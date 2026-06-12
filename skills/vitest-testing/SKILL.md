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

## Readability

- Test one behaviour per `it`.
- Name tests after observable behaviour, not implementation details.
- Avoid `try`/`catch` for expected failures. Use `expect(...).toThrow()`, `await expect(...).rejects`, or explicit Result failure assertions.
- Avoid `if` branches inside test bodies. Split behaviours into separate tests or use `it.each` for table-driven cases.
- Do not over-DRY tests. Keep repeated setup inline when it makes the behaviour easier to read.
- Keep assertions in the test unless a helper name is clearer than the assertion it hides.
- Use `expect.assert` to make preconditions explicit and narrow nullable values instead of using non-null assertions.

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
