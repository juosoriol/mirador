const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();

exports.syncUserClaims = onCall(async (request) => {
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

  const role = data.role || 'user';
  await getAuth().setCustomUserClaims(uid, { role });
  return { role };
});
