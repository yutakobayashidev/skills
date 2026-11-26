---
name: plan-feature
description: Plan a new project or feature, clarify its domain and decisions, and turn the agreed scope into verifiable GitHub Issue drafts.
---

# Plan a feature

Start from the desired outcome and the user's current decisions. For an existing repository, read its instructions, relevant code, tests, and glossary. For a new project, use [the new-project workflow](references/new-project.md) to plan before provisioning a repository.

Use `domain-modeling` on every feature plan, including new and existing repositories. Settle the terms, states, and rules relevant to the feature before repository provisioning or Issue decomposition. Reuse established definitions when they already cover the change. In a read-only session, keep proposed glossary entries and warranted ADRs as drafts.

- Identify the behavior the user wants and the smallest independently verifiable change that delivers it.
- If an unresolved decision changes the implementation materially, return the question, available evidence, and what it blocks.
- Name a small experiment when an observable result would resolve a design question. Include the exact result that would let the user decide.

Draft one Issue for a bounded deliverable. For several deliverables, draft an Epic with its goal and sub-issues, each with its own acceptance checks. State which Issues truly depend on another Issue or a pending design decision, so the caller can add `Blocked by` in GitHub.

Use these fields for each implementation Issue.

- **Goal and context** — the requested outcome, why it matters, and relevant source links or repository locations.
- **Scope and decisions** — agreed behavior, open questions that affect delivery, and dependencies.
- **Acceptance and evidence** — observable behavior, the relevant command or user flow, and the output or artifact that will prove it. Use commands supported by the checkout and identify any runtime or fixture still needed.

Return the drafts and any blocking question to the caller. In a write-capable OpenCode run, commit authorized ADRs under `docs/adr/` using the repo convention or the format from `domain-modeling` and send them through the repo's PR flow. Give `manage-project-issues` the accepted ADR link on the default branch or the open decision Issue before publishing dependent work.
