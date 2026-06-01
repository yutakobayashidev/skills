# ADR Location and Naming

ADR output is most useful when it lives in the repository beside the codebase it governs.

## Recommended default for a monorepo

Put ADRs in one shared directory at the repo root:

```text
docs/
  adr/
    0001-adopt-drizzle-for-new-db-access.md
    0002-standardize-public-apis-on-openapi.md
    README.md
```

This should be the default unless the repo already has a stronger documentation convention.

## Why this layout

- A single root `docs/adr/` tree makes architectural decisions discoverable across apps and packages.
- It avoids duplicating process and format rules in each workspace.
- Cross-cutting decisions usually affect more than one package, so a shared location is the least surprising default.
- It keeps ADRs close enough to the codebase to evolve in the same pull requests.

## Directory rules

- Prefer `docs/adr/` over scattering ADRs under individual packages.
- Keep one ADR per file.
- Add a small `docs/adr/README.md` only if the repo benefits from a short index or contribution rules.
- If the repository already uses `adr/` at the root or `docs/architecture/decisions/`, keep the existing convention instead of forcing a rename.

## Filename rules

- Use a stable numeric prefix plus a slug:
  - `0001-short-decision-name.md`
  - `0002-move-env-validation-to-startup.md`
- Use four digits unless the repo already uses another width.
- Write the slug from the decision, not the symptom.
- Do not encode status in the filename. Status belongs inside the ADR.

## When package-local ADRs are acceptable

Use a package-local ADR directory only when the decision is truly local and unlikely to matter outside that workspace.

Example:

```text
packages/
  billing/
    docs/
      adr/
        0001-use-ledger-snapshots-for-monthly-close.md
```

If you choose a local ADR, link it from the root ADR index when other teams may need to discover it.

## Suggested repo policy

- Cross-cutting decisions live in `docs/adr/`.
- Package-only decisions may live in `<workspace>/docs/adr/` if their scope is genuinely local.
- Any ADR that changes shared platform behavior, public contracts, or standard dependencies belongs in the root ADR directory.
- New ADRs should be created in the same pull request as the code or config changes they govern whenever practical.

## Recommended companion files

- `docs/adr/README.md`: optional index, numbering rules, and contribution notes.
- `docs/adr/template.md`: optional local copy only if the repo wants a project-specific ADR template.

If a repo wants a lightweight index file, start from `references/readme-template.md` and trim it to the team's actual process.

Do not create extra scaffolding unless the team will actually maintain it.
