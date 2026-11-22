# New Repo Workflow
1. Dispatch github-new-repository in tofu-configuration to open the repository pull request
2. Review the github-plan run, merge after the user approves, and wait for github-apply to create the repository
3. Confirm the repository exists and clone with ghq
4. Add LICENSE and .gitignore from GitHub's templates
5. Initialize from dev-templates
6. Append the template-specific dependency install command to the repository's local wt.hook
7. Add the CI gate workflow (.github/workflows/ci.yml ending in a ci-gate job) and lint and lock it with gha-lint
8. Land the first commit through a pull request once the required ci-gate check passes
