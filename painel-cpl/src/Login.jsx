import { useState } from 'react';
import { supabase } from './lib/supabaseClient.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    setLoading(false);
    if (signInError) {
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : signInError.message
      );
    }
  };

  return (
    <div className="login-root">
      <style>{`
        .login-root {
          --bg: #0a0f1a;
          --bg-panel: #10192a;
          --border: #22334a;
          --text: #e7eef7;
          --text-dim: #8a9cb4;
          --text-faint: #56687f;
          --blue: #4fb3f0;
          --blue-dim: #122b41;
          --red: #ea6b57;
          --mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
          --sans: 'Inter', -apple-system, 'Segoe UI', sans-serif;

          min-height: 100vh;
          background: var(--bg);
          background-image:
            radial-gradient(ellipse 900px 500px at 15% -10%, #163a5a33 0%, transparent 55%),
            radial-gradient(ellipse 900px 600px at 90% 110%, #0f2a4230 0%, transparent 55%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--sans);
          padding: 20px;
          box-sizing: border-box;
        }
        .login-root * { box-sizing: border-box; }

        .login-card {
          width: 100%;
          max-width: 380px;
          background: var(--bg-panel);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 34px 30px;
          box-shadow: 0 24px 70px rgba(0,0,0,0.5);
        }
        .login-logo {
          width: 46px; height: 46px;
          border-radius: 12px;
          object-fit: cover;
          border: 1px solid var(--border);
          box-shadow: 0 0 0 3px #4fb3f014, 0 4px 14px rgba(79,179,240,0.15);
          margin-bottom: 18px;
        }
        .login-eyebrow {
          font-family: var(--mono);
          font-size: 10.5px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--text-faint);
          margin-bottom: 4px;
        }
        .login-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 26px;
        }

        .field { margin-bottom: 16px; }
        .field label {
          display: block;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-faint);
          margin-bottom: 6px;
        }
        .field input {
          width: 100%;
          background: #0c1420;
          border: 1px solid var(--border);
          border-radius: 9px;
          color: var(--text);
          font-family: var(--sans);
          font-size: 14px;
          padding: 11px 13px;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .field input:focus { border-color: var(--blue); }

        .login-error {
          background: #3a1a16;
          border: 1px solid #6b2e24;
          color: var(--red);
          font-size: 12.5px;
          padding: 10px 12px;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .login-btn {
          width: 100%;
          background: var(--blue-dim);
          border: 1px solid #2a5a80;
          color: var(--blue);
          font-family: var(--sans);
          font-weight: 650;
          font-size: 14px;
          padding: 12px;
          border-radius: 9px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .login-btn:hover:not(:disabled) { border-color: var(--blue); filter: brightness(1.15); }
        .login-btn:disabled { opacity: 0.6; cursor: default; }
      `}</style>

      <div className="login-card">
        <img src="/logo.jpg" alt="logo" className="login-logo" />
        <div className="login-eyebrow">Painel de campanhas</div>
        <h1 className="login-title">Entrar</h1>

        <form onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}
          <div className="field">
            <label htmlFor="email">e-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="senha">senha</label>
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'entrando…' : 'entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
