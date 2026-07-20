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
