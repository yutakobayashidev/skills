---
name: adr
description: Draft or refine an architecture decision record (ADR) when the user needs a durable technical decision, not just a summary. Use for architecture, dependency, API contract, infrastructure, security, tooling, or process choices that need clear rationale, rejected alternatives, consequences, and an adoption path.
user-invocable: true
---

# adr

Create an ADR draft that someone can review and act on.

The goal is not a long essay. The goal is a durable record of what was decided, why it was chosen, what was not chosen, what changes next, and how the team will keep the decision in force.

## Default stance

- Prefer concrete, reviewable statements over broad principles.
- Separate facts, assumptions, and the final decision.
- Do not invent certainty. Mark missing facts as `Assumption:` or `Follow-up:`.
- Treat compliance as enforcement: review checks, CI rules, ownership, and exception handling.
- Keep the first draft short. Expand only when the decision is risky, broad, or contested.

## Use this skill when

- Choosing system boundaries, deployment topology, or data ownership.
- Standardizing a dependency, framework, driver, build tool, or test stack.
- Defining API, schema, event, or versioning policy.
- Capturing security, privacy, reliability, performance, or auditability decisions.
- Formalizing an engineering process that changes how code is reviewed, shipped, or operated.

## ADR vs Design Doc

- Use an ADR when the core deliverable is a durable decision: what was chosen, why it beat the alternatives, what consequences follow, and how the team will enforce it.
- Use a design doc when the core deliverable is implementation design: architecture shape, component flow, data model, rollout plan, operational detail, and open implementation questions.
- If the user brings a large solution proposal, extract the irreversible or standard-setting decisions into ADRs and leave the execution detail in the design doc.
- If only one artifact will exist, bias toward an ADR when the long-term value is decision history, and bias toward a design doc when the long-term value is build guidance.

## Workflow

### 1. Frame the decision

- State the decision in one sentence.
- Extract the hard constraints, timeline pressure, and affected systems or teams.
- If the request sounds like an implementation task, surface the implied decision before drafting the ADR.
- Decide where the ADR should live in the repository before drafting it. In a monorepo, prefer one shared ADR tree unless the user already has a stronger convention.

### 2. Pressure-test the proposal

- Name the leading alternative options.
- Identify the real decision drivers: cost, speed, safety, operability, compatibility, migration effort, team familiarity, or vendor risk.
- Call out unknowns that materially weaken the recommendation.

### 3. Draft the ADR

- Use the default template in `references/template.md`.
- Promote to the expanded template only when the decision is cross-cutting or politically sensitive.
- Mention rejected alternatives only when they help the reader understand why the chosen path won.
- When the user wants a repo-ready ADR, follow the directory and filename guidance in `references/location.md`.

### 4. Make it enforceable

- Describe what changes in implementation, review, CI, or operations because of this ADR.
- State who can approve exceptions and what evidence is required.

## Output rules

- Preserve the user's language unless they explicitly ask for another one.
- Default to concise Markdown with one bullet per distinct point.
- Prefer direct statements such as "Adopt X as the standard" over passive wording.
- If the user asks for a quick decision memo instead of a formal ADR, keep the same structure but compress the wording.

## Reference routing

- Use `references/template.md` for the standard ADR shapes and section guidance.
- Use `references/location.md` for recommended in-repo ADR placement, naming, and monorepo conventions.
- Use `references/readme-template.md` only when the repo wants a lightweight `docs/adr/README.md` scaffold.
- Use the external references listed in `references/template.md` when the user wants public ADR guidance or template sources.
