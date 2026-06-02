# Skills

Personal agent skills for AI coding assistants. These skills follow the [Agent Skills specification](https://agentskills.io) and are compatible with Claude Code, Codex CLI, OpenCode, Cursor, and any skills-compatible agent.

## Skills

| Skill                                                                   | Description                                                      |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [adr](skills/adr)                                                       | Draft or refine architecture decision records                    |
| [check-similarity](skills/check-similarity)                             | Detect duplicate TypeScript/JavaScript code using AST comparison |
| [dce](skills/dce)                                                       | Detect and eliminate dead code in TypeScript projects            |
| [functional-cohesion-components](skills/functional-cohesion-components) | Guide frontend component design using functional cohesion        |
| [gha-lint](skills/gha-lint)                                             | Lint and secure GitHub Actions workflows                         |
| [good-first-issue-creator](skills/good-first-issue-creator)             | Draft newcomer-friendly GitHub issues                            |
| [markitdown](skills/markitdown)                                         | Convert files to Markdown using Microsoft's markitdown CLI       |
| [nextjs-onboarding](skills/nextjs-onboarding)                           | Audit baseline repo hygiene when joining a Next.js project       |
| [oura-daily-watch](skills/oura-daily-watch)                             | Build and run a daily Oura + Discord behavior monitor            |
| [repo-creator](skills/repo-creator)                                     | Create new GitHub repositories through OpenTofu                  |
| [social-digest](skills/social-digest)                                   | Fetch and summarize Discord + Mastodon posts                     |
| [speakerdeck](skills/speakerdeck)                                       | Download slide images from a SpeakerDeck presentation            |
| [youtube-transcript](skills/youtube-transcript)                         | Extract transcripts from YouTube videos                          |

## Installation

### npx skills

```bash
npx skills add yutakobayashidev/skills
```

### Claude Code

```bash
/plugin marketplace add yutakobayashidev/skills
```

### Manually

```bash
git clone https://github.com/yutakobayashidev/skills
cp -r skills/skills/* ~/.claude/skills/
```

### Nix (agent-skills-nix)

Consume this repository via [agent-skills-nix](https://github.com/Kyure-A/agent-skills-nix) for declarative skill management with automatic deployment to multiple agents.

```nix
# flake.nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    skills = {
      url = "github:yutakobayashidev/skills";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    agent-skills.url = "github:Kyure-A/agent-skills-nix";
  };

  # Pass to home-manager as extraSpecialArgs, then:
  home-manager.users.youruser = {
    programs.agent-skills = {
      enable = true;
      sources.local = {
        path = inputs.skills;
        subdir = "skills";
      };
      # Deploy to agents
      targets = {
        claude.enable = true;
        codex.enable = true;
        agents.enable = true;
      };
    };
  };
}
```

Skills are deployed to `~/.agents/skills`, `~/.config/claude/skills`, and `~/.config/codex/skills`. See [dotnix](https://github.com/yutakobayashidev/dotnix) for a complete reference setup.

### Local (direnv)

```bash
direnv allow
```

Installs agent skills to `.agents/skills/`, `.claude/skills/`, etc. and adds `waza`, `actrun`, and `nodejs` to PATH via devShell.

## Development

### Run evals locally

```bash
# All skills (mock engine)
waza run

# Single skill (mock engine)
waza run youtube-transcript

# Single skill with real model (requires copilot login)
waza run youtube-transcript --model gpt-5-mini --executor copilot-sdk
```

### Run CI workflow locally (actrun)

Prerequisites: [actrun](https://github.com/myuron/actrun-overlay) in PATH (available after `direnv allow`).

```bash
# Run the full CI pipeline locally
actrun workflow run .github/workflows/eval.yml --trust

# Re-run failed jobs from last run
actrun run --retry

# View run logs
actrun run logs <run-id>
```

Note: Some GitHub Actions runner environment variables (`RUNNER_TOOL_CACHE`) are not fully emulated by actrun. The CI workflow passes on GitHub Actions.

### Trigger CI manually (workflow_dispatch)

```bash
gh workflow run eval.yml --ref main
```

## Packages

- **waza**: waza CLI, re-exported from [yutakobayashidev/nur-packages](https://github.com/yutakobayashidev/nur-packages).
- **actrun**: Local GitHub Actions runner, from [myuron/actrun-overlay](https://github.com/myuron/actrun-overlay).

## License

MIT
