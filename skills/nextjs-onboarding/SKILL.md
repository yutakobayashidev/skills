---
name: nextjs-onboarding
description: Audit the baseline repo hygiene of an existing Next.js project when joining it for the first time. Use this whenever the user says they just joined a Next.js project, asks what to check first, wants a first-pass setup review, or wants to confirm dependency pinning, pnpm workspace strictness, Knip setup, Node version pinning, environment-variable validation, or testing strategy before doing feature work.
user-invocable: true
---

# nextjs-onboarding

Audit an existing Next.js project with a read-first checklist.

This skill is for the first pass after joining a Next.js codebase. Focus on the repo hygiene and guardrails that should already be in place before feature work starts. Prefer concrete file-based evidence over broad architectural commentary.

## Default stance

- Start with inspection, not edits.
- Do not change files during the initial pass unless the user explicitly asks for implementation.
- Call out missing safeguards directly.
- If something is absent, say so plainly and explain why it matters.

## Primary checklist

Inspect these items first and in this order.

### 1. Scripts for formatting and linting

Check `package.json` first for `scripts.lint` and `scripts.fmt`.

These should exist as explicit entrypoints for contributors. If either is missing, call it out immediately.

Preferred defaults:

- `lint`: use `oxlint` when it fits the repo
- `fmt`: use `oxfmt` when it fits the repo

Acceptable alternatives when there is a clear reason:

- `eslint`
- `prettier`
- `biome`

Do not treat tool choice as the primary issue. The primary issue is whether contributors have stable, documented `lint` and `fmt` scripts to run.

### 2. Dependency pinning

Check whether `.npmrc` exists and contains:

```ini
save-exact=true
```

The goal is that newly added dependencies are pinned exactly rather than drifting with range operators.

If the project is a pnpm monorepo, also inspect `pnpm-workspace.yaml` for strict catalog settings:

```yaml
catalogMode: strict
cleanupUnusedCatalogs: true
packageManagerStrictVersion: true
minimumReleaseAge: 1440
```

Report whether each setting is present, missing, or partially configured.

If it is a monorepo, also check whether `sherif` is used to catch dependency/version drift across packages.

### 3. Node version pinning

Check whether `.node-version` exists.

Call out version-pinning gaps if the repo relies on `packageManager` only or has no explicit Node version file at all.

If the repo uses GitHub Actions, also check whether Node.js setup is centralized in a reusable composite action instead of duplicated across workflows.

Prefer a shared action such as `.github/actions/setup-node/action.yml`:

```yaml
name: Setup Node
description: 'Set up Node.js'
runs:
  using: composite
  steps:
    - uses: pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4.3.0
    - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0
      with:
        node-version-file: .node-version
        cache: pnpm
    - run: cp ./.env.sample ./.env
      shell: bash
    - run: npm run setup
      shell: bash
    - run: pnpm i && pnpm rebuild
      shell: bash
```

If the repo uses `npm run setup`, also check what that script does in `package.json`.

One good pattern is using it to run `corepack enable` so the expected package manager can be activated consistently before install steps.

Do not require this exact script sequence, but prefer the same intent:

- Node version comes from `.node-version`
- package manager activation is explicit, for example via `corepack enable`
- pnpm setup is shared
- dependency cache is enabled
- local bootstrap steps are reusable across workflows
- env bootstrap from `.env.sample` is explicit when the project expects it

### 4. Unused-code detection with Knip

Check whether `knip` is installed and exposed through scripts or tooling.

Then inspect whether a config file such as `knip.config.ts` exists and is intentionally configured instead of left at defaults.

Prefer a config shape along these lines:

```ts
import type { KnipConfig } from 'knip';

const config: KnipConfig = {
	ignore: ['.internal/**', 'tests/build.mjs', 'prisma.config.ts'],
	playwright: {
		config: ['playwright.config.ts'],
		entry: ['e2e/**/*.ts'],
	},
	vitest: {
		entry: ['src/**/*.test.ts'],
	},
	ignoreDependencies: ['postcss', 'tailwindcss'],
	ignoreBinaries: ['stripe'],
};

export default config;
```

Do not require this exact file verbatim, but verify the project covers the same intent:

- known false positives are ignored deliberately
- Playwright entrypoints are declared when Playwright exists
- Vitest entrypoints are declared when Vitest exists
- noisy dependency and binary false positives are handled

### 5. Environment validation

Check whether environment variables are validated with code, ideally via `zod`, rather than relied on implicitly.

Look for a pattern like:

- `env.ts` or equivalent
- loading env early, for example with `@next/env`
- a schema for static/server/client env vars
- explicit process exit on invalid env

An expected pattern is:

```ts
import { loadEnvConfig } from '@next/env';
import { z } from 'zod';
```

Then a schema-driven validator that checks required variables and fails fast. Prefer a concrete shape along these lines:

```ts
import { loadEnvConfig } from '@next/env';
import { z } from 'zod';

const staticEnv = z.object({
	NODE_ENV: z
		.union([z.literal('development'), z.literal('test'), z.literal('production')])
		.default('development'),

	NEXT_PUBLIC_SITE_URL: z.url(),

	DATABASE_HOST: z.string().min(1),
	DATABASE_PORT: z.coerce.number().min(1),
	DATABASE_NAME: z.string().min(1),
	DATABASE_USER: z.string().min(1),
	DATABASE_PASSWORD: z.string().min(1),
});

const runtimeEnv = z.object({});

const schema = z.intersection(staticEnv, runtimeEnv);

export type Schema = z.infer<typeof schema>;

export function config(kind: 'static' | 'runtime' = 'static') {
	const { combinedEnv } = loadEnvConfig(process.cwd());
	const res =
		kind === 'static' ? staticEnv.safeParse(combinedEnv) : runtimeEnv.safeParse(combinedEnv);

	if (res.error) {
		console.error('\x1b[31m%s\x1b[0m', '[Errors] environment variables');
		console.error(JSON.stringify(res.error.issues, null, 2));
		process.exit(1);
	}
}
```

Do not require the exact providers or variable names, but verify the same mechanics:

- env is loaded explicitly before validation
- static env and runtime env are separated when needed
- representative required server envs and public envs are both covered
- coercion is used for numeric values such as ports
- optional values, if present in the project, are validated intentionally rather than skipped implicitly
- invalid env prints actionable errors and exits immediately

### 6. Environment documentation

Check whether `.env.sample` exists.

It should be aligned with the validated env schema so a new contributor can discover the required variables without reading scattered code.

### 7. Type-safe env access

Check whether global env typing is wired, for example via `src/globals.d.ts` extending `NodeJS.ProcessEnv` from the validated env schema.

An expected shape is:

```ts
import type { Schema } from '../../env';

declare global {
	namespace NodeJS {
		interface ProcessEnv extends Schema {}
	}

	type PartialWithNullable<T> = {
		[P in keyof T]?: T[P] | null;
	};
}
```

If env validation exists but typing does not, call that out as a smaller follow-up rather than a blocker.

### 8. Route Handler params typing

When the repo uses App Router Route Handlers, check whether route params are typed with the global `RouteContext<'/...'>` helper instead of hand-written context param types.

Prefer patterns like:

```ts
import type { NextRequest } from 'next/server';

export async function GET(_req: NextRequest, ctx: RouteContext<'/users/[id]'>) {
	const { id } = await ctx.params;
	return Response.json({ id });
}
```

If you find hand-written handler context types for route params, call out that they should be replaced with `RouteContext` when the project is on the relevant Next.js version and type generation is already part of `next dev`, `next build`, or `next typegen`.

### 9. `next.config.*` baseline

Check whether `next.config.ts` or `next.config.*` is present and intentionally configured rather than left almost empty.

Prefer a baseline like:

```ts
import type { NextConfig } from 'next';
import { config } from './env';

config();

const nextConfig: NextConfig = {
	poweredByHeader: false,
	async headers() {
		return [
			{
				source: '/(.*?)',
				headers: [
					{
						key: 'Strict-Transport-Security',
						value: 'max-age=63072000; includeSubDomains; preload',
					},
					{
						key: 'X-Frame-Options',
						value: 'DENY',
					},
					{
						key: 'X-DNS-Prefetch-Control',
						value: 'on',
					},
					{
						key: 'X-XSS-Protection',
						value: '1; mode=block',
					},
					{
						key: 'X-Content-Type-Options',
						value: 'nosniff',
					},
					{
						key: 'Referrer-Policy',
						value: 'strict-origin-when-cross-origin',
					},
				],
			},
		];
	},
	compiler: {
		removeConsole:
			process.env['NODE_ENV'] === 'production'
				? {
						exclude: ['error'],
					}
				: false,
	},
	logging: {
		fetches: {
			fullUrl: true,
		},
	},
	experimental: {
		authInterrupts: true,
	},
};

export default nextConfig;
```

Do not require this exact object shape, but verify the same intent:

- env validation is invoked before exporting the config
- `poweredByHeader` is disabled
- important security headers are set deliberately
- production console removal is configured intentionally
- fetch logging is enabled when it helps debugging
- experimental flags, if present, are intentional and understood

Explain the purpose of each setting when reporting:

- `config()`
  - validates env during config load so broken env is caught before boot or build continues
- `poweredByHeader: false`
  - removes the default `x-powered-by` header and slightly reduces unnecessary framework disclosure
- `headers()`
  - centralizes security-related response headers instead of relying on ad hoc per-route behavior
- `Strict-Transport-Security`
  - enforces HTTPS for supported browsers and should usually exist in production-facing services behind HTTPS
- `X-Frame-Options: DENY`
  - blocks clickjacking via framing unless the product explicitly needs embedding
- `X-DNS-Prefetch-Control: on`
  - allows DNS prefetch behavior to be explicit rather than accidental
- `X-XSS-Protection`
  - mostly legacy, so if present it should be a conscious compatibility choice rather than cargo cult
- `X-Content-Type-Options: nosniff`
  - prevents MIME sniffing and is a low-cost default hardening header
- `Referrer-Policy: strict-origin-when-cross-origin`
  - limits referrer leakage while keeping reasonable analytics/debugging behavior
- `compiler.removeConsole`
  - strips noisy console calls from production bundles while usually preserving `console.error`
- `logging.fetches.fullUrl`
  - makes fetch debugging easier during development and incident investigation; confirm the team wants the extra verbosity
- `experimental.authInterrupts`
  - should only be enabled when the team understands and intentionally uses the related Next.js capability

When the repo diverges from this baseline, explain whether the difference looks intentional, outdated, or simply missing.

### 10. Testing strategy

Check whether the repo has an intentional test strategy instead of only ad hoc unit tests.

Start with the surface area:

- `package.json` scripts such as `test`, `test:watch`, `test:e2e`, `test:coverage`
- Vitest configuration
- Playwright configuration
- CI execution of the intended test layers

If the repo uses a real database in tests, or the user asks for a deeper evaluation of testing quality, read `references/testing.md`.

Prefer repos that can:

- run unit/integration tests against a real isolated database
- run e2e tests in parallel without sharing one mutable database
- centralize DB/app test setup helpers instead of repeating per-suite boilerplate

### 11. Dependency choices

Check whether the repo depends on packages that this project should generally avoid by default.

If the user asks for dependency guidance, package review, or modernization opportunities, read `references/dependencies.md`.

Treat that file as a preference guide, not a list of npm-deprecated packages. The point is to prefer built-in APIs, open-code UI, or lighter modern tooling when they fit.

### 12. Dependency audit and Next.js security hygiene

Check whether the repo runs `pnpm audit` as part of dependency hygiene, either manually or in CI.

If the repo uses Next.js, prefer keeping it on the latest stable version. Read `references/dependencies.md` for the current upgrade path and recent Server Components / App Router security context.

### 13. Utility patterns

Check whether the repo has a small set of intentional shared utilities for common Next.js concerns instead of reimplementing them ad hoc across routes and server actions.

If the user asks for utility design, shared helper review, or examples of useful baseline utilities, read `references/utils.md`.

Prefer utilities that:

- encode one repeated rule clearly instead of becoming a generic dumping ground
- compose well with Route Handlers, server actions, and auth boundaries
- return explicit results for expected failures instead of throwing everywhere
- keep parsing and validation close to the edge of the request

## Output format

Use this structure unless the user asks for something else:

## Checklist result

- `package.json` `lint` / `fmt` scripts
- `.npmrc` / exact dependency pinning
- `pnpm-workspace.yaml` strictness
- `.node-version`
- reusable `.github/actions/setup-node`
- `knip` and `knip.config.*`
- env validation
- `.env.sample`
- env typing
- Route Handler `RouteContext`
- `next.config.*`
- testing strategy
- dependency choices
- `pnpm audit` / Next.js security hygiene
- utility patterns

For each item, mark one of:

- `OK`
- `Missing`
- `Partial`

## Priority findings

- `P0`: onboarding blockers or high-risk config gaps
- `P1`: important hygiene gaps that should be fixed soon
- `P2`: polish and consistency improvements

Only include priorities that are supported by evidence.

## Recommended next actions

- concrete fixes in priority order
- keep them small and implementation-ready

## Style

- Be concise and opinionated.
- Prefer file paths and exact missing keys.
- Do not drift into a general Next.js architecture review unless the user explicitly asks for that.
- Treat missing repo hygiene as the core finding, not a side note.
- For testing, keep the checklist in this file short and load `references/testing.md` only when the repo actually has non-trivial test infrastructure or the user asks for depth.
