# Skills

Personal agent skills for AI coding assistants.

## Skills

| Skill | Description |
|-------|-------------|
| [adr](skills/adr) | Draft or refine architecture decision records |
| [check-similarity](skills/check-similarity) | Detect duplicate code via AST comparison |
| [dce](skills/dce) | Detect and eliminate dead code |
| [functional-cohesion-components](skills/functional-cohesion-components) | Guide frontend component design |
| [gha-lint](skills/gha-lint) | Lint and secure GitHub Actions workflows |
| [good-first-issue-creator](skills/good-first-issue-creator) | Draft newcomer-friendly GitHub issues |
| [markitdown](skills/markitdown) | Convert files to Markdown |
| [nextjs-onboarding](skills/nextjs-onboarding) | Audit baseline repo hygiene |
| [oura-daily-watch](skills/oura-daily-watch) | Daily Oura + Discord behavior monitor |
| [repo-creator](skills/repo-creator) | Create GitHub repos through OpenTofu |
| [social-digest](skills/social-digest) | Fetch and summarize Discord + Mastodon |
| [speakerdeck](skills/speakerdeck) | Download slide images from SpeakerDeck |
| [youtube-transcript](skills/youtube-transcript) | Extract YouTube transcripts |

## Installation

```bash
# direnv (devShell + waza CLI + waza skill deploy)
direnv allow

# npx
npx skills add yutakobayashidev/skills

# Claude Code
/plugin marketplace add yutakobayashidev/skills
```

## Waza

Evaluate AI agent skills. Available in PATH via `direnv allow`.

```bash
waza init        # scaffold project
waza new skill   # create skill + eval
waza run         # run evals
waza check       # validate skill readiness
```

## License

MIT
