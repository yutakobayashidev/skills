# Useful Next.js Utilities

Use this file when the user asks what shared utilities are worth having in a modern Next.js codebase, or when reviewing whether repeated server-side logic has been factored cleanly.

The goal is not to collect every helper in one folder. The goal is to keep a few repeated rules explicit, testable, and easy to reuse across Route Handlers, server actions, and auth-protected reads.

## What good looks like

Prefer utilities that:

- sit at the edge of the app where repetition actually happens
- encode one clear behavior each
- stay framework-aware without becoming framework-heavy
- return predictable shapes for expected failures
- compose with `zod`, `NextResponse`, and auth/session access naturally

Avoid a `utils/` folder that turns into a grab bag of unrelated helpers with no ownership boundary.

## Recommended reading order

1. `Result type`
2. `Session helper`
3. `URL helper`
4. `Route Handler composition`

## Result type

When server helpers can fail in expected ways, prefer returning an explicit `Result` union instead of throwing for every non-happy path.

Representative `types/result.ts`:

```ts
import type { ZodFlattenedError } from 'zod';

type SuccessResult<T> = {
	success: true;
	data: T;
	message?: string;
};

type FailureResult<T, U> = {
	success: false;
	message?: string;
	data?: U;
	zodErrors?: T extends Record<string, unknown> ? ZodFlattenedError<T>['fieldErrors'] : never;
};

/**
 * @typeParam T - data to be returned if successful
 * @typeParam U - validation error by zod
 * @typeParam P - data to be returned if failed
 */
export type Result<T = void, U = Record<string, unknown>, P = never> =
	| SuccessResult<T>
	| FailureResult<U, P>;
```

### Why it helps

- callers can branch on `success` without guessing about thrown exceptions
- validation errors can carry structured field errors
- auth and request-parsing helpers can share one failure shape

### What to check

- the result shape is small and consistent
- `success` is the discriminant
- validation failures can carry typed `zod` field errors when needed
- the project does not mix many incompatible `Result` shapes

## Session helper

Auth checks are easy to duplicate badly. Prefer one helper that wraps `auth()` and normalizes the “missing session” path.

Representative `utils/auth.ts`:

```ts
export async function getSessionOrReject(): Promise<Result<Session, void>> {
	try {
		const session = await auth();

		if (!session?.user?.id) {
			return {
				success: false,
				message: 'no session token',
			};
		}

		return {
			success: true,
			data: session,
		};
	} catch (error) {
		console.error('[getSessionOrReject] failed', error);
		return {
			success: false,
			message: 'no session token',
		};
	}
}
```

### Why it helps

- Route Handlers and server actions stop re-implementing session checks
- expected unauthenticated cases stay explicit
- unexpected auth failures can still be logged centrally

### What to check

- the helper returns a typed `Result` instead of throwing for normal unauthenticated requests
- the authenticated branch verifies `session.user.id`, not just `session`
- logging exists for genuinely unexpected failures
- the helper name matches behavior; if it does not throw, do not call that out as a bug, but note the naming mismatch

If the repo has many authenticated Route Handlers, a thin wrapper can also help.

Representative `withAuth` shape:

```ts
import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { getSessionOrReject } from '@/utils/auth';

type GuardContext = unknown;
type AuthenticatedRouteArgs<TContext extends GuardContext> = {
	actor: Session['user'];
	request: Request;
	ctx: TContext;
};

type AuthenticatedRouteHandler<TContext extends GuardContext> = (
	..._args: [AuthenticatedRouteArgs<TContext>]
) => Promise<Response>;

export function withAuth<TContext extends GuardContext>(
	handler: AuthenticatedRouteHandler<TContext>,
) {
	return async (request: Request, ctx: TContext) => {
		const session = await getSessionOrReject();
		const actor = session.success ? session.data.user : null;

		if (!actor) {
			return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
		}

		return handler({ actor, request, ctx });
	};
}
```

This is useful when many handlers share the same auth gate and `401` response shape, but keep it thin. Do not turn a small wrapper into a full internal framework unless the repo genuinely benefits from that extra structure.

## URL helper

Route Handlers often need one thin helper to convert `request.url` into a plain object before passing it into a schema.

Representative `utils/urls.ts`:

```ts
export function getSearchParams(url: string) {
	const params: Record<string, string> = {};

	new URL(url).searchParams.forEach((val, key) => {
		params[key] = val;
	});

	return params;
}
```

### Why it helps

- schemas can parse plain objects directly
- route code stays focused on validation and orchestration
- repeated `new URL(request.url)` boilerplate disappears

### What to check

- parsing logic is centralized instead of repeated across handlers
- the helper does not silently invent defaults that belong in the schema layer
- `zod` parsing still happens after extraction rather than inside a generic URL helper

## Route Handler composition

These helpers become more useful when the route keeps validation, auth, and data loading in a predictable order.

Representative shape:

```ts
const searchParamsSchema = z.object({
	q: z.string().optional(),
});

export const GET = withAuth(async ({ actor, request }) => {
	const { q } = searchParamsSchema.parse(getSearchParams(request.url));
	const items = await listItems({
		userId: actor.id,
		search: q,
	});

	return NextResponse.json({ items });
});
```

### Why it helps

- auth resolution stays near the top of the handler
- query parsing is explicit and schema-backed
- downstream loaders receive already-normalized inputs
- the handler reads as orchestration, not parsing glue

### What to check

- auth, parsing, and data loading happen in a deliberate order
- `zod` parses extracted search params close to the request edge
- helper usage shortens the handler instead of hiding important control flow
- utility names stay small and concrete instead of drifting toward a generic service layer

## Red flags

- `utils/` contains dozens of unrelated helpers with no conventions
- every route has its own session-check variant
- route code parses search params manually in many places
- helpers mix parsing, validation, DB access, and response formatting in one function
- expected auth failures rely on broad `try/catch` in every handler instead of one shared helper
