# Contents Builder (Animal x Politics Info Automation)

動物×政治情報アカウントの運営を支援・自動化するためのツールです。
Google スプレッドシート上で動作し、AI (Gemini) を使って情報収集から台本作成までを一気通貫で自動化します。

## ✨ 機能一覧

1.  **ハイブリッド情報収集**: 
    - **ベースキーワード**: トレンド重視（過去1日）
    - **政策焦点キーワード**: 法律・政策性重視（過去1週間、AND/OR演算子使用）
    - エンタメ記事を削減し、政策性の高い記事を優先収集

2.  **AIスクリーニング**: 
    - 収集した記事をAIが評価・要約
    - `animal_score` + `policy_score` >= 7 で重要記事を自動判定

3.  **多面的深掘り調査 (Deep Research)** 🆕:
    - **一次ソース収集**: 政府機関プレスリリース、法令、統計データを直接取得
    - **多面的視点収集**: 推進派・反対派・中立の4視点から情報を収集し、偏向を防止
    - **信頼性評価**: 全記事を0-100点で自動評価（メディア信頼度 + Gemini判定）
    - **ファクトチェック**: 元記事の数値を一次ソースと照合し、誤情報を自動検出
    - **時系列分析** 🆕: 過去1年のニュースと法改正履歴を収集し、「なぜ今？」という背景を可視化
    - 情報を集約した **「専用スプレッドシート」** を自動生成

4.  **テーマ案生成 (高度化)**: 
    - Deep Researchの結果（時系列・対立構造）を踏まえ、深みのある企画テーマを提案
    - `01_Research` や `05_Timeline` のデータを活用

5.  **ステークホルダー分析 (高度化)**: 
    - 記事のバイアス情報から、各アクターのスタンス（賛成・反対）や利害関係を詳細に分析

6.  **コンテンツ生成 (高度化)**: 
    - 検証済みの数値 (`verified`) を優先的に使用した、信頼性の高いショート動画台本を生成

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
    - Deep Researchの結果（重要記事・時系列）を読み込み、多角的な視点からテーマ案を作成します。
5.  **「5. ステークホルダー分析」**
    - プロジェクトシートの記事情報から、アクター間の利害対立を詳細に分析します。
6.  **「6. コンテンツ生成 (Shorts)」**
    - ファクトチェック済みの数値や時系列情報を反映した、信頼性の高い台本を生成し、プロジェクトシート (`03_Drafts`) に保存します。

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
│   ├── FactCheckService.gs # ファクトチェック機能
│   ├── PrimarySourceService.gs # 一次ソース収集
│   ├── SetupService.gs     # 初期セットアップ
│   ├── FetchService.gs     # RSS収集
│   ├── ScreeningService.gs # AIスクリーニング
│   ├── TopicService.gs     # テーマ生成
│   ├── StakeholderService.gs # ステークホルダー分析
│   ├── ContentService.gs   # 台本生成
│   ├── TimelineService.gs  # 時系列分析 🆕
│   ├── SourceDiscoveryService.gs # 収集先自動開拓
│   └── _GeminiService.gs   # Gemini API連携
└── utils/
    ├── ReliabilityEvaluator.gs # 信頼性評価
    └── TriggerManager.gs   # トリガー管理
```

## 📚 ドキュメント

### システム設計
- [要件定義書](要件定義書.md)
- [技術要件定義書](技術要件定義書.md)
- [システム設計：スプレッドシート集約型](docs/system_design_spreadsheet_centric.md)
- [Deep Research 機能強化計画](docs/deep_research_enhancement_plan.md)

### 開発進捗
- [開発進捗レポート](docs/development_progress.md) - Phase 1-5 の実装完了状況と次回への引き継ぎ事項

### API・技術情報
- [Gemini API 利用ガイド](docs/gemini_api_guide.md)

---

## 🆕 最新アップデート（2026/01/21）

### Phase 1-9: Deep Research 機能完全実装 ✅

#### Phase 6: 時系列分析機能
- **過去記事・法改正履歴の収集**: `when:1y` や `site:elaws.e-gov.go.jp` を活用
- **重要イベント抽出**: Geminiにより「法改正」「事件」「統計」などのイベントを時系列で整理

#### Phase 7-9: 後工程の高度化
- **テーマ案生成**: Deep Researchのコンテキスト（時系列・対立）を反映した企画立案
- **ステークホルダー分析**: 記事のバイアス情報 (`pro`/`con`) を活用した利害分析
- **コンテンツ生成**: 検証済みファクト (`verified`) を優先使用した高信頼性台本の生成

#### システム改善
- **プロジェクトシート保存先の最適化**: メインスプレッドシートと同じフォルダに自動保存
- **トリガー実行の安定化**: 実行間隔を最適化し、重複実行を防止

詳細は [開発進捗レポート](docs/development_progress.md) を参照してください。
