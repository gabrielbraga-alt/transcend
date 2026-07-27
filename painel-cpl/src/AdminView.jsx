import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './lib/supabaseClient.js';

function normalizeStatus(status) {
  const s = (status || '').toLowerCase();
  if (s === 'alto') return 'alto';
  if (s === 'otimizado') return 'otimizado';
  return 'normal';
}

function fmtMoney(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

const STATUS_LABEL = { alto: 'Alto', normal: 'Normal', otimizado: 'Otimizado' };

export default function AdminView({ userEmail, onLogout }) {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [especialistaFiltro, setEspecialistaFiltro] = useState('todos');
  const [sortKey, setSortKey] = useState('cpl');
  const [sortDir, setSortDir] = useState('desc');

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [
        { data: clientesData, error: clientesError },
        { data: historicoData },
        { data: sugestoesData },
      ] = await Promise.all([
        supabase.from('clientes').select('*').order('Cliente', { ascending: true }),
        supabase
          .from('historico_verificacoes')
          .select('cliente_id,custo_por_resultado,data_verificacao')
          .order('data_verificacao', { ascending: false })
          .limit(1000),
        supabase
          .from('resumo_ia')
          .select('cliente_id,status_ia,resumo,sugestao,criado_em')
          .order('criado_em', { ascending: false })
          .limit(500),
      ]);

      if (clientesError) throw new Error(clientesError.message);

      let latestByClient = {};
      if (historicoData) {
        for (const row of historicoData) {
          if (!latestByClient[row.cliente_id]) latestByClient[row.cliente_id] = row;
        }
      }

      let latestSugestaoByAdAccount = {};
      if (sugestoesData) {
        for (const row of sugestoesData) {
          if (!latestSugestaoByAdAccount[row.cliente_id]) latestSugestaoByAdAccount[row.cliente_id] = row;
        }
      }

      const merged = clientesData.map((c) => ({
        ...c,
        cpl: c.cpl_atual ?? latestByClient[c.id]?.custo_por_resultado ?? null,
        ultima_verificacao: latestByClient[c.id]?.data_verificacao ?? c.atualizado_em ?? null,
        sugestaoIA: latestSugestaoByAdAccount[c.ID] ?? null,
      }));

      setClientes(merged);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const especialistas = useMemo(() => {
    const set = new Set(clientes.map((c) => c.Especialista).filter(Boolean));
    return Array.from(set).sort();
  }, [clientes]);

  const filtrados = useMemo(() => {
    let list = clientes.filter((c) => {
      if (statusFiltro !== 'todos' && normalizeStatus(c.Status) !== statusFiltro) return false;
      if (especialistaFiltro !== 'todos' && c.Especialista !== especialistaFiltro) return false;
      if (busca && !c.Cliente?.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      let av, bv;
      if (sortKey === 'cliente') { av = a.Cliente || ''; bv = b.Cliente || ''; }
      else if (sortKey === 'especialista') { av = a.Especialista || ''; bv = b.Especialista || ''; }
      else if (sortKey === 'cpl') { av = a.cpl ?? -1; bv = b.cpl ?? -1; }
      else if (sortKey === 'max') { av = a['Custo por Resultado Máximo'] ?? -1; bv = b['Custo por Resultado Máximo'] ?? -1; }
      else { av = a.Cliente || ''; bv = b.Cliente || ''; }

      if (typeof av === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });

    return list;
  }, [clientes, statusFiltro, especialistaFiltro, busca, sortKey, sortDir]);

  const counts = useMemo(() => {
    const c = { alto: 0, normal: 0, otimizado: 0 };
    for (const cli of clientes) c[normalizeStatus(cli.Status)]++;
    return c;
  }, [clientes]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortArrow = ({ colKey }) =>
    sortKey === colKey ? <span className="sort-arrow">{sortDir === 'asc' ? '↑' : '↓'}</span> : null;

  return (
    <div className="admin-root">
      <style>{`
        .admin-root {
          --bg: #0a0f1a;
          --bg-panel: #10192a;
          --bg-row: #101a2c;
          --bg-row-hover: #142236;
          --border: #22334a;
          --border-soft: #182740;
          --text: #e7eef7;
          --text-dim: #8a9cb4;
          --text-faint: #56687f;
          --green: #4ad894;
          --green-dim: #123425;
          --amber: #ecab4f;
          --amber-dim: #3e2c14;
          --blue: #4fb3f0;
          --blue-dim: #122b41;
          --red: #ea6b57;
          --mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
          --sans: 'Inter', -apple-system, 'Segoe UI', sans-serif;

          background: var(--bg);
          background-image:
            radial-gradient(ellipse 900px 500px at 8% -8%, #163a5a33 0%, transparent 55%),
            radial-gradient(ellipse 900px 600px at 95% 105%, #0f2a4230 0%, transparent 55%);
          color: var(--text);
          font-family: var(--sans);
          min-height: 100vh;
          padding: 32px 40px 56px;
          box-sizing: border-box;
        }
        .admin-root * { box-sizing: border-box; }
        .admin-inner { max-width: 1280px; margin: 0 auto; }

        .header {
          display: flex; justify-content: space-between; align-items: center;
          gap: 20px; flex-wrap: wrap; margin-bottom: 22px; padding-bottom: 18px;
          border-bottom: 1px solid var(--border-soft);
        }
        .header-brand { display: flex; align-items: center; gap: 14px; }
        .header-logo {
          width: 38px; height: 38px; border-radius: 10px; object-fit: cover;
          border: 1px solid var(--border);
          box-shadow: 0 0 0 3px #4fb3f014, 0 4px 14px rgba(79,179,240,0.12);
        }
        .header-title h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
        .eyebrow {
          font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--text-faint);
        }
        .header-user {
          display: flex; align-items: center; gap: 10px;
          font-family: var(--mono); font-size: 11px; color: var(--text-faint);
        }
        .logout-btn {
          font-family: var(--sans); font-size: 11.5px; font-weight: 600;
          background: transparent; border: 1px solid var(--border); color: var(--text-dim);
          padding: 5px 11px; border-radius: 7px; cursor: pointer; transition: all 0.15s ease;
        }
        .logout-btn:hover { border-color: var(--red); color: var(--red); }

        .summary-row { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .summary-chip {
          font-family: var(--mono); font-size: 12px; padding: 8px 14px; border-radius: 9px;
          border: 1px solid var(--border-soft); background: var(--bg-panel); color: var(--text-dim);
          display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.15s ease;
        }
        .summary-chip:hover { border-color: var(--border); }
        .summary-chip.active { border-color: var(--chip-accent); color: var(--text); background: #14203a; }
        .summary-chip b { color: var(--text); font-weight: 700; font-size: 13.5px; }
        .chip-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--chip-accent); }

        .controls { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
        .select, .search-input {
          background: var(--bg-panel); border: 1px solid var(--border); color: var(--text);
          font-family: var(--sans); font-size: 13px; padding: 9px 13px; border-radius: 8px;
          outline: none; transition: border-color 0.15s ease;
        }
        .select:focus, .search-input:focus { border-color: var(--blue); }
        .search-input { min-width: 220px; }
        .search-input::placeholder { color: var(--text-faint); }

        .table-wrap {
          background: var(--bg-panel); border: 1px solid rgba(255,255,255,0.055); border-radius: 16px;
          box-shadow: 0 1px 0 rgba(255,255,255,0.03) inset, 0 12px 30px -18px rgba(0,0,0,0.6);
          overflow: hidden;
        }
        table { width: 100%; border-collapse: collapse; }
        thead th {
          text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em;
          color: var(--text-faint); font-weight: 600; padding: 12px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.055); cursor: pointer; user-select: none;
          white-space: nowrap;
        }
        thead th:hover { color: var(--text-dim); }
        .sort-arrow { color: var(--blue); margin-left: 4px; }
        tbody tr { border-bottom: 1px solid rgba(255,255,255,0.045); transition: background 0.1s ease; }
        tbody tr:last-child { border-bottom: none; }
        tbody tr:hover { background: var(--bg-row-hover); }
        td { padding: 12px 16px; font-size: 13.5px; vertical-align: middle; }
        .td-cliente { font-weight: 650; color: var(--text); }
        .td-especialista { color: var(--text-dim); }
        .td-mono { font-family: var(--mono); }
        .td-mono.over { color: var(--red); font-weight: 700; }
        .td-atualizado { color: var(--text-faint); font-family: var(--mono); font-size: 12px; }

        .status-badge {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--mono); font-size: 10.5px; font-weight: 600;
          padding: 4px 9px; border-radius: 6px;
        }
        .status-badge.alto { background: var(--amber-dim); color: var(--amber); }
        .status-badge.normal { background: var(--green-dim); color: var(--green); }
        .status-badge.otimizado { background: var(--blue-dim); color: var(--blue); }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

        .ia-badge {
          font-family: var(--mono); font-size: 10px; font-weight: 700; text-transform: uppercase;
          padding: 3px 8px; border-radius: 6px; cursor: help; white-space: nowrap;
        }
        .ia-badge.ia-crítico { background: #3e1a16; color: var(--red); }
        .ia-badge.ia-atenção { background: var(--amber-dim); color: var(--amber); }
        .ia-badge.ia-ok, .ia-badge.ia-saudável { background: var(--green-dim); color: var(--green); }
        .ia-badge-empty { color: var(--text-faint); }

        .obs-cell {
          max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          color: var(--text-dim); font-size: 12.5px;
        }
        .empty-row { text-align: center; padding: 40px; color: var(--text-faint); font-family: var(--mono); font-size: 13px; }

        .loading-state, .error-state {
          font-family: var(--mono); font-size: 13px; color: var(--text-dim); padding: 60px; text-align: center;
        }
        .error-state { color: var(--red); }

        @media (max-width: 900px) {
          .admin-root { padding: 20px 14px 40px; }
          .table-wrap { overflow-x: auto; }
          table { min-width: 720px; }
        }
      `}</style>

      <div className="admin-inner">
        <div className="header">
          <div className="header-brand">
            <img src="/logo.jpg" alt="logo" className="header-logo" />
            <div>
              <div className="eyebrow">Visão geral · admin</div>
              <h1>Todos os clientes</h1>
            </div>
          </div>
          <div className="header-user">
            <span>{userEmail}</span>
            <button className="logout-btn" onClick={onLogout}>sair</button>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">carregando dados…</div>
        ) : error ? (
          <div className="error-state">não foi possível carregar os dados — {error}</div>
        ) : (
          <>
            <div className="summary-row">
              <div
                className={`summary-chip ${statusFiltro === 'todos' ? 'active' : ''}`}
                style={{ '--chip-accent': 'var(--blue)' }}
                onClick={() => setStatusFiltro('todos')}
              >
                <span className="chip-dot" /> <b>{clientes.length}</b> total
              </div>
              <div
                className={`summary-chip ${statusFiltro === 'alto' ? 'active' : ''}`}
                style={{ '--chip-accent': 'var(--amber)' }}
                onClick={() => setStatusFiltro('alto')}
              >
                <span className="chip-dot" /> <b>{counts.alto}</b> alto
              </div>
              <div
                className={`summary-chip ${statusFiltro === 'normal' ? 'active' : ''}`}
                style={{ '--chip-accent': 'var(--green)' }}
                onClick={() => setStatusFiltro('normal')}
              >
                <span className="chip-dot" /> <b>{counts.normal}</b> normal
              </div>
              <div
                className={`summary-chip ${statusFiltro === 'otimizado' ? 'active' : ''}`}
                style={{ '--chip-accent': 'var(--blue)' }}
                onClick={() => setStatusFiltro('otimizado')}
              >
                <span className="chip-dot" /> <b>{counts.otimizado}</b> otimizados
              </div>
            </div>

            <div className="controls">
              <select className="select" value={especialistaFiltro} onChange={(e) => setEspecialistaFiltro(e.target.value)}>
                <option value="todos">todos os especialistas</option>
                {especialistas.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
              <input
                className="search-input"
                placeholder="buscar cliente…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th onClick={() => handleSort('cliente')}>Cliente<SortArrow colKey="cliente" /></th>
                    <th onClick={() => handleSort('especialista')}>Especialista<SortArrow colKey="especialista" /></th>
                    <th>Status</th>
                    <th onClick={() => handleSort('cpl')}>CPL atual<SortArrow colKey="cpl" /></th>
                    <th onClick={() => handleSort('max')}>CPL teto<SortArrow colKey="max" /></th>
                    <th>IA</th>
                    <th>Observação</th>
                    <th>Atualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.length === 0 ? (
                    <tr><td colSpan={8} className="empty-row">nenhum cliente encontrado</td></tr>
                  ) : (
                    filtrados.map((c) => {
                      const status = normalizeStatus(c.Status);
                      const over =
                        c.cpl !== null && c.cpl !== undefined &&
                        c['Custo por Resultado Máximo'] !== null &&
                        c.cpl > c['Custo por Resultado Máximo'];
                      const iaStatus = c.sugestaoIA?.status_ia?.toLowerCase();
                      return (
                        <tr key={c.id}>
                          <td className="td-cliente">{c.Cliente}</td>
                          <td className="td-especialista">{c.Especialista || '—'}</td>
                          <td>
                            <span className={`status-badge ${status}`}>
                              <span className="status-dot" />
                              {STATUS_LABEL[status]}
                            </span>
                          </td>
                          <td className={`td-mono ${over ? 'over' : ''}`}>{fmtMoney(c.cpl)}</td>
                          <td className="td-mono">{fmtMoney(c['Custo por Resultado Máximo'])}</td>
                          <td>
                            {c.sugestaoIA ? (
                              <span
                                className={`ia-badge ia-${iaStatus}`}
                                title={`${c.sugestaoIA.resumo || ''}${c.sugestaoIA.sugestao ? '\n\nSugestão: ' + c.sugestaoIA.sugestao : ''}`}
                              >
                                {c.sugestaoIA.status_ia}
                              </span>
                            ) : (
                              <span className="ia-badge-empty">—</span>
                            )}
                          </td>
                          <td className="obs-cell" title={c.observacao || ''}>{c.observacao || '—'}</td>
                          <td className="td-atualizado">{timeAgo(c.ultima_verificacao)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
