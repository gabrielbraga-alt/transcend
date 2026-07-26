import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

const SUPABASE_URL = 'https://rtbwdzvtphnhredutwur.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0YndkenZ0cGhuaHJlZHV0d3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMTE2NjksImV4cCI6MjEwMDU4NzY2OX0.PHV0DFj4pp5_X-Dc2IrtlF7pFibTxeGZAdj41mKOzSw';

const HEADERS = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
};

const COLUMNS = [
  { key: 'alto', title: 'Custo por lead alto', accent: 'var(--amber)', accentDim: 'var(--amber-dim)' },
  { key: 'normal', title: 'Custo por lead normal', accent: 'var(--green)', accentDim: 'var(--green-dim)' },
  { key: 'otimizado', title: 'Otimizados', accent: 'var(--blue)', accentDim: 'var(--blue-dim)' },
];

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

function Card({ cliente, onOpen, onDragStart, columnKey }) {
  const overMax =
    cliente.cpl !== null &&
    cliente.cpl !== undefined &&
    cliente['Custo por Resultado Máximo'] !== null &&
    cliente.cpl > cliente['Custo por Resultado Máximo'];

  return (
    <div
      className={`kcard kcard-${columnKey}`}
      draggable
      onDragStart={(e) => onDragStart(e, cliente.id)}
      onClick={() => onOpen(cliente)}
    >
      <div className="kcard-head">
        <span className="kcard-name">{cliente.Cliente}</span>
        {cliente.observacao ? <span className="kcard-note-dot" title="Tem observação" /> : null}
      </div>
      <div className="kcard-especialista">{cliente.Especialista || 'sem especialista'}</div>
      <div className="kcard-cpl-row">
        <div className="kcard-cpl-block">
          <span className="kcard-cpl-label">CPL atual</span>
          <span className={`kcard-cpl-value ${overMax ? 'over' : ''}`}>{fmtMoney(cliente.cpl)}</span>
        </div>
        <div className="kcard-cpl-block right">
          <span className="kcard-cpl-label">máximo</span>
          <span className="kcard-cpl-max">{fmtMoney(cliente['Custo por Resultado Máximo'])}</span>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ cliente, onClose, onSave, onMarkOtimizado, onUnmarkOtimizado }) {
  const [obs, setObs] = useState(cliente.observacao || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const isOtimizado = normalizeStatus(cliente.Status) === 'otimizado';

  const handleSave = async () => {
    setSaving(true);
    await onSave(cliente.id, obs);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-eyebrow">{cliente.Especialista || 'sem especialista'}</div>
            <h2>{cliente.Cliente}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <div className="modal-stats">
          <div className="modal-stat">
            <span className="modal-stat-label">CPL atual</span>
            <span className="modal-stat-value">{fmtMoney(cliente.cpl)}</span>
          </div>
          <div className="modal-stat">
            <span className="modal-stat-label">CPL máximo</span>
            <span className="modal-stat-value">{fmtMoney(cliente['Custo por Resultado Máximo'])}</span>
          </div>
          <div className="modal-stat">
            <span className="modal-stat-label">última verificação</span>
            <span className="modal-stat-value small">{timeAgo(cliente.ultima_verificacao)}</span>
          </div>
        </div>

        <label className="modal-label" htmlFor="modal-obs">observação</label>
        <textarea
          id="modal-obs"
          className="modal-textarea"
          placeholder="ex: otimização feita, aguardando ação do cliente..."
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          rows={4}
        />

        <div className="modal-actions">
          <button
            className={`modal-btn ${isOtimizado ? 'ghost' : 'primary-otimizado'}`}
            onClick={() => (isOtimizado ? onUnmarkOtimizado(cliente.id) : onMarkOtimizado(cliente.id))}
          >
            {isOtimizado ? '↩ voltar para status calculado' : '✓ marcar como otimizado'}
          </button>
          <div className="modal-actions-right">
            <span className={`modal-saved ${saved ? 'show' : ''}`}>salvo</span>
            <button className="modal-btn primary" disabled={saving} onClick={handleSave}>
              {saving ? 'salvando…' : 'salvar observação'}
            </button>
          </div>
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
  const [selected, setSelected] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const draggingId = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [clientesRes, historicoRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/clientes?select=*&order=Cliente.asc`, { headers: HEADERS }),
        fetch(
          `${SUPABASE_URL}/rest/v1/historico_verificacoes?select=cliente_id,custo_por_resultado,data_verificacao&order=data_verificacao.desc&limit=1000`,
          { headers: HEADERS }
        ),
      ]);

      if (!clientesRes.ok) {
        const body = await clientesRes.text().catch(() => '');
        throw new Error(`clientes: HTTP ${clientesRes.status} — ${body.slice(0, 200)}`);
      }

      const clientesData = await clientesRes.json();

      let latestByClient = {};
      if (historicoRes.ok) {
        const historicoData = await historicoRes.json();
        for (const row of historicoData) {
          if (!latestByClient[row.cliente_id]) {
            latestByClient[row.cliente_id] = row;
          }
        }
      }

      const merged = clientesData.map((c) => ({
        ...c,
        cpl: latestByClient[c.id]?.custo_por_resultado ?? null,
        ultima_verificacao: latestByClient[c.id]?.data_verificacao ?? null,
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

  const updateStatus = useCallback(async (id, newStatus) => {
    setClientes((prev) => prev.map((c) => (c.id === id ? { ...c, Status: newStatus } : c)));
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ Status: newStatus, atualizado_em: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error('falha ao salvar status');
    } catch (e) {
      fetchData();
    }
  }, [fetchData]);

  const handleSaveObs = useCallback(async (id, novoValor) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clientes?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...HEADERS, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ observacao: novoValor, atualizado_em: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error('falha ao salvar observação');
      setClientes((prev) => prev.map((c) => (c.id === id ? { ...c, observacao: novoValor } : c)));
      setSelected((prev) => (prev && prev.id === id ? { ...prev, observacao: novoValor } : prev));
    } catch (e) {
      alert('Não foi possível salvar a observação. Tente novamente.');
    }
  }, []);

  const handleDragStart = (e, id) => {
    draggingId.current = id;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (colKey) => {
    if (draggingId.current) {
      const dbStatus = colKey === 'alto' ? 'Alto' : colKey === 'otimizado' ? 'Otimizado' : 'Normal';
      updateStatus(draggingId.current, dbStatus);
    }
    draggingId.current = null;
    setDragOverCol(null);
  };

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

  const byColumn = useMemo(() => {
    const groups = { alto: [], normal: [], otimizado: [] };
    for (const c of filtrados) {
      groups[normalizeStatus(c.Status)].push(c);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        const av = a.cpl ?? -1;
        const bv = b.cpl ?? -1;
        return bv - av;
      });
    }
    return groups;
  }, [filtrados]);

  return (
    <div className="painel-root">
      <style>{`
        .painel-root {
          --bg: #0b1220;
          --bg-panel: #111b2c;
          --bg-card: #14203488;
          --bg-card-hover: #172741;
          --border: #223349;
          --border-soft: #1a2a3e;
          --text: #dfe9f5;
          --text-dim: #8698b0;
          --text-faint: #556780;
          --green: #4fd68c;
          --green-dim: #163527;
          --amber: #e3a94e;
          --amber-dim: #3c2c15;
          --blue: #5aa9e6;
          --blue-dim: #16293c;
          --red: #e2664f;
          --mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
          --sans: 'Inter', -apple-system, 'Segoe UI', sans-serif;

          background: var(--bg);
          background-image:
            radial-gradient(circle at 10% -10%, #16273d55 0%, transparent 45%),
            radial-gradient(circle at 90% 110%, #14263a55 0%, transparent 50%);
          color: var(--text);
          font-family: var(--sans);
          min-height: 100vh;
          padding: 24px 24px 40px;
          box-sizing: border-box;
        }
        .painel-root * { box-sizing: border-box; }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border-soft);
        }
        .header-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .header-logo {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          object-fit: cover;
          border: 1px solid var(--border);
        }
        .header-title h1 {
          margin: 0;
          font-size: 19px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }
        .header-title .eyebrow {
          font-family: var(--mono);
          font-size: 10.5px;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        .header-status {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--text-faint);
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .pulse {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--green);
          animation: pulse 2.2s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(79,214,140,0.45); }
          70% { box-shadow: 0 0 0 6px rgba(79,214,140,0); }
          100% { box-shadow: 0 0 0 0 rgba(79,214,140,0); }
        }

        .controls {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .select, .search-input {
          background: var(--bg-panel);
          border: 1px solid var(--border);
          color: var(--text);
          font-family: var(--sans);
          font-size: 13px;
          padding: 8px 12px;
          border-radius: 7px;
          outline: none;
        }
        .select:focus, .search-input:focus { border-color: var(--blue); }
        .search-input { min-width: 200px; }
        .search-input::placeholder { color: var(--text-faint); }

        .board {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .board { grid-template-columns: 1fr; }
        }

        .column {
          background: var(--bg-panel);
          border: 1px solid var(--border-soft);
          border-radius: 12px;
          padding: 14px;
          min-height: 200px;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .column.drag-over {
          border-color: var(--col-accent);
          background: #14203440;
        }

        .column-head {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        .column-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--col-accent); flex-shrink: 0; }
        .column-title {
          font-size: 12.5px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: var(--text);
          flex: 1;
        }
        .column-count {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--text-faint);
          background: var(--bg-card);
          border: 1px solid var(--border-soft);
          padding: 1px 7px;
          border-radius: 20px;
        }

        .column-cards {
          display: flex;
          flex-direction: column;
          gap: 9px;
          min-height: 80px;
        }
        .column-empty {
          font-family: var(--mono);
          font-size: 11.5px;
          color: var(--text-faint);
          text-align: center;
          padding: 18px 8px;
          border: 1px dashed var(--border-soft);
          border-radius: 8px;
        }

        .kcard {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-left: 3px solid var(--col-accent);
          border-radius: 9px;
          padding: 12px 13px;
          cursor: grab;
          transition: background 0.12s ease, transform 0.08s ease, border-color 0.12s ease;
        }
        .kcard:hover { background: var(--bg-card-hover); border-color: #2e4560; }
        .kcard:active { cursor: grabbing; transform: scale(0.98); }

        .kcard-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 3px;
        }
        .kcard-name {
          font-weight: 600;
          font-size: 14px;
          color: var(--text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .kcard-note-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--blue);
          flex-shrink: 0;
        }
        .kcard-especialista {
          font-size: 11.5px;
          color: var(--text-faint);
          margin-bottom: 10px;
        }

        .kcard-cpl-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          border-top: 1px solid var(--border-soft);
          padding-top: 9px;
        }
        .kcard-cpl-block { display: flex; flex-direction: column; gap: 2px; }
        .kcard-cpl-block.right { align-items: flex-end; }
        .kcard-cpl-label {
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-faint);
        }
        .kcard-cpl-value {
          font-family: var(--mono);
          font-size: 15px;
          font-weight: 600;
          color: var(--text);
        }
        .kcard-cpl-value.over { color: var(--red); }
        .kcard-cpl-max {
          font-family: var(--mono);
          font-size: 12px;
          color: var(--text-dim);
        }

        /* Modal */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(6,10,17,0.7);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 20px;
        }
        .modal {
          background: var(--bg-panel);
          border: 1px solid var(--border);
          border-radius: 14px;
          width: 100%;
          max-width: 440px;
          padding: 22px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        .modal-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 18px;
        }
        .modal-eyebrow {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--text-faint);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 3px;
        }
        .modal-head h2 { margin: 0; font-size: 19px; }
        .modal-close {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-dim);
          border-radius: 7px;
          width: 28px; height: 28px;
          cursor: pointer;
          font-size: 13px;
        }
        .modal-close:hover { color: var(--text); border-color: var(--text-dim); }

        .modal-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 18px;
        }
        .modal-stat {
          background: var(--bg-card);
          border: 1px solid var(--border-soft);
          border-radius: 8px;
          padding: 9px 10px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .modal-stat-label {
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-faint);
        }
        .modal-stat-value { font-family: var(--mono); font-size: 14.5px; font-weight: 600; }
        .modal-stat-value.small { font-size: 12px; font-weight: 500; color: var(--text-dim); }

        .modal-label {
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-faint);
          display: block;
          margin-bottom: 6px;
        }
        .modal-textarea {
          width: 100%;
          background: #0e1826;
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text);
          font-family: var(--sans);
          font-size: 13.5px;
          padding: 10px 12px;
          resize: vertical;
          outline: none;
        }
        .modal-textarea:focus { border-color: var(--blue); }

        .modal-actions {
          margin-top: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .modal-actions-right { display: flex; align-items: center; gap: 10px; }
        .modal-saved {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--green);
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .modal-saved.show { opacity: 1; }
        .modal-btn {
          font-family: var(--sans);
          font-size: 12.5px;
          font-weight: 600;
          padding: 8px 14px;
          border-radius: 7px;
          border: 1px solid var(--border);
          background: #1a2942;
          color: var(--text);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .modal-btn.primary:hover:not(:disabled) { border-color: var(--blue); color: var(--blue); }
        .modal-btn.primary:disabled { opacity: 0.5; cursor: default; }
        .modal-btn.primary-otimizado {
          background: var(--blue-dim);
          border-color: #2a4a68;
          color: var(--blue);
        }
        .modal-btn.primary-otimizado:hover { border-color: var(--blue); }
        .modal-btn.ghost { background: transparent; color: var(--text-dim); }
        .modal-btn.ghost:hover { color: var(--text); border-color: var(--text-dim); }

        .loading-state, .error-state {
          font-family: var(--mono);
          font-size: 13px;
          color: var(--text-dim);
          padding: 40px;
          text-align: center;
        }
        .error-state { color: var(--red); }
      `}</style>

      <div className="header">
        <div className="header-brand">
          <img src="/logo.jpg" alt="logo" className="header-logo" />
          <div className="header-title">
            <span className="eyebrow">Monitoramento · CPL por cliente</span>
            <h1>Painel de Campanhas</h1>
          </div>
        </div>
        <div className="header-status">
          <span className="pulse" />
          ao vivo
        </div>
      </div>

      {loading ? (
        <div className="loading-state">carregando dados…</div>
      ) : error ? (
        <div className="error-state">não foi possível carregar os dados — {error}</div>
      ) : (
        <>
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

          <div className="board">
            {COLUMNS.map((col) => (
              <div
                key={col.key}
                className={`column ${dragOverCol === col.key ? 'drag-over' : ''}`}
                style={{ '--col-accent': col.accent }}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
                onDragLeave={() => setDragOverCol((c) => (c === col.key ? null : c))}
                onDrop={(e) => { e.preventDefault(); handleDrop(col.key); }}
              >
                <div className="column-head">
                  <span className="column-dot" />
                  <span className="column-title">{col.title}</span>
                  <span className="column-count">{byColumn[col.key].length}</span>
                </div>
                <div className="column-cards">
                  {byColumn[col.key].length === 0 ? (
                    <div className="column-empty">arraste um cliente pra cá</div>
                  ) : (
                    byColumn[col.key].map((c) => (
                      <Card key={c.id} cliente={c} columnKey={col.key} onOpen={setSelected} onDragStart={handleDragStart} />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selected && (
        <DetailModal
          cliente={selected}
          onClose={() => setSelected(null)}
          onSave={handleSaveObs}
          onMarkOtimizado={(id) => { updateStatus(id, 'Otimizado'); setSelected(null); }}
          onUnmarkOtimizado={(id) => { updateStatus(id, 'Normal'); setSelected(null); }}
        />
      )}
    </div>
  );
}
