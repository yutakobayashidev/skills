---
name: plan-feature
description: Plan a new project or feature, clarify its domain and decisions, and turn the agreed scope into verifiable GitHub Issue drafts.
---

# Plan a feature

Start from the desired outcome and identify the target before selecting a checkout or drafting Issues.

- If the user clearly wants a separate repository, use [the new-project workflow](references/new-project.md). Run `init-project` only after the user approves the proposed repository setup.
- If the request or conversation identifies an existing target repository, use its checkout and read its instructions, relevant code, tests, and glossary.
- If the choice between an existing repository and a new one is unclear and would change the plan, return one focused question and wait for the answer. For example, “Should this go in noren, or should it have its own repository?” Resume with the user's answer.

Use `domain-modeling` on every feature plan, including new and existing repositories. Settle the terms, states, and rules relevant to the feature before repository provisioning or Issue decomposition. Reuse established definitions when they already cover the change. In a read-only session, keep proposed glossary entries and warranted ADRs as drafts.

## Agree on requirements

Confirm the release scope, expected behavior, and acceptance criteria before decomposing the feature into Issues. Read the user's earlier decisions, accepted specs and ADRs, and existing Issues. Carry agreed requirements forward with their sources. Include any agreed decision missing from the relevant document in the proposed docs update.

If a choice would change the release scope, user-visible behavior, acceptance criteria, or an implementation prerequisite, return the unresolved question, available evidence, and the work it blocks. Resume planning with the user's answer. If an experiment is needed to decide, specify the result that would settle the question and resume with that evidence. If the user agrees to defer the affected behavior, remove it from the current scope and acceptance criteria.

In a write-capable OpenCode run, record the agreed requirements in the relevant docs. Commit authorized ADRs under `docs/adr/` using the repo convention or the format from `domain-modeling` and send them through the repo's PR flow. Carry links to the agreed requirements and decisions into the Issue drafts.

## Decompose the agreed scope

Split the agreed scope into the smallest independently verifiable changes that together deliver it. Draft one Issue for a bounded deliverable. For several deliverables, draft an Epic with its goal and sub-issues, each with its own type and acceptance checks. Use `Blocked by` for delivery prerequisites such as another implementation Issue. Leave out deliverables already completed and link their PRs in the Epic or dependent Issue.

Use these fields for each Issue.

- **Type** — epic, implementation, decision, or experiment. `manage-project-issues` decides board membership and status handling from it, so every draft carries one, including each sub-issue of an Epic.
- **Goal and context** — the requested outcome, why it matters, and relevant source links or repository locations.
- **Scope and decisions** — agreed behavior, links to the requirements and applicable decisions, and implementation dependencies.
- **Acceptance and evidence** — observable behavior, the relevant command or user flow, and the output or artifact that will prove it. Use commands supported by the checkout and identify any runtime or fixture still needed.

Return drafts that cover the whole agreed scope for one review. If drafting reveals a new question that affects the requirements, return to requirements planning before sending the decomposition for approval.
