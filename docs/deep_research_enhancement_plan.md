# Deep Research機能拡張計画

## 現在のステータス
**全フェーズ（Phase 1-9）の実装および安定化（タイムアウト対策）が完了しました。**

---

## Phase 1: シート構造の拡張 ✅

### 実装済み内容
- `01_Research` シートに以下のカラムを追加:
  - `source_type`: ソースの種類（`"news"`, `"official"`, `"law"`, `"statistics"`, `"stakeholder"`）
  - `reliability_score`: 信頼性スコア（0-100）
  - `bias_indicator`: バイアス指標（`"neutral"`, `"pro"`, `"con"`, `"unknown"`）
  - `fact_check_status`: ファクトチェック状態（`"verified"`, `"conflicting"`, `"unverified"`）
  - `stakeholder`: 関連ステークホルダー名

- 新規シート `04_FactCheck`:
  - 元記事の主張と一次ソースを照合する専用シート

- 新規シート `05_Timeline`:
  - 関連イベントを時系列で整理

---

## Phase 2: 一次ソース収集機能 ✅

### 実装完了: `PrimarySourceService.gs`

**機能**:
1.  **政府機関プレスリリース収集**
2.  **法令情報の取得**
3.  **統計データの取得**

---

## Phase 3: 信頼性評価エンジン ✅

### 実装完了: `ReliabilityEvaluator.gs`

**機能**:
- 収集した情報の信頼性を自動評価（Gemini + ルールベース）
- スコアリングロジックによる定量評価

---

## Phase 4: 多面的視点収集 ✅

### 実装完了: `DeepResearchService.planResearch()`

**機能**:
- 4種類の視点別クエリ（Pro/Con/Neutral/Primary）を生成
- バランスの取れた情報収集を実現

---

## Phase 5: ファクトチェック機能 ✅

### 実装完了: `FactCheckService.gs`

**機能**:
- 元記事の数値・日付を一次ソースと照合
- 結果を `04_FactCheck` シートに記録

---

## Phase 6: 時系列分析機能 ✅

### 実装完了: `TimelineService.gs`

**機能**:
- 過去の関連記事収集
- 重要イベントの時系列抽出
- `05_Timeline` シートへの保存

---

## Phase 7: テーマ案生成の高度化 ✅

### 実装完了: `TopicService.gs`

**機能**:
- Deep Researchの結果（Research/Timeline）を活用したテーマ立案
- 「なぜ今語るべきか」というAngleの提案
- `TopicBacklog` への保存

---

## Phase 8: ステークホルダー分析の高度化 ✅

### 実装完了: `StakeholderService.gs`

**機能**:
- 記事のバイアス情報から利害関係を分析
- 対立構造の可視化
- `StakeholderMap` への保存

---

## Phase 9: コンテンツ生成の高度化 ✅

### 実装完了: `ContentService.gs`

**機能**:
- 検証済みファクトに基づいた台本生成
- ショート動画用スクリプトの作成
- `03_Drafts` への保存

---

## 運用フローの改善（タイムアウト対策） ✅

Deep Researchの実行時間が長大になる問題に対処するため、処理を3つのステップに分割し、Continuation Pattern（継続実行）を導入しました。

1.  **Step 1 (Collection)**: 記事収集・一次保存
2.  **Step 2 (Evaluation)**: 信頼性評価
3.  **Step 3 (Analysis)**: ファクトチェック・時系列分析

各ステップはトリガーによって数珠繋ぎに実行され、GASの実行時間制限（6分）を回避します。
