---
name: grok-search
description: >-
  Grokを使ってX（Twitter）上のリアルタイム情報を検索する。ユーザーの反応、最新トレンド、議論の調査に使用。Chrome
  MCP環境でのみ動作。Triggers on: 'Xでの反応', 'ツイッターで', 'SNSの反応', '最新情報',
  'リアルタイム', 'トレンド', '話題', 'バズ', '評判', '口コミ', 'みんなどう言ってる',
  'みんなの反応', '反応を調べ', '〜の反応', '〜への反応', '世間の声', '感想を調べ',
  'grokで', 'grokを使って', '〜の使い方', '〜のtips', 'tips', '便利な使い方',
  'おすすめ設定'
---

## 自動発動ルール

以下のケースでは、ユーザーが明示的にGrok/Xを指定しなくてもこのスキルを使用する:

1. **発信コンテンツへの反応調査**
   - YouTube動画への反応
   - Zenn/note記事への反応
   - 技術記事・連載への反応
   - その他トレンドになっている記事・コンテンツへの反応

2. **技術トピックへの反応調査**
   - CVE・脆弱性への反応（例: 「CVE-XXXXのみんなの反応」）
   - ライブラリ・フレームワークの問題への反応
   - セキュリティインシデントへの反応
   - OSS・技術ツールへの評価・議論

3. **直前の調査対象への反応**
   - 会話中で調査したトピックに対して「みんなの反応」「反応を調べて」と言われた場合
   - WebSearchで技術情報を調べた直後に反応を求められた場合

4. **リアルタイム性が重要な調査**
   - 発売直後の書籍・雑誌の評判
   - リリース直後のプロダクトへの反応
   - イベント・カンファレンスの感想

5. **WebSearchで十分な結果が得られない場合**
   - SNSの生の声が必要なとき
   - 最新の議論・意見を知りたいとき

6. **ユーザーが「grokで」「grokを使って」と明示した場合**
   - ツール・アプリの使い方やtipsを調べるとき
   - 実際のユーザーの活用事例を知りたいとき

# Grokリアルタイム検索

Chrome MCPを使ってGrokでリアルタイム検索を実行する。

## 前提条件

このスキルは以下の条件を満たす場合のみ動作する:
1. Claude in Chrome環境である（Chrome MCPが利用可能）
2. ブラウザでGrok（https://grok.com/）にログイン済み

## 実行手順

### Step 0: 環境チェック

**Chrome MCP確認**

`mcp__claude-in-chrome__tabs_context_mcp` を呼び出す。

- エラーが返る場合:
  ```
  Chrome MCPが利用できません。Claude in Chrome環境で実行してください。
  ```
  と表示して終了。

**Grokログイン確認**

1. `mcp__claude-in-chrome__tabs_create_mcp` で新しいタブを作成
2. `mcp__claude-in-chrome__navigate` で `grok.com` にアクセス
3. `mcp__claude-in-chrome__read_page` でページ状態を確認
4. ログインボタン、サインアップボタン、または「Sign in」テキストが表示されている場合:
   ```
   Grokにログインしていません。ブラウザでログインしてから再実行してください。
   ```
   と表示して終了。

### Step 1: 検索実行

1. `mcp__claude-in-chrome__find` で検索入力欄（textarea または input）を探す
2. `mcp__claude-in-chrome__form_input` で検索クエリを入力
3. Enterキー押下（`mcp__claude-in-chrome__computer` action=key, text=Enter）
4. 回答生成を待つ（`mcp__claude-in-chrome__computer` action=wait, duration=10）

### Step 2: 結果取得

1. `mcp__claude-in-chrome__get_page_text` または `read_page` でGrokの回答を読み取る
2. 回答部分を抽出・整形

### Step 3: 出力

「検索完了。」と表示してから、以下の形式で結果を出力:

```
## Grok検索結果

**クエリ**: {検索クエリ}

---

{Grokの回答}
```
