import { Config } from '../config/Config';

export class GeminiService {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor() {
    this.apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || '';
    if (!this.apiKey) {
      console.warn('GEMINI_API_KEY is not set in Script Properties.');
    }
  }

  /**
   * Gemini APIを呼び出す汎用メソッド
   * @param model モデル名
   * @param systemInstruction システムプロンプト
   * @param prompt ユーザープロンプト
   * @param jsonMode JSONモードを有効にするか
   */
  public generateContent(
    model: string,
    systemInstruction: string,
    prompt: string,
    jsonMode: boolean = false
  ): string {
    const url = `${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`;
    
    const payload: any = {
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

    const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
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
   */
  public generateJson<T>(
    model: string,
    systemInstruction: string,
    prompt: string
  ): T {
    const jsonString = this.generateContent(model, systemInstruction, prompt, true);
    try {
        return JSON.parse(jsonString) as T;
    } catch (e) {
        console.error('JSON Parse Error:', jsonString);
        throw new Error('Failed to parse Gemini response as JSON');
    }
  }
}
