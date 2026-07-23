---
name: Bird
description: X/Twitter command-line tool for reading, searching, posting, and interacting. Use when the user wants to read, search, post, or interact with X/Twitter through the bird CLI.
homepage: https://bird.fast
metadata:
  clawdbot:
    emoji: "🐦"
    requires:
      bins:
        - bird
    install:
      - id: npm
        kind: node
        package: "@yuta/bird"
        bins:
          - bird
        label: Install bird (Gitea npm)
user-invocable: true
---

# bird

Fast X/Twitter CLI using GraphQL through twitter safe relay.

## Install

Only install bird if the `bird` command is missing.

Gitea Packages:

```bash
if ! command -v bird >/dev/null 2>&1; then
  npm config set @yuta:registry=https://git.yutakobayashi.com/api/packages/yuta/npm/
  npm install -g @yuta/bird
fi
```

One-shot without installing:

```bash
npx -y --@yuta:registry=https://git.yutakobayashi.com/api/packages/yuta/npm/ @yuta/bird whoami
```

Nix flakes:

```bash
nix run git+https://git.yutakobayashi.com/yuta/bird -- --help
```

Point bird at your running twitter safe relay if the environment variable is missing:

```bash
if [ -z "${TWITTER_RELAY_BASE_URL:-}" ]; then
  export TWITTER_RELAY_BASE_URL=https://tw.home.yutakobayashi.com/
fi
```

## Account And Auth

```bash
bird whoami
bird check
bird help [command]
bird query-ids --fresh
```

## Reading Tweets

```bash
bird read <url-or-id>
bird <url-or-id>
bird thread <url-or-id> --max-pages 3 --json
bird replies <url-or-id>
```

`replies` does not support `-n`. To fetch more replies, use pagination options such as `--all`, `--max-pages`, or `--cursor`.

## Timelines

```bash
bird home
bird home --following
bird user-tweets @handle -n 20
bird mentions -n 5
bird mentions --user @handle -n 5
```

## Search

```bash
bird search "query" -n 10
bird search "AI lang:ja" --product Top -n 20
bird search "from:yuta" --product Latest -n 20
bird search "from:yuta" --all --max-pages 3
```

`Latest` is the default search product. Use `Top` for ranked results.

## News And Trending

```bash
bird news -n 10
bird news --ai-only
bird news --news-only --ai-only -n 10
bird news --sports --entertainment -n 20
bird news --with-tweets --tweets-per-item 3 -n 10
bird news --trending-only --json
bird trending
```

## Lists

```bash
bird lists
bird lists --member-of
bird list-timeline <id> -n 20
bird list-timeline https://x.com/i/lists/<id> --max-pages 3 --json
```

## Bookmarks And Likes

```bash
bird bookmarks -n 10
bird bookmarks --folder-id <id>
bird bookmarks --all --max-pages 3 --json
bird bookmarks --expand-root-only
bird bookmarks --include-parent
bird bookmarks --author-chain
bird bookmarks --author-only
bird bookmarks --full-chain-only
bird bookmarks --full-chain-only --include-ancestor-branches
bird bookmarks --thread-meta --sort-chronological --json
bird unbookmark <url-or-id> <url-or-id>
bird likes -n 10
bird likes --all --max-pages 3 --json
```

## Social Graph

```bash
bird following -n 20
bird followers -n 20
bird following --user <id>
bird user @handle --json
bird profiles @handle <user-id> --json
bird about @handle
```

## Engagement Actions

```bash
bird follow @handle
bird unfollow @handle
```

## Posting

```bash
bird tweet "hello world"
bird reply <url-or-id> "nice thread!"
bird tweet "check this out" --media image.png --alt "description"
```

Posting is more likely to be rate limited. If blocked, use the browser tool instead.

## Media Uploads

```bash
bird tweet "hi" --media img.png --alt "description"
bird tweet "pics" --media a.jpg --media b.jpg
bird tweet "video" --media clip.mp4
```

Use up to 4 images, or 1 video.

## Pagination

Commands supporting pagination: `home`, `replies`, `thread`, `search`, `bookmarks`, `likes`, `list-timeline`, `following`, `followers`, `user-tweets`.

```bash
bird bookmarks --all
bird bookmarks --all --max-pages 3
bird bookmarks --cursor <cursor>
bird replies <id> --all --delay 1000
bird replies <id> --max-pages 3
bird replies <id> --cursor <cursor>
```

For `search`, `bookmarks`, and `likes`, use `--max-pages` with `--all` or `--cursor`. For `thread` and `list-timeline`, `--max-pages` implies pagination.

## Output Options

```bash
--json
--json-full
--plain
--no-emoji
--no-color
--quote-depth n
```

## Global Options

```bash
--relay-base-url <url>
--profile-name <name>
--timeout <ms>
```

Config precedence: CLI flags > environment variables > `./.birdrc.json5` > `~/.config/bird/config.json5`.

Environment variables: `TWITTER_RELAY_BASE_URL`, `BIRD_PROFILE_NAME`, `BIRD_TIMEOUT_MS`, `BIRD_QUOTE_DEPTH`, `NO_COLOR`.

## Troubleshooting

For stale query IDs or 404 errors:

```bash
bird query-ids --fresh
```
