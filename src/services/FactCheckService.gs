/**
 * ファクトチェックサービス
 * 元記事の数値・日付を一次ソースと照合
 */
class FactCheckService {
  constructor() {
    this.geminiService = new GeminiService();
    this.projectManager = new ProjectManager();
  }

  /**
   * 記事のファクトチェックを実行
   * @param {Object} item 元記事
   * @param {string} topicId トピックID
   */
  verify(item, topicId) {
    console.log('  [FactCheck] Starting fact check...');
    
    try {
      // 1. 元記事から数値・日付を抽出
      const claims = this.extractClaims(item);
      if (!claims || claims.length === 0) {
        console.log('  [FactCheck] No verifiable claims found.');
        return;
      }
      console.log(`  [FactCheck] Extracted ${claims.length} claims.`);

      // 2. 各クレームを検証
      const results = [];
      claims.forEach(claim => {
        Utilities.sleep(1000); // レート制限対策
        
        const verification = this.verifyClaim(claim, topicId);
        results.push(verification);
      });

      // 3. 結果を 04_FactCheck シートに保存
      this.saveToFactCheckSheet(topicId, results);
      
      // 4. 統計ログ
      const verified = results.filter(r => r.match_status === 'verified').length;
      const conflicting = results.filter(r => r.match_status === 'conflicting').length;
      const unverified = results.filter(r => r.match_status === 'unverified').length;
      console.log(`  [FactCheck] Results: Verified=${verified}, Conflicting=${conflicting}, Unverified=${unverified}`);
      
    } catch (e) {
      console.error('  [FactCheck] Error during fact check:', e);
    }
  }

  /**
   * 元記事から検証すべき数値・日付を抽出
   * @param {Object} item
   * @returns {Array} claims
   */
  extractClaims(item) {
    const systemPrompt = `
あなたはファクトチェッカーです。
以下の記事から、検証すべき具体的な数値・日付を抽出してください。

【抽出対象】
- 統計数値（例: 「2万頭」「50%」「1,234件」）
- 年度・日付（例: 「2023年度」「2024年1月」）
- 金額（例: 「100億円」「5,000万円」）

【注意】
- 数値は正規化してください（例: 「2万」→「20000」）
- 重要な主張に関連する数値のみを抽出
- 最大5つまで

JSON Schema:
{
  "claims": [{
    "claim_text": string,      // 元の文章（例: "2023年度の殺処分数は2万頭"）
    "claim_value": string,     // 数値部分のみ（例: "20000"）
    "claim_type": "number"|"date"|"money"
  }]
}
`;
    
    const userPrompt = `
記事タイトル: ${item.title}
記事概要: ${item.snippet || ''}
`;

    try {
      const result = this.geminiService.generateJson(
        Config.GEMINI.MODEL_GENERATION,
        systemPrompt,
        userPrompt
      );
      
      return result.claims || [];
    } catch (e) {
      console.warn('  [FactCheck] Failed to extract claims:', e);
      return [];
    }
  }

  /**
   * クレームを検証
   * @param {Object} claim
   * @param {string} topicId
   * @returns {Object} verification result
   */
  verifyClaim(claim, topicId) {
    console.log(`  [FactCheck] Verifying: ${claim.claim_text}`);
    
    // 1. 一次ソースを取得
    const primarySources = this.getPrimarySources(topicId);
    if (!primarySources || primarySources.length === 0) {
      return {
        claim_text: claim.claim_text,
        claim_value: claim.claim_value,
        source_value: '',
        match_status: 'unverified',
        source_url: '',
        notes: 'No primary sources available'
      };
    }

    // 2. 一次ソースから関連する数値を検索
    for (const source of primarySources) {
      const sourceData = this.searchInPrimarySource(claim, source);
      
      if (sourceData.found) {
        // 3. 値を比較
        const match = this.compareValues(claim.claim_value, sourceData.value, claim.claim_type);
        
        return {
          claim_text: claim.claim_text,
          claim_value: claim.claim_value,
          source_value: sourceData.value,
          match_status: match ? 'verified' : 'conflicting',
          source_url: source.url,
          notes: sourceData.context || ''
        };
      }
    }

    // 一次ソースで見つからなかった
    return {
      claim_text: claim.claim_text,
      claim_value: claim.claim_value,
      source_value: '',
      match_status: 'unverified',
      source_url: '',
      notes: 'Not found in primary sources'
    };
  }

  /**
   * プロジェクトシートから一次ソースを取得
   * @param {string} topicId
   * @returns {Array}
   */
  getPrimarySources(topicId) {
    const sheet = this.projectManager.getProjectSheet(topicId, '01_Research');
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);

    // source_type が official, law, statistics のもの
    const sourceTypeIdx = headers.indexOf('source_type');
    const urlIdx = headers.indexOf('source_url');
    const titleIdx = headers.indexOf('title');
    const summaryIdx = headers.indexOf('summary');

    const primaryTypes = ['official', 'law', 'statistics'];
    
    return rows
      .filter(row => primaryTypes.includes(row[sourceTypeIdx]))
      .map(row => ({
        url: row[urlIdx],
        title: row[titleIdx],
        summary: row[summaryIdx]
      }))
      .filter(s => s.url); // URLがあるもののみ
  }

  /**
   * 一次ソースから関連する数値を検索
   * @param {Object} claim
   * @param {Object} source
   * @returns {Object} { found: boolean, value: string, context: string }
   */
  searchInPrimarySource(claim, source) {
    const systemPrompt = `
あなたはファクトチェッカーです。
以下の一次ソースから「${claim.claim_text}」に関連する数値を抽出してください。

【タスク】
- クレームに関連する数値を探す
- 見つかった場合は、その数値と前後の文脈を返す
- 見つからない場合は found: false

JSON Schema:
{
  "found": boolean,
  "value": string,    // 見つかった数値（正規化済み）
  "context": string   // 前後の文脈（100文字程度）
}
`;

    const userPrompt = `
【クレーム】
${claim.claim_text}

【一次ソース】
タイトル: ${source.title}
URL: ${source.url}
内容: ${source.summary || ''}
`;

    try {
      const result = this.geminiService.generateJson(
        Config.GEMINI.MODEL_GENERATION,
        systemPrompt,
        userPrompt
      );
      
      return result;
    } catch (e) {
      console.warn('  [FactCheck] Failed to search in primary source:', e);
      return { found: false, value: '', context: '' };
    }
  }

  /**
   * 値を比較（許容範囲を考慮）
   * @param {string} claimValue
   * @param {string} sourceValue
   * @param {string} type
   * @returns {boolean} 一致するか
   */
  compareValues(claimValue, sourceValue, type) {
    // 数値の正規化（カンマ削除など）
    const normalize = (val) => {
      return val.replace(/[,、]/g, '').trim();
    };

    const claim = normalize(claimValue);
    const source = normalize(sourceValue);

    // 完全一致
    if (claim === source) return true;

    // 数値型の場合、許容範囲（±5%）を考慮
    if (type === 'number' || type === 'money') {
      try {
        const claimNum = parseFloat(claim);
        const sourceNum = parseFloat(source);
        
        if (isNaN(claimNum) || isNaN(sourceNum)) return false;
        
        const diff = Math.abs(claimNum - sourceNum);
        const tolerance = sourceNum * 0.05; // ±5%
        
        return diff <= tolerance;
      } catch (e) {
        return false;
      }
    }

    // 日付型は完全一致のみ
    return false;
  }

  /**
   * 結果を 04_FactCheck シートに保存
   * @param {string} topicId
   * @param {Array} results
   */
  saveToFactCheckSheet(topicId, results) {
    const sheet = this.projectManager.getProjectSheet(topicId, '04_FactCheck');
    if (!sheet) {
      console.warn('  [FactCheck] 04_FactCheck sheet not found.');
      return;
    }

    const rows = results.map(r => [
      r.claim_text,
      r.claim_value,
      r.source_value,
      r.match_status,
      r.source_url
    ]);

    if (rows.length > 0) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
      console.log(`  [FactCheck] Saved ${rows.length} results to 04_FactCheck sheet.`);
    }
  }
}
