'use strict';

const FB_CONFIG = {
  apiKey: 'AIzaSyD0fb5hycNqq_yAsXGoYEda0DgNtYZx8gc',
  authDomain: 'miradorapp-b9faf.firebaseapp.com',
  projectId: 'miradorapp-b9faf',
  storageBucket: 'miradorapp-b9faf.firebasestorage.app',
  messagingSenderId: '116927636764',
  appId: '1:116927636764:web:c6d0476ca599c0118686d9',
};

let _auth = null;
let _db = null;
let _storage = null;
let _fns = null;
let _initialized = false;

export function initFirebaseClient() {
  if (_initialized) {
    return { auth: _auth, db: _db, storage: _storage, fns: _fns, config: FB_CONFIG };
  }

  if (typeof firebase === 'undefined') {
    throw new Error('Firebase compat SDK no cargado.');
  }

  firebase.initializeApp(FB_CONFIG);
  _auth = firebase.auth();
  _db = firebase.firestore();
  _storage = firebase.storage();
  _fns = firebase.app().functions('us-central1');

  _db.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
    ignoreUndefinedProperties: true,
  });

  _db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    console.warn('[Firestore] Persistencia no habilitada:', err.code);
  });

  _initialized = true;
  return { auth: _auth, db: _db, storage: _storage, fns: _fns, config: FB_CONFIG };
}

export function getFirebaseAuth() {
  if (!_auth) initFirebaseClient();
  return _auth;
}

export function getFirestore() {
  if (!_db) initFirebaseClient();
  return _db;
}

export function getFirebaseStorage() {
  if (!_storage) initFirebaseClient();
  return _storage;
}

export function getFirebaseFunctions() {
  if (!_fns) initFirebaseClient();
  return _fns;
}

export function getFirebaseConfig() {
  return FB_CONFIG;
}

export function createSecondaryApp(name = `secondary_${Date.now()}`) {
  if (typeof firebase === 'undefined') {
    throw new Error('Firebase compat SDK no cargado.');
  }
  return firebase.initializeApp(FB_CONFIG, name);
}
