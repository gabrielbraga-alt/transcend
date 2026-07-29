-- ============================================================
-- 1. Tabela de perfis — liga cada usuário do Supabase Auth
--    a um papel (admin ou especialista)
-- ============================================================
create table if not exists perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'especialista')),
  nome text
);

alter table perfis enable row level security;

create policy "usuario ve seu proprio perfil"
  on perfis for select
  using (auth.uid() = id);

-- ============================================================
-- 2. Liga RLS nas tabelas de dados — a partir de agora só quem
--    estiver logado (com token válido) consegue ler/gravar
-- ============================================================
alter table clientes enable row level security;
alter table historico_verificacoes enable row level security;

create policy "autenticados leem clientes"
  on clientes for select
  using (auth.role() = 'authenticated');

create policy "autenticados atualizam clientes"
  on clientes for update
  using (auth.role() = 'authenticated');

create policy "autenticados leem historico"
  on historico_verificacoes for select
  using (auth.role() = 'authenticated');

-- Tabela com o histórico diário de métricas por campanha
alter table metricas_diarias enable row level security;

create policy "autenticados leem metricas_diarias"
  on metricas_diarias for select
  using (auth.role() = 'authenticated');

-- ============================================================
-- 3. Depois de rodar isso, você ainda precisa:
--
--    a) Criar os 2 usuários em Authentication → Users → Add user
--       (um e-mail/senha pro admin, outro pro especialista)
--
--    b) Pegar o UUID de cada usuário criado (aparece na lista de
--       Users) e rodar, pra CADA um, algo como:
--
--       insert into perfis (id, role, nome) values
--         ('uuid-do-admin-aqui', 'admin', 'Nome do Admin');
--
--       insert into perfis (id, role, nome) values
--         ('uuid-do-especialista-aqui', 'especialista', 'Nome do Especialista');
--
--    c) No n8n, trocar a credencial do Supabase de "anon key"
--       para "service_role key" (Project Settings → API), já
--       que agora o RLS bloqueia gravações sem login — e o
--       n8n roda no servidor, então é seguro usar a service_role
--       lá (nunca no front-end).
-- ============================================================
