# ADR Directory README Template

Use this only if the repository benefits from a small ADR index and a few contribution rules.

```md
# Architecture Decision Records

This directory stores durable technical decisions for this repository.

## Scope

- Put cross-cutting decisions here.
- Keep package-local ADRs inside the owning workspace only when the decision is genuinely local.

## Naming

- Use one file per ADR.
- Name files as `NNNN-short-decision-name.md`.
- Keep status inside the document, not the filename.

## Process

- Create or update the ADR in the same pull request as the code or config change it governs whenever practical.
- Use `Proposed` while the decision is under review.
- Mark an ADR `Accepted` once the team agrees to enforce it.
- When reversing a decision, write a new ADR and mark the old one `Superseded` instead of rewriting history.

## Index

- `0001-adopt-drizzle-for-new-db-access.md`
- `0002-standardize-public-apis-on-openapi.md`
```

## Notes

- Keep this README short. It is an index and rules-of-the-road document, not a second ADR manual.
- Do not add maintenance-heavy process unless the team already follows it.
