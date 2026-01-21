# 開発進捗レポート

**最終更新**: 2026/1/21  
**担当**: AI Assistant  
**プロジェクト**: Contents Builder - Deep Research 機能強化

---

## 完了した実装（Phase 1-6）

### Phase 6: 時系列分析機能 ✅

**目的**: 「なぜ今この問題が?」を理解するための時系列情報収集

**実装内容**:

#### `TimelineService.gs`（新規作成）
- **過去記事収集**: Google News RSS (`when:1y`) で過去1年間の記事を収集
- **法改正履歴収集**: e-Gov (`site:elaws.e-gov.go.jp`) から法改正情報を収集
- **Geminiによるイベント抽出**:
  - 全記事から「法改正」「事件」「政策」「統計」などの重要イベントを抽出
  - JSON Schema: `{ events: [{ date, event, category, source_url }] }`
- **シート保存**: `05_Timeline` シートに時系列で保存

#### `DeepResearchService.gs`（拡張）
- **調査計画 (`planResearch`)**: `queries_timeline` (時系列調査用クエリ) の自動生成を追加
- **調査実行 (`conductResearch`)**: 全ての調査完了後に `TimelineService.analyze()` を実行

**変更ファイル**:
- `src/services/TimelineService.gs`（新規）
- `src/services/DeepResearchService.gs`

**Commit**: （次回コミット時に記録）

---

### 技術的改善点：トリガー実行間隔の最適化 ✅

**目的**: Deep Research の重複実行によるエラー発生リスクを低減

**実装内容**:
- `processPromotedItems` におけるトリガー登録間隔を **0.5分 (30秒)** から **2分 (120秒)** に拡大
- 各処理が確実に完了してから次の処理が開始されるよう調整

**変更ファイル**:
- `src/services/DeepResearchService.gs`

---

## 完了した実装（Phase 1-5）

### Phase 1: シート構造の拡張 ✅
- `source_type`, `reliability_score`, `bias_indicator` 等のカラム追加
- `04_FactCheck`, `05_Timeline` シートの定義

### Phase 2: 一次ソース収集機能 ✅
- `PrimarySourceService.gs`: 政府機関、法令、統計の収集

### Phase 3: 信頼性評価エンジン ✅
- `ReliabilityEvaluator.gs`: メディア信頼度 + Gemini評価でスコアリング

### Phase 4: 多面的視点収集 ✅
- 4つの視点（賛成/反対/中立/一次）でのクエリ生成と記事収集
- `bias_indicator` によるバイアス可視化

### Phase 5: ファクトチェック機能 ✅
- `FactCheckService.gs`: 数値・日付の自動抽出と一次ソースとの照合

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
【トリガー登録 (DeepResearchService)】
  ↓ ※ 2分間隔でスケジュール
【一次ソース調査 (DeepResearchService)】
  ↓
Step 1: 一次ソース収集（政府・法令・統計）
Step 2: 多面的視点での調査計画生成（queries_timeline追加）🆕
Step 3: 視点別に記事収集 (pro/con/neutral)
Step 4: 信頼性評価（0-100点）
Step 5: プロジェクトシートに保存
Step 6: ファクトチェック実行
Step 7: 時系列分析実行 (TimelineService) 🆕
  - 過去記事・法改正履歴を収集
  - 重要イベント抽出
  - 05_Timeline シートに記録
  ↓
完了（OutputsRepo: completed）
```

---

## 次回への引き継ぎ事項

### 検討事項
- **Gemini API のコスト監視**: 時系列分析の追加により入力トークン数が増加。必要に応じて記事要約の文字数制限を調整。
- **エラーハンドリングの強化**: 外部サイト（e-Gov等）へのアクセス失敗時のフォールバック。

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
| 2026/01/21 | Phase 6 | - | 時系列分析機能・トリガー最適化 |
