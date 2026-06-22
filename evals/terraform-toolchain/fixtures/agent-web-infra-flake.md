# Agent Web Infrastructure Template Starting Point

The repository usually starts with:

```bash
nix flake init -t github:yutakobayashidev/ashiba#agent-web-infra
```

If the user explicitly wants a minimal Terraform/OpenTofu-only setup, use:

```bash
nix flake init -t github:the-nix-way/dev-templates#hashi
```

Then the project adds or trims Terraform/OpenTofu-specific tools in the generated devShell.
