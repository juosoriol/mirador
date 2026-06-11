'use strict';

/** Live auth state shared between React and legacy JS modules. */
export let fbUser = null;
export let fbUserRole = null;

const legacyListeners = new Set();
let signInHandler = null;

export function setAuthState(user, role) {
  fbUser = user;
  fbUserRole = role;
  syncWindowAuth();
  legacyListeners.forEach((fn) => {
    try {
      fn(user, role);
    } catch (e) {
      console.error('[AuthBridge] listener error:', e);
    }
  });
}

export function registerLegacyAuthListener(fn) {
  legacyListeners.add(fn);
  if (fbUser) fn(fbUser, fbUserRole);
  return () => legacyListeners.delete(fn);
}

export function registerSignInHandler(fn) {
  signInHandler = fn;
}

export async function requestSignIn(email, password) {
  if (!signInHandler) {
    throw new Error('Auth no inicializado.');
  }
  return signInHandler(email, password);
}

export function syncWindowAuth() {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, '_fbUser', {
      get: () => fbUser,
      configurable: true,
    });
    Object.defineProperty(window, '_fbUserRole', {
      get: () => fbUserRole,
      configurable: true,
    });
  }
}
