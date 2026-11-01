---
name: gha-lint-repos
description: >-
  Apply gha-lint across repositories owned by a GitHub organization or user: inventory all accessible repositories, clone them with ghq, isolate changes, validate fixes, and open one pull request per changed repository. Use for an owner-wide GitHub Actions lint or actions.lock rollout, not a single-repository review.
---

# GitHub Actions maintenance across repositories

## Responsibility boundary

This skill coordinates repositories. The prerequisite **gha-lint** skill owns the
per-repository lint commands, fixes, actions.lock workflow, and pinact policy.
Read the installed `gha-lint/SKILL.md` before execution; in this source repository
it is [../gha-lint/SKILL.md](../gha-lint/SKILL.md). Do not copy its tool versions or
rules here. If it is unavailable, inventory can proceed, but report that the lint
phase needs the dependency rather than improvising its behavior.

A request to create or discuss this skill does not authorize a maintenance run.
For execution, obtain the owner and scope from the request. If the user asks to
fix repositories and create PRs, that authorizes branches, commits, pushes and
PR creation for that scope; do not ask again per repository. An audit-only request
permits inventory and checks, but not fixes, pushes or PRs.

## Inventory and clone

Use authenticated `gh`, `ghq`, Git, and the tools required by gha-lint. Default to
github.com unless the user identifies another host. Use that host consistently
for API, clone and PR commands. Do not mistake an owner name for a GitHub team.

Enumerate **every page** of repositories owned by the requested user or org. Do
not use the default 30 results from `gh repo list` as the complete inventory.
For GitHub.com, this paginated query works for either owner type:

```bash
# Set target_owner and run_dir from the task; keep run_dir outside the repositories.
gh api graphql --paginate \
  -f owner="$target_owner" \
  -f query='query($owner: String!, $endCursor: String) {
    repositoryOwner(login: $owner) {
      repositories(first: 100, after: $endCursor) {
        nodes {
          nameWithOwner url isArchived isFork isEmpty viewerPermission
          defaultBranchRef { name }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }' --jq '.data.repositoryOwner.repositories.nodes[]' > "$run_dir/repos.jsonl"
```

Check the API exit status/errors before using the inventory. A partial response
is not a complete run. Deduplicate by `nameWithOwner`, verify the returned owner,
and keep metadata plus the active include/exclude filters in the run record.
Only repositories visible to the authenticated account can be enumerated; report
that visibility limit instead of claiming access to hidden private repositories.

When asked for all repositories, include forks and archives in the inventory and
clone phase rather than silently filtering them out. Apply explicit user filters.
For each in-scope entry, use `ghq get --no-recursive "$repo_url"`. Resolve its local
path with `ghq list --exact --full-path "$owner_repo"` and verify its origin matches
the inventoried host/repository; do not guess a single global ghq root. Existing
clones are reused. Record clone failures individually and continue with others.

## Isolate each repository

- Read repository-local AGENTS.md and relevant instructions before changes.
- Before fetching, mark empty repositories or a missing default branch as a
  reasoned no-op; there is no branch to process.
- Fetch the latest default branch from the verified remote; never assume `main`.
  Use a separate Git worktree based on that remote branch, with a descriptive
  branch such as `chore/gha-lint`. Keep worktrees outside the user's checkout.
  Do not switch, stash, reset, clean, or commit the user's existing work.
- Before creating a branch, check the run record, local/remote branch and open PRs
  for this maintenance task. Reuse an existing task-owned worktree/PR when safe.
  Do not overwrite an unrelated branch or another contributor's PR. If the prior
  PR was merged, compare the current default branch before starting another.
- Repositories without Actions workflows or action definitions are no-ops; do not add artificial CI just to
  produce a PR. Archived repositories are read-only: audit where possible, but
  do not unarchive or create changes/PRs. Record these outcomes explicitly.

## Run gha-lint and prepare changes

Apply gha-lint separately in each isolated worktree. First record baseline
findings, then make the smallest relevant fixes and run the required checks again.
Follow its actions.lock coverage and version guidance; do not invent a second
pinning policy here. Standalone action definitions may need linting even when
there are no workflows to onboard to a lockfile.

Preserve workflow triggers, secrets usage and intended execution behavior unless
a finding requires a reviewed change. Do not batch unrelated dependency upgrades,
application changes, repository settings, or permission broadening into this task.
A change requiring unavailable credentials or a product decision is a per-repo
blocker; finish independent repositories instead of guessing.

Start with one representative repository to verify the tool setup, then continue
through the inventory. This is a validation step, not a new approval gate. Keep
concurrency low and serialize pushes/PR creation. Share findings between workers
if delegating, but never give two workers ownership of the same worktree. On rate
limits, honor the retry timing; authentication or systemic tool failures should
pause the affected phase, not trigger repeated identical failures across repos.

## Publish one PR per changed repository

Only publish when PR creation is in the user's requested scope. For each repo:

1. Review the diff, follow its pre-commit/doc requirements, and record exactly
   which checks passed, failed, or were unavailable. No diff means no commit/PR.
2. Commit only the intended files. Push the task branch, never the default branch;
   do not force-push as a routine retry. If direct push is unavailable, use a fork
   only when allowed by the request and repository policy, otherwise record the
   access blocker. Do not fork private repositories just to bypass restrictions.
3. Query for an existing matching open PR immediately before creating one. Update
   this run's existing PR rather than creating duplicates. Use `gh pr create` with
   explicit repository, actual default base branch, head branch, and `--body-file`.
   Describe the concrete changes, lockfile coverage, validation, and unresolved
   issues. Do not send extra comments or request reviewers unless asked.
4. Normal PRs require the relevant validation to pass. If checks are blocked or
   findings remain, keep the work recorded locally; create a draft only when the
   user requested drafts or explicitly wants partial work published. A failed
   check must not be hidden by marking the repository complete.
5. Record the PR URL and current checks. Report pending CI separately from passing
   CI; do not merge, enable auto-merge or alter branch protections.

## Resume and report

Keep an inventory and progress file in `run_dir`, not committed into target repos.
For each repository record: local/worktree paths, base SHA, task branch, phase,
findings, changed files, validation commands/results, PR URL and blocker/skip
reason. Update it after each repository and after publishing. On resume, reconcile
it with Git and GitHub before acting; an interrupted push/PR call may have succeeded.

Finish with counts and links: PRs created/updated, clean repositories, read-only
or empty repositories, failures and unprocessed repositories. Every inventory
entry must have an outcome; expose any incomplete work. Never report all repos as
fixed merely because all clones succeeded.
