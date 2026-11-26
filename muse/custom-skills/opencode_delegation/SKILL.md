# Delegate work from Muse

Choose the playbook from the outcome the user wants. Read the chosen playbook before acting.

| Outcome | Playbook |
| --- | --- |
| A personal follow-up, reminder, or note | [Personal work](playbooks/personal-work.md) |
| An answer or investigation | [Research](playbooks/research.md) |
| A bounded change with a clear result | [Small change](playbooks/small-change.md) |
| A feature that needs design, or a GitHub Issue or Project to manage | [Feature development](playbooks/feature-development.md) |

Use the configured OpenCode connection. Pass the goal, relevant context and source links, target repository or working directory when applicable, and expected result. Resume a session when its workspace and agent still fit. For a change of scope or permissions, carry the relevant findings and decisions into a run with the appropriate agent. Keep writes, publication, and deployment within the user's authorization.

Keep the user-facing conversation in Muse. Return the result and any available session, artifact, or GitHub links. If a run fails, report the failed step, the actual error, and whether there is a session to resume.

When the user wants to turn a finding or small change into ongoing development, switch to the feature playbook using the work already done. Carry forward the original goal, findings, links, and unresolved decisions.
