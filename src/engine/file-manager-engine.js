export const FM_MAX_RECENT = 50;

export const FM_FOLDER_COLORS = [
  '#f59e0b',
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
];

/** @param {string|null|undefined} raw */
export function parseFileManagerJson(raw) {
  try {
    return JSON.parse(raw || '[]');
  } catch {
    return [];
  }
}

/** @param {unknown[]} list */
export function serializeFileManagerList(list) {
  return JSON.stringify(list);
}

/**
 * @param {string} storageKey
 * @param {Storage|null|undefined} [storage]
 */
export function readFileListFromStorage(storageKey, storage = globalThis.localStorage) {
  if (!storage) return [];
  return parseFileManagerJson(storage.getItem(storageKey));
}

/**
 * @param {string} storageKey
 * @param {unknown[]} list
 * @param {Storage|null|undefined} [storage]
 */
export function writeFileListToStorage(storageKey, list, storage = globalThis.localStorage) {
  if (!storage) return false;
  storage.setItem(storageKey, serializeFileManagerList(list));
  return true;
}

export function readFoldersFromStorage(storageKey, storage = globalThis.localStorage) {
  return readFileListFromStorage(storageKey, storage);
}

export function writeFoldersToStorage(storageKey, folders, storage = globalThis.localStorage) {
  return writeFileListToStorage(storageKey, folders, storage);
}

/** @param {string} fileName */
export function formatFileDisplayName(fileName) {
  return String(fileName || '').replace(/\.xlsx?$/i, '');
}

/** Relative time label for recent file entries. */
export function formatTimeAgo(ts, now = Date.now()) {
  const d = now - ts;
  if (d < 3600000) return `${Math.round(d / 60000)}m`;
  if (d < 86400000) return `${Math.round(d / 3600000)}h`;
  if (d < 604800000) return `${Math.round(d / 86400000)}d`;
  return new Date(ts).toLocaleDateString();
}

/**
 * Register or bump a file in the recent list (mutates copy-safe if caller clones first).
 * @param {Array<{ name: string, sheets?: number, rows?: number, date?: number, fav?: boolean, folder?: string|null }>} list
 */
export function registerRecentFile(list, fileName, sheetCount = 0, rowCount = 0, now = Date.now()) {
  const existing = list.findIndex((f) => f.name === fileName);
  const entry = {
    name: fileName,
    sheets: sheetCount || 0,
    rows: rowCount || 0,
    date: now,
    fav: existing >= 0 ? list[existing].fav : false,
    folder: existing >= 0 ? list[existing].folder : null,
  };
  if (existing >= 0) list.splice(existing, 1);
  list.unshift(entry);
  if (list.length > FM_MAX_RECENT) list.length = FM_MAX_RECENT;
  return list;
}

/** @param {unknown[]} list @param {number} idx */
export function toggleFileFavorite(list, idx) {
  if (list[idx]) list[idx].fav = !list[idx].fav;
  return list;
}

/** @param {unknown[]} list @param {number} idx @param {string|null} folderName */
export function moveFileToFolder(list, idx, folderName) {
  if (list[idx]) list[idx].folder = folderName;
  return list;
}

/** @param {unknown[]} list @param {number} idx */
export function removeFileAt(list, idx) {
  list.splice(idx, 1);
  return list;
}

/** @param {Array<{ fav?: boolean }>} list */
export function getFavoriteFiles(list) {
  return list.filter((f) => f.fav);
}

/** @param {Array<{ folder?: string|null }>} list @param {string} folderName */
export function getFilesInFolder(list, folderName) {
  return list.filter((f) => f.folder === folderName);
}

/** @param {Array<{ folder?: string|null }>} list */
export function getUnassignedFiles(list) {
  return list.filter((f) => !f.folder);
}

/**
 * @param {Array<{ name: string, color?: string, _open?: boolean }>} folders
 * @param {string} name
 */
export function createFolderEntry(folders, name) {
  folders.push({
    name: name.trim(),
    color: FM_FOLDER_COLORS[folders.length % FM_FOLDER_COLORS.length],
    _open: false,
  });
  return folders;
}

/** @param {Array<{ _open?: boolean }>} folders @param {number} idx */
export function toggleFolderOpen(folders, idx) {
  if (folders[idx]) folders[idx]._open = !folders[idx]._open;
  return folders;
}

/**
 * @param {Array<{ name: string }>} folders
 * @param {number} idx
 * @param {string} newName
 */
export function renameFolderEntry(folders, idx, newName) {
  const folder = folders[idx];
  if (!folder) return { folders, oldName: null, newName: null };
  const oldName = folder.name;
  folder.name = newName.trim();
  return { folders, oldName, newName: folder.name };
}

/**
 * @param {Array<{ name: string }>} folders
 * @param {number} idx
 */
export function deleteFolderAt(folders, idx) {
  const folder = folders[idx];
  if (!folder) return { folders, folderName: null };
  folders.splice(idx, 1);
  return { folders, folderName: folder.name };
}

/** @param {Array<{ folder?: string|null }>} list @param {string} oldName @param {string} newName */
export function reassignFilesOnFolderRename(list, oldName, newName) {
  list.forEach((file) => {
    if (file.folder === oldName) file.folder = newName;
  });
  return list;
}

/** @param {Array<{ folder?: string|null }>} list @param {string} folderName */
export function unassignFilesFromFolder(list, folderName) {
  list.forEach((file) => {
    if (file.folder === folderName) file.folder = null;
  });
  return list;
}

/** @param {Array<{ name: string }>} list @param {string} fileName */
export function findFileIndex(list, fileName) {
  return list.findIndex((f) => f.name === fileName);
}
