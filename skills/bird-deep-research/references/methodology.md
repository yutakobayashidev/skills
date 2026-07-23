# Bird Deep Research Methodology

## Contents

- Research specification
- Query and collection design
- Profile enrichment and inclusion
- Classification output
- Dashboard and quality rules

## Research specification

Create `research-spec.json` for every project. All topical behavior comes from this file.

```json
{
  "title": "Public-post research title",
  "researchQuestion": "What should this research answer?",
  "queries": [
    {
      "id": "keyword-a-2026-07",
      "query": "\"keyword A\" lang:ja -filter:retweets since:2026-07-01 until:2026-08-01"
    }
  ],
  "targetPosts": 10000,
  "outputDir": "./research-output",
  "collection": {
    "product": "Latest",
    "pageSize": 100,
    "delayMs": 45000,
    "jitterMs": 15000,
    "cooldownEveryRequests": 10,
    "cooldownMs": 600000,
    "cooldownJitterMs": 300000,
    "timeoutMs": 60000,
    "maxRetries": 3,
    "profileBatchSize": 20
  },
  "inclusionRules": [
    {
      "id": "population-fit",
      "description": "User-supplied eligibility rule",
      "allowedEvidence": ["public_profile_location", "public_profile_bio"],
      "excludeWeakEvidence": true
    }
  ],
  "classification": {
    "primaryDimension": "depth",
    "dimensions": [
      {
        "id": "depth",
        "label": "Depth",
        "type": "ordinal",
        "decisionRules": [
          "Use only explicit evidence in the post and approved profile fields",
          "Choose the lower level when evidence is ambiguous"
        ],
        "values": [
          {"id": "0", "label": "Not applicable", "definition": "No evidence matching this dimension", "color": "#9AA7A1"},
          {"id": "1", "label": "Light", "definition": "User-supplied level definition", "color": "#7CA7B8"},
          {"id": "2", "label": "Material", "definition": "User-supplied level definition", "color": "#D89A55"},
          {"id": "3", "label": "Severe", "definition": "User-supplied level definition", "color": "#C54D3D"}
        ]
      },
      {
        "id": "theme",
        "label": "Theme",
        "type": "categorical",
        "values": []
      }
    ]
  },
  "dashboard": {
    "title": "Research dashboard",
    "subtitle": "A concise description of the sample",
    "notice": "Public X search is a non-probability sample and does not represent all users.",
    "showHandles": false
  }
}
```

Require at least one query. Make the date range explicit for large jobs. Split broad research into keyword × date-window shards; a single search cursor often exhausts far below 10,000 posts.

## Query and collection design

- Use `--product Latest` for time-bounded collection.
- Prefer several narrow query shards over one large `OR` query.
- Include desired language, date range, and retweet exclusion in each query when relevant.
- Count unique post IDs, not requests or authors.
- Run a 100-post dry run and inspect false positives before scaling.
- The collector writes:
  - `posts.jsonl`: unique Bird post objects
  - `collection-state.json`: cursor and exhaustion state per query
- Re-running the same command resumes from the checkpoint.
- Keep the default two-layer pacing: 45–60 seconds after every request, then an additional 10–15 minute cooldown after every 10 successful requests. The checkpoint preserves the successful-request count across resumes. On rate limits, wait longer rather than increasing concurrency.

## Profile enrichment and inclusion

Run profile enrichment only when account metadata is necessary for the user's inclusion rules. The command writes `profiles.jsonl` and `profile-errors.jsonl`.

Use only public, auditable evidence. For location-like criteria:

- Strong: explicit public profile location or explicit self-description.
- Medium: weaker public profile text supported by multiple relevant first-person posts.
- Weak: a single place mention, visit, follow, or `about.accountBasedIn`; exclude by default.

Store the evidence, rule ID, confidence, snapshot time, and conflicts. Phrase results as estimates based on public signals. Do not infer health diagnoses, ethnicity, religion, sexuality, or other unstated sensitive traits.

## Classification output

Write one JSON object per line to `<outputDir>/classified.jsonl`:

```json
{
  "id": "post-id",
  "text": "Original public post text",
  "url": "https://x.com/account/status/post-id",
  "createdAt": "2026-07-23T00:00:00Z",
  "author": {
    "username": "account",
    "pseudonym": "Account A17F"
  },
  "inclusion": {
    "status": "include",
    "confidence": 0.86,
    "ruleId": "population-fit",
    "evidence": ["Public profile states the required condition"]
  },
  "classification": {
    "depth": {
      "value": "2",
      "confidence": 0.81,
      "evidence": ["Short excerpt supporting the label"]
    },
    "theme": {
      "value": "transport",
      "confidence": 0.9,
      "evidence": ["Short excerpt supporting the label"]
    }
  },
  "sourceQueries": ["keyword-a-2026-07"],
  "sensitive": false,
  "analysisVersion": "rubric-v1"
}
```

Match `classification` keys to the spec's dimension IDs. Use `include`, `review`, or `exclude`. Keep original text unchanged. Classify from explicit evidence; use `review` when evidence is insufficient.

Define every value boundary in the spec before classification. For large jobs, classify stable batches with the available model, preserve the prompt/model/rubric version, and manually audit a random sample. Report per-class precision or reviewer agreement when available.

## Dashboard and quality rules

The renderer creates a self-contained `dashboard.html` with:

- counts by the primary and secondary dimensions
- inclusion-confidence and data-quality summaries
- searchable, paginated original-text records
- a `#post=<id>` detail view with classification evidence and the X source link
- a persistent sampling-limit notice

Default to pseudonyms in lists. Do not create people rankings. Suppress tiny aggregate cells for sensitive research when re-identification is plausible. Do not republish deleted posts. Keep the dashboard local or access-controlled unless the user explicitly approves broader distribution.

Always report:

- requested and collected unique posts
- unique authors and author concentration
- exhausted query shards and shortfall
- date range and query list
- inclusion/review/exclusion counts
- limitations from X search ranking, deletion, API truncation, and non-random sampling
