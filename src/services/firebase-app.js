'use strict';

import {
  createSecondaryApp,
  getFirebaseAuth,
  getFirebaseConfig,
  getFirebaseFunctions,
  getFirebaseStorage,
  getFirestore,
  initFirebaseClient,
} from '../auth/firebase-client.js';
import { fbUser, fbUserRole, registerLegacyAuthListener, requestSignIn, syncWindowAuth } from '../auth/auth-bridge.js';
import { ensureAdminClaim, syncUserClaims } from '../auth/auth-service.js';

// Depends on core globals (tabs, T, loadSheet, etc.)
initFirebaseClient();
const _fbConfig = getFirebaseConfig();
const _fbAuth = getFirebaseAuth();
const _fbDb = getFirestore();
const _fbStorage = getFirebaseStorage();
const _fbFns = getFirebaseFunctions();

async function _fbSyncClaims(user) {
  return syncUserClaims(user);
}

// ── Login email/contraseña (legacy wrapper for onclick / E2E) ───────────────
async function loginWithEmail() {
  const email = document.getElementById('login-email')?.value?.trim() ?? '';
  const pass = document.getElementById('login-pass')?.value ?? '';
  try {
    await requestSignIn(email, pass);
  } catch (e) {
    const errEl = document.getElementById('login-error');
    if (errEl) {
      errEl.textContent = e.message || 'Error de autenticación.';
      errEl.classList.add('show');
    }
  }
}

function _fbShowLoginError(msg) {
  const e = document.getElementById('login-error');
  if (!e) return;
  e.textContent = msg;
  e.classList.add('show');
}

// ── UI: avatar + admin en el menú hamburguesa ───────────────────────────
function _fbUpdateUserUI(user){
  document.getElementById('fb-user-badge')?.remove();
  document.getElementById('fb-admin-btn')?.remove();
  _updateActionsPanelUserHeader();
}

function _updateActionsPanelUserHeader(){
  const header = document.getElementById('ap-user-header');
  const avatarBtn = document.getElementById('ap-user-avatar-btn');
  const avatarEl = document.getElementById('ap-user-avatar');
  const nameEl = document.getElementById('ap-user-name');
  const roleEl = document.getElementById('ap-user-role');
  const adminBtn = document.getElementById('ap-admin-btn');

  if(!fbUser){
    if(header) header.style.display = 'none';
    return;
  }

  const email = fbUser.email || '';
  const name = email.split('@')[0];
  const initials = email.slice(0,2).toUpperCase();
  const role = fbUserRole === 'admin' ? 'Administrador' : 'Usuario';

  if(header) header.style.display = '';
  if(avatarBtn) avatarBtn.title = email;
  if(avatarEl) avatarEl.textContent = initials;
  if(nameEl) nameEl.textContent = name;
  if(roleEl) roleEl.textContent = role;
  if(adminBtn){
    adminBtn.style.display = fbUserRole === 'admin' ? '' : 'none';
  }
}

function fbShowUserMenu(el){
  const existing = document.getElementById('fb-user-menu');
  if(existing){ existing.remove(); return; }
  const rect = el.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'fb-user-menu';
  menu.style.cssText = `position:fixed;top:${rect.bottom+6}px;right:${window.innerWidth-rect.right}px;z-index:9000;background:var(--s1);border:1px solid var(--border2);border-radius:10px;padding:6px;min-width:180px;box-shadow:0 8px 24px rgba(0,0,0,.4);font-family:var(--font)`;
  menu.innerHTML = `
    <div style="padding:8px 12px;font-size:12px;color:var(--muted);border-bottom:1px solid var(--border);margin-bottom:4px">${eh(fbUser?.email||'')}</div>
    <button onclick="fbChangePassword()" style="width:100%;text-align:left;padding:7px 12px;border:none;background:none;color:var(--text);font-size:12px;cursor:pointer;border-radius:6px;font-family:var(--font)">🔑 Cambiar contraseña</button>
    <button onclick="_fbAuth.signOut();document.getElementById('fb-user-menu')?.remove()" style="width:100%;text-align:left;padding:7px 12px;border:none;background:none;color:#f87171;font-size:12px;cursor:pointer;border-radius:6px;font-family:var(--font)">↪ Cerrar sesión</button>`;
  document.body.appendChild(menu);
  setTimeout(()=>document.addEventListener('click', ()=>menu.remove(), {once:true}), 10);
}

function fbChangePassword(){
  document.getElementById('fb-user-menu')?.remove();
  const np = prompt('Nueva contraseña (mínimo 6 caracteres):');
  if(!np || np.length < 6){ if(np!==null) alert('Mínimo 6 caracteres.'); return; }
  fbUser.updatePassword(np)
    .then(()=>alert('✅ Contraseña actualizada correctamente.'))
    .catch(e=>{ if(e.code==='auth/requires-recent-login') alert('Por seguridad, cierra sesión y vuelve a ingresar para cambiar la contraseña.'); else alert('Error: '+e.message); });
}

// ── PANEL ADMINISTRACIÓN ──────────────────────────────────────────────────
async function fbOpenAdminPanel(){
  if(fbUserRole !== 'admin'){
    alert('Tu cuenta no tiene rol de administrador en Firestore.');
    return;
  }
  if(!await _fbEnsureAdminClaim()){
    alert('No se pudieron activar los permisos de admin. Cierra sesión, vuelve a entrar y espera unos segundos.');
    return;
  }
  document.getElementById('fb-user-menu')?.remove();

  // Cargar usuarios
  const snap = await _fbDb.collection('users').orderBy('createdAt','desc').get();
  const users = snap.docs.map(d=>({id:d.id,...d.data()}));

  const overlay = document.createElement('div');
  overlay.id = 'fb-admin-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px;font-family:var(--font)';

  const rows = users.map(u=>`
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:10px 12px;font-size:12px;color:var(--text)">${eh(u.name||'—')}</td>
      <td style="padding:10px 12px;font-size:12px;color:var(--muted)">${eh(u.email||'')}</td>
      <td style="padding:10px 12px"><span style="font-size:10px;padding:2px 8px;border-radius:20px;background:${u.role==='admin'?'#4f46e522':'#16532422'};color:${u.role==='admin'?'#a5b4fc':'#4ade80'}">${eh(u.role||'user')}</span></td>
      <td style="padding:10px 12px"><span style="font-size:10px;padding:2px 8px;border-radius:20px;background:${u.active!==false?'#16532422':'#450a0a22'};color:${u.active!==false?'#4ade80':'#f87171'}">${u.active!==false?'Activo':'Inactivo'}</span></td>
      <td style="padding:10px 12px">
        ${u.id !== fbUser.uid ? `<button data-fb-toggle="${eh(u.id)}" data-fb-active="${u.active!==false?'1':'0'}" style="font-size:10px;padding:3px 9px;border-radius:6px;border:1px solid var(--border);background:var(--s2);color:var(--muted);cursor:pointer;font-family:var(--font)">${u.active!==false?'Desactivar':'Activar'}</button>` : '<span style="font-size:10px;color:var(--muted)">Tú</span>'}
      </td>
    </tr>`).join('');

  overlay.innerHTML = `
    <div style="background:var(--s1);border:1px solid var(--border2);border-radius:16px;width:100%;max-width:680px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.5)">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <div style="font-size:15px;font-weight:600;color:var(--text)">👥 Administrar usuarios</div>
        <button onclick="document.getElementById('fb-admin-overlay').remove()" style="width:30px;height:30px;border-radius:6px;border:none;background:var(--s2);color:var(--muted);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center">×</button>
      </div>
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);flex-shrink:0">
        <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:10px">Crear usuario</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input id="fb-new-name" placeholder="Nombre" style="flex:1;min-width:120px;padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:12px;outline:none;font-family:var(--font)"/>
          <input id="fb-new-email" type="email" placeholder="correo@ejemplo.com" style="flex:2;min-width:160px;padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:12px;outline:none;font-family:var(--font)"/>
          <input id="fb-new-pass" type="password" placeholder="Contraseña" style="flex:1;min-width:120px;padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:12px;outline:none;font-family:var(--font)"/>
          <select id="fb-new-role" style="padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:12px;outline:none;font-family:var(--font)">
            <option value="user">Usuario</option>
            <option value="admin">Admin</option>
          </select>
          <button onclick="fbCreateUser()" style="padding:8px 16px;border-radius:8px;border:none;background:#6366f1;color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font)">+ Crear</button>
        </div>
        <div id="fb-create-msg" style="font-size:11px;margin-top:6px;color:#f87171"></div>
      </div>
      <div style="overflow-y:auto;flex:1">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:var(--s2)">
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:600">Nombre</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:600">Correo</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:600">Rol</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:600">Estado</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:600">Acción</th>
          </tr></thead>
          <tbody id="fb-users-list">${rows}</tbody>
        </table>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#fb-users-list')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-fb-toggle]');
    if(!btn) return;
    fbToggleActive(btn.dataset.fbToggle, btn.dataset.fbActive === '1');
  });
  checkOverlaysOpen();
}

async function fbCreateUser(){
  const name  = document.getElementById('fb-new-name').value.trim();
  const email = document.getElementById('fb-new-email').value.trim();
  const pass  = document.getElementById('fb-new-pass').value;
  const role  = document.getElementById('fb-new-role').value;
  const msg   = document.getElementById('fb-create-msg');
  msg.style.color='#f87171'; msg.textContent='';

  if(!name||!email||!pass){ msg.textContent='Completa todos los campos.'; return; }
  if(pass.length<6){ msg.textContent='Contraseña mínimo 6 caracteres.'; return; }

  msg.style.color='#94a3b8'; msg.textContent='Creando usuario…';

  try {
    // Crear en Firebase Auth usando una segunda instancia para no cerrar sesión del admin
    const secondary = createSecondaryApp(`secondary_${Date.now()}`);
    const secAuth = secondary.auth();
    const cred = await secAuth.createUserWithEmailAndPassword(email, pass);
    const uid = cred.user.uid;
    await secAuth.signOut();
    secondary.delete();

    // Guardar en Firestore
    await _fbDb.collection('users').doc(uid).set({
      name, email, role, active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: fbUser.uid
    });

    msg.style.color='#4ade80'; msg.textContent=`✅ Usuario "${name}" creado correctamente.`;
    ['fb-new-name','fb-new-email','fb-new-pass'].forEach(id=>document.getElementById(id).value='');

    // Refrescar lista
    document.getElementById('fb-admin-overlay').remove();
    setTimeout(fbOpenAdminPanel, 200);
  } catch(e){
    const msgs = {'auth/email-already-in-use':'Este correo ya está registrado.','auth/invalid-email':'Correo inválido.'};
    msg.textContent = msgs[e.code] || 'Error: ' + e.message;
  }
}

async function fbToggleActive(uid, currentlyActive){
  await _fbDb.collection('users').doc(uid).update({ active: !currentlyActive });
  document.getElementById('fb-admin-overlay').remove();
  setTimeout(fbOpenAdminPanel, 200);
}

// ── DOCUMENTOS EN LA NUBE ──────────────────────────────────────────────────
async function saveToCloud(){
  if(!fbUser){ alert('Debes iniciar sesión primero.'); return; }
  const tab = T();
  if(!tab || !tab.rawData.length){ alert('No hay datos para guardar.'); return; }
  if(!tab._file){ alert('Este archivo no se puede guardar (no hay archivo original).'); return; }

  const fileName = tab.fileName || 'documento.xlsx';
  const file = tab._file;

  if(file.size > 10 * 1024 * 1024){
    alert('El archivo es demasiado grande (máximo 10MB).');
    return;
  }

  if(!confirm(`¿Guardar "${fileName}" en la nube?`)) return;

  const btn = document.getElementById('btn-save-cloud');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Guardando...';

  try {
    // Subir a Storage
    const storageRef = _fbStorage.ref(`users/${fbUser.uid}/${fileName}`);
    const uploadTask = storageRef.put(file);

    await uploadTask;
    const downloadURL = await storageRef.getDownloadURL();

    // Guardar metadata en Firestore
    await _fbDb.collection('documents').add({
      userId: fbUser.uid,
      fileName: fileName,
      size: file.size,
      storagePath: `users/${fbUser.uid}/${fileName}`,
      downloadURL: downloadURL,
      uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
      sheets: tab.wb?.SheetNames || []
    });

    btn.innerHTML = originalText;
    btn.disabled = false;
    alert('✅ Documento guardado correctamente.');
  } catch(e){
    console.error('Error guardando documento:', e);
    btn.innerHTML = originalText;
    btn.disabled = false;
    alert('Error al guardar: ' + e.message);
  }
}

async function _fbEnsureAdminClaim() {
  if (!fbUser) return false;
  return ensureAdminClaim(fbUser, fbUserRole);
}

async function openDocsPanel(){
  if(!fbUser){ alert('Debes iniciar sesión primero.'); return; }

  _lockModalViewport();
  document.getElementById('docs-panel').classList.add('open');
  scheduleOverlayCheck();
  const body = document.getElementById('docs-body');
  body.innerHTML = '<div class="docs-uploading">Cargando documentos...</div>';

  try {
    const canListAll = await _fbEnsureAdminClaim();
    let query = _fbDb.collection('documents');

    if(!canListAll){
      query = query.where('userId', '==', fbUser.uid);
    }

    const snap = await query.orderBy('uploadedAt', 'desc').get();

    if(snap.empty){
      body.innerHTML = '<div class="docs-empty">📂 No hay documentos guardados.<br><br><span style="font-size:12px;color:var(--muted)">Abre un archivo Excel y haz click en "Guardar" para subirlo a la nube.</span></div>';
      return;
    }

    const docs = snap.docs.map(d => ({id: d.id, ...d.data()}));

    // Solo listar usuarios si el token tiene claim admin (evita permission-denied)
    let users = {};
    if(canListAll){
      try {
        const userSnap = await _fbDb.collection('users').get();
        userSnap.docs.forEach(d => users[d.id] = d.data());
      } catch(e){
        console.warn('[Docs] No se pudieron cargar nombres de usuario:', e.message || e);
      }
    }

    const html = docs.map(doc => {
      const date = doc.uploadedAt?.toDate();
      const dateStr = date ? date.toLocaleDateString('es', {day:'numeric', month:'short', year:'numeric'}) : '—';
      const sizeStr = doc.size ? (doc.size / 1024 / 1024).toFixed(2) + ' MB' : '—';
      const userName = canListAll && doc.userId !== fbUser.uid ?
                       `<span style="font-size:10px;color:var(--muted);margin-left:6px">(${eh(users[doc.userId]?.email || 'Usuario')})</span>` : '';

      return `
        <div class="doc-item">
          <div class="doc-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div class="doc-info">
            <div class="doc-name" title="${eh(doc.fileName || 'Sin nombre')}">${eh(doc.fileName || 'Sin nombre')}${userName}</div>
            <div class="doc-meta"><span>${dateStr} • ${doc.sheets?.length || 0} hoja(s)</span><span class="doc-size">${sizeStr}</span></div>
          </div>
          <div class="doc-actions">
            <button class="doc-btn primary" data-doc-open="${eh(doc.id)}">Abrir</button>
            ${doc.userId === fbUser.uid || canListAll ?
              `<button class="doc-btn danger" data-doc-delete="${eh(doc.id)}" data-doc-path="${eh(doc.storagePath||'')}">Eliminar</button>` : ''}
          </div>
        </div>`;
    }).join('');

    body.innerHTML = `<div class="docs-list">${html}</div>`;
    body.querySelector('.docs-list')?.addEventListener('click', e => {
      const openBtn = e.target.closest('[data-doc-open]');
      const delBtn = e.target.closest('[data-doc-delete]');
      if(openBtn) openCloudDoc(openBtn.dataset.docOpen);
      if(delBtn) deleteCloudDoc(delBtn.dataset.docDelete, delBtn.dataset.docPath);
    });
  } catch(e){
    console.error('Error cargando documentos:', e);
    body.innerHTML = '<div class="docs-empty" style="color:#f87171">Error al cargar documentos: ' + e.message + '</div>';
  }
}

function closeDocsPanel(){
  document.getElementById('docs-panel').classList.remove('open');
  checkOverlaysOpen();
}

async function openCloudDoc(docId){
  try {
    const doc = await _fbDb.collection('documents').doc(docId).get();
    if(!doc.exists){ alert('Documento no encontrado.'); return; }

    const data = doc.data();
    const body = document.getElementById('docs-body');
    body.innerHTML = '<div class="docs-uploading">Descargando documento...<div class="docs-progress"><div class="docs-progress-bar" style="width:50%"></div></div></div>';

    // Obtener URL de descarga con CORS configurado
    const storageRef = _fbStorage.ref(data.storagePath);
    const downloadURL = await storageRef.getDownloadURL();

    // Descargar con fetch (ahora funciona gracias a CORS)
    const response = await fetch(downloadURL);
    const blob = await response.blob();

    const file = new File([blob], data.fileName, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    closeDocsPanel();

    // Simular selección de archivo y abrir en la app
    const input = document.getElementById('file-input');
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    // Disparar evento onchange
    const event = new Event('change', { bubbles: true });
    input.dispatchEvent(event);
  } catch(e){
    console.error('Error abriendo documento:', e);
    alert('Error al abrir: ' + e.message);
    openDocsPanel();
  }
}

async function deleteCloudDoc(docId, storagePath){
  if(!confirm('¿Eliminar este documento de la nube?')) return;

  try {
    // Eliminar de Storage (puede que no exista)
    try {
      await _fbStorage.ref(storagePath).delete();
    } catch(e){
      // Si el archivo no existe en Storage, continuar de todos modos
      if(e.code !== 'storage/object-not-found'){
        throw e; // Re-lanzar si es otro error
      }
      console.warn('Archivo no encontrado en Storage, eliminando solo metadata');
    }

    // Eliminar metadata de Firestore
    await _fbDb.collection('documents').doc(docId).delete();

    // Refrescar lista
    openDocsPanel();
  } catch(e){
    console.error('Error eliminando documento:', e);
    alert('Error al eliminar: ' + e.message);
  }
}

// Mostrar botón "Guardar" cuando hay archivo cargado
const _origOpenFileTab = openFileTab;
openFileTab = function(input){
  _origOpenFileTab.apply(this, arguments);
  if(fbUser){
    const btn = document.getElementById('btn-save-cloud');
    if(btn) btn.style.display = '';
    const apSc = document.getElementById('ap-save-cloud');
    if(apSc) apSc.style.display = '';
  }
};

// Overlays: fijar modo móvil/desktop al abrir para que no salten al redimensionar
let _modalVp = null;
let _overlayCheckRaf = null;
const _OVERLAY_IDS = [
  'mobile-menu', 'actions-panel', 'admin-panel', 'docs-panel',
  'pills-ficha-overlay', 'mobile-sheets-overlay',
  'detail-overlay', 'cond-overlay', 'fav-overlay', 'col-menu', 'hdr-overlay',
  'mobile-filter-overlay', 'fb-admin-overlay', 'fb-user-menu'
];
function _anyOverlayOpen(){
  return _OVERLAY_IDS.some(id => {
    const el = document.getElementById(id);
    return el && (el.classList.contains('open') || el.style.display === 'flex');
  });
}
function _lockModalViewport(){
  if(!_modalVp) _modalVp = window.innerWidth <= 500 ? 'mobile' : 'desktop';
  document.documentElement.dataset.modalVp = _modalVp;
}
function _updateModalViewport(){
  if(!_anyOverlayOpen()){
    _modalVp = null;
    document.documentElement.removeAttribute('data-modal-vp');
    return;
  }
  _lockModalViewport();
}
function scheduleOverlayCheck(){
  if(_overlayCheckRaf) return;
  _overlayCheckRaf = requestAnimationFrame(() => {
    _overlayCheckRaf = null;
    checkOverlaysOpen();
  });
}
function checkOverlaysOpen(){
  _updateModalViewport();
}
new MutationObserver(scheduleOverlayCheck).observe(document.body, {
  subtree: true,
  attributes: true,
  attributeFilter: ['class'],
  childList: true
});
window.addEventListener('resize', scheduleOverlayCheck);
window._lockModalViewport = _lockModalViewport;
window.scheduleOverlayCheck = scheduleOverlayCheck;
if(typeof _bootSessionRestore === 'function') _bootSessionRestore();

registerLegacyAuthListener((user) => {
  if (user) {
    _fbUpdateUserUI(user);
    if (typeof tabs !== 'undefined' && tabs.size > 0 && typeof T === 'function' && T()?.rawData?.length) {
      refreshActiveView(activeTabId);
      if (typeof _showFileActions === 'function') _showFileActions();
    }
  } else {
    document.getElementById('fb-user-badge')?.remove();
    document.getElementById('fb-admin-btn')?.remove();
    _updateActionsPanelUserHeader();
  }
  if (typeof _mobileUiRefresh === 'function') _mobileUiRefresh();
});

// ── Inline handler globals (auto-generated by scripts/split-phase0.mjs) ──
const __miradorGlobals = {
  _OVERLAY_IDS,
  _anyOverlayOpen,
  _fbAuth,
  _fbConfig,
  _fbDb,
  _fbEnsureAdminClaim,
  _fbFns,
  _fbShowLoginError,
  _fbStorage,
  _fbSyncClaims,
  _fbUpdateUserUI,
  fbUser,
  fbUserRole,
  _lockModalViewport,
  _modalVp,
  _origOpenFileTab,
  _overlayCheckRaf,
  _updateActionsPanelUserHeader,
  _updateModalViewport,
  checkOverlaysOpen,
  closeDocsPanel,
  deleteCloudDoc,
  fbChangePassword,
  fbCreateUser,
  fbOpenAdminPanel,
  fbShowUserMenu,
  fbToggleActive,
  loginWithEmail,
  openCloudDoc,
  openDocsPanel,
  saveToCloud,
  scheduleOverlayCheck,
};
for (const [key, val] of Object.entries(__miradorGlobals)) {
  if (val !== undefined) window[key] = val;
}

// Live Firebase refs for E2E tests (getters track auth state)
window._fbDb = _fbDb;
window._fbStorage = _fbStorage;
window._fbAuth = _fbAuth;
syncWindowAuth();

