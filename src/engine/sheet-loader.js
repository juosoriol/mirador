/** Rows scanned when auto-detecting header row. */
export const DEFAULT_HDR_SCAN_ROWS = 50;

/**
 * @param {import('xlsx').WorkBook} workbook
 * @returns {string[]}
 */
export function getVisibleSheetNames(workbook) {
  const meta = workbook.Workbook?.Sheets || [];
  const visible = workbook.SheetNames.filter((_, i) => {
    const m = meta[i];
    return !m || !m.Hidden;
  });
  return visible.length ? visible : [...workbook.SheetNames];
}

/**
 * Autodetect best header row in first `scanRows` rows of the sheet.
 * @param {object} ws - XLSX worksheet
 * @param {object} range - decoded range
 * @param {number} [scanRows]
 */
export function detectBestHeaderRow(ws, range, scanRows = DEFAULT_HDR_SCAN_ROWS) {
  const colCount = range.e.c - range.s.c + 1;
  let bestRow = range.s.r;
  let bestScore = -1;

  for (let r = range.s.r; r < Math.min(range.s.r + scanRows, range.e.r + 1); r++) {
    let filled = 0;
    let textCells = 0;
    let numCells = 0;
    const uniqueVals = new Set();
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell || cell.v === undefined || String(cell.v).trim() === '') continue;
      filled++;
      uniqueVals.add(String(cell.v).trim().toLowerCase());
      if (typeof cell.v === 'string') textCells++;
      else numCells++;
    }
    if (filled === 0) continue;
    const fillRatio = filled / colCount;
    const textRatio = textCells / filled;
    const uniqueRatio = uniqueVals.size / filled;
    const score = fillRatio * 0.4 + textRatio * 0.35 + uniqueRatio * 0.25 - (numCells / filled) * 0.3;
    if (score > bestScore && fillRatio >= 0.3) {
      bestScore = score;
      bestRow = r;
    }
  }
  return bestRow;
}

/**
 * Read sheet using row `hRow` as column headers; data starts at hRow + 1.
 * @param {object} ws
 * @param {object} range
 * @param {number} hRow
 */
export function extractSheetDataFromHeaderRow(ws, range, hRow) {
  const r0 = range.s.r;
  const r1 = range.e.r;
  const c0 = range.s.c;
  const c1 = range.e.c;
  const hdrRow = Math.max(r0, Math.min(hRow, r1));
  const colCount = c1 - c0 + 1;
  let emptyIdx = 0;
  const seen = {};
  const columns = [];

  for (let ci = 0; ci < colCount; ci++) {
    const cell = ws[XLSX.utils.encode_cell({ r: hdrRow, c: c0 + ci })];
    let name = cell != null && cell.v != null ? String(cell.v).trim() : '';
    if (!name) {
      name = emptyIdx === 0 ? '__EMPTY' : `__EMPTY_${emptyIdx}`;
      emptyIdx++;
    }
    if (seen[name] != null) {
      seen[name]++;
      name = `${name}_${seen[name]}`;
    } else {
      seen[name] = 0;
    }
    columns.push(name);
  }

  const raw = [];
  for (let r = hdrRow + 1; r <= r1; r++) {
    const row = {};
    let hasData = false;
    for (let ci = 0; ci < colCount; ci++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: c0 + ci })];
      const v = cell != null && cell.v != null ? cell.v : '';
      if (v !== '' && v != null) hasData = true;
      row[columns[ci]] = v;
    }
    if (hasData) raw.push(row);
  }

  return { columns, raw, hdrRow };
}

function excelSerialToIso(n, isBirthCol, parseDateCode) {
  try {
    const minSerial = isBirthCol ? 10959 : 29221;
    const minYear = isBirthCol ? 1930 : 1980;
    if (n < minSerial || n > 73050) return null;
    const d = parseDateCode?.(n);
    if (!d || !d.y || d.y < minYear || d.y > 2100) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  } catch {
    return null;
  }
}

/**
 * Normalize raw cell values (dates, numbers) into display/filter-friendly strings.
 * @param {Array<Record<string, unknown>>} raw
 * @param {string[]} columns
 * @param {{ parseDateCode?: (n: number) => { y: number, m: number, d: number }|null, manualDateCols?: string[] }} [opts]
 */
export function normalizeSheetData(raw, columns, opts = {}) {
  const { parseDateCode = null, manualDateCols = null } = opts;
  const dateColNames = new Set(
    columns.filter((c) => /fecha|date|nacimiento|ingreso|reintegro|retiro|posesi|^f_/i.test(c))
  );
  const birthColNames = new Set(columns.filter((c) => /nacimiento|birth|nac\b/i.test(c)));

  const rawData = raw.map((row) => {
    const o = {};
    for (const col of columns) {
      const v = row[col];
      if (v == null || v === undefined) {
        o[col] = '';
        continue;
      }
      if (typeof v === 'number') {
        if (dateColNames.has(col)) {
          const iso = excelSerialToIso(v, birthColNames.has(col), parseDateCode);
          if (iso) {
            o[col] = iso;
            continue;
          }
        }
        o[col] = Number.isInteger(v) ? String(v) : (Math.round(v * 100) / 100).toString();
        continue;
      }
      const s = String(v).trim();
      const mIso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (mIso && parseInt(mIso[1], 10) >= 1930) {
        o[col] = `${mIso[1]}-${mIso[2].padStart(2, '0')}-${mIso[3].padStart(2, '0')}`;
        continue;
      }
      if (dateColNames.has(col)) {
        const mDmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        if (mDmy) {
          const day = parseInt(mDmy[1], 10);
          const month = parseInt(mDmy[2], 10);
          const year = parseInt(mDmy[3], 10);
          if (year >= 1930 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            o[col] = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            continue;
          }
        }
      }
      o[col] = s;
    }
    return o;
  });

  let dateColsDetected = detectDateColumns(columns, rawData);
  if (manualDateCols?.length) {
    dateColsDetected = [...new Set([...dateColsDetected, ...manualDateCols])];
  }

  return { rawData, dateColsDetected };
}

/** Columns where ≥60% of sample values look like ISO dates (1930–2099). */
export function detectDateColumns(columns, rawData) {
  return columns.filter((c) => {
    const sample = rawData.slice(0, 50).map((r) => r[c]).filter(Boolean);
    if (sample.length < 3) return false;
    const dateMatches = sample.filter((v) => {
      const m = String(v).match(/^(\d{4})-\d{2}-\d{2}/);
      return m && parseInt(m[1], 10) >= 1930 && parseInt(m[1], 10) <= 2099;
    });
    return dateMatches.length / sample.length >= 0.6;
  });
}

/**
 * Full parse pipeline for one worksheet.
 * @param {object} ws
 * @param {object} range
 * @param {number} hRow
 * @param {{ parseDateCode?: Function, manualDateCols?: string[] }} [opts]
 */
export function parseWorksheet(ws, range, hRow, opts = {}) {
  const extracted = extractSheetDataFromHeaderRow(ws, range, hRow);
  const { rawData, dateColsDetected } = normalizeSheetData(extracted.raw, extracted.columns, opts);
  return {
    columns: extracted.columns,
    rawData,
    hdrRow: extracted.hdrRow,
    dateColsDetected,
    isEmpty: rawData.length === 0,
  };
}
