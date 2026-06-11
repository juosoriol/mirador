/** @typedef {import('./tab-model.js').TabState} TabState */

export const ID_COLUMN_RE = /^(c[eé]dula|nit|documento|cc|dni|id)$/i;

export const EXCEL_BORDER = { style: 'thin', color: { argb: 'FF000000' } };
export const FULL_BORDER = {
  top: EXCEL_BORDER,
  bottom: EXCEL_BORDER,
  left: EXCEL_BORDER,
  right: EXCEL_BORDER,
};

/** Visible export columns respecting hidden/frozen order. */
export function getExportColumns(tab) {
  const hid = tab.hiddenCols || new Set();
  const frz = tab.frozenCols || new Set();
  const frozenOrder = tab.frozenOrder || [...frz];
  return [
    ...frozenOrder.filter((c) => frz.has(c) && !hid.has(c)),
    ...tab.columns.filter((c) => !frz.has(c) && !hid.has(c)),
  ];
}

/** Columns treated as numeric in Excel (≥70% numeric sample). */
export function detectNumericExportColumns(
  exportCols,
  rawData,
  dateCols = new Set(),
  idRe = ID_COLUMN_RE,
  sampleSize = 150
) {
  const numColSet = new Set();
  exportCols.forEach((col) => {
    if (dateCols.has(col) || idRe.test(String(col).trim())) return;
    let total = 0;
    let numCount = 0;
    for (let k = 0; k < Math.min(rawData.length, sampleSize); k++) {
      const r = rawData[k];
      if (!r) continue;
      const v = r[col];
      if (v === '' || v == null) continue;
      total++;
      const n = Number(v);
      if (!Number.isNaN(n) && String(v).trim() !== '') numCount++;
    }
    if (total >= 3 && numCount / total >= 0.7) numColSet.add(col);
  });
  return numColSet;
}

export function exportCellValue(col, v, numColSet, dateCols = new Set()) {
  if (v === '' || v == null) return null;
  if (dateCols.has(col)) {
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  if (numColSet.has(col)) {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return String(v);
}

export function buildExportDataRows(tab, exportCols) {
  const dateCols = new Set(tab.dateColsDetected || []);
  const numColSet = detectNumericExportColumns(exportCols, tab.rawData, dateCols);
  const toVal = (col, v) => exportCellValue(col, v, numColSet, dateCols);
  const dataRows = (tab.filtered || [])
    .filter((i) => tab.rawData[i])
    .map((i) => exportCols.map((c) => toVal(c, tab.rawData[i][c])));
  return { dataRows, numColSet, dateCols };
}

export function safeExportName(s, maxLen = 50) {
  return (s || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/** Builds download filename for a single tab export. */
export function buildSingleTabExportFileName(tab) {
  const baseName = safeExportName((tab.fileName || 'export').replace(/\.xlsx?$/i, ''));
  const sheetName = safeExportName(tab.activeSheet || 'Datos');
  const date = new Date().toISOString().slice(0, 10);
  return `${baseName}_${sheetName}_${date}.xlsx`.replace(/\s/g, '_');
}

export function uniqueWorksheetName(wb, baseName, attemptStart = 0) {
  let wsName = baseName.replace(/[\\/:*?"<>|]/g, '_').slice(0, 28);
  let attempt = attemptStart;
  while (wb.worksheets.find((s) => s.name === wsName)) {
    wsName = wsName.slice(0, 25) + '_' + ++attempt;
  }
  return wsName;
}

export function columnWidthsForExport(exportCols, dataRows, sampleSize = 300) {
  return exportCols.map((col, ci) => {
    let max = Math.max(col.length, 8);
    dataRows.slice(0, sampleSize).forEach((r) => {
      const v = r[ci];
      if (v == null) return;
      const len = v instanceof Date ? 10 : String(v).length;
      if (len > max) max = len;
    });
    return { width: Math.min(max + 3, 50) };
  });
}

export function styleHeaderRow(hdrRow, exportCols) {
  hdrRow.height = 20;
  exportCols.forEach((_, ci) => {
    const cell = hdrRow.getCell(ci + 1);
    cell.font = { bold: true, name: 'Arial', size: 11, color: { argb: 'FF000000' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFBFBF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
    cell.border = FULL_BORDER;
  });
}

export function styleDataRow(r, rowArr, exportCols, numColSet, rowIndex) {
  r.height = 14;
  const rowBg = rowIndex % 2 === 0 ? 'FFFFFFFF' : 'FFF5F5F5';
  exportCols.forEach((col, ci) => {
    const cell = r.getCell(ci + 1);
    const val = rowArr[ci];
    cell.font = { name: 'Arial', size: 10, color: { argb: 'FF000000' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
    cell.border = FULL_BORDER;
    if (val instanceof Date) {
      cell.numFmt = 'DD/MM/YYYY';
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    } else if (typeof val === 'number') {
      cell.numFmt = Number.isInteger(val) ? '#,##0' : '#,##0.00';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else {
      cell.alignment = { vertical: 'middle', wrapText: false };
    }
  });
}

export function appendTotalRow(ws, exportCols, dataRows, numColSet) {
  const totalRow = exportCols.map((col, ci) => {
    if (!numColSet.has(col)) {
      return ci === 0 ? `Total: ${dataRows.length.toLocaleString()} filas` : null;
    }
    return dataRows.reduce((acc, r) => {
      const v = r[ci];
      return typeof v === 'number' ? acc + v : acc;
    }, 0);
  });
  const tRow = ws.addRow(totalRow);
  tRow.height = 16;
  exportCols.forEach((col, ci) => {
    const cell = tRow.getCell(ci + 1);
    const val = totalRow[ci];
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
    cell.border = FULL_BORDER;
    if (typeof val === 'number') {
      cell.numFmt = Number.isInteger(val) ? '#,##0' : '#,##0.00';
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else if (val) {
      cell.alignment = { vertical: 'middle' };
    }
  });
}

export function applyWorksheetPrintSetup(ws, exportCols, dataRows, baseName, sheetName, date) {
  ws.views = [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }];
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: dataRows.length + 1, column: exportCols.length },
  };
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    printTitlesRow: '1:1',
  };
  ws.headerFooter = {
    oddHeader: `&L&"Arial,Bold"&10${baseName} — ${sheetName}&R&"Arial,Regular"&9Generado: ${date}`,
    oddFooter: '&C&"Arial,Regular"&9Página &P de &N',
  };
}

/** Fallback export via SheetJS when ExcelJS is unavailable. */
export function exportFallbackXlsx(XLSX, exportCols, dataRows, fileName) {
  const ws = XLSX.utils.aoa_to_sheet([
    exportCols,
    ...dataRows.map((r) => r.map((v) => (v == null ? '' : v))),
  ]);
  ws['!cols'] = exportCols.map((c, ci) => {
    let max = c.length + 2;
    dataRows.slice(0, 200).forEach((r) => {
      const len = String(r[ci] ?? '').length;
      if (len > max) max = len;
    });
    return { wch: Math.min(max + 2, 45) };
  });
  ws['!rows'] = [{ hpt: 20 }, ...dataRows.map(() => ({ hpt: 14 }))];
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
  const lc = XLSX.utils.encode_col(exportCols.length - 1);
  ws['!autofilter'] = { ref: `A1:${lc}${dataRows.length + 1}` };
  const wb2 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb2, ws, (fileName.split('_')[1] || 'Datos').slice(0, 31));
  XLSX.writeFile(wb2, fileName);
}

/** Add a styled worksheet to an ExcelJS workbook. */
export function appendStyledExportSheet(ExcelJS, wb, tab, { wsName, baseName, sheetName, date } = {}) {
  const exportCols = getExportColumns(tab);
  if (!exportCols.length) return null;
  const { dataRows, numColSet } = buildExportDataRows(tab, exportCols);
  if (!dataRows.length) return null;

  const safeSheet = (wsName || safeExportName(tab.activeSheet || 'Datos')).slice(0, 31);
  const ws = wb.addWorksheet(safeSheet);
  ws.columns = columnWidthsForExport(exportCols, dataRows);

  const hdrRow = ws.addRow(exportCols);
  styleHeaderRow(hdrRow, exportCols);

  dataRows.forEach((rowArr, di) => {
    const r = ws.addRow(rowArr);
    styleDataRow(r, rowArr, exportCols, numColSet, di);
  });

  appendTotalRow(ws, exportCols, dataRows, numColSet);
  applyWorksheetPrintSetup(
    ws,
    exportCols,
    dataRows,
    baseName || safeExportName((tab.fileName || 'export').replace(/\.xlsx?$/i, '')),
    sheetName || safeExportName(tab.activeSheet || 'Datos'),
    date || new Date().toISOString().slice(0, 10)
  );

  return { exportCols, dataRows, numColSet };
}

export function downloadExcelBuffer(buffer, fileName) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 200);
}
