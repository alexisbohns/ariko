# Slice 4 — Read Model + Beanstalk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ariko becomes a pollen consumer: a cursor-synced, rebuildable read model over the federated feeds, projected beans, and the public/admin beanstalk timeline merging feed events with authored sprouts.

**Architecture:** A pure sync core (`lib/pollen-sync.ts`) behind one guarded door (`POST /api/pollen/sync`), fed by pluggable transports (HTTP feed + committed ndjson file) configured in repo-versioned `data/federation.yml`. Envelopes land write-once in a `pollen` Mongo collection (disposable cache, per-feed cursors, surfaced refusals); a pure builder (`lib/beanstalk.ts`) merges them with `timelineSprouts()` at render time. Spec: `docs/superpowers/specs/2026-08-17-read-model-beanstalk-design.md`.

**Tech Stack:** Next.js 15 App Router (zero-CSS, no client JS), TypeScript, MongoDB driver, `node --test` + tsx, js-yaml. Existing seams reused: `validatePollen` (lib/pollen.ts), `hasValidToken` (lib/auth.ts), `filterPublic`/`buildDataset` (lib/data.ts), `getDb` (lib/db.ts).

**Conventions (read first):**
- Run everything from the repo root. Tests: `npm test` (runs `lib/**/*.test.ts`). Typecheck: `npx tsc --noEmit`.
- House style: pure logic in `lib/*.ts` with unit tests and no DB; DB/glue is thin and smoke-tested only; routes/pages are thin shells.
- Comments state constraints, not narration. Match the existing terse-comment style.
- Commit after every task (messages given per task).

---

## File map

| File | Responsibility |
|---|---|
| `data/federation.yml` (create) | Feed list + exhibit list, repo-versioned |
| `lib/federation.ts` (create) | Parse/validate federation.yml, cached loader |
| `lib/data.ts` (modify) | `projected?` provenance field on `Bean` |
| `lib/projected-beans.ts` (create) | Pure: envelopes → beans to materialize |
| `lib/pollen-sync.ts` (create) | Pure sync core: validate/partition, ndjson slicing, cursor loop |
| `lib/pollen-transports.ts` (create) | HTTP + file transports (fetch-injected, testable) |
| `lib/pollen-store.ts` (create) | Mongo glue: write-once inserts, cursors, refusals, queries, indexes |
| `lib/pollen-run.ts` (create) | Glue: config → transports → sinks → results (route/action/script share it) |
| `lib/beanstalk.ts` (create) | Pure: exhibition rule, merge/sort, plant filter |
| `app/api/pollen/sync/route.ts` (create) | Guarded sync door |
| `app/beanstalk/page.tsx` (create) / `app/timeline/page.tsx` (delete) | Public beanstalk |
| `app/admin/beanstalk/page.tsx` (create) | Admin beanstalk + sync status |
| `app/admin/actions.ts` (modify) | `syncNowAction` |
| `next.config.ts`, `app/layout.tsx`, `app/admin/page.tsx` (modify) | Redirect + nav |
| `scripts/pollen-rebuild.ts` (create), `scripts/apply-validators.ts`, `package.json` (modify) | Rebuild + validators |
| `.github/workflows/pollen-sync.yml` (create) | Cron trigger, one secret |
| `data/garden.yml`, `docs/POLLEN.md`, `README.md` (modify) | Bees + docs |

---

### Task 1: Federation config (`data/federation.yml` + `lib/federation.ts`)

**Files:**
- Create: `data/federation.yml`
- Create: `lib/federation.ts`
- Test: `lib/federation.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/federation.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFederation } from "./federation";

const FEED = {
  id: "arkaik-pbbls",
  source: "arkaik",
  transport: "http",
  url: "https://arkaik.app/api/graph/projects/prj_x/pollen",
  tokenEnv: "ARKAIK_API_TOKEN",
};

test("parses a valid config", () => {
  const cfg = parseFederation({ feeds: [FEED], exhibit: ["plant:pbbls"] });
  assert.equal(cfg.feeds.length, 1);
  assert.equal(cfg.feeds[0].id, "arkaik-pbbls");
  assert.deepEqual(cfg.exhibit, ["plant:pbbls"]);
});

test("feeds and exhibit default to empty", () => {
  assert.deepEqual(parseFederation({}), { feeds: [], exhibit: [] });
});

test("file transport needs no tokenEnv", () => {
  const cfg = parseFederation({
    feeds: [{ id: "paulopus", source: "paulopus", transport: "file", url: "https://x/feed.ndjson" }],
  });
  assert.equal(cfg.feeds[0].tokenEnv, undefined);
});

test("http feed without tokenEnv is a loud config error", () => {
  assert.throws(
    () => parseFederation({ feeds: [{ ...FEED, tokenEnv: undefined }] }),
    /tokenEnv is required/,
  );
});

test("unknown transport is rejected", () => {
  assert.throws(() => parseFederation({ feeds: [{ ...FEED, transport: "ftp" }] }), /transport/);
});

test("duplicate feed ids are rejected", () => {
  assert.throws(() => parseFederation({ feeds: [FEED, FEED] }), /duplicate feed id/);
});

test("exhibit entries must be plant refs", () => {
  assert.throws(() => parseFederation({ exhibit: ["bean:x"] }), /plant:<slug>/);
  assert.throws(() => parseFederation({ exhibit: ["plant:Bad_Slug"] }), /plant:<slug>/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -A2 federation`
Expected: FAIL — cannot find module `./federation`.

- [ ] **Step 3: Implement `lib/federation.ts`**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { isObject, nonEmptyString } from "./text-input";

// Repo-versioned federation config (spec §3): which feeds the read model
// syncs, and which plants exhibit their feed events on the PUBLIC beanstalk.
// Merging a change to data/federation.yml is deploying it (umbrella §11).

export interface FeedConfig {
  id: string; // cursor key — stable forever once synced
  source: string; // emitting tool slug (matches envelope.source)
  transport: "http" | "file";
  url: string;
  tokenEnv?: string; // env var NAME holding the bearer token; required for http
}

export interface FederationConfig {
  feeds: FeedConfig[];
  exhibit: string[]; // "plant:<slug>" refs — the per-plant human exhibition act
}

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const PLANT = "plant:";

// Throws on any bad shape: a broken config must fail sync loudly, never
// half-run (spec §10 — loud config error).
export function parseFederation(raw: unknown): FederationConfig {
  if (!isObject(raw)) throw new Error("federation.yml must be a mapping");
  const feedsRaw = raw.feeds ?? [];
  if (!Array.isArray(feedsRaw)) throw new Error("feeds must be a list");
  const seen = new Set<string>();
  const feeds = feedsRaw.map((f, i): FeedConfig => {
    if (!isObject(f)) throw new Error(`feeds[${i}] must be a mapping`);
    if (!nonEmptyString(f.id) || !SLUG.test(f.id)) throw new Error(`feeds[${i}].id must be a slug`);
    if (seen.has(f.id)) throw new Error(`duplicate feed id "${f.id}"`);
    seen.add(f.id);
    if (!nonEmptyString(f.source) || !SLUG.test(f.source)) {
      throw new Error(`feed "${f.id}": source must be a slug`);
    }
    if (f.transport !== "http" && f.transport !== "file") {
      throw new Error(`feed "${f.id}": transport must be "http" or "file"`);
    }
    if (!nonEmptyString(f.url)) throw new Error(`feed "${f.id}": url is required`);
    if (f.transport === "http" && !nonEmptyString(f.tokenEnv)) {
      throw new Error(`feed "${f.id}": tokenEnv is required for http feeds`);
    }
    return {
      id: f.id,
      source: f.source,
      transport: f.transport,
      url: f.url,
      ...(nonEmptyString(f.tokenEnv) ? { tokenEnv: f.tokenEnv } : {}),
    };
  });
  const exhibitRaw = raw.exhibit ?? [];
  if (!Array.isArray(exhibitRaw)) throw new Error("exhibit must be a list");
  const exhibit = exhibitRaw.map((e, i) => {
    if (typeof e !== "string" || !e.startsWith(PLANT) || !SLUG.test(e.slice(PLANT.length))) {
      throw new Error(`exhibit[${i}] must be a "plant:<slug>" ref`);
    }
    return e;
  });
  return { feeds, exhibit };
}

let cached: FederationConfig | null = null;

// Reads data/federation.yml once, then caches — same lifecycle as getDataset.
export function getFederation(): FederationConfig {
  if (!cached) {
    const file = readFileSync(join(process.cwd(), "data", "federation.yml"), "utf8");
    cached = parseFederation(yaml.load(file, { schema: yaml.CORE_SCHEMA }));
  }
  return cached;
}
```

- [ ] **Step 4: Create `data/federation.yml`**

```yaml
# Federation read model config (slice 4). Feeds the sync door pulls, and the
# plants whose feed events render on the PUBLIC beanstalk. Secrets stay in
# env vars — this file names them, never holds them. Merging is deploying.
feeds:
  - id: arkaik-pbbls
    source: arkaik
    transport: http
    url: https://arkaik.app/api/graph/projects/prj_5dDiZc-G6lseF3cb/pollen
    tokenEnv: ARKAIK_API_TOKEN
  - id: arkaik-arkaik
    source: arkaik
    transport: http
    url: https://arkaik.app/api/graph/projects/prj_-p3xhVj7e3EvBksO/pollen
    tokenEnv: ARKAIK_API_TOKEN

exhibit:
  - plant:pbbls
  - plant:arkaik
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: all pass (federation tests included; nothing else broken).

- [ ] **Step 6: Commit**

```bash
git add lib/federation.ts lib/federation.test.ts data/federation.yml
git commit -m "feat: federation config — feeds + exhibit list (slice 4)"
```

---

### Task 2: `projected` provenance on Bean + pure bean projection

**Files:**
- Modify: `lib/data.ts` (the `Bean` interface, ~line 93)
- Create: `lib/projected-beans.ts`
- Test: `lib/projected-beans.test.ts`

- [ ] **Step 1: Add the field to `Bean` in `lib/data.ts`**

Change the `Bean` interface to:

```ts
export interface Bean {
  slug: string;
  name: Text; // bilingual since B1; plain strings remain valid (no migration)
  parents: string[]; // containment ONLY: "pod:…" and/or "plant:…" refs — a bean may skip the pod tier
  visibility?: Visibility; // default treated as "public"
  tags?: string[];
  // Machine-created from a pollen feed (slice 4): read-only in the admin,
  // source-owned, rebuildable. Absent on every authored bean.
  projected?: { source: string; feedId: string; firstPollenId: string };
}
```

- [ ] **Step 2: Write the failing tests**

Create `lib/projected-beans.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveProjectedBeans } from "./projected-beans";
import type { Pollen } from "./pollen";

function pollen(over: Partial<Pollen>): Pollen {
  return {
    v: 1,
    id: "melogram:e1",
    at: "2026-06-01T10:00:00Z",
    source: "melogram",
    kind: "published",
    title: "Celesta is out",
    anchors: { plant: "plant:bohns-music" },
    ...over,
  };
}

test("bean anchor on an unknown slug materializes a projected bean", () => {
  const beans = deriveProjectedBeans(
    [pollen({ anchors: { plant: "plant:bohns-music", pod: "pod:celesta", bean: "bean:damned-thoughts" } })],
    new Set(),
    new Set(["plant:bohns-music"]),
    "melogram",
  );
  assert.equal(beans.length, 1);
  assert.deepEqual(beans[0], {
    slug: "damned-thoughts",
    name: "damned-thoughts",
    parents: ["plant:bohns-music", "pod:celesta"],
    visibility: "public",
    projected: { source: "melogram", feedId: "melogram", firstPollenId: "melogram:e1" },
  });
});

test("non-exhibited plant projects a PRIVATE bean", () => {
  const beans = deriveProjectedBeans(
    [pollen({ anchors: { plant: "plant:bohns-music", bean: "bean:x" } })],
    new Set(),
    new Set(),
    "melogram",
  );
  assert.equal(beans[0].visibility, "private");
});

test("existing bean (authored or prior projection) is never touched", () => {
  const beans = deriveProjectedBeans(
    [pollen({ anchors: { plant: "plant:bohns-music", bean: "bean:existing" } })],
    new Set(["existing"]),
    new Set(["plant:bohns-music"]),
    "melogram",
  );
  assert.deepEqual(beans, []);
});

test("first envelope wins within a batch", () => {
  const beans = deriveProjectedBeans(
    [
      pollen({ id: "melogram:e1", anchors: { plant: "plant:bohns-music", bean: "bean:x" } }),
      pollen({ id: "melogram:e2", anchors: { plant: "plant:bohns-music", bean: "bean:x" } }),
    ],
    new Set(),
    new Set(),
    "melogram",
  );
  assert.equal(beans.length, 1);
  assert.equal(beans[0].projected?.firstPollenId, "melogram:e1");
});

test("plant-only envelopes project nothing", () => {
  assert.deepEqual(deriveProjectedBeans([pollen({})], new Set(), new Set(), "f"), []);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -B1 -A3 projected`
Expected: FAIL — cannot find module `./projected-beans`.

- [ ] **Step 4: Implement `lib/projected-beans.ts`**

```ts
import { BEAN_PREFIX, type Bean } from "./data";
import type { Pollen } from "./pollen";

// Pure derivation of projected beans (spec §5): envelopes carrying a bean
// anchor whose slug does not exist yet materialize a read-only, rebuildable
// bean. Authored-or-prior always wins (the caller passes every existing slug);
// visibility derives from the exhibition list at projection time, so a rebuild
// after flipping the list re-derives consistently. Pods are NOT projected in
// v1 — a dangling pod anchor is the reader's problem, ignored fail-closed.
export function deriveProjectedBeans(
  envelopes: Pollen[],
  existingBeanSlugs: Set<string>,
  exhibit: Set<string>, // "plant:<slug>" refs
  feedId: string,
): Bean[] {
  const out: Bean[] = [];
  const claimed = new Set<string>();
  for (const p of envelopes) {
    if (!p.anchors.bean) continue;
    const slug = p.anchors.bean.slice(BEAN_PREFIX.length);
    if (existingBeanSlugs.has(slug) || claimed.has(slug)) continue;
    claimed.add(slug);
    out.push({
      slug,
      name: slug,
      parents: [p.anchors.plant, ...(p.anchors.pod ? [p.anchors.pod] : [])],
      visibility: exhibit.has(p.anchors.plant) ? "public" : "private",
      projected: { source: p.source, feedId, firstPollenId: p.id },
    });
  }
  return out;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test` and `npx tsc --noEmit`
Expected: all pass, clean typecheck (the `Bean` widening is additive).

- [ ] **Step 6: Commit**

```bash
git add lib/data.ts lib/projected-beans.ts lib/projected-beans.test.ts
git commit -m "feat: projected beans — pure derivation + Bean provenance field"
```

---

### Task 3: Sync pure core — validation partition + ndjson slicing

**Files:**
- Create: `lib/pollen-sync.ts`
- Test: `lib/pollen-sync.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/pollen-sync.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  processEnvelopes,
  sliceFeedFile,
  lastEnvelopeId,
  MAX_REFUSAL_RAW_BYTES,
} from "./pollen-sync";

function envelope(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    v: 1,
    id: "arkaik:01H0000000000000000000A001",
    at: "2026-08-01T10:00:00Z",
    source: "arkaik",
    kind: "shipped",
    title: "Something shipped",
    anchors: { plant: "plant:pbbls" },
    ...over,
  };
}

test("valid envelopes come back normalized, invalid become refusals", () => {
  const r = processEnvelopes([envelope(), { junk: true }]);
  assert.equal(r.valid.length, 1);
  assert.equal(r.valid[0].id, "arkaik:01H0000000000000000000A001");
  assert.equal(r.refusals.length, 1);
  assert.match(r.refusals[0].reason, /v must be 1/);
  assert.equal(r.refusals[0].raw, JSON.stringify({ junk: true }));
});

test("non-core kind is a warning, not a refusal", () => {
  const r = processEnvelopes([envelope({ kind: "idea.proposed" })]);
  assert.equal(r.valid.length, 1);
  assert.equal(r.refusals.length, 0);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /not in the v1 core/);
});

test("refusal raw is capped at 4 KiB", () => {
  const r = processEnvelopes([{ big: "x".repeat(10_000) }]);
  assert.equal(r.refusals[0].raw.length, MAX_REFUSAL_RAW_BYTES);
});

test("sliceFeedFile without cursor returns every parsed line", () => {
  const text = `${JSON.stringify(envelope({ id: "a:1" }))}\n\n${JSON.stringify(envelope({ id: "a:2" }))}\n`;
  const r = sliceFeedFile(text, null);
  assert.notEqual(r, "gone");
  if (r === "gone") return;
  assert.equal(r.entries.length, 2);
  assert.deepEqual(r.malformed, []);
});

test("sliceFeedFile with a cursor returns only lines after it", () => {
  const text = [envelope({ id: "a:1" }), envelope({ id: "a:2" }), envelope({ id: "a:3" })]
    .map((e) => JSON.stringify(e))
    .join("\n");
  const r = sliceFeedFile(text, "a:2");
  assert.notEqual(r, "gone");
  if (r === "gone") return;
  assert.deepEqual(r.entries.map((e) => (e as { id: string }).id), ["a:3"]);
});

test("sliceFeedFile with a vanished cursor is gone (410-equivalent)", () => {
  assert.equal(sliceFeedFile(JSON.stringify(envelope({ id: "a:1" })), "a:404"), "gone");
});

test("sliceFeedFile records unparseable lines after the cursor as malformed", () => {
  const text = `${JSON.stringify(envelope({ id: "a:1" }))}\nnot json\n`;
  const r = sliceFeedFile(text, "a:1");
  assert.notEqual(r, "gone");
  if (r === "gone") return;
  assert.deepEqual(r.entries, []);
  assert.equal(r.malformed.length, 1);
  assert.match(r.malformed[0].reason, /unparseable/);
});

test("lastEnvelopeId takes the last string id, skipping junk", () => {
  assert.equal(lastEnvelopeId([envelope({ id: "a:1" }), { junk: true }]), "a:1");
  assert.equal(lastEnvelopeId([{ junk: true }]), null);
  assert.equal(lastEnvelopeId([]), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -B1 -A3 pollen-sync`
Expected: FAIL — cannot find module `./pollen-sync`.

- [ ] **Step 3: Implement the pure core in `lib/pollen-sync.ts`**

```ts
import { validatePollen, type Pollen } from "./pollen";
import { isObject } from "./text-input";

// Pure sync core for the read model (spec §3). No DB, no fetch — transports
// and sinks are injected (lib/pollen-transports.ts, lib/pollen-store.ts).

// A cached envelope: the validated envelope plus sync provenance.
export interface PollenDoc extends Pollen {
  feedId: string;
  syncedAt: string;
}

export interface StoredRefusal {
  reason: string;
  raw: string; // capped — no silent loss, but no unbounded junk either
}

export const MAX_REFUSAL_RAW_BYTES = 4096;

function capRaw(value: unknown): string {
  let s: string;
  try {
    s = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    s = String(value);
  }
  return s.length > MAX_REFUSAL_RAW_BYTES ? s.slice(0, MAX_REFUSAL_RAW_BYTES) : s;
}

export interface ProcessResult {
  valid: Pollen[];
  refusals: StoredRefusal[];
  warnings: string[];
}

// Partition one page: refusals are recorded, never fatal; warnings (non-core
// kinds) accompany a STORED envelope — generic handling, never rejection.
export function processEnvelopes(raw: unknown[]): ProcessResult {
  const valid: Pollen[] = [];
  const refusals: StoredRefusal[] = [];
  const warnings: string[] = [];
  for (const entry of raw) {
    const result = validatePollen(entry);
    if (result.ok) {
      valid.push(result.value);
      warnings.push(...result.warnings);
    } else {
      refusals.push({ reason: result.error, raw: capRaw(entry) });
    }
  }
  return { valid, refusals, warnings };
}

// Committed-feed-file transport core (POLLEN.md §Report): one envelope per
// line, blank lines ignored. The cursor is a line's envelope id; a cursor no
// longer present in the file is the 410-equivalent — the caller rebuilds from
// the top. Unparseable lines after the cursor surface as refusals.
export function sliceFeedFile(
  text: string,
  cursor: string | null,
): { entries: unknown[]; malformed: StoredRefusal[] } | "gone" {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const parsed = lines.map((line): { ok: true; value: unknown } | { ok: false; line: string } => {
    try {
      return { ok: true, value: JSON.parse(line) };
    } catch {
      return { ok: false, line };
    }
  });
  let start = 0;
  if (cursor !== null) {
    const idx = parsed.findIndex((p) => p.ok && isObject(p.value) && p.value.id === cursor);
    if (idx === -1) return "gone";
    start = idx + 1;
  }
  const entries: unknown[] = [];
  const malformed: StoredRefusal[] = [];
  for (const p of parsed.slice(start)) {
    if (p.ok) entries.push(p.value);
    else malformed.push({ reason: "unparseable ndjson line", raw: capRaw(p.line) });
  }
  return { entries, malformed };
}

// The consumer's cursor is the last processed envelope id — refused envelopes
// count as processed (they were recorded). Junk without a string id cannot
// carry a cursor; the loop's no-advance guard catches a page of only-junk.
export function lastEnvelopeId(envelopes: unknown[]): string | null {
  for (let i = envelopes.length - 1; i >= 0; i--) {
    const e = envelopes[i];
    if (isObject(e) && typeof e.id === "string" && e.id) return e.id;
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/pollen-sync.ts lib/pollen-sync.test.ts
git commit -m "feat: pollen sync pure core — partition, ndjson slicing, cursor id"
```

---

### Task 4: Sync loop (`syncFeed`)

**Files:**
- Modify: `lib/pollen-sync.ts` (append)
- Test: `lib/pollen-sync.test.ts` (append)

- [ ] **Step 1: Append the failing tests to `lib/pollen-sync.test.ts`**

```ts
import { syncFeed, type FeedPage, type FeedTransport, type PollenSink } from "./pollen-sync";

// In-memory sink capturing every call — no DB in unit tests, house style.
function memorySink(initialCursor: string | null = null) {
  const calls = {
    inserted: [] as string[],
    refused: [] as string[],
    cursors: [] as (string | null)[],
    statuses: [] as string[],
    projected: 0,
  };
  let cursor = initialCursor;
  const sink: PollenSink = {
    getCursor: async () => cursor,
    setCursor: async (_feedId, c, status) => {
      cursor = c;
      calls.cursors.push(c);
      calls.statuses.push(status);
    },
    insertNew: async (_feedId, envelopes) => {
      calls.inserted.push(...envelopes.map((e) => e.id));
      return envelopes.length;
    },
    recordRefusals: async (_feedId, refusals) => {
      calls.refused.push(...refusals.map((r) => r.reason));
    },
    projectBeans: async (_feedId, envelopes) => {
      calls.projected += envelopes.length;
      return 0;
    },
  };
  return { sink, calls };
}

function pageTransport(pages: FeedPage[]): FeedTransport {
  let i = 0;
  return { fetchPage: async () => pages[Math.min(i++, pages.length - 1)] };
}

test("syncFeed pages until the empty page, advancing the cursor per page", async () => {
  const { sink, calls } = memorySink();
  const result = await syncFeed(
    "f1",
    pageTransport([
      { envelopes: [envelope({ id: "a:1" }), envelope({ id: "a:2" })], done: false },
      { envelopes: [envelope({ id: "a:3" })], done: false },
      { envelopes: [], done: true },
    ]),
    sink,
  );
  assert.deepEqual(result, { feedId: "f1", stored: 3, refused: 0, status: "ok" });
  assert.deepEqual(calls.inserted, ["a:1", "a:2", "a:3"]);
  assert.deepEqual(calls.cursors, ["a:2", "a:3", "a:3"]);
  assert.equal(calls.projected, 3);
});

test("a refused envelope is recorded and still advances the cursor", async () => {
  const { sink, calls } = memorySink();
  const result = await syncFeed(
    "f1",
    pageTransport([
      { envelopes: [envelope({ id: "a:1" }), { id: "a:2", junk: true }], done: false },
      { envelopes: [], done: true },
    ]),
    sink,
  );
  assert.equal(result.stored, 1);
  assert.equal(result.refused, 1);
  assert.equal(result.status, "ok");
  assert.equal(calls.cursors[0], "a:2");
});

test("gone resets the cursor once and replays from the start", async () => {
  const { sink, calls } = memorySink("a:404");
  const result = await syncFeed(
    "f1",
    pageTransport(["gone", { envelopes: [envelope({ id: "a:1" })], done: true }]),
    sink,
  );
  assert.equal(result.status, "ok");
  assert.equal(result.stored, 1);
  assert.deepEqual(calls.cursors, [null, "a:1"]);
  assert.equal(calls.statuses[0], "rebuilding");
});

test("gone twice is an error, not a loop", async () => {
  const { sink } = memorySink("a:404");
  const result = await syncFeed("f1", pageTransport(["gone", "gone"]), sink);
  assert.equal(result.status, "error");
  assert.match(result.error ?? "", /gone again/);
});

test("a non-empty page that cannot advance the cursor is an error", async () => {
  const { sink } = memorySink("a:1");
  const result = await syncFeed(
    "f1",
    pageTransport([{ envelopes: [{ junk: true }], done: false }]),
    sink,
  );
  assert.equal(result.status, "error");
  assert.match(result.error ?? "", /failed to advance/);
});

test("a transport throw becomes an error result, never an exception", async () => {
  const { sink } = memorySink();
  const boom: FeedTransport = {
    fetchPage: async () => {
      throw new Error("HTTP 503");
    },
  };
  const result = await syncFeed("f1", boom, sink);
  assert.equal(result.status, "error");
  assert.match(result.error ?? "", /503/);
});

test("file-transport extraRefusals are counted and recorded", async () => {
  const { sink, calls } = memorySink();
  const result = await syncFeed(
    "f1",
    pageTransport([
      {
        envelopes: [envelope({ id: "a:1" })],
        extraRefusals: [{ reason: "unparseable ndjson line", raw: "not json" }],
        done: true,
      },
    ]),
    sink,
  );
  assert.equal(result.refused, 1);
  assert.deepEqual(calls.refused, ["unparseable ndjson line"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -B1 -A3 syncFeed`
Expected: FAIL — `syncFeed` is not exported.

- [ ] **Step 3: Append the loop to `lib/pollen-sync.ts`**

```ts
// One page from a transport. done:true ends the loop after processing (file
// transport is single-page); http transports set done when the page is empty
// ("empty array ⇒ caught up"). "gone" = upstream 410 / vanished file cursor.
export type FeedPage =
  | { envelopes: unknown[]; extraRefusals?: StoredRefusal[]; done: boolean }
  | "gone";

export interface FeedTransport {
  fetchPage(cursor: string | null): Promise<FeedPage>;
}

export interface PollenSink {
  getCursor(feedId: string): Promise<string | null>;
  setCursor(feedId: string, cursor: string | null, status: string, error?: string): Promise<void>;
  insertNew(feedId: string, envelopes: Pollen[]): Promise<number>; // write-once; returns newly stored
  recordRefusals(feedId: string, refusals: StoredRefusal[]): Promise<void>;
  projectBeans(feedId: string, envelopes: Pollen[]): Promise<number>;
}

export interface FeedResult {
  feedId: string;
  stored: number;
  refused: number;
  status: "ok" | "error";
  error?: string;
}

// Cursor-synced ingest of one feed. Idempotent by construction: write-once
// inserts converge on replay, the cursor advances per page (a crashed run
// re-covers at most one page — latency, never correctness), and a 410/gone
// resets the cursor exactly once per run. One feed's failure never throws:
// it lands on the cursor doc and in the result (umbrella §11, no silent loss).
export async function syncFeed(
  feedId: string,
  transport: FeedTransport,
  sink: PollenSink,
): Promise<FeedResult> {
  let stored = 0;
  let refused = 0;
  try {
    let cursor = await sink.getCursor(feedId);
    let rebuilt = false;
    for (;;) {
      const page = await transport.fetchPage(cursor);
      if (page === "gone") {
        if (rebuilt) throw new Error("cursor gone again after rebuild");
        rebuilt = true;
        cursor = null;
        await sink.setCursor(feedId, null, "rebuilding");
        continue;
      }
      const { valid, refusals, warnings } = processEnvelopes(page.envelopes);
      for (const w of warnings) console.warn(`[pollen:${feedId}] ${w}`);
      const allRefusals = [...(page.extraRefusals ?? []), ...refusals];
      if (valid.length > 0) {
        stored += await sink.insertNew(feedId, valid);
        await sink.projectBeans(feedId, valid);
      }
      if (allRefusals.length > 0) {
        refused += allRefusals.length;
        await sink.recordRefusals(feedId, allRefusals);
      }
      const next = lastEnvelopeId(page.envelopes) ?? cursor;
      if (page.envelopes.length > 0 && next === cursor && !page.done) {
        throw new Error("cursor failed to advance — page carries no usable id");
      }
      cursor = next;
      await sink.setCursor(feedId, cursor, "ok");
      if (page.done || page.envelopes.length === 0) break;
    }
    return { feedId, stored, refused, status: "ok" };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    // Best effort: surface the failure on the cursor doc without clobbering
    // the cursor itself (the next run resumes where this one stopped).
    try {
      await sink.setCursor(feedId, await sink.getCursor(feedId), "error", error);
    } catch {
      // the sink itself is down — the FeedResult still carries the error
    }
    return { feedId, stored, refused, status: "error", error };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/pollen-sync.ts lib/pollen-sync.test.ts
git commit -m "feat: syncFeed — cursor loop, 410 rebuild, per-feed error isolation"
```

---

### Task 5: Transports (`lib/pollen-transports.ts`)

**Files:**
- Create: `lib/pollen-transports.ts`
- Test: `lib/pollen-transports.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/pollen-transports.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTransport } from "./pollen-transports";
import type { FeedConfig } from "./federation";

const HTTP_FEED: FeedConfig = {
  id: "arkaik-pbbls",
  source: "arkaik",
  transport: "http",
  url: "https://arkaik.example/api/pollen",
  tokenEnv: "TEST_ARKAIK_TOKEN",
};
const FILE_FEED: FeedConfig = {
  id: "paulopus",
  source: "paulopus",
  transport: "file",
  url: "https://raw.example/feed.ndjson",
};
const ENV = { TEST_ARKAIK_TOKEN: "tok_test" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

test("http transport without its env var fails at construction, loudly", () => {
  assert.throws(() => makeTransport(HTTP_FEED, {}), /TEST_ARKAIK_TOKEN/);
});

test("http transport sends bearer + limit, and after only when cursored", async () => {
  const seen: { url: string; auth: string | null }[] = [];
  const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
    seen.push({
      url: String(input),
      auth: new Headers(init?.headers).get("authorization"),
    });
    return jsonResponse({ pollen: [] });
  }) as typeof fetch;
  const t = makeTransport(HTTP_FEED, ENV, fetchImpl);
  await t.fetchPage(null);
  await t.fetchPage("arkaik:01H");
  assert.equal(seen[0].auth, "Bearer tok_test");
  assert.match(seen[0].url, /limit=200/);
  assert.doesNotMatch(seen[0].url, /after=/);
  assert.match(seen[1].url, /after=arkaik%3A01H/);
});

test("http transport: empty page is done, non-empty is not", async () => {
  const bodies = [{ pollen: [{ id: "a:1" }] }, { pollen: [] }];
  let i = 0;
  const fetchImpl = (async () => jsonResponse(bodies[i++])) as typeof fetch;
  const t = makeTransport(HTTP_FEED, ENV, fetchImpl);
  const p1 = await t.fetchPage(null);
  const p2 = await t.fetchPage("a:1");
  assert.notEqual(p1, "gone");
  assert.notEqual(p2, "gone");
  if (p1 === "gone" || p2 === "gone") return;
  assert.equal(p1.done, false);
  assert.equal(p2.done, true);
});

test("http transport maps 410 to gone and other failures to throws", async () => {
  const t410 = makeTransport(HTTP_FEED, ENV, (async () => new Response("", { status: 410 })) as typeof fetch);
  assert.equal(await t410.fetchPage("a:x"), "gone");
  const t500 = makeTransport(HTTP_FEED, ENV, (async () => new Response("", { status: 500 })) as typeof fetch);
  await assert.rejects(() => t500.fetchPage(null), /HTTP 500/);
  const tBad = makeTransport(HTTP_FEED, ENV, (async () => jsonResponse({ nope: 1 })) as typeof fetch);
  await assert.rejects(() => tBad.fetchPage(null), /not \{ pollen/);
});

test("file transport slices by cursor and is always done", async () => {
  const text = '{"id":"p:1"}\n{"id":"p:2"}\nnot json\n';
  const fetchImpl = (async () => new Response(text)) as typeof fetch;
  const t = makeTransport(FILE_FEED, {}, fetchImpl);
  const page = await t.fetchPage("p:1");
  assert.notEqual(page, "gone");
  if (page === "gone") return;
  assert.deepEqual(page.envelopes, [{ id: "p:2" }]);
  assert.equal(page.extraRefusals?.length, 1);
  assert.equal(page.done, true);
  assert.equal(await t.fetchPage("p:404"), "gone");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -B1 -A3 transport`
Expected: FAIL — cannot find module `./pollen-transports`.

- [ ] **Step 3: Implement `lib/pollen-transports.ts`**

```ts
import type { FeedConfig } from "./federation";
import { sliceFeedFile, type FeedPage, type FeedTransport } from "./pollen-sync";
import { isObject } from "./text-input";

const PAGE_LIMIT = 200; // POLLEN.md server cap

// Builds the transport for one configured feed. fetchImpl is injectable for
// tests; env is injectable so a missing token env var fails HERE, loudly, at
// construction — never as a silent unauthenticated request.
export function makeTransport(
  feed: FeedConfig,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): FeedTransport {
  if (feed.transport === "http") {
    const token = feed.tokenEnv ? env[feed.tokenEnv] : undefined;
    if (!token) throw new Error(`feed "${feed.id}": env var ${feed.tokenEnv} is not set`);
    return {
      async fetchPage(cursor): Promise<FeedPage> {
        const url = new URL(feed.url);
        url.searchParams.set("limit", String(PAGE_LIMIT));
        if (cursor !== null) url.searchParams.set("after", cursor);
        const res = await fetchImpl(url, { headers: { authorization: `Bearer ${token}` } });
        if (res.status === 410) return "gone";
        if (!res.ok) throw new Error(`feed "${feed.id}": HTTP ${res.status}`);
        const body: unknown = await res.json();
        if (!isObject(body) || !Array.isArray(body.pollen)) {
          throw new Error(`feed "${feed.id}": response is not { pollen: [...] }`);
        }
        return { envelopes: body.pollen, done: body.pollen.length === 0 };
      },
    };
  }
  // Committed feed file: refetched whole per call (at most twice per run —
  // once, plus once more after a gone reset). Single page, always done.
  return {
    async fetchPage(cursor): Promise<FeedPage> {
      const res = await fetchImpl(feed.url);
      if (!res.ok) throw new Error(`feed "${feed.id}": HTTP ${res.status}`);
      const sliced = sliceFeedFile(await res.text(), cursor);
      if (sliced === "gone") return "gone";
      return { envelopes: sliced.entries, extraRefusals: sliced.malformed, done: true };
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/pollen-transports.ts lib/pollen-transports.test.ts
git commit -m "feat: pollen transports — http paging + committed feed file"
```

---

### Task 6: Beanstalk pure module (`lib/beanstalk.ts`)

**Files:**
- Create: `lib/beanstalk.ts`
- Test: `lib/beanstalk.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/beanstalk.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { exhibitedPollen, mergeBeanstalk, plantSlugOf } from "./beanstalk";
import type { PollenDoc } from "./pollen-sync";
import type { TimelineEntry } from "./data";

function doc(over: Partial<PollenDoc>): PollenDoc {
  return {
    v: 1,
    id: "arkaik:e1",
    at: "2026-08-10T10:00:00Z",
    source: "arkaik",
    kind: "shipped",
    title: "Shipped a thing",
    anchors: { plant: "plant:pbbls" },
    feedId: "arkaik-pbbls",
    syncedAt: "2026-08-17T00:00:00Z",
    ...over,
  };
}

function sproutEntry(slug: string, date: string, plantSlug: string | null = "pbbls"): TimelineEntry {
  return {
    sprout: { slug, name: slug, type: "feature", date, description: "", parents: [] },
    bean: null,
    plant: plantSlug ? { slug: plantSlug, name: plantSlug, natures: ["work"], description: "" } : null,
  };
}

const PUBLIC_PLANTS = new Set(["pbbls", "arkaik"]);

test("exhibition: private visibility always loses, fail-closed first", () => {
  const r = exhibitedPollen([doc({ visibility: "private" })], ["plant:pbbls"], PUBLIC_PLANTS);
  assert.deepEqual(r, []);
});

test("exhibition: a non-exhibited plant loses", () => {
  assert.deepEqual(exhibitedPollen([doc({})], [], PUBLIC_PLANTS), []);
});

test("exhibition: a filterPublic-hidden plant loses even when exhibited", () => {
  assert.deepEqual(exhibitedPollen([doc({})], ["plant:pbbls"], new Set()), []);
});

test("exhibition: exhibited + public plant passes", () => {
  assert.equal(exhibitedPollen([doc({})], ["plant:pbbls"], PUBLIC_PLANTS).length, 1);
});

test("merge sorts newest first by date part, sprout before pollen on ties", () => {
  const entries = mergeBeanstalk(
    [sproutEntry("s-old", "2026-08-01"), sproutEntry("s-tie", "2026-08-10")],
    [doc({ id: "arkaik:tie", at: "2026-08-10T23:59:59Z" }), doc({ id: "arkaik:new", at: "2026-08-12T01:00:00Z" })],
    new Set(),
  );
  assert.deepEqual(
    entries.map((e) => (e.type === "sprout" ? e.entry.sprout.slug : e.pollen.id)),
    ["arkaik:new", "s-tie", "arkaik:tie", "s-old"],
  );
});

test("pollen entries pick the first url ref and a kept bean anchor", () => {
  const [e] = mergeBeanstalk(
    [],
    [
      doc({
        anchors: { plant: "plant:pbbls", bean: "bean:rom-win" },
        refs: [
          { label: "deliverable", ref: "pr-12" },
          { label: "pull request", url: "https://github.com/x/pbbls/pull/12" },
        ],
      }),
    ],
    new Set(["rom-win"]),
  );
  assert.equal(e.type, "pollen");
  if (e.type !== "pollen") return;
  assert.equal(e.url, "https://github.com/x/pbbls/pull/12");
  assert.equal(e.beanSlug, "rom-win");
});

test("a bean anchor outside the kept set yields no bean link", () => {
  const [e] = mergeBeanstalk([], [doc({ anchors: { plant: "plant:pbbls", bean: "bean:hidden" } })], new Set());
  if (e.type !== "pollen") return assert.fail("expected pollen entry");
  assert.equal(e.beanSlug, undefined);
});

test("plantSlugOf reads both entry types", () => {
  const entries = mergeBeanstalk([sproutEntry("s1", "2026-08-01")], [doc({})], new Set());
  assert.deepEqual(entries.map(plantSlugOf), ["pbbls", "pbbls"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -B1 -A3 beanstalk`
Expected: FAIL — cannot find module `./beanstalk`.

- [ ] **Step 3: Implement `lib/beanstalk.ts`**

```ts
import { BEAN_PREFIX, PLANT_PREFIX, type TimelineEntry } from "./data";
import type { PollenDoc } from "./pollen-sync";

// Pure beanstalk builders (spec §4, §6): the timeline is the union of
// authored material and feed events; growth over time is the page's meaning.

export type BeanstalkEntry =
  | { type: "sprout"; date: string; entry: TimelineEntry }
  | { type: "pollen"; date: string; pollen: PollenDoc; url?: string; beanSlug?: string };

// The exhibition rule (spec §4) — all three must hold, checked in order:
// envelope privacy is binding fail-closed; the plant must be exhibited (the
// per-plant human act in data/federation.yml); the plant must survive
// filterPublic (a private plant exhibits nothing).
export function exhibitedPollen(
  pollen: PollenDoc[],
  exhibit: string[],
  publicPlantSlugs: Set<string>,
): PollenDoc[] {
  const ex = new Set(exhibit);
  return pollen.filter(
    (p) =>
      p.visibility !== "private" &&
      ex.has(p.anchors.plant) &&
      publicPlantSlugs.has(p.anchors.plant.slice(PLANT_PREFIX.length)),
  );
}

// Newest first by DATE PART (sprout dates are date-only, pollen `at` is a
// full timestamp — comparing raw strings would sort date-only lines older).
// Ties put authored material first; further ties keep input order (stable sort).
export function mergeBeanstalk(
  sprouts: TimelineEntry[],
  pollen: PollenDoc[],
  keptBeanSlugs: Set<string>,
): BeanstalkEntry[] {
  const entries: BeanstalkEntry[] = [
    ...sprouts.map((entry): BeanstalkEntry => ({ type: "sprout", date: entry.sprout.date.slice(0, 10), entry })),
    ...pollen.map((p): BeanstalkEntry => {
      const beanSlug = p.anchors.bean?.slice(BEAN_PREFIX.length);
      const url = (p.refs ?? []).find((r) => r.url)?.url;
      return {
        type: "pollen",
        date: p.at.slice(0, 10),
        pollen: p,
        ...(url ? { url } : {}),
        ...(beanSlug && keptBeanSlugs.has(beanSlug) ? { beanSlug } : {}),
      };
    }),
  ];
  const rank = (e: BeanstalkEntry) => (e.type === "sprout" ? 0 : 1);
  return entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : rank(a) - rank(b)));
}

// The plant a line belongs to, for the ?plant= filter — resolved plant for
// sprouts, the anchor for pollen.
export function plantSlugOf(e: BeanstalkEntry): string | null {
  return e.type === "sprout"
    ? (e.entry.plant?.slug ?? null)
    : e.pollen.anchors.plant.slice(PLANT_PREFIX.length);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/beanstalk.ts lib/beanstalk.test.ts
git commit -m "feat: beanstalk builders — exhibition rule + authored/pollen merge"
```

---

### Task 7: Conformance flow test (fixtures → store shape → beanstalk)

**Files:**
- Test: `lib/pollen-sync.test.ts` (append)

- [ ] **Step 1: Append the conformance test**

The `data/pollen/valid/` fixtures are the contract's ground truth (slice 2). Every one must flow through the read-model pipeline untouched. Append to `lib/pollen-sync.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mergeBeanstalk } from "./beanstalk";
import type { PollenDoc } from "./pollen-sync";

test("every valid conformance fixture flows through process → merge cleanly", () => {
  const dir = join(process.cwd(), "data", "pollen", "valid");
  const fixtures = readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "manifest.json")
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as unknown);
  assert.ok(fixtures.length > 0, "no valid fixtures found");
  const { valid, refusals } = processEnvelopes(fixtures);
  assert.equal(refusals.length, 0);
  assert.equal(valid.length, fixtures.length);
  const docs: PollenDoc[] = valid.map((v) => ({ ...v, feedId: "fixture", syncedAt: "2026-08-17T00:00:00Z" }));
  const entries = mergeBeanstalk([], docs, new Set());
  assert.equal(entries.length, fixtures.length);
});

test("every invalid conformance fixture becomes a refusal, none throw", () => {
  const dir = join(process.cwd(), "data", "pollen", "invalid");
  const fixtures = readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "manifest.json")
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as unknown);
  const { valid, refusals } = processEnvelopes(fixtures);
  assert.equal(valid.length, 0);
  assert.equal(refusals.length, fixtures.length);
});
```

Note: if `data/pollen/invalid/newer-version.json` carries `v: 2` (a *warning*-free hard refusal per the validator's `checkV`) this passes as written; if any "invalid" fixture is actually accepted-with-warning, the manifest (`data/pollen/invalid/manifest.json`) says what each fixture expects — align the assertion with the manifest rather than weakening the validator.

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test`
Expected: all pass (this is a characterization test over already-working code; if it fails, the fixture/manifest note above tells you which side to fix).

- [ ] **Step 3: Commit**

```bash
git add lib/pollen-sync.test.ts
git commit -m "test: conformance fixtures flow through the read-model pipeline"
```

---

### Task 8: Store glue + runSync (`lib/pollen-store.ts`, `lib/pollen-run.ts`)

**Files:**
- Create: `lib/pollen-store.ts`
- Create: `lib/pollen-run.ts`

DB glue — thin, no unit tests (house style: pure logic is tested, glue is smoke-tested at acceptance).

- [ ] **Step 1: Implement `lib/pollen-store.ts`**

```ts
import { createHash } from "node:crypto";
import { getDb } from "./db";
import type { Bean } from "./data";
import type { PollenDoc, PollenSink, StoredRefusal } from "./pollen-sync";
import { deriveProjectedBeans } from "./projected-beans";

// Mongo glue for the read model (spec §3). The cache is disposable: every
// write here is derivable from the feeds; deleteFeedData + sync rebuilds it.

export interface CursorDoc {
  feedId: string;
  cursor: string | null;
  lastSyncAt: string;
  lastStatus: string; // "ok" | "rebuilding" | "error"
  lastError?: string;
}

export interface RefusalDoc {
  feedId: string;
  at: string;
  reason: string;
  raw: string;
  rawHash: string; // sha256 hex of raw — the dedupe key (raw itself is too big to index)
}

export async function ensurePollenIndexes(): Promise<void> {
  const db = await getDb();
  await db.collection("pollen").createIndex({ id: 1 }, { unique: true });
  await db.collection("pollen").createIndex({ at: -1 });
  await db.collection("pollen").createIndex({ "anchors.plant": 1 });
  await db.collection("pollen_cursors").createIndex({ feedId: 1 }, { unique: true });
  await db.collection("pollen_refusals").createIndex({ feedId: 1, rawHash: 1 }, { unique: true });
}

export function makeSink(exhibit: string[]): PollenSink {
  return {
    async getCursor(feedId) {
      const db = await getDb();
      const doc = await db.collection<CursorDoc>("pollen_cursors").findOne({ feedId });
      return doc?.cursor ?? null;
    },
    async setCursor(feedId, cursor, status, error) {
      const db = await getDb();
      const update: Record<string, unknown> = {
        $set: {
          cursor,
          lastSyncAt: new Date().toISOString(),
          lastStatus: status,
          ...(error ? { lastError: error } : {}),
        },
        $setOnInsert: { feedId },
      };
      if (!error) update.$unset = { lastError: "" };
      // If the driver's typings reject the loose shape, cast:
      // `update as UpdateFilter<CursorDoc>` (import type { UpdateFilter } from "mongodb").
      await db.collection<CursorDoc>("pollen_cursors").updateOne({ feedId }, update, { upsert: true });
    },
    async insertNew(feedId, envelopes) {
      // Write-once by id ($setOnInsert): envelopes are immutable, a re-seen
      // id is a no-op — replay after a 410 rebuild converges instead of duping.
      const db = await getDb();
      const syncedAt = new Date().toISOString();
      const res = await db.collection<PollenDoc>("pollen").bulkWrite(
        envelopes.map((e) => ({
          updateOne: {
            filter: { id: e.id },
            update: { $setOnInsert: { ...e, feedId, syncedAt } },
            upsert: true,
          },
        })),
        { ordered: false },
      );
      return res.upsertedCount;
    },
    async recordRefusals(feedId, refusals: StoredRefusal[]) {
      // Deduped by content hash so a re-synced malformed line doesn't grow
      // the collection every run; surfaced on /admin/beanstalk, never fatal.
      const db = await getDb();
      const at = new Date().toISOString();
      await db.collection<RefusalDoc>("pollen_refusals").bulkWrite(
        refusals.map((r) => {
          const rawHash = createHash("sha256").update(r.raw).digest("hex");
          return {
            updateOne: {
              filter: { feedId, rawHash },
              update: { $setOnInsert: { feedId, at, reason: r.reason, raw: r.raw, rawHash } },
              upsert: true,
            },
          };
        }),
        { ordered: false },
      );
    },
    async projectBeans(feedId, envelopes) {
      const db = await getDb();
      const existing = new Set(
        (await db.collection<Bean>("beans").find({}, { projection: { _id: 0, slug: 1 } }).toArray()).map(
          (b) => b.slug,
        ),
      );
      const beans = deriveProjectedBeans(envelopes, existing, new Set(exhibit), feedId);
      if (beans.length === 0) return 0;
      // $setOnInsert on slug: authored-or-prior always wins, write-once.
      const res = await db.collection<Bean>("beans").bulkWrite(
        beans.map((b) => ({
          updateOne: { filter: { slug: b.slug }, update: { $setOnInsert: b }, upsert: true },
        })),
        { ordered: false },
      );
      return res.upsertedCount;
    },
  };
}

export async function listPollen(): Promise<PollenDoc[]> {
  const db = await getDb();
  return db.collection<PollenDoc>("pollen").find({}, { projection: { _id: 0 } }).sort({ at: -1 }).toArray();
}

export async function listCursors(): Promise<CursorDoc[]> {
  const db = await getDb();
  return db.collection<CursorDoc>("pollen_cursors").find({}, { projection: { _id: 0 } }).sort({ feedId: 1 }).toArray();
}

export async function listRefusals(limit = 20): Promise<RefusalDoc[]> {
  const db = await getDb();
  return db
    .collection<RefusalDoc>("pollen_refusals")
    .find({}, { projection: { _id: 0 } })
    .sort({ at: -1 })
    .limit(limit)
    .toArray();
}

// Full rebuild, step 1 (spec §3): wipe everything derived from one feed —
// envelopes, cursor, refusals, projected beans. Step 2 is an ordinary sync.
export async function deleteFeedData(feedId: string): Promise<void> {
  const db = await getDb();
  await db.collection("pollen").deleteMany({ feedId });
  await db.collection("pollen_cursors").deleteOne({ feedId });
  await db.collection("pollen_refusals").deleteMany({ feedId });
  await db.collection("beans").deleteMany({ "projected.feedId": feedId });
}
```

- [ ] **Step 2: Implement `lib/pollen-run.ts`**

```ts
import { getFederation } from "./federation";
import { makeSink } from "./pollen-store";
import { syncFeed, type FeedResult } from "./pollen-sync";
import { makeTransport } from "./pollen-transports";

// The one shared entry point for the sync door, the admin button, and the
// rebuild script. Sequential on purpose: two feeds, no concurrency to reason
// about, and one feed's construction failure (missing env var) still lets the
// others run.
export async function runSync(onlyFeedId?: string): Promise<FeedResult[]> {
  const { feeds, exhibit } = getFederation();
  const selected = onlyFeedId ? feeds.filter((f) => f.id === onlyFeedId) : feeds;
  const results: FeedResult[] = [];
  for (const feed of selected) {
    try {
      results.push(await syncFeed(feed.id, makeTransport(feed), makeSink(exhibit)));
    } catch (err) {
      results.push({
        feedId: feed.id,
        stored: 0,
        refused: 0,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}
```

- [ ] **Step 3: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: clean typecheck, all tests still pass.

- [ ] **Step 4: Commit**

```bash
git add lib/pollen-store.ts lib/pollen-run.ts
git commit -m "feat: pollen store glue + runSync — write-once cache, cursors, refusals"
```

---

### Task 9: The sync door (`POST /api/pollen/sync`)

**Files:**
- Create: `app/api/pollen/sync/route.ts`
- Test: `lib/pollen-sync-route.test.ts`

- [ ] **Step 1: Write the failing auth tests**

Create `lib/pollen-sync-route.test.ts` (route tests live in `lib/`, matching `inbox-route.test.ts`; only the pre-DB auth path is unit-testable):

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/pollen/sync/route";

function req(auth?: string): Request {
  return new Request("http://localhost/api/pollen/sync", {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
  });
}

test("sync door: SYNC_TOKEN unset refuses everything (fail closed)", async () => {
  delete process.env.SYNC_TOKEN;
  const res = await POST(req("Bearer anything"));
  assert.equal(res.status, 401);
});

test("sync door: wrong or missing token is 401", async () => {
  process.env.SYNC_TOKEN = "tok_sync_test";
  try {
    assert.equal((await POST(req())).status, 401);
    assert.equal((await POST(req("Bearer wrong"))).status, 401);
  } finally {
    delete process.env.SYNC_TOKEN;
  }
});
```

(No happy-path unit test: a correct token proceeds to `runSync`, which needs the DB — that path is covered by the acceptance run in Task 14.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -B1 -A3 "sync door"`
Expected: FAIL — cannot find module `../app/api/pollen/sync/route`.

- [ ] **Step 3: Implement `app/api/pollen/sync/route.ts`**

```ts
import { hasValidToken } from "../../../../lib/auth";
import { runSync } from "../../../../lib/pollen-run";

// The one guarded sync door (spec §7). One static bearer token (SYNC_TOKEN);
// an unset env var refuses everything — fail closed, like every other door.
export async function POST(request: Request): Promise<Response> {
  const token = process.env.SYNC_TOKEN;
  const tokens = token
    ? new Map([[token, new Set(["*"])]])
    : new Map<string, Set<string>>();
  if (!hasValidToken(request.headers.get("authorization"), tokens)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const results = await runSync();
  const status = results.some((r) => r.status === "error") ? 502 : 200;
  return Response.json({ results }, { status });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/pollen/sync/route.ts lib/pollen-sync-route.test.ts
git commit -m "feat: guarded sync door — POST /api/pollen/sync"
```

---

### Task 10: Public `/beanstalk` page (rename from `/timeline`)

**Files:**
- Create: `app/beanstalk/page.tsx`
- Delete: `app/timeline/page.tsx`
- Modify: `next.config.ts`, `app/layout.tsx` (nav, ~line 37)

- [ ] **Step 1: Create `app/beanstalk/page.tsx`**

```tsx
import { buildDataset, filterPublic, resolveText } from "@/lib/data";
import { loadRawGarden } from "@/lib/store";
import { getFederation } from "@/lib/federation";
import { listPollen } from "@/lib/pollen-store";
import { exhibitedPollen, mergeBeanstalk, plantSlugOf } from "@/lib/beanstalk";

export const dynamic = "force-dynamic";

// The beanstalk (spec §6): the union of authored sprouts and exhibited feed
// events, newest first — growth over time is the page's meaning. Reads the
// Mongo cache only, never upstream feeds.
export default async function BeanstalkPage({
  searchParams,
}: {
  searchParams: Promise<{ plant?: string }>;
}) {
  const { plant } = await searchParams;
  const pub = filterPublic(await loadRawGarden());
  const data = buildDataset(pub);
  const plantSlugs = data.getPlants().map((p) => p.slug);
  const active = plant && plantSlugs.includes(plant) ? plant : "all";

  const pollen = exhibitedPollen(await listPollen(), getFederation().exhibit, new Set(plantSlugs));
  const keptBeanSlugs = new Set((pub.beans ?? []).map((b) => b.slug));
  const entries = mergeBeanstalk(data.timelineSprouts(), pollen, keptBeanSlugs).filter(
    (e) => active === "all" || plantSlugOf(e) === active,
  );

  return (
    <article>
      <h1>Beanstalk</h1>

      <nav>
        <ul>
          {["all", ...plantSlugs].map((filter) => (
            <li key={filter}>
              {filter === active ? (
                <strong>{filter}</strong>
              ) : (
                <a href={filter === "all" ? "/beanstalk" : `/beanstalk?plant=${encodeURIComponent(filter)}`}>
                  {filter}
                </a>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <ul>
        {entries.map((e) =>
          e.type === "sprout" ? (
            <li key={`sprout:${e.entry.sprout.slug}`}>
              {e.entry.bean ? (
                <a href={`/bean/${e.entry.bean.slug}`}>{resolveText(e.entry.sprout.name)}</a>
              ) : (
                resolveText(e.entry.sprout.name)
              )}
              {" — "}
              <time dateTime={e.entry.sprout.date}>{e.date}</time>
              {" — "}
              {e.entry.sprout.type}
            </li>
          ) : (
            <li key={`pollen:${e.pollen.id}`}>
              {e.url ? <a href={e.url}>{resolveText(e.pollen.title)}</a> : resolveText(e.pollen.title)}
              {" — "}
              <time dateTime={e.pollen.at}>{e.date}</time>
              {" — "}
              {e.pollen.kind}
              {" — "}
              {e.pollen.source}
              {e.beanSlug ? (
                <>
                  {" — "}
                  <a href={`/bean/${e.beanSlug}`}>{e.beanSlug}</a>
                </>
              ) : null}
            </li>
          ),
        )}
      </ul>
    </article>
  );
}
```

- [ ] **Step 2: Delete the old page and wire the redirect**

```bash
git rm app/timeline/page.tsx
```

In `next.config.ts`, add the redirect next to the existing `/atom/:id` one:

```ts
  redirects: async () => [
    { source: "/atom/:id", destination: "/bean/:id", permanent: true },
    // Slice 4: the timeline is the beanstalk — the cosmology reaches the URL.
    { source: "/timeline", destination: "/beanstalk", permanent: true },
  ],
```

In `app/layout.tsx`, change the nav entry:

```tsx
              <li>
                <a href="/beanstalk">Beanstalk</a>
              </li>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: clean typecheck, tests pass, build succeeds (the build needs no DB — pages are `force-dynamic`). If the build fails on missing `data/federation.yml` parsing, the file from Task 1 exists — the error would mean a YAML typo; fix it there.

- [ ] **Step 4: Commit**

```bash
git add app/beanstalk/page.tsx next.config.ts app/layout.tsx
git commit -m "feat: the beanstalk — public timeline renders authored + exhibited pollen"
```

---

### Task 11: Admin beanstalk + Sync now

**Files:**
- Create: `app/admin/beanstalk/page.tsx`
- Modify: `app/admin/actions.ts` (append), `app/admin/page.tsx` (nav link next to the vault link, ~line 54)

- [ ] **Step 1: Append `syncNowAction` to `app/admin/actions.ts`**

Add the import at the top with the other lib imports:

```ts
import { runSync } from "@/lib/pollen-run";
```

Append the action (session-gated like every other action; `/admin/*` is also middleware-gated):

```ts
// Manual pull of every configured feed — same core the cron Action calls.
export async function syncNowAction(): Promise<void> {
  await requireSession();
  await runSync();
  revalidatePath("/admin/beanstalk");
  redirect("/admin/beanstalk");
}
```

- [ ] **Step 2: Create `app/admin/beanstalk/page.tsx`**

```tsx
import { resolveText } from "@/lib/data";
import { getFullDataset, loadRawGarden } from "@/lib/store";
import { getFederation } from "@/lib/federation";
import { listCursors, listPollen, listRefusals } from "@/lib/pollen-store";
import { mergeBeanstalk } from "@/lib/beanstalk";
import { syncNowAction } from "../actions";

export const dynamic = "force-dynamic";

// Admin beanstalk (spec §6): EVERYTHING — every sprout state, every cached
// envelope (private and non-exhibited included), each line with provenance —
// plus the sync operations surface (cursors, refusals, Sync now).
export default async function AdminBeanstalkPage() {
  const [raw, data, pollen, cursors, refusals] = await Promise.all([
    loadRawGarden(),
    getFullDataset(),
    listPollen(),
    listCursors(),
    listRefusals(),
  ]);
  const allBeanSlugs = new Set((raw.beans ?? []).map((b) => b.slug));
  const entries = mergeBeanstalk(data.timelineSprouts(), pollen, allBeanSlugs);
  const { feeds } = getFederation();

  return (
    <article>
      <h1>Beanstalk (admin)</h1>
      <p>
        <a href="/admin">← admin</a> · <a href="/beanstalk">public view →</a>
      </p>

      <h2>Feeds</h2>
      <form action={syncNowAction}>
        <button type="submit">Sync now</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>feed</th>
            <th>cursor</th>
            <th>last sync</th>
            <th>status</th>
          </tr>
        </thead>
        <tbody>
          {feeds.map((f) => {
            const c = cursors.find((x) => x.feedId === f.id);
            return (
              <tr key={f.id}>
                <td>{f.id}</td>
                <td>{c?.cursor ?? "—"}</td>
                <td>{c?.lastSyncAt ?? "never"}</td>
                <td>
                  {c?.lastStatus ?? "—"}
                  {c?.lastError ? ` (${c.lastError})` : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {refusals.length > 0 ? (
        <>
          <h2>Refusals</h2>
          <ul>
            {refusals.map((r) => (
              <li key={`${r.feedId}:${r.rawHash}`}>
                <code>{r.feedId}</code> — {r.reason} — <time dateTime={r.at}>{r.at.slice(0, 10)}</time>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h2>Entries</h2>
      <ul>
        {entries.map((e) =>
          e.type === "sprout" ? (
            <li key={`sprout:${e.entry.sprout.slug}`}>
              [{e.entry.sprout.state ?? "draft"}] {resolveText(e.entry.sprout.name)}
              {" — "}
              <time dateTime={e.entry.sprout.date}>{e.date}</time>
              {" — "}
              {e.entry.sprout.type} — authored
            </li>
          ) : (
            <li key={`pollen:${e.pollen.id}`}>
              [{e.pollen.visibility ?? "unset"}] {resolveText(e.pollen.title)}
              {" — "}
              <time dateTime={e.pollen.at}>{e.date}</time>
              {" — "}
              {e.pollen.kind} — feed:{e.pollen.feedId}
            </li>
          ),
        )}
      </ul>
    </article>
  );
}
```

- [ ] **Step 3: Link it from the admin home**

In `app/admin/page.tsx`, next to the existing `<a href="/admin/vault">vault →</a>` link, add:

```tsx
        <a href="/admin/beanstalk">beanstalk →</a>
```

(Match the surrounding markup — if the vault link sits in a list or a paragraph, put this beside it the same way.)

- [ ] **Step 4: Mark projected beans read-only in the admin bean view**

Spec §5: projected beans carry a "projected from <source>" marker. In `app/admin/bean/[id]/page.tsx`, where the bean's fields are rendered (right after the bean's name/heading), add:

```tsx
      {bean.projected ? (
        <p>
          <em>
            projected from {bean.projected.source} (feed {bean.projected.feedId}) — read-only,
            rebuilt from the feed
          </em>
        </p>
      ) : null}
```

(`bean` here is whatever variable that page already binds the bean to — match its name. Beans have no edit affordance today, so the marker is the whole read-only story; nothing to disable.)

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: clean. Note: `RefusalDoc.rawHash` is used as the React key — it exists on the type from Task 8.

- [ ] **Step 6: Commit**

```bash
git add app/admin/beanstalk/page.tsx app/admin/actions.ts app/admin/page.tsx app/admin/bean
git commit -m "feat: admin beanstalk — full union, sync status, refusals, Sync now"
```

---

### Task 12: Validators, indexes, rebuild script

**Files:**
- Modify: `scripts/apply-validators.ts`, `package.json`
- Create: `scripts/pollen-rebuild.ts`

- [ ] **Step 1: Extend `scripts/apply-validators.ts`**

Add the import at the top:

```ts
import { ensurePollenIndexes } from "../lib/pollen-store";
```

Inside `main()`, after the existing `applyValidator` calls, add:

```ts
  // Read-model cache (slice 4). Moderate level, like everything else: the
  // cache is disposable, so a validator here is a tripwire, not a migration.
  await applyValidator("pollen", {
    bsonType: "object",
    required: ["v", "id", "at", "source", "kind", "title", "anchors", "feedId", "syncedAt"],
    properties: {
      v: { bsonType: "number" },
      id: { bsonType: "string" },
      at: { bsonType: "string" },
      source: { bsonType: "string" },
      kind: { bsonType: "string" },
      anchors: {
        bsonType: "object",
        required: ["plant"],
        properties: { plant: { bsonType: "string" } },
      },
      visibility: { enum: ["public", "private"] },
      feedId: { bsonType: "string" },
      syncedAt: { bsonType: "string" },
    },
  });
  await applyValidator("pollen_cursors", {
    bsonType: "object",
    required: ["feedId", "lastSyncAt", "lastStatus"],
    properties: {
      feedId: { bsonType: "string" },
      cursor: { bsonType: ["string", "null"] },
      lastSyncAt: { bsonType: "string" },
      lastStatus: { bsonType: "string" },
    },
  });
  await applyValidator("pollen_refusals", {
    bsonType: "object",
    required: ["feedId", "at", "reason", "raw", "rawHash"],
    properties: {
      feedId: { bsonType: "string" },
      at: { bsonType: "string" },
      reason: { bsonType: "string" },
      raw: { bsonType: "string" },
      rawHash: { bsonType: "string" },
    },
  });
  await ensurePollenIndexes();
```

- [ ] **Step 2: Create `scripts/pollen-rebuild.ts`**

```ts
import { closeDb } from "../lib/db";
import { getFederation } from "../lib/federation";
import { runSync } from "../lib/pollen-run";
import { deleteFeedData } from "../lib/pollen-store";

// Full rebuild of one feed's slice of the cache (spec §3): wipe, then sync.
// A dev script, not an admin button — destructive paths stay deliberate.
async function main() {
  const feedId = process.argv[2];
  const { feeds } = getFederation();
  if (!feedId || !feeds.some((f) => f.id === feedId)) {
    console.error(`usage: npm run pollen:rebuild -- <feedId>  (one of: ${feeds.map((f) => f.id).join(", ")})`);
    process.exit(1);
  }
  console.log(`wiping feed ${feedId}…`);
  await deleteFeedData(feedId);
  const results = await runSync(feedId);
  console.log(JSON.stringify(results, null, 2));
  await closeDb();
  if (results.some((r) => r.status === "error")) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Add the npm script**

In `package.json` scripts, after `"pollen:validate"`:

```json
    "pollen:rebuild": "node --env-file=.env.local --import tsx scripts/pollen-rebuild.ts",
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm test`
Expected: clean. (Running `npm run validators` against the real DB happens in Task 14.)

- [ ] **Step 5: Commit**

```bash
git add scripts/apply-validators.ts scripts/pollen-rebuild.ts package.json
git commit -m "feat: pollen validators, indexes, and the rebuild script"
```

---

### Task 13: Cron workflow, garden, docs

**Files:**
- Create: `.github/workflows/pollen-sync.yml`
- Modify: `data/garden.yml`, `docs/POLLEN.md`, `README.md`

- [ ] **Step 1: Create `.github/workflows/pollen-sync.yml`**

```yaml
# Slice 4: the read-model heartbeat. One secret, one POST — the sync door
# does the work server-side (ariko holds the upstream feed tokens; DB
# credentials move nowhere). Manual runs via workflow_dispatch.
name: pollen-sync

on:
  schedule:
    - cron: "0 */6 * * *"
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Call the sync door
        run: |
          curl -sS --fail-with-body -X POST "https://www.ariko.app/api/pollen/sync" \
            -H "Authorization: Bearer ${ARIKO_SYNC_TOKEN}"
        env:
          ARIKO_SYNC_TOKEN: ${{ secrets.ARIKO_SYNC_TOKEN }}
```

- [ ] **Step 2: Update `data/garden.yml`**

In the `arkaik-adapter` bee (~line 562): change `status: planned` to `status: live`, and change the description's tail — replace

```yaml
    description: Serves the arkaik journal as a pollen feed (slice 3, live producer-side); the Ariko read model ingests it in slice 4 — status flips to live then.
```

with

```yaml
    description: Serves the arkaik journal as a pollen feed (slice 3); ingested by the slice-4 read model into the beanstalk.
```

After the `arkaik-adapter` bee entry, add:

```yaml
  - slug: pollen-sync
    name: Pollen sync
    kind: workflow
    status: live
    engine: action
    schedule: every 6h
    levers:
      - label: workflow
        ref: .github/workflows/pollen-sync.yml
      - label: sync door
        ref: app/api/pollen/sync
      - label: feed config
        ref: data/federation.yml
    serves:
      - plant:ariko
    description: Pulls every configured pollen feed into the read model through the guarded sync door (slice 4); the beanstalk renders the result.
```

(Both `live` flips are claimed in the shipping PR itself, backed by the Task 14 acceptance run against the real feeds before merge.)

- [ ] **Step 3: Update `docs/POLLEN.md`**

In the "## Read — guarantees" section, change the parenthetical "(read model, slice 4)" sentence opener from:

```
Implemented ariko-side (read model, slice 4); stated here because
```

to:

```
Implemented ariko-side by the slice-4 read model
(`docs/superpowers/specs/2026-08-17-read-model-beanstalk-design.md`);
stated here because
```

- [ ] **Step 4: Update `README.md`**

Add a section (near the Lab Note pipeline / architecture docs, matching the README's heading style):

```markdown
## Federation read model (slice 4)

Ariko syncs every feed in `data/federation.yml` into a disposable Mongo
cache (`pollen`, `pollen_cursors`, `pollen_refusals`) through one guarded
door: `POST /api/pollen/sync` (bearer `SYNC_TOKEN`; cron:
`.github/workflows/pollen-sync.yml`, every 6 h, secret `ARIKO_SYNC_TOKEN`).
Upstream feed tokens live in Vercel env vars named by each feed's
`tokenEnv` (today: `ARKAIK_API_TOKEN`). The public `/beanstalk` merges
authored sprouts with feed events for plants in the config's `exhibit`
list; `/admin/beanstalk` shows everything plus sync status and refusals.
Rebuild one feed from scratch: `npm run pollen:rebuild -- <feedId>`.
Contract: [`docs/POLLEN.md`](docs/POLLEN.md) §Read.
```

- [ ] **Step 5: Verify and commit**

Run: `npm test` (the garden guard test, if present, must accept the new bee).

```bash
git add .github/workflows/pollen-sync.yml data/garden.yml docs/POLLEN.md README.md
git commit -m "feat: pollen-sync cron + garden bees live + federation docs"
```

---

### Task 14: Verification, acceptance, PR

**Files:** none new.

- [ ] **Step 1: Full local verification**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: everything green. Do not claim success without seeing the passing output.

- [ ] **Step 2: Configure secrets**

Needs the human (or pre-provisioned secrets):
- `.env.local`: `ARKAIK_API_TOKEN` (an arkaik `ark_` token with `graph:read` over both projects) and `SYNC_TOKEN` (generate: `openssl rand -hex 24`).
- Vercel env: the same two.
- GitHub repo secret: `ARIKO_SYNC_TOKEN` = the same `SYNC_TOKEN` value.

- [ ] **Step 3: Apply validators + indexes against the real DB**

Run: `npm run validators`
Expected: `validator applied: pollen` (+ cursors, refusals) with no errors.

- [ ] **Step 4: Acceptance sync against the real feeds**

Run locally: `npm run dev`, then in a second shell:

```bash
curl -sS -X POST http://localhost:3000/api/pollen/sync -H "Authorization: Bearer $(grep '^SYNC_TOKEN=' .env.local | cut -d= -f2)"
```

Expected: `{"results":[{"feedId":"arkaik-pbbls","stored":<n>,…,"status":"ok"},{"feedId":"arkaik-arkaik",…}]}` with `stored > 0` on at least one feed. Re-run the same curl: every `stored` is `0` (idempotent). Then check:
- `http://localhost:3000/beanstalk` shows pollen lines interleaved with sprouts, plant filter works on both kinds;
- `http://localhost:3000/admin/beanstalk` shows cursors `ok`, the full union, and Sync now round-trips;
- `/timeline` redirects to `/beanstalk`.

If a feed 404s: its arkaik project has no federation config (plant slug) yet — that is arkaik-side setup from slice 3, fix there, not here.

- [ ] **Step 5: Rebuild drill**

```bash
npm run pollen:rebuild -- arkaik-pbbls
```

Expected: wipe log, then a sync result storing the same envelope count as the first-ever sync; the beanstalk renders identically.

- [ ] **Step 6: Open the PR (with Lab Note)**

```bash
git push -u origin HEAD
gh pr create --title "Slice 4 — read model + beanstalk: ariko reads the federation" --body "$(cat <<'EOF'
Implements docs/superpowers/specs/2026-08-17-read-model-beanstalk-design.md
(plan: docs/superpowers/plans/2026-08-17-read-model-beanstalk.md).

Cursor-synced pollen cache (write-once, rebuildable, refusals surfaced),
projected-bean machinery, the /beanstalk page (public + admin), the guarded
sync door + 6-hourly Action, arkaik-adapter flipped live.

## Lab Note

```yaml
en:
  title: The beanstalk — one timeline for everything growing
  summary: The timeline is now the beanstalk — alongside hand-published updates, it weaves in what ships across the whole practice, straight from each project's own journal.
fr:
  title: Le beanstalk — une seule frise pour tout ce qui pousse
  summary: La frise devient le beanstalk — en plus des publications choisies à la main, tu y vois pousser ce qui avance dans tous les projets, directement depuis leurs journaux.
suggested:
  molecule: ariko
  type: feature
  tags: [changelog]
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 7: After merge**

Confirm the Vercel deploy, dispatch `pollen-sync` once from the Actions tab, and check `https://www.ariko.app/beanstalk`.

---

### Task 15 (optional tail): Paulopus bootstrap

Droppable without touching acceptance (spec §9). Work happens in the **paulopus repo** plus two lines here.

- [ ] **Step 1: In the paulopus repo, create `pollen/feed.ndjson`**

Hand-curate ~10–20 milestone envelopes, one JSON object per line, `source: "paulopus"`, `anchors: { "plant": "plant:paulopus" }`, ids `paulopus:<slug>`, dates from real history. First line example:

```json
{"v":1,"id":"paulopus:launch","at":"2026-06-12T09:00:00Z","source":"paulopus","kind":"published","title":{"en":"Paulopus is live","fr":"Paulopus est en ligne"},"anchors":{"plant":"plant:paulopus"},"refs":[{"label":"site","url":"https://paulopus.vercel.app"}]}
```

- [ ] **Step 2: Validate from the ariko repo**

```bash
npm run pollen:validate -- ../paulopus/pollen/feed.ndjson
```

Expected: every line valid, zero errors (warnings acceptable only for non-core kinds).

- [ ] **Step 3: Commit the file in paulopus, then wire it in ariko**

In `data/federation.yml`, uncomment/add:

```yaml
  - id: paulopus
    source: paulopus
    transport: file
    url: https://raw.githubusercontent.com/<owner>/paulopus/main/pollen/feed.ndjson
```

and under `exhibit:` add `- plant:paulopus` (a `paulopus` plant must exist in the garden — check `data/garden.yml`/Mongo `plants`; if absent, that is a garden content addition, made the same way the other plants were seeded).

- [ ] **Step 4: Sync and verify**

Run the acceptance curl from Task 14 step 4; the paulopus history appears on the beanstalk. Commit:

```bash
git add data/federation.yml
git commit -m "feat: paulopus bootstrap — committed feed file joins the beanstalk"
```

---

## Deferred to later specs / follow-ups

- Slice 5 (weekly digest) queries `pollen` + the map through ariko's own APIs — first synthesis brick, first engine decision.
- `corrects`-aware rendering (collapse correction chains); pod projection; dispatch status-arc special handling — all additive over this cache.
- Refusal row deletion/hygiene UI (manual DB for now).
- Melogram feed (slice 6) exercises projected beans with real bean anchors.
