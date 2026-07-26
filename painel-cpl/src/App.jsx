import { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient.js';
import Login from './Login.jsx';
import AdminView from './AdminView.jsx';
import EspecialistaView from './EspecialistaView.jsx';

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0f1a',
        color: '#8a9cb4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13,
      }}
    >
      carregando…
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = ainda não checou
  const [role, setRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setRole(null);
      return;
    }
    setRoleLoading(true);
    supabase
      .from('perfis')
      .select('role')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        setRole(error ? 'sem-perfil' : data.role);
        setRoleLoading(false);
      });
  }, [session]);

  const handleLogout = () => {
    supabase.auth.signOut();
  };

  if (session === undefined) return <LoadingScreen />;
  if (!session) return <Login />;
  if (roleLoading || role === null) return <LoadingScreen />;

  if (role === 'sem-perfil') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0a0f1a',
          color: '#ea6b57',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Inter', sans-serif",
          fontSize: 14,
          padding: 20,
          textAlign: 'center',
        }}
      >
        <div>Esse usuário está autenticado, mas não tem um perfil configurado (tabela <code>perfis</code>).</div>
        <div style={{ color: '#8a9cb4', fontSize: 12.5 }}>Peça pro admin adicionar seu papel na tabela perfis.</div>
        <button
          onClick={handleLogout}
          style={{
            marginTop: 10,
            background: 'transparent',
            border: '1px solid #22334a',
            color: '#8a9cb4',
            padding: '8px 16px',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          sair
        </button>
      </div>
    );
  }

  if (role === 'admin') {
    return <AdminView userEmail={session.user.email} onLogout={handleLogout} />;
  }

  return <EspecialistaView userEmail={session.user.email} onLogout={handleLogout} />;
}
