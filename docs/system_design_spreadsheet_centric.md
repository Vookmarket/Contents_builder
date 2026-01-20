# システム設計：トピック別スプレッドシート集約型

## 1. 概要
「1トピック = 1スプレッドシート」の原則に基づき、情報の収集・分析・生成プロセスを単一のブック内で完結させる。これにより、情報の可視性と編集性を高め、AIと人間の協調を促進する。

## 2. ディレクトリ構造 (Google Drive)
```
ContentsBuilder_Output/
  ├── YYYY-MM-DD_Topic-Slug/
  │   └── Project_TopicTitle (Spreadsheet)
  └── ...
```

## 3. スプレッドシート構成 (Project Spreadsheet)

### 3.1 00_Overview (基本情報)
プロジェクトのメタデータを管理。
- **Properties**: Topic ID, Created At, Status
- **Source Article**: Title, URL, Summary
- **Direction**: Target Audience, Angle, Tone

### 3.2 01_Research (調査データ)
収集した記事や資料のリスト。
- **Columns**:
  - `source_url`: 記事URL
  - `title`: タイトル
  - `published_at`: 公開日
  - `summary`: 要約
  - `key_claims`: 抽出された主張（箇条書き）
  - `reliability`: 信頼度 (High/Med/Low)
  - `notes`: メモ

### 3.3 02_Analysis (分析・統合)
調査結果の分析。
- **Columns**:
  - `category`: "Fact Check", "Stakeholder", "Timeline", "Issue"
  - `item`: 項目名（例: "動物愛護法改正の経緯"）
  - `content`: 分析内容詳細
  - `sources`: 根拠としたSource URL (CSV)

### 3.4 03_Drafts (コンテンツ案)
生成されたコンテンツ。
- **Columns**:
  - `type`: "Shorts", "Long", "Note"
  - `title_proposal`: タイトル案
  - `content_body`: 本文 (Markdown)
  - `status`: "Draft", "Reviewed", "Final"

## 4. クラス設計

### `ProjectManager`
プロジェクトスプシのライフサイクルを管理。
- `createProject(topic)`: フォルダとスプシ作成、初期シート展開。
- `getProjectSheet(topicId, sheetName)`: 指定トピックの指定シートを取得。

### `DeepResearchService` (改修)
- 出力先を Markdown ファイルから `01_Research` シートへ変更。
- 複数回の検索結果を追記していく形にする。

### `AnalysisService` (新規)
- `01_Research` を読み込み、Geminiで分析して `02_Analysis` に書き込む。

### `ContentService` (改修)
- `02_Analysis` (および `00_Overview`) をコンテキストとして読み込み、台本を生成して `03_Drafts` に書き込む。

## 5. データ連携フロー
1. `TopicService`: マスタースプシでトピック生成 -> `ProjectManager` でプロジェクトスプシ作成 -> マスタースプシにURL記録。
2. `DeepResearchService`: プロジェクトスプシの `01_Research` に追記。
3. `AnalysisService`: プロジェクトスプシ内で処理完結。
4. `ContentService`: プロジェクトスプシ内で処理完結。
