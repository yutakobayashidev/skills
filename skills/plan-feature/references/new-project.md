# Plan a new project

1. Start a `plan` session in an available workspace. Agree on who the project is for, what the first usable version does, and one concrete user flow. Run the required `domain-modeling` step and keep the proposed glossary and ADRs in the plan while the project has no repository.
2. Use those decisions to propose a repository name, toolchain, license, and visibility. When the user approves setup, pass the agreed setup to `init-project` in a write-capable run. Relay any provisioning approval requested by `init-project` and wait for its repository and checkout to be ready.
3. Resume planning in the new checkout. Use an existing session-move command when available or pass the goal, terms, agreed decisions, and open questions into a new session. Check the proposed acceptance commands against the scaffold.

Return to the Issue-drafting steps in `plan-feature` with the repository URL, decisions, and first deliverable.
