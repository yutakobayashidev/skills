# Skills

Personal agent skills for AI coding assistants. These skills follow the [Agent Skills specification](https://agentskills.io) and are compatible with Claude Code, Codex CLI, OpenCode, Cursor, and any skills-compatible agent.

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

### npx skills

```bash
npx skills add yutakobayashidev/skills
```

### Claude Code

```bash
/plugin marketplace add yutakobayashidev/skills
```

### Manually

Clone the repo and copy skills to your agent's skills directory:

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
    agent-skills = {
      url = "github:Kyure-A/agent-skills-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    skills = {
      url = "github:yutakobayashidev/skills";
      inputs.nixpkgs.follows = "nixpkgs";
    };
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

### Local Install (waza skill)

Install the waza skill (from [microsoft/waza](https://github.com/microsoft/waza/blob/main/skills/waza/SKILL.md)) to `.claude/skills/` without home-manager:

```bash
nix run github:yutakobayashidev/skills#skills-install-local
```

This uses [agent-skills-nix](https://github.com/Kyure-A/agent-skills-nix) for a local-scope install — useful when you want the waza skill for evaluating other skills without adding it to your global agent configuration.

## Packages

The flake also provides:

- **waza**: CLI and framework for evaluating AI agent skills ([Microsoft/waza](https://github.com/microsoft/waza)), re-exported from [yutakobayashidev/nur-packages](https://github.com/yutakobayashidev/nur-packages).

## Apps

- **skills-install-local**: Install selected skills (waza) to `.claude/skills/` via `agent-skills-nix` local install.

## License

MIT
