# AGENTS.md

Guides for Claude Code and other AI coding agents when working with this repository.

## Waza — Agent Skill Evaluation

[waza](https://github.com/microsoft/waza) is a CLI for evaluating AI agent skills.
It is packaged in `yutakobayashidev/nur-packages` and re-exported by this flake.

### Installation

```bash
# Run ad-hoc
nix run github:yutakobayashidev/skills#waza -- --help

# Or install in your nix profile
nix profile install github:yutakobayashidev/skills#waza
```

### Workflow

```bash
# 1. Initialize waza project (creates skills/, evals/, CI, .gitignore)
waza init

# 2. Create a new skill with its eval suite
waza new skill

# 3. Create an eval for an existing skill
waza new eval

# 4. Check skill readiness (frontmatter compliance, token budget, eval presence)
waza check <skill-name>

# 5. Run evaluations
waza run                     # auto-detect all evals
waza run <skill-name>        # run a specific eval
waza run --parallel --model claude-sonnet-4-20250514

# 6. Grade results offline (after --skip-graders run)
waza grade <results.json>

# 7. Quality assessment via LLM-as-Judge
waza quality skills/<name>/SKILL.md

# 8. Start the HTTP dashboard
waza serve

# 9. Compare multiple result files
waza compare <result1.json> <result2.json>
```

### Key commands reference

| Command | Purpose |
|---------|---------|
| `waza init` | Scaffold project structure (skills/, evals/, CI) |
| `waza new skill` | Create a new skill definition + eval |
| `waza new eval` | Add an eval suite to an existing skill |
| `waza new task` | Auto-generate tasks from copilot logs or prompts |
| `waza run` | Execute evaluation benchmarks |
| `waza check` | Validate skill readiness for submission |
| `waza quality` | Score SKILL.md quality with an LLM judge |
| `waza grade` | Grade results from a prior `waza run --skip-graders` |
| `waza compare` | Compare multiple evaluation results |
| `waza serve` | Launch HTTP dashboard or JSON-RPC server |
| `waza coverage` | Generate eval coverage grid for discovered skills |

### Using with local changes

When testing waza behavior against local nur-packages changes:

```bash
nix run .#waza -- run --help              # uses local flake
nix run .#waza --override-input nur-packages path:../nur-packages
```

## Repository Structure

```
skills/
  <name>/
    SKILL.md       # Skill definition (frontmatter + instructions)
    references/    # Reference materials for the skill
evals/             # Evaluation suites (created by waza init / waza new)
flake.nix          # Flake that re-exports waza from nur-packages
```

## Secret Handling

Do not write secrets, API tokens, or private keys to temporary directories.
If waza requires API keys for evaluation models, use environment variables
(e.g. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) or a `.env` file in the repo root
(ensure `.env` is in `.gitignore`).
