# 開発進捗レポート

**最終更新**: 2026/1/21  
**担当**: AI Assistant  
**プロジェクト**: Contents Builder - Deep Research 機能強化

---

## 完了した実装（Phase 1-3）

### Phase 1: シート構造の拡張 ✅

**目的**: 信頼性評価、バイアス検出、ファクトチェックに対応するシート構造を構築

**実装内容**:
- `01_Research` シートに以下のカラムを追加:
  - `source_type`: ソースの種類（news/official/law/statistics/stakeholder）
  - `reliability_score`: 信頼性スコア（0-100）
  - `bias_indicator`: バイアス指標（neutral/pro/con/unknown）
  - `fact_check_status`: ファクトチェック状態（verified/conflicting/unverified）
  - `stakeholder`: 関連ステークホルダー名

- 新規シート追加:
  - `04_FactCheck`: 元記事の主張と一次ソースを照合（将来的に実装）
  - `05_Timeline`: 関連イベントを時系列で整理（将来的に実装）

**変更ファイル**:
- `src/services/ProjectManager.gs`

**Commit**: `2d3c52c`

---

### Phase 2: 一次ソース収集機能 ✅

**目的**: Google Newsだけでなく、政府機関・法令・統計データを直接収集

**実装内容**:

#### 1. `PrimarySourceService.gs`（新規作成）
- **政府機関プレスリリース収集**: 環境省、農林水産省、厚労省、内閣官房
- **法令情報収集**: e-Gov法令検索から関連法令を取得
- **統計データ収集**: e-Stat政府統計ポータルから統計を取得
- **Geminiによるクエリ生成**: 記事から一次ソース検索用のキーワードを自動生成

#### 2. `FetchService.gs`（拡張）
- `fetchByQuery()` に `limit` と `timeRange` パラメータを追加
- 取得件数と期間を柔軟に制御可能に

#### 3. `DeepResearchService.gs`（大幅改修）
- **2段階収集プロセス**:
  1. 一次ソース収集（PrimarySourceService）
  2. 二次ソース収集（ニュース記事）
- 拡張されたシート構造に対応（source_type, reliability_score などを設定）

**変更ファイル**:
- `src/services/PrimarySourceService.gs`（新規）
- `src/services/FetchService.gs`
- `src/services/DeepResearchService.gs`

**Commit**: `fe52e54`

---

### Phase 3: 信頼性評価エンジン ✅

**目的**: 収集した情報の信頼性を自動評価し、質の低い情報を識別

**実装内容**:

#### `ReliabilityEvaluator.gs`（新規作成）

**3段階評価システム**:
```
reliability_score = base_score + source_bonus + clarity_bonus

1. Base Score (0-50): メディアごとの基礎スコア
   - 政府機関（env.go.jp等）: 50
   - NHK, 朝日, 読売等: 40-45
   - Yahoo, Google News: 30-35
   - 不明サイト: 10-20

2. Source Bonus (0-30):
   - 一次ソース（official/law/statistics）: +30
   - 二次ソース（news）: +10

3. Clarity Bonus (0-20): Geminiによる根拠明確度評価
   - 数値・日付・情報源が明示: +20
   - やや曖昧: +10
   - 根拠不明: 0
```

**メディア信頼度マスタ**: 50以上のメディア・機関をドメイン別に定義

**統合**:
- `DeepResearchService.conductResearch()` 内で全記事を自動評価
- 評価結果を `01_Research` シートの `reliability_score` 列に保存

**変更ファイル**:
- `src/utils/ReliabilityEvaluator.gs`（新規）
- `src/services/DeepResearchService.gs`

**Commit**: `bb08051`

---

## 追加実装：ハイブリッド収集戦略 ✅

**目的**: 無駄な記事を削減しつつ、重要な時事問題は見逃さない

**実装内容**:

### `SourceDiscoveryService.gs`（大幅改修）

**2種類のキーワード生成**:
1. **ベースキーワード（1-2個）**: テーマそのもの
   - 例: 「動物愛護」「保護猫」
   - 期間: 過去1日（トレンド重視）
   
2. **政策焦点キーワード（3-4個）**: テーマ + 法律・政治ワード
   - 例: 「動物愛護 AND (法律 OR 改正 OR 政策)」
   - 期間: 過去1週間（政策性重視）
   - Google検索演算子（AND/OR）を使用

**効果**:
- エンタメ的記事（例: 「かわいい猫の動画」）を大幅削減
- 法改正・行政発表など、確実にスクリーニングを通過する記事を優先収集

**変更ファイル**:
- `src/services/SourceDiscoveryService.gs`

**Commit**: `a2e4553`

---

## 未実装機能（Phase 6）

これらは `docs/deep_research_enhancement_plan.md` に詳細設計済み。

---

### Phase 6: 時系列分析機能

**目的**: 「なぜ今この問題が?」を理解するための時系列情報収集

**実装計画**:
- `TimelineService.gs` を新規作成
- 機能:
  - 過去1年分の関連記事を収集（`when:1y`）
  - e-Gov APIで法改正履歴を取得
  - Geminiで重要イベントを抽出
  - `05_Timeline` シートに時系列で記録

---

## 技術的改善点

### 1. トリガーベース並列処理（完了済み）
- `TriggerManager.gs` を新規作成
- 一次ソース調査を3分後にトリガー実行
- 各アイテムを30秒ずつずらして並列処理
- `LockService` による排他制御で重複実行を防止

### 2. ステータス管理（完了済み）
- `Outputs` シートに `research_status` カラム追加
- ステータス: `pending` → `processing` → `completed/failed`
- `OutputsRepo` に状態管理メソッドを追加

### 3. スプレッドシート準備完了待機（完了済み）
- `ProjectManager.createProject()` に2秒のsleepを追加
- Googleのバックエンド処理完了を待機

---

## 現在のシステムフロー

```
【収集テーマ追加】
  ↓ Gemini
ベースKW（1日）+ 政策KW（1週間）で収集
  ↓
【定期収集 (FetchService)】
  ↓
IntakeQueue に保存
  ↓
【スクリーニング (ScreeningService)】
  ↓ animal_score + policy_score >= 7
promoted ステータス
  ↓
【一次ソース調査 (DeepResearchService)】
  ↓
Step 1: 一次ソース収集（政府・法令・統計）
Step 2: 多面的視点での調査計画生成 🆕
  - queries_pro（推進派）
  - queries_con（反対派）
  - queries_neutral（中立）
  - queries_primary（一次ソース）
Step 3: 視点別に記事収集 🆕
  - 推進派記事（bias_indicator: pro）
  - 反対派記事（bias_indicator: con）
  - 中立記事（bias_indicator: neutral）
  - 追加の一次ソース（bias_indicator: neutral）
Step 4: 信頼性評価（0-100点）
Step 5: プロジェクトシートに保存
Step 6: ファクトチェック実行 🆕
  - 元記事から数値・日付を抽出
  - 一次ソースと照合
  - 04_FactCheck シートに記録
  ↓
01_Research シートに集約
（source_type, reliability_score, bias_indicator 等を記録）
04_FactCheck シートにファクトチェック結果を記録 🆕
```

---

## 次回への引き継ぎ事項

### 優先度中（推奨実装）
1.  **Phase 6: 時系列分析機能**
    - 背景理解に有用
    - 法改正履歴や重要イベントの可視化

### 検討事項
- **Gemini API のコスト監視**: 現在、記事ごとに複数回API呼び出しを行っているため、利用量を確認
- **エラーハンドリングの強化**: 一次ソース収集失敗時のフォールバック処理を検討
- **パフォーマンス最適化**: Utilities.sleep() の調整やバッチ処理の改善

---

## 参考ドキュメント

- [深掘り調査拡張計画](docs/deep_research_enhancement_plan.md): Phase 2-6の詳細設計
- [Gemini API利用ガイド](docs/gemini_api_guide.md): API設定・モデル選択
- [システム設計書](docs/system_design_spreadsheet_centric.md): 全体アーキテクチャ

---

---

### Phase 4: 多面的視点収集 ✅

**目的**: 賛成派・反対派・中立の視点を明示的に収集し、偏向を防ぐ

**実装内容**:

#### `DeepResearchService.gs`（大幅改修）

**1. planResearch() の改善**:
- 従来: 3つの一般的なクエリのみ生成
- 改善後: 4種類の視点別クエリを生成
  - `queries_pro`: 推進派・賛成派の意見
  - `queries_con`: 反対派・慎重派の意見
  - `queries_neutral`: 中立的な分析
  - `queries_primary`: 一次ソース（site:演算子使用）

**2. conductResearch() の改善**:
- 視点別に記事を収集し、各記事に適切な `bias_indicator` を設定
  - 推進派記事 → `bias_indicator: 'pro'`
  - 反対派記事 → `bias_indicator: 'con'`
  - 中立記事 → `bias_indicator: 'neutral'`
  - 一次ソース → `bias_indicator: 'neutral'`

**3. フォールバック機能**:
- Gemini APIエラー時の代替処理を追加（`_getFallbackPlan()`）
- レスポンス検証機能を実装

**4. 視点別統計ログ**:
- 収集結果をpro/con/neutral/primaryで集計してログ出力

**効果**:
- 偏向防止: 賛成・反対両方の意見を確実に収集
- 視点の可視化: `01_Research` シートで立場が一目瞭然
- バランスの取れたコンテンツ生成が可能

**変更ファイル**:
- `src/services/DeepResearchService.gs`

**Commit**: （次回コミット時に記録）

---

### Phase 5: ファクトチェック機能 ✅

**目的**: 元記事の数値・日付を一次ソースと照合し、誤情報を検出

**実装内容**:

#### `FactCheckService.gs`（新規作成）

**主要メソッド**:
1. **extractClaims()**: 
   - Geminiで元記事から検証すべき数値・日付を抽出
   - JSON Schema: `{ claims: [{ claim_text, claim_value, claim_type }] }`
   - 最大5つまで

2. **verifyClaim()**:
   - 一次ソースから関連する数値を検索
   - 値を比較（±5%の許容範囲）
   - 判定: `verified` / `conflicting` / `unverified`

3. **verify()**:
   - メインメソッド：全体のフローを統合
   - `04_FactCheck` シートに結果を記録

**処理フロー**:
```
1. 元記事から数値抽出（Gemini）
2. プロジェクトシートから一次ソース取得
3. 一次ソースで数値検索（Gemini）
4. 値を比較・判定
5. 04_FactCheck シートに記録
```

**数値比較ロジック**:
- 完全一致チェック
- 数値型：±5%の許容範囲
- 日付型：完全一致のみ

**統合**:
- `DeepResearchService.conductResearch()` に Step 6 として追加
- 信頼性評価の後、プロジェクトシート保存と並行して実行

**変更ファイル**:
- `src/services/FactCheckService.gs`（新規）
- `src/services/DeepResearchService.gs`

**Commit**: （次回コミット時に記録）

---

## 変更履歴

| 日付 | Phase | Commit | 概要 |
|------|-------|--------|------|
| 2026/01/20 | Phase 1 | 2d3c52c | シート構造拡張 |
| 2026/01/20 | Phase 2 | fe52e54 | 一次ソース収集機能 |
| 2026/01/20 | - | a2e4553 | ハイブリッド収集戦略 |
| 2026/01/21 | Phase 3 | bb08051 | 信頼性評価エンジン |
| 2026/01/21 | Phase 4 | - | 多面的視点収集 |
| 2026/01/21 | Phase 5 | - | ファクトチェック機能 |
