/**
 * 収集元レジストリのリポジトリ
 */
class SourceRegistryRepo {
  constructor() {
    this.db = new SheetAccess(Config.SHEETS.SOURCE_REGISTRY, 'source_id');
  }

  /**
   * 有効な収集元のみを取得
   * @returns {Object[]}
   */
  getActiveSources() {
    const all = this.db.getAll();
    // enabled が TRUE (boolean) または "TRUE" (string) のものをフィルタ
    return all.filter(src => String(src.enabled).toUpperCase() === 'TRUE');
  }
}
