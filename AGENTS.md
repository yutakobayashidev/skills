# AGENTS.md

Waza CLI is available in PATH via `direnv allow` (devShell). See `.claude/skills/waza/SKILL.md` for full command reference.

## Evaluation Workflow

```bash
# 1. Write tasks & fixtures for a skill
#    evals/<skill>/eval.yaml
#    evals/<skill>/tasks/*.yaml
#    evals/<skill>/fixtures/*
#    Optional real-model suite: eval.semantic.yaml + tasks/semantic/*.yaml

# 2. Dry-run with mock executor (no API calls)
waza run evals/<skill>/eval.yaml -v

# 3. Run the explicit real-model suite when present
waza run evals/<skill>/eval.semantic.yaml --model claude-sonnet-4.6 -o results.json -v

# 4. Compare before/after
waza compare results-before.json results-after.json

# 5. Iterate: fix SKILL.md → re-run → compare
# 6. Dashboard
waza serve
```

## CI

`.github/workflows/eval.yml` runs `waza run --engine mock --output-dir ./results` on PRs to validate eval structure without API calls.

## Key Design Points

- **Mock first**: fix eval/task/grader logic with mock, then run real model
- **Explicit executor split**: `--model` does not change the executor; keep mock plumbing in `eval.yaml` and real semantic grading in `eval.semantic.yaml` when both are needed
- **Text graders first**: regex/text graders are deterministic and cheap; use `prompt` (LLM-as-judge) only when subjective evaluation is unavoidable
- **Hold-out tasks**: keep one task unseen during iteration to detect overfitting
- **`trials_per_task` >= 3**: single-run scores mix model variance with real improvement
