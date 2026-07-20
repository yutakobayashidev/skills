# Create Web API Audit Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `create-web-api` with an evidence-backed whole-API audit mode while preserving its compact contract-design workflow.

**Architecture:** Route audit requests from `SKILL.md` to a lazily loaded `AUDIT.md` playbook. Audit fixtures cover definition, implementation, and documentation drift; Waza validates task structure while fresh-context agents provide RED/GREEN behavioral evidence.

**Tech Stack:** Agent Skills Markdown/YAML, Waza 0.31, OpenAPI fixture YAML, TypeScript route fixture, skill-creator validators, Git.

## Global Constraints

- Keep design and audit in the same `create-web-api` skill.
- Load `AUDIT.md` only for whole-API review requests.
- Use five user-facing buckets: contract correctness, consistency/DX, security, reliability/operations, compatibility/maintainability.
- Require `path:line`, OpenAPI JSON Pointer, or method/path plus artifact location for every finding.
- Rank by impact and exposure; do not equate rule severity with priority.
- Separate confirmed findings, improvement opportunities, and coverage gaps.
- Respect suppressions, compatibility constraints, and documented tradeoffs.
- Do not modify audited files unless the user separately requests fixes.
- Keep `SKILL.md` within Waza's 500-token budget.
- Use `trials_per_task: 3` and deterministic expectations.

---

### Task 1: Add the Audit Fixture and RED Scenario

**Files:**
- Create: `evals/create-web-api/fixtures/inconsistent-api/openapi.yaml`
- Create: `evals/create-web-api/fixtures/inconsistent-api/routes.ts`
- Create: `evals/create-web-api/fixtures/inconsistent-api/README.md`
- Create: `evals/create-web-api/tasks/audit-existing-api.yaml`

**Interfaces:**
- Consumes: `evals/create-web-api/eval.yaml` task glob and the existing design-mode evaluation suite.
- Produces: A repository-shaped audit scenario with definition, implementation, and documentation evidence.

- [ ] **Step 1: Create the inconsistent API fixture**

Create `evals/create-web-api/fixtures/inconsistent-api/openapi.yaml` with:

```yaml
openapi: 3.0.3
info:
  title: Accounts API
  version: 1.0.0
servers:
  - url: /v1
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
  schemas:
    User:
      type: object
      required: [id, email]
      properties:
        id: { type: string }
        email: { type: string, format: email }
    Error:
      type: object
      required: [message]
      properties:
        message: { type: string }
security:
  - bearerAuth: []
paths:
  /users/{user_id}:
    get:
      operationId: getUser
      parameters:
        - name: user_id
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          description: User
          content:
            application/json:
              schema: { $ref: "#/components/schemas/User" }
        "404":
          description: Missing user
          content:
            application/json:
              schema: { $ref: "#/components/schemas/Error" }
  /users:
    post:
      operationId: createUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email]
              properties:
                email: { type: string, format: email }
      responses:
        "200":
          description: Created user
          content:
            application/json:
              schema: { $ref: "#/components/schemas/User" }
  /reports:
    get:
      operationId: listReports
      parameters:
        - name: access_token
          in: query
          required: true
          schema: { type: string }
      responses:
        "200":
          description: All reports
          content:
            application/json:
              schema:
                type: array
                items: { type: object }
```

Create `evals/create-web-api/fixtures/inconsistent-api/routes.ts` with:

```typescript
router.get("/users/:userId", requireAuth, async (req, res) => {
  const user = await users.find(req.params.userId);
  if (!user) return res.status(404).json({ code: "not_found" });
  return res.json({ userId: user.id, email: user.email });
});

router.post("/users", async (req, res) => {
  const user = await users.create(req.body);
  return res.status(201).json({ id: user.id, email: user.email });
});

router.get("/reports", requireAuth, async (_req, res) => {
  return res.json(await reports.listAll());
});
```

Create `evals/create-web-api/fixtures/inconsistent-api/README.md` with:

```markdown
# Accounts API

All errors use `{ "error": { "code": string, "message": string } }`.

`GET /v1/reports` returns every report visible to the caller. Pagination is not currently documented.
```

- [ ] **Step 2: Run the fresh-agent RED audit without audit guidance**

Dispatch a fresh-context agent with no skill text:

```text
Audit the entire REST API represented by inconsistent-api/openapi.yaml, inconsistent-api/routes.ts, and inconsistent-api/README.md. Report scope and coverage, prioritize findings under Contract correctness, Consistency & DX, Security, Reliability & operations, and Compatibility & maintainability, cite path:line or OpenAPI JSON Pointer evidence, separate opportunities from confirmed findings, list coverage gaps, and do not edit files.
```

Expected RED evidence: the response misses at least one required bucket, fails to distinguish definition/implementation/documentation evidence, cites findings without exact locations, or mixes unconfirmed opportunities with confirmed defects. Record the exact failure shape; do not add audit rules for behavior the control already handles correctly.

- [ ] **Step 3: Add the audit task**

Create `evals/create-web-api/tasks/audit-existing-api.yaml` with:

```yaml
id: create-web-api-audit-001
name: Whole API Audit
description: Audit definition, implementation, and documentation with source-located findings and coverage gaps.
tags:
  - audit
  - repository
inputs:
  prompt: "Audit the entire REST API represented by inconsistent-api/openapi.yaml, inconsistent-api/routes.ts, and inconsistent-api/README.md. Report scope and coverage, prioritize findings under Contract correctness, Consistency & DX, Security, Reliability & operations, and Compatibility & maintainability, cite path:line or OpenAPI JSON Pointer evidence, separate opportunities from confirmed findings, list Coverage gaps, and do not edit files."
  files:
    - path: inconsistent-api/openapi.yaml
    - path: inconsistent-api/routes.ts
    - path: inconsistent-api/README.md
expected:
  output_contains:
    - "inconsistent-api/openapi.yaml"
    - "inconsistent-api/routes.ts"
    - "Contract correctness"
    - "Security"
    - "Coverage gaps"
  outcomes:
    - type: task_completed
```

- [ ] **Step 4: Run the expanded mock suite**

Run:

```bash
nix shell nixpkgs#python3 --command waza run evals/create-web-api/eval.yaml -v
```

Expected: Waza discovers 4 tasks and completes 3 trials per task; all 12 trials pass without schema, fixture, or grader errors.

- [ ] **Step 5: Commit the audit evaluation**

```bash
git add evals/create-web-api
git commit -m "test: add whole API audit scenario"
```

### Task 2: Add Audit Routing and the Audit Playbook

**Files:**
- Modify: `skills/create-web-api/SKILL.md`
- Create: `skills/create-web-api/AUDIT.md`
- Verify: `skills/create-web-api/references/web-api-guidelines.md`
- Verify: `skills/create-web-api/agents/openai.yaml`

**Interfaces:**
- Consumes: The audit failure shape from Task 1 and the design rubric at `references/web-api-guidelines.md`.
- Produces: Design-mode routing plus an evidence-first whole-API audit workflow.

- [ ] **Step 1: Route audit requests from SKILL.md**

Replace `skills/create-web-api/SKILL.md` with:

```markdown
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
```

- [ ] **Step 2: Write the whole-API audit playbook**

Create `skills/create-web-api/AUDIT.md` with:

```markdown
# Web API Audit Playbook

Audit the observable contract across definitions, implementation, tests, clients, and documentation. Evidence determines findings; the rubric supplies recommendations.

Inspired by millionco/react-doctor's [React Audit Playbook](https://github.com/millionco/react-doctor/blob/main/skills/improve-react/AUDIT.md), adapted for Web API contracts without copying React-specific rules.

## Build Coverage First

Read repository instructions, then inventory available artifacts:

- OpenAPI or equivalent definitions
- routes, handlers, middleware, validators, and serializers
- authorization and tenant-boundary code
- contract, integration, and end-to-end tests
- generated or hand-written clients
- API documentation and gateway configuration

Build an endpoint matrix: method, path, definition, handler, auth/authz, request schema, response schema, statuses, tests, and known clients. List missing artifacts as coverage gaps; do not infer their behavior.

## Verify and Prioritize

Confirm each finding at `path:line`, an OpenAPI JSON Pointer, or a method/path plus artifact location. Quote only the smallest fragment needed to anchor the evidence.

Rank priority by impact × exposure × confidence:

- **P0**: active security boundary failure, data loss, or broad outage risk
- **P1**: likely client breakage, authorization gap, unsafe retry, or high-traffic correctness failure
- **P2**: bounded inconsistency, operability gap, or recurring developer cost
- **P3**: low-impact improvement requiring product or runtime evidence

Respect deliberate suppressions, compatibility constraints, and documented tradeoffs. Rule severity alone never determines priority.

## 1. Contract Correctness

Hunt for definition/implementation/test drift; wrong method or status semantics; request/response schema mismatches; inconsistent null, omission, and default behavior; unstable errors; unbounded collections; unsafe idempotency; and ambiguous asynchronous states.

Beyond static comparison, trace a representative request from route through authorization, validation, handler, serialization, and documented response. Do not claim runtime behavior from a definition alone.

## 2. Consistency & Developer Experience

Hunt for inconsistent naming, envelopes, error codes, pagination, filtering, sorting, timestamps, identifiers, media types, and deprecation signals. Check whether documentation and examples match the callable API.

Prefer compatibility over cosmetic uniformity. Record a consistency issue only when it causes client branching, mistakes, or repeated maintenance cost.

## 3. Security & Authorization

Hunt at trust boundaries: missing authentication, resource or tenant authorization, mass assignment, sensitive values in URLs, unsafe CORS/cookies, unbounded payloads, secret leakage, and authorization-sensitive existence disclosures.

Trace attacker-controlled data to privileged effects. An authenticated route is not proven authorized until ownership or tenant scope is enforced.

## 4. Reliability & Operations

Hunt for unsafe retries, missing idempotency, lost-update races, incomplete async lifecycle rules, unbounded timeouts, missing rate-limit signaling, absent trace propagation, noisy or misleading health checks, and partial-failure ambiguity.

Use traffic, retry, or incident evidence when available. Label performance and capacity ideas as opportunities when runtime evidence is absent.

## 5. Compatibility & Maintainability

Hunt for undocumented breaking changes, version drift, duplicated policy, definition/code/client divergence, missing deprecation windows, and rules enforced in only one layer.

Prioritize central contracts and shared middleware over one-off style differences. Do not recommend a version bump when additive evolution is sufficient.

## Report Contract

Return sections in this order:

1. **Scope and coverage**: artifacts inspected, endpoint count, exclusions
2. **Executive summary**: three to five highest-leverage findings
3. **Prioritized findings**: priority, category, evidence, impact, recommendation
4. **Cross-cutting patterns**: repeated root causes, not duplicate symptoms
5. **Improvement opportunities**: unconfirmed ideas and required evidence
6. **Coverage gaps**: missing artifacts and claims that could not be verified

Use this finding shape:

```markdown
### [P1] Short finding title

- Category: Security & Authorization
- Evidence: `src/routes/users.ts:42`; `#/paths/~1users/post/security`
- Affected surface: `POST /v1/users`; unauthenticated clients
- Impact: Observable client, data, security, or operational consequence
- Recommendation: Exact target behavior grounded in `references/web-api-guidelines.md`
- Confidence: High | Medium | Low
- Verify: Evidence still needed, or `Confirmed`
```

Separate confirmed defects from opportunities. Do not modify files unless the user separately asks for fixes. When the bundled rubric does not cover a recommendation, label it as independent engineering judgment.
```

- [ ] **Step 3: Validate routing, links, and token budget**

Run:

```bash
nix shell --impure --expr '(builtins.getFlake "nixpkgs").legacyPackages.x86_64-linux.python3.withPackages (ps: [ ps.pyyaml ])' --command sh -c 'python3 /home/yuta/.config/codex/skills/.system/skill-creator/scripts/quick_validate.py skills/create-web-api && waza check skills/create-web-api'
```

Expected: quick validator prints `Skill is valid!`; Waza reports High readiness, valid links, the evaluation suite, and at most 500 `SKILL.md` tokens.

- [ ] **Step 4: Run fresh-agent GREEN audits**

Dispatch a fresh-context agent with the Task 1 audit prompt prefixed by:

```text
Use $create-web-api at /home/yuta/ghq/github.com/yutakobayashidev/skills/.worktrees/create-web-api/skills/create-web-api to complete this request.
```

Expected: the response inventories all three fixture artifacts, uses all five buckets or explicitly reports no finding in a bucket, cites exact source locations, distinguishes confirmed findings from opportunities, and lists coverage gaps without editing files.

Then run one design-mode forward test with the payment prompt from the base plan. Numeric limits, retention periods, scopes, and state transitions not supplied by the user must appear as assumptions or decisions to confirm rather than established domain facts.

- [ ] **Step 5: Commit design and audit skill files**

```bash
git add skills/create-web-api docs/superpowers/plans/2026-07-20-create-web-api-audit.md
git commit -m "feat: add Web API design and audit skill"
```

### Task 3: Integrate and Verify

**Files:**
- Modify: `README.md`
- Verify: `AGENTS.md`
- Verify: `CLAUDE.md` if present
- Verify: `docs/`

**Interfaces:**
- Consumes: The design and audit workflows plus four-task Waza suite.
- Produces: Repository discovery documentation and final verification evidence.

- [ ] **Step 1: Add the README entry**

Insert alphabetically after `check-similarity`:

```markdown
| [create-web-api](skills/create-web-api)                                 | Design and audit REST-like Web API contracts                      |
```

- [ ] **Step 2: Run focused verification**

Run:

```bash
nix shell --impure --expr '(builtins.getFlake "nixpkgs").legacyPackages.x86_64-linux.python3.withPackages (ps: [ ps.pyyaml ])' --command sh -c 'waza run evals/create-web-api/eval.yaml -v && python3 /home/yuta/.config/codex/skills/.system/skill-creator/scripts/quick_validate.py skills/create-web-api && waza check skills/create-web-api'
```

Expected: all 12 mock trials succeed, the package validator passes, and Waza reports ready with a valid audit link.

- [ ] **Step 3: Run repository-level verification**

Run:

```bash
nix shell nixpkgs#python3 --command waza run --output-dir /tmp/create-web-api-waza-results
git diff --check
```

Expected: every repository mock evaluation passes and `git diff --check` prints nothing.

- [ ] **Step 4: Perform documentation and scope review**

Verify `README.md` describes both design and audit. `AGENTS.md` and `CLAUDE.md` remain unchanged because agent workflow commands did not change. Confirm the diff contains no scripts, assets, dependencies, framework branches, or automatic fixes.

- [ ] **Step 5: Commit repository integration**

```bash
git add README.md
git commit -m "docs: list create-web-api skill"
```

- [ ] **Step 6: Verify committed state**

Run:

```bash
git status --short
git log -8 --oneline
```

Expected: the worktree is clean and the design, plan, eval, skill, audit, and README commits are visible.
