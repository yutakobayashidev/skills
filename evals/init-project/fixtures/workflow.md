# New Repo Workflow
1. Add the repository in tofu-configuration under infra/services/github/repositories.tf
2. Land the change on main and wait for CI to apply it
3. Confirm the repository exists and clone with ghq
4. Initialize from dev-templates
5. Append the template-specific dependency install command to the repository's local wt.hook
6. Make initial commit
