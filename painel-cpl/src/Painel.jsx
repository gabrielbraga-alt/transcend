import { useState, useEffect, useMemo, useCallback } from 'react';

const SUPABASE_URL = 'https://rtbwdzvtphnhredutwur.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0YndkenZ0cGhuaHJlZHV0d3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMTE2NjksImV4cCI6MjEwMDU4NzY2OX0.PHV0DFj4pp5_X-Dc2IrtlF7pFibTxeGZAdj41mKOzSw';

const HEADERS = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
};

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

function fmtMoney(v) {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function ClienteCard({ cliente, onSave }) {
  const [obs, setObs] = useState(cliente.observacao || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = obs !== (cliente.observacao || '');
  const isAlto = cliente.Status === 'alto';

  const handleSave = async () => {
    setSaving(true);
    await onSave(cliente.id, obs);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const custo = cliente['Custo por Resultado Máximo'];

  return (
    <div className={`card ${isAlto ? 'card-alto' : 'card-normal'}`}>
      <div className="card-top">
        <div className="card-id">
          <span className="dot" />
          <span className="cliente-nome">{cliente.Cliente}</span>
        </div>
        <span className={`status-tag ${isAlto ? 'tag-alto' : 'tag-normal'}`}>
          {isAlto ? 'ALTO' : 'NORMAL'}
        </span>
      </div>

      <div className="card-meta">
        <div className="meta-row">
          <span className="meta-label">especialista</span>
          <span className="meta-val">{cliente.Especialista || '—'}</span>
        </div>
        <div className="meta-row">
          <span className="meta-label">id conta</span>
          <span className="meta-val mono">{cliente.ID || '—'}</span>
        </div>
        <div className="meta-row">
          <span className="meta-label">cpl máx</span>
          <span className="meta-val mono">{fmtMoney(custo)}</span>
        </div>
        <div className="meta-row">
          <span className="meta-label">atualizado</span>
          <span className="meta-val mono">{timeAgo(cliente.atualizado_em)}</span>
        </div>
      </div>

      <div className="obs-block">
        <label className="obs-label" htmlFor={`obs-${cliente.id}`}>observação</label>
        <textarea
          id={`obs-${cliente.id}`}
          className="obs-input"
          placeholder="ex: otimização feita, aguardando ação..."
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          rows={2}
        />
        <div className="obs-actions">
          <span className={`obs-status ${saved ? 'obs-status-show' : ''}`}>salvo</span>
          <button
            className="save-btn"
            disabled={!dirty || saving}
            onClick={handleSave}
          >
            {saving ? 'salvando…' : 'salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Painel() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [especialistaFiltro, setEspecialistaFiltro] = useState('todos');
  const [busca, setBusca] = useState('');
  const [lastFetch, setLastFetch] = useState(null);

  const fetchClientes = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes?select=*&order=Cliente.asc`, {
        headers: HEADERS,
      });
      if (!res.ok) {
        let body = '';
        try { body = await res.text(); } catch {}
        throw new Error(`HTTP ${res.status} ${res.statusText} — ${body.slice(0, 300)}`);
      }
      const data = await res.json();
      setClientes(data);
      setLastFetch(new Date());
    } catch (e) {
      setError(e.message || String(e) || 'falha desconhecida ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClientes();
    const interval = setInterval(fetchClientes, 60000);
    return () => clearInterval(interval);
  }, [fetchClientes]);

  const handleSaveObs = useCallback(async (id, novoValor) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          ...HEADERS,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ observacao: novoValor, atualizado_em: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error('falha ao salvar');
      setClientes((prev) =>
        prev.map((c) => (c.id === id ? { ...c, observacao: novoValor, atualizado_em: new Date().toISOString() } : c))
      );
    } catch (e) {
      alert('Não foi possível salvar a observação. Tente novamente.');
    }
  }, []);

  const especialistas = useMemo(() => {
    const set = new Set(clientes.map((c) => c.Especialista).filter(Boolean));
    return Array.from(set).sort();
  }, [clientes]);

  const filtrados = useMemo(() => {
    return clientes.filter((c) => {
      if (especialistaFiltro !== 'todos' && c.Especialista !== especialistaFiltro) return false;
      if (busca && !c.Cliente?.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [clientes, especialistaFiltro, busca]);

  const altos = filtrados.filter((c) => c.Status === 'alto');
  const normais = filtrados.filter((c) => c.Status !== 'alto');

  return (
    <div className="painel-root">
      <style>{`
        .painel-root {
          --bg: #0c1420;
          --bg-panel: #121d2e;
          --bg-card: #16233688;
          --border: #24344a;
          --border-soft: #1b2a3d;
          --text: #dbe6f2;
          --text-dim: #8296ad;
          --text-faint: #566780;
          --green: #4fd68c;
          --green-dim: #1c3a2c;
          --amber: #e0a54d;
          --amber-dim: #3d2e17;
          --mono: 'JetBrains Mono', 'SF Mono', 'Roboto Mono', Consolas, monospace;
          --sans: 'Inter', -apple-system, 'Segoe UI', sans-serif;

          background: var(--bg);
          background-image:
            radial-gradient(circle at 15% 0%, #16273d55 0%, transparent 45%),
            radial-gradient(circle at 85% 100%, #14263a44 0%, transparent 50%);
          color: var(--text);
          font-family: var(--sans);
          min-height: 100vh;
          padding: 28px 24px 60px;
          box-sizing: border-box;
        }
        .painel-root * { box-sizing: border-box; }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 22px;
          padding-bottom: 18px;
          border-bottom: 1px solid var(--border-soft);
        }
        .header-title {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .eyebrow {
          font-family: var(--mono);
          font-size: 11px;
          letter-spacing: 0.14em;
          color: var(--text-faint);
          text-transform: uppercase;
        }
        .header-title h1 {
          margin: 0;
          font-size: 22px;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: var(--text);
        }
        .header-status {
          font-family: var(--mono);
          font-size: 11.5px;
          color: var(--text-faint);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .pulse {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--green);
          box-shadow: 0 0 0 0 rgba(79,214,140,0.6);
          animation: pulse 2.2s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(79,214,140,0.45); }
          70% { box-shadow: 0 0 0 6px rgba(79,214,140,0); }
          100% { box-shadow: 0 0 0 0 rgba(79,214,140,0); }
        }

        .summary-bar {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .summary-chip {
          font-family: var(--mono);
          font-size: 12px;
          padding: 7px 13px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: var(--bg-panel);
          color: var(--text-dim);
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .summary-chip b { color: var(--text); font-weight: 600; }
        .chip-dot { width: 6px; height: 6px; border-radius: 50%; }

        .controls {
          display: flex;
          gap: 10px;
          margin-bottom: 26px;
          flex-wrap: wrap;
          align-items: center;
        }
        .select, .search-input {
          background: var(--bg-panel);
          border: 1px solid var(--border);
          color: var(--text);
          font-family: var(--sans);
          font-size: 13px;
          padding: 8px 12px;
          border-radius: 6px;
          outline: none;
        }
        .select:focus, .search-input:focus {
          border-color: var(--green);
        }
        .search-input {
          min-width: 220px;
        }
        .search-input::placeholder { color: var(--text-faint); }

        .section-heading {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 30px 0 14px;
        }
        .section-heading h2 {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin: 0;
        }
        .section-heading.alto h2 { color: var(--amber); }
        .section-heading.normal h2 { color: var(--green); }
        .section-line {
          flex: 1;
          height: 1px;
          background: var(--border-soft);
        }
        .section-count {
          font-family: var(--mono);
          font-size: 12px;
          color: var(--text-faint);
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 14px;
        }

        .card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          transition: border-color 0.15s ease;
        }
        .card-alto { border-left: 3px solid var(--amber); }
        .card-normal { border-left: 3px solid var(--green); }

        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .card-id {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .card-alto .dot { background: var(--amber); }
        .card-normal .dot { background: var(--green); }
        .cliente-nome {
          font-weight: 600;
          font-size: 14.5px;
          color: var(--text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .status-tag {
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0.08em;
          padding: 3px 8px;
          border-radius: 4px;
          flex-shrink: 0;
        }
        .tag-alto { background: var(--amber-dim); color: var(--amber); }
        .tag-normal { background: var(--green-dim); color: var(--green); }

        .card-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 10px;
        }
        .meta-row {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .meta-label {
          font-size: 10px;
          color: var(--text-faint);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .meta-val {
          font-size: 13px;
          color: var(--text);
        }
        .meta-val.mono { font-family: var(--mono); font-size: 12.5px; }

        .obs-block {
          border-top: 1px solid var(--border-soft);
          padding-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .obs-label {
          font-size: 10px;
          color: var(--text-faint);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .obs-input {
          background: #0e1826;
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text);
          font-family: var(--sans);
          font-size: 13px;
          padding: 8px 10px;
          resize: vertical;
          outline: none;
          min-height: 42px;
        }
        .obs-input:focus { border-color: var(--green); }
        .obs-input::placeholder { color: var(--text-faint); }

        .obs-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 10px;
        }
        .obs-status {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--green);
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .obs-status-show { opacity: 1; }
        .save-btn {
          font-family: var(--sans);
          font-size: 12.5px;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: #1a2942;
          color: var(--text);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .save-btn:hover:not(:disabled) {
          border-color: var(--green);
          color: var(--green);
        }
        .save-btn:disabled {
          opacity: 0.4;
          cursor: default;
        }

        .empty-state {
          font-family: var(--mono);
          font-size: 13px;
          color: var(--text-faint);
          padding: 24px;
          text-align: center;
          border: 1px dashed var(--border);
          border-radius: 8px;
        }

        .loading-state, .error-state {
          font-family: var(--mono);
          font-size: 13px;
          color: var(--text-dim);
          padding: 40px;
          text-align: center;
        }
        .error-state { color: var(--amber); }

        @media (max-width: 600px) {
          .header { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <div className="header">
        <div className="header-title">
          <span className="eyebrow">Monitoramento · CPL por cliente</span>
          <h1>Painel de Campanhas</h1>
        </div>
        <div className="header-status">
          <span className="pulse" />
          {lastFetch ? `atualizado ${timeAgo(lastFetch.toISOString())}` : 'conectando…'}
        </div>
      </div>

      {loading ? (
        <div className="loading-state">carregando dados…</div>
      ) : error ? (
        <div className="error-state">não foi possível carregar os dados — {error}</div>
      ) : (
        <>
          <div className="summary-bar">
            <div className="summary-chip">
              <span className="chip-dot" style={{ background: 'var(--amber)' }} />
              <b>{altos.length}</b> em alto
            </div>
            <div className="summary-chip">
              <span className="chip-dot" style={{ background: 'var(--green)' }} />
              <b>{normais.length}</b> em normal
            </div>
            <div className="summary-chip">
              <b>{filtrados.length}</b> total exibido
            </div>
          </div>

          <div className="controls">
            <select
              className="select"
              value={especialistaFiltro}
              onChange={(e) => setEspecialistaFiltro(e.target.value)}
            >
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

          <div className="section-heading alto">
            <h2>Alto</h2>
            <div className="section-line" />
            <span className="section-count">{altos.length}</span>
          </div>
          {altos.length === 0 ? (
            <div className="empty-state">nenhum cliente em alto no momento</div>
          ) : (
            <div className="grid">
              {altos.map((c) => (
                <ClienteCard key={c.id} cliente={c} onSave={handleSaveObs} />
              ))}
            </div>
          )}

          <div className="section-heading normal">
            <h2>Normal</h2>
            <div className="section-line" />
            <span className="section-count">{normais.length}</span>
          </div>
          {normais.length === 0 ? (
            <div className="empty-state">nenhum cliente em normal no momento</div>
          ) : (
            <div className="grid">
              {normais.map((c) => (
                <ClienteCard key={c.id} cliente={c} onSave={handleSaveObs} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
