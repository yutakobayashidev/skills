# New Repo Workflow
1. Write the repository root in tofu-configuration with scripts/new-github-repository
2. Plan the root, apply it after the user approves, and land it on main
3. Confirm the repository exists and clone with ghq
4. Add LICENSE and .gitignore from GitHub's templates
5. Initialize from dev-templates
6. Append the template-specific dependency install command to the repository's local wt.hook
7. Add the CI gate workflow (.github/workflows/ci.yml ending in a ci-gate job) and lint and lock it with gha-lint
8. Make initial commit
