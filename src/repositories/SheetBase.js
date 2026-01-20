/**
 * シートアクセスの基底クラス
 */
class SheetBase {
  /**
   * @param {string} sheetName
   * @param {string} primaryKey
   */
  constructor(sheetName, primaryKey) {
    this.sheetName = sheetName;
    this.primaryKey = primaryKey;
  }

  /**
   * @protected
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  getSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(this.sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(this.sheetName);
    }
    return sheet;
  }

  /**
   * @protected
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @returns {string[]}
   */
  getHeaders(sheet) {
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) return [];
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    return headers.map(String);
  }

  /**
   * @protected
   * @param {string[]} headers
   * @param {any[]} row
   * @returns {Object}
   */
  mapRowToObj(headers, row) {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  }

  /**
   * @protected
   * @param {string[]} headers
   * @param {Object} obj
   * @returns {any[]}
   */
  mapObjToRow(headers, obj) {
    return headers.map(header => {
      const val = obj[header];
      if (Array.isArray(val) || (typeof val === 'object' && val !== null)) {
        return JSON.stringify(val);
      }
      return val;
    });
  }

  /**
   * @returns {Object[]}
   */
  getAll() {
    const sheet = this.getSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    const headers = this.getHeaders(sheet);
    const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

    return data.map(row => this.mapRowToObj(headers, row));
  }

  /**
   * @param {Object} item
   */
  add(item) {
    const sheet = this.getSheet();
    let headers = this.getHeaders(sheet);

    if (headers.length === 0) {
      headers = Object.keys(item);
      sheet.appendRow(headers);
    }

    const row = this.mapObjToRow(headers, item);
    sheet.appendRow(row);
  }

  /**
   * @param {string} id
   * @param {Object} partial
   */
  update(id, partial) {
    const sheet = this.getSheet();
    const headers = this.getHeaders(sheet);
    const data = this.getAll();
    
    const index = data.findIndex(item => item[this.primaryKey] === id);
    if (index === -1) {
        throw new Error(`Item with ID ${id} not found in ${this.sheetName}`);
    }

    const currentItem = data[index];
    const updatedItem = { ...currentItem, ...partial };
    const row = this.mapObjToRow(headers, updatedItem);

    sheet.getRange(index + 2, 1, 1, row.length).setValues([row]);
  }
}
