# Contents Builder (Animal x Politics Info Automation)

動物×政治情報アカウントの運営を支援・自動化するためのツールです。
Google スプレッドシート上で動作し、AI (Gemini) を使って情報収集から台本作成までを一気通貫で自動化します。

## ✨ 機能一覧

1.  **情報収集**: 登録したRSSから最新ニュースを収集し、重複を除外して保存します。
2.  **スクリーニング**: 収集した記事をAIが評価・要約し、重要度（Promoted/Ignored）を判定します。
3.  **多面的深掘り調査 (Deep Research)**: 重要記事についてAIが自律的に追加調査を行い、情報を集約した **「専用スプレッドシート」** を自動生成します。
4.  **テーマ案生成**: 複数の重要記事を組み合わせて、YouTubeやNoteで発信すべき企画テーマを提案します。
5.  **ステークホルダー分析**: テーマに関連する利害関係者（アクター、スタンス、利害）を洗い出し、対立構造を可視化します。
6.  **コンテンツ生成**: 決定したテーマに基づいて、YouTubeショート動画の台本（Markdown）を自動生成します。

---

## 🔰 初心者向けセットアップガイド

### 1. 必要なものを準備する

1.  **Google Chrome**: ブラウザ。
2.  **Google Apps Script GitHub アシスタント**:
    - Chrome ウェブストアから拡張機能をインストールしてください。
    - [Google Apps Script GitHub アシスタント](https://chrome.google.com/webstore/detail/google-apps-script-github/lfjcgcmkmjjlieihflcicjojomelinch) (または類似の拡張機能)

### 2. GASプロジェクトの作成

1.  Google ドライブを開き、「新規」>「その他」>「Google Apps Script」を選択して新しいプロジェクトを作成します。
2.  プロジェクト名を「Contents Builder」などに変更します。

### 3. GitHub との連携

1.  GAS エディタ画面を開いた状態で、拡張機能のメニューから GitHub アカウントにログインします。
2.  **Repository** でこのリポジトリ (`Contents_builder`) を選択します。
3.  **Branch** で `main` を選択します。
4.  **Pull** ボタン（↓矢印など）をクリックして、コードを GAS プロジェクトに取り込みます。

### 4. 初期設定（重要）

AI を使うための鍵（APIキー）を設定します。

1.  GAS エディタ画面の左側にある歯車アイコン（⚙️ **プロジェクトの設定**）をクリックします。
2.  **スクリプト プロパティ** に以下を設定します。
    - プロパティ: `GEMINI_API_KEY`
    - 値: (Google AI Studio で取得した API キー)

※ 詳細な手順やモデル設定については [Gemini API 利用ガイド](docs/gemini_api_guide.md) を参照してください。

---

## 🚀 使い方

### 1. 初期セットアップ
スプレッドシートを開き（コード反映後にリロードが必要）、メニューの **「Contents Builder」** > **「0. 初期セットアップ」** を実行します。
これににより、必要なシートが全て自動作成され、サンプルのRSS（Yahooニュース等）が登録されます。

### 2. 収集先の追加 (Optional)
**「➕ 収集テーマの追加」** を実行し、興味のあるテーマ（例: 「動物愛護法の改正」）を入力すると、Geminiが関連するRSSを自動検索して登録します。

### 3. 運用フロー
以下の順序でメニューを実行していくことで、コンテンツが生成されます。

1.  **「1. 収集を実行」**
    - `SourceRegistry` に登録されたRSSから記事を集め、`IntakeQueue` に保存します。
2.  **「2. スクリーニング実行」**
    - 新着記事をAIが分析し、重要度を判定します。有望な記事は `promoted` ステータスになります。
3.  **「3. 一次ソース調査」 (Deep Research)**
    - `promoted` 記事ごとに **新しいスプレッドシート** (Project Sheet) が自動生成されます。
    - AIが関連情報をWebから追加収集し、そのシートの `01_Research` タブに記録します。
    - **ここが情報の集約拠点となります。**
4.  **「4. テーマ案生成」**
    - `promoted` 記事を元に、今週発信すべきテーマ案を `TopicBacklog` に作成します。
5.  **「5. ステークホルダー分析」**
    - テーマ案に関連する利害関係者を `StakeholderMap` に洗い出します。
6.  **「6. コンテンツ生成 (Shorts)」**
    - テーマ案を元にショート動画の台本を作成します。

---

## 📂 ファイル構成

```
src/
├── main.gs                 # エントリーポイント・メニュー定義
├── config/
│   └── _Config.gs          # 設定ファイル
├── models/                 # データ型定義 (JSDoc)
├── repositories/           # スプレッドシート操作
│   ├── SheetAccess.gs      # シート操作の基盤クラス
│   └── *Repo.gs            # 各シート専用のリポジトリ
├── services/
│   ├── ProjectManager.gs   # プロジェクトスプシ管理
│   ├── DeepResearchService.gs # 多面的深掘り調査
│   ├── SetupService.gs     # 初期セットアップ
│   ├── FetchService.gs     # RSS収集
│   ├── ScreeningService.gs # AIスクリーニング
│   ├── EvidenceService.gs  # 単一記事調査 (旧)
│   ├── TopicService.gs     # テーマ生成
│   ├── StakeholderService.gs # ステークホルダー分析
│   ├── ContentService.gs   # 台本生成
│   ├── SourceDiscoveryService.gs # 収集先自動開拓
│   └── _GeminiService.gs   # Gemini API連携
└── utils/
```

## ドキュメント
- [要件定義書](要件定義書.md)
- [技術要件定義書](技術要件定義書.md)
- [システム設計：スプレッドシート集約型](docs/system_design_spreadsheet_centric.md)
