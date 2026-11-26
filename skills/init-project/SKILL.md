---
name: init-project
description: Create a new GitHub repository through a tofu-configuration pull request that CI plans and applies, clone it with ghq, initialize it from the-nix-way/dev-templates, configure dependency installation for new worktrees, add the required ci-gate check, and land the first commit through a pull request.
---

Create a new repository with full scaffolding. Follow these steps exactly:

## 1. Ask Project Details

Gather all info in one prompt:

```text
New repository setup:

1. Project name? (e.g. my-app)
2. Toolchain? Choose a template from the-nix-way/dev-templates (e.g. node, bun, python, go, rust, or hashi).
3. License? (mit, apache-2.0, gpl-3.0, unlicense, etc. Default: mit)
4. Visibility? (public / private. Default: public)
5. Description? (one-liner, optional)
```

## 2. Open the Repository Pull Request

Each repository has its own OpenTofu root in `yutakobayashidev/tofu-configuration`,
and CI creates the repository when that root is merged. First confirm the name
is free; stop and ask for another name if this prints a repository:

```bash
gh repo view yutakobayashidev/<project_name> --json url 2>/dev/null
```

Dispatch the workflow that writes the root and opens the pull request.
`gh workflow run` returns no run ID, and another dispatch may run at the same
time. Record the time just before dispatching, then take the earliest run
created after it:

```bash
since=$(date -u +%Y-%m-%dT%H:%M:%SZ)
gh workflow run github-new-repository.yml --repo yutakobayashidev/tofu-configuration \
  -f name=<project_name> -f description="<description>" -f visibility=<visibility>
gh run list --repo yutakobayashidev/tofu-configuration --workflow github-new-repository.yml \
  --event workflow_dispatch --limit 10 --json databaseId,createdAt \
  --jq "[.[] | select(.createdAt >= \"$since\")] | last | .databaseId"
gh run watch <run_id> --repo yutakobayashidev/tofu-configuration --exit-status
```

The run may take a few seconds to appear; repeat `gh run list` until it prints
an ID.

The root calls the shared repo kit module. Its defaults are the recommended
settings (squash merge only, branch deletion on merge, Dependabot alerts). For a
public repository, its ruleset makes `main` accept only pull requests that pass
`ci-gate`, with no required approval. GitHub Free has no rulesets for private
repositories, so a private root sets `default_branch_ruleset = null` and
`ci-gate` stays advisory. The pull request's branch is `new-repository/<project_name>`;
once the run succeeds, find it with:

```bash
gh pr list --repo yutakobayashidev/tofu-configuration --head new-repository/<project_name> --json url
```

When the user asks for a setting that differs from the defaults, check out that
branch from tofu-configuration (locate it with `ghq list -p`, or `ghq get` it),
add the setting to a `general` block in
`infra/services/github/repositories/<project_name>/module_gh_repo_kit.tf`, e.g.
`general = { has_wiki = true }`, and push. The module README lists the fields.
Requested settings the module does not expose, such as GitHub Pages, become
manual follow-ups in the summary.

## 3. Review the Plan and Merge

The workflow dispatches github-plan for the branch, and every later push to it
runs github-plan again. Wait for the latest run:

```bash
gh run list --repo yutakobayashidev/tofu-configuration --workflow github-plan.yml \
  --branch new-repository/<project_name> --limit 1 --json databaseId,status,conclusion
gh run watch <run_id> --repo yutakobayashidev/tofu-configuration --exit-status
```

The plan, in the run summary, creates the repository, its default branch, its
vulnerability alerts, and its Actions permissions (SHA pinning required). A
public repository adds its ruleset, for five resources; a private one has no
ruleset, for four. Any other count is wrong: report it instead of merging. Show the plan to the user and merge after they
approve:

```bash
gh pr merge <pr_url> --squash --delete-branch
```

The merge starts github-apply, which creates the repository. Other merges to
`main` also start github-apply, so find the run by the merge commit:

```bash
sha=$(gh pr view <pr_url> --repo yutakobayashidev/tofu-configuration --json mergeCommit --jq .mergeCommit.oid)
gh run list --repo yutakobayashidev/tofu-configuration --workflow github-apply.yml \
  --commit "$sha" --event push --json databaseId --jq '.[0].databaseId'
gh run watch <run_id> --repo yutakobayashidev/tofu-configuration --exit-status
```

The step is done when the apply succeeds and the repository answers:

```bash
gh repo view yutakobayashidev/<project_name> --json url,defaultBranchRef
```

github-apply also adds the new repository to the `yuta-tofu-plan` installation,
so later pull requests for this root can plan. If that step failed, github-plan
fails for this root with a 422; report it with the apply log.

If a run fails, report the failing step from its log and resume after the user
resolves it.

## 4. Clone via ghq

```bash
ghq get yutakobayashidev/<project_name>
cd "$(ghq root)/github.com/yutakobayashidev/<project_name>"
```

## 5. Init Nix Flake from dev-templates

Initialize the flake first: `nix flake init` refuses to overwrite existing
files, and some templates ship their own `.gitignore`.

```bash
nix flake init -t github:the-nix-way/dev-templates#<toolchain>
```

GitHub creates the repository with only a README. Add the license:

```bash
gh api licenses/<license> --jq .body > LICENSE
```

In `LICENSE`, replace `[year]` and `[fullname]`, when present, with the current
year and `gh api user --jq '.name // .login'`.

Keep any `.gitignore` the template wrote, and append the Nix entries it lacks so
that `git add -A` in step 8 does not commit them:

```bash
touch .gitignore
for entry in .direnv/ result; do
  grep -qxF "$entry" .gitignore || echo "$entry" >> .gitignore
done
```

## 6. Configure the Worktree Dependency Hook

Add the install command for the toolchain now, guarded so it runs only once the
manifest exists. A fresh flake has no `package.json`, and an unguarded
`pnpm install` would fail in every new worktree until one is added. For `node`,
append:

```bash
git config --local --add wt.hook 'if [ -f package.json ]; then pnpm install; fi'
```

For `bun`, use `bun install` with the same guard. Honor a package manager the
project already declares, such as a `packageManager` field or another lockfile.
For other toolchains, guard the documented install command with its manifest,
e.g. `Cargo.toml` for `cargo fetch` or `pyproject.toml` for the template's
Python installer. Skip the hook only for toolchains without a dependency
manager, such as shell-only scaffolding.

The global `wt.hook` already handles `direnv allow`. Add only the install command
to the repository's local Git config. Check `git config --local --get-all wt.hook`
first and append the command only if it is absent.

## 7. Add the CI Gate

Create `.github/workflows/ci.yml` in the new repository. It runs on every pull
request and push to `main` and ends in one aggregate job, `ci-gate`: the single
check that branch rules and agents wait on. New jobs join the gate through its
`needs` list, so the check name stays stable. `gha-lint` calls the shared
[zunoser/reusable-workflows](https://github.com/zunoser/reusable-workflows) lint.

Fill the placeholders with the latest releases; do not copy versions from an
older repository:

```bash
gh release view --repo actions/checkout --json tagName --jq .tagName              # <checkout_tag>
gh release view --repo nixbuild/nix-quick-install-action --json tagName --jq .tagName  # <nix_tag>
tag=$(gh release view --repo zunoser/reusable-workflows --json tagName --jq .tagName)
gh api "repos/zunoser/reusable-workflows/commits/$tag" --jq .sha                  # <lint_sha>, comment <lint_tag>
```

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions: {}

jobs:
  flake-check:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@<checkout_tag>
        with:
          persist-credentials: false
      - name: Install Nix
        uses: nixbuild/nix-quick-install-action@<nix_tag>
        with:
          github_access_token: ${{ github.token }}
          nix_conf: |
            access-tokens = github.com=${{ github.token }}
      - run: nix flake check

  gha-lint:
    permissions:
      contents: read
    uses: zunoser/reusable-workflows/.github/workflows/gha-lint.yml@<lint_sha> # <lint_tag>

  # Add every new job to `needs`.
  ci-gate:
    if: always()
    needs: [flake-check, gha-lint]
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions: {}
    steps:
      - if: contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')
        run: exit 1
```

Action refs stay as tags: `gh actions-lock` pins them to commits in
`.github/workflows/actions.lock`. The reusable workflow call needs its full
commit SHA, because the lockfile does not pin `jobs.<id>.uses`.

Then run `gh actions-lock` to create the lockfile. Leave everything uncommitted:
step 8 commits the scaffolding on the `init` branch, including `ci.yml`,
`actions.lock`, and the `flake.lock` that `nix flake check` writes. A commit on
`main` here would make the final `git pull --ff-only` fail after the squash
merge.
The step is done when `nix flake check` passes locally and `gh actions-lock
--verify` passes; the `gha-lint` job runs the remaining checks on the pull
request. See `$gha-lint` for the lockfile rules.

## 8. Land the First Commit Through a Pull Request

For a public repository, the ruleset rejects direct pushes to `main`, and
`ci-gate` must pass before a merge. Use the same pull request flow for a private
repository so `ci-gate` still runs. Open the scaffolding as a pull request:

```bash
git switch -c init
git add -A
git commit -m "feat: init <project_name> with <toolchain> flake"
git push -u origin init
gh pr create --fill --base main
gh pr checks --watch
```

Right after the pull request opens, `gh pr checks --watch` can exit with "no
checks reported" before the workflows register. Wait a few seconds and run it
again until it reports `ci-gate`.

Merge once `ci-gate` passes, then sync `main`:

```bash
gh pr merge --squash --delete-branch
git switch main
git pull --ff-only
```

When `ci-gate` fails, fix the cause on the `init` branch and push again.

## 9. Summary

Print the final result:

- Repository URL
- Local path
- Toolchain and license used
- Worktree install hook added, or why none was needed
- tofu-configuration pull request URL and the CI gate workflow path. For a
  public repository, `main` requires pull requests that pass `ci-gate`; for a
  private one, `ci-gate` is advisory because GitHub Free has no rulesets there
- Whether github-apply added the repository to the `yuta-tofu-plan` installation
- Manual follow-ups for requested settings the module does not expose

## 10. Resume Feature Planning

If an OpenCode planning session already has the project's requirements or
domain decisions, return the new checkout to that session so it can resume
with those decisions and the remaining questions.

For a standalone setup, ask the user to open the new repository and invoke
`$domain-modeling` to start defining its requirements and identifying decisions
that warrant an ADR. Leave the modeling session to the user's next request.
