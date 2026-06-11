import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  initUserProfile,
  mapAuthError,
  signInWithEmail,
  subscribeAuthState,
} from './auth-service.js';
import {
  registerLegacyAuthListener,
  registerSignInHandler,
  setAuthState,
} from './auth-bridge.js';
import { initFirebaseClient } from './firebase-client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState(null);

  const signIn = useCallback(async (email, password) => {
    setError(null);

    if (!email?.trim() || !password) {
      const msg = 'Completa todos los campos.';
      setError(msg);
      throw new Error(msg);
    }

    setStatus('signing-in');
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      const msg = mapAuthError(err.code, err.message);
      setError(msg);
      setStatus('unauthenticated');
      throw new Error(msg);
    }
  }, []);

  const signOut = useCallback(async () => {
    const { auth } = initFirebaseClient();
    await auth.signOut();
  }, []);

  useEffect(() => {
    initFirebaseClient();
    registerSignInHandler(signIn);

    const unsubscribe = subscribeAuthState(async (nextUser) => {
      if (nextUser) {
        setStatus((prev) => (prev === 'signing-in' ? 'signing-in' : 'checking'));
        setError(null);
        try {
          const nextRole = await initUserProfile(nextUser);
          setUser(nextUser);
          setRole(nextRole);
          setAuthState(nextUser, nextRole);
          setStatus('authenticated');
        } catch (err) {
          setUser(null);
          setRole(null);
          setAuthState(null, null);
          setError(err.message || 'No se pudo iniciar sesión.');
          setStatus('unauthenticated');
        }
      } else {
        setUser(null);
        setRole(null);
        setAuthState(null, null);
        setStatus('unauthenticated');
      }
    });

    return () => unsubscribe();
  }, [signIn]);

  useEffect(() => {
    const screen = document.getElementById('login-screen');
    if (!screen) return;
    if (status === 'authenticated') screen.classList.add('hidden');
    else screen.classList.remove('hidden');
    if (typeof window._mobileUiRefresh === 'function') {
      window._mobileUiRefresh();
    }
  }, [status]);

  const value = useMemo(
    () => ({
      user,
      role,
      status,
      error,
      isChecking: status === 'checking',
      isSigningIn: status === 'signing-in',
      isAuthenticated: status === 'authenticated',
      signIn,
      signOut,
      clearError: () => setError(null),
    }),
    [user, role, status, error, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

export function useRegisterLegacyAuthEffects(handler) {
  useEffect(() => registerLegacyAuthListener(handler), [handler]);
}
