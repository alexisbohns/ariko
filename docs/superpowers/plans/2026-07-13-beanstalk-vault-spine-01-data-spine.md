# Beanstalk Vault Spine — Plan 1: Data Spine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Beanstalk's content from a static `seed.yml` into MongoDB, extend the atomic model with the vault fields (visibility/state/media/source/localized content), and make the public site serve only published items — with the pure `buildDataset` core and its tests left intact.

**Architecture:** Keep `buildDataset(raw: RawSeed): Dataset` a pure, synchronous function. Change only *where the raw data comes from* (Mongo instead of a YAML read) and add one pure `filterPublic(raw)` step in front of the public build. The public zone builds from `filterPublic(rawFromDb)`; a future admin zone will build from the unfiltered raw. A one-time migration script seeds Mongo from the existing `seed.yml`.

**Tech Stack:** Next.js 15 (App Router, server components), TypeScript, MongoDB (`mongodb` driver), `node:test` + `tsx` for tests, `js-yaml` (migration only).

**Scope note (deliberate sequencing):** Per the spec, `name`/`description` become `LocalizedText`. Plan 1 keeps them as `string` because all current seed data is monolingual and the public render path renders them directly; the field type widens to `Text` in Plan 2 when the first bilingual (FR/EN) content is actually ingested. The `LocalizedText`/`Text`/`resolveText` primitives are still built here so later plans just use them.

---

## File Structure

- `lib/data.ts` — **modify.** Add vault types (`Visibility`, `VersionState`, `LocalizedText`, `Text`, `Media`, `Source`), extend `Molecule`/`Atom`/`Version` with optional vault fields, add pure `filterPublic()` and `resolveText()`. The existing `buildDataset` stays as-is.
- `lib/db.ts` — **create.** Cached MongoDB connection helper (`getDb()`).
- `lib/store.ts` — **create.** `loadRawSeed()` (reads the three collections into a `RawSeed`) and the async dataset accessors `getPublicDataset()` / `getFullDataset()`.
- `lib/visibility.test.ts` — **create.** Tests for `filterPublic()` (the no-leak invariant) and `resolveText()`.
- `lib/store.test.ts` — **create.** Env-guarded integration test for `loadRawSeed()` (skips when `MONGODB_URI` is unset).
- `scripts/migrate-seed.ts` — **create.** One-time upsert of `seed.yml` into Mongo, stamping `visibility: "public"` / `state: "published"`.
- `app/page.tsx`, `app/timeline/page.tsx`, `app/atom/[id]/page.tsx` — **modify.** Await `getPublicDataset()` instead of calling sync `getDataset()`.
- `package.json` — **modify.** Add `mongodb` dependency and a `migrate` script.
- `.env.local` — **create (local only, gitignored).** `MONGODB_URI`, `MONGODB_DB`.
- `.gitignore` — **modify.** Ignore `.env.local`.
- `lib/data.test.ts` — **unchanged.** Must still pass after every task.

---

## Task 0: Prerequisites — Mongo dependency, env, connection helper

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `.env.local`
- Create: `lib/db.ts`

- [ ] **Step 1: Add the MongoDB driver**

Run:
```bash
npm install mongodb@^6.10.0
```
Expected: `mongodb` appears under `dependencies` in `package.json`; `package-lock.json` updates.

- [ ] **Step 2: Provide a MongoDB and set env vars**

Use a MongoDB Atlas free cluster or a local instance (`docker run -d -p 27017:27017 --name beanstalk-mongo mongo:7`).

Create `.env.local` (local Docker example):
```
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=beanstalk
```

- [ ] **Step 3: Ignore `.env.local`**

Add this line to `.gitignore` (below `.DS_Store`):
```
.env.local
```

- [ ] **Step 4: Write the connection helper**

Create `lib/db.ts`:
```ts
import { MongoClient, type Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

// Cached across hot reloads / requests. Throws clearly if the URI is missing.
export async function getDb(): Promise<Db> {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.MONGODB_DB ?? "beanstalk");
  return db;
}
```

- [ ] **Step 5: Verify it compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore lib/db.ts
git commit -m "chore: add mongodb driver and connection helper"
```
(`.env.local` is intentionally not committed.)

---

## Task 1: Add vault types and extend the model (no behavior change)

**Files:**
- Modify: `lib/data.ts`
- Test: `lib/data.test.ts` (must still pass — no new test here; this task only widens types)

- [ ] **Step 1: Add the new type declarations**

In `lib/data.ts`, replace the existing `Domain` line and the `Molecule`/`Atom`/`Version` interfaces with the extended versions. Add the value-object types **above** `Molecule`:
```ts
export type Domain = "music" | "design" | "podcast";

export type Visibility = "private" | "public";
export type VersionState = "draft" | "private" | "published";

export interface LocalizedText {
  en?: string;
  fr?: string;
}
export type Text = string | LocalizedText;

export interface MediaEmbed {
  kind: "embed";
  provider: string; // soundcloud | spotify | deezer | ausha | youtube | vimeo | figma | ...
  url: string;
  embedId?: string;
}
export interface MediaImage {
  kind: "image";
  storageKey: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}
export type Media = MediaEmbed | MediaImage;

export interface Source {
  kind: string; // manual | github | changelog | arkaik | ...
  url?: string;
  externalId?: string;
  capturedAt?: string;
}

export interface Molecule {
  slug: string;
  name: string;
  domain: Domain;
  description: string;
  visibility?: Visibility; // default treated as "public"
  tags?: string[];
}

export interface Atom {
  slug: string;
  name: string;
  parents: string[]; // e.g. ["molecule:republic-of-masquerade"]
  visibility?: Visibility; // default treated as "public"
  tags?: string[];
}

export interface Version {
  slug: string;
  name: string;
  type: string;
  date: string;
  description: string;
  parents: string[]; // e.g. ["atom:rom-win"]
  state?: VersionState; // absent => NOT published (safe default)
  content?: Text; // optional rich markdown, localizable
  media?: Media[];
  source?: Source;
  tags?: string[];
  [key: string]: unknown; // flexible per-type properties
}
```

- [ ] **Step 2: Verify existing tests still pass (types are additive)**

Run:
```bash
npm test
```
Expected: all existing `lib/data.test.ts` tests PASS (the new fields are optional, so the synthetic seed and `buildDataset` are unaffected).

- [ ] **Step 3: Verify it compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/data.ts
git commit -m "feat: extend atomic model with vault fields (visibility, state, media, source, content)"
```

---

## Task 2: Pure `resolveText()` and `filterPublic()` with the no-leak invariant

**Files:**
- Modify: `lib/data.ts`
- Test: `lib/visibility.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/visibility.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { filterPublic, resolveText, type RawSeed } from "./data";

test("resolveText returns plain strings unchanged", () => {
  assert.equal(resolveText("hello"), "hello");
});

test("resolveText picks the requested language, falling back to en then fr", () => {
  assert.equal(resolveText({ en: "Hi", fr: "Salut" }, "fr"), "Salut");
  assert.equal(resolveText({ en: "Hi" }, "fr"), "Hi");
  assert.equal(resolveText({ fr: "Salut" }, "en"), "Salut");
  assert.equal(resolveText(undefined), "");
});

const raw: RawSeed = {
  molecules: [
    { slug: "m-pub", name: "Pub", domain: "music", description: "" },
    { slug: "m-priv", name: "Priv", domain: "music", description: "", visibility: "private" },
  ],
  atoms: [
    { slug: "a-pub", name: "A pub", parents: ["molecule:m-pub"] },
    { slug: "a-priv", name: "A priv", parents: ["molecule:m-pub"], visibility: "private" },
  ],
  versions: [
    { slug: "v-published", name: "Published", type: "song", date: "2026-01-01", description: "", parents: ["atom:a-pub"], state: "published" },
    { slug: "v-draft", name: "Draft", type: "song", date: "2026-01-02", description: "", parents: ["atom:a-pub"], state: "draft" },
    { slug: "v-private", name: "Private", type: "song", date: "2026-01-03", description: "", parents: ["atom:a-pub"], state: "private" },
    { slug: "v-nostate", name: "No state", type: "song", date: "2026-01-04", description: "", parents: ["atom:a-pub"] },
  ],
};

test("filterPublic keeps only published versions", () => {
  const slugs = (filterPublic(raw).versions ?? []).map((v) => v.slug);
  assert.deepEqual(slugs, ["v-published"]);
});

test("filterPublic drops private molecules and atoms, keeps the rest", () => {
  const out = filterPublic(raw);
  assert.deepEqual((out.molecules ?? []).map((m) => m.slug), ["m-pub"]);
  assert.deepEqual((out.atoms ?? []).map((a) => a.slug), ["a-pub"]);
});

test("filterPublic never leaks a draft, private, or stateless version", () => {
  const slugs = new Set((filterPublic(raw).versions ?? []).map((v) => v.slug));
  for (const leaked of ["v-draft", "v-private", "v-nostate"]) {
    assert.equal(slugs.has(leaked), false, `${leaked} must not be public`);
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
npm test
```
Expected: FAIL — `filterPublic` and `resolveText` are not exported from `./data`.

- [ ] **Step 3: Implement `resolveText` and `filterPublic`**

Append to `lib/data.ts` (after the `buildDataset` function is fine):
```ts
export function resolveText(value: Text | undefined, lang: "en" | "fr" = "en"): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value[lang] ?? value.en ?? value.fr ?? "";
}

// Public projection of the vault. The security-sensitive rule lives here:
// a Version is public ONLY when state === "published" (missing state hides it).
// Molecules/Atoms are structural: visible unless explicitly "private".
export function filterPublic(raw: RawSeed): RawSeed {
  return {
    molecules: (raw.molecules ?? []).filter((m) => m.visibility !== "private"),
    atoms: (raw.atoms ?? []).filter((a) => a.visibility !== "private"),
    versions: (raw.versions ?? []).filter((v) => v.state === "published"),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
npm test
```
Expected: PASS — all `lib/visibility.test.ts` tests, and existing `lib/data.test.ts` still green.

- [ ] **Step 5: Commit**

```bash
git add lib/data.ts lib/visibility.test.ts
git commit -m "feat: add resolveText and filterPublic (published-only projection)"
```

---

## Task 3: Load a `RawSeed` from Mongo (`lib/store.ts`)

**Files:**
- Create: `lib/store.ts`
- Test: `lib/store.test.ts`

- [ ] **Step 1: Write the env-guarded integration test**

Create `lib/store.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRawSeed } from "./store";

const hasDb = Boolean(process.env.MONGODB_URI);

test("loadRawSeed returns arrays for all three collections", { skip: !hasDb }, async () => {
  const raw = await loadRawSeed();
  assert.ok(Array.isArray(raw.molecules));
  assert.ok(Array.isArray(raw.atoms));
  assert.ok(Array.isArray(raw.versions));
});

test("loadRawSeed strips Mongo _id from documents", { skip: !hasDb }, async () => {
  const raw = await loadRawSeed();
  for (const doc of [...(raw.molecules ?? []), ...(raw.atoms ?? []), ...(raw.versions ?? [])]) {
    assert.equal("_id" in (doc as object), false);
  }
});
```

- [ ] **Step 2: Run to verify it skips (no DB in the default test run)**

Run:
```bash
npm test
```
Expected: the two `store` tests report as **skipped** (unless `MONGODB_URI` is set); everything else PASS. This fails first with a module-not-found error because `./store` does not exist yet.

- [ ] **Step 3: Implement `lib/store.ts`**

Create `lib/store.ts`:
```ts
import { getDb } from "./db";
import {
  buildDataset,
  filterPublic,
  type Atom,
  type Dataset,
  type Molecule,
  type RawSeed,
  type Version,
} from "./data";

export async function loadRawSeed(): Promise<RawSeed> {
  const db = await getDb();
  const [molecules, atoms, versions] = await Promise.all([
    db.collection<Molecule>("molecules").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection<Atom>("atoms").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection<Version>("versions").find({}, { projection: { _id: 0 } }).toArray(),
  ]);
  return { molecules, atoms, versions };
}

// Public site: published-only.
export async function getPublicDataset(): Promise<Dataset> {
  return buildDataset(filterPublic(await loadRawSeed()));
}

// Admin (used by later plans): everything.
export async function getFullDataset(): Promise<Dataset> {
  return buildDataset(await loadRawSeed());
}
```

- [ ] **Step 4: Run tests + typecheck**

Run:
```bash
npm test && npx tsc --noEmit
```
Expected: store tests skipped, all others PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/store.ts lib/store.test.ts
git commit -m "feat: load RawSeed from mongo + public/full dataset accessors"
```

---

## Task 4: Migration script — `seed.yml` → Mongo

**Files:**
- Create: `scripts/migrate-seed.ts`
- Modify: `package.json` (add `migrate` script)

- [ ] **Step 1: Write the migration script**

Create `scripts/migrate-seed.ts`:
```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { getDb } from "../lib/db";
import type { RawSeed } from "../lib/data";

async function main() {
  const file = readFileSync(join(process.cwd(), "data", "seed.yml"), "utf8");
  // CORE_SCHEMA keeps dates as plain YYYY-MM-DD strings.
  const raw = (yaml.load(file, { schema: yaml.CORE_SCHEMA }) as RawSeed) ?? {};
  const db = await getDb();

  await db.collection("molecules").createIndex({ slug: 1 }, { unique: true });
  await db.collection("atoms").createIndex({ slug: 1 }, { unique: true });
  await db.collection("versions").createIndex({ slug: 1 }, { unique: true });

  for (const m of raw.molecules ?? []) {
    await db.collection("molecules").updateOne(
      { slug: m.slug },
      { $set: { ...m, visibility: "public" } },
      { upsert: true },
    );
  }
  for (const a of raw.atoms ?? []) {
    await db.collection("atoms").updateOne(
      { slug: a.slug },
      { $set: { ...a, visibility: "public" } },
      { upsert: true },
    );
  }
  for (const v of raw.versions ?? []) {
    await db.collection("versions").updateOne(
      { slug: v.slug },
      { $set: { ...v, state: "published" } },
      { upsert: true },
    );
  }

  console.log(
    `Migrated ${raw.molecules?.length ?? 0} molecules, ${raw.atoms?.length ?? 0} atoms, ${raw.versions?.length ?? 0} versions.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add the `migrate` script to `package.json`**

In `package.json` `scripts`, add (note `--env-file` so the standalone script picks up `.env.local`, which Next loads automatically for the app but a bare `tsx` run does not):
```json
    "migrate": "node --env-file=.env.local --import tsx scripts/migrate-seed.ts"
```

- [ ] **Step 3: Run the migration (idempotent — safe to re-run)**

Run:
```bash
npm run migrate
```
Expected: `Migrated 9 molecules, 23 atoms, 39 versions.` (counts match `data/seed.yml`).

- [ ] **Step 4: Verify the data landed with the right stamps**

Run:
```bash
node --env-file=.env.local -e "const {MongoClient}=require('mongodb');(async()=>{const c=new MongoClient(process.env.MONGODB_URI);await c.connect();const db=c.db(process.env.MONGODB_DB);console.log('versions published:', await db.collection('versions').countDocuments({state:'published'}));console.log('molecules public:', await db.collection('molecules').countDocuments({visibility:'public'}));await c.close();})()"
```
Expected: `versions published: 39` and `molecules public: 9`.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-seed.ts package.json package-lock.json
git commit -m "feat: seed.yml -> mongo migration script"
```

---

## Task 5: Point the public pages at the DB dataset (published-only)

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/timeline/page.tsx`
- Modify: `app/atom/[id]/page.tsx`

- [ ] **Step 1: Update the Directory page**

In `app/page.tsx`, change the import and make data-loading async:
```tsx
import { getPublicDataset } from "@/lib/store";

export default async function DirectoryPage() {
  const data = await getPublicDataset();
  const molecules = data.getMolecules();
  const standalone = data.standaloneAtoms();
  // ...rest of the JSX is unchanged
```

- [ ] **Step 2: Update the Timeline page**

In `app/timeline/page.tsx`, change the import line and the dataset call:
```tsx
import { type Domain } from "@/lib/data";
import { getPublicDataset } from "@/lib/store";
```
and replace the `getDataset()` usage:
```tsx
  const entries = (await getPublicDataset())
    .timelineVersions()
    .filter((entry) => active === "all" || entry.domain === active);
```
(The component is already `async`.)

- [ ] **Step 3: Update the Atom detail page**

In `app/atom/[id]/page.tsx`: remove the sync `generateStaticParams` (the route renders dynamically from the DB now), swap the import, and await the dataset.

Replace the top of the file:
```tsx
import { notFound } from "next/navigation";
import { getPublicDataset } from "@/lib/store";

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export default async function AtomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPublicDataset();
  const atom = data.getAtom(id);
  if (!atom) notFound();
  // ...rest of the JSX is unchanged
```
(Deleting `generateStaticParams` makes `/atom/[id]` render on demand — correct for a DB-backed, published-only view; unknown or unpublished slugs fall through to `notFound()`.)

- [ ] **Step 4: Build to verify the app compiles and renders against the DB**

Run (with `.env.local` present and the migration applied):
```bash
npm run build
```
Expected: build succeeds. The Atom route is reported as dynamic (ƒ) rather than static (○).

- [ ] **Step 5: Smoke-test in the browser**

Run:
```bash
npm run dev
```
Then load `http://localhost:3000/` (Directory), `http://localhost:3000/timeline`, and one atom link (e.g. `/atom/rom-win`). Expected: same content as before the migration — because every migrated item is `published`.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/timeline/page.tsx app/atom/[id]/page.tsx
git commit -m "feat: public pages read published-only dataset from mongo"
```

---

## Task 6: Prove the no-leak invariant end-to-end

**Files:**
- Modify: `lib/store.test.ts` (add an env-guarded end-to-end visibility test)

- [ ] **Step 1: Write the failing end-to-end test**

Append to `lib/store.test.ts`:
```ts
import { getPublicDataset } from "./store";

test("public dataset excludes a manually-drafted version", { skip: !hasDb }, async () => {
  const { getDb } = await import("./db");
  const db = await getDb();
  const probe = {
    slug: "__leak_probe__",
    name: "Leak Probe",
    type: "note",
    date: "2099-01-01",
    description: "should never be public",
    parents: [],
    state: "draft" as const,
  };
  await db.collection("versions").updateOne({ slug: probe.slug }, { $set: probe }, { upsert: true });
  try {
    const data = await getPublicDataset();
    const found = data.timelineVersions().some((e) => e.version.slug === probe.slug);
    assert.equal(found, false, "draft version leaked into the public dataset");
  } finally {
    await db.collection("versions").deleteOne({ slug: probe.slug });
  }
});
```

- [ ] **Step 2: Run the guarded test with a DB**

Run:
```bash
node --env-file=.env.local --import tsx --test "lib/**/*.test.ts"
```
Expected: PASS — the draft probe is inserted, confirmed absent from the public dataset, then cleaned up.

- [ ] **Step 3: Confirm the default (no-DB) test run is still green**

Run:
```bash
npm test
```
Expected: DB-guarded tests skipped; all pure tests PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/store.test.ts
git commit -m "test: prove drafts never leak into the public dataset"
```

---

## Done — what Plan 1 delivers

- MongoDB holds the canonical content; `seed.yml` is now only a migration input.
- The atomic model carries `visibility`, `state`, `media`, `source`, `content`, `tags`.
- The public site serves **published-only**, with the no-leak invariant covered by pure unit tests and a DB-backed end-to-end test.
- The pure `buildDataset` core and its original tests are untouched.

**Next:** Plan 2 (Ingestion & Capture) adds the `Capture` collection, `POST /api/inbox`, embed detection, image upload, and the quick-capture bar — all writing into the same Mongo store this plan established.
