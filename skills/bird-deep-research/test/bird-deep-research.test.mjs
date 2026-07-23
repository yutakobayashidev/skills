import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  parseSearchResult,
  renderDashboardHtml,
} from "../scripts/bird-deep-research.mjs";

test("parseSearchResult reads paginated Bird JSON", () => {
  assert.deepEqual(parseSearchResult({ tweets: [{ id: "1" }], nextCursor: "next" }), {
    tweets: [{ id: "1" }],
    nextCursor: "next",
  });
});

test("dashboard embeds escaped source data and source detail route", () => {
  const html = renderDashboardHtml(
    {
      title: "Generic research",
      classification: {
        primaryDimension: "depth",
        dimensions: [{ id: "depth", label: "Depth", values: [{ id: "1", label: "One" }] }],
      },
    },
    [
      {
        id: "1",
        text: "</script><script>alert(1)</script>",
        classification: { depth: { value: "1", evidence: [] } },
      },
    ],
  );
  assert.match(html, /#post=/);
  assert.doesNotMatch(html, /<\/script><script>alert/);
  assert.match(html, /\\u003c\/script\\u003e/);
});

test("collector checkpoints and deduplicates fake Bird pages", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "bird-deep-research-"));
  const fakeBird = path.join(directory, "bird");
  const fakeSource = `#!/usr/bin/env node
const args=process.argv.slice(2);
if(args.includes("query-ids")) process.exit(0);
const cursorIndex=args.indexOf("--cursor");
const cursor=cursorIndex>=0?args[cursorIndex+1]:null;
const query=args[args.indexOf("search")+1];
const base=query.includes("alpha")?1:3;
const tweets=cursor?[{id:String(base+1),text:"second",author:{username:"b"}}]:[{id:String(base),text:"first",author:{username:"a"}},{id:String(base+1),text:"shared",author:{username:"b"}}];
process.stdout.write(JSON.stringify({tweets,nextCursor:cursor?null:"next"}));
`;
  await writeFile(fakeBird, fakeSource);
  await chmod(fakeBird, 0o755);
  const specFile = path.join(directory, "spec.json");
  await writeFile(
    specFile,
    JSON.stringify({
      title: "Fixture",
      queries: [
        { id: "a", query: "alpha" },
        { id: "b", query: "beta" },
      ],
      targetPosts: 4,
      outputDir: "./out",
      collection: { delayMs: 0, jitterMs: 0, timeoutMs: 5000 },
    }),
  );
  const script = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    "../scripts/bird-deep-research.mjs",
  );
  const result = spawnSync(process.execPath, [script, "collect", "--spec", specFile, "--bird-bin", fakeBird], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const posts = (await readFile(path.join(directory, "out/posts.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert.equal(new Set(posts.map((post) => post.id)).size, 4);
  const state = JSON.parse(await readFile(path.join(directory, "out/collection-state.json"), "utf8"));
  assert.equal(state.uniquePosts, 4);
  assert.equal(state.successfulRequests, 2);
});
