# Editing from the garden map — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a plant, pod, bean or sprout on `/admin/map` opens that entity's real admin page in a side sheet over the map, editable in place.

**Architecture:** A parallel-route slot `map/@entity/` holds five `(..)` interceptors that wrap the existing page modules. The slot lives under `map`, so it is only active while the router is on the map. A client `MapSheet`, mounted by `map/layout.tsx`, draws the frame. The frame is a `transform`ed box, so the pages' viewport-fixed pieces (rail, rail panel, editor commit) land inside it. No server action and no node href changes.

**Tech Stack:** Next.js 15 App Router (parallel + intercepting routes), React 19, Tailwind v4, `node:test` via `npm test`.

**Spec:** [`docs/superpowers/specs/2026-11-15-map-entity-sheet-design.md`](../specs/2026-11-15-map-entity-sheet-design.md). Read it first, especially "Spike first": Task 5 is a **gate**.

**Ground rules from CLAUDE.md that bite here**

- Never `npm run build` or `rm -rf .next` in `/Users/alexis/code/ariko` (the main checkout): Alexis's dev server shares it. This worktree has its own `.next`; the dev server in Task 1 and any build in Task 10 must not run at the same time.
- Never point anything at the real database. Every server in this plan runs with `MONGODB_DB=beanstalk_scratch`.
- Tailwind v4 scans source as text: never write a utility class name inside a comment.
- Every check in `lib/*-source.test.ts` exists because `tsc`, `npm test` and `npm run build` all pass with the thing broken. Add the test the day you add the file.
- Commit trailer: end every commit message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

## File structure

| File | Create / modify | Responsibility |
|---|---|---|
| `lib/map-sheet.ts` | create | Pure, import-free helpers and constants: close href, "is the sheet open for this path", the dirty-editor predicate and the discard confirm. Client-safe. |
| `lib/map-sheet.test.ts` | create | Unit tests for the above. |
| `app/admin/_components/map-sheet.tsx` | create | The sheet's frame (client). Open state from the pathname, close link, Escape, discard guard. |
| `app/admin/(chrome)/map/layout.tsx` | create | Renders `children` and `<MapSheet>{entity}</MapSheet>`. |
| `app/admin/(chrome)/map/@entity/default.tsx` | create | `null`. |
| `app/admin/(chrome)/map/@entity/page.tsx` | create | `null`: the slot at `/admin/map`, which is what closing navigates to. |
| `app/admin/(chrome)/map/@entity/(..)plant/[slug]/page.tsx` | create | Wraps the plant hub page. |
| `app/admin/(chrome)/map/@entity/(..)plant/[slug]/narrative/page.tsx` | create | Wraps the plant narrative page. |
| `app/admin/(chrome)/map/@entity/(..)pod/[slug]/page.tsx` | create | Wraps the pod page. |
| `app/admin/(chrome)/map/@entity/(..)bean/[id]/page.tsx` | create | Wraps the bean page. |
| `app/admin/(chrome)/map/@entity/(..)sprout/[slug]/page.tsx` | create | Wraps the sprout page. |
| `app/admin/_components/entity-rail.tsx` | modify (line 477) | Add `data-entity-page` to the page-offset wrapper so the sheet can switch the viewport-gated offset off. |
| `components/editor/suggestion-menu.tsx` | modify (**conditional**, Task 6) | Portal the `@`/`/` menu to `document.body`. |
| `components/editor/prose-editor.tsx` | modify (~line 472) | `data-editor-dirty` on the editor's surface while `dirty`. |
| `app/admin/_components/garden-map.tsx` | modify | Capture-phase click guard: a node click asks before it discards a dirty editor. |
| `lib/garden-map-source.test.ts` | modify | Allow `@/lib/map-sheet` as a value import in the island. |
| `lib/map-sheet-source.test.ts` | create | The structural rules of the slice (spec "Testing"). |
| `docs/superpowers/specs/2026-11-15-garden-map-design.md`, `…-map-entity-sheet-design.md`, `CLAUDE.md` | modify | Docs (Task 9). |

---

### Task 1: A scratch environment and a seeded garden

Everything after this is verified in a browser against a database that is not production.

**Files:**
- Create (temporary, **not committed**): `.env.local` in the worktree, `scripts/spike-seed.ts`

- [ ] **Step 1: Confirm `.env.local` is ignored, then copy it with scratch overrides**

```bash
cd /Users/alexis/code/ariko/.claude/worktrees/editor-data-loss-lists-c3da33
git check-ignore .env.local && echo "ignored: ok"
cp /Users/alexis/code/ariko/.env.local .env.local
# Override, or append when absent. A scratch admin password means no real credential is typed into a browser.
for kv in "MONGODB_DB=beanstalk_scratch" "ADMIN_PASSWORD=spike-local-only"; do
  key="${kv%%=*}"
  if grep -q "^${key}=" .env.local; then sed -i '' "s|^${key}=.*|${kv}|" .env.local; else echo "${kv}" >> .env.local; fi
done
grep -E "^(MONGODB_DB|ADMIN_PASSWORD)=" .env.local
```

Expected: `ignored: ok`, then `MONGODB_DB=beanstalk_scratch` and `ADMIN_PASSWORD=spike-local-only`. If `git check-ignore` prints nothing, **stop** and do not copy the file in.

The copied file still holds the real Cloudinary credentials: **do not upload an image anywhere in this plan.**

- [ ] **Step 2: Write the seed script**

Create `scripts/spike-seed.ts`:

```ts
import { closeDb, getDb } from "../lib/db";
import { createBean, createPod, createSprout, ensureBotanicalIndexes } from "../lib/botanical";

/**
 * TEMPORARY. Seeds the scratch database for the map-sheet spike. Refuses to
 * run against anything but `beanstalk_scratch`. Deleted in Task 10.
 */
async function main() {
  if (process.env.MONGODB_DB !== "beanstalk_scratch") {
    throw new Error(`refusing to seed MONGODB_DB=${process.env.MONGODB_DB ?? "(unset)"}`);
  }
  await ensureBotanicalIndexes();
  const db = await getDb();
  await db.collection("plants").updateOne(
    { slug: "spike" },
    {
      $set: {
        slug: "spike",
        name: "Spike plant",
        natures: ["work"],
        role: { kind: "owner" },
        description: "A scratch plant for the map sheet.",
        visibility: "private",
      },
    },
    { upsert: true },
  );
  const tolerate = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err) {
      if (!(err instanceof Error) || err.name !== "SlugExistsError") throw err;
    }
  };
  await tolerate(() => createPod({ slug: "spike-pod", name: "Spike pod", plantSlug: "spike", description: "A pod." }));
  await tolerate(() =>
    createBean({ slug: "spike-bean", name: "Spike bean", description: "A bean.", podSlug: "spike-pod", plantSlug: null }),
  );
  await tolerate(() =>
    createBean({ slug: "spike-bean-two", name: "Second bean", description: "Another.", podSlug: "spike-pod", plantSlug: null }),
  );
  await tolerate(() =>
    createSprout({
      slug: "spike-sprout",
      name: "Spike sprout",
      kind: "log",
      date: "2026-11-15",
      description: "A draft entry.",
      state: "draft",
      about: ["bean:spike-bean"],
      media: [],
      source: { kind: "manual" },
    }),
  );
  console.log("seeded: plant spike, pod spike-pod, beans spike-bean + spike-bean-two, sprout spike-sprout");
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Run it against the scratch database**

```bash
cd /Users/alexis/code/ariko/.claude/worktrees/editor-data-loss-lists-c3da33
TSX_TSCONFIG_PATH=tsconfig.test.json MONGODB_DB=beanstalk_scratch node --env-file=.env.local --import tsx scripts/spike-seed.ts
```

Expected: `seeded: plant spike, …`. If `SlugExistsError` is not the thrown error's `name`, the second run prints a duplicate-key error: read `lib/botanical.ts` for the class and fix the `tolerate` check; do not remove the guard.

- [ ] **Step 4: Start the dev server on its own port, in the background**

Run with `run_in_background`:

```bash
cd /Users/alexis/code/ariko/.claude/worktrees/editor-data-loss-lists-c3da33 && MONGODB_DB=beanstalk_scratch npx next dev -p 3401
```

Wait for `Ready`. Then in the built-in browser: navigate to `http://localhost:3401/admin/login`, sign in with the scratch password `spike-local-only`, and open `/admin/map`.

Expected: a map with **one** plant ("Spike plant"), its pod, two beans and one draft sprout. If it shows a dozen plants it is reading production: **stop the server and fix the env before anything else.**

- [ ] **Step 5: No commit.** These files are scratch (`.env.local` is ignored; `scripts/spike-seed.ts` is removed in Task 10).

---

### Task 2: The pure helpers (TDD)

**Files:**
- Create: `lib/map-sheet.ts`
- Test: `lib/map-sheet.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/map-sheet.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DISCARD_PROMPT,
  EDITOR_DIRTY_ATTR,
  MAP_PATH,
  confirmDiscard,
  hasUnsavedEdit,
  mapCloseHref,
  sheetOpenFor,
} from "./map-sheet";

test("closing returns to the map with the query the author left it with", () => {
  assert.equal(mapCloseHref(""), MAP_PATH);
  assert.equal(mapCloseHref("?plant=ariko&view=review"), "/admin/map?plant=ariko&view=review");
  // `URLSearchParams.toString()` carries no `?`; a caller may pass either.
  assert.equal(mapCloseHref("plant=ariko"), "/admin/map?plant=ariko");
});

test("the sheet is open on every path but the map's own", () => {
  assert.equal(sheetOpenFor("/admin/map"), false);
  assert.equal(sheetOpenFor("/admin/map/"), false);
  assert.equal(sheetOpenFor("/admin/bean/spike-bean"), true);
  assert.equal(sheetOpenFor("/admin/plant/spike/narrative"), true);
});

test("an editor is unsaved exactly when the dirty marker is in the sheet", () => {
  const clean = { querySelector: () => null };
  const dirty = { querySelector: (selector: string) => (selector === `[${EDITOR_DIRTY_ATTR}]` ? {} : null) };
  assert.equal(hasUnsavedEdit(null), false);
  assert.equal(hasUnsavedEdit(clean), false);
  assert.equal(hasUnsavedEdit(dirty), true);
});

test("a clean sheet never asks; a dirty one asks once and obeys the answer", () => {
  const dirty = { querySelector: () => ({}) };
  const clean = { querySelector: () => null };
  const asked: string[] = [];
  const yes = (message: string) => (asked.push(message), true);
  const no = (message: string) => (asked.push(message), false);

  assert.equal(confirmDiscard(clean, yes), true);
  assert.deepEqual(asked, []);
  assert.equal(confirmDiscard(dirty, yes), true);
  assert.equal(confirmDiscard(dirty, no), false);
  assert.deepEqual(asked, [DISCARD_PROMPT, DISCARD_PROMPT]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- 2>&1 | grep -A6 "map-sheet"` (the whole suite runs; read the `lib/map-sheet.test.ts` lines).
Expected: FAIL: cannot find module `./map-sheet`.

- [ ] **Step 3: Write the implementation**

Create `lib/map-sheet.ts`:

```ts
/**
 * The map's entity sheet — the parts of it that are arithmetic.
 *
 * No imports, on purpose: `app/admin/_components/garden-map.tsx` (a client
 * island that may import only types from `lib/` plus this) and `map-sheet.tsx`
 * both read these, and `lib/garden-map-source.test.ts` forbids any `lib/`
 * module that reaches `node:fs` from a client file.
 */

export const MAP_PATH = "/admin/map";

/** On the sheet's root, so the island can find it without a ref crossing files. */
export const MAP_SHEET_ATTR = "data-map-sheet";

/** On the prose editor's surface while it holds an unsaved edit. */
export const EDITOR_DIRTY_ATTR = "data-editor-dirty";

export const DISCARD_PROMPT = "You have unsaved changes in this editor. Discard them?";

/**
 * Where closing goes. The sheet's own URL is `/admin/bean/x`, so the map's
 * `?plant=` and `?view=` are gone from it; the caller keeps the last map query
 * it saw and hands it back here. Accepts `location.search` (with `?`) or
 * `URLSearchParams#toString()` (without).
 */
export function mapCloseHref(search: string): string {
  const query = search.startsWith("?") ? search.slice(1) : search;
  return query ? `${MAP_PATH}?${query}` : MAP_PATH;
}

/**
 * The sheet is open whenever the router is anywhere but the map itself while
 * the map's layout is still mounted — which is exactly the interception: the
 * layout is unmounted by any navigation the slot does not catch.
 */
export function sheetOpenFor(pathname: string): boolean {
  return pathname.replace(/\/$/, "") !== MAP_PATH;
}

/** The slice of `ParentNode` this needs, so a test passes a plain object. */
export interface Queryable {
  querySelector(selector: string): unknown;
}

export function hasUnsavedEdit(root: Queryable | null): boolean {
  return Boolean(root?.querySelector(`[${EDITOR_DIRTY_ATTR}]`));
}

/**
 * True when it is safe to leave: nothing is unsaved, or the author said so.
 * `confirm` is a parameter so a test supplies the answer.
 */
export function confirmDiscard(
  root: Queryable | null,
  confirm: (message: string) => boolean = (message) => window.confirm(message),
): boolean {
  return hasUnsavedEdit(root) ? confirm(DISCARD_PROMPT) : true;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add lib/map-sheet.ts lib/map-sheet.test.ts
git commit -m "Map sheet: the pure helpers — close href, open state, discard guard

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The sheet's frame

**Files:**
- Create: `app/admin/_components/map-sheet.tsx`

- [ ] **Step 1: Write the component**

Create `app/admin/_components/map-sheet.tsx`:

```tsx
"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { MAP_PATH, confirmDiscard, mapCloseHref, sheetOpenFor } from "@/lib/map-sheet";
import { cn } from "@/lib/utils";

/**
 * Where Escape must NOT close the sheet: a field, the editor, or any menu or
 * popover the page opened. A dismiss that also discards a draft is the thing
 * this component exists not to do. Base UI popups portal out of the sheet but
 * React events bubble through portals, so the role check is load-bearing.
 */
const KEEP_ESCAPE =
  'input, textarea, select, [contenteditable="true"], [role="listbox"], [role="menu"], [role="dialog"]';

/**
 * The frame around the entity page the `@entity` slot renders — spec
 * 2026-11-15 §"The sheet". The frame only: no form, no action, no field.
 *
 * MOUNTED BY `map/layout.tsx`, so it survives every swap from one entity to
 * the next; the slot's content changes inside it. It is open exactly when the
 * router is somewhere other than the map (`sheetOpenFor`), because the map's
 * layout is unmounted by any navigation the slot does not intercept.
 *
 * THE `transform` IS LOAD-BEARING. A transformed element is the containing
 * block for its `position: fixed` descendants, which is what pulls the entity
 * rail's icon cluster, its 448px panel and the editor's floating commit INTO
 * the sheet instead of leaving them over the map. `lib/map-sheet-source.test.ts`
 * pins it. The consequence is the one `entity-rail.tsx` documents for the page
 * offset: viewport coordinates stop meaning viewport. The `@`/`/` menu is the
 * one place that computes them.
 *
 * TWO BOXES, because a scrolling container is also a containing block: with
 * the scroller itself transformed, the rail and the commit would scroll away
 * with the prose. The outer box is fixed, transformed and does not scroll; the
 * inner one scrolls; fixed descendants measure against the outer one, and the
 * inner box's overflow does not clip them.
 *
 * Z 30, under the chrome's 40, so the public-site and log-out buttons stay
 * reachable; the ✕ is on the left for the same reason, and the top padding
 * clears the cluster as `AdminMain`'s does.
 *
 * Closing is a real `href` and never `router.back()`: after a save the history
 * holds redirect hops. The map's own query is kept here, in state set during
 * render from the URL while it is the map's, because the sheet's URL has none.
 */
export function MapSheet({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const sheet = useRef<HTMLElement>(null);

  const [mapSearch, setMapSearch] = useState("");
  if (pathname === MAP_PATH && search.toString() !== mapSearch) setMapSearch(search.toString());

  if (!sheetOpenFor(pathname)) return null;

  const closeHref = mapCloseHref(mapSearch);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if ((event.target as HTMLElement).closest(KEEP_ESCAPE)) return;
    if (confirmDiscard(sheet.current)) router.push(closeHref);
  }

  return (
    <aside
      ref={sheet}
      data-map-sheet
      aria-label="Entity editor"
      onKeyDown={onKeyDown}
      className={cn(
        "fixed inset-y-0 right-0 z-30 w-full max-w-[44rem] transform-gpu overflow-hidden border-l bg-card shadow-xl",
        "duration-200 animate-in slide-in-from-right",
        // The rail's page offset is viewport-gated (it needs 1216px of
        // viewport) and means nothing inside a 44rem box; the rail's panel
        // then floats over the prose, dismissible, as it does below that width.
        "[&_[data-entity-page]]:right-0!",
      )}
    >
      <Link
        href={closeHref}
        aria-label="Close"
        onClick={(event) => {
          if (!confirmDiscard(sheet.current)) event.preventDefault();
        }}
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "absolute left-4 top-4 z-10")}
      >
        <X />
      </Link>
      <div className="h-full overflow-y-auto px-6 pb-16 pt-24">{children}</div>
    </aside>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no output. If `buttonVariants` does not accept `size: "icon"`, read `components/ui/button.tsx` for the real size name and use it.

- [ ] **Step 3: Commit**

```bash
git add app/admin/_components/map-sheet.tsx
git commit -m "Map sheet: the frame — transformed box, real-href close, Escape guard

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The slot and the layout

**Files:**
- Create: `app/admin/(chrome)/map/layout.tsx`, `app/admin/(chrome)/map/@entity/default.tsx`, `app/admin/(chrome)/map/@entity/page.tsx`, and the five wrappers under `app/admin/(chrome)/map/@entity/(..)…`
- Modify: `app/admin/_components/entity-rail.tsx:477`

- [ ] **Step 1: The layout**

Create `app/admin/(chrome)/map/layout.tsx`:

```tsx
import { Suspense, type ReactNode } from "react";
import { MapSheet } from "../../_components/map-sheet";

/**
 * The map's layout exists to hold the `@entity` slot (spec 2026-11-15
 * §"Mechanism"). The slot lives HERE and not under `(chrome)` as the screen
 * sheet's does, so that interception is active only while the router is on the
 * map: an interceptor at the chrome level would turn every link to a bean in the
 * tables, the palette and the lineage chrome into a sheet.
 *
 * `useSearchParams` in `MapSheet` wants a boundary; `null` because a half-drawn
 * sheet frame is worse than none.
 */
export default function MapLayout({ children, entity }: { children: ReactNode; entity: ReactNode }) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <MapSheet>{entity}</MapSheet>
      </Suspense>
    </>
  );
}
```

- [ ] **Step 2: The two empty slot routes**

Create `app/admin/(chrome)/map/@entity/default.tsx`:

```tsx
/**
 * The slot, closed: what a hard load of any route renders for `@entity`.
 * A parallel route needs one for every route that does not fill it.
 */
export default function NoEntity() {
  return null;
}
```

Create `app/admin/(chrome)/map/@entity/page.tsx`:

```tsx
/**
 * The slot at `/admin/map` itself — deliberately nothing, and the reason Close
 * closes. On a SOFT navigation Next keeps a slot's previous state instead of
 * falling back to `default.tsx`, so without a route that MATCHES the map the
 * sheet would stay open over it after the URL changed back. This is the screen
 * sheet's `@sheet/screens/page.tsx` for the same reason, and
 * `lib/map-sheet-source.test.ts` pins its existence: deleting it as dead code
 * re-opens the bug.
 */
export default function NoEntityOnMap() {
  return null;
}
```

- [ ] **Step 3: The five wrappers**

Each imports the standalone page module and renders it with the props it was given. Create each file exactly:

`app/admin/(chrome)/map/@entity/(..)plant/[slug]/page.tsx`:

```tsx
import PlantPage from "@/app/admin/(chrome)/plant/[slug]/page";

export const dynamic = "force-dynamic";

/** A plant's hub, in the map's sheet: the page's own module, imported. */
export default function PlantInMapSheet(props: Parameters<typeof PlantPage>[0]) {
  return <PlantPage {...props} />;
}
```

`app/admin/(chrome)/map/@entity/(..)plant/[slug]/narrative/page.tsx`:

```tsx
import PlantNarrativePage from "@/app/admin/(chrome)/plant/[slug]/narrative/page";

export const dynamic = "force-dynamic";

/** A plant's narrative editor, in the map's sheet: the page's own module, imported. */
export default function PlantNarrativeInMapSheet(props: Parameters<typeof PlantNarrativePage>[0]) {
  return <PlantNarrativePage {...props} />;
}
```

`app/admin/(chrome)/map/@entity/(..)pod/[slug]/page.tsx`:

```tsx
import PodPage from "@/app/admin/(chrome)/pod/[slug]/page";

export const dynamic = "force-dynamic";

/** A pod, in the map's sheet: the page's own module, imported. */
export default function PodInMapSheet(props: Parameters<typeof PodPage>[0]) {
  return <PodPage {...props} />;
}
```

`app/admin/(chrome)/map/@entity/(..)bean/[id]/page.tsx`:

```tsx
import BeanPage from "@/app/admin/(chrome)/bean/[id]/page";

export const dynamic = "force-dynamic";

/** A bean, in the map's sheet: the page's own module, imported. */
export default function BeanInMapSheet(props: Parameters<typeof BeanPage>[0]) {
  return <BeanPage {...props} />;
}
```

`app/admin/(chrome)/map/@entity/(..)sprout/[slug]/page.tsx`:

```tsx
import SproutPage from "@/app/admin/(chrome)/sprout/[slug]/page";

export const dynamic = "force-dynamic";

/** A sprout, in the map's sheet: the page's own module, imported. */
export default function SproutInMapSheet(props: Parameters<typeof SproutPage>[0]) {
  return <SproutPage {...props} />;
}
```

- [ ] **Step 4: Mark the rail's page wrapper**

In `app/admin/_components/entity-rail.tsx` line 477, change

```tsx
      <div className={`${PAGE_BASE} ${active || page ? PAGE_ASIDE : ""}`}>{children}</div>
```

to

```tsx
      <div data-entity-page className={`${PAGE_BASE} ${active || page ? PAGE_ASIDE : ""}`}>
        {children}
      </div>
```

(`data-entity-page` is what the sheet's `[&_[data-entity-page]]:right-0!` rule targets.)

- [ ] **Step 5: Type-check and run the existing suite**

Run: `npx tsc --noEmit && npm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: no tsc output, `# fail 0`. If a page's default export has a prop shape `Parameters<…>` rejects (for example the plant hub's `searchParams`), read that page's signature and pass the props through unchanged: the wrapper must stay a pass-through.

- [ ] **Step 6: Commit**

```bash
git add "app/admin/(chrome)/map" app/admin/_components/entity-rail.tsx
git commit -m "Map: an @entity slot that wraps the entity pages in a sheet

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: THE SPIKE GATE — verify the four assumptions in a browser

This task writes no code. It decides whether Tasks 6–10 go ahead as written. The dev server from Task 1 is still running (Next hot-reloads the new route files; if the slot does not appear, restart it with the same command).

**Method:** built-in browser (`mcp__Claude_Browser__*`), `http://localhost:3401/admin/map`, signed in as in Task 1. Use `read_page`/`find` to click and `javascript_exec` to measure; take screenshots for the spec's record.

- [ ] **Step 1: Assumption 1: interception, and again after a save redirect**

1. Click the **Spike bean** card. Expect: the URL becomes `/admin/bean/spike-bean`, **the map is still drawn behind**, and a sheet appears on the right showing the bean page.
2. In the sheet, change the bean's visibility (open the visibility popover, pick a different member, Save). Expect: the sheet reloads showing the new value, **the map is still behind it**, the URL is `/admin/bean/spike-bean`.
3. Click the **Spike pod** card, then the **Spike sprout** card, then **Spike plant**. Expect each to swap the sheet's content without the frame flickering off and on.
4. Reload the page on `/admin/bean/spike-bean` (hard load). Expect: the standalone bean page with the full chrome and no sheet.
5. Navigate to `/admin/beans` and click a bean in the table. Expect: an ordinary navigation, **no sheet**.

*If step 2 leaves the map* (the sheet vanishes and the full bean page appears): fallback 1 in the spec. Report back before continuing.

- [ ] **Step 2: Assumption 2: the transform contains the fixed pieces**

On the sheet showing **Spike bean**, run in `javascript_exec`:

```js
const sheet = document.querySelector("[data-map-sheet]").getBoundingClientRect();
const fixedInside = [...document.querySelectorAll("[data-map-sheet] *")]
  .filter((el) => getComputedStyle(el).position === "fixed")
  .map((el) => ({ tag: el.tagName, cls: String(el.className).slice(0, 60), r: el.getBoundingClientRect() }))
  .map((x) => ({ ...x, inside: x.r.left >= sheet.left - 1 && x.r.right <= sheet.right + 1 && x.r.top >= sheet.top - 1 && x.r.bottom <= sheet.bottom + 1 }));
({ sheet: { left: sheet.left, right: sheet.right, width: sheet.width }, fixedInside });
```

Expect: every entry has `inside: true` (the rail's icon cluster, the editor's floating commit once you focus the editor). Then open a rail panel from the bean's rail and scroll the sheet's prose: the rail and commit must **stay put** while the prose scrolls (two boxes did their job); the panel must open inside the sheet.

*If anything is `inside: false`* (a viewport-fixed piece is over the map): **fallback 2 (the iframe, B)**. Stop and report; Tasks 6–10 change.

- [ ] **Step 3: Assumption 3: the `@` / `/` menu**

On the bean's editor, click into the prose, type `@` then a letter. Expect the suggestion menu directly under the caret. Measure:

```js
const caret = getSelection().getRangeAt(0).getBoundingClientRect();
const menu = document.querySelector('[role="listbox"]')?.getBoundingClientRect();
menu && { dx: Math.round(menu.left - caret.left), dy: Math.round(menu.top - caret.bottom) };
```

Expect `dx ≈ 0` and `dy ≈ 6`. If it is off by the sheet's offset (`dx` ≈ the sheet's left edge): do **Task 6**. If it is right: skip Task 6.

- [ ] **Step 4: Assumption 4: does the map refresh behind an open sheet**

Note a flag on the map that a save changes: Spike bean's visibility is private, so its card shows an amber ring and "Waiting". In the sheet publish the bean (visibility → public, Save). Expect (best case) the ring on the map card **clears while the sheet is open**. Then click ✕. Expect the map to be correct either way, because closing navigates to `/admin/map`.

Record: `refreshes live: yes | no (current after close)`. Both are acceptable; **no** is already the spec's stated floor.

- [ ] **Step 5: Also look, and write down, three things the spec only predicted**

1. The page's `PlantHeader`/rail at a 1400px-wide window: nothing clipped by the sheet's `overflow-hidden`.
2. The lineage chrome (pod, bean, sprout pages): where does it land? If it overlaps the page's header inside the sheet, add `inSheet` to the three pages exactly as `screens/[slug]/page.tsx:59` does and pass it from the wrappers. Say which you did.
3. The rail reshaping: open **Spike plant** and note whether the chrome's rail changes shape. This is the spec's accepted limit; confirm it is tolerable, not a bug.

- [ ] **Step 6: Record the outcome in the spec**

Append to `docs/superpowers/specs/2026-11-15-map-entity-sheet-design.md`:

```markdown
## Spike results

Run 2026-11-15 against a scratch database, `next dev`, Chrome.

| # | Assumption | Result |
|---|---|---|
| 1 | Interception from a map click, and again after a save redirect | <pass / fail + what> |
| 2 | The transform contains the rail, its panel and the floating commit | <pass / fail + what> |
| 3 | The `@` / `/` menu lands on the caret | <pass; or offset by N px, fixed in Task 6> |
| 4 | The map re-renders behind an open sheet | <yes / no: current after close> |

Also found: <the lineage chrome decision, the rail reshape, anything else>.
```

Replace every `<…>` with what you observed. **A table with a bracket left in it is a failed task.**

- [ ] **Step 7: Gate**

- 1 and 2 pass → continue.
- 1 or 2 fails → **stop**, commit the spec with the results, and tell the user. Do not start Task 6.

- [ ] **Step 8: Commit**

```bash
git add docs/superpowers/specs/2026-11-15-map-entity-sheet-design.md
git commit -m "Spec: record the map-sheet spike results

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: **Only if Task 5 step 3 failed** — portal the suggestion menu

Skip this task, and say so in the PR, if the menu landed on the caret.

**Files:**
- Modify: `components/editor/suggestion-menu.tsx`

- [ ] **Step 1: Check what renders it, so the portal breaks nothing**

Run: `grep -rn "SuggestionMenu" components lib app --include=*.tsx --include=*.ts | grep -v "^components/editor/suggestion-menu.tsx"`

Any **test** that renders `SuggestionMenu` with a non-null `rect` through `renderToStaticMarkup` will throw once the menu portals (there is no `document` on the server). Note them; the menu returns `null` without a rect, so tests that pass `rect={null}` are unaffected.

- [ ] **Step 2: Portal it**

In `components/editor/suggestion-menu.tsx` add the import and wrap the returned element:

```tsx
import { createPortal } from "react-dom";
```

Replace `return (\n    <div\n      role="listbox"` … closing `</div>\n  );` so the whole `<div role="listbox" …>…</div>` becomes the first argument of `createPortal(…, document.body)`:

```tsx
  return createPortal(
    <div
      role="listbox"
      style={{ position: "fixed", top: rect.bottom + 6, left: rect.left, zIndex: 50 }}
      className="max-h-64 w-72 overflow-y-auto rounded-lg border bg-background p-1 shadow-md"
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(index);
          }}
          className={cn(
            "flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left text-sm",
            index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
          )}
        >
          <span>{item.label}</span>
          {item.hint ? (
            <span className="font-heading text-xs text-muted-foreground">{item.hint}</span>
          ) : null}
        </button>
      ))}
    </div>,
    document.body,
  );
```

The items block is the file's existing one, verbatim; only the wrapper changes.

Leave the items and the docblock; add one sentence to the docblock: "Portalled to the body: a transformed ancestor (the map's entity sheet) is the containing block for `position: fixed`, which would turn these viewport coordinates into sheet-relative ones."

- [ ] **Step 3: Verify in the browser**

Repeat Task 5 step 3's measurement. Expect `dx ≈ 0`, `dy ≈ 6`. Also check the **standalone** bean page (`/admin/bean/spike-bean`, no sheet): the menu still lands on the caret, and picking a row with the mouse and with Enter still inserts it.

If you cannot get it right with a portal, **fallback 2 applies**: stop and report.

- [ ] **Step 4: Run the suite and commit**

```bash
npx tsc --noEmit && npm test 2>&1 | grep -E "^# (pass|fail)"
git add components/editor/suggestion-menu.tsx
git commit -m "Editor: portal the @ / menu so a transformed ancestor cannot offset it

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Expected: `# fail 0`.

---

### Task 7: Unsaved edits survive a stray click

**Files:**
- Modify: `components/editor/prose-editor.tsx` (the surface `<div className={cn("relative", …)}>` at ~line 472)
- Modify: `app/admin/_components/garden-map.tsx`
- Modify: `lib/garden-map-source.test.ts`

- [ ] **Step 1: Mark the editor's surface while it is dirty**

In `components/editor/prose-editor.tsx` change

```tsx
      <div className={cn("relative", !bare && "rounded-lg border p-3")}>
```

to

```tsx
      <div
        className={cn("relative", !bare && "rounded-lg border p-3")}
        // Read by `lib/map-sheet.ts` (`EDITOR_DIRTY_ATTR`): the map's entity
        // sheet asks before a close or a node click discards this editor. It
        // follows `dirty`, which stays true after a FAILED save — exactly the
        // state in which the draft exists nowhere else.
        data-editor-dirty={dirty || undefined}
      >
```

The attribute name must equal `EDITOR_DIRTY_ATTR`; Task 8's test compares them.

- [ ] **Step 2: Guard node clicks in the island**

In `app/admin/_components/garden-map.tsx`:

Add to the imports:

```tsx
import { useMemo, useSyncExternalStore, type MouseEvent } from "react";
import { MAP_SHEET_ATTR, confirmDiscard } from "@/lib/map-sheet";
```

(replace the existing `react` import line, which today is `import { useMemo, useSyncExternalStore } from "react";`).

Add above `export function GardenMap`:

```tsx
/**
 * A node click while the entity sheet holds an unsaved edit asks first.
 *
 * CAPTURE phase, on the canvas's wrapper: `next/link` handles the click on the
 * anchor itself, so only something earlier in the event's path can stop it. The
 * sheet leaves the canvas live beside an open editor on purpose, which makes a
 * stray click the likeliest way to lose a draft.
 */
function guardDirtySheet(event: MouseEvent<HTMLDivElement>) {
  if (!(event.target as Element).closest("a[href]")) return;
  if (!confirmDiscard(document.querySelector(`[${MAP_SHEET_ATTR}]`))) {
    event.preventDefault();
    event.stopPropagation();
  }
}
```

Wrap the returned `<ReactFlow … />` in `<div className="size-full" onClickCapture={guardDirtySheet}> … </div>` (the closing tag after `</ReactFlow>`).

- [ ] **Step 3: Allow the one value import in the island's boundary test**

In `lib/garden-map-source.test.ts`, change the allowance in "the client side imports TYPES from lib/, never values":

```ts
      assert.ok(typeOnly || /@\/lib\/utils["']/.test(line), `${file}: ${line}`);
```

to

```ts
      assert.ok(typeOnly || /@\/lib\/(utils|map-sheet)["']/.test(line), `${file}: ${line}`);
```

and extend the comment above it: "`map-sheet` imports nothing, so it reaches no `node:` module either."

- [ ] **Step 4: Check in the browser (dev server still running)**

1. Open Spike bean in the sheet, type in the editor, wait a second. Click another card. Expect a confirm. **Cancel**: the sheet and the typed text stay. Click again and **OK**: the sheet swaps.
2. Type, then click the ✕ → same confirm. Press Escape with the caret in the editor → nothing happens (no close).
3. Save the edit, then click another card → **no** confirm.

- [ ] **Step 5: Run the suite and commit**

```bash
npx tsc --noEmit && npm test 2>&1 | grep -E "^# (pass|fail)"
git add components/editor/prose-editor.tsx app/admin/_components/garden-map.tsx lib/garden-map-source.test.ts
git commit -m "Map sheet: ask before a close or a node click discards an unsaved edit

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Expected: `# fail 0`.

---

### Task 8: The structural test

Every rule below passes `tsc`, `npm test` and `npm run build` while quietly becoming false.

**Files:**
- Create: `lib/map-sheet-source.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EDITOR_DIRTY_ATTR, MAP_SHEET_ATTR } from "./map-sheet";

/**
 * The map's entity sheet, enforced rather than written down (spec
 * 2026-11-15-map-entity-sheet-design.md). Source text, like
 * `lib/screen-sheet-source.test.ts`: each rule is a fact about an import graph,
 * a directory or a class string, which no render can observe — and every one
 * passes `tsc`, `npm test` and `npm run build` while being broken.
 */

/** A file's CODE — comments removed, so a docblock that NAMES a thing is not
 *  mistaken for one that USES it. */
function code(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

const MAP = "app/admin/(chrome)/map";
const SLOT = `${MAP}/@entity`;
const SHEET = "app/admin/_components/map-sheet.tsx";
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Each interceptor, and the standalone page module it must wrap. */
const WRAPPERS: Record<string, string> = {
  [`${SLOT}/(..)plant/[slug]/page.tsx`]: "plant/[slug]/page",
  [`${SLOT}/(..)plant/[slug]/narrative/page.tsx`]: "plant/[slug]/narrative/page",
  [`${SLOT}/(..)pod/[slug]/page.tsx`]: "pod/[slug]/page",
  [`${SLOT}/(..)bean/[id]/page.tsx`]: "bean/[id]/page",
  [`${SLOT}/(..)sprout/[slug]/page.tsx`]: "sprout/[slug]/page",
};

function tsxUnder(dir: string): string[] {
  return readdirSync(join(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? tsxUnder(`${dir}/${entry.name}`)
      : entry.name.endsWith(".tsx")
        ? [`${dir}/${entry.name}`]
        : [],
  );
}

test("every interceptor renders the standalone page's own module", () => {
  for (const [file, page] of Object.entries(WRAPPERS)) {
    const text = code(file);
    assert.match(text, new RegExp(`from "@/app/admin/\\(chrome\\)/${escape(page)}"`), `${file} does not import ${page}`);
    assert.match(text, /<\w+ \{\.\.\.props\} \/>/, `${file} does not pass the page's props straight through`);
  }
});

test("no slot file rebuilds a form, reaches an action, or composes the page's editors", () => {
  const files = tsxUnder(SLOT);
  // The walk itself must not be empty: a renamed directory would pass the loop below.
  for (const file of Object.keys(WRAPPERS)) assert.ok(files.includes(file), `the walk missed ${file}`);
  assert.ok(files.includes(`${SLOT}/default.tsx`) && files.includes(`${SLOT}/page.tsx`));

  for (const file of files) {
    const text = code(file);
    assert.equal(text.includes("<form"), false, `${file} renders its own form`);
    assert.equal(text.includes("Action"), false, `${file} reaches a server action`);
    assert.equal(/_components\//.test(text), false, `${file} composes the page's pieces instead of importing the page`);
  }
});

test("the slot's two empty routes render nothing — Close depends on the second", () => {
  for (const file of [`${SLOT}/default.tsx`, `${SLOT}/page.tsx`]) {
    assert.match(code(file), /return null;/, file);
  }
});

test("interception is under the map only, never the chrome-level sheet", () => {
  const sheetSlot = readdirSync(join(process.cwd(), "app/admin/(chrome)/@sheet"));
  for (const name of sheetSlot) {
    assert.doesNotMatch(name, /^\(\.\.?\)(plant|pod|bean|sprout)/, `(chrome)/@sheet/${name} would intercept entity links admin-wide`);
  }
});

test("the map's layout renders the slot inside the sheet", () => {
  const text = code(`${MAP}/layout.tsx`);
  assert.match(text, /entity/);
  assert.match(text, /<MapSheet>\{entity\}<\/MapSheet>/);
});

test("the sheet is its own surface, a containing block, and closes by href", () => {
  const text = code(SHEET);
  assert.match(text, /^"use client";/m);
  assert.ok(text.includes(MAP_SHEET_ATTR), "the sheet must carry the attribute the island looks for");
  assert.equal(text.includes("data-screen-sheet"), false, "data-screen-sheet would make the admin layout push the page");
  // The transform is what pulls the rail, its panel and the editor commit inside the sheet.
  assert.match(text, /\btransform(-gpu)?\b/);
  // Two boxes: the scroller must not be the transformed one.
  assert.match(text, /overflow-hidden/);
  assert.match(text, /overflow-y-auto/);
  assert.equal(text.includes("router.back"), false, "Close is a real href, never history");
  assert.match(text, /<Link\b[\s\S]*href=\{closeHref\}/);
});

test("the editor's surface carries the dirty marker bound to its dirty state", () => {
  const text = code("components/editor/prose-editor.tsx");
  assert.match(text, new RegExp(`${escape(EDITOR_DIRTY_ATTR)}=\\{dirty \\|\\| undefined\\}`));
});

test("the map island asks before a node click discards an edit", () => {
  const text = code("app/admin/_components/garden-map.tsx");
  assert.match(text, /onClickCapture=\{guardDirtySheet\}/);
  assert.match(text, /confirmDiscard\(/);
});

test("the rail's page wrapper is addressable, and the sheet switches its viewport-gated offset off", () => {
  assert.match(code("app/admin/_components/entity-rail.tsx"), /<div data-entity-page\b/);
  assert.match(code(SHEET), /\[&_\[data-entity-page\]\]:right-0!/);
});

test("the sheet imports no action and no store", () => {
  const text = code(SHEET);
  assert.doesNotMatch(text, /app\/admin\/actions|@\/lib\/(store|seeds|db)\b|node:[a-z]/);
});
```

- [ ] **Step 2: Run it**

Run: `npm test 2>&1 | grep -E "map-sheet-source|^# (pass|fail)"`
Expected: all pass, `# fail 0`. If one fails, the file it names is wrong: fix the **source**, not the assertion, unless the assertion's regex is demonstrably mis-spelled against a correct file.

- [ ] **Step 3: Prove the test can fail (one mutation)**

Temporarily change `transform-gpu` to `translate-x-0` in `app/admin/_components/map-sheet.tsx`, run the suite, and confirm the "containing block" test fails. Revert with `git checkout app/admin/_components/map-sheet.tsx`.

Expected: FAIL on that test, then PASS after the revert.

- [ ] **Step 4: Commit**

```bash
git add lib/map-sheet-source.test.ts
git commit -m "Map sheet: pin the slot, the frame and the unsaved-edit guard

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Docs

**Files:**
- Modify: `docs/superpowers/specs/2026-11-15-garden-map-design.md`, `docs/superpowers/specs/2026-11-15-map-entity-sheet-design.md`, `CLAUDE.md`

- [ ] **Step 1: The map spec**

In `docs/superpowers/specs/2026-11-15-garden-map-design.md`:

Replace `Read-only. There is no write path, no server action and no side panel.` with:

```markdown
Read-only **on the canvas**: no write path, no server action. Editing happens in
the entity's own page, shown in a side sheet over the map
([`2026-11-15-map-entity-sheet-design.md`](2026-11-15-map-entity-sheet-design.md)).
```

Replace `Editing from the map, saving positions, published sprouts as nodes, screens,\nbees, a side panel.` with:

```markdown
Saving positions, published sprouts as nodes, screens, bees. (Editing from the
map and a side panel were out of scope here and are now
[their own slice](2026-11-15-map-entity-sheet-design.md).)
```

- [ ] **Step 2: The sheet spec's testing line**

In `…-map-entity-sheet-design.md`, replace the bullet beginning `- A render test for the dirty marker` with:

```markdown
- A unit test for the pure helpers (`lib/map-sheet.test.ts`), and a source test
  that the editor's surface binds `data-editor-dirty` to its `dirty` state. A
  render test cannot do the second: `dirty` is set by an editor update, which
  `renderToStaticMarkup` never runs, so the behaviour is covered by the browser
  pass below.
```

Set `**Status:**` to `implemented (see Spike results)`.

- [ ] **Step 3: CLAUDE.md**

In `CLAUDE.md`, in the garden-map bullet, replace `It has no write path: each node is a `next/link` to the page where the decision\n  lives.` (the sentence may wrap differently: search for `It has no write path`) with:

```markdown
The canvas has no write path: each node is a `next/link` to the page where the
  decision lives, and for a plant, pod, bean or sprout a soft click opens THAT
  PAGE in a side sheet over the map ([`specs/2026-11-15-map-entity-sheet-design.md`](docs/superpowers/specs/2026-11-15-map-entity-sheet-design.md)):
  five `(..)` interceptors under `map/@entity/` wrap the standalone page modules
  and `MapSheet` draws the frame. **The slot is under `map/`, not `(chrome)/@sheet/`,
  and that is the point** — an interceptor at the chrome level would turn every
  link to a bean in the tables, the palette and the lineage chrome into a sheet.
  The frame is a `transform`ed box so the rail, its panel and the editor commit
  land inside it, and `@entity/page.tsx` renders nothing because without a route
  that matches the map the sheet stays open after Close. A dirty editor marks
  itself `data-editor-dirty` and a close or node click asks first.
  `lib/map-sheet-source.test.ts` pins all of it.
```

- [ ] **Step 4: Commit**

```bash
git add docs CLAUDE.md
git commit -m "Docs: the map edits through a sheet — spec, map spec, CLAUDE.md

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Verify, clean up, open the PR

**Files:**
- Delete: `scripts/spike-seed.ts`, the worktree's `.env.local`

- [ ] **Step 1: The browser pass (spec "Testing")**

With the dev server still on :3401 and the scratch garden, check each and note the result:

1. Click a plant, a pod, a bean and a sprout: each opens in the sheet.
2. Edit and save one field on each (a name, a visibility, a state): the sheet reloads in place, the map stays.
3. In the bean's editor: write, use `@` and `/`, pick a row with the mouse and with Enter.
4. Open a rail panel (the bean's cover, the plant's exhibition): it opens inside the sheet and the prose stays reachable.
5. Swap by clicking another node, and by an in-sheet link (the pod's "Inside" list): the frame does not flicker.
6. Close with the ✕, with Escape from outside the editor, and by clicking a non-intercepted link (the inbox seed-count node if the scratch garden has one, or `/admin/sprouts` typed in the bar).
7. Scope and view survive a round trip: open `/admin/map?plant=spike&view=review`, open a node, close: the URL is back on `?plant=spike&view=review`.
8. Reload on `/admin/bean/spike-bean`: standalone page, no sheet.
9. Dark mode (toggle the theme): the sheet is legible.
10. A 390px-wide window: the sheet is full-width and the ✕ is reachable.

Anything that fails is a bug in this slice: fix it in the file it names, add a line to `lib/map-sheet-source.test.ts` if it is a structural rule, and re-run.

- [ ] **Step 2: Stop the dev server, remove the scratch files**

Stop the background `next dev` (TaskStop). Then:

```bash
cd /Users/alexis/code/ariko/.claude/worktrees/editor-data-loss-lists-c3da33
rm scripts/spike-seed.ts .env.local
git status --short
```

Expected: `git status` clean (nothing untracked from the scratch work).

- [ ] **Step 3: The full gates**

```bash
npx tsc --noEmit && npm run lint && npm test 2>&1 | grep -E "^# (pass|fail)" && npm run build 2>&1 | tail -25
```

The dev server must be stopped first (they share this worktree's `.next`). Expected: no tsc or lint output, `# fail 0`, a successful build with `/admin/map` listed as dynamic.

- [ ] **Step 4: Push and open the PR**

This slice ships something the author notices, so the PR **needs a Lab Note**. Body:

````markdown
## What
Click a plant, pod, bean or sprout on the garden map and its page opens in a side sheet over the map — editable in place, the map stays where you left it.

Design: `docs/superpowers/specs/2026-11-15-map-entity-sheet-design.md` (spike results are in it).

## How
- `map/@entity/` holds five `(..)` interceptors wrapping the existing page modules. Under `map/`, not `(chrome)/`, so only a click from the map opens a sheet.
- `MapSheet` is a transformed frame so the rail, its panel and the editor commit land inside it.
- No action, no node href changed.
- A dirty editor marks itself `data-editor-dirty`; closing or clicking another node asks first.

## Test plan
- [x] `npm test`, `tsc`, `lint`, `build`
- [x] Browser pass against a scratch database (spec "Testing"): <list what you ran>

## Lab Note

```yaml
en:
  title: Edit straight from the garden map
  summary: Click any plant, pod, bean or journal entry on the map and its page slides in beside it. Fix what's waiting without losing your place.
fr:
  title: Modifie directement depuis la carte du jardin
  summary: Clique sur une plante, un pod, un bean ou une entrée du journal, et sa page s'ouvre à côté de la carte. Tu règles ce qui attend sans perdre ta place.
suggested:
  molecule: ariko
  type: feature
  tags: [admin]
```
````

Replace the `<list what you ran>` with the real results before pushing. Use the commit/PR flow the repo uses (branch is `map-node-inline-edit-71ace2`; no direct commits to `main`). After opening it, call `get_status` and, if the PR is not reported, `bind_pr`; GitHub auto-merge is OFF in this repo, so ask Alexis when CI is green before squash-merging.

Append to the PR body: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## Self-review (done)

**Spec coverage.** Mechanism and slot → Tasks 3–4. Sheet frame, containing block, two boxes, z-order, close, Escape → Task 3. Unsaved work → Tasks 2 and 7. Rail reshape and refresh limits → recorded in Task 5. Spike → Task 5, with the spec's own fallbacks as the stop conditions. Testing → Tasks 2, 8, 10. Docs → Task 9. Seed-count and bucket nodes need no code: their hrefs are `/admin/inbox…`, which no interceptor matches.

**Known gaps, stated.**
- The spec's "render test for the dirty marker" is replaced by a source test plus the browser pass (Task 9 step 2 amends the spec).
- A rail page-panel draft (a staged block's form) is not covered by the dirty guard; only the prose editor is.
- The lineage chrome inside the sheet is decided by Task 5 step 5, not here.

**Consistency.** `MAP_SHEET_ATTR`, `EDITOR_DIRTY_ATTR`, `MAP_PATH`, `DISCARD_PROMPT`, `mapCloseHref`, `sheetOpenFor`, `hasUnsavedEdit`, `confirmDiscard` are defined once in Task 2 and used under those names in Tasks 3, 7 and 8.
