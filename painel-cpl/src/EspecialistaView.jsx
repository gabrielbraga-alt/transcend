import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from './lib/supabaseClient.js';

const COLUMNS = [
  { key: 'alto', dbValue: 'Alto', title: 'Custo por lead alto', accentVar: '--amber' },
  { key: 'normal', dbValue: 'Normal', title: 'Custo por lead normal', accentVar: '--green' },
  { key: 'otimizado', dbValue: 'Otimizado', title: 'Otimizados', accentVar: '--blue' },
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

function isOverBudget(cliente) {
  return (
    cliente.cpl !== null &&
    cliente.cpl !== undefined &&
    cliente['Custo por Resultado Máximo'] !== null &&
    cliente.cpl > cliente['Custo por Resultado Máximo']
  );
}

function Toast({ message, kind, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className={`toast toast-${kind}`}>{message}</div>;
}

function Card({ cliente, columnKey, onOpen, onDragStart, onDragEnd }) {
  const over = isOverBudget(cliente);
  const pctOfMax =
    over && cliente['Custo por Resultado Máximo']
      ? Math.round((cliente.cpl / cliente['Custo por Resultado Máximo']) * 100)
      : null;

  return (
    <div
      className={`kcard kcard-${columnKey} ${over ? 'kcard-alert' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, cliente.id)}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(cliente)}
    >
      {over && <span className="kcard-alert-badge">▲ {pctOfMax}% do teto</span>}
      <div className="kcard-head">
        <span className="kcard-name">{cliente.Cliente}</span>
        {cliente.observacao ? <span className="kcard-note-dot" title="Tem observação" /> : null}
      </div>
      <div className="kcard-especialista">{cliente.Especialista || 'sem especialista'}</div>
      <div className="kcard-cpl-row">
        <div className="kcard-cpl-block">
          <span className="kcard-cpl-label">CPL atual</span>
          <span className={`kcard-cpl-value ${over ? 'over' : ''}`}>{fmtMoney(cliente.cpl)}</span>
        </div>
        <div className="kcard-cpl-block right">
          <span className="kcard-cpl-label">teto</span>
          <span className="kcard-cpl-max">{fmtMoney(cliente['Custo por Resultado Máximo'])}</span>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ cliente, onClose, onSave, onMove, moving }) {
  const [obs, setObs] = useState(cliente.observacao || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const current = normalizeStatus(cliente.Status);
  const over = isOverBudget(cliente);

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave(cliente.id, obs);
    setSaving(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    }
  };

  const moveOptions = COLUMNS.filter((c) => c.key !== current);

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
            <span className={`modal-stat-value ${over ? 'over' : ''}`}>{fmtMoney(cliente.cpl)}</span>
          </div>
          <div className="modal-stat">
            <span className="modal-stat-label">CPL teto</span>
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

        <div className="modal-move-row">
          <span className="modal-label" style={{ marginBottom: 0 }}>mover para</span>
          <div className="modal-move-btns">
            {moveOptions.map((opt) => (
              <button
                key={opt.key}
                className={`move-btn move-btn-${opt.key}`}
                disabled={moving}
                onClick={() => onMove(cliente.id, opt.dbValue)}
              >
                {opt.title}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <span className={`modal-saved ${saved ? 'show' : ''}`}>✓ salvo</span>
          <button className="modal-btn primary" disabled={saving} onClick={handleSave}>
            {saving ? 'salvando…' : 'salvar observação'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EspecialistaView({ userEmail, onLogout }) {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [especialistaFiltro, setEspecialistaFiltro] = useState('todos');
  const [busca, setBusca] = useState('');
  const [selected, setSelected] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [movingId, setMovingId] = useState(null);
  const [toast, setToast] = useState(null);
  const draggingId = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [{ data: clientesData, error: clientesError }, { data: historicoData }] = await Promise.all([
        supabase.from('clientes').select('*').order('Cliente', { ascending: true }),
        supabase
          .from('historico_verificacoes')
          .select('cliente_id,custo_por_resultado,data_verificacao')
          .order('data_verificacao', { ascending: false })
          .limit(1000),
      ]);

      if (clientesError) throw new Error(`clientes: ${clientesError.message}`);

      let latestByClient = {};
      if (historicoData) {
        for (const row of historicoData) {
          if (!latestByClient[row.cliente_id]) latestByClient[row.cliente_id] = row;
        }
      }

      const merged = clientesData.map((c) => ({
        ...c,
        cpl: c.cpl_atual ?? latestByClient[c.id]?.custo_por_resultado ?? null,
        ultima_verificacao: latestByClient[c.id]?.data_verificacao ?? c.atualizado_em ?? null,
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

  // Move de verdade: escreve no Supabase com return=representation, confirma
  // a resposta do servidor antes de considerar sucesso, e reverte + avisa em
  // caso de falha (nada de "assumir que deu certo").
  const updateStatus = useCallback(async (id, dbStatusValue) => {
    const previous = clientes.find((c) => c.id === id);
    setMovingId(id);
    setClientes((prev) => prev.map((c) => (c.id === id ? { ...c, Status: dbStatusValue } : c)));

    try {
      const { data: rows, error: updateError } = await supabase
        .from('clientes')
        .update({ Status: dbStatusValue, atualizado_em: new Date().toISOString() })
        .eq('id', id)
        .select();

      if (updateError) throw new Error(updateError.message);
      if (!rows || rows.length === 0) {
        throw new Error('Supabase não retornou confirmação da mudança (0 linhas afetadas — verifique as políticas de RLS)');
      }

      // confirma com o valor que o servidor realmente gravou
      const confirmedStatus = rows[0].Status;
      setClientes((prev) => prev.map((c) => (c.id === id ? { ...c, Status: confirmedStatus } : c)));
      setToast({ kind: 'ok', message: `${previous?.Cliente || 'Cliente'} movido para ${dbStatusValue}` });
      setSelected((prev) => (prev && prev.id === id ? { ...prev, Status: confirmedStatus } : prev));
    } catch (e) {
      // reverte pro estado anterior confirmado
      setClientes((prev) => prev.map((c) => (c.id === id ? { ...c, Status: previous?.Status ?? null } : c)));
      setToast({ kind: 'error', message: `Não salvou a mudança de ${previous?.Cliente || 'cliente'}: ${e.message}` });
    } finally {
      setMovingId(null);
    }
  }, [clientes]);

  const handleSaveObs = useCallback(async (id, novoValor) => {
    try {
      const { data: rows, error: updateError } = await supabase
        .from('clientes')
        .update({ observacao: novoValor, atualizado_em: new Date().toISOString() })
        .eq('id', id)
        .select();

      if (updateError) throw new Error(updateError.message);
      if (!rows || rows.length === 0) throw new Error('0 linhas afetadas — verifique as políticas de RLS');
      setClientes((prev) => prev.map((c) => (c.id === id ? { ...c, observacao: novoValor } : c)));
      setSelected((prev) => (prev && prev.id === id ? { ...prev, observacao: novoValor } : prev));
      return true;
    } catch (e) {
      setToast({ kind: 'error', message: `Observação não salvou: ${e.message}` });
      return false;
    }
  }, []);

  const handleDragStart = (e, id) => {
    draggingId.current = id;
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragEnd = () => {
    draggingId.current = null;
    setDragOverCol(null);
  };
  const handleDrop = (col) => {
    if (draggingId.current) updateStatus(draggingId.current, col.dbValue);
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
    for (const c of filtrados) groups[normalizeStatus(c.Status)].push(c);
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => (b.cpl ?? -1) - (a.cpl ?? -1));
    }
    return groups;
  }, [filtrados]);

  const alertCount = useMemo(() => filtrados.filter(isOverBudget).length, [filtrados]);

  return (
    <div className="painel-root">
      <style>{`
        .painel-root {
          --bg: #0a0f1a;
          --bg-panel: #10192a;
          --bg-card: #142033;
          --bg-card-hover: #17263d;
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
        .painel-root * { box-sizing: border-box; }
        .painel-inner { max-width: 1440px; margin: 0 auto; }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
          margin-bottom: 26px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border-soft);
        }
        .header-brand { display: flex; align-items: center; gap: 14px; }
        .header-logo {
          width: 40px; height: 40px;
          border-radius: 10px;
          object-fit: cover;
          border: 1px solid var(--border);
          box-shadow: 0 0 0 3px #4fb3f014, 0 4px 14px rgba(79,179,240,0.12);
        }
        .header-title h1 {
          margin: 0;
          font-size: 21px;
          font-weight: 700;
          letter-spacing: -0.015em;
        }
        .header-title .eyebrow {
          font-family: var(--mono);
          font-size: 10.5px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--text-faint);
        }

        .header-right { display: flex; align-items: center; gap: 14px; }
        .header-user {
          display: flex; align-items: center; gap: 10px;
          font-family: var(--mono); font-size: 11px; color: var(--text-faint);
          padding-left: 14px; border-left: 1px solid var(--border-soft);
        }
        .logout-btn {
          font-family: var(--sans); font-size: 11.5px; font-weight: 600;
          background: transparent; border: 1px solid var(--border); color: var(--text-dim);
          padding: 5px 11px; border-radius: 7px; cursor: pointer; transition: all 0.15s ease;
        }
        .logout-btn:hover { border-color: var(--red); color: var(--red); }
        .alert-pill {
          display: flex; align-items: center; gap: 7px;
          font-family: var(--mono);
          font-size: 11.5px;
          padding: 6px 12px;
          border-radius: 20px;
          background: var(--amber-dim);
          border: 1px solid #5a4322;
          color: var(--amber);
        }
        .alert-pill-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--amber);
          animation: pulse-amber 1.6s infinite;
        }
        .header-status {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--text-faint);
          display: flex; align-items: center; gap: 7px;
        }
        .pulse {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--green);
          animation: pulse-green 2.2s infinite;
        }
        @keyframes pulse-green {
          0% { box-shadow: 0 0 0 0 rgba(74,216,148,0.5); }
          70% { box-shadow: 0 0 0 7px rgba(74,216,148,0); }
          100% { box-shadow: 0 0 0 0 rgba(74,216,148,0); }
        }
        @keyframes pulse-amber {
          0% { box-shadow: 0 0 0 0 rgba(236,171,79,0.55); }
          70% { box-shadow: 0 0 0 6px rgba(236,171,79,0); }
          100% { box-shadow: 0 0 0 0 rgba(236,171,79,0); }
        }

        .controls { display: flex; gap: 10px; margin-bottom: 22px; flex-wrap: wrap; }
        .select, .search-input {
          background: var(--bg-panel);
          border: 1px solid var(--border);
          color: var(--text);
          font-family: var(--sans);
          font-size: 13px;
          padding: 9px 13px;
          border-radius: 8px;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .select:focus, .search-input:focus { border-color: var(--blue); }
        .search-input { min-width: 220px; }
        .search-input::placeholder { color: var(--text-faint); }

        .board {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
          align-items: start;
        }

        .column {
          background: linear-gradient(180deg, var(--bg-panel) 0%, #0d1524 100%);
          border: 1px solid var(--border-soft);
          border-radius: 14px;
          padding: 16px;
          min-height: 220px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .column.drag-over {
          border-color: var(--col-accent);
          box-shadow: inset 0 0 0 1px var(--col-accent), 0 0 24px -8px var(--col-accent);
        }

        .column-head { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; }
        .column-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--col-accent); flex-shrink: 0;
          box-shadow: 0 0 8px 0 var(--col-accent); }
        .column-title { font-size: 13px; font-weight: 700; letter-spacing: 0.01em; color: var(--text); flex: 1; }
        .column-count {
          font-family: var(--mono); font-size: 11px; color: var(--text-dim);
          background: var(--bg-card); border: 1px solid var(--border-soft);
          padding: 2px 8px; border-radius: 20px;
        }

        .column-cards { display: flex; flex-direction: column; gap: 10px; min-height: 90px; }
        .column-empty {
          font-family: var(--mono); font-size: 11.5px; color: var(--text-faint);
          text-align: center; padding: 22px 8px;
          border: 1.5px dashed var(--border-soft); border-radius: 10px;
        }

        .kcard {
          position: relative;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-left: 3px solid var(--col-accent);
          border-radius: 10px;
          padding: 13px 14px;
          cursor: grab;
          transition: background 0.12s ease, transform 0.1s ease, border-color 0.12s ease, box-shadow 0.12s ease;
        }
        .kcard:hover {
          background: var(--bg-card-hover);
          border-color: #33507a;
          box-shadow: 0 6px 18px -8px rgba(0,0,0,0.5);
          transform: translateY(-1px);
        }
        .kcard:active { cursor: grabbing; transform: scale(0.98); }

        .kcard-alert {
          border-color: #6b4c26;
          animation: card-glow 2.4s ease-in-out infinite;
        }
        @keyframes card-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(236,171,79,0.0); }
          50% { box-shadow: 0 0 0 3px rgba(236,171,79,0.14); }
        }
        .kcard-alert-badge {
          display: inline-block;
          font-family: var(--mono);
          font-size: 9.5px;
          font-weight: 600;
          color: var(--amber);
          background: var(--amber-dim);
          border: 1px solid #5a4322;
          padding: 2px 7px;
          border-radius: 5px;
          margin-bottom: 8px;
        }

        .kcard-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 3px; }
        .kcard-name {
          font-weight: 650; font-size: 14.5px; color: var(--text);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .kcard-note-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--blue); flex-shrink: 0; }
        .kcard-especialista { font-size: 11.5px; color: var(--text-faint); margin-bottom: 11px; }

        .kcard-cpl-row {
          display: flex; justify-content: space-between; align-items: flex-end;
          border-top: 1px solid var(--border-soft); padding-top: 10px;
        }
        .kcard-cpl-block { display: flex; flex-direction: column; gap: 2px; }
        .kcard-cpl-block.right { align-items: flex-end; }
        .kcard-cpl-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-faint); }
        .kcard-cpl-value { font-family: var(--mono); font-size: 16px; font-weight: 700; color: var(--text); }
        .kcard-cpl-value.over { color: var(--red); }
        .kcard-cpl-max { font-family: var(--mono); font-size: 12px; color: var(--text-dim); }

        /* Modal */
        .modal-backdrop {
          position: fixed; inset: 0;
          background: rgba(5,8,14,0.72);
          backdrop-filter: blur(3px);
          display: flex; align-items: center; justify-content: center;
          z-index: 50; padding: 20px;
        }
        .modal {
          background: var(--bg-panel);
          border: 1px solid var(--border);
          border-radius: 16px;
          width: 100%; max-width: 460px;
          padding: 24px;
          box-shadow: 0 24px 70px rgba(0,0,0,0.55);
        }
        .modal-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
        .modal-eyebrow {
          font-family: var(--mono); font-size: 11px; color: var(--text-faint);
          text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 3px;
        }
        .modal-head h2 { margin: 0; font-size: 20px; }
        .modal-close {
          background: transparent; border: 1px solid var(--border); color: var(--text-dim);
          border-radius: 8px; width: 30px; height: 30px; cursor: pointer; font-size: 13px;
        }
        .modal-close:hover { color: var(--text); border-color: var(--text-dim); }

        .modal-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 18px; }
        .modal-stat {
          background: var(--bg-card); border: 1px solid var(--border-soft);
          border-radius: 9px; padding: 10px 11px;
          display: flex; flex-direction: column; gap: 3px;
        }
        .modal-stat-label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-faint); }
        .modal-stat-value { font-family: var(--mono); font-size: 14.5px; font-weight: 700; }
        .modal-stat-value.over { color: var(--red); }
        .modal-stat-value.small { font-size: 12px; font-weight: 500; color: var(--text-dim); }

        .modal-label {
          font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-faint);
          display: block; margin-bottom: 7px;
        }
        .modal-textarea {
          width: 100%; background: #0c1420; border: 1px solid var(--border); border-radius: 9px;
          color: var(--text); font-family: var(--sans); font-size: 13.5px; padding: 10px 12px;
          resize: vertical; outline: none; transition: border-color 0.15s ease;
        }
        .modal-textarea:focus { border-color: var(--blue); }

        .modal-move-row { margin-top: 16px; }
        .modal-move-btns { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
        .move-btn {
          font-family: var(--sans); font-size: 12px; font-weight: 600;
          padding: 7px 12px; border-radius: 7px; border: 1px solid var(--border);
          background: #16233a; color: var(--text-dim); cursor: pointer;
          transition: all 0.15s ease;
        }
        .move-btn:disabled { opacity: 0.5; cursor: default; }
        .move-btn-alto:hover:not(:disabled) { border-color: var(--amber); color: var(--amber); }
        .move-btn-normal:hover:not(:disabled) { border-color: var(--green); color: var(--green); }
        .move-btn-otimizado:hover:not(:disabled) { border-color: var(--blue); color: var(--blue); }

        .modal-actions {
          margin-top: 18px; display: flex; justify-content: flex-end; align-items: center; gap: 12px;
        }
        .modal-saved {
          font-family: var(--mono); font-size: 11.5px; color: var(--green);
          opacity: 0; transition: opacity 0.2s ease;
        }
        .modal-saved.show { opacity: 1; }
        .modal-btn {
          font-family: var(--sans); font-size: 12.5px; font-weight: 650;
          padding: 9px 16px; border-radius: 8px; border: 1px solid var(--border);
          background: var(--blue-dim); color: var(--blue); cursor: pointer;
          transition: all 0.15s ease;
        }
        .modal-btn.primary:hover:not(:disabled) { border-color: var(--blue); filter: brightness(1.15); }
        .modal-btn.primary:disabled { opacity: 0.5; cursor: default; }

        .toast {
          position: fixed; bottom: 22px; right: 22px;
          font-family: var(--sans); font-size: 13px; font-weight: 500;
          padding: 12px 16px; border-radius: 10px;
          max-width: 340px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.4);
          z-index: 60;
          animation: toast-in 0.2s ease;
        }
        @keyframes toast-in { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .toast-ok { background: var(--green-dim); border: 1px solid #1e5b3d; color: var(--green); }
        .toast-error { background: #3a1a16; border: 1px solid #6b2e24; color: var(--red); }

        .loading-state, .error-state {
          font-family: var(--mono); font-size: 13px; color: var(--text-dim);
          padding: 60px; text-align: center;
        }
        .error-state { color: var(--red); }

        @media (max-width: 1000px) {
          .board { grid-template-columns: 1fr; }
          .painel-root { padding: 20px 16px 40px; }
        }
      `}</style>

      <div className="painel-inner">
        <div className="header">
          <div className="header-brand">
            <img src="/logo.jpg" alt="logo" className="header-logo" />
            <div className="header-title">
              <span className="eyebrow">Monitoramento · CPL por cliente</span>
              <h1>Painel de Campanhas</h1>
            </div>
          </div>
          <div className="header-right">
            {alertCount > 0 && (
              <span className="alert-pill">
                <span className="alert-pill-dot" />
                {alertCount} acima do teto
              </span>
            )}
            <div className="header-status">
              <span className="pulse" />
              ao vivo
            </div>
            <div className="header-user">
              <span>{userEmail}</span>
              <button className="logout-btn" onClick={onLogout}>sair</button>
            </div>
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
                  style={{ '--col-accent': `var(${col.accentVar})` }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
                  onDragLeave={() => setDragOverCol((c) => (c === col.key ? null : c))}
                  onDrop={(e) => { e.preventDefault(); handleDrop(col); }}
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
                        <Card
                          key={c.id}
                          cliente={c}
                          columnKey={col.key}
                          onOpen={setSelected}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {selected && (
        <DetailModal
          cliente={selected}
          onClose={() => setSelected(null)}
          onSave={handleSaveObs}
          onMove={(id, dbValue) => updateStatus(id, dbValue)}
          moving={movingId === selected.id}
        />
      )}

      {toast && <Toast message={toast.message} kind={toast.kind} onDone={() => setToast(null)} />}
    </div>
  );
}
