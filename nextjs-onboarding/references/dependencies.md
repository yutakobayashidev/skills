# Dependency Choices

Use this file when the user asks about package selection, modernization, dependency cleanup, or “what should we stop using by default?”.

This is a preference guide, not a literal npm deprecation list. Several packages here are still maintained. The point is to prefer standard APIs, open-code UI patterns, or lighter modern tooling when they fit the project.

## Preferred replacements

| Avoid by default                   | Prefer                                       | Why                                                                                                                                                                   |
| ---------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm` / `yarn`                     | `pnpm`                                       | Prefer stronger workspace ergonomics, overrides, and supply-chain-oriented settings like `minimumReleaseAge`.                                                         |
| `pnpm` without checks              | `pnpm` + `pnpm audit` + `sherif`             | Prefer explicit dependency-audit and monorepo-drift checks instead of trusting package-manager defaults alone.                                                        |
| stale `next`                       | latest stable `next`                         | Prefer current stable Next.js because App Router / RSC security advisories keep landing.                                                                              |
| `tsup`                             | `tsdown`                                     | Prefer the newer Rolldown-based bundler when starting fresh, especially if a smooth migration path from tsup matters.                                                 |
| `jest` / `mocha`                   | `vitest`                                     | Prefer faster Vite-native test workflows and a smoother path to browser mode.                                                                                         |
| `cypress`                          | `playwright` or `vitest` browser mode        | Prefer Playwright for broad e2e/browser automation, or Vitest browser mode when the need is browser-native component/integration testing rather than full e2e.        |
| manual URL search param state sync | `nuqs`                                       | Prefer type-safe query state with a `useState`-like API when Next.js UI state needs to live in the URL without ad hoc parser/serializer plumbing.                     |
| `axios`                            | `fetch`                                      | Prefer the platform standard when browser and Node already provide it. Fewer dependencies and less wrapper code.                                                      |
| `dayjs`                            | `Temporal` / polyfill first, then `date-fns` | Prefer the emerging standard date/time model first; if that is not practical, prefer pure modular utilities with strong TypeScript support.                           |
| `lodash`                           | `es-toolkit` or remove entirely              | Prefer native JS first; if helpers are still needed, prefer a modern utility library with smaller footprint and a Lodash compatibility path.                          |
| `remark` / `remark-parse`          | `micromark`                                  | If the task is mainly markdown parsing/rendering rather than AST transforms, prefer the lower-level parser the unified ecosystem itself recommends for that use case. |
| `@chakra-ui/react`                 | `shadcn/ui`                                  | Prefer open-code components you own and edit directly instead of a large packaged component library by default.                                                       |

## Guidance by package

## Platform and security first

## `npm` / `yarn` -> `pnpm`

Prefer `pnpm` by default.

What matters:

- stronger workspace ergonomics
- reliable overrides support
- supply-chain-oriented settings such as `minimumReleaseAge`
- strong monorepo support

In monorepos, pair `pnpm` with `sherif`.

## `pnpm audit`

Prefer running `pnpm audit` as part of dependency hygiene.

What matters:

- `pnpm audit` checks installed packages for known security issues
- `pnpm audit --fix` can add overrides for vulnerable transitive ranges
- `pnpm.auditConfig.ignoreCves` exists when a vulnerability is known and intentionally tolerated

Do not treat `pnpm audit` as the only security control, but do treat “never audited” as a smell.

## Monorepo check: `sherif`

If the repo is a monorepo, prefer `sherif`.

What matters:

- `sherif` describes itself as an opinionated, zero-config monorepo linter
- it is specifically aimed at dependency/version consistency and monorepo DX
- it can catch drift that package-manager settings alone do not surface clearly

Typical usage:

```bash
pnpm dlx sherif@latest
```

Prefer running it in CI once the repo is clean enough to enforce it.

## Next.js security and upgrade hygiene

If the repo uses Next.js, prefer keeping it on the latest stable version.

This is not generic upgrade churn. Next.js has had multiple recent advisories affecting Server Components / App Router behavior, including:

- CVE-2025-55182: RCE in React Server Components, affecting Next.js versions that used the vulnerable React packages
- CVE-2025-67779: Denial of Service with Server Components, incomplete fix follow-up
- CVE-2026-23869: Denial of Service with Server Components
- CVE-2025-49005: cache poisoning that could cause RSC payloads to be cached and served in place of HTML under specific conditions

So the default review rule should be:

- if the repo is behind stable Next.js patches/minors, ask why
- if the repo uses App Router / Server Components heavily, bias toward current stable versions
- check advisories before deciding an old version is acceptable

Official upgrade guidance currently says:

- use `pnpm next upgrade`
- versions before Next.js 16.1.0 need `npx @next/codemod@canary upgrade latest`
- manual upgrade path:

```bash
pnpm i next@latest react@latest react-dom@latest eslint-config-next@latest
```

## Renovate / Dependabot

Prefer having an automated dependency update bot instead of relying only on manual upgrades.

For JavaScript/TypeScript repos, Renovate is the stronger default when the team wants fine-grained grouping, automerge policy, pinning strategy, and update hygiene in one place.

Representative `renovate.json`:

```json
{
	"$schema": "https://docs.renovatebot.com/renovate-schema.json",
	"extends": [
		"config:recommended",
		":semanticCommitTypeAll(chore)",
		":enableVulnerabilityAlerts",
		":separateMajorReleases",
		"group:definitelyTyped",
		"group:monorepos",
		"group:test"
	],
	"rangeStrategy": "pin",
	"labels": ["deps"],
	"packageRules": [
		{
			"groupName": "npm patch dependencies",
			"matchManagers": ["npm"],
			"matchUpdateTypes": ["patch"],
			"matchDepTypes": ["dependencies", "devDependencies", "peerDependencies"],
			"matchPackageNames": ["*"],
			"automerge": true
		},
		{
			"groupName": "npm minor dependencies",
			"matchManagers": ["npm"],
			"matchUpdateTypes": ["minor"],
			"matchDepTypes": ["dependencies", "devDependencies", "peerDependencies"],
			"matchPackageNames": ["*"]
		},
		{
			"groupName": "npm @types",
			"matchManagers": ["npm"],
			"matchPackageNames": ["@types/{/,}**"],
			"automerge": true,
			"major": {
				"automerge": false
			}
		},
		{
			"groupName": "linter deps",
			"matchManagers": ["npm"],
			"matchPackageNames": ["/^@biomejs/", "/^prettier/"],
			"extends": ["packages:linters"],
			"automerge": true,
			"major": {
				"automerge": false
			}
		},
		{
			"matchManagers": ["npm"],
			"groupName": "opentelemetry",
			"automerge": true,
			"major": {
				"automerge": false
			},
			"matchPackageNames": ["/^@opentelemetry/*/"]
		},
		{
			"matchManagers": ["npm"],
			"groupName": "prisma",
			"matchUpdateTypes": ["patch", "minor", "major"],
			"automerge": true,
			"major": {
				"automerge": false
			},
			"matchPackageNames": ["/^@prisma/*/", "prisma"]
		}
	],
	"ignoreDeps": []
}
```

What to check:

- the repo uses an update bot at all
- update ranges are pinned or otherwise intentionally controlled
- vulnerability alerts are enabled
- major updates are separated from patch/minor noise
- low-risk groups such as patch updates or `@types` are considered for automerge
- important ecosystems such as linters, observability, ORM packages, or monorepo packages are grouped intentionally

Dependabot is still a reasonable choice when the team wants a simpler built-in GitHub workflow. But if the repo needs opinionated grouping and automerge policy like the above, prefer Renovate.

## Tooling and test stack

## `tsup` -> `tsdown`

Prefer `tsdown` for new library bundling work unless the project already has stable `tsup` conventions and no migration pressure.

What matters:

- `tsdown` positions itself as a modern bundler powered by Rolldown
- it documents compatibility with tsup's main options and features
- it provides an explicit migration command

So the default should be:

- existing stable `tsup` setup: keep unless there is a reason to change
- new setup or active modernization: prefer `tsdown`

## `jest` / `mocha` -> `vitest`

Prefer `vitest` for new TypeScript/Next.js app work.

What matters:

- Vite-native workflow
- fast local feedback
- easy mocking/story around ESM-heavy projects
- direct path to browser mode when needed

Jest or Mocha can stay if the repo is already deeply invested, but the default for new code should be Vitest.

## `cypress` -> `playwright` or `vitest` browser mode

Prefer `playwright` for full browser automation and end-to-end testing.

Prefer Vitest browser mode when the goal is browser-native test execution for components or integration-style tests rather than full e2e.

What matters:

- Vitest recommends Playwright as the browser provider path when you want robust browser execution and CI support
- Playwright is the stronger default for multi-page flows, fixtures, auth state, and parallel worker orchestration
- Vitest browser mode is useful when you want tests to stay close to the unit/integration stack while still running in a real browser

## Runtime and library choices

## manual URL search param state sync -> `nuqs`

Prefer `nuqs` when a Next.js app intentionally stores interactive UI state in the URL.

What matters:

- `nuqs` provides type-safe parsers and serializers for search params
- it keeps a familiar `useState`-like API instead of scattering `URLSearchParams` plumbing across components
- it supports Next.js App Router and Pages Router, including server-side parsing patterns
- it keeps URL-backed state ergonomic without inventing project-local wrappers too early

Do not force `nuqs` everywhere. If the page only reads one or two params once on the server, plain `searchParams` handling can stay simpler. Prefer `nuqs` when the app has real client-side query state that needs to round-trip cleanly between URL, components, and sometimes server rendering.

## `axios` -> `fetch`

Prefer `fetch` unless the project has a concrete need for Axios-specific features.

Default reasons:

- Node now ships a stable, browser-compatible global `fetch`
- browsers already provide `fetch`
- fewer dependencies and fewer adapter choices
- shared mental model across frontend, backend, tests, and Route Handlers

Axios is still reasonable if the repo truly depends on its interceptors, request/response transforms, or existing instance/middleware architecture. But the burden of proof should be on keeping it, not adding it.

## `dayjs` -> `Temporal` / polyfill first, then `date-fns`

Prefer checking whether `Temporal` can solve the problem first.

If the runtime does not provide `Temporal` yet, consider a supported polyfill path. If `Temporal` is still not practical for the project, prefer `date-fns` for new code.

What matters:

- `Temporal` is the TC39 date/time direction and already at Stage 3
- there is an official polyfill ecosystem around it
- modular function-based API
- pure and immutable operations
- native `Date` usage instead of wrapper instances
- modern TypeScript support
- first-class time zone support in v4

Suggested order:

1. native `Temporal` if the target runtime supports it
2. `@js-temporal/polyfill` or another appropriate Temporal polyfill if the project benefits from the Temporal model
3. `date-fns` if the team wants simpler incremental adoption or function-style helpers around `Date`

This is not because `dayjs` is formally deprecated. It is a project preference toward the standard Temporal model first, and then function-based date utilities with strong tree-shaking and timezone support.

## `lodash` -> `es-toolkit` or remove

Prefer removing the helper entirely if modern JavaScript already covers the need.

If a utility library is still justified, prefer `es-toolkit`.

What matters:

- `es-toolkit` positions itself as a seamless Lodash replacement
- it documents smaller bundle size
- it documents modern implementation and strong types

For small one-off helpers, prefer no dependency at all.

## `remark` / `remark-parse` -> `micromark`

Use `remark` when the project actually needs unified plugins and markdown AST transforms.

Use `micromark` when the main job is parsing markdown or turning markdown into HTML.

What matters:

- unified’s own `remark-parse` docs say to prefer `micromark` when you just want HTML
- `micromark` is the lower-level parser underneath much of the ecosystem
- it is smaller and closer to the parsing problem itself

So the rule is:

- parsing/rendering focused work: `micromark`
- plugin/AST transformation workflows: `remark`

## `@chakra-ui/react` -> `shadcn/ui`

Prefer `shadcn/ui` for new app-level UI work when the team wants component ownership and easy customization.

What matters:

- `shadcn/ui` is explicitly “not a component library”; it is a code distribution approach
- the component code is open and intended to be modified directly
- this reduces wrapper layers and design-system lock-in
- it tends to work better with local customization and AI/codegen workflows

Chakra UI is still actively maintained and not “bad”. This preference is about owning the UI code by default, not about Chakra being obsolete.

## How to review a repo

When reviewing dependencies, classify each one like this:

- `Keep`: there is a clear reason and the project is already shaped around it
- `Avoid in new code`: existing use can remain, but do not spread it further
- `Replace`: the project should actively migrate away

Do not recommend churn just for ideology. Prefer replacements when at least one of these is true:

- the platform now provides the capability
- the replacement reduces dependency surface significantly
- the replacement improves code ownership and customization
- the replacement matches the actual use case more directly

## Source notes

These preferences are based on a mix of official package documentation and ecosystem inference.

- `fetch`: Node.js documents `fetch` as a stable, browser-compatible global.
- `nuqs`: the project documents type-safe search param state for Next.js and other React routers, plus server/client integration patterns.
- `axios`: Axios documents itself as a separate HTTP client with its own API/features, which is why it should only be kept when those features are actually needed.
- `Temporal`: TC39 documents Temporal as the standard direction for working with dates and times, and the official ecosystem points to production polyfills.
- `date-fns`: the project documents modularity, pure functions, TypeScript support, and first-class time zone support.
- `es-toolkit`: the project documents smaller bundle size, Lodash compatibility, modern implementation, and strong types.
- `shadcn/ui`: the project explicitly describes itself as open code rather than a traditional component library.
- `remark-parse`: unified explicitly recommends `micromark` when the goal is turning markdown into HTML rather than plugin-driven transforms.
- `tsdown`: the project documents tsup compatibility plus a migration command.
- `sherif`: the package describes itself as a zero-config monorepo linter.
- `vitest` browser mode: Vitest recommends Playwright when you want robust browser execution in CI.
- `Next.js`: official docs define the current upgrade commands, and GitHub advisories document repeated Server Components / App Router vulnerabilities.
- `pnpm`: official docs and homepage material emphasize workspace support and security-oriented settings such as `minimumReleaseAge`.

## Primary sources

- Node.js globals / `fetch`: https://nodejs.org/api/globals.html
- nuqs docs: https://nuqs.dev/
- Temporal proposal: https://github.com/tc39/proposal-temporal
- Temporal polyfill: https://github.com/js-temporal/temporal-polyfill
- Axios docs: https://axios-http.com/docs/intro
- date-fns: https://github.com/date-fns/date-fns
- es-toolkit: https://es-toolkit.dev/
- tsdown: https://github.com/rolldown/tsdown
- sherif: https://www.npmjs.com/package/sherif
- pnpm: https://pnpm.io/
- pnpm audit: https://pnpm.io/cli/audit
- Vitest browser mode: https://main.vitest.dev/guide/browser/
- Next.js upgrading: https://nextjs.org/docs/app/getting-started/upgrading
- Next.js advisories: https://github.com/vercel/next.js/security/advisories
- shadcn/ui: https://ui.shadcn.com/docs
- Chakra UI: https://chakra-ui.com/docs/components/concepts/overview
- remark-parse: https://unifiedjs.com/explore/package/remark-parse/
- micromark: https://unifiedjs.com/explore/package/micromark/
