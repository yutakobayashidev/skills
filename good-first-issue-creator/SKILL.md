---
name: good-first-issue-creator
description: Draft or refine a newcomer-friendly GitHub issue from repo context. Use when the user asks to create a "good first issue", wants a small scoped starter task, needs an issue body with clear acceptance criteria, or wants to split a larger task into a safe first contribution.
---

# Good First Issue Creator

Create a small, concrete, low-risk issue that a new contributor can finish without needing broad system knowledge.

The goal is not to find any easy task. The goal is to define a task with a narrow blast radius, explicit verification, and enough context that the assignee does not need to reverse-engineer the repo first.

## Default stance

- Prefer issues that touch one subsystem or a small cluster of related files.
- Prefer additive or local cleanup work over refactors, migrations, or policy changes.
- Do not label a task "good first issue" if hidden repo knowledge, production credentials, or cross-cutting architectural judgment is required.
- If the candidate task is still too large, split it again before drafting the issue.

## Issue quality bar

A good first issue should satisfy most of these constraints:

- Solvable in one focused session, usually not more than a few files.
- Has an obvious definition of done.
- Can be verified with a command, test, or clear manual check.
- Does not require access to secret systems, paid services, or production environments.
- Does not depend on unresolved design decisions.
- Has a clear starting point in the codebase.

Reject or re-scope tasks with these failure modes:

- "Refactor X" without a bounded target.
- "Improve DX" or "clean up config" without a concrete symptom.
- Work that spans many packages, many workflows, or many platforms at once.
- Tasks where the hard part is deciding what should happen rather than implementing it.

## Workflow

### 1. Find a candidate task

- Inspect the repo for obvious small gaps: stale docs, missing validation, isolated lint/test failures, narrow config drift, tiny automation gaps, or localized cleanup.
- Start from concrete evidence such as a TODO, failing command, repeated manual step, missing script, or inconsistent file pattern.
- If the user already suggests a larger feature, extract the smallest independently useful slice.

### 2. Pressure-test the scope

Before drafting, check:

- Which files will likely change?
- Can the task stay within one directory or one concern?
- Is there a direct verification step?
- Would a first-time contributor know where to start from the issue alone?

If any answer is unclear, narrow the task further and rewrite the goal.

### 3. Write the issue

Default to this structure:

```md
## Summary

One paragraph describing the problem and the intended outcome.

## Why this is a good first issue

- Small scope
- Clear starting points
- Straightforward verification

## Background

- Current behavior
- Why it is a problem
- Relevant files or commands

## Proposed change

1. Concrete step
2. Concrete step
3. Concrete step

## Acceptance criteria

- Observable result
- Verification command or manual check
- Any doc or test update required

## Out of scope

- Explicitly exclude adjacent work that should not be bundled in

## Pointers

- Relevant files
- Relevant commands
- Similar examples in the repo
```

## Writing rules

- Use direct language and concrete file paths when known.
- Prefer "Update `path/to/file` to do X" over abstract requests.
- Explain enough repo context to start, but do not turn the issue into a design doc.
- Include exact commands when verification is known.
- Name the constraints explicitly: platform, host, package manager, test target, or doc surface.
- Add "Out of scope" whenever nearby cleanup would be tempting.

## Scoping heuristics

Use these patterns when carving a starter issue out of a larger request:

- From a broad refactor, take one repeated call site or one module.
- From a feature request, take one prerequisite such as a script, validation, or doc update.
- From repo hygiene work, take one command, one module, or one platform path.
- From failing CI, take one reproducible failure with one clear fix path.

Avoid these starter-issue anti-patterns:

- Introducing a new framework or dependency unless the change is trivial and isolated.
- Reorganizing many files just for consistency.
- Combining code changes, infra changes, and docs changes unless the doc update is tiny and inseparable.

## Output expectations

When the user asks for a good first issue, provide:

- A short title.
- A complete Markdown issue body.
- One sentence explaining why the scope is beginner-friendly.
- If useful, one sentence explaining how you intentionally narrowed the scope.

If no valid good first issue exists yet, say so plainly and propose 1 to 3 smaller candidate slices instead of forcing a bad label.
