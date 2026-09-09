# Screen Gallery Implementation Plan (PR 1, issue #71)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A plant page shows a horizontal strip of exhibited screens, drawn from the screen store, with an admin surface that marks membership and orders the sequence.

**Architecture:** Two optional fields on `Screen` (`exhibited`, `order`); one zero-import pure module (`lib/exhibition.ts`) holding all the arithmetic; one `Dataset` accessor; one bulk write in `lib/botanical.ts`; two thin server actions; two admin surfaces (a card on the screen's page for membership, a rail panel on the plant page for ordering); two new **server-safe** public components. `app/(public)` still has exactly one client island when this lands.

**Tech Stack:** Next.js 15 (App Router, server actions), React 19, TypeScript, MongoDB, Tailwind v4 + shadcn on Base UI, `node:test` + `tsx`.

**Spec:** [`docs/superpowers/specs/2026-09-09-screen-gallery-design.md`](../specs/2026-09-09-screen-gallery-design.md) §1–8. §9 (the lightbox) is PR 2 and is **out of scope here**.

**Branch:** `screen-gallery` (already checked out; the spec commit is on it). Do NOT commit to `main`.

**Running tests:**
- Everything: `npm test`
- One file: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/exhibition.test.ts`
- DB-gated files (Task 3 only): `npm run test:db` — needs `.env.local` with `MONGODB_URI`. If it is absent the tests SKIP rather than fail; that is expected and fine.
- Types: `npx tsc --noEmit`
- Build: `npm run build`

---

## File Structure

**Create:**
- `lib/exhibition.ts` — all the arithmetic. Zero value imports (one `import type`).
- `lib/exhibition.test.ts` — its tests.
- `app/admin/_components/screen-exhibit-form.tsx` — the membership card (server component).
- `app/admin/_components/exhibition-panel.tsx` — the ordering panel's contents (server component).
- `components/phone-frame.tsx` — the phone bezel, extracted from `bean-cover.tsx`.
- `components/screen-strip.tsx` — the public strip.
- `components/screen-strip.test.tsx` — its tests.

**Modify:**
- `lib/data.ts` — two `Screen` fields, `Dataset.exhibitionForPlant`, its wiring in `buildDataset`.
- `lib/data.test.ts` — accessor tests.
- `lib/visibility.test.ts` — one cascade-interaction test.
- `lib/botanical.ts` — `listScreensForPlant`, `writeExhibition`; delete `listScreens`.
- `lib/botanical.test.ts` — DB-gated round trip; drop the `listScreens` import.
- `app/admin/actions.ts` — `toggleScreenExhibitAction`, `reorderExhibitionAction`.
- `app/admin/screens/[slug]/page.tsx` — the Exhibition card.
- `app/admin/_components/plant-inside.tsx` — a second panel on the rail.
- `app/admin/plant/[slug]/page.tsx` — builds and hands down that panel.
- `components/bean-cover.tsx` — draws its phone from `PhoneFrame`.
- `app/(public)/(chrome)/plant/[slug]/page.tsx` — renders the strip.
- `lib/server-safe-source.test.ts` — the two new public files.
- `CLAUDE.md` — the `plant-inside.tsx` neighbour note.

---

## Task 1: `lib/exhibition.ts` — the arithmetic

The whole of what the four buttons do, as pure functions. **Zero value imports** — `lib/data.ts` imports this file in Task 2, so a value import back out would be a runtime cycle.

**Files:**
- Create: `lib/exhibition.ts`
- Test: `lib/exhibition.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/exhibition.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyExhibitionOp,
  exhibitionOpOf,
  exhibitionOrder,
  exhibitionWrites,
} from "./exhibition";

// --- exhibitionOrder: the comparator the strip and the panel share.

test("exhibitionOrder sorts by order ascending", () => {
  const sorted = [{ slug: "c", order: 2 }, { slug: "a", order: 0 }, { slug: "b", order: 1 }].sort(
    exhibitionOrder,
  );
  assert.deepEqual(sorted.map((e) => e.slug), ["a", "b", "c"]);
});

test("exhibitionOrder sorts an entry with no order LAST, never first", () => {
  // Fail-visible: the author said exhibit it, so a missing sort key costs
  // position and never presence. A naive `(a.order ?? 0) - (b.order ?? 0)`
  // would put it at the head of the strip instead.
  const sorted = [{ slug: "b" }, { slug: "a", order: 0 }].sort(exhibitionOrder);
  assert.deepEqual(sorted.map((e) => e.slug), ["a", "b"]);
});

test("exhibitionOrder breaks a tie on slug", () => {
  const sorted = [{ slug: "b", order: 0 }, { slug: "a", order: 0 }].sort(exhibitionOrder);
  assert.deepEqual(sorted.map((e) => e.slug), ["a", "b"]);
  const unordered = [{ slug: "z" }, { slug: "y" }].sort(exhibitionOrder);
  assert.deepEqual(unordered.map((e) => e.slug), ["y", "z"]);
});

// --- exhibitionOpOf: the vocabulary, re-validated rather than trusted.

test("exhibitionOpOf admits exactly the four members", () => {
  assert.equal(exhibitionOpOf("add"), "add");
  assert.equal(exhibitionOpOf("remove"), "remove");
  assert.equal(exhibitionOpOf("up"), "up");
  assert.equal(exhibitionOpOf("down"), "down");
});

test("exhibitionOpOf refuses anything else", () => {
  assert.equal(exhibitionOpOf(""), null);
  assert.equal(exhibitionOpOf("ADD"), null);
  assert.equal(exhibitionOpOf("drop"), null);
});

// --- applyExhibitionOp: the new list, or null for a no-op.

test("add appends to the end of the strip", () => {
  assert.deepEqual(applyExhibitionOp(["a", "b"], "c", "add"), ["a", "b", "c"]);
  assert.deepEqual(applyExhibitionOp([], "a", "add"), ["a"]);
});

test("add is a no-op when the screen is already exhibited", () => {
  assert.equal(applyExhibitionOp(["a", "b"], "a", "add"), null);
});

test("remove drops the screen and keeps the rest in order", () => {
  assert.deepEqual(applyExhibitionOp(["a", "b", "c"], "b", "remove"), ["a", "c"]);
});

test("up and down swap with the neighbour", () => {
  assert.deepEqual(applyExhibitionOp(["a", "b", "c"], "b", "up"), ["b", "a", "c"]);
  assert.deepEqual(applyExhibitionOp(["a", "b", "c"], "b", "down"), ["a", "c", "b"]);
});

test("up at the head and down at the tail are no-ops, not errors", () => {
  // A stray press on a disabled-looking button writes nothing at all, which is
  // what dirty-gates the whole write path.
  assert.equal(applyExhibitionOp(["a", "b"], "a", "up"), null);
  assert.equal(applyExhibitionOp(["a", "b"], "b", "down"), null);
});

test("an unknown slug is a no-op for every op but add", () => {
  assert.equal(applyExhibitionOp(["a"], "ghost", "remove"), null);
  assert.equal(applyExhibitionOp(["a"], "ghost", "up"), null);
  assert.equal(applyExhibitionOp(["a"], "ghost", "down"), null);
});

test("applyExhibitionOp never mutates the list it was given", () => {
  const before = ["a", "b"];
  applyExhibitionOp(before, "b", "up");
  assert.deepEqual(before, ["a", "b"]);
});

// --- exhibitionWrites: only what actually moved.

test("a swap promotes exactly the two screens that moved", () => {
  const before = [{ slug: "a", order: 0 }, { slug: "b", order: 1 }, { slug: "c", order: 2 }];
  const writes = exhibitionWrites(before, ["b", "a", "c"]);
  assert.deepEqual(writes.promote, [{ slug: "b", order: 0 }, { slug: "a", order: 1 }]);
  assert.deepEqual(writes.withdraw, []);
});

test("an added screen is promoted and nothing else is", () => {
  const before = [{ slug: "a", order: 0 }];
  const writes = exhibitionWrites(before, ["a", "b"]);
  assert.deepEqual(writes.promote, [{ slug: "b", order: 1 }]);
  assert.deepEqual(writes.withdraw, []);
});

test("a removed screen is withdrawn and everything after it renumbers", () => {
  const before = [{ slug: "a", order: 0 }, { slug: "b", order: 1 }, { slug: "c", order: 2 }];
  const writes = exhibitionWrites(before, ["a", "c"]);
  assert.deepEqual(writes.promote, [{ slug: "c", order: 1 }]);
  assert.deepEqual(writes.withdraw, ["b"]);
});

test("an exhibited screen with NO stored order is promoted even where it sits", () => {
  // The bug this pins: comparing membership instead of stored order skips this
  // screen forever, so it stays orderless and keeps sorting last no matter how
  // often the author moves it.
  const before = [{ slug: "a", order: 0 }, { slug: "b" }];
  const writes = exhibitionWrites(before, ["a", "b"]);
  assert.deepEqual(writes.promote, [{ slug: "b", order: 1 }]);
});

test("an unchanged strip writes nothing at all", () => {
  const before = [{ slug: "a", order: 0 }, { slug: "b", order: 1 }];
  const writes = exhibitionWrites(before, ["a", "b"]);
  assert.deepEqual(writes.promote, []);
  assert.deepEqual(writes.withdraw, []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/exhibition.test.ts`
Expected: FAIL — `Cannot find module './exhibition'`.

- [ ] **Step 3: Write the implementation**

Create `lib/exhibition.ts`:

```ts
import type { MediaImage } from "./data";

/**
 * The exhibition's arithmetic — everything the gallery decides that is not a
 * render or a write.
 *
 * NO VALUE IMPORTS, and that is load-bearing rather than tidy: `lib/data.ts`
 * imports `exhibitionOrder` below, so a value import back out of this file
 * would be a runtime cycle. The one `import type` above is erased at build and
 * is not one. This module works on slugs and on structural `{ slug, order? }`
 * shapes, never on a `Screen`, which is what keeps that true — and what lets
 * the admin (reading the raw garden) and the public page (reading a filtered
 * Dataset) share it.
 */

/** The four buttons a row can carry. A NAMED vocabulary, re-validated by the
 *  action rather than trusted, which is `lib/plant-status.ts`'s stance and for
 *  its reason: a stale page can then only ever name a member that exists. */
export const EXHIBITION_OPS = ["add", "remove", "up", "down"] as const;
export type ExhibitionOp = (typeof EXHIBITION_OPS)[number];

export function exhibitionOpOf(raw: string): ExhibitionOp | null {
  return (EXHIBITION_OPS as readonly string[]).includes(raw) ? (raw as ExhibitionOp) : null;
}

/** The least a thing needs to have a place in the strip. `Screen` satisfies it
 *  structurally, so no caller ever converts. */
export interface ExhibitionEntry {
  slug: string;
  order?: number;
}

/**
 * The strip's order: `order` ascending, an entry WITHOUT one last, slug as the
 * tie-break.
 *
 * Last, not first, and not dropped. An exhibited screen with no sort key can
 * only arrive by a hand-edit or a half-finished write, and the author's opt-in
 * is the thing to honour — so a missing key costs position and never presence.
 * `(a.order ?? 0)` would silently put it at the head of the strip instead.
 *
 * Plain `<` on the slug rather than `localeCompare`, matching `byDateDesc` in
 * lib/data.ts and the sorts in lib/screens.ts: slugs are ASCII kebab-case, and
 * one collation across the repo is what makes two surfaces agree.
 */
export function exhibitionOrder(a: ExhibitionEntry, b: ExhibitionEntry): number {
  const ao = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
  const bo = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

/**
 * Pure. One button press → the new ordered strip, or `null` for a no-op.
 *
 * `null` is the whole of the dirty gate. `up` at the head, `down` at the tail,
 * `add` for a screen already exhibited, and anything but `add` for a slug that
 * is not in the strip all mean "the author pressed something that changes
 * nothing" — and a no-op that returned the list unchanged would still write
 * every document in it.
 *
 * The input list is never mutated; the swap works on a copy.
 */
export function applyExhibitionOp(
  ordered: string[],
  slug: string,
  op: ExhibitionOp,
): string[] | null {
  const at = ordered.indexOf(slug);

  if (op === "add") return at === -1 ? [...ordered, slug] : null;
  if (at === -1) return null;
  if (op === "remove") return ordered.filter((s) => s !== slug);

  const to = op === "up" ? at - 1 : at + 1;
  if (to < 0 || to >= ordered.length) return null;

  const next = [...ordered];
  next[at] = ordered[to];
  next[to] = ordered[at];
  return next;
}

export interface ExhibitionWrites {
  /** Screens to exhibit at a position — see lib/botanical.ts for the lockstep
   *  this half performs on `visibility`. */
  promote: { slug: string; order: number }[];
  /** Screens leaving the strip. */
  withdraw: string[];
}

/**
 * Pure. The two lists of documents a press actually has to touch.
 *
 * `before` carries the STORED order rather than bare slugs, and that is the
 * detail worth reading twice: a screen exhibited with no `order` at all sits at
 * some index in `before`, and a diff that compared index-to-index would decide
 * it had not moved and never write it a sort key — so it would sort last
 * forever, however often the author pressed ↑. Comparing the stored value
 * against the new index is what closes that.
 *
 * A swap therefore writes two documents and not the whole strip.
 */
export function exhibitionWrites(before: ExhibitionEntry[], after: string[]): ExhibitionWrites {
  const stored = new Map(before.map((entry) => [entry.slug, entry.order]));
  const kept = new Set(after);

  return {
    promote: after
      .map((slug, order) => ({ slug, order }))
      .filter(({ slug, order }) => stored.get(slug) !== order),
    withdraw: before.map((entry) => entry.slug).filter((slug) => !kept.has(slug)),
  };
}

/**
 * One screen as the strip draws it — the two `Text`s already resolved.
 *
 * Resolved by the PAGE rather than here, which is what keeps
 * `components/screen-strip.tsx` isomorphic instead of merely server-safe:
 * `resolveText` lives in lib/data.ts, which opens with `node:fs`, and a strip
 * that reached for it would be in the awkward state `components/bean-cover.tsx`
 * spends a paragraph explaining. It is also what lets PR 2's client island
 * share this type with a plain `import type`.
 */
export interface ExhibitionRow {
  slug: string;
  name: string;
  legend: string;
  image: MediaImage;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/exhibition.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/exhibition.ts lib/exhibition.test.ts
git commit -m "The exhibition's arithmetic: order, ops and the write diff

Pure and with no value imports, because lib/data.ts imports the comparator
next and a value import back out would be a runtime cycle.

Two behaviours are the point. A no-op op returns null rather than the list
unchanged, so a stray press writes nothing; and the write diff compares the
STORED order against the new index rather than index against index, so an
exhibited screen carrying no order finally gets one instead of sorting last
forever.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: The model and the read path

**Files:**
- Modify: `lib/data.ts`
- Test: `lib/data.test.ts`, `lib/visibility.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/data.test.ts`:

```ts
// --- The exhibition (the gallery slice): buildDataset's one screen accessor.

const EXHIBIT_IMAGE = {
  kind: "image" as const,
  storageKey: "beanstalk/x",
  url: "https://res.cloudinary.com/x/x.png",
  width: 1179,
  height: 2556,
};

const EXHIBITED: RawGarden = {
  plants: [
    { slug: "pl", name: "Plant", natures: ["work"], role: { kind: "owner" }, description: "" },
    { slug: "pl-other", name: "Other", natures: ["work"], role: { kind: "owner" }, description: "" },
  ],
  screens: [
    { slug: "s-second", name: "Second", image: EXHIBIT_IMAGE, parents: ["plant:pl"], exhibited: true, order: 1 },
    { slug: "s-first", name: "First", image: EXHIBIT_IMAGE, parents: ["plant:pl"], exhibited: true, order: 0 },
    { slug: "s-unordered", name: "Unordered", image: EXHIBIT_IMAGE, parents: ["plant:pl"], exhibited: true },
    { slug: "s-stored", name: "Stored", image: EXHIBIT_IMAGE, parents: ["plant:pl"] },
    { slug: "s-elsewhere", name: "Elsewhere", image: EXHIBIT_IMAGE, parents: ["plant:pl-other"], exhibited: true, order: 0 },
    { slug: "s-dangling", name: "Dangling", image: EXHIBIT_IMAGE, parents: ["plant:ghost"], exhibited: true, order: 0 },
  ],
};

test("exhibitionForPlant returns the plant's exhibited screens, in order", () => {
  const d = buildDataset(EXHIBITED);
  assert.deepEqual(d.exhibitionForPlant("pl").map((s) => s.slug), [
    "s-first",
    "s-second",
    "s-unordered",
  ]);
});

test("exhibitionForPlant omits a stored screen that was never exhibited", () => {
  // Storing a screen is not publishing it: the store holds a hundred and
  // seventy and the strip shows the handful marked for it.
  const d = buildDataset(EXHIBITED);
  assert.equal(d.exhibitionForPlant("pl").some((s) => s.slug === "s-stored"), false);
});

test("exhibitionForPlant does not borrow another plant's screens", () => {
  const d = buildDataset(EXHIBITED);
  assert.equal(d.exhibitionForPlant("pl").some((s) => s.slug === "s-elsewhere"), false);
  assert.deepEqual(d.exhibitionForPlant("pl-other").map((s) => s.slug), ["s-elsewhere"]);
});

test("exhibitionForPlant ignores a screen whose plant parent does not resolve", () => {
  // Same rule podsByPlant/beansByPlant already follow: only resolvable refs
  // index. A dangling screen survives filterPublic as standalone and simply
  // has no page to appear on.
  const d = buildDataset(EXHIBITED);
  assert.deepEqual(d.exhibitionForPlant("ghost"), []);
});

test("exhibitionForPlant is empty for a plant with no screens at all", () => {
  const d = buildDataset(EXHIBITED);
  assert.deepEqual(d.exhibitionForPlant("nobody"), []);
});
```

Append to `lib/visibility.test.ts` (after the existing screen cascade tests, at the end of the file):

```ts
test("a private screen never reaches the exhibition, however it is marked", () => {
  // The two halves of the rule are enforced in two places and this is the
  // seam between them: filterPublic is the security boundary and drops the
  // screen, so exhibitionForPlant never has to re-check visibility — and a
  // second copy of a security check would be a second behaviour.
  const seed = screenSeed();
  seed.screens![0] = { ...seed.screens![0], exhibited: true, order: 0 }; // sc-private
  const d = buildDataset(filterPublic(seed));
  assert.deepEqual(d.exhibitionForPlant("pl-pub"), []);
});
```

And extend `lib/visibility.test.ts`'s import at the top of the file from
`import { filterPublic, resolveText, type RawGarden } from "./data";` to
`import { buildDataset, filterPublic, resolveText, type RawGarden } from "./data";`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/data.test.ts lib/visibility.test.ts`
Expected: FAIL — `d.exhibitionForPlant is not a function`, plus a `tsc` error on the unknown `exhibited` property once Step 3 has not yet run.

- [ ] **Step 3: Add the two fields**

In `lib/data.ts`, in the `Screen` interface docblock, REPLACE this paragraph:

```
 * Deliberately ABSENT: `exhibited` and `order`. Those belong to the gallery,
 * they are optional, and Mongo adds an optional field with no migration — so
 * declaring them here would put two fields in the type that nothing reads and
 * nothing writes, which is the speculative generality this file argues against
 * everywhere else. The gallery slice adds them when it has a use for them.
```

with:

```
 * `exhibited` and `order` arrived with the gallery slice, which is the slice
 * that had a use for them — they were deliberately absent until then. They are
 * still optional, and Mongo added them with no migration.
 *
 * Two fields where one nearly does, and the reason is the seam: the strip
 * requires `exhibited === true` AND a screen that survived filterPublic. Those
 * are two different facts, editorial and privacy, enforced in two different
 * places. Collapsing them would put a screen on a plant page because it was
 * public, without anyone having said it belonged there.
```

and add the two fields to the interface body, immediately after `capturedAt`:

```ts
  /** The editorial opt-in — the strip's membership test. See the docblock
   *  above for why this is not simply "is it public". */
  exhibited?: boolean;
  /** Position in the plant's strip, normalized to 0..n-1 on every write
   *  (lib/exhibition.ts). Absent on an exhibited screen sorts it LAST rather
   *  than hiding it: the author's opt-in outranks a missing sort key. */
  order?: number;
```

- [ ] **Step 4: Add the accessor**

In `lib/data.ts`, add the import at the top of the file, beside the existing imports:

```ts
import { exhibitionOrder } from "./exhibition";
```

Add to the `Dataset` interface, after `beansForPlant`:

```ts
  /** The plant's exhibited screens, in strip order (the gallery slice). Only
   *  the OPT-IN is checked here — privacy is filterPublic's, upstream. */
  exhibitionForPlant(slug: string): Screen[];
```

In `buildDataset`, after the `beansByPod` / `beansByPlant` loop and before the
`sproutsByBean` loop, add:

```ts
  // plant slug -> exhibited screens, in strip order. Only resolvable plant
  // refs index, exactly as pods and beans above: a screen naming a plant that
  // does not exist survives filterPublic as standalone and has no page to
  // appear on.
  //
  // Sorted ONCE here rather than per render, and `exhibited` is the only
  // predicate — `visibility` is not re-checked, because the caller reading a
  // public Dataset is reading one filterPublic already emptied of private
  // screens, and a security check with two copies has two behaviours.
  const exhibitionByPlant = new Map<string, Screen[]>();
  for (const screen of raw.screens ?? []) {
    if (screen.exhibited !== true) continue;
    for (const p of parentsWithPrefix(screen.parents, PLANT_PREFIX)) {
      if (!plantBySlug.has(p)) continue;
      const list = exhibitionByPlant.get(p) ?? [];
      list.push(screen);
      exhibitionByPlant.set(p, list);
    }
  }
  for (const list of exhibitionByPlant.values()) {
    list.sort(exhibitionOrder);
  }
```

And in the returned object, after `beansForPlant`:

```ts
    exhibitionForPlant: (slug) => exhibitionByPlant.get(slug) ?? [],
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/data.test.ts lib/visibility.test.ts`
Expected: PASS — every existing test still green, plus the six new ones.

Then run `npx tsc --noEmit`. Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add lib/data.ts lib/data.test.ts lib/visibility.test.ts
git commit -m "Screen.exhibited / Screen.order, and the one accessor that reads them

The two fields lib/data.ts said the gallery slice would add when it had a
use for them. It has one.

exhibitionForPlant checks the OPT-IN and nothing else: the public page reads
a Dataset filterPublic already emptied of private screens, so re-checking
visibility here would be a second copy of a security check, which is a second
behaviour. The seam is pinned from both sides.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: The write path in `lib/botanical.ts`

**Files:**
- Modify: `lib/botanical.ts`, `lib/botanical.test.ts`

- [ ] **Step 1: Write the failing test**

In `lib/botanical.test.ts`, change the import block: remove `listScreens` from the
`from "./botanical"` import list and add `listScreensForPlant` and `writeExhibition`.
Then DELETE any test that calls `listScreens` (search for it; the store slice added
one) and append:

```ts
test("writeExhibition promotes in lockstep and withdraws in lockstep", { skip: !hasDb }, async (t) => {
  await ensureBotanicalIndexes();
  t.after(cleanup);

  const image = {
    kind: "image" as const,
    storageKey: "__test__k",
    url: "https://example.com/x.png",
    width: 1179,
    height: 2556,
  };
  await createScreen({ slug: "__test__ex1", name: "One", image, plantSlug: "__test__expl" });
  await createScreen({ slug: "__test__ex2", name: "Two", image, plantSlug: "__test__expl" });

  // Both land private, which is the whole reason the promote half also writes
  // visibility: `exhibited: true` on a private screen renders nothing.
  const before = await listScreensForPlant("__test__expl");
  assert.deepEqual(before.map((s) => s.slug).sort(), ["__test__ex1", "__test__ex2"]);
  assert.equal(before.every((s) => s.visibility === "private"), true);

  await writeExhibition({
    promote: [
      { slug: "__test__ex1", order: 0 },
      { slug: "__test__ex2", order: 1 },
    ],
    withdraw: [],
  });

  const db = await getDb();
  const one = await db.collection("screens").findOne({ slug: "__test__ex1" });
  assert.equal(one?.exhibited, true);
  assert.equal(one?.visibility, "public");
  assert.equal(one?.order, 0);

  await writeExhibition({ promote: [{ slug: "__test__ex2", order: 0 }], withdraw: ["__test__ex1"] });

  const withdrawn = await db.collection("screens").findOne({ slug: "__test__ex1" });
  assert.equal(withdrawn?.visibility, "private");
  // UNSET, not false and not 0: an absent optional field has one representation
  // in this database, which is createScreen's omission discipline continued.
  assert.equal("exhibited" in (withdrawn ?? {}), false);
  assert.equal("order" in (withdrawn ?? {}), false);

  const moved = await db.collection("screens").findOne({ slug: "__test__ex2" });
  assert.equal(moved?.order, 0);
});

test("writeExhibition is a no-op on two empty lists", { skip: !hasDb }, async () => {
  await writeExhibition({ promote: [], withdraw: [] });
});

test("listScreensForPlant returns only that plant's screens", { skip: !hasDb }, async (t) => {
  await ensureBotanicalIndexes();
  t.after(cleanup);

  const image = {
    kind: "image" as const,
    storageKey: "__test__k",
    url: "https://example.com/x.png",
    width: 1179,
    height: 2556,
  };
  await createScreen({ slug: "__test__lp1", name: "Mine", image, plantSlug: "__test__lpplant" });
  await createScreen({ slug: "__test__lp2", name: "Theirs", image, plantSlug: "__test__other" });

  const rows = await listScreensForPlant("__test__lpplant");
  assert.deepEqual(rows.map((s) => s.slug), ["__test__lp1"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:db`
Expected: FAIL — `listScreensForPlant is not exported`. (If `.env.local` has no `MONGODB_URI` the new tests SKIP; in that case verify the failure with `npx tsc --noEmit` instead, which will report the missing exports.)

- [ ] **Step 3: Write the implementation**

In `lib/botanical.ts`, add to the import from `./exhibition`:

```ts
import type { ExhibitionWrites } from "./exhibition";
```

DELETE the whole `listScreens` function and its docblock (it says to delete it
"if that slice lands on a different read"; it does), and put in its place:

```ts
/**
 * One plant's screens — the read both admin exhibition surfaces work from.
 *
 * A real query on `parents` rather than `loadRawGarden()`, because the two
 * callers want screens and nothing else: the plant page already has the garden
 * it needs, and the library's actions would otherwise load five collections to
 * reorder one strip.
 *
 * It replaces `listScreens`, whose docblock said to delete it if the gallery
 * slice landed on a different read. It did.
 *
 * Slug-ordered, and that is not the strip's order: this is a stable READ, and
 * `exhibitionOrder` is what puts it in sequence at the point of use, from the
 * `order` field this returns.
 */
export async function listScreensForPlant(plantSlug: string): Promise<Screen[]> {
  const db = await getDb();
  return db
    .collection<Screen>("screens")
    .find({ parents: `${PLANT_PREFIX}${plantSlug}` }, { projection: { _id: 0 } })
    .sort({ slug: 1 })
    .toArray();
}

/**
 * The exhibition, written.
 *
 * EXHIBITING AND PUBLISHING ARE ONE ACT, and this function is where that is
 * true. Every screen is private at birth (createScreen, above), and
 * filterPublic drops a private screen — so `exhibited: true` on its own would
 * render nothing at all, and an author who had to flip visibility separately
 * would produce, as the commonest mistake, a screen marked for the strip and
 * stored private, showing nothing with nothing on any page to say why.
 *
 * Withdrawing is the exact mirror, down to the `$unset`: an absent optional
 * field has ONE representation in this database — `createScreen`'s omission
 * discipline — so a withdrawn screen carries no `exhibited: false` and no
 * stale `order` for the next reader to interpret.
 *
 * A loop of updateOne for the promote half rather than a bulkWrite, because
 * each row writes a different `order`; setVisibility's shape, and a strip is a
 * handful of screens rather than a hundred and seventy. The withdraw half is
 * uniform, so it is one updateMany.
 *
 * Empty lists write nothing, which is what makes lib/exhibition.ts's `null`
 * no-op cheap all the way down.
 */
export async function writeExhibition(writes: ExhibitionWrites): Promise<void> {
  const db = await getDb();
  const screens = db.collection<Screen>("screens");

  for (const { slug, order } of writes.promote) {
    await screens.updateOne(
      { slug },
      { $set: { exhibited: true, visibility: "public", order } } as UpdateFilter<Screen>,
    );
  }

  if (writes.withdraw.length > 0) {
    await screens.updateMany({ slug: { $in: writes.withdraw } }, {
      $set: { visibility: "private" },
      $unset: { exhibited: "", order: "" },
    } as UpdateFilter<Screen>);
  }
}
```

`PLANT_PREFIX` must be added to the value import from `./data` at the top of
`lib/botanical.ts` (it currently imports `resolveText` plus types only).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:db`
Expected: PASS (or SKIP with no `MONGODB_URI`).
Then `npx tsc --noEmit` — no output — and `npm test` — all green.

- [ ] **Step 5: Commit**

```bash
git add lib/botanical.ts lib/botanical.test.ts
git commit -m "The exhibition write: promote and withdraw, both in lockstep

Every screen is private at birth and filterPublic drops a private screen, so
exhibited: true on its own renders nothing. Promote therefore writes
visibility beside it and withdraw writes it back — one act, one button, and
no way to mark a screen for a strip it cannot appear on.

listScreens goes, as its own docblock asked to if the gallery landed on a
different read. listScreensForPlant is that read.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: The two server actions

**Files:**
- Modify: `app/admin/actions.ts`

- [ ] **Step 1: Add the imports**

In `app/admin/actions.ts`, extend the `from "@/lib/botanical"` import with
`listScreensForPlant` and `writeExhibition`, and add:

```ts
import {
  applyExhibitionOp,
  exhibitionOpOf,
  exhibitionOrder,
  exhibitionWrites,
} from "@/lib/exhibition";
import { PLANT_PREFIX, parentsWithPrefix } from "@/lib/data";
```

(If `app/admin/actions.ts` already imports from `@/lib/data`, add the two names
to the existing import rather than writing a second one.)

- [ ] **Step 2: Write the shared core and the two actions**

Append to `app/admin/actions.ts`:

```ts
/**
 * The exhibition's one write, behind two doors.
 *
 * The PLANT IS DERIVED from the screen's own `parents[]` rather than taken from
 * a form field, and that is a guard rather than a tidiness: the ordering panel
 * redirects to `/admin/plant/<slug>`, and a plant slug that arrived in a hidden
 * input and reached `redirect()` would be an open redirect. Derived, it can
 * only ever be a value already in the database — the stance `screensHref` takes
 * for the library's filters.
 *
 * `op` is re-validated against the vocabulary rather than trusted, so a stale
 * page can only name one of the four. A no-op — `up` at the head, `add` for a
 * screen already exhibited — comes back from `applyExhibitionOp` as null and
 * writes nothing at all.
 *
 * Returns the plant slug so each caller can redirect where it belongs; null
 * when there was nothing to do, which includes a screen with no plant parent:
 * there is no exhibition for it to join.
 *
 * Not exported and not async-for-nothing: only the EXPORTS of a "use server"
 * module must be async, and this one genuinely awaits.
 */
async function applyExhibition(slug: string, rawOp: string): Promise<string | null> {
  const op = exhibitionOpOf(rawOp);
  if (!op) return null;

  const screen = await getScreen(slug);
  if (!screen) return null;

  const plantSlug = parentsWithPrefix(screen.parents, PLANT_PREFIX)[0];
  if (!plantSlug) return null;

  const current = (await listScreensForPlant(plantSlug))
    .filter((s) => s.exhibited === true)
    .sort(exhibitionOrder);

  const after = applyExhibitionOp(
    current.map((s) => s.slug),
    slug,
    op,
  );
  if (!after) return plantSlug;

  await writeExhibition(exhibitionWrites(current, after));
  return plantSlug;
}

/** Membership, from the screen's own page in the library — the half that works
 *  without script. Redirects back through the author's filters, exactly as the
 *  library's four other write paths do. */
export async function toggleScreenExhibitAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");
  const query = activeFilterQuery(formData);

  const plantSlug = await applyExhibition(slug, String(formData.get("op") ?? ""));

  revalidatePath("/admin/screens");
  if (plantSlug) revalidatePath(`/admin/plant/${plantSlug}`);
  redirect(screensHref(slug, query));
}

/** Ordering, from the plant's rail panel. Same core; the only difference is
 *  where it comes back to. `encodeURIComponent` on a slug that came from the
 *  DATABASE for `screensHref`'s reason — a screen's slug came from a filename,
 *  and a plant's is hand-authored, but neither is a reason to be the one place
 *  in the slice that trusts one. */
export async function reorderExhibitionAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const plantSlug = await applyExhibition(slug, String(formData.get("op") ?? ""));

  revalidatePath("/admin/screens");
  if (!plantSlug) redirect("/admin/screens");
  revalidatePath(`/admin/plant/${plantSlug}`);
  redirect(`/admin/plant/${encodeURIComponent(plantSlug)}`);
}
```

- [ ] **Step 3: Verify types and build**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add app/admin/actions.ts
git commit -m "Two doors, one exhibition write

Membership from the screen's page, ordering from the plant's panel, over one
core. The plant is DERIVED from the screen's parents rather than read from a
hidden field: the ordering action redirects to /admin/plant/<slug>, and a
slug that arrived in a form and reached redirect() would be an open redirect.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: The membership card on the screen's page

**Files:**
- Create: `app/admin/_components/screen-exhibit-form.tsx`
- Modify: `app/admin/screens/[slug]/page.tsx`

- [ ] **Step 1: Write the component**

Create `app/admin/_components/screen-exhibit-form.tsx`:

```tsx
import { PLANT_PREFIX, parentsWithPrefix, type Screen } from "@/lib/data";
import { toggleScreenExhibitAction } from "../actions";
import { Button } from "@/components/ui/button";
import { FilterFields } from "./filter-fields";

/**
 * Whether this screen is on its plant's strip — one button, and the half of
 * the exhibition that works without script.
 *
 * An ORDINARY admin metadata form: native controls, a real submit, zero client
 * JS. The other half — the SEQUENCE — lives in a popover on the plant page,
 * because a 256px panel can hold a strip of eight and cannot hold a library of
 * a hundred and seventy to pick from. That split is deliberate and it is what
 * makes the script-off cost one sentence long: without script the author can
 * still add and withdraw, here, and only the ordering is out of reach.
 *
 * Separate from the Details form next door for the reason every card on this
 * page is separate from its neighbour (the bean Keyword form states it at
 * length): one form, one act, so a save can never carry a field the author did
 * not mean to touch.
 *
 * A screen with no plant parent gets a sentence instead of a button. There is
 * no exhibition for it to join, and a button that could only fail is worse
 * than none — `applyExhibition` refuses the same case server-side, which is
 * the defence-in-depth stance `buildScreenImagePatch`'s `__ready` check takes.
 */
export function ScreenExhibitForm({
  screen,
  plantName,
  query,
}: {
  screen: Screen;
  /** The containing plant's readable name, resolved by the page. */
  plantName: string | null;
  query: string;
}) {
  const plant = parentsWithPrefix(screen.parents, PLANT_PREFIX)[0] ?? null;
  const exhibited = screen.exhibited === true;

  if (!plant) {
    return (
      <p className="text-sm text-muted-foreground">
        This screen has no plant, so there is no exhibition for it to join. Give it one in Details
        above.
      </p>
    );
  }

  return (
    <form action={toggleScreenExhibitAction} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={screen.slug} />
      <FilterFields query={query} />

      <p className="text-sm text-muted-foreground">
        {exhibited ? (
          <>
            On <span className="font-heading">{plantName ?? plant}</span>&rsquo;s page, in the strip
            above the narrative. Its position is set from the plant&rsquo;s Exhibition panel.
          </>
        ) : (
          <>
            Stored, and on no page. Adding it to{" "}
            <span className="font-heading">{plantName ?? plant}</span>&rsquo;s strip publishes this
            screen; withdrawing it makes it private again.
          </>
        )}
      </p>

      <div>
        {/* The op is a NAMED member of lib/exhibition.ts's vocabulary, carried
            on the button rather than in a hidden field, so the form has exactly
            one meaning at a time. The action re-validates it regardless. */}
        <Button type="submit" name="op" value={exhibited ? "remove" : "add"} variant={exhibited ? "outline" : "default"}>
          {exhibited ? "Remove from the exhibition" : `Add to ${plantName ?? plant}'s exhibition`}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Wire it into the page**

In `app/admin/screens/[slug]/page.tsx`:

Add the import beside the other form imports:

```ts
import { ScreenExhibitForm } from "@/app/admin/_components/screen-exhibit-form";
```

Add, beside the existing `const isCover = ...` line:

```ts
  const plantSlug = parentsWithPrefix(screen.parents, PLANT_PREFIX)[0] ?? null;
  const plantName = plantSlug
    ? (resolveText((raw.plants ?? []).find((p) => p.slug === plantSlug)?.name) || plantSlug)
    : null;
```

and extend the page's `from "@/lib/data"` import to
`import { PLANT_PREFIX, parentsWithPrefix, resolveText, type RawGarden } from "@/lib/data";`.

Insert a new `<section>` between the Details section and the Image section:

```tsx
      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-lg tracking-tight">Exhibition</h2>
        <Card>
          <CardContent>
            <ScreenExhibitForm screen={screen} plantName={plantName} query={query} />
          </CardContent>
        </Card>
      </section>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — no output.
Run: `npm run build` — completes without error.

Then check by eye: `npm run dev`, open `http://localhost:3333/admin/screens`, click a
screen, and confirm the Exhibition card appears in the side sheet with the right
button text. **The side sheet renders this very module**, so the card must appear
in both the sheet and at `/admin/screens/<slug>` directly.

- [ ] **Step 4: Commit**

```bash
git add app/admin/_components/screen-exhibit-form.tsx "app/admin/screens/[slug]/page.tsx"
git commit -m "Membership, on the screen's own page

One button, zero client JS, in the shape every other card on this page has.
It is the half of the exhibition that survives script-off, which is what
lets the ordering panel be a popover without the whole feature going with it.

A screen with no plant gets a sentence rather than a button that could only
fail, and the action refuses the same case anyway.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: The ordering panel on the plant's rail

**Files:**
- Create: `app/admin/_components/exhibition-panel.tsx`
- Modify: `app/admin/_components/plant-inside.tsx`, `app/admin/plant/[slug]/page.tsx`

- [ ] **Step 1: Write the panel's contents (a SERVER component)**

Create `app/admin/_components/exhibition-panel.tsx`:

```tsx
import { cloudinaryFit } from "@/lib/image-url";
import { reorderExhibitionAction } from "../actions";

/**
 * The strip's SEQUENCE, as the contents of a panel on the plant's right-hand
 * rail.
 *
 * A SERVER component, rendered by `app/admin/plant/[slug]/page.tsx` and handed
 * to `plant-inside.tsx` as a prop — the arrangement `plant-hero.tsx` uses for
 * `metaForm`, `roleForm` and `logoForm`, and for the same reason: the client
 * island owns the open state and nothing else, so it never composes a payload
 * and never learns a field name.
 *
 * Each row is ONE form with three submit buttons rather than three forms,
 * which is why a row needs no client code at all: `name="op"` on the button is
 * what tells the action which of the three the author pressed, and a button
 * that would do nothing is `disabled` rather than absent — a row whose ↑ came
 * and went as it moved would shift the other two under the pointer.
 *
 * `disabled` is a courtesy and not the guard. `applyExhibitionOp` returns null
 * for `up` at the head and `down` at the tail, so a crafted POST writes
 * nothing; the attribute only spares the author a page load.
 */
export interface ExhibitionPanelRow {
  slug: string;
  /** Resolved for display — a row shows words, not a Text. */
  name: string;
  url: string;
  alt: string;
}

export function ExhibitionPanel({
  plantSlug,
  rows,
}: {
  plantSlug: string;
  rows: ExhibitionPanelRow[];
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing exhibited yet. Add screens from{" "}
        <a
          href={`/admin/screens?plant=${encodeURIComponent(plantSlug)}`}
          className="underline underline-offset-4 transition-colors hover:text-foreground"
        >
          the library
        </a>
        .
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-1">
      {rows.map((row, index) => (
        <li key={row.slug}>
          <form action={reorderExhibitionAction} className="flex items-center gap-2">
            <input type="hidden" name="slug" value={row.slug} />

            {/* object-contain for the contact sheet's reason: a 9:19.5 capture
                cropped into a box is a picture of its middle third, and the
                thumbnail is here to be recognised. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cloudinaryFit(row.url, { width: 96 })}
              alt={row.alt}
              loading="lazy"
              decoding="async"
              className="h-12 w-8 shrink-0 rounded border bg-muted/40 object-contain"
            />

            <a
              href={`/admin/screens/${encodeURIComponent(row.slug)}`}
              className="min-w-0 flex-1 truncate text-sm underline-offset-4 hover:underline"
            >
              {row.name}
            </a>

            <span className="flex shrink-0 items-center gap-0.5">
              <PanelButton op="up" label={`Move ${row.name} up`} disabled={index === 0}>
                ↑
              </PanelButton>
              <PanelButton
                op="down"
                label={`Move ${row.name} down`}
                disabled={index === rows.length - 1}
              >
                ↓
              </PanelButton>
              <PanelButton op="remove" label={`Remove ${row.name} from the exhibition`}>
                ✕
              </PanelButton>
            </span>
          </form>
        </li>
      ))}
    </ol>
  );
}

/**
 * One of the three. An `aria-hidden` glyph beside an `sr-only` word, which is
 * `components/admin/glyphs.tsx`'s shape and the screen library's "+": the name
 * is real text in the document rather than an attribute on it, so an arrow is
 * never the only carrier of what it does.
 *
 * No lucide, and not for the public zone's reason — this is the admin, which
 * imports lucide everywhere. Three arrows at 12px in a 256px panel are two
 * characters of text, and a component for each would be three imports to draw
 * what the font already has.
 */
function PanelButton({
  op,
  label,
  disabled,
  children,
}: {
  op: "up" | "down" | "remove";
  label: string;
  disabled?: boolean;
  children: string;
}) {
  return (
    <button
      type="submit"
      name="op"
      value={op}
      disabled={disabled}
      className="flex size-6 items-center justify-center rounded-md text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
    >
      <span aria-hidden>{children}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
```

- [ ] **Step 2: Give the rail a second panel**

In `app/admin/_components/plant-inside.tsx`:

Change the lucide import to `import { Boxes, GalleryHorizontal } from "lucide-react";`.

Change the docblock's fourth paragraph FROM:

```
 * Client only for the open state. Nothing here writes and nothing here is a
 * form — every row is the same <a href> the page rendered before, and
 * script-off the panel simply never opens. That costs discovery and never a
 * destination, exactly as the vault's filter popovers do: every page listed
 * here is also reachable from /admin/garden, from ⌘K, and from the prose.
```

TO:

```
 * Client only for the open state. The Inside panel writes nothing — every row
 * is the same <a href> the page rendered before — and script-off it simply
 * never opens, which costs discovery and never a destination.
 *
 * The Exhibition panel DOES carry forms, and this file still composes none of
 * them: its contents are server-rendered by app/admin/plant/[slug]/page.tsx and
 * arrive as a prop, exactly as plant-hero.tsx takes metaForm, roleForm and
 * logoForm. This island owns the open state and nothing else — it learns no
 * field name and builds no payload.
 *
 * What that costs without script is ORDERING, and only ordering: membership
 * lives on the screen's own page in the library (screen-exhibit-form.tsx), so
 * adding and withdrawing both survive, and a strip whose sequence was never set
 * still renders in exhibitionOrder's fallback. That split is the whole reason
 * this is an amendment to a neighbour rather than a seventh exception.
```

Change the signature and body:

```tsx
export function PlantInside({
  items,
  exhibition,
  exhibitionCount,
  children,
}: {
  items: InsideItem[];
  /** The Exhibition panel's contents, server-rendered by the page. Absent for
   *  a plant with no screens at all — the rail then shows one icon, not two. */
  exhibition?: ReactNode;
  exhibitionCount: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [showing, setShowing] = useState(false);
```

The page-nudge div's condition becomes `(open || showing ? "lg:-translate-x-28" : "")`.

Inside the existing `<Chrome ...>`, AFTER the closing `</Popover>` of the Inside
panel, add:

```tsx
        {exhibition ? (
          <Popover open={showing} onOpenChange={setShowing}>
            <ChromeItem
              label={`Exhibition${exhibitionCount > 0 ? ` (${exhibitionCount})` : ""}`}
            >
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    aria-label="Exhibition"
                    className={chromeItemClass(showing)}
                  >
                    <GalleryHorizontal className="size-4" />
                  </button>
                }
              />
            </ChromeItem>

            {/* Same measured sideOffset as the panel above it, for the same
                reason: the anchor is the button but what has to be cleared is
                the pill around it. */}
            <PopoverContent
              side="left"
              align="center"
              sideOffset={16}
              className="max-h-[70vh] w-80 overflow-y-auto"
            >
              <p className="mb-2 font-heading text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Exhibition
              </p>
              {exhibition}
            </PopoverContent>
          </Popover>
        ) : null}
```

- [ ] **Step 3: Wire the plant page**

In `app/admin/plant/[slug]/page.tsx`:

Add imports:

```ts
import { ExhibitionPanel, type ExhibitionPanelRow } from "../../_components/exhibition-panel";
import { exhibitionOrder } from "@/lib/exhibition";
import { PLANT_PREFIX, parentsWithPrefix } from "@/lib/data";
```

(fold `PLANT_PREFIX` and `parentsWithPrefix` into the existing `from "@/lib/data"`
import rather than adding a second one.)

After the `inside` array, add:

```ts
  // The plant's screens, from the garden already loaded. Every screen it has —
  // the panel needs the count to decide whether the rail shows a second icon at
  // all, and the exhibited ones to list.
  const plantScreens = (raw.screens ?? []).filter((s) =>
    parentsWithPrefix(s.parents, PLANT_PREFIX).includes(slug),
  );
  const exhibitionRows: ExhibitionPanelRow[] = plantScreens
    .filter((s) => s.exhibited === true)
    .sort(exhibitionOrder)
    .map((s) => ({
      slug: s.slug,
      name: resolveText(s.name),
      url: s.image.url,
      alt: s.image.alt ?? "",
    }));
```

Change the `<PlantInside items={inside}>` opening tag to:

```tsx
    <PlantInside
      items={inside}
      exhibitionCount={exhibitionRows.length}
      // Handed down server-rendered, so the island never composes a payload.
      // Absent when the plant has no screens at all: a rail icon opening onto
      // "nothing to see" is a control that only ever says no.
      exhibition={
        plantScreens.length > 0 ? (
          <ExhibitionPanel plantSlug={slug} rows={exhibitionRows} />
        ) : undefined
      }
    >
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — no output.
Run: `npm run build` — completes.
Run: `npm test` — all green.

By eye (`npm run dev`, `http://localhost:3333/admin/plant/paulopus`): the rail
shows two icons; the Exhibition panel lists the exhibited screens in order; ↑ on
the first row and ↓ on the last are disabled; pressing ↑ on the second row
reloads the page with the two swapped.

- [ ] **Step 5: Commit**

```bash
git add app/admin/_components/exhibition-panel.tsx app/admin/_components/plant-inside.tsx "app/admin/plant/[slug]/page.tsx"
git commit -m "The exhibition's sequence, on the plant's rail

A second panel beside Inside, whose contents are server-rendered by the page
and handed down as a prop — plant-hero.tsx's arrangement, so the island still
owns the open state and nothing else.

Each row is one form with three submit buttons, so a row needs no client code.
disabled on the ends is a courtesy: applyExhibitionOp already returns null for
an up at the head, so a crafted POST writes nothing.

Script-off this costs ORDERING and only ordering — membership is on the
screen's own page — which is why plant-inside.tsx's note is amended rather
than the exception list grown.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Extract the phone frame

`components/bean-cover.tsx` owns the phone's geometry and the gallery needs the
same phone. Extract, do not copy. The cover keeps its positioning, its hover
choreography and its word — those are the cover's, not the phone's.

**Files:**
- Create: `components/phone-frame.tsx`
- Modify: `components/bean-cover.tsx`, `lib/server-safe-source.test.ts`
- Test: `components/bean-cover.test.tsx` must pass UNCHANGED — that is the proof the extraction changed nothing.

- [ ] **Step 1: Write the component**

Create `components/phone-frame.tsx`:

```tsx
import type { MediaImage } from "@/lib/data";
import { cloudinaryThumb } from "@/lib/image-url";

/**
 * A phone, drawn around a portrait screenshot.
 *
 * SERVER-SAFE and pinned as such in lib/server-safe-source.test.ts, and unlike
 * `components/bean-cover.tsx` it is genuinely ISOMORPHIC: it imports a TYPE
 * from lib/data and a pure string function from lib/image-url, and no value
 * that reaches `node:fs`.
 *
 * Extracted when the screen gallery needed the cover's phone. What lives here
 * is the phone and nothing else — the bezel, the screen's radius, and the
 * derivative. What does NOT live here is where a phone sits, how it moves, or
 * what is written above it: `bean-cover.tsx` keeps its own positioning and its
 * hover choreography, `screen-strip.tsx` keeps its window, and neither has to
 * know the other exists.
 *
 * Two details are load-bearing rather than styling:
 *
 *  - **`bg-neutral-900`, not a theme token.** A phone is dark in both themes,
 *    so `bg-foreground` (near-white in dark mode) or `bg-card` (vanishes into
 *    the page) would both be silently wrong fixes for something that was never
 *    broken. It is the one non-token colour in either caller.
 *  - **The bezel is drawn HERE, never baked into the stored file.** Baking it
 *    would make cloudinaryThumb crop a composite instead of a screen, and turn
 *    "re-shoot that screen" into "re-composite that screen".
 *
 * `pb-0` is what makes the phone bottomless: it has a bezel on three sides and
 * runs off the bottom of whatever frames it, which is what lets both callers
 * read as a window onto something taller rather than as a cropped picture.
 *
 * `width`/`height` are the DERIVATIVE's, not the box's — every caller asks
 * Cloudinary for roughly twice the pixels it paints, so the screen stays sharp
 * on a retina display, and asks for the FULL height rather than the visible
 * part, because both callers reveal more of the image than they show at rest.
 */
export function PhoneFrame({
  image,
  width,
  height,
  className,
}: {
  image: MediaImage;
  width: number;
  height: number;
  /** Where the phone sits and how it moves — the caller's business entirely. */
  className?: string;
}) {
  return (
    <span className={`rounded-2xl bg-neutral-900 p-1 pb-0 shadow-lg ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cloudinaryThumb(image.url, { width, height })}
        alt={image.alt ?? ""}
        loading="lazy"
        decoding="async"
        className="block w-full rounded-t-xl"
      />
    </span>
  );
}
```

- [ ] **Step 2: Redraw the cover from it**

In `components/bean-cover.tsx`:

Add `import { PhoneFrame } from "@/components/phone-frame";` beside the other imports.

REPLACE the whole final `<span className={...}>...</span>` block (the one carrying
`absolute left-1/2 top-[58px]` and the nested `<img>`) with:

```tsx
      <PhoneFrame
        image={cover.image}
        // ~2.15x the box the screenshot actually paints — 104 x 225, once
        // `p-1` is taken out of the 112px span — rather than the flat 2x
        // lib/image-url.ts states every caller asks for. This is the one
        // caller that departs from that rule, and the departure is in the safe
        // direction: a little sharper than needed, never softer.
        //
        // The FULL height, not the ~110px visible at rest: hover reveals more
        // of the image, and a derivative sized to the rest state would blur
        // exactly when the visitor leans in.
        width={224}
        height={484}
        // The transform is written whole rather than composed from Tailwind's
        // translate-x / translate-y / scale utilities. Those set separate
        // custom properties that a hover variant then has to re-declare in full
        // anyway, and getting one of them wrong centres the phone off-axis for
        // the duration of the transition only — which is exactly the kind of
        // bug that survives review.
        //
        // -46px with a 0.80 scale from `origin-top`: 110px of the phone visible
        // at rest becomes ~156px of a smaller phone on hover. Against the
        // span's real ~229px that is 48% of it showing, becoming 85%.
        className={`absolute left-1/2 top-[58px] w-1/2 origin-top [transform:translateX(-50%)] ${GLIDE} group-hover:[transform:translateX(-50%)_translateY(-46px)_scale(0.8)]`}
      />
```

Delete the `bg-neutral-900` paragraph from the comment you are replacing — it moved
into `phone-frame.tsx` with the class. Keep every other comment, moved as above.

In the file's docblock, after the sentence about the geometry being tied to the
row's `w-56` card, add:

```
 * The phone itself is `components/phone-frame.tsx` since the gallery slice
 * needed the same one. What stayed here is what is the COVER's: where the phone
 * sits, how it rises on hover, and the word that leaves as it does.
```

- [ ] **Step 3: Pin the new file**

In `lib/server-safe-source.test.ts`, add `"components/phone-frame.tsx",` to the
`SERVER_SAFE` array.

- [ ] **Step 4: Run the tests to verify the extraction changed nothing**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test components/bean-cover.test.tsx lib/server-safe-source.test.ts`
Expected: PASS — every existing bean-cover test, unmodified. In particular
`"a phone cover asks for the TALL derivative, not the square one"` still matches
`w_224,h_484,c_fill,q_auto,f_auto`, `loading="lazy"` and `decoding="async"`.

If any of them fail, the extraction changed the rendered output — fix the
component, not the test.

Then `npx tsc --noEmit` and `npm run build`.

- [ ] **Step 5: Commit**

```bash
git add components/phone-frame.tsx components/bean-cover.tsx lib/server-safe-source.test.ts
git commit -m "Extract the phone, so the gallery draws the cover's phone

The bezel, the screen's radius and the derivative move to one file both
callers draw from. What stays in bean-cover.tsx is what is the COVER's:
where the phone sits, how it rises on hover, and the word that leaves as
it does.

bean-cover.test.tsx passes unchanged, which is the proof the extraction
changed nothing a visitor sees.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: The public strip

**Files:**
- Create: `components/screen-strip.tsx`, `components/screen-strip.test.tsx`
- Modify: `lib/server-safe-source.test.ts`

- [ ] **Step 1: Write the failing test**

Create `components/screen-strip.test.tsx`:

```tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { ScreenStrip } from "./screen-strip";
import type { ExhibitionRow } from "@/lib/exhibition";

/**
 * renderToStaticMarkup, no jsdom — components/bean-cover.test.tsx's route, and
 * for its reason: the strip is a server component and the static markup IS its
 * output. It is also exactly what PR 2's island must add nothing to.
 */
const row = (slug: string, legend = ""): ExhibitionRow => ({
  slug,
  name: `${slug} name`,
  legend,
  image: {
    kind: "image",
    storageKey: `k/${slug}`,
    url: `https://res.cloudinary.com/demo/image/upload/v1/${slug}.png`,
    width: 1179,
    height: 2556,
  },
});

const html = (rows: ExhibitionRow[]) =>
  renderToStaticMarkup(<ScreenStrip rows={rows} plantName="Paulopus" />);

test("an empty exhibition renders nothing at all", () => {
  // Not an empty <section>: the plant page's `gap-8` would put 32px on both
  // sides of it, which is the bug the platform-links guard on that page
  // already documents.
  assert.equal(html([]), "");
});

test("every screen is a REAL anchor to the full image", () => {
  // The whole of PR 2's admissibility: the island intercepts a link that
  // already works, so its absence costs nothing. If this ever becomes a
  // <button>, the lightbox stops being an enhancement.
  const markup = html([row("one"), row("two")]);
  assert.match(markup, /<a[^>]+href="https:\/\/res\.cloudinary\.com\/demo\/image\/upload\/v1\/one\.png"/);
  assert.match(markup, /<a[^>]+href="https:\/\/res\.cloudinary\.com\/demo\/image\/upload\/v1\/two\.png"/);
});

test("the href is the FULL image, never a derivative", () => {
  const markup = html([row("one")]);
  assert.doesNotMatch(markup, /href="[^"]*w_\d+/);
});

test("the legend is always in the markup, never hover-only", () => {
  const markup = html([row("one", "The match hero, at full time")]);
  assert.match(markup, /The match hero, at full time/);
});

test("a screen with no legend falls back to its name, never to a blank caption", () => {
  // A legend is optional and most screens have none — lib/data.ts: "a hundred
  // and seventy captions nobody asked for would be worse than none". An empty
  // caption box under every phone would be the visible cost of that decision.
  const markup = html([row("one")]);
  assert.match(markup, /one name/);
  assert.doesNotMatch(markup, /<figcaption[^>]*><\/figcaption>/);
});

test("the strip is keyboard-reachable and names itself", () => {
  // tabIndex is what makes the arrow keys true: a scroll container is not
  // focusable by default, so without it every slide past the first is
  // unreachable to anyone not using a pointer. components/media.tsx's Gallery
  // carries the same pair for the same reason.
  const markup = html([row("one"), row("two")]);
  assert.match(markup, /tabindex="0"/i);
  assert.match(markup, /aria-label="[^"]*Paulopus[^"]*"/);
});

test("the phones ask Cloudinary for a tall derivative", () => {
  const markup = html([row("one")]);
  assert.match(markup, /w_400,h_868,c_fill,q_auto,f_auto/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test components/screen-strip.test.tsx`
Expected: FAIL — `Cannot find module './screen-strip'`.

- [ ] **Step 3: Write the component**

Create `components/screen-strip.tsx`:

```tsx
import type { ExhibitionRow } from "@/lib/exhibition";
import { PhoneFrame } from "@/components/phone-frame";

/**
 * The plant's exhibition — a rank of phones the visitor swipes, with the
 * legends under them.
 *
 * SERVER-SAFE and pinned as such in lib/server-safe-source.test.ts: no
 * "use client", no lucide-react. It is also ISOMORPHIC rather than merely
 * server-safe, because it takes rows whose two `Text`s the page already
 * resolved — so nothing here reaches lib/data.ts and its `node:fs`.
 *
 * CSS only, which is the same decision components/media.tsx's Gallery made and
 * the primitive this reuses rather than reinvents: `overflow-x-auto` plus
 * scroll snapping. There is no carousel script, no dots and no arrows, so there
 * is nothing that stops working without JavaScript — the strip scrolls with a
 * finger, a trackpad, a scrollbar, or the arrow keys once it has focus.
 * `tabIndex={0}` is what makes that last one true.
 *
 * EVERY PHONE IS A REAL ANCHOR to the full Cloudinary image, and that is not
 * decoration: it costs this slice nothing (the URL is already on the page) and
 * it is the thing the lightbox slice intercepts. An island that adds behaviour
 * to a link that already works is an enhancement whose absence costs nothing;
 * one that supplies the only route to the image is a seventh exception of a
 * much more expensive kind.
 *
 * The window is `aspect-[3/4]` with `overflow-hidden` and the phone is pinned
 * to its top, so the phone runs off the bottom edge — the landing row's
 * treatment, and what makes the strip read as a rank of phones rather than a
 * row of cropped pictures.
 */
export function ScreenStrip({
  rows,
  plantName,
}: {
  rows: ExhibitionRow[];
  /** For the group's accessible name — the visitor hears whose screens these
   *  are, not "gallery". */
  plantName: string;
}) {
  // Nothing at all for an empty exhibition. Not an empty <section>: the plant
  // page's `gap-8` puts 32px on both sides of every flex item, so a wrapper
  // around nothing doubles the space above the narrative — the bug that page's
  // platform-links guard already documents.
  if (rows.length === 0) return null;

  return (
    <div
      role="group"
      tabIndex={0}
      aria-label={`Screens from ${plantName}, ${rows.length}`}
      // -mx-1/px-1 so a focus ring on the strip is not clipped by its own
      // overflow; pb-2 leaves room for the scrollbar rather than over the
      // legends. Gallery's arrangement, for Gallery's reasons.
      className="not-prose -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2"
    >
      {rows.map((row) => (
        <figure key={row.slug} className="flex w-[min(52vw,13rem)] shrink-0 snap-start flex-col gap-3">
          <a
            // The FULL image, not a derivative. See the docblock.
            href={row.image.url}
            className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {/* The window. `relative` establishes the positioning context the
                phone is pinned into, and `overflow-hidden` is what crops it. */}
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl">
              <PhoneFrame
                image={row.image}
                // 2x the ~200px of screen this paints, at a 9:19.5 phone's
                // ratio, and the FULL height rather than the ~75% the window
                // shows: the strip is one place a visitor may zoom, and a
                // derivative sized to the visible part would blur there.
                width={400}
                height={868}
                className="absolute inset-x-0 top-0"
              />
            </div>
          </a>

          {/* ALWAYS VISIBLE, never a hover state: a caption the visitor has to
              discover is a caption most visitors never read. The name is the
              fallback, because every screen has one and a legend is optional
              (lib/data.ts: "a hundred and seventy captions nobody asked for
              would be worse than none"). */}
          <figcaption className="text-xs leading-relaxed text-muted-foreground">
            {row.legend || row.name}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Pin it**

In `lib/server-safe-source.test.ts`, add `"components/screen-strip.tsx",` to the
`SERVER_SAFE` array.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test components/screen-strip.test.tsx lib/server-safe-source.test.ts`
Expected: PASS, all seven strip tests plus the three server-safe assertions for
each pinned file.

- [ ] **Step 6: Commit**

```bash
git add components/screen-strip.tsx components/screen-strip.test.tsx lib/server-safe-source.test.ts
git commit -m "The strip: a rank of phones the visitor swipes

CSS only — overflow-x-auto plus scroll snapping, media.tsx's Gallery reused
rather than reinvented — so app/(public) still has exactly one client island
when this lands.

Every phone is a real anchor to the full image. That costs nothing here (the
URL is already on the page) and it is what makes the lightbox an enhancement
rather than the only route to the picture. A test pins it as an <a>.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: The strip on the plant page

**Files:**
- Modify: `app/(public)/(chrome)/plant/[slug]/page.tsx`

- [ ] **Step 1: Wire it up**

Add imports:

```ts
import { ScreenStrip } from "@/components/screen-strip";
import type { ExhibitionRow } from "@/lib/exhibition";
```

After the `const pods = ...` / `const beans = ...` lines, add:

```ts
  // The exhibition, with both Texts resolved HERE rather than in the strip —
  // which is what keeps components/screen-strip.tsx isomorphic instead of
  // server-only, and what will let the lightbox slice hand the same rows to a
  // client island.
  const screens: ExhibitionRow[] = data.exhibitionForPlant(slug).map((screen) => ({
    slug: screen.slug,
    name: resolveText(screen.name, lang),
    legend: resolveText(screen.legend ?? "", lang).trim(),
    image: screen.image,
  }));
```

Insert BETWEEN the platform-links block and the `<Prose>` block:

```tsx
      {/* The exhibition, ABOVE the narrative: show first, explain after. It
          renders nothing at all for a plant with no exhibited screens, so this
          needs no guard of its own — ScreenStrip returns null and React drops
          the flex item, which is the shape the links block above could not
          take (a centring wrapper around null is still an item). */}
      <ScreenStrip rows={screens} plantName={resolveText(plant.name, lang)} />
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — no output.
Run: `npm run build` — completes.
Run: `npm test` — all green.

By eye (`npm run dev`): `http://localhost:3333/plant/paulopus` after exhibiting two
or three screens in the admin. Check: the strip sits above the narrative; the
legends are visible without hovering; the row scrolls horizontally and snaps;
clicking a phone opens the full image; the page has no horizontal scrollbar of
its own.

Then disable JavaScript in the browser and reload. Everything above must still be
true except the TOC rail — that is the whole claim of this slice.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/(chrome)/plant/[slug]/page.tsx"
git commit -m "The plant page shows its exhibition, above the narrative

Show first, explain after. Both Texts are resolved here rather than in the
strip, which is what keeps that component isomorphic and what will let the
lightbox slice hand the same rows to a client island.

No guard around it: the strip returns null for an empty exhibition, so React
drops the flex item and the page's gap-8 has nothing to double.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: CLAUDE.md, and the whole-suite check

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Amend the `plant-inside.tsx` neighbour note**

`CLAUDE.md` lists five neighbours that are "not further exceptions". The plant
page's rail is described inside the **fifth exception** (the plant page's header).
Find this sentence in that section:

```
The pods and beans index left the page for a floating panel on a right-hand rail,
the mirror of the chrome's, which slides the page left rather than covering it.
```

and add immediately after it:

```
That rail now carries a second panel, the **Exhibition** (the screen-gallery
slice) — the plant's strip of screens, in order, with ↑ / ↓ / ✕ on each row.
It is the first thing on the rail that writes, and it is still not a new
exception, for two reasons. Its contents are **server-rendered by the page and
handed down as a prop**, exactly as `metaForm` / `roleForm` / `logoForm` are, so
`plant-inside.tsx` composes no payload and learns no field name. And what its
absence costs is **ordering alone**: membership lives on the screen's own page
in the library (`app/admin/_components/screen-exhibit-form.tsx`, an ordinary
zero-client-JS form), so script-off the author can still add and withdraw, and a
strip whose sequence was never set still renders in `exhibitionOrder`'s
fallback — unordered last, by slug.

Two rules that slice carries are worth stating where they can be found.
**Exhibiting and publishing are one act**: a screen is private at birth, so
`lib/botanical.ts`'s `writeExhibition` writes `visibility: "public"` beside
`exhibited: true` and reverses both on withdrawal — an author who had to flip
visibility separately would produce, as the commonest mistake, a screen marked
for a strip it cannot appear on. And **the strip requires both facts**:
`filterPublic` enforces privacy, `Dataset.exhibitionForPlant` enforces the
editorial opt-in, and neither re-checks the other's — which is why a screen made
public by some other route never silently appears on a plant page.
```

Then, in the neighbours list further down, find the bullet beginning
"The public chrome (`app/(public)/_components/public-chrome.tsx`)" and add a new
bullet ABOVE it:

```
- The public strip (`components/screen-strip.tsx`) and the phone it draws
  (`components/phone-frame.tsx`, extracted from `components/bean-cover.tsx` so
  the gallery and the landing row draw one phone). Both are **server**
  components pinned in `lib/server-safe-source.test.ts`, the row is CSS
  `overflow-x-auto` with scroll snapping — `components/media.tsx`'s `Gallery`
  reused rather than reinvented — and `app/(public)` still has exactly one
  island. Every phone is a real `<a href>` to the full image, which is
  deliberate and load-bearing: it is what the lightbox slice will intercept, and
  what makes that island an enhancement rather than the only route to the
  picture.
```

- [ ] **Step 2: Run everything**

```bash
npm test && npx tsc --noEmit && npm run build
```
Expected: all tests pass, no type output, build completes.

Run `npm run test:db` too if `.env.local` has a `MONGODB_URI`.

- [ ] **Step 3: Commit and open the PR**

```bash
git add CLAUDE.md
git commit -m "CLAUDE.md: the exhibition panel, and why it is not a seventh exception

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push -u origin screen-gallery
```

Then open the PR. **It ships something a visitor would notice, so the body MUST
carry a Lab Note** — a section whose heading starts with `## Lab Note` holding
exactly one ```yaml fence:

```yaml
en:
  title: Apps you can actually look at
  summary: Project pages now open with a row of screens from the app itself — swipe through them, captions and all, before reading a word about it.
fr:
  title: Les apps, en vrai
  summary: Les pages de projet s'ouvrent maintenant sur une série d'écrans de l'app — tu les fais défiler, légendes comprises, avant même de lire quoi que ce soit.
suggested:
  molecule: ariko
  type: feature
  tags: [changelog]
```

The PR body should also say it closes #71, and that #72 (the lightbox) follows on
top of it.

---

## Notes for the implementer

- **Do not touch `main`.** Everything lands on `screen-gallery`.
- **Do not build the lightbox.** It is spec §9 and PR 2. If you find yourself
  writing `"use client"` in `components/`, stop — this slice adds none.
- **`lib/exhibition.ts` must never grow a value import.** `lib/data.ts` imports
  it; a value import back out is a runtime cycle that fails the build in a
  confusing place.
- **The public zone's two rules** (`lib/server-safe-source.test.ts` enforces
  them): no `"use client"`, no `lucide-react` in anything `app/(public)` renders.
  The admin has neither constraint.
- If a test you did not write starts failing, that is a signal the change was
  wider than intended — read the test before changing it.
