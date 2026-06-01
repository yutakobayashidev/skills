# Skills

Personal agent skills for AI coding assistants. Compatible with Claude Code, Codex CLI, OpenCode, Cursor, and any skills-compatible agent.

## Skills

| Skill | Description |
|-------|-------------|
| [adr](skills/adr) | Draft or refine architecture decision records |
| [check-similarity](skills/check-similarity) | Detect duplicate TypeScript/JavaScript code using AST comparison |
| [dce](skills/dce) | Detect and eliminate dead code in TypeScript projects |
| [functional-cohesion-components](skills/functional-cohesion-components) | Guide frontend component design using functional cohesion |
| [gha-lint](skills/gha-lint) | Lint and secure GitHub Actions workflows |
| [good-first-issue-creator](skills/good-first-issue-creator) | Draft newcomer-friendly GitHub issues |
| [markitdown](skills/markitdown) | Convert files to Markdown using Microsoft's markitdown CLI |
| [nextjs-onboarding](skills/nextjs-onboarding) | Audit baseline repo hygiene when joining a Next.js project |
| [oura-daily-watch](skills/oura-daily-watch) | Build and run a daily Oura + Discord behavior monitor |
| [repo-creator](skills/repo-creator) | Create new GitHub repositories through OpenTofu |
| [social-digest](skills/social-digest) | Fetch and summarize Discord + Mastodon posts |
| [speakerdeck](skills/speakerdeck) | Download slide images from a SpeakerDeck presentation |
| [youtube-transcript](skills/youtube-transcript) | Extract transcripts from YouTube videos |

## Installation

```bash
# npx
npx skills add yutakobayashidev/skills

# Claude Code
/plugin marketplace add yutakobayashidev/skills

# Manual
cp -r skills/skills/* ~/.claude/skills/

# Nix
nix run github:yutakobayashidev/skills#skills-install-local
```

## Waza

Evaluates AI agent skills. Install via `skills-install-local` or run ad-hoc:

```bash
nix run github:yutakobayashidev/skills#waza -- init
nix run github:yutakobayashidev/skills#waza -- run
```

## License

MIT
