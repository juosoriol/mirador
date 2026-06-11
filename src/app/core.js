'use strict';

import { filterRows } from '../engine/filter-engine.js';
import {
  DEFAULT_HDR_SCAN_ROWS,
  detectBestHeaderRow,
  getVisibleSheetNames,
  parseWorksheet,
} from '../engine/sheet-loader.js';
import {
  applyParsedSheetToTab,
  createTabState,
  resetTabFiltersForNewSheet,
} from '../engine/tab-model.js';

// ── CONSTANTES ────────────────────────────────────────────────────────────────
const SESSION_KEY  = 'mirador_session_v1';
const FAV_KEY      = 'mirador_favorites_v1';
const TAB_COLORS   = ['#16a34a','#2563eb','#d97706','#9333ea','#dc2626','#0891b2','#65a30d','#c026d3'];
const MAX_SESSION  = 8000;   // filas máximas guardadas en sesión por pestaña
const CHIP_LIMIT   = 500;    // máximo únicos para mostrar como chip
const SEARCH_DELAY = 80;     // debounce en ms — rápido para feedback en tiempo real

// ── ESTADO GLOBAL ─────────────────────────────────────────────────────────────
const tabs = new Map();
let activeTabId  = null;
let tabCounter   = 0;
let searchTimer  = null;
let lastClick    = null;
let _pillsOn     = false;

// Acceso rápido al tab activo
const T = () => tabs.get(activeTabId);

// ── HELPERS PUROS ─────────────────────────────────────────────────────────────
const eh  = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const ejs = s => String(s??'').replace(/'/g,"\\'");
const safe = v => (v==null||v instanceof Object&&v.constructor.name==='DBNull') ? '' : String(v).trim();

// DOM helpers — evitan querySelector repetido
const $  = id => document.getElementById(id);
const el = (tag,props={},children=[]) => {
  const e=document.createElement(tag);
  Object.entries(props).forEach(([k,v])=>{
    if(k==='style') e.style.cssText=v;
    else if(k==='cls') e.className=v;
    else if(k.startsWith('data-')) e.setAttribute(k, v);
    else e[k]=v;
  });
  children.forEach(c=>e.appendChild(typeof c==='string'?document.createTextNode(c):c));
  return e;
};

// Debounce genérico
const debounce = (fn,ms) => {
  let t;
  const d = (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); };
  d.flush = ()=>{ clearTimeout(t); fn(); };
  d.cancel = ()=>{ clearTimeout(t); };
  return d;
};

// ── SESIÓN ────────────────────────────────────────────────────────────────────
const SESSION_IDB = 'mirador_session_db';
const SESSION_IDB_STORE = 'session';
const WORKBOOK_IDB_PREFIX = 'workbook:';

function _workbookIdbKey(tabId){ return WORKBOOK_IDB_PREFIX + tabId; }

function _sessionWriteWorkbook(tabId, arrayBuffer){
  if(!arrayBuffer) return Promise.resolve(false);
  return _sessionOpenIdb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(SESSION_IDB_STORE, 'readwrite');
    tx.objectStore(SESSION_IDB_STORE).put(arrayBuffer, _workbookIdbKey(tabId));
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  })).catch(() => false);
}

function _sessionReadWorkbook(tabId){
  return _sessionOpenIdb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(SESSION_IDB_STORE, 'readonly');
    const req = tx.objectStore(SESSION_IDB_STORE).get(_workbookIdbKey(tabId));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  })).catch(() => null);
}

function _sessionClearWorkbooks(tabIds){
  const ids = tabIds || [...tabs.keys()];
  if(!ids.length) return Promise.resolve();
  return _sessionOpenIdb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(SESSION_IDB_STORE, 'readwrite');
    const store = tx.objectStore(SESSION_IDB_STORE);
    ids.forEach(id => store.delete(_workbookIdbKey(id)));
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  })).catch(() => {});
}

function _sessionCompactSheetCache(cache){
  if(!cache || typeof cache !== 'object') return {};
  const out = {};
  for(const [name, entry] of Object.entries(cache)){
    if(!entry?.rawData?.length) continue;
    const fakeTab = { rawData: entry.rawData, columns: entry.columns || [] };
    const compact = _sessionCompactTab(fakeTab);
    out[name] = {
      columns: compact.columns,
      rawData: compact.rawData,
      _manualHdrRow: entry._manualHdrRow ?? null,
      _hdrRangeStart: entry._hdrRangeStart ?? null,
      dateColsDetected: entry.dateColsDetected || [],
    };
  }
  return out;
}

function _cacheSheetData(tab, sheetName){
  if(!tab || !sheetName || !tab.rawData?.length) return;
  if(!tab._sheetCache) tab._sheetCache = {};
  const compact = _sessionCompactTab(tab);
  tab._sheetCache[sheetName] = {
    columns: compact.columns,
    rawData: compact.rawData,
    _manualHdrRow: tab._manualHdrRow ?? null,
    _hdrRangeStart: tab._hdrRangeStart ?? null,
    dateColsDetected: tab.dateColsDetected || [],
  };
}

async function _restoreWorkbooksFromIdb(){
  if(typeof XLSX === 'undefined') return;
  for(const [id, tab] of tabs){
    if(tab.workbook) continue;
    const buf = await _sessionReadWorkbook(id);
    if(!buf) continue;
    try{
      tab.workbook = XLSX.read(buf, { type: 'array', cellDates: false });
      const meta = (tab.workbook.Workbook?.Sheets) || [];
      tab.sheets = tab.workbook.SheetNames.filter((_, i) => {
        const m = meta[i];
        return !m || !m.Hidden;
      });
      if(!tab.sheets.length) tab.sheets = tab.workbook.SheetNames;
    }catch(e){
      console.warn('Workbook restore failed for tab', id, e);
    }
  }
}

function _loadSheetFromCache(tabId, sheetName, preserveFilters){
  const tab = tabs.get(tabId);
  const cached = tab?._sheetCache?.[sheetName];
  if(!tab || !cached?.rawData?.length) return false;
  tab.activeSheet = sheetName;
  tab.columns = cached.columns;
  tab.rawData = cached.rawData;
  tab.dateColsDetected = cached.dateColsDetected || tab.dateColsDetected || [];
  tab._manualHdrRow = cached._manualHdrRow ?? tab._manualHdrRow;
  tab._hdrRangeStart = cached._hdrRangeStart ?? tab._hdrRangeStart;
  tab.searchIndex = null;
  tab.colUniques = null;
  tab.colNulls = null;
  tab.selected = new Set();
  if(!preserveFilters){
    tab.colFilters = {};
    tab.condRules = [];
    tab.sortCol = null;
    tab.searchText = '';
    tab.searchCol = '';
    tab.dateFrom = '';
    tab.dateTo = '';
    tab.dateCol = '';
  }
  buildChips();
  buildSearchCombo();
  buildDateColCombo();
  enableControls(true);
  _syncDataViewAfterLoad(tabId);
  renderTabs();
  renderSheetsSidebar();
  setStatus(`"${sheetName}" — ${tab.rawData.length.toLocaleString()} filas · ${tab.columns.length} columnas (caché)`);
  updateBreadcrumb();
  saveSession();
  return true;
}

function _sessionCompactTab(t){
  const raw = t.rawData || [];
  const cols = t.columns || [];
  let keep = cols;
  if(cols.length && raw.length){
    keep = cols.filter(c => raw.some(r => r[c] !== '' && r[c] != null));
    if(!keep.length) keep = cols;
  }
  let compactRaw = raw;
  if(keep.length < cols.length){
    compactRaw = raw.map(r => {
      const o = {};
      for(const c of keep) o[c] = r[c] ?? '';
      return o;
    });
  }
  if(compactRaw.length > MAX_SESSION) compactRaw = compactRaw.slice(0, MAX_SESSION);
  return { columns: keep, rawData: compactRaw };
}

function _sessionBuildData(){
  const cur = T();
  if(cur){
    cur.searchCol = $('search-col').value || '';
    cur.dateFrom = $('date-from').value || '';
    cur.dateTo = $('date-to').value || '';
    cur.dateCol = $('date-col').value || '';
    if(_pillsOn) cur.pillsSearchText = $('pills-search-input')?.value ?? cur.pillsSearchText ?? '';
    else cur.searchText = $('search-input')?.value || '';
  }
  return {
    activeTabId,
    activeName: T()?.fileName || '',
    ts: Date.now(),
    tabs: [...tabs.values()].map(t => {
      const compact = _sessionCompactTab(t);
      const keepSet = new Set(compact.columns);
      const pickCols = arr => (arr || []).filter(c => keepSet.has(c));
      const cleanFilters = {};
      for(const [col, val] of Object.entries(t.colFilters || {})){
        if(keepSet.has(col)) cleanFilters[col] = val;
      }
      return {
        id: t.id, fileName: t.fileName, color: t.color,
        activeSheet: t.activeSheet, sheets: t.sheets,
        colFilters: cleanFilters, condRules: (t.condRules || []).filter(r => keepSet.has(r.col)),
        sortCol: keepSet.has(t.sortCol) ? t.sortCol : null, sortDir: t.sortDir,
        searchText: t.searchText, pillsSearchText: t.pillsSearchText || '', searchCol: t.searchCol,
        dateFrom: t.dateFrom, dateTo: t.dateTo, dateCol: keepSet.has(t.dateCol) ? t.dateCol : '',
        dateColsDetected: (t.dateColsDetected || []).filter(c => keepSet.has(c)),
        hiddenCols: pickCols([...t.hiddenCols || []]), frozenCols: pickCols([...t.frozenCols || []]),
        frozenOrder: pickCols(t.frozenOrder || []),
        columns: compact.columns,
        _manualHdrRow: t._manualHdrRow ?? null,
        _hdrRangeStart: t._hdrRangeStart ?? null,
        _hdrBySheet: t._hdrBySheet ?? null,
        _sheetCache: _sessionCompactSheetCache(t._sheetCache),
        statsPanels: (t.statsPanels || []).filter(c => keepSet.has(c)),
        rawData: compact.rawData,
      };
    }),
    pillsCfg: typeof _pillsLoadCfg === 'function' ? _pillsLoadCfg() : null,
  };
}

function _sessionReadLocal(){
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch(_) { return null; }
}

function _sessionOpenIdb(){
  return new Promise((resolve, reject) => {
    if(typeof indexedDB === 'undefined'){ reject(new Error('indexedDB unavailable')); return; }
    const req = indexedDB.open(SESSION_IDB, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(SESSION_IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function _sessionWriteIdb(json){
  return _sessionOpenIdb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(SESSION_IDB_STORE, 'readwrite');
    tx.objectStore(SESSION_IDB_STORE).put(json, SESSION_KEY);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  }));
}

function _sessionReadIdb(){
  return _sessionOpenIdb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(SESSION_IDB_STORE, 'readonly');
    const req = tx.objectStore(SESSION_IDB_STORE).get(SESSION_KEY);
    req.onsuccess = () => {
      if(!req.result){ resolve(null); return; }
      try { resolve(JSON.parse(req.result)); } catch(_) { resolve(null); }
    };
    req.onerror = () => reject(req.error);
  }));
}

function _sessionClearIdb(){
  return _sessionOpenIdb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(SESSION_IDB_STORE, 'readwrite');
    tx.objectStore(SESSION_IDB_STORE).delete(SESSION_KEY);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  })).catch(()=>{});
}

function _sessionReadEmergency(){
  try { return JSON.parse(localStorage.getItem(SESSION_KEY + '_emergency') || 'null'); } catch(_) { return null; }
}

async function _sessionReadAll(){
  const local = _sessionReadLocal();
  if(local && !local._store && local.tabs?.length) return local;
  const idb = await _sessionReadIdb().catch(() => null);
  if(idb?.tabs?.some(t => t.rawData?.length)) return idb;
  const emerg = _sessionReadEmergency();
  if(emerg?.tabs?.some(t => t.rawData?.length)) return emerg;
  if(local && !local._store) return local;
  return null;
}

function clearStoredSession(){
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY + '_emergency');
  } catch(_) {}
  _sessionClearWorkbooks([...tabs.keys()]);
  _sessionClearIdb();
}

function _sessionWriteEmergency(data){
  const lite = {
    activeTabId: data.activeTabId,
    activeName: data.activeName,
    ts: data.ts,
    tabs: data.tabs.map(t => ({
      ...t,
      rawData: (t.rawData || []).slice(0, 1500),
    })),
    pillsCfg: data.pillsCfg,
  };
  try { localStorage.setItem(SESSION_KEY + '_emergency', JSON.stringify(lite)); } catch(_) {}
}

function saveSession(){
  if(!tabs.size){ clearStoredSession(); return; }
  const data = _sessionBuildData();
  const json = JSON.stringify(data);
  try {
    localStorage.setItem(SESSION_KEY, json);
    try { localStorage.removeItem(SESSION_KEY + '_emergency'); } catch(_) {}
    _sessionClearIdb();
    return;
  } catch(_) {}
  const stub = {
    _store: 'idb', ts: data.ts, activeTabId: data.activeTabId,
    activeName: data.activeName, tabCount: data.tabs.length,
  };
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(stub)); } catch(_) {}
  _sessionWriteEmergency(data);
  _sessionWriteIdb(json).catch(()=>{});
}

function _flushSessionSave(){
  saveSessionDebounced.flush?.();
  saveSession();
}

function promptSessionRestore(){
  restoreSessionAsync();
  return true;
}

async function openSessionPanel(){
  const existing=$('session-panel');
  if(existing){ existing.remove(); return; }

  const saved = await _sessionReadAll();
  const panel=document.createElement('div');
  panel.id='session-panel';
  panel.style.cssText='position:fixed;z-index:700;background:var(--s1);border:1px solid var(--border2);border-radius:var(--r);box-shadow:0 6px 24px rgba(0,0,0,.4);width:320px;font-size:12px;overflow:hidden';

  if(!saved||!saved.tabs||!saved.tabs.filter(t=>t.rawData?.length).length){
    panel.innerHTML=`<div style="padding:12px 16px;color:var(--muted)">Sin sesión guardada</div>`;
  } else {
    const activeName=saved.activeName||'';
    const tabsHTML=saved.tabs.filter(t=>t.rawData?.length>0).map(t=>{
      const isActive=t.fileName===activeName;
      const filters=Object.entries(t.colFilters||{});
      const filterSummary=filters.slice(0,3).map(([col,val])=>{
        const label=Array.isArray(val)?`${col}:${val.length}vals`:col;
        return `<span style="padding:1px 5px;border-radius:6px;font-size:9px;background:var(--acc-dim);color:var(--acc-text);border:0.5px solid var(--acc)">${eh(label)}</span>`;
      }).join(' ')+(filters.length>3?`<span style="font-size:9px;color:var(--muted)">+${filters.length-3}</span>`:'');
      return `<div style="padding:8px 14px;border-bottom:0.5px solid var(--border);cursor:pointer${isActive?';background:var(--acc-dim)':''}" onclick="restoreSessionAsync().then(()=>$('session-panel')?.remove())">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:${t.sheets?.length||filters.length?'4':'0'}px">
          <span style="font-size:11px;font-weight:500;color:${isActive?'var(--acc-text)':'var(--text)'};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${isActive?'● ':''} ${eh(t.fileName||'Sin nombre')}</span>
          <span style="font-size:9px;color:var(--muted)">${(t.rawData?.length||0).toLocaleString()} filas</span>
        </div>
        ${t.sheets?.length>1?`<div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:3px">${t.sheets.map(s=>`<span style="font-size:9px;padding:1px 5px;border-radius:4px;background:${t.activeSheet===s?'var(--s3)':'var(--s2)'};color:${t.activeSheet===s?'var(--text)':'var(--muted)'}">${eh(s)}</span>`).join('')}</div>`:''}
        ${filterSummary?`<div style="display:flex;gap:3px;flex-wrap:wrap">${filterSummary}</div>`:''}
      </div>`;
    }).join('');
    panel.innerHTML=`
      <div style="padding:10px 14px;border-bottom:0.5px solid var(--border);display:flex;align-items:center;gap:8px">
        <span style="font-size:12px;font-weight:600;color:var(--text);flex:1">Sesión guardada</span>
        <span style="font-size:10px;color:var(--muted)">${new Date(saved.ts||Date.now()).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}</span>
        <button onclick="$('session-panel')?.remove()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;line-height:1">×</button>
      </div>
      <div style="max-height:360px;overflow-y:auto">${tabsHTML}</div>
      <div style="padding:8px 14px;border-top:0.5px solid var(--border);display:flex;gap:8px">
        <button onclick="restoreSessionAsync().then(()=>$('session-panel')?.remove())" style="flex:1;padding:5px;border-radius:var(--r);border:1px solid var(--acc);background:var(--acc-dim);color:var(--acc-text);cursor:pointer;font-size:11px;font-family:var(--font)">↺ Restaurar sesión</button>
        <button onclick="clearRecentSearches();$('session-panel')?.remove()" title="Borrar historial de búsquedas" style="padding:5px 10px;border-radius:var(--r);border:1px solid var(--border);background:none;color:var(--muted);cursor:pointer;font-size:11px;font-family:var(--font)">🧹</button>
        <button onclick="clearStoredSession();$('session-panel')?.remove();toast('Sesión eliminada')" style="padding:5px 10px;border-radius:var(--r);border:1px solid var(--border);background:none;color:var(--muted);cursor:pointer;font-size:11px;font-family:var(--font)">Borrar</button>
      </div>`;
  }

  // Posicionar: en móvil desde botón ⋯, en desktop desde btn-session
  const anchorEl = window.innerWidth<=500 ? $('btn-mobile-menu') : $('btn-session');
  const r=anchorEl?.getBoundingClientRect();
  if(r){
    panel.style.right=(window.innerWidth-r.right)+'px';
    panel.style.top=(r.bottom+4)+'px';
  } else {
    panel.style.right='8px'; panel.style.top='60px';
  }
  // En móvil: ancho casi completo
  if(window.innerWidth<=500) panel.style.width=(window.innerWidth-16)+'px';
  document.body.appendChild(panel);
  setTimeout(()=>document.addEventListener('mousedown',e=>{
    if(!panel.contains(e.target)&&e.target.id!=='btn-session') panel.remove();
  },{once:true}),10);
}

function _applySavedSession(saved, quiet){
  if(!saved?.tabs?.length) return false;
  saved.tabs.forEach(s=>{
    if(!s.columns?.length||!s.rawData?.length) return;
    tabCounter=Math.max(tabCounter,s.id);
    tabs.set(s.id,{
      id:s.id, fileName:s.fileName, color:s.color||TAB_COLORS[(s.id-1)%TAB_COLORS.length],
      workbook:null, sheets:s.sheets||[s.activeSheet||''], activeSheet:s.activeSheet||'',
      rawData:s.rawData, columns:s.columns, filtered:[], selected:new Set(),
      searchIndex:null, colUniques:null, colNulls:null,
      hiddenCols:new Set(s.hiddenCols||[]), frozenCols:new Set(s.frozenCols||[]), frozenOrder:s.frozenOrder||[],
      colFilters:s.colFilters||{}, condRules:s.condRules||[],
      sortCol:s.sortCol||null, sortDir:s.sortDir||1, activeChipCol:null,
      dateColsDetected:s.dateColsDetected||[],
      _manualHdrRow: s._manualHdrRow ?? null,
      _hdrRangeStart: s._hdrRangeStart ?? null,
      _hdrBySheet: s._hdrBySheet ?? null,
      _sheetCache: s._sheetCache || {},
      statsPanels: s.statsPanels || null,
      searchText:s.searchText||'', pillsSearchText:s.pillsSearchText||'', searchCol:s.searchCol||'',
      dateFrom:s.dateFrom||'', dateTo:s.dateTo||'', dateCol:s.dateCol||'',
    });
  });
  if(!tabs.size) return false;
  activeTabId = tabs.has(saved.activeTabId) ? saved.activeTabId : [...tabs.keys()][0];
  if(saved.pillsCfg) try{ localStorage.setItem(PILLS_KEY, JSON.stringify(saved.pillsCfg)); }catch(_){}
  renderTabs(); restoreTabUI();
  if(T()?.rawData?.length) refreshActiveView(activeTabId);
  if(!quiet) toast(`Sesión restaurada — ${tabs.size} pestaña(s)`);
  return true;
}

async function _applySavedSessionAsync(saved, quiet){
  const ok = _applySavedSession(saved, quiet);
  if(ok) await _restoreWorkbooksFromIdb();
  return ok;
}

function restoreSession(){
  try {
    const saved = _sessionReadLocal();
    if(saved && !saved._store && _applySavedSession(saved)) return true;
    const emerg = _sessionReadEmergency();
    if(emerg?.tabs?.length) return _applySavedSession(emerg);
    return false;
  } catch(_) { return false; }
}

async function restoreSessionAsync(){
  try {
    const saved = await _sessionReadAll();
    if(!saved?.tabs?.some(t => t.rawData?.length)) return false;
    return _applySavedSessionAsync(saved, true);
  } catch(_) { return false; }
}

async function _bootSessionRestore(){
  const hasSaved = _sessionReadLocal() || _sessionReadEmergency();
  if(hasSaved){
    $('loading').style.display = 'flex';
    $('dropzone').style.display = 'none';
    setStatus('Restaurando sesión…');
  }
  const ok = await restoreSessionAsync();
  if(ok) await _restoreWorkbooksFromIdb();
  $('loading').style.display = 'none';
  if(!ok && tabs.size === 0) showDropzone(true);
  else if(tabs.size > 0){
    _syncDataAreaView();
    const tab = T();
    if(tab?.rawData?.length) refreshActiveView(activeTabId);
  }
  if(T()) _showFileActions();
}

const saveSessionDebounced = debounce(saveSession, 1000);
setInterval(saveSession, 30000);
window.addEventListener('beforeunload', _flushSessionSave);
window.addEventListener('pagehide', _flushSessionSave);
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'hidden') _flushSessionSave();
});

// ── CERRAR OVERLAYS AL INICIO (fix móviles) ──
window.addEventListener('DOMContentLoaded', function(){
  // Cerrar todos los overlays/modales/menús al cargar
  const overlaysToClose = [
    'mobile-menu', 'actions-panel', 'admin-panel', 'docs-panel',
    'pills-ficha-overlay', 'mobile-sheets-overlay',
    'detail-overlay', 'cond-overlay', 'fav-overlay', 'col-menu', 'mobile-filter-overlay'
  ];
  overlaysToClose.forEach(id => {
    const el = document.getElementById(id);
    if(el) el.classList.remove('open');
  });
  // Remover overlays dinámicos
  ['fb-admin-overlay', 'fb-user-menu', 'tab-ctx-menu', 'fm-ctx-menu'].forEach(id => {
    document.getElementById(id)?.remove();
  });
  if(typeof _mfUnmountChips==='function') _mfUnmountChips();
  if(typeof _mobileUiRefresh==='function') _mobileUiRefresh();
});

// ── TABS ──────────────────────────────────────────────────────────────────────
function createTab(fileName){
  const id=++tabCounter;
  tabs.set(id, createTabState(id, fileName, TAB_COLORS[(id-1)%TAB_COLORS.length]));
  return id;
}

function updateActiveTabCount(){ /* conteo de filas retirado de pestañas */ }

function renderTabs(){
  const bar=$('tabs-bar'), addBtn=$('tab-add');
  const emptyState=$('tabs-empty-state');
  bar.querySelectorAll('.tab').forEach(t=>t.remove());
  if(tabs.size===0){
    if(emptyState) emptyState.style.display='flex';
    addBtn.style.display='none';
  } else {
    if(emptyState) emptyState.style.display='none';
    addBtn.style.display='';
  }
  tabs.forEach(tab=>{
    const isActive=tab.id===activeTabId;
    const ext=_tabFileExt(tab.fileName);
    const iconDot=_tabFileDot(ext);
    const isFav=_tabIsFav(tab.fileName);

    const div=el('div',{cls:'tab '+(isActive?'active':'inactive'),'data-id':tab.id});
    div.innerHTML=`
      <span class="tab-icon">${iconDot}</span>
      <div class="tab-body">
        <span class="tab-name" title="${eh(tab.fileName)}">${eh(tab.fileName)}${tab._autoRefresh?' <span style="color:var(--success)" title="Auto-refresh activo">&#x21BB;</span>':''}</span>
      </div>
      <span class="tab-star${isFav?' on':''}" data-star="${tab.id}" title="${isFav?'Quitar favorito':'Marcar favorito'}">&#9733;</span>
      <span class="tab-close" data-close="${tab.id}" title="Cerrar">×</span>`;

    div.onclick=e=>{
      if(e.target.dataset.close){closeTab(+e.target.dataset.close);return}
      if(e.target.dataset.star){_tabToggleFav(tabs.get(+e.target.dataset.star));return}
      switchTab(tab.id);
    };
    div.oncontextmenu=e=>{e.preventDefault();_tabCtx(e,tab.id);};
    bar.insertBefore(div,addBtn);
  });
  _updateSheetsBtn();
  _syncDataAreaView();
}

function _syncDataAreaView(){
  const tab=T();
  if(tabs.size>0&&activeTabId&&tab?.rawData?.length){
    $('dropzone').style.display='none';
    if(_pillsOn){
      $('table-wrap').style.display='none';
      $('data-area').style.display='none';
    } else if(!$('pills-view')?.classList.contains('open')){
      $('table-wrap').style.display='flex';
    }
  }
}

// File extension detection
function _tabFileExt(name){
  const m=(name||'').match(/\.(\w+)$/);
  return m?m[1].toLowerCase():'xlsx';
}

const _EXCEL_EXTS=new Set(['xlsx','xls','xlsb','xlsm']);
function _tabFileDot(ext){
  const c=_EXCEL_EXTS.has(ext)?'#22c55e':'#6366f1';
  const lbl=_EXCEL_EXTS.has(ext)?'Excel':(ext||'archivo').toUpperCase();
  return `<span class="tab-dot" style="background:${c}" title="${eh(lbl)}"></span>`;
}

// Star → guardar/quitar vista inmediatamente
function _tabIsFav(fileName){
  return getFavs().some(f=>f.state?.fileName===fileName);
}
function _tabBuildViewState(tab){
  return {
    colFilters:JSON.parse(JSON.stringify(tab.colFilters||{})),
    searchText:tab.searchText||$('search-input')?.value||'',
    searchCol:tab.searchCol||$('search-col')?.value||'',
    dateFrom:tab.dateFrom||$('date-from')?.value||'',
    dateTo:tab.dateTo||$('date-to')?.value||'',
    dateCol:tab.dateCol||$('date-col')?.value||'',
    fileName:tab.fileName, activeSheet:tab.activeSheet, sheets:tab.sheets,
    columns:tab.columns, rawData:tab.rawData, dateColsDetected:tab.dateColsDetected, color:tab.color
  };
}
function _tabSaveView(tab){
  const state=_tabBuildViewState(tab);
  const name=(tab.fileName||'Vista').replace(/\.[^.]+$/,'');
  const favs=getFavs();
  const idx=favs.findIndex(f=>f.state?.fileName===tab.fileName);
  const fav={name,summary:buildFilterSummary(state),state,date:new Date().toLocaleDateString('es-CO')};
  if(idx>=0) favs[idx]=fav; else favs.push(fav);
  setFavs(favs);
  const fmList=_fmLoad();
  const fmIdx=fmList.findIndex(x=>x.name===tab.fileName);
  if(fmIdx>=0 && !fmList[fmIdx].fav){ fmList[fmIdx].fav=true; _fmSave(fmList); }
  toast(`⭐ Vista "${name}" guardada`);
}
function _tabRemoveView(tab){
  const favs=getFavs();
  const idx=favs.findIndex(f=>f.state?.fileName===tab.fileName);
  if(idx<0) return;
  const name=favs[idx].name;
  favs.splice(idx,1);
  setFavs(favs);
  const fmList=_fmLoad();
  const fmIdx=fmList.findIndex(x=>x.name===tab.fileName);
  if(fmIdx>=0){ fmList[fmIdx].fav=false; _fmSave(fmList); }
  toast(`"${name}" quitada de vistas`);
}
function _tabToggleFav(tab){
  if(!tab) return;
  if(_tabIsFav(tab.fileName)) _tabRemoveView(tab);
  else _tabSaveView(tab);
  renderTabs();
}

// Context menu
const TAB_CTX_COLORS=['#10b981','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16'];
function _tabCtx(e,tabId){
  _tabCloseCtx();
  const tab=tabs.get(tabId); if(!tab) return;
  const menu=document.createElement('div');
  menu.id='tab-ctx-menu';
  menu.className='tab-ctx';
  menu.style.left=e.clientX+'px';
  menu.style.top=e.clientY+'px';

  const isFav=_tabIsFav(tab.fileName);
  menu.innerHTML=`
    <div style="padding:4px 12px;font-size:10px;color:var(--muted);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px">${eh(tab.fileName)}</div>
    <div class="tab-ctx-sep"></div>
    <div class="tab-ctx-item" onclick="_tabToggleFav(tabs.get(${tabId}));_tabCloseCtx()"><span style="font-size:13px;color:${isFav?'#f59e0b':'var(--muted)'}">★</span> ${isFav?'Quitar favorito':'Marcar favorito'}</div>
    <div class="tab-ctx-item" onclick="openRefreshModal();_tabCloseCtx()"><span style="font-size:13px">↻</span> Auto-refresh</div>
    <div class="tab-ctx-sep"></div>
    <div style="padding:3px 12px;font-size:9px;color:var(--muted)">Color de pestaña</div>
    <div class="tab-ctx-colors">${TAB_CTX_COLORS.map(color=>
      `<div class="tab-ctx-cdot${tab.color===color?' sel':''}" style="background:${color}" onclick="_tabSetColor(${tabId},'${color}')"></div>`
    ).join('')}</div>
    <div class="tab-ctx-sep"></div>
    <div class="tab-ctx-item danger" onclick="closeTab(${tabId});_tabCloseCtx()"><span style="font-size:13px">✕</span> Cerrar</div>`;

  document.body.appendChild(menu);
  const r=menu.getBoundingClientRect();
  if(r.right>window.innerWidth) menu.style.left=(window.innerWidth-r.width-8)+'px';
  if(r.bottom>window.innerHeight) menu.style.top=(window.innerHeight-r.height-8)+'px';
  setTimeout(()=>document.addEventListener('mousedown',_tabCtxOutside,{once:true}),10);
}
function _tabSetColor(tabId,color){
  const tab=tabs.get(tabId); if(!tab) return;
  tab.color=color;
  _tabCloseCtx();
  renderTabs();
  saveSessionDebounced();
}
function _tabCloseCtx(){ const m=$('tab-ctx-menu'); if(m) m.remove(); }
function _tabCtxOutside(e){ const m=$('tab-ctx-menu'); if(m&&!m.contains(e.target)) _tabCloseCtx(); else if(m) setTimeout(()=>document.addEventListener('mousedown',_tabCtxOutside,{once:true}),10); }

function switchTab(id){
  if(!tabs.has(id)) return;
  const cur=T();
  if(cur){
    cur.searchCol=$('search-col').value||''; cur.dateFrom=$('date-from').value||''; cur.dateTo=$('date-to').value||''; cur.dateCol=$('date-col').value||'';
    if(_pillsOn){
      cur.pillsSearchText=$('pills-search-input')?.value??cur.pillsSearchText??'';
      cur._pillsSel={
        main:$('pills-sel-main')?.value||'',
        sec:$('pills-sel-sec')?.value||'',
        color:$('pills-sel-color')?.value||'none',
        avatar:$('pills-sel-avatar')?.value||'',
        design:$('pills-sel-design')?.value||'d1',
      };
    } else {
      cur.searchText=$('search-input')?.value||'';
    }
  }
  activeTabId=id; renderTabs(); restoreTabUI();
}



function _syncPillsSearchUI(tab){
  const v=(tab?.pillsSearchText||'').trim();
  const pinp=$('pills-search-input');
  if(pinp){ pinp.value=v; pinp.style.borderColor=v?'var(--acc)':'var(--border)'; }
  const clr=$('pills-search-clear');
  if(clr) clr.style.display=v?'block':'none';
}
function restoreTabUI(){
  const tab=T();
  if(!tab){showDropzone(true);return}
  closeDropdown();
  renderSheetsSidebar();
  if(!tab.rawData.length){
    if(tab.workbook){
      $('loading').style.display='flex';
      $('dropzone').style.display='none';
      $('table-wrap').style.display='none';
      setStatus('Cargando datos…');
      return;
    }
    showDropzone(false);
    setStatus('Sin datos.');
    return;
  }
  buildSearchCombo();
  setSelectValue('search-col', tab.searchCol);
  buildDateColCombo();
  $('date-from').value = tab.dateFrom||'';
  $('date-to').value   = tab.dateTo||'';
  setSelectValue('date-col', tab.dateCol);
  buildChips();
  enableControls(true);
  $('dropzone').style.display='none';
  if(_pillsOn){
    $('search-input').value=tab.searchText||'';
    _syncPillsSearchUI(tab);
    $('table-wrap').style.display='none';
    $('data-area').style.display='none';
    $('pills-view')?.classList.add('open');
    updateBreadcrumb();
    setStatus(`"${tab.activeSheet||'Datos'}" — ${tab.rawData.length.toLocaleString()} filas · ${tab.columns.length} columnas`);
    _mobileUiRefresh();
    refreshActiveView(activeTabId);
    return;
  }
  $('search-input').value = tab.searchText||'';
  applyFilters();
  $('table-wrap').style.display='flex';
  updateBreadcrumb();
  setStatus(`"${tab.activeSheet||'Datos'}" — ${tab.rawData.length.toLocaleString()} filas · ${tab.columns.length} columnas`);
  _mobileUiRefresh();
}

function setSelectValue(id, val){
  const s=$(id); if(!s) return;
  for(let i=0;i<s.options.length;i++) if(s.options[i].value===val){s.selectedIndex=i;return}
  s.selectedIndex=0; // fallback: primer elemento si el valor no existe
}

function _hideFileActions(){
  ['btn-export','btn-mobile-sheets','btn-save-cloud'].forEach(id=>{
    const e=$(id); if(e) e.style.display='none';
  });
  const apSc=$('ap-save-cloud'); if(apSc) apSc.style.display='none';
  _updateSheetsBtn();
}
function showDropzone(full=true){
  if(full) _resetPillsSurface();
  $('dropzone').style.display='flex';
  $('table-wrap').style.display='none';
  $('loading').style.display='none';
  $('stats-bar').classList.remove('visible');
  if(full){
    enableControls(false);
    _hideFileActions();
    updateBreadcrumb();
    setStatus('Abre un archivo .xlsx para comenzar.');
    $('search-input').value='';
    $('chips-placeholder').style.display='inline';
    $('chips-right').style.display='none';
    $('chips-bar')?.querySelectorAll('.chip').forEach(c=>c.remove());
    $('sheet-list').innerHTML='<div style="padding:10px 12px;color:var(--muted);font-size:11px">Abre un .xlsx</div>';
  }
  updateStatusBar();
  _mobileUiRefresh();
}

// ── CARGA DE ARCHIVO ──────────────────────────────────────────────────────────
function openFilePicker(){
  const inp=$('file-input');
  if(!inp) return;
  inp.click();
}
function onDragOver(e){e.preventDefault();$('dropzone').classList.add('dragover')}
function onDrop(e){e.preventDefault();$('dropzone').classList.remove('dragover');[...e.dataTransfer.files].forEach(f=>{if(/\.(xlsx?|xlsb|xlsm|csv|tsv|ods|json|txt)$/i.test(f.name))processFile(f)})}
function openFileTab(inp){[...inp.files].forEach(processFile);inp.value=''}

function _fileLoadFailed(tabId, msg){
  $('loading').style.display='none';
  if(tabId != null && tabs.has(tabId) && !tabs.get(tabId)?.rawData?.length){
    closeTab(tabId);
  }
  showDropzone(true);
  toast(msg || 'No se pudo leer el archivo.', true);
}
function processFile(file){
  if(!file) return;
  if(typeof XLSX === 'undefined'){
    _fileLoadFailed(null, 'La librería Excel no cargó. Recarga la página e inténtalo de nuevo.');
    return;
  }
  const tabId=createTab(file.name);
  const tab=tabs.get(tabId);
  tab._file=file; // guardar referencia al File para recargar
  tab._lastLoaded=Date.now();
  tab._autoRefresh=0; // 0=off, >0=ms intervalo
  activeTabId=tabId; renderTabs();
  $('loading').style.display='flex'; $('dropzone').style.display='none'; $('table-wrap').style.display='none';
  const r=new FileReader();
  r.onload=e=>{
    try{
      const tab=tabs.get(tabId);
      if(!tab) return;
      const buf=e.target.result;
      tab.workbook=XLSX.read(buf,{type:'array',cellDates:false});
      _sessionWriteWorkbook(tabId, buf);
      tab.sheets=getVisibleSheetNames(tab.workbook);
      if(!tab.sheets.length) throw new Error('El archivo no tiene hojas visibles.');
      renderTabs();
      loadSheet(tab.sheets[0],tabId,false);
      fmRegisterFile(tab.fileName, tab.sheets?.length||0, 0);
    }catch(err){_fileLoadFailed(tabId, 'Error: '+err.message)}
  };
  r.onerror=()=>_fileLoadFailed(tabId, 'No se pudo leer el archivo.');
  r.onabort=()=>_fileLoadFailed(tabId, 'Lectura del archivo cancelada.');
  r.readAsArrayBuffer(file);
}

// ── HOJAS ─────────────────────────────────────────────────────────────────────
function _hdrRowForSheet(tab, sheetName){
  const entry=tab._hdrBySheet?.[sheetName];
  if(entry!=null){
    const r=typeof entry==='number'?entry:entry.row;
    if(r!=null) return r;
  }
  if(tab.activeSheet===sheetName&&tab._manualHdrRow!=null) return tab._manualHdrRow;
  return null;
}

function renderSheetsSidebar(){
  _updateSheetsBtn();
  const tab=T();
  const sl=$('sheet-list');
  if(!sl) return;
  if(!tab?.sheets?.length){
    sl.innerHTML='<div style="padding:10px 12px;color:var(--muted);font-size:11px">Abre un .xlsx</div>';
    return;
  }
  const hdrRow=tab._manualHdrRow!=null&&tab._hdrRangeStart!=null
    ? tab._manualHdrRow-tab._hdrRangeStart+1
    : null;
  const hdrInfo=hdrRow!=null
    ? `<div style="padding:4px 12px 6px;font-size:10px;color:var(--muted);border-bottom:1px solid var(--border);margin-bottom:4px">
         Encabezado: fila <strong style="color:var(--acc-text)">${hdrRow}</strong>
         <span onclick="reopenHdrPicker()" style="margin-left:6px;color:var(--acc-text);cursor:pointer;text-decoration:underline;font-size:10px">cambiar</span>
       </div>`
    : '';
  sl.innerHTML=hdrInfo+tab.sheets.map(n=>`
    <div class="sheet-item${tab.activeSheet===n?' active':''}" onclick="loadSheet('${ejs(n)}',null,false)">
      <div class="s-icon"></div>
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${eh(n)}</span>
    </div>`).join('');
}

function _syncDataViewAfterLoad(tabId){
  refreshActiveView(tabId);
}

function loadSheet(name, tabId, preserveFilters){
  const tid = tabId||activeTabId;
  const tab = tabs.get(tid); if(!tab) return;
  if(tid!==activeTabId){activeTabId=tid;renderTabs()}
  const prevSheet=tab.activeSheet;
  const prevSort=preserveFilters?{col:tab.sortCol,dir:tab.sortDir}:null;
  tab.activeSheet=name; tab.selected=new Set(); tab.activeChipCol=null;
  if(!preserveFilters){ resetTabFiltersForNewSheet(tab); }
  else if(prevSort){ tab.sortCol=prevSort.col; tab.sortDir=prevSort.dir; }
  closeDropdown(); renderSheetsSidebar();

  // Sin workbook → usar caché de hojas visitadas o datos en memoria
  if(!tab.workbook){
    if(prevSheet!==name){
      if(_loadSheetFromCache(tid, name, preserveFilters)) return;
      tab.activeSheet=prevSheet;
      renderSheetsSidebar();
      toast('Abre el archivo de nuevo para cambiar de hoja', true);
      return;
    }
    _syncSearchInputFromTab(tab);
    buildChips(); buildSearchCombo(); buildDateColCombo();
    enableControls(true);
    _syncDataViewAfterLoad(tid);
    return;
  }

  const ws=tab.workbook.Sheets[name]; if(!ws){toast('Hoja no encontrada');return}
  const range=XLSX.utils.decode_range(ws['!ref']||'A1');

  // Detectar la mejor fila de encabezado
  const detectedRow = detectBestHeaderRow(ws, range);
  const totalDataRows = range.e.r - detectedRow;

  const savedHdr=_hdrRowForSheet(tab, name);
  if(savedHdr!=null){
    _processSheetData(tid, name, ws, range, savedHdr, preserveFilters);
    return;
  }

  // Si la hoja es pequeña (≤500 filas) o la detección es en la primera fila, procesar directo con banner de confirmación
  // Para hojas grandes o con filas de encabezado tardías: siempre abrir picker
  // Abrir picker si: hay filas encima del encabezado detectado, O la hoja tiene
  // muchas columnas y el encabezado no está en la primera fila
  const rowsAbove = detectedRow - range.s.r;

  // Siempre auto-detectar y procesar directamente — el picker es solo bajo demanda
  _processSheetData(tid, name, ws, range, detectedRow, preserveFilters);
  if(rowsAbove > 0){
    _showHdrToast(rowsAbove + 1);
  }
}

/**
 * Procesa los datos de una hoja a partir de la fila de encabezado indicada.
 */
function _processSheetData(tabId, name, ws, range, hRow, preserveFilters){
  const tab = tabs.get(tabId); if(!tab) return;
  const parsed = parseWorksheet(ws, range, hRow, {
    parseDateCode: XLSX.SSF?.parse_date_code,
    manualDateCols: tab._manualDateCols,
  });
  if(parsed.isEmpty){toast('La hoja no tiene datos');$('loading').style.display='none';return}

  const meta = applyParsedSheetToTab(tab, name, parsed, range.s.r, preserveFilters);

  if(preserveFilters){
    _syncSearchInputFromTab(tab);
    if(_pillsOn) _syncPillsSearchUI(tab);
  }
  buildChips(); buildSearchCombo(); buildDateColCombo();
  enableControls(true);
  _syncDataViewAfterLoad(tabId);
  renderTabs();
  const skippedNote = meta.rowsSkipped > 0 ? ` · ${meta.rowsSkipped} fila${meta.rowsSkipped>1?'s':''} ignorada${meta.rowsSkipped>1?'s':''}` : '';
  setStatus(`"${name}" — ${meta.rowCount.toLocaleString()} filas · ${meta.colCount} columnas${skippedNote}`);
  updateBreadcrumb();
  renderSheetsSidebar();
  fmRegisterFile(tab.fileName, tab.sheets?.length||0, tab.rawData.length);
  _cacheSheetData(tab, name);
  saveSession();
  saveSessionDebounced();
}


// ── FORMATO DE FECHA ──────────────────────────────────────────────────────────
// Internamente: yyyy-mm-dd (para ordenar/filtrar correctamente)
// En pantalla:  dd/mm/yyyy (formato Colombia)
const RE_ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
function fmtDate(v){
  if(!v) return v;
  const s=String(v);
  const m=s.match(RE_ISO_DATE);
  if(m) return `${m[3]}/${m[2]}/${m[1]}`; // yyyy-mm-dd → dd/mm/yyyy ✅
  // Fallback: si aún llega mm/dd/yyyy (legacy) → convertir
  const mUs=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(mUs&&parseInt(mUs[2])>12) return `${mUs[2].padStart(2,'0')}/${mUs[1].padStart(2,'0')}/${mUs[3]}`;
  return s;
}
// Aplicar formato a un valor según si la columna es de fecha
function fmtCell(col, v, tab){
  if(v==null||v===''||!tab) return v??'';
  if((tab.dateColsDetected||[]).includes(col)) return fmtDate(v);
  return v;
}

// ── CHIPS ─────────────────────────────────────────────────────────────────────
// Precalcula colUniques y colNulls en UNA pasada sobre rawData (O(N))
// y los guarda en el tab para no recalcular en cada updateChipStates
function precalcColStats(tab){
  tab.colUniques = {}; // col -> Set de valores únicos (rawData completo)
  tab.colNulls   = {}; // col -> conteo de nulos (rawData completo)
  const dc = new Set(tab.dateColsDetected);
  const ced = tab.columns.find(c=>/^c[eé]dula$/i.test(c.trim()));
  for(const row of tab.rawData){
    if(!row) continue;
    for(const col of tab.columns){
      const v = row[col];
      if(v===''||v==null){
        tab.colNulls[col]=(tab.colNulls[col]||0)+1;
      } else {
        if(!tab.colUniques[col]) tab.colUniques[col]=new Set();
        tab.colUniques[col].add(v);
      }
    }
  }
}

function buildChips(){
  const tab=T(); if(!tab) return;
  if(!tab.colUniques) precalcColStats(tab);
  if(_mfChipsMounted) _mfUnmountChips();
  $('mf-chips-host')?.querySelectorAll('.chip').forEach(c=>c.remove());
  _mfChipsMounted=false;

  const bar=$('chips-bar');
  $('chips-placeholder').style.display='none';
  $('chips-right').style.display='flex';
  bar.querySelectorAll('.chip').forEach(c=>c.remove());
  const ref=$('chips-right');

  // Show search input
  const sw=$('chip-search-wrap');
  if(sw) sw.style.display='flex';
  const si=$('chip-search');
  if(si){ si.value=''; si.disabled=false; }

  const makeChip=(col,special)=>{
    const chip=el('div',{cls:'chip'});
    chip.dataset.col=col;
    if(special) chip.dataset.special=special;
    chip._origHTML=null; // reset for chip search
    chip.onclick=e=>{ if(e.target.closest('.chip-x')){removeColFilter(col);return} toggleChipDropdown(col,chip); };
    bar.insertBefore(chip,ref);
    return chip;
  };

  const cedCol=tab.columns.find(c=>/^c[eé]dula$/i.test(c.trim()));
  const hid=tab.hiddenCols||new Set();
  if(cedCol) makeChip(cedCol,'null-filter'); // siempre visible, aunque la columna esté oculta

  tab.columns.forEach(col=>{
    if(hid.has(col)) return;
    if(cedCol&&col===cedCol) return;
    if(tab.dateColsDetected.includes(col)){
      makeChip(col,'date-filter'); // date columns get their own chip type
      return;
    }
    const u=(tab.colUniques[col]?.size)||0;
    if(u>=1&&u<=CHIP_LIMIT) makeChip(col,null);
  });
  updateChipStates();
}

function updateChipStates(){
  const tab=T(); if(!tab) return;
  if(!tab.colUniques) precalcColStats(tab); // guardia: nunca acceder null
  const chips=[...$('chips-bar').querySelectorAll('.chip[data-col]'),
    ...($('mf-chips-host')?.querySelectorAll('.chip[data-col]')||[])];
  if(!chips.length) return;

  // Obtener solo las columnas que tienen chip para limitar la pasada
  const chipCols=new Set([...chips].map(c=>c.dataset.col));

  // Una pasada sobre filtered, solo para columnas con chip
  const filtCnt={}; // col -> conteo de valores no-vacíos en filtered
  for(const i of tab.filtered){
    const row=tab.rawData[i]; if(!row) continue;
    for(const col of chipCols){
      const v=row[col];
      if(v!=null&&v!=='') filtCnt[col]=(filtCnt[col]||0)+1;
    }
  }

  chips.forEach(chip=>{
    const col=chip.dataset.col;
    const isSpec=chip.dataset.special==='null-filter';
    const isDate=chip.dataset.special==='date-filter';
    const active=tab.colFilters[col]!==undefined;
    chip.classList.toggle('active',active);
    const val=tab.colFilters[col];
    if(active){
      let label;
      if(Array.isArray(val)){
        label = val.length===1 ? val[0] : `${val.length} seleccionados`;
      } else {
        label = val==='__NULL__'?'sin cédula':val==='__WITH__'?'con cédula':val?.startsWith('__CONTAINS__:')?`contiene "${val.slice(13)}"`:val?.startsWith('__DATE_RANGE__:')?`${val.slice(14).split('__TO__:')[0]||'*'} → ${val.split('__TO__:')[1]||'*'}`:String(val);
      }
      chip.innerHTML=`${isSpec?'🪪 ':isDate?'📅 ':''}${eh(col)}: <strong class="chip-val">${eh(label)}</strong> <span class="chip-x">×</span>`;
    } else if(isSpec){
      const nulls=tab.colNulls[col]||0;
      chip.innerHTML=`🪪 ${eh(col)} ${nulls>0?'⚠️':''}<span class="chip-count">${nulls} nulos</span>`;
    } else if(isDate){
      const cnt=filtCnt[col]||0;
      chip.innerHTML=`📅 ${eh(col)} <span class="chip-count">${cnt}</span>`;
    } else {
      chip.innerHTML=`${eh(col)} <span class="chip-count">${filtCnt[col]||0}</span>`;
    }
  });
  const n=Object.keys(tab.colFilters).length;
  $('chips-count').textContent=n>0?`${n} filtro${n>1?'s':''} activo${n>1?'s':''}`:'' ;
  // Cache HTML for chip search restore
  chips.forEach(chip=>{ chip._origHTML=chip.innerHTML; });
  // Sync filter indicator to table headers
  document.querySelectorAll('thead th[data-col]').forEach(th=>{
    const col=th.dataset.col;
    th.classList.toggle('col-filtered', col && tab.colFilters[col]!==undefined);
  });
  // Update toggle badge and clear button
  setTimeout(_updateChipsBadge, 50);
  _updateClearChipBtn();
  _mobileUiRefresh();
  if($('mobile-filter-overlay')?.classList.contains('open')) _mfSyncOptionsUI();
}

function toggleChipsBar(){
  const bar=$('chips-bar');
  const tog=$('chips-toggle');
  const lbl=$('chips-toggle-label');
  const isOpen=bar.classList.contains('chips-expanded');
  bar.classList.toggle('chips-expanded',!isOpen);
  tog.classList.toggle('open',!isOpen);
  lbl.textContent=isOpen?'Ver todos':'Colapsar';
  _updateChipsBadge();
}

function _updateChipsBadge(){
  const bar=$('chips-bar');
  const tog=$('chips-toggle');
  const badge=$('chips-more-badge');
  const chips=[...(bar?.querySelectorAll('.chip')||[])];
  if(!chips.length){ if(tog) tog.style.display='none'; return; }
  if(tog) tog.style.display='flex';
  const isOpen=bar.classList.contains('chips-expanded');
  if(badge) badge.textContent='';
  const lbl=$('chips-toggle-label');
  if(lbl) lbl.textContent=isOpen?'Colapsar':'Ver todos';
  const chevron=tog?.querySelector('svg');
  if(chevron) chevron.style.transform=isOpen?'rotate(180deg)':'';
}

function _visibleChipsInOneLine(bar, chips){
  // Rough estimate: total chip widths that fit in bar width
  const barW=bar.clientWidth - 280; // subtract search + toggle
  let usedW=0, count=0;
  for(const chip of chips){
    const w=(chip.offsetWidth||100)+6;
    if(usedW+w>barW) break;
    usedW+=w; count++;
  }
  return Math.max(3, count);
}

function _clearChipSearch(){
  const si=$('chip-search');
  if(si&&si.value){ si.value=''; onChipSearch(); return; }
  clearChipFiltersOnly();
}

function _updateClearChipBtn(){
  const btn=$('btn-clear-chips'); if(!btn) return;
  const tab=T();
  const hasSearch=!!($('chip-search')?.value||'').trim();
  const hasFilters=tab&&Object.keys(tab.colFilters||{}).length>0;
  btn.style.opacity=(hasSearch||hasFilters)?'1':'0.3';
  btn.style.cursor=(hasSearch||hasFilters)?'pointer':'default';
}

// ── BUSCADOR DE CHIPS ────────────────────────────────────────────────────────
function initChipSearch(){
  const si=$('chip-search');
  if(!si) return;
  si.addEventListener('input',onChipSearch);
  si.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      si.value=''; onChipSearch(); si.blur();
    }
    if(e.key==='Enter'){
      e.preventDefault();
      // Abrir el primer chip resaltado
      const first=document.querySelector('.chip.chip-hl');
      if(first) first.click();
      si.value=''; onChipSearch();
    }
  });
}

function onChipSearch(){
  const q=($('chip-search')?.value||'').toLowerCase().trim();
  const bar=$('chips-bar');
  const chips=[...bar.querySelectorAll('.chip')];
  const ref=$('chips-right');

  if(!q){
    // Restore: cédula siempre de primera, resto en orden original
    const cedChip=chips.find(c=>c.dataset.special==='null-filter');
    chips.forEach(chip=>{
      chip.classList.remove('chip-dim','chip-hl');
      if(chip._origHTML) chip.innerHTML=chip._origHTML;
      bar.insertBefore(chip, ref);
    });
    // Re-anclar cédula al inicio (justo después de chip-search-wrap)
    if(cedChip){
      const sw=$('chip-search-wrap');
      const swNext=sw?sw.nextSibling:null;
      // Si nextSibling es el mismo cedChip, ya está en su lugar
      if(swNext!==cedChip) bar.insertBefore(cedChip, swNext);
    }
    return;
  }

  bar.classList.add('chips-expanded');
  const cedChip=chips.find(c=>c.dataset.special==='null-filter');
  const matching=[], nonMatching=[];

  chips.forEach(chip=>{
    const isCed=chip.dataset.special==='null-filter';
    if(isCed) return; // cédula se maneja aparte
    const col=(chip.dataset.col||'').toLowerCase();
    const match=col.includes(q);
    chip.classList.toggle('chip-dim',!match);
    chip.classList.toggle('chip-hl',match);
    if(match){
      if(!chip._origHTML) chip._origHTML=chip.innerHTML;
      chip.innerHTML=chip._origHTML;
      _highlightChipText(chip, q);
      matching.push(chip);
    } else {
      if(chip._origHTML) chip.innerHTML=chip._origHTML;
      nonMatching.push(chip);
    }
  });

  // Cédula: siempre primera, nunca dim, sin highlight aunque coincida
  const sw=$('chip-search-wrap');
  if(cedChip){
    cedChip.classList.remove('chip-dim','chip-hl');
    if(cedChip._origHTML) cedChip.innerHTML=cedChip._origHTML;
    bar.insertBefore(cedChip, sw.nextSibling);
  }
  // El resto: matching después de cédula, nonMatching al final
  const anchor=cedChip?cedChip.nextSibling:sw.nextSibling;
  matching.forEach(chip=>bar.insertBefore(chip, anchor));
  nonMatching.forEach(chip=>bar.insertBefore(chip, ref));
  _updateClearChipBtn();
}

function _highlightChipText(chip, q){
  // Walk text nodes and wrap the match — avoids breaking HTML structure
  const walker=document.createTreeWalker(chip, NodeFilter.SHOW_TEXT, null);
  const matches=[];
  let node;
  while((node=walker.nextNode())){
    const text=node.textContent;
    const lower=text.toLowerCase();
    const idx=lower.indexOf(q);
    if(idx>=0) matches.push({node,idx,q});
  }
  // Process in reverse to preserve offsets
  for(let i=matches.length-1;i>=0;i--){
    const {node,idx,q}=matches[i];
    const text=node.textContent;
    const span=document.createElement('span');
    span.className='chip-hl-text';
    span.textContent=text.slice(idx,idx+q.length);
    const after=document.createTextNode(text.slice(idx+q.length));
    node.textContent=text.slice(0,idx);
    node.parentNode.insertBefore(span,node.nextSibling);
    node.parentNode.insertBefore(after,span.nextSibling);
    break; // highlight only first match per chip
  }
}

// ── PANEL DE FILTRO MULTI-CHECKBOX ────────────────────────────────────────────
let _cdpCol = null;        // columna activa en el panel
let _cdpChipEl = null;     // chip que lo abrió (para posicionamiento)

function toggleChipDropdown(col, chipEl){
  const tab=T(); if(!tab) return;
  const dd=$('chip-dropdown');
  if(_cdpCol===col && dd.classList.contains('open')){ closeDropdown(); return; }
  _cdpCol = col;
  _cdpChipEl = chipEl;
  tab.activeChipCol = col;
  // Date chips open a date range mini-panel
  if(chipEl?.dataset.special==='date-filter'){
    openDateChipPanel(col, chipEl); return;
  }
  openCdpPanel(col, chipEl);
}

function openDateChipPanel(col, chipEl){
  const tab=T(); if(!tab) return;
  const dd=$('chip-dropdown');
  dd.classList.add('open');

  const ref=chipEl||$('chips-bar');
  const rect=ref.getBoundingClientRect();
  const panelW=280;
  let left=rect.left;
  if(left+panelW>window.innerWidth-10) left=Math.max(6,rect.right-panelW);
  const vwD = window.visualViewport ? window.visualViewport.width : window.innerWidth;
  const safeLeftD = vwD<=500 ? 8 : Math.max(6, Math.min(left, vwD-panelW-6));
  dd.style.left = safeLeftD+'px';
  dd.style.width = vwD<=500 ? (vwD-16)+'px' : '';
  dd.style.top=(rect.bottom+4)+'px';
  dd.style.maxHeight='200px';

  const cur=tab.colFilters[col];
  const curFrom=typeof cur==='string'&&cur.startsWith('__FROM__:')?cur.slice(9):'';
  const curTo=typeof cur==='string'&&cur.includes('__TO__:')?cur.split('__TO__:')[1]:'';

  dd.innerHTML=`
    <div id="cdp-head">
      <span id="chip-dropdown-title">📅 ${eh(col)}</span>
      <button id="dp-close" onclick="closeDropdown()" title="Cerrar">×</button>
    </div>
    <div style="padding:10px 14px;display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--muted)">
        <span style="min-width:40px">Desde</span>
        <input type="date" id="dcp-from" value="${curFrom}" style="flex:1;padding:4px 8px;border:0.5px solid var(--border);border-radius:var(--r);background:var(--bg);color:var(--text);font-size:11px;outline:none" onchange="applyDateChipFilter('${ejs(col)}')"/>
      </div>
      <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--muted)">
        <span style="min-width:40px">Hasta</span>
        <input type="date" id="dcp-to" value="${curTo}" style="flex:1;padding:4px 8px;border:0.5px solid var(--border);border-radius:var(--r);background:var(--bg);color:var(--text);font-size:11px;outline:none" onchange="applyDateChipFilter('${ejs(col)}')"/>
      </div>
    </div>
    <div id="cdp-footer">
      <span id="cdp-sel-label" style="font-size:11px;color:var(--muted)">${col}</span>
      <div style="display:flex;gap:4px">
        <button class="cdp-footer-btn" onclick="clearDateChipFilter('${ejs(col)}')">Limpiar</button>
        <button class="cdp-footer-btn" id="cdp-btn-all" onclick="closeDropdown()">Cerrar</button>
      </div>
    </div>`;

  setTimeout(()=>document.addEventListener('mousedown',_cdpOutsideHandler,{once:true}),10);
}

function applyDateChipFilter(col){
  const tab=T(); if(!tab) return;
  const from=($('dcp-from')?.value||'').trim();
  const to=($('dcp-to')?.value||'').trim();
  if(!from&&!to){ delete tab.colFilters[col]; }
  else {
    // Store as a special contains filter that applyFilters can handle
    tab.colFilters[col]='__DATE_RANGE__:'+from+'__TO__:'+to;
  }
  applyFilters(); updateChipStates();
}

function clearDateChipFilter(col){
  const tab=T(); if(!tab) return;
  delete tab.colFilters[col];
  applyFilters(); updateChipStates();
  closeDropdown();
}

function openCdpPanel(col, chipEl){
  const tab=T(); if(!tab) return;
  const dd=$('chip-dropdown');
  dd.classList.add('open');

  // Posicionar debajo del chip clicado, con clamp al viewport
  const ref = chipEl || $('chips-bar');
  const rect = ref.getBoundingClientRect();
  const panelW = 320;
  let left = rect.left;
  // Si se sale por la derecha, alinear al borde derecho del chip
  if(left + panelW > window.innerWidth - 10) left = Math.max(6, rect.right - panelW);
  const top = rect.bottom + 4;
  const available = window.innerHeight - top - 12;

  // En móvil usar visualViewport para el alto real visible (iOS Safari)
  const vh = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
  const vw = (window.visualViewport ? window.visualViewport.width  : window.innerWidth);
  const safeLeft = Math.max(6, Math.min(left, vw - panelW - 6));
  const available2 = vh - top - 12;

  dd.style.left = safeLeft + 'px';
  dd.style.top  = top + 'px';
  dd.style.maxHeight = Math.min(420, Math.max(180, available2)) + 'px';
  // En móvil: ancho casi completo, centrado
  if(vw <= 500){ dd.style.left='8px'; dd.style.width=(vw-16)+'px'; } else { dd.style.width=''; }

  renderCdpContent(col);
}

function renderCdpContent(col){
  const tab=T(); if(!tab) return;
  const dd=$('chip-dropdown');
  const isSpec = _cdpChipEl?.dataset.special==='null-filter';

  if(!tab.colUniques) precalcColStats(tab);

  // Conteos sobre filas filtradas (sin el filtro de esta columna para mostrar candidatos reales)
  const filtCountsAll={};
  // Construir vista de filtered ignorando el filtro de esta columna
  const otherFilters=Object.entries(tab.colFilters).filter(([c])=>c!==col);
  const candidateRows = otherFilters.length>0
    ? tab.rawData.reduce((acc,row,i)=>{
        if(!row) return acc;
        const pass=otherFilters.every(([fc,fv])=>{
          const rv=row[fc];
          if(Array.isArray(fv)) return fv.includes(rv);
          if(fv==='__NULL__') return rv===''||rv==null;
          if(fv==='__WITH__') return rv!==''&&rv!=null;
          if(fv?.startsWith('__CONTAINS__:')) return (rv||'').toLowerCase().includes(fv.slice(13));
          return rv===fv;
        });
        if(pass) acc.push(i);
        return acc;
      },[])
    : tab.rawData.map((_,i)=>i);

  candidateRows.forEach(i=>{
    const r=tab.rawData[i]; if(!r) return;
    const v=r[col]; if(v!=null&&v!=='') filtCountsAll[v]=(filtCountsAll[v]||0)+1;
  });

  const allVals = tab.colUniques[col] ? [...tab.colUniques[col]].sort(new Intl.Collator(undefined,{sensitivity:'base',numeric:true}).compare) : [];
  const curFilter = tab.colFilters[col]; // undefined | string | string[]
  const selSet = new Set(Array.isArray(curFilter)?curFilter:(curFilter&&curFilter!=='__NULL__'&&curFilter!=='__WITH__'?[curFilter]:[]));

  dd.innerHTML=`
    <div id="cdp-head">
      <span id="chip-dropdown-title">${eh(col)}</span>
      <span id="cdp-count">${selSet.size>0?`${selSet.size}/${allVals.length}`:`0/${allVals.length}`}</span>
      <button id="dp-close" onclick="closeDropdown()" title="Cerrar">×</button>
    </div>
    ${isSpec?`
      <div id="cdp-opts-wrap">
        <div class="cdp-item${curFilter===undefined?' cdp-sel':''}" onclick="cdpSetSpec(undefined)">
          <input type="checkbox" ${curFilter===undefined?'checked':''}/><span class="cdp-item-label">(Todos)</span><span class="cdp-item-cnt">${candidateRows.length}</span>
        </div>
        <div class="cdp-item${curFilter==='__WITH__'?' cdp-sel':''}" onclick="cdpSetSpec('__WITH__')">
          <input type="checkbox" ${curFilter==='__WITH__'?'checked':''}/><span class="cdp-item-label">Con cédula</span><span class="cdp-item-cnt">${candidateRows.filter(i=>{const r=tab.rawData[i];return r&&r[col]!==''&&r[col]!=null}).length}</span>
        </div>
        <div class="cdp-item${curFilter==='__NULL__'?' cdp-sel':''}" onclick="cdpSetSpec('__NULL__')">
          <input type="checkbox" ${curFilter==='__NULL__'?'checked':''}/><span class="cdp-item-label">Sin cédula</span><span class="cdp-item-cnt">${candidateRows.filter(i=>{const r=tab.rawData[i];return r&&(r[col]===''||r[col]==null)}).length}</span>
        </div>
      </div>
    `:`
      <div id="cdp-search-wrap">
        <input class="dp-search" type="text" id="cdp-search-input" placeholder="🔍 Filtrar ${eh(col)}…" autocomplete="off"/>
      </div>
      <div id="cdp-opts-wrap"></div>
    `}
    <div id="cdp-footer">
      <span id="cdp-sel-label"><strong id="cdp-sel-num">${selSet.size}</strong> seleccionados</span>
      <div style="display:flex;gap:4px">
        <button class="cdp-footer-btn" id="cdp-btn-clear" onclick="cdpClearAll()">Limpiar</button>
        <button class="cdp-footer-btn" id="cdp-btn-invert" onclick="cdpInvert()" title="Seleccionar lo opuesto">Invertir</button>
        <button class="cdp-footer-btn" id="cdp-btn-all" onclick="cdpSelectAll()">Todos</button>
      </div>
    </div>`;

  if(!isSpec){
    // Opción especial "Contiene..." y "Nulos"
    const optionsWrap=$('cdp-opts-wrap');
    const specialFrag=document.createDocumentFragment();

    // Fila: (Nulos)
    const nullCnt=candidateRows.filter(i=>{const r=tab.rawData[i];return r&&(r[col]===''||r[col]==null)}).length;
    const isNullSel=curFilter==='__NULL__';
    const nullRow=document.createElement('div');
    nullRow.className='cdp-item cdp-special'+(isNullSel?' cdp-sel':'');
    nullRow.innerHTML=`<input type="checkbox" ${isNullSel?'checked':''}/><span class="cdp-item-label" style="font-style:italic;opacity:.75">(Nulos / vacíos)</span><span class="cdp-item-cnt">${nullCnt}</span>`;
    nullRow.onclick=e=>{e.stopPropagation(); if(isNullSel){delete tab.colFilters[_cdpCol];}else{tab.colFilters[_cdpCol]='__NULL__';} applyFilters();updateChipStates();renderCdpContent(_cdpCol);};
    specialFrag.appendChild(nullRow);

    // Fila: Contiene...
    const containsActive=typeof curFilter==='string'&&curFilter.startsWith('__CONTAINS__:');
    const containsVal=containsActive?curFilter.slice(13):'';
    const containsRow=document.createElement('div');
    containsRow.className='cdp-item cdp-special'+(containsActive?' cdp-sel':'');
    containsRow.style.cssText='flex-direction:column;align-items:flex-start;gap:4px;padding:6px 14px';
    containsRow.innerHTML=`<div style="display:flex;align-items:center;gap:10px;width:100%"><input type="checkbox" ${containsActive?'checked':''}/><span class="cdp-item-label" style="font-style:italic;opacity:.75">Contiene texto…</span></div>
      <input id="cdp-contains-input" type="text" placeholder="Escribe para filtrar…" value="${eh(containsVal)}" style="width:100%;padding:4px 8px;font-size:11px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);outline:none;font-family:var(--font)" autocomplete="off"/>`;
    containsRow.onclick=e=>e.stopPropagation();
    specialFrag.appendChild(containsRow);

    const sep=document.createElement('div');
    sep.className='cdp-sep';
    specialFrag.appendChild(sep);

    optionsWrap.innerHTML='';
    optionsWrap.appendChild(specialFrag);

    // Append checkboxes after special rows — must be before renderItems & "Contiene" wiring
    const checkWrap=document.createElement('div');
    checkWrap.style.cssText='display:contents';
    optionsWrap.appendChild(checkWrap);

    const renderItems=(q='')=>{
      const filtered=q?allVals.filter(v=>v.toLowerCase().includes(q)):allVals;
      const frag=document.createDocumentFragment();
      if(!filtered.length){
        const e=document.createElement('div');
        e.style.cssText='padding:10px 14px;font-size:12px;color:var(--muted)';
        e.textContent='Sin resultados';
        frag.appendChild(e);
      } else {
        filtered.forEach(v=>{
          const cnt=filtCountsAll[v]||0;
          const checked=selSet.has(v);
          const row=document.createElement('div');
          row.className='cdp-item'+(checked?' cdp-sel':'')+(cnt===0&&!checked?' cdp-empty':'');
          row.dataset.val=v;
          row.innerHTML=`<input type="checkbox" ${checked?'checked':''}/><span class="cdp-item-label" title="${eh(v)}">${eh(v)}</span><span class="cdp-item-cnt">${cnt}</span>`;
          row.onclick=e=>{e.stopPropagation();cdpToggleVal(v);};
          row.querySelector('input').onclick=e=>{e.stopPropagation();cdpToggleVal(v);};
          frag.appendChild(row);
        });
      }
      checkWrap.innerHTML=''; checkWrap.appendChild(frag);
    };

    // Wire "Contiene" input
    const ci=$('cdp-contains-input');
    if(ci){
      ci.addEventListener('input',()=>{
        const q=(ci.value||'').trim();
        if(!q){delete tab.colFilters[_cdpCol];}
        else{tab.colFilters[_cdpCol]='__CONTAINS__:'+q.toLowerCase();}
        applyFilters();updateChipStates();
        containsRow.classList.toggle('cdp-sel',!!q);
        containsRow.querySelector('input[type=checkbox]').checked=!!q;
        renderItems(q.toLowerCase());
      });
      ci.addEventListener('click',e=>e.stopPropagation());
      ci.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); closeDropdown(); } });
      if(containsActive){
        renderItems(containsVal.toLowerCase());
      }
    }

    renderItems();

    // Buscador
    const si=$('cdp-search-input');
    if(si){
      si.addEventListener('input',()=>renderItems(si.value.toLowerCase().trim()));
      si.addEventListener('click',e=>e.stopPropagation());
      si.addEventListener('keydown',e=>{
        if(e.key==='Enter'){ e.preventDefault(); closeDropdown(); }
      });
    }
  }

  // Cerrar al hacer clic fuera
  setTimeout(()=>{
    document.addEventListener('mousedown', _cdpOutsideHandler, {once:true});
  }, 10);
}

function _cdpOutsideHandler(e){
  const dd=$('chip-dropdown');
  if(dd && !dd.contains(e.target) && _cdpChipEl && !_cdpChipEl.contains(e.target)){
    closeDropdown();
  } else if(dd && !dd.contains(e.target)){
    closeDropdown();
  } else {
    // Clic dentro: re-registrar listener
    document.addEventListener('mousedown', _cdpOutsideHandler, {once:true});
  }
}

function cdpToggleVal(v){
  const tab=T(); if(!tab||!_cdpCol) return;

  // Save cursor position before any DOM changes
  const si=$('cdp-search-input');
  const prevQ=si?.value||'';
  const prevSelStart=si?.selectionStart;
  const prevSelEnd=si?.selectionEnd;

  const cur=tab.colFilters[_cdpCol];
  let sel=new Set(Array.isArray(cur)?cur:(cur&&cur!=='__NULL__'&&cur!=='__WITH__'?[cur]:[]));
  sel.has(v)?sel.delete(v):sel.add(v);
  if(sel.size===0){ delete tab.colFilters[_cdpCol]; }
  else { tab.colFilters[_cdpCol]=[...sel]; }

  applyFilters(); updateChipStates();

  // Update checkboxes and row states in-place — no full re-render
  const newSel=new Set(Array.isArray(tab.colFilters[_cdpCol])?tab.colFilters[_cdpCol]:[]);
  const dd=$('chip-dropdown');
  if(dd){
    dd.querySelectorAll('.cdp-item[data-val]').forEach(row=>{
      const rv=row.dataset.val;
      const checked=newSel.has(rv);
      row.classList.toggle('cdp-sel',checked);
      const chk=row.querySelector('input[type=checkbox]');
      if(chk) chk.checked=checked;
    });
    // Update counter in header
    const cnt=$('cdp-count');
    if(cnt) cnt.textContent=`${newSel.size>0?newSel.size+'/':'0/'}${dd.querySelectorAll('.cdp-item[data-val]').length}`;
    // Update footer label
    const lbl=$('cdp-sel-num');
    if(lbl) lbl.textContent=newSel.size;
  }

  // Restore search text without stealing focus (evita saltos de viewport en móvil)
  if(si&&prevQ){
    si.value=prevQ;
    if(document.activeElement===si && prevSelStart!=null){
      si.setSelectionRange(prevSelStart,prevSelEnd??prevSelStart);
    }
  }
}

function cdpSetSpec(val){
  const tab=T(); if(!tab||!_cdpCol) return;
  if(val===undefined){ delete tab.colFilters[_cdpCol]; }
  else { tab.colFilters[_cdpCol]=val; }
  applyFilters(); updateChipStates();
  closeDropdown();
}

function cdpClearAll(){
  const tab=T(); if(!tab||!_cdpCol) return;
  delete tab.colFilters[_cdpCol];
  applyFilters(); updateChipStates();
  renderCdpContent(_cdpCol);
}

function cdpSelectAll(){
  const tab=T(); if(!tab||!_cdpCol) return;
  if(!tab.colUniques) precalcColStats(tab);
  const allVals=tab.colUniques[_cdpCol]?[...tab.colUniques[_cdpCol]]:[];
  if(!allVals.length) return;
  tab.colFilters[_cdpCol]=[...allVals];
  applyFilters(); updateChipStates();
  renderCdpContent(_cdpCol);
}

function cdpInvert(){
  const tab=T(); if(!tab||!_cdpCol) return;
  if(!tab.colUniques) precalcColStats(tab);
  const allVals=tab.colUniques[_cdpCol]?[...tab.colUniques[_cdpCol]]:[];
  if(!allVals.length) return;
  const cur=tab.colFilters[_cdpCol];

  // Determinar qué está actualmente seleccionado
  let curSet;
  if(cur===undefined){
    // Sin filtro = todo visible → invertir = nada (limpiar todo y seleccionar ninguno no tiene sentido, así que no hacer nada)
    toast('No hay selección para invertir. Selecciona algunos valores primero.');
    return;
  } else if(Array.isArray(cur)){
    curSet=new Set(cur);
  } else if(typeof cur==='string'&&cur!=='__NULL__'&&cur!=='__WITH__'&&!cur?.startsWith('__CONTAINS__:')){
    curSet=new Set([cur]);
  } else {
    // Filtro especial (nulos, contiene) → no se puede invertir con checkboxes
    toast('Usa Invertir solo con valores seleccionados por checkbox');
    return;
  }

  // Si todo está seleccionado → limpiar filtro
  if(curSet.size>=allVals.length||[...curSet].every(v=>allVals.includes(v)&&curSet.size===allVals.length)){
    delete tab.colFilters[_cdpCol];
    toast('Todo estaba seleccionado → filtro removido');
  } else {
    // Seleccionar lo opuesto
    const inverted=allVals.filter(v=>!curSet.has(v));
    tab.colFilters[_cdpCol]=inverted;
    toast(`Invertido: ${inverted.length} de ${allVals.length} valores`);
  }
  applyFilters(); updateChipStates();
  renderCdpContent(_cdpCol);
}

function removeColFilter(col){
  const tab=T(); if(!tab) return;
  delete tab.colFilters[col]; applyFilters(); updateChipStates();
  if(_cdpCol===col) closeDropdown();
}
function closeDropdown(){
  $('chip-dropdown').classList.remove('open');
  const tab=T(); if(tab) tab.activeChipCol=null;
  _cdpCol=null; _cdpChipEl=null;
  document.removeEventListener('mousedown', _cdpOutsideHandler);
}

// ── BÚSQUEDA ──────────────────────────────────────────────────────────────────
let _lastComboTab=null;
let _lastComboCols=null;
function onSearchColChange(){
  const tab=T(); if(!tab) return;
  // Invalida el índice concatenado: ya no sirve para búsqueda por columna específica
  tab.searchIndex=null;
  applyFilters();
}

function buildSearchCombo(){
  const tab=T(); if(!tab) return;
  const colKey=tab.columns.join('|');
  if(tab===_lastComboTab && colKey===_lastComboCols) return;
  _lastComboCols=colKey; // mismas columnas, no reconstruir
  _lastComboTab=tab;
  $('search-col').innerHTML='<option>(Todas las columnas)</option>'+tab.columns.map(c=>`<option value="${eh(c)}">${eh(c)}</option>`).join('');
  _mfSyncOptionsUI?.();
}
function buildDateColCombo(){
  const tab=T(); if(!tab) return;
  const dc=tab.dateColsDetected;
  $('date-col').innerHTML='<option value="">— filtrar por fecha —</option>'+dc.map(c=>`<option value="${eh(c)}">${eh(c)}</option>`).join('');
  const has=dc.length>0;
  ['date-from','date-to','date-col'].forEach(id=>$(id).disabled=!has);
  // Auto-seleccionar si solo hay una columna de fecha (caso más común)
  if(has && !tab.dateCol){
    $('date-col').selectedIndex=1;
    tab.dateCol=dc[0];
  } else if(tab.dateCol){
    setSelectValue('date-col', tab.dateCol);
  }
}

// Búsqueda con debounce para no filtrar en cada tecla
function _syncSearchInputFromTab(tab){
  if(!tab) return;
  const si=$('search-input'); if(!si) return;
  if(tab.searchText!=null && tab.searchText!=='') si.value=tab.searchText;
  if(tab.searchCol) setSelectValue('search-col', tab.searchCol);
}
function onSearch(){
  if(_pillsOn) return;
  const tab=T();
  const val=$('search-input')?.value??'';
  if(tab) tab.searchText=val;
  clearTimeout(searchTimer);
  clearTimeout(_pillsSearchTimer);
  searchTimer=setTimeout(()=>{
    applyFilters();
    _updateMobileActiveBar();
    _updateSearchClearBtn();
  }, SEARCH_DELAY);
}

// ── FILTROS ───────────────────────────────────────────────────────────────────
function onRegexChange(){
  const on=$('chk-regex').checked;
  const fb=$('btn-regex-flags'); if(fb) fb.style.display=on?'':'none';
  if(!on){ const p=$('regex-flags-panel'); if(p) p.style.display='none'; }
  const tab=T(); if(tab) tab.searchIndex=null;
  applyFilters();
}
function toggleRegexFlagsPanel(){
  const p=$('regex-flags-panel'); if(!p) return;
  const btn=$('btn-regex-flags');
  if(p.style.display!=='none'){p.style.display='none';return;}
  const r=btn.getBoundingClientRect();
  p.style.left=r.left+'px'; p.style.top=(r.bottom+4)+'px';
  p.style.display='block';
  // Close on outside click
  setTimeout(()=>document.addEventListener('mousedown',function h(e){if(!p.contains(e.target)&&e.target!==btn){p.style.display='none';document.removeEventListener('mousedown',h);}},{once:true}),10);
}
function getRegexFlags(){
  let f='';
  if($('chk-regex-i')?.checked) f+='i';
  if($('chk-regex-m')?.checked) f+='m';
  if($('chk-regex-s')?.checked) f+='s';
  return f;
}
function _activeSearchText(tab){
  if(_pillsOn){
    if(tab.pillsSearchText!=null && tab.pillsSearchText!==undefined) return String(tab.pillsSearchText).trim();
    return ($('pills-search-input')?.value||'').trim();
  }
  if(tab.searchText!=null && tab.searchText!==undefined) return String(tab.searchText).trim();
  return ($('search-input')?.value||'').trim();
}
function _resetLiveSearchState(tab){
  tab=tab||T();
  if(tab){ tab.searchIndex=null; if(_pillsOn) tab.pillsSearchText=''; else tab.searchText=''; }
  if(_pillsOn){
    const pinp=$('pills-search-input');
    if(pinp){ pinp.value=''; pinp.style.borderColor='var(--border)'; }
    $('pills-search-clear')?.style.setProperty('display','none');
  } else {
    const si=$('search-input'); if(si) si.value='';
  }
  clearTimeout(searchTimer);
  clearTimeout(_pillsSearchTimer);
}
function _syncLiveSearchFields(_rawTxt){
  if(_pillsOn){
    const pinp=$('pills-search-input');
    if(pinp){
      if(pinp.value!==_rawTxt) pinp.value=_rawTxt;
      pinp.style.borderColor=_rawTxt?'var(--acc)':'var(--border)';
    }
    const pclr=$('pills-search-clear');
    if(pclr) pclr.style.display=_rawTxt?'block':'none';
    return;
  }
  const si=$('search-input'); if(si && si.value!==_rawTxt) si.value=_rawTxt;
}
function applyFilters(){
  const tab=T(); if(!tab||!tab.rawData.length) return;
  const _rawTxt=_activeSearchText(tab);
  _syncLiveSearchFields(_rawTxt);
  const useRegex=$('chk-regex')?.checked;
  const useExcl =$('chk-excl')?.checked;
  const scol    = $('search-col').value;
  const dfrom   = $('date-from').value;
  const dto     = $('date-to').value;
  const dcol    = $('date-col').value;
  if(_pillsOn) tab.pillsSearchText=_rawTxt;
  else tab.searchText=_rawTxt;

  const { filtered, searchIndex, lastUseRegex } = filterRows({
    data: tab.rawData,
    columns: tab.columns,
    colFilters: tab.colFilters,
    searchText: _rawTxt,
    useRegex,
    useExclude: useExcl,
    regexFlags: getRegexFlags() || 'i',
    searchCol: scol,
    dateFrom: dfrom,
    dateTo: dto,
    dateCol: dcol,
    dateColsDetected: tab.dateColsDetected,
    searchIndex: tab.searchIndex,
    lastUseRegex: tab._lastUseRegex,
  });

  tab.filtered = filtered;
  tab.searchIndex = searchIndex;
  tab._lastUseRegex = lastUseRegex;
  tab.selected.clear();
  if(_pillsOn) updateChipStates();
  else renderTable();
  updateStats();
  updateStatusBar();
  updateBreadcrumb();
  updateActiveTabCount();
}

const _origApplyFilters = applyFilters;
applyFilters = function(){
  _origApplyFilters.apply(this, arguments);
  if(_pillsOn){
    renderPillsView();
    _pillsUpdateFilterBtn();
    if(typeof renderTabs === 'function') renderTabs();
  }
};

function refreshActiveView(tabId){
  const tid=tabId??activeTabId;
  const tab=tabs.get(tid);
  if(!tab||!tab.rawData?.length||tid!==activeTabId) return false;
  $('loading').style.display='none';
  $('dropzone').style.display='none';
  _pillsShowLoading(false);
  if(_pillsFichaOpen) pillsCloseFicha();
  tab.searchIndex=null;
  tab.colUniques=null;
  tab.colNulls=null;
  if(_pillsOn){
    $('table-wrap').style.display='none';
    $('data-area').style.display='none';
    $('pills-view')?.classList.add('open');
    _syncPillsSearchUI(tab);
    _pillsPopulateSelectors();
    applyFilters();
  }else{
    $('pills-view')?.classList.remove('open');
    $('data-area').style.display='';
    $('table-wrap').style.display='flex';
    applyFilters();
    _vtLastStart=-1; _vtLastEnd=-1; _vtRowHeights={};
    requestAnimationFrame(()=>_vtRenderVisible());
  }
  updateStatusBar();
  _mobileUiRefresh();
  return true;
}

function clearFilters(){
  clearChipFiltersOnly();
  const tab=T(); if(!tab) return;
  tab.searchCol='';
  $('search-col').selectedIndex=0;
  const cr=$('chk-regex'); if(cr) cr.checked=false;
  const ce=$('chk-excl'); if(ce) ce.checked=false;
  const fb=$('btn-regex-flags'); if(fb) fb.style.display='none';
  const rp=$('regex-flags-panel'); if(rp) rp.style.display='none';
  closeDropdown(); closeMobileFilterSheet();
  if(typeof _mfSyncOptionsUI==='function') _mfSyncOptionsUI();
  applyFilters();
  _mobileUiRefresh();
  toast('Filtros limpiados');
}

// ── TABLA — VIRTUAL SCROLL ───────────────────────────────────────────────────
const VT_ROW_H    = 30;
const VT_BUFFER   = 12;
let _vtRAF = null;
let _vtRowTap = {idx:null, t:0};
let _vtLastStart = -1;
let _vtLastEnd = -1;
let _frzLeftMap = {};   // col → exact left offset in px (measured from real DOM)
// Cache de alturas reales medidas por fila virtual
let _vtRowHeights = {};   // vrow → measured height
let _vtTotalH = 0;        // altura total estimada del contenido

function renderTable(){
  const tab=T(); if(!tab) return;

  const hid=tab.hiddenCols||new Set();
  const frz=tab.frozenCols||new Set();
  const frozenOrder=tab.frozenOrder||[...frz];
  const orderedCols=[...frozenOrder.filter(c=>frz.has(c)&&!hid.has(c)),
                     ...tab.columns.filter(c=>!frz.has(c)&&!hid.has(c))];

  // Reset frozen offsets — will be measured after DOM paint
  _frzLeftMap = {};

  // Build header with expand button on each th
  const headHtml='<tr>'+orderedCols.map(col=>{
    if(hid.has(col)) return'';
    const sc=tab.sortCol===col?(tab.sortDir===1?'asc':'desc'):'';
    const isFrz=frz.has(col);
    const frzCls=isFrz?'frozen':'';
    const frzStyle=isFrz?' style="left:0"':'';
    const lockIcon=isFrz?' 🔒':'';
    return`<th class="${sc} ${frzCls}" data-col="${eh(col)}"${frzStyle}
      onclick="sortBy('${ejs(col)}')"
      oncontextmenu="openColMenu(event,'${ejs(col)}')"
      style="position:sticky;top:0${isFrz?';left:0':''}"
      >${eh(col)}${lockIcon} <button class="col-expand-btn" onclick="event.stopPropagation();toggleColExpand(this)" title="Expandir/colapsar columna">⤢</button></th>`;
  }).join('')+'</tr>';

  $('table-head').innerHTML=headHtml;

  // Registrar scroll handler
  const scroll=$('vt-scroll');
  if(scroll) scroll.onscroll=_vtOnScroll;

  // Info bar
  const totalRows=tab.filtered.length;
  const info=$('vt-info');
  if(totalRows>200){
    info.classList.add('visible');
    info.textContent=totalRows.toLocaleString()+' filas \xB7 scroll virtual activo';
  } else {
    info.classList.remove('visible');
  }

  _vtLastStart=-1; _vtLastEnd=-1;
  _vtRowHeights={}; // reset height cache on full rebuild
  _vtRenderVisible();

  // Measure real th widths AFTER paint and apply exact left offsets + lock widths
  requestAnimationFrame(()=>{
    const ths=[...$('table-head').querySelectorAll('th')];
    // Lock each column width to prevent layout shift during virtual scroll
    ths.forEach(th=>{
      const w=th.offsetWidth;
      if(w>0) th.style.minWidth=w+'px';
    });
    // Now measure frozen offsets with locked widths
    let leftAccum=0;
    ths.filter(th=>th.classList.contains('frozen')).forEach(th=>{
      const col=th.dataset.col;
      _frzLeftMap[col]=leftAccum;
      th.style.left=leftAccum+'px';
      leftAccum+=th.offsetWidth;
    });
    // Re-render with correct offsets
    _vtLastStart=-1; _vtLastEnd=-1;
    _vtRowHeights={};
    _vtRenderVisible();
  });
}

function toggleColExpand(btn){
  const th=btn.closest('th');
  if(!th) return;
  const col=th.dataset.col;
  const tab=T(); if(!tab) return;
  if(!tab.expandedCols) tab.expandedCols=new Set();

  const isExpanded=tab.expandedCols.has(col);
  isExpanded ? tab.expandedCols.delete(col) : tab.expandedCols.add(col);

  // Update th immediately (no scroll position change)
  th.classList.toggle('col-expanded',!isExpanded);
  btn.textContent=isExpanded?'⤢':'⤡';

  // Update visible tds by data-col (not index — survives virtual scroll)
  _applyExpandedCols();
}

function _applyExpandedCols(){
  const tab=T(); if(!tab) return;
  const expanded=tab.expandedCols||new Set();
  // Update all currently rendered tds
  $('table-body').querySelectorAll('tr').forEach(tr=>{
    [...tr.children].forEach((td,i)=>{
      const th=$('table-head').querySelector(`th:nth-child(${i+1})`);
      const col=th?.dataset.col;
      if(col) td.classList.toggle('col-expanded', expanded.has(col));
    });
  });
  // Update ths
  $('table-head').querySelectorAll('th[data-col]').forEach(th=>{
    const col=th.dataset.col;
    const btn=th.querySelector('.col-expand-btn');
    const isExp=expanded.has(col);
    th.classList.toggle('col-expanded',isExp);
    if(btn) btn.textContent=isExp?'⤡':'⤢';
  });
}

function _vtOnScroll(){
  if(_vtRAF) return;
  _vtRAF=requestAnimationFrame(()=>{
    _vtRAF=null;
    try{ _vtRenderVisible(); }catch(e){ console.error('vtRender error:',e); }
  });
}

// Construye un <tr> completo para la fila virtual `row`
function _vtBuildRow(tab, row, renderCols, hid, frz, rules, txt, scol, allCols){
  const i=tab.filtered[row]; if(i===undefined) return null;
  const rowData=tab.rawData[i]; if(!rowData) return null;
  const tr=document.createElement('tr');
  if(tab.selected.has(i)) tr.className='selected';
  tr.dataset.idx=i;
  tr.dataset.vrow=row;
  tr.onclick=e=>{
    const now=Date.now();
    if(_vtRowTap.idx===i&&now-_vtRowTap.t<400){
      _vtRowTap={idx:null,t:0};
      openDetail(i);
      return;
    }
    _vtRowTap={idx:i,t:now};
    toggleRow(e,i);
  };
  tr.ondblclick=e=>{e.preventDefault();_vtRowTap={idx:null,t:0};openDetail(i);};

  renderCols.forEach(col=>{
    const td=document.createElement('td');
    if(hid.has(col)){td.className='col-hidden';tr.appendChild(td);return}
    if(frz.has(col)){
      td.className='frozen';
      const left=_frzLeftMap[col]||0;
      td.style.left=left+'px';
    }
    const raw_v=rowData[col]??''; const v=fmtCell(col,raw_v,tab);
    td.title=v;

    let bg='';
    for(const rule of rules){
      if(rule.col!==col) continue;
      const rv=v.toLowerCase(), rv2=rule.val.toLowerCase();
      if((rule.op==='='&&rv===rv2)||(rule.op==='!='&&rv!==rv2)||
         (rule.op==='>'&&parseFloat(v)>parseFloat(rule.val))||
         (rule.op==='<'&&parseFloat(v)<parseFloat(rule.val))||
         (rule.op==='contiene'&&rv.includes(rv2))){ bg=rule.color; break; }
    }

    if(txt&&v&&(!scol||allCols||scol===col)){
      const idx=v.toLowerCase().indexOf(txt);
      if(idx>=0){
        const pre=document.createTextNode(v.slice(0,idx));
        const mark=el('span',{cls:'hl'},[v.slice(idx,idx+txt.length)]);
        const post=document.createTextNode(v.slice(idx+txt.length));
        if(bg){ const wrap=el('span',{style:`background:${bg};color:#000;border-radius:3px;padding:0 4px`}); wrap.append(pre,mark,post); td.appendChild(wrap); }
        else{ td.append(pre,mark,post); }
        tr.appendChild(td); return;
      }
    }
    if(bg){ td.innerHTML=`<span style="background:${bg};color:#000;border-radius:3px;padding:0 4px">${eh(v)}</span>`; }
    else   { td.textContent=v; }
    tr.appendChild(td);
  });
  return tr;
}

function _vtRenderVisible(){
  const tab=T(); if(!tab) return;
  const scroll=$('vt-scroll');
  const scrollTop=scroll.scrollTop;
  const viewH=scroll.clientHeight;
  const totalRows=tab.filtered.length;

  // Usar altura promedio medida (cae back a VT_ROW_H hasta tener datos reales)
  const measuredKeys=Object.keys(_vtRowHeights);
  const avgH=measuredKeys.length>0
    ? measuredKeys.reduce((s,k)=>s+_vtRowHeights[k],0)/measuredKeys.length
    : VT_ROW_H;
  const rowH=Math.max(VT_ROW_H, avgH);

  let startRow=Math.floor(scrollTop/rowH)-VT_BUFFER;
  let endRow=Math.ceil((scrollTop+viewH)/rowH)+VT_BUFFER;
  startRow=Math.max(0,startRow);
  endRow=Math.min(totalRows-1,endRow);

  // Si el rango no cambió, nada que hacer
  if(startRow===_vtLastStart && endRow===_vtLastEnd) return;

  const txt   = ($('search-input').value||'').toLowerCase().trim();
  const scol  = $('search-col').value;
  const allCols = scol==='(Todas las columnas)'||!scol;
  const hid=tab.hiddenCols||new Set();
  const frz=tab.frozenCols||new Set();
  const rules=tab.condRules.filter(r=>r.col&&r.op&&r.val&&r.color);
  const visColCount=tab.columns.filter(c=>!hid.has(c)).length||1;
  const frozenOrder=tab.frozenOrder||[...frz];
  const renderCols=[...frozenOrder.filter(c=>frz.has(c)&&!hid.has(c)),
                    ...tab.columns.filter(c=>!frz.has(c)&&!hid.has(c))];

  const tbody=$('table-body');

  // ── DIFF: calcular qué filas entran y salen ───────────────────────────────
  const prevStart=_vtLastStart, prevEnd=_vtLastEnd;
  _vtLastStart=startRow; _vtLastEnd=endRow;

  const isFullRebuild = prevStart===-1; // primer render o reset

  if(isFullRebuild){
    // Construcción inicial: usar fragmento, sin parpadeo
    const frag=document.createDocumentFragment();

    // Spacer top
    if(startRow>0){
      const sp=document.createElement('tr');
      sp.id='vt-pad-top';
      sp.innerHTML=`<td colspan="${visColCount}" style="height:${startRow*rowH}px;padding:0;border:none"></td>`;
      frag.appendChild(sp);
    }

    for(let row=startRow;row<=endRow;row++){
      const tr=_vtBuildRow(tab,row,renderCols,hid,frz,rules,txt,scol,allCols);
      if(tr) frag.appendChild(tr);
    }

    // Spacer bottom
    const botH=(totalRows-(endRow+1))*rowH;
    if(botH>0){
      const sp=document.createElement('tr');
      sp.id='vt-pad-bot';
      sp.innerHTML=`<td colspan="${visColCount}" style="height:${botH}px;padding:0;border:none"></td>`;
      frag.appendChild(sp);
    }

    tbody.innerHTML='';
    tbody.appendChild(frag);

  } else {
    // ── Render diferencial: solo tocar lo que cambia ──────────────────────

    // Medir alturas reales de las filas ya renderizadas antes de cualquier cambio
    tbody.querySelectorAll('tr[data-vrow]').forEach(tr=>{
      const vr=+tr.dataset.vrow;
      const h=tr.offsetHeight;
      if(h>0) _vtRowHeights[vr]=h;
    });

    // Quitar filas que salen por arriba
    if(startRow>prevStart){
      for(let row=prevStart;row<Math.min(startRow,prevEnd+1);row++){
        const tr=tbody.querySelector(`tr[data-vrow="${row}"]`);
        if(tr) tr.remove();
      }
    }
    // Quitar filas que salen por abajo
    if(endRow<prevEnd){
      for(let row=Math.max(endRow+1,prevStart);row<=prevEnd;row++){
        const tr=tbody.querySelector(`tr[data-vrow="${row}"]`);
        if(tr) tr.remove();
      }
    }

    // Spacer top: actualizar altura
    let padTop=tbody.querySelector('#vt-pad-top');
    const topH=startRow*rowH;
    if(topH>0){
      if(!padTop){
        padTop=document.createElement('tr'); padTop.id='vt-pad-top';
        padTop.innerHTML=`<td colspan="${visColCount}" style="height:${topH}px;padding:0;border:none"></td>`;
        tbody.insertBefore(padTop,tbody.firstChild);
      } else {
        const td=padTop.querySelector('td');
        if(td) td.style.height=topH+'px';
      }
    } else if(padTop){ padTop.remove(); }

    // Spacer bottom: actualizar altura
    let padBot=tbody.querySelector('#vt-pad-bot');
    const botH=(totalRows-(endRow+1))*rowH;
    if(botH>0){
      if(!padBot){
        padBot=document.createElement('tr'); padBot.id='vt-pad-bot';
        padBot.innerHTML=`<td colspan="${visColCount}" style="height:${botH}px;padding:0;border:none"></td>`;
        tbody.appendChild(padBot);
      } else {
        const td=padBot.querySelector('td');
        if(td) td.style.height=botH+'px';
      }
    } else if(padBot){ padBot.remove(); }

    // Añadir filas nuevas por arriba
    if(startRow<prevStart){
      // Buscar ancla: primera fila existente o justo después del spacer top
      const existingFirst=tbody.querySelector('tr[data-vrow]');
      const padTopEl=tbody.querySelector('#vt-pad-top');
      const anchor=existingFirst||(padTopEl?padTopEl.nextSibling:tbody.firstChild);
      const newRows=[];
      for(let row=prevStart-1;row>=startRow;row--){
        const tr=_vtBuildRow(tab,row,renderCols,hid,frz,rules,txt,scol,allCols);
        if(tr) newRows.push(tr);
      }
      for(let j=newRows.length-1;j>=0;j--){
        tbody.insertBefore(newRows[j], anchor);
      }
    }

    // Añadir filas nuevas por abajo
    if(endRow>prevEnd){
      const anchorBot=tbody.querySelector('#vt-pad-bot');
      for(let row=prevEnd+1;row<=endRow;row++){
        const tr=_vtBuildRow(tab,row,renderCols,hid,frz,rules,txt,scol,allCols);
        if(tr){ if(anchorBot) tbody.insertBefore(tr,anchorBot); else tbody.appendChild(tr); }
      }
    }
  }

  // Aplicar estado de columnas expandidas sin forzar reflow completo
  _applyExpandedCols();
}

function sortBy(col){
  const tab=T(); if(!tab) return;
  tab.sortDir=tab.sortCol===col?tab.sortDir*-1:1; tab.sortCol=col;
  // Schwartzian transform: extraer valores una vez, ordenar, extraer índices
  const dir=tab.sortDir;
  const pairs=tab.filtered.map(i=>[i, String(tab.rawData[i]?.[col]??'')]);
  const coll=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
  pairs.sort((a,b)=>coll.compare(a[1],b[1])*dir);
  tab.filtered=pairs.map(p=>p[0]);
  renderTable();
}

// ── SELECCIÓN ─────────────────────────────────────────────────────────────────
function toggleRow(e,idx){
  const tab=T(); if(!tab) return;
  if(e.shiftKey&&lastClick!=null){
    const s=Math.min(lastClick,idx),en=Math.max(lastClick,idx);
    for(let i=s;i<=en;i++) tab.selected.add(i);
  } else if(e.ctrlKey||e.metaKey){
    tab.selected.has(idx)?tab.selected.delete(idx):tab.selected.add(idx);
  } else {
    tab.selected.size===1&&tab.selected.has(idx)?tab.selected.clear():(tab.selected.clear(),tab.selected.add(idx));
  }
  lastClick=idx;
  // Actualizar solo las filas afectadas en lugar de reconstruir toda la tabla
  $('table-body').querySelectorAll('tr[data-idx]').forEach(tr=>{
    const i=+tr.dataset.idx;
    tr.className=tab.selected.has(i)?'selected':'';
  });
  updateStatusBar();
}

// ── DETALLE ───────────────────────────────────────────────────────────────────
// ── DETAIL PANEL ──────────────────────────────────────────────────────────────
const DETAIL_STYLE_KEY='mirador_detail_style';
let _detailIdx=null;
let _detailStyle=parseInt(localStorage.getItem(DETAIL_STYLE_KEY)||'1');

function setDetailStyle(n){
  _detailStyle=n;
  localStorage.setItem(DETAIL_STYLE_KEY,n);
  document.querySelectorAll('.ds-btn').forEach(b=>b.classList.toggle('on',+b.dataset.ds===n));
  if(_detailIdx!==null) renderDetailBody(_detailIdx);
}

function openDetail(idx){
  const tab=T(); if(!tab) return;
  _blurActiveInput();
  _detailIdx=idx;
  document.querySelectorAll('.ds-btn').forEach(b=>b.classList.toggle('on',+b.dataset.ds===_detailStyle));
  renderDetailBody(idx);
  _lockModalViewport();
  $('detail-overlay').classList.add('open');
  scheduleOverlayCheck();
}

function renderDetailBody(idx){
  const tab=T(); if(!tab) return;
  const row=tab.rawData[idx]; if(!row) return;
  const nameCol=tab.columns.find(c=>/apellidos.nombre|nombre.apellidos/i.test(c))||tab.columns.find(c=>/primer.apellido/i.test(c))||tab.columns.find(c=>/nombre|apellido/i.test(c));
  const cargoCol=tab.columns.find(c=>/cargo.actual/i.test(c))||tab.columns.find(c=>/cargo|encargo/i.test(c));
  const dirCol=tab.columns.find(c=>/^direcci/i.test(c));
  const estCol=tab.columns.find(c=>/^estado$/i.test(c));
  const vinCol=tab.columns.find(c=>/vinculaci/i.test(c));
  const nivCol=tab.columns.find(c=>/nivel.jer/i.test(c));
  const cedCol=tab.columns.find(c=>/^c[eé]dula$/i.test(c.trim()));
  const escalCol=tab.columns.find(c=>/escal/i.test(c));
  const posCol=tab.columns.find(c=>/posici/i.test(c));
  const evalCol=tab.columns.find(c=>/evaluaci/i.test(c));
  const name=nameCol?row[nameCol]:'Registro #'+(idx+1);
  const cargo=cargoCol?row[cargoCol]:'';
  const dir=dirCol?row[dirCol]:'';
  const estado=estCol?row[estCol]:'';
  const vinc=vinCol?row[vinCol]:'';
  const niv=nivCol?row[nivCol]:'';
  const ced=cedCol?row[cedCol]:'';
  const escal=escalCol?row[escalCol]:'';
  const pos=posCol?row[posCol]:'';
  const evalu=evalCol?row[evalCol]:'';
  const initials=name.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase()||'?';
  const isActive=/activ/i.test(estado);
  const allFields=tab.columns.filter(col=>row[col]!==''&&row[col]!=null);
  const fmtRow=(col)=>fmtCell(col,row[col]||'',tab); // helper para detalle
  const grpCargo=tab.columns.filter(c=>/cargo|encargo|nivel.jer|escalera|posici/i.test(c)).filter(c=>row[c]);
  const grpDir=tab.columns.filter(c=>/direcci|dependencia|tipo.dep|^pais$|^departamento|^ciudad|correo|municipio/i.test(c)).filter(c=>row[c]);
  const grpPers=tab.columns.filter(c=>/nombre|apellido|cedula|cédula|sexo|nacimiento/i.test(c)).filter(c=>row[c]);
  const grpAcad=tab.columns.filter(c=>/titulo|título|escolaridad|especiali/i.test(c)).filter(c=>row[c]);
  const grpVinc=tab.columns.filter(c=>/vinculaci|ingreso|estado|evaluaci|teletrab/i.test(c)).filter(c=>row[c]);
  const badgesHtml=`${estado?`<span class="d-badge ${isActive?'db-green':'db-gray'}">${eh(estado)}</span>`:''}${niv?`<span class="d-badge db-blue">${eh(niv)}</span>`:''}${vinc?`<span class="d-badge db-warn">${eh(vinc.split(' ')[0])}</span>`:''}${evalu?`<span class="d-badge db-green">${eh(evalu)}</span>`:''}`;
  const navBtns=`<button class="da-btn p" onclick="navigateDetail(-1)">← Anterior</button><button class="da-btn p" onclick="navigateDetail(1)">Siguiente →</button>`;
  const actionBtns=`<button class="da-btn" onclick="copyDetailRow(${idx})">⧉ Copiar</button><button class="da-btn" onclick="filterLikeRow(${idx})">⊜ Filtrar igual</button>`;
  if(_detailStyle===1){
    $('detail-body').innerHTML=`
      <div id="d1-head"><div id="d1-avatar">${initials}</div><div id="d1-info">
        <div id="d1-name">${eh(name)}</div>
        <div id="d1-sub">${ced?'Cédula: '+eh(ced)+' · ':''}${eh(cargo)}</div>
        <div id="d1-badges">${badgesHtml}</div></div></div>
      <div id="d1-tabs">
        <div class="d1-tab on" onclick="switchD1Tab(this,'dtab-cargo')">Cargo</div>
        <div class="d1-tab" onclick="switchD1Tab(this,'dtab-personal')">Personal</div>
        <div class="d1-tab" onclick="switchD1Tab(this,'dtab-ubicacion')">Ubicación</div>
        <div class="d1-tab" onclick="switchD1Tab(this,'dtab-notas')">Notas</div>
      </div>
      <div id="d1-content">
        <div id="dtab-cargo" class="d1-grid">${[...new Set([...grpCargo,...grpVinc])].map(col=>`<div class="d1-field"><span class="d1-fk">${eh(col)}</span><span class="d1-fv">${eh(fmtRow(col))}</span></div>`).join('')}</div>
        <div id="dtab-personal" class="d1-grid" style="display:none">${[...grpPers,...grpAcad].map(col=>`<div class="d1-field"><span class="d1-fk">${eh(col)}</span><span class="d1-fv">${eh(fmtRow(col))}</span></div>`).join('')}</div>
        <div id="dtab-ubicacion" class="d1-grid" style="display:none">${grpDir.map(col=>`<div class="d1-field"><span class="d1-fk">${eh(col)}</span><span class="d1-fv">${eh(fmtRow(col))}</span></div>`).join('')}</div>
        <div id="dtab-notas" style="display:none">${renderNoteTab(ced||name)}</div>
      </div>
      <div id="d1-actions"><div style="display:flex;gap:6px">${actionBtns}</div><div style="display:flex;gap:6px">${navBtns}</div></div>`;
  } else if(_detailStyle===2){
    $('detail-body').innerHTML=`
      <div id="d2-hero"><div id="d2-avatar">${initials}</div><div id="d2-heroinfo">
        <div id="d2-name">${eh(name)}</div><div id="d2-cargo">${eh(cargo)}${dir?' · '+eh(dir):''}</div>
        <div id="d2-pills">${badgesHtml}</div></div></div>
      <div id="d2-stats">
        ${escal?`<div class="d2-stat"><div class="d2-sv">${eh(escal)}</div><div class="d2-sl">Escalera</div></div>`:''}
        ${pos?`<div class="d2-stat"><div class="d2-sv">Pos.${eh(pos)}</div><div class="d2-sl">Posición</div></div>`:''}
        ${ced?`<div class="d2-stat"><div class="d2-sv" style="font-size:11px">${eh(ced)}</div><div class="d2-sl">Cédula</div></div>`:''}
      </div>
      <div id="d2-sections">
        ${grpCargo.length?`<div><div class="d2-sec-title">Cargo y organización</div><div class="d2-sgrid">${grpCargo.map(col=>`<div class="d2-sfield"><div class="d2-sk">${eh(col)}</div><div class="d2-sv2">${eh(fmtRow(col))}</div></div>`).join('')}</div></div>`:''}
        ${grpDir.length?`<div><div class="d2-sec-title">Dirección y dependencia</div><div class="d2-sgrid">${grpDir.map(col=>`<div class="d2-sfield"><div class="d2-sk">${eh(col)}</div><div class="d2-sv2">${eh(fmtRow(col))}</div></div>`).join('')}</div></div>`:''}
        ${grpAcad.length?`<div><div class="d2-sec-title">Formación académica</div><div class="d2-sgrid">${grpAcad.map(col=>`<div class="d2-sfield"><div class="d2-sk">${eh(col)}</div><div class="d2-sv2">${eh(fmtRow(col))}</div></div>`).join('')}</div></div>`:''}
      </div>
      <div id="d2-actions">${actionBtns}${navBtns}</div>`;
  } else {
    const correoCol=tab.columns.find(c=>/correo/i.test(c));
  const ciudadCol=tab.columns.find(c=>/^ciudad$/i.test(c));
  const sideFields=[[estCol,row[estCol]],[cedCol,row[cedCol]],[posCol,row[posCol]],[escalCol,row[escalCol]],[nivCol,row[nivCol]],[evalCol,row[evalCol]],[vinCol,row[vinCol]],[ciudadCol,row[ciudadCol]],[correoCol,row[correoCol]]].filter(([k,v])=>k&&v);
    $('detail-body').innerHTML=`
      <div id="d3-wrap">
        <div id="d3-left">
          <div><div id="d3-avatar">${initials}</div><div id="d3-lname">${eh(name)}</div><div id="d3-lsub">${ced?'Cédula: '+eh(ced):''}</div></div>
          <div class="d3-sep"></div>
          ${sideFields.map(([k,v])=>`<div class="d3-kv"><div class="d3-k">${eh(k)}</div><div class="d3-v">${eh(fmtCell(k,v,tab))}</div></div>`).join('')}
          <div id="d3-left-btns"><div class="d3-sep"></div>${actionBtns}${navBtns}</div>
        </div>
        <div id="d3-right">
          <div id="d3-rtabs">
            <div class="d3-rtab on" onclick="switchD3Tab(this,'d3t-all')">Todos los campos</div>
            <div class="d3-rtab" onclick="switchD3Tab(this,'d3t-notas')">Notas</div>
          </div>
          <div id="d3-rbody">
            <div id="d3t-all">${allFields.map(col=>`<div class="d3-fr"><span class="d3-fk">${eh(col)}</span><span class="d3-fv">${eh(fmtRow(col))}</span></div>`).join('')}</div>
            <div id="d3t-notas" style="display:none">${renderNoteTab(ced||name)}</div>
          </div>
          <div id="d3-acts"><button class="da-btn" onclick="closeDetail()">Cerrar</button></div>
        </div>
      </div>`;
  }
}

function switchD1Tab(el,tabId){
  document.querySelectorAll('.d1-tab').forEach(t=>t.classList.remove('on'));
  el.classList.add('on');
  ['dtab-cargo','dtab-personal','dtab-ubicacion','dtab-notas'].forEach(id=>{
    const e=$(id);if(e)e.style.display=id===tabId?(tabId==='dtab-notas'?'block':'grid'):'none';
  });
}
function switchD3Tab(el,tabId){
  document.querySelectorAll('.d3-rtab').forEach(t=>t.classList.remove('on'));
  el.classList.add('on');
  ['d3t-all','d3t-notas'].forEach(id=>{const e=$(id);if(e)e.style.display=id===tabId?'block':'none';});
}
function navigateDetail(dir){
  const tab=T();if(!tab||_detailIdx===null)return;
  const pos=tab.filtered.indexOf(_detailIdx);if(pos===-1)return;
  const np=pos+dir;if(np<0||np>=tab.filtered.length)return;
  _detailIdx=tab.filtered[np];
  tab.selected.clear();tab.selected.add(_detailIdx);
  $('table-body').querySelectorAll('tr[data-idx]').forEach(tr=>{ tr.className=tab.selected.has(+tr.dataset.idx)?'selected':''; });
  const tr=$('table-body').querySelector(`tr[data-idx="${_detailIdx}"]`);
  if(tr)tr.scrollIntoView({block:'nearest',behavior:'smooth'});
  renderDetailBody(_detailIdx);updateStatusBar();
}
function filterLikeRow(idx){
  const tab=T();if(!tab)return;
  const row=tab.rawData[idx];if(!row)return;

  let ov=document.getElementById('flr-overlay');
  if(ov)ov.remove();
  ov=document.createElement('div');
  ov.id='flr-overlay';
  ov.style.cssText='position:fixed;inset:0;z-index:700;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px';
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});

  const skip=/^(identificador|id_|codigo_|_id$)/i;
  const fields=tab.columns.filter(c=>row[c]!==''&&row[c]!=null&&!skip.test(c));
  const preselectRe=/^(estado|direcci|nivel|sexo|g[eé]nero|cargo|vinculaci|dependencia|tipo|municipio|ciudad|grado)/i;

  const box=document.createElement('div');
  box.style.cssText='background:var(--s1);border:1px solid var(--border2);border-radius:12px;width:430px;max-height:82vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,.4)';

  // ── Cabecera ──
  const head=document.createElement('div');
  head.style.cssText='padding:13px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-shrink:0';
  const headTitle=document.createElement('span');
  headTitle.style.cssText='font-size:14px;font-weight:600;color:var(--text);flex:1';
  headTitle.textContent='⊜ Filtrar igual a este registro';
  const headClose=document.createElement('button');
  headClose.style.cssText='background:none;border:none;color:var(--muted);cursor:pointer;font-size:20px;line-height:1';
  headClose.textContent='×';
  headClose.addEventListener('click',()=>ov.remove());
  head.append(headTitle,headClose);

  // ── Subheader ──
  const sub=document.createElement('div');
  sub.style.cssText='padding:7px 14px;border-bottom:1px solid var(--border);font-size:11px;color:var(--muted);flex-shrink:0;display:flex;justify-content:space-between;align-items:center';
  sub.innerHTML='<span>Selecciona los campos por los que quieres filtrar:</span>';
  const selAll=document.createElement('span');
  selAll.style.cssText='font-size:11px;color:var(--acc-text);cursor:pointer;text-decoration:underline';
  selAll.textContent='Seleccionar todo';
  selAll.addEventListener('click',()=>{ fieldsList.querySelectorAll('input[type=checkbox]').forEach(cb=>{ cb.checked=true; _flrRefreshLabel(cb.closest('label'),true); }); });
  sub.appendChild(selAll);

  // ── Lista de campos ──
  const fieldsList=document.createElement('div');
  fieldsList.id='flr-fields';
  fieldsList.style.cssText='flex:1;overflow-y:auto;padding:6px 8px;display:flex;flex-direction:column;gap:4px';

  fields.forEach(col=>{
    const v=row[col];
    const disp=String(v).length>52?String(v).slice(0,49)+'…':String(v);
    const checked=preselectRe.test(col);

    const lbl=document.createElement('label');
    lbl.style.cssText=`display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:6px;cursor:pointer;background:${checked?'var(--acc-dim)':'var(--bg)'};border:1px solid ${checked?'var(--acc)':'var(--border)'};transition:background .1s,border-color .1s`;

    const cb=document.createElement('input');
    cb.type='checkbox';
    cb.dataset.col=col;
    cb.checked=checked;
    cb.style.cssText='accent-color:var(--acc);flex-shrink:0;width:14px;height:14px;cursor:pointer';

    const txt=document.createElement('span');
    txt.style.cssText='flex:1;min-width:0;overflow:hidden';
    txt.innerHTML=`<span style="font-size:12px;font-weight:500;color:var(--text);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${eh(col)}</span><span style="font-size:10px;color:var(--acc-text);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${eh(disp)}</span>`;

    cb.addEventListener('change',()=>_flrRefreshLabel(lbl,cb.checked));
    lbl.addEventListener('click',e=>{
      if(e.target!==cb){ cb.checked=!cb.checked; _flrRefreshLabel(lbl,cb.checked); }
    });

    lbl.append(cb,txt);
    fieldsList.appendChild(lbl);
  });

  // ── Footer ──
  const foot=document.createElement('div');
  foot.style.cssText='padding:10px 14px;border-top:1px solid var(--border);display:flex;gap:8px;flex-shrink:0';
  const btnCancel=document.createElement('button');
  btnCancel.style.cssText='flex:1;padding:7px;border-radius:var(--r);border:1px solid var(--border);background:none;color:var(--muted);cursor:pointer;font-size:12px;font-family:var(--font)';
  btnCancel.textContent='Cancelar';
  btnCancel.addEventListener('click',()=>ov.remove());
  const btnApply=document.createElement('button');
  btnApply.style.cssText='flex:2;padding:7px;border-radius:var(--r);border:1px solid var(--acc);background:var(--acc-dim);color:var(--acc-text);cursor:pointer;font-size:12px;font-weight:500;font-family:var(--font)';
  btnApply.textContent='⊜ Aplicar filtros';
  btnApply.addEventListener('click',()=>_applyFilterLikeRow(idx,fieldsList,ov));
  foot.append(btnCancel,btnApply);

  box.append(head,sub,fieldsList,foot);
  ov.appendChild(box);
  document.body.appendChild(ov);
}

function _flrRefreshLabel(lbl,checked){
  lbl.style.background=checked?'var(--acc-dim)':'var(--bg)';
  lbl.style.borderColor=checked?'var(--acc)':'var(--border)';
}

function _applyFilterLikeRow(idx,fieldsList,ov){
  const tab=T();if(!tab)return;
  const row=tab.rawData[idx];if(!row)return;
  const checked=[...(fieldsList||document).querySelectorAll('input[type=checkbox]:checked')];
  if(!checked.length){toast('Selecciona al menos un campo');return;}
  let applied=0;
  checked.forEach(cb=>{
    const col=cb.dataset.col;
    if(col&&row[col]!==''&&row[col]!=null){tab.colFilters[col]=row[col];applied++;}
  });
  applyFilters();updateChipStates();
  (ov||document.getElementById('flr-overlay'))?.remove();
  closeDetail();
  toast(`⊜ ${applied} filtro(s) aplicado(s)`);
}
function copyDetailRow(idx){
  const tab=T();if(!tab)return;
  const row=tab.rawData[idx];if(!row)return;
  copyText(tab.columns.map(c=>`${c}: ${row[c]||''}`).join('\n'),'✓ Registro copiado');
}
const NOTES_KEY='mirador_notes_v1';
function getNotes(){try{return JSON.parse(localStorage.getItem(NOTES_KEY)||'{}')}catch{return{}}}
function saveNote(key,val){const n=getNotes();val?n[key]=val:delete n[key];localStorage.setItem(NOTES_KEY,JSON.stringify(n))}
function renderNoteTab(key){
  const note=getNotes()[key]||'';
  return`<div style="padding:0 0 8px;font-size:11px;color:var(--muted)">Nota para: <strong style="color:var(--text)">${eh(key)}</strong></div>${note?`<div class="saved-note">${eh(note)}</div>`:''}<textarea class="note-area" id="note-area-input" placeholder="Escribe una nota...">${eh(note)}</textarea><div style="display:flex;justify-content:flex-end;margin-top:7px"><button class="da-btn p" onclick="saveNoteFromPanel('${key.replace(/'/g,"\\'")}')">💾 Guardar nota</button></div>`;
}
function saveNoteFromPanel(key){
  const el=$('note-area-input');if(!el)return;
  saveNote(key,el.value.trim());toast('Nota guardada');
}
function closeDetail(e){if(e&&e.target!==$('detail-overlay'))return;$('detail-overlay').classList.remove('open');}
document.addEventListener('keydown',ev=>{
  if(!$('detail-overlay').classList.contains('open'))return;
  if(ev.target.tagName==='TEXTAREA'||ev.target.tagName==='INPUT')return;
  if(ev.key==='ArrowLeft')navigateDetail(-1);
  if(ev.key==='ArrowRight')navigateDetail(1);
});


// ── ESTADÍSTICAS ──────────────────────────────────────────────────────────────
function updateStats(){
  const tab=T(); if(!tab||!tab.rawData.length){$('stats-bar').classList.remove('visible');return}
  if(!tab.colUniques) precalcColStats(tab);
  const vis=tab.filtered.length, total=tab.rawData.length;

  // Paneles configurables: auto-detectar si no hay config guardada
  if(!tab.statsPanels){
    tab.statsPanels = [];
    const vCol=tab.columns.find(c=>/vinculaci/i.test(c));
    const eCol=tab.columns.find(c=>/^estado$/i.test(c.trim()));
    const sCol=tab.columns.find(c=>/^sexo$/i.test(c.trim())||/^g[eé]nero$/i.test(c.trim()));
    if(vCol) tab.statsPanels.push(vCol);
    if(eCol) tab.statsPanels.push(eCol);
    if(sCol) tab.statsPanels.push(sCol);
  }

  const PILL_COLORS=['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#84cc16','#f97316','#ec4899','#14b8a6'];

  // Conteos por columna — una sola pasada (fix: continue, no return)
  const panelCounts={};
  tab.statsPanels.forEach(c=>panelCounts[c]={});
  tab.filtered.forEach(i=>{
    const r=tab.rawData[i]; if(!r) return;
    for(const col of tab.statsPanels){
      const v=r[col]; if(!v) continue;
      const key = /^sexo$/i.test(col)||/^g[eé]nero$/i.test(col) ? v.toUpperCase() : v;
      panelCounts[col][key]=(panelCounts[col][key]||0)+1;
    }
  });

  // Pills clicables: clic → aplica filtro directo
  const makePills=(col,cnt,max=5)=>{
    const entries=Object.entries(cnt).sort((a,b)=>b[1]-a[1]);
    const shown=entries.slice(0,max);
    const curFilter=tab.colFilters[col];
    const curSet=new Set(Array.isArray(curFilter)?curFilter:[]);

    return shown.map(([k,v],i)=>{
      const isActive=curSet.has(k)||(typeof curFilter==='string'&&curFilter===k);
      const bg=PILL_COLORS[i%PILL_COLORS.length];
      const activeBorder=isActive?`box-shadow:0 0 0 2px ${bg};`:'';
      return `<span class="spill" data-col="${eh(col)}" data-val="${eh(k)}" title="Clic: filtrar por ${eh(k)}&#10;Ctrl+clic: añadir al filtro" style="display:inline-flex;align-items:center;gap:3px;padding:1px 7px;border-radius:10px;font-size:10px;background:${bg}22;border:1px solid ${bg}44;color:${bg};font-weight:600;white-space:nowrap;cursor:pointer;transition:all .12s;${activeBorder}" onclick="onPillClick(event,'${ejs(col)}','${ejs(k)}')">${eh(k.split(' ').slice(0,2).join(' '))} <strong>${v}</strong>${isActive?'<span style="margin-left:2px;font-size:8px">✓</span>':''}</span>`;
    }).join('');
  };

  $('stats-bar').classList.add('visible');
  let html=`
    <div class="scard" style="min-width:80px">
      <div class="scard-label">Total</div>
      <div class="scard-val">${total.toLocaleString()}</div>
      <div class="scard-sub">registros</div>
    </div>
    <div class="scard" style="min-width:70px">
      <div class="scard-label">Visibles</div>
      <div class="scard-val">${vis.toLocaleString()}</div>
      <div class="scard-sub">${total?Math.round(vis/total*100):0}%</div>
    </div>`;

  tab.statsPanels.forEach(col=>{
    const cnt=panelCounts[col]||{};
    const nUnique=Object.keys(cnt).length;
    const maxPills=nUnique<=6?nUnique:5;
    const othersN=Math.max(0,nUnique-maxPills);
    const hasFilter=tab.colFilters[col]!==undefined;

    html+=`<div class="scard scard-panel" style="min-width:0;position:relative" data-panel-col="${eh(col)}">
      <button class="scard-remove" onclick="removeStatsPanel('${ejs(col)}')" title="Quitar panel">×</button>
      <div class="scard-label">${eh(col)}${hasFilter?' <span style="font-size:8px;color:var(--acc-text);background:var(--acc-dim);padding:0 4px;border-radius:6px;vertical-align:middle">filtrado</span>':''}</div>
      <div class="scard-pills">${makePills(col,cnt,maxPills)}${othersN>0?`<span class="spill-more" onclick="openPanelAllValues('${ejs(col)}')" title="Ver todos los ${nUnique} valores" style="font-size:9px;color:var(--muted);padding:1px 6px;border-radius:8px;background:var(--s2);border:1px solid var(--border);cursor:pointer;transition:all .12s">+${othersN} más</span>`:''}</div>
      <div class="scard-sub">${hasFilter?`<span onclick="clearPanelFilter('${ejs(col)}')" style="color:var(--acc-text);cursor:pointer;text-decoration:underline" title="Quitar filtro de ${eh(col)}">✕ limpiar</span>`:nUnique+' valores'}</div>
    </div>`;
  });

  html+=`<div class="scard scard-add" onclick="openStatsPanelPicker()" title="Añadir panel informativo">
    <div style="font-size:20px;line-height:1;color:var(--acc-text)">+</div>
    <div style="font-size:9px;color:var(--muted)">Añadir</div>
  </div>`;

  $('stats-bar').innerHTML=html;
}

// ── Clic en pill → filtro directo ────────────────────────────────────────────
function onPillClick(e,col,val){
  e.stopPropagation();
  const tab=T(); if(!tab) return;
  const cur=tab.colFilters[col];

  if(e.ctrlKey||e.metaKey){
    // Multi-select: añadir/quitar del array
    let sel=new Set(Array.isArray(cur)?cur:(cur&&cur!=='__NULL__'&&cur!=='__WITH__'&&!cur?.startsWith('__CONTAINS__:')?[cur]:[]));
    sel.has(val)?sel.delete(val):sel.add(val);
    if(sel.size===0) delete tab.colFilters[col];
    else tab.colFilters[col]=[...sel];
  } else {
    // Single click: toggle exacto
    if(typeof cur==='string'&&cur===val){
      delete tab.colFilters[col];
    } else if(Array.isArray(cur)&&cur.length===1&&cur[0]===val){
      delete tab.colFilters[col];
    } else {
      tab.colFilters[col]=val;
    }
  }
  applyFilters(); updateChipStates();
}

function clearPanelFilter(col){
  const tab=T(); if(!tab) return;
  delete tab.colFilters[col];
  applyFilters(); updateChipStates();
}

// ── Popover "+N más" → muestra todos los valores con checkboxes ──────────────
function openPanelAllValues(col){
  const tab=T(); if(!tab) return;
  if(!tab.colUniques) precalcColStats(tab);

  // Conteos sobre filtered
  const cnt={};
  tab.filtered.forEach(i=>{
    const r=tab.rawData[i]; if(!r) return;
    const v=r[col]; if(!v) return;
    const key=/^sexo$/i.test(col)||/^g[eé]nero$/i.test(col)?v.toUpperCase():v;
    cnt[key]=(cnt[key]||0)+1;
  });
  const entries=Object.entries(cnt).sort((a,b)=>b[1]-a[1]);
  const curFilter=tab.colFilters[col];
  const curSet=new Set(Array.isArray(curFilter)?curFilter:(typeof curFilter==='string'&&curFilter!=='__NULL__'&&curFilter!=='__WITH__'&&!curFilter?.startsWith('__CONTAINS__:')?[curFilter]:[]));

  // Crear popover
  let ov=$('panel-values-overlay');
  if(ov) ov.remove();
  ov=document.createElement('div');
  ov.id='panel-values-overlay';
  ov.style.cssText='position:fixed;inset:0;z-index:600;background:rgba(0,0,0,.4);display:flex;align-items:flex-start;justify-content:center;padding-top:70px';
  ov.onclick=e=>{if(e.target===ov)ov.remove();};

  const box=document.createElement('div');
  box.style.cssText='background:var(--s1);border:1px solid var(--border2);border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.4);width:380px;max-height:72vh;display:flex;flex-direction:column;overflow:hidden';

  box.innerHTML=`
    <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
      <div style="font-size:14px;font-weight:600;color:var(--text);flex:1">${eh(col)} <span style="font-size:11px;font-weight:400;color:var(--muted)">(${entries.length} valores)</span></div>
      <button onclick="$('panel-values-overlay').remove()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:20px;line-height:1">×</button>
    </div>
    <div style="padding:6px 12px;border-bottom:1px solid var(--border)">
      <input id="pv-search" type="text" placeholder="Buscar valor…" style="width:100%;padding:5px 10px;font-size:12px;border:1px solid var(--border);border-radius:var(--r);background:var(--bg);color:var(--text);outline:none;font-family:var(--font)" autocomplete="off"/>
    </div>
    <div id="pv-list" style="flex:1;overflow-y:auto;padding:4px 0"></div>
    <div style="padding:8px 16px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px;font-size:11px;color:var(--muted)">
      <span id="pv-sel-info"><strong style="color:var(--acc-text)">${curSet.size}</strong> seleccionados</span>
      <span style="margin-left:auto;display:flex;gap:6px">
        <button onclick="_pvClear('${ejs(col)}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;font-family:var(--font);padding:2px 6px;border-radius:4px" onmouseover="this.style.background='var(--s2)'" onmouseout="this.style.background='none'">Limpiar</button>
        <button onclick="$('panel-values-overlay').remove()" style="background:none;border:none;color:var(--acc-text);cursor:pointer;font-size:12px;font-weight:500;font-family:var(--font);padding:2px 8px;border-radius:4px" onmouseover="this.style.background='var(--s2)'" onmouseout="this.style.background='none'">Cerrar</button>
      </span>
    </div>`;

  ov.appendChild(box);
  document.body.appendChild(ov);

  const PILL_COLORS=['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#84cc16','#f97316','#ec4899','#14b8a6'];

  const renderList=(q='')=>{
    const list=$('pv-list'); if(!list) return;
    const filtered=q?entries.filter(([k])=>k.toLowerCase().includes(q)):entries;

    list.innerHTML=filtered.map(([k,v],i)=>{
      const checked=curSet.has(k);
      const bg=PILL_COLORS[i%PILL_COLORS.length];
      return `<div class="cdp-item${checked?' cdp-sel':''}" onclick="_pvToggle('${ejs(col)}','${ejs(k)}')" style="gap:8px">
        <input type="checkbox" ${checked?'checked':''} onclick="event.stopPropagation()"/>
        <span class="cdp-item-label">${eh(k)}</span>
        <span style="display:inline-flex;align-items:center;gap:3px;padding:1px 7px;border-radius:10px;font-size:10px;background:${bg}22;border:1px solid ${bg}33;color:${bg};font-weight:600">${v}</span>
      </div>`;
    }).join('');
  };
  renderList();

  const si=$('pv-search');
  if(si) si.addEventListener('input',()=>renderList(si.value.toLowerCase().trim()));
}

function _pvToggle(col,val){
  const tab=T(); if(!tab) return;
  const cur=tab.colFilters[col];
  let sel=new Set(Array.isArray(cur)?cur:(typeof cur==='string'&&cur!=='__NULL__'&&cur!=='__WITH__'&&!cur?.startsWith('__CONTAINS__:')?[cur]:[]));
  sel.has(val)?sel.delete(val):sel.add(val);
  if(sel.size===0) delete tab.colFilters[col];
  else tab.colFilters[col]=[...sel];
  applyFilters(); updateChipStates();
  // Re-render list preserving search
  const q=($('pv-search')?.value||'').toLowerCase().trim();
  openPanelAllValues(col);
  if(q){ const si=$('pv-search'); if(si){si.value=q;si.dispatchEvent(new Event('input'));} }
}

function _pvClear(col){
  const tab=T(); if(!tab) return;
  delete tab.colFilters[col];
  applyFilters(); updateChipStates();
  const ov=$('panel-values-overlay'); if(ov) ov.remove();
}

// ── Panel picker para stats ──────────────────────────────────────────────────
function openStatsPanelPicker(){
  const tab=T(); if(!tab) return;
  if(!tab.colUniques) precalcColStats(tab);
  const current=new Set(tab.statsPanels||[]);
  // Columnas candidatas: que tengan entre 2 y 200 valores únicos
  const candidates=tab.columns.filter(c=>{
    const u=tab.colUniques[c]?.size||0;
    return u>=2 && u<=200;
  });

  // Crear overlay tipo popover
  let ov=$('stats-picker-overlay');
  if(ov) ov.remove();
  ov=document.createElement('div');
  ov.id='stats-picker-overlay';
  ov.style.cssText='position:fixed;inset:0;z-index:600;background:rgba(0,0,0,.4);display:flex;align-items:flex-start;justify-content:center;padding-top:80px';
  ov.onclick=e=>{if(e.target===ov)ov.remove();};

  const box=document.createElement('div');
  box.style.cssText='background:var(--s1);border:1px solid var(--border2);border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.4);width:340px;max-height:70vh;display:flex;flex-direction:column;overflow:hidden';

  box.innerHTML=`
    <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
      <div style="font-size:14px;font-weight:600;color:var(--text);flex:1">Añadir panel informativo</div>
      <button onclick="$('stats-picker-overlay').remove()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:20px;line-height:1">×</button>
    </div>
    <div style="padding:8px 12px;border-bottom:1px solid var(--border)">
      <input id="sp-search" type="text" placeholder="Buscar columna…" style="width:100%;padding:6px 10px;font-size:12px;border:1px solid var(--border);border-radius:var(--r);background:var(--bg);color:var(--text);outline:none;font-family:var(--font)" autocomplete="off"/>
    </div>
    <div id="sp-list" style="flex:1;overflow-y:auto;padding:4px 0"></div>
    <div style="padding:8px 16px;border-top:1px solid var(--border);font-size:10px;color:var(--muted)">
      Selecciona columnas para mostrar como paneles en la barra de estadísticas.
    </div>`;

  ov.appendChild(box);
  document.body.appendChild(ov);

  const renderList=(q='')=>{
    const list=$('sp-list'); if(!list) return;
    const filtered=q?candidates.filter(c=>c.toLowerCase().includes(q)):candidates;
    list.innerHTML=filtered.map(c=>{
      const checked=current.has(c);
      const uCount=tab.colUniques[c]?.size||0;
      return `<div class="cdp-item${checked?' cdp-sel':''}" onclick="toggleStatsPanel('${ejs(c)}')">
        <input type="checkbox" ${checked?'checked':''}/>
        <span class="cdp-item-label">${eh(c)}</span>
        <span class="cdp-item-cnt">${uCount} val</span>
      </div>`;
    }).join('');
  };
  renderList();

  const si=$('sp-search');
  if(si) si.addEventListener('input',()=>renderList(si.value.toLowerCase().trim()));
}

function toggleStatsPanel(col){
  const tab=T(); if(!tab) return;
  if(!tab.statsPanels) tab.statsPanels=[];
  const idx=tab.statsPanels.indexOf(col);
  if(idx>=0) tab.statsPanels.splice(idx,1);
  else tab.statsPanels.push(col);
  updateStats();
  saveSessionDebounced();
  // Re-render picker if open
  const ov=$('stats-picker-overlay');
  if(ov) openStatsPanelPicker();
}

function removeStatsPanel(col){
  const tab=T(); if(!tab) return;
  if(!tab.statsPanels) return;
  const idx=tab.statsPanels.indexOf(col);
  if(idx>=0) tab.statsPanels.splice(idx,1);
  updateStats();
  saveSessionDebounced();
}

// ── COLOREADO ─────────────────────────────────────────────────────────────────
function openCondModal(){ const tab=T(); if(!tab)return; renderCondRules(); $('cond-overlay').classList.add('open'); }
function closeCondModal(e){ if(e&&e.target!==$('cond-overlay'))return; $('cond-overlay').classList.remove('open'); }
function addCondRule(){ const tab=T(); if(!tab)return; tab.condRules.push({col:'',op:'=',val:'',color:'#3fb950'}); renderCondRules(); }
function applyCondRules(){ closeCondModal(); renderTable(); toast('Colores aplicados'); }
function renderCondRules(){
  const tab=T(); if(!tab) return;
  const list=$('cond-rules-list');
  if(!tab.condRules.length){list.innerHTML='<p style="font-size:12px;color:var(--muted);margin-bottom:10px">Sin reglas. Agrega una abajo.</p>';return}
  const colOpts=['<option value="">Columna</option>',...tab.columns.map(c=>`<option value="${eh(c)}">${eh(c)}</option>`)].join('');
  list.innerHTML=tab.condRules.map((r,i)=>`
    <div class="cm-row" data-idx="${i}">
      <select data-f="col">${colOpts.replace(`value="${eh(r.col)}"`,`value="${eh(r.col)}" selected`)}</select>
      <select data-f="op">${['=','!=','>','<','contiene'].map(op=>`<option value="${op}"${r.op===op?' selected':''}>${op}</option>`).join('')}</select>
      <input type="text" data-f="val" value="${eh(r.val)}" placeholder="valor"/>
      <input type="color" data-f="color" value="${r.color||'#3fb950'}"/>
      <button class="cm-del" data-del="${i}">×</button>
    </div>`).join('');
  list.oninput=list.onchange=e=>{ const row=e.target.closest('[data-idx]'); if(!row)return; const f=e.target.dataset.f; if(f)tab.condRules[+row.dataset.idx][f]=e.target.value; };
  list.onclick=e=>{ const d=e.target.dataset.del; if(d!==undefined){tab.condRules.splice(+d,1);renderCondRules();} };
}

// ── EXPORTAR / COPIAR ─────────────────────────────────────────────────────────
function exportExcel(){
  const tab=T();
  if(!tab||!tab.filtered.length){toast('Sin datos para exportar');return}

  // ── 1. Columnas a exportar: mismas que el usuario ve (respeta ocultas y orden)
  const hid=tab.hiddenCols||new Set();
  const frz=tab.frozenCols||new Set();
  const frozenOrder=tab.frozenOrder||[...frz];
  const exportCols=[
    ...frozenOrder.filter(c=>frz.has(c)&&!hid.has(c)),
    ...tab.columns.filter(c=>!frz.has(c)&&!hid.has(c))
  ];
  if(!exportCols.length){toast('No hay columnas visibles');return}

  const dc=new Set(tab.dateColsDetected||[]);

  // ── 2. Detectar columnas numéricas (≥70% numéricos, excluye fechas e IDs)
  const idRe=/^(c[eé]dula|nit|documento|cc|dni|id)$/i;
  const numColSet=new Set();
  exportCols.forEach(col=>{
    if(dc.has(col)||idRe.test(col.trim())) return;
    let total=0,numCount=0;
    for(let k=0;k<Math.min(tab.rawData.length,150);k++){
      const r=tab.rawData[k]; if(!r) continue;
      const v=r[col];
      if(v===''||v==null) continue;
      total++;
      const n=Number(v);
      if(!isNaN(n)&&String(v).trim()!=='') numCount++;
    }
    if(total>=3&&numCount/total>=0.7) numColSet.add(col);
  });

  // ── 3. Convertir valor al tipo correcto para ExcelJS
  const toVal=(col,v)=>{
    if(v===''||v==null) return null; // null = celda vacía real en ExcelJS
    if(dc.has(col)){
      const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if(m) return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
    }
    if(numColSet.has(col)){
      const n=Number(v);
      if(!isNaN(n)) return n;
    }
    return String(v);
  };

  // ── 4. Construir array de filas (solo filas filtradas, solo columnas visibles)
  const dataRows=tab.filtered
    .filter(i=>tab.rawData[i])
    .map(i=>exportCols.map(c=>toVal(c,tab.rawData[i][c])));

  // ── 5. Nombre de archivo seguro
  const safeName=s=>(s||'').replace(/[\\/:*?"<>|]/g,'_').replace(/\s+/g,' ').trim().slice(0,50);
  const baseName=safeName((tab.fileName||'export').replace(/\.xlsx?$/i,''));
  const sheetName=safeName(tab.activeSheet||'Datos');
  const date=new Date().toISOString().slice(0,10);
  const fileName=`${baseName}_${sheetName}_${date}.xlsx`.replace(/\s/g,'_');

  // ── 6. Exportar con ExcelJS
  if(typeof ExcelJS==='undefined'){
    toast('⚠ ExcelJS no cargó — exportando sin estilos'); _exportFallback(exportCols,dataRows,fileName); return;
  }

  // Feedback visual inmediato
  const btn=$('btn-export');
  const origText=btn?.innerHTML||'';
  if(btn){btn.disabled=true;btn.innerHTML='⏳ Generando...';}

  try{
    const wb=new ExcelJS.Workbook();
    wb.creator='Mirador';
    const wsName=sheetName.slice(0,31); // Excel limita a 31 chars
    const ws=wb.addWorksheet(wsName);

    const BORDER={style:'thin',color:{argb:'FF000000'}};
    const FULL_BORDER={top:BORDER,bottom:BORDER,left:BORDER,right:BORDER};

    // Definir anchos de columna (sin header — evita fila vacía)
    ws.columns=exportCols.map((col,ci)=>{
      let max=Math.max(col.length,8);
      dataRows.slice(0,300).forEach(r=>{
        const v=r[ci]; if(v==null) return;
        const len=v instanceof Date?10:String(v).length;
        if(len>max) max=len;
      });
      return {width:Math.min(max+3,50)};
    });

    // Fila de encabezados
    const hdrRow=ws.addRow(exportCols);
    hdrRow.height=20;
    exportCols.forEach((_,ci)=>{
      const cell=hdrRow.getCell(ci+1);
      cell.font={bold:true,name:'Arial',size:11,color:{argb:'FF000000'}};
      cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFBFBFBF'}};
      cell.alignment={horizontal:'center',vertical:'middle',wrapText:false};
      cell.border=FULL_BORDER;
    });

    // Filas de datos — procesadas por lote para no bloquear el hilo
    const BATCH=500;
    let di=0;
    const addBatch=()=>{
      const end=Math.min(di+BATCH,dataRows.length);
      for(;di<end;di++){
        const rowArr=dataRows[di];
        const r=ws.addRow(rowArr);
        r.height=14;
        // Filas alternas: par → blanco, impar → gris muy claro
        const rowBg=di%2===0?'FFFFFFFF':'FFF5F5F5';
        exportCols.forEach((col,ci)=>{
          const cell=r.getCell(ci+1);
          const val=rowArr[ci];
          cell.font={name:'Arial',size:10,color:{argb:'FF000000'}};
          cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:rowBg}};
          cell.border=FULL_BORDER;
          if(val instanceof Date){
            cell.numFmt='DD/MM/YYYY';
            cell.alignment={vertical:'middle',horizontal:'center'};
          } else if(typeof val==='number'){
            cell.numFmt=Number.isInteger(val)?'#,##0':'#,##0.00';
            cell.alignment={vertical:'middle',horizontal:'right'};
          } else {
            cell.alignment={vertical:'middle',wrapText:false};
          }
        });
      }
      if(di<dataRows.length){
        setTimeout(addBatch,0);
      } else {
        // ── Fila de totales para columnas numéricas ──────────────────
        const totalRow=exportCols.map((col,ci)=>{
          if(!numColSet.has(col)) return ci===0?`Total: ${dataRows.length.toLocaleString()} filas`:null;
          const sum=dataRows.reduce((acc,r)=>{ const v=r[ci]; return typeof v==='number'?acc+v:acc; },0);
          return sum;
        });
        const tRow=ws.addRow(totalRow);
        tRow.height=16;
        exportCols.forEach((col,ci)=>{
          const cell=tRow.getCell(ci+1);
          const val=totalRow[ci];
          cell.font={name:'Arial',size:10,bold:true,color:{argb:'FF000000'}};
          cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFD9D9D9'}};
          cell.border=FULL_BORDER;
          if(typeof val==='number'){
            cell.numFmt=Number.isInteger(val)?'#,##0':'#,##0.00';
            cell.alignment={vertical:'middle',horizontal:'right'};
          } else if(val){
            cell.alignment={vertical:'middle'};
          }
        });

        // ── Freeze + autofilter + configuración de impresión ─────────
        ws.views=[{state:'frozen',ySplit:1,activeCell:'A2'}];
        ws.autoFilter={from:{row:1,column:1},to:{row:dataRows.length+1,column:exportCols.length}};

        // Configuración de página para impresión: A4, horizontal, márgenes, encabezado
        ws.pageSetup={
          paperSize:9,          // A4
          orientation:'landscape',
          fitToPage:true,
          fitToWidth:1,
          fitToHeight:0,
          margins:{left:0.5,right:0.5,top:0.75,bottom:0.75,header:0.3,footer:0.3},
          printTitlesRow:'1:1', // repetir fila de encabezados en cada página impresa
        };
        ws.headerFooter={
          oddHeader:`&L&"Arial,Bold"&10${baseName} — ${sheetName}&R&"Arial,Regular"&9Generado: ${date}`,
          oddFooter:'&C&"Arial,Regular"&9Página &P de &N'
        };

        wb.xlsx.writeBuffer()
          .then(buf=>{
            const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
            const url=URL.createObjectURL(blob);
            const a=document.createElement('a'); a.href=url; a.download=fileName;
            document.body.appendChild(a); a.click();
            setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},200);
            toast(`✓ ${dataRows.length.toLocaleString()} filas · ${exportCols.length} columnas exportadas`);
          })
          .catch(err=>{
            console.error('ExcelJS writeBuffer error:',err);
            toast('Error al generar el archivo — intenta de nuevo');
          })
          .finally(()=>{
            if(btn){btn.disabled=false;btn.innerHTML=origText;}
          });
      }
    };
    addBatch();

  } catch(err){
    console.error('exportExcel error:',err);
    toast('Error al exportar: '+err.message);
    if(btn){btn.disabled=false;btn.innerHTML=origText;}
  }
}

// ── EXPORTAR TODAS LAS PESTAÑAS ABIERTAS ─────────────────────────────────────
function exportAllTabs(){
  if(tabs.size===0){toast('Sin pestañas abiertas');return}
  if(tabs.size===1){exportExcel();return} // una sola → export normal

  if(typeof ExcelJS==='undefined'){toast('⚠ ExcelJS no disponible');return}

  const btn=$('btn-export-all');
  const origText=btn?.innerHTML||'';
  if(btn){btn.disabled=true;btn.innerHTML='⏳ Generando...';}

  const wb=new ExcelJS.Workbook();
  wb.creator='Mirador';

  const BORDER={style:'thin',color:{argb:'FF000000'}};
  const FULL_BORDER={top:BORDER,bottom:BORDER,left:BORDER,right:BORDER};
  const idRe=/^(c[eé]dula|nit|documento|cc|dni|id)$/i;
  const dc_global=new Set();

  // Construir una hoja por pestaña
  const tabList=[...tabs.values()];
  let ti=0;

  const processTab=()=>{
    if(ti>=tabList.length){
      // Todas las hojas listas — serializar
      wb.xlsx.writeBuffer().then(buf=>{
        const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a'); a.href=url;
        a.download=`Mirador_Export_${new Date().toISOString().slice(0,10)}.xlsx`;
        document.body.appendChild(a); a.click();
        setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},200);
        toast(`✓ ${tabList.length} hojas exportadas`);
      }).catch(err=>{
        toast('Error al generar: '+err.message,true);
      }).finally(()=>{
        if(btn){btn.disabled=false;btn.innerHTML=origText;}
      });
      return;
    }

    const tab=tabList[ti++];
    if(!tab.filtered?.length||!tab.columns?.length){processTab();return;}

    const hid=tab.hiddenCols||new Set();
    const frz=tab.frozenCols||new Set();
    const frozenOrder=tab.frozenOrder||[...frz];
    const exportCols=[...frozenOrder.filter(c=>frz.has(c)&&!hid.has(c)),...tab.columns.filter(c=>!frz.has(c)&&!hid.has(c))];
    if(!exportCols.length){processTab();return;}

    const dc=new Set(tab.dateColsDetected||[]);
    const numColSet=new Set();
    exportCols.forEach(col=>{
      if(dc.has(col)||idRe.test(col.trim())) return;
      let total=0,num=0;
      for(let k=0;k<Math.min(tab.rawData.length,150);k++){
        const r=tab.rawData[k];if(!r)continue;
        const v=r[col];if(v===''||v==null)continue;
        total++;if(!isNaN(Number(v)))num++;
      }
      if(total>=3&&num/total>=0.7)numColSet.add(col);
    });

    const toVal=(col,v)=>{
      if(v===''||v==null)return null;
      if(dc.has(col)){const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);}
      if(numColSet.has(col)){const n=Number(v);if(!isNaN(n))return n;}
      return String(v);
    };

    const dataRows=tab.filtered.filter(i=>tab.rawData[i]).map(i=>exportCols.map(c=>toVal(c,tab.rawData[i][c])));

    // Nombre de hoja: usar sheetName del tab, truncar a 31 chars, evitar duplicados
    let wsName=(tab.activeSheet||tab.fileName||`Hoja${ti}`).replace(/[\/:*?"<>|]/g,'_').slice(0,28);
    let attempt=0;
    while(wb.worksheets.find(s=>s.name===wsName)){wsName=wsName.slice(0,25)+'_'+(++attempt);}

    const ws=wb.addWorksheet(wsName);
    ws.columns=exportCols.map((col,ci)=>{
      let max=Math.max(col.length,8);
      dataRows.slice(0,200).forEach(r=>{const v=r[ci];if(v!=null){const l=v instanceof Date?10:String(v).length;if(l>max)max=l;}});
      return{width:Math.min(max+3,50)};
    });

    const hdrRow=ws.addRow(exportCols);
    hdrRow.height=20;
    exportCols.forEach((_,ci)=>{
      const cell=hdrRow.getCell(ci+1);
      cell.font={bold:true,name:'Arial',size:11,color:{argb:'FF000000'}};
      cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFBFBFBF'}};
      cell.alignment={horizontal:'center',vertical:'middle'};
      cell.border=FULL_BORDER;
    });

    dataRows.forEach((rowArr,di)=>{
      const r=ws.addRow(rowArr); r.height=14;
      const rowBg=di%2===0?'FFFFFFFF':'FFF5F5F5';
      exportCols.forEach((col,ci)=>{
        const cell=r.getCell(ci+1); const val=rowArr[ci];
        cell.font={name:'Arial',size:10,color:{argb:'FF000000'}};
        cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:rowBg}};
        cell.border=FULL_BORDER;
        if(val instanceof Date){cell.numFmt='DD/MM/YYYY';cell.alignment={vertical:'middle',horizontal:'center'};}
        else if(typeof val==='number'){cell.numFmt=Number.isInteger(val)?'#,##0':'#,##0.00';cell.alignment={vertical:'middle',horizontal:'right'};}
        else{cell.alignment={vertical:'middle',wrapText:false};}
      });
    });

    ws.views=[{state:'frozen',ySplit:1,activeCell:'A2'}];
    ws.autoFilter={from:{row:1,column:1},to:{row:dataRows.length+1,column:exportCols.length}};
    ws.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,
      margins:{left:0.5,right:0.5,top:0.75,bottom:0.75,header:0.3,footer:0.3},printTitlesRow:'1:1'};

    setTimeout(processTab,0); // ceder hilo entre pestañas
  };

  processTab();
}

function _exportFallback(exportCols,dataRows,fileName){
  try{
    const ws=XLSX.utils.aoa_to_sheet([exportCols,...dataRows.map(r=>r.map(v=>v==null?'':v))]);
    ws['!cols']=exportCols.map((c,ci)=>{
      let max=c.length+2;
      dataRows.slice(0,200).forEach(r=>{const len=String(r[ci]??'').length;if(len>max)max=len;});
      return{wch:Math.min(max+2,45)};
    });
    ws['!rows']=[{hpt:20},...dataRows.map(()=>({hpt:14}))];
    ws['!freeze']={xSplit:0,ySplit:1,topLeftCell:'A2',activePane:'bottomLeft',state:'frozen'};
    const lc=XLSX.utils.encode_col(exportCols.length-1);
    ws['!autofilter']={ref:`A1:${lc}${dataRows.length+1}`};
    const wb2=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb2,ws,fileName.split('_')[1]||'Datos');
    XLSX.writeFile(wb2,fileName);
    toast(`✓ ${dataRows.length.toLocaleString()} filas exportadas (sin estilos)`);
  }catch(e){toast('Error en fallback: '+e.message);}
}
function copySelection(){
  const tab=T(); if(!tab||!tab.selected.size){toast('Sin selección');return}
  copyText([tab.columns.join('\t'),...[...tab.selected].sort((a,b)=>a-b).filter(i=>tab.rawData[i]).map(i=>tab.columns.map(c=>tab.rawData[i][c]??'').join('\t'))].join('\n'),`✓ ${tab.selected.size} fila(s)`);
}
function copyFiltered(){
  const tab=T(); if(!tab||!tab.filtered.length){toast('Sin datos visibles');return}
  copyText([tab.columns.join('\t'),...tab.filtered.filter(i=>tab.rawData[i]).map(i=>tab.columns.map(c=>tab.rawData[i][c]??'').join('\t'))].join('\n'),`✓ ${tab.filtered.length.toLocaleString()} fila(s)`);
}
function copyText(text,msg){
  navigator.clipboard.writeText(text).then(()=>toast(msg)).catch(()=>{
    const t=document.createElement('textarea'); t.value=text; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); toast(msg);
  });
}


// ── ENCABEZADOS: MENÚ CONTEXTUAL, FREEZE, HIDE, STATS ─────────────────────────
let _ctxCol=null;

function openColMenu(e,col){
  e.preventDefault(); e.stopPropagation();
  _ctxCol=col;
  const tab=T(); if(!tab) return;
  const frz=tab.frozenCols||new Set();
  const fi=$('ctx-freeze-item');
  fi.textContent=frz.has(col)?'🔓 Desfijar columna':'🔒 Fijar columna';
  const m=$('col-menu');
  m.style.left=Math.min(e.clientX, window.innerWidth-190)+'px';
  m.style.top =Math.min(e.clientY, window.innerHeight-220)+'px';
  m.classList.add('open');
}

document.addEventListener('click',()=>$('col-menu').classList.remove('open'));
document.addEventListener('keydown',ev=>{ if(ev.key==='Escape') $('col-menu').classList.remove('open'); });

function ctxSort(dir){
  $('col-menu').classList.remove('open');
  const tab=T(); if(!tab||!_ctxCol) return;
  tab.sortDir=dir; tab.sortCol=_ctxCol;
  const coll=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
  const pairs=tab.filtered.map(i=>[i,String(tab.rawData[i]?.[_ctxCol]??'')]);
  pairs.sort((a,b)=>coll.compare(a[1],b[1])*dir);
  tab.filtered=pairs.map(p=>p[0]);
  renderTable();
}

function ctxFreeze(){
  $('col-menu').classList.remove('open');
  const tab=T(); if(!tab||!_ctxCol) return;
  if(!tab.frozenCols) tab.frozenCols=new Set();
  if(!tab.frozenOrder) tab.frozenOrder=[];
  if(tab.frozenCols.has(_ctxCol)){
    tab.frozenCols.delete(_ctxCol);
    tab.frozenOrder=tab.frozenOrder.filter(c=>c!==_ctxCol);
    toast(`"${_ctxCol}" desfijada`);
  } else {
    if(tab.frozenOrder.length>=4){ toast('Máximo 4 columnas fijadas',true); return; }
    tab.frozenCols.add(_ctxCol);
    tab.frozenOrder.push(_ctxCol);
    toast(`"${_ctxCol}" fijada (#${tab.frozenOrder.length})`);
  }
  renderTable();
}

function ctxHide(){
  $('col-menu').classList.remove('open');
  const tab=T(); if(!tab||!_ctxCol) return;
  if(!tab.hiddenCols) tab.hiddenCols=new Set();
  tab.hiddenCols.add(_ctxCol);
  buildChips();
  renderTable();
  toast(`"${_ctxCol}" oculta — usa ⊟ Columnas para restaurar`);
}

function ctxCopyCol(){
  $('col-menu').classList.remove('open');
  const tab=T(); if(!tab||!_ctxCol) return;
  const vals=tab.filtered.filter(i=>tab.rawData[i]).map(i=>tab.rawData[i][_ctxCol]||'');
  copyText([_ctxCol,...vals].join('\n'),`✓ ${vals.length} valores de "${_ctxCol}" copiados`);
}

function ctxFilter(){
  $('col-menu').classList.remove('open');
  const tab=T(); if(!tab||!_ctxCol) return;
  const chip=[...$('chips-bar').querySelectorAll('.chip[data-col]')].find(c=>c.dataset.col===_ctxCol);
  if(chip) chip.click();
  else toast(`Usa la barra de búsqueda para filtrar "${_ctxCol}"`);
}


// ── Panel de columnas ──────────────────────────────────────────────────────────
function openColPanel(){
  const tab=T(); if(!tab) return;
  const list=$('col-panel-list');
  list.innerHTML=tab.columns.map(col=>{
    const hidden=(tab.hiddenCols||new Set()).has(col);
    const frozen=(tab.frozenCols||new Set()).has(col);
    return`<div class="col-panel-item" onclick="toggleColVisibility('${ejs(col)}')">
      <input type="checkbox" ${hidden?'':'checked'} onclick="event.stopPropagation();toggleColVisibility('${ejs(col)}')"/>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${eh(col)}</span>
      ${frozen?'<span style="font-size:10px;color:var(--acc-text)">fija</span>':''}
    </div>`;
  }).join('');
  $('col-panel-overlay').classList.add('open');
}
function closeColPanel(e){
  if(e&&e.target!==$('col-panel-overlay'))return;
  $('col-panel-overlay').classList.remove('open');
}
function toggleColVisibility(col){
  const tab=T(); if(!tab) return;
  if(!tab.hiddenCols) tab.hiddenCols=new Set();
  tab.hiddenCols.has(col)?tab.hiddenCols.delete(col):tab.hiddenCols.add(col);
  // Refrescar lista del panel
  openColPanel();
  buildChips();
  renderTable();
}
function setAllCols(visible){
  const tab=T(); if(!tab) return;
  tab.hiddenCols = visible ? new Set() : new Set(tab.columns);
  openColPanel(); buildChips(); renderTable();
}

// ── FAVORITOS ─────────────────────────────────────────────────────────────────
const getFavs = () => { try{return JSON.parse(localStorage.getItem(FAV_KEY)||'[]')}catch{return[]} };
const setFavs = f => localStorage.setItem(FAV_KEY,JSON.stringify(f));

function openFavModal(){ openViewsPanel(); }
function closeFavModal(e){ if(e&&e.target!==$('fav-overlay'))return; $('fav-overlay').classList.remove('open'); $('fav-name-input').value=''; }

function buildFilterSummary(st){
  const p=[];
  Object.entries(st.colFilters||{}).forEach(([col,val])=>{
    if(Array.isArray(val)) p.push(`${col}:${val.length===1?val[0]:`${val.length} valores`}`);
    else p.push(`${col}:${val==='__NULL__'?'sin valor':val==='__WITH__'?'con valor':val?.startsWith('__CONTAINS__:')?`~${val.slice(13)}`:val}`);
  });
  if(st.searchText) p.push(`"${st.searchText}"`);
  if(st.dateFrom||st.dateTo) p.push(`${st.dateCol||'fecha'}:${st.dateFrom||'*'}→${st.dateTo||'*'}`);
  return p.length?p.join(' · '):'(sin filtros)';
}

function saveFavorite(){
  const tab=T(); if(!tab) return;
  const name=($('fav-name-input').value||'').trim(); if(!name){toast('Escribe un nombre');return}
  const state={ colFilters:JSON.parse(JSON.stringify(tab.colFilters)),
    searchText:$('search-input').value||'', searchCol:$('search-col').value||'',
    dateFrom:$('date-from').value||'', dateTo:$('date-to').value||'', dateCol:$('date-col').value||'',
    fileName:tab.fileName, activeSheet:tab.activeSheet, sheets:tab.sheets,
    columns:tab.columns, rawData:tab.rawData, dateColsDetected:tab.dateColsDetected, color:tab.color };
  const favs=getFavs(), idx=favs.findIndex(f=>f.name===name);
  const fav={name,summary:buildFilterSummary(state),state,date:new Date().toLocaleDateString('es-CO')};
  if(idx>=0){favs[idx]=fav;toast(`"${name}" actualizada`)} else{favs.push(fav);toast(`"${name}" guardada`)}
  setFavs(favs); $('fav-name-input').value=''; renderFavList();
}

function loadFavorite(idx){
  const fav=getFavs()[idx]; if(!fav) return;
  const st=fav.state, id=++tabCounter;
  tabs.set(id,{ id, fileName:st.fileName||fav.name, color:st.color||TAB_COLORS[(id-1)%TAB_COLORS.length],
    workbook:null, sheets:st.sheets||[st.activeSheet||''], activeSheet:st.activeSheet||'',
    rawData:st.rawData||[], columns:st.columns||[], filtered:[], selected:new Set(),
    searchIndex:null, colUniques:null, colNulls:null,
    hiddenCols:new Set(), frozenCols:new Set(),
    colFilters:JSON.parse(JSON.stringify(st.colFilters||{})), condRules:[], sortCol:null, sortDir:1,
    activeChipCol:null, dateColsDetected:st.dateColsDetected||[],
    searchText:st.searchText||'', searchCol:st.searchCol||'',
    dateFrom:st.dateFrom||'', dateTo:st.dateTo||'', dateCol:st.dateCol||'' });
  activeTabId=id; renderTabs(); restoreTabUI(); closeFavModal();
  toast(`📌 Vista "${fav.name}" cargada`); saveSession();
}

function openFileForFav(idx){
  const fav=getFavs()[idx]; if(!fav) return;
  const inp=document.createElement('input');
  inp.type='file'; inp.accept='.xlsx,.xls,.xlsb,.xlsm,.csv,.tsv,.ods,.json,.txt';
  inp.onchange=()=>{
    if(!inp.files.length) return;
    // Process the file, then load the favorite on top
    processFile(inp.files[0]);
    // After loading, apply the favorite filters
    setTimeout(()=>{
      const tab=T(); if(!tab) return;
      const st=fav.state;
      tab.colFilters=JSON.parse(JSON.stringify(st.colFilters||{}));
      tab.searchText=st.searchText||'';
      applyFilters(); updateChipStates();
      toast(`📌 Archivo abierto con vista "${fav.name}"`);
    }, 1200);
  };
  inp.click();
}

function deleteFavorite(idx){
  const favs=getFavs(), name=favs[idx]?.name||''; favs.splice(idx,1); setFavs(favs); renderFavList(); toast(`"${name}" eliminado`);
}
function renderViewsList(){ renderFavList(); }
function renderFavList(){
  const favs=getFavs(), list=$('fav-list');
  if(!favs.length){list.innerHTML='<div id="fav-empty">Sin favoritos. Aplica filtros y guárdalos.</div>';return}
  list.innerHTML=favs.map((f,i)=>`<div class="fav-item"><div class="fav-item-info"><div class="fav-item-name">${eh(f.name)}</div><div class="fav-item-meta">${eh(f.summary)} · ${eh(f.date||'')}</div>${f.state?.fileName?`<div style="font-size:9px;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📄 ${eh(f.state.fileName)}</div>`:''}</div><div class="fav-item-actions"><button class="fav-load" onclick="loadFavorite(${i})">▷ Cargar</button>${f.state?.fileName?`<button class="fav-load" onclick="openFileForFav(${i})" title="Seleccionar este archivo" style="background:var(--s2)">📂 Archivo</button>`:''}<button class="fav-del" onclick="deleteFavorite(${i})" title="Eliminar">🗑</button></div></div>`).join('');
}

// ── UI HELPERS ────────────────────────────────────────────────────────────────
function enableControls(on){
  const rt=$('recent-toggle'); if(rt) rt.style.display=on?'flex':'none';
  ['btn-export','btn-export-all','btn-cond','btn-copy','btn-copy-all','btn-fav','btn-clear','btn-cols','btn-date-cols',
   'btn-graph','btn-refresh','btn-clear-inline','btn-clear-chips','chk-regex','chk-excl','btn-regex-flags','search-input','search-col']
    .forEach(id=>{const e=$(id);if(e)e.disabled=!on});
  if(on) _showFileActions();
  updateBreadcrumb();
}
function updateStatusBar(){
  const tab=T();
  $('st-total').textContent=tab?tab.rawData.length:0;
  $('st-vis').textContent  =tab?tab.filtered.length:0;
  $('st-sel').textContent  =tab?tab.selected.size:0;
}
function setStatus(m){ /* status textual retirado de la barra inferior */ }
let _toastTimer=null;
function toast(msg,err){
  const e=$('toast'); e.textContent=msg; e.style.borderColor=err?'var(--danger)':'var(--border)';
  e.classList.add('show'); clearTimeout(_toastTimer); _toastTimer=setTimeout(()=>e.classList.remove('show'),2800);
}
function _showHdrToast(fila){
  const e=$('toast');
  e.innerHTML=`Encabezado detectado en fila ${fila} &nbsp;·&nbsp; <span onclick="reopenHdrPicker();this.closest('#toast').classList.remove('show')" style="text-decoration:underline;cursor:pointer;color:var(--acc-text);font-weight:600">Cambiar</span>`;
  e.style.borderColor='var(--border)';
  e.classList.add('show');
  clearTimeout(_toastTimer); _toastTimer=setTimeout(()=>e.classList.remove('show'),5000);
}

// ── ATAJOS ────────────────────────────────────────────────────────────────────
document.addEventListener('keydown',e=>{
  const tab=T();
  const tag=document.activeElement?.tagName;
  const inInput=tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT';

  // Ctrl+A — seleccionar todo
  if((e.ctrlKey||e.metaKey)&&e.key==='a'&&tab?.rawData.length){
    e.preventDefault(); tab.filtered.forEach(i=>tab.selected.add(i)); renderTable(); updateStatusBar();
  }
  // Ctrl+C — copiar selección
  if((e.ctrlKey||e.metaKey)&&e.key==='c'&&!inInput&&tab?.selected.size){
    e.preventDefault(); copySelection();
  }

  // Escape — cerrar paneles
  if(e.key==='Escape'){
    ['detail-overlay','cond-overlay','fav-overlay','theme-overlay','datecol-overlay','hdr-overlay','col-panel-overlay'].forEach(id=>$(id)?.classList.remove('open'));
    $('chart-overlay').style.display='none'; $('regex-flags-panel').style.display='none'; const _sp=$('stats-picker-overlay'); if(_sp)_sp.remove(); const _pv=$('panel-values-overlay'); if(_pv)_pv.remove(); const _rf=$('refresh-overlay'); if(_rf)_rf.remove();
    closeDropdown();
  }

  // Teclas direccionales — navegar filas (virtual scroll aware)
  if(!inInput&&tab?.filtered.length&&(e.key==='ArrowDown'||e.key==='ArrowUp')){
    e.preventDefault();
    let cursorIdx = tab._cursorRow ?? -1;
    const total=tab.filtered.length;
    if(e.key==='ArrowDown') cursorIdx = Math.min(cursorIdx+1, total-1);
    else                    cursorIdx = Math.max(cursorIdx-1, 0);
    tab._cursorRow = cursorIdx;
    const rawIdx = tab.filtered[cursorIdx];

    if(e.shiftKey){ tab.selected.add(rawIdx); }
    else { tab.selected.clear(); tab.selected.add(rawIdx); }

    // Scroll virtual al cursor
    const scroll=$('vt-scroll');
    const targetTop=cursorIdx*VT_ROW_H;
    const viewTop=scroll.scrollTop;
    const viewH=scroll.clientHeight;
    if(targetTop<viewTop) scroll.scrollTop=targetTop;
    else if(targetTop+VT_ROW_H>viewTop+viewH) scroll.scrollTop=targetTop-viewH+VT_ROW_H;

    // Re-render para actualizar selección visual
    _vtLastStart=-1; _vtRenderVisible();
    updateStatusBar();
  }

  // Home/End — ir a primera/última fila
  if(!inInput&&tab?.filtered.length&&(e.key==='Home'||e.key==='End')){
    e.preventDefault();
    const total=tab.filtered.length;
    const cursorIdx = e.key==='Home' ? 0 : total-1;
    tab._cursorRow = cursorIdx;
    const rawIdx = tab.filtered[cursorIdx];
    tab.selected.clear(); tab.selected.add(rawIdx);
    $('vt-scroll').scrollTop = cursorIdx*VT_ROW_H;
    _vtLastStart=-1; _vtRenderVisible();
    updateStatusBar();
  }

  // Enter — abrir detalle de la fila seleccionada (si hay exactamente una)
  if(!inInput&&e.key==='Enter'&&tab?.selected.size===1){
    e.preventDefault();
    const idx=[...tab.selected][0];
    openDetail(idx);
  }

  // Scroll horizontal con ← → cuando no hay input activo ni selección
  if(!inInput&&(e.key==='ArrowLeft'||e.key==='ArrowRight')&&!tab?.selected.size){
    const scroll=$('vt-scroll');
    if(scroll.scrollWidth>scroll.clientWidth){
      e.preventDefault();
      scroll.scrollBy({left: e.key==='ArrowRight'?120:-120, behavior:'smooth'});
    }
  }
});


// ── TEMAS ──────────────────────────────────────────────────────────────────────
const THEMES=[
  {id:'dark',   label:'Oscuro',             sub:'Slate azul oscuro',    p:['#1e293b','#334155','#3b82f6','#e2e8f0']},
  {id:'dashboard',label:'Dashboard',        sub:'Verde esmeralda oscuro',p:['#11152a','#1a1f38','#10b981','#e2e8f0']},
  {id:'dashboard-purple',label:'Dashboard violeta',sub:'Púrpura profundo',p:['#130f28','#1c1640','#8b5cf6','#e2e8f0']},
  {id:'azul',   label:'Institucional azul', sub:'Azul gubernamental',   p:['#1d3461','#e8f0fb','#4a90d9','#1d3461']},
  {id:'grafito',label:'Slate grafito',      sub:'Gris carbón claro',    p:['#2c3444','#eef0f3','#3d8c5a','#1e2535']},
  {id:'minimal',label:'Blanco minimal',     sub:'Violeta sobre blanco', p:['#ffffff','#fafafa','#6c63ff','#1a1a2e']},
  {id:'verde',  label:'Verde esmeralda',    sub:'Verde institucional',  p:['#064e3b','#ecfdf5','#10b981','#064e3b']},
  {id:'amber',  label:'Cálido arena ámbar',  sub:'Ámbar cálido',         p:['#78350f','#fef3c7','#f59e0b','#78350f']},
];
const THEME_KEY='mirador_theme';
let currentTheme=localStorage.getItem(THEME_KEY)||'dark';

function applyTheme(id){
  currentTheme=id;
  document.documentElement.dataset.theme=id;
  localStorage.setItem(THEME_KEY,id);
  if($('theme-grid')) renderThemeGrid();
}

function openThemeModal(){
  renderThemeGrid();
  $('theme-overlay').classList.add('open');
}
function closeThemeModal(e){
  if(e&&e.target!==$('theme-overlay'))return;
  $('theme-overlay').classList.remove('open');
}
function renderThemeGrid(){
  $('theme-grid').innerHTML=THEMES.map(t=>{
    const active=t.id===currentTheme;
    const [top,body,acc,txt]=t.p;
    const lightTop=top==='#ffffff'||top.startsWith('#e')||top.startsWith('#f');
    return`<div onclick="applyTheme('${t.id}')" style="border-radius:8px;border:${active?'2px solid '+acc:'1px solid var(--border)'};overflow:hidden;cursor:pointer;${active?'box-shadow:0 0 0 3px '+acc+'33':''}">
      <div style="background:${top};padding:7px 10px;display:flex;align-items:center;gap:6px">
        <div style="width:12px;height:12px;border-radius:3px;background:${acc}"></div>
        <span style="font-size:10px;font-weight:500;color:${lightTop?txt:'#fff'};opacity:.9">Mirador</span>
        ${active?`<span style="margin-left:auto;font-size:9px;background:${acc};color:#fff;padding:1px 5px;border-radius:8px">activo</span>`:''}
      </div>
      <div style="background:${body};padding:7px 10px;border-top:1px solid rgba(0,0,0,.08)">
        <div style="display:flex;gap:4px;margin-bottom:5px">
          <div style="padding:2px 7px;border-radius:8px;background:${acc};color:#fff;font-size:9px">${t.label.split(' ')[0]}</div>
          <div style="padding:2px 7px;border-radius:8px;background:rgba(0,0,0,.06);color:${txt};font-size:9px;border:1px solid rgba(0,0,0,.1)">Filtro</div>
        </div>
        <div style="height:2px;border-radius:1px;background:rgba(0,0,0,.07);margin-bottom:3px"></div>
        <div style="height:2px;border-radius:1px;background:rgba(0,0,0,.04)"></div>
      </div>
      <div style="padding:7px 10px;background:${body};border-top:1px solid rgba(0,0,0,.06)">
        <div style="font-size:12px;font-weight:500;color:${txt}">${t.label}</div>
        <div style="font-size:10px;color:${txt};opacity:.55;margin-top:2px">${t.sub}</div>
      </div>
    </div>`;
  }).join('');
}


// ── SELECTOR MANUAL DE COLUMNAS DE FECHA ─────────────────────────────────────
function openDateColPanel(){
  const tab=T(); if(!tab) return;
  const detected=new Set(tab.dateColsDetected||[]);
  const manual=new Set(tab._manualDateCols||[]);
  const allDate=new Set([...detected,...manual]);

  $('datecol-list').innerHTML=tab.columns.map(col=>{
    const checked=allDate.has(col);
    const autoDetected=detected.has(col)&&!manual.has(col);
    return`<label style="display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:5px;cursor:pointer;background:${checked?'var(--acc-dim)':'var(--bg)'};border:1px solid ${checked?'var(--acc)':'var(--border)'}">
      <input type="checkbox" ${checked?'checked':''} data-col="${eh(col)}" style="accent-color:var(--acc);width:14px;height:14px"/>
      <span style="flex:1;font-size:12px;color:var(--text)">${eh(col)}</span>
      ${autoDetected?'<span style="font-size:10px;color:var(--muted);background:var(--s2);padding:1px 6px;border-radius:8px">auto</span>':''}
      ${checked&&!autoDetected?'<span style="font-size:10px;color:var(--acc-text);background:var(--acc-dim);padding:1px 6px;border-radius:8px">manual</span>':''}
    </label>`;
  }).join('');

  // Toggle visual al hacer clic
  $('datecol-list').onclick=function(e){
    const lbl=e.target.closest('label'); if(!lbl) return;
    const cb=lbl.querySelector('input[type=checkbox]');
    if(e.target!==cb) cb.checked=!cb.checked;
    const on=cb.checked;
    lbl.style.background=on?'var(--acc-dim)':'var(--bg)';
    lbl.style.borderColor=on?'var(--acc)':'var(--border)';
  };

  $('datecol-overlay').classList.add('open');
}

function closeDateColPanel(e){
  if(e&&e.target!==$('datecol-overlay'))return;
  $('datecol-overlay').classList.remove('open');
}

function applyDateColSelection(){
  const tab=T(); if(!tab) return;
  const checked=[...$('datecol-list').querySelectorAll('input[type=checkbox]:checked')].map(cb=>cb.dataset.col);
  tab._manualDateCols=checked;
  tab.dateColsDetected=[...new Set(checked)];
  // Invalidar índice de búsqueda y stats
  tab.searchIndex=null; tab.colUniques=null; tab.colNulls=null;
  buildChips(); buildDateColCombo(); renderTable();
  closeDateColPanel();
  toast(`${checked.length} columna(s) de fecha configuradas`);
}

// ── SELECTOR DE FILA DE ENCABEZADOS ──────────────────────────────────────────
// Estado del picker
let _hdrPicker = null;
// {tabId, sheetName, ws, range, detectedRow, selectedRow, preserveFilters, maxPreviewRows}

const HDR_PREVIEW_ROWS = 80; // filas a mostrar en la vista previa
const HDR_SCAN_ROWS = DEFAULT_HDR_SCAN_ROWS;

/**
 * Abre el modal picker. Escanea el workbook y muestra preview interactiva.
 * Si la autodetección es obvia (score alto), confirma directamente.
 */
function openHdrPicker(tabId, sheetName, ws, range, preserveFilters, initialRow){
  const detectedRow = detectBestHeaderRow(ws, range);
  const selectedRow = (initialRow != null && initialRow >= range.s.r && initialRow <= range.e.r)
    ? initialRow : detectedRow;

  _hdrPicker = {
    tabId, sheetName, ws, range,
    detectedRow,
    selectedRow,
    preserveFilters,
    colCount: range.e.c - range.s.c + 1
  };

  const banner = $('hdr-auto-banner');
  banner.classList.add('show');
  $('hdr-auto-rownum').textContent = detectedRow - range.s.r + 1;
  const manualInp = $('hdr-manual-input');
  if(manualInp) manualInp.value = '';

  renderHdrPreview();
  window._lockModalViewport?.();
  $('hdr-overlay').classList.add('open');
  window.scheduleOverlayCheck?.();
  setTimeout(()=>scrollToHdrRow(selectedRow), 80);
}

/**
 * Renderiza la tabla de vista previa con las primeras HDR_PREVIEW_ROWS filas.
 */
function renderHdrPreview(){
  const p = _hdrPicker; if(!p) return;
  const {ws, range, selectedRow} = p;

  // Construir cabecera de columnas (A, B, C…)
  const cols = [];
  for(let c = range.s.c; c <= Math.min(range.e.c, range.s.c + 25); c++){
    cols.push(XLSX.utils.encode_col(c));
  }
  const moreColsCount = Math.max(0, range.e.c - range.s.c + 1 - 26);

  $('hdr-thead').innerHTML = `<tr>
    <th style="width:44px;text-align:center">#</th>
    ${cols.map(c=>`<th>${eh(c)}</th>`).join('')}
    ${moreColsCount>0?`<th style="color:var(--muted)">+${moreColsCount} más…</th>`:''}
  </tr>`;

  const tbody = $('hdr-tbody');
  const frag = document.createDocumentFragment();
  const endRow = Math.min(range.e.r, range.s.r + HDR_PREVIEW_ROWS - 1);

  for(let r = range.s.r; r <= endRow; r++){
    const tr = document.createElement('tr');
    const rowNum = r - range.s.r + 1; // número 1-based visible

    // Estado visual
    if(r < selectedRow)        tr.classList.add('hdr-above');
    else if(r === selectedRow) tr.classList.add('hdr-selected');
    else                       tr.classList.add('hdr-data');

    tr.dataset.row = r;
    tr.title = `Clic para usar fila ${rowNum} como encabezado`;
    tr.onclick = () => selectHdrRow(r);

    // Celda de número de fila
    const tdNum = document.createElement('td');
    tdNum.className = 'hdr-row-num';
    if(r === selectedRow){
      tdNum.innerHTML = `<span class="hdr-row-selector current">↳ Fila ${rowNum}</span>`;
    } else {
      tdNum.innerHTML = `<span class="hdr-row-selector">${rowNum}</span>`;
    }
    tr.appendChild(tdNum);

    // Celdas de datos
    cols.forEach((_, ci) => {
      const c = range.s.c + ci;
      const cell = ws[XLSX.utils.encode_cell({r, c})];
      const val = cell ? String(cell.v ?? '').trim() : '';
      const td = document.createElement('td');
      td.textContent = val;
      if(r === selectedRow && val) td.style.fontWeight = '600';
      tr.appendChild(td);
    });

    if(moreColsCount > 0){
      const td = document.createElement('td');
      td.style.cssText = 'color:var(--muted);font-style:italic;font-size:10px';
      td.textContent = '…';
      tr.appendChild(td);
    }

    frag.appendChild(tr);
  }

  if(range.e.r > endRow){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="${cols.length+2}" style="text-align:center;padding:10px;color:var(--muted);font-size:11px;font-style:italic">
      … ${(range.e.r - endRow).toLocaleString()} filas más (solo se muestran las primeras ${HDR_PREVIEW_ROWS})
    </td>`;
    frag.appendChild(tr);
  }

  tbody.innerHTML = '';
  tbody.appendChild(frag);

  // Actualizar info del footer
  const selNum = _hdrPicker.selectedRow - _hdrPicker.range.s.r + 1;
  const totalRows = _hdrPicker.range.e.r - _hdrPicker.selectedRow; // filas de datos estimadas
  $('hdr-sel-rownum').innerHTML = `${selNum} <span style="font-size:11px;font-weight:400;color:var(--muted)">→ ~${totalRows.toLocaleString()} filas de datos</span>`;
}

function selectHdrRow(rowIndex){
  if(!_hdrPicker) return;
  _hdrPicker.selectedRow = rowIndex;
  renderHdrPreview();
  scrollToHdrRow(rowIndex);
  toast(`Fila ${rowIndex - _hdrPicker.range.s.r + 1} seleccionada como encabezado`);
}

function scrollToHdrRow(rowIndex){
  const tr = $('hdr-preview-wrap').querySelector(`tr[data-row="${rowIndex}"]`);
  if(tr) tr.scrollIntoView({block:'center', behavior:'smooth'});
}

function jumpToHdrRow(val){
  const n = parseInt(val);
  if(!_hdrPicker || isNaN(n) || n < 1) return;
  const r = _hdrPicker.range.s.r + n - 1;
  if(r > _hdrPicker.range.e.r){ toast(`La hoja solo tiene ${_hdrPicker.range.e.r - _hdrPicker.range.s.r + 1} filas`, true); return; }
  selectHdrRow(r);
}

function autoDetectHeaderAndApply(){
  if(!_hdrPicker) return;
  _hdrPicker.selectedRow = detectBestHeaderRow(_hdrPicker.ws, _hdrPicker.range);
  confirmHdrPicker();
}

function confirmHdrPicker(){
  if(!_hdrPicker) return;
  const {tabId, sheetName, ws, range, selectedRow, preserveFilters} = _hdrPicker;
  $('hdr-overlay').classList.remove('open');
  _hdrPicker = null;
  window.scheduleOverlayCheck?.();
  _processSheetData(tabId, sheetName, ws, range, selectedRow, preserveFilters);
  toast(`Encabezado aplicado: fila ${selectedRow - range.s.r + 1}`);
}

function cancelHdrPicker(){
  if(!_hdrPicker) return;
  const {tabId} = _hdrPicker;
  const fallback = _hdrPicker._cancelFallback ?? null;
  $('hdr-overlay').classList.remove('open');
  _hdrPicker = null;
  window.scheduleOverlayCheck?.();
  const tab = tabs.get(tabId);
  if(fallback !== null && fallback !== undefined && tab){
    tab._manualHdrRow = fallback;
    renderSheetsSidebar();
    return;
  }
  if(tab && tab.rawData.length){
    renderSheetsSidebar();
    return;
  }
  $('loading').style.display = 'none';
  $('dropzone').style.display = 'flex';
  $('table-wrap').style.display = 'none';
  if(tab && !tab.rawData.length){ closeTab(tabId); }
}

function _openHdrPickerForTab(tab){
  const ws = tab.workbook?.Sheets[tab.activeSheet];
  if(!ws){ toast('Hoja no encontrada en el archivo.', true); return; }
  const range = XLSX.utils.decode_range(ws['!ref']||'A1');
  const prevRow = tab._manualHdrRow;
  tab._manualHdrRow = null;
  _hdrPicker = null;
  openHdrPicker(tab.id, tab.activeSheet, ws, range, true, prevRow);
  if(_hdrPicker) _hdrPicker._cancelFallback = prevRow;
}
function _readWorkbookFromFile(tab, file, onDone){
  const r = new FileReader();
  r.onload = e => {
    try{
      tab._file = file;
      tab.fileName = file.name;
      tab.workbook = XLSX.read(e.target.result, {type:'array', cellDates:false});
      const meta = (tab.workbook.Workbook?.Sheets)||[];
      tab.sheets = tab.workbook.SheetNames.filter((_,i)=>{ const m=meta[i]; return !m||!m.Hidden; });
      if(!tab.sheets.length) tab.sheets = tab.workbook.SheetNames;
      if(!tab.sheets.includes(tab.activeSheet)) tab.activeSheet = tab.sheets[0];
      onDone?.();
    }catch(err){ toast('Error al leer el archivo: '+err.message, true); }
  };
  r.onerror = () => toast('No se pudo leer el archivo.', true);
  r.readAsArrayBuffer(file);
}
function _promptTabXlsx(tab, onLoaded){
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.xlsx,.xls';
  inp.onchange = () => { if(inp.files?.[0]) _readWorkbookFromFile(tab, inp.files[0], onLoaded); };
  toast('Selecciona el .xlsx para ajustar el encabezado');
  inp.click();
}
function reopenHdrPicker(){
  const tab = T();
  if(!tab || !tab.activeSheet) return;
  if(tab.workbook){ _openHdrPickerForTab(tab); return; }
  if(tab._file){ _readWorkbookFromFile(tab, tab._file, ()=>_openHdrPickerForTab(tab)); return; }
  _promptTabXlsx(tab, ()=>_openHdrPickerForTab(tab));
}

// ── RECARGA / AUTO-REFRESH ──────────────────────────────────────────────────
let _refreshTimers={}; // tabId -> intervalId

function reloadTab(tabId){
  const tid=tabId||activeTabId;
  const tab=tabs.get(tid); if(!tab) return;
  if(!tab._file){
    // Sin archivo original — ofrecer selector
    const inp=document.createElement('input');
    inp.type='file'; inp.accept='.xlsx,.xls';
    inp.onchange=()=>{
      if(!inp.files.length) return;
      tab._file=inp.files[0];
      tab.fileName=tab._file.name;
      _doReload(tid);
    };
    inp.click();
    return;
  }
  _doReload(tid);
}

function _doReload(tabId){
  const tab=tabs.get(tabId); if(!tab) return;
  if(!tab._file){
    if(tab.workbook&&tab.activeSheet){
      if(tabId===activeTabId) toast('↻ Actualizando '+tab.fileName+'…');
      loadSheet(tab.activeSheet, tabId, true);
      return;
    }
    if(tabId===activeTabId) toast('⚠ Sin archivo original — usa ↻ para seleccionarlo',true);
    if(_refreshTimers[tabId]){ clearInterval(_refreshTimers[tabId]); delete _refreshTimers[tabId]; tab._autoRefresh=0; renderTabs(); }
    return;
  }
  const preserveSheet=tab.activeSheet;
  const prevSort={col:tab.sortCol,dir:tab.sortDir};
  const prevColFilters=JSON.parse(JSON.stringify(tab.colFilters||{}));
  const prevSearchText=tab.searchText||'';
  const prevPillsSearch=tab.pillsSearchText||'';
  const prevScrollTop=$('vt-scroll')?.scrollTop||0;

  if(tabId===activeTabId) toast('↻ Recargando '+tab.fileName+'…');
  const r=new FileReader();
  r.onload=e=>{
    try{
      tab.workbook=XLSX.read(e.target.result,{type:'array',cellDates:false});
      const meta=(tab.workbook.Workbook?.Sheets)||[];
      tab.sheets=tab.workbook.SheetNames.filter((_,i)=>{ const m=meta[i]; return !m||!m.Hidden; });
      if(!tab.sheets.length) tab.sheets=tab.workbook.SheetNames;
      const targetSheet=tab.sheets.includes(preserveSheet)?preserveSheet:tab.sheets[0];
      // Preservar estado del usuario
      tab.colFilters=prevColFilters;
      tab.sortCol=prevSort.col; tab.sortDir=prevSort.dir;
      tab.searchIndex=null; tab.colUniques=null; tab.colNulls=null;
      tab._lastLoaded=Date.now();
      if(tabId===activeTabId){
        // Recarga activa: refrescar UI completa preservando filtros y scroll
        _vtLastStart=-1; _vtLastEnd=-1; _vtRowHeights={};
        tab.searchText=prevSearchText;
        tab.pillsSearchText=prevPillsSearch;
        loadSheet(targetSheet, tabId, true);
        if(_pillsOn){
          _syncPillsSearchUI(tab);
        }else{
          $('search-input').value=prevSearchText;
          requestAnimationFrame(()=>{
            const s=$('vt-scroll');
            if(!s) return;
            s.scrollTop=prevScrollTop;
            _vtLastStart=-1; _vtLastEnd=-1; _vtRowHeights={};
            _vtRenderVisible();
          });
        }
      } else {
        // Recarga en segundo plano: actualizar datos sin tocar la UI activa
        // Necesitamos parsear la hoja para tener rawData actualizado
        const ws=tab.workbook.Sheets[targetSheet];
        if(ws){
          const range=XLSX.utils.decode_range(ws['!ref']||'A1');
          const hRow=tab._manualHdrRow??range.s.r;
          const extracted=_extractSheetDataFromHeaderRow(ws, range, hRow);
          tab.columns=extracted.columns;
          const raw=extracted.raw;
          if(raw.length){
            // Re-usar la lógica de parseado ya aplicada (dateColsDetected guardado)
            tab.rawData=raw.map(row=>{
              const o={};
              for(const col of tab.columns){
                const v=row[col];
                if(v==null||v===undefined){o[col]='';continue}
                if(typeof v==='number'){
                  const dc=new Set(tab.dateColsDetected||[]);
                  if(dc.has(col)){
                    try{const d=XLSX.SSF?.parse_date_code?.(v);if(d&&d.y>=1930)o[col]=`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;else o[col]=Number.isInteger(v)?String(v):(Math.round(v*100)/100).toString();}catch{o[col]=String(v);}
                    continue;
                  }
                  o[col]=Number.isInteger(v)?String(v):(Math.round(v*100)/100).toString();continue;
                }
                o[col]=String(v).trim();
              }
              return o;
            });
            tab.searchIndex=null; tab.colUniques=null; tab.colNulls=null;
            tab.activeSheet=targetSheet;
          }
        }
        // Marcar el tab como actualizado (indicador visual)
        tab._pendingReload=true;
        renderTabs();
      }
      renderTabs();
      const timeStr=new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});
      if(tabId===activeTabId) toast('✓ '+tab.fileName+' actualizado — '+timeStr);
    }catch(err){toast('Error al recargar: '+err.message,true)}
  };
  r.readAsArrayBuffer(tab._file);
}

function openRefreshModal(){
  const tab=T(); if(!tab){toast('Abre un archivo primero');return;}
  let ov=$('refresh-overlay');
  if(ov) ov.remove();
  ov=document.createElement('div');
  ov.id='refresh-overlay';
  ov.style.cssText='position:fixed;inset:0;z-index:600;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px';
  ov.onclick=e=>{if(e.target===ov)ov.remove();};

  const hasFile=!!tab._file;
  const lastTime=tab._lastLoaded?new Date(tab._lastLoaded).toLocaleTimeString():'nunca';
  const curInterval=tab._autoRefresh||0;

  const box=document.createElement('div');
  box.style.cssText='background:var(--s1);border:1px solid var(--border);border-radius:12px;width:380px;box-shadow:0 16px 48px rgba(0,0,0,.4);overflow:hidden';
  box.innerHTML=`
    <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
      <div style="width:32px;height:32px;border-radius:8px;background:var(--acc-dim);border:1px solid var(--acc);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">↻</div>
      <div style="flex:1"><div style="font-size:14px;font-weight:600;color:var(--text)">Actualizar datos</div><div style="font-size:11px;color:var(--muted)">${eh(tab.fileName)}</div></div>
      <button onclick="$('refresh-overlay').remove()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:20px;line-height:1">×</button>
    </div>
    <div style="padding:16px 18px;display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="flex:1;font-size:12px;color:var(--muted)">Última carga:</div>
        <div style="font-size:12px;color:var(--text);font-weight:500">${lastTime}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="flex:1;font-size:12px;color:var(--muted)">Archivo original:</div>
        <div style="font-size:12px;color:${hasFile?'var(--success)':'var(--warn)'};">${hasFile?'✓ disponible':'✗ no disponible'}</div>
      </div>
      <button onclick="reloadTab();$('refresh-overlay').remove()" style="width:100%;padding:8px;border-radius:var(--r);border:1px solid var(--acc);background:var(--acc-dim);color:var(--acc-text);font-size:13px;font-weight:500;cursor:pointer;font-family:var(--font)">${hasFile?'↻ Recargar archivo ahora':'Seleccionar archivo para recargar'}</button>
      <div style="border-top:1px solid var(--border);padding-top:12px">
        <div style="font-size:12px;font-weight:500;color:var(--text);margin-bottom:8px">Auto-refresh</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap" id="rf-intervals">
          ${[{l:'Off',v:0},{l:'30s',v:30000},{l:'1 min',v:60000},{l:'5 min',v:300000},{l:'15 min',v:900000},{l:'30 min',v:1800000}].map(o=>
            '<button onclick="setAutoRefresh('+o.v+')" style="padding:4px 12px;border-radius:16px;border:1px solid '+(curInterval===o.v?'var(--acc)':'var(--border)')+';background:'+(curInterval===o.v?'var(--acc-dim)':'var(--bg)')+';color:'+(curInterval===o.v?'var(--acc-text)':'var(--muted)')+';font-size:11px;cursor:pointer;font-family:var(--font)">'+o.l+'</button>'
          ).join('')}
        </div>
        <div style="font-size:10px;color:var(--muted);margin-top:6px">${curInterval>0?'Recargando cada '+(curInterval/1000)+'s — se preservan filtros y orden':'Desactivado — selecciona un intervalo para recargar automáticamente'}</div>
      </div>
    </div>`;
  ov.appendChild(box);
  document.body.appendChild(ov);
}

function setAutoRefresh(ms){
  const tab=T(); if(!tab) return;
  tab._autoRefresh=ms;
  // Limpiar timer anterior
  if(_refreshTimers[tab.id]){ clearInterval(_refreshTimers[tab.id]); delete _refreshTimers[tab.id]; }
  // Configurar nuevo timer
  if(ms>0 && tab._file){
    _refreshTimers[tab.id]=setInterval(()=>_doReload(tab.id), ms);
    toast('↻ Auto-refresh: cada '+(ms>=60000?(ms/60000)+' min':(ms/1000)+'s'));
  } else if(ms===0){
    toast('Auto-refresh desactivado');
  } else {
    toast('Selecciona un archivo primero para auto-refresh');
  }
  const ov=$('refresh-overlay'); if(ov) ov.remove();
  openRefreshModal(); // re-render para actualizar estado visual
}

// Limpiar timers al cerrar tab
function closeTab(id){
  if(_refreshTimers[id]){ clearInterval(_refreshTimers[id]); delete _refreshTimers[id]; }
  _sessionClearWorkbooks([id]);
  tabs.delete(id);
  if(activeTabId===id) activeTabId=tabs.size ? [...tabs.keys()].at(-1) : null;
  renderTabs();
  activeTabId ? restoreTabUI() : showDropzone(true);
  saveSession();
}

// ── FILE MANAGER ─────────────────────────────────────────────────────────────
const FM_KEY='mirador_files_v1';
const FM_FOLDERS_KEY='mirador_folders_v1';
let _fmOpen=false;

function _fmLoad(){ try{return JSON.parse(localStorage.getItem(FM_KEY))||[];}catch(e){return[];} }
function _fmSave(list){ localStorage.setItem(FM_KEY,JSON.stringify(list)); }
function _fmLoadFolders(){ try{return JSON.parse(localStorage.getItem(FM_FOLDERS_KEY))||[];}catch(e){return[];} }
function _fmSaveFolders(f){ localStorage.setItem(FM_FOLDERS_KEY,JSON.stringify(f)); }

function fmRegisterFile(fileName,sheetCount,rowCount){
  const list=_fmLoad();
  const existing=list.findIndex(f=>f.name===fileName);
  const entry={name:fileName,sheets:sheetCount||0,rows:rowCount||0,date:Date.now(),fav:existing>=0?list[existing].fav:false,folder:existing>=0?list[existing].folder:null};
  if(existing>=0) list.splice(existing,1);
  list.unshift(entry);
  if(list.length>50) list.length=50;
  _fmSave(list);
  fmRender();
}

function toggleFilesSidebar(){
  _fmOpen=!_fmOpen;
  const panel=$('sidebar-files');
  const chev=$('files-chevron');
  const sheets=$('sidebar-sheets');
  if(_fmOpen){
    panel.style.display='flex';
    chev.style.transform='rotate(90deg)';
    sheets.style.maxHeight='120px';
    sheets.style.overflow='auto';
    fmRender();
  } else {
    panel.style.display='none';
    chev.style.transform='';
    sheets.style.maxHeight='';
    sheets.style.overflow='';
  }
}

function fmShowTab(tab){
  ['recent','fav','folders'].forEach(t=>{
    $('fm-panel-'+t).style.display=t===tab?'':'none';
    $('fm-tab-'+t).className='fm-tab'+(t===tab?' fm-tab-on':'');
  });
  fmRender();
}

function fmRender(){
  const list=_fmLoad();
  const folders=_fmLoadFolders();
  const currentFile=T()?.fileName;

  // Recientes
  const rp=$('fm-panel-recent');
  if(rp&&rp.offsetParent!==null){
    rp.innerHTML=list.length?list.map((f,i)=>`
      <div class="fm-item${f.name===currentFile?' fm-active':''}" onclick="fmOpenFile('${ejs(f.name)}')" oncontextmenu="fmCtx(event,${i})">
        <span class="fm-icon" style="color:${f.name===currentFile?'var(--acc-text)':'var(--muted)'}">📄</span>
        <span class="fm-name" title="${eh(f.name)}">${eh(f.name.replace(/\.xlsx?$/i,''))}</span>
        <span class="fm-star${f.fav?' on':''}" onclick="event.stopPropagation();fmToggleFav(${i})" title="Favorito">★</span>
      </div>`).join(''):'<div style="padding:10px 8px;font-size:10px;color:var(--muted);text-align:center">Sin archivos recientes</div>';
  }

  // Favoritos
  const fp=$('fm-panel-fav');
  if(fp&&fp.offsetParent!==null){
    const favs=list.filter(f=>f.fav);
    fp.innerHTML=favs.length?favs.map(f=>{
      const idx=list.findIndex(x=>x.name===f.name);
      return `<div class="fm-item${f.name===currentFile?' fm-active':''}" onclick="fmOpenFile('${ejs(f.name)}')" oncontextmenu="fmCtx(event,${idx})">
        <span class="fm-icon" style="color:#f59e0b">★</span>
        <span class="fm-name" title="${eh(f.name)}">${eh(f.name.replace(/\.xlsx?$/i,''))}</span>
        <span class="fm-meta">${_fmTimeAgo(f.date)}</span>
      </div>`;
    }).join(''):'<div style="padding:10px 8px;font-size:10px;color:var(--muted);text-align:center">Marca archivos con ★</div>';
  }

  // Carpetas
  const flp=$('fm-panel-folders');
  if(flp&&flp.offsetParent!==null){
    let html=folders.map((folder,fi)=>{
      const files=list.filter(f=>f.folder===folder.name);
      return `<div>
        <div class="fm-folder" onclick="fmToggleFolderOpen(${fi})" oncontextmenu="fmFolderCtx(event,${fi})">
          <span style="font-size:13px;color:${folder.color||'#f59e0b'}">📁</span>
          <span class="fm-name">${eh(folder.name)}</span>
          <span class="fm-meta">${files.length}</span>
          <span style="font-size:10px;color:var(--muted)">${folder._open?'▾':'▸'}</span>
        </div>
        <div class="fm-folder-files${folder._open?' open':''}">
          ${files.length?files.map(f=>{
            const idx=list.findIndex(x=>x.name===f.name);
            return `<div class="fm-item" onclick="fmOpenFile('${ejs(f.name)}')" style="padding:3px 8px">
              <span class="fm-icon" style="font-size:12px;color:var(--muted)">📄</span>
              <span class="fm-name" style="font-size:10px">${eh(f.name.replace(/\.xlsx?$/i,''))}</span>
            </div>`;
          }).join(''):'<div style="padding:4px 8px;font-size:9px;color:var(--muted);font-style:italic">Vacia</div>'}
        </div>
      </div>`;
    }).join('');
    // Sin carpeta
    const unassigned=list.filter(f=>!f.folder);
    if(unassigned.length){
      html+=`<div style="margin-top:4px;padding:4px 0;border-top:1px solid var(--border)">
        <div style="padding:2px 8px;font-size:9px;color:var(--muted)">Sin carpeta (${unassigned.length})</div>
        ${unassigned.slice(0,5).map(f=>{
          const idx=list.findIndex(x=>x.name===f.name);
          return `<div class="fm-item" onclick="fmOpenFile('${ejs(f.name)}')" oncontextmenu="fmCtx(event,${idx})" style="padding:3px 8px">
            <span class="fm-icon" style="font-size:12px">📄</span>
            <span class="fm-name" style="font-size:10px">${eh(f.name.replace(/\.xlsx?$/i,''))}</span>
          </div>`;
        }).join('')}
      </div>`;
    }
    flp.innerHTML=html||'<div style="padding:10px 8px;font-size:10px;color:var(--muted);text-align:center">Crea una carpeta para organizar</div>';
  }
}

function _fmTimeAgo(ts){
  const d=Date.now()-ts;
  if(d<3600000) return Math.round(d/60000)+'m';
  if(d<86400000) return Math.round(d/3600000)+'h';
  if(d<604800000) return Math.round(d/86400000)+'d';
  return new Date(ts).toLocaleDateString();
}

function fmToggleFav(idx){
  const list=_fmLoad();
  if(list[idx]) list[idx].fav=!list[idx].fav;
  _fmSave(list);
  fmRender();
}

function fmOpenFile(name){
  // Clic en reciente: abre selector de archivo, el usuario escoge el archivo
  const inp=document.createElement('input');
  inp.type='file';inp.accept='.xlsx,.xls';
  inp.onchange=()=>{
    if(!inp.files.length) return;
    processFile(inp.files[0]);
  };
  toast(`Selecciona "${name}" desde tu equipo`);
  inp.click();
}

function fmNewFolder(){
  const name=prompt('Nombre de la nueva carpeta:');
  if(!name||!name.trim()) return;
  const folders=_fmLoadFolders();
  const colors=['#f59e0b','#3b82f6','#10b981','#8b5cf6','#ef4444','#06b6d4'];
  folders.push({name:name.trim(),color:colors[folders.length%colors.length],_open:false});
  _fmSaveFolders(folders);
  fmShowTab('folders');
  fmRender();
}

function fmToggleFolderOpen(fi){
  const folders=_fmLoadFolders();
  if(folders[fi]) folders[fi]._open=!folders[fi]._open;
  _fmSaveFolders(folders);
  fmRender();
}

function fmMoveToFolder(fileIdx,folderName){
  const list=_fmLoad();
  if(list[fileIdx]) list[fileIdx].folder=folderName;
  _fmSave(list);
  _fmCloseCtx(); _tabCloseCtx();
  fmRender();
}

function fmRemoveFile(idx){
  const list=_fmLoad();
  list.splice(idx,1);
  _fmSave(list);
  _fmCloseCtx();
  fmRender();
}

// Context menu
function fmCtx(e,idx){
  e.preventDefault(); e.stopPropagation();
  _fmCloseCtx();
  const list=_fmLoad();
  const f=list[idx]; if(!f) return;
  const folders=_fmLoadFolders();

  const menu=document.createElement('div');
  menu.id='fm-ctx-menu';
  menu.className='fm-ctx';
  menu.style.left=e.clientX+'px';
  menu.style.top=e.clientY+'px';

  let html=`<div class="fm-ctx-item" onclick="fmToggleFav(${idx});_fmCloseCtx()">${f.fav?'☆ Quitar favorito':'★ Marcar favorito'}</div>`;
  if(folders.length){
    html+=`<div style="padding:3px 12px;font-size:9px;color:var(--muted);border-top:1px solid var(--border);margin-top:2px;padding-top:5px">Mover a carpeta:</div>`;
    folders.forEach(fl=>{
      html+=`<div class="fm-ctx-item" onclick="fmMoveToFolder(${idx},'${ejs(fl.name)}')">📁 ${eh(fl.name)}</div>`;
    });
    if(f.folder) html+=`<div class="fm-ctx-item" onclick="fmMoveToFolder(${idx},null)">↩ Sin carpeta</div>`;
  }
  html+=`<div style="border-top:1px solid var(--border);margin-top:2px"></div>`;
  html+=`<div class="fm-ctx-item danger" onclick="fmRemoveFile(${idx})">🗑 Eliminar del historial</div>`;
  menu.innerHTML=html;

  document.body.appendChild(menu);
  // Clamp to viewport
  const r=menu.getBoundingClientRect();
  if(r.right>window.innerWidth) menu.style.left=(window.innerWidth-r.width-8)+'px';
  if(r.bottom>window.innerHeight) menu.style.top=(window.innerHeight-r.height-8)+'px';
  setTimeout(()=>document.addEventListener('mousedown',_fmCloseCtxHandler,{once:true}),10);
}

function fmFolderCtx(e,fi){
  e.preventDefault(); e.stopPropagation();
  _fmCloseCtx();
  const folders=_fmLoadFolders();
  const f=folders[fi]; if(!f) return;
  const menu=document.createElement('div');
  menu.id='fm-ctx-menu';
  menu.className='fm-ctx';
  menu.style.left=e.clientX+'px';
  menu.style.top=e.clientY+'px';
  menu.innerHTML=`
    <div class="fm-ctx-item" onclick="fmRenameFolder(${fi})">✏️ Renombrar</div>
    <div class="fm-ctx-item danger" onclick="fmDeleteFolder(${fi})">🗑 Eliminar carpeta</div>`;
  document.body.appendChild(menu);
  setTimeout(()=>document.addEventListener('mousedown',_fmCloseCtxHandler,{once:true}),10);
}

function fmRenameFolder(fi){
  _fmCloseCtx();
  const folders=_fmLoadFolders();
  const f=folders[fi]; if(!f) return;
  const name=prompt('Nuevo nombre:',f.name);
  if(!name||!name.trim()) return;
  const oldName=f.name;
  f.name=name.trim();
  _fmSaveFolders(folders);
  // Update files in that folder
  const list=_fmLoad();
  list.forEach(file=>{ if(file.folder===oldName) file.folder=f.name; });
  _fmSave(list);
  fmRender();
}

function fmDeleteFolder(fi){
  _fmCloseCtx();
  const folders=_fmLoadFolders();
  const f=folders[fi]; if(!f) return;
  // Unassign files
  const list=_fmLoad();
  list.forEach(file=>{ if(file.folder===f.name) file.folder=null; });
  _fmSave(list);
  folders.splice(fi,1);
  _fmSaveFolders(folders);
  fmRender();
}

function _fmCloseCtx(){ const m=$('fm-ctx-menu'); if(m) m.remove(); }
function _fmCloseCtxHandler(e){ const m=$('fm-ctx-menu'); if(m&&!m.contains(e.target)) _fmCloseCtx(); else if(m) setTimeout(()=>document.addEventListener('mousedown',_fmCloseCtxHandler,{once:true}),10); }

// ── BÚSQUEDAS RECIENTES ───────────────────────────────────────────────────────
const RECENT_SEARCH_KEY = 'mirador_recent_searches_v1';
const RECENT_COLORS = [
  {bg:'#3b82f611',border:'#3b82f633',text:'#60a5fa'},
  {bg:'#10b98111',border:'#10b98133',text:'#34d399'},
  {bg:'#8b5cf611',border:'#8b5cf633',text:'#a78bfa'},
  {bg:'#f59e0b11',border:'#f59e0b33',text:'#fbbf24'},
  {bg:'#ef444411',border:'#ef444433',text:'#f87171'},
  {bg:'#ec489911',border:'#ec489933',text:'#f472b6'},
];
let _recentFadeTimers = {};

function _getRecentSearches(){ try{return JSON.parse(localStorage.getItem(RECENT_SEARCH_KEY)||'[]')}catch{return[]} }
function _saveRecentSearches(arr){ localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(arr)); }

function _addRecentSearch(q){
  if(!q||q.length<2) return;
  if(!_isRecentEnabled()) return;
  let arr=_getRecentSearches();
  arr=arr.filter(r=>r.q!==q); // dedup
  arr.unshift({q, ts:Date.now(), color:arr.length%RECENT_COLORS.length});
  arr=arr.slice(0,8); // max 8
  _saveRecentSearches(arr);
  _renderRecentSearches();
// Restore recent-save toggle state
setTimeout(()=>{ const chk=$('chk-recent'); if(chk) chk.checked=_isRecentEnabled(); },50);
}

function _toggleRecentSave(){
  const chk=$('chk-recent');
  if(!chk) return;
  localStorage.setItem('mirador_recent_enabled', chk.checked?'1':'0');
}

function _isRecentEnabled(){
  // Default ON
  return localStorage.getItem('mirador_recent_enabled')!=='0';
}

function _renderRecentSearches(){
  const wrap=$('search-recents'); if(!wrap) return;
  const arr=_getRecentSearches();
  if(!arr.length){ wrap.classList.remove('has-items'); wrap.innerHTML=''; return; }
  wrap.classList.add('has-items');
  wrap.innerHTML=arr.map((r,i)=>{
    const col=RECENT_COLORS[r.color||0];
    const age=Date.now()-r.ts;
    // Fade based on age: fresh=1, 1hr=0.85, 6hr=0.65, 24hr=0.4, 48hr=0.2
    const opacity=Math.max(0.15, 1 - age/172800000); // 48h to fully faded
    return `<span class="search-recent" data-idx="${i}" 
      style="background:${col.bg};border-color:${col.border};color:${col.text};opacity:${opacity.toFixed(2)}"
      onclick="_applyRecentSearch(${i})"
      title="Buscar: ${r.q}"
      >${r.q} <span style="opacity:.5;font-size:10px" onclick="event.stopPropagation();_deleteRecentSearch(${i})">×</span></span>`;
  }).join('');
}

function _applyRecentSearch(idx){
  const arr=_getRecentSearches();
  const r=arr[idx]; if(!r) return;
  const si=$('search-input'); if(!si) return;
  si.value=r.q;
  si.dispatchEvent(new Event('input'));
  // Bump to top
  _addRecentSearch(r.q);
}

function _deleteRecentSearch(idx){
  let arr=_getRecentSearches();
  arr.splice(idx,1);
  _saveRecentSearches(arr);
  _renderRecentSearches();
}

function _onSearchKey(e){
  if(e.key==='Enter'){
    const val=($('search-input').value||'').trim();
    if(val.length>=2) _addRecentSearch(val);
  }
  if(e.key==='Escape'){
    $('search-input').value='';
    $('search-input').dispatchEvent(new Event('input'));
  }
}

// Configurable: clear all recent searches
function clearRecentSearches(){
  localStorage.removeItem(RECENT_SEARCH_KEY);
  _renderRecentSearches();
  toast('Búsquedas recientes borradas');
}

// ── SIDEBAR HOVER / PIN ───────────────────────────────────────────────────────
const SIDEBAR_PIN_KEY = 'mirador_sidebar_pin_v1';
let _sidebarHideTimer = null;

function _sidebarInit(){
  const sb = $('sidebar');
  if(!sb) return;
  // Restore pinned state
  if(localStorage.getItem(SIDEBAR_PIN_KEY)==='1') sb.classList.add('pinned');

  sb.addEventListener('mouseenter', ()=>_sidebarReveal(true));
  sb.addEventListener('mouseleave', ()=>_sidebarReveal(false));
}

function _sidebarReveal(show){
  const sb=$('sidebar'); if(!sb) return;
  if(sb.classList.contains('pinned')) return; // pinned = always open
  clearTimeout(_sidebarHideTimer);
  if(show){
    sb.classList.add('hovered');
  } else {
    _sidebarHideTimer = setTimeout(()=>sb.classList.remove('hovered'), 300);
  }
}

function _sidebarTogglePin(){
  const sb=$('sidebar'); const btn=$('sidebar-pin'); if(!sb||!btn) return;
  const isPinned = sb.classList.toggle('pinned');
  sb.classList.remove('hovered');
  btn.classList.toggle('on', isPinned);
  btn.title = isPinned ? 'Desfijar panel' : 'Fijar panel';
  btn.textContent = isPinned ? '📍' : '📌';
  localStorage.setItem(SIDEBAR_PIN_KEY, isPinned?'1':'0');
}

// ── BREADCRUMB ────────────────────────────────────────────────────────────────
function updateBreadcrumb(){
  const tab=T();
  const bc=$('topbar-breadcrumb');
  if(!tab||!tab.rawData.length){if(bc)bc.style.display='none';return}
  if(bc) bc.style.display='flex';
  const fn=$('tb-filename'); const sn=$('tb-sheetname'); const ri=$('tb-rowinfo');
  const fileLabel=(tab.fileName||'').replace(/\.xlsx?$/i,'');
  const sheetLabel=tab.activeSheet||'';
  if(fn) fn.textContent=fileLabel;
  if(sn) sn.textContent=sheetLabel;
  const vis=tab.filtered.length, total=tab.rawData.length;
  if(ri) ri.textContent=`${vis.toLocaleString()} de ${total.toLocaleString()}`;
  if(bc) bc.title=`${fileLabel} / ${sheetLabel} — ${vis.toLocaleString()} de ${total.toLocaleString()}`;
}

// ── VISTAS / GRÁFICO (stubs para botones de toolbar) ────────────────────────
function openViewsPanel(){
  renderViewsList();
  window._lockModalViewport?.();
  $('fav-overlay').classList.add('open');
  window.scheduleOverlayCheck?.();
}

// ── GRÁFICAS ──────────────────────────────────────────────────────────────────
const CHART_COLORS=['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#84cc16','#f97316','#ec4899','#14b8a6','#a855f7','#eab308','#6366f1','#22c55e','#fb923c'];

function openGraphPanel(){
  const tab=T(); if(!tab||!tab.rawData.length){toast('Carga datos primero');return;}
  // Populate column selector with categorical cols (unique <= CHIP_LIMIT)
  if(!tab.colUniques) precalcColStats(tab);
  const sel=$('chart-col');
  const catCols=tab.columns.filter(c=>(tab.colUniques[c]?.size||0)>=2&&(tab.colUniques[c]?.size||0)<=200);
  sel.innerHTML='<option value="">— seleccionar columna —</option>'+catCols.map(c=>`<option value="${eh(c)}">${eh(c)}</option>`).join('');
  // Pre-select first reasonable col
  if(catCols.length) sel.value=catCols[0];
  $('chart-overlay').style.display='flex';
  renderChart();
}
function closeGraphPanel(){
  $('chart-overlay').style.display='none';
  const canvas=$('chart-canvas');
  if(canvas){ const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height); }
}

function renderChart(){
  const tab=T(); if(!tab) return;
  const col=$('chart-col').value;
  const type=$('chart-type').value;
  const topN=parseInt($('chart-top').value)||0;
  const order=$('chart-order').value;
  const canvas=$('chart-canvas');
  const empty=$('chart-empty');
  const summary=$('chart-summary');

  if(!col){ canvas.style.display='none'; empty.style.display='block'; summary.innerHTML=''; return; }
  canvas.style.display='block'; empty.style.display='none';

  // Count values from filtered rows
  const counts={};
  tab.filtered.forEach(i=>{
    const r=tab.rawData[i]; if(!r) return;
    const v=(r[col]||'(vacío)').toString().trim()||'(vacío)';
    counts[v]=(counts[v]||0)+1;
  });

  let entries=Object.entries(counts);
  if(order==='desc') entries.sort((a,b)=>b[1]-a[1]);
  else if(order==='asc') entries.sort((a,b)=>a[1]-b[1]);
  else entries.sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
  const total=entries.reduce((s,[,v])=>s+v,0);
  if(topN>0&&entries.length>topN) entries=entries.slice(0,topN);

  const labels=entries.map(([k])=>k);
  const values=entries.map(([,v])=>v);
  const colors=entries.map((_,i)=>CHART_COLORS[i%CHART_COLORS.length]);

  const isPie=type==='pie'||type==='donut';
  const isHBar=type==='hbar';

  // Size canvas
  const containerW=canvas.parentElement.clientWidth-32;
  const containerH=Math.min(460,Math.max(260,window.innerHeight-280));
  canvas.width=containerW;
  canvas.height=containerH;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);

  const isDark=document.documentElement.dataset.theme==='dark'||!document.documentElement.dataset.theme;
  const textColor=getComputedStyle(document.documentElement).getPropertyValue('--text').trim()||'#e2e8f0';
  const mutedColor=getComputedStyle(document.documentElement).getPropertyValue('--muted').trim()||'#94a3b8';
  const gridColor=getComputedStyle(document.documentElement).getPropertyValue('--border').trim()||'#334155';

  ctx.font='12px '+getComputedStyle(document.documentElement).getPropertyValue('--font');

  if(isPie){
    drawPieChart(ctx,canvas,labels,values,colors,type==='donut',textColor,mutedColor);
  } else if(isHBar){
    drawHBarChart(ctx,canvas,labels,values,colors,textColor,mutedColor,gridColor);
  } else {
    drawBarChart(ctx,canvas,labels,values,colors,textColor,mutedColor,gridColor);
  }

  summary.innerHTML=`<span>Total filas: <strong style="color:var(--acc-text)">${tab.filtered.length.toLocaleString()}</strong></span><span>Valores únicos: <strong style="color:var(--acc-text)">${Object.keys(counts).length}</strong></span>${topN&&Object.keys(counts).length>topN?`<span style="color:var(--warn)">Mostrando top ${topN}</span>`:''}`;
}

function drawBarChart(ctx,canvas,labels,values,colors,tc,mc,gc){
  const W=canvas.width, H=canvas.height;
  const pad={t:20,r:20,b:70,l:55};
  const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
  const max=Math.max(...values,1);
  let barW=Math.max(8,Math.min(50,(cW/labels.length)*0.7));
  let gap=(cW-(barW*labels.length))/(labels.length+1);
  if(gap<2){barW=Math.max(4,(cW/(labels.length+1))*0.7); gap=Math.max(1,(cW-barW*labels.length)/(labels.length+1));}

  // Grid lines
  ctx.strokeStyle=gc; ctx.lineWidth=0.5;
  for(let i=0;i<=5;i++){
    const y=pad.t+cH-(cH*i/5);
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+cW,y);ctx.stroke();
    ctx.fillStyle=mc; ctx.font='10px sans-serif'; ctx.textAlign='right';
    ctx.fillText(Math.round(max*i/5).toLocaleString(),pad.l-4,y+3);
  }

  // Bars
  labels.forEach((lbl,i)=>{
    const x=pad.l+gap+i*(barW+gap);
    const bH=Math.max(2,(values[i]/max)*cH);
    const y=pad.t+cH-bH;
    ctx.fillStyle=colors[i];
    // Rounded top
    ctx.beginPath();
    const r=Math.min(4,barW/2);
    ctx.moveTo(x+r,y); ctx.lineTo(x+barW-r,y);
    ctx.quadraticCurveTo(x+barW,y,x+barW,y+r);
    ctx.lineTo(x+barW,y+bH); ctx.lineTo(x,y+bH);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.fill();
    // Value label
    ctx.fillStyle=tc; ctx.font='10px sans-serif'; ctx.textAlign='center';
    if(bH>16) ctx.fillText(values[i],x+barW/2,y-4);
    // X label
    ctx.save(); ctx.translate(x+barW/2,pad.t+cH+8); ctx.rotate(-Math.PI/4);
    ctx.fillStyle=mc; ctx.textAlign='right'; ctx.font='10px sans-serif';
    const maxLbl=12;
    ctx.fillText(lbl.length>maxLbl?lbl.slice(0,maxLbl)+'…':lbl,0,0);
    ctx.restore();
  });
}

function drawHBarChart(ctx,canvas,labels,values,colors,tc,mc,gc){
  const W=canvas.width, H=canvas.height;
  const maxLblW=Math.min(150,W*0.3);
  const pad={t:10,r:60,b:10,l:maxLblW+10};
  const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
  const max=Math.max(...values,1);
  const barH=Math.max(8,Math.min(36,cH/labels.length*0.7));
  const gap=(cH-(barH*labels.length))/(labels.length+1);

  labels.forEach((lbl,i)=>{
    const y=pad.t+gap+i*(barH+gap);
    const bW=Math.max(2,(values[i]/max)*cW);
    // Label
    ctx.fillStyle=mc; ctx.font='11px sans-serif'; ctx.textAlign='right';
    const disp=lbl.length>18?lbl.slice(0,17)+'…':lbl;
    ctx.fillText(disp,pad.l-6,y+barH/2+4);
    // Bar
    ctx.fillStyle=colors[i];
    const r=Math.min(3,barH/2);
    ctx.beginPath();
    ctx.moveTo(pad.l,y+r); ctx.quadraticCurveTo(pad.l,y,pad.l+r,y);
    ctx.lineTo(pad.l+bW-r,y); ctx.quadraticCurveTo(pad.l+bW,y,pad.l+bW,y+r);
    ctx.lineTo(pad.l+bW,y+barH-r); ctx.quadraticCurveTo(pad.l+bW,y+barH,pad.l+bW-r,y+barH);
    ctx.lineTo(pad.l+r,y+barH); ctx.quadraticCurveTo(pad.l,y+barH,pad.l,y+barH-r);
    ctx.fill();
    // Value
    ctx.fillStyle=tc; ctx.font='10px sans-serif'; ctx.textAlign='left';
    ctx.fillText(values[i],pad.l+bW+4,y+barH/2+4);
  });
}

function drawPieChart(ctx,canvas,labels,values,colors,isDonut,tc,mc){
  const W=canvas.width, H=canvas.height;
  const legendW=Math.min(200,W*0.35);
  const cx=(W-legendW)/2, cy=H/2;
  const r=Math.min(cx-10,(H-20)/2);
  const inner=isDonut?r*0.55:0;
  const total=values.reduce((a,b)=>a+b,0);
  let angle=-Math.PI/2;
  const bgStroke=getComputedStyle(document.documentElement).getPropertyValue('--s1')||'#1e293b';

  values.forEach((v,i)=>{
    const sweep=(v/total)*Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,angle,angle+sweep);
    if(inner>0){ ctx.arc(cx,cy,inner,angle+sweep,angle,true); }
    ctx.closePath();
    ctx.fillStyle=colors[i]; ctx.fill();
    ctx.strokeStyle=bgStroke;
    ctx.lineWidth=2; ctx.stroke();
    angle+=sweep;
  });

  // Center label for donut
  if(isDonut){
    ctx.fillStyle=tc; ctx.font=`bold ${Math.round(r*0.22)}px sans-serif`; ctx.textAlign='center';
    ctx.fillText(total.toLocaleString(),cx,cy+4);
    ctx.fillStyle=mc; ctx.font=`${Math.round(r*0.13)}px sans-serif`;
    ctx.fillText('total',cx,cy+r*0.2);
  }

  // Legend
  const lx=W-legendW+8, ly0=Math.max(10,(H-labels.length*20)/2);
  labels.forEach((lbl,i)=>{
    const ly=ly0+i*22;
    if(ly>H-10) return;
    ctx.fillStyle=colors[i];
    ctx.beginPath(); ctx.moveTo(lx+2,ly); ctx.lineTo(lx+10,ly); ctx.quadraticCurveTo(lx+12,ly,lx+12,ly+2); ctx.lineTo(lx+12,ly+10); ctx.quadraticCurveTo(lx+12,ly+12,lx+10,ly+12); ctx.lineTo(lx+2,ly+12); ctx.quadraticCurveTo(lx,ly+12,lx,ly+10); ctx.lineTo(lx,ly+2); ctx.quadraticCurveTo(lx,ly,lx+2,ly); ctx.fill();
    ctx.fillStyle=mc; ctx.font='10px sans-serif'; ctx.textAlign='left';
    const pct=((values[i]/total)*100).toFixed(1)+'%';
    const disp=(lbl.length>16?lbl.slice(0,15)+'…':lbl)+' '+pct;
    ctx.fillText(disp,lx+16,ly+9);
  });
}

// ── FILTROS MÓVIL (barra inferior + panel) ────────────────────────────────────
let _mfChipsMounted = false;
function _isMobileUi(){ return window.innerWidth <= 500; }
function _blurActiveInput(){
  const el=document.activeElement;
  if(!el) return;
  const tag=el.tagName;
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT') el.blur();
}
let _vpRestoreHideTimer=null;
function restoreMobileViewport(){
  _blurActiveInput();
  window.scrollTo({top:0,left:0,behavior:'instant'});
  document.documentElement.scrollTop=0;
  document.body.scrollTop=0;
  ['height','position','top','overflow','width'].forEach(p=>{
    document.documentElement.style.removeProperty(p);
    document.body.style.removeProperty(p);
  });
  $('viewport-restore-btn')?.classList.remove('show');
  _mobileUiRefresh();
}
function _showViewportRestoreBtn(){
  if(!_isMobileUi()) return;
  $('viewport-restore-btn')?.classList.add('show');
}
function _scheduleHideViewportRestoreBtn(){
  clearTimeout(_vpRestoreHideTimer);
  _vpRestoreHideTimer=setTimeout(_checkMobileViewportShift, 450);
}
function _checkMobileViewportShift(){
  const btn=$('viewport-restore-btn');
  if(!btn||!_isMobileUi()){ btn?.classList.remove('show'); return; }
  const vv=window.visualViewport;
  const keyboardOpen=!!vv && (window.innerHeight-vv.height)>120;
  const shifted=window.scrollY>8 || (vv && vv.offsetTop>8);
  if(keyboardOpen||shifted) btn.classList.add('show');
  else btn.classList.remove('show');
}
if(window.visualViewport){
  window.visualViewport.addEventListener('resize', _checkMobileViewportShift);
  window.visualViewport.addEventListener('scroll', _checkMobileViewportShift);
}
window.addEventListener('scroll', _checkMobileViewportShift, {passive:true});
document.addEventListener('focusin', e=>{
  if(!_isMobileUi()) return;
  if(e.target.closest('#login-screen')) return;
  if(e.target.matches('input:not([type=hidden]),textarea,select')) _showViewportRestoreBtn();
}, true);
document.addEventListener('focusout', _scheduleHideViewportRestoreBtn, true);
function _isLoggedIn(){
  const ls=$('login-screen');
  return !ls || ls.classList.contains('hidden');
}
function _colFilterLabel(col, val){
  if(Array.isArray(val)) return val.length===1?val[0]:val.length+' valores';
  if(val==='__NULL__') return 'sin cédula';
  if(val==='__WITH__') return 'con cédula';
  if(typeof val==='string'&&val.startsWith('__CONTAINS__:')) return 'contiene "'+val.slice(13)+'"';
  if(typeof val==='string'&&val.startsWith('__DATE_RANGE__:')) return val.slice(14).split('__TO__:').join(' → ');
  return String(val);
}
function clearChipFiltersOnly(){
  const tab=T(); if(!tab) return;
  tab.colFilters={};
  $('date-from').value=''; $('date-to').value=''; $('date-col').selectedIndex=0;
  closeDropdown();
  if($('chip-search')){ $('chip-search').value=''; onChipSearch(); }
  updateChipStates(); applyFilters();
  _mobileUiRefresh();
}
function _clearLiveSearch(){
  _resetLiveSearchState(T());
  applyFilters();
  _updateSearchClearBtn();
  _updateMobileActiveBar();
}
function _updateSearchClearBtn(){
  const btn=$('btn-search-clear-mobile'); if(!btn) return;
  const q=($('search-input')?.value||'').trim();
  const show=_isMobileUi()&&q;
  btn.style.display=show?'flex':'none';
  btn.classList.toggle('show',show);
}
function _updateMobileBnav(){
  const bnav=$('mobile-bnav'); if(!bnav) return;
  const tab=T();
  const show=_isMobileUi()&&_isLoggedIn();
  bnav.style.display=show?'flex':'none';
  if(!show) return;
  const hasData=!!(tab?.rawData?.length>0);
  $('mbnav-filters')?.classList.toggle('mbnav-no-data',!hasData);
  const n=Object.keys(tab?.colFilters||{}).length;
  const badge=$('mbnav-filter-badge');
  if(badge){
    badge.textContent=n>0?String(n):'';
    badge.classList.toggle('on',n>0);
  }
  _syncPillsToggleBtns();
  $('mbnav-filters')?.classList.toggle('on',$('mobile-filter-overlay')?.classList.contains('open'));
}
function _syncPillsToggleBtns(){
  document.querySelectorAll('#btn-pills-mode,#btn-pills-mode-bnav').forEach(b=>{
    b.classList.toggle('pills-on',!!_pillsOn);
  });
}
function _updateMobileActiveBar(){
  const bar=$('mobile-active-bar'), host=$('mobile-active-pills');
  if(!bar||!host) return;
  if(!_isMobileUi()){ bar.classList.remove('show'); return; }
  const tab=T();
  const parts=[];
  if(tab){
    Object.entries(tab.colFilters||{}).forEach(([col,val])=>{
      parts.push({rm:'col:'+col, html:eh(col)+': '+eh(_colFilterLabel(col,val))});
    });
  }
  if(!parts.length){ bar.classList.remove('show'); return; }
  bar.classList.add('show');
  let h=`<span class="mf-active-count">${parts.length}</span>`;
  parts.forEach(p=>{
    h+=`<span class="mf-apill">${p.html}<button type="button" data-rm="${p.rm}" aria-label="Quitar">×</button></span>`;
  });
  host.innerHTML=h;
  host.querySelectorAll('[data-rm]').forEach(btn=>{
    btn.onclick=()=>{
      const k=btn.dataset.rm;
      if(k.startsWith('col:')) removeColFilter(k.slice(4));
      _updateMobileActiveBar();
    };
  });
}
function _mobileUiRefresh(){
  _updateMobileBnav();
  _updateMobileActiveBar();
  _updateSearchClearBtn();
  _updateSheetsBtn();
}
function _mfSyncOptionsUI(){
  const sc=$('search-col'), mf=$('mf-search-col');
  if(sc&&mf){
    mf.innerHTML=sc.innerHTML; mf.value=sc.value;
    const colOn=!!mf.value && mf.value!=='(Todas las columnas)';
    mf.classList.toggle('on',colOn);
  }
  const rx=$('chk-regex'), mrx=$('mf-chk-regex');
  if(rx&&mrx){ mrx.checked=rx.checked; $('mf-l-regex')?.classList.toggle('on',rx.checked); }
  const ex=$('chk-excl'), mex=$('mf-chk-excl');
  if(ex&&mex){ mex.checked=ex.checked; $('mf-l-excl')?.classList.toggle('on',ex.checked); }
  const tab=T();
  const n=tab?Object.keys(tab.colFilters||{}).length:0;
  const hint=$('mf-active-hint');
  if(hint) hint.textContent=n>0?`${n} filtro${n>1?'s':''} de columna activo${n>1?'s':''}`:'Ningún filtro de columna activo';
}
function mobileFilterColChange(val){
  const sc=$('search-col'); if(sc){ sc.value=val; onSearchColChange(); }
  $('mf-search-col')?.classList.toggle('on',!!val && val!=='(Todas las columnas)');
  _mfSyncOptionsUI();
}
function mobileFilterRegexToggle(on){
  const c=$('chk-regex'); if(c){ c.checked=on; onRegexChange(); }
  $('mf-l-regex')?.classList.toggle('on',on);
  _updateMobileActiveBar();
}
function mobileFilterExclToggle(on){
  const c=$('chk-excl'); if(c){ c.checked=on; applyFilters(); }
  $('mf-l-excl')?.classList.toggle('on',on);
  _updateMobileActiveBar();
}
function _mfMountChips(){
  if(_mfChipsMounted) return;
  const host=$('mf-chips-host'), bar=$('chips-bar'), ref=$('chips-right');
  if(!host||!bar) return;
  [...bar.querySelectorAll('.chip[data-col]')].forEach(ch=>host.appendChild(ch));
  _mfChipsMounted=true;
}
function _mfUnmountChips(){
  if(!_mfChipsMounted) return;
  const host=$('mf-chips-host'), bar=$('chips-bar'), ref=$('chips-right');
  if(!host||!bar) return;
  [...host.querySelectorAll('.chip')].forEach(ch=>bar.insertBefore(ch, ref));
  _mfChipsMounted=false;
}
function openMobileFilterSheet(){
  if(!_isMobileUi()) return;
  _blurActiveInput();
  const tab=T(); if(!tab?.rawData?.length){ toast('Carga datos primero'); return; }
  tab.searchText=$('search-input')?.value??tab.searchText??'';
  const bar=$('chips-bar'), host=$('mf-chips-host');
  const chipCount=bar.querySelectorAll('.chip[data-col]').length+(host?.querySelectorAll('.chip[data-col]').length||0);
  if(chipCount===0) buildChips();
  if(!_mfChipsMounted) _mfMountChips();
  updateChipStates();
  _mfSyncOptionsUI();
  $('mobile-filter-overlay')?.classList.add('open');
  _lockModalViewport();
  scheduleOverlayCheck();
  _updateMobileBnav();
}
function closeMobileFilterSheet(){
  _mfUnmountChips();
  _blurActiveInput();
  $('mobile-filter-overlay')?.classList.remove('open');
  scheduleOverlayCheck?.();
  _updateMobileBnav();
}
window.addEventListener('resize', ()=>{ _mobileUiRefresh(); if(!_isMobileUi()) closeMobileFilterSheet(); });

// ── INICIO ────────────────────────────────────────────────────────────────────
applyTheme(currentTheme);
initChipSearch();
document.body.classList.remove('focus-a','focus-b','focus-c','focus-d','focus-c-revealed');
try{ localStorage.removeItem('mirador_focus_v1'); }catch(_){}
_sidebarInit();
_renderRecentSearches();
_mobileUiRefresh();

// ── MODO PILLS ────────────────────────────────────────────────────────────────
const PILLS_KEY = 'mirador_pills_v1';
let _pillsCfgOn  = false;
let _pillsFichaIdx = 0;
let _pillsFichaOpen = false;
let _pillsFilteredCache = [];

function _pillsShowLoading(show, label){
  const el=$('pills-loading');
  const txt=$('pills-loading-text');
  if(txt && label) txt.textContent=label;
  if(el){
    el.classList.toggle('show',!!show);
    el.setAttribute('aria-busy', show ? 'true' : 'false');
  }
}

function _refreshPillsTabView(){
  refreshActiveView(activeTabId);
}
// Posición original del chips-bar para restaurar al salir de pills mode
let _pillsCbParent = null;
let _pillsCbNext   = null;
let _pillsMfOpen   = false;

// Colores para avatar
function _pillsAvatarColor(s){
  const c=['#1d4ed8','#7c3aed','#0f766e','#b45309','#0e7490','#be185d','#65a30d','#c2410c'];
  let h=0; for(const ch of String(s)) h=(h*31+ch.charCodeAt(0))%c.length; return c[h];
}
function _pillsInitials(s){
  return String(s||'').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase()||'?';
}

// ── TOGGLE PRINCIPAL ──────────────────────────────────────────────────────────
function _resetPillsSurface(){
  if(_pillsOn) _exitPillsMode();
  $('pills-view')?.classList.remove('open');
  const grid=$('pills-grid'); if(grid) grid.innerHTML='';
  const cnt=$('pills-toolbar-count'); if(cnt) cnt.textContent='';
  const pInp=$('pills-search-input'); if(pInp) pInp.value='';
  const da=$('data-area'); if(da) da.style.display='';
  const sb=$('searchbar'); if(sb) sb.style.display='';
}
function _exitPillsMode(){
  if(!_pillsOn) return;
  _pillsOn = false;
  _syncPillsToggleBtns();
  const pv = $('pills-view');
  const da = $('data-area');
  const cb = $('chips-bar');
  pv?.classList.remove('open');
  if(da) da.style.display = '';
  $('searchbar').style.display='';
  $('table-wrap').style.display='flex';
  const psb=$('pills-search-bar'); if(psb) psb.style.display='';
  if(_pillsCbParent && cb){
    cb.classList.remove('pills-mode','chips-collapsed');
    cb.style.display = '';
    _pillsCbParent.insertBefore(cb, _pillsCbNext);
    _pillsCbParent = null; _pillsCbNext = null;
  } else if(cb) {
    cb.style.display = '';
  }
  if(_pillsFichaOpen) pillsCloseFicha();
}
function togglePillsMode(){
  if(_pillsOn){ closeMobileFilterSheet(); _exitPillsMode(); _mobileUiRefresh(); return; }
  closeMobileFilterSheet();
  _pillsOn = true;
  _syncPillsToggleBtns();
  const pv = $('pills-view');
  const da = $('data-area');
  const cb = $('chips-bar');
  const isMobile = window.innerWidth <= 500;

  pv.classList.add('open');
    da.style.display = 'none';
    const psb=$('pills-search-bar');
    $('searchbar').style.display='none';
    if(psb) psb.style.display='flex';

    if(cb){
      // Mover chips-bar dentro de pills-view (reutiliza toda la lógica de filtros)
      _pillsCbParent = cb.parentNode;
      _pillsCbNext   = cb.nextSibling;
      cb.classList.add('pills-mode');
      if(isMobile){
        cb.classList.add('chips-collapsed'); // móvil: oculto por defecto, toggle via botón
        _pillsMfOpen = false;
        _pillsUpdateFilterBtn();
      } else {
        cb.classList.remove('chips-collapsed'); // desktop: siempre visible
      }
      cb.style.display = '';
      pv.insertBefore(cb, $('pills-search-bar'));
    }

    buildChips();
    _syncPillsSearchUI(T());
    if(T()?.rawData?.length) refreshActiveView(activeTabId);
    else _pillsShowLoading(false);
  _mobileUiRefresh();
}

function pillsToggleMobileFilter(){
  const cb = $('chips-bar');
  if(!cb) return;
  _pillsMfOpen = !_pillsMfOpen;
  cb.classList.toggle('chips-collapsed', !_pillsMfOpen);
  _pillsUpdateFilterBtn();
}

function _pillsUpdateFilterBtn(){
  const btn = $('pills-filter-btn');
  const lbl = $('pills-filter-label');
  if(!btn || !lbl) return;
  const tab = T();
  const n = Object.keys(tab?.colFilters||{}).length;
  lbl.textContent = n > 0 ? `Filtros (${n})` : 'Filtros';
  btn.classList.toggle('on', n > 0 || _pillsMfOpen);
}

// ── POBLAR SELECTORES CON COLUMNAS REALES ────────────────────────────────────
// Busca la primera columna que coincida con alguno de los patrones (case-insensitive)
function _pillsFindCol(cols, patterns){
  for(const p of patterns){
    const r = new RegExp(p,'i');
    const found = cols.find(c=>r.test(c));
    if(found) return found;
  }
  return null;
}

function _pillsPopulateSelectors(){
  const tab = T(); if(!tab||!tab.columns) return;
  const cols = tab.columns;
  const saved = _pillsLoadCfg();

  const selMain = $('pills-sel-main');
  const selSec  = $('pills-sel-sec');
  if(!selMain||!selSec) return;

  const opts = cols.map(c=>`<option value="${eh(c)}">${eh(c)}</option>`).join('');
  selMain.innerHTML = opts;
  selSec.innerHTML  = opts;

  // Defaults inteligentes si no hay configuración guardada
  const smartMain = _pillsFindCol(cols,['c[eé]dula','id','rut','codigo','code','dni','nit']);
  const smartSec  = _pillsFindCol(cols,['nombre.apell','apell.*nombre','nombre','name','empleado','funcionario']);

  const tabSel = tab._pillsSel;
  const savedMain = tabSel?.main || saved?.main;
  const savedSec  = tabSel?.sec  || saved?.sec;

  selMain.value = (savedMain && cols.includes(savedMain)) ? savedMain : (smartMain || cols[0]);
  selSec.value  = (savedSec  && cols.includes(savedSec))  ? savedSec  : (smartSec  || (cols[1]||cols[0]));

  // Color por: columnas con pocos únicos (≤20) o primera columna
  const colorSel = $('pills-sel-color');
  colorSel.innerHTML = '<option value="none">Sin color</option>';
  cols.forEach(c=>{
    const uniq = new Set((tab.rawData||[]).slice(0,300).map(r=>r[c]||'')).size;
    if(uniq<=20) colorSel.innerHTML += `<option value="${eh(c)}">${eh(c)}</option>`;
  });
  const savedColor = tabSel?.color || saved?.color;
  if(savedColor && (savedColor==='none' || cols.includes(savedColor))) colorSel.value = savedColor;

  // Avatar: mismas opciones que main/sec, default = campo de nombre
  const avatarSel = $('pills-sel-avatar');
  if(avatarSel){
    avatarSel.innerHTML = opts;
    const smartAvatar = _pillsFindCol(cols,['nombre.apell','apell.*nombre','nombre','name','empleado','funcionario']);
    const savedAvatar = tabSel?.avatar || saved?.avatar;
    avatarSel.value = (savedAvatar && cols.includes(savedAvatar)) ? savedAvatar : (smartAvatar || selSec.value || cols[0]);
  }

  // Diseño: restaurar o default d7
  const designSel = $('pills-sel-design');
  if(designSel){
    const savedDesign = tabSel?.design || saved?.design;
    designSel.value = (savedDesign && savedDesign !== 'd7') ? savedDesign : 'd1';
  }

  tab._pillsSel={
    main:selMain.value, sec:selSec.value, color:colorSel.value,
    avatar:avatarSel?.value||'', design:designSel?.value||'d1',
  };
}

function _pillsLoadCfg(){ try{ return JSON.parse(localStorage.getItem(PILLS_KEY)||'null'); }catch(_){return null;} }
function _pillsSaveCfg(){
  try{ localStorage.setItem(PILLS_KEY, JSON.stringify({
    main:$('pills-sel-main')?.value,
    sec:$('pills-sel-sec')?.value,
    color:$('pills-sel-color')?.value,
    avatar:$('pills-sel-avatar')?.value,
    design:$('pills-sel-design')?.value
  })); }catch(_){}
}

function pillsResetDefaults(){
  localStorage.removeItem(PILLS_KEY);
  _pillsPopulateSelectors();
  renderPillsView();
  toast('Configuración restablecida');
}

function pillsToggleConfig(){
  _pillsCfgOn = !_pillsCfgOn;
  $('pills-cfg-panel').style.display = _pillsCfgOn ? 'flex' : 'none';
  $('pills-cfg-btn').classList.toggle('on', _pillsCfgOn);
}

// ── RENDER PILLS ──────────────────────────────────────────────────────────────
function renderPillsView(){
  const tab = T(); if(!tab) return;
  _pillsSaveCfg();

  const cols = tab.columns || [];
  let mk = $('pills-sel-main')?.value;
  let sk = $('pills-sel-sec')?.value;
  const ck = $('pills-sel-color')?.value;
  const ak = $('pills-sel-avatar')?.value || sk || mk;
  const design = $('pills-sel-design')?.value || 'd7';

  if(!mk || !cols.includes(mk)) mk = cols[0] || '';
  if(!sk || !cols.includes(sk)) sk = cols[1] || cols[0] || '';

  const rows = (tab.filtered||[]).map(i=>tab.rawData[i]).filter(Boolean);
  _pillsFilteredCache = rows;

  const activeFilters = Object.keys(tab.colFilters||{}).length;
  const total = tab.rawData?.length || 0;
  const countTxt = rows.length.toLocaleString() + ' registros' +
    (activeFilters ? ` <span style="color:var(--acc-text);font-size:10px">(filtrado de ${total.toLocaleString()})</span>` : '');
  $('pills-toolbar-count').innerHTML = countTxt;

  const palette=['#22c55e','#f59e0b','#f87171','#60a5fa','#c084fc','#34d399','#fb923c','#a78bfa'];
  let colorMap = {};
  if(ck && ck!=='none'){
    const uniqVals=[...new Set(rows.map(r=>r[ck]||''))];
    uniqVals.forEach((v,i)=>{ colorMap[v]=palette[i%palette.length]; });
  }

  // Iniciales de avatar (2 letras del campo principal)
  function initials(str){ const w=String(str||'').trim().split(/\s+/); return w.length>=2?(w[0][0]+w[w.length-1][0]).toUpperCase():(str||'?')[0].toUpperCase(); }
  // Color de avatar determinista por valor
  const avPalette=['#7c3aed','#2563eb','#059669','#b45309','#be123c','#0e7490','#7c3aed','#6d28d9'];
  function avColor(str){ let h=0; for(let c of String(str||'')) h=(h*31+c.charCodeAt(0))&0xffff; return avPalette[h%avPalette.length]; }

  const grid = $('pills-grid');
  // Clases de layout por diseño
  grid.className = '';
  if(design==='d3'){ grid.classList.add('pg-wrap'); }
  else if(design==='d7'){ grid.classList.add('pg-col','pg-glass-bg'); }
  else { grid.classList.add('pg-col'); }

  grid.innerHTML = rows.map((r,i)=>{
    const main = (mk && r[mk]) ? r[mk] : (cols[0]?r[cols[0]]:'—');
    const sec  = (sk && sk!==mk && r[sk]) ? String(r[sk]) : '';
    const avSrc = (ak && r[ak]) ? String(r[ak]) : (sec || main);
    const dotColor = (ck&&ck!=='none') ? (colorMap[r[ck]||'']||'#475569') : null;

    if(design==='d7'){
      const av = avColor(avSrc);
      const init = initials(avSrc);
      const badgeVal = dotColor ? eh(String(r[ck]||'')) : '';
      return `<div class="mpill-d7" onclick="pillsOpenFicha(${i})">
        <div class="pg-glyph" style="background:${av}">${init}</div>
        <div class="pg-body">
          <div class="pg-name">${eh(main)}</div>
          ${sec?`<div class="pg-sub">${eh(sec)}</div>`:''}
        </div>
        ${badgeVal?`<div class="pg-right"><div class="pg-badge" style="background:${dotColor}22;color:${dotColor};border:1px solid ${dotColor}44">${badgeVal}</div></div>`:''}
      </div>`;
    }
    if(design==='d1'){
      const av = avColor(avSrc);
      const init = initials(avSrc);
      const accentColor = dotColor || av;
      const badge = dotColor ? `<div class="pd-badge" style="background:${dotColor}22;color:${dotColor};border:1px solid ${dotColor}44">${eh(String(r[ck]||''))}</div>` : '';
      return `<div class="mpill-d1" onclick="pillsOpenFicha(${i})" style="background:linear-gradient(to right,${accentColor}18 0%,var(--s1) 45%);border-color:${accentColor}33">
        <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:${accentColor};border-radius:14px 0 0 14px"></div>
        <div class="pd-avatar" style="background:${av};box-shadow:0 0 0 3px ${av}44">${init}</div>
        <div class="pd-body">
          <div class="pd-id">${eh(mk)} · ${eh(main)}</div>
          <div class="pd-name">${eh(sec||main)}</div>
        </div>
        ${badge}
      </div>`;
    }
    if(design==='d2'){
      const dot = `<div class="pl-dot" style="background:${dotColor||'var(--border)'}"></div>`;
      const tagVal = dotColor ? eh(String(r[ck]||'')) : '';
      const tagHtml = tagVal ? `<div class="pl-tag" style="background:${dotColor}22;color:${dotColor}">${tagVal}</div>` : '';
      return `<div class="mpill-d2" onclick="pillsOpenFicha(${i})">
        ${dot}
        <div class="pl-body">
          <div class="pl-name">${eh(sec||main)}</div>
          <div class="pl-id">${eh(mk)}: ${eh(main)}</div>
        </div>
        ${tagHtml}
      </div>`;
    }
    if(design==='d3'){
      const av = avColor(avSrc);
      const init = initials(avSrc);
      const borderColor = dotColor ? `border-color:${dotColor}44` : '';
      return `<div class="mpill-d3" onclick="pillsOpenFicha(${i})" style="${borderColor}">
        <div class="pc-av" style="background:${av}">${init}</div>
        <div class="pc-body">
          <div class="pc-name">${eh(sec||main)}</div>
          <div class="pc-id">${eh(main)}</div>
        </div>
      </div>`;
    }
    if(design==='d5'){
      const av = avColor(avSrc);
      const init = initials(avSrc);
      const tagVal = dotColor ? eh(String(r[ck]||'')) : '';
      const tags = tagVal ? `<span class="pt-tag" style="background:${dotColor}22;color:${dotColor};border:1px solid ${dotColor}44">${tagVal}</span>` : '';
      const trackColor = dotColor || av;
      return `<div class="mpill-d5" onclick="pillsOpenFicha(${i})">
        <div class="pt-circle" style="background:${av};box-shadow:0 0 0 3px ${av}44,0 2px 8px ${av}33">${init}</div>
        <div class="pt-body" style="border-left-color:${trackColor}44">
          <div class="pt-name">${eh(sec||main)}</div>
          <div class="pt-meta">${eh(mk)}: ${eh(main)}</div>
          ${tags?`<div class="pt-tags">${tags}</div>`:''}
        </div>
      </div>`;
    }
    // fallback: chip original
    const dotHtml = dotColor ? `<span class="mpill-dot" style="background:${dotColor}"></span>` : '';
    return `<div class="mpill" onclick="pillsOpenFicha(${i})">${dotHtml}<span class="mpill-main">${eh(main)}</span>${sec?`<span class="mpill-sec">${eh(sec)}</span>`:''}</div>`;
  }).join('');
}

// ── FICHA ─────────────────────────────────────────────────────────────────────
function pillsOpenFicha(i){
  _blurActiveInput();
  _pillsFichaIdx = i; _pillsFichaOpen = true;
  _pillsRenderFicha();
  _lockModalViewport();
  $('pills-ficha-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  scheduleOverlayCheck();
}

function _pillsRenderFicha(){
  const tab = T(); if(!tab) return;
  const r = _pillsFilteredCache[_pillsFichaIdx]; if(!r) return;
  const cols = tab.columns;

  // Header
  const mainKey = $('pills-sel-main')?.value || cols[0];
  const mainVal = r[mainKey]||'—';
  const secKey  = $('pills-sel-sec')?.value;
  const secVal  = secKey&&secKey!==mainKey ? (r[secKey]||'') : '';
  const col     = _pillsAvatarColor(mainVal);

  $('pf-avatar').textContent   = _pillsInitials(mainVal);
  $('pf-avatar').style.background = `linear-gradient(135deg,${col},${col}99)`;
  $('pf-name').textContent     = mainVal;
  $('pf-sub').textContent      = secVal;
  $('pf-counter').textContent  = `${_pillsFichaIdx+1} / ${_pillsFilteredCache.length}`;
  $('pf-btn-prev').disabled    = _pillsFichaIdx===0;
  $('pf-btn-next').disabled    = _pillsFichaIdx===_pillsFilteredCache.length-1;

  // Body — todos los campos
  $('pf-body').innerHTML = `
    <div class="pf-section">Todos los campos</div>
    ${cols.map(c=>{
      const v = r[c]||'';
      return `<div class="pf-field">
        <span class="pf-key">${eh(c)}</span>
        <span class="pf-val${!v?' empty':''}">${v ? eh(v) : 'Sin información'}</span>
      </div>`;
    }).join('')}`;
  $('pf-body').scrollTop = 0;
}

function pillsNavigate(dir){
  const n = _pillsFichaIdx + dir;
  if(n<0||n>=_pillsFilteredCache.length) return;
  _pillsFichaIdx = n; _pillsRenderFicha();
}

function pillsCloseFicha(){
  _pillsFichaOpen = false;
  $('pills-ficha-overlay').classList.remove('open');
  document.body.style.overflow = '';
  scheduleOverlayCheck();
}
function pillsFichaOverlayClick(e){ if(e.target===$('pills-ficha-overlay')) pillsCloseFicha(); }

// Swipe gestures en móvil
(function(){
  let sx=0, sy=0;
  const panel = $('pills-ficha-panel');
  panel.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;},{passive:true});
  panel.addEventListener('touchend',e=>{
    const dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy;
    if(Math.abs(dy)>Math.abs(dx)&&dy>60){pillsCloseFicha();return;}
    if(Math.abs(dx)>50&&Math.abs(dy)<60){ dx<0?pillsNavigate(1):pillsNavigate(-1); }
  },{passive:true});
})();

// Teclado
document.addEventListener('keydown',e=>{
  if(!_pillsFichaOpen) return;
  if(e.key==='Escape') pillsCloseFicha();
  if(e.key==='ArrowRight'||e.key==='ArrowDown') pillsNavigate(1);
  if(e.key==='ArrowLeft' ||e.key==='ArrowUp')   pillsNavigate(-1);
});

// ── Icono hoja Excel (verde) ─────────────────────────────────────────────────
function _excelSheetIcon(size){
  const s=size||20, c='#217346';
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="2" width="18" height="20" rx="2" fill="${c}" opacity=".18"/><rect x="3" y="2" width="18" height="20" rx="2" stroke="${c}" stroke-width="1.4"/><path d="M3 8h18M8 8v14" stroke="${c}" stroke-width="1.1" opacity=".75"/><rect x="10" y="11" width="9" height="2" rx=".5" fill="${c}"/><rect x="10" y="15" width="7" height="2" rx=".5" fill="${c}" opacity=".65"/><rect x="10" y="19" width="8" height="2" rx=".5" fill="${c}" opacity=".45"/></svg>`;
}

// ── Modal selector de hojas ──────────────────────────────────────────────────
function openMobileSheets(){
  const tab = T();
  const overlay = $('mobile-sheets-overlay');
  const list    = $('ms-list');
  const title   = $('ms-title');
  const subtitle= $('ms-subtitle');
  const headerIcon = $('ms-header-icon');
  if(!overlay || !list) return;

  if(headerIcon) headerIcon.innerHTML = _excelSheetIcon(24);

  if(!tab || !tab.sheets || !tab.sheets.length){
    if(title) title.textContent = 'Hojas del archivo';
    if(subtitle) subtitle.textContent = 'Abre un archivo .xlsx primero';
    list.innerHTML = '<div class="ms-empty">📂 Abre un archivo Excel para ver sus hojas aquí</div>';
  } else {
    const sheetCount = tab.sheets.length;
    const fileLabel = (tab.fileName || 'Archivo').replace(/\.[^.]+$/,'');
    if(title) title.textContent = fileLabel;
    if(subtitle) subtitle.textContent = `${sheetCount} hoja${sheetCount===1?'':'s'} · selecciona la activa`;

    const hdrRow = tab._manualHdrRow != null ? tab._manualHdrRow - (tab._hdrRangeStart||0) + 1 : null;
    const hdrInfo = hdrRow != null
      ? `<div class="ms-hdr-banner manual">
           <span class="ms-hdr-banner-label">${_excelSheetIcon(14)} Encabezado en fila <strong>${hdrRow}</strong></span>
           <button type="button" class="ms-hdr-banner-btn" onclick="closeMobileSheets();setTimeout(reopenHdrPicker,0)">Cambiar</button>
         </div>`
      : `<div class="ms-hdr-banner">
           <span class="ms-hdr-banner-label">Encabezado auto-detectado</span>
           <button type="button" class="ms-hdr-banner-btn" onclick="closeMobileSheets();setTimeout(reopenHdrPicker,0)">Ajustar</button>
         </div>`;

    const items = tab.sheets.map((n,i)=>{
      const active = tab.activeSheet===n;
      return `<button type="button" class="ms-item${active?' active':''}" onclick="loadSheet('${ejs(n)}',null,false);closeMobileSheets();_updateSheetsBtn()">
        <span class="ms-item-icon">${_excelSheetIcon(20)}</span>
        <span class="ms-item-body">
          <span class="ms-item-name">${eh(n)}</span>
          <span class="ms-item-meta">${active?'Hoja activa':'Hoja '+(i+1)}</span>
        </span>
        <span class="ms-item-check">${active?'✓':''}</span>
      </button>`;
    }).join('');

    list.innerHTML = hdrInfo + `<div class="ms-items">${items}</div>`;
  }
  _lockModalViewport();
  overlay.classList.add('open');
  scheduleOverlayCheck();
}
function closeMobileSheets(){
  $('mobile-sheets-overlay')?.classList.remove('open');
  scheduleOverlayCheck();
}
function _updateSheetsBtn(){
  const tab = T();
  const sheetsBtn = $('btn-mobile-sheets');
  const lbl = $('btn-sheets-label');
  const badge = $('btn-sheets-badge');
  const count = tab?.sheets?.length || 0;
  // Visible on all viewports when the active tab has sheet names (incl. multi-tab)
  const show = !!tab && count > 0;
  if(sheetsBtn) sheetsBtn.style.display = show ? 'inline-flex' : 'none';
  if(lbl) lbl.textContent = 'Hojas';
  if(badge){
    if(count > 1){
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
}

// ── PANEL DE ACCIONES ────────────────────────────────────────────────────────
function toggleActionsPanel(){
  const p=$('actions-panel');
  if(!p) return;
  if(p.classList.contains('open')){ closeActionsPanel(); return; }
  _blurActiveInput();
  closeMobileFilterSheet();

  // Actualizar header del usuario
  _updateActionsPanelUserHeader();

  // Sincronizar disabled de cada item con el botón oculto correspondiente
  [['ap-graph','btn-graph'],['ap-cond','btn-cond'],['ap-cols','btn-cols'],
   ['ap-export','btn-export'],['ap-export-all','btn-export-all'],['ap-refresh','btn-refresh']
  ].forEach(([ap,btn])=>{ const a=$$(ap),b=$$(btn); if(a&&b) a.disabled=b.disabled; });
  const scBtn=$('btn-save-cloud'), apSc=$('ap-save-cloud');
  if(scBtn&&apSc) apSc.style.display=scBtn.style.display;

  const overlay = $('actions-panel-overlay');
  p.style.left=''; p.style.top=''; p.style.right=''; p.style.width='';
  if(overlay) overlay.style.display = 'block';
  _lockModalViewport();
  p.classList.add('open');
  scheduleOverlayCheck();
  setTimeout(()=>document.addEventListener('click',_closeActionsPanelOutside,{once:true}),10);
}
function closeActionsPanel(){
  $('actions-panel')?.classList.remove('open');
  const overlay = $('actions-panel-overlay');
  if(overlay) overlay.style.display = 'none';
}
function _closeActionsPanelOutside(e){
  const p=$('actions-panel');
  if(p&&!p.contains(e.target)&&e.target.id!=='btn-actions') closeActionsPanel();
  else if(p?.classList.contains('open')) setTimeout(()=>document.addEventListener('click',_closeActionsPanelOutside,{once:true}),10);
}

// Mostrar botones de archivo cuando hay datos cargados
function _showFileActions(){
  $('btn-export').style.display='';
  _updateSheetsBtn();
  if(typeof _fbUser !== 'undefined' && _fbUser){
    const sc=$('btn-save-cloud'); if(sc) sc.style.display='';
    const apSc=$('ap-save-cloud'); if(apSc) apSc.style.display='';
  }
  // Habilitar items del menú móvil
  ['mm-export','mm-graph','mm-cond','mm-cols','mm-refresh'].forEach(id=>{
    const el=$(id); if(el) el.disabled=false;
  });
}

// ── MENÚ MÓVIL ───────────────────────────────────────────────────────────────
function toggleMobileMenu(){
  const m=$('mobile-menu'); if(!m) return;
  m.classList.toggle('open');
  if(m.classList.contains('open')){
    // Sincronizar estado disabled
    const sync=[['mm-graph','btn-graph'],['mm-cond','btn-cond'],['mm-cols','btn-cols'],
                ['mm-export','btn-export'],['mm-refresh','btn-refresh']];
    sync.forEach(([mm,btn])=>{ const b=$$(mm),s=$$(btn); if(b&&s) b.disabled=s.disabled; });
    setTimeout(()=>document.addEventListener('click',_closeMobileMenuOutside,{once:true}),10);
  }
}
function $$(id){return document.getElementById(id);}
function closeMobileMenu(){ $('mobile-menu')?.classList.remove('open'); }
function _closeMobileMenuOutside(e){ if(!$('mobile-menu')?.contains(e.target)) closeMobileMenu(); }

// ── BÚSQUEDA PROPIA DEL MODO PILLS ───────────────────────────────────────────
let _pillsSearchTimer = null;

function pillsOnSearch(val){
  clearTimeout(searchTimer);
  const tab=T();
  if(tab){ tab.pillsSearchText=val; if(!val) tab.searchIndex=null; }

  const clr = $('pills-search-clear');
  if(clr) clr.style.display = val ? 'block' : 'none';

  const inp = $('pills-search-input');
  if(inp) inp.style.borderColor = val ? 'var(--acc)' : 'var(--border)';

  clearTimeout(_pillsSearchTimer);
  _pillsSearchTimer = setTimeout(()=>{
    applyFilters();
    _updateMobileActiveBar();
    _updateSearchClearBtn();
  }, SEARCH_DELAY);
}

function pillsClearSearch(){
  _resetLiveSearchState(T());
  applyFilters();
  _updateMobileActiveBar();
  _updateSearchClearBtn();
}

// Sincronizar el pills-search-input cuando se activa el modo pills
const _origTogglePillsMode = togglePillsMode;
togglePillsMode = function(){
  _origTogglePillsMode.apply(this, arguments);
  if(_pillsOn){
    _blurActiveInput();
  } else {
    const inp = $('pills-search-input');
    if(inp) inp.value = '';
    $('searchbar').style.display = '';
  }
};

// Mostrar botones de archivo si hay sesión restaurada (también tras _bootSessionRestore)

// ── Inline handler globals (auto-generated by scripts/split-phase0.mjs) ──
const __miradorGlobals = {
  $,
  $$,
  CHART_COLORS,
  CHIP_LIMIT,
  DETAIL_STYLE_KEY,
  FAV_KEY,
  FM_FOLDERS_KEY,
  FM_KEY,
  HDR_PREVIEW_ROWS,
  HDR_SCAN_ROWS,
  MAX_SESSION,
  NOTES_KEY,
  PILLS_KEY,
  RECENT_COLORS,
  RECENT_SEARCH_KEY,
  RE_ISO_DATE,
  SEARCH_DELAY,
  SESSION_IDB,
  SESSION_IDB_STORE,
  SESSION_KEY,
  SIDEBAR_PIN_KEY,
  T,
  TAB_COLORS,
  TAB_CTX_COLORS,
  THEMES,
  THEME_KEY,
  VT_BUFFER,
  VT_ROW_H,
  WORKBOOK_IDB_PREFIX,
  _EXCEL_EXTS,
  _activeSearchText,
  _addRecentSearch,
  _applyExpandedCols,
  _applyFilterLikeRow,
  _applyRecentSearch,
  _applySavedSession,
  _applySavedSessionAsync,
  _blurActiveInput,
  _bootSessionRestore,
  _cacheSheetData,
  _cdpChipEl,
  _cdpCol,
  _cdpOutsideHandler,
  _checkMobileViewportShift,
  _clearChipSearch,
  _clearLiveSearch,
  _closeActionsPanelOutside,
  _closeMobileMenuOutside,
  _colFilterLabel,
  _ctxCol,
  _deleteRecentSearch,
  _detailIdx,
  _detailStyle,
  _doReload,
  _excelSheetIcon,
  _exitPillsMode,
  _exportFallback,
  _extractSheetDataFromHeaderRow,
  _fileLoadFailed,
  _flrRefreshLabel,
  _flushSessionSave,
  _fmCloseCtx,
  _fmCloseCtxHandler,
  _fmLoad,
  _fmLoadFolders,
  _fmOpen,
  _fmSave,
  _fmSaveFolders,
  _fmTimeAgo,
  _frzLeftMap,
  _getRecentSearches,
  _hdrPicker,
  _hdrRowForSheet,
  _hideFileActions,
  _highlightChipText,
  _isLoggedIn,
  _isMobileUi,
  _isRecentEnabled,
  _lastComboCols,
  _lastComboTab,
  _loadSheetFromCache,
  _mfChipsMounted,
  _mfMountChips,
  _mfSyncOptionsUI,
  _mfUnmountChips,
  _mobileUiRefresh,
  _onSearchKey,
  _openHdrPickerForTab,
  _origApplyFilters,
  _origTogglePillsMode,
  _pillsAvatarColor,
  _pillsCbNext,
  _pillsCbParent,
  _pillsCfgOn,
  _pillsFichaIdx,
  _pillsFichaOpen,
  _pillsFilteredCache,
  _pillsFindCol,
  _pillsInitials,
  _pillsLoadCfg,
  _pillsMfOpen,
  _pillsOn,
  _pillsPopulateSelectors,
  _pillsRenderFicha,
  _pillsSaveCfg,
  _pillsSearchTimer,
  _pillsShowLoading,
  _pillsUpdateFilterBtn,
  _processSheetData,
  _promptTabXlsx,
  _pvClear,
  _pvToggle,
  _readWorkbookFromFile,
  _recentFadeTimers,
  _refreshPillsTabView,
  _refreshTimers,
  _renderRecentSearches,
  _resetLiveSearchState,
  _resetPillsSurface,
  _restoreWorkbooksFromIdb,
  _saveRecentSearches,
  _scheduleHideViewportRestoreBtn,
  _sessionBuildData,
  _sessionClearIdb,
  _sessionClearWorkbooks,
  _sessionCompactSheetCache,
  _sessionCompactTab,
  _sessionOpenIdb,
  _sessionReadAll,
  _sessionReadEmergency,
  _sessionReadIdb,
  _sessionReadLocal,
  _sessionReadWorkbook,
  _sessionWriteEmergency,
  _sessionWriteIdb,
  _sessionWriteWorkbook,
  _showFileActions,
  _showHdrToast,
  _showViewportRestoreBtn,
  _sidebarHideTimer,
  _sidebarInit,
  _sidebarReveal,
  _sidebarTogglePin,
  _syncDataAreaView,
  _syncDataViewAfterLoad,
  _syncLiveSearchFields,
  _syncPillsSearchUI,
  _syncPillsToggleBtns,
  _syncSearchInputFromTab,
  _tabBuildViewState,
  _tabCloseCtx,
  _tabCtx,
  _tabCtxOutside,
  _tabFileDot,
  _tabFileExt,
  _tabIsFav,
  _tabRemoveView,
  _tabSaveView,
  _tabSetColor,
  _tabToggleFav,
  _toastTimer,
  _toggleRecentSave,
  _updateChipsBadge,
  _updateClearChipBtn,
  _updateMobileActiveBar,
  _updateMobileBnav,
  _updateSearchClearBtn,
  _updateSheetsBtn,
  _visibleChipsInOneLine,
  _vpRestoreHideTimer,
  _vtBuildRow,
  _vtLastEnd,
  _vtLastStart,
  _vtOnScroll,
  _vtRAF,
  _vtRenderVisible,
  _vtRowHeights,
  _vtRowTap,
  _vtTotalH,
  _workbookIdbKey,
  activeTabId,
  addCondRule,
  applyCondRules,
  applyDateChipFilter,
  applyDateColSelection,
  applyFilters,
  applyTheme,
  autoDetectHeaderAndApply,
  buildChips,
  buildDateColCombo,
  buildFilterSummary,
  buildSearchCombo,
  cancelHdrPicker,
  cdpClearAll,
  cdpInvert,
  cdpSelectAll,
  cdpSetSpec,
  cdpToggleVal,
  clearChipFiltersOnly,
  clearDateChipFilter,
  clearFilters,
  clearPanelFilter,
  clearRecentSearches,
  clearStoredSession,
  closeActionsPanel,
  closeColPanel,
  closeCondModal,
  closeDateColPanel,
  closeDetail,
  closeDropdown,
  closeFavModal,
  closeGraphPanel,
  closeMobileFilterSheet,
  closeMobileMenu,
  closeMobileSheets,
  closeTab,
  closeThemeModal,
  confirmHdrPicker,
  copyDetailRow,
  copyFiltered,
  copySelection,
  copyText,
  createTab,
  ctxCopyCol,
  ctxFilter,
  ctxFreeze,
  ctxHide,
  ctxSort,
  currentTheme,
  debounce,
  deleteFavorite,
  detectBestHeaderRow,
  drawBarChart,
  drawHBarChart,
  drawPieChart,
  eh,
  ejs,
  el,
  enableControls,
  exportAllTabs,
  exportExcel,
  filterLikeRow,
  fmCtx,
  fmDeleteFolder,
  fmFolderCtx,
  fmMoveToFolder,
  fmNewFolder,
  fmOpenFile,
  fmRegisterFile,
  fmRemoveFile,
  fmRenameFolder,
  fmRender,
  fmShowTab,
  fmToggleFav,
  fmToggleFolderOpen,
  fmtCell,
  fmtDate,
  getFavs,
  getNotes,
  getRegexFlags,
  initChipSearch,
  jumpToHdrRow,
  lastClick,
  loadFavorite,
  loadSheet,
  mobileFilterColChange,
  mobileFilterExclToggle,
  mobileFilterRegexToggle,
  navigateDetail,
  onChipSearch,
  onDragOver,
  onDrop,
  onPillClick,
  onRegexChange,
  onSearch,
  onSearchColChange,
  openCdpPanel,
  openColMenu,
  openColPanel,
  openCondModal,
  openDateChipPanel,
  openDateColPanel,
  openDetail,
  openFavModal,
  openFileForFav,
  openFilePicker,
  openFileTab,
  openGraphPanel,
  openHdrPicker,
  openMobileFilterSheet,
  openMobileSheets,
  openPanelAllValues,
  openRefreshModal,
  openSessionPanel,
  openStatsPanelPicker,
  openThemeModal,
  openViewsPanel,
  pillsClearSearch,
  pillsCloseFicha,
  pillsFichaOverlayClick,
  pillsNavigate,
  pillsOnSearch,
  pillsOpenFicha,
  pillsResetDefaults,
  pillsToggleConfig,
  pillsToggleMobileFilter,
  precalcColStats,
  processFile,
  promptSessionRestore,
  refreshActiveView,
  reloadTab,
  removeColFilter,
  removeStatsPanel,
  renderCdpContent,
  renderChart,
  renderCondRules,
  renderDetailBody,
  renderFavList,
  renderHdrPreview,
  renderNoteTab,
  renderPillsView,
  renderSheetsSidebar,
  renderTable,
  renderTabs,
  renderThemeGrid,
  renderViewsList,
  reopenHdrPicker,
  restoreMobileViewport,
  restoreSession,
  restoreSessionAsync,
  restoreTabUI,
  safe,
  saveFavorite,
  saveNote,
  saveNoteFromPanel,
  saveSession,
  saveSessionDebounced,
  scrollToHdrRow,
  searchTimer,
  selectHdrRow,
  setAllCols,
  setAutoRefresh,
  setDetailStyle,
  setFavs,
  setSelectValue,
  setStatus,
  showDropzone,
  sortBy,
  switchD1Tab,
  switchD3Tab,
  switchTab,
  tabCounter,
  tabs,
  toast,
  toggleActionsPanel,
  toggleChipDropdown,
  toggleChipsBar,
  toggleColExpand,
  toggleColVisibility,
  toggleFilesSidebar,
  toggleMobileMenu,
  togglePillsMode,
  toggleRegexFlagsPanel,
  toggleRow,
  toggleStatsPanel,
  updateActiveTabCount,
  updateBreadcrumb,
  updateChipStates,
  updateStats,
  updateStatusBar,
};
for (const [key, val] of Object.entries(__miradorGlobals)) {
  if (val !== undefined) window[key] = val;
}

