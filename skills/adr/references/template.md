# ADR Templates

Use the default template unless the decision is broad, risky, or heavily debated.

## Default template

```md
## Status

- Proposed | Accepted | Superseded | Deprecated

## Context

- What problem, constraint, or trigger makes this decision necessary.
- Existing system assumptions, deadlines, affected teams, or migration pressure.

## Decision

- The chosen direction in direct language.
- Scope boundaries, defaults, and important non-goals.

## Consequences

- Positive: the main benefits or risk reductions.
- Negative: the cost, coupling, migration burden, or operational tradeoff.
- Follow-up: required implementation or rollout work if it is known.

## Adoption and Exceptions

- How the team will enforce the decision in code review, CI, documentation, or runtime operations.
- What counts as an exception, who approves it, and how it is recorded.
```

## Expanded template

Use this when the reader needs to see explicit tradeoffs or when several alternatives are plausible.

```md
## Status

- Proposed | Accepted | Superseded | Deprecated

## Decision Drivers

- The few criteria that actually determine the outcome.

## Context

- Current state, constraints, deadlines, and affected systems or teams.

## Options Considered

- Option A: why it was considered.
- Option B: why it was considered.

## Decision

- The chosen option and its scope.
- Any important limits, non-goals, or transition boundaries.

## Consequences

- Positive: benefits, simplifications, or safeguards gained.
- Negative: new costs, risks, or lock-in introduced.
- Migration: rollout steps, compatibility implications, or deprecation impact.

## Adoption and Exceptions

- Required checks in review, CI, operations, or documentation.
- Exception process, owner, and evidence required.

## Open Questions

- Unknowns that should be resolved later without blocking the current decision.
```

## Section guidance

- `Status`: default to `Proposed` unless the user clearly says the decision is already accepted.
- `Context`: write facts first. If something is assumed, label it.
- `Decision`: lead with the final answer, not the build-up.
- `Consequences`: include both upside and cost. An ADR that only sells the benefits is incomplete.
- `Adoption and Exceptions`: focus on enforceable mechanics, not slogans.

## External references

- AWS Prescriptive Guidance FAQ:
  `https://docs.aws.amazon.com/ja_jp/prescriptive-guidance/latest/architectural-decision-records/faq.html#q2`
- ADR GitHub organization, existing templates and related guidance:
  `https://adr.github.io/#existing-adr-templates`
