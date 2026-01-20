export abstract class SheetBase<T> {
  protected sheetName: string;
  protected primaryKey: string;

  constructor(sheetName: string, primaryKey: string) {
    this.sheetName = sheetName;
    this.primaryKey = primaryKey;
  }

  protected getSheet(): GoogleAppsScript.Spreadsheet.Sheet {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(this.sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(this.sheetName);
    }
    return sheet;
  }

  protected getHeaders(sheet: GoogleAppsScript.Spreadsheet.Sheet): string[] {
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) return [];
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    return headers.map(String);
  }

  protected mapRowToObj(headers: string[], row: any[]): T {
    const obj: any = {};
    headers.forEach((header, index) => {
      // カラム名とオブジェクトプロパティのマッピング
      // 簡単のため、ヘッダー名をそのままプロパティ名として扱う
      // 必要ならCamelCase変換などを入れる
      obj[header] = row[index];
    });
    return obj as T;
  }

  protected mapObjToRow(headers: string[], obj: any): any[] {
    return headers.map(header => {
      const val = obj[header];
      if (Array.isArray(val) || (typeof val === 'object' && val !== null)) {
        return JSON.stringify(val);
      }
      return val;
    });
  }

  public getAll(): T[] {
    const sheet = this.getSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    const headers = this.getHeaders(sheet);
    const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

    return data.map(row => this.mapRowToObj(headers, row));
  }

  public add(item: T): void {
    const sheet = this.getSheet();
    let headers = this.getHeaders(sheet);

    // ヘッダーが存在しない（新規シート）場合、オブジェクトから生成
    if (headers.length === 0) {
      headers = Object.keys(item as any);
      sheet.appendRow(headers);
    }

    // オブジェクトに新しいプロパティがある場合、ヘッダーを追加
    // (簡易実装: 今回は固定スキーマを前提とし、省略)

    const row = this.mapObjToRow(headers, item);
    sheet.appendRow(row);
  }

  public update(id: string, partial: Partial<T>): void {
    const sheet = this.getSheet();
    const headers = this.getHeaders(sheet);
    const data = this.getAll();
    
    // 行番号を探す (データ行は2行目からなので、index + 2)
    const index = data.findIndex((item: any) => item[this.primaryKey] === id);
    if (index === -1) {
        throw new Error(`Item with ID ${id} not found in ${this.sheetName}`);
    }

    const currentItem = data[index];
    const updatedItem = { ...currentItem, ...partial };
    const row = this.mapObjToRow(headers, updatedItem);

    sheet.getRange(index + 2, 1, 1, row.length).setValues([row]);
  }
}
