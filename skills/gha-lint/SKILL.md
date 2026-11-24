---
name: gha-lint
description: Lint and secure GitHub Actions workflows with jactionlint, gh actions-lock, pinact, ghalint, and zizmor. Use when adding, updating, or reviewing workflows, maintaining actions.lock, or pinning refs the lockfile does not cover with pinact.
user-invocable: true
---

# GitHub Actions Lint & Security

Static analysis and security checking tools for GitHub Actions workflows. Use jactionlint for workflow correctness, gh actions-lock for action dependency locking, pinact for SHA pins on refs the lockfile does not cover, and ghalint / zizmor for security checks. Some checks overlap. jactionlint is available in nixos-unstable; the explicit flake reference below also works when the local `nixpkgs` registry points to an older revision without it.

| Tool           | Purpose                         | Nix package          |
| -------------- | ------------------------------- | -------------------- |
| **jactionlint** | Workflow syntax and type checking | `github:NixOS/nixpkgs/nixos-unstable#jactionlint` |
| **gh actions-lock** | Generate and verify action lockfiles | `gh extension install github/gh-actions-lock` |
| **pinact**     | SHA-pin refs the lockfile does not cover | `nixpkgs#pinact` |
| **ghalint**    | Security best practices         | `nixpkgs#ghalint`    |
| **zizmor**     | Security vulnerability analysis | `nixpkgs#zizmor`     |

---

For owner-wide cloning and PR orchestration, use the companion `gha-lint-repos`
skill. This skill handles one repository at a time.

## Action dependency locking (default)

When adding or editing workflows on GitHub.com or GitHub Enterprise Cloud with
data residency, onboard the affected workflows to `.github/workflows/actions.lock`
and keep it in the same changeset. Already-onboarded workflows must have their
lockfile refreshed after dependency edits. GitHub Enterprise Server is not
supported; retain inline SHA pinning there.

Workflow lockfiles became GA on October 28, 2026, including Team and Free plans.
See the [GA announcement](https://github.blog/changelog/2026-10-28-github-actions-workflow-lockfiles-are-generally-available/)
and [official setup guide](https://docs.github.com/en/actions/how-tos/secure-your-work/lock-workflow-dependencies).

### Runtime enforcement and verification

GitHub validates onboarded workflows at execution time: dependency coverage,
locked commit provenance, and source repository identity. `gh actions-lock --verify`
adds a pre-merge check, including `schedule` and `workflow_dispatch` workflows that
a pull request never runs. The [shared CI workflow](#ci-shared-workflow) runs it;
also run it locally before committing.

### Generate, review, verify

Use authenticated GitHub CLI from the repository root. If the extension is absent:

```bash
gh extension install github/gh-actions-lock
```

```bash
# Onboard or refresh the workflows in scope
gh actions-lock .github/workflows/ci.yml

# For repository-wide adoption, scan all workflows (also prunes deleted entries)
gh actions-lock

# Read-only local verification against GitHub before committing
gh actions-lock --verify
```

Choose the scoped or full-directory generation command to match the task. A
repository-wide verify also checks workflows not yet onboarded: complete adoption
before running the full check, or scope local verification during rollout.

- Do not hand-edit `actions.lock`. Generation can also rewrite workflow references
  to more specific version tags; review and commit both files together.
- Plain generation preserves existing pins. Use `--relock` only for an intentional
  dependency refresh, review changed commits and their release notes, then verify.
- `--verify-local` is an optional offline coverage check, not a replacement for
  `--verify` before committing. Check `gh actions-lock --help` for the installed version.
- Failures such as unreachable pins or replaced repository identities require
  investigation. Do not automatically use `--accept-moved` to silence them.
- Do not infer trust from a successful lock: review dependency and lockfile diffs.
  An older reachable commit for a floating ref may still pass verification.
- Dependabot's GitHub Actions updates maintain lock entries for onboarded workflows;
  new workflows still need initial onboarding. Preserve an existing updater setup.
- If an action allowlist is configured, check it against locked commit SHAs: a
  tag-only allowlist entry may no longer match. Do not silently broaden permissions
  or activate repository-wide enforcement as part of a workflow edit.

### Coverage and the role of pinact

For onboarded workflows, the runner uses the locked commits for remote actions,
including transitive action dependencies. Their YAML `uses:` keeps readable tags;
`gh actions-lock` rewrites SHA refs in onboarded workflows back to tags.

pinact is required for everything the lockfile does not pin. Each of these needs a
full commit SHA with a version comment:

- Remote reusable workflows at `jobs.<id>.uses`. Their internal actions use the
  called repository's lockfile, not the caller's.
- Action definitions that other repositories can call, such as a root
  `action.yml`. Their callers may not use a lockfile.
- Every ref in workflows not yet onboarded to `actions.lock`.

Local actions under `.github/actions/` called as `$/` are the opposite case: the
caller's lockfile pins their refs, and `gh actions-lock` rewrites them to tags.
Keep those tags. A SHA there no longer matches the lock entry, and the runner
rejects the workflow; `gh actions-lock` v0.4.1 `--verify` misses this, while
v0.5.1 reports `lockfile missing pin`. Verify with the version CI uses.

Two more boundaries sit outside both tools:

- Container images (including `docker://`, job containers, and services) need
  digest pins.
- `./` actions run from the checked-out workspace and are not traversed. For actions
  using other actions, review whether migrating to `$/` is appropriate, then use
  `gh actions-lock --migrate-local-actions`. `$/` runs the repository action at the
  workflow commit; it is not equivalent when checkout selects another ref or when
  previous steps generate/modify the action. Do not routinely bypass this with
  `--ignore-local-actions`.

pinact v5.0.2 does not read the lockfile: a blanket `pinact run --check` fails on
the locked tags. Scope it the way the shared CI workflow does:

```bash
# Reusable workflow calls in every workflow
pinact run --check --verify-comment --include '.*/\.github/workflows/.*'
# Action definitions that other repositories call
pinact run --check --verify-comment action.yml
# A workflow not yet onboarded
pinact run --check --verify-comment .github/workflows/legacy.yml
```

Run `pinact run` (without `--check`) on the same targets to pin them. The
[pinact lockfile guide](https://github.com/suzuki-shunsuke/pinact/blob/main/docs/workflow_lockfile.md)
describes a lock-aware pinact that skips locked actions and pins the rest; it is on
`main` but not in a release as of November 25, 2026. Once released, a blanket
`pinact run --check` replaces the scoped commands.

Keep other lint/security checks. ghalint v1.6.0 adds lockfile support; zizmor v1.32.0
adds experimental support. Check the installed versions, including Nix packages,
before relying on that support. jactionlint 2.3.0 has lock-aware pin checks in its
`default` profile, but the `correctness` profile below does not run those checks;
run `gh actions-lock --verify` locally after generating the lockfile.

If a linter flags a tag already covered by the
lockfile, check its installed version and lockfile support before changing policy.
Scope any necessary pin-rule exception to verified coverage; do not disable other
security checks or repin every locked tag merely to satisfy an old linter.

Reference: [lockfiles versus SHA pinning](https://docs.github.com/en/actions/concepts/security/workflow-dependency-lockfiles),
[CLI modes and limits](https://github.com/github/gh-actions-lock#readme).

---

## jactionlint

[jactionlint](https://github.com/jdx/jactionlint) is a fork of actionlint. Use its
`correctness` profile for the syntax/type-checking role in this toolchain. The
`default` profile adds security and policy checks; `pedantic` adds stricter checks.
When a repository already selects a profile, respect it rather than overriding it.

### Basic Commands

```bash
# Auto-detect workflows, composite actions and Dependabot configuration
nix run github:NixOS/nixpkgs/nixos-unstable#jactionlint -- --profile correctness

# Check a specific file
nix run github:NixOS/nixpkgs/nixos-unstable#jactionlint -- --profile correctness .github/workflows/nix-build.yaml

# JSON output
nix run github:NixOS/nixpkgs/nixos-unstable#jactionlint -- --profile correctness --format json
```

The Nix package does not bundle shellcheck / pyflakes. Include them when checking
inline scripts:

```bash
nix shell github:NixOS/nixpkgs/nixos-unstable#jactionlint nixpkgs#shellcheck nixpkgs#python3Packages.pyflakes -c jactionlint --profile correctness
```

For reproducible CI or a devShell, pin nixpkgs in the project's flake lock rather
than resolving the moving branch on each run. No NUR package is needed.

### What It Detects

- Workflow syntax errors (missing required keys, duplicate keys, invalid values)
- Type checking of `${{ }}` expressions (undefined context references, etc.)
- Shell script issues via shellcheck and Python issues via pyflakes
- Matrix inconsistencies, invalid glob patterns and runner labels
- Deprecated commands and invalid local/composite actions

### Configuration and Migration

Use `.github/jactionlint.yaml` for new configuration:

```yaml
profile: correctness
self-hosted-runner:
  labels:
    - blacksmith-4vcpu-ubuntu-2404
```

Existing `.github/actionlint.yaml` files are accepted. Preserve custom labels and
other settings when renaming one; without a profile, jactionlint applies its
broader `default` checks. The `correctness` profile also adds bug checks, so it is
not an exact copy of actionlint.

Use v2 long options (`--format json`, `--config-file`, `--ignore`) instead of
legacy single-dash options. Review output parsers and ignore patterns when
migrating: rule IDs and messages can differ. Findings at warning/info severity do
not fail the command unless `--strict-exit` is set.

See the [upstream migration guide](https://github.com/jdx/jactionlint/blob/v2.3.0/docs/actionlint.md).

---

## pinact

Pin the targets listed in [Coverage and the role of pinact](#coverage-and-the-role-of-pinact).
It updates workflow references, not the action lockfile. After changing a reference in an
onboarded workflow, regenerate and verify the lockfile too.

### Configuration

Place `.pinact.yml` at the repository root:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/suzuki-shunsuke/pinact/refs/heads/main/json-schema/pinact.json
version: 3
```

Initialize: `nix run nixpkgs#pinact -- init`

### Basic Commands

```bash
# Pin a workflow that still requires inline SHA references
nix run nixpkgs#pinact -- run .github/workflows/legacy.yml

# Composite actions in a repository without actions.lock
nix run nixpkgs#pinact -- run \
  .github/actions/setup-nix/action.yaml \
  .github/actions/setup-git-bot/action.yaml

# Validate only the files that require inline pins
nix run nixpkgs#pinact -- run --check .github/workflows/legacy.yml

# Verify pinned SHAs match their version comments; catches wrong SHAs
nix run nixpkgs#pinact -- run --check --verify-comment .github/workflows/legacy.yml

# Show diff only
nix run nixpkgs#pinact -- run --diff .github/workflows/legacy.yml

# Update to latest versions
nix run nixpkgs#pinact -- run --update .github/workflows/legacy.yml
```

### Release Notes for Updates

After `pinact --update`, use the bundled helper to fetch GitHub Releases between the old and new action versions:

```bash
python3 skills/gha-lint/scripts/github_release_notes.py actions/checkout --from v4.2.2 --to v4.3.1
```

- The range is `--from` exclusive and `--to` inclusive by default, matching upgrade review needs
- Pass `--include-from` when you also need the baseline release notes
- The script reads `GITHUB_TOKEN`, `GH_TOKEN`, or `gh auth token` automatically to avoid low unauthenticated API limits
- It accepts either `owner/repo` or `https://github.com/owner/repo`

### Conversion Format

```yaml
# Before
- uses: actions/checkout@v4

# After
- uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v4.3.1
```

- Tags are replaced with SHAs; the original version is appended as a comment
- Files outside `.github/workflows/` (composite actions, etc.) must be specified explicitly

### Key Options

| Option                               | Description                                                           |
| ------------------------------------ | --------------------------------------------------------------------- |
| `--check`                            | Non-zero exit if unpinned references exist. No file changes           |
| `--verify-comment`, `--verify`, `-v` | Verify the version comment matches the pinned SHA; catches wrong SHAs |
| `--update, -u`                       | Update to latest versions                                             |
| `--diff`                             | Output diff only. No file changes                                     |
| `--include, -i`                      | Filter targets by regex                                               |
| `--exclude, -e`                      | Exclude targets by regex                                              |
| `--min-age, -m`                      | Skip releases newer than N days (use with `-u`)                       |

---

## ghalint

Linter for security best practices in workflow and action definitions.

### Basic Commands

```bash
# Check workflows
nix run nixpkgs#ghalint -- run

# Check action definitions
nix run nixpkgs#ghalint -- run-action
```

### What It Detects

- Jobs missing explicit `permissions`
- Action references not pinned to commit SHAs
- `actions/checkout` without `persist-credentials: false`
- Other security best practice violations

---

## zizmor

Security vulnerability analyzer for GitHub Actions. Offers 3 personas to tune detection sensitivity.

### Basic Commands

```bash
# Analyze current repository (auto-detects .github/)
nix run nixpkgs#zizmor -- .

# Check a specific file
nix run nixpkgs#zizmor -- .github/workflows/nix-build.yaml

# Pedantic mode (also detects code smells)
nix run nixpkgs#zizmor -- --pedantic .

# Offline mode (no GitHub API needed)
nix run nixpkgs#zizmor -- --offline .

# SARIF output
nix run nixpkgs#zizmor -- --format sarif .
```

### Personas (Detection Sensitivity)

| Persona             | Description                                        |
| ------------------- | -------------------------------------------------- |
| `regular` (default) | Minimizes false positives                          |
| `pedantic`          | Also detects code smells                           |
| `auditor`           | Comprehensive detection, tolerates false positives |

### What It Detects

- Excessive `permissions` settings
- Code injection via template expansion (`${{ }}`)
- Direct use of untrusted inputs
- Potential commit spoofing
- Dangerous use of `pull_request_target`
- Improper use of self-hosted runners

---

## CI: shared workflow

CI runs through [zunoser/reusable-workflows](https://github.com/zunoser/reusable-workflows):
`gh actions-lock --verify`, scoped pinact, jactionlint (`correctness`), ghalint and
zizmor in one job. Tool versions and checksums live there; update that repository and release it
instead of copying lint steps into callers.

Add or keep this caller as `.github/workflows/ci.yml`. Take the SHA of the latest
[release](https://github.com/zunoser/reusable-workflows/releases), then run
`gh actions-lock` so the lockfile registers the caller:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions: {}

jobs:
  gha-lint:
    permissions:
      contents: read
    uses: zunoser/reusable-workflows/.github/workflows/gha-lint.yml@RELEASE_COMMIT_SHA # vX.Y.Z
```

- A repository whose workflows are not yet onboarded to `actions.lock` passes
  `with: { verify-actions-lock: false }` until onboarding is complete; pinact then
  requires a SHA pin on every ref.
- Replace an existing inline lint job (jactionlint / ghalint / zizmor steps) with
  this call. Keep the repository's other CI jobs and triggers.
- Dependabot's `github-actions` ecosystem opens PRs for new releases of the shared
  workflow. Preserve an existing updater setup.
- The check reports as `gha-lint / lint`. Use that name if it becomes a required check.

---

## Workflow: When Adding or Modifying GitHub Actions

1. Edit workflows or composite actions. Pin container images by digest.
2. Generate/update the action lockfile for the affected workflows, review the full
   diff, and verify it. Then run pinact on the refs the lockfile does not cover.
3. Run the correctness and security checks:

```bash
nix run github:NixOS/nixpkgs/nixos-unstable#jactionlint -- --profile correctness
gh actions-lock --verify
nix run nixpkgs#pinact -- run --check --verify-comment --include '.*/\.github/workflows/.*'
nix run nixpkgs#ghalint -- run
nix run nixpkgs#zizmor -- .
```

4. Review workflow and lockfile changes together, then commit:

```bash
git diff
```

5. Open a PR and inspect the CI results. Add the [shared CI workflow](#ci-shared-workflow)
   if the repository does not call it yet.

## Notes

- Setting `GITHUB_TOKEN` / `GH_TOKEN` avoids API rate limits (pinact, zizmor)
- jactionlint auto-integrates with shellcheck and pyflakes on PATH. The Nix package does not bundle these companions; use the `nix shell` command above for inline script checks.
- ghalint covers permissions, credentials and other checks beyond dependency pinning.
- Lock verification does not replace syntax checking or security analysis.
