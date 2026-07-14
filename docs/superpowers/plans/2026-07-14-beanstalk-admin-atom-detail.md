# Beanstalk Admin — Atom-Detail View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `/admin/atom/[id]` detail view over the full dataset, and repoint the vault's version-name link at it, so clicking a `draft`/`private` version no longer 404s.

**Architecture:** A new admin server component reads `getFullDataset()` and feeds it to a pure, unit-tested `atomDetail(dataset, slug)` builder that returns the atom + its domain, molecule parents, and versions (or `null` when the slug is unknown). The page renders bare HTML (atom header + every version with its state), `notFound()`s on `null`, and falls back to a plain line on DB failure. The one security-sensitive path (`filterPublic`/`getPublicDataset`) is untouched.

**Tech Stack:** Next.js 15 (server components, route segment config), TypeScript, MongoDB (via existing `lib/store`), `node:test` + `tsx`.

**Spec:** `docs/superpowers/specs/2026-07-14-beanstalk-admin-atom-detail-design.md`

**Conventions carried from prior slices:**
- Tests live under `lib/` and run via `npm test` = `node --import tsx --test "lib/**/*.test.ts"`; pure tests need no DB; test files import by relative path.
- Pure logic (`buildDataset`, `filterVaultEntries`, and now `atomDetail`) is unit-tested with in-memory fixtures — never touching Mongo. App pages are thin glue, smoke-tested manually.
- App code imports lib via the `@/*` alias; admin pages are bare functional HTML (no CSS, no client JS) and rely on the existing `/admin/*` middleware for auth.
- `params` and `searchParams` in Next 15 pages are `Promise`s and must be awaited.
- **Baseline:** `npm test` → 96 pass / 16 skip; `npx tsc --noEmit` clean.

---

## File Structure

- `lib/atom-detail.ts` — **create.** Pure `atomDetail(dataset, slug)` + `AtomDetailView` type.
- `lib/atom-detail.test.ts` — **create.** Pure unit tests over `buildDataset()` fixtures.
- `app/admin/atom/[id]/page.tsx` — **create.** The read-only detail page.
- `app/admin/vault/page.tsx` — **modify.** Repoint the version-name link (line 101) to `/admin/atom/<slug>`.
- `README.md` — **modify.** Document the atom-detail view + the fixed vault link.

**Untouched:** `filterPublic` / `getPublicDataset` / `buildDataset`, the public `app/atom/[id]/page.tsx`, the promote/publish action, `lib/atomic.ts`, `lib/store.ts`, and the rest of 2b-i/2b-ii/2b-iii.

---

## Task 1: Pure atom-detail builder — `lib/atom-detail.ts` (TDD)

**Files:**
- Create: `lib/atom-detail.ts`
- Test: `lib/atom-detail.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/atom-detail.test.ts`. The fixture builds a real `Dataset` via `buildDataset` (no DB), mirroring how `lib/data.test.ts` exercises the dataset:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDataset, type RawSeed } from "./data";
import { atomDetail } from "./atom-detail";

const SEED: RawSeed = {
  molecules: [{ slug: "rom", name: "Republic", domain: "music", description: "" }],
  atoms: [
    { slug: "rom-win", name: "Win", parents: ["molecule:rom"] },
    { slug: "loner", name: "Loner", parents: [] },
    { slug: "dangler", name: "Dangler", parents: ["molecule:ghost"] },
  ],
  versions: [
    { slug: "win-v1", name: "Win v1", type: "t", date: "2025-01-01", description: "", parents: ["atom:rom-win"], state: "draft" },
    { slug: "win-v2", name: "Win v2", type: "t", date: "2025-03-01", description: "", parents: ["atom:rom-win"], state: "published" },
  ],
};
const DATASET = buildDataset(SEED);

test("unknown slug returns null", () => {
  assert.equal(atomDetail(DATASET, "nope"), null);
});

test("found atom returns the atom and its versions newest-first", () => {
  const view = atomDetail(DATASET, "rom-win");
  assert.ok(view);
  assert.equal(view!.atom.slug, "rom-win");
  assert.deepEqual(view!.versions.map((v) => v.slug), ["win-v2", "win-v1"]);
});

test("domain resolves via the molecule parent", () => {
  assert.equal(atomDetail(DATASET, "rom-win")!.domain, "music");
});

test("moleculeParents surfaces the molecule: refs (as-is)", () => {
  assert.deepEqual(atomDetail(DATASET, "rom-win")!.moleculeParents, ["molecule:rom"]);
});

test("a standalone atom has no molecule parents and a null domain", () => {
  const view = atomDetail(DATASET, "loner");
  assert.deepEqual(view!.moleculeParents, []);
  assert.equal(view!.domain, null);
});

test("a dangling molecule ref is surfaced as-is but yields a null domain", () => {
  const view = atomDetail(DATASET, "dangler");
  assert.deepEqual(view!.moleculeParents, ["molecule:ghost"]);
  assert.equal(view!.domain, null);
});

test("an atom with no versions returns an empty versions array", () => {
  assert.deepEqual(atomDetail(DATASET, "loner")!.versions, []);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `./atom-detail` cannot be found.

- [ ] **Step 3: Implement `lib/atom-detail.ts`**

Create `lib/atom-detail.ts`:

```ts
import type { Atom, Dataset, Domain, Version } from "./data";

export interface AtomDetailView {
  atom: Atom;
  domain: Domain | null;
  moleculeParents: string[]; // atom.parents entries with the "molecule:" prefix, as-is (incl. dangling)
  versions: Version[]; // newest-first (dataset.versionsForAtom is already sorted)
}

// Pure. Returns the admin view model for an atom, or null when the slug doesn't exist.
export function atomDetail(dataset: Dataset, slug: string): AtomDetailView | null {
  const atom = dataset.getAtom(slug);
  if (!atom) return null;
  return {
    atom,
    domain: dataset.domainForAtom(slug),
    moleculeParents: (atom.parents ?? []).filter((p) => p.startsWith("molecule:")),
    versions: dataset.versionsForAtom(slug),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — new `atom-detail` tests green; existing tests still green (96 → 103 pass, 16 skip).

- [ ] **Step 5: Commit**

```bash
git add lib/atom-detail.ts lib/atom-detail.test.ts
git commit -m "feat: pure atomDetail builder (atom + domain + lineage + versions)"
```

---

## Task 2: The detail page — `app/admin/atom/[id]/page.tsx`

**Files:**
- Create: `app/admin/atom/[id]/page.tsx`

- [ ] **Step 1: Implement the page**

Create `app/admin/atom/[id]/page.tsx`. Bare semantic HTML, no CSS. The `isScalar` predicate is copied verbatim from the public `app/atom/[id]/page.tsx` (the two pages are deliberately independent — the public one must never read the full dataset):

```tsx
import { notFound } from "next/navigation";
import { getFullDataset } from "@/lib/store";
import { atomDetail, type AtomDetailView } from "@/lib/atom-detail";

export const dynamic = "force-dynamic";

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export default async function AdminAtomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let view: AtomDetailView | null = null;
  let failed = false;
  try {
    view = atomDetail(await getFullDataset(), id);
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <article>
        <p>
          <a href="/admin/vault">← vault</a>
        </p>
        <h1>Atom</h1>
        <p role="alert">Couldn&apos;t load the atom.</p>
      </article>
    );
  }

  if (!view) notFound();

  const { atom, domain, moleculeParents, versions } = view;

  return (
    <article>
      <p>
        <a href="/admin/vault">← vault</a>
      </p>
      <h1>{atom.name}</h1>
      <ul>
        <li>atom: {atom.slug}</li>
        <li>visibility: {atom.visibility ?? "public (default)"}</li>
        <li>domain: {domain ?? "—"}</li>
        <li>molecule: {moleculeParents.join(", ") || "—"}</li>
        <li>tags: {(atom.tags ?? []).join(", ") || "—"}</li>
      </ul>

      <h2>Versions ({versions.length})</h2>
      {versions.length === 0 ? (
        <p>No versions.</p>
      ) : (
        versions.map((version) => (
          <section key={version.slug}>
            <h3>{version.name}</h3>
            <p>state: {version.state ?? "—"}</p>
            <ul>
              {Object.entries(version)
                .filter(([, value]) => isScalar(value))
                .map(([key, value]) => (
                  <li key={key}>
                    {key}: {String(value)}
                  </li>
                ))}
            </ul>
            <p>tags: {(version.tags ?? []).join(", ") || "—"}</p>
          </section>
        ))
      )}
    </article>
  );
}
```

- [ ] **Step 2: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; tests green (unchanged from Task 1 — this is a page, exercised by smoke test).

- [ ] **Step 3: Smoke — the page renders**

Start the dev server (`npm run dev`). Logged in as admin, visit `http://localhost:3000/admin/atom/<an-existing-atom-slug>` (find one via `/admin/vault`). Confirm: the atom header (visibility/domain/molecule/tags) and every version with its `state:` line render. Then visit `http://localhost:3000/admin/atom/definitely-not-real` and confirm a 404. (Full vault-link flow is Task 4.)

- [ ] **Step 4: Commit**

```bash
git add "app/admin/atom/[id]/page.tsx"
git commit -m "feat: read-only /admin/atom/[id] detail view (all versions + state)"
```

---

## Task 3: Repoint the vault version-name link

**Files:**
- Modify: `app/admin/vault/page.tsx` (line 101)

- [ ] **Step 1: Change the link target**

In `app/admin/vault/page.tsx`, find this line (currently line 101):
```tsx
                  {e.atom ? <a href={`/atom/${e.atom.slug}`}>{e.version.name}</a> : e.version.name}
```
and change `/atom/` to `/admin/atom/`:
```tsx
                  {e.atom ? <a href={`/admin/atom/${e.atom.slug}`}>{e.version.name}</a> : e.version.name}
```
Change nothing else — the atom-slug column stays plain text, and a version with no atom still renders its name as plain text.

- [ ] **Step 2: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; tests green.

- [ ] **Step 3: Commit**

```bash
git add app/admin/vault/page.tsx
git commit -m "fix: vault version link targets the admin atom view (no more 404 on drafts)"
```

---

## Task 4: End-to-end smoke + README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Full suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all pure tests pass (incl. the new `atom-detail` suite); DB-guarded tests skip; no type errors.

- [ ] **Step 2: Smoke — the vault link now resolves**

Start the dev server (`npm run dev`), logged in as admin. From `/admin/vault`:
- Ensure at least one `draft` or `private` version exists (triage a capture and leave it `draft`, as in the 2b-ii/2b-iii smoke, if none does).
- Click that draft version's **name** → it lands on `/admin/atom/<slug>` (NOT a 404) and shows the atom header plus all its versions with states.
- Confirm the same atom's **public** page `/atom/<slug>` still 404s (or omits the draft) for the unpublished case — i.e. the public projection is unchanged.
- Confirm `/admin/atom/<slug>` without a session cookie redirects (307) via the middleware.
Clean up any test captures/molecules/atoms/versions you created.

- [ ] **Step 3: Document in the README**

In `README.md`, under the Admin zone description (next to the `/admin/vault` bullet added in 2b-iii), add a bullet:
- `/admin/atom/<slug>` — a read-only detail view of a single atom over the full dataset: its visibility/domain/molecule lineage/tags plus every version and its state (draft/private/published). Linked from each vault row's version name, so drafts/privates no longer 404.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document the admin atom-detail view"
```

---

## Done — what this delivers

- A pure, unit-tested `atomDetail(dataset, slug)` builder and a read-only `/admin/atom/[id]` page that shows an atom's visibility/lineage and all its versions (every state).
- The vault's version-name link repointed to the admin view, closing the 2b-iii deferred 404 for `draft`/`private` versions.
- The public read path (`filterPublic` / `getPublicDataset` / the public `/atom/[id]` page) and all write paths are untouched.

## Deferred to later specs

- Editing / re-publishing / un-publishing a Version from the admin (the "edit Version" slice).
- Molecule detail pages / cross-linking to a molecule view.
- `name`/`description` `string→Text` widening; capture-bar image attach; connectors; AI-assisted classification.

## Notes / small risks to watch during execution

- **`isScalar` is duplicated, not shared.** The public `app/atom/[id]/page.tsx` keeps its own copy; the admin page has its own. This is deliberate — sharing a helper would invite importing other public-page internals and blur the public/full-dataset boundary. If a third consumer appears, extract it to `lib/` then.
- **`atomDetail` never consults visibility** — it returns the atom and all its versions regardless of state, by design (`getFullDataset`, not `filterPublic`). The public/private split is enforced only on the public read path, which this slice does not touch.
- **The DB-failure fallback branch has no unit test** — it is only reachable via a real Mongo failure, consistent with the project's no-DB-in-`npm test` convention (the vault page's fallback is untested for the same reason).
- **`params` is a Promise in Next 15** — it must be awaited before reading `id`.
