# Parenting Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `top-center` chrome cluster on six entity pages that draws the entity's ancestry — `plant | pod | bean` — one item per tier, each a link to its parent or a disclosure listing several.

**Architecture:** A pure resolver (`lib/lineage.ts`) climbs the prefixed-ref grammar and returns tiers; a server-safe component (`components/lineage-chrome.tsx`) draws them inside the existing `Chrome`. The garden read and the href grammar stay with the page, so the admin and the public zone share one component and differ only in parameters.

**Tech Stack:** Next.js 15 / React 19 / TypeScript, `node --test` + `tsx` (`npm test`), `renderToStaticMarkup` for render assertions, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-13-parenting-chrome-design.md`

---

## Background an engineer needs before Task 1

**The ref grammar.** Every entity carries `parents?: string[]` holding prefixed
refs: `"plant:ariko"`, `"pod:pbbls-karma"`, `"bean:pbbls-d8"`. `lib/data.ts`
exports `PLANT_PREFIX`, `POD_PREFIX`, `BEAN_PREFIX` and
`parentsWithPrefix(parents, prefix) => string[]` (already stripped of the
prefix). A sprout's parents are beans; a bean's are pods **and/or** plants (a
bean may skip the pod tier); a pod's and a screen's are plants.

**Names are bilingual.** `name` is a `Text` (a string, or `{en, fr}`), read with
`resolveText(value, lang)` from `lib/data.ts`.

**Two zones, two href grammars.** Admin: `/admin/plant/<slug>` (built by
`hubHref` in `lib/plant-path.ts`), `/admin/pod/<slug>`, `/admin/bean/<slug>`.
Public: `/plant/<slug>`, `/pod/<slug>`, `/bean/<slug>`.

**`lib/data.ts` reaches `node:fs`.** So `components/lineage-chrome.tsx` may
import from `lib/lineage.ts` **as a type only** — the resolver itself is called
by pages, which are servers. `lib/exhibition-source.test.ts` is the precedent.

**Running one test file:** `npx tsx --test lib/lineage.test.ts` will not pick up
the repo's test tsconfig. Use:

```bash
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/lineage.test.ts
```

The whole suite is `npm test`.

---

## File structure

| File | Responsibility |
| --- | --- |
| `lib/lineage.ts` (create) | Pure: `parents[]` + a garden + href builders → `Lineage`. No JSX, no I/O. |
| `lib/lineage.test.ts` (create) | The climb, dangling refs, omitted tiers, ordering, dedup. |
| `components/public-icons.tsx` (modify) | Two new server-safe glyphs: `PodIcon`, `BeanIcon`. |
| `components/public-icons.test.tsx` (modify) | Pin the two new glyphs against lucide; teach the extractor `polyline`. |
| `components/lineage-chrome.tsx` (create) | Server-safe: draws a `Lineage` inside `Chrome`. |
| `lib/lineage-chrome-render.test.tsx` (create) | One parent → anchor named for the parent; two+ → `<details>` with real hrefs; plant `<img>` in server HTML. |
| `lib/server-safe-source.test.ts` (modify) | Add `components/lineage-chrome.tsx` to the pinned list. |
| Six page files (modify) | Build the lineage and mount the cluster. |

---

## Task 1: The lineage resolver

**Files:**
- Create: `lib/lineage.ts`
- Test: `lib/lineage.test.ts`
- Modify: `docs/superpowers/specs/2026-09-13-parenting-chrome-design.md` (the signature refinement below)

**Signature refinement vs. the spec.** The spec sketched
`resolveLineage(raw, ref)`. Two facts found while planning move it: the public
zone holds a `Dataset` (no `getBeans()`), and the two zones' hrefs differ. So
the resolver takes the entity's **own `parents` array** (every page already has
the entity), a plain `{plants?, pods?, beans?}` garden for the lookups, and an
href builder per kind. The public bean page supplies
`{plants: dataset.getPlants(), pods: dataset.getPods()}` — it never needs a bean
lookup, because a bean's own parents are pods and plants.

- [ ] **Step 1: Write the failing test**

Create `lib/lineage.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveLineage, ADMIN_HREFS, PUBLIC_HREFS } from "@/lib/lineage";
import type { Bean, Plant, Pod } from "@/lib/data";

const plant = (slug: string, name: string, logo?: string): Plant =>
  ({ slug, name, description: "", role: { kind: "owner" }, ...(logo ? { logo: { url: logo } } : {}) }) as unknown as Plant;
const pod = (slug: string, name: string, parents: string[]): Pod =>
  ({ slug, name, description: "", parents }) as unknown as Pod;
const bean = (slug: string, name: string, parents: string[]): Bean =>
  ({ slug, name, parents }) as unknown as Bean;

const GARDEN = {
  plants: [plant("pbbls", "pbbls", "https://res.cloudinary.com/demo/image/upload/v1/p.png")],
  pods: [pod("pbbls-karma", "Karma", ["plant:pbbls"])],
  beans: [
    bean("pbbls-d8", "D8", ["pod:pbbls-karma"]),
    bean("pbbls-loose", "Loose", ["plant:pbbls"]),
  ],
};

test("a sprout climbs bean → pod → plant, outermost first", () => {
  const lineage = resolveLineage(["bean:pbbls-d8"], GARDEN, {
    lang: "en",
    hrefs: ADMIN_HREFS,
  });

  assert.deepEqual(
    lineage.map((tier) => tier.kind),
    ["plant", "pod", "bean"],
  );
  assert.deepEqual(lineage[0].entries, [
    {
      slug: "pbbls",
      name: "pbbls",
      href: "/admin/plant/pbbls",
      logoUrl: "https://res.cloudinary.com/demo/image/upload/v1/p.png",
    },
  ]);
  assert.deepEqual(lineage[1].entries[0].href, "/admin/pod/pbbls-karma");
  assert.deepEqual(lineage[2].entries[0].href, "/admin/bean/pbbls-d8");
});

test("a pod-less bean omits the pod tier rather than rendering it empty", () => {
  const lineage = resolveLineage(["plant:pbbls"], GARDEN, {
    lang: "en",
    hrefs: PUBLIC_HREFS,
  });

  assert.deepEqual(
    lineage.map((tier) => tier.kind),
    ["plant"],
  );
  assert.equal(lineage[0].entries[0].href, "/plant/pbbls");
});

test("a dangling ref is dropped, exactly as publishCascade drops one", () => {
  const lineage = resolveLineage(["bean:ghost", "bean:pbbls-d8"], GARDEN, {
    lang: "en",
    hrefs: ADMIN_HREFS,
  });

  const beans = lineage.find((tier) => tier.kind === "bean");
  assert.deepEqual(beans?.entries.map((e) => e.slug), ["pbbls-d8"]);
});

test("two beans under one pod list the pod once", () => {
  const garden = {
    ...GARDEN,
    beans: [...GARDEN.beans, bean("pbbls-d9", "D9", ["pod:pbbls-karma"])],
  };
  const lineage = resolveLineage(["bean:pbbls-d8", "bean:pbbls-d9"], garden, {
    lang: "en",
    hrefs: ADMIN_HREFS,
  });

  assert.deepEqual(lineage.find((t) => t.kind === "pod")?.entries.map((e) => e.slug), [
    "pbbls-karma",
  ]);
  assert.deepEqual(lineage.find((t) => t.kind === "bean")?.entries.map((e) => e.slug), [
    "pbbls-d8",
    "pbbls-d9",
  ]);
});

test("a bilingual name resolves to the reading language", () => {
  const garden = { plants: [{ ...plant("x", ""), name: { en: "Accuracy", fr: "Justesse" } } as unknown as Plant] };
  const lineage = resolveLineage(["plant:x"], garden, { lang: "fr", hrefs: PUBLIC_HREFS });

  assert.equal(lineage[0].entries[0].name, "Justesse");
});

test("a slug with a space is encoded in the href", () => {
  const garden = { plants: [plant("a b", "A B")] };
  const lineage = resolveLineage(["plant:a b"], garden, { lang: "en", hrefs: PUBLIC_HREFS });

  assert.equal(lineage[0].entries[0].href, "/plant/a%20b");
});

test("no parents is an empty lineage, not a cluster of nothing", () => {
  assert.deepEqual(resolveLineage(undefined, GARDEN, { lang: "en", hrefs: ADMIN_HREFS }), []);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/lineage.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/lineage'`.

- [ ] **Step 3: Write the resolver**

Create `lib/lineage.ts`:

```ts
import {
  BEAN_PREFIX,
  PLANT_PREFIX,
  POD_PREFIX,
  parentsWithPrefix,
  resolveText,
  type Bean,
  type Plant,
  type Pod,
} from "./data";
import { hubHref } from "./plant-path";
import type { Lang } from "./locale";

/**
 * Where an entity hangs from — the parenting chrome's model.
 *
 * Pure and JSX-free, beside `lib/admin-nav.ts` and for the same reason: the
 * component that consumes this is rendered, this is arithmetic, and arithmetic
 * is what `npm test` can reach without a database.
 *
 * THE GARDEN IS A PARAMETER, never loaded here. That keeps CLAUDE.md's garden
 * rule with the page — `loadRawGarden` in the admin, the cached reader in the
 * public zone — rather than letting one component decide a privacy question on
 * behalf of six pages. Same argument for `hrefs`: the two zones spell the same
 * entity's address differently, so the grammar arrives as a parameter and the
 * climb is shared.
 *
 * Dangling refs are DROPPED, exactly as `publishCascade` and `filterPublic`
 * drop them: a ref whose target is absent from the garden you were handed is a
 * ref you may not link to, and in the public zone that absence IS the privacy
 * projection.
 */

export interface LineageEntry {
  slug: string;
  name: string;
  href: string;
  /** Plants only — the mark the chrome draws instead of an icon. */
  logoUrl?: string;
}

export interface LineageTier {
  kind: "plant" | "pod" | "bean";
  entries: LineageEntry[];
}

/** Outermost first: plant, then pod, then bean. A tier with no entries is
 *  absent from the array — see the component for why empty is never drawn. */
export type Lineage = LineageTier[];

/** One zone's address grammar. */
export interface LineageHrefs {
  plant: (slug: string) => string;
  pod: (slug: string) => string;
  bean: (slug: string) => string;
}

export const ADMIN_HREFS: LineageHrefs = {
  // Through lib/plant-path.ts, so the plant address stays spelled once and this
  // module cannot disagree with the rail's resolver about what it means.
  plant: hubHref,
  pod: (slug) => `/admin/pod/${encodeURIComponent(slug)}`,
  bean: (slug) => `/admin/bean/${encodeURIComponent(slug)}`,
};

export const PUBLIC_HREFS: LineageHrefs = {
  plant: (slug) => `/plant/${encodeURIComponent(slug)}`,
  pod: (slug) => `/pod/${encodeURIComponent(slug)}`,
  bean: (slug) => `/bean/${encodeURIComponent(slug)}`,
};

/** The lookups the climb needs. Shaped like `RawGarden`'s first three fields so
 *  the admin can pass the garden it already has, and the public zone can build
 *  one from its `Dataset` (which has no `getBeans()` — and needs none, since a
 *  bean's own parents are pods and plants). */
export interface LineageGarden {
  plants?: Plant[];
  pods?: Pod[];
  beans?: Bean[];
}

export function resolveLineage(
  parents: string[] | undefined,
  garden: LineageGarden,
  opts: { lang: Lang; hrefs: LineageHrefs },
): Lineage {
  const { lang, hrefs } = opts;
  const plantBySlug = new Map((garden.plants ?? []).map((p) => [p.slug, p]));
  const podBySlug = new Map((garden.pods ?? []).map((p) => [p.slug, p]));
  const beanBySlug = new Map((garden.beans ?? []).map((b) => [b.slug, b]));

  // Insertion order is the answer's order, so a Set is both the dedup and the
  // "first ref wins" rule in one.
  const beanSlugs = new Set(
    parentsWithPrefix(parents, BEAN_PREFIX).filter((s) => beanBySlug.has(s)),
  );
  const podSlugs = new Set(
    parentsWithPrefix(parents, POD_PREFIX).filter((s) => podBySlug.has(s)),
  );
  const plantSlugs = new Set(
    parentsWithPrefix(parents, PLANT_PREFIX).filter((s) => plantBySlug.has(s)),
  );

  for (const slug of beanSlugs) {
    const bean = beanBySlug.get(slug)!;
    for (const p of parentsWithPrefix(bean.parents, POD_PREFIX)) {
      if (podBySlug.has(p)) podSlugs.add(p);
    }
    for (const p of parentsWithPrefix(bean.parents, PLANT_PREFIX)) {
      if (plantBySlug.has(p)) plantSlugs.add(p);
    }
  }
  for (const slug of podSlugs) {
    for (const p of parentsWithPrefix(podBySlug.get(slug)!.parents, PLANT_PREFIX)) {
      if (plantBySlug.has(p)) plantSlugs.add(p);
    }
  }

  const tier = (
    kind: LineageTier["kind"],
    slugs: Set<string>,
    entry: (slug: string) => LineageEntry,
  ): LineageTier[] => (slugs.size ? [{ kind, entries: [...slugs].map(entry) }] : []);

  return [
    ...tier("plant", plantSlugs, (slug) => {
      const plant = plantBySlug.get(slug)!;
      const logoUrl = plant.logo?.url;
      return {
        slug,
        name: resolveText(plant.name, lang),
        href: hrefs.plant(slug),
        ...(logoUrl ? { logoUrl } : {}),
      };
    }),
    ...tier("pod", podSlugs, (slug) => ({
      slug,
      name: resolveText(podBySlug.get(slug)!.name, lang),
      href: hrefs.pod(slug),
    })),
    ...tier("bean", beanSlugs, (slug) => ({
      slug,
      name: resolveText(beanBySlug.get(slug)!.name, lang),
      href: hrefs.bean(slug),
    })),
  ];
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/lineage.test.ts
```

Expected: PASS, 7 tests. If `resolveText` rejects the `Lang` import path, check
`lib/locale.ts` exports `Lang` — it does, and `lib/entity-resolve.ts` imports it
the same way.

- [ ] **Step 5: Record the signature refinement in the spec**

In `docs/superpowers/specs/2026-09-13-parenting-chrome-design.md`, replace the
`resolveLineage(raw: RawGarden, ref: string): Lineage;` line and the paragraph
above it with the real signature and this reason:

> `resolveLineage(parents, garden, { lang, hrefs })`. It takes the entity's own
> `parents` array rather than a ref, because every page already holds the
> entity, and a lookup-by-ref would need a `getScreen`/`getSprout` the public
> `Dataset` does not offer. `hrefs` is a parameter because the two zones spell
> the same entity's address differently.

- [ ] **Step 6: Commit**

```bash
git add lib/lineage.ts lib/lineage.test.ts docs/superpowers/specs/2026-09-13-parenting-chrome-design.md
git commit -m "Resolve an entity's lineage

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Two public-safe glyphs

The pod and bean tiers need icons in **both** zones, and the public zone may not
import `lucide-react` (one import is one client boundary). `components/public-icons.tsx`
is the documented way around it: lucide's path data, copied verbatim, drawn as a
server component. The admin's `SECTION_ICONS` uses lucide `Package` for pods and
`Bean` for beans, so those are the two to copy — the whole point is that the
same destination looks the same in both zones.

**Files:**
- Modify: `components/public-icons.tsx`
- Test: `components/public-icons.test.tsx`

- [ ] **Step 1: Write the failing test**

In `components/public-icons.test.tsx`, make three edits.

(a) Extend the lucide import to bring in the two upstream icons:

```ts
import {
  Bean,
  ChessKnight,
  ChessPawn,
  Crown,
  Package,
  Sprout,
  Waypoints,
  Zap,
  ZapOff,
} from "lucide-react";
```

(b) Extend our import:

```ts
import {
  BeanIcon,
  ChessKnightIcon,
  ChessPawnIcon,
  CrownIcon,
  PLANT_ROLE_ICONS,
  PodIcon,
  SproutIcon,
  WaypointsIcon,
  ZapIcon,
  ZapOffIcon,
} from "./public-icons";
```

(c) Add the two pairs to the `pairs` array, after `["waypoints", …]`:

```ts
  ["package", Package, PodIcon],
  ["bean", Bean, BeanIcon],
```

(d) lucide's `package` is drawn partly with a `<polyline>`, which the current
extractor neither matches nor compares — so a drifted polyline would pass
silently. Widen both, in `geometryOf` and its attribute list:

```ts
// `points` joins the list for lucide's `package`, which draws its open box as a
// polyline: an attribute the extractor does not read is an attribute that can
// drift without failing anything, which is the exact hole this file exists to
// close.
const GEOMETRY_ATTRS = ["d", "cx", "cy", "r", "points"] as const;
```

and in the same function:

```ts
  for (const tag of markup.matchAll(/<(path|circle|polyline)\b([^>]*)>/g)) {
```

- [ ] **Step 2: Run it and watch it fail**

```bash
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test components/public-icons.test.tsx
```

Expected: FAIL — `PodIcon`/`BeanIcon` are not exported from `./public-icons`.

- [ ] **Step 3: Add the two glyphs**

In `components/public-icons.tsx`, after `WaypointsIcon`, add (path data copied
verbatim from `node_modules/lucide-react/dist/esm/icons/package.mjs` and
`bean.mjs` at lucide-react@1.33):

```tsx
/** lucide `package` — a pod. The admin rail's Pods icon, and the parenting
 *  chrome's pod tier. */
export function PodIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgFrame {...props}>
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
      <path d="M12 22V12" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <path d="m7.5 4.27 9 5.15" />
    </SvgFrame>
  );
}

/** lucide `bean` — a bean. The admin rail's Beans icon, and the parenting
 *  chrome's bean tier. */
export function BeanIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <SvgFrame {...props}>
      <path d="M10.165 6.598C9.954 7.478 9.64 8.36 9 9c-.64.64-1.521.954-2.402 1.165A6 6 0 0 0 8 22c7.732 0 14-6.268 14-14a6 6 0 0 0-11.835-1.402Z" />
      <path d="M5.341 10.62a4 4 0 1 0 5.279-5.28" />
    </SvgFrame>
  );
}
```

Also update the file's own docblock: it says "seven glyphs" in two places
(`The public zone's icon set — seven glyphs` and `Bumping lucide: RE-COPY ALL
SEVEN`). Both become **nine**. The docblock is the instruction the next person
follows; leaving it at seven is how the eighth and ninth get left behind on a
lucide bump.

- [ ] **Step 4: Run the test and watch it pass**

```bash
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test components/public-icons.test.tsx
```

Expected: PASS — nine `our <name> is lucide's <name>` tests plus the role-map test.

- [ ] **Step 5: Commit**

```bash
git add components/public-icons.tsx components/public-icons.test.tsx
git commit -m "Draw a pod and a bean without crossing a client boundary

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: The cluster

**Files:**
- Create: `components/lineage-chrome.tsx`
- Test: `lib/lineage-chrome-render.test.tsx`
- Modify: `lib/server-safe-source.test.ts`

- [ ] **Step 1: Write the failing render test**

Create `lib/lineage-chrome-render.test.tsx`:

```tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { LineageChrome } from "@/components/lineage-chrome";
import type { Lineage } from "@/lib/lineage";

const ONE_EACH: Lineage = [
  {
    kind: "plant",
    entries: [
      {
        slug: "pbbls",
        name: "pbbls",
        href: "/admin/plant/pbbls",
        logoUrl: "https://res.cloudinary.com/demo/image/upload/v1/p.png",
      },
    ],
  },
  { kind: "pod", entries: [{ slug: "pbbls-karma", name: "Karma", href: "/admin/pod/pbbls-karma" }] },
  { kind: "bean", entries: [{ slug: "pbbls-d8", name: "D8", href: "/admin/bean/pbbls-d8" }] },
];

const TWO_BEANS: Lineage = [
  {
    kind: "bean",
    entries: [
      { slug: "a", name: "Alpha", href: "/bean/a" },
      { slug: "b", name: "Beta", href: "/bean/b" },
    ],
  },
];

test("a tier with one parent is a link named for that parent", () => {
  const html = renderToStaticMarkup(<LineageChrome lineage={ONE_EACH} />);

  assert.ok(
    /<a[^>]+href="\/admin\/pod\/pbbls-karma"[^>]+aria-label="Karma"/.test(html) ||
      /<a[^>]+aria-label="Karma"[^>]+href="\/admin\/pod\/pbbls-karma"/.test(html),
    "a single parent must be a plain link whose accessible name is the PARENT'S " +
      `name, not the tier's word. Got: ${html}`,
  );
  assert.ok(!/<details/.test(html), "a tier of one must not be a disclosure");
});

test("a tier with two parents is a disclosure holding both as real hrefs", () => {
  const html = renderToStaticMarkup(<LineageChrome lineage={TWO_BEANS} />);

  assert.ok(/<details/.test(html), `two parents must open a disclosure. Got: ${html}`);
  assert.ok(/<summary[^>]+aria-label="Beans: 2"/.test(html), `Got: ${html}`);
  assert.ok(/href="\/bean\/a"/.test(html) && /href="\/bean\/b"/.test(html),
    "every parent must be reachable as a real href with script off. " + `Got: ${html}`);
});

test("the plant item's logo is in the server HTML", () => {
  const html = renderToStaticMarkup(<LineageChrome lineage={ONE_EACH} />);

  assert.ok(/<img\b/.test(html) && /res\.cloudinary\.com/.test(html),
    "the plant mark must server-render its <img> — a client avatar flashes its " +
      `monogram on every first paint. Got: ${html}`);
});

test("an empty lineage renders nothing at all", () => {
  assert.equal(renderToStaticMarkup(<LineageChrome lineage={[]} />), "");
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/lineage-chrome-render.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/lineage-chrome'`.

- [ ] **Step 3: Write the component**

Create `components/lineage-chrome.tsx`:

```tsx
import type { ComponentType, ReactNode } from "react";

import { Chrome, ChromeLink, chromeItemClass } from "./chrome";
import { CHROME_PLATE } from "./chrome-plate";
import { PlantMarkContent } from "./plant-header";
import { BeanIcon, PodIcon } from "./public-icons";
import type { Lineage, LineageEntry, LineageTier } from "@/lib/lineage";
import { cn } from "@/lib/utils";

/**
 * The parenting chrome — where the entity you are looking at hangs from.
 *
 * `plant | pod | bean`, outermost first, one item per TIER rather than one per
 * parent: the tiers are what the model guarantees (a sprout is always under
 * beans, a bean always under pods or plants), while the count within a tier is
 * data. So the row's shape is stable and only an item's behaviour changes.
 *
 * **Server-safe, and that is load-bearing** — no `"use client"`, no
 * `lucide-react`, no `next/link`, no `node:`. `lib/server-safe-source.test.ts`
 * pins all four, because every one of them passes `tsc`, `npm test` AND
 * `npm run build` while costing the public zone its navigation. It is why the
 * pod and bean glyphs come from `components/public-icons.tsx` and why the
 * lineage arrives as a TYPE from `lib/lineage.ts` — whose runtime half reaches
 * `lib/data.ts`, which opens with `node:fs`.
 *
 * **A `<details>` rather than a popover**, for a tier with several parents.
 * Base UI's Popover is a client component, and reaching for it would make
 * moving up a tier script-dependent in the one zone whose rule is that nothing
 * is. A disclosure is server-rendered and complete with script off, and it is
 * the same element in both zones — so this stays one file rather than one file
 * with two behaviours. The known costs, stated rather than discovered: no
 * outside-click dismissal, and the panel is in flow beneath the plate.
 *
 * **A tier of ONE is a plain link, not a disclosure of one.** The common case
 * is one bean under one pod under one plant, and a menu of one is a click that
 * costs a click. The accessible name is then the PARENT'S name — the only place
 * a reader learns which parent this is — which is the icon-trigger rule
 * (`lib/plant-hero-a11y.test.ts`) applied to navigation.
 *
 * The entity itself is not an item: this cluster says where you are FROM, and
 * the page's own header already says what you are looking at.
 */

const TIER_WORD: Record<LineageTier["kind"], { one: string; many: string }> = {
  plant: { one: "Plant", many: "Plants" },
  pod: { one: "Pod", many: "Pods" },
  bean: { one: "Bean", many: "Beans" },
};

/** The glyph inside an item. A plant draws its MARK — the logo over a monogram,
 *  both in the server HTML (`PlantMarkContent`) — because a plant is recognised
 *  by its logo everywhere else in the product, and a generic flower here would
 *  be the one place it is not. */
function TierGlyph({ kind, entry }: { kind: LineageTier["kind"]; entry?: LineageEntry }) {
  if (kind === "plant") {
    return (
      <span aria-hidden="true" className="size-5 overflow-hidden rounded-[28%] bg-muted">
        <PlantMarkContent logoUrl={entry?.logoUrl} name={entry?.name ?? ""} />
      </span>
    );
  }
  const Icon = kind === "pod" ? PodIcon : BeanIcon;
  return <Icon className="size-4" />;
}

function TierItem({
  tier,
  as,
}: {
  tier: LineageTier;
  as?: "a" | ComponentType<never>;
}): ReactNode {
  const [first, ...rest] = tier.entries;
  if (!first) return null;

  if (rest.length === 0) {
    return (
      <ChromeLink
        href={first.href}
        label={first.name}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        as={as as any}
      >
        <TierGlyph kind={tier.kind} entry={first} />
      </ChromeLink>
    );
  }

  const Anchor = (as ?? "a") as "a";
  return (
    <details className="relative">
      <summary
        aria-label={`${TIER_WORD[tier.kind].many}: ${tier.entries.length}`}
        className={cn(chromeItemClass(), "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}
      >
        <TierGlyph kind={tier.kind} entry={first} />
      </summary>
      <ul
        className={cn(
          "absolute left-1/2 top-full z-10 mt-2 min-w-40 -translate-x-1/2 rounded-xl p-1",
          CHROME_PLATE,
        )}
      >
        {tier.entries.map((entry) => (
          <li key={entry.slug}>
            <Anchor
              href={entry.href}
              className="block rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            >
              {entry.name}
            </Anchor>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function LineageChrome({
  lineage,
  as,
}: {
  lineage: Lineage;
  /**
   * The anchor, exactly as `ChromeLink` takes it and for exactly its reason:
   * the admin passes `next/link` for a soft navigation, the public zone passes
   * nothing and gets `<a>`. Importing `next/link` HERE would put a client
   * boundary under every public page.
   */
  as?: "a" | ComponentType<never>;
}) {
  // Nothing at all, rather than an empty plate floating at the top of a page
  // that has no parents to show. A plant's own page lands here.
  if (lineage.length === 0) return null;

  return (
    <Chrome magnet="top-center" label="Parents">
      {lineage.map((tier) => (
        <TierItem key={tier.kind} tier={tier} as={as} />
      ))}
    </Chrome>
  );
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/lineage-chrome-render.test.tsx
```

Expected: PASS, 4 tests. If the `aria-label` assertion fails on attribute order,
read the printed markup and adjust the regex — not the component.

- [ ] **Step 5: Pin the file as server-safe**

In `lib/server-safe-source.test.ts`, add to the pinned list, after
`"components/chrome.tsx",`:

```ts
  // The parenting chrome. Public bean and pod pages render it, so a
  // lucide import or a next/link here is the public zone's navigation.
  "components/lineage-chrome.tsx",
```

- [ ] **Step 6: Run the server-safe suite**

```bash
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/server-safe-source.test.ts
```

Expected: PASS. A failure here names the exact rule broken — fix the component,
never the list.

- [ ] **Step 7: Commit**

```bash
git add components/lineage-chrome.tsx lib/lineage-chrome-render.test.tsx lib/server-safe-source.test.ts
git commit -m "Draw where an entity hangs from

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Mount it on the admin sprout page

**Files:**
- Modify: `app/admin/(chrome)/sprout/[slug]/page.tsx`

- [ ] **Step 1: Build the lineage**

The page already holds `sprout` and `raw` (from `loadRawGarden()`). Add the
imports:

```ts
import Link from "next/link";
import { resolveLineage, ADMIN_HREFS } from "@/lib/lineage";
import { LineageChrome } from "@/components/lineage-chrome";
```

and, after `const raw = await loadRawGarden();`:

```ts
  // The admin reads the LIVE garden (it already did, five lines up) — the
  // chrome is the surface most likely to be looked at right after a rename.
  // "en" rather than a negotiated language: the admin zone is authored in one.
  const lineage = resolveLineage(sprout.parents, raw, { lang: "en", hrefs: ADMIN_HREFS });
```

- [ ] **Step 2: Render it and remove the back link**

Add `<LineageChrome lineage={lineage} as={Link} />` as the first child of the
page's returned fragment.

Then delete the page's existing single "back to bean" link — the element built
from `backHref` / `backLabel` — and the now-unused `backHref`, `backLabel` and
`bean` bindings above it. Keep `beanSlug` only if something else still reads it;
if nothing does, delete it and the `BEAN_PREFIX` / `parentsWithPrefix` imports
with it. Leaving both link and cluster would give one destination two shapes on
one page.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. An "unused variable" complaint here means Step 2's deletion
was incomplete — finish it rather than silencing it.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/(chrome)/sprout/[slug]/page.tsx"
git commit -m "Give a sprout its parents

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Mount it on the three remaining admin pages

**Files:**
- Modify: `app/admin/(chrome)/bean/[id]/page.tsx`
- Modify: `app/admin/(chrome)/pod/[slug]/page.tsx`
- Modify: `app/admin/(chrome)/screens/[slug]/page.tsx`

Each page already loads the entity and, in most cases, the garden. Where a page
does not already hold a `RawGarden`, add `const raw = await loadRawGarden();`
(`import { loadRawGarden } from "@/lib/store";`) — the live reader, never
`loadCachedGarden`, per CLAUDE.md's garden rule for the admin zone.

- [ ] **Step 1: The bean page**

Imports:

```ts
import Link from "next/link";
import { resolveLineage, ADMIN_HREFS } from "@/lib/lineage";
import { LineageChrome } from "@/components/lineage-chrome";
```

After the bean is resolved and the garden is in hand:

```ts
  const lineage = resolveLineage(bean.parents, raw, { lang: "en", hrefs: ADMIN_HREFS });
```

Render `<LineageChrome lineage={lineage} as={Link} />` as the first child of the
returned fragment. A bean's tiers are plant and pod; a pod-less bean shows one
item, which is correct and needs no special case.

- [ ] **Step 2: The pod page**

Identical, reading `pod.parents`. Its only tier is plant.

- [ ] **Step 3: The screen page**

Identical, reading `screen.parents`. Its only tier is plant. If this page holds
no garden, `loadRawGarden()` is a new read on a `force-dynamic` page — acceptable
here (it is one page, not the layout above every page, which is what PR #96
narrowed).

- [ ] **Step 4: Typecheck and run the suite**

```bash
npx tsc --noEmit && npm test
```

Expected: no type errors; the suite passes.

- [ ] **Step 5: Commit**

```bash
git add "app/admin/(chrome)/bean/[id]/page.tsx" "app/admin/(chrome)/pod/[slug]/page.tsx" "app/admin/(chrome)/screens/[slug]/page.tsx"
git commit -m "Give a bean, a pod and a screen their parents

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Mount it on the two public pages

**Files:**
- Modify: `app/(public)/(chrome)/bean/[id]/page.tsx`
- Modify: `app/(public)/(chrome)/pod/[slug]/page.tsx`

These read `getPublicDataset()` — the CACHED, privacy-filtered reader — and they
keep doing so. **No `as` prop**: the public zone's anchors are plain `<a>`, which
is the whole point of the parameter.

- [ ] **Step 1: The public bean page**

Imports:

```ts
import { resolveLineage, PUBLIC_HREFS } from "@/lib/lineage";
import { LineageChrome } from "@/components/lineage-chrome";
```

After the bean and the `lang` are resolved (the page already calls
`currentLang()`):

```ts
  // From the FILTERED dataset, so a private pod or plant is simply absent from
  // the trail — resolveLineage drops a ref it cannot resolve, which is the
  // privacy projection doing the work rather than a second check here.
  const lineage = resolveLineage(
    bean.parents,
    { plants: dataset.getPlants(), pods: dataset.getPods() },
    { lang, hrefs: PUBLIC_HREFS },
  );
```

Use whatever the page's own binding for the dataset is called. Render
`<LineageChrome lineage={lineage} />` as the first child of the returned
fragment.

- [ ] **Step 2: The public pod page**

Identical, reading `pod.parents` and needing only
`{ plants: dataset.getPlants() }`.

- [ ] **Step 3: Typecheck, suite, build**

```bash
npx tsc --noEmit && npm test && npm run build
```

Expected: all three pass. `npm run build` matters here specifically: a client
boundary reaching the public zone shows up as bundle growth, and the build is
where the public pages are rendered.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/(chrome)/bean/[id]/page.tsx" "app/(public)/(chrome)/pod/[slug]/page.tsx"
git commit -m "Show a visitor where a bean and a pod hang from

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Verify the geometry, then open the PR

**Files:** none, unless Step 2 finds a collision.

- [ ] **Step 1: Look at it**

```bash
npm run dev
```

Open an admin sprout with a real lineage (`/admin/sprout/pbbls-d8-0`) and a
public bean (`/bean/<slug>`). Check, at a desktop width: three items, plant
logo first, hover labels naming each parent, and every item navigating.

- [ ] **Step 2: Check 400px**

Resize to 400px wide on the admin sprout page — the crowded case, since the
admin also carries the mark + plant switcher (top-left) and the account cluster
(top-right).

If the three clusters overlap, the fix goes in `components/lineage-chrome.tsx`
and nowhere else: the lineage cluster is the newcomer, so it is what changes.
Drop its plate and padding below `sm` by passing
`className="max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none"` to `Chrome`.
Do **not** move `top-left` or `top-right` — two clusters that were correct
before this slice do not move for it.

- [ ] **Step 3: Script off**

In devtools, disable JavaScript and reload a public bean page whose pod tier has
two or more parents. The `<details>` must still open and every parent must still
navigate. This is the assertion `lib/lineage-chrome-render.test.tsx` makes about
the markup, confirmed against a real browser.

- [ ] **Step 4: Full verification**

```bash
npx tsc --noEmit && npm test && npm run build && npx eslint .
```

Expected: all four clean. Paste the real output into the PR — do not claim a
pass you have not read.

- [ ] **Step 5: Open the PR with a Lab Note**

This slice is visitor-facing (the public bean and pod pages gain the trail), so
the PR body MUST carry a Lab Note — see CLAUDE.md.

```bash
git push -u origin HEAD
```

PR body, after the summary and the verification output:

````markdown
## Lab Note

```yaml
en:
  title: See where anything sits, at a glance
  summary: Every bean and pod page now carries its family above it — the plant it belongs to, the pod it sits in — so you can climb back up in one click instead of hunting for the way back.
fr:
  title: Retrouve ton chemin d'un coup d'œil
  summary: Chaque page de bean et de pod affiche désormais sa famille juste au-dessus : la plante dont elle vient, le pod qui l'abrite. Un clic suffit pour remonter.
suggested:
  molecule: ariko
  type: improvement
  tags: [changelog]
```
````
