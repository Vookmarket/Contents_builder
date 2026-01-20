class ContentService {
  constructor() {
    this.topicRepo = new TopicBacklogRepo();
    this.outputsRepo = new OutputsRepo();
    this.geminiService = new GeminiService();
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
