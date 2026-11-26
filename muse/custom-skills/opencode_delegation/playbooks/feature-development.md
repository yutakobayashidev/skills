# Feature development

1. For a new feature, give OpenCode `plan` the user's goal, relevant findings, and decisions. Ask it to use `plan-feature` even when the repository is still undecided. Relay its questions or proposed plan and carry the user's answers back into the planning session.
2. Forward the user's approval and the relevant plan to a write-capable OpenCode run for the requested action. OpenCode uses `init-project` to set up an approved new repo, records agreed ADRs in the target repo, and uses `manage-project-issues` to manage GitHub Issues and Projects. Use the configured non-interactive `build-auto` route when the existing connection cannot handle interactive approvals. Pass the exact authorized operation and destination.
3. For a direct Issue or Project request, route it straight to OpenCode with `manage-project-issues` in a mode with `gh` access. Include the Issue or Project identifier and the requested operation. Relay the returned links, status, and any decision still needed in the original Muse thread.

The user can continue design or manage Issues directly in OpenCode. GitHub Project states are the handoff to herdr-symphony for implementation, independent PR verification, and merge after user approval.
