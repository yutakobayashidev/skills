# Testing Strategy

Use this file when the repo already has meaningful test infrastructure, uses a real database in tests, or the user explicitly wants a deeper review of test design.

The goal is not just “tests exist.” The goal is fast, isolated, trustworthy tests that work with real infrastructure where it matters.

## What good looks like

Prefer a layered strategy:

- unit and integration tests on Vitest
- e2e tests on Playwright
- real database tests when database behavior is part of correctness
- parallel execution without shared mutable state

If the repo mocks the database heavily, do not automatically call that wrong. But if the product logic depends on SQL constraints, transactions, Prisma queries, or auth/session persistence, prefer real-database coverage for those paths.

## Recommended reading order

This file is easiest to read in this order:

1. shared database test infrastructure
   - `Real DB integration tests with Testcontainers`
   - `Drizzle variant`
2. unit and integration test wiring
   - `Vitest pattern`
   - `Vitest configuration`
3. browser and end-to-end test wiring
   - `Suggested directory structure`
   - `Test users and setup project`
   - `Playwright configuration`
   - `CI workflow`
   - `Parallel Playwright with real DB`
   - `Authenticated user setup`
   - `Page object / model structure`
   - `Accessibility slice`

If the current order feels strange, follow this sequence instead. The implementation dependencies are closer to DB helper first, then Vitest, then Playwright/e2e.

## Real DB integration tests with Testcontainers

When the repo uses PostgreSQL with a real application database layer, a strong pattern is:

1. Start a disposable database container per suite or worker.
2. Bind Postgres to a dynamic host port.
3. Generate a per-run `DATABASE_URL`.
4. Run schema setup against that URL.
5. Instantiate the database client against the overridden URL.
6. Truncate between tests.
7. Tear everything down after the suite finishes.

### Port collision avoidance

If `compose.yml` is reused for tests, prefer making the database port overrideable:

```yaml
volumes:
  db-data:

services:
  db:
    image: postgres:17
    ports:
      - ${DATABASE_PORT:-5432}:5432
    environment:
      - POSTGRES_USER=${DATABASE_USER}
      - POSTGRES_PASSWORD=${DATABASE_PASSWORD}
      - POSTGRES_DB=${DATABASE_DB}
    # https://admin.alyfoods.com/blog/testcontainers-volume-mount-failure-debugging
    # volumes:
    #   - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready']
      interval: 1s
      timeout: 5s
      retries: 10
```

This allows normal development to keep `5432`, while tests can inject `DATABASE_PORT=0` or another dynamic port.

Prefer keeping the persistent volume commented out or otherwise disabled for the Testcontainers path when volume mounts are known to cause instability in disposable test environments.

The healthcheck matters because it gives the app and test harness a stronger readiness signal than “container started.”

### DB setup helper

Prefer a shared helper rather than duplicating setup in every suite.

Also prefer centralizing database URL construction in one helper instead of rebuilding connection strings ad hoc across tests and app code.

Representative shape:

```ts
export function createDBUrl({
	user = process.env.DATABASE_USER,
	password = process.env.DATABASE_PASSWORD,
	host = process.env.DATABASE_HOST,
	port = Number(process.env.DATABASE_PORT),
	db = process.env.DATABASE_DB,
	schema = process.env.DATABASE_SCHEMA,
}: {
	user?: string;
	password?: string;
	host?: string;
	port?: number;
	db?: string;
	schema?: string;
}) {
	return `postgresql://${user}:${password}@${host}:${port}/${db}?schema=${schema}`;
}
```

### What to check

- Compose or container setup supports dynamic port assignment.
- `healthcheck` exists and the test setup waits for actual readiness.
- DB URL construction is centralized instead of duplicated.
- The database client is created from the dynamic URL, not a default local URL.
- Schema setup runs against the dynamically created DB, not the developer DB.
- Cleanup is automatic.
- `truncate` is centralized and not copy-pasted across suites.

## Drizzle variant

If the repo uses Drizzle instead of Prisma, the same isolation pattern still applies:

1. start a disposable Postgres container
2. build a dynamic DB URL
3. run schema setup against that URL
4. construct a DB client against that URL
5. reset state between tests
6. tear everything down cleanly

Representative shape for a non-monorepo project:

```ts
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { type NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres';
import { reset } from 'drizzle-seed';
import { Pool } from 'pg';
import { DockerComposeEnvironment, Wait } from 'testcontainers';
import * as schema from './schema';
import { createDBUrl } from '@/utils/db';

const execAsync = promisify(exec);

export type Database = NodePgDatabase<typeof schema>;

export async function setupDB({ port }: { port: 'random' | number }) {
	const container = await new DockerComposeEnvironment('.', 'compose.yml')
		.withEnvironmentFile('.env.test')
		.withEnvironment({
			DATABASE_PORT: port === 'random' ? '0' : `${port}`,
		})
		.withWaitStrategy('db', Wait.forListeningPorts())
		.up(['db']);
	const dbContainer = container.getContainer('db-1');
	const mappedPort = dbContainer.getMappedPort(5432);
	const url = createDBUrl({
		host: dbContainer.getHost(),
		port: mappedPort,
	});

	await execAsync(`DATABASE_URL=${url} drizzle-kit push`);

	const pool = new Pool({ connectionString: url });
	const db = drizzle(pool, { schema });

	async function down() {
		await pool.end();
		await container.down();
	}

	return {
		url,
		container,
		port: mappedPort,
		db,
		truncate: () => truncate(db),
		down,
		async [Symbol.asyncDispose]() {
			await down();
		},
	} as const;
}

async function truncate(db: Database) {
	await reset(db, schema);
}
```

### What to check

- `drizzle-kit push` or the project's equivalent schema command runs against the dynamic `DATABASE_URL`
- `Pool` is created from the dynamic URL, not a default local URL
- `drizzle(...)` is built once per isolated DB instance
- cleanup closes the PG pool and tears down the container
- reset uses a centralized helper such as `drizzle-seed` `reset`

### Helper tests

If helpers like `createDBUrl` exist, prefer testing them directly.

Representative shape:

```ts
import { describe, expect, test } from 'vitest';
import { createDBUrl } from './db';

describe('utils/db', () => {
	describe('createDBUrl', () => {
		test('should create url by environment variables', () => {
			expect(createDBUrl({})).toMatchInlineSnapshot(
				`"postgresql://local:1234@localhost:5432/local?schema=public"`,
			);
		});

		test('should create url by params', () => {
			expect(
				createDBUrl({
					user: 'user',
					password: 'password',
					host: 'host',
					port: 5432,
					db: 'db',
					schema: 'schema',
				}),
			).toMatchInlineSnapshot(`"postgresql://user:password@host:5432/db?schema=schema"`);
		});
	});
});
```

This is small, but it matters. If the project relies on dynamic DB URLs for test isolation, bugs in that helper can invalidate the whole setup.

## Vitest pattern

For Vitest, prefer one helper that:

- hoists DB setup before imports that depend on Prisma
- mocks the app’s database client to the isolated test client
- truncates after each test
- shuts down after all tests

Prefer keeping these shared files under `tests/`, for example:

- `tests/db.setup.ts`
- `tests/vitest.helper.ts`
- `tests/vitest.setup.ts`

Representative shape:

```ts
import { afterAll, afterEach, vi } from 'vitest';

export async function setup() {
	const { db, truncate, down } = await vi.hoisted(async () => {
		const { setupDB } = await import('./db.setup');
		return await setupDB({ port: 'random' });
	});

	vi.mock('../_clients/db', () => ({
		db,
	}));

	afterAll(async () => {
		await down();
	});

	afterEach(async () => {
		await truncate();
	});

	return {
		db,
		truncate,
		down,
	} as const;
}
```

### What to check

- `vi.hoisted` is used when import timing requires it.
- The test client replaces the production database client cleanly.
- Per-test cleanup is `truncate`, not full process restart.
- Each suite has isolated DB state.

### Route Handler suite shape

For App Router Route Handlers, prefer testing the exported handler directly with `Request` objects instead of only going through browser tests.

Representative shape:

```ts
import { describe, expect, test } from 'vitest';
import { groups, groupMembers, groupQuestionPresets } from '@/db/schema';
import { setup } from '@/tests/vitest.helper';

// import after vitest helper setup when module state depends on mocks
import { GET } from './route';

const { db, createUser, mock } = await setup();

describe('api/items/new-data', () => {
	test('returns creatable groups and question presets', async () => {
		const actor = await createUser();
		const groupId = '01964444-b006-7006-8006-111111111111';

		await db.insert(groups).values({
			id: groupId,
			slug: 'sample-group',
			name: 'Sample Group',
			createdBy: actor.id,
		});

		await db.insert(groupMembers).values({
			userId: actor.id,
			groupId,
			role: 'owner',
		});

		await db.insert(groupQuestionPresets).values({
			id: '01964444-b006-7006-8006-222222222222',
			groupId,
			label: 'Experience',
			required: true,
			orderIndex: 0,
		});

		const res = await GET(new Request('http://localhost/api/items/new-data?group=sample-group'));

		expect(res.status).toBe(200);
		expect(await res.json()).toMatchInlineSnapshot(`
			{
			  "groupQuestionPresets": {
			    "sample-group": [
			      {
			        "label": "Experience",
			        "required": true,
			      },
			    ],
			  },
			  "groups": [
			    {
			      "name": "Sample Group",
			      "slug": "sample-group",
			    },
			  ],
			  "initialSlug": "sample-group",
			}
		`);
	});

	test('returns 403 when the actor has no creatable groups', async () => {
		const actor = await createUser();
		const groupId = '01964444-b006-7006-8006-333333333333';

		await db.insert(groups).values({
			id: groupId,
			slug: 'read-only-group',
			name: 'Read Only Group',
			createdBy: actor.id,
		});

		await db.insert(groupMembers).values({
			userId: actor.id,
			groupId,
			role: 'viewer',
		});

		const res = await GET(new Request('http://localhost/api/items/new-data'));

		expect(res.status).toBe(403);
		expect(await res.json()).toMatchInlineSnapshot(`
			{
			  "error": "NO_CREATABLE_GROUP",
			}
		`);
	});

	test('returns 401 when unauthenticated', async () => {
		mock.auth.mockReturnValue(null);

		const res = await GET(new Request('http://localhost/api/items/new-data'));

		expect(res.status).toBe(401);
		expect(await res.json()).toMatchInlineSnapshot(`
			{
			  "error": "UNAUTHENTICATED",
			}
		`);
	});
});
```

### What to check

- the handler is tested directly without spinning up the whole app
- authenticated, unauthorized, and domain-success cases are all covered
- DB setup uses the shared isolated test helper
- auth/session mocks are reset predictably between tests
- snapshots are used for stable response payloads when they improve readability

## Vitest configuration

Prefer a Vitest config that validates env on load and makes the test environment explicit.

Representative `package.json` scripts:

```json
{
	"test": "NODE_ENV=test vitest run",
	"test:watch": "NODE_ENV=test vitest watch",
	"test:e2e": "NODE_ENV=test playwright test",
	"test:e2e:ui": "pnpm test:e2e --ui"
}
```

This matters because `NODE_ENV=test` makes `.env.test` the expected source of truth during test execution in many Next.js projects.

Representative shape:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { config } from './env';

config();

export default defineConfig(async () => {
	return {
		plugins: [react()],
		resolve: {
			tsconfigPaths: true,
		},
		test: {
			globals: true,
			mockReset: true,
			restoreMocks: true,
			clearMocks: true,
			include: ['./src/**/*.test.{ts,tsx}'],
			globalSetup: './tests/vitest.setup.ts',
			environment: 'jsdom',
			server: {
				deps: {
					inline: ['next'],
				},
			},
		},
	};
});
```

### What to check

- `package.json` test scripts explicitly run with `NODE_ENV=test` when the project depends on env-based test config
- `config()` runs before exporting the Vitest config
- shared Vitest helpers live in stable paths such as `tests/vitest.helper.ts` and `tests/vitest.setup.ts`
- `globalSetup` exists when shared bootstrapping is needed
- `environment` is chosen intentionally (`jsdom` vs `node`)
- mock reset/restore behavior is explicit
- framework-specific dependency inlining is documented rather than mysterious

## `.env.test` strategy

Prefer a dedicated `.env.test` for test-only behavior and external integration neutralization.

Representative shape:

```dotenv
# Google OAuth
GOOGLE_CLIENT_ID=dummy
GOOGLE_CLIENT_SECRET=dummy

# NextAuth.js
NEXTAUTH_TEST_MODE=true

# start: stripe #
# Stripe
STRIPE_SECRET_KEY=dummy
STRIPE_WEBHOOK_SECRET=dummy
STRIPE_PRICE_ID=dummy
# end: stripe #
```

What matters:

- test runs should not trigger real external transactions
- OAuth, payments, and similar third-party integrations should be replaced with inert values in test mode
- `.env.test` should be loaded through the project’s normal env loading path instead of special-casing every test manually

### What to check

- `.env.test` exists when the project depends on environment-driven integrations
- external API credentials are replaced with safe dummy values in test mode
- test-only flags such as `NEXTAUTH_TEST_MODE=true` are explicit
- the project does not risk hitting real payment/auth providers during local or CI tests

## Suggested directory structure

When the repo has non-trivial e2e coverage, prefer an `e2e/` layout that separates helpers, fixtures/models, and test suites clearly.

Representative shape:

```text
apps/frontend/
└── e2e/
    ├── a11y/
    ├── helpers/
    │   ├── app.ts
    │   ├── drizzle.ts
    │   ├── getRandomPort.ts
    │   ├── users.ts
    │   └── waitForHealth.ts
    ├── integrations/
    │   ├── item.test.ts
    │   └── top-page.test.ts
    └── models/
        ├── Base.ts
        ├── ItemPage.ts
        ├── NotFoundPage.ts
        └── TopPage.ts
```

The exact names do not matter. The point is to avoid one flat `e2e/` directory where helpers, fixtures, and scenario tests blur together.

### What to check

- reusable process and DB helpers live under `helpers/`
- scenario or integration specs are grouped separately from support code
- page objects or models are separated from raw test cases
- accessibility-focused tests can live in their own slice when they have distinct tooling or assertions

## Test users and setup project

When the suite relies on authenticated users, prefer keeping deterministic test identities in one file and generating auth state in a Playwright setup project.

Representative `e2e/dummyUsers.ts`:

```ts
import type { User } from 'next-auth';

type RemoveNullish<T> = {
	[K in keyof T]-?: NonNullable<T[K]>;
};

type NonNullableUser = RemoveNullish<User>;

export const user1: NonNullableUser = {
	id: '11111111-1111-4111-8111-111111111111',
	name: 'user1',
	email: 'user1@test.invalid',
	image:
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAMElEQVR42u3OMQEAAAQAMDrpp4Zuyojh2RIsa7bjUQoICAgICAgICAgICAgICHwHDhv0ROEuXMGUAAAAAElFTkSuQmCC',
};

export const admin1: NonNullableUser = {
	id: '22222222-2222-4222-8222-222222222222',
	name: 'admin1',
	email: 'admin1@test.invalid',
	image:
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8qS5UDwAExgGj/3sspQAAAABJRU5ErkJggg==',
};
```

Representative `e2e/setup/auth.ts`:

```ts
import { test as setup } from '@playwright/test';
import { admin1, user1 } from '../dummyUsers';
import { createUserAuthState } from '../helpers/users';

setup('Create user1 auth', async ({ context }) => {
	await createUserAuthState(context, {
		user: user1,
	} as Parameters<typeof createUserAuthState>[1]);
});

setup('Create admin1 auth', async ({ context }) => {
	await createUserAuthState(context, {
		user: admin1,
	} as Parameters<typeof createUserAuthState>[1]);
});
```

### What to check

- test users are deterministic and easy to reference across specs
- regular users and privileged users are separated clearly
- auth state generation happens in setup, not ad hoc inside every test
- `.auth/*.json` outputs are treated as generated artifacts, not hand-maintained fixtures

## Playwright configuration

Prefer a Playwright config that:

- validates env on load
- uses a dedicated `setup` project
- runs actual browser projects after setup dependencies complete
- allows parallel execution when the DB/app isolation model supports it

Representative shape:

```ts
import { defineConfig, devices } from '@playwright/test';
import { config } from './env';

config();

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	projects: [
		{
			name: 'setup',
			testMatch: /.\/e2e\/setup\/.*.ts/,
		},
		{
			name: 'chrome',
			use: {
				...devices['Desktop Chrome'],
				headless: false,
				launchOptions: {
					args: [],
				},
			},
			dependencies: ['setup'],
		},
	],
});
```

### What to check

- `config()` runs before the config object is exported
- setup tasks are isolated under a dedicated Playwright project
- browser projects depend on setup explicitly
- `fullyParallel` is only enabled when worker isolation is actually safe
- headed/headless defaults look intentional for the team’s workflow

## CI workflow

If the repo already has `lint`, `fmt`, `test`, and `test:e2e`, prefer a CI workflow that runs those layers explicitly instead of hiding everything behind one opaque script.

Representative `github/workflows/ci.yml` for a single-repo Next.js project:

```yaml
name: ci

permissions:
  contents: read
  pull-requests: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

on:
  workflow_dispatch:
  pull_request:
    branches:
      - main
    types:
      - opened
      - reopened
      - synchronize
      - ready_for_review
    paths:
      - .github/workflows/ci.yml
      - package.json
      - src/**
      - e2e/**
  push:
    branches:
      - main
    paths:
      - .github/workflows/ci.yml
      - package.json
      - src/**
      - e2e/**

jobs:
  code-quality:
    name: Code Quality
    if: ${{ github.event_name != 'pull_request' || github.event.pull_request.draft == false }}
    runs-on: blacksmith-4vcpu-ubuntu-2404
    timeout-minutes: 10
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
        with:
          persist-credentials: false
      - uses: ./.github/actions/setup-node
      - run: pnpm lint
      - run: pnpm fmt

  unit-test:
    name: Unit Test
    if: ${{ github.event_name != 'pull_request' || github.event.pull_request.draft == false }}
    runs-on: blacksmith-4vcpu-ubuntu-2404
    timeout-minutes: 10
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
        with:
          persist-credentials: false
      - uses: ./.github/actions/setup-node
      - run: pnpm test

  e2e-test:
    name: E2E Test
    if: ${{ github.event_name != 'pull_request' || github.event.pull_request.draft == false }}
    runs-on: blacksmith-4vcpu-ubuntu-2404
    timeout-minutes: 10
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
        with:
          persist-credentials: false
      - uses: ./.github/actions/setup-node
      - uses: ./.github/actions/setup-db
      - run: pnpm exec playwright install chromium
      - run: pnpm build
      - run: pnpm test:e2e
```

If the repo is a monorepo, adapt commands with workspace filters or `pnpm --dir`. For a single repo, prefer the simpler direct commands.

When reviewing or changing these workflow files, also run the `gha-lint` skill so the workflow is checked with `actionlint`, `pinact`, `ghalint`, and `zizmor` rather than only reading YAML by eye.

Representative `.github/actions/setup-db/action.yml`:

```yaml
name: Setup DB
description: 'Set up Testcontainers'
runs:
  using: composite
  steps:
    - run: pnpm db:up && pnpm db:push
      shell: bash
```

Representative `package.json` script:

```json
{
	"scripts": {
		"db:up": "docker compose up -d db"
	}
}
```

### What to check

- workflow triggers are scoped intentionally with `paths`
- draft pull requests do not burn CI minutes unnecessarily
- permissions are explicit at workflow and job level
- Node bootstrap is centralized in `.github/actions/setup-node`
- DB bootstrap is centralized in `.github/actions/setup-db` when e2e depends on a real database
- code quality, unit tests, and e2e are separated into distinct jobs
- e2e installs the browser explicitly and builds before running
- single-repo workflows do not carry unnecessary `pnpm --dir` indirection
- custom runners are paired with `.github/actionlint.yaml` so workflow linting stays accurate
- workflow changes are reviewed with the `gha-lint` skill, not only by visual inspection

## Parallel Playwright with real DB

Playwright becomes slower and harder to isolate if every test hits the same app process and database.

A stronger pattern is:

1. Prepare authentication bypass for test mode when the real auth flow is impractical.
2. Pre-generate authenticated `storageState` files for test users.
3. Start one DB container per worker.
4. Start one app process per worker on its own port.
5. Reset DB and browser state after each test.
6. Tear down DB and app when the worker finishes.

### Test-mode auth

If the app uses NextAuth and OAuth is painful in e2e, a test-only JWT override can be reasonable:

```ts
export const config = {
	providers: [],
	callbacks: {
		session: ({ session }) => session,
	},
	...(process.env.NEXTAUTH_TEST_MODE === 'true' ? configForTest : {}),
};
```

This must be clearly test-only. Flag any version that could leak into production behavior.

### App startup per worker

Representative shape:

```ts
import { exec } from 'node:child_process';
import { getRandomPort } from './getRandomPort';
import { waitForHealth } from './waitForHealth';

export async function setupApp(dbPort: number) {
	const appPort = await getRandomPort();
	const baseURL = `http://localhost:${appPort}`;
	const cp = exec(`NEXTAUTH_URL=${baseURL} DATABASE_PORT=${dbPort} pnpm start --port ${appPort}`);
	await waitForHealth(baseURL);

	return {
		appPort,
		baseURL,
		async [Symbol.asyncDispose]() {
			if (cp.pid) process.kill(cp.pid);
		},
	} as const;
}
```

Helper examples:

```ts
import { createServer } from 'node:http';

export async function getRandomPort() {
	return new Promise<number>((resolve) => {
		const server = createServer();

		server.listen(0, () => {
			const address = server.address();
			const port = address && typeof address === 'object' ? address.port : null;

			if (port) {
				server.close();
				resolve(port);
			}
		});
	});
}
```

```ts
import { setTimeout } from 'node:timers/promises';

export async function waitForHealth(baseUrl: string) {
	const maxAttempts = 120;
	const interval = 500;
	const healthUrl = `${baseUrl}/api/health`;
	let attempts = 0;

	while (attempts < maxAttempts) {
		try {
			const response = await fetch(healthUrl);

			if (response.ok) {
				const data = await response.json();

				if (data.status === 'ok') {
					return;
				}
			}
		} catch {}

		attempts++;
		if (attempts % 10 === 0) {
			console.error(`[e2e] waiting for health: ${healthUrl} (${attempts}/${maxAttempts})`);
		}
		await setTimeout(interval);
	}

	throw new Error(`Server health check failed for ${healthUrl} after ${maxAttempts} attempts`);
}
```

### Worker-scoped fixtures

Prefer Playwright fixtures that own DB and app lifecycle per worker:

```ts
import { test as base } from '@playwright/test';
import { setupDB } from '../tests/db.setup';
import { setupApp } from './helpers/app';

export const test = base.extend({
	setup: [
		async ({ browser }, use) => {
			await using dbSetup = await setupDB({ port: 'random' });
			await using appSetup = await setupApp(dbSetup.port);
			const baseURL = appSetup.baseURL;
			const originalNewContext = browser.newContext.bind(browser);

			browser.newContext = async () => {
				return originalNewContext({ baseURL });
			};

			await use({
				db: dbSetup.db,
				appPort: appSetup.appPort,
				baseURL,
				dbURL: dbSetup.url,
			});
		},
		{
			scope: 'worker',
			auto: true,
		},
	],
});
```

### What to check

- The app is not shared across all workers on one fixed port.
- The DB is not shared across all workers.
- `baseURL` is worker-local.
- Health checks exist before tests start.
- Teardown happens even on failure.

## Authenticated user setup

If the suite uses authenticated users, prefer:

- prebuilt `storageState` files
- helpers that register users directly into the isolated DB
- per-test reset of DB state and cookies

This avoids repeating UI login flows and keeps e2e throughput high.

Representative helper shape:

```ts
import type { BrowserContext, TestType } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { User } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import { users } from '@/db/schema';
import type { TestFixtures, WorkerFixtures } from '../fixtures';
import { generateDrizzleClient } from './drizzle';

export async function registerUserToDB(user: User, dbUrl: string) {
	await using db = await generateDrizzleClient(dbUrl);
	await db.db.insert(users).values({
		id: user.id ?? '',
		email: user.email,
		name: user.name,
		handle: user.id ?? '',
		avatarUrl: user.image,
	});
}

export async function createUserAuthState(context: BrowserContext, jwt: JWT) {
	const storageStatePath = getStorageStatePath(jwt.user.id ?? '');

	await context.addCookies([
		{
			name: 'authjs.session-token',
			value: btoa(
				JSON.stringify({
					...jwt,
					sub: jwt.user.id,
				}),
			),
			domain: 'localhost',
			path: '/',
			httpOnly: true,
			sameSite: 'Lax',
			expires: Math.round((Date.now() + 60 * 60 * 24 * 1000 * 7) / 1000),
		},
	]);
	await mkdir(dirname(storageStatePath), { recursive: true });
	await context.storageState({
		path: storageStatePath,
	});
}

export async function useUser<T extends TestType<TestFixtures, WorkerFixtures>>(
	test: T,
	user: User,
) {
	test.use({ storageState: getStorageStatePath(user.id) });
	test.beforeEach(async ({ registerToDB }) => {
		await registerToDB(user);
	});
}

function getStorageStatePath(id: string) {
	return `e2e/.auth/${id}.json`;
}
```

Representative Drizzle helper shape:

```ts
import { Pool } from 'pg';
import * as schema from '@/db/schema';
import { drizzle } from 'drizzle-orm/node-postgres';

export async function generateDrizzleClient(url: string) {
	const pool = new Pool({ connectionString: url });
	const db = drizzle(pool, { schema });

	return {
		db,
		async [Symbol.asyncDispose]() {
			await pool.end();
		},
	} as const;
}
```

### What to check

- storage state is generated once and reused instead of redoing login flows everywhere
- user registration goes straight into the isolated DB for speed and determinism
- cookie/session generation is clearly test-only
- Drizzle helpers close their PG pool reliably
- `useUser` is applied before page creation at the correct test scope
- framework-specific cookie names or token shapes are fine, but keep the helper surface generic and easy to swap

## Page object / model structure

When the repo uses Playwright heavily, prefer page objects or models over repeating raw locators in each spec.

A good pattern is:

1. define a shared `Base` model for common layout and auth-aware UI
2. extend that base for page-specific models
3. keep scenario logic in `integrations/*.test.ts`

### Base model

Representative shape:

```ts
import { expect, type Locator, type Page } from '@playwright/test';
import type { User } from 'next-auth';

export class Base {
	page: Page;
	headerLocator: Locator;
	headerButtonSignInLocator: Locator;
	headerButtonSignOutLocator: Locator;

	constructor(page: Page) {
		this.page = page;
		this.headerLocator = this.page.locator('header');
		this.headerButtonSignInLocator = this.headerLocator.getByRole('button', {
			name: 'Sign in',
		});
		this.headerButtonSignOutLocator = this.headerLocator.getByRole('button', {
			name: 'Sign out',
		});
	}

	async expectHeaderUI(state: 'signIn' | 'signOut', user?: User) {
		if (state === 'signIn') {
			await expect(this.headerButtonSignInLocator).not.toBeVisible();
			await expect(this.headerButtonSignOutLocator).toBeVisible();
		}

		if (state === 'signOut') {
			await expect(this.headerButtonSignInLocator).toBeVisible();
			await expect(this.headerButtonSignOutLocator).not.toBeVisible();
		}
	}
}
```

### Page-specific model

Representative shape:

```ts
import { expect, type Locator, type Page } from '@playwright/test';
import { Base } from './Base';

export class TopPage extends Base {
	titleLocator: Locator;
	addButtonLocator: Locator;

	constructor(page: Page) {
		super(page);

		this.titleLocator = this.page.getByRole('heading', {
			name: 'Items',
		});
		this.addButtonLocator = this.page.getByRole('button', {
			name: 'Add item',
		});
	}

	async goTo() {
		return await this.page.goto('/');
	}

	async expectUI() {
		await expect(this.titleLocator).toBeVisible();
		await expect(this.addButtonLocator).toBeVisible();
	}
}
```

### Integration spec shape

Representative shape:

```ts
import { user1 } from '../dummyUsers';
import { test } from '../fixtures';
import { useUser } from '../helpers/users';

test.describe('top page', () => {
	useUser(test, user1);

	test.beforeEach(async ({ topPage }) => {
		await topPage.goTo();
		await topPage.expectHeaderUI('signIn', user1);
		await topPage.expectUI();
	});

	test('shows the signed-in top page', async ({ topPage }) => {
		await topPage.expectHeaderUI('signIn', user1);
		await topPage.expectUI();
	});
});
```

### What to check

- common auth-related expectations are centralized in a base model
- page-specific assertions stay in page-specific models
- specs read like scenarios, not selector scripts
- fixtures inject ready-to-use models instead of constructing them ad hoc in each test
- auth helpers such as `useUser` are applied at the right scope before page creation

## Accessibility slice

If the repo has meaningful UI coverage, prefer keeping accessibility checks in a dedicated `a11y/` slice instead of mixing them into every integration spec.

Representative fixture shape:

```ts
import AxeBuilder from '@axe-core/playwright';

a11y: async ({ page }, use) => {
	const makeAxeBuilder = () =>
		new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
			.disableRules(['meta-viewport']);

	await use(makeAxeBuilder);
},
```

Representative spec shape:

```ts
import { expect } from '@playwright/test';
import { user1 } from '../dummyUsers';
import { test } from '../fixtures';
import { useUser } from '../helpers/users';

test.describe('Top Page', () => {
	test.describe('not signed in', () => {
		test('should not have any automatically detectable accessibility issues', async ({
			topPage,
			a11y,
		}) => {
			await topPage.goTo();

			const res = await a11y().analyze();

			expect(res.violations).toEqual([]);
		});
	});

	test.describe('signed in', () => {
		useUser(test, user1);

		test('should not have any automatically detectable accessibility issues', async ({
			topPage,
			a11y,
		}) => {
			await topPage.goTo();
			await topPage.expectUI();

			const res = await a11y().analyze();

			expect(res.violations).toEqual([]);
		});
	});
});
```

### What to check

- axe-based checks are easy to run through a shared fixture
- signed-in and signed-out states are both covered when the UI meaningfully differs
- disabled rules are intentional and documented, not cargo-culted
- accessibility assertions stay focused on auto-detectable violations, with broader UX checks handled elsewhere

## Red flags

Mark these as `Missing` or `P1/P0` depending on severity:

- tests use a shared developer database
- fixed DB port with parallel workers
- fixed app port with parallel workers
- no cleanup between tests
- schema setup runs against the wrong database
- auth bypass is not gated tightly to test mode
- the database client still points at the default datasource
- container/app teardown is manual or flaky

## Reporting guidance

When reviewing a repo, summarize testing with these questions:

- Are unit/integration/e2e layers clearly separated?
- Does real DB testing exist where it matters?
- Can Vitest run in parallel safely?
- Can Playwright run in parallel safely?
- Is auth setup pragmatic but still contained to test mode?
- Are setup, reset, and teardown centralized in reusable helpers?

Keep the final report short. The detailed mechanics should stay in this file, not in `SKILL.md`.

## Sample design guidance

Keep the sample app and POM examples intentionally generic and small.

Prefer:

- `TopPage`, `ItemPage`, `NotFoundPage`
- `item.test.ts`, `top-page.test.ts`
- generic import paths like `@/db/schema`
- one short scenario per example

Avoid domain-heavy naming unless the domain itself is what the skill is teaching.

## Additional references

- hiroppy: Testcontainers parallel tests
  https://hiroppy.me/blog/posts/testcontainers-parallel-tests
- hiroppy: Isolated e2e
  https://hiroppy.me/blog/posts/isolated-e2e
