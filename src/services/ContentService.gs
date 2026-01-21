class ContentService {
  constructor() {
    this.topicRepo = new TopicBacklogRepo();
    this.outputsRepo = new OutputsRepo();
    this.geminiService = new GeminiService();
    this.projectManager = new ProjectManager();
  }

  /**
   * Deep Research完了済みのトピックから、信頼性の高いコンテンツを生成する (Phase 9)
   * @param {number} limit
   */
  generateContentFromDeepResearch(limit = 3) {
    const topics = this.topicRepo.getByStatus('draft').slice(0, limit);
    console.log(`Generating content for ${topics.length} topics...`);

    topics.forEach(topic => {
      try {
        console.log(`Generating Script for: ${topic.title_working}`);
        const context = this._getResearchContext(topic.topic_id, topic);
        
        if (!context) {
          console.warn(`No context found for ${topic.topic_id}`);
          return;
        }

        const script = this.createShortsScriptEnhanced(context);

        // 03_Drafts シートに保存
        this._saveToDraftSheet(topic.topic_id, script);
        
        // ステータス更新
        this.topicRepo.update(topic.topic_id, { status: 'writing' });
        console.log(`  -> Saved script to 03_Drafts sheet.`);

      } catch (e) {
        console.error(`Error generating content for ${topic.topic_id}:`, e);
      }
    });
  }

  /**
   * プロジェクトシートからコンテキスト情報を取得
   * @private
   */
  _getResearchContext(topicId, topic) {
    const context = {
      title: topic.title_working,
      angle: topic.angle,
      articles: '',
      facts: '',
      timeline: ''
    };

    // 1. Articles (01_Research)
    const rSheet = this.projectManager.getProjectSheet(topicId, '01_Research');
    if (rSheet) {
      const rows = rSheet.getDataRange().getValues();
      if (rows.length > 1) {
        const headers = rows[0];
        const data = rows.slice(1).map(r => { const o={}; headers.forEach((h,i)=>o[h]=r[i]); return o; });
        context.articles = data.slice(0, 5).map(d => `- ${d.title} (${d.bias_indicator})`).join('\n');
      }
    } else {
      return null; // Deep Researchデータがない
    }

    // 2. Fact Check (04_FactCheck)
    const fSheet = this.projectManager.getProjectSheet(topicId, '04_FactCheck');
    if (fSheet) {
      const rows = fSheet.getDataRange().getValues();
      if (rows.length > 1) {
        const headers = rows[0];
        const data = rows.slice(1).map(r => { const o={}; headers.forEach((h,i)=>o[h]=r[i]); return o; });
        context.facts = data
          .filter(d => d.match_status === 'verified')
          .map(d => `- [Verified] ${d.claim_text}: ${d.source_value}`)
          .join('\n');
      }
    }

    // 3. Timeline (05_Timeline)
    const tSheet = this.projectManager.getProjectSheet(topicId, '05_Timeline');
    if (tSheet) {
      const rows = tSheet.getDataRange().getValues();
      if (rows.length > 1) {
        const headers = rows[0];
        const data = rows.slice(1).map(r => { const o={}; headers.forEach((h,i)=>o[h]=r[i]); return o; });
        context.timeline = data.slice(0, 5).map(d => `- ${d.date}: ${d.event}`).join('\n');
      }
    }

    return context;
  }

  /**
   * 高度なショート動画台本生成
   * @param {Object} context
   * @returns {string} Markdown
   */
  createShortsScriptEnhanced(context) {
    const systemPrompt = `
あなたはプロのYouTubeショート動画構成作家です。
Deep Researchで得られた「検証済みの事実」と「多面的な視点」を元に、
信頼性が高く、かつ視聴維持率の高い台本を作成してください。

【制約】
- **Fact-Based**: 提供された「検証済みファクト」を必ず1つ以上盛り込んでください。
- **Balanced**: 偏った意見ではなく、事実に基づいた冷静な視点を含めてください。
- **Hook**: 最初の5秒で視聴者の関心を掴んでください。

出力形式: Markdown
構成:
- **Hook** (0-5秒): 強烈な一言
- **Body** (5-45秒): ファクトに基づく本題
- **Conclusion** (45-60秒): まとめ
`;
    
    const userPrompt = `
Title: ${context.title}
Angle: ${context.angle}

[Verified Facts]
${context.facts}

[Timeline/Context]
${context.timeline}

[Key Articles]
${context.articles}
`;

    return this.geminiService.generateContent(
      Config.GEMINI.MODEL_GENERATION,
      systemPrompt,
      userPrompt
    );
  }

  /**
   * 03_Drafts シートへ保存
   * @private
   */
  _saveToDraftSheet(topicId, content) {
    const sheet = this.projectManager.getProjectSheet(topicId, '03_Drafts');
    if (!sheet) return;

    // headers: type, title_proposal, content_body, status
    sheet.appendRow([
      'shorts_script',
      'Generated Script',
      content,
      'draft'
    ]);
  }

  /**
   * 準備完了ステータスのトピックに対してコンテンツ生成を行う
   * (今回は draft のものを対象にデモ実装)
   */
  generateContentsForPendingTopics() {
    const topics = this.topicRepo.getByStatus('draft'); // 本当は 'ready' とか
    console.log(`Found ${topics.length} pending topics.`);

    topics.forEach(topic => {
      // ターゲットメディアに 'short' が含まれていれば生成
      const media = JSON.parse(topic.target_media || '[]');
      if (media.includes('short')) {
        console.log(`Generating Shorts Script for: ${topic.title_working}`);
        const script = this.createShortsScript(topic);
        const url = this.saveToDrive(topic, '10_shorts_script.md', script);
        
        this.outputsRepo.add({
          topic_id: topic.topic_id,
          md_short_url: url,
          generated_at: new Date().toISOString()
        });
        
        console.log(`  -> Saved to ${url}`);
        
        // ステータス更新
        this.topicRepo.update(topic.topic_id, { status: 'writing' });
      }
    });
  }

  /**
   * ショート動画台本生成
   * @param {Object} topic
   * @returns {string} Markdown Content
   */
  createShortsScript(topic) {
    const systemPrompt = `
あなたはプロのYouTubeショート動画構成作家です。
与えられたトピックについて、1分以内（目安150-200文字程度×速度）で完結する、
視聴維持率の高い台本を作成してください。

出力形式: Markdown
構成:
- **Hook** (0-5秒): 視聴者の手を止めさせる強烈な一言
- **Body** (5-45秒): 本題、事実、驚き
- **Conclusion/CTA** (45-60秒): まとめ、コメント誘導

※テロップ指示も（）で記述してください。
`;
    const userPrompt = `
Topic: ${topic.title_working}
Angle: ${topic.angle}
`;
    
    // 生成 (テキストモード)
    return this.geminiService.generateContent(
      Config.GEMINI.MODEL_GENERATION,
      systemPrompt,
      userPrompt
    );
  }

  /**
   * Driveに保存
   * @param {Object} topic
   * @param {string} fileName
   * @param {string} content
   * @returns {string} File URL
   */
  saveToDrive(topic, fileName, content) {
    // ルートフォルダ取得
    const folders = DriveApp.getFoldersByName(Config.DRIVE.ROOT_FOLDER_NAME);
    let rootFolder;
    if (folders.hasNext()) {
      rootFolder = folders.next();
    } else {
      rootFolder = DriveApp.createFolder(Config.DRIVE.ROOT_FOLDER_NAME);
    }

    // トピック用サブフォルダ (日付_Slug)
    const today = new Date().toISOString().slice(0, 10);
    const folderName = `${today}__topic-${topic.topic_id.substring(0, 8)}`;
    
    const subFolders = rootFolder.getFoldersByName(folderName);
    let topicFolder;
    if (subFolders.hasNext()) {
      topicFolder = subFolders.next();
    } else {
      topicFolder = rootFolder.createFolder(folderName);
    }

    // ファイル作成
    const file = topicFolder.createFile(fileName, content, MimeType.PLAIN_TEXT);
    return file.getUrl();
  }
}
