class FetchService {
  constructor() {
    this.sourceRepo = new SourceRegistryRepo();
    this.intakeRepo = new IntakeQueueRepo();
    // GeminiServiceはメソッド内で動的に生成するか、ここで生成する
  }

  /**
   * 全ての有効なソースから情報を収集し、保存する
   */
  fetchAll() {
    const sources = this.sourceRepo.getActiveSources();
    console.log(`Fetching from ${sources.length} sources...`);

    let totalAdded = 0;

    sources.forEach(source => {
      try {
        console.log(`Fetching: ${source.name} (${source.url})`);
        const items = this.fetchSource(source);
        if (items.length > 0) {
          const added = this.intakeRepo.addNewItems(items);
          console.log(`  -> Fetched ${items.length} items, Added ${added} new items.`);
          totalAdded += added;
        }
      } catch (e) {
        console.error(`Error fetching source ${source.name}:`, e);
        // エラーログを残すが、処理は続行
      }
    });

    console.log(`Fetch cycle completed. Total new items: ${totalAdded}`);
  }

  /**
   * 個別のソースから取得処理
   * @param {Object} source
   * @returns {Object[]}
   */
  fetchSource(source) {
    // RSSかWebか判断 (簡易的にtypeまたはURLで判断)
    if (source.type && source.type.toUpperCase() === 'RSS') {
      return this.fetchRss(source);
    }
    console.warn(`Unsupported source type: ${source.type} for ${source.name}`);
    return [];
  }

  /**
   * RSSフィードの取得とパース
   * @param {Object} source
   * @returns {Object[]}
   */
  fetchRss(source) {
    const response = UrlFetchApp.fetch(source.url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
      throw new Error(`HTTP Error: ${response.getResponseCode()}`);
    }

    const xml = response.getContentText();
    const document = XmlService.parse(xml);
    const root = document.getRootElement();

    let items = [];
    
    // Atom (namespace)
    const atomNs = XmlService.getNamespace('http://www.w3.org/2005/Atom');
    // RSS 2.0 (channel > item)
    const channel = root.getChild('channel');

    if (channel) {
      // RSS 2.0
      const rssItems = channel.getChildren('item');
      items = rssItems.map(item => {
        const title = item.getChildText('title');
        const link = item.getChildText('link');
        const desc = item.getChildText('description');
        const pubDate = item.getChildText('pubDate');
        const guid = item.getChildText('guid');
        
        return {
          source_id: source.source_id,
          title: title,
          url: link,
          published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          snippet: this.cleanHtml(desc),
          dedupe_key: link || guid,
          fetched_at: new Date().toISOString()
        };
      });
    } else if (root.getName() === 'feed') {
      // Atom
      const entries = root.getChildren('entry', atomNs);
      items = entries.map(entry => {
        const title = entry.getChildText('title', atomNs);
        const linkElem = entry.getChild('link', atomNs);
        const link = linkElem ? linkElem.getAttribute('href').getValue() : '';
        const summary = entry.getChildText('summary', atomNs) || entry.getChildText('content', atomNs);
        const updated = entry.getChildText('updated', atomNs);
        const id = entry.getChildText('id', atomNs);

        return {
          source_id: source.source_id,
          title: title,
          url: link,
          published_at: updated ? new Date(updated).toISOString() : new Date().toISOString(),
          snippet: this.cleanHtml(summary),
          dedupe_key: link || id,
          fetched_at: new Date().toISOString()
        };
      });
    } else {
      // RSS 1.0 (RDF)
      const rdfNs = XmlService.getNamespace('http://purl.org/rss/1.0/');
      const rdfItems = root.getChildren('item', rdfNs);
      if (rdfItems.length > 0) {
         items = rdfItems.map(item => {
            const title = item.getChildText('title', rdfNs);
            const link = item.getChildText('link', rdfNs);
            const desc = item.getChildText('description', rdfNs);
            
            return {
              source_id: source.source_id,
              title: title,
              url: link,
              published_at: new Date().toISOString(),
              snippet: this.cleanHtml(desc),
              dedupe_key: link,
              fetched_at: new Date().toISOString()
            };
         });
      }
    }

    return items;
  }

  /**
   * 検索クエリによる一時的な収集（Gemini Searchを使用）
   * @param {string} query
   * @param {number} limit 取得件数上限（デフォルト: 10）
   * @param {string} timeRange 期間指定（"1d", "7d", "1m", "1y" など、デフォルト: "1y"）
   * @returns {Object[]}
   */
  fetchByQuery(query, limit = 10, timeRange = '1y') {
    // 従来のRSS検索ではなく、Gemini Groundingを使用
    return this.fetchByGeminiSearch(query, limit, timeRange);
  }

  /**
   * Gemini Grounding (Google Search) を利用した記事収集
   * @param {string} query
   * @param {number} limit
   * @param {string} timeRange
   * @returns {Object[]}
   */
  fetchByGeminiSearch(query, limit, timeRange) {
    const gemini = new GeminiService();
    const rangeText = timeRange === '1y' ? '過去1年' : timeRange === '1m' ? '過去1ヶ月' : '最新';
    
    // カンマ区切りの場合は検索しやすいように整形
    const searchKeywords = query.replace(/[,、]/g, ' ');

    const systemPrompt = `
あなたはリサーチャーです。
ユーザーが指定するキーワードについてGoogle検索を行い、信頼性の高いニュース記事や公的機関の情報を収集してください。

【検索条件】
- キーワード: "${searchKeywords}"
- 期間: ${rangeText}
- 優先ソース: 大手ニュースメディア、政府機関、業界団体、研究所

【出力要件】
- 検索結果から最大${limit}件の記事を抽出してください。
- 各記事について、タイトル、URL、発行日（YYYY-MM-DD）、概要（100文字程度）をJSON形式で出力してください。

JSON Schema:
{
  "articles": [
    {
      "title": string,
      "url": string,
      "published_at": string, // YYYY-MM-DD
      "snippet": string
    }
  ]
}
`;
    const userPrompt = `キーワード: ${searchKeywords}`;

    try {
      const result = gemini.generateJson(
        Config.GEMINI.MODEL_GENERATION, 
        systemPrompt,
        userPrompt,
        true // useSearch = true
      );

      return (result.articles || []).slice(0, limit).map(a => ({
          source_id: 'gemini_search',
          title: a.title,
          url: a.url,
          published_at: a.published_at || new Date().toISOString(),
          snippet: a.snippet,
          fetched_at: new Date().toISOString(),
          source_type: 'news' // デフォルト
      }));

    } catch (e) {
      console.warn(`Gemini Search failed for query "${query}":`, e);
      // フォールバック: RSS検索を試みる
      console.log('Falling back to RSS search...');
      return this.fetchByRssSearch(query, limit, timeRange);
    }
  }

  /**
   * 従来のRSS検索（フォールバック用）
   * @private
   */
  fetchByRssSearch(query, limit, timeRange) {
    const sanitizedQuery = query.replace(/[,、]/g, ' OR ');
    const encodedKw = encodeURIComponent(sanitizedQuery);
    const url = `https://news.google.com/rss/search?q=${encodedKw}+when:${timeRange}&hl=ja&gl=JP&ceid=JP:ja`;
    
    const tempSource = {
      source_id: 'temp',
      name: `Search: ${query}`,
      type: 'RSS',
      url: url,
      enabled: 'TRUE'
    };

    try {
      const results = this.fetchRss(tempSource);
      return results.slice(0, limit);
    } catch (e) {
      console.warn(`RSS Search fallback failed: ${e.message}`);
      return [];
    }
  }

  /**
   * HTMLタグ除去（簡易版）
   * @param {string} html
   * @returns {string}
   */
  cleanHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]+>/g, '').trim().substring(0, 500);
  }
}
