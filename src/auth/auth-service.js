'use strict';

import {
  getFirebaseAuth,
  getFirebaseFunctions,
  getFirestore,
} from './firebase-client.js';

const AUTH_ERRORS = {
  'auth/user-not-found': 'Usuario no encontrado.',
  'auth/wrong-password': 'Contraseña incorrecta.',
  'auth/invalid-email': 'Correo inválido.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
};

export function mapAuthError(code, fallback = 'Error de autenticación.') {
  return AUTH_ERRORS[code] || fallback;
}

export async function syncUserClaims(user) {
  try {
    const fns = getFirebaseFunctions();
    const res = await fns.httpsCallable('syncUserClaims')();
    await user.getIdToken(true);
    return res.data?.role || null;
  } catch (e) {
    console.warn('[Claims] No se pudieron sincronizar permisos:', e.message || e);
    return null;
  }
}

export async function initUserProfile(user) {
  const db = getFirestore();
  const auth = getFirebaseAuth();

  const docRef = db.collection('users').doc(user.uid);
  const doc = await docRef.get();
  let data;

  if (!doc.exists) {
    data = {
      email: user.email,
      role: 'user',
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      name: user.displayName || user.email.split('@')[0],
    };
    await docRef.set(data);
  } else {
    data = doc.data();
  }

  if (data.active === false) {
    await auth.signOut();
    throw new Error('Tu cuenta está desactivada. Contacta al administrador.');
  }

  let role = data.role || 'user';
  const syncedRole = await syncUserClaims(user);
  if (syncedRole) role = syncedRole;
  else {
    try {
      const tr = await user.getIdTokenResult(true);
      if (tr.claims.role) role = tr.claims.role;
    } catch (_) {}
  }

  docRef.update({ lastLogin: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});

  return role;
}

export async function signInWithEmail(email, password) {
  const auth = getFirebaseAuth();
  return auth.signInWithEmailAndPassword(email.trim(), password);
}

export async function ensureAdminClaim(user, role) {
  if (role !== 'admin') return false;

  for (let i = 0; i < 3; i++) {
    const tr = await user.getIdTokenResult(i > 0);
    if (tr.claims.role === 'admin') return true;
    await syncUserClaims(user);
    await new Promise((r) => setTimeout(r, 400));
  }

  const tr = await user.getIdTokenResult(true);
  return tr.claims.role === 'admin';
}

export function subscribeAuthState(onChange) {
  const auth = getFirebaseAuth();
  return auth.onAuthStateChanged(onChange);
}
