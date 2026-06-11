export const SESSION_IDB = 'mirador_session_db';
export const SESSION_IDB_STORE = 'session';
export const WORKBOOK_IDB_PREFIX = 'workbook:';
export const DEFAULT_MAX_SESSION_ROWS = 8000;
export const DEFAULT_EMERGENCY_ROWS = 1500;

export function workbookIdbKey(tabId) {
  return WORKBOOK_IDB_PREFIX + tabId;
}

/** Strip empty columns and cap row count for session persistence. */
export function compactTabForSession(t, maxRows = DEFAULT_MAX_SESSION_ROWS) {
  const raw = t.rawData || [];
  const cols = t.columns || [];
  let keep = cols;
  if (cols.length && raw.length) {
    keep = cols.filter((c) => raw.some((r) => r[c] !== '' && r[c] != null));
    if (!keep.length) keep = cols;
  }
  let compactRaw = raw;
  if (keep.length < cols.length) {
    compactRaw = raw.map((r) => {
      const o = {};
      for (const c of keep) o[c] = r[c] ?? '';
      return o;
    });
  }
  if (compactRaw.length > maxRows) compactRaw = compactRaw.slice(0, maxRows);
  return { columns: keep, rawData: compactRaw };
}

export function compactSheetCacheForSession(cache, maxRows = DEFAULT_MAX_SESSION_ROWS) {
  if (!cache || typeof cache !== 'object') return {};
  const out = {};
  for (const [name, entry] of Object.entries(cache)) {
    if (!entry?.rawData?.length) continue;
    const compact = compactTabForSession(
      { rawData: entry.rawData, columns: entry.columns || [] },
      maxRows
    );
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

export function buildEmergencySessionLite(data, maxRows = DEFAULT_EMERGENCY_ROWS) {
  return {
    activeTabId: data.activeTabId,
    activeName: data.activeName,
    ts: data.ts,
    tabs: (data.tabs || []).map((t) => ({
      ...t,
      rawData: (t.rawData || []).slice(0, maxRows),
    })),
    pillsCfg: data.pillsCfg,
  };
}

export function openSessionDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(SESSION_IDB, 1);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(SESSION_IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function writeWorkbookBuffer(tabId, arrayBuffer) {
  if (!arrayBuffer) return false;
  try {
    const db = await openSessionDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(SESSION_IDB_STORE, 'readwrite');
      tx.objectStore(SESSION_IDB_STORE).put(arrayBuffer, workbookIdbKey(tabId));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    return false;
  }
}

export async function readWorkbookBuffer(tabId) {
  try {
    const db = await openSessionDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(SESSION_IDB_STORE, 'readonly');
      const req = tx.objectStore(SESSION_IDB_STORE).get(workbookIdbKey(tabId));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearWorkbookBuffers(tabIds) {
  const ids = tabIds || [];
  if (!ids.length) return;
  try {
    const db = await openSessionDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SESSION_IDB_STORE, 'readwrite');
      const store = tx.objectStore(SESSION_IDB_STORE);
      ids.forEach((id) => store.delete(workbookIdbKey(id)));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

export function readSessionLocal(sessionKey) {
  try {
    return JSON.parse(localStorage.getItem(sessionKey) || 'null');
  } catch {
    return null;
  }
}

export async function writeSessionJson(sessionKey, json) {
  return openSessionDb().then((db) =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(SESSION_IDB_STORE, 'readwrite');
      tx.objectStore(SESSION_IDB_STORE).put(json, sessionKey);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    })
  );
}

export async function readSessionJson(sessionKey) {
  try {
    const db = await openSessionDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(SESSION_IDB_STORE, 'readonly');
      const req = tx.objectStore(SESSION_IDB_STORE).get(sessionKey);
      req.onsuccess = () => {
        if (!req.result) {
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(req.result));
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearSessionJson(sessionKey) {
  try {
    const db = await openSessionDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SESSION_IDB_STORE, 'readwrite');
      tx.objectStore(SESSION_IDB_STORE).delete(sessionKey);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

export function readSessionEmergency(sessionKey) {
  try {
    return JSON.parse(localStorage.getItem(sessionKey + '_emergency') || 'null');
  } catch {
    return null;
  }
}

export function writeSessionEmergency(sessionKey, data, maxRows = DEFAULT_EMERGENCY_ROWS) {
  const lite = buildEmergencySessionLite(data, maxRows);
  try {
    localStorage.setItem(sessionKey + '_emergency', JSON.stringify(lite));
  } catch {
    /* ignore quota */
  }
}

export async function readBestSession(sessionKey) {
  const local = readSessionLocal(sessionKey);
  if (local && !local._store && local.tabs?.length) return local;
  const idb = await readSessionJson(sessionKey).catch(() => null);
  if (idb?.tabs?.some((t) => t.rawData?.length)) return idb;
  const emerg = readSessionEmergency(sessionKey);
  if (emerg?.tabs?.some((t) => t.rawData?.length)) return emerg;
  if (local && !local._store) return local;
  return null;
}
