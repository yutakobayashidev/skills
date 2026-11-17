---
name: nix-cache-optimize
description: Reduce slow Nix rebuilds by finding cached nixpkgs replacements, checking Hydra and exact output paths, and diagnosing expensive cache misses.
---

# Nix Cache Optimize

Prefer compatible cached nixpkgs packages over uncached custom inputs. Preserve required features and security fixes. Prioritize expensive, recurring builds over raw miss counts; label estimated costs as estimates.

## Workflow

1. Locate the repository with `ghq`. Read its instructions, lock file, package selectors, and overlays. Identify the actual host/system and heavy packages. Preserve unrelated changes.
2. Capture the host's build plan without compiling:

   ```bash
   nix build '.#nixosConfigurations.HOST.config.system.build.toplevel' \
     --dry-run --no-link --no-write-lock-file \
     --option allow-import-from-derivation false
   ```

   Substitute the real host. For Darwin use `darwinConfigurations.HOST.system`; for standalone Home Manager use `homeConfigurations.NAME.activationPackage`. Capture stderr too. An IFD error means the audit is incomplete. Respect restrictions on evaluation during another build.
3. Check a compatible nixpkgs replacement or revision. Prefer supported full channel branches over development heads or small channels. Check required features, platform, and patches; a merged PR or Hydra success alone does not prove availability at the selected pin.
4. Check exact output paths first, then runtime closure when useful:

   ```bash
   nix path-info --store https://cache.nixos.org /nix/store/ACTUAL-OUTPUT
   nix path-info --store https://cache.nixos.org --recursive /nix/store/ACTUAL-OUTPUT
   ```

   Evaluate paths from the actual package expression, including host overrides. Check required outputs such as `bin` and `dev`. Record root presence separately from closure completeness. Check missing references against relevant configured caches; do not repeatedly traverse rejected candidates. Network errors mean unknown, not missing.
5. Diagnose significant misses: absent output, differing upstream derivation, or local substitution configuration. Compare `.drvPath` and inputs with `nix-diff` below. Before changing `follows`, trace whether that input actually constructs the consumed package: modules/overlays often use the host's package set. Do not change irrelevant inputs for cache coverage.
6. Compare each heavy package's paths and dry-run plan before/after one change, then the whole host. Test a revision using `--override-input INPUT github:NixOS/nixpkgs/REV` with the dry-run flags above. Do not update all inputs or activate the host for an audit.

## Tools: use nix shell on demand

Do not add diagnostic tools to permanent dotnix packages. Replace `REV` with a resolved nixpkgs revision and use the same revision for the preflight and shell. First check that obtaining the tool requires no compilation:

```bash
nix build 'github:NixOS/nixpkgs/REV#hydra-check' --dry-run --no-link \
  --option allow-import-from-derivation false
nix shell 'github:NixOS/nixpkgs/REV#hydra-check' --max-jobs 0 --builders '' \
  --option allow-import-from-derivation false \
  -c hydra-check --jobset nixos/unstable --arch x86_64-linux --json firefox
```

Use the actual package, system, and Hydra jobset. `--jobset` specifies a project/jobset; `--channel` is for supported aliases. Match the returned revision and output with the candidate.

For mismatched derivations, preflight `nix-diff` the same way, then:

```bash
nix shell 'github:NixOS/nixpkgs/REV#nix-diff' --max-jobs 0 --builders '' \
  --option allow-import-from-derivation false \
  -c nix-diff /nix/store/OLD-package.drv /nix/store/NEW-package.drv
```

Both recipes must be available locally; a cached output does not guarantee its recipe is cached. Trace changed patches, compiler, dependencies, or settings back to their configuration. If tools would need compilation, use Hydra's web view or `nix derivation show` instead. The shell flags disable local and remote builds so a cache race fails rather than starts compilation.

## Report

Give the host/system, revisions, timestamp, and a short list of expensive misses: cause, proposed change, before/after plan, cost evidence or estimate, and rebuild frequency. Check actual daemon substitution separately from remote cache presence; preserve signature verification and report configuration/network failures.

A warm local store is not proof of remote coverage. Do not divide fetched paths by build derivations or equate download size with compile cost. Prefer eliminating a repeated compiler build over many cheap wrappers; avoid double-counting shared dependencies.

For upstream monitoring, record package/PR, required features, target channel/system, and latest cache result. On the next run, check channel inclusion and feature parity before recommending migration. Run once unless recurring monitoring is requested.

Sources: [Hydra CLI](https://github.com/nix-community/hydra-check), [nix-diff](https://github.com/Gabriella439/nix-diff), [flake inputs](https://nix.dev/manual/nix/2.35/command-ref/new-cli/nix3-flake), [path-info](https://nix.dev/manual/nix/latest/command-ref/new-cli/nix3-path-info). This workflow combines upstream specifications with project-specific operational choices.
