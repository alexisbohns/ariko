# Beanstalk Admin UI — Plan 2b-ii: Triage → Promote → Publish Cascade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the triage workspace — promote an inbox capture into a first-class Version (selecting or creating a molecule/atom), run the pure publish visibility cascade, and discard — introducing the first write layer for the atomic model.

**Architecture:** A pure `publishCascade` in `lib/data.ts` (the write-time mirror of `filterPublic`) computes the upward closure of parents to make public. A thin `lib/atomic.ts` write layer creates molecules/atoms/versions (private by default) and flips visibility. Pure helpers in `lib/promote.ts` map the triage form → a version + resolve the select-or-create precedence. A `promoteCaptureAction` server action orchestrates; a zero-JS `/admin/triage/[id]` page renders the form.

**Tech Stack:** Next.js 15 (server components, server actions), TypeScript, MongoDB (`mongodb` driver via existing `lib/db`), `node:test` + `tsx`.

**Spec:** `docs/superpowers/specs/2026-07-13-beanstalk-admin-ui-2b-ii-design.md`

**Branch note:** this branch (`feat/admin-ui-2b-ii`) is stacked on `feat/admin-ui-2b-i` (PR #4). It builds on 2b-i's `app/admin/*`, `lib/session.ts`, etc. Rebase onto `main` once #4 merges.

**Conventions carried from Plans 1/2a/2b-i:**
- Tests live under `lib/` and run via `npm test` = `node --import tsx --test "lib/**/*.test.ts"`. Pure tests stay green with no DB; DB-backed tests are guarded with `{ skip: !process.env.MONGODB_URI }` and run via `node --env-file=.env.local --import tsx --test "lib/<file>.test.ts"`.
- App code imports lib via the `@/*` alias; sibling app modules by relative path.
- Server actions live in `app/admin/actions.ts` (a single `"use server"` module) and each mutating action calls `requireSession()` first.
- `redirect()` (from `next/navigation`) throws to interrupt control flow — never wrap it in try/catch.

---

## File Structure

- `lib/data.ts` — **modify.** Add pure `publishCascade(raw, versionSlug)`. (Tests in `lib/data.test.ts`.)
- `lib/promote.ts` — **create.** Pure `resolveParentChoice`, `buildVersionInput`, `validateVersionInput` + the `VersionInput`/`ParentResolution` types.
- `lib/atomic.ts` — **create.** Write layer: `SlugExistsError`, `ensureAtomicIndexes`, `listMolecules`/`listAtoms`, `createMolecule`/`createAtom`/`createVersion`, `setPublic`.
- `lib/captures.ts` — **modify.** Add `markCapturePromoted`, `discardCapture`.
- `scripts/apply-validators.ts` — **modify.** Call `ensureAtomicIndexes()`.
- `app/admin/actions.ts` — **modify.** Add `promoteCaptureAction`, `discardCaptureAction`.
- `app/admin/triage/[id]/page.tsx` — **create.** The triage page.
- `app/admin/page.tsx` — **modify.** Inbox title cell → link to `/admin/triage/[id]`.
- `README.md` — **modify.** Document triage/promote/publish.
- Tests: `lib/promote.test.ts`, `lib/atomic.test.ts` — **create**; `lib/data.test.ts`, `lib/captures.test.ts` — **modify.**

---

## Task 1: Pure `publishCascade` (`lib/data.ts`, TDD)

**Files:**
- Modify: `lib/data.ts`
- Test: `lib/data.test.ts`

- [ ] **Step 1: Write the failing tests**

`lib/data.test.ts` already starts with `import { test } from "node:test";`, `import assert from "node:assert/strict";`, and `import { buildDataset, getDataset, type RawSeed } from "./data";`. Do NOT re-import `test`/`assert` (that is a redeclaration error). Just add `publishCascade` to the existing `./data` import so it reads `import { buildDataset, getDataset, publishCascade, type RawSeed } from "./data";`, then append the following test blocks to the end of the file (note the fixtures use a local `RAW`, distinct from the file's existing lowercase `raw`):
```ts
const RAW = {
  molecules: [{ slug: "m1", name: "M1", domain: "music" as const, description: "" }],
  atoms: [
    { slug: "a1", name: "A1", parents: ["molecule:m1"] },
    { slug: "a2", name: "A2", parents: ["molecule:m1", "molecule:mX"] }, // mX dangling
  ],
  versions: [
    { slug: "v1", name: "V1", type: "t", date: "2025-01-01", description: "", parents: ["atom:a1"] },
    { slug: "v2", name: "V2", type: "t", date: "2025-01-01", description: "", parents: ["atom:a1", "atom:a2"] },
    { slug: "v3", name: "V3", type: "t", date: "2025-01-01", description: "", parents: [] },
    { slug: "v4", name: "V4", type: "t", date: "2025-01-01", description: "", parents: ["atom:ghost"] },
  ],
};

test("publishCascade returns the atom parent and its molecule parent", () => {
  const r = publishCascade(RAW, "v1");
  assert.deepEqual(r.atomSlugs, ["a1"]);
  assert.deepEqual(r.moleculeSlugs, ["m1"]);
});

test("publishCascade unions multiple atom parents and their molecules, ignoring dangling molecule refs", () => {
  const r = publishCascade(RAW, "v2");
  assert.deepEqual([...r.atomSlugs].sort(), ["a1", "a2"]);
  assert.deepEqual(r.moleculeSlugs, ["m1"]); // mX is dangling → excluded
});

test("a parentless version cascades nothing", () => {
  assert.deepEqual(publishCascade(RAW, "v3"), { moleculeSlugs: [], atomSlugs: [] });
});

test("a dangling atom parent is ignored", () => {
  assert.deepEqual(publishCascade(RAW, "v4"), { moleculeSlugs: [], atomSlugs: [] });
});

test("an unknown version slug cascades nothing", () => {
  assert.deepEqual(publishCascade(RAW, "nope"), { moleculeSlugs: [], atomSlugs: [] });
});

test("parents are returned regardless of current visibility (idempotent flip)", () => {
  const raw = {
    molecules: [{ slug: "m1", name: "M1", domain: "music" as const, description: "", visibility: "public" as const }],
    atoms: [{ slug: "a1", name: "A1", parents: ["molecule:m1"], visibility: "public" as const }],
    versions: [{ slug: "v1", name: "V1", type: "t", date: "2025-01-01", description: "", parents: ["atom:a1"] }],
  };
  const r = publishCascade(raw, "v1");
  assert.deepEqual(r.atomSlugs, ["a1"]);
  assert.deepEqual(r.moleculeSlugs, ["m1"]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `publishCascade` is not exported from `./data`.

- [ ] **Step 3: Implement `publishCascade`**

In `lib/data.ts`, immediately after the `filterPublic` function (and its `allExistingParentsFiltered` helper), add:
```ts
// Upward publish cascade — the write-time mirror of filterPublic's downward
// projection (spec §6.2). For the given version, returns the EXISTING atom parents
// and their EXISTING molecule parents that must be made public so a published
// version never dangles under a private parent. Dangling refs are ignored, exactly
// as filterPublic ignores them. Pure; visibility is not consulted (idempotent flip).
export function publishCascade(
  raw: RawSeed,
  versionSlug: string,
): { moleculeSlugs: string[]; atomSlugs: string[] } {
  const molecules = raw.molecules ?? [];
  const atoms = raw.atoms ?? [];
  const versions = raw.versions ?? [];

  const version = versions.find((v) => v.slug === versionSlug);
  if (!version) return { moleculeSlugs: [], atomSlugs: [] };

  const atomBySlug = new Map(atoms.map((a) => [a.slug, a]));
  const moleculeExists = new Set(molecules.map((m) => m.slug));

  const atomSlugs = [
    ...new Set(parentsWithPrefix(version.parents, ATOM_PREFIX).filter((s) => atomBySlug.has(s))),
  ];

  const moleculeSlugs = new Set<string>();
  for (const atomSlug of atomSlugs) {
    const atom = atomBySlug.get(atomSlug)!;
    for (const m of parentsWithPrefix(atom.parents, MOLECULE_PREFIX)) {
      if (moleculeExists.has(m)) moleculeSlugs.add(m);
    }
  }

  return { moleculeSlugs: [...moleculeSlugs], atomSlugs };
}
```
(`parentsWithPrefix`, `ATOM_PREFIX`, `MOLECULE_PREFIX` already exist in `lib/data.ts`.)

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — all `publishCascade` tests green; existing tests still green.

- [ ] **Step 5: Commit**

```bash
git add lib/data.ts lib/data.test.ts
git commit -m "feat: pure publishCascade (upward visibility closure)"
```

---

## Task 2: Pure promote helpers (`lib/promote.ts`, TDD)

**Files:**
- Create: `lib/promote.ts`
- Test: `lib/promote.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/promote.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveParentChoice, buildVersionInput, validateVersionInput } from "./promote";
import type { Capture } from "./data";

const capture: Capture = {
  id: "c1",
  title: "Song idea",
  body: { en: "hummed melody", fr: "mélodie" },
  media: [{ kind: "embed", provider: "youtube", url: "https://youtu.be/x", embedId: "x" }],
  source: { kind: "manual", capturedAt: "2025-01-01T00:00:00.000Z" },
  status: "inbox",
  promotedTo: [],
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

function form(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

test("resolveParentChoice: a non-blank new slug wins (create)", () => {
  assert.deepEqual(resolveParentChoice("  new-slug ", "existing"), { mode: "create", slug: "new-slug" });
});

test("resolveParentChoice: falls back to the selected existing slug", () => {
  assert.deepEqual(resolveParentChoice("", " picked "), { mode: "existing", slug: "picked" });
});

test("resolveParentChoice: none when both blank", () => {
  assert.deepEqual(resolveParentChoice("  ", ""), { mode: "none" });
});

test("buildVersionInput prefills name/description from the capture and carries media/source", () => {
  const v = buildVersionInput(form([["versionSlug", "v1"], ["type", "demo"], ["date", "2025-02-02"]]), capture, "a1");
  assert.equal(v.slug, "v1");
  assert.equal(v.name, "Song idea"); // prefilled from capture.title
  assert.equal(v.description, "hummed melody"); // prefilled from capture.body via resolveText
  assert.equal(v.type, "demo");
  assert.equal(v.date, "2025-02-02");
  assert.equal(v.state, "draft"); // default
  assert.deepEqual(v.parents, ["atom:a1"]);
  assert.deepEqual(v.media, capture.media);
  assert.deepEqual(v.source, capture.source);
});

test("buildVersionInput uses provided fields over prefill and parses state", () => {
  const v = buildVersionInput(
    form([["versionSlug", "v1"], ["versionName", "Live cut"], ["type", "live"], ["date", "2025-02-02"], ["description", "at the club"], ["state", "published"]]),
    capture,
    "a1",
  );
  assert.equal(v.name, "Live cut");
  assert.equal(v.description, "at the club");
  assert.equal(v.state, "published");
});

test("buildVersionInput yields a parentless version when atomParentSlug is null", () => {
  const v = buildVersionInput(form([["versionSlug", "v1"], ["type", "t"], ["date", "2025-02-02"]]), capture, null);
  assert.deepEqual(v.parents, []);
});

test("buildVersionInput coerces an unexpected state to draft", () => {
  const v = buildVersionInput(form([["versionSlug", "v1"], ["type", "t"], ["date", "2025-02-02"], ["state", "bogus"]]), capture, null);
  assert.equal(v.state, "draft");
});

test("validateVersionInput rejects missing required fields", () => {
  const base = buildVersionInput(form([["versionSlug", "v1"], ["type", "t"], ["date", "2025-02-02"]]), capture, null);
  assert.equal(validateVersionInput(base).ok, true);
  assert.equal(validateVersionInput({ ...base, slug: "" }).ok, false);
  assert.equal(validateVersionInput({ ...base, type: "" }).ok, false);
  assert.equal(validateVersionInput({ ...base, date: "" }).ok, false);
});

test("validateVersionInput rejects an empty name (e.g. blank title + blank field)", () => {
  const v = buildVersionInput(form([["versionSlug", "v1"], ["type", "t"], ["date", "2025-02-02"]]), { ...capture, title: "" }, null);
  assert.equal(v.name, "");
  assert.equal(validateVersionInput(v).ok, false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `./promote` cannot be found.

- [ ] **Step 3: Implement `lib/promote.ts`**

Create `lib/promote.ts`:
```ts
import type { Capture, Media, Source, VersionState } from "./data";
import { resolveText } from "./data";

export type ParentResolution =
  | { mode: "create"; slug: string }
  | { mode: "existing"; slug: string }
  | { mode: "none" };

// New wins: a non-blank new slug means "create a new parent". Else a non-blank
// selected slug means "use existing". Else none. (Both fields are always rendered
// because there is no client JS to toggle them.)
export function resolveParentChoice(newSlug: string, selectedSlug: string): ParentResolution {
  const created = newSlug.trim();
  if (created) return { mode: "create", slug: created };
  const selected = selectedSlug.trim();
  if (selected) return { mode: "existing", slug: selected };
  return { mode: "none" };
}

// The fields written to a new Version. Structurally the createVersion input.
export interface VersionInput {
  slug: string;
  name: string;
  type: string;
  date: string;
  description: string;
  state: VersionState;
  parents: string[];
  media: Media[];
  source: Source;
}

// Pure. Maps the triage form + the source capture into a VersionInput. Prefills
// name from the capture title and description from the capture note (flattened via
// resolveText), both overridable by form fields. Carries the capture's media and
// provenance. `atomParentSlug` (resolved by the action) wires the atom parent ref.
export function buildVersionInput(
  form: FormData,
  capture: Capture,
  atomParentSlug: string | null,
): VersionInput {
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const stateRaw = get("state");
  const state: VersionState =
    stateRaw === "published" || stateRaw === "private" ? stateRaw : "draft";

  return {
    slug: get("versionSlug"),
    name: get("versionName") || capture.title.trim(),
    type: get("type"),
    date: get("date"),
    description: get("description") || resolveText(capture.body),
    state,
    parents: atomParentSlug ? [`atom:${atomParentSlug}`] : [],
    media: capture.media,
    source: capture.source,
  };
}

// Pure guard for the required Version fields (spec §7). Media/source are carried,
// not user-entered, so they are not validated here.
export function validateVersionInput(
  v: VersionInput,
): { ok: true } | { ok: false; error: string } {
  if (!v.slug) return { ok: false, error: "version slug is required" };
  if (!v.name) return { ok: false, error: "version name is required" };
  if (!v.type) return { ok: false, error: "version type is required" };
  if (!v.date) return { ok: false, error: "version date is required" };
  return { ok: true };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — all `promote` tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/promote.ts lib/promote.test.ts
git commit -m "feat: pure triage-form → version mapping and parent resolution"
```

---

## Task 3: Atomic write layer (`lib/atomic.ts`, env-guarded TDD)

**Files:**
- Create: `lib/atomic.ts`
- Test: `lib/atomic.test.ts`

- [ ] **Step 1: Write the env-guarded integration tests**

Create `lib/atomic.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ensureAtomicIndexes,
  createMolecule,
  createAtom,
  createVersion,
  setPublic,
  listMolecules,
  listAtoms,
  SlugExistsError,
} from "./atomic";
import { getDb, closeDb } from "./db";

const hasDb = Boolean(process.env.MONGODB_URI);

async function cleanup() {
  const db = await getDb();
  await db.collection("molecules").deleteMany({ slug: /^__test__/ });
  await db.collection("atoms").deleteMany({ slug: /^__test__/ });
  await db.collection("versions").deleteMany({ slug: /^__test__/ });
}

test("createMolecule/createAtom insert private-by-default", { skip: !hasDb }, async (t) => {
  await ensureAtomicIndexes();
  t.after(cleanup);
  const m = await createMolecule({ slug: "__test__m", name: "M", domain: "music", description: "" });
  assert.equal(m.visibility, "private");
  const a = await createAtom({ slug: "__test__a", name: "A", moleculeSlug: "__test__m" });
  assert.equal(a.visibility, "private");
  assert.deepEqual(a.parents, ["molecule:__test__m"]);
  const molecules = await listMolecules();
  const atoms = await listAtoms();
  assert.ok(molecules.some((x) => x.slug === "__test__m"));
  assert.ok(atoms.some((x) => x.slug === "__test__a"));
});

test("createAtom with no molecule is parentless", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const a = await createAtom({ slug: "__test__solo", name: "Solo", moleculeSlug: null });
  assert.deepEqual(a.parents, []);
});

test("createVersion writes parents/state/media/source", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const v = await createVersion({
    slug: "__test__v",
    name: "V",
    type: "demo",
    date: "2025-01-01",
    description: "d",
    state: "draft",
    parents: ["atom:__test__a"],
    media: [{ kind: "embed", provider: "youtube", url: "https://youtu.be/x", embedId: "x" }],
    source: { kind: "manual" },
  });
  assert.equal(v.state, "draft");
  assert.deepEqual(v.parents, ["atom:__test__a"]);
});

test("setPublic flips visibility to public", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  await createMolecule({ slug: "__test__pm", name: "M", domain: "music", description: "" });
  await createAtom({ slug: "__test__pa", name: "A", moleculeSlug: "__test__pm" });
  await setPublic(["__test__pm"], ["__test__pa"]);
  const db = await getDb();
  const m = await db.collection("molecules").findOne({ slug: "__test__pm" });
  const a = await db.collection("atoms").findOne({ slug: "__test__pa" });
  assert.equal(m?.visibility, "public");
  assert.equal(a?.visibility, "public");
});

test("setPublic is a no-op on empty arrays", { skip: !hasDb }, async () => {
  await setPublic([], []); // must not throw
});

test("a duplicate slug throws SlugExistsError", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  await createMolecule({ slug: "__test__dup", name: "M", domain: "music", description: "" });
  await assert.rejects(
    () => createMolecule({ slug: "__test__dup", name: "M2", domain: "music", description: "" }),
    (err) => err instanceof SlugExistsError && err.slug === "__test__dup",
  );
});

test.after(async () => {
  if (hasDb) await closeDb();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `./atomic` cannot be found. (The tests are DB-guarded; they skip once the module exists but there's no DB.)

- [ ] **Step 3: Implement `lib/atomic.ts`**

Create `lib/atomic.ts`:
```ts
import { getDb } from "./db";
import type { Atom, Domain, Molecule, Version } from "./data";
import type { VersionInput } from "./promote";

// Thrown when a create hits the unique slug index. Lets the server action turn a
// collision into a friendly message instead of a 500.
export class SlugExistsError extends Error {
  constructor(
    public collection: string,
    public slug: string,
  ) {
    super(`${collection} slug already exists: ${slug}`);
    this.name = "SlugExistsError";
  }
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

// Idempotent — the Plan 1 migration already created these; making it explicit and
// re-runnable, and wiring it into scripts/apply-validators.ts.
export async function ensureAtomicIndexes(): Promise<void> {
  const db = await getDb();
  await db.collection("molecules").createIndex({ slug: 1 }, { unique: true });
  await db.collection("atoms").createIndex({ slug: 1 }, { unique: true });
  await db.collection("versions").createIndex({ slug: 1 }, { unique: true });
}

export async function listMolecules(): Promise<Molecule[]> {
  const db = await getDb();
  return db.collection<Molecule>("molecules").find({}, { projection: { _id: 0 } }).sort({ slug: 1 }).toArray();
}

export async function listAtoms(): Promise<Atom[]> {
  const db = await getDb();
  return db.collection<Atom>("atoms").find({}, { projection: { _id: 0 } }).sort({ slug: 1 }).toArray();
}

export interface NewMolecule {
  slug: string;
  name: string;
  domain: Domain;
  description: string;
}

export async function createMolecule(input: NewMolecule): Promise<Molecule> {
  const db = await getDb();
  const doc: Molecule = { ...input, visibility: "private" };
  try {
    await db.collection<Molecule>("molecules").insertOne({ ...doc });
  } catch (err) {
    if (isDuplicateKey(err)) throw new SlugExistsError("molecule", input.slug);
    throw err;
  }
  return doc;
}

export interface NewAtom {
  slug: string;
  name: string;
  moleculeSlug: string | null;
}

export async function createAtom(input: NewAtom): Promise<Atom> {
  const db = await getDb();
  const doc: Atom = {
    slug: input.slug,
    name: input.name,
    parents: input.moleculeSlug ? [`molecule:${input.moleculeSlug}`] : [],
    visibility: "private",
  };
  try {
    await db.collection<Atom>("atoms").insertOne({ ...doc });
  } catch (err) {
    if (isDuplicateKey(err)) throw new SlugExistsError("atom", input.slug);
    throw err;
  }
  return doc;
}

export async function createVersion(input: VersionInput): Promise<Version> {
  const db = await getDb();
  const doc: Version = { ...input };
  try {
    await db.collection<Version>("versions").insertOne({ ...doc });
  } catch (err) {
    if (isDuplicateKey(err)) throw new SlugExistsError("version", input.slug);
    throw err;
  }
  return doc;
}

// The write half of the publish cascade. No-op on empty arrays.
export async function setPublic(moleculeSlugs: string[], atomSlugs: string[]): Promise<void> {
  const db = await getDb();
  if (moleculeSlugs.length > 0) {
    await db.collection("molecules").updateMany({ slug: { $in: moleculeSlugs } }, { $set: { visibility: "public" } });
  }
  if (atomSlugs.length > 0) {
    await db.collection("atoms").updateMany({ slug: { $in: atomSlugs } }, { $set: { visibility: "public" } });
  }
}
```

- [ ] **Step 4: Run the DB-backed tests**

Run: `node --env-file=.env.local --import tsx --test "lib/atomic.test.ts"`
Expected: PASS — inserts are private, `setPublic` flips visibility, duplicate slug throws `SlugExistsError`.

- [ ] **Step 5: Confirm the default (no-DB) run stays green**

Run: `npm test`
Expected: `atomic` tests skip; everything else PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/atomic.ts lib/atomic.test.ts
git commit -m "feat: atomic write layer (create molecule/atom/version, setPublic)"
```

---

## Task 4: Capture status transitions (`lib/captures.ts`, env-guarded TDD)

**Files:**
- Modify: `lib/captures.ts`
- Test: `lib/captures.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/captures.test.ts` (it already imports from `./captures`, `./db`, and defines `hasDb`/`cleanup`; add these tests and extend the import to include `markCapturePromoted`, `discardCapture`, `getCapture` if not already imported):
```ts
test("markCapturePromoted sets status and appends the version slug", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const { capture } = await createOrUpdateCapture({ title: "__test__ promote", media: [], source: { kind: "manual" } });
  await markCapturePromoted(capture.id, "ver-1");
  await markCapturePromoted(capture.id, "ver-1"); // idempotent add
  await markCapturePromoted(capture.id, "ver-2");
  const reread = await getCapture(capture.id);
  assert.equal(reread?.status, "promoted");
  assert.deepEqual([...(reread?.promotedTo ?? [])].sort(), ["ver-1", "ver-2"]);
});

test("discardCapture sets status discarded", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const { capture } = await createOrUpdateCapture({ title: "__test__ discard", media: [], source: { kind: "manual" } });
  await discardCapture(capture.id);
  const reread = await getCapture(capture.id);
  assert.equal(reread?.status, "discarded");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `markCapturePromoted`/`discardCapture` are not exported from `./captures`.

- [ ] **Step 3: Implement the transitions**

In `lib/captures.ts`, add after `getCapture` (reuse the existing `captures()` helper and `nowIso()`):
```ts
// Triage: a capture becomes a Version. Status flips to "promoted" and the version
// slug is appended ($addToSet keeps it idempotent across re-promotes of the same slug).
export async function markCapturePromoted(id: string, versionSlug: string): Promise<void> {
  const col = await captures();
  await col.updateOne(
    { id },
    { $set: { status: "promoted", updatedAt: nowIso() }, $addToSet: { promotedTo: versionSlug } },
  );
}

// Triage: explicitly drop a capture from the inbox.
export async function discardCapture(id: string): Promise<void> {
  const col = await captures();
  await col.updateOne({ id }, { $set: { status: "discarded", updatedAt: nowIso() } });
}
```

- [ ] **Step 4: Run the DB-backed tests**

Run: `node --env-file=.env.local --import tsx --test "lib/captures.test.ts"`
Expected: PASS — promote sets status + appends slugs idempotently; discard sets status.

- [ ] **Step 5: Confirm the no-DB run stays green**

Run: `npm test`
Expected: new tests skip; everything else PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/captures.ts lib/captures.test.ts
git commit -m "feat: capture promote/discard status transitions"
```

---

## Task 5: Wire `ensureAtomicIndexes` into the validators script

**Files:**
- Modify: `scripts/apply-validators.ts`

- [ ] **Step 1: Call `ensureAtomicIndexes`**

In `scripts/apply-validators.ts`, add the import at the top (next to the `ensureCaptureIndexes` import):
```ts
import { ensureAtomicIndexes } from "../lib/atomic";
```
And in `main()`, after `await ensureCaptureIndexes(); console.log("capture indexes ensured");`, add:
```ts
  await ensureAtomicIndexes();
  console.log("atomic indexes ensured");
```

- [ ] **Step 2: Run it (idempotent) against the DB**

Run: `npm run validators`
Expected output includes `capture indexes ensured` and `atomic indexes ensured`, no errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/apply-validators.ts
git commit -m "chore: ensure atomic slug indexes in the validators script"
```

---

## Task 6: Promote & discard server actions (`app/admin/actions.ts`)

**Files:**
- Modify: `app/admin/actions.ts`

- [ ] **Step 1: Add the actions**

Append to `app/admin/actions.ts` (the file already has `"use server"` at the top and imports `redirect`, `revalidatePath`, `requireSession`). Add these imports at the top with the others:
```ts
import { getCapture, markCapturePromoted, discardCapture } from "@/lib/captures";
import { loadRawSeed } from "@/lib/store";
import { publishCascade, type Domain } from "@/lib/data";
import { resolveParentChoice, buildVersionInput, validateVersionInput } from "@/lib/promote";
import { createMolecule, createAtom, createVersion, setPublic, SlugExistsError } from "@/lib/atomic";
```
And add the two actions:
```ts
const DOMAINS: Domain[] = ["music", "design", "podcast"];

export async function discardCaptureAction(formData: FormData): Promise<void> {
  await requireSession();
  const captureId = String(formData.get("captureId") ?? "");
  await discardCapture(captureId);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function promoteCaptureAction(formData: FormData): Promise<void> {
  await requireSession();
  const captureId = String(formData.get("captureId") ?? "");
  const capture = await getCapture(captureId);
  if (!capture) redirect("/admin");

  // Validate the version's own fields BEFORE any write, so an invalid version never
  // leaves orphan molecule/atom docs behind.
  const precheck = validateVersionInput(buildVersionInput(formData, capture, null));
  if (!precheck.ok) {
    redirect(`/admin/triage/${captureId}?error=${encodeURIComponent(precheck.error)}`);
  }

  // Resolve parent choices up front (pure) so we can guard invalid combinations
  // BEFORE any write. A newly created molecule is only ever linked from a newly
  // created atom in this flow, so "new molecule + (existing/no) atom" would leave
  // the molecule orphaned — reject it rather than silently drop the intent.
  const molChoice = resolveParentChoice(
    String(formData.get("newMoleculeSlug") ?? ""),
    String(formData.get("moleculeSlug") ?? ""),
  );
  const atomChoice = resolveParentChoice(
    String(formData.get("newAtomSlug") ?? ""),
    String(formData.get("atomSlug") ?? ""),
  );
  if (molChoice.mode === "create" && atomChoice.mode !== "create") {
    redirect(
      `/admin/triage/${captureId}?error=${encodeURIComponent(
        "a new molecule must be paired with a new atom under it",
      )}`,
    );
  }

  // Create parents, then the version. Only slug collisions are recoverable;
  // anything else propagates. redirect() stays OUT of the try (it throws to control flow).
  let slugError: string | null = null;
  try {
    let moleculeSlug: string | null = null;
    if (molChoice.mode === "create") {
      const domainRaw = String(formData.get("newMoleculeDomain") ?? "");
      const domain: Domain = DOMAINS.includes(domainRaw as Domain) ? (domainRaw as Domain) : "music";
      await createMolecule({
        slug: molChoice.slug,
        name: String(formData.get("newMoleculeName") ?? "").trim() || molChoice.slug,
        domain,
        description: "",
      });
      moleculeSlug = molChoice.slug;
    } else if (molChoice.mode === "existing") {
      moleculeSlug = molChoice.slug;
    }

    let atomSlug: string | null = null;
    if (atomChoice.mode === "create") {
      await createAtom({
        slug: atomChoice.slug,
        name: String(formData.get("newAtomName") ?? "").trim() || atomChoice.slug,
        moleculeSlug,
      });
      atomSlug = atomChoice.slug;
    } else if (atomChoice.mode === "existing") {
      atomSlug = atomChoice.slug;
    }

    const input = buildVersionInput(formData, capture, atomSlug);
    await createVersion(input);

    if (input.state === "published") {
      const { moleculeSlugs, atomSlugs } = publishCascade(await loadRawSeed(), input.slug);
      await setPublic(moleculeSlugs, atomSlugs);
    }

    await markCapturePromoted(captureId, input.slug);
  } catch (err) {
    if (err instanceof SlugExistsError) slugError = err.message;
    else throw err;
  }

  if (slugError) {
    redirect(`/admin/triage/${captureId}?error=${encodeURIComponent(slugError)}`);
  }
  revalidatePath("/admin");
  redirect("/admin");
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/actions.ts
git commit -m "feat: promote and discard triage server actions"
```

---

## Task 7: Triage page (`app/admin/triage/[id]/page.tsx`)

**Files:**
- Create: `app/admin/triage/[id]/page.tsx`

- [ ] **Step 1: Implement the triage page**

Create `app/admin/triage/[id]/page.tsx`. Bare semantic HTML, no CSS:
```tsx
import { notFound } from "next/navigation";
import { getCapture } from "@/lib/captures";
import { listMolecules, listAtoms } from "@/lib/atomic";
import { resolveText } from "@/lib/data";
import { promoteCaptureAction, discardCaptureAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function TriagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const capture = await getCapture(id);
  if (!capture || capture.status !== "inbox") notFound();

  const [molecules, atoms] = await Promise.all([listMolecules(), listAtoms()]);
  const note = resolveText(capture.body);

  return (
    <article>
      <p>
        <a href="/admin">← inbox</a>
      </p>
      <h1>Triage</h1>
      {error ? <p role="alert">Could not promote: {error}</p> : null}

      <section>
        <h2>{capture.title}</h2>
        {note ? <p>{note}</p> : null}
        <p>source: {capture.source.kind}</p>
        {capture.media.length > 0 ? (
          <ul>
            {capture.media.map((m, i) => (
              <li key={i}>
                {m.kind}: {m.url}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <form action={promoteCaptureAction}>
        <input type="hidden" name="captureId" value={capture.id} />

        <fieldset>
          <legend>Molecule</legend>
          <p>
            <label>
              Existing{" "}
              <select name="moleculeSlug" defaultValue="">
                <option value="">— none —</option>
                {molecules.map((m) => (
                  <option key={m.slug} value={m.slug}>
                    {m.slug}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <p>
            <label>
              New slug <input type="text" name="newMoleculeSlug" />
            </label>
          </p>
          <p>
            <label>
              New name <input type="text" name="newMoleculeName" />
            </label>
          </p>
          <p>
            <label>
              New domain{" "}
              <select name="newMoleculeDomain" defaultValue="music">
                <option value="music">music</option>
                <option value="design">design</option>
                <option value="podcast">podcast</option>
              </select>
            </label>
          </p>
        </fieldset>

        <fieldset>
          <legend>Atom</legend>
          <p>
            <label>
              Existing{" "}
              <select name="atomSlug" defaultValue="">
                <option value="">— none —</option>
                {atoms.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.slug}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <p>
            <label>
              New slug <input type="text" name="newAtomSlug" />
            </label>
          </p>
          <p>
            <label>
              New name <input type="text" name="newAtomName" />
            </label>
          </p>
        </fieldset>

        <fieldset>
          <legend>Version</legend>
          <p>
            <label>
              Slug <input type="text" name="versionSlug" required />
            </label>
          </p>
          <p>
            <label>
              Name <input type="text" name="versionName" defaultValue={capture.title} required />
            </label>
          </p>
          <p>
            <label>
              Type <input type="text" name="type" required />
            </label>
          </p>
          <p>
            <label>
              Date <input type="date" name="date" required />
            </label>
          </p>
          <p>
            <label>
              Description <textarea name="description" defaultValue={note} />
            </label>
          </p>
          <fieldset>
            <legend>State</legend>
            <label>
              <input type="radio" name="state" value="draft" defaultChecked /> draft
            </label>
            <label>
              <input type="radio" name="state" value="private" /> private
            </label>
            <label>
              <input type="radio" name="state" value="published" /> published
            </label>
          </fieldset>
        </fieldset>

        <p>
          <button type="submit">Promote</button>
        </p>
      </form>

      <form action={discardCaptureAction}>
        <input type="hidden" name="captureId" value={capture.id} />
        <button type="submit">Discard</button>
      </form>
    </article>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/triage/[id]/page.tsx
git commit -m "feat: per-capture triage page"
```

---

## Task 8: Link the inbox rows to triage (`app/admin/page.tsx`)

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Make the title cell a triage link**

In `app/admin/page.tsx`, in the inbox table body, replace:
```tsx
                <td>{c.title}</td>
```
with:
```tsx
                <td>
                  <a href={`/admin/triage/${c.id}`}>{c.title}</a>
                </td>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: link inbox rows to the triage page"
```

---

## Task 9: Smoke test end-to-end + README note

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Full test suite (no DB) + typecheck — green**

Run: `npm test && npx tsc --noEmit`
Expected: all pure tests PASS (incl. new `publishCascade`/`promote` suites); DB-guarded tests skip; no type errors.

- [ ] **Step 2: Full DB-backed suite**

Run: `node --env-file=.env.local --import tsx --test "lib/**/*.test.ts"`
Expected: all tests PASS (nothing skipped), including `atomic` and `captures` transitions.

- [ ] **Step 3: Apply indexes/validators**

Run: `npm run validators`
Expected: `capture indexes ensured` and `atomic indexes ensured`.

- [ ] **Step 4: Manual smoke via the running app**

Start the dev server (`npm run dev`). Then, authenticated in the browser (log in at `/admin/login` with your `ADMIN_PASSWORD`):
1. Capture a note with a link from the capture bar → it appears in the inbox.
2. Click the inbox row title → lands on `/admin/triage/<id>`.
3. Promote as **draft** into a NEW molecule + NEW atom (fill the "New slug"/"New name" fields, pick a domain, set version slug/type/date, state=draft, Promote). Back on `/admin`, the capture is gone from the inbox. Verify the new molecule/atom are **private**:
```bash
node --env-file=.env.local -e "const {MongoClient}=require('mongodb');(async()=>{const c=new MongoClient(process.env.MONGODB_URI);await c.connect();const db=c.db(process.env.MONGODB_DB);console.log('molecule',await db.collection('molecules').findOne({slug:'<newMoleculeSlug>'},{projection:{slug:1,visibility:1,_id:0}}));console.log('atom',await db.collection('atoms').findOne({slug:'<newAtomSlug>'},{projection:{slug:1,visibility:1,_id:0}}));await c.close();})()"
```
Expected: both show `visibility: 'private'`.
4. Capture another note, triage it, promote as **published** into the SAME atom created in step 3. Verify the cascade flipped the atom **and** its molecule to public:
```bash
node --env-file=.env.local -e "const {MongoClient}=require('mongodb');(async()=>{const c=new MongoClient(process.env.MONGODB_URI);await c.connect();const db=c.db(process.env.MONGODB_DB);console.log('molecule',await db.collection('molecules').findOne({slug:'<newMoleculeSlug>'},{projection:{slug:1,visibility:1,_id:0}}));console.log('atom',await db.collection('atoms').findOne({slug:'<newAtomSlug>'},{projection:{slug:1,visibility:1,_id:0}}));console.log('version',await db.collection('versions').findOne({slug:'<publishedVersionSlug>'},{projection:{slug:1,state:1,_id:0}}));await c.close();})()"
```
Expected: molecule + atom `visibility: 'public'`, version `state: 'published'`.
5. Capture a third note and **Discard** it from the triage page → it leaves the inbox (status `discarded`).
6. Clean up the test molecules/atoms/versions/captures you created (delete by the slugs/titles you used).

- [ ] **Step 5: Document triage in the README**

Add to the "Admin zone" section of `README.md` a `/admin/triage/[id]` subsection describing:
- The inbox rows now link to a per-capture triage page.
- Promote: choose or create a molecule and atom, fill the version fields, pick a state (draft/private/published), and submit. Newly created molecules/atoms are **private by default**; publishing runs the visibility cascade that makes the whole lineage public.
- Discard removes a capture from the inbox.
- A note that the public zone won't reflect a publish until the caching/revalidation work in 2b-iii; run `npm run validators` after pulling this change to ensure the atomic slug indexes.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: document the triage/promote/publish flow"
```

---

## Done — what Plan 2b-ii delivers

- A pure, tested `publishCascade` (upward visibility closure) — the write-time mirror of `filterPublic`, giving the spec §6.2 security rule real coverage.
- The first write layer for the atomic model (`lib/atomic.ts`): create molecule/atom/version (private by default), `setPublic`, typed slug-collision errors.
- Capture promote/discard status transitions.
- A zero-JS `/admin/triage/[id]` workspace: select-or-create a molecule/atom, fill the version fields, choose a state, promote; or discard. Reuses the capture's media + provenance on the new version.
- `/api/inbox`, `/api/upload`, and the public zone untouched; public reflection of publishes lands in 2b-iii.

## Deferred to later slices

- **2b-iii:** vault browser (browse/filter all items) + public-zone caching/revalidation wired to the publish action (so publishes appear on the public site).
- **Later:** `name`/`description` `string→Text` widening (+ public-render `resolveText`), capture-bar image attach, editing/un-publishing an existing Version from the admin.

## Notes / small risks to watch during execution

- **Orphan parents on a mid-promote failure** are accepted (private, invisible, reusable) — no cross-document transaction (spec §7). The version-field pre-validation (Task 6) avoids orphans on the common invalid-version case.
- **`publishCascade` reads `loadRawSeed()` AFTER `createVersion`**, so the new version + its just-created parents are present for the closure — keep that ordering in the action.
- **DB validators** (`versions.state`, `molecules/atoms.visibility` enums) must be satisfied by writes: `state ∈ {draft,private,published}` and `visibility ∈ {private,public}` — the write layer and `buildVersionInput` already conform.
- **`app/admin/triage/[id]/page.tsx` imports actions via `../../actions`** (up from `[id]` → `triage` → `admin`). Keep that path if editing.

## Execution notes (added during subagent-driven execution)

All 9 tasks implemented and passed a two-stage (spec + code-quality) review each, plus a final whole-slice review. Automated gates green: `npm test` (86 pass / 16 pre-existing DB skips), the full DB-backed suite (`node --env-file=.env.local --import tsx --test "lib/**/*.test.ts"`) **102 pass / 0 skip / 0 fail**, and `npx tsc --noEmit` clean throughout.

- **Task 1 test added inline** (`4f7bf96`): a code-review coverage note — the plan's fixture paired one real + one dangling molecule parent, so an atom with *two real* molecule parents wasn't exercised. Added that test (spec §4 had listed the case).
- **Task 6 orphan-guard fix** (`efb2552`, final-review finding): filling *new-molecule* fields while selecting an *existing* atom (or no atom) created a private molecule nothing links to — a *successful* promote that silently dropped intent (distinct from the accepted mid-promote-failure orphan). Fixed by resolving both parent choices up front and rejecting `new molecule + (existing|no) atom` with a friendly error before any write. Plan Task 6 code kept in sync.
- **Live smoke** (Chrome extension unavailable, as in 2b-i): exercised the exact promote chain via a minted session cookie + the real lib functions, and `curl`. Confirmed: promoting as **draft** into a new molecule+atom leaves both `private`; promoting as **published** into that atom cascades **both** the atom and its molecule to `public`; the version states persist (`draft`/`published`); the capture flips to `promoted`; the `/admin/triage/[id]` page renders (200) with the form for a valid cookie and redirects (307) without one; the inbox links to it. The Next server-action POST plumbing itself was not driven over HTTP (framework glue over already-tested functions).

## Deferred follow-ups (surfaced during review, tracked for later slices)

Non-blocking; none blocks 2b-ii:

- **Re-validate "existing" parent selections** (Task 6 / final): a forged POST with a `moleculeSlug`/`atomSlug` that doesn't exist is written straight into `parents`. It degrades safely (both `filterPublic` and `publishCascade` treat it as a dangling ref) and is gated to the single admin, but there's no error shown. Add an existence check when the vault browser (2b-iii) makes selection richer.
- **`SlugExistsError` mapping assumes slug is the sole unique index** (Task 3): `isDuplicateKey` maps any `E11000` on a collection to a slug collision. Harden with an `err.keyPattern` check if a second unique index is ever added.
- **`newMoleculeDomain` silently defaults to `music`** on a tampered/missing value (Task 6) rather than a friendly error — inconsistent with the "never silent" posture, low risk (admin-only 3-option select).
- **`createVersion` → `setPublic` is not transactional** (Task 6): a crash between them can leave a published version whose parent chain isn't fully public. `filterPublic` keeps this safe (the item just doesn't appear publicly), but consider a "republish" affordance in 2b-iii.
- **No action/page-level integration test** for promote→cascade (final): matches the spec §9 scope (pure fns unit-tested + manual smoke). Consider one when a test harness for server actions exists.
- **Minor `lib/promote.ts` polish** (Task 2): description prefill uses `resolveText(capture.body)` un-trimmed while other fields trim; add a `state:"private"` pass-through test for symmetry.
- **Double `buildVersionInput`** (Task 6): called once for the precheck (with `null` parent) and once with the real atom — harmless (pure) duplicate parse; could validate the already-built real input instead.
