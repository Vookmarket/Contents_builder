# システム構成変更案：多面的深掘り調査 (Deep Research) 機能

## 1. 概要
現在の「単一記事からの情報抽出」を拡張し、AIが自律的に周辺情報を収集・検証し、情報の正確性と網羅性を高める「リサーチエージェント機能」を導入する。

## 2. アーキテクチャ変更点

### 2.1 新規サービスの導入
既存の `EvidenceService` の上に、統括的な調査を行う `DeepResearchService` を新設し、専門的なサブサービスと連携させる。

- **`DeepResearchService`**: 調査全体の指揮・統合を行う。
- **`PrimarySourceService`**: 政府機関・法令・統計データの直接収集。
- **`TimelineService`**: 過去記事検索と法改正履歴の収集・分析。
- **`FactCheckService`**: 数値・日付の整合性チェック。
- **`FetchService`** (拡張): 動的クエリによる一時的な検索・収集。

### 2.2 データフローの刷新

```mermaid
graph TD
    A[Promoted Item] --> B[DeepResearchService]
    B -->|1. 計画| C[Gemini: 多面的視点クエリ生成]
    C --> D[PrimarySourceService]
    C --> E[FetchService (News)]
    D & E -->|収集結果| F[ReliabilityEvaluator]
    F -->|信頼性評価| G[Project Spreadsheet]
    G -->|2. 検証| H[FactCheckService]
    H -->|3. 分析| I[TimelineService]
    G & H & I -->|統合データ| J[Topic/Stakeholder/Content Service]
```

## 3. 実装詳細

### 3.1 調査計画の生成 (Research Planning)
Geminiに対し、元記事を入力として以下の情報を生成させる。
- **Verification Points**: 検証すべき事実（数字、引用、時系列）。
- **Missing Context**: 不足している背景情報（過去の経緯、法律の条文、専門用語）。
- **Search Queries**: 上記を埋めるための検索キーワード（例: `site:env.go.jp 動物愛護法 改正 経緯`）。

### 3.2 追加情報の収集 (Dynamic Fetching)
生成された検索キーワードを用いて、Google News RSSなどを動的に生成し、直近の記事やリリースを収集する。
- 既存の `SourceDiscoveryService` のロジックを応用し、一時的なRSS URLを生成して `FetchService` で取得する。

### 3.3 情報の統合と整合性チェック (Synthesis)
元記事の主張と、追加収集した記事の内容を突き合わせる。
- **Fact Checking**: 数字や日付が一致しているか。
- **Perspective**: 立場の違いによる見解の相違がないか。
- **Completeness**: 不足していた背景情報が補完されたか。

### 3.4 成果物
プロジェクト専用スプレッドシートに構造化データを保存する。
- **01_Research**: 全記事リスト（信頼性スコア、バイアス判定付き）。
- **04_FactCheck**: 数値・日付の検証結果。
- **05_Timeline**: 時系列イベントリスト。

## 4. 既存コードへの影響

- `src/services/EvidenceService.gs`:
    - `analyzeContent` はそのまま利用可能。
    - `processPromotedItems` のロジックを `DeepResearchService` に移譲するか、書き換える。
- `src/services/FetchService.gs`:
    - 指定されたURL（動的RSS）から即座にアイテムリストを返す `fetchTemporaryUrl(url)` メソッドを追加する。
- `src/main.gs`:
    - メニューの「3. 一次ソース調査」の呼び出し先を `DeepResearchService` に変更する。

## 5. 期待される効果
- コンテンツ作成時に、単なる「ニュースの要約」ではなく、「裏付けの取れた解説」が可能になる。
- 誤情報や偏った情報に基づく発信リスクを低減できる。
