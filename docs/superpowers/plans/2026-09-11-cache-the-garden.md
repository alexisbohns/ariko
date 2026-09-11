# Cache the Garden Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the public zone's six-collection Mongo read behind Next's Data Cache under one `"garden"` tag, so TTFB stops depending on Mongo and an Atlas outage renders stale instead of 500.

**Architecture:** Two named readers in two modules. `lib/store.ts` keeps the live `loadRawGarden()` and stays free of any `next/*` import; a new `lib/garden-cache.ts` owns the `unstable_cache` wrapper, the tag, and `getPublicDataset()`. Only the public zone and `/api/graph` read the cached one — the admin and every server action keep the live reader, because two actions deliberately re-read *after* writing so `publishCascade` sees the just-saved state. `revalidateGarden()` is called at exactly four write doors, and a source test pins all of it.

**Tech Stack:** Next 15.3 App Router (`unstable_cache`, `revalidateTag`), React 19, TypeScript, MongoDB driver 6, `node --test` + `tsx`.

**Spec:** [`../specs/2026-09-11-cache-the-garden-design.md`](../specs/2026-09-11-cache-the-garden-design.md)

---

## File structure

**Created**

| File | Responsibility |
|---|---|
| `lib/garden-size.ts` | Pure: the Data Cache byte ceiling and the warning string. No Next import, so `node --test` can exercise it directly. |
| `lib/garden-size.test.ts` | Unit tests for the above. |
| `lib/garden-cache.ts` | Next-aware: `GARDEN_TAG`, `GARDEN_TTL`, `loadCachedGarden`, `getPublicDataset`, `revalidateGarden`. The only module in `lib/` importing `next/cache`. |
| `lib/garden-cache-source.test.ts` | Source-text test pinning the four invariants of §4.3. |
| `app/not-found.tsx` | Unmatched URLs. Root layout only. |
| `app/(public)/(chrome)/not-found.tsx` | The three public `notFound()` calls, inside the chrome layout. |
| `app/(public)/error.tsx` | The public error boundary. `"use client"` by Next's requirement. |
| `lib/not-found-pages.test.tsx` | Render tests for the three pages above. |

**Modified**

| File | Change |
|---|---|
| `lib/store.ts` | `getPublicDataset` moves out. `loadRawGarden` / `getFullDataset` unchanged. |
| `lib/store.test.ts` | Its `getPublicDataset` case asserts `filterPublic(await loadRawGarden())` instead — same claim, no Next runtime. |
| `app/(public)/page.tsx`, `(chrome)/plant/[slug]/page.tsx`, `(chrome)/pod/[slug]/page.tsx`, `(chrome)/bean/[id]/page.tsx` | `getPublicDataset` import path only. |
| `app/(public)/(chrome)/beanstalk/page.tsx:22` | `loadRawGarden()` → `loadCachedGarden()`. |
| `app/api/graph/route.ts:12` | `loadRawGarden()` → `loadCachedGarden()`. |
| `app/admin/actions.ts` | 29 `revalidatePath` → 19 `revalidateGarden()`; 2 deleted with no replacement. |
| `app/api/articles/route.ts`, `app/api/synthesis/route.ts`, `app/api/pollen/sync/route.ts` | One `revalidateGarden()` after the write. |
| `lib/db.ts` | `serverSelectionTimeoutMS` / `connectTimeoutMS`. |

**The language rule for the three new pages**, decided once here so the tasks don't each re-litigate it: the chrome 404 sits inside a zone that already resolves the reading language, so it reads `currentLang()` and renders bilingual copy. The root 404 and `error.tsx` are English-only — the root 404 is the unmatched-URL fallback outside the language-aware zone, and `error.tsx` is a client component that cannot read the cookie. Keeping them English is a smaller lie than rendering a half-translated page.

---

### Task 1: The pure size guard

Vercel's Data Cache refuses an entry above 2 MB, and above it `unstable_cache` silently declines to cache — the regression looks exactly like success. This is the pure half, split out so `node --test` can exercise it without importing `next/cache`. Same idiom as `lib/locale.ts` / `lib/locale-server.ts`.

**Files:**
- Create: `lib/garden-size.ts`
- Test: `lib/garden-size.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/garden-size.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { GARDEN_WARN_BYTES, gardenCacheWarning } from "./garden-size";

test("a garden comfortably under the ceiling warns about nothing", () => {
  assert.equal(gardenCacheWarning(411_400), null);
});

test("the threshold fires AT the boundary, not one byte past it", () => {
  assert.equal(gardenCacheWarning(GARDEN_WARN_BYTES - 1), null);
  assert.notEqual(gardenCacheWarning(GARDEN_WARN_BYTES), null);
});

// The warning is the ONLY signal this failure mode produces — above 2 MB the
// cache silently stops caching — so it has to name the size, the limit and
// where to read about it, or the person who sees it in a log learns nothing.
test("the warning names the measured size, the real limit, and the spec", () => {
  const warning = gardenCacheWarning(1_600_000);
  assert.ok(warning);
  assert.match(warning, /1563 kB/, "must report the measured size in kB");
  assert.match(warning, /2 MB/, "must name the limit that actually bites");
  assert.match(warning, /2026-09-11-cache-the-garden-design/, "must point at the spec");
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/garden-size.test.ts`
Expected: FAIL — `Cannot find module './garden-size'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/garden-size.ts
/**
 * The one number that makes `lib/garden-cache.ts` a cache rather than a
 * decoration, and the warning that fires before it stops being one.
 *
 * Vercel's Data Cache refuses a single entry above 2 MB. Above that limit
 * `unstable_cache` does not throw and does not log — it simply declines to
 * cache, and every public request goes back to Mongo. The failure mode is a
 * performance regression that is indistinguishable, from inside the app, from
 * the thing working. So the ceiling is checked here rather than trusted.
 *
 * Measured 2026-09-11: the full garden is 411 kB, roughly 5x under. The warning
 * sits at 1.5 MB so it fires with room to act, not at the moment of failure.
 *
 * Pure, and in its own module, for `lib/locale.ts`'s reason: `garden-cache.ts`
 * imports `next/cache`, and this half has to stay exercisable under plain
 * `node --test`.
 */
export const GARDEN_WARN_BYTES = 1_500_000;

export function gardenCacheWarning(bytes: number): string | null {
  if (bytes < GARDEN_WARN_BYTES) return null;
  return (
    `garden is ${Math.round(bytes / 1024)} kB, approaching Vercel's 2 MB Data ` +
    `Cache entry limit. Above it unstable_cache silently declines to cache and ` +
    `every public request goes back to Mongo. Split the load per collection — ` +
    `docs/superpowers/specs/2026-09-11-cache-the-garden-design.md §3.5, §6.`
  );
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/garden-size.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/garden-size.ts lib/garden-size.test.ts
git commit -m "feat: the Data Cache ceiling, checked rather than trusted

Above 2 MB unstable_cache does not throw and does not log — it stops
caching. The pure half lives here so node --test can reach it without
importing next/cache.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `lib/garden-cache.ts`, and `getPublicDataset` moves into it

`getPublicDataset` **must** leave `lib/store.ts`: calling an `unstable_cache`-wrapped function outside a Next request context throws, and `lib/store.test.ts:48` calls it under plain `node --test`. Leaving it behind would either break `npm run test:db` or force `store.ts` to import `next/cache`, putting that throw one import away from every DB test in the repo.

**Files:**
- Create: `lib/garden-cache.ts`
- Modify: `lib/store.ts` (delete `getPublicDataset`)
- Modify: `lib/store.test.ts:38-55` (the third test)

- [ ] **Step 1: Write `lib/garden-cache.ts`**

```ts
import { revalidateTag, unstable_cache } from "next/cache";
import { buildDataset, filterPublic, type Dataset, type RawGarden } from "./data";
import { gardenCacheWarning } from "./garden-size";
import { loadRawGarden } from "./store";

/**
 * The public zone's read of the garden, and the only module in lib/ that knows
 * Next has a cache.
 *
 * TWO READERS, DELIBERATELY — this is the whole design and it is one import
 * away from being undone. `lib/store.ts`'s `loadRawGarden` stays live and is
 * what the admin and every server action read. This module's
 * `loadCachedGarden` is what the public zone reads. They are different names
 * rather than a flag because `editVersionAction` and `promoteSeedAction`
 * re-read AFTER writing, on purpose, so `publishCascade` evaluates the
 * just-saved state (there is a comment in actions.ts saying so). Hand those a
 * cached read and the cascade computes against the pre-write garden: an author
 * publishes a sprout and its bean stays private, or an unpublish leaves a
 * parent public that should have been re-privatised. That is a PRIVACY
 * regression produced by a caching change, and it passes tsc, npm test and
 * npm run build. `lib/garden-cache-source.test.ts` is what stops it.
 *
 * The TTL is a backstop, not the mechanism. `revalidateGarden()` at the four
 * write doors is what makes a publish appear immediately; GARDEN_TTL exists so
 * that a write path someone adds and forgets to wire degrades to "stale for
 * five minutes" rather than "stale until the next deploy".
 */
export const GARDEN_TAG = "garden";
export const GARDEN_TTL = 300;

async function loadGardenForCache(): Promise<RawGarden> {
  const raw = await loadRawGarden();
  // On a MISS only — never on the hit path, which is the one that matters.
  const warning = gardenCacheWarning(Buffer.byteLength(JSON.stringify(raw)));
  if (warning) console.warn(warning);
  return raw;
}

export const loadCachedGarden = unstable_cache(loadGardenForCache, ["garden"], {
  tags: [GARDEN_TAG],
  revalidate: GARDEN_TTL,
});

/** Public site: published-only, off the cache. */
export async function getPublicDataset(): Promise<Dataset> {
  return buildDataset(filterPublic(await loadCachedGarden()));
}

/**
 * Called at the four write doors — the admin actions and the three API write
 * routes. Never in a writer in lib/: those run under `npm run test:db` with no
 * Next request context, where revalidateTag throws.
 */
export function revalidateGarden(): void {
  revalidateTag(GARDEN_TAG);
}
```

- [ ] **Step 2: Delete `getPublicDataset` from `lib/store.ts`**

Remove these four lines (`lib/store.ts:28-31`):

```ts
// Public site: published-only.
export async function getPublicDataset(): Promise<Dataset> {
  return buildDataset(filterPublic(await loadRawGarden()));
}
```

Then drop `buildDataset` and `filterPublic` from the import block at the top — `getFullDataset` still uses `buildDataset`, so remove **only** `filterPublic`. Leave `type Dataset` (still used by `getFullDataset`).

- [ ] **Step 3: Repoint the test in `lib/store.test.ts`**

Change the import on line 3:

```ts
import { loadRawGarden } from "./store";
import { buildDataset, filterPublic } from "./data";
```

and the one assertion line inside the third test (currently line 48):

```ts
    const data = buildDataset(filterPublic(await loadRawGarden()));
    const slugs = new Set(data.timelineSprouts().map((e) => e.sprout.slug));
```

Leave the test's name, its probes and both assertions exactly as they are. The claim is unchanged — it was always a claim about `filterPublic`, which is the pure function this now calls directly.

- [ ] **Step 4: Verify the whole suite and the type-check**

Run: `npm test && npx tsc --noEmit`
Expected: PASS. `tsc` will report errors in the four public pages that still import `getPublicDataset` from `@/lib/store` — **that is expected here** and is Task 3's work. Confirm the errors are *only* those four files:

Run: `npx tsc --noEmit 2>&1 | grep "error TS" | sort -u`
Expected: four `app/(public)/…` lines and nothing else.

- [ ] **Step 5: Commit**

```bash
git add lib/garden-cache.ts lib/store.ts lib/store.test.ts
git commit -m "feat: the cached garden reader, beside the live one and not instead of it

getPublicDataset moves out of store.ts because calling an
unstable_cache-wrapped function outside a Next request throws, and
store.test.ts calls it under node --test. Its test now asserts
filterPublic directly — the same claim about the same pure function.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The source test — written before the callers move, so it drives them

Four assertions. Two of them fail now and are fixed by Tasks 4 and 5. Write the whole file, then use the failures as the task list.

**Files:**
- Create: `lib/garden-cache-source.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * The rules that make the garden cache a cache rather than a decoration, and
 * that keep it off the write path.
 *
 * `lib/server-safe-source.test.ts`'s reasoning, applied to a different
 * invariant: every violation below passes `tsc`, `npm test` and
 * `npm run build`, and three of the four are invisible in development, where
 * Mongo is local and fast.
 *
 *  - A new write door that forgets `revalidateGarden()` writes to Mongo while
 *    the public site keeps serving the pre-write garden. This already
 *    happened once in the design: the audit proposed one call in a shared
 *    action guard, and THREE of the write doors (/api/articles,
 *    /api/synthesis, /api/pollen/sync) do not go through actions at all.
 *
 *  - `app/admin/actions.ts` reading the CACHED garden is the dangerous one.
 *    `editVersionAction` and `promoteSeedAction` re-read after writing so
 *    `publishCascade` sees the just-saved state; a cached read there hands
 *    them the pre-write garden and the cascade publishes the wrong set of
 *    parents. Nothing crashes. A bean silently stays private, or a parent
 *    silently stays public.
 *
 *  - A public page reading the LIVE garden is the quiet one: it is correct in
 *    every sense except the one this slice exists for, and nothing about it
 *    looks wrong locally.
 *
 * Source text rather than a render or a call, for this file's whole subject:
 * "which function does this module import" is a property of the file as
 * written, and neither `renderToStaticMarkup` nor a unit test can see it.
 *
 * ADDING A WRITER HERE IS THE CHEAP HALF. A new write export in
 * `lib/botanical.ts` belongs in GARDEN_WRITERS on the day it is written.
 */

const APP = join(process.cwd(), "app");

/**
 * The WRITE exports reachable from `app/`. Readers are deliberately absent:
 * `lib/botanical.ts` also exports `getSprout`, `getScreen` and `listPlants`,
 * which pages import legitimately and which invalidate nothing.
 */
const GARDEN_WRITERS = new Set([
  "createPod",
  "createBean",
  "createScreen",
  "writeExhibition",
  "updateScreenMeta",
  "updateScreenImage",
  "deleteScreen",
  "createSprout",
  "updateVersion",
  "deleteVersion",
  "setPublic",
  "setPrivate",
  "updateSproutContent",
  "updatePlantContent",
  "updatePodContent",
  "updatePlantRole",
  "updatePlantMeta",
  "updatePlantLogo",
  "updateBeanCover",
  "updateBeanKeyword",
  "updatePlantStatus",
  "updatePlantVisibility",
  "updateSproutMedia",
  "writeArticles",
  "upsertDigestDrafts",
  "runSync",
]);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Names bound by a braced import, which is NOT the same as "the file contains
 * this substring". `screen-create-form.tsx` imports `createScreenAction`, and
 * a substring match would read that as importing the writer `createScreen` and
 * demand a `revalidateGarden()` in a component that writes nothing.
 */
function importedNames(source: string): Set<string> {
  const names = new Set<string>();
  for (const m of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["'][^"']+["']/g)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name) names.add(name);
    }
  }
  return names;
}

const FILES = sourceFiles(APP).map((path) => ({
  path: relative(process.cwd(), path),
  text: readFileSync(path, "utf8"),
}));

test("every file under app/ that imports a garden writer also invalidates the garden", () => {
  const offenders = FILES.filter(
    (f) =>
      [...importedNames(f.text)].some((n) => GARDEN_WRITERS.has(n)) &&
      !f.text.includes("revalidateGarden("),
  ).map((f) => f.path);

  assert.deepEqual(
    offenders,
    [],
    `these files write the garden but never call revalidateGarden() — the ` +
      `public site will serve the pre-write garden until GARDEN_TTL expires`,
  );
});

test("the four write doors are all still here", () => {
  // The converse of the test above, which passes vacuously if someone deletes
  // a door's writer import along with its invalidation.
  const doors = FILES.filter((f) => f.text.includes("revalidateGarden(")).map((f) => f.path);
  assert.deepEqual(doors.sort(), [
    "app/admin/actions.ts",
    "app/api/articles/route.ts",
    "app/api/pollen/sync/route.ts",
    "app/api/synthesis/route.ts",
  ]);
});

test("the write path reads the LIVE garden, never the cached one", () => {
  const actions = FILES.find((f) => f.path === "app/admin/actions.ts");
  assert.ok(actions, "app/admin/actions.ts must exist");
  assert.ok(
    importedNames(actions.text).has("loadRawGarden"),
    "app/admin/actions.ts must read the live garden",
  );
  assert.equal(
    importedNames(actions.text).has("loadCachedGarden"),
    false,
    "app/admin/actions.ts must NOT read the cached garden — editVersionAction " +
      "and promoteSeedAction re-read after writing so publishCascade sees the " +
      "just-saved state, and a cached read there publishes the wrong parents",
  );
});

test("the public zone reads the CACHED garden, never the live one", () => {
  const offenders = FILES.filter(
    (f) =>
      (f.path.startsWith("app/(public)/") || f.path === "app/api/graph/route.ts") &&
      importedNames(f.text).has("loadRawGarden"),
  ).map((f) => f.path);

  assert.deepEqual(
    offenders,
    [],
    "these public files bypass the cache and hit Mongo on every request",
  );
});

test("no revalidatePath survives anywhere under app/", () => {
  const offenders = FILES.filter((f) => f.text.includes("revalidatePath")).map((f) => f.path);
  assert.deepEqual(
    offenders,
    [],
    "revalidatePath invalidated nothing here (every page is force-dynamic) — " +
      "its return means someone reasoned from the pre-cache model",
  );
});
```

- [ ] **Step 2: Run it and read the failures as the task list**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/garden-cache-source.test.ts`
Expected: 2 PASS, 3 FAIL —

- *"every file under app/ that imports a garden writer also invalidates the garden"* fails listing `app/admin/actions.ts`, `app/api/articles/route.ts`, `app/api/pollen/sync/route.ts`, `app/api/synthesis/route.ts` → Task 5.
- *"the four write doors are all still here"* fails with `[]` → Task 5.
- *"no revalidatePath survives anywhere under app/"* fails listing `app/admin/actions.ts` → Task 5.

The two that already pass are *"the write path reads the LIVE garden"* (true today, and the point is that it stays true) and *"the public zone reads the CACHED garden"* — the latter passes **vacuously** right now, because Task 2 deleted `getPublicDataset` from `store.ts`, so the four pages import a name that no longer exists. Task 4 makes it pass for the right reason.

- [ ] **Step 3: Commit the failing test**

```bash
git add lib/garden-cache-source.test.ts
git commit -m "test: pin the four cache invariants before the callers move

Three of these fail right now, and the failures are the task list. The
one that matters most is the one that already passes: actions.ts must
keep reading the live garden, because two of its actions re-read after
writing on purpose.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Move the public readers onto the cache

**Files:**
- Modify: `app/(public)/page.tsx:4`
- Modify: `app/(public)/(chrome)/plant/[slug]/page.tsx:4`
- Modify: `app/(public)/(chrome)/pod/[slug]/page.tsx:4`
- Modify: `app/(public)/(chrome)/bean/[id]/page.tsx:6`
- Modify: `app/(public)/(chrome)/beanstalk/page.tsx:2,22`
- Modify: `app/api/graph/route.ts:2,12`

- [ ] **Step 1: Repoint the four `getPublicDataset` imports**

In each of the four pages, change the import specifier only — the call sites do not move:

```ts
import { getPublicDataset } from "@/lib/garden-cache";
```

- [ ] **Step 2: Switch the two direct callers**

`app/(public)/(chrome)/beanstalk/page.tsx` — line 2 becomes:

```ts
import { loadCachedGarden } from "@/lib/garden-cache";
```

and line 22:

```ts
  const [raw, allPollen] = await Promise.all([loadCachedGarden(), listPollen()]);
```

`app/api/graph/route.ts` — line 2 becomes:

```ts
import { loadCachedGarden } from "@/lib/garden-cache";
```

and line 12:

```ts
  return Response.json(toGraph(filterPublic(await loadCachedGarden())));
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` clean (the four errors from Task 2 are gone). *"the public zone reads the CACHED garden"* now passes non-vacuously; the three Task 5 failures remain.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)" app/api/graph/route.ts
git commit -m "perf: the public zone reads the garden through the Data Cache

Four pages change an import specifier; /beanstalk and /api/graph change
a call. TTFB on every public route stops depending on a Mongo round
trip, and /api/graph stops being a free DoS vector against the database.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: The four write doors

29 `revalidatePath` calls become 19 `revalidateGarden()` calls, and 2 are deleted outright. The reduction is not sloppiness: several actions pass two paths for one write, and one tag replaces both.

**Files:**
- Modify: `app/admin/actions.ts`
- Modify: `app/api/articles/route.ts`
- Modify: `app/api/synthesis/route.ts`
- Modify: `app/api/pollen/sync/route.ts`

- [ ] **Step 1: Swap the import in `app/admin/actions.ts`**

Line 4 becomes:

```ts
import { revalidateGarden } from "@/lib/garden-cache";
```

- [ ] **Step 2: Delete the two calls that were always dead**

`createSeedAction` (line 120) and `discardSeedAction` (line 128) write only the `seeds` collection, which nothing reads through a cache. **Delete both `revalidatePath("/admin");` lines with no replacement.** Putting a `revalidateGarden()` there would reintroduce on day one exactly what this slice is deleting: an invalidation call that invalidates nothing, standing where a later reader will assume it means something.

- [ ] **Step 3: Replace the remaining 27 with 19 calls**

One `revalidateGarden();` per action, at the position of the **first** `revalidatePath` it had; delete any second or third. This is the complete map — line numbers are pre-edit, so work bottom-up or re-grep as you go:

| Action | Was | Becomes |
|---|---|---|
| `promoteSeedAction` | 214 | one call |
| `editVersionAction` | 252 | one call |
| `deleteVersionAction` | 298 | one call |
| `editContentAction` | 326 | one call |
| `editSproutMediaAction` | 345 | one call |
| `editContainerContentAction` | 377 | one call |
| `editPlantRoleAction` | 415 | one call |
| `editPlantMetaAction` | 453, 457 | one call at 453 |
| `editPlantLogoAction` | 481, 482 | one call at 481 |
| `flipPlantField` | 529, 533 | one call at 529 |
| `editBeanCoverAction` | 586, 587 | one call at 586 |
| `editBeanKeywordAction` | 619, 620 | one call at 619 |
| `syncNowAction` | 630 | one call |
| `createScreenAction` | 701 | one call |
| `editScreenMetaAction` | 719 | one call |
| `editScreenImageAction` | 741 | one call |
| `deleteScreenAction` | 764 | one call |
| `toggleScreenExhibitAction` | 926, 927 | one call at 926 |
| `reorderExhibitionAction` | 958, 961 | one call at 958 |

`flipPlantField` is a non-exported helper shared by `setPlantStatusAction` and `setPlantVisibilityAction`; one call in it covers both. Lines 927 and 961 are the conditional `revalidatePath(\`/admin/plant/${…}\`)` forms — **delete them outright**, including the `if (outcome.kind === "settled")` guard on 927 where that guard exists only to wrap the revalidate. Read the surrounding lines before cutting; if the guard does anything else, keep the guard and remove only the call.

Three comments in this file explain that `revalidatePath` invalidates nothing because every page is `force-dynamic` — at `:416-417`, `:454-457` and `:585-586`. **Delete those comments too.** They documented a workaround that no longer exists.

- [ ] **Step 4: Wire the three API write doors**

`app/api/articles/route.ts` — add the import, then call it immediately after `writeArticles(...)` succeeds and before the success `Response.json(...)`:

```ts
import { revalidateGarden } from "../../../lib/garden-cache";
```
```ts
  revalidateGarden();
```

`app/api/synthesis/route.ts` — same, after `upsertDigestDrafts(...)` succeeds:

```ts
import { revalidateGarden } from "../../../lib/garden-cache";
```

`app/api/pollen/sync/route.ts` — same, after `runSync()` returns. Note the relative depth is one level deeper here:

```ts
import { revalidateGarden } from "../../../../lib/garden-cache";
```
```ts
  const results = await runSync();
  revalidateGarden();
```

In all three, the call goes on the **success path only** — an unauthorized or malformed request wrote nothing and must not evict a good cache entry. For `/api/pollen/sync`, `runSync()` returning a mix of ok and error results still means something was written, so it invalidates unconditionally once `runSync` returns.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm test`
Expected: all five tests in `lib/garden-cache-source.test.ts` PASS, including *"the four write doors are all still here"* listing exactly those four paths. Full suite green.

Then confirm the count by hand:

Run: `grep -c "revalidateGarden()" app/admin/actions.ts`
Expected: `19`

- [ ] **Step 6: Commit**

```bash
git add app/admin/actions.ts app/api
git commit -m "feat: one tag at four doors, replacing 29 revalidatePath calls

Three of the four doors are not actions — /api/articles, /api/synthesis
and /api/pollen/sync write beans and sprouts without going near
actions.ts, and an action-guard-only invalidation would have left them
serving the pre-write garden until the next deploy.

The two seed-only actions lose their call with no replacement: seeds are
not in the garden, and a call that invalidates nothing is what this
slice is deleting.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Bound the cold-cache failure

Audit B5. Both of these default to 30 s today, so an Atlas outage holds every request for half a minute before failing.

**Files:**
- Modify: `lib/db.ts:19`

- [ ] **Step 1: Add the options**

Replace `const client = new MongoClient(uri);` with:

```ts
    // Both default to 30 s, which is how an outage came to hold a request for
    // half a minute before failing it. 5 s is the useful bound: with a warm
    // Data Cache the public zone never reaches this code at all — it renders
    // stale from the cached garden — so this applies only to a cold cache and
    // to the admin, where a fast error beats a long hang.
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5_000,
      connectTimeoutMS: 5_000,
    });
```

- [ ] **Step 2: Verify the DB suite still connects**

Run: `npm run test:db`
Expected: PASS. 5 s is ample for a local or Atlas connection; a failure here means the connection was genuinely slow, not that the option is wrong.

- [ ] **Step 3: Commit**

```bash
git add lib/db.ts
git commit -m "fix: an unreachable Mongo fails in 5s instead of 30

With a warm cache the public zone never reaches this code — it renders
stale. This bounds the cold-cache path.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: The 404 and error pages

Three files. `error.tsx` **must** carry `"use client"` — Next requires it of every error boundary — and Next puts the component in the client bundle of every route the boundary covers. So it imports nothing: no `lucide-react`, no `cn` (and therefore no `clsx`, no `tailwind-merge`), no registry primitive.

**Files:**
- Create: `app/not-found.tsx`
- Create: `app/(public)/(chrome)/not-found.tsx`
- Create: `app/(public)/error.tsx`
- Test: `lib/not-found-pages.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// lib/not-found-pages.test.tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import RootNotFound from "@/app/not-found";
import PublicError from "@/app/(public)/error";

test("the root 404 offers a way back to the site", () => {
  const html = renderToStaticMarkup(<RootNotFound />);
  assert.match(html, /href="\/"/, "a 404 with no way out is a dead end");
});

/**
 * The reset control is the only affordance an error page has. An error page
 * whose one control is broken is worse than Next's default, which at least
 * does not pretend.
 */
test("the public error boundary renders a working reset control", () => {
  let reset = 0;
  const html = renderToStaticMarkup(
    <PublicError error={new Error("boom")} reset={() => { reset += 1; }} />,
  );
  assert.match(html, /<button/, "reset must be a real button");
  assert.match(html, /href="\/"/, "and there must still be a way home");
  assert.equal(reset, 0, "reset must not fire during render");
});

/**
 * The error boundary ships in the client bundle of every public route, in the
 * slice right after the rulebook rewrite took a client boundary OUT of the
 * public zone. These imports are what would make it expensive.
 */
test("the public error boundary imports nothing that costs bytes", () => {
  const source = readFileSync(join(process.cwd(), "app/(public)/error.tsx"), "utf8");
  for (const banned of ["lucide-react", "@/lib/utils", "@/components/ui/"]) {
    assert.ok(
      !source.includes(banned),
      `app/(public)/error.tsx must not import ${banned} — it is a client ` +
        `boundary on every public route, so every import is shipped`,
    );
  }
});

test("the public error boundary is a client component, as Next requires", () => {
  const source = readFileSync(join(process.cwd(), "app/(public)/error.tsx"), "utf8");
  assert.match(source, /^\s*["']use client["']/m);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/not-found-pages.test.tsx`
Expected: FAIL — `Cannot find module '@/app/not-found'`.

- [ ] **Step 3: Write `app/not-found.tsx`**

English-only and deliberately so: this is the unmatched-URL fallback, which Next renders inside `app/layout.tsx` with no zone chrome and no access to the reading language. A half-translated page would be a worse lie than an English one.

```tsx
import { READING_COLUMN } from "@/components/page-column";

/**
 * Unmatched URLs. Root layout only — Next gives the root not-found boundary no
 * zone chrome, which is a documented constraint rather than a choice here. The
 * three public `notFound()` calls resolve to the nearer boundary at
 * `app/(public)/(chrome)/not-found.tsx` and DO get the chrome.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center">
      <div className={READING_COLUMN}>
        <h1 className="font-mono text-2xl">Not here</h1>
        <p className="mt-3 text-muted-foreground">
          This page does not exist, or it was never public.
        </p>
        <p className="mt-8">
          <a href="/" className="underline underline-offset-4">
            Back to Ariko
          </a>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Write `app/(public)/(chrome)/not-found.tsx`**

This one renders inside `(chrome)/layout.tsx`, which already supplies the mark, the nav, the language switch and the column — so it renders its copy and nothing else, and it reads the language because the zone around it does.

```tsx
import { currentLang } from "@/lib/locale-server";

/**
 * The boundary the three public `notFound()` calls resolve to —
 * `plant/[slug]`, `pod/[slug]` and `bean/[id]`. It renders INSIDE
 * `(chrome)/layout.tsx`, so the mark, the nav, the language switch and the
 * measure are already there and this file adds none of them.
 *
 * Bilingual, unlike `app/not-found.tsx`, for the reason that file states: this
 * one sits inside the language-aware zone and `currentLang()` is one call away.
 */
const COPY = {
  en: {
    title: "Not here",
    body: "This page does not exist, or it is not public yet.",
    home: "Back to the garden",
  },
  fr: {
    title: "Rien ici",
    body: "Cette page n'existe pas, ou n'est pas encore publique.",
    home: "Retour au jardin",
  },
} as const;

export default async function ChromeNotFound() {
  const copy = COPY[await currentLang()];
  return (
    <div>
      <h1 className="font-mono text-2xl">{copy.title}</h1>
      <p className="mt-3 text-muted-foreground">{copy.body}</p>
      <p className="mt-8">
        <a href="/" className="underline underline-offset-4">
          {copy.home}
        </a>
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Write `app/(public)/error.tsx`**

```tsx
"use client";

/**
 * The public zone's error boundary.
 *
 * `"use client"` is Next's requirement, not a choice — and Next puts this
 * component in the client bundle of every route the boundary covers, which is
 * the whole public zone. That is a client boundary added in the slice right
 * after the rulebook rewrite removed one, so this file imports NOTHING:
 * literal Tailwind strings rather than `cn`, no registry primitive, no lucide.
 * `lib/not-found-pages.test.tsx` pins that.
 *
 * English-only, unlike the chrome 404: a client component cannot read the
 * language cookie, and the reading language is not worth a second boundary.
 *
 * Rare by construction now. With a warm Data Cache a Mongo outage renders the
 * stale garden and never reaches here; this is for a cold cache and for the
 * genuinely unexpected.
 */
export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-svh items-center">
      <div className="mx-auto w-full max-w-3xl px-6">
        <h1 className="font-mono text-2xl">Something broke</h1>
        <p className="mt-3 text-muted-foreground">
          This page could not be loaded. It is usually temporary.
        </p>
        <p className="mt-8 flex gap-6">
          <button
            type="button"
            onClick={reset}
            className="underline underline-offset-4"
          >
            Try again
          </button>
          <a href="/" className="underline underline-offset-4">
            Back to Ariko
          </a>
        </p>
      </div>
    </main>
  );
}
```

Note the prop signature: Next passes `{ error, reset }`, and this component uses only `reset`. `error` stays in the type because Next supplies it and the test constructs it.

- [ ] **Step 6: Run the tests**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/not-found-pages.test.tsx`
Expected: PASS, 4 tests.

Then the whole suite: `npm test && npx tsc --noEmit`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add app/not-found.tsx "app/(public)/(chrome)/not-found.tsx" "app/(public)/error.tsx" lib/not-found-pages.test.tsx
git commit -m "feat: a 404 that can be navigated away from, and an error page

Three boundaries. The chrome 404 renders inside the chrome layout, so a
mistyped slug keeps the mark, the nav and the language switch instead of
being a dead end.

error.tsx must be a client component — Next requires it — so it imports
nothing at all, and a test pins that.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Measure, then record what was measured

The spec commits to a number in §5. This task produces it.

**Files:**
- Modify: `docs/superpowers/specs/2026-09-11-cache-the-garden-design.md` §5

- [ ] **Step 1: Capture the baseline**

```bash
git stash list >/dev/null
git worktree add /tmp/ariko-baseline main
cd /tmp/ariko-baseline && npm ci --silent && npm run build 2>&1 | tee /tmp/baseline-build.txt
```

Record the "First Load JS" column for `/`, `/plant/[slug]`, `/pod/[slug]`, `/bean/[id]` and `/beanstalk`.

- [ ] **Step 2: Build the branch and compare**

```bash
cd /Users/alexis/code/ariko && npm run build 2>&1 | tee /tmp/branch-build.txt
diff <(grep -E "^[├└┌│] " /tmp/baseline-build.txt) <(grep -E "^[├└┌│] " /tmp/branch-build.txt) || true
```

Expected: the only per-route growth is the `error.tsx` boundary, ≲ 1 kB on public routes. **If it is larger, stop and report the number** — §3.4 of the spec says that is a finding to surface rather than absorb, and the likely cause is an accidental import.

- [ ] **Step 3: Write the measured numbers into the spec**

Replace the second bullet of §5 with the actual before/after figures per route, as a small table. No prose estimate survives this step.

- [ ] **Step 4: Clean up the worktree**

```bash
git worktree remove /tmp/ariko-baseline
```

- [ ] **Step 5: Full verification**

Run each and confirm green before claiming anything:

```bash
npm run lint
npm test
npm run test:db
npm run build
```

- [ ] **Step 6: The one thing no test can assert**

With `npm run dev`, in the admin: edit a public plant's name and save. Load its public page. The new name must be there on the **next request**, not in five minutes. This needs both a Next runtime and a database, which is why it is a human step and not a test.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/specs/2026-09-11-cache-the-garden-design.md
git commit -m "docs: record the measured bundle delta in the cache spec

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Roadmap and PR

- [ ] **Step 1: Strike item 2 from the roadmap**

In `docs/superpowers/ROADMAP.md`, mark item 2 shipped in the style item 1 already uses:

```markdown
2. ~~**Cache the garden.**~~ Shipped — [`specs/2026-09-11-cache-the-garden-design.md`](specs/2026-09-11-cache-the-garden-design.md).
```

Add the cache to the "Shipped" paragraph's list, and update **Last updated** to `2026-09-11`.

- [ ] **Step 2: Commit and open the PR**

This ships something a visitor would notice — a faster site that survives an outage — so the PR body **requires a Lab Note** (CLAUDE.md §Lab Note requirement).

```bash
git add docs/superpowers/ROADMAP.md
git commit -m "docs: the roadmap stops listing the garden cache as next

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push -u origin cache-the-garden
```

PR body must include, verbatim in shape:

````markdown
## Lab Note

```yaml
en:
  title: The site got quicker, and stopped minding when the database naps
  summary: Pages no longer wait on a database round trip before they start
    drawing, so everything lands faster. And if the database has a bad
    moment, you get the last good version of the page instead of an error.
fr:
  title: Le site est plus rapide, et ne panique plus si la base fait la sieste
  summary: Les pages n'attendent plus la base de données pour s'afficher,
    donc tout arrive plus vite. Et si la base a un coup de mou, tu vois la
    dernière version correcte de la page plutôt qu'une erreur.
suggested:
  molecule: ariko
  type: improvement
  tags: [changelog]
```
````

---

## Self-review notes

**Spec coverage.** §3.1 → Tasks 1, 2. §3.2 → Task 5. §3.3 → Task 6. §3.4 → Task 7. §3.5 → Tasks 1, 2. §4.1 → Tasks 2, 6. §4.2 → Task 7. §4.3 → Task 3. §5 → Task 8. §6 is the non-goals list and needs no task.

**One deviation from the spec, deliberate.** §3.5 describes the size guard as living in `lib/garden-cache.ts`. The plan splits the pure half into `lib/garden-size.ts` so `node --test` can exercise it without importing `next/cache` — the same split `lib/locale.ts` / `lib/locale-server.ts` already makes, for the same reason. The behaviour is identical.

**Names used consistently throughout:** `loadRawGarden` (live), `loadCachedGarden` (cached), `getPublicDataset`, `revalidateGarden`, `GARDEN_TAG`, `GARDEN_TTL`, `GARDEN_WARN_BYTES`, `gardenCacheWarning`.
