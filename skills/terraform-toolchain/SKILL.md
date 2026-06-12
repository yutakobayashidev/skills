---
name: terraform-toolchain
description: Set up, review, or improve Terraform/OpenTofu project tooling with Nix devShells, especially when using the-nix-way/dev-templates#hashi, checkov, trivy, tflint, pike from yutakobayashidev/nur-packages, or terraform/opentofu.withPlugins. Use this whenever the user asks about Terraform/OpenTofu development environments, provider plugin pinning through Nix, infrastructure security scanning, or turning a HashiCorp-style project into a reproducible Nix workflow.
user-invocable: true
---

# Terraform/OpenTofu Toolchain

Use this skill to create or improve a reproducible Terraform/OpenTofu development environment. The local default is to start from `the-nix-way/dev-templates#hashi` and then add the missing project-specific pieces.

Keep the setup simple: one devShell, explicit tools, explicit provider plugins, and direct commands that the user can run locally or in CI. Avoid wrapper scripts unless the repository already uses them or the command is genuinely repeated and error-prone.

## Default Approach

1. Start from the HashiCorp template:

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
| `sops`                    | Secrets workflow, when the project uses SOPS or the `carlpett/sops` provider.                                                                                   |

4. Prefer `terraform.withPlugins` or `opentofu.withPlugins` in Nix when provider plugins are known. This makes `init` less dependent on live registry downloads and keeps local/CI behavior closer.

5. Document only the commands that are actually useful for the project. Avoid adding a long generic Terraform tutorial.

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

- The devShell is based on `the-nix-way/dev-templates#hashi` unless the repo already has a better local structure.
- Terraform/OpenTofu provider plugins in `required_providers` are mirrored in `withPlugins` when available.
- `checkov`, `trivy`, and `tflint` are available through `nix develop`.
- Validation uses `init -backend=false` unless a real plan/apply is intended.
- Secrets are not printed in logs, committed in `tfvars`, or embedded in examples.
- Docs mention the exact local commands the repository supports.
