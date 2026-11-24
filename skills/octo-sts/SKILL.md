---
name: octo-sts
description: Build or migrate GitHub Actions jobs that need Octo STS to exchange GitHub OIDC for a short-lived GitHub App installation token. Use for App bot identity, cross-repository access, or downstream CI that needs an App token.
---

# Octo STS for GitHub Actions

1. Identify the GitHub operation, target repository, and permissions. Use the job's `GITHUB_TOKEN` if its repository scope, identity, and event behavior meet the requirements. Use Octo STS when the job needs a GitHub App installation token, for example to access another repository, act as a particular bot, or trigger downstream CI without approval on an automation-created PR. Check the [GitHub token event rules](https://docs.github.com/en/actions/concepts/security/github_token#when-github_token-triggers-workflow-runs). Keep infrastructure administration on its existing dedicated credentials.
2. Check the intended STS instance and App installation. For Yuta's workflow automation, use `sts.yutakobayashi.com` and `yuta-octo-sts` where the App is installed and its permissions cover the operation. Verify the installation on the **target** repository and grant only the permissions the job needs. See [the deployed instance and dotnix workflows](https://github.com/yutakobayashidev/dotnix/blob/main/docs/octo-sts.md).
3. Match the **caller**. Inspect the OIDC claims from a run with the intended event, ref, environment, and reusable-workflow path. Record only the specific claim values needed for the policy, and keep the encoded JWT out of logs and artifacts. Check the actual `sub`: GitHub can emit a name-based, immutable ID-based, or customized subject. Environment-based subjects may omit the branch, so match `ref` separately when restricting them to a branch. Match `workflow_ref` for a direct workflow. For a reusable workflow, match `job_workflow_ref` for the called workflow and use `workflow_ref` to restrict the calling workflow when needed. See [GitHub's OIDC claim reference](https://docs.github.com/en/actions/reference/security/oidc).
4. Add the policy to `.github/chainguard/<identity>.sts.yaml` on the **target's default branch**. Use a separate identity for each distinct trust or permission set. Match the issuer, exact subject, and trusted workflow path and ref. For a name-based subject, also match the caller's numeric `repository_owner_id` and `repository_id`. Use quoted strings for numeric values and escape regex metacharacters in literal claim patterns. Keep write-token jobs on trusted code and refs. If a privileged trigger processes pull request data, keep PR-controlled code and artifacts out of the token-bearing job. See [Octo STS policy format](https://github.com/octo-sts/app#trust-policies).
5. Reuse an existing token setup action when it accepts the required identity and scope. Otherwise use [`octo-sts/action`](https://github.com/octo-sts/action) pinned to a verified commit. Grant `id-token: write` only to the exchange job. In a reusable workflow, ensure the caller permits that same job permission. Set `scope` to the target `owner/repo` and `identity` to the policy's filename stem. Pass the step's `token` output only to the steps that need it, for example through `GH_TOKEN` for `gh`. Set `persist-credentials: false` on checkout when passing Git credentials explicitly. If the job makes commits, configure the App bot's Git author identity separately from authentication.

## Example

A trusted workflow in `octo-org/automation` comments on an issue in `octo-org/project`. Replace the example repo names and IDs with the caller and target values.

In the target repository, `.github/chainguard/issue-comment.sts.yaml`:

```yaml
issuer: https://token.actions.githubusercontent.com
subject: repo:octo-org/automation:ref:refs/heads/main
claim_pattern:
  repository_owner_id: '123456'
  repository_id: '789012'
  workflow_ref: 'octo-org/automation/\.github/workflows/issue-comment\.yaml@refs/heads/main'
permissions:
  issues: write
```

In the caller repository, `.github/workflows/issue-comment.yaml`:

```yaml
name: Comment on an issue
on:
  workflow_dispatch:
    inputs:
      issue_number:
        description: Issue number in the target repository
        type: number
        required: true

permissions: {}

jobs:
  comment:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      id-token: write
    steps:
      - id: sts
        uses: octo-sts/action@f603d3be9d8dd9871a265776e625a27b00effe05 # v1.1.1
        with:
          domain: sts.yutakobayashi.com
          scope: octo-org/project
          identity: issue-comment
      - name: Comment on the issue
        env:
          GH_TOKEN: ${{ steps.sts.outputs.token }}
          GH_REPO: octo-org/project
          ISSUE_NUMBER: ${{ inputs.issue_number }}
        run: gh issue comment "$ISSUE_NUMBER" --body "Processed by automation."
```

## Verify the cutover

- Validate the workflow and policy. After the policy is on the target default branch, observe an authorized run from the intended caller. Verify token exchange and the GitHub operation, including bot attribution and downstream CI when those motivated the change. For a migration, check remaining consumers before retiring the old credentials.
- For `403 token does not match trust policy`, compare the actual claims with the target's merged policy. Check the subject format, reusable-workflow path, and exact ref. If the policy just changed, account for the STS policy cache before changing permissions or patterns. [dotnix #2579](https://github.com/yutakobayashidev/dotnix/pull/2579) records a subject mismatch that appeared after the service was already responding.
