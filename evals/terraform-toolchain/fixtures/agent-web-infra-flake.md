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

The agent-web-infra template also includes `agent-skills-nix`. Document the skill repositories as a compact table with upstream links, including `cloudflare-skills = { url = "github:cloudflare/skills"; flake = false; };`, then keep only the sources that match the cloud provider and stack in use.
