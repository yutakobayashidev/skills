---
name: init-project
description: Create a new GitHub repository through the tofu-configuration CI workflow, clone it with ghq, initialize it from the-nix-way/dev-templates, configure dependency installation for new worktrees, and make the initial commits.
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

## 2. Add Repository to OpenTofu

Locate `yutakobayashidev/tofu-configuration` with `ghq list -p`, or clone it
with `ghq get yutakobayashidev/tofu-configuration` if needed. Add the
`github_repository` resource to `infra/services/github/repositories.tf`:

```hcl
resource "github_repository" "<project_name>" {
  name        = "<project_name>"
  description = "<description>"  # omit if empty
  visibility  = "<visibility>"

  has_issues    = true
  has_projects  = true
  has_wiki      = true
  has_downloads = true

  allow_merge_commit = true
  allow_squash_merge = true
  allow_rebase_merge = true

  delete_branch_on_merge = true

  license_template    = "<license>"            # e.g. "mit"
  gitignore_template  = "<Gitignore_template>" # e.g. "Go", "Rust", "Python", "Node"; omit if no match
}
```

Notes:

- Resource name: use the project name with hyphens converted to underscores.
- Map the toolchain to the closest GitHub gitignore template name, e.g. go -> Go, rust -> Rust, python -> Python, node -> Node. If no match, omit `gitignore_template`.
- If description is empty, omit `description`.

## 3. Submit the OpenTofu Change and Wait for CI

Commit the new repository resource and submit it through
`tofu-configuration`'s normal workflow so it lands on `main` and CI runs
the apply. Check the apply result when available and confirm that the new
repository is accessible before cloning:

```bash
gh repo view yutakobayashidev/<project_name> --json url,defaultBranchRef
```

If CI fails or the repository is still pending, report that status and
resume cloning after provisioning succeeds.

## 4. Clone via ghq

```bash
ghq get yutakobayashidev/<project_name>
cd "$(ghq root)/github.com/yutakobayashidev/<project_name>"
```

Pull the generated LICENSE and `.gitignore`:

```bash
git pull origin main
```

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

## 7. Initial Commit

Stage all files and create an initial commit:

```bash
git add -A
git commit -m "feat: init <project_name> with <toolchain> flake"
git push -u origin main
```

## 8. Summary

Print the final result:

- Repository URL
- Local path
- Toolchain and license used
- Worktree install hook added, or why none was needed

## 9. Hand Off to Domain Modeling

After the summary, ask the user to open the new repository and invoke
`$domain-modeling` to start defining the project's requirements and identifying
decisions that warrant an ADR. Leave the modeling session to the user's next
request.
