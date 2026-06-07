const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();

async function applyUserClaims(uid, data) {
  if (!data || data.active === false) {
    await getAuth().setCustomUserClaims(uid, { role: 'user' });
    return 'user';
  }
  const role = data.role || 'user';
  await getAuth().setCustomUserClaims(uid, { role });
  return role;
}

exports.syncUserClaims = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }

  const uid = request.auth.uid;
  const snap = await getFirestore().collection('users').doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Usuario no registrado.');
  }

  const data = snap.data();
  if (data.active === false) {
    throw new HttpsError('permission-denied', 'Cuenta desactivada.');
  }

  const role = await applyUserClaims(uid, data);
  return { role };
});

exports.onUserProfileWrite = onDocumentWritten({
  document: 'users/{userId}',
  region: 'us-central1',
}, async (event) => {
  const after = event.data?.after;
  if (!after?.exists) return;
  await applyUserClaims(event.params.userId, after.data());
});
