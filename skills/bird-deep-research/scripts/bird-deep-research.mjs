#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import process from "node:process";

const execFileAsync = promisify(execFile);

function usage() {
  return `bird-deep-research

Usage:
  bird-deep-research.mjs collect --spec <file> [--target N] [--delay-ms N] [--bird-bin path]
  bird-deep-research.mjs profiles --spec <file> [--delay-ms N] [--bird-bin path]
  bird-deep-research.mjs dashboard --spec <file> [--classified <file>]

The spec controls all research-specific queries, inclusion rules, rubrics, and labels.
Collection defaults to 45000-60000ms between requests plus a 10-15 minute
cooldown after every 10 successful requests.
`;
}

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = rest[index + 1];
    if (value === undefined || value.startsWith("--")) flags[key] = true;
    else {
      flags[key] = value;
      index += 1;
    }
  }
  return { command, flags };
}

function asInteger(value, fallback, name) {
  const parsed = value === undefined ? fallback : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative integer`);
  return parsed;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function readJsonl(file) {
  try {
    const content = await readFile(file, "utf8");
    return content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line, index) => {
        try {
          return JSON.parse(line);
        } catch {
          throw new Error(`Invalid JSONL at ${file}:${index + 1}`);
        }
      });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function atomicJson(file, value) {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, file);
}

async function appendJsonl(file, values) {
  if (values.length === 0) return;
  await appendFile(file, `${values.map((value) => JSON.stringify(value)).join("\n")}\n`);
}

function normalizeQueries(queries) {
  if (!Array.isArray(queries) || queries.length === 0) {
    throw new Error("spec.queries must contain at least one query");
  }
  const seen = new Set();
  return queries.map((entry, index) => {
    const query = typeof entry === "string" ? entry : entry.query;
    const id = typeof entry === "string" ? `query-${index + 1}` : entry.id || `query-${index + 1}`;
    if (!query || typeof query !== "string") throw new Error(`Query ${index + 1} is missing query text`);
    if (seen.has(id)) throw new Error(`Duplicate query id: ${id}`);
    seen.add(id);
    return { id, query };
  });
}

async function loadContext(specFile) {
  const absoluteSpec = path.resolve(specFile);
  const spec = await readJson(absoluteSpec);
  const queries = normalizeQueries(spec.queries);
  const outputDir = path.resolve(path.dirname(absoluteSpec), spec.outputDir || "research-output");
  await mkdir(outputDir, { recursive: true });
  return { absoluteSpec, spec, queries, outputDir };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestDelay(base, jitter) {
  return base + (jitter > 0 ? Math.floor(Math.random() * (jitter + 1)) : 0);
}

async function paceRequests(requestCount, pacing) {
  await delay(requestDelay(pacing.delayMs, pacing.jitterMs));
  if (
    pacing.cooldownEveryRequests > 0 &&
    requestCount > 0 &&
    requestCount % pacing.cooldownEveryRequests === 0
  ) {
    const cooldown = requestDelay(pacing.cooldownMs, pacing.cooldownJitterMs);
    process.stderr.write(`scheduled cooldown: ${cooldown}ms after ${requestCount} successful requests\n`);
    await delay(cooldown);
  }
}

function birdGlobalArgs(spec, timeoutMs) {
  const args = ["--timeout", String(timeoutMs)];
  if (spec.collection?.relayBaseUrl) args.push("--relay-base-url", spec.collection.relayBaseUrl);
  if (spec.collection?.profileName) args.push("--profile-name", spec.collection.profileName);
  return args;
}

async function runBird(birdBin, args, timeoutMs) {
  const { stdout } = await execFileAsync(birdBin, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: timeoutMs + 5000,
  });
  return JSON.parse(stdout);
}

async function runBirdWithRetry({ birdBin, args, timeoutMs, maxRetries, baseDelayMs }) {
  let refreshedQueryIds = false;
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await runBird(birdBin, args, timeoutMs);
    } catch (error) {
      lastError = error;
      const message = `${error.stderr || ""}\n${error.message || ""}`;
      if (message.includes("404") && !refreshedQueryIds) {
        refreshedQueryIds = true;
        await execFileAsync(birdBin, ["query-ids", "--fresh"], { timeout: timeoutMs + 5000 });
        continue;
      }
      if (attempt < maxRetries) {
        const rateLimited = message.includes("429");
        const backoff = rateLimited
          ? Math.max(300000, baseDelayMs * 2 ** (attempt + 1))
          : Math.max(baseDelayMs, 5000) * 2 ** attempt;
        process.stderr.write(`bird request failed; retrying in ${backoff}ms (${attempt + 1}/${maxRetries})\n`);
        await delay(backoff);
      }
    }
  }
  throw lastError;
}

export function parseSearchResult(result) {
  if (Array.isArray(result)) return { tweets: result, nextCursor: null };
  const tweets = result?.tweets || result?.data?.tweets;
  if (!Array.isArray(tweets)) throw new Error("Bird search JSON did not contain a tweets array");
  return {
    tweets,
    nextCursor: result.nextCursor || result.next_cursor || result.data?.nextCursor || null,
  };
}

async function collect(specFile, flags) {
  const { spec, queries, outputDir } = await loadContext(specFile);
  const collection = spec.collection || {};
  const target = asInteger(flags.target, spec.targetPosts || 10000, "target");
  const pageSize = asInteger(collection.pageSize, 100, "collection.pageSize");
  const delayMs = asInteger(flags["delay-ms"], collection.delayMs ?? 45000, "delay-ms");
  const jitterMs = asInteger(collection.jitterMs, 15000, "collection.jitterMs");
  const cooldownEveryRequests = asInteger(
    collection.cooldownEveryRequests,
    10,
    "collection.cooldownEveryRequests",
  );
  const cooldownMs = asInteger(collection.cooldownMs, 600000, "collection.cooldownMs");
  const cooldownJitterMs = asInteger(
    collection.cooldownJitterMs,
    300000,
    "collection.cooldownJitterMs",
  );
  const timeoutMs = asInteger(collection.timeoutMs, 60000, "collection.timeoutMs");
  const maxRetries = asInteger(collection.maxRetries, 3, "collection.maxRetries");
  const product = collection.product || "Latest";
  const birdBin = flags["bird-bin"] || collection.birdBin || "bird";
  const postsFile = path.join(outputDir, "posts.jsonl");
  const stateFile = path.join(outputDir, "collection-state.json");
  const existingPosts = await readJsonl(postsFile);
  const ids = new Set(existingPosts.map((post) => String(post.id)).filter(Boolean));

  let state;
  try {
    state = await readJson(stateFile);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    state = { version: 1, queries: {}, createdAt: new Date().toISOString() };
  }
  for (const query of queries) {
    state.queries[query.id] ||= { cursor: null, exhausted: false, pages: 0, collected: 0 };
  }

  while (ids.size < target) {
    let madeRequest = false;
    for (const query of queries) {
      if (ids.size >= target) break;
      const queryState = state.queries[query.id];
      if (queryState.exhausted) continue;
      madeRequest = true;
      const args = [
        ...birdGlobalArgs(spec, timeoutMs),
        "search",
        query.query,
        "-n",
        String(pageSize),
        "--product",
        product,
        "--json",
      ];
      if (queryState.cursor) args.push("--cursor", queryState.cursor);
      else args.push("--all", "--max-pages", "1");

      const result = await runBirdWithRetry({
        birdBin,
        args,
        timeoutMs,
        maxRetries,
        baseDelayMs: delayMs,
      });
      const { tweets, nextCursor } = parseSearchResult(result);
      const fresh = [];
      for (const tweet of tweets) {
        if (tweet?.id === undefined || tweet?.id === null) continue;
        const id = String(tweet.id);
        if (ids.has(id)) continue;
        ids.add(id);
        fresh.push({ ...tweet, _researchQueryId: query.id });
      }
      await appendJsonl(postsFile, fresh);
      const previousCursor = queryState.cursor;
      queryState.cursor = nextCursor;
      queryState.pages += 1;
      queryState.collected += fresh.length;
      queryState.exhausted = !nextCursor || nextCursor === previousCursor;
      queryState.lastSuccessAt = new Date().toISOString();
      state.updatedAt = queryState.lastSuccessAt;
      state.uniquePosts = ids.size;
      state.targetPosts = target;
      state.successfulRequests = (state.successfulRequests || 0) + 1;
      await atomicJson(stateFile, state);
      process.stderr.write(
        `[${query.id}] page=${queryState.pages} new=${fresh.length} unique=${ids.size}/${target} exhausted=${queryState.exhausted}\n`,
      );

      const hasMore = ids.size < target && queries.some((item) => !state.queries[item.id].exhausted);
      if (hasMore) {
        await paceRequests(state.successfulRequests, {
          delayMs,
          jitterMs,
          cooldownEveryRequests,
          cooldownMs,
          cooldownJitterMs,
        });
      }
    }
    if (!madeRequest) break;
  }

  const exhausted = queries.filter((query) => state.queries[query.id].exhausted).map((query) => query.id);
  const summary = {
    outputDir,
    postsFile,
    stateFile,
    requested: target,
    collected: ids.size,
    shortfall: Math.max(0, target - ids.size),
    exhaustedQueries: exhausted,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

function compactProfile(user, keepRaw) {
  if (keepRaw) return user;
  const { raw, ...profile } = user;
  return {
    ...profile,
    location: user.location || raw?.location?.location || raw?.legacy?.location || "",
  };
}

async function profiles(specFile, flags) {
  const { spec, outputDir } = await loadContext(specFile);
  const collection = spec.collection || {};
  const delayMs = asInteger(flags["delay-ms"], collection.delayMs ?? 45000, "delay-ms");
  const jitterMs = asInteger(collection.jitterMs, 15000, "collection.jitterMs");
  const cooldownEveryRequests = asInteger(
    collection.cooldownEveryRequests,
    10,
    "collection.cooldownEveryRequests",
  );
  const cooldownMs = asInteger(collection.cooldownMs, 600000, "collection.cooldownMs");
  const cooldownJitterMs = asInteger(
    collection.cooldownJitterMs,
    300000,
    "collection.cooldownJitterMs",
  );
  const timeoutMs = asInteger(collection.timeoutMs, 60000, "collection.timeoutMs");
  const maxRetries = asInteger(collection.maxRetries, 3, "collection.maxRetries");
  const batchSize = Math.max(1, asInteger(collection.profileBatchSize, 20, "collection.profileBatchSize"));
  const birdBin = flags["bird-bin"] || collection.birdBin || "bird";
  const posts = await readJsonl(path.join(outputDir, "posts.jsonl"));
  const profilesFile = path.join(outputDir, "profiles.jsonl");
  const errorsFile = path.join(outputDir, "profile-errors.jsonl");
  const existing = await readJsonl(profilesFile);
  const completed = new Set(existing.map((profile) => profile.username?.toLowerCase()).filter(Boolean));
  const usernames = [
    ...new Set(
      posts
        .map((post) => post.author?.username || post.author?.screenName)
        .filter(Boolean)
        .map((username) => username.replace(/^@/, "")),
    ),
  ].filter((username) => !completed.has(username.toLowerCase()));

  for (let index = 0; index < usernames.length; index += batchSize) {
    const batch = usernames.slice(index, index + batchSize);
    const args = [
      ...birdGlobalArgs(spec, timeoutMs),
      "profiles",
      ...batch.map((username) => `@${username}`),
      "--json",
    ];
    const result = await runBirdWithRetry({
      birdBin,
      args,
      timeoutMs,
      maxRetries,
      baseDelayMs: delayMs,
    });
    const users = Array.isArray(result?.users) ? result.users : [];
    await appendJsonl(
      profilesFile,
      users.map((user) => ({
        ...compactProfile(user, collection.keepRawProfiles === true),
        _snapshotAt: new Date().toISOString(),
      })),
    );
    await appendJsonl(
      errorsFile,
      (result?.errors || []).map((error) => ({
        ...error,
        _requestedBatch: batch,
        _snapshotAt: new Date().toISOString(),
      })),
    );
    process.stderr.write(`profiles batch=${Math.floor(index / batchSize) + 1} users=${users.length}\n`);
    if (index + batchSize < usernames.length) {
      await paceRequests(Math.floor(index / batchSize) + 1, {
        delayMs,
        jitterMs,
        cooldownEveryRequests,
        cooldownMs,
        cooldownJitterMs,
      });
    }
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        outputDir,
        requestedProfiles: usernames.length,
        profilesFile,
        errorsFile,
      },
      null,
      2,
    )}\n`,
  );
}

function safeJson(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderDashboardHtml(spec, posts) {
  const title = spec.dashboard?.title || spec.title || "Bird Deep Research";
  const subtitle = spec.dashboard?.subtitle || spec.researchQuestion || "";
  const notice =
    spec.dashboard?.notice ||
    "Public X search is a non-probability sample. Findings describe the collected posts, not all users.";
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root{--paper:#f2f5f3;--ink:#14213d;--muted:#66736e;--line:#cfd8d3;--panel:#fff;--accent:#d6533f;--focus:#16697a}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:"Avenir Next","Hiragino Sans",system-ui,sans-serif}
    a{color:inherit}.shell{max-width:1440px;margin:auto;padding:28px}.mast{border-top:8px solid var(--ink);display:grid;grid-template-columns:1fr auto;gap:24px;padding:24px 0 18px;border-bottom:1px solid var(--line)}
    .eyebrow,.utility{font:700 11px/1.4 ui-monospace,SFMono-Regular,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
    h1{font-size:clamp(2rem,5vw,5.8rem);line-height:.92;letter-spacing:-.055em;margin:.25rem 0;max-width:900px}.subtitle{max-width:760px;font-size:1.05rem;line-height:1.6;color:var(--muted)}
    .notice{margin:18px 0 28px;padding:12px 16px;border-left:5px solid var(--accent);background:#fff8f5;font-size:.9rem}
    .metrics{display:grid;grid-template-columns:repeat(5,1fr);border:1px solid var(--line);background:var(--panel)}.metric{padding:18px;border-right:1px solid var(--line)}.metric:last-child{border:0}.metric strong{display:block;font-size:2rem;letter-spacing:-.04em}
    .grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,.75fr);gap:24px;margin-top:24px}.panel{background:var(--panel);border:1px solid var(--line);padding:22px}.panel h2{margin:0 0 18px;font-size:1rem;letter-spacing:.04em}
    .strata{display:flex;min-height:320px;align-items:stretch;border:1px solid var(--line);overflow:hidden}.stratum{border:0;border-right:1px solid rgba(20,33,61,.18);padding:16px 12px;display:flex;flex:1;flex-direction:column;justify-content:space-between;text-align:left;color:var(--ink);cursor:pointer;min-width:74px}.stratum:last-child{border-right:0}.stratum strong{font-size:clamp(1.7rem,4vw,4rem);letter-spacing:-.07em}.stratum span{writing-mode:vertical-rl;transform:rotate(180deg);font-weight:700}
    .bars{display:grid;gap:22px}.bar-group{display:grid;gap:10px}.bar-group h3{margin:0;font-size:.78rem;color:var(--muted)}.bar-row{display:grid;grid-template-columns:130px 1fr 48px;gap:10px;align-items:center;font-size:.85rem}.bar-track{height:12px;background:#e6ece9}.bar-fill{height:100%;background:var(--focus)}
    .records{margin-top:24px}.toolbar{display:grid;grid-template-columns:2fr repeat(3,1fr);gap:10px;margin-bottom:14px}.toolbar input,.toolbar select{width:100%;border:1px solid var(--line);background:#fff;padding:11px;color:var(--ink)}
    .record-list{display:grid;gap:8px}.record{display:grid;grid-template-columns:110px 1fr auto;gap:18px;align-items:start;background:#fff;border:1px solid var(--line);padding:16px}.record p{margin:0;line-height:1.55}.record button{border:1px solid var(--ink);background:transparent;padding:8px 10px;cursor:pointer}
    .pager{display:flex;justify-content:space-between;align-items:center;margin-top:14px}.pager button,.back{border:1px solid var(--ink);background:var(--ink);color:#fff;padding:10px 16px;cursor:pointer}
    .detail{display:none;max-width:900px;margin:30px auto;background:#fff;border:1px solid var(--line);padding:clamp(24px,6vw,72px)}.detail.active{display:block}.dashboard.hidden{display:none}.original{font-size:clamp(1.25rem,3vw,2.3rem);line-height:1.45;letter-spacing:-.02em;margin:30px 0}.evidence{border-top:1px solid var(--line);padding-top:18px;margin-top:18px}.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{border:1px solid var(--line);padding:5px 8px;font-size:.78rem}
    :focus-visible{outline:3px solid var(--focus);outline-offset:3px}@media(max-width:860px){.shell{padding:16px}.mast,.grid{grid-template-columns:1fr}.metrics{grid-template-columns:1fr 1fr}.metric:nth-child(2){border-right:0}.toolbar{grid-template-columns:1fr 1fr}.toolbar input{grid-column:1/-1}.record{grid-template-columns:1fr}.strata{overflow-x:auto}.stratum{min-width:110px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
  </style>
</head>
<body>
  <main class="shell">
    <section id="dashboard" class="dashboard">
      <header class="mast"><div><div class="eyebrow">Bird deep research / signal desk</div><h1>${escapeHtml(title)}</h1><p class="subtitle">${escapeHtml(subtitle)}</p></div><div class="utility" id="generated"></div></header>
      <div class="notice">${escapeHtml(notice)}</div>
      <section class="metrics" id="metrics"></section>
      <div class="grid"><section class="panel"><h2 id="primary-title">Classification strata</h2><div class="strata" id="strata"></div></section><section class="panel"><h2>Secondary signals</h2><div class="bars" id="secondary"></div></section></div>
      <section class="panel records"><h2>Original posts</h2><div class="toolbar"><input id="search" type="search" placeholder="Search original text"><select id="dimension"></select><select id="value"></select><select id="inclusion"><option value="">All inclusion states</option><option>include</option><option>review</option><option>exclude</option></select></div><div class="record-list" id="records"></div><div class="pager"><button id="previous">Previous</button><span id="page"></span><button id="next">Next</button></div></section>
    </section>
    <article id="detail" class="detail"><button class="back" id="back">← Dashboard</button><div id="detail-content"></div></article>
  </main>
  <script>
    const SPEC=${safeJson(spec)};
    const POSTS=${safeJson(posts)};
    const DIMENSIONS=SPEC.classification?.dimensions||[];
    const PRIMARY=SPEC.classification?.primaryDimension||DIMENSIONS[0]?.id||"";
    const PAGE_SIZE=50;
    let currentPage=1;
    const byId=(id)=>document.getElementById(id);
    const text=(tag,value,className)=>{const el=document.createElement(tag);if(className)el.className=className;el.textContent=value??"";return el};
    const valueOf=(post,id)=>post.classification?.[id]?.value==null?"unclassified":String(post.classification[id].value);
    const dimension=(id)=>DIMENSIONS.find((item)=>item.id===id);
    const valueMeta=(id,value)=>dimension(id)?.values?.find((item)=>String(item.id)===String(value));
    const postUrl=(post)=>post.url||("https://x.com/"+(post.author?.username||"i")+"/status/"+post.id);
    const pseudonym=(post)=>{if(post.author?.pseudonym)return post.author.pseudonym;const source=post.author?.username||String(post.id);let hash=0;for(const char of source)hash=((hash<<5)-hash)+char.charCodeAt(0)|0;return "Account "+Math.abs(hash).toString(16).slice(0,4).toUpperCase()};
    function counts(id,rows=POSTS){const result=new Map();for(const row of rows){const value=valueOf(row,id);result.set(value,(result.get(value)||0)+1)}return result}
    function renderMetrics(){const included=POSTS.filter((p)=>p.inclusion?.status==="include").length;const authors=new Set(POSTS.map((p)=>p.author?.username).filter(Boolean)).size;const reviewed=POSTS.filter((p)=>p.inclusion?.status==="review").length;const items=[["Collected",POSTS.length],["Requested",SPEC.targetPosts||POSTS.length],["Included",included],["Needs review",reviewed],["Unique authors",authors]];const root=byId("metrics");root.replaceChildren(...items.map(([label,value])=>{const box=document.createElement("div");box.className="metric";box.append(text("span",label,"utility"),text("strong",value.toLocaleString()));return box}))}
    function renderStrata(){const dim=dimension(PRIMARY);byId("primary-title").textContent=dim?.label||"Classification strata";const distribution=counts(PRIMARY);const values=dim?.values?.length?dim.values:[...distribution.keys()].map((id)=>({id,label:id}));const max=Math.max(1,...distribution.values());const root=byId("strata");root.replaceChildren(...values.map((item,index)=>{const count=distribution.get(String(item.id))||0;const button=document.createElement("button");button.className="stratum";button.style.background=item.color||["#dbe8e6","#b7d0d1","#e4bd84","#d97b64"][index%4];button.style.flexGrow=String(Math.max(.35,count/max));button.append(text("span",item.label||item.id),text("strong",count.toLocaleString()));button.addEventListener("click",()=>{byId("dimension").value=PRIMARY;populateValues();byId("value").value=String(item.id);currentPage=1;renderRecords()});return button}))}
    function renderSecondary(){const dims=DIMENSIONS.filter((item)=>item.id!==PRIMARY);const root=byId("secondary");if(!dims.length){root.append(text("p","Add another classification dimension to compare themes."));return}root.replaceChildren(...dims.map((dim)=>{const distribution=counts(dim.id);const entries=[...distribution.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12);const max=Math.max(1,...entries.map((entry)=>entry[1]));const group=document.createElement("section");group.className="bar-group";group.append(text("h3",dim.label||dim.id,"utility"),...entries.map(([value,count])=>{const row=document.createElement("div");row.className="bar-row";row.append(text("span",valueMeta(dim.id,value)?.label||value));const track=document.createElement("div");track.className="bar-track";const fill=document.createElement("div");fill.className="bar-fill";fill.style.width=((count/max)*100)+"%";track.append(fill);row.append(track,text("strong",count));return row}));return group}))}
    function populateDimensions(){const select=byId("dimension");select.replaceChildren(new Option("Any dimension",""),...DIMENSIONS.map((item)=>new Option(item.label,item.id)));populateValues()}
    function populateValues(){const id=byId("dimension").value;const select=byId("value");select.replaceChildren(new Option("Any value",""));if(!id)return;const dim=dimension(id);const values=dim?.values?.length?dim.values:[...counts(id).keys()].map((value)=>({id:value,label:value}));for(const item of values)select.add(new Option(item.label||item.id,item.id))}
    function filtered(){const query=byId("search").value.trim().toLowerCase();const dim=byId("dimension").value;const value=byId("value").value;const inclusion=byId("inclusion").value;return POSTS.filter((post)=>(!query||post.text?.toLowerCase().includes(query))&&(!inclusion||post.inclusion?.status===inclusion)&&(!dim||!value||valueOf(post,dim)===value))}
    function renderRecords(){const rows=filtered();const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));currentPage=Math.min(currentPage,pages);const visible=rows.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);const root=byId("records");root.replaceChildren(...visible.map((post)=>{const row=document.createElement("article");row.className="record";row.append(text("span",pseudonym(post),"utility"),text("p",post.text));const button=text("button","View source record");button.addEventListener("click",()=>location.hash="post="+encodeURIComponent(post.id));row.append(button);return row}));byId("page").textContent=currentPage+" / "+pages+" · "+rows.length.toLocaleString()+" records";byId("previous").disabled=currentPage<=1;byId("next").disabled=currentPage>=pages}
    function renderDetail(post){const root=byId("detail-content");root.replaceChildren(text("div",pseudonym(post)+" · "+(post.createdAt||"date unavailable"),"eyebrow"),text("p",post.text,"original"));const chips=document.createElement("div");chips.className="chips";for(const dim of DIMENSIONS){const value=valueOf(post,dim.id);chips.append(text("span",(dim.label||dim.id)+": "+(valueMeta(dim.id,value)?.label||value),"chip"))}chips.append(text("span","Inclusion: "+(post.inclusion?.status||"unknown"),"chip"));root.append(chips);const evidence=document.createElement("section");evidence.className="evidence";evidence.append(text("h2","Evidence"));const lines=[...(post.inclusion?.evidence||[])];for(const item of Object.values(post.classification||{}))lines.push(...(item.evidence||[]));evidence.append(...(lines.length?lines.map((line)=>text("p",line)): [text("p","No evidence text recorded.") ]));const link=text("a","Open original post on X →");link.href=postUrl(post);link.target="_blank";link.rel="noopener noreferrer";evidence.append(link);root.append(evidence)}
    function route(){const match=location.hash.match(/^#post=(.+)$/);if(!match){byId("dashboard").classList.remove("hidden");byId("detail").classList.remove("active");return}const post=POSTS.find((item)=>String(item.id)===decodeURIComponent(match[1]));if(!post)return;byId("dashboard").classList.add("hidden");byId("detail").classList.add("active");renderDetail(post);scrollTo(0,0)}
    byId("generated").textContent="Generated "+new Date().toLocaleString();
    byId("search").addEventListener("input",()=>{currentPage=1;renderRecords()});byId("dimension").addEventListener("change",()=>{populateValues();currentPage=1;renderRecords()});byId("value").addEventListener("change",()=>{currentPage=1;renderRecords()});byId("inclusion").addEventListener("change",()=>{currentPage=1;renderRecords()});byId("previous").addEventListener("click",()=>{currentPage--;renderRecords()});byId("next").addEventListener("click",()=>{currentPage++;renderRecords()});byId("back").addEventListener("click",()=>{location.hash=""});addEventListener("hashchange",route);
    renderMetrics();renderStrata();renderSecondary();populateDimensions();renderRecords();route();
  </script>
</body>
</html>`;
}

async function dashboard(specFile, flags) {
  const { spec, outputDir } = await loadContext(specFile);
  const classifiedFile = path.resolve(
    flags.classified || path.join(outputDir, spec.classifiedFile || "classified.jsonl"),
  );
  const posts = await readJsonl(classifiedFile);
  if (posts.length === 0) throw new Error(`No classified posts found at ${classifiedFile}`);
  const outputFile = path.join(outputDir, "dashboard.html");
  await writeFile(outputFile, renderDashboardHtml(spec, posts));
  process.stdout.write(`${JSON.stringify({ outputFile, posts: posts.length }, null, 2)}\n`);
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (!command || command === "help" || command === "--help" || command === "-h" || flags.help) {
    process.stdout.write(usage());
    return;
  }
  if (!flags.spec) throw new Error("--spec is required");
  if (command === "collect") await collect(flags.spec, flags);
  else if (command === "profiles") await profiles(flags.spec, flags);
  else if (command === "dashboard") await dashboard(flags.spec, flags);
  else throw new Error(`Unknown command: ${command}`);
}

const invokedDirectly = process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href;
if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
