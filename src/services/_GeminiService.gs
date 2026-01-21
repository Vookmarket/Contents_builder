class GeminiService {
  constructor() {
    this.apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || '';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    
    if (!this.apiKey) {
      console.warn('GEMINI_API_KEY is not set in Script Properties.');
    }
  }

  /**
   * Gemini APIを呼び出す汎用メソッド
   * @param {string} model モデル名
   * @param {string} systemInstruction システムプロンプト
   * @param {string} prompt ユーザープロンプト
   * @param {boolean} jsonMode JSONモードを有効にするか
   * @returns {string} 生成されたテキスト
   */
  generateContent(model, systemInstruction, prompt, jsonMode = false, useSearch = false) {
    const url = `${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`;
    
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      systemInstruction: {
        role: 'system',
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        temperature: 0.7,
      }
    };

    if (jsonMode) {
      payload.generationConfig.responseMimeType = 'application/json';
    }

    if (useSearch) {
      // Google Search Grounding を有効化
      payload.tools = [{ google_search: {} }];
    }

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    try {
      const response = UrlFetchApp.fetch(url, options);
      const statusCode = response.getResponseCode();
      const contentText = response.getContentText();

      if (statusCode !== 200) {
        throw new Error(`Gemini API Error (${statusCode}): ${contentText}`);
      }

      const json = JSON.parse(contentText);
      if (!json.candidates || json.candidates.length === 0) {
        throw new Error('No candidates returned from Gemini API');
      }

      const text = json.candidates[0].content.parts[0].text;
      return text;

    } catch (e) {
      console.error('Gemini API Fetch Error:', e);
      throw e;
    }
  }

  /**
   * JSONオブジェクトとしてパースして返すラッパー
   * @template T
   * @param {string} model
   * @param {string} systemInstruction
   * @param {string} prompt
   * @returns {T}
   */
  generateJson(model, systemInstruction, prompt, useSearch = false) {
    const jsonString = this.generateContent(model, systemInstruction, prompt, true, useSearch);
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error('JSON Parse Error:', jsonString);
        throw new Error('Failed to parse Gemini response as JSON');
    }
  }
}
