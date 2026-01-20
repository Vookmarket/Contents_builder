# Deep Research機能拡張計画

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

## Phase 2: 一次ソース収集機能（未実装）

### 実装予定: `PrimarySourceService.gs`

**目的**: Google Newsだけでなく、公的機関の一次情報を直接収集

**機能**:
1.  **政府機関プレスリリース収集**
    - 環境省、農林水産省、厚生労働省のサイトから「動物」「愛護」関連のプレスリリースを検索
    - 実装方法: `site:env.go.jp プレスリリース 動物愛護 2024` などのクエリでGoogle検索

2.  **法令情報の取得**
    - e-Gov法令検索から関連法令の条文を取得
    - 実装方法: `site:elaws.e-gov.go.jp 動物愛護管理法` などで検索
    - 改正履歴も取得可能であれば取得

3.  **統計データの取得**
    - e-Stat（政府統計ポータル）から動物関連統計を取得
    - 例: 殺処分数、飼育頭数、虐待事案数

**統合ポイント**:
- `DeepResearchService.conductResearch()` 内で、通常のニュース収集の前に一次ソース収集を実行
- 収集した情報は `source_type="official"` または `"law"` で `01_Research` に保存

---

## Phase 3: 信頼性評価エンジン（未実装）

### 実装予定: `ReliabilityEvaluator.gs`

**目的**: 収集した情報の信頼性を自動評価

**スコアリングロジック**:
```javascript
reliability_score = base_score + source_bonus + clarity_bonus

base_score (0-50): メディアごとの基礎スコア
  - NHK, 朝日, 読売など大手: 40-50
  - Yahoo, Google News: 30-40
  - 不明なブログ: 10-20
  
source_bonus (0-30):
  - 一次ソース（公式サイト、法令）: +30
  - 二次ソースだが引用明示: +20
  - 引用なし: 0

clarity_bonus (0-20): Geminiによる評価
  - 根拠が明確: +20
  - やや曖昧: +10
  - 根拠不明: 0
```

**Gemini評価プロンプト**:
```
「以下の記事について、主張の根拠が明確に示されているか評価してください。
- 数値や日付が具体的に示されている
- 情報源（一次ソース）が明記されている
- 専門家のコメントがある

評価: 0（根拠不明）〜 20（非常に明確）」
```

**統合ポイント**:
- 収集した各記事に対して評価を実行
- `reliability_score` 列に記録
- スコアが低い（30点未満）記事には警告フラグ

---

## Phase 4: 多面的視点収集 ✅

### 実装完了: `DeepResearchService.planResearch()`

**実装内容**: 4種類の視点別クエリを生成し、バランスの取れた情報収集を実現

**Geminiプロンプト改善**:
```
あなたは調査ジャーナリストです。
以下の記事について、多面的に情報を収集するため、
異なる視点からの検索クエリを生成してください。

1. 推進派・賛成派の意見を探すクエリ（1つ）
2. 反対派・慎重派の意見を探すクエリ（1つ）
3. 中立的な分析・解説を探すクエリ（1つ）
4. 関連する一次ソース（法令・統計）を探すクエリ（1つ）

JSON Schema:
{
  "queries_pro": string,     // 推進派クエリ
  "queries_con": string,     // 反対派クエリ
  "queries_neutral": string, // 中立クエリ
  "queries_primary": string  // 一次ソースクエリ
}
```

**収集時の処理**:
- 各クエリで収集した記事に `bias_indicator` を設定:
  - `queries_pro` → `"pro"`
  - `queries_con` → `"con"`
  - `queries_neutral` → `"neutral"`

**ステークホルダー別収集**:
- `StakeholderService` で洗い出されたアクターの公式見解を検索
- 例: `"日本獣医師会 動物愛護法 見解 site:nichiju.lin.gr.jp"`
- 収集時に `stakeholder` 列に名前を記録

---

## Phase 5: ファクトチェック機能 ✅

### 実装完了: `FactCheckService.gs`

**目的**: 元記事の数値・日付を一次ソースと照合

**実装内容**:

**主要メソッド**:
- `extractClaims()`: 元記事から数値・日付を抽出（Gemini）
- `verifyClaim()`: 一次ソースと照合
- `verify()`: 全体フローを統合、04_FactCheckシートに記録

**処理フロー**:
1. 元記事から数値・日付を抽出（Gemini）
2. プロジェクトシート（01_Research）から一次ソースを取得
3. 一次ソースで関連する数値を検索（Gemini）
4. 値を比較（±5%の許容範囲）
5. 結果を `04_FactCheck` シートに記録

**判定ロジック**:
- `verified`: 一致（数値型は±5%許容）
- `conflicting`: 不一致（警告）
- `unverified`: 一次ソースで見つからず

**04_FactCheck シート構造**:
- `claim_text`: 「2023年度の殺処分数は2万頭」
- `claim_value`: 「20000」
- `source_value`: 「19705」
- `match_status`: `verified`/`conflicting`/`unverified`
- `source_url`: 環境省URL

---

## Phase 6: 時系列分析機能（未実装）

### 実装予定: `TimelineService.gs`

**目的**: 「なぜ今この問題が?」を理解するための時系列情報収集

**機能**:
1.  **過去の関連記事を収集**
    - Google News RSSの `when:1y` パラメータで過去1年分を取得
    - `published_at` でソート

2.  **法改正履歴の取得**
    - e-Gov法令検索から改正履歴を取得
    - 例: 「動物愛護管理法 改正 履歴 site:elaws.e-gov.go.jp」

3.  **Geminiによる重要イベント抽出**
    ```
    「以下の記事群から、重要なイベントを時系列で抽出してください。
    特に、法改正、重大事件、統計発表、政策発表に注目してください。
    JSON Schema: {
      "events": [{
        "date": "YYYY-MM-DD",
        "event": string,
        "category": "law"|"policy"|"incident"|"statistics"
      }]
    }」
    ```

4.  **結果を `05_Timeline` シートに記録**

---

## Phase 7: 統合と実行順序

### 改訂後の `DeepResearchService.conductResearch()` フロー

```javascript
conductResearch(item, topicId) {
  // 1. 調査計画策定（拡張版）
  const plan = this.planResearchEnhanced(item);
  // → 視点別クエリ（pro/con/neutral/primary）を生成

  // 2. 一次ソース収集
  const primarySources = this.primarySourceService.collect(plan.queries_primary);
  this.saveToProjectSheet(topicId, primarySources, 'official');

  // 3. 多面的視点収集
  const proArticles = this.fetchService.fetchByQuery(plan.queries_pro);
  this.saveToProjectSheet(topicId, proArticles, 'news', 'pro');
  
  const conArticles = this.fetchService.fetchByQuery(plan.queries_con);
  this.saveToProjectSheet(topicId, conArticles, 'news', 'con');
  
  const neutralArticles = this.fetchService.fetchByQuery(plan.queries_neutral);
  this.saveToProjectSheet(topicId, neutralArticles, 'news', 'neutral');

  // 4. 信頼性評価
  const allArticles = [...primarySources, ...proArticles, ...conArticles, ...neutralArticles];
  allArticles.forEach(article => {
    article.reliability_score = this.reliabilityEvaluator.evaluate(article);
  });

  // 5. ファクトチェック
  this.factCheckService.verify(item, topicId);

  // 6. 時系列整理
  this.timelineService.analyze(topicId, allArticles);

  console.log('Enhanced Deep Research Completed.');
}
```

---

## 実装優先度

1.  **Phase 2 (一次ソース収集)**: ✅ 完了
2.  **Phase 3 (信頼性評価)**: ✅ 完了
3.  **Phase 4 (多面的視点)**: ✅ 完了
4.  **Phase 5 (ファクトチェック)**: ✅ 完了
5.  **Phase 6 (時系列分析)**: 未実装。背景理解を深める。
