import { describe, expect, it } from 'vitest';
import {
  createFolderEntry,
  deleteFolderAt,
  formatFileDisplayName,
  formatTimeAgo,
  getFavoriteFiles,
  getFilesInFolder,
  getUnassignedFiles,
  moveFileToFolder,
  registerRecentFile,
  removeFileAt,
  renameFolderEntry,
  toggleFileFavorite,
  toggleFolderOpen,
  unassignFilesFromFolder,
} from '../../src/engine/file-manager-engine.js';

describe('formatFileDisplayName', () => {
  it('strips excel extension', () => {
    expect(formatFileDisplayName('report.xlsx')).toBe('report');
    expect(formatFileDisplayName('data.xls')).toBe('data');
  });
});

describe('formatTimeAgo', () => {
  it('formats relative times', () => {
    const now = Date.now();
    expect(formatTimeAgo(now - 5 * 60000, now)).toBe('5m');
    expect(formatTimeAgo(now - 3 * 3600000, now)).toBe('3h');
  });
});

describe('registerRecentFile', () => {
  it('adds new file at front and preserves fav/folder on re-register', () => {
    let list = [{ name: 'old.xlsx', fav: true, folder: 'Work' }];
    list = registerRecentFile(list, 'new.xlsx', 2, 100, 1000);
    expect(list[0].name).toBe('new.xlsx');
    expect(list[0].sheets).toBe(2);

    list = registerRecentFile(list, 'old.xlsx', 1, 50, 2000);
    expect(list[0].name).toBe('old.xlsx');
    expect(list[0].fav).toBe(true);
    expect(list[0].folder).toBe('Work');
    expect(list[0].date).toBe(2000);
  });
});

describe('file list helpers', () => {
  const list = [
    { name: 'a.xlsx', fav: true, folder: 'X' },
    { name: 'b.xlsx', fav: false, folder: null },
    { name: 'c.xlsx', fav: true, folder: 'X' },
  ];

  it('filters favorites, folder files, and unassigned', () => {
    expect(getFavoriteFiles(list)).toHaveLength(2);
    expect(getFilesInFolder(list, 'X')).toHaveLength(2);
    expect(getUnassignedFiles(list)).toHaveLength(1);
  });

  it('toggles favorite, moves folder, removes entry', () => {
    const copy = [...list];
    toggleFileFavorite(copy, 1);
    expect(copy[1].fav).toBe(true);
    moveFileToFolder(copy, 1, 'Y');
    expect(copy[1].folder).toBe('Y');
    removeFileAt(copy, 0);
    expect(copy).toHaveLength(2);
  });
});

describe('folder helpers', () => {
  it('creates, toggles, renames, and deletes folders', () => {
    let folders = [];
    createFolderEntry(folders, 'Work');
    expect(folders[0].name).toBe('Work');
    toggleFolderOpen(folders, 0);
    expect(folders[0]._open).toBe(true);
    const renamed = renameFolderEntry(folders, 0, 'Personal');
    expect(renamed.oldName).toBe('Work');
    expect(renamed.newName).toBe('Personal');
    const deleted = deleteFolderAt(folders, 0);
    expect(deleted.folderName).toBe('Personal');
    expect(folders).toHaveLength(0);
  });

  it('unassigns files when folder deleted', () => {
    const list = [{ name: 'a.xlsx', folder: 'Old' }];
    unassignFilesFromFolder(list, 'Old');
    expect(list[0].folder).toBeNull();
  });
});
