import { writeFile, utils } from 'xlsx';

export type ExportRow = Record<string, unknown>;
export interface ExportOptions { fileName?: string; sheetName?: string }

export const exportJsonToExcel = (rows: ExportRow[], opts?: ExportOptions) => {
  const { fileName = 'report.xlsx', sheetName = 'Sheet1' } = opts || {};
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    // create an empty sheet with a message
    const ws = utils.aoa_to_sheet([['No data']]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, sheetName);
    writeFile(wb, fileName);
    return;
  }

  const ws = utils.json_to_sheet(rows as unknown as Record<string, unknown>[]);
  // set simple column widths
  ws['!cols'] = Object.keys(rows[0]).map((k) => ({ wch: Math.min(Math.max(String(k).length + 5, 10), 60) }));
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, sheetName);
  writeFile(wb, fileName);
};

export default exportJsonToExcel;
