/**
 * 一次ソース（公的機関・法令・統計）収集サービス
 */
class PrimarySourceService {
  constructor() {
    this.fetchService = new FetchService();
    this.geminiService = new GeminiService();
  }

  /**
   * 一次ソースを包括的に収集
   * @param {string} query ベースとなる検索クエリ
   * @returns {Object[]} 収集した一次ソース記事
   */
  collect(query) {
    console.log(`Collecting primary sources for: ${query}`);
    
    const results = [];
    
    // 1. 政府機関プレスリリース
    results.push(...this.collectGovernmentReleases(query));
    
    // 2. 法令情報
    results.push(...this.collectLegalInfo(query));
    
    // 3. 統計データ
    results.push(...this.collectStatistics(query));
    
    console.log(`Collected ${results.length} primary sources.`);
    return results;
  }

  /**
   * 政府機関のプレスリリースを収集（グループ1: 環境省・農水省）
   * @param {string} query
   * @returns {Object[]}
   */
  collectGovernmentReleasesGroup1(query) {
    return this.collectFromSites(query, ['env.go.jp', 'maff.go.jp'], 'official', 95);
  }

  /**
   * 政府機関のプレスリリースを収集（グループ2: 厚労省・内閣官房）
   * @param {string} query
   * @returns {Object[]}
   */
  collectGovernmentReleasesGroup2(query) {
    return this.collectFromSites(query, ['mhlw.go.jp', 'cas.go.jp'], 'official', 95);
  }

  /**
   * 指定サイトからの収集（タイムアウト制御付き）
   * @param {string} query
   * @param {string[]} sites
   * @param {string} sourceType
   * @param {number} reliabilityScore
   * @returns {Object[]}
   */
  collectFromSites(query, sites, sourceType, reliabilityScore) {
    const results = [];
    const TIMEOUT_MS = 40000; // 40秒タイムアウト

    sites.forEach(site => {
      const startTime = Date.now();
      
      try {
        const siteQuery = `site:${site} プレスリリース ${query}`;
        console.log(`  -> Fetching from ${site}...`);
        
        const articles = this.fetchWithTimeout(siteQuery, 2, TIMEOUT_MS);
        
        articles.forEach(article => {
          article.source_type = sourceType;
          article.reliability_score = reliabilityScore;
          article.bias_indicator = 'neutral';
        });
        
        results.push(...articles);
        console.log(`     Found ${articles.length} articles (${Date.now() - startTime}ms)`);
        
        Utilities.sleep(500); // レート制限対策（短縮）
      } catch (e) {
        const elapsed = Date.now() - startTime;
        if (elapsed >= TIMEOUT_MS) {
          console.warn(`Timeout fetching from ${site} (${elapsed}ms)`);
        } else {
          console.warn(`Failed to fetch from ${site}:`, e);
        }
      }
    });

    return results;
  }

  /**
   * タイムアウト制御付きfetch
   * @param {string} query
   * @param {number} limit
   * @param {number} timeoutMs
   * @returns {Object[]}
   */
  fetchWithTimeout(query, limit, timeoutMs) {
    const startTime = Date.now();
    
    try {
      const articles = this.fetchService.fetchByQuery(query, limit);
      
      const elapsed = Date.now() - startTime;
      if (elapsed >= timeoutMs) {
        console.warn(`Query took ${elapsed}ms (>= ${timeoutMs}ms timeout)`);
        return []; // タイムアウト時は空配列
      }
      
      return articles;
    } catch (e) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= timeoutMs) {
        console.warn(`Query timeout: ${elapsed}ms`);
        return [];
      }
      throw e;
    }
  }

  /**
   * 政府機関のプレスリリースを収集（旧メソッド：後方互換性のため残す）
   * @deprecated Use collectGovernmentReleasesGroup1/Group2 instead
   */
  collectGovernmentReleases(query) {
    const results = [];
    results.push(...this.collectGovernmentReleasesGroup1(query));
    results.push(...this.collectGovernmentReleasesGroup2(query));
    return results;
  }

  /**
   * 法令情報を収集（タイムアウト制御付き）
   * @param {string} query
   * @returns {Object[]}
   */
  collectLegalInfo(query) {
    const startTime = Date.now();
    const TIMEOUT_MS = 40000;
    
    try {
      const legalQuery = `site:elaws.e-gov.go.jp ${query}`;
      console.log(`  -> Fetching legal info...`);
      
      const articles = this.fetchWithTimeout(legalQuery, 3, TIMEOUT_MS);
      
      articles.forEach(article => {
        article.source_type = 'law';
        article.reliability_score = 100;
        article.bias_indicator = 'neutral';
        article.snippet = this.extractLegalSummary(article);
      });
      
      console.log(`     Found ${articles.length} legal docs (${Date.now() - startTime}ms)`);
      return articles;
    } catch (e) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= TIMEOUT_MS) {
        console.warn(`Legal info timeout: ${elapsed}ms`);
      } else {
        console.warn('Failed to fetch legal info:', e);
      }
      return [];
    }
  }

  /**
   * 統計データを収集（タイムアウト制御付き）
   * @param {string} query
   * @returns {Object[]}
   */
  collectStatistics(query) {
    const startTime = Date.now();
    const TIMEOUT_MS = 40000;
    
    try {
      const statQuery = `site:e-stat.go.jp ${query}`;
      console.log(`  -> Fetching statistics...`);
      
      const articles = this.fetchWithTimeout(statQuery, 2, TIMEOUT_MS);
      
      articles.forEach(article => {
        article.source_type = 'statistics';
        article.reliability_score = 95;
        article.bias_indicator = 'neutral';
      });
      
      console.log(`     Found ${articles.length} statistics (${Date.now() - startTime}ms)`);
      return articles;
    } catch (e) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= TIMEOUT_MS) {
        console.warn(`Statistics timeout: ${elapsed}ms`);
      } else {
        console.warn('Failed to fetch statistics:', e);
      }
      return [];
    }
  }

  /**
   * 法令ページから要約を抽出（Gemini使用）
   * @param {Object} article
   * @returns {string}
   */
  extractLegalSummary(article) {
    if (!article.snippet) return '';
    
    // 簡易版: snippetをそのまま使用
    // 将来的にはGeminiで法令の条文を要約可能
    return article.snippet;
  }

  /**
   * 一次ソースの検索クエリを生成（Gemini使用）
   * @param {Object} item 元記事
   * @returns {string[]} 一次ソース検索用クエリ
   */
  generatePrimaryQueries(item) {
    const systemPrompt = `
あなたは調査ジャーナリストです。
ニュース記事のタイトルと概要から、この記事の信憑性を検証するために
参照すべき「一次ソース」（政府発表、法令、統計データ）を探すための
検索キーワードを3つ生成してください。

例:
- 「環境省 動物愛護 統計 2024」
- 「動物愛護管理法 改正」
- 「殺処分 統計 e-stat」

JSON Schema:
{
  "queries": string[]  // 3つの検索クエリ
}
`;
    const userPrompt = `Title: ${item.title}\nSnippet: ${item.snippet}`;

    try {
      const result = this.geminiService.generateJson(
        Config.GEMINI.MODEL_GENERATION,
        systemPrompt,
        userPrompt
      );
      return result.queries || [];
    } catch (e) {
      console.warn('Failed to generate primary queries, using fallback.');
      return [`${item.title} 政府`, `${item.title} 法令`, `${item.title} 統計`];
    }
  }
}
