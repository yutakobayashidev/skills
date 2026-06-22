---
name: terraform-toolchain
description: Set up, review, or improve Terraform/OpenTofu project tooling with Nix devShells, especially when using yutakobayashidev/ashiba#agent-web-infra, agent-skills-nix, the-nix-way/dev-templates#hashi for minimal setups, checkov, trivy, tflint, pike/tfmv from yutakobayashidev/nur-packages, or terraform/opentofu.withPlugins. Use this whenever the user asks about Terraform/OpenTofu development environments, provider plugin pinning through Nix, infrastructure security scanning, or turning a HashiCorp-style project into a reproducible Nix workflow.
user-invocable: true
---

# Terraform/OpenTofu Toolchain

Use this skill to create or improve a reproducible Terraform/OpenTofu development environment. The local default is to start from `github:yutakobayashidev/ashiba#agent-web-infra`. If the user explicitly wants a minimal setup, use `github:the-nix-way/dev-templates#hashi` instead and then add only the missing project-specific pieces.

Keep the setup simple: one devShell, explicit tools, explicit provider plugins, and direct commands that the user can run locally or in CI. Avoid wrapper scripts unless the repository already uses them or the command is genuinely repeated and error-prone.

## Default Approach

1. Start from the agent web infrastructure template:

```bash
nix flake init -t github:yutakobayashidev/ashiba#agent-web-infra
```

For minimal Terraform/OpenTofu-only repositories, start from the smaller HashiCorp template instead:

```bash
nix flake init -t github:the-nix-way/dev-templates#hashi
```

2. Inspect the generated `flake.nix` before editing. Preserve the template's structure unless there is a clear reason to change it.

3. Add project tooling to the devShell:

| Tool                      | Use                                                                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `terraform` or `opentofu` | IaC engine. Use the one already used by the project.                                                                                                            |
| `tflint`                  | Terraform style and provider-aware linting.                                                                                                                     |
| `checkov`                 | IaC policy and misconfiguration scanning.                                                                                                                       |
| `trivy`                   | Filesystem scan for vulnerabilities, secrets, and IaC misconfigurations.                                                                                        |
| `pike`                    | IAM permission discovery for Terraform resources, when relevant. Use `inputs.nur-packages.packages.${system}.pike` from `github:yutakobayashidev/nur-packages`. |
| `tfmv`                    | Rename Terraform/OpenTofu resources, data sources, and modules while generating `moved` blocks. Use `inputs.nur-packages.packages.${system}.tfmv`.              |
| `sops`                    | Secrets workflow, when the project uses SOPS or the `carlpett/sops` provider.                                                                                   |

4. Prefer `terraform.withPlugins` or `opentofu.withPlugins` in Nix when provider plugins are known. This makes `init` less dependent on live registry downloads and keeps local/CI behavior closer.

5. Document only the commands that are actually useful for the project. Avoid adding a long generic Terraform tutorial.

## Agent Skills in agent-web-infra

`ashiba#agent-web-infra` also installs agent skills with `Kyure-A/agent-skills-nix`. Keep the explanation minimal and close to the code:

| Source | Upstream | Use when |
| ------ | -------- | -------- |
| `google-cloud` | [google/skills](https://github.com/google/skills/tree/main/skills/cloud) | The infrastructure targets Google Cloud. |
| `cloudflare-skills` | [cloudflare/skills](https://github.com/cloudflare/skills) | The infrastructure targets Cloudflare Workers, Pages, D1, R2, or related Cloudflare services. |
| `vercel` | [vercel-labs/skills](https://github.com/vercel-labs/skills) | The app deploys to Vercel. |
| `vercel-next` | [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills) | The app is Next.js on Vercel. |
| `hono` | [yusukebe/hono-skill](https://github.com/yusukebe/hono-skill) | The backend uses Hono. |
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | The project needs frontend design guidance. |
| `modern-web-guidance` | [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) | The project needs browser/platform guidance. |
| `hashicorp` | [hashicorp/agent-skills](https://github.com/hashicorp/agent-skills) | Terraform/OpenTofu, Vault, or other HashiCorp workflows matter. |
| `actrun` | [mizchi/actrun](https://github.com/mizchi/actrun) | Local GitHub Actions execution is useful. |

Choose skill sources for the cloud provider and stack in use. For Google Cloud projects, keep `google-cloud`; for Cloudflare projects, keep `cloudflare-skills`; for Vercel/Next.js deployments, keep `vercel` and `vercel-next`; for Terraform/OpenTofu work, keep `hashicorp`. Remove unused providers instead of installing every source by default. Do not hand-copy generated skill directories into the repo; let `agent-skills-nix` install selected skills from pinned flake inputs.

## Choosing Terraform vs OpenTofu

- Use `terraform` when the project already depends on Terraform Cloud/HCP Terraform behavior, HashiCorp-only workflows, or has a checked-in `.terraform-version`.
- Use `opentofu` when the project already uses OpenTofu or wants the open-source default.
- Do not migrate between Terraform and OpenTofu as part of toolchain cleanup unless the user explicitly asks.

## Provider Plugins with Nix

Use Nix-provided plugins for common providers:

```nix
terraform = pkgs.terraform.withPlugins (p: [
  p.carlpett_sops
  p.cloudflare_cloudflare
  p.determinatesystems_hydra
  p.hashicorp_aws
  p.hashicorp_external
  p.hashicorp_null
  p.integrations_github
  p.oracle_oci
]);
```

Then include `terraform` in `packages`:

```nix
let
  terraform = pkgs.terraform.withPlugins (p: [
    p.hashicorp_aws
    p.hashicorp_external
    p.hashicorp_null
  ]);
in
pkgs.mkShellNoCC {
  packages = with pkgs; [
    terraform
    tflint
    checkov
    trivy
    # flake input: nur-packages.url = "github:yutakobayashidev/nur-packages";
    inputs.nur-packages.packages.${system}.pike
    inputs.nur-packages.packages.${system}.tfmv
  ];
}
```

For OpenTofu, use the same pattern:

```nix
pkgs.opentofu.withPlugins (p: [
  p.cloudflare_cloudflare
  p.hashicorp_aws
  p.integrations_github
])
```

## Custom Providers

If nixpkgs does not provide a provider, use `opentofu.plugins.mkProvider` when available. Keep the derivation close to the devShell so the plugin list is easy to audit.

```nix
let
  mkProvider = pkgs.opentofu.plugins.mkProvider;
in
pkgs.opentofu.withPlugins (p: [
  p.hashicorp_aws
  (mkProvider {
    owner = "Lucky3028";
    repo = "terraform-provider-discord";
    rev = "v2.7.0";
    hash = "sha256-...";
    vendorHash = "sha256-...";
    spdx = "GPL-3.0-only";
    homepage = "https://registry.terraform.io/providers/Lucky3028/discord";
    provider-source-address = "registry.terraform.io/Lucky3028/discord";
  })
])
```

For Terraform, prefer nixpkgs-provided providers. If a custom provider is required and only OpenTofu exposes the needed helper cleanly, explain the tradeoff instead of inventing a fragile derivation.

## Validation Commands

Run the narrowest command that proves the change:

```bash
nix flake check
nix develop -c terraform fmt -check -recursive
nix develop -c terraform init -backend=false
nix develop -c terraform validate
nix develop -c tflint --init
nix develop -c tflint
nix develop -c checkov -d .
nix develop -c trivy filesystem --scanners vuln,misconfig,secret .
```

Adjust `terraform` to `tofu`/`opentofu` when the project uses OpenTofu.

Use `terraform init -backend=false` for validation when real backend credentials are not needed. Use the real backend only when planning or applying.

## CI Pattern

Keep CI close to local commands:

```yaml
- run: nix develop -c terraform fmt -check -recursive
- run: nix develop -c terraform init -backend=false
- run: nix develop -c terraform validate
- run: nix develop -c tflint --init
- run: nix develop -c tflint
- run: nix develop -c checkov -d .
- run: nix develop -c trivy filesystem --scanners vuln,misconfig,secret .
```

Do not run `terraform apply` in a generic quality workflow. Apply jobs need explicit environment, identity, locking, and approval rules.

When applying from GitHub Actions, explicitly design for tokenless/cloud-native identity and supply-chain hardening:

- Prefer workload identity federation / OIDC over long-lived cloud access keys. For example, use GitHub OIDC with AWS IAM roles, Google Cloud Workload Identity Federation, Azure federated credentials, or the equivalent provider-native mechanism.
- Keep apply permissions separate from validation permissions. PR workflows should normally run format/lint/validate/plan only; apply should be restricted to protected branches/environments with required reviewers.
- Pin third-party actions to commit SHAs, keep the original version in a comment, and review release notes before updates.
- Set minimal `permissions:` on every workflow/job, usually `contents: read` plus `id-token: write` only for jobs that actually need OIDC.
- Avoid storing provider credentials in GitHub secrets when a tokenless path exists. If a secret is unavoidable, scope it narrowly and rotate it.
- Treat Terraform provider plugins and custom Nix provider derivations as supply-chain inputs: pin versions and hashes, review source repositories, and keep lock files intentional.

## Review Checklist

- The devShell is based on `yutakobayashidev/ashiba#agent-web-infra`, or `the-nix-way/dev-templates#hashi` when the user wants a minimal Terraform/OpenTofu-only setup.
- The `agent-skills-nix` setup is explained when using `agent-web-infra`: pinned skill sources, selected targets, and shellHook installation are intentional parts of the template.
- Terraform/OpenTofu provider plugins in `required_providers` are mirrored in `withPlugins` when available.
- `checkov`, `trivy`, `tflint`, and relevant NUR tools such as `pike`/`tfmv` are available through `nix develop`.
- Validation uses `init -backend=false` unless a real plan/apply is intended.
- Secrets are not printed in logs, committed in `tfvars`, or embedded in examples.
- Docs mention the exact local commands the repository supports.
