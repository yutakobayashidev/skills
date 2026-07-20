# Create Web API Skill Design

## Summary

Add a `create-web-api` skill that helps an agent design a REST-like Web API contract. The skill will follow the compact, deliverable-oriented shape of `create-cli`: clarify only decisions that materially affect the interface, apply documented defaults, and return an implementation-ready specification without drifting into application code.

The design guidance will be based on Future Architect's [Web API Guidelines](https://future-architect.github.io/arch-guidelines/documents/forWebAPI/web_api_guidelines.html), summarized and adapted rather than copied wholesale.

## Goals

- Design HTTP API surface area and behavior for human reviewers and client developers.
- Produce consistent endpoint, schema, error, safety, security, and operations decisions.
- Remain language- and framework-agnostic unless the user requests implementation advice.
- Ask only the questions needed to avoid materially different API contracts.
- Distinguish REST-like API design from requests better served by GraphQL, gRPC, or RPC.
- Verify the skill with deterministic Waza evaluations before relying on subjective graders.

## Non-goals

- Generate server or client implementation code by default.
- Generate a complete OpenAPI document unless explicitly requested.
- Prescribe AWS-specific infrastructure for every API.
- Reproduce the source guideline article in full.
- Cover GraphQL, gRPC, SOAP, or JSON-RPC contract design beyond protocol selection guidance.

## Skill Behavior

The skill will trigger when a user asks to design, review, or define a REST/HTTP/Web API contract, including endpoints, resources, request and response schemas, status codes, error formats, pagination, idempotency, or versioning.

It will first read the bundled guideline reference, then establish only the missing decisions that can change the public contract:

- API purpose and intended consumers
- principal resources and operations
- trust boundary and authentication model
- synchronous versus asynchronous behavior
- compatibility and versioning constraints
- expected scale or limits when they affect pagination, rate limits, uploads, or timeouts

If the user is unsure, the skill will proceed with explicit defaults rather than conducting a long interview.

## Output Contract

The default response will be a compact specification in this order:

1. Scope and assumptions
2. Resource model and relationships
3. Endpoint table with method, path, purpose, auth, idempotency, and success status
4. Request definitions for path, query, header, and body fields
5. Response schemas and representative examples
6. Error envelope, status-code mapping, and validation behavior
7. Cross-cutting rules such as pagination, filtering, sorting, concurrency, retries, and asynchronous jobs
8. Security and operational rules such as authorization, rate limits, request limits, trace IDs, and health checks
9. Compatibility and versioning policy
10. Example requests for common and failure flows

Irrelevant sections may be omitted. The skill will identify unresolved decisions explicitly and will not invent domain semantics that require product input.

## Default Design Rules

The reference will provide concise decision rubrics rather than unconditional rules. Defaults include:

- Use REST unless streaming, high-throughput service communication, or highly variable client-driven queries justify another protocol.
- Model nouns as resources and use HTTP methods according to their semantics.
- Use plural, kebab-case resource paths and keep nesting shallow.
- Use standard status codes and one stable, machine-readable error envelope.
- Use cursor pagination for large or changing collections; use simpler pagination only when its trade-offs are acceptable.
- Define idempotency for retryable writes and use an idempotency key when duplicate creation would be harmful.
- Treat authentication and resource-level authorization as separate decisions.
- Prefer backward-compatible changes; introduce a new major API version only for unavoidable breaking changes.
- Define request size, timeout, rate-limit, trace, and health-check behavior when operationally relevant.
- State deviations from defaults with their reason.

## Files

```text
skills/create-web-api/
├── SKILL.md
├── agents/
│   └── openai.yaml
└── references/
    └── web-api-guidelines.md

evals/create-web-api/
├── eval.yaml
└── tasks/
    ├── basic-usage.yaml
    ├── edge-case.yaml
    └── should-not-trigger.yaml
```

`README.md` will gain one entry in the Skills table. No changes are needed in `.waza.yaml`, CI configuration, `flake.nix`, `AGENTS.md`, or `CLAUDE.md`.

## Reference Organization

`references/web-api-guidelines.md` will be a curated, original summary organized for retrieval:

- protocol selection
- naming, hosting, resources, and nesting
- HTTP methods and status codes
- request and response conventions
- errors and validation
- pagination, filtering, sorting, bulk operations, and partial responses
- idempotency, concurrency, retries, and asynchronous processing
- authentication, authorization, CORS, cookies, and transport security
- versioning and compatibility
- rate limits, payload limits, health checks, tracing, and observability

It will cite the source article and preserve its scope caveat: the recommendations are a baseline for REST-like business APIs, not universal requirements.

## Evaluation Strategy

Use Waza with `trials_per_task: 3` and deterministic text or regex graders first.

- `basic-usage`: a small resource-oriented API request must produce an endpoint table, schemas, errors, and examples without implementation code.
- `edge-case`: a payment-like or job-processing API must address idempotency, authorization, retries, concurrency, and asynchronous status handling.
- `should-not-trigger`: an implementation-only or GraphQL-specific request must not be reframed as a REST contract design task.

The RED baseline will run equivalent tasks without the new skill and record omissions or output-shape failures. GREEN will run the same scenarios with the skill. The skill text will be revised only to address observed gaps, keeping it concise.

## Validation

- Run the skill package validator against `skills/create-web-api`.
- Run the new Waza evaluation with the mock engine.
- Run repository-level checks relevant to skill discovery and evaluation structure.
- Inspect generated metadata and confirm its default prompt names `$create-web-api`.
- Review `README.md`, `AGENTS.md`, `CLAUDE.md`, and `docs/` for documentation impact before committing the implementation.

## Design Constraints

- Keep `SKILL.md` focused on workflow and output shape; do not duplicate the detailed reference.
- Add no scripts or assets because the workflow requires judgment, not repeated deterministic transformation.
- Avoid backward-compatibility shims, framework-specific branches, and speculative deliverables.
- Prefer concrete positive output requirements over a long list of prohibitions.
