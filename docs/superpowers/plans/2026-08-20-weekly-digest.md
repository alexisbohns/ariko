# Weekly Digest (Slice 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Claude routine drafts one digest sprout per plant per ISO week plus a cross-plant wrap, through a new token-guarded synthesis read/write door pair; the human reviews and publishes in the existing admin.

**Architecture:** Pure builders in `lib/synthesis.ts` (week math, bucketing, batch validation) + thin Mongo glue in `lib/synthesis-store.ts` + two Next.js route handlers guarded by `SYNTHESIS_TOKEN` (slice-4 `SYNC_TOKEN` pattern). Digest containers are four curated beans added to `garden.yml`; the machine writes only draft sprouts (no `state`), upserted by deterministic slug, never overwriting a sprout whose `state` is set. Spec: `docs/superpowers/specs/2026-08-20-weekly-digest-design.md`.

**Tech Stack:** Next.js 15 app router, MongoDB driver, node:test via tsx (`npm test`). No new dependencies.

---

### Task 1: Week math + slug grammar (pure)

**Files:**
- Create: `lib/synthesis.ts`
- Test: `lib/synthesis.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/synthesis.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isoWeekId,
  weekBounds,
  digestSlug,
  wrapSlug,
  isValidWeekId,
} from "./synthesis";

test("isoWeekId: maps dates to ISO weeks incl. year boundaries", () => {
  assert.equal(isoWeekId("2026-08-17"), "2026-W34"); // a Monday
  assert.equal(isoWeekId("2026-08-23"), "2026-W34"); // its Sunday
  assert.equal(isoWeekId("2026-01-01"), "2026-W01"); // Thu → week 1 of 2026
  assert.equal(isoWeekId("2027-01-01"), "2026-W53"); // Fri → belongs to 2026
});

test("weekBounds: Monday through Sunday, date-only strings", () => {
  assert.deepEqual(weekBounds("2026-W34"), {
    start: "2026-08-17",
    end: "2026-08-23",
  });
  assert.deepEqual(weekBounds("2026-W01"), {
    start: "2025-12-29",
    end: "2026-01-04",
  });
});

test("weekBounds and isoWeekId round-trip", () => {
  const { start, end } = weekBounds("2026-W34");
  assert.equal(isoWeekId(start), "2026-W34");
  assert.equal(isoWeekId(end), "2026-W34");
});

test("week id grammar", () => {
  assert.ok(isValidWeekId("2026-W34"));
  assert.ok(!isValidWeekId("2026-w34")); // ids are uppercase; slugs are lowercase
  assert.ok(!isValidWeekId("2026-W60"));
  assert.ok(!isValidWeekId("garbage"));
});

test("digest slugs are lowercase and deterministic", () => {
  assert.equal(digestSlug("pbbls", "2026-W34"), "digest-pbbls-2026-w34");
  assert.equal(wrapSlug("2026-W34"), "weekly-wrap-2026-w34");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test lib/synthesis.test.ts`
Expected: FAIL — `Cannot find module './synthesis'`

- [ ] **Step 3: Implement**

```typescript
// lib/synthesis.ts
// Pure synthesis builders (slice 5 spec §3–§4): week math, slug grammar,
// bucketing and batch validation. No I/O — Mongo glue lives in
// synthesis-store.ts, the doors in app/api/synthesis/.

const WEEK_RE = /^(\d{4})-W(\d{2})$/;

export function isValidWeekId(week: string): boolean {
  const m = WEEK_RE.exec(week);
  if (!m) return false;
  const n = Number(m[2]);
  return n >= 1 && n <= 53;
}

// Date-only strings throughout ("YYYY-MM-DD"); computed in UTC, which is
// exact for date-only inputs (the Europe/Paris framing in the spec only
// matters for the routine's run time, not for date arithmetic).
function toDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}
function toDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isoWeekId(day: string): string {
  const d = toDate(day);
  // ISO 8601: the week belongs to the year of its Thursday.
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function weekBounds(week: string): { start: string; end: string } {
  const m = WEEK_RE.exec(week);
  if (!m || !isValidWeekId(week)) throw new Error(`invalid week id: ${week}`);
  const [, year, num] = m;
  // Jan 4 is always in week 1; walk back to its Monday, then forward.
  const jan4 = new Date(Date.UTC(Number(year), 0, 4));
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1));
  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (Number(num) - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start: toDay(start), end: toDay(end) };
}

export function digestSlug(plantSlug: string, week: string): string {
  return `digest-${plantSlug}-${week.toLowerCase()}`;
}

export function wrapSlug(week: string): string {
  return `weekly-wrap-${week.toLowerCase()}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test lib/synthesis.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/synthesis.ts lib/synthesis.test.ts
git commit -m "feat: synthesis week math and digest slug grammar"
```

---

### Task 2: Week bucketing + quiet-plant derivation (pure)

**Files:**
- Modify: `lib/synthesis.ts` (append)
- Test: `lib/synthesis.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `lib/synthesis.test.ts`:

```typescript
import { bucketWeek, DIGEST_TYPE, type WindowSprout } from "./synthesis";
import type { PollenDoc } from "./pollen-sync";

function env(id: string, at: string, plant: string): PollenDoc {
  return {
    v: 1,
    id,
    at,
    source: "arkaik",
    anchors: { plant: `plant:${plant}` },
    kind: "deliverable.shipped",
    title: `t-${id}`,
  } as PollenDoc;
}
function ws(slug: string, date: string, plant: string | null, type = "note"): WindowSprout {
  return { slug, type, date, plantSlug: plant, name: slug, description: "" };
}

test("bucketWeek: window-filters, groups per plant, derives quiet", () => {
  const bounds = { start: "2026-08-17", end: "2026-08-23" };
  const out = bucketWeek(
    [
      env("p1", "2026-08-18T10:00:00Z", "pbbls"),
      env("p2", "2026-08-16T10:00:00Z", "pbbls"), // before window
      env("p3", "2026-08-23T23:59:00Z", "arkaik"), // Sunday counts
    ],
    [
      ws("s1", "2026-08-19", "ariko"),
      ws("s2", "2026-08-25", "ariko"), // after window
      ws("s3", "2026-08-19", null), // unresolvable plant → dropped
    ],
    ["pbbls", "arkaik", "ariko", "femfolk"],
    bounds,
  );
  assert.deepEqual(Object.keys(out.plants).sort(), ["ariko", "arkaik", "pbbls"].sort());
  assert.equal(out.plants["pbbls"].envelopes.length, 1);
  assert.equal(out.plants["arkaik"].envelopes.length, 1);
  assert.equal(out.plants["ariko"].sprouts.length, 1);
  assert.deepEqual(out.quiet, ["femfolk"]);
});

test("bucketWeek: digest sprouts never narrate themselves", () => {
  const bounds = { start: "2026-08-17", end: "2026-08-23" };
  const out = bucketWeek(
    [],
    [ws("digest-pbbls-2026-w33", "2026-08-17", "pbbls", DIGEST_TYPE)],
    ["pbbls"],
    bounds,
  );
  assert.deepEqual(out.plants, {});
  assert.deepEqual(out.quiet, ["pbbls"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test lib/synthesis.test.ts`
Expected: FAIL — `bucketWeek` not exported

- [ ] **Step 3: Implement**

Append to `lib/synthesis.ts`:

```typescript
import type { PollenDoc } from "./pollen-sync";
import { PLANT_PREFIX } from "./data";

export const DIGEST_TYPE = "digest";

// The store's flattening of a TimelineEntry — just what narration needs.
export interface WindowSprout {
  slug: string;
  type: string;
  date: string;
  plantSlug: string | null;
  name: string;
  description: string;
}

export interface WeekBuckets {
  plants: Record<string, { envelopes: PollenDoc[]; sprouts: WindowSprout[] }>;
  quiet: string[];
}

// Pure. Date-part comparison on both sides (pollen `at` is a timestamp,
// sprout dates are date-only — same convention as mergeBeanstalk). Sprouts
// of DIGEST_TYPE are excluded: the digest never narrates itself (spec §4).
export function bucketWeek(
  pollen: PollenDoc[],
  sprouts: WindowSprout[],
  roster: string[],
  bounds: { start: string; end: string },
): WeekBuckets {
  const inWindow = (day: string) => day >= bounds.start && day <= bounds.end;
  const plants: WeekBuckets["plants"] = {};
  const bucket = (slug: string) =>
    (plants[slug] ??= { envelopes: [], sprouts: [] });

  for (const p of pollen) {
    if (!inWindow(p.at.slice(0, 10))) continue;
    bucket(p.anchors.plant.slice(PLANT_PREFIX.length)).envelopes.push(p);
  }
  for (const s of sprouts) {
    if (s.type === DIGEST_TYPE) continue;
    if (!s.plantSlug || !inWindow(s.date.slice(0, 10))) continue;
    bucket(s.plantSlug).sprouts.push(s);
  }
  const quiet = roster.filter((slug) => !(slug in plants));
  return { plants, quiet };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test lib/synthesis.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/synthesis.ts lib/synthesis.test.ts
git commit -m "feat: week bucketing and quiet-plant derivation"
```

---

### Task 3: Draft batch validation (pure)

**Files:**
- Modify: `lib/synthesis.ts` (append)
- Test: `lib/synthesis.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `lib/synthesis.test.ts`:

```typescript
import { validateDigestBatch, type DraftSprout } from "./synthesis";

const BEANS = new Set(["digest-pbbls", "digest-ariko", "weekly-wrap"]);
function draft(over: Partial<DraftSprout> = {}): DraftSprout {
  return {
    slug: "digest-pbbls-2026-w34",
    name: "Week 34",
    date: "2026-08-23",
    parents: ["bean:digest-pbbls"],
    content: "The week in pbbls…",
    ...over,
  };
}

test("validateDigestBatch: accepts a well-formed batch", () => {
  const r = validateDigestBatch("2026-W34", [
    draft(),
    draft({ slug: "weekly-wrap-2026-w34", parents: ["bean:weekly-wrap"] }),
  ], BEANS);
  assert.deepEqual(r, { ok: true });
});

test("validateDigestBatch: rejections name the offending sprout", () => {
  const bad = (sprouts: DraftSprout[], week = "2026-W34") => {
    const r = validateDigestBatch(week, sprouts, BEANS);
    assert.equal(r.ok, false);
    return r.ok === false ? r.error : "";
  };
  assert.match(bad([draft()], "garbage"), /invalid week/);
  assert.match(bad([draft({ slug: "digest-pbbls-2026-w33" })]), /2026-w33/); // week mismatch
  assert.match(bad([draft({ slug: "renamed-thing" })]), /renamed-thing/); // grammar
  assert.match(bad([draft({ parents: ["bean:nope"] })]), /nope/); // unknown bean
  assert.match(bad([draft({ parents: ["bean:digest-ariko"] })]), /digest-pbbls-2026-w34/); // slug/parent mismatch
  assert.match(
    bad([draft({ state: "published" } as unknown as DraftSprout)]),
    /state/,
  ); // the door cannot publish
  assert.match(bad([draft({ content: "x".repeat(32769) })]), /32KiB/);
  assert.match(bad([draft({ name: " " })]), /name/);
  assert.match(bad([draft(), draft()]), /duplicate/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test lib/synthesis.test.ts`
Expected: FAIL — `validateDigestBatch` not exported

- [ ] **Step 3: Implement**

Append to `lib/synthesis.ts` (add `BEAN_PREFIX` to the existing `./data` import):

```typescript
export interface DraftSprout {
  slug: string;
  name: string;
  date: string;
  parents: string[]; // exactly one "bean:digest-…" / "bean:weekly-wrap" ref
  content: string;
  description?: string;
}

const CONTENT_CAP = 32 * 1024;

// Pure, all-or-nothing (spec §4): first failure names the sprout and rejects
// the batch. `state` is checked on the RAW object — the door structurally
// cannot publish, so any state key at all is a refusal, whatever its value.
export function validateDigestBatch(
  week: string,
  sprouts: DraftSprout[],
  digestBeanSlugs: Set<string>,
): { ok: true } | { ok: false; error: string } {
  if (!isValidWeekId(week)) return { ok: false, error: `invalid week id: ${week}` };
  const seen = new Set<string>();
  for (const s of sprouts) {
    const who = s.slug || "(missing slug)";
    if ("state" in (s as Record<string, unknown>))
      return { ok: false, error: `${who}: state is not accepted on this door` };
    if (seen.has(s.slug)) return { ok: false, error: `duplicate slug: ${who}` };
    seen.add(s.slug);
    if (!s.name?.trim()) return { ok: false, error: `${who}: name is required` };
    if (typeof s.content !== "string" || s.content.length > CONTENT_CAP)
      return { ok: false, error: `${who}: content must be a string of at most 32KiB` };
    if (s.parents?.length !== 1 || !s.parents[0].startsWith(BEAN_PREFIX))
      return { ok: false, error: `${who}: parents must be exactly one bean ref` };
    const beanSlug = s.parents[0].slice(BEAN_PREFIX.length);
    if (!digestBeanSlugs.has(beanSlug))
      return { ok: false, error: `${who}: unknown digest bean ${beanSlug}` };
    // Slug grammar must match the parent bean AND the batch's week.
    const expected =
      beanSlug === "weekly-wrap"
        ? wrapSlug(week)
        : digestSlug(beanSlug.replace(/^digest-/, ""), week);
    if (s.slug !== expected)
      return { ok: false, error: `${who}: slug must be ${expected}` };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test lib/synthesis.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Run the full suite (regression)**

Run: `npm test`
Expected: all green (existing 280+ tests unaffected)

- [ ] **Step 6: Commit**

```bash
git add lib/synthesis.ts lib/synthesis.test.ts
git commit -m "feat: digest draft batch validation — the door cannot publish"
```

---

### Task 4: Mongo glue — `lib/synthesis-store.ts`

Thin, house-pattern (like `pollen-store.ts`): no unit tests on the glue itself; the decision logic it calls is pure and already tested. The one pure decision it owns — refuse overwriting reviewed sprouts — is factored out and tested.

**Files:**
- Create: `lib/synthesis-store.ts`
- Test: `lib/synthesis.test.ts` (append — pure part only)

- [ ] **Step 1: Write the failing test for the overwrite guard**

Append to `lib/synthesis.test.ts`:

```typescript
import { refusedOverwrites } from "./synthesis";

test("refusedOverwrites: any existing state refuses; absent state is overwritable", () => {
  const existing = new Map<string, string | undefined>([
    ["digest-pbbls-2026-w34", undefined], // draft → overwritable
    ["weekly-wrap-2026-w34", "published"], // reviewed → refuse
  ]);
  assert.deepEqual(
    refusedOverwrites(["digest-pbbls-2026-w34", "weekly-wrap-2026-w34", "digest-ariko-2026-w34"], existing),
    ["weekly-wrap-2026-w34"],
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test lib/synthesis.test.ts`
Expected: FAIL — `refusedOverwrites` not exported

- [ ] **Step 3: Implement the pure guard in `lib/synthesis.ts`**

```typescript
// Pure. incoming slugs → the subset that must NOT be overwritten because the
// stored sprout has ANY state set (reviewed is a human act; spec §3).
export function refusedOverwrites(
  incoming: string[],
  existingStates: Map<string, string | undefined>,
): string[] {
  return incoming.filter(
    (slug) => existingStates.has(slug) && existingStates.get(slug) !== undefined,
  );
}
```

Run: `node --import tsx --test lib/synthesis.test.ts` → PASS (10 tests)

- [ ] **Step 4: Write the store glue**

```typescript
// lib/synthesis-store.ts
import { getDb } from "./db";
import { buildDataset } from "./data";
import { loadRawGarden } from "./store";
import { listPollen } from "./pollen-store";
import {
  DIGEST_TYPE,
  refusedOverwrites,
  type DraftSprout,
  type WindowSprout,
} from "./synthesis";
import type { Sprout } from "./data";
import { resolveText } from "./data";

// Mongo glue for the synthesis doors (slice 5 spec §4). Reads reuse the
// slice-4 stores; the only write is the draft upsert below.

export interface WeekMaterial {
  pollen: Awaited<ReturnType<typeof listPollen>>;
  sprouts: WindowSprout[];
  roster: string[];
}

// FULL union (private included) — the read door is guarded (spec §2).
export async function loadWeekMaterial(): Promise<WeekMaterial> {
  const raw = await loadRawGarden();
  const dataset = buildDataset(raw);
  const sprouts: WindowSprout[] = dataset.timelineSprouts().map((e) => ({
    slug: e.sprout.slug,
    type: e.sprout.type,
    date: e.sprout.date,
    plantSlug: e.plant?.slug ?? null,
    name: resolveText(e.sprout.name),
    description: resolveText(e.sprout.description),
  }));
  return {
    pollen: await listPollen(),
    sprouts,
    roster: (raw.plants ?? []).map((p) => p.slug),
  };
}

// The curated digest containers: beans whose slug is weekly-wrap or digest-*.
export async function listDigestBeanSlugs(): Promise<Set<string>> {
  const db = await getDb();
  const beans = await db
    .collection<{ slug: string }>("beans")
    .find(
      { slug: { $in: [/^digest-/, "weekly-wrap"] } },
      { projection: { _id: 0, slug: 1 } },
    )
    .toArray();
  return new Set(beans.map((b) => b.slug));
}

// All-or-nothing draft upsert. Pre-checks every slug's stored state, then
// writes; refusals abort the whole batch (spec §3 idempotency).
export async function upsertDigestDrafts(
  drafts: DraftSprout[],
): Promise<{ ok: true; written: number } | { ok: false; refused: string[] }> {
  const db = await getDb();
  const slugs = drafts.map((d) => d.slug);
  const existing = await db
    .collection<Sprout>("sprouts")
    .find({ slug: { $in: slugs } }, { projection: { _id: 0, slug: 1, state: 1 } })
    .toArray();
  const states = new Map(existing.map((s) => [s.slug, s.state as string | undefined]));
  const refused = refusedOverwrites(slugs, states);
  if (refused.length > 0) return { ok: false, refused };
  for (const d of drafts) {
    // $set never includes `state`: a fresh insert has none (draft), and a
    // re-run leaves an existing (absent) state untouched.
    await db.collection("sprouts").updateOne(
      { slug: d.slug },
      {
        $set: {
          name: d.name,
          type: DIGEST_TYPE,
          date: d.date,
          parents: d.parents,
          content: d.content,
          description: d.description ?? "",
        },
        $unset: { state: "" },
      },
      { upsert: true },
    );
  }
  return { ok: true, written: drafts.length };
}
```

Note: `$unset: { state: "" }` is safe — the pre-check already guaranteed no
targeted sprout has a state, so this only normalizes documents that never had
one.

- [ ] **Step 5: Typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: clean, all green. If `resolveText` or `timelineSprouts` signatures differ from the above, adjust the store (not the pure lib) to match `lib/data.ts`.

- [ ] **Step 6: Commit**

```bash
git add lib/synthesis.ts lib/synthesis.test.ts lib/synthesis-store.ts
git commit -m "feat: synthesis store glue — week material, digest beans, draft upsert"
```

---

### Task 5: The read door — `GET /api/synthesis/week`

**Files:**
- Create: `app/api/synthesis/week/route.ts`
- Test: `lib/synthesis-week-route.test.ts`

- [ ] **Step 1: Write the failing tests** (auth + grammar only — the DB path is exercised in acceptance, house pattern of `pollen-sync-route.test.ts`)

```typescript
// lib/synthesis-week-route.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/synthesis/week/route";

function req(week: string, auth?: string): Request {
  return new Request(`http://localhost/api/synthesis/week?week=${week}`, {
    headers: auth ? { authorization: auth } : {},
  });
}

test("week door: SYNTHESIS_TOKEN unset refuses everything (fail closed)", async () => {
  delete process.env.SYNTHESIS_TOKEN;
  assert.equal((await GET(req("2026-W34", "Bearer anything"))).status, 401);
});

test("week door: wrong or missing token is 401", async () => {
  process.env.SYNTHESIS_TOKEN = "tok_syn_test";
  try {
    assert.equal((await GET(req("2026-W34"))).status, 401);
    assert.equal((await GET(req("2026-W34", "Bearer wrong"))).status, 401);
  } finally {
    delete process.env.SYNTHESIS_TOKEN;
  }
});

test("week door: bad week id is 400 (before any DB touch)", async () => {
  process.env.SYNTHESIS_TOKEN = "tok_syn_test";
  try {
    const res = await GET(req("garbage", "Bearer tok_syn_test"));
    assert.equal(res.status, 400);
  } finally {
    delete process.env.SYNTHESIS_TOKEN;
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test lib/synthesis-week-route.test.ts`
Expected: FAIL — route module missing

- [ ] **Step 3: Implement**

```typescript
// app/api/synthesis/week/route.ts
import { hasValidToken } from "../../../../lib/auth";
import { bucketWeek, isValidWeekId, weekBounds } from "../../../../lib/synthesis";
import { loadWeekMaterial } from "../../../../lib/synthesis-store";

// Guarded synthesis read door (slice 5 spec §4): the machine-readable twin of
// the beanstalk union, UNFILTERED — private envelopes and unpublished sprouts
// included, which is exactly why the token is not optional. Fail closed.
export async function GET(request: Request): Promise<Response> {
  const token = process.env.SYNTHESIS_TOKEN;
  const tokens = token
    ? new Map([[token, new Set(["*"])]])
    : new Map<string, Set<string>>();
  if (!hasValidToken(request.headers.get("authorization"), tokens)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const week = new URL(request.url).searchParams.get("week") ?? "";
  if (!isValidWeekId(week)) {
    return Response.json({ error: `invalid week id: ${week}` }, { status: 400 });
  }
  const bounds = weekBounds(week);
  const material = await loadWeekMaterial();
  const { plants, quiet } = bucketWeek(
    material.pollen,
    material.sprouts,
    material.roster,
    bounds,
  );
  return Response.json({
    week: { id: week, ...bounds },
    plants,
    quiet,
    roster: material.roster,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test lib/synthesis-week-route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/synthesis/week/route.ts lib/synthesis-week-route.test.ts
git commit -m "feat: guarded synthesis read door — the week window, full union"
```

---

### Task 6: The write door — `POST /api/synthesis`

**Files:**
- Create: `app/api/synthesis/route.ts`
- Test: `lib/synthesis-route.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/synthesis-route.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/synthesis/route";

function req(body: unknown, auth?: string): Request {
  return new Request("http://localhost/api/synthesis", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  });
}

test("write door: SYNTHESIS_TOKEN unset refuses everything (fail closed)", async () => {
  delete process.env.SYNTHESIS_TOKEN;
  assert.equal((await POST(req({}, "Bearer anything"))).status, 401);
});

test("write door: wrong or missing token is 401", async () => {
  process.env.SYNTHESIS_TOKEN = "tok_syn_test";
  try {
    assert.equal((await POST(req({}))).status, 401);
    assert.equal((await POST(req({}, "Bearer wrong"))).status, 401);
  } finally {
    delete process.env.SYNTHESIS_TOKEN;
  }
});

test("write door: malformed body and bad week are 400 before any DB touch", async () => {
  process.env.SYNTHESIS_TOKEN = "tok_syn_test";
  try {
    const raw = new Request("http://localhost/api/synthesis", {
      method: "POST",
      headers: { authorization: "Bearer tok_syn_test" },
      body: "not json",
    });
    assert.equal((await POST(raw)).status, 400);
    assert.equal((await POST(req({ week: "garbage", sprouts: [] }, "Bearer tok_syn_test"))).status, 400);
    assert.equal((await POST(req({ week: "2026-W34" }, "Bearer tok_syn_test"))).status, 400); // sprouts missing
  } finally {
    delete process.env.SYNTHESIS_TOKEN;
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test lib/synthesis-route.test.ts`
Expected: FAIL — route module missing

- [ ] **Step 3: Implement**

```typescript
// app/api/synthesis/route.ts
import { hasValidToken } from "../../../lib/auth";
import {
  isValidWeekId,
  validateDigestBatch,
  type DraftSprout,
} from "../../../lib/synthesis";
import {
  listDigestBeanSlugs,
  upsertDigestDrafts,
} from "../../../lib/synthesis-store";

// Guarded synthesis write door (slice 5 spec §4): drafts only, all-or-nothing.
// Validation order: token → shape → week grammar (no DB yet) → batch guard
// against the curated digest beans → upsert, which itself refuses to touch
// any sprout whose state is set (409). The door structurally cannot publish.
export async function POST(request: Request): Promise<Response> {
  const token = process.env.SYNTHESIS_TOKEN;
  const tokens = token
    ? new Map([[token, new Set(["*"])]])
    : new Map<string, Set<string>>();
  if (!hasValidToken(request.headers.get("authorization"), tokens)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { week?: unknown; sprouts?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const week = typeof body.week === "string" ? body.week : "";
  if (!isValidWeekId(week) || !Array.isArray(body.sprouts)) {
    return Response.json(
      { error: "body must be { week: 'YYYY-Wnn', sprouts: [...] }" },
      { status: 400 },
    );
  }
  const sprouts = body.sprouts as DraftSprout[];
  const beans = await listDigestBeanSlugs();
  const check = validateDigestBatch(week, sprouts, beans);
  if (!check.ok) return Response.json({ error: check.error }, { status: 400 });
  const result = await upsertDigestDrafts(sprouts);
  if (!result.ok) {
    return Response.json(
      { error: "refused: reviewed sprouts are not overwritable", refused: result.refused },
      { status: 409 },
    );
  }
  return Response.json({ week, written: result.written });
}
```

- [ ] **Step 4: Run tests, then the full suite**

Run: `node --import tsx --test lib/synthesis-route.test.ts` → PASS (3 tests)
Run: `npm test` → all green

- [ ] **Step 5: Commit**

```bash
git add app/api/synthesis/route.ts lib/synthesis-route.test.ts
git commit -m "feat: guarded synthesis write door — draft upsert, cannot publish"
```

---

### Task 7: Curated digest beans in `garden.yml`

**Files:**
- Modify: `data/garden.yml` (beans section)

- [ ] **Step 1: Add the four containers**

Append to the `beans:` list in `data/garden.yml`, following the file's existing entry style:

```yaml
  # Slice 5 — digest containers (spec §3). Private: the shelter cascade keeps
  # even PUBLISHED digest sprouts off the public beanstalk; publish here means
  # reviewed-and-final. The machine writes sprouts only, never beans.
  - slug: digest-pbbls
    name: Weekly digests — pbbls
    parents: ["plant:pbbls"]
    visibility: private
    description: One machine-drafted digest sprout per week of pbbls activity.
  - slug: digest-arkaik
    name: Weekly digests — arkaik
    parents: ["plant:arkaik"]
    visibility: private
    description: One machine-drafted digest sprout per week of arkaik activity.
  - slug: digest-ariko
    name: Weekly digests — ariko
    parents: ["plant:ariko"]
    visibility: private
    description: One machine-drafted digest sprout per week of ariko activity.
  - slug: weekly-wrap
    name: Weekly wrap
    parents: ["plant:ariko"]
    visibility: private
    description: The cross-plant weekly wrap — lede, tally, quiet plants, next. References the per-plant digests, never restates them.
```

(If the existing beans use bilingual `name: {en: …, fr: …}` maps, match that shape.)

- [ ] **Step 2: Validate + regression**

Run: `npm test`
Expected: green — the garden smoke-parse test (slice 1) picks the new beans up; a failure here means a YAML or shape mistake.

- [ ] **Step 3: Commit**

```bash
git add data/garden.yml
git commit -m "chore: garden — digest container beans for slice 5"
```

Deploy note (for the acceptance task): merging deploys the app, then `npm run migrate` imports the new beans into prod Mongo (idempotent, like every prior garden change).

---

### Task 8: Routine instructions + acceptance + bee flip

**Files:**
- Create: `docs/synthesis/weekly-digest-routine.md`
- Modify: `data/garden.yml` (the `weekly-digest` bee, ~line 611)

- [ ] **Step 1: Write the routine instructions doc**

Create `docs/synthesis/weekly-digest-routine.md` with the exact prompt to paste into a claude.ai scheduled routine (paulopus-writer pattern — the doc is the versioned source of truth for the prompt):

````markdown
# Weekly digest routine (slice 5)

Scheduled: Mondays 07:00 Europe/Paris. Cloud env needs `SYNTHESIS_TOKEN`.

## Routine prompt

You are ariko's weekly-digest bee. Draft last week's digest and wrap, then stop.

1. Compute last ISO week's id (Monday–Sunday, Europe/Paris; today is Monday, so last week ended yesterday). Call it WEEK, e.g. `2026-W34`.
2. Read the window:
   `curl -fsS -H "Authorization: Bearer $SYNTHESIS_TOKEN" "https://www.ariko.app/api/synthesis/week?week=WEEK"`
3. For each plant in `plants` (skip empty buckets), write one digest sprout:
   - slug `digest-<plant>-<week lowercase>`, parents `["bean:digest-<plant>"]`, date = the week's Sunday, name "Week NN".
   - content: concise markdown narrating that plant's week from its envelopes and sprouts — milestones first, then notable work; every claim links down into a source (PR URL from the envelope refs when present). No filler; a two-line week is a two-line digest.
4. Write the wrap sprout: slug `weekly-wrap-<week lowercase>`, parents `["bean:weekly-wrap"]`, same date. Content, in order: a one-sentence cross-plant lede (the week's thesis); a tally line (commits/envelopes per plant, active plant count); the quiet plants from `quiet`; a one-line "next" if the material suggests one. Reference the plant digests — never restate their content.
5. POST everything in ONE batch:
   `curl -fsS -X POST -H "Authorization: Bearer $SYNTHESIS_TOKEN" -H "content-type: application/json" -d @batch.json "https://www.ariko.app/api/synthesis"`
   with `batch.json` = `{"week": "WEEK", "sprouts": [ ...all drafts... ]}`.
6. If a call fails, retry it once. If it fails again, stop and report the error verbatim — do not retry the batch piecemeal; the door is all-or-nothing.
7. Never include a `state` field. Drafts are reviewed and published by a human in the admin.
````

- [ ] **Step 2: Provision secrets (manual, with the user)**

1. Generate a token: `openssl rand -hex 32`.
2. Vercel → ariko project → env var `SYNTHESIS_TOKEN` (production) → redeploy.
3. claude.ai → the cloud environment used by routines → add `SYNTHESIS_TOKEN` with the same value.
4. Add the token to local `.env.local` too (acceptance below).

- [ ] **Step 3: Acceptance — exercise both doors for real**

Against production after deploy (or locally with `.env.local` first):

```bash
# Read: current week window; expect plants buckets + quiet + roster
curl -fsS -H "Authorization: Bearer $SYNTHESIS_TOKEN" \
  "https://www.ariko.app/api/synthesis/week?week=2026-W34" | head -c 600

# Write: hand-feed the week-33 wrap as backfill (content from the week-33
# artifact). Expect {"week":"2026-W33","written":1}.
curl -fsS -X POST -H "Authorization: Bearer $SYNTHESIS_TOKEN" \
  -H "content-type: application/json" \
  -d '{"week":"2026-W33","sprouts":[{"slug":"weekly-wrap-2026-w33","name":"Week 33","date":"2026-08-16","parents":["bean:weekly-wrap"],"content":"…week-33 wrap markdown…"}]}' \
  "https://www.ariko.app/api/synthesis"

# Idempotency: re-run the POST → same 200. Then publish the sprout in the
# admin and re-run → 409 with refused: ["weekly-wrap-2026-w33"].
# Check the admin beanstalk lists the draft; check the public beanstalk does NOT.
```

- [ ] **Step 4: Create the routine and flip the bee**

1. Create the claude.ai scheduled routine (Mondays 07:00 Europe/Paris) with the prompt from Step 1; note its routine id (`trig_…`).
2. Trigger one manual run for the current week; review the drafts in the admin.
3. Update the `weekly-digest` bee in `data/garden.yml`:

```yaml
  - slug: weekly-digest
    name: Weekly digest
    kind: routine
    status: live
    engine: claude-routine
    schedule: "Mondays 07:00 Europe/Paris"
    levers:
      - label: Routine
        ref: trig_REPLACE_WITH_REAL_ID
    serves:
      - plant:ariko
    description: Writes the weekly cross-plant digest of the beanstalk (slice 5) — one draft sprout per plant plus the wrap, through the guarded synthesis door.
```

- [ ] **Step 5: Final suite + commit**

```bash
npm test
git add docs/synthesis/weekly-digest-routine.md data/garden.yml
git commit -m "feat: weekly-digest bee live — routine instructions, garden flip"
```

---

## Self-review notes

- **Spec coverage:** §3 storage → Tasks 4, 7 (beans curated, drafts upserted, overwrite refusal); §4 doors → Tasks 5, 6 (incl. digest-type exclusion in Task 2 and the no-state guard in Task 3); §5 routine → Task 8; §6 rendering → no build (verified in Task 8 acceptance: admin shows drafts, public beanstalk does not); §7 testing → Tasks 1–6 pure/door tests + Task 8 acceptance.
- **Type consistency:** `DraftSprout`/`WindowSprout`/`refusedOverwrites` defined in Task 1–4's `lib/synthesis.ts` and imported by name in Tasks 4–6.
- Store glue field names (`timelineSprouts`, `resolveText`) were read from `lib/data.ts` at planning time; Task 4 Step 5 typechecks against the real signatures.
