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

## 未実装機能（Phase 4-6）

これらは `docs/deep_research_enhancement_plan.md` に詳細設計済み。

### Phase 4: 多面的視点収集

**目的**: 賛成派・反対派・中立の視点を明示的に収集し、偏向を防ぐ

**実装計画**:
- `planResearch()` のプロンプトを改善
- 4種類のクエリを生成:
  - `queries_pro`: 推進派の意見
  - `queries_con`: 反対派の意見
  - `queries_neutral`: 中立的分析
  - `queries_primary`: 一次ソース
- 各記事に `bias_indicator` を設定（pro/con/neutral）

---

### Phase 5: ファクトチェック機能

**目的**: 元記事の数値・日付を一次ソースと照合し、誤情報を検出

**実装計画**:
- `FactCheckService.gs` を新規作成
- プロセス:
  1. Geminiで元記事から数値・日付を抽出
  2. 一次ソースで同じ情報を検索
  3. 値を比較して一致/不一致を判定
  4. 結果を `04_FactCheck` シートに記録

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
Step 2: 二次ソース収集（ニュース記事）
Step 3: 信頼性評価（0-100点）
Step 4: プロジェクトシートに保存
  ↓
01_Research シートに集約
（source_type, reliability_score, bias_indicator 等を記録）
```

---

## 次回への引き継ぎ事項

### 優先度高（推奨実装）
1.  **Phase 4: 多面的視点収集**
    - 最も効果が高く、実装も比較的容易
    - 偏向防止に直結

2.  **Phase 5: ファクトチェック機能**
    - 数値の誤りを自動検出
    - 信頼性向上に寄与

### 優先度中
3.  **Phase 6: 時系列分析機能**
    - 背景理解に有用だが、Phase 4-5より優先度は低い

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

## 変更履歴

| 日付 | Phase | Commit | 概要 |
|------|-------|--------|------|
| 2026/01/20 | Phase 1 | 2d3c52c | シート構造拡張 |
| 2026/01/20 | Phase 2 | fe52e54 | 一次ソース収集機能 |
| 2026/01/20 | - | a2e4553 | ハイブリッド収集戦略 |
| 2026/01/21 | Phase 3 | bb08051 | 信頼性評価エンジン |
