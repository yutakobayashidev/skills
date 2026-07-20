# Create Web API Implementation Plan

> **Scope update:** Task 1 remains the original design-mode baseline. After whole-API auditing was added, [2026-07-20-create-web-api-audit.md](2026-07-20-create-web-api-audit.md) superseded Tasks 2 and 3.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add and verify a `create-web-api` skill that produces compact, implementation-ready REST-like Web API specifications.

**Architecture:** Keep the skill workflow and output contract in a concise `SKILL.md`, move the detailed decision rubric into one directly linked reference, and validate discovery and response shape through Waza tasks. Generate standard skill metadata with the official initializer, then make only the repository integration change required in `README.md`.

**Tech Stack:** Agent Skills Markdown/YAML, Waza 0.31, skill-creator validation scripts, Git.

## Global Constraints

- Limit the skill to REST-like HTTP/Web API contract design; protocol alternatives receive selection guidance only.
- Remain language- and framework-agnostic unless the user explicitly asks for implementation advice.
- Do not generate implementation code or a complete OpenAPI document by default.
- Summarize and cite the Future Architect guideline; do not copy the article wholesale.
- Use `trials_per_task: 3` and deterministic task expectations.
- Keep `SKILL.md` focused on workflow and output shape; put the detailed rubric in `references/web-api-guidelines.md`.
- Add no scripts, assets, dependencies, compatibility shims, or unrelated documentation changes.

---

### Task 1: Establish the Evaluation Contract and RED Baseline

**Files:**
- Create: `evals/create-web-api/eval.yaml`
- Create: `evals/create-web-api/tasks/basic-usage.yaml`
- Create: `evals/create-web-api/tasks/edge-case.yaml`
- Create: `evals/create-web-api/tasks/should-not-trigger.yaml`

**Interfaces:**
- Consumes: Waza workspace discovery from `.waza.yaml` and the future skill name `create-web-api`.
- Produces: Three stable task prompts used for both the baseline and forward tests.

- [ ] **Step 1: Run fresh-agent RED scenarios without the skill**

Dispatch separate fresh-context agents with these exact prompts and no skill text:

```text
Design a REST API contract for a team bookmarks service. Cover endpoint table, request/response fields, status codes, error envelope, pagination, auth assumptions, and example calls. Do not write implementation code.
```

```text
Design an API contract for submitting payments that may be retried and processed asynchronously. Specify an idempotency key, authentication and resource authorization, concurrent update handling, async job status, rate limits, errors, and examples. Do not implement it.
```

For each output, record concrete omissions, inconsistent defaults, unnecessary implementation drift, and questions that block progress despite a safe default. The expected RED signal is at least one omitted contract dimension or an ambiguous rule across the two scenarios. If both controls fully satisfy every requested dimension, narrow the skill to the reference and reusable output template rather than adding corrective rules unsupported by evidence.

- [ ] **Step 2: Write the Waza suite**

Create `evals/create-web-api/eval.yaml` with:

```yaml
name: create-web-api-eval
description: Evaluation suite for create-web-api.
skill: create-web-api
version: "1.0"
config:
  executor: mock
  trials_per_task: 3
  timeout_seconds: 300
  parallel: false
  model: claude-sonnet-4.6
metrics:
  - name: task_completion
    weight: 1.0
    threshold: 0.8
    description: Did the skill complete the assigned task?
graders:
  - type: code
    name: has_output
    config:
      assertions:
        - "len(output) > 0"
tasks:
  - "tasks/*.yaml"
```

Create `evals/create-web-api/tasks/basic-usage.yaml` with:

```yaml
id: create-web-api-basic-001
name: Basic REST API Contract
description: Test the complete output shape for a small resource-oriented API.
tags:
  - basic
  - happy-path
inputs:
  prompt: "Design a REST API contract for a team bookmarks service. Cover endpoint table, request/response fields, status codes, error envelope, pagination, auth assumptions, and example calls. Do not write implementation code."
expected:
  output_contains:
    - "endpoint table"
    - "status codes"
    - "error envelope"
    - "example"
  outcomes:
    - type: task_completed
```

Create `evals/create-web-api/tasks/edge-case.yaml` with:

```yaml
id: create-web-api-edge-001
name: Retryable Asynchronous Payment API
description: Test safety and lifecycle decisions for a retryable asynchronous operation.
tags:
  - edge-case
inputs:
  prompt: "Design an API contract for submitting payments that may be retried and processed asynchronously. Specify an idempotency key, authentication and resource authorization, concurrent update handling, async job status, rate limits, errors, and examples. Do not implement it."
expected:
  output_contains:
    - "idempotency key"
    - "resource authorization"
    - "concurrent update"
    - "async job status"
    - "rate limits"
  outcomes:
    - type: task_completed
```

Create `evals/create-web-api/tasks/should-not-trigger.yaml` with:

```yaml
id: create-web-api-negative-001
name: Implementation-only GraphQL Request
description: Avoid replacing an already-fixed GraphQL contract with a REST design.
tags:
  - anti-trigger
  - negative-test
inputs:
  prompt: "Implement a GraphQL resolver in TypeScript for a user profile query. The schema and API contract are already fixed; only write the resolver and tests."
expected:
  output_not_contains:
    - "REST specification"
    - "Endpoint table"
  outcomes:
    - type: task_completed
```

- [ ] **Step 3: Run the mock suite before the skill exists**

Run:

```bash
waza run evals/create-web-api/eval.yaml -v
```

Expected: Waza discovers all 3 tasks and completes 3 trials per task without schema or grader errors. This verifies evaluation structure only; the fresh-agent outputs from Step 1 are the behavioral RED evidence.

- [ ] **Step 4: Commit the evaluation contract**

```bash
git add evals/create-web-api
git commit -m "test: add create-web-api evals"
```

### Task 2: Create the Reference and Minimal Skill

**Files:**
- Create: `skills/create-web-api/SKILL.md`
- Create: `skills/create-web-api/references/web-api-guidelines.md`
- Create: `skills/create-web-api/agents/openai.yaml`

**Interfaces:**
- Consumes: The baseline failures and task prompts from Task 1.
- Produces: A discoverable `$create-web-api` workflow and one directly linked design rubric.

- [ ] **Step 1: Initialize the skill with the official generator**

Run:

```bash
nix shell nixpkgs#python3 --command python3 /home/yuta/.config/codex/skills/.system/skill-creator/scripts/init_skill.py create-web-api --path skills --resources references --interface 'display_name=Create Web API' --interface 'short_description=Design consistent REST-like Web API contracts' --interface 'default_prompt=Use $create-web-api to design a REST-like Web API contract for this service.'
```

Expected: `skills/create-web-api/` contains `SKILL.md`, `agents/openai.yaml`, and an empty `references/` directory. Do not add scripts, assets, or example placeholders.

- [ ] **Step 2: Replace the generated SKILL.md with the minimal workflow**

Write `skills/create-web-api/SKILL.md` with:

```markdown
---
name: create-web-api
description: Use when designing or reviewing REST-like HTTP/Web API contracts, including resources, endpoints, methods, request and response schemas, status codes, errors, pagination, idempotency, authentication, authorization, or versioning.
---

# Create Web API

Design a Web API contract that is consistent for client developers, explicit about behavior, and ready to implement.

## Do This First

- Read [references/web-api-guidelines.md](references/web-api-guidelines.md) and apply it as the default rubric.
- Treat the project's existing public API conventions as a compatibility constraint. Call out harmful inconsistencies instead of silently extending them.
- Ask only questions whose answers materially change the public contract. If the user is unsure, state a reasonable default and proceed.

## Clarify Fast

Resolve only missing contract decisions:

- API purpose, consumers, and trust boundary
- resources, relationships, and required operations
- authentication and resource-level authorization
- synchronous, asynchronous, or streaming behavior
- compatibility and versioning constraints
- scale or limits that affect pagination, uploads, timeouts, or rate limits

If REST is a poor fit, explain why and recommend GraphQL or gRPC before designing endpoints.

## Deliverables

Produce a compact specification. Drop irrelevant sections:

1. **Scope and assumptions**
2. **Resource model**: resources, identifiers, ownership, and relationships
3. **Endpoint table**: method, path, purpose, auth, idempotency, success status, and state change
4. **Requests**: path, query, header, and body fields with type, requiredness, constraints, and examples
5. **Responses**: schemas and representative success examples
6. **Errors**: stable envelope, status-code map, validation details, and retryability
7. **Cross-cutting rules**: pagination, filtering, sorting, concurrency, retries, bulk behavior, and asynchronous jobs
8. **Security and operations**: authorization, rate and payload limits, trace IDs, timeouts, and health checks
9. **Compatibility**: breaking-change and versioning policy
10. **Examples**: common success and failure flows

Mark unresolved product decisions explicitly. Do not invent domain rules.

## Default Conventions

- Use HTTPS and JSON. Never put credentials, tokens, or sensitive values in URLs.
- Model nouns as resources. Use plural kebab-case paths and shallow nesting.
- Follow HTTP method semantics; do not use `POST` for every operation.
- Use standard status codes and one machine-readable error envelope.
- Use cursor pagination for large or frequently changing collections.
- Define idempotency for retryable writes; require an idempotency key when duplicate creation is harmful.
- Treat authentication and resource-level authorization as separate checks.
- Make backward-compatible changes where practical. Add a new major API version only for unavoidable breaking changes.
- Define request limits, timeouts, rate-limit signaling, trace propagation, and health behavior when relevant.
- Explain every deviation from these defaults.

## Specification Skeleton

```markdown
1. **Name**: `service-api`
2. **One-liner**: ...
3. **Scope and assumptions**: ...
4. **Resources**: ...
5. **Endpoints**:
   | Method | Path | Purpose | Auth | Idempotency | Success |
   | --- | --- | --- | --- | --- | --- |
6. **Schemas**: requests, responses, and examples
7. **Errors**: envelope and status map
8. **Cross-cutting rules**: pagination, concurrency, retries, limits
9. **Compatibility**: versioning and deprecation
10. **Examples**: ...
```

## Boundaries

- Stay language- and framework-agnostic unless implementation guidance is requested.
- Do not generate a complete OpenAPI document unless requested.
- For an implementation-only request with a fixed contract, follow that contract instead of redesigning it.
```

- [ ] **Step 3: Write the curated reference**

Write `skills/create-web-api/references/web-api-guidelines.md` with:

```markdown
# Web API Design Rubric

Use this as a baseline, not a universal standard. Adapt it to the product, consumers, risk, and existing contracts.

Source: Future Architect, [Web API Guidelines](https://future-architect.github.io/arch-guidelines/documents/forWebAPI/web_api_guidelines.html). This file summarizes and reorganizes the source for contract-design decisions.

## Protocol Selection

Prefer REST for resource-oriented request/response APIs that benefit from HTTP caching, status codes, gateways, and broad tooling.

Choose another protocol only when its benefit justifies its operational cost:

| Need | Prefer | Reason |
| --- | --- | --- |
| Client-selected shapes over a highly connected graph | GraphQL | Avoids fixed response over-fetching, but adds query-cost and N+1 controls |
| Low-latency internal calls or bidirectional streaming | gRPC | Binary contracts and streaming, but weaker browser and HTTP-tool compatibility |
| Resource-oriented business operations | REST | Mature, observable, cacheable, and widely interoperable |

Do not default to JSON-RPC when ordinary resource operations and a small number of action endpoints express the domain clearly.

## Naming and Resource Shape

- Use plural, kebab-case path segments: `/delivery-schedules`.
- Use consistent JSON and query-field casing. When no project convention exists, use snake_case as the source guideline's default.
- Use opaque, stable identifiers. Do not expose mutable names as primary identifiers.
- Nest when the child exists only in the parent's lifecycle or is principally listed through the parent: `/articles/{article_id}/comments`.
- Keep an independently addressable child flat: `/comments/{comment_id}`.
- Avoid supporting both flat and nested forms without a demonstrated client need.
- Keep nesting shallow; deep paths couple unrelated identifiers and complicate authorization.

## Hosting and Versioning

- Use a subpath when the site and API share a domain and deployment boundary; use an API subdomain for an independently operated service.
- Prefer backward-compatible evolution: add optional request fields and additive response fields.
- Treat renamed or removed fields, changed paths, and materially changed behavior as breaking changes.
- Introduce a path major version such as `/v2` only when clients need a migration window for a breaking contract.
- Do not expose patch or minor versions in paths.

## Methods and Success Statuses

| Operation | Method | Typical success | Contract notes |
| --- | --- | --- | --- |
| Read one or many | `GET` | `200` | No request body; define cache and empty-list behavior |
| Create | `POST` | `201` | Return the created representation or `Location` |
| Replace | `PUT` | `200` or `204` | Idempotent; define create-if-absent behavior explicitly |
| Partially update | `PATCH` | `200` or `204` | Define patch format and omitted/null semantics |
| Delete | `DELETE` | `204` | Idempotent outcome; define repeated-delete behavior |
| Accept async work | `POST` | `202` | Return a job/status URL and polling or callback rules |

Use an action subresource only when the behavior is not naturally CRUD, for example `POST /orders/{id}/cancellations`. Name the action as a domain concept rather than a verb when possible.

## Requests and Responses

- State field type, requiredness, nullability, format, range, length, and enum values.
- Reject unknown fields only if clients can safely coordinate schema changes; otherwise define how they are ignored.
- Distinguish omitted, `null`, empty, and default values.
- Use ISO 8601/RFC 3339 timestamps with an explicit offset, normally UTC.
- Use strings for decimal money values and pair amounts with an explicit currency.
- Use URLs or object storage flows for large binary content instead of embedding it in JSON.
- Return a consistent top-level representation. Avoid per-endpoint envelope variations.

## Errors and Validation

Use one stable error shape, for example:

```json
{
  "code": "invalid_request",
  "message": "The request is invalid.",
  "details": [
    { "field": "title", "reason": "required" }
  ],
  "trace_id": "01J..."
}
```

- Keep `code` stable and machine-readable; allow `message` to improve without becoming a client switch key.
- Return all safe validation failures when practical.
- Do not expose stack traces, database errors, secrets, or authorization-sensitive existence details.
- Use `400` for malformed requests, `401` for missing/invalid authentication, `403` for denied authorization, `404` for absent or intentionally concealed resources, `409` for state conflicts, `412` for failed preconditions, `422` for well-formed but semantically invalid input when the API distinguishes it, `429` for rate limits, and `5xx` for server failures.
- State whether an error is retryable and include `Retry-After` when the server can provide it.

## Collections

- Define filters as an allowlist with types and combination semantics.
- Define stable sort keys and a deterministic tie-breaker.
- Prefer cursor pagination for large or changing collections. Return an opaque next cursor and define page-size limits.
- Offset pagination is acceptable for small, stable, directly navigable datasets when drift is understood.
- Put result metadata in a consistent envelope or documented headers.
- Avoid unbounded collection responses.

## Idempotency, Concurrency, and Retries

- `GET`, `PUT`, and `DELETE` should preserve their HTTP idempotency semantics.
- For retryable create or charge operations, accept an idempotency key scoped to the caller and operation. Define retention, replay response, payload mismatch, and in-progress behavior.
- Use ETags or an explicit version field with `If-Match` for lost-update protection. Return `412` or `409` consistently on conflicts.
- Specify which failures clients may retry, maximum attempts, exponential backoff, and jitter.
- Do not retry non-idempotent operations unless an idempotency mechanism makes replay safe.

## Asynchronous and Bulk Work

- Return `202 Accepted` with a durable operation identifier and status URL.
- Define states such as `queued`, `running`, `succeeded`, `failed`, and `cancelled`, including terminal-state payloads and retention.
- Define polling cadence, `Retry-After`, cancellation, callbacks, and duplicate notification behavior when applicable.
- For bulk work, define atomic versus partial success. If partial, return an item-correlated result for every input.

## Security

- Use TLS for all non-local traffic.
- Keep authentication separate from resource authorization and tenant isolation.
- Never place passwords, API keys, bearer tokens, session IDs, or sensitive personal data in paths or query strings.
- Scope credentials and permissions to the minimum operations and resources required.
- For browser cookies, use `Secure`, `HttpOnly`, an appropriate `SameSite` value, narrow domain scope, and a deliberate path. Prefer the `__Host-` prefix when its path requirements fit.
- Allow only required CORS origins, methods, and headers. Do not combine credentialed requests with a wildcard origin.
- Define payload and header size limits and validate media types.

## Operations and Observability

- Define per-caller or per-tenant rate limits where shared-resource exhaustion matters. Return `429` and useful limit/reset metadata.
- Bound server and downstream timeouts so the application fails before its gateway does.
- Accept or create a trace identifier, return it to the caller, and propagate it to downstream calls. Do not trust a caller-provided ID as authorization evidence.
- Use `/health` for process health and `/healthz` for dependency-aware health when both are needed. Kubernetes deployments may use `/live` and `/ready`.
- Keep health-check logs quiet unless failures need diagnosis.
- Document deprecation with a migration path and removal date.

## Common Mistakes

| Mistake | Better contract |
| --- | --- |
| Verbs and arbitrary RPC paths everywhere | Resource paths plus a small number of domain action resources |
| `200` for every result | Status codes that express creation, absence, conflict, async acceptance, and server failure |
| Per-endpoint error shapes | One stable error envelope and code namespace |
| Unbounded list endpoints | Explicit filtering, stable sorting, page limits, and cursors |
| Authentication without ownership checks | Resource-level authorization and tenant isolation |
| Retrying `POST` blindly | Idempotency keys and documented replay behavior |
| Versioning every small change | Additive evolution and major versions only for real breaking changes |
| Designing implementation details instead of a contract | Observable request, response, state, error, and compatibility behavior |
```

- [ ] **Step 4: Verify metadata generated by the initializer**

Confirm `skills/create-web-api/agents/openai.yaml` is exactly:

```yaml
interface:
  display_name: "Create Web API"
  short_description: "Design consistent REST-like Web API contracts"
  default_prompt: "Use $create-web-api to design a REST-like Web API contract for this service."
```

If it differs, regenerate it with:

```bash
nix shell nixpkgs#python3 --command python3 /home/yuta/.config/codex/skills/.system/skill-creator/scripts/generate_openai_yaml.py skills/create-web-api --interface 'display_name=Create Web API' --interface 'short_description=Design consistent REST-like Web API contracts' --interface 'default_prompt=Use $create-web-api to design a REST-like Web API contract for this service.'
```

- [ ] **Step 5: Validate the skill package**

Run:

```bash
nix shell nixpkgs#python3 --command python3 /home/yuta/.config/codex/skills/.system/skill-creator/scripts/quick_validate.py skills/create-web-api
waza check skills/create-web-api
```

Expected: both commands report a valid/ready skill with correct frontmatter, token budget, and eval discovery.

- [ ] **Step 6: Run fresh-agent GREEN scenarios with the skill**

Dispatch fresh agents using each Task 1 prompt prefixed with:

```text
Use $create-web-api at /home/yuta/ghq/github.com/yutakobayashidev/skills/skills/create-web-api to complete this request.
```

Expected: both responses cover every requested dimension, remain implementation-agnostic, make safe defaults explicit, and do not repeat omissions observed in RED. If a new omission appears, add only the smallest positive output requirement or reference rule that closes it, then repeat with a fresh agent.

- [ ] **Step 7: Commit the skill**

```bash
git add skills/create-web-api
git commit -m "feat: add create-web-api skill"
```

### Task 3: Integrate Documentation and Verify the Repository

**Files:**
- Modify: `README.md`
- Verify: `AGENTS.md`
- Verify: `CLAUDE.md` if present
- Verify: `docs/`

**Interfaces:**
- Consumes: The validated skill and eval suite from Tasks 1 and 2.
- Produces: Repository discovery documentation and final verification evidence.

- [ ] **Step 1: Add the README skill entry**

Insert this row alphabetically after `check-similarity`:

```markdown
| [create-web-api](skills/create-web-api)                                 | Design consistent REST-like Web API contracts                    |
```

- [ ] **Step 2: Run focused evaluation and validation**

Run:

```bash
waza run evals/create-web-api/eval.yaml -v
nix shell nixpkgs#python3 --command python3 /home/yuta/.config/codex/skills/.system/skill-creator/scripts/quick_validate.py skills/create-web-api
waza check skills/create-web-api
```

Expected: all 9 mock trials succeed; the package validator and Waza readiness check pass.

- [ ] **Step 3: Run repository-level structural checks**

Run:

```bash
waza run --output-dir /tmp/create-web-api-waza-results
git diff --check
git status --short
```

Expected: all repository mock evals complete without schema errors, `git diff --check` prints nothing, and status lists only the planned `README.md` change after the earlier commits.

- [ ] **Step 4: Perform the pre-commit documentation check**

Verify:

- `README.md` contains the new feature entry.
- `AGENTS.md` needs no change because workflow commands and agent-facing rules are unchanged.
- `CLAUDE.md` needs no change if absent or if no Claude-specific instruction changed.
- `docs/` already contains the approved design and implementation plan.

- [ ] **Step 5: Review the final diff for simplicity and scope**

Run:

```bash
git diff 86cd2a7 -- README.md skills/create-web-api evals/create-web-api docs/superpowers
git diff --check
```

Expected: one skill, one reference, one metadata file, three evaluation tasks, the README entry, and the two approved planning documents; no scripts, assets, framework branches, fallback paths, or unrelated edits.

- [ ] **Step 6: Commit the repository integration**

```bash
git add README.md
git commit -m "docs: list create-web-api skill"
```

- [ ] **Step 7: Verify the committed state**

Run:

```bash
git status --short
git log -5 --oneline
```

Expected: the worktree is clean and the design, eval, skill, and README commits are visible.
