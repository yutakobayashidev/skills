---
name: gha-lint
description: Lint and secure GitHub Actions workflows using pinact, jactionlint, ghalint, and zizmor. Use when the user adds, updates, or reviews GitHub Actions workflows and wants to check correctness, security, or pin action versions.
user-invocable: true
---

# GitHub Actions Lint & Security

Static analysis and security checking tools for GitHub Actions workflows. Use jactionlint for workflow correctness, pinact for SHA pinning, and ghalint / zizmor for security checks. Some checks overlap. jactionlint is available in nixos-unstable; the explicit flake reference below also works when the local `nixpkgs` registry points to an older revision without it.

| Tool           | Purpose                         | Nix package          |
| -------------- | ------------------------------- | -------------------- |
| **jactionlint** | Workflow syntax and type checking | `github:NixOS/nixpkgs/nixos-unstable#jactionlint` |
| **pinact**     | SHA-pin action references       | `nixpkgs#pinact`     |
| **ghalint**    | Security best practices         | `nixpkgs#ghalint`    |
| **zizmor**     | Security vulnerability analysis | `nixpkgs#zizmor`     |

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

## pinact

Converts GitHub Actions version references to commit SHAs. Prevents supply chain attacks via tag rewriting.

### Configuration

Place `.pinact.yml` at the repository root:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/suzuki-shunsuke/pinact/refs/heads/main/json-schema/pinact.json
version: 3
```

Initialize: `nix run nixpkgs#pinact -- init`

### Basic Commands

```bash
# Pin all actions under .github/workflows/
nix run nixpkgs#pinact -- run

# Include composite actions etc.
nix run nixpkgs#pinact -- run \
  .github/actions/setup-nix/action.yaml \
  .github/actions/setup-git-bot/action.yaml

# Validate only (no file changes, good for CI)
nix run nixpkgs#pinact -- run --check

# Verify pinned SHAs match their version comments; catches wrong SHAs
nix run nixpkgs#pinact -- run --check --verify-comment

# Show diff only
nix run nixpkgs#pinact -- run --diff

# Update to latest versions
nix run nixpkgs#pinact -- run --update
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

Use `suzuki-shunsuke/pinact-action`:

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
    ref: v4.294.0
packages:
  - name: suzuki-shunsuke/ghalint@v1.5.5
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

## CI Integration: All Tools Combined

Example workflow combining all 4 tools using their official actions (no nixpkgs):

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

      - uses: suzuki-shunsuke/pinact-action@1081f5ad49ac904b7d977784f338145150a32112 # v1.4.0
        with:
          skip_push: "true"

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

1. Edit workflows or composite actions
2. Run all tools locally:

```bash
nix run github:NixOS/nixpkgs/nixos-unstable#jactionlint -- --profile correctness
nix run nixpkgs#pinact -- run
nix run nixpkgs#ghalint -- run
nix run nixpkgs#zizmor -- .
```

3. Review changes and commit:

```bash
git diff
```

4. Open a PR and verify CI passes

## Notes

- Setting `GITHUB_TOKEN` / `GH_TOKEN` avoids API rate limits (pinact, zizmor)
- jactionlint auto-integrates with shellcheck and pyflakes on PATH. The Nix package does not bundle these companions; use the `nix shell` command above for inline script checks.
- ghalint's checks partially overlap with pinact (SHA pinning), but ghalint also covers other best practices, so using both is worthwhile
