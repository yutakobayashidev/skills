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
and CI creates the repository when that root is merged. Dispatch the workflow
that writes the root and opens the pull request:

```bash
gh workflow run github-new-repository.yml --repo yutakobayashidev/tofu-configuration \
  -f name=<project_name> -f description="<description>" -f visibility=<visibility>
```

The root calls the shared repo kit module. Its defaults are the recommended
settings (squash merge only, branch deletion on merge, Dependabot alerts), and
its ruleset makes `main` accept only pull requests that pass `ci-gate`, with no
required approval. The pull request's branch is `new-repository/<project_name>`;
find it with:

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

The plan, in the run summary, creates exactly four resources: the repository,
its default branch, its vulnerability alerts, and its ruleset. Show it to the
user and merge after they approve:

```bash
gh pr merge <pr_url> --squash --delete-branch
```

The merge starts github-apply, which creates the repository. Watch its run the
same way (`--workflow github-apply.yml --branch main`). The step is done when
the apply succeeds and the repository answers:

```bash
gh repo view yutakobayashidev/<project_name> --json url,defaultBranchRef
```

If a run fails, report the failing step from its log and resume after the user
resolves it.

## 4. Clone via ghq

```bash
ghq get yutakobayashidev/<project_name>
cd "$(ghq root)/github.com/yutakobayashidev/<project_name>"
```

GitHub creates the repository with only a README, so add the license and
`.gitignore` from GitHub's templates:

```bash
gh api licenses/<license> --jq .body > LICENSE
gh api gitignore/templates/<Gitignore_template> --jq .source > .gitignore
```

- In `LICENSE`, replace `[year]` and `[fullname]`, when present, with the
  current year and `gh api user --jq '.name // .login'`.
- Map the toolchain to the closest gitignore template name, e.g. go -> Go,
  rust -> Rust, python -> Python, node -> Node. When none matches, skip
  `.gitignore`.

## 5. Init Nix Flake from dev-templates

```bash
nix flake init -t github:the-nix-way/dev-templates#<toolchain>
```

## 6. Configure the Worktree Dependency Hook

From the new repository root, choose the install command using the selected
template, its setup notes, and any project manifest or lockfile. Honor a package
manager already declared by the project. For a Node project using pnpm, append:

```bash
git config --local --add wt.hook 'pnpm install'
```

For a Bun project using Bun, append `bun install` the same way. If no package
manager is declared, use pnpm for `node` and Bun for `bun` when the project has a
`package.json`. For other templates, add the documented install command if the
project has dependencies to install. Skip the hook for shell-only scaffolding
without a dependency manifest.

The global `wt.hook` already handles `direnv allow`. Add only the install command
to the repository's local Git config. Check `git config --local --get-all wt.hook`
first and append the command only if it is absent.

## 7. Add the CI Gate

Create `.github/workflows/ci.yml` in the new repository. It runs on every pull
request and push to `main` and ends in one aggregate job, `ci-gate`: the single
check that branch rules and agents wait on. New jobs join the gate through its
`needs` list, so the check name stays stable.

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
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
        with:
          persist-credentials: false
      - uses: cachix/install-nix-action@8aa03977d8d733052d78f4e008a241fd1dbf36b3 # v31.10.6
      - run: nix flake check

  # Add every new job to `needs`.
  ci-gate:
    if: always()
    needs: [flake-check]
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions: {}
    steps:
      - if: contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')
        run: exit 1
```

Then run `$gha-lint` on `ci.yml`: it lints the workflow and onboards its actions
to `.github/workflows/actions.lock`. The step is done when `nix flake check`
passes locally and every `$gha-lint` check passes.

## 8. Land the First Commit Through a Pull Request

The ruleset rejects direct pushes to `main`, and `ci-gate` must pass before a
merge. Open the scaffolding as a pull request:

```bash
git switch -c init
git add -A
git commit -m "feat: init <project_name> with <toolchain> flake"
git push -u origin init
gh pr create --fill --base main
gh pr checks --watch --required
```

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
- tofu-configuration pull request URL and the CI gate workflow path; `main`
  requires pull requests that pass `ci-gate`
- Manual follow-ups for requested settings the module does not expose

## 10. Hand Off to Domain Modeling

After the summary, ask the user to open the new repository and invoke
`$domain-modeling` to start defining the project's requirements and identifying
decisions that warrant an ADR. Leave the modeling session to the user's next
request.
