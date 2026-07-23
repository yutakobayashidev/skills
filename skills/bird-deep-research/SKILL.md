---
name: bird-deep-research
description: Conduct large-scale, resumable research over public X/Twitter posts with Bird from a user-supplied research specification. Use when collecting hundreds to tens of thousands of posts, enriching public profile signals, applying an arbitrary evidence-based classification rubric, and generating a source-linked dashboard with original-post detail views.
---

# Bird Deep Research

Turn a research brief into a reproducible public-post dataset and local dashboard.

## Workflow

1. Read [methodology.md](references/methodology.md).
2. Write `research-spec.json` from the user's topic, population criteria, query shards, target count, classification dimensions, and dashboard labels. Never hardcode the example topic.
3. Confirm Bird access, then run a small dry run:

   ```bash
   bird check
   node {baseDir}/scripts/bird-deep-research.mjs collect \
     --spec research-spec.json --target 100
   ```

4. Review false positives and query coverage; refine the spec.
5. Collect the full dataset with the long default delay:

   ```bash
   node {baseDir}/scripts/bird-deep-research.mjs collect --spec research-spec.json
   ```

6. If inclusion rules require public profile evidence, enrich profiles:

   ```bash
   node {baseDir}/scripts/bird-deep-research.mjs profiles --spec research-spec.json
   ```

7. Classify bounded batches with the spec's rubric. Write `classified.jsonl` using the schema in [methodology.md](references/methodology.md). Preserve evidence and confidence.
8. Generate the self-contained dashboard:

   ```bash
   node {baseDir}/scripts/bird-deep-research.mjs dashboard --spec research-spec.json
   ```

## Required behavior

- Use one-page cursor requests because `bird search` has no delay flag.
- Default to 45–60 seconds between requests plus an additional 10–15 minute cooldown every 10 successful requests.
- Deduplicate by post ID and report shortfalls instead of fabricating the requested count.
- Treat account eligibility as an evidence-backed estimate, never a fact.
- Keep the research aggregate-focused: do not rank people, automate outreach, or perform engagement actions.
- Display sampling limitations, inclusion evidence, classification evidence, and source links in the dashboard.
- Keep raw and source-detail outputs local unless publication is approved.
