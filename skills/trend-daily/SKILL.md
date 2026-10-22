---
name: trend-daily
description: "トレンド収集"
---

# トレンド収集

Radar Sources OPMLの購読フィード、はてなブックマークIT、Hacker News、Lobsters、GitHub Trending、セキュリティソースから最新記事を収集し、`~/ghq/git.yutakobayashi.com/yuta/life/ideas/daily/YYYYMMDD-trend.md` に保存する。

## 実行手順

### 0. 購読ソースと興味領域の読み込み

[Radar Sources OPML](https://radar.yutakobayashi.com/sources.opml) を毎回取得し、購読フィードを記事の収集元として使用する。

```bash
curl --fail --silent --show-error --location --max-time 30 \
  https://radar.yutakobayashi.com/sources.opml -o /tmp/trend-daily-sources.opml
```

- XMLとして解析し、階層を問わず `xmlUrl` を持つすべての `outline` を抽出する。`xmlUrl` がフィードURL、`title` または `text` がソース名、親 `outline` がカテゴリになる
- `xmlUrl` の重複を除き、手順1で各フィードの記事を取得する。OPMLを読むだけで収集を終えない
- OPML取得にはcurlを使用する。Python urllibの標準User-AgentではCloudflareの403（エラー1010）になることを確認済み

購読カテゴリ・説明と以下の興味領域を、収集記事の関連度評価に使用する：
- AI/ML・AIエージェント（LLM、MCP、コーディングエージェント、ローカル推論、AI安全性）
- 開発ツール・ソフトウェアエンジニアリング（JavaScript/TypeScript、React、Node.js、Bun、Rust、テスト、ビルドツール、Nix）
- Webプラットフォーム（Web標準、ブラウザ、HTTP、WebAssembly、アクセシビリティ）
- セキュリティ・プライバシー・デジタルアイデンティティ（脆弱性研究、リバースエンジニアリング、暗号、匿名性、OAuth/OIDC）
- 分散型・ローカルファースト技術（CRDT、IPFS、Ethereum、ActivityPub、AT Protocol、Nostr）
- OSS・インフラ・企業エンジニアリング（リリース動向、クラウド、ネットワーク、開発組織）
- テクノロジーと社会（デジタル権利、検閲、シビックテック、AI倫理、政策、社会的影響）
- デザイン・HCI・メディア技術（UI/UX、ロボティクス、IoT、ヘルステック、メディアアート）
- 数学・計算機科学・言語・音楽・インターネット文化

### 1. トレンド情報の収集

以下のサイトから最新のトレンド情報を取得：

**Radar購読フィード（OPML）**
- 手順0で抽出した全フィードのRSS/Atomを取得する。同時接続は最大5件、各リクエストのタイムアウトは30秒とする
- 各記事のタイトル、元記事URL、公開日時、概要、ソース名、OPMLのカテゴリを取得する。RSSは `item` の `link`、Atomは `entry` の `link rel="alternate"`（または `rel` 省略）の `href` を記事URLに使う
- 実行時刻から過去24時間の公開記事を対象にする。公開日時がなく更新日時のみある場合は更新日時を使い、「更新」と明記する。日時不明の記事は当日の新着として掲載しない
- 同じ元記事URLはRadar内で1件にまとめる。他の収集元にも登場する場合はメモに併記する
- 非日本語のタイトルは日本語に翻訳し、元記事へのリンクを掲載する
- 個別フィードの取得失敗は記録し、他のフィードの収集を続ける。OPML自体の取得失敗・未取得フィードも収集状況に明記し、「新着なし」と区別する

**日本市場（はてブIT）**
- 公式RSS `https://b.hatena.ne.jp/hotentry/it.rss` を取得する
- RSS 1.0の各 `item` から `title`、`link`（元記事URL）、`hatena:bookmarkcount`（ブックマーク数）、`dc:subject`（タグ）を抽出する
- `dc:subject` とタイトル・概要を使って、AI、プログラミング、セキュリティ、エンジニアリングなどのカテゴリに分類する
- はてなブックマークのHTML人気エントリーページは取得元に使わない
- ブックマーク数を再確認する必要がある場合は、公式の `https://bookmark.hatenaapis.com/count/entries` にURLを最大50件まで指定する
- 各エントリーの**タイトル、元記事URL、ブックマーク数**を必ず取得すること
- はてブのエントリーページURLではなく、RSSの `link` にある元記事URLを使用する

**グローバル（Hacker News）**
- [Hacker News公式API](https://github.com/HackerNews/API)を使用する
- `https://hacker-news.firebaseio.com/v0/topstories.json` から上位30件のIDを取得する
- 各IDについて `https://hacker-news.firebaseio.com/v0/item/<id>.json` を取得し、`type` が `story`、かつ `deleted` と `dead` が `true` でない項目を使用する
- 各記事の`title`をタイトル、`score`をポイント数として使用する
- `id`からHNコメントページURL（`https://news.ycombinator.com/item?id=<id>`形式）を組み立てる
- **元記事URLではなくHNのコメントページURLを使用すること**（コメントも確認できるようにするため）
- **タイトルは日本語に翻訳して出力**

**グローバル（Lobsters）**
- `https://lobste.rs/hottest.json` から人気記事のJSON配列を取得し、返却順に先頭25件を使用する（25件未満なら全件）
- 各記事の `title`（タイトル）、`score`（スコア）、`comment_count`（コメント数）、`tags`（タグ）、`comments_url`（コメントページURL）を取得する
- `tags` とタイトル・概要を使ってカテゴリと興味度を判断する
- **記事のリンクには `comments_url` を使用すること**（コメントも確認できるようにするため）
- 元記事の確認には `url` を使用する。`url` が空のテキスト投稿も収集対象とし、`description_plain` を参照する
- **タイトルは日本語に翻訳して出力**

**GitHub Trending（グローバル新規リポジトリ）**
- **ax CLI** を使用して `https://github.com/trending` から取得する
- コマンド:
  ```bash
  ax https://github.com/trending 'article.Box-row' \
    --row 'name=h2.h3.lh-condensed a.Link, stars=span.d-inline-block.float-sm-right, desc=p.col-9.color-fg-muted.my-1.tmp-pr-4, lang=div.f6.color-fg-muted.mt-2 span.d-inline-block.ml-0, url=h2.h3.lh-condensed a.Link@href' \
    --json
  ```
- 言語別ページも同様に取得可能:
  - `https://github.com/trending/typescript`
  - `https://github.com/trending/rust`
  - `https://github.com/trending/python`
- 各リポジトリの `name`（`owner / repo` 形式）、`stars`（今日獲得スター数）、`desc`（概要）、`lang`（言語）、`url`（相対パス `/owner/repo`）を抽出
- `url` は `https://github.com` をプレフィックスして完全URLにすること
- 興味領域に合わせて **TypeScript・Rust・Python** の言語別ページを優先してチェック

**セキュリティ（追加ソース）**
- https://www.aikido.dev/blog - セキュリティ研究開発者向けのセキュリティ情報
- https://www.wiz.io/blog - クラウドセキュリティ
- 最新1-3記事をチェックし、興味度★★★のものがあれば注目トピックに含める

<!-- Redditは403エラーのため一時停止。以下は再開用に保持する。
**Reddit（13サブレッド）**
- **重要**: WebFetchツールはreddit.comをブロックするため、**Bashツールでcurlコマンドを使用**すること
- 各サブレッドから `/hot.json?t=day&limit=10` で上位10件を取得
- **old.reddit.com**を使用（www.reddit.comではない）
- User-Agentヘッダーを設定: `"User-Agent: trend-collector/1.0 (trend analysis tool)"`
- 各記事の**タイトル、Redditコメントページの完全URL、投票数（ups）、コメント数**を取得
- **タイトルは日本語に翻訳して出力**

取得例（Bashツールで実行）:
```bash
curl -s -H "User-Agent: trend-collector/1.0 (trend analysis tool)" \
  "https://old.reddit.com/r/programming/hot.json?t=day&limit=10" | \
  jq -r '.data.children[] | "\(.data.title)|\(.data.ups)|\(.data.num_comments)|https://www.reddit.com\(.data.permalink)"'
```

データ構造:
- `data.children[].data.title`: タイトル
- `data.children[].data.ups`: 投票数
- `data.children[].data.num_comments`: コメント数
- `data.children[].data.permalink`: パス（`https://www.reddit.com` + permalink で完全URL）

セキュリティ系（2サブレッド）:
- r/netsec
- r/cybersecurity

AI系（3サブレッド）:
- r/OpenAI
- r/LocalLLaMA
- r/ClaudeCode

コア技術系（2サブレッド）:
- r/programming
- r/technology

OSS/個人開発系（4サブレッド）:
- r/opensource
- r/indiehackers
- r/webdev
- r/javascript

キャリア/実践系（2サブレッド）:
- r/cscareerquestions
- r/productivity
-->

### 2. 分析

収集した情報を以下の観点で分析：

**興味領域マッチング（最優先）**
- 各記事を興味領域と照合し、関連度を評価
- 高関連度の記事を「注目トピック」の最上位に配置
- 特に注目すべきトピック：
  - AI/ML・AIエージェント（開発ツール、MCP、ローカル推論、安全性）
  - セキュリティ・プライバシー・デジタルアイデンティティ
  - Web標準・アクセシビリティ・ブラウザ技術
  - JavaScript/TypeScript・Rust・開発ツール
  - OSS・分散型技術・ローカルファーストソフトウェア
  - デジタル権利・シビックテック・テクノロジーの社会的影響
  - HCI・デザイン・メディア技術

**Radar購読フィード**
- 興味領域への関連度、新規性、実用性を評価し、個人ブログや公式リリースなどの一次情報も注目トピックに含める
- ポイント数やブックマーク数がない記事も評価対象にし、人気指標を捏造しない

**はてブIT**
- 日本のエンジニアに刺さりやすい話題
- 議論を呼びそうなトピック
- 技術トレンド（AI、開発手法、ツール等）
- キャリア・働き方関連

**Hacker News**
- グローバルで話題の技術トレンド
- スタートアップ・プロダクト関連
- セキュリティ関連（脆弱性、攻撃手法、インシデント）
- 議論を呼んでいるトピック（ポイント数が高い）

**Lobsters**
- プログラミング言語、OS、セキュリティ、OSSなどの技術的な話題
- タグと興味領域の一致を優先し、スコアとコメント数でコミュニティの反応を評価
- スコアはLobsters内で比較し、HNのポイント数と直接比較しない

**GitHub Trending**
- 今日急上昇しているリポジトリ（stars today が高いもの）
- AIエージェント・MCP・コーディングツール関連の新規プロジェクト
- Rust/TypeScript/Python の注目ライブラリ・ツール
- スター数の絶対値ではなく「今日の増加数」で評価

<!-- Redditは403エラーのため分析対象から一時除外。
**Reddit（13サブレッド）**
- セキュリティ系：最新の脅威、実践的な攻撃・防御手法
- AI系：OpenAI、ローカルLLM、Claude Code関連
- OSS/個人開発系：OSSプロジェクト、個人開発、Web開発
- キャリア/実践系：キャリア、生産性
- 投票数（ups）とコメント数でコミュニティの反応を評価
- 議論が活発なトピック（コメント数が多い）を優先
-->

### 3. 出力

**まず「トレンド収集完了。」というメッセージを返してから、結果を `~/ghq/git.yutakobayashi.com/yuta/life/ideas/daily/YYYYMMDD-trend.md` に保存。**

以下のフォーマットで出力：

```markdown
# トレンド: YYYY-MM-DD

## Radar購読フィード

収集状況: 対象期間 YYYY-MM-DD HH:mm ～ YYYY-MM-DD HH:mm（タイムゾーン）、全Nフィード中N件取得成功、N件失敗、N件未取得。日時不明N記事。
取得失敗・未取得があればソース名と理由を記載。対象記事が0件なら「対象期間の新着なし」と記載。

### 注目トピック

| タイトル | ソース | 公開日時（更新のみなら明記） | 興味度 | カテゴリ | メモ |
|---------|--------|---------------------------|--------|---------|------|
| [日本語タイトル](元記事URL) | ソース名 | YYYY-MM-DD HH:mm | ★★★/★★/★ | AI/Web/Security等 | 注目理由・他ソースでの掲載状況 |

### 全エントリー

1. [日本語タイトル](元記事URL) - ソース名・公開日時 - 概要
2. ...

## はてブIT（日本市場）

### 注目トピック

| タイトル | ブクマ数 | 興味度 | カテゴリ | メモ |
|---------|---------|--------|---------|------|
| [タイトル](元記事URL) | XXX users | ★★★/★★/★ | AI/Web/Security等 | 発信に活用できるポイント |

**興味度の定義**:
- ★★★: 興味領域に直接関連（AIエージェント、セキュリティ、Web標準、OSS、デジタル権利など）
- ★★: 間接的に関連（技術トレンド全般、エンジニアリング文化）
- ★: 一般的なIT/技術ニュース

### 全エントリー

1. [タイトル](元記事URL) (XXX users) - 概要
2. ...

## Hacker News（グローバル）

### 注目トピック

| タイトル | ポイント | 興味度 | カテゴリ | メモ |
|---------|---------|--------|---------|------|
| [タイトル](HNコメントページURL) | XXXpt | ★★★/★★/★ | AI/Security/Dev等 | 発信に活用できるポイント |

### 全エントリー

1. [タイトル](HNコメントページURL) (XXXpt) - 概要
2. ...

## Lobsters（グローバル）

### 注目トピック

| タイトル | スコア | コメント数 | 興味度 | タグ | メモ |
|---------|--------|-----------|--------|------|------|
| [日本語タイトル](LobstersコメントページURL) | XXXpt | XXX | ★★★/★★/★ | rust/security等 | 発信に活用できるポイント |

### 全エントリー

1. [日本語タイトル](LobstersコメントページURL) (XXXpt, XXX comments) - 概要
2. ...

## GitHub Trending（グローバル）

### 注目トピック

| リポジトリ | 言語 | 今日のスター | 興味度 | カテゴリ | メモ |
|-----------|------|-------------|--------|---------|------|
| [owner/repo](https://github.com/owner/repo) | TypeScript | +XXX | ★★★/★★/★ | AI/Dev/OSS等 | 発信に活用できるポイント |

### 全エントリー

1. [owner/repo](https://github.com/owner/repo) (+XXX stars today, TypeScript) - 概要
2. ...

<!-- Redditは403エラーのため出力対象から一時除外。
## Reddit（13サブレッド）

### 注目トピック

| タイトル | 投票数 | コメント数 | 興味度 | カテゴリ | サブレッド | メモ |
|---------|--------|-----------|--------|---------|-----------|------|
| [タイトル](Redditコメントページ完全URL) | XXX ups | XXX | ★★★/★★/★ | Security/AI/OSS等 | r/subreddit | 発信に活用できるポイント |

### カテゴリ別エントリー

#### セキュリティ系
1. [タイトル](RedditコメントページURL) (XXX ups, XXX comments) - r/netsec - 概要
2. ...

#### AI系
1. [タイトル](RedditコメントページURL) (XXX ups, XXX comments) - r/OpenAI - 概要
2. ...

#### OSS/個人開発系
1. [タイトル](RedditコメントページURL) (XXX ups, XXX comments) - r/opensource - 概要
2. ...

#### キャリア/実践系
1. [タイトル](RedditコメントページURL) (XXX ups, XXX comments) - r/cscareerquestions - 概要
2. ...
-->
```

## 注意事項

- Radarは毎回OPMLから購読フィードを列挙し、RSS/Atomの記事を実際に収集する
- はてブは公式RSS、追加セキュリティソースはWebFetchツール、Hacker Newsは公式JSON APIで取得
- Lobstersは `https://lobste.rs/hottest.json` で取得し、リンクには `comments_url` を使用、タイトルは日本語に翻訳する
- GitHub Trendingは **ax CLI** を使用（`ax https://github.com/trending ... --json`）
- **すべての記事にURLリンクを必ず含める（リンクなしは不可）**
- **はてブは元記事のURLを必ず取得**（はてブページURLではなく）
- **Hacker NewsはHNコメントページURL（`item?id=`形式）を使用**（元記事URLではなく）
- **Hacker Newsのタイトルは日本語に翻訳**
- GitHub TrendingのURLは `https://github.com` + 相対パス で完全URLにすること
- GitHub Trendingの `stars` は「今日獲得スター数」であり、累計スター数ではない
<!-- Redditは403エラーのため一時停止。
- **RedditはRedditコメントページの完全URL（`https://www.reddit.com/r/subreddit/comments/...`形式）を使用**
- **Redditのタイトルは日本語に翻訳**
- Reddit APIレート制限に注意（1分あたり60リクエスト程度）
- 投票数（ups）/コメント数が高い記事を優先
-->
- ポイント数/ブックマーク数が高い記事は特に注目
- 出力ファイルのYYYYMMDDは実行日の日付を使用
