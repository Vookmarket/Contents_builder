class SetupService {
  constructor() {
    // 全リポジトリを初期化（シート作成トリガー）
    this.repos = {
      source: new SourceRegistryRepo(),
      intake: new IntakeQueueRepo(),
      screening: new ScreeningRepo(),
      evidence: new EvidenceIndexRepo(),
      topic: new TopicBacklogRepo(),
      outputs: new OutputsRepo(),
      // ログやトリガー管理などはまだRepoがないため省略
    };
  }

  /**
   * 全シートのセットアップと初期データ投入
   */
  setupAll() {
    console.log('Starting Setup...');

    // 1. 各シートのヘッダー定義
    const headersMap = {
      source: ['source_id', 'name', 'type', 'url', 'fetch_freq', 'lang', 'reliability_base', 'enabled', 'memo'],
      intake: ['item_id', 'fetched_at', 'source_id', 'title', 'url', 'published_at', 'snippet', 'dedupe_key', 'status', 'notes'],
      screening: ['item_id', 'animal_score', 'policy_score', 'urgency', 'japan_relevance', 'misinformation_risk', 'tags', 'summary_30s', 'key_points', 'model_meta'],
      evidence: ['topic_id', 'claim_id', 'related_item_id', 'claim_text', 'evidence_url', 'evidence_type', 'primary_flag', 'confidence', 'evidence_notes'],
      topic: ['topic_id', 'created_at', 'title_working', 'angle', 'target_media', 'priority', 'status', 'lead_item_ids'],
      outputs: ['topic_id', 'project_sheet_url', 'research_status', 'drive_folder_url', 'md_evidence_url', 'md_short_url', 'md_long_url', 'md_note_url', 'md_genspark_prompt_url', 'generated_at']
    };

    // 2. ヘッダー設定
    Object.keys(this.repos).forEach(key => {
      const repo = this.repos[key];
      const headers = headersMap[key];
      if (repo && headers) {
        this.ensureSheetHeaders(repo.db, headers);
      }
    });

    // 3. 初期データ投入 (SourceRegistry)
    this.seedSourceRegistry();

    console.log('Setup Completed.');
  }

  /**
   * シートにヘッダーを設定（存在しない場合のみ）
   * @param {SheetAccess} db
   * @param {string[]} headers
   */
  ensureSheetHeaders(db, headers) {
    const sheet = db.getSheet();
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      console.log(`Initialized headers for ${db.sheetName}`);
    }
  }

  /**
   * SourceRegistryに初期データを投入
   */
  seedSourceRegistry() {
    const repo = this.repos.source;
    const sources = repo.getActiveSources(); // 既存チェック代わり

    if (sources.length > 0) {
      console.log('SourceRegistry already has data. Skipping seed.');
      return;
    }

    const seeds = [
      {
        source_id: Utilities.getUuid(),
        name: 'Google News (動物愛護)',
        type: 'RSS',
        url: 'https://news.google.com/rss/search?q=%E5%8B%95%E7%89%A9%E6%84%9B%E8%AD%B7+when:1d&hl=ja&gl=JP&ceid=JP:ja',
        fetch_freq: 'daily',
        lang: 'ja',
        reliability_base: 3,
        enabled: 'TRUE',
        memo: 'Default Seed'
      },
      {
        source_id: Utilities.getUuid(),
        name: 'Yahoo!ニュース (主要)',
        type: 'RSS',
        url: 'https://news.yahoo.co.jp/rss/topics/top-picks.xml',
        fetch_freq: 'hourly',
        lang: 'ja',
        reliability_base: 4,
        enabled: 'TRUE',
        memo: 'Default Seed'
      }
    ];

    seeds.forEach(s => repo.db.add(s));
    console.log(`Seeded ${seeds.length} sources.`);
  }
}
