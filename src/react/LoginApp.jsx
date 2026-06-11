import { useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

function LogoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
      <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
    </svg>
  );
}

export function LoginApp() {
  const { signIn, error, isChecking, isSigningIn, clearError } = useAuth();
  const passRef = useRef(null);
  const emailRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);

  const showLoading = isChecking || isSigningIn || submitting;
  const showForm = !showLoading;

  const submit = async () => {
    clearError();
    const email = emailRef.current?.value ?? '';
    const password = passRef.current?.value ?? '';
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch {
      // error state handled by AuthProvider
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-card">
      <div className="login-logo">
        <div className="login-logo-icon">
          <LogoIcon />
        </div>
        <span className="login-logo-text">Mirador</span>
      </div>
      <div className="login-tagline">Análisis de planillas Excel</div>

      <div id="login-main-content" style={{ display: showForm ? '' : 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label
              htmlFor="login-email"
              style={{
                fontSize: 11,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '.06em',
              }}
            >
              Correo electrónico
            </label>
            <input
              ref={emailRef}
              id="login-email"
              type="email"
              placeholder="correo@ejemplo.com"
              autoComplete="email"
              className="login-input"
              style={{ marginBottom: 0 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') passRef.current?.focus();
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label
              htmlFor="login-pass"
              style={{
                fontSize: 11,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '.06em',
              }}
            >
              Contraseña
            </label>
            <input
              ref={passRef}
              id="login-pass"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              className="login-input"
              style={{ marginBottom: 0 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
            />
          </div>
          <button type="button" className="btn-login" onClick={submit} disabled={submitting}>
            Ingresar
          </button>
          <div className={`login-error${error ? ' show' : ''}`} id="login-error">
            {error || ''}
          </div>
        </div>
      </div>

      <div className={`login-loading${showLoading ? ' show' : ''}`} id="login-loading">
        <div className="login-spinner" />
        <div className="login-loading-text">Verificando sesión…</div>
      </div>

      <div className="login-footer" style={{ marginTop: 20 }}>
        Los archivos se procesan en tu dispositivo.
        <br />
        La subida a la nube es opcional y solo si tú lo eliges.
      </div>
    </div>
  );
}
