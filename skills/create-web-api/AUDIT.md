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
