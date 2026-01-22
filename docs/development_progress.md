# 開発進捗レポート

**最終更新**: 2026/1/21  
**担当**: AI Assistant  
**プロジェクト**: Contents Builder - Deep Research 機能強化

---

## 完了した実装（Phase 7-9）

Deep Research で収集したデータを活用し、後半フェーズ（テーマ生成・分析・コンテンツ化）を高度化しました。

### Phase 7: テーマ案生成の高度化 ✅
**目的**: 一次ソースや時系列情報を反映した、深みのあるテーマ案を生成
- **改修内容 (`TopicService.gs`)**:
  - `generateTopicsFromDeepResearch()` を実装
  - プロジェクトシートの `01_Research` (重要記事) と `05_Timeline` (時系列) を読み込み
  - Geminiにコンテキストとして与え、「なぜ今？」という切り口を提案

### Phase 8: ステークホルダー分析の高度化 ✅
**目的**: 記事のバイアス情報から利害関係を詳細に分析
- **改修内容 (`StakeholderService.gs`)**:
  - `analyzeStakeholdersFromDeepResearch()` を実装
  - `01_Research` の `bias_indicator` (pro/con) や `stakeholder` カラムを活用
  - 対立構造や背後にある利害を Gemini で抽出

### Phase 9: コンテンツ生成の高度化 ✅
**目的**: 検証済みの事実に基づいた信頼性の高い台本を作成
- **改修内容 (`ContentService.gs`)**:
  - `generateContentFromDeepResearch()` を実装
  - `04_FactCheck` の検証済み数値 (`verified`) を優先的に使用
  - 生成された台本をプロジェクトシートの `03_Drafts` に保存（一元管理）

---

## 完了した実装（Phase 1-6）

### Phase 6: 時系列分析機能 ✅
- `TimelineService.gs`: 過去記事収集とイベント抽出
- `DeepResearchService.gs`: 調査フローへの統合

### Phase 1-5
- シート構造拡張、一次ソース収集、信頼性評価、多面的視点、ファクトチェック機能の実装完了

---

## 技術的改善点

### プロジェクトシート保存場所の変更 ✅
- 生成されるスプレッドシートを、スクリプト実行元のスプレッドシートと同じフォルダ内の `ContentsBuilder_Output` に保存するように変更 (`ProjectManager.gs`)

### トリガー実行間隔の最適化 ✅
- Deep Research の実行間隔を 2分 に拡大 (`DeepResearchService.gs`)

---

## 現在のシステムフロー（完全版）

```
【収集テーマ追加】
  ↓
【定期収集】-> IntakeQueue
  ↓
【スクリーニング】-> Promoted Items
  ↓
【一次ソース調査 (Deep Research)】
  - 一次ソース収集
  - 多面的視点収集 (Pro/Con/Neutral)
  - 信頼性評価
  - ファクトチェック
  - 時系列分析 (Timeline)
  ↓ プロジェクトシート作成
【テーマ案生成 (Phase 7)】
  - Timeline/Researchデータを活用
  - TopicBacklog に保存
  ↓
【ステークホルダー分析 (Phase 8)】
  - Researchデータのバイアスを活用
  - StakeholderMap に保存
  ↓
【コンテンツ生成 (Phase 9)】
  - FactCheck/Timelineデータを活用
  - プロジェクトシート (03_Drafts) に台本保存
```

---

## 安定化・改善 (2026/01/21)

### タイムアウト対策の実装 ✅
Deep Research実行時のタイムアウト問題に対応するため、処理を5ステップに分割しました。
- **Step 1a**: 一次ソース収集（PrimarySourceService）
- **Step 1b**: 調査計画生成 + 多面的記事収集
- **Step 2**: 信頼性評価
- **Step 3**: ファクトチェックと時系列分析

各ステップは独立したトリガー実行として動作し、それぞれが新しい6分枠を持ちます。ステップ間は約1分間隔で自動的にチェーンされます。

### ステータス管理の修正 ✅
- `OutputsRepo` への初期ステータス登録処理を追加し、トリガー実行時の `status: null` 問題を解決しました。

### 記事検索の抜本的改善 ✅
RSS検索からGemini Grounding (Google Search) への移行により、検索ヒット率が大幅に向上しました。
- **従来**: Google News RSSを直接検索（キーワード一致）
- **新方式**: Geminiに検索を依頼し、構造化されたJSONで記事を取得
- **効果**: 複雑なクエリや日本語検索でもヒット率が向上、空白シートの問題を解消

---

## 次回への引き継ぎ事項

### 運用テスト
- 実際のスプレッドシートで一連のフロー（1〜9）を実行し、動作を確認してください。
- Gemini Grounding のトークン使用量や実行時間、検索精度に注意が必要です。

---

## 変更履歴

| 日付 | Phase | Commit | 概要 |
|------|-------|--------|------|
| 2026/01/20 | Phase 1-2 | - | シート拡張・一次ソース収集 |
| 2026/01/21 | Phase 3-5 | - | 信頼性評価・多面的視点・ファクトチェック |
| 2026/01/21 | Phase 6 | f657d20 | 時系列分析・トリガー最適化 |
| 2026/01/21 | Phase 7-9 | - | テーマ・分析・コンテンツ生成の高度化 |
| 2026/01/21 | 安定化 | 6ce4022, 3d68b12, 51fa05b | ステップ実行化・ステータス初期化 |
| 2026/01/21 | 改善 | 391d8a6, 9fa23f2 | 検索クエリ最適化・Gemini Grounding導入 |
| 2026/01/22 | 最適化 | 6ea05cd | Step 1を1a/1bに細分化（タイムアウト完全対策） |
