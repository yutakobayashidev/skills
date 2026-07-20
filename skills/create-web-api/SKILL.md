---
name: create-web-api
description: "**WORKFLOW SKILL** - Use when designing, reviewing, or auditing REST-like HTTP/Web API contracts. USE FOR: resources, endpoints, schemas, errors, pagination, idempotency, auth, versioning, and whole-API audits. DO NOT USE FOR: implementation-only work with a fixed contract or GraphQL/gRPC schema design."
---

# Create Web API

Design or audit an implementation-ready Web API contract.

## Workflow

1. Read [references/web-api-guidelines.md](references/web-api-guidelines.md) as the default rubric.
2. For a whole-API audit, also read [AUDIT.md](AUDIT.md) and follow its evidence and report contract.
3. Preserve existing public conventions; flag harmful inconsistencies.
4. Ask only about missing decisions that materially change the contract.
5. If REST is a poor fit, recommend GraphQL or gRPC before designing endpoints.

## Clarify Fast

Resolve purpose and consumers; resources and operations; trust boundary and authorization; sync/async behavior; compatibility; and limits affecting pagination, uploads, timeouts, or rate limits.

Use explicit assumptions when safe. Present product-dependent numeric limits, retention, scopes, and state transitions as decisions to confirm, not facts.

## Design Deliverables

Produce a compact specification; drop irrelevant sections:

1. Scope, assumptions, resources, ownership, relationships
2. Endpoint table: method, path, purpose, auth, idempotency, success, state change
3. Request/response fields: types, constraints, examples
4. Error envelope, status map, validation, retryability
5. Pagination, concurrency, retries, async behavior, security, limits, compatibility
6. Common success and failure examples

Mark unresolved product decisions; do not invent domain rules.

## Missing or Conflicting Input

Ask one blocking question only when no safe default exists. Otherwise state the assumption and proceed. Preserve compatibility when project conventions conflict with the rubric, and flag the trade-off.

## Boundaries

- Stay language- and framework-agnostic unless implementation guidance is requested.
- Do not generate complete OpenAPI unless requested.
- For implementation-only work with a fixed contract, follow it instead of redesigning it.
