# Related Beans Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** End `/bean/[id]` with a rail of up to six other beans worth reading — pod siblings first, topped up from the plant.

**Architecture:** Three pieces, each independently testable. `lib/related-beans.ts` is a pure function over a `Dataset` that answers *which beans* (no data loading, no JSX — the garden is a parameter, so privacy stays the page's decision). `components/bean-card.tsx` is the landing page's existing card face lifted into one file with a cover **slot**, so both callers draw the same card. The bean page composes them into a fixed-224px-track grid after `</article>`.

**Tech Stack:** Next.js 15 App Router (server components only — no client island), TypeScript, Tailwind v4, `node:test` + `node:assert/strict` via `npm test`.

**Spec:** `docs/superpowers/specs/2026-09-16-related-beans-rail-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/related-beans.ts` | **Create.** Pure. `relatedBeans(dataset, bean, limit)` → `Bean[]`. The whole relation rule: two tiers, dedupe, article filter, sort, cap. |
| `lib/related-beans.test.ts` | **Create.** 13 tests, no database — `buildDataset` over a literal `RawGarden`. |
| `components/bean-card.tsx` | **Create.** The vertical card face, server-safe, cover as a `ReactNode` slot. |
| `app/(public)/page.tsx` | **Modify** (lines 81–114). `cardRow` renders `<BeanCard>` instead of inline JSX. Rendering must not change. |
| `app/(public)/(chrome)/bean/[id]/page.tsx` | **Modify.** Compose the rail after `</article>`. |
| `lib/server-safe-source.test.ts` | **Modify** (the pinned list, ~line 48). Add `components/bean-card.tsx`. |

**Task order matters.** Task 1 (the rule) is independent. Task 2 (extraction) must land before Task 3 (the grid), because the grid renders the card Task 2 creates.

---

## Task 1: The relation rule — `lib/related-beans.ts`

**Files:**
- Create: `lib/related-beans.ts`
- Test: `lib/related-beans.test.ts`

### Context the engineer needs

`Dataset` (`lib/data.ts:319`) is a built index over the garden. The four accessors this task uses:

- `beansForPod(slug): Bean[]` — beans naming that pod in `parents`, in garden order.
- `plantForBean(slug): Plant | null` — a direct `plant:` parent wins; otherwise it climbs through the first resolvable pod (`lib/data.ts:446`). So a bean parented **only** to a pod still finds its plant.
- `sproutsForBean(slug): Sprout[]` — **already newest-first** (`buildDataset` sorts with `byDateDesc`).
- `getBean(slug)`, `getPods()`, etc.

`beansForPlantDeep(dataset, slug)` (`lib/plant-hub.ts:53`) is every bean under a plant — its own plus every pod's, deduped by slug. **Call it; do not compose it.** Its docblock names the three ways a hand-rolled rollup gets this wrong.

`articleFor(sprouts)` (`lib/article.ts`) returns the first sprout whose `content` resolves non-blank, or `null`. It expects newest-first input, which `sproutsForBean` already guarantees.

`parentsWithPrefix(parents, prefix)` (`lib/data.ts:348`) strips the prefix off matching refs. `POD_PREFIX` is `"pod:"`.

`resolveText(text, lang?)` defaults to English when `lang` is omitted.

- [ ] **Step 1: Write the failing test**

Create `lib/related-beans.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDataset, type RawGarden, type Bean } from "./data";
import { relatedBeans } from "./related-beans";

/** A sprout carrying real content, so `articleFor` answers for its bean. */
function written(slug: string, bean: string, date: string) {
  return {
    slug,
    name: slug,
    type: "note",
    date,
    description: "",
    parents: [`bean:${bean}`],
    content: `# ${slug}\n\nBody.`,
  };
}

/** A sprout with NO content — present, dated, and invisible to `articleFor`. */
function blank(slug: string, bean: string, date: string) {
  return { slug, name: slug, type: "note", date, description: "", parents: [`bean:${bean}`] };
}

const garden: RawGarden = {
  // `natures`, `role` and `description` are REQUIRED on Plant (lib/data.ts:107)
  // — `role` deliberately so, per its own comment. tsc catches an omission.
  plants: [
    {
      slug: "paulopus",
      name: "Paulopus",
      natures: ["work"],
      role: { kind: "owner" },
      description: "",
    },
    {
      slug: "other-plant",
      name: "Other",
      natures: ["work"],
      role: { kind: "owner" },
      description: "",
    },
  ],
  pods: [
    { slug: "karma", name: "Karma", description: "", parents: ["plant:paulopus"] },
    { slug: "atlas", name: "Atlas", description: "", parents: ["plant:paulopus"] },
    { slug: "far", name: "Far", description: "", parents: ["plant:other-plant"] },
  ],
  beans: [
    { slug: "here", name: "Here", parents: ["pod:karma"] },       // the bean being read
    { slug: "sib-old", name: "Sib Old", parents: ["pod:karma"] },  // pod sibling, older
    { slug: "sib-new", name: "Sib New", parents: ["pod:karma"] },  // pod sibling, newer
    { slug: "cousin", name: "Cousin", parents: ["pod:atlas"] },    // same plant, other pod
    { slug: "direct", name: "Direct", parents: ["plant:paulopus"] }, // same plant, no pod
    { slug: "stranger", name: "Stranger", parents: ["pod:far"] },  // other plant entirely
  ],
  sprouts: [
    written("s-here", "here", "2026-01-01"),
    written("s-sib-old", "sib-old", "2020-01-01"),
    written("s-sib-new", "sib-new", "2024-01-01"),
    written("s-cousin", "cousin", "2026-06-01"),   // NEWER than both pod siblings
    written("s-direct", "direct", "2025-01-01"),
    written("s-stranger", "stranger", "2026-09-01"),
  ],
};

function slugsFor(raw: RawGarden, beanSlug: string, limit?: number): string[] {
  const ds = buildDataset(raw);
  const bean = ds.getBean(beanSlug)!;
  return relatedBeans(ds, bean, limit).map((b: Bean) => b.slug);
}

test("pod siblings come before plant beans, even when a plant bean is newer", () => {
  // cousin (2026-06) is newer than sib-new (2024) and sib-old (2020), and still
  // sorts below both: the tier is the first key, the date only the second.
  assert.deepEqual(slugsFor(garden, "here"), ["sib-new", "sib-old", "cousin", "direct"]);
});

test("the bean being read never appears in its own rail", () => {
  assert.ok(!slugsFor(garden, "here").includes("here"));
});

test("a bean under another plant is never related", () => {
  assert.ok(!slugsFor(garden, "here").includes("stranger"));
});

test("within a tier, newest article first", () => {
  const out = slugsFor(garden, "here");
  assert.deepEqual(out.slice(0, 2), ["sib-new", "sib-old"]);
});

test("a bean with no sprout carrying content is excluded", () => {
  const raw: RawGarden = {
    ...garden,
    sprouts: [written("s-here", "here", "2026-01-01"), blank("s-sib-new", "sib-new", "2024-01-01")],
  };
  assert.deepEqual(slugsFor(raw, "here"), []);
});

test("a bean with no sprouts at all is excluded", () => {
  const raw: RawGarden = { ...garden, sprouts: [written("s-here", "here", "2026-01-01")] };
  assert.deepEqual(slugsFor(raw, "here"), []);
});

test("a bean in two pods contributes both sibling sets, once each", () => {
  const raw: RawGarden = {
    ...garden,
    beans: [...garden.beans!, { slug: "both", name: "Both", parents: ["pod:karma", "pod:atlas"] }],
    sprouts: [...garden.sprouts!, written("s-both", "both", "2026-07-01")],
  };
  const out = slugsFor(raw, "both");
  // Siblings from BOTH pods, each listed once, newest-first across the merged
  // tier — cousin (2026-06) and here (2026-01) are karma's and atlas's, and
  // "both" itself is absent. `direct` is the plant tier topping up behind them.
  assert.deepEqual(out, ["cousin", "here", "sib-new", "sib-old", "direct"]);
});

test("a bean parented to both a pod and that pod's plant appears once", () => {
  const raw: RawGarden = {
    ...garden,
    beans: garden.beans!.map((b) =>
      b.slug === "cousin" ? { ...b, parents: ["pod:atlas", "plant:paulopus"] } : b,
    ),
  };
  const out = slugsFor(raw, "here");
  assert.equal(out.filter((s) => s === "cousin").length, 1);
});

test("the rail caps at the limit", () => {
  assert.equal(slugsFor(garden, "here", 2).length, 2);
  assert.deepEqual(slugsFor(garden, "here", 2), ["sib-new", "sib-old"]);
});

test("equal article dates tie-break by English name, then slug", () => {
  const raw: RawGarden = {
    ...garden,
    beans: [
      { slug: "here", name: "Here", parents: ["pod:karma"] },
      { slug: "z-bean", name: "Alpha", parents: ["pod:karma"] },
      { slug: "a-bean", name: "Beta", parents: ["pod:karma"] },
    ],
    sprouts: [
      written("s-here", "here", "2026-01-01"),
      written("s-z", "z-bean", "2025-05-05"),
      written("s-a", "a-bean", "2025-05-05"),
    ],
  };
  // Same date: NAME decides, so "Alpha" (slug z-bean) precedes "Beta" (slug a-bean).
  assert.deepEqual(slugsFor(raw, "here"), ["z-bean", "a-bean"]);
});

test("a bean parented straight to a plant still gets the plant tier", () => {
  // "direct" has no pod, so tier 1 is empty and the whole rail is tier 2 —
  // every other written bean under paulopus, newest article first.
  assert.deepEqual(slugsFor(garden, "direct"), ["cousin", "here", "sib-new", "sib-old"]);
});

test("a bean whose pod has no plant gets pod siblings only", () => {
  const raw: RawGarden = {
    ...garden,
    pods: [{ slug: "karma", name: "Karma", description: "" }], // no plant parent
  };
  // atlas and far are gone with their beans' pod refs dangling, so only the
  // karma siblings remain — and no plant tier to top up from.
  assert.deepEqual(slugsFor(raw, "here"), ["sib-new", "sib-old"]);
});

test("a standalone bean gets nothing", () => {
  const raw: RawGarden = {
    ...garden,
    beans: [{ slug: "lonely", name: "Lonely", parents: [] }, ...garden.beans!],
    sprouts: [...garden.sprouts!, written("s-lonely", "lonely", "2026-01-01")],
  };
  assert.deepEqual(slugsFor(raw, "lonely"), []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- --test-name-pattern="pod siblings come before"
```

Expected: FAIL — `Cannot find module './related-beans'`.

- [ ] **Step 3: Write the implementation**

Create `lib/related-beans.ts`:

```ts
import {
  POD_PREFIX,
  parentsWithPrefix,
  resolveText,
  type Bean,
  type Dataset,
} from "./data";
import { beansForPlantDeep } from "./plant-hub";
import { articleFor } from "./article";

/**
 * What to read next, at the end of a bean — pod siblings first, topped up from
 * the plant.
 *
 * Pure and JSX-free, beside `lib/lineage.ts` and `lib/admin-nav.ts`, for the
 * same reason: the component is rendered, this is arithmetic, and arithmetic is
 * what `npm test` can reach without a database.
 *
 * THE GARDEN IS A PARAMETER, never loaded here — `lib/lineage.ts`'s rule,
 * verbatim. The page decides which dataset it hands over, so privacy stays a
 * page's decision rather than this file's: the public bean page passes
 * `getPublicDataset()`, `filterPublic` has already dropped every private bean,
 * pod and plant upstream, and there is NO second check here. One projection,
 * one place — and nothing a future admin caller would have to remember to
 * switch off.
 */

/**
 * A candidate, carrying the date it sorts by so `articleFor` is called once per
 * bean rather than once per comparison.
 */
interface Candidate {
  bean: Bean;
  date: string;
}

/**
 * Newest article first; ties by English name, then by slug.
 *
 * The tie-break is TWO keys deep rather than one, and that is not belt and
 * braces: two beans can carry articles dated the same day, and `Dataset`'s
 * arrays are in garden order — which is Mongo's. Without the tail the rail
 * reshuffles itself between two visits with nothing in the garden having
 * changed, the hazard `lib/plant-hub.ts`'s `byName` and `lib/screens.ts`'s
 * capture-run sort both already name.
 *
 * `resolveText` with no `lang` resolves to English, exactly as `byName` does,
 * so the ORDER is English-name order for every reader while the CONTENTS are
 * resolved per-reader by the page. That asymmetry is deliberate: a per-language
 * sort would let the `slice(0, limit)` below keep a different six beans for a
 * French reader than for an English one.
 */
function byNewestThenName(a: Candidate, b: Candidate): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return (
    resolveText(a.bean.name).localeCompare(resolveText(b.bean.name)) ||
    a.bean.slug.localeCompare(b.bean.slug)
  );
}

export function relatedBeans(dataset: Dataset, bean: Bean, limit = 6): Bean[] {
  // Tier 1: every pod this bean names, unioned. The union is not defensive — a
  // bean may name two pods, and both sets of siblings are genuinely related.
  const podTier = new Map<string, Bean>();
  for (const podSlug of parentsWithPrefix(bean.parents, POD_PREFIX)) {
    for (const sibling of dataset.beansForPod(podSlug)) {
      podTier.set(sibling.slug, sibling);
    }
  }

  // Tier 2: everything under the plant. `plantForBean` climbs THROUGH the pod,
  // so the common case — a bean parented only to a pod — still finds its plant.
  // `beansForPlantDeep` is called rather than composed: that is what inherits
  // its dedupe of a bean parented to both a pod and that pod's plant.
  const plantTier = new Map<string, Bean>();
  const plant = dataset.plantForBean(bean.slug);
  if (plant) {
    for (const candidate of beansForPlantDeep(dataset, plant.slug)) {
      if (!podTier.has(candidate.slug)) plantTier.set(candidate.slug, candidate);
    }
  }

  // A candidate survives only if it has something to read — and the test is the
  // SAME function the bean page renders by (`lib/article.ts`), not a second one
  // that happens to agree. The rail therefore cannot promise a read the
  // destination will not give.
  const readable = (beans: Iterable<Bean>): Candidate[] => {
    const out: Candidate[] = [];
    for (const candidate of beans) {
      if (candidate.slug === bean.slug) continue;
      const article = articleFor(dataset.sproutsForBean(candidate.slug));
      if (article) out.push({ bean: candidate, date: article.date });
    }
    return out.sort(byNewestThenName);
  };

  // Pod tier ahead of plant tier, ALWAYS — a pod sibling outranks every plant
  // bean however old. Sorting the concatenation by date instead (one key rather
  // than two tiers) reads as a simplification and passes any test that only
  // counts the rail's length, while quietly making a pod's own siblings
  // invisible inside a twenty-bean plant.
  return [...readable(podTier.values()), ...readable(plantTier.values())]
    .slice(0, limit)
    .map((c) => c.bean);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test 2>&1 | tail -20
```

Expected: all `lib/related-beans.test.ts` tests pass, and no previously-passing test breaks.

- [ ] **Step 5: Typecheck and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add lib/related-beans.ts lib/related-beans.test.ts
git commit -m "Answer what to read next, at the end of a bean

Pod siblings first, topped up from the plant, and never a bean with
nothing written under it. The garden is a parameter, so privacy stays
the page's decision.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Draw the card once — `components/bean-card.tsx`

**Files:**
- Create: `components/bean-card.tsx`
- Modify: `app/(public)/page.tsx` (lines 81–114, plus the import block)
- Modify: `lib/server-safe-source.test.ts` (the pinned list, ~line 48)

### Context the engineer needs

`app/(public)/page.tsx` currently draws this card inline inside `cardRow`. It is about to have a second caller, so it moves into one file — CLAUDE.md's shared-surfaces rule: *if two surfaces draw the same thing, they draw it from the same file, and what differs is a parameter.*

**The cover is a SLOT (`ReactNode`), not a `BeanCover` value.** `components/entity-card.tsx` does exactly this and its docblock says why: `components/bean-cover.tsx` is server-**only** (it reaches `lib/data`, which opens with `node:fs`), so a card that drew the cover itself could never be imported anywhere a card might one day be wanted. The slot costs one prop and keeps that door open. This is the difference between server-*safe* and server-*only*, and it is the whole reason this file can be added to the pinned list at all.

**This is a pure extraction.** The landing page's rendered output must not change — same classes, same nesting, same comments carried across. That is the acceptance test for this task.

- [ ] **Step 1: Write the failing test**

`lib/server-safe-source.test.ts` is the test for this file. Add the new path to its pinned list — find the line `"components/bean-cover.tsx",` (~line 47) and insert **above** it:

```ts
  "components/bean-card.tsx",
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- --test-name-pattern="server-safe" 2>&1 | tail -20
```

Expected: FAIL — the test reads each pinned path off disk and `components/bean-card.tsx` does not exist yet (`ENOENT`).

- [ ] **Step 3: Write the implementation**

Create `components/bean-card.tsx`:

```tsx
import type { ReactNode } from "react";

/**
 * The landing row's card face, drawn once.
 *
 * It had one caller and inline JSX in `app/(public)/page.tsx` until the related
 * rail wanted the same card at the end of a bean. Two drawings of one card is
 * the thing CLAUDE.md's shared-surfaces rule exists to stop, so it moved here
 * before it ever became two: one geometry, and what differs is a parameter.
 *
 * The cover arrives as a SLOT rather than as a cover value, exactly as
 * `components/entity-card.tsx` takes its `coverArt`, and for that file's
 * reason. `components/bean-cover.tsx` is server-ONLY — it reaches `lib/data`,
 * which opens with `node:fs` — so a card that drew the cover itself could never
 * be imported anywhere a card might one day be wanted. Handing the frame's
 * contents in from outside costs one prop and is what keeps THIS file
 * server-safe, which is what puts it in `lib/server-safe-source.test.ts`.
 *
 * What it owns is the FRAME and the text beneath it. The card's WIDTH belongs
 * to the caller and is not optional decoration: `components/bean-cover.tsx`
 * reckons the phone's rise in pixels off a 224x168 frame (`top-[58px]` is
 * 168 - 110), so both callers place this in a 224px box — the landing page's
 * `w-56` track cell, the rail's fixed 14rem grid track. A fluid cell here would
 * silently walk the phone off its geometry.
 */
export function BeanCard({
  href,
  title,
  description,
  coverArt,
}: {
  href: string;
  title: string;
  /** One muted line, never markdown: descriptions are one-liners, content is
   *  not (spec §5). Blank renders nothing rather than an empty line. */
  description?: string;
  /** What goes INSIDE the cover frame, composed by the caller — `<BeanCover>`
   *  in both zones today. Absent renders the bare `bg-muted` frame, which is
   *  what a bean with no cover has always shown. */
  coverArt?: ReactNode;
}) {
  return (
    <a href={href} className="group flex flex-col gap-3">
      {/* `overflow-hidden` is what clips the departing word on its way
          out and crops the phone at the bottom; `relative` is
          belt-and-braces since the phone branch establishes its own
          positioning context. A null cover renders nothing here, so a
          bean or pod with no cover simply shows this bare `bg-muted`
          frame, like any other entry. */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
        {coverArt}
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-heading text-sm tracking-tight underline-offset-4 group-hover:underline">
          {title}
        </span>
        {description?.trim() ? (
          <span className="text-xs leading-relaxed text-muted-foreground">{description}</span>
        ) : null}
      </div>
    </a>
  );
}
```

- [ ] **Step 4: Point the landing page at it**

In `app/(public)/page.tsx`, add to the import block (after the `BeanCover as BeanCoverArt` import):

```tsx
import { BeanCard } from "@/components/bean-card";
```

Then replace lines 81–114 (the whole `cardRow` arrow function, from `const cardRow = (entries: Entry[]) => (` through its closing `);`) with:

```tsx
  const cardRow = (entries: Entry[]) => (
    <div className="no-scrollbar overflow-x-auto overscroll-x-none pb-2">
      <ul className={`flex w-max gap-4 ${GUTTER}`}>
        {entries.map((entry) => (
          // w-56 is 224px, and components/bean-cover.tsx derives its phone
          // geometry from that number — widen the card and the numbers in
          // that file need revisiting.
          <li key={entry.key} className="w-56 shrink-0">
            <BeanCard
              href={entry.href}
              title={entry.title}
              description={entry.description}
              coverArt={<BeanCoverArt cover={entry.cover} lang={lang} />}
            />
          </li>
        ))}
      </ul>
    </div>
  );
```

Leave the block comment above `const cardRow` (lines 68–80) exactly where it is — it describes the full-bleed scroller, which stays here.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm test 2>&1 | tail -20 && npx tsc --noEmit && npm run lint
```

Expected: all tests pass (including the server-safe list now finding the file), tsc clean, lint clean.

- [ ] **Step 6: Verify the landing page renders identically**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds. Then start the dev server and look at `/`:

```bash
npm run dev
```

Check the landing page: the card tracks scroll horizontally, covers render, and **hovering a card with a phone cover still lifts the phone and slides the keyword up and out**. That hover is `group-hover` on the anchor `BeanCard` now owns — if it stopped working, the `group` class did not come across.

- [ ] **Step 7: Commit**

```bash
git add components/bean-card.tsx "app/(public)/page.tsx" lib/server-safe-source.test.ts
git commit -m "Draw the landing card from one file

It is about to have a second caller at the end of a bean, so it moves
before it becomes two drawings of one card. The cover arrives as a slot,
which is what keeps the file server-safe while the art it frames is not.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: The rail — `app/(public)/(chrome)/bean/[id]/page.tsx`

**Files:**
- Modify: `app/(public)/(chrome)/bean/[id]/page.tsx`

### Context the engineer needs

The page already loads `getPublicDataset()` and holds `bean`, `lang` and `data`. Everything the rail needs is in scope; nothing new is fetched.

`beanCoverFor(bean, sprouts)` (`lib/bean-cover.ts`) answers *what treatment* a cover gets — including the phone branch. `sproutsForBean` is already newest-first, which is the ordering it expects.

**The grid's tracks are fixed at `14rem` (224px), not fluid.** `components/bean-cover.tsx` reckons its phone geometry in pixels off a 224×168 frame and says so outright. `READING_COLUMN` is 768px minus 24px of gutter each side = 720px of content; `floor((720 + 16) / (224 + 16))` = 3 across, using 704 of 720. A 375px phone gives one card at the same 224px the landing row already shows there.

**The rail goes after `</article>`**, because it is not part of the article.

**Zero candidates renders nothing at all** — no heading, no border. An absent rail is a statement about the garden; an empty one is a component that failed.

- [ ] **Step 1: Add the imports**

In `app/(public)/(chrome)/bean/[id]/page.tsx`, add to the import block:

```tsx
import { relatedBeans } from "@/lib/related-beans";
import { beanCoverFor } from "@/lib/bean-cover";
import { BeanCard } from "@/components/bean-card";
import { BeanCover } from "@/components/bean-cover";
```

- [ ] **Step 2: Compose the rail**

After the `const lineage = resolveLineage(...)` block and before the `return (`, add:

```tsx
  // From the same FILTERED dataset the rest of the page reads, so a private
  // sibling is simply absent — `relatedBeans` runs no privacy check of its own
  // and must not grow one (lib/related-beans.ts says why).
  const related = relatedBeans(data, bean);
```

Then, immediately after the closing `</article>` tag and before the closing `</>`, add:

```tsx
      {/* Zero is NO rail — no heading, no border, no empty box under the word
          "Keep reading". A standalone bean reaches this, and so does the first
          bean written under a new plant. An absent rail is a statement about
          the garden; an empty one is a component that failed. */}
      {related.length > 0 ? (
        <nav aria-label="Keep reading" className="mt-16 flex flex-col gap-6 border-t pt-8">
          {/* The pod page's "Inside" treatment, verbatim — the footer matches
              the only other index in the zone rather than inventing a second.
              English regardless of the language switch, as every other piece of
              UI chrome in this zone is (the lineage chrome's Plants/Pods/Beans,
              the pod page's Inside). Recorded in the spec as an inconsistency
              the zone already carries, not one this rail introduces. */}
          <h2 className="font-heading text-xs uppercase tracking-widest text-muted-foreground">
            Keep reading
          </h2>
          {/* Fixed 14rem tracks, never fluid: components/bean-cover.tsx reckons
              the phone's rise in pixels off a 224x168 frame (`top-[58px]` is
              168 - 110), so a fluid cell would walk the phone off its geometry
              with nothing failing anywhere. 720px of reading column gives three
              across; a phone gives one, at the same 224px the landing row
              already shows there. */}
          <ul className="grid grid-cols-[repeat(auto-fill,14rem)] gap-4">
            {related.map((sibling) => (
              <li key={sibling.slug}>
                <BeanCard
                  href={`/bean/${sibling.slug}`}
                  title={resolveText(sibling.name, lang)}
                  description={resolveText(sibling.description ?? "", lang)}
                  coverArt={
                    <BeanCover
                      cover={beanCoverFor(sibling, data.sproutsForBean(sibling.slug))}
                      lang={lang}
                    />
                  }
                />
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
```

- [ ] **Step 3: Extend the page's docblock**

The file's existing docblock explains what the page shows. Append a paragraph before its closing `*/`:

```
 * The rail beneath it is `lib/related-beans.ts` — pod siblings first, topped up
 * from the plant, and never a bean with nothing written under it. It draws
 * `components/bean-card.tsx`, the landing page's own card, which is why its
 * grid tracks are fixed at 224px rather than fluid: the phone treatment inside
 * that frame is reckoned in pixels.
```

- [ ] **Step 4: Verify it typechecks, lints and tests**

```bash
npx tsc --noEmit && npm run lint && npm test 2>&1 | tail -10
```

Expected: all clean.

- [ ] **Step 5: Verify it renders**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds. Then `npm run dev` and open a bean that has siblings — a bean under a pod with other written beans. Check:

1. The rail appears after the article, under a `Keep reading` heading with a rule above it.
2. Three cards per row at a wide window; one on a narrow one.
3. Covers render, and a phone cover still lifts on hover.
4. **Open a bean with no siblings** (a standalone bean, or one whose plant has nothing else written) — no heading, no border, nothing.
5. **Disable JavaScript and reload.** Every card is still there and every card still navigates: the rail is server HTML with no island.

- [ ] **Step 6: Commit**

```bash
git add "app/(public)/(chrome)/bean/[id]/page.tsx"
git commit -m "End a bean with somewhere to go next

Up to six other beans after the article — pod siblings first, topped up
from the plant. Server HTML, no island: six anchors that navigate with
script off.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Open the PR

**Files:** none — this is the handoff.

- [ ] **Step 1: Run the full gate**

```bash
npx tsc --noEmit && npm run lint && npm test 2>&1 | tail -5 && npm run build 2>&1 | tail -5
```

Expected: all four clean. Do not open the PR on a failure.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin related-beans-rail
```

Then open a PR whose body includes a **Lab Note** — this is a visitor-facing change, so CLAUDE.md requires one:

```markdown
## Lab Note

```yaml
en:
  title: Something to read next
  summary: Finish an article and you'll now find a few more at the bottom of the page — other pieces from the same collection first, then whatever else is worth a look nearby.
fr:
  title: La suite, juste en dessous
  summary: Tu finis un article ? Tu trouveras maintenant quelques autres lectures en bas de page — d'abord celles de la même collection, puis ce qui vaut le détour juste à côté.
suggested:
  molecule: ariko
  type: feature
  tags: [changelog]
```
```

End the PR description with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Notes for the reviewer

Three things in this slice pass `tsc`, `npm test` and `npm run build` while quietly becoming false, so they are what to look at:

1. **The two tiers are concatenated, not merged.** Pod siblings outrank every plant bean however old. Collapsing this into one date sort is the tempting simplification and turns the rail into "everything under the plant".
2. **The grid tracks are fixed at 14rem.** Making them `minmax(14rem, 1fr)` reads as a responsive improvement and walks the phone cover off the pixel geometry `components/bean-cover.tsx` documents.
3. **`relatedBeans` takes the dataset as a parameter and runs no privacy check.** That is correct precisely because the page passes the filtered dataset. Adding a `visibility` check inside it would be a second projection that can drift from `filterPublic`; loading the garden inside it would be worse.
