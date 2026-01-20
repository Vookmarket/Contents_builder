/**
 * 収集元レジストリのリポジトリ
 * @extends {SheetBase}
 */
class SourceRegistryRepo extends SheetBase {
  constructor() {
    super(Config.SHEETS.SOURCE_REGISTRY, 'source_id');
  }

  /**
   * 有効な収集元のみを取得
   * @returns {Object[]}
   */
  getActiveSources() {
    const all = this.getAll();
    // enabled が TRUE (boolean) または "TRUE" (string) のものをフィルタ
    return all.filter(src => String(src.enabled).toUpperCase() === 'TRUE');
  }
}
