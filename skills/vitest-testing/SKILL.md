---
name: vitest-testing
description: Write or review Vitest tests with clear behaviour-focused assertions, appropriate globals/imports, file snapshots for terminal output, and readable fixture setup. Use when adding tests, fixing Vitest failures, or improving TypeScript test quality.
---

# Vitest Testing

This skill covers Vitest-specific test shape and review rules.

## Setup

- Check `vitest.config.*` before assuming globals are enabled.
- If globals are enabled, use `describe`, `it`, `expect`, `vi`, and `beforeEach` directly without importing them.
- If globals are not enabled, import only the Vitest APIs used by the file.
- Avoid `await import()` and other dynamic imports in tests unless the behaviour under test is dynamic loading.
- Use `vi.stubEnv()` instead of mutating `process.env` directly.
- Use `.invalid` domains for dummy URLs that should never resolve, such as `https://service-under-test.invalid/path`, instead of real hosts like `example.com`; RFC 6761 reserves `.invalid` for names that return NXDOMAIN.

## Linting

- Choose at least one Vitest-aware linter configuration and make it mandatory in the project. The point is to catch invalid test shapes early, especially focused tests, conditional assertions, and misplaced hoisted APIs.
- Prefer ESLint with `@vitest/eslint-plugin` when the repo already uses ESLint. It has the deepest Vitest coverage and is the default recommendation.
- Use Oxlint when the repo wants faster linting and already relies on Oxlint plugins. Its Vitest coverage is strong, but narrower than ESLint.
- Use Biome only when the repo is standardized on Biome and can accept lighter Vitest-specific coverage. Its test-domain rules help, but it is not the best primary Vitest guardrail.

Recommended default with ESLint:

```js
// eslint.config.js
import { defineConfig } from "eslint/config";
import vitest from "@vitest/eslint-plugin";

export default defineConfig({
  files: ["**/*.{test,spec}.{ts,tsx,js,jsx}"],
  plugins: { vitest },
  rules: {
    ...vitest.configs.recommended.rules,

    "vitest/no-focused-tests": "error",
    "vitest/no-disabled-tests": "warn",
    "vitest/no-conditional-expect": "error",
    "vitest/no-standalone-expect": "error",
    "vitest/expect-expect": "error",
    "vitest/hoisted-apis-on-top": "error",
    "vitest/consistent-test-it": ["warn", { fn: "test" }],
  },
});
```

Oxlint alternative:

```json
{
  "plugins": ["vitest"],
  "rules": {
    "vitest/no-focused-tests": "error",
    "vitest/no-disabled-tests": "warn",
    "vitest/no-conditional-expect": "error",
    "vitest/no-standalone-expect": "error",
    "vitest/expect-expect": "error",
    "vitest/hoisted-apis-on-top": "error"
  }
}
```

## Module Mocking

- `vi.mock()` is hoisted. Do not redefine the same module mock inside individual tests and expect later calls to win at runtime.
- When a mocked module's return value is the main input to the unit under test, define a shared mock with `vi.hoisted()` and update that mock per test with `mockReturnValue` or `mockImplementation`.
- Do not capture ordinary top-level variables inside a `vi.mock()` factory. If the factory needs a shared mock reference, create it with `vi.hoisted()`.
- Avoid `await import()` inside `vi.hoisted()` unless you must read another module before imports are initialized. Imported bindings are not available there yet, so this is the narrow exception to the normal "avoid dynamic import" rule.
- Use `vi.doMock()` only when you specifically need a non-hoisted mock for a later dynamic import.

## Readability

- Test one behaviour per `it`.
- Name tests after observable behaviour, not implementation details.
- Avoid `try`/`catch` for expected failures. Use `expect(...).toThrow()`, `await expect(...).rejects`, or explicit Result failure assertions.
- Avoid `if` branches inside test bodies. Split behaviours into separate tests or use `it.each` for table-driven cases.
- Do not over-DRY tests. Keep repeated setup inline when it makes the behaviour easier to read.
- Keep assertions in the test unless a helper name is clearer than the assertion it hides.
- Use `expect.assert` to make preconditions explicit and narrow nullable values instead of using non-null assertions.
- Do not `throw` inside test cases for ordinary control flow or missing fixtures. Prefer `expect.assert` and direct assertions so failures stay readable and consistent with the test runner.

## Output Tests

- Prefer JSON assertions for structured behaviour.
- Use file snapshots with `toMatchFileSnapshot` for human-readable CLI/table output so layout changes are reviewable.
- For `toMatchInlineSnapshot`, let Vitest generate the snapshot with `vitest run -u`; do not hand-write inline snapshot updates.
- For responsive terminal output, capture or set the terminal width used by the command.

## Schema Assertions

- Use `expect.schemaMatching()` for schema-backed object assertions when the matcher is available.
- Prefer it for direct structural checks against Zod schemas.
- Keep separate tests for valid and invalid cases when you need to inspect schema errors.

## Examples

Expected failure:

```ts
it("rejects invalid config", async () => {
  await expect(loadConfig("bad.json")).rejects.toThrow(Error);
});
```

Table-driven case:

```ts
it.each([
  ["daily", "2026-05-16"],
  ["monthly", "2026-05"],
])("groups %s rows by period", (reportType, expectedPeriod) => {
  const rows = groupUsage(reportType, usage);

  expect(rows[0]?.period).toBe(expectedPeriod);
});
```

Narrowing with `expect.assert`:

```ts
it("returns the first row", () => {
  const rows = getRows();
  const firstRow = rows[0];
  expect.assert.isDefined(firstRow, "expected at least one row");

  expect(firstRow.id).toBe("row-1");
});
```

Mocking a hook whose return value changes by test:

```ts
const useUserQuery = vi.hoisted(() =>
  vi.fn(() => ({
    data: { name: "John Doe" },
  })),
);

vi.mock("./use-user-query", () => ({
  useUserQuery,
}));

it("shows the loading state", () => {
  useUserQuery.mockReturnValue({
    data: undefined,
  });

  render(<UserProfile />);

  expect(screen.getByText("Loading...")).toBeInTheDocument();
});
```

Rare exception: reading another module inside `vi.hoisted()`:

```ts
const { value } = await vi.hoisted(async () => {
  return await import("./some/module.js");
});
```

Prefer moving that setup into the imported module itself when possible. Imports are already hoisted, so importing inside `vi.hoisted()` should stay exceptional.

Schema validation:

```ts
const fixtures: MeSchema[] = [
  {
    name: "John",
    email: "a@b.com",
    image: "https://a.com",
  },
];

for (const fixture of fixtures) {
  expect(fixture).toEqual(expect.schemaMatching(meSchema));
}
```

Invalid schema cases:

```ts
const base: MeSchema = {
  name: "a",
  email: "a@b.com",
  image: "https://a.com",
};

const fixtures: [MeSchema, string[]][] = [
  [
    {
      ...base,
      name: "",
    },
    ["name is too short"],
  ],
  [
    {
      ...base,
      name: "a".repeat(21),
    },
    ["name is too long"],
  ],
  [
    {
      ...base,
      email: "",
    },
    ["email is invalid", "email is too short"],
  ],
];

for (const [fixture, messages] of fixtures) {
  const result = meSchema.safeParse(fixture);

  expect.assert.isFalse(result.success);
  expect(result.error.issues.map((issue) => issue.message)).toEqual(messages);
}
```

Next.js route handler:

```ts
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("api/health", () => {
  describe("GET /", () => {
    it("should return 200", async () => {
      const res = await GET();

      expect(await res.json()).toMatchInlineSnapshot(`
        {
          "status": "ok",
        }
      `);
      expect(res.status).toBe(200);
    });
  });
});
```

Hono handler:

```ts
import { testClient } from "hono/testing";
import { describe, expect, it } from "vitest";
import app from "./handler";

describe("api/health", () => {
  const client = testClient(app);

  describe("GET /", () => {
    it("should return 200 with valid input", async () => {
      const res = await client.$get();

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchInlineSnapshot(`
        {
          "success": true,
        }
      `);
    });
  });
});
```

<!-- Reference: https://raw.githubusercontent.com/ryoppippi/dotfiles/de08e0d6eced4ef81943e8869bbe29d50531a04f/agents/skills/vitest-testing/SKILL.md -->
