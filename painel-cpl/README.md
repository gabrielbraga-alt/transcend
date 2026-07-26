# Painel de Campanhas (CPL)

Painel de monitoramento de custo por lead, lendo direto da tabela `clientes` no Supabase.

## Rodar localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

## Deploy no Vercel (mais simples)

1. Crie um repositório no GitHub e suba essa pasta inteira (ou use `vercel --prod` direto pela CLI, sem precisar de GitHub).
2. Acesse https://vercel.com, clique em **Add New → Project**, importe o repositório.
3. Framework preset: **Vite** (o Vercel detecta sozinho).
4. Build command: `npm run build` — Output directory: `dist` (padrão, não precisa mexer).
5. Clique em **Deploy**. Pronto — em ~1 minuto o painel está no ar com uma URL pública.

## Deploy no Netlify (alternativa)

1. Acesse https://netlify.com → **Add new site → Import an existing project**.
2. Conecte o repositório.
3. Build command: `npm run build` — Publish directory: `dist`.
4. Deploy.

## Sem GitHub (deploy direto da pasta)

Se preferir não usar Git:

```bash
npm install
npm run build
```

Isso gera a pasta `dist/`. No Netlify, existe a opção de **arrastar essa pasta `dist` direto no navegador** (netlify.com/drop) — sem precisar de conta nem repositório.

## Variáveis

As credenciais do Supabase (URL + anon key) estão direto em `src/Painel.jsx`, já que a anon key é segura para uso no front-end. Nenhuma variável de ambiente é necessária.
