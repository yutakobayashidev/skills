---
name: nix-cache-optimize
description: Reduce Nix source builds by auditing binary-cache misses, comparing nixpkgs revisions and Hydra status, and finding cached nixpkgs replacements for NUR or other flake packages. Use for slow rebuilds, cache-aware input updates, and monitoring upstream package availability; not general Nix performance tuning.
---

# Nix Cache Optimize

Prefer compatible packages already available from trusted binary caches, especially nixpkgs, over custom uncached packages. Optimize expensive compilation and rebuild frequency, not the number of flake inputs. Preserve required versions, features, platforms, and security fixes.

Read [references/workflow.md](references/workflow.md) for commands, evidence requirements, and upstream sources. Check installed CLI help before using version-sensitive options.

## Establish the actual build

- Locate repositories with `ghq`. Read repository instructions, working-tree changes, `flake.nix`, `flake.lock`, relevant overlays and package selectors. Identify each requested host's system and concrete build target.
- Map heavy packages to their actual source: root nixpkgs, stable fallback, external flake package output, overlay, or local derivation. Resolve lock-file input edges and `follows`; do not assume the node is named `nixpkgs`.
- Record baseline build/fetch plans and effective cache configuration. Separate source fetching, evaluation, substitution, compilation, and activation delays. A declaration of an unused input does not itself cause compilation.
- If another build is running, respect local instructions about concurrent evaluation. Do not use rebuild/switch to investigate. Prevent import-from-derivation builds during diagnostics; if evaluation is blocked, report that limitation.

## Choose the smallest effective improvement

Use these options according to the observed cause:

1. **Replace custom packages with nixpkgs equivalents.** Search the pinned revision and supported channel candidates. Verify features, version, patches, platforms, and actual output availability. A merged PR is a monitoring signal, not proof of channel availability. Keep the external input until all its package/module consumers are gone.
2. **Choose a cached revision.** Prefer supported full channel branches to development heads or small channels for this user's cache-first preference. Compare the current pin with a channel revision and, when necessary, a recent suitable Hydra evaluation. Do not indefinitely freeze an old insecure pin for cache coverage.
3. **Match upstream build inputs.** Compare an external flake's original package output with the consumer's overridden output. `follows` can reduce duplicate inputs but can also change dependencies and lose upstream cache matches. An overlay may rebuild the package against the host's package set. Neither adding nor removing `follows` universally improves caching. Check ABI/module compatibility before changing package sourcing.
4. **Remove unnecessary build variants.** Inspect patches, compiler/stdenv changes, CPU tuning, global CUDA settings, and package overrides. Keep needed behavior; scope optional variants narrowly. Metadata-only changes and every overlay do not necessarily change derivations: compare paths.
5. **Repair use of an existing relevant cache.** Check exact output availability, endpoint, signing key, effective daemon settings, trust restrictions, authentication, and network errors. Prefer the repository's declarative configuration. Do not disable signature checks, add broad trusted-users, or add caches unrelated to the outputs.
6. **Handle unavoidable custom builds.** When replacements do not meet requirements, explain the tradeoff. An existing CI cache or remote builder can help, but offloading compilation is not a cache hit. New cache infrastructure is an optional separate project, not the default remedy for a user trying to avoid custom inputs.

## Prove the recommendation

Hydra success, existence in a remote cache, and substitution by the user's daemon are separate findings. Match architecture and exact output paths; package names or versions alone are insufficient. A successful build at a different nixpkgs revision is only a candidate.

Compare one change at a time using temporary overrides or an isolated copy. Keep current user changes intact. For authorized edits, make the targeted package/input change, validate the resulting whole-host dry run, and show the lock-file diff. Do not update every input just to update nixpkgs. A request to audit or monitor does not authorize activation, scheduled jobs, publishing, or notifications.

Report:

- Target host/system, current and candidate revisions, observation time, and checked cache endpoints.
- Per heavy package: source, required features/version, exact output path, Hydra evidence, cache/daemon evidence, and recommended action.
- Before/after pending builds, fetch counts/bytes when available, and remaining expensive misses. Separate small configuration/wrapper derivations from compilers, browsers, kernels, and other heavy builds.
- Unknowns and next checks. Never describe unmeasured wall-clock improvements as achieved results.

Do not call a warm local store a 100% remote cache hit. Do not divide fetched store paths by build derivations: these are different units. If a percentage is useful, define a fixed set of required output paths and count cached/missing/unknown paths consistently for the same systems and cache set.

## Monitor for upstream replacements

For each uncached package, keep a concise watchlist in the requested report/location: current source and version, required patches/features, target systems, nixpkgs attribute or PR, channel/revision, latest Hydra result, exact-cache result, timestamp, and next action.

On a subsequent run, check whether the package or required fix has reached the candidate channel, then verify the concrete derivation and whole-target plan. Distinguish not merged, merged but not promoted, queued, failed, built but output unavailable, and ready to migrate. Recommend migration only after feature parity and substitution checks. Run once by default; create recurring monitoring only when requested, reusing existing automation and avoiding rapid Hydra polling.
