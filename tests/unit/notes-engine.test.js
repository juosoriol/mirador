import { describe, expect, it } from 'vitest';
import {
  NOTES_KEY,
  buildNoteTabHtml,
  getNoteForKey,
  readNotesFromStorage,
  saveNoteForKey,
  writeNotesToStorage,
} from '../../src/engine/notes-engine.js';

function makeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe('notes storage', () => {
  it('reads empty dict when storage is empty', () => {
    const storage = makeStorage();
    expect(readNotesFromStorage(storage)).toEqual({});
  });

  it('parses stored notes and handles corrupt data', () => {
    const storage = makeStorage({ [NOTES_KEY]: '{"a":"note1"}' });
    expect(readNotesFromStorage(storage)).toEqual({ a: 'note1' });

    const badStorage = makeStorage({ [NOTES_KEY]: 'not json' });
    expect(readNotesFromStorage(badStorage)).toEqual({});
  });

  it('writes notes back to storage', () => {
    const storage = makeStorage();
    writeNotesToStorage({ key1: 'text1' }, storage);
    expect(JSON.parse(storage.getItem(NOTES_KEY))).toEqual({ key1: 'text1' });
  });
});

describe('note crud', () => {
  it('reads note by key', () => {
    const storage = makeStorage({ [NOTES_KEY]: '{"id1":"my note"}' });
    expect(getNoteForKey('id1', storage)).toBe('my note');
    expect(getNoteForKey('missing', storage)).toBe('');
  });

  it('saves and deletes notes', () => {
    const storage = makeStorage();
    saveNoteForKey('key1', '  trimmed note  ', storage);
    expect(getNoteForKey('key1', storage)).toBe('trimmed note');

    saveNoteForKey('key1', '', storage);
    expect(getNoteForKey('key1', storage)).toBe('');
  });
});

describe('buildNoteTabHtml', () => {
  const eh = (s) => String(s ?? '').replace(/&/g, '&amp;');

  it('includes key, saved note, and textarea', () => {
    const html = buildNoteTabHtml('person1', 'existing note', eh);
    expect(html).toContain('person1');
    expect(html).toContain('existing note');
    expect(html).toContain('textarea');
  });

  it('escapes the key for onclick', () => {
    const html = buildNoteTabHtml("key'with'quotes", '', eh);
    expect(html).toContain("\\'");
  });
});
