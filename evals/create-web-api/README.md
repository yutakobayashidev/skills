# create-web-api evaluations

`eval.yaml` uses Waza's mock executor for fast CI checks that tasks and fixtures load correctly. It does not claim to measure response quality.

`eval.semantic.yaml` uses a real executor and output-only graders with no model-controlled bypass:

```bash
waza run evals/create-web-api/eval.semantic.yaml --model claude-sonnet-4.6
```

Use `waza grade evals/create-web-api/eval.semantic.yaml --results <results.json>` to regrade saved real-engine outputs.
