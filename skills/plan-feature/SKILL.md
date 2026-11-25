---
name: plan-feature
description: Turn a feature request or research handoff into implementation-ready GitHub issue drafts using the target repository's code, terms, and verification tools. Use when planning a feature for handoff to an implementation workflow.
---

# Plan a feature

Read the target repository's instructions, relevant code and tests, and any glossary or decisions that constrain the feature. Separate facts from assumptions and carry forward relevant findings and links from the brief.

- Identify the behavior the user wants and the smallest independently verifiable change that delivers it.
- Use the reasoning and formats from `domain-modeling` when new terms, states, or business rules need agreement. In a read-only session, return proposed glossary or ADR content in the draft. If an unresolved decision changes the implementation materially, return the question, available evidence, and what it blocks.
- Name a small experiment when an observable result would resolve a design question. Include the exact result that would let the user decide.

Draft one Issue for a bounded deliverable. For several deliverables, draft an Epic with its goal and sub-issues, each with its own acceptance checks. State which Issues truly depend on another Issue or a pending design decision, so the caller can add `Blocked by` in GitHub.

Use these fields for each implementation Issue.

- **Goal and context** — the requested outcome, why it matters, and relevant source links or repository locations.
- **Scope and decisions** — agreed behavior, open questions that affect delivery, and dependencies.
- **Acceptance and evidence** — observable behavior, the relevant command or user flow, and the output or artifact that will prove it. Use commands supported by the checkout and identify any runtime or fixture still needed.

Return the drafts and any blocking question to the caller. Leave implementation, publication and status changes to the caller's workflow.
