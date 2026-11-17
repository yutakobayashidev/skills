# Evidence and commands

These examples are templates: resolve the actual target, input name, jobset, system, revision, and output paths first. Use installed tools; do not compile a diagnostic utility just to diagnose slow builds. If hydra-check is absent, inspect its pinned nixpkgs build plan before obtaining it, or use Hydra's web/API views.

## 1. Capture baseline without compilation

Read `flake.lock` directly first. Inspect only relevant fields of `nix config show --json` (older versions use `nix show-config`): `substitute`, `substituters`, `trusted-substituters`, `trusted-public-keys`, and builder-related options. Avoid dumping credentials. Client output alone does not prove what a restricted multi-user daemon will accept; preserve warnings from the actual plan.

Example for NixOS:

```bash
nix build '.#nixosConfigurations.HOST.config.system.build.toplevel' \
  --dry-run --no-link --no-write-lock-file \
  --option allow-import-from-derivation false
```

For nix-darwin select `darwinConfigurations.HOST.system`; for standalone Home Manager select `homeConfigurations.NAME.activationPackage`. Resolve real output names from the repository. Capture stderr as well as stdout: build/fetch plans commonly appear on stderr. Do not rely on an undocumented `--dry-run --json` plan schema.

Evaluation may fetch flake sources and write derivations. Disabling IFD prevents evaluation from realising build outputs; an IFD error is an incomplete audit, not a cache miss. `--max-jobs 0` alone is not a no-build guard because remote builders may still execute builds.

## 2. Query Hydra as candidate evidence

```bash
hydra-check --help
hydra-check --channel nixos/unstable --arch x86_64-linux --json firefox
hydra-check --channel nixos/unstable --arch x86_64-linux
```

Use the discovered jobset for stable releases and Darwin. Do not assume aliases or architecture defaults match the host. Package jobs can be named differently from nixpkgs attributes; inspect the returned job and build URL. Use evaluation details to recover the full nixpkgs revision. Match that revision and the build output against the consumer. If Hydra is unavailable or a job is absent, report unknown; query exact cache paths independently. Limit requests to the relevant packages/evaluations.

## 3. Check exact outputs

For an unmodified nixpkgs candidate:

```bash
nix eval --raw \
  'github:NixOS/nixpkgs/REV#legacyPackages.x86_64-linux.PACKAGE.outPath' \
  --no-write-lock-file --option allow-import-from-derivation false
```

For packages selected through host overlays/configuration, evaluate their actual expression instead. `legacyPackages` does not reproduce custom `nixpkgs.config`, overlays, or external package outputs. Check every required output, such as `out`, `bin`, or `dev`, not only the default output. `.drvPath` identifies the build recipe; binary substitution generally needs its output paths.

With a concrete output path:

```bash
nix path-info --store https://cache.nixos.org --recursive \
  /nix/store/ACTUAL-HASH-PACKAGE
```

Repeat only for relevant trusted caches. A valid response demonstrates remote metadata/closure availability at that time; it does not prove successful NAR download or daemon acceptance. Distinguish a missing path from timeout, DNS/TLS failure, or denied access. A cached top-level output can be substituted without its build-time toolchain; do not require every build dependency to be remotely cached when the final output already is.

Check the local target's dry run to establish planned substitution. If a newly uploaded output remains a miss, investigate Nix's negative narinfo cache; use a targeted retry with `--option narinfo-cache-negative-ttl 0` where supported, not a global cache purge or permanent TTL change.

## 4. Compare revisions and package sources

```bash
nix build '.#nixosConfigurations.HOST.config.system.build.toplevel' \
  --override-input nixpkgs github:NixOS/nixpkgs/REV \
  --dry-run --no-link --no-write-lock-file \
  --option allow-import-from-derivation false
```

Use the actual input name. A root override can also affect external inputs that follow it; compare the whole plan. For edits that cannot be represented by an override, use an isolated checkout/copy that includes the relevant working-tree changes. Resolve local path inputs before copying.

Keep both observations close in time on the same machine without fetching/building between them. Existing local outputs can mask remote misses: query them remotely as well for a cold-machine portability claim. Do not delete store paths or run GC to simulate a cold store.

Use `nix derivation show` (older `nix show-derivation`) to inspect dependency or builder differences when necessary. Trace a heavy dependency through the derivation graph, distinguishing build-time and runtime dependencies; an unrealised output cannot always be traversed as a runtime closure.

## Best-practice rationale and sources

Reviewed 2026-11-17. Recheck current documentation when applying release-specific advice.

- **Channel selection:** full NixOS channels gate promotion on release checks and offer broader prebuilt coverage than small channels. They do not guarantee every requested package/platform succeeds. Prefer a supported channel, then measure the exact package set. See the [NixOS manual](https://nixos.org/manual/nixos/unstable/) and [channel branch documentation](https://wiki.nixos.org/wiki/Channel_branches).
- **Inputs versus caches:** `follows` changes the input graph. Our operational inference is that deduplication and upstream-cache compatibility can conflict when the upstream build used a different dependency revision. Compare derivations before choosing. See the [flake reference](https://nix.dev/manual/nix/2.35/command-ref/new-cli/nix3-flake) and [flake tradeoffs](https://nix.dev/concepts/flakes).
- **Hydra history:** hydra-check exposes jobs, evaluations, release tests, and architecture selection. Its historical success output is not an exact-pin cache guarantee. See [hydra-check upstream](https://github.com/nix-community/hydra-check).
- **Direct verification:** use output paths and target build plans. See [`nix path-info`](https://nix.dev/manual/nix/latest/command-ref/new-cli/nix3-path-info) and [`nix build`](https://nix.dev/manual/nix/latest/command-ref/new-cli/nix3-build).
- **Evaluation safety:** even evaluation-only workflows can realise IFD outputs unless prohibited. See [Import From Derivation](https://nix.dev/manual/nix/2.34/language/import-from-derivation.html).
- **Variants and licensing:** unfree packages generally lack official Hydra coverage. `allowUnfree` permits evaluation; it does not make them cached. CUDA flags/capabilities can select different builds. A suitable binary-packaged variant may avoid lengthy compilation, but still needs functional and path checks. See the [nixpkgs manual](https://nixos.org/manual/nixpkgs/stable/) and [CUDA documentation](https://wiki.nixos.org/wiki/CUDA).
- **Cache configuration:** validate endpoint, signatures, trust, and negative-cache behavior using the [Nix configuration reference](https://nix.dev/manual/nix/2.30/command-ref/conf-file). Preserve existing caches and keys; a flake's suggested cache is not automatically trusted by every daemon.
- **Reuse for unavoidable builds:** existing CI can publish identical outputs for other machines; cache retention matters. See [Cachix garbage collection](https://docs.cachix.org/garbage-collection). GC roots preserve local reuse, not remote availability. CPU parallelism, remote builds, and store optimisation address different costs and should not be reported as cache-hit improvements.

## Behavioral review cases

- Hydra reports a successful package at revision A; the lock pins B with a patch. Expected: compare actual output paths, not a claim that B is cached.
- An upstream flake package is cached with its own nixpkgs pin; the consumer uses `follows`. Expected: compare both plans and compatibility before changing `follows`.
- The current machine needs zero builds because all outputs exist locally. Expected: remote checks before any cold-machine hit-rate claim.
- A NUR package reaches nixpkgs but lacks a required feature. Expected: keep the existing package and record the missing feature in the watchlist.
- Cache requests time out and IFD blocks the plan. Expected: report unknown/incomplete; no compilation, deletion, or permanent configuration changes to force a result.
