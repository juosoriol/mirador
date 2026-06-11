export const NOTES_KEY = 'mirador_notes_v1';

/**
 * Read all notes from localStorage.
 * @param {Storage} [storage]
 */
export function readNotesFromStorage(storage = globalThis.localStorage) {
  if (!storage) return {};
  try {
    return JSON.parse(storage.getItem(NOTES_KEY) || '{}');
  } catch {
    return {};
  }
}

/**
 * Save notes dict back to localStorage.
 * @param {Record<string, unknown>} notes
 * @param {Storage} [storage]
 */
export function writeNotesToStorage(notes, storage = globalThis.localStorage) {
  if (!storage) return;
  storage.setItem(NOTES_KEY, JSON.stringify(notes));
}

/**
 * Get a note by key (usually cédula or name).
 * @param {string} key
 * @param {Storage} [storage]
 */
export function getNoteForKey(key, storage = globalThis.localStorage) {
  const notes = readNotesFromStorage(storage);
  return notes[key] || '';
}

/**
 * Save or delete a note.
 * @param {string} key
 * @param {string} value (empty string = delete)
 * @param {Storage} [storage]
 */
export function saveNoteForKey(key, value, storage = globalThis.localStorage) {
  const notes = readNotesFromStorage(storage);
  if (value && value.trim()) {
    notes[key] = value.trim();
  } else {
    delete notes[key];
  }
  writeNotesToStorage(notes, storage);
}

/**
 * Build note tab HTML for detail panel.
 * @param {string} key The note identifier (cédula, name, etc.)
 * @param {string} currentNote The current note text (may be empty)
 * @param {(s: unknown) => string} eh Escape function
 */
export function buildNoteTabHtml(key, currentNote, eh) {
  return `<div style="padding:0 0 8px;font-size:11px;color:var(--muted)">Nota para: <strong style="color:var(--text)">${eh(key)}</strong></div>${currentNote ? `<div class="saved-note">${eh(currentNote)}</div>` : ''}<textarea class="note-area" id="note-area-input" placeholder="Escribe una nota...">${eh(currentNote)}</textarea><div style="display:flex;justify-content:flex-end;margin-top:7px"><button class="da-btn p" onclick="saveNoteFromPanel('${key.replace(/'/g, "\\'")}')">${'\u{1F4BE}'} Guardar nota</button></div>`;
}
