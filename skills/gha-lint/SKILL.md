---
name: gha-lint
description: Lint and secure GitHub Actions workflows with jactionlint, gh actions-lock, ghalint, and zizmor. Use when adding, updating, or reviewing workflows, maintaining actions.lock, or choosing lockfiles versus SHA pinning with pinact.
user-invocable: true
---

# GitHub Actions Lint & Security

Static analysis and security checking tools for GitHub Actions workflows. Use jactionlint for workflow correctness, gh actions-lock for action dependency locking, and ghalint / zizmor for security checks. pinact is optional for references that still need inline SHA pins. Some checks overlap. jactionlint is available in nixos-unstable; the explicit flake reference below also works when the local `nixpkgs` registry points to an older revision without it.

| Tool           | Purpose                         | Nix package          |
| -------------- | ------------------------------- | -------------------- |
| **jactionlint** | Workflow syntax and type checking | `github:NixOS/nixpkgs/nixos-unstable#jactionlint` |
| **gh actions-lock** | Generate and verify action lockfiles | `gh extension install github/gh-actions-lock` |
| **pinact** (optional) | Maintain inline SHA pins where needed | `nixpkgs#pinact` |
| **ghalint**    | Security best practices         | `nixpkgs#ghalint`    |
| **zizmor**     | Security vulnerability analysis | `nixpkgs#zizmor`     |

---

## Action dependency locking (default)

When adding or editing workflows on GitHub.com or GitHub Enterprise Cloud with
data residency, onboard the affected workflows to `.github/workflows/actions.lock`
and keep it in the same changeset. Already-onboarded workflows must have their
lockfile refreshed after dependency edits. GitHub Enterprise Server is not
supported; retain inline SHA pinning there.

Workflow lockfiles became GA on October 28, 2026, including Team and Free plans.
See the [GA announcement](https://github.blog/changelog/2026-10-28-github-actions-workflow-lockfiles-are-generally-available/)
and [official setup guide](https://docs.github.com/en/actions/how-tos/secure-your-work/lock-workflow-dependencies).

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

# Read-only verification against GitHub; use this in CI
gh actions-lock --verify
```

Choose the scoped or full-directory generation command to match the task. A
repository-wide verify also checks workflows not yet onboarded: complete adoption
before making that full check required, or scope verification during rollout.

- Do not hand-edit `actions.lock`. Generation can also rewrite workflow references
  to more specific version tags; review and commit both files together.
- Plain generation preserves existing pins. Use `--relock` only for an intentional
  dependency refresh, review changed commits and their release notes, then verify.
- `--verify-local` is an optional offline coverage check, not a replacement for
  `--verify` in CI. Check `gh actions-lock --help` for the installed version.
- Failures such as unreachable pins or replaced repository identities require
  investigation. Do not automatically use `--accept-moved` to silence them.
- Do not infer trust from a successful lock: review dependency and lockfile diffs.
  An older reachable commit for a floating ref may still pass verification.
- Dependabot's GitHub Actions updates maintain lock entries for onboarded workflows;
  new workflows still need initial onboarding. Preserve an existing updater setup.
- If an action allowlist is configured, check it against locked commit SHAs: a
  tag-only allowlist entry may no longer match. Do not silently broaden permissions
  or activate repository-wide enforcement as part of a workflow edit.

### Coverage and the remaining role of pinact

For onboarded workflows, the runner uses the locked commits for remote actions,
including transitive action dependencies. Their YAML `uses:` may retain readable
tags; inline SHA pinning and a blanket `pinact --check` are no longer required.
Do not replace existing SHA pins with tags just for appearance.

Coverage has boundaries:

- Remote reusable workflows at `jobs.<id>.uses` still need full commit SHAs. Their
  internal actions use the called repository's lockfile, not the caller's.
- Container images (including `docker://`, job containers, and services) still need
  digest pins. The action lockfile does not lock them.
- `./` actions run from the checked-out workspace and are not traversed. For actions
  using other actions, review whether migrating to `$/` is appropriate, then use
  `gh actions-lock --migrate-local-actions`. `$/` runs the repository action at the
  workflow commit; it is not equivalent when checkout selects another ref or when
  previous steps generate/modify the action. Do not routinely bypass this with
  `--ignore-local-actions`.
- Workflows not yet onboarded still need inline SHA pinning. Keep pinact for these,
  reusable workflow references, or an explicit repository policy requiring inline
  pins. It does not generate or verify `actions.lock`. Public composite action
  definitions may also need inline pins because their callers may not use locks.

The [pinact lockfile guide](https://github.com/suzuki-shunsuke/pinact/blob/main/docs/workflow_lockfile.md)
describes lock-aware versions: they leave actions locked for that workflow alone,
pin reusable workflows and action definitions, and fail if an onboarded workflow
has an action missing from its lock. Do not assume this behavior in older binaries:
as checked on November 1, 2026, the guide is on `main`, while release v5.0.2 lacks
it. Check the installed version's documentation before using blanket pinact checks
in a mixed workflow. With an older version, target non-onboarded files; manually
pin reusable-workflow calls in mixed files without rewriting locked action tags.

Keep other lint/security checks. ghalint v1.6.0 adds lockfile support; zizmor v1.32.0
adds experimental support. Check the installed versions, including Nix packages,
before relying on that support. jactionlint 2.3.0 has lock-aware pin checks in its
`default` profile, but the `correctness` profile below does not run those checks;
keep the dedicated `gh actions-lock --verify` check either way.

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

### CI Usage

Use the official action, pinned to a release commit:

```yaml
- uses: jdx/jactionlint@a65ab044e916760429068fe5794b8306abdfcbb9 # v2.3.0
  with:
    profile: correctness
```

The action defaults to the binary version it was released with. If the repository
configures its own profile, omit the `profile` input. Inline script checks require
shellcheck / pyflakes on the runner's PATH; the action does not install them.

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

## pinact (optional inline pinning)

Use only where the coverage rules above call for inline SHA pins. It updates
workflow references, not the action lockfile. After changing a reference in an
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

# Include composite actions etc.
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

### CI Usage

Only for repositories that require inline SHA pins throughout, use
`suzuki-shunsuke/pinact-action`. Do not add a blanket pinact job to a lockfile-based
repository:

```yaml
- uses: suzuki-shunsuke/pinact-action@1081f5ad49ac904b7d977784f338145150a32112 # v1.4.0
  with:
    skip_push: "true"
```

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

### CI Usage

Install via aqua:

```yaml
- uses: aquaproj/aqua-installer@11dd79b4e498d471a9385aa9fb7f62bb5f52a73c # v4.0.4
  with:
    aqua_version: v2.56.6
- run: ghalint run
  env:
    GHALINT_LOG_COLOR: always
```

Requires `aqua.yaml` in the repository with ghalint registered:

```yaml
# aqua.yaml
registries:
  - type: standard
    ref: v4.579.0
packages:
  - name: suzuki-shunsuke/ghalint@v1.6.0
```

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

### CI Usage

Use `zizmorcore/zizmor-action`:

```yaml
- uses: zizmorcore/zizmor-action@0dce2577a4760a2749d8cfb7a84b7d5585ebcb7d # v0.5.0
```

With GitHub Advanced Security:

```yaml
- uses: zizmorcore/zizmor-action@0dce2577a4760a2749d8cfb7a84b7d5585ebcb7d # v0.5.0
```

Without Advanced Security:

```yaml
- uses: zizmorcore/zizmor-action@0dce2577a4760a2749d8cfb7a84b7d5585ebcb7d # v0.5.0
  with:
    advanced-security: false
```

---

## CI Integration: Lock verification and linting

For a repository with all workflows onboarded, verify locks alongside the linters.
The example keeps existing SHA pins; tags are also valid for locked actions. After
adding this workflow, generate the lockfile again so this workflow is covered too.
Pin the extension version deliberately and update it with reviewed upgrades.
For private dependencies in other repositories, verification needs a token that
can read them; the default repository token may be insufficient.

```yaml
name: "CI: GitHub Actions lint"

on:
  pull_request:
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions: {}

jobs:
  gha-lint:
    runs-on: ubuntu-24.04-arm
    timeout-minutes: 10
    permissions:
      contents: read
      actions: read
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
        with:
          persist-credentials: false

      - uses: jdx/jactionlint@a65ab044e916760429068fe5794b8306abdfcbb9 # v2.3.0
        with:
          profile: correctness

      - name: Verify action lockfile
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh extension install github/gh-actions-lock --pin v0.2.0
          gh actions-lock --verify

      - uses: aquaproj/aqua-installer@11dd79b4e498d471a9385aa9fb7f62bb5f52a73c # v4.0.4
        with:
          aqua_version: v2.56.6
      - name: ghalint
        run: ghalint run
        env:
          GHALINT_LOG_COLOR: always

      - uses: zizmorcore/zizmor-action@0dce2577a4760a2749d8cfb7a84b7d5585ebcb7d # v0.5.0
        with:
          advanced-security: false
```

---

## Workflow: When Adding or Modifying GitHub Actions

1. Edit workflows or composite actions. Pin reusable workflows and images separately.
2. Generate/update the action lockfile for the affected workflows, review the full
   diff, and verify it. Use pinact only for references still requiring inline pins.
3. Run the correctness and security checks:

```bash
nix run github:NixOS/nixpkgs/nixos-unstable#jactionlint -- --profile correctness
gh actions-lock --verify
nix run nixpkgs#ghalint -- run
nix run nixpkgs#zizmor -- .
```

4. Review workflow and lockfile changes together, then commit:

```bash
git diff
```

5. Open a PR and verify CI passes. Use read-only lock verification on PRs; do not
   regenerate or auto-accept moved pins inside the required verification check.

## Notes

- Setting `GITHUB_TOKEN` / `GH_TOKEN` avoids API rate limits (pinact, zizmor)
- jactionlint auto-integrates with shellcheck and pyflakes on PATH. The Nix package does not bundle these companions; use the `nix shell` command above for inline script checks.
- ghalint covers permissions, credentials and other checks beyond dependency pinning.
- Lock verification does not replace syntax checking or security analysis.
