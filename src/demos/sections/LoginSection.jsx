import { useState } from 'react';
import { LogoIcon } from '../icons/index.jsx';
import { DemoSection } from '../components/DemoSection.jsx';

function LoginCard({ variant, title }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Ingresa correo y contraseña.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setError('');
    }, 800);
  };

  const styles = {
    refined: {
      frame: {},
      card: {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
      },
      logoBg: 'linear-gradient(135deg, var(--acc), #6366f1)',
      label: { color: 'var(--muted)' },
      input: {
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.06)',
        color: 'var(--text)',
      },
      btn: { background: 'linear-gradient(135deg, var(--acc), #6366f1)', color: '#fff' },
      tagline: { color: 'var(--muted)' },
      footer: { color: 'var(--muted)' },
    },
    glass: {
      frame: {},
      card: {
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: 24,
        backdropFilter: 'blur(20px)',
        boxShadow: '0 24px 80px rgba(99,102,241,0.25)',
      },
      logoBg: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
      label: { color: 'rgba(255,255,255,0.6)' },
      input: {
        border: '1px solid rgba(255,255,255,0.2)',
        background: 'rgba(255,255,255,0.1)',
        color: '#f1f5f9',
      },
      btn: { background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff' },
      tagline: { color: 'rgba(255,255,255,0.55)' },
      footer: { color: 'rgba(255,255,255,0.35)' },
    },
    light: {
      frame: {},
      card: {
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 20,
        boxShadow: '0 8px 32px rgba(15,23,42,0.08)',
      },
      logoBg: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
      label: { color: '#64748b' },
      input: {
        border: '1px solid #cbd5e1',
        background: '#f8fafc',
        color: '#0f172a',
      },
      btn: { background: '#2563eb', color: '#fff' },
      tagline: { color: '#64748b' },
      footer: { color: '#94a3b8' },
    },
  };

  const s = styles[variant];

  return (
    <div className="login-compare-item">
      <div className="login-compare-label">{title}</div>
      <div className={`login-compare-frame ${variant}`}>
        <div
          style={{
            ...s.card,
            padding: '36px 32px',
            width: '100%',
            maxWidth: 320,
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
            <div
              style={{
                width: 44,
                height: 44,
                background: s.logoBg,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LogoIcon size={24} />
            </div>
            <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, color: variant === 'light' ? '#0f172a' : '#f1f5f9' }}>
              Mirador
            </span>
          </div>
          <div style={{ fontSize: 13, ...s.tagline, marginBottom: 24 }}>Análisis de planillas Excel</div>

          {!loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, textAlign: 'left' }}>
                <label style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', ...s.label }}>
                  Correo electrónico
                </label>
                <input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 10,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    outline: 'none',
                    ...s.input,
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, textAlign: 'left' }}>
                <label style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', ...s.label }}>
                  Contraseña
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 10,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    outline: 'none',
                    ...s.input,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={submit}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: 10,
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  marginTop: 4,
                  ...s.btn,
                }}
              >
                Ingresar
              </button>
              {error && (
                <div
                  style={{
                    marginTop: 4,
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: '#450a0a',
                    border: '1px solid #7f1d1d',
                    color: '#f87171',
                    fontSize: 12,
                    textAlign: 'left',
                  }}
                >
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '20px 0' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: '3px solid rgba(99,102,241,0.2)',
                  borderTopColor: '#6366f1',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
              <div style={{ fontSize: 13, ...s.tagline }}>Verificando sesión…</div>
            </div>
          )}

          <div style={{ marginTop: 20, fontSize: 11, lineHeight: 1.6, ...s.footer }}>
            Los archivos se procesan en tu dispositivo.
            <br />
            La subida a la nube es opcional y solo si tú lo eliges.
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoginSection() {
  return (
    <DemoSection
      title="Login"
      description="Tres direcciones visuales para la pantalla de acceso. Refined usa tokens del tema; Glass explora glassmorphism; Light propone un modo institucional claro."
      changes="Etiquetas con var(--muted) en lugar de #64748b fijo; botón con var(--acc); variantes listas para adoptar en LoginApp.jsx."
    >
      <div className="login-compare-grid">
        <LoginCard variant="refined" title="Refined — producción" />
        <LoginCard variant="glass" title="Glass — experimental" />
        <LoginCard variant="light" title="Light — experimental" />
      </div>
    </DemoSection>
  );
}
