# Contents Builder (Animal x Politics Info Automation)

動物×政治情報アカウントの運営を支援・自動化するための Google Apps Script (GAS) プロジェクトです。
RSSやWebからの情報収集、Gemini APIを用いたスクリーニング、およびYouTube/Note向けのコンテンツ生成を自動化します。

## ドキュメント

詳細な仕様については以下のドキュメントを参照してください。

- [要件定義書](要件定義書.md)
- [技術要件定義書](技術要件定義書.md)

## システム構成

- **Runtime**: Google Apps Script (V8)
- **Language**: TypeScript
- **AI Engine**: Google Gemini API (Flash/Pro)
- **Database**: Google Sheets
- **Storage**: Google Drive
- **Toolchain**: clasp, npm

## セットアップ

### 前提条件
- Node.js installed
- Google Account

### インストール

```bash
# 依存関係のインストール
npm install

# clasp のログイン（初回のみ）
npx clasp login
```

### プロジェクト設定

1. Google Apps Script プロジェクトを作成またはクローンします。
   ```bash
   npx clasp create --type sheets --title "Contents Builder" --rootDir ./build
   # または既存の scriptId を .clasp.json に設定
   ```

2. スクリプトプロパティの設定
   GASのエディタ上で、以下のスクリプトプロパティを設定してください。
   - `GEMINI_API_KEY`: Google AI Studioで発行したAPIキー

### 開発フロー

```bash
# ビルド（TypeScript -> GAS JS への変換）
npm run build # (現状は clasp push で自動的に行われる想定ですが、必要に応じて script 追加)

# デプロイ（アップロード）
npx clasp push

# エディタを開く
npx clasp open
```

## ディレクトリ構造

```
src/
├── config/           # 設定・定数
├── models/           # 型定義
├── repositories/     # Sheetsデータアクセス
├── services/         # 外部API連携・ビジネスロジック
├── utils/            # ユーティリティ
└── main.ts           # エントリーポイント
```

## ライセンス
ISC
