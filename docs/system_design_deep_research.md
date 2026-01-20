# システム構成変更案：多面的深掘り調査 (Deep Research) 機能

## 1. 概要
現在の「単一記事からの情報抽出」を拡張し、AIが自律的に周辺情報を収集・検証し、情報の正確性と網羅性を高める「リサーチエージェント機能」を導入する。

## 2. アーキテクチャ変更点

### 2.1 新規サービスの導入
既存の `EvidenceService` の上に、統括的な調査を行う `DeepResearchService` を新設する。

- **`DeepResearchService`**: 調査全体の指揮・統合を行う。
- **`EvidenceService`** (既存): 個別の記事/URLからの情報抽出に特化させる（部品化）。
- **`FetchService`** (拡張): 登録済みRSSだけでなく、動的に生成されたクエリでの一時的な検索・収集に対応させる。

### 2.2 データフローの刷新

```mermaid
graph TD
    A[Promoted Item] --> B[DeepResearchService]
    B -->|1. 初期分析| C[Gemini: 調査計画生成]
    C -->|問い・検索語| D[FetchService (Search)]
    D -->|関連RSS検索| E[追加記事リスト]
    E -->|2. 各記事解析| F[EvidenceService]
    F -->|Claim/Evidence| G[EvidenceIndex]
    G -->|3. 統合・検証| H[Gemini: 整合性チェック]
    H -->|レポート生成| I[01_research_report.md]
    I -->|入力| J[ContentService (台本作成)]
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
Driveに `01_research_report.md` を生成する。
- **Summary**: テーマの概要。
- **Fact Check**: 検証結果（一致/不一致/保留）。
- **Timeline**: 関連する時系列。
- **Perspectives**: 主要な論点と各ステークホルダーの主張。
- **References**: 参照した全ての一次ソース・記事リンク。

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
