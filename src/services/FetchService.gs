class FetchService {
  constructor() {
    this.sourceRepo = new SourceRegistryRepo();
    this.intakeRepo = new IntakeQueueRepo();
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
    // 今回は type='RSS' を前提とする
    if (source.type && source.type.toUpperCase() === 'RSS') {
      return this.fetchRss(source);
    }
    // Webスクレイピングなどは今後追加
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
          dedupe_key: link || guid, // URLをキーにする
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
            // dc:date などが必要だが省略
            
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
   * 検索クエリによる一時的なRSS収集
   * @param {string} query
   * @returns {Object[]}
   */
  fetchByQuery(query) {
    // Google News RSS URL生成
    const encodedKw = encodeURIComponent(query);
    const url = `https://news.google.com/rss/search?q=${encodedKw}+when:1y&hl=ja&gl=JP&ceid=JP:ja`; // 過去1年
    
    const tempSource = {
      source_id: 'temp',
      name: `Search: ${query}`,
      type: 'RSS',
      url: url,
      enabled: 'TRUE'
    };

    try {
      return this.fetchRss(tempSource);
    } catch (e) {
      console.warn(`Search failed for query "${query}": ${e.message}`);
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
    return html.replace(/<[^>]+>/g, '').trim().substring(0, 500); // 500文字制限
  }
}
