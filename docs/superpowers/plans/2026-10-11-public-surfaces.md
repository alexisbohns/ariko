# The Journal's Public Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the journal model (spec `docs/superpowers/specs/2026-10-10-journal-model-design.md` §3 Public, Part B) its public face: a `/sprout/[slug]` page, a journal on the plant, pod and bean pages, one shared journal line for every surface including `/beanstalk`, and the deletion of the article fallback with the related-beans rail given a date source of its own.

**Architecture:** One server-safe component, `components/journal.tsx`, draws a journal line everywhere (the shared-surfaces rule: if two pages draw the same thing, they draw it from one file). The pages differ only in which entries they hand it: `/beanstalk` the whole timeline plus exhibited pollen, the plant page its own entries plus its own pollen, the pod and bean pages their entries alone. A sprout line links to `/sprout/[slug]`, a new `force-dynamic` server page that reads the public dataset like its siblings and 404s for anything `filterPublic` dropped. `lib/article.ts` is deleted: a bean's narrative is its own `content` and nothing else, and `lib/related-beans.ts` dates a candidate by the newest journal entry about it.

**Tech Stack:** Next.js 15 App Router (server components, `force-dynamic`), React 19, TypeScript, `node:test` + `node:assert/strict`, `react-dom/server` `renderToStaticMarkup` for component tests. Public zone rules from `CLAUDE.md` §"Script, by zone" apply to every file here: no `"use client"`, no `lucide-react`, no `next/link`, no `node:` imports, every page reads script-off.

---

## Before you start

Work in a scratchpad worktree, never in `/Users/alexis/code/ariko` (Alexis's dev server shares its `.next`). The worktree for this plan is `scratchpad/wt-public-surfaces`, branch `journal/public-surfaces`, off `main`. `node_modules` is a symlink there; `npm test`, `npx tsc --noEmit`, `npx eslint .` all work.

Run one test file: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test <file>`. Run everything: `npm test`. No DB test changes in this plan, so `npm run test:db` is a final gate only.

Vocabulary you will meet, all in `lib/data.ts`:

- `Sprout { slug, name, kind, date, description, about?, parents?, content?, media?, links?, tags? }` — a dated journal entry. `about` holds `"pod:…"` / `"bean:…"` refs; `parents` holds one `"plant:…"` ref only when `about` is empty.
- `TimelineEntry { sprout, bean, plant }` — the sprout, its first existing about-bean (or null) and its DERIVED plant (or null). `Dataset.timelineSprouts()` returns them all newest-first.
- `Dataset.sproutsForBean / sproutsForPod / sproutsForPlant` — `Sprout[]`, newest-first. Part A added the last two with no caller; this plan is their caller.
- `filterPublic(raw)` then `buildDataset(pub)` — `getPublicDataset()` in `lib/garden-cache.ts` does both behind Next's Data Cache. Every public page reads that and runs no privacy check of its own.
- `lib/beanstalk.ts` — `BeanstalkEntry` (a sprout line or a pollen line), `mergeBeanstalk(timelineEntries, pollen, keptBeanSlugs)` newest-first, `exhibitedPollen(pollen, exhibit, publicPlantSlugs)`, `plantSlugOf(entry)`.

---

### Task 1: `Dataset.entryForSprout`

The sprout page needs one sprout WITH its derived plant and first bean. The timeline already computes both; expose the lookup rather than re-deriving.

**Files:**
- Modify: `lib/data.ts` (the `Dataset` interface around line 373 and `buildDataset` around line 581–618)
- Create: `lib/journal-dataset.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/journal-dataset.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDataset, type RawGarden } from "./data";

// The smallest garden with both anchor shapes: an entry ABOUT a bean under a
// pod under a plant, and a plant-level entry with no `about`.
const garden: RawGarden = {
  plants: [{ slug: "p", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" }],
  pods: [{ slug: "pod", name: "Pod", description: "", parents: ["plant:p"] }],
  beans: [{ slug: "b", name: "B", parents: ["pod:pod"] }],
  sprouts: [
    { slug: "s1", name: "S1", kind: "log", date: "2026-01-02", description: "", about: ["bean:b"] },
    { slug: "s2", name: "S2", kind: "release", date: "2026-01-01", description: "", parents: ["plant:p"] },
  ],
};

test("entryForSprout: the sprout, its first about-bean and its derived plant", () => {
  const e = buildDataset(garden).entryForSprout("s1");
  assert.equal(e?.sprout.slug, "s1");
  assert.equal(e?.bean?.slug, "b");
  assert.equal(e?.plant?.slug, "p");
});

test("entryForSprout: a plant-level entry has no bean and keeps its plant", () => {
  const e = buildDataset(garden).entryForSprout("s2");
  assert.equal(e?.bean, null);
  assert.equal(e?.plant?.slug, "p");
});

test("entryForSprout: an unknown slug is undefined, not a throw", () => {
  assert.equal(buildDataset(garden).entryForSprout("nope"), undefined);
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/journal-dataset.test.ts`
Expected: tsx type error or `TypeError: ...entryForSprout is not a function`.

- [ ] **Step 3: Add the method**

In the `Dataset` interface, directly after `timelineSprouts(): TimelineEntry[];`:

```ts
  /** One sprout's timeline entry — the sprout, its first about-bean and its
   *  DERIVED plant — or undefined. The public sprout page reads this rather
   *  than re-deriving the plant: `resolveSproutPlant` stays the one derivation. */
  entryForSprout(slug: string): TimelineEntry | undefined;
```

In `buildDataset`, directly after `timeline.sort((a, b) => byDateDesc(a.sprout, b.sprout));`:

```ts
  const entryBySlug = new Map(timeline.map((e) => [e.sprout.slug, e] as const));
```

and in the returned object, after `timelineSprouts: () => timeline,`:

```ts
    entryForSprout: (slug) => entryBySlug.get(slug),
```

- [ ] **Step 4: Run the test, then the whole suite**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/journal-dataset.test.ts`
Expected: 3 pass.
Run: `npx tsc --noEmit && npm test 2>&1 | tail -5`
Expected: tsc clean; every test passes (any test building a fake `Dataset` literal by hand will fail tsc here — add `entryForSprout: () => undefined` to such a literal).

- [ ] **Step 5: Commit**

```bash
git add lib/data.ts lib/journal-dataset.test.ts
git commit -m "Dataset.entryForSprout: one sprout with its derived plant and first bean"
```

---

### Task 2: `publicSproutHref` and `entriesAbout` in `lib/beanstalk.ts`

Two pure helpers: the sprout's public address, spelled once; and the beanstalk lines for a page's own `Sprout[]`, so a pod or bean journal is the beanstalk narrowed rather than a second rendering.

**Files:**
- Modify: `lib/beanstalk.ts`
- Modify: `lib/beanstalk.test.ts`

- [ ] **Step 1: Write the failing tests** (append to `lib/beanstalk.test.ts`)

```ts
import { entriesAbout, publicSproutHref } from "./beanstalk";
import type { Sprout } from "./data";

test("publicSproutHref: /sprout/<slug>, URL-encoded", () => {
  assert.equal(publicSproutHref("felina-0"), "/sprout/felina-0");
  assert.equal(publicSproutHref("a b"), "/sprout/a%20b");
});

test("entriesAbout: the timeline narrowed to the given sprouts, order kept, no pollen", () => {
  const timeline = [sproutEntry("new", "2026-03-01"), sproutEntry("mid", "2026-02-01"), sproutEntry("old", "2026-01-01")];
  const mine: Sprout[] = [timeline[2].sprout, timeline[0].sprout];
  const r = entriesAbout(timeline, mine);
  assert.deepEqual(
    r.map((e) => (e.type === "sprout" ? e.entry.sprout.slug : "pollen")),
    ["new", "old"],
  );
});

test("entriesAbout: no sprouts, no lines", () => {
  assert.deepEqual(entriesAbout([sproutEntry("x", "2026-01-01")], []), []);
});
```

Merge the two new `import` lines into the file's existing imports (one `import … from "./beanstalk"`, one `import type { … } from "./data"`) rather than leaving duplicates — eslint's `no-duplicate-imports` is on.

- [ ] **Step 2: Run, expect failure**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/beanstalk.test.ts`
Expected: fails on the missing exports.

- [ ] **Step 3: Implement** (append to `lib/beanstalk.ts`; add `type Sprout` to the `./data` import)

```ts
// The public address of a sprout, spelled ONCE. `lib/lineage.ts`'s PUBLIC_HREFS
// stops at the bean because a sprout is never a container; the journal lines
// and the sprout page's own doors read this instead.
export function publicSproutHref(slug: string): string {
  return `/sprout/${encodeURIComponent(slug)}`;
}

// The beanstalk lines for a page's OWN sprouts — a bean's, a pod's — in the
// timeline's newest-first order and with no pollen. A pod or bean journal is
// therefore the beanstalk narrowed, drawn by the same component, rather than a
// second rendering of a `Sprout[]` that would drift from the first.
export function entriesAbout(timeline: TimelineEntry[], sprouts: Sprout[]): BeanstalkEntry[] {
  const keep = new Set(sprouts.map((s) => s.slug));
  return mergeBeanstalk(
    timeline.filter((e) => keep.has(e.sprout.slug)),
    [],
    new Set(),
  );
}
```

- [ ] **Step 4: Run the test**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/beanstalk.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/beanstalk.ts lib/beanstalk.test.ts
git commit -m "beanstalk: publicSproutHref and entriesAbout, the journal's two pure helpers"
```

---

### Task 3: `components/journal.tsx`, the one journal line

The list `/beanstalk` draws today (`app/(public)/(chrome)/beanstalk/page.tsx:66–115`) moves into a server-safe component so the plant, pod and bean pages draw the same line. The sprout line now links to `/sprout/[slug]` (every public sprout has a page after Task 5) instead of to its bean.

**Files:**
- Create: `components/journal.tsx`
- Create: `components/journal.test.tsx`
- Modify: `lib/server-safe-source.test.ts` (the `SERVER_SAFE` list)

- [ ] **Step 1: Write the failing test**

```tsx
// components/journal.test.tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { Journal } from "./journal";
import type { BeanstalkEntry } from "@/lib/beanstalk";
import type { PollenDoc } from "@/lib/pollen-sync";

// renderToStaticMarkup, no jsdom — components/screen-strip.test.tsx's route:
// a server component's static markup IS its output.

const sproutLine = (slug: string, date: string, kind: "log" | "essay" = "log"): BeanstalkEntry => ({
  type: "sprout",
  date,
  entry: {
    sprout: { slug, name: { en: `${slug} en`, fr: `${slug} fr` }, kind, date, description: "" },
    bean: null,
    plant: null,
  },
});

const pollenLine = (id: string, date: string, url?: string, beanSlug?: string): BeanstalkEntry => {
  const pollen: PollenDoc = {
    v: 1,
    id,
    at: `${date}T10:00:00Z`,
    source: "arkaik",
    kind: "shipped",
    title: `${id} title`,
    anchors: { plant: "plant:pbbls" },
    feedId: "arkaik-pbbls",
    syncedAt: "2026-08-17T00:00:00Z",
  };
  return { type: "pollen", date, pollen, ...(url ? { url } : {}), ...(beanSlug ? { beanSlug } : {}) };
};

const html = (entries: BeanstalkEntry[], heading?: string) =>
  renderToStaticMarkup(<Journal entries={entries} lang="fr" heading={heading} />);

test("no entries renders nothing at all — no heading, no empty list", () => {
  assert.equal(html([], "Journal"), "");
});

test("a sprout line links its name to /sprout/<slug> and spells its kind's word", () => {
  const out = html([sproutLine("felina-0", "2026-02-01", "essay")]);
  assert.match(out, /<a href="\/sprout\/felina-0"[^>]*>felina-0 fr<\/a>/);
  assert.match(out, /<time dateTime="2026-02-01">2026-02-01<\/time>/);
  assert.match(out, />Essay</);
});

test("a pollen line links its title to the source url and names its bean when kept", () => {
  const out = html([pollenLine("arkaik:e1", "2026-02-02", "https://x.test/e1", "pbbls-wallet")]);
  assert.match(out, /<a href="https:\/\/x\.test\/e1"[^>]*>arkaik:e1 title<\/a>/);
  assert.match(out, /<a href="\/bean\/pbbls-wallet"[^>]*>pbbls-wallet<\/a>/);
});

test("a heading, when given, is the section's h2 and the list is labelled by it", () => {
  const out = html([sproutLine("s", "2026-01-01")], "Journal");
  assert.match(out, /<h2[^>]*>Journal<\/h2>/);
  assert.match(out, /aria-label="Journal"/);
});

test("without a heading the list stands alone (the beanstalk owns its own h1)", () => {
  const out = html([sproutLine("s", "2026-01-01")]);
  assert.doesNotMatch(out, /<h2/);
  assert.doesNotMatch(out, /<section/);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test components/journal.test.tsx`
Expected: cannot find module `./journal`.

- [ ] **Step 3: Write the component**

```tsx
// components/journal.tsx
import { resolveText } from "@/lib/data";
import type { Lang } from "@/lib/locale";
import { sproutKindLabel } from "@/lib/glyphs";
import { publicSproutHref, type BeanstalkEntry } from "@/lib/beanstalk";
import { Badge } from "@/components/ui/badge";

/**
 * The journal line — one sprout or one exhibited pollen event — drawn ONCE for
 * every surface that lists growth over time: `/beanstalk` (every plant, with
 * its `?plant=` filter), a plant page (its own entries and its own pollen), a
 * pod page and a bean page (their own entries, no pollen). The pages differ in
 * WHICH entries they hand over; this file does not know which page it is on.
 * That is the shared-surfaces rule from CLAUDE.md doing its work, and why this
 * file is in `lib/server-safe-source.test.ts`: it renders under every public
 * page, so it carries no `"use client"`, no lucide, no `next/link`.
 *
 * A sprout line links to `/sprout/[slug]` — the entry's own page — never to its
 * bean: a published entry about a private bean has a page a visitor may read,
 * while its bean does not, and `filterPublic` has already scrubbed the ref.
 * A pollen line links to the source and, when the anchored bean survived the
 * projection, names it as a second, smaller door.
 *
 * Zero entries is NO journal — no heading, no border, no empty list — exactly
 * as the bean page's rail: an absent section is a statement about the garden,
 * an empty one is a component that failed.
 */
export function Journal({
  entries,
  lang,
  heading,
}: {
  entries: BeanstalkEntry[];
  lang: Lang;
  /** Set on an entity page ("Journal"); absent on `/beanstalk`, which owns its h1. */
  heading?: string;
}) {
  if (entries.length === 0) return null;

  const list = (
    <ul className="reveal-each flex flex-col gap-4" {...(heading ? { "aria-label": heading } : {})}>
      {entries.map((e) =>
        e.type === "sprout" ? (
          <li key={`sprout:${e.entry.sprout.slug}`} className="flex flex-col gap-1">
            <span className="text-base">
              <a
                href={publicSproutHref(e.entry.sprout.slug)}
                className="underline-offset-4 transition-colors hover:underline"
              >
                {resolveText(e.entry.sprout.name, lang)}
              </a>
            </span>
            <span className="flex flex-wrap items-center gap-2 font-heading text-xs text-muted-foreground">
              <time dateTime={e.entry.sprout.date}>{e.date}</time>
              <Badge variant="secondary">{sproutKindLabel(e.entry.sprout.kind)}</Badge>
            </span>
          </li>
        ) : (
          <li key={`pollen:${e.pollen.id}`} className="flex flex-col gap-1">
            <span className="text-base">
              {e.url ? (
                <a href={e.url} className="underline-offset-4 transition-colors hover:underline">
                  {resolveText(e.pollen.title, lang)}
                </a>
              ) : (
                resolveText(e.pollen.title, lang)
              )}
            </span>
            <span className="flex flex-wrap items-center gap-2 font-heading text-xs text-muted-foreground">
              <time dateTime={e.pollen.at}>{e.date}</time>
              <Badge variant="secondary">{e.pollen.kind}</Badge>
              <span>{e.pollen.source}</span>
              {e.beanSlug ? (
                <a
                  href={`/bean/${encodeURIComponent(e.beanSlug)}`}
                  className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {e.beanSlug}
                </a>
              ) : null}
            </span>
          </li>
        ),
      )}
    </ul>
  );

  if (!heading) return list;

  // The entity pages' section shape — the pod page's "Inside" heading,
  // verbatim, so the journal reads as the second index on the page rather than
  // a new kind of thing. English regardless of the language switch, as every
  // piece of UI chrome in this zone is.
  return (
    <section className="reveal flex flex-col gap-4 border-t pt-6">
      <h2 className="font-heading text-xs uppercase tracking-widest text-muted-foreground">{heading}</h2>
      {list}
    </section>
  );
}
```

- [ ] **Step 4: Add it to the server-safe list**

In `lib/server-safe-source.test.ts`, in `SERVER_SAFE`, directly after `"components/screen-strip.tsx",`:

```ts
  "components/journal.tsx", // the journal line: /beanstalk, plant, pod, bean (Part B)
```

- [ ] **Step 5: Run both tests**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test components/journal.test.tsx lib/server-safe-source.test.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add components/journal.tsx components/journal.test.tsx lib/server-safe-source.test.ts
git commit -m "components/journal: the one journal line every public surface draws"
```

---

### Task 4: `/beanstalk` draws `Journal`

**Files:**
- Modify: `app/(public)/(chrome)/beanstalk/page.tsx`

- [ ] **Step 1: Replace the list**

Replace everything from the comment `{/* Each entry arrives as it reaches the fold …` through the closing `</ul>` (lines 64–115 today) with:

```tsx
      {/* Each entry arrives as it reaches the fold — the timeline is the one
          surface here long enough for that to be the whole point. No heading:
          this page's h1 IS the journal's name. */}
      <Journal entries={entries} lang={lang} />
```

Change the imports: add `import { Journal } from "@/components/journal";`; remove `import { sproutKindLabel } from "@/lib/glyphs";` (no longer used here). `Badge` stays — the `?plant=` filter row uses it.

- [ ] **Step 2: Gates**

Run: `npx tsc --noEmit && npx eslint "app/(public)/(chrome)/beanstalk/page.tsx"`
Expected: both clean (eslint would flag an unused import).

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/(chrome)/beanstalk/page.tsx"
git commit -m "/beanstalk draws the shared journal line; a sprout links to its own page"
```

---

### Task 5: `/sprout/[slug]`, the entry's own page

Kind badge, date, name, description, body with entity refs, media, links, and the "About" doors. The lineage chrome climbs from the derived plant through the about refs, built from the public dataset exactly as the bean page does. Private → `filterPublic` dropped it → `entryForSprout` is undefined → 404.

**Files:**
- Create: `app/(public)/(chrome)/sprout/[slug]/page.tsx`
- Modify: `lib/server-safe-source.test.ts`

- [ ] **Step 1: Pin it in the server-safe list first** (spec §6: "added the day it is written")

In `SERVER_SAFE`, directly after the `"components/journal.tsx"` line added in Task 3:

```ts
  // The first PAGE on this list. Every other public page is kept honest by the
  // components it imports; this one was named by the spec (journal model §6)
  // because it is the newest surface and the one most likely to grow an island.
  "app/(public)/(chrome)/sprout/[slug]/page.tsx",
```

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/server-safe-source.test.ts`
Expected: FAIL — the file does not exist yet (the test reads each path from disk).

- [ ] **Step 2: Write the page**

```tsx
// app/(public)/(chrome)/sprout/[slug]/page.tsx
import { notFound } from "next/navigation";
import { BEAN_PREFIX, PLANT_PREFIX, POD_PREFIX, aboutRefs, parentsWithPrefix, resolveText } from "@/lib/data";
import { currentLang } from "@/lib/locale-server";
import { getPublicDataset } from "@/lib/garden-cache";
import { resolveEntity } from "@/lib/entity-resolve";
import { resolveLineage, PUBLIC_HREFS } from "@/lib/lineage";
import { sproutKindLabel } from "@/lib/glyphs";
import { LineageChrome } from "@/components/lineage-chrome";
import { Prose } from "@/components/markdown";
import { MediaList } from "@/components/media";
import { LinkRow } from "@/components/link-row";
import { Badge } from "@/components/ui/badge";
import { seq } from "@/components/reveal";

export const dynamic = "force-dynamic";

/**
 * One journal entry, as a visitor reads it (journal model §3 Public): what
 * kind of entry it is, when, its name, its description, its body with entity
 * refs resolved against the public dataset, its media, its links, and the
 * doors to what it is ABOUT.
 *
 * It reads `getPublicDataset()` and runs no privacy check of its own. A
 * private sprout, or one whose derived plant is private, was dropped by
 * `filterPublic` upstream, so `entryForSprout` answers undefined and the page
 * 404s — the same shape as a private pod or bean. An entry ABOUT a private
 * bean is a different case: the entry itself is public, `filterPublic`
 * scrubbed the ref out of `about`, and the doors below simply do not include
 * it. Nothing here could name it if it tried.
 *
 * `components/media.tsx` returns to a public page here — the bean page retired
 * it with the per-sprout cards and kept the file for exactly this day (its
 * docblock says so). The sprout's `links[]` come back the same way, through
 * `LinkRow`, with the row's label naming the entry rather than a plant.
 *
 * In `lib/server-safe-source.test.ts`, the first page on that list, per the
 * spec. Progressively enhanced like every public page: every door is an `<a>`.
 */
export default async function SproutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lang = await currentLang();
  const data = await getPublicDataset();
  const entry = data.entryForSprout(slug);
  if (!entry) notFound();
  const { sprout, plant } = entry;

  // The trail: the DERIVED plant first, then whatever `about` names. `about`
  // refs are pod:/bean: and the climb fills the tiers between them. Beans are
  // looked up one by one because `Dataset` has no `getBeans()` — and needs
  // none: the trail can only name beans the entry is about.
  const about = aboutRefs(sprout);
  const beans = parentsWithPrefix(about, BEAN_PREFIX)
    .map((s) => data.getBean(s))
    .filter((b): b is NonNullable<typeof b> => b !== undefined);
  const lineage = resolveLineage(
    [...(plant ? [`${PLANT_PREFIX}${plant.slug}`] : []), ...about],
    { plants: data.getPlants(), pods: data.getPods(), beans },
    { lang, hrefs: PUBLIC_HREFS },
  );

  // The doors: each pod and bean the entry is about, as it survives the
  // projection. A plant-level entry (about empty) has one door, its plant.
  const doors: { href: string; name: string }[] = [
    ...parentsWithPrefix(about, POD_PREFIX).flatMap((s) => {
      const pod = data.getPod(s);
      return pod ? [{ href: PUBLIC_HREFS.pod(s), name: resolveText(pod.name, lang) }] : [];
    }),
    ...beans.map((b) => ({ href: PUBLIC_HREFS.bean(b.slug), name: resolveText(b.name, lang) })),
  ];
  if (doors.length === 0 && plant) {
    doors.push({ href: PUBLIC_HREFS.plant(plant.slug), name: resolveText(plant.name, lang) });
  }

  const description = resolveText(sprout.description ?? "", lang).trim();

  return (
    <>
      <LineageChrome lineage={lineage} />
      <article className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          {/* Kind and date BEFORE the name: a journal entry is read as "a
              release, on this day, called X", the order the beanstalk line
              already uses. The kind is the word from lib/glyphs.ts, the one
              place its display form is decided. */}
          <p {...seq(0, "flex flex-wrap items-center gap-2 font-heading text-xs text-muted-foreground")}>
            <Badge variant="secondary">{sproutKindLabel(sprout.kind)}</Badge>
            <time dateTime={sprout.date}>{sprout.date.slice(0, 10)}</time>
          </p>
          <h1 {...seq(1, "font-heading text-2xl font-medium tracking-tight")}>
            {resolveText(sprout.name, lang)}
          </h1>
          {description ? <p {...seq(2, "text-base text-muted-foreground")}>{description}</p> : null}
        </header>

        {/* The body — entity refs resolve against the public dataset, so
            anything hidden renders as nothing. `Prose` renders nothing for an
            absent or blank content, the same contract MediaList has. */}
        <Prose reveal lang={lang} content={sprout.content} resolve={(ref) => resolveEntity(data, ref, lang)} />

        {/* Media and links return to a public page here — see the docblock. */}
        <MediaList media={sprout.media} />

        {sprout.links && sprout.links.length > 0 ? (
          <div {...seq(6, "flex justify-center")}>
            <LinkRow links={sprout.links} lang={lang} label={`Find ${resolveText(sprout.name, lang)} elsewhere`} />
          </div>
        ) : null}

        {/* The doors — what this entry is about. The pod page's "Inside"
            shape, with its own word. */}
        {doors.length > 0 ? (
          <nav aria-label="About" className="reveal flex flex-col gap-2">
            <h2 className="font-heading text-xs uppercase tracking-widest text-muted-foreground">About</h2>
            <ul className="flex flex-col gap-1">
              {doors.map((d) => (
                <li key={d.href}>
                  <a href={d.href} className="text-sm underline-offset-4 hover:underline">
                    {d.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </article>
    </>
  );
}
```

Check `aboutRefs` and `parentsWithPrefix` are exported from `lib/data.ts` (`grep -n "export function aboutRefs\|export function parentsWithPrefix" lib/data.ts`). Both are. If `MediaList` returns null for `undefined` media (it does: `if (!media || media.length === 0) return null;`), no guard is needed around it — but it IS a flex item when it renders, which is wanted.

- [ ] **Step 3: Gates**

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/server-safe-source.test.ts && npx tsc --noEmit && npx eslint "app/(public)/(chrome)/sprout"`
Expected: all clean.

- [ ] **Step 4: Render it against the scratch database**

The worktree's `.env.local` points at PRODUCTION. Do not run the dev server against it for this check without `MONGODB_DB=beanstalk_scratch`; instead read `lib/plant-garden.test.ts` for how the DB tests seed `beanstalk_scratch`, and if a seeded scratch garden exists, run `MONGODB_DB=beanstalk_scratch npx next dev -p 3100` from the WORKTREE (never the main repo) and open `/sprout/<a published slug>` and `/sprout/nope` (expect 404). If no scratch garden is seeded, skip this step and say so in the task report — the subagent reviewer will render-check via the source tests instead.

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/(chrome)/sprout/[slug]/page.tsx" lib/server-safe-source.test.ts
git commit -m "/sprout/[slug]: a journal entry's own page — kind, date, body, media, links, about doors"
```

---

### Task 6: The plant page's journal

This plant's published entries and its exhibited pollen, merged newest-first, under the "Inside" index. Pollen is read live from `listPollen()` exactly as `/beanstalk` does; `exhibitedPollen` is given a one-plant set so only this plant's events pass.

**Files:**
- Modify: `app/(public)/(chrome)/plant/[slug]/page.tsx`

- [ ] **Step 1: Read and merge**

Add the imports:

```tsx
import { getFederation } from "@/lib/federation";
import { listPollen } from "@/lib/pollen-store";
import { exhibitedPollen, mergeBeanstalk } from "@/lib/beanstalk";
import { Journal } from "@/components/journal";
```

Change the two reads at the top of the component so the pollen read runs beside the garden read:

```tsx
  const [data, allPollen] = await Promise.all([getPublicDataset(), listPollen()]);
```

(replacing `const data = await getPublicDataset();`). After `const beans = data.beansForPlant(slug);` add:

```tsx
  // The journal (journal model §3): this plant's published entries — those
  // whose DERIVED plant is this one, `timelineSprouts` narrowed — merged with
  // its exhibited pollen, newest first. `exhibitedPollen` is handed a one-plant
  // set, so the exhibition rule (private envelope loses; the plant must be in
  // data/federation.yml's exhibit list; the plant must have survived
  // filterPublic — it has, we are on its page) admits only this plant's events.
  // The kept-bean set is every public bean, so a pollen line about a public
  // bean keeps its door: the same set /beanstalk passes.
  const mine = data.timelineSprouts().filter((e) => e.plant?.slug === slug);
  const pollen = exhibitedPollen(allPollen, getFederation().exhibit, new Set([slug]));
  const keptBeanSlugs = new Set(data.getBeans().map((b) => b.slug));
  const journal = mergeBeanstalk(mine, pollen, keptBeanSlugs);
```

Then, directly after the `Inside` `<nav>` block's closing `) : null}`, add:

```tsx
      <Journal entries={journal} lang={lang} heading="Journal" />
```

- [ ] **Step 2: `Dataset.getBeans()`**

`Dataset` has no `getBeans()` today (the bean page's docblock says so, and the beanstalk reads `pub.beans` from the raw projection instead). Add one. In `lib/data.ts`'s `Dataset` interface, after `getBean(slug: string): Bean | undefined;`:

```ts
  /** Every bean in this dataset, garden order — the kept-bean set a journal's
   *  pollen lines take their bean doors from. */
  getBeans(): Bean[];
```

and in `buildDataset`'s returned object, after the `getBean:` entry:

```ts
    getBeans: () => beans,
```

(`beans` is `buildDataset`'s local `const beans = raw.beans ?? [];` at `lib/data.ts:474`.) In `/beanstalk`, replace `const keptBeanSlugs = new Set((pub.beans ?? []).map((b) => b.slug));` with `const keptBeanSlugs = new Set(data.getBeans().map((b) => b.slug));` so the two pages spell the set the same way. Any hand-built `Dataset` literal in a test needs `getBeans: () => []`.

- [ ] **Step 3: Gates**

Run: `npx tsc --noEmit && npm test 2>&1 | tail -3 && npx eslint "app/(public)"`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add lib/data.ts "app/(public)/(chrome)/plant/[slug]/page.tsx" "app/(public)/(chrome)/beanstalk/page.tsx"
git commit -m "The plant page's journal: its entries and its exhibited pollen, newest first"
```

---

### Task 7: The pod page's journal

Entries about this pod or about any bean inside it — `Dataset.sproutsForPod` already answers that — drawn by `Journal` via `entriesAbout`. No pollen: pollen anchors to a plant and optionally a bean, never a pod.

**Files:**
- Modify: `app/(public)/(chrome)/pod/[slug]/page.tsx`

- [ ] **Step 1: Add the journal**

Imports:

```tsx
import { entriesAbout } from "@/lib/beanstalk";
import { Journal } from "@/components/journal";
```

After `const beans = data.beansForPod(slug);`:

```tsx
  // The journal (journal model §3): entries ABOUT this pod or about any bean
  // inside it, `sproutsForPod`'s exact definition, as beanstalk lines. No
  // pollen — a feed event anchors to a plant and at most a bean, never a pod.
  const journal = entriesAbout(data.timelineSprouts(), data.sproutsForPod(slug));
```

After the `Inside` `<nav>` block's `) : null}`, inside the `<article>`:

```tsx
        <Journal entries={journal} lang={lang} heading="Journal" />
```

- [ ] **Step 2: Gates and commit**

Run: `npx tsc --noEmit && npx eslint "app/(public)/(chrome)/pod"`
Expected: clean.

```bash
git add "app/(public)/(chrome)/pod/[slug]/page.tsx"
git commit -m "The pod page's journal: entries about the pod or any bean inside it"
```

---

### Task 8: The bean page's journal, and the article fallback deleted

The bean renders its own `content` and nothing else; `articleFor` and `narrativeFor` go, with `lib/article.ts` and its test. `lib/related-beans.ts` keeps admitting only a bean with something to read — now "has a narrative of its own" — and dates each candidate by the newest journal entry about it, the date source the spec says it must be given.

**Files:**
- Delete: `lib/article.ts`, `lib/article.test.ts`
- Modify: `lib/related-beans.ts`, `lib/related-beans.test.ts`
- Modify: `lib/server-safe-source.test.ts` (remove `"lib/article.ts"`)
- Modify: `lib/cover.ts` (docblock only)
- Modify: `app/(public)/(chrome)/bean/[id]/page.tsx`

- [ ] **Step 1: Update the related-beans test to the new rule**

In `lib/related-beans.test.ts`, the fixtures `written()` and `blank()` make a bean readable through a sprout's content. Under the new rule a bean is readable through ITS OWN content and dated by its newest entry. Rewrite the two helpers and the garden's beans so the existing assertions keep their meaning:

```ts
/** An entry about a bean — dated, and all a journal entry needs to be here. */
function entry(slug: string, bean: string, date: string): Sprout {
  return { slug, name: slug, kind: "log", date, description: "", about: [`bean:${bean}`] };
}

/** A bean with a narrative of its own — the ONE admission test now. */
function readable(slug: string, name: string, parents: string[]): Bean {
  return { slug, name, parents, content: `# ${name}\n\nBody.` };
}
```

Then, in the `garden` literal: every bean that the OLD fixture gave a `written()` sprout becomes `readable(...)`; every bean that only had `blank()` sprouts (or none) stays a plain `{ slug, name, parents }` literal — read the existing `sprouts:` array and the test names below it to see which is which, and keep each sprout as `entry(...)` with the same slug, bean and date so the ORDER assertions are unchanged. Delete the `written`/`blank` helpers. A test whose name says a bean "with no article" is excluded now reads "with no narrative" — rename it; its assertion stands.

Add one test that pins the new date source:

```ts
test("a candidate is dated by its newest journal entry, not by its narrative", () => {
  const g: RawGarden = {
    ...garden,
    beans: [
      readable("here", "Here", ["pod:karma"]),
      readable("a", "A", ["pod:karma"]),
      readable("b", "B", ["pod:karma"]),
    ],
    sprouts: [entry("a-old", "a", "2020-01-01"), entry("b-new", "b", "2026-01-01"), entry("a-new", "a", "2026-06-01")],
  };
  const d = buildDataset(g);
  assert.deepEqual(relatedBeans(d, d.getBean("here")!).map((b) => b.slug), ["a", "b"]);
});
```

Run: `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/related-beans.test.ts`
Expected: the new test fails (today `a` and `b`, both with own narratives, are undated and sort by name — `["a","b"]` happens to match; so ALSO assert the reverse in a second case by swapping the dates: `entry("a-old","a","2020-01-01"), entry("b-new","b","2026-06-01")` → expect `["b","a"]`). Add that second case; it fails today.

- [ ] **Step 2: Rewrite the admission in `lib/related-beans.ts`**

Replace `import { narrativeFor } from "./article";` with nothing (delete the line), and add `hasNarrative` to the `./data` import. Replace the `readable` closure's body:

```ts
  // A candidate survives only if it has something to read — its OWN narrative
  // (journal model §1.1: a bean's prose is its `content`, nothing else since
  // the article fold). Dated by the newest journal entry ABOUT it, which is
  // `sproutsForBean`'s first element (newest-first). `""` for a bean nobody has
  // written about yet — the smallest string, LAST within its tier. This is the
  // date source the spec required when the article fallback went: without it
  // every candidate is undated and the rail degrades, silently, to name order.
  const readable = (beans: Iterable<Bean>): Candidate[] => {
    const out: Candidate[] = [];
    for (const candidate of beans) {
      if (candidate.slug === bean.slug) continue;
      if (!hasNarrative(candidate.content)) continue;
      out.push({
        bean: candidate,
        date: dataset.sproutsForBean(candidate.slug)[0]?.date ?? "",
        name: resolveText(candidate.name),
      });
    }
    return out.sort(byNewestThenName);
  };
```

Update the `Candidate.date` doc comment: `"" when no entry is about the bean yet`. Update the file's docblock sentence that names `narrativeFor` ("the SAME function the bean page renders by") to: "the same test the bean page renders by — `hasNarrative(bean.content)`".

- [ ] **Step 3: Delete the article module**

```bash
git rm lib/article.ts lib/article.test.ts
```

Remove `"lib/article.ts",` from `SERVER_SAFE` in `lib/server-safe-source.test.ts`. In `lib/cover.ts`, the docblock paragraph beginning "Resolved toward this function's sibling, articleFor" — rewrite it to: "Resolved toward 'the first sprout carrying one', not 'strictly the newest': a bean whose latest entry is a text-only log keeps the cover its previous release earned." and the later "exactly as in articleFor" to "as every public reader does".

- [ ] **Step 4: The bean page**

In `app/(public)/(chrome)/bean/[id]/page.tsx`:

- Delete `import { narrativeFor } from "@/lib/article";`. Add `hasNarrative` to the `@/lib/data` import, and add `import { entriesAbout } from "@/lib/beanstalk";` and `import { Journal } from "@/components/journal";`.
- Replace `const narrative = narrativeFor(bean, data.sproutsForBean(bean.slug));` with:

```tsx
  // The journal (journal model §3): every published entry about this bean,
  // newest first, as beanstalk lines. The narrative above it is the bean's OWN
  // `content` and nothing else — the article fallback is gone with the fold.
  const journal = entriesAbout(data.timelineSprouts(), data.sproutsForBean(bean.slug));
```

- Replace the `{narrative ? (<Prose … content={narrative.content} …/>) : null}` block with:

```tsx
        {hasNarrative(bean.content) ? (
          <Prose reveal lang={lang} content={bean.content} resolve={(ref) => resolveEntity(data, ref, lang)} />
        ) : null}

        <Journal entries={journal} lang={lang} heading="Journal" />
```

- Rewrite the component docblock. Keep the paragraphs about the retired per-sprout cards and the kept renderers, but: the first paragraph becomes "its name, its description, its narrative — the bean's own `content` (journal model §1.1), nothing else — and its journal, every published entry about it"; the paragraph beginning "`sproutsForBean` therefore survives for exactly one reader" becomes "`sproutsForBean` now feeds the journal beneath the narrative; the rail's covers read it too"; and the sentence "Putting a sprout's assets back on a page is then a rendering decision, not a rebuild." gains: "— and `/sprout/[slug]` is that page."

- [ ] **Step 5: Find every other reader**

Run: `grep -rn "articleFor\|narrativeFor\|lib/article\"" --include='*.ts' --include='*.tsx' --include='*.md' . | grep -v node_modules | grep -v "docs/superpowers/specs\|docs/superpowers/plans"`
Expected: no code hits. Fix any that appear. Docs hits (README, CLAUDE.md) are Task 9's.

- [ ] **Step 6: Gates**

Run: `npx tsc --noEmit && npx eslint . && npm test 2>&1 | tail -3`
Expected: clean; the two related-beans date cases pass.

- [ ] **Step 7: Commit**

```bash
git add -A lib/related-beans.ts lib/related-beans.test.ts lib/server-safe-source.test.ts lib/cover.ts "app/(public)/(chrome)/bean/[id]/page.tsx"
git commit -m "The bean page's journal; the article fallback deleted; the rail dated by the newest entry"
```

---

### Task 9: Docs

**Files:**
- Modify: `CLAUDE.md`, `README.md`, `docs/superpowers/specs/2026-10-10-journal-model-design.md`

- [ ] **Step 1: CLAUDE.md**

In the public-zone paragraph of §"Script, by zone" that lists what the zone promises, nothing changes. In §"Rules the tests pin", find the bullet whose text mentions `articleFor` or `narrativeFor` (`grep -n "articleFor\|narrativeFor" CLAUDE.md`); rewrite each mention so it describes the present: a bean's narrative is its `content`, the related-beans rail admits a bean with a narrative and dates it by its newest journal entry. In the shared-surfaces list (the "Four things the two zones now DRAW FROM ONE FILE" bullet), add nothing — `components/journal.tsx` serves only the public zone — but in the §"Script, by zone" paragraph about `lib/server-safe-source.test.ts` add one sentence after "Add a file to it the day you write it.": "`app/(public)/(chrome)/sprout/[slug]/page.tsx` is the first PAGE on the list, per the journal spec; a page that imports only listed components is otherwise kept honest by them."

- [ ] **Step 2: README.md**

Find the public-routes section (`grep -n "/beanstalk\|/plant/\[slug\]\|/bean/\[id\]" README.md | head`). Add `/sprout/[slug]` beside its siblings with one line: "a journal entry — kind, date, name, body, media, links, and the pods and beans it is about". Add to the plant, pod and bean route lines: "…and its journal". Replace any `articleFor`/`narrativeFor` mention per `grep -n "articleFor\|narrativeFor" README.md`.

- [ ] **Step 3: The spec's Part B appendix**

In `docs/superpowers/specs/2026-10-10-journal-model-design.md`, after the Part B paragraph, add:

> Shipped by `plans/2026-10-11-public-surfaces.md`: `components/journal.tsx` is the one journal line (`/beanstalk`, plant, pod, bean), `/sprout/[slug]` is on the server-safe list, `lib/article.ts` is deleted and `lib/related-beans.ts` dates a candidate by `sproutsForBean(slug)[0]`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md docs/superpowers/specs/2026-10-10-journal-model-design.md
git commit -m "Docs: the journal's public surfaces, the sprout page on the server-safe list, the article fallback gone"
```

---

### Task 10: Final gates and the PR

- [ ] **Step 1: Everything**

Run: `npx tsc --noEmit && npx eslint . && npm test 2>&1 | tail -4 && npm run test:db 2>&1 | tail -3`
Expected: all clean. Note the test count for the PR body.

- [ ] **Step 2: Production build in the worktree** (never in the main repo)

Run: `npx next build 2>&1 | grep -E "sprout|beanstalk|plant/\[slug\]|pod/\[slug\]|bean/\[id\]|Error|error" | head`
Expected: the five routes listed as `ƒ` (dynamic), no errors. Then `rm -rf .next` in the worktree.

- [ ] **Step 3: Open the PR**

Push `journal/public-surfaces`, base `main`. Body: what changed (the five surfaces, the shared line, the deletion), the gates, a "Not in this PR" (slice three: seed → bean; slice four: manifest sprouts top-level), and a Lab Note — this is visitor-facing:

```yaml
en:
  title: Every journal entry has a page of its own now
  summary: Click any line in a project's timeline and read the whole entry — its story, its pictures, its links, and the features it is about. Every project, pod and feature page now ends with its journal.
fr:
  title: Chaque entrée du journal a maintenant sa propre page
  summary: Clique sur une ligne de la timeline d'un projet et lis l'entrée en entier — son histoire, ses images, ses liens, et les fonctionnalités dont elle parle. Chaque page de projet, de pod et de fonctionnalité se termine désormais par son journal.
suggested:
  molecule: ariko
  type: feature
  tags: [changelog, journal]
```

End the body with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## Self-review against the spec

- §3 `/plant/[slug]` "then the journal: this plant's published sprouts and its exhibited pollen merged newest-first by `mergeBeanstalk`, each line linking to `/sprout/[slug]` or the pollen source" — Task 6 + Task 3.
- §3 `/pod/[slug]` "the journal filtered to sprouts about this pod or about any bean inside it" — Task 7 via `sproutsForPod`.
- §3 `/bean/[id]` "narrative first, then the journal filtered to sprouts about it. `articleFor` and the one-article rendering are deleted. The related-beans rail … a date source of its own (the newest journal entry about each bean)" — Task 8.
- §3 `/sprout/[slug]` "kind badge, date, name, body with entity refs, media, links, and about doors. Progressively enhanced; added to `lib/server-safe-source.test.ts` the day it is written" — Task 5, list first.
- §3 `/beanstalk` "keeps its all-plants, `?plant=` form; the badge now reads `kind`" — Task 4 (the badge already read `kind` after Part A).
- §6 "`/sprout/[slug]` is in `lib/server-safe-source.test.ts`" — Task 5 step 1.
- Not here, by the spec's own words: top-level manifest sprouts and the nested-manifest refusal (slice four); seed → bean (slice three).

Type consistency: `Journal({ entries: BeanstalkEntry[]; lang: Lang; heading?: string })` in Tasks 3, 4, 6, 7, 8. `entriesAbout(timeline: TimelineEntry[], sprouts: Sprout[]): BeanstalkEntry[]` in Tasks 2, 7, 8. `publicSproutHref(slug)` in Tasks 2, 3. `Dataset.entryForSprout(slug)` in Tasks 1, 5. `Dataset.getBeans()` in Task 6 (both callers).
