/**
 * Factory and mutators for in-memory tab state (one open Excel file).
 * UI/session code in core.js reads/writes these objects.
 */

/** @param {number} id @param {string} fileName @param {string} color */
export function createTabState(id, fileName, color) {
  return {
    id,
    fileName,
    color,
    workbook: null,
    sheets: [],
    activeSheet: null,
    rawData: [],
    columns: [],
    filtered: [],
    selected: new Set(),
    searchIndex: null,
    colUniques: null,
    colNulls: null,
    hiddenCols: new Set(),
    frozenCols: new Set(),
    colFilters: {},
    condRules: [],
    sortCol: null,
    sortDir: 1,
    activeChipCol: null,
    dateColsDetected: [],
    searchText: '',
    pillsSearchText: '',
    searchCol: '',
    dateFrom: '',
    dateTo: '',
    dateCol: '',
  };
}

/**
 * Apply parsed sheet payload onto tab after loadSheet / header picker.
 * @param {ReturnType<typeof createTabState>} tab
 * @param {string} sheetName
 * @param {{ columns: string[], rawData: object[], hdrRow: number, dateColsDetected: string[] }} parsed
 * @param {number} rangeStart - range.s.r for relative row display
 * @param {boolean} preserveFilters
 */
export function applyParsedSheetToTab(tab, sheetName, parsed, rangeStart, preserveFilters) {
  tab._manualHdrRow = parsed.hdrRow;
  tab._hdrRangeStart = rangeStart;
  if (!tab._hdrBySheet) tab._hdrBySheet = {};
  tab._hdrBySheet[sheetName] = { row: parsed.hdrRow, rangeStart };

  tab.columns = parsed.columns;
  tab.rawData = parsed.rawData;
  tab.dateColsDetected = parsed.dateColsDetected;

  if (!preserveFilters) {
    tab.searchText = '';
    tab.searchCol = '';
    tab.dateFrom = '';
    tab.dateTo = '';
    tab.dateCol = '';
  }

  tab.searchIndex = null;
  tab.colUniques = null;
  tab.colNulls = null;

  return {
    rowsSkipped: parsed.hdrRow - rangeStart,
    rowCount: parsed.rawData.length,
    colCount: parsed.columns.length,
  };
}

/** Reset filter/search state when switching sheets without preserve. */
export function resetTabFiltersForNewSheet(tab) {
  tab.colFilters = {};
  tab.condRules = [];
  tab.sortCol = null;
  tab.selected = new Set();
  tab.activeChipCol = null;
}
