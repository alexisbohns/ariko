# The Public Plant Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the public plant page the admin hero's centred composition, replace the public header bar with a floating icon rail, set the prose at 16px with mono headings, make reference cards fully clickable, and add a Notion-style table-of-contents rail — the public zone's first client island.

**Architecture:** Everything except the TOC rail is a **server** component, so the public zone keeps its no-script promise: the chrome's tooltips are CSS, and its glyphs are inline SVG (lucide is `"use client"`). The TOC rail is mount-gated and renders nothing without script; its pure index→state logic lives in `lib/toc.ts` so `npm test` can reach it without a DOM. Spec: `docs/superpowers/specs/2026-09-06-public-plant-page-design.md`.

**Tech Stack:** Next.js 15 / React 19 / TypeScript, Tailwind v4 + `@tailwindcss/typography`, shadcn on Base UI, `node --test` via `npm test`. **No new dependencies.**

---

## File Structure

**Created:**
- `lib/toc.ts` — pure. `TocHeading`, `TocState`, `TOC_MIN_HEADINGS`, `tocState()`, `shouldRenderToc()`. No JSX, no React, no DOM. Lives in `lib/` because that is where `npm test` looks.
- `lib/toc.test.ts` — tests for the two pure functions.
- `lib/toc-mount.test.ts` — pins that `<TocRail />` server-renders to the empty string.
- `components/public-icons.tsx` — server. Five inline `<svg aria-hidden>` glyphs (lucide path data, ISC).
- `components/icon-link.tsx` — server. An `<a>` with a CSS-only hover/focus label.
- `components/brand/profane-preload.tsx` — server. The `<link rel="preload">` for the Profane face.
- `components/toc-rail.tsx` — **client**, the only one. Mount gate + DOM scan + IntersectionObserver.
- `app/(public)/_components/public-chrome.tsx` — server. The two fixed clusters.
- `app/(public)/_components/plant-head.tsx` — server. The centred mark/title/description/role/status stack.

**Modified:**
- `app/(public)/(chrome)/layout.tsx` — header bar deleted; renders `<PublicChrome/>` and `<TocRail/>`.
- `app/(public)/(chrome)/plant/[slug]/page.tsx` — its `<header>` replaced by `<PlantHead/>` + the preload.
- `app/(public)/page.tsx` — its inline preload `<link>` replaced by `<ProfanePreload/>`.
- `components/markdown.tsx` — `prose-sm` → `prose`, mono headings.
- `components/entity.tsx` — `py-4` → `py-8`, whole card clickable.
- `CLAUDE.md` — the sixth exception (TOC rail) + the public chrome as a neighbour.

**Deleted:** nothing.

---

## Task 1: The pure TOC model

**Files:**
- Create: `lib/toc.ts`
- Test: `lib/toc.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/toc.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldRenderToc, tocState, TOC_MIN_HEADINGS, type TocHeading } from "./toc";

const h = (id: string, level: 2 | 3 = 2): TocHeading => ({ id, text: id, level });

test("the row at the active index is active", () => {
  assert.equal(tocState(1, 1), "active");
});

test("rows before the active index are passed", () => {
  assert.equal(tocState(0, 2), "passed");
  assert.equal(tocState(1, 2), "passed");
});

test("rows after the active index are default", () => {
  assert.equal(tocState(3, 2), "default");
});

// At the very top of a document nothing has been read yet. -1 is the honest
// answer, and it must not make the first row active by accident.
test("an active index of -1 leaves every row default", () => {
  assert.equal(tocState(0, -1), "default");
  assert.equal(tocState(5, -1), "default");
});

test("a rail needs at least two headings", () => {
  assert.equal(TOC_MIN_HEADINGS, 2);
  assert.equal(shouldRenderToc([]), false);
  assert.equal(shouldRenderToc([h("one")]), false);
  assert.equal(shouldRenderToc([h("one"), h("two")]), true);
  assert.equal(shouldRenderToc([h("one"), h("two", 3), h("three")]), true);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test 2>&1 | grep -A3 "toc"`
Expected: FAIL — `Cannot find module './toc'`.

- [ ] **Step 3: Write the implementation**

Create `lib/toc.ts`:

```ts
/**
 * The TOC rail's model. Pure, JSX-free and DOM-free so `npm test` can reach it:
 * the rail itself is a client component that reads the rendered document, and
 * the only part of it worth pinning is the arithmetic.
 *
 * The headings are NOT extracted here. `lib/markdown.ts` already runs
 * rehypeSlug, so the rail reads the ids off the rendered DOM rather than
 * re-walking the markdown — a fourth reader of the one corpus is exactly the
 * shape the tiptap slice's conformance work found five defects in, and a slug
 * algorithm that disagrees with rehypeSlug's in one edge case produces a rail
 * whose links quietly go nowhere.
 */

export interface TocHeading {
  /** The rehypeSlug id, already on the rendered heading. */
  id: string;
  text: string;
  level: 2 | 3;
}

/** Where a row sits relative to the reader. */
export type TocState = "passed" | "active" | "default";

/**
 * A single dash is a claim about structure that a page with no structure cannot
 * support, so the rail withdraws entirely below this.
 */
export const TOC_MIN_HEADINGS = 2;

/**
 * `activeIndex` is -1 before any heading has crossed the reading line — the top
 * of the document, where nothing has been passed and nothing is current. The
 * `index < activeIndex` test gives that for free: with -1 no row is passed and
 * no row is active, which is the truth rather than a special case.
 */
export function tocState(index: number, activeIndex: number): TocState {
  if (index === activeIndex) return "active";
  return index < activeIndex ? "passed" : "default";
}

export function shouldRenderToc(headings: readonly TocHeading[]): boolean {
  return headings.length >= TOC_MIN_HEADINGS;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test 2>&1 | tail -20`
Expected: all tests pass, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add lib/toc.ts lib/toc.test.ts
git commit -m "The TOC rail's pure model: three states and a two-heading floor"
```

---

## Task 2: The public zone's inline glyphs

**Files:**
- Create: `components/public-icons.tsx`

There is no test for this task — it is static path data with no behaviour. Task 6 and Task 8 render it.

- [ ] **Step 1: Write the module**

Create `components/public-icons.tsx`. The `d` strings are lucide-react@1.33's own, copied verbatim; do not redraw them.

```tsx
import type { SVGProps } from "react";

/**
 * The public zone's icon set — five glyphs, as SERVER components.
 *
 * `components/media.tsx` states the rule these exist to obey: lucide-react@1.33
 * routes every icon through an Icon.mjs carrying "use client", so a single
 * <Crown /> imported from it would push a client boundary into a zone whose
 * whole rule is that it has none. Five glyphs would be five boundaries, to draw
 * five static shapes.
 *
 * So the path data is inlined instead. It IS lucide's — copied verbatim from
 * lucide-react@1.33 (ISC licence: "Permission to use, copy, modify, and/or
 * distribute this software for any purpose with or without fee is hereby
 * granted"), which is what keeps the two zones drawing the same vocabulary: the
 * crown on a public plant page is the same crown as on /admin/plant/[slug],
 * because it is the same twelve numbers.
 *
 * Every one is aria-hidden. These glyphs never carry meaning alone — the public
 * chrome puts the word in the anchor's aria-label, and the plant head renders
 * the word beside the icon. Nothing here is the accessible name for anything.
 *
 * Adding a sixth: copy `__iconNode` out of
 * node_modules/lucide-react/dist/esm/icons/<name>.mjs. Do not eyeball it.
 */

/** lucide's own defaults — 24-unit box, 2-unit round stroke, no fill. */
function Glyph({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** lucide `sprout` — the directory of plants. The admin rail's Garden icon. */
export function SproutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3" />
      <path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4" />
      <path d="M5 21h14" />
    </Glyph>
  );
}

/** lucide `waypoints` — the beanstalk. The admin rail's Beanstalk icon. */
export function WaypointsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="m10.586 5.414-5.172 5.172" />
      <path d="m18.586 13.414-5.172 5.172" />
      <path d="M6 12h12" />
      <circle cx="12" cy="20" r="2" />
      <circle cx="12" cy="4" r="2" />
      <circle cx="20" cy="12" r="2" />
      <circle cx="4" cy="12" r="2" />
    </Glyph>
  );
}

/** lucide `crown` — a plant's role. The admin hero's role trigger. */
export function CrownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </Glyph>
  );
}

/** lucide `zap` — status: active. */
export function ZapIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" />
    </Glyph>
  );
}

/** lucide `zap-off` — status: inactive. */
export function ZapOffIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M10.768 5.111 13.44 2.44a1.5 1.5 0 012.474 1.561l-1.633 4.625" />
      <path d="m18.889 13.232.672-.672A1.5 1.5 0 0018.5 10h-2.844" />
      <path d="m2 2 20 20" />
      <path d="m7.94 7.94-3.5 3.499A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l5.5-5.5" />
    </Glyph>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: no errors mentioning `public-icons`.

- [ ] **Step 3: Commit**

```bash
git add components/public-icons.tsx
git commit -m "Five inline glyphs, so the public zone keeps its no-script promise"
```

---

## Task 3: The CSS-only icon link

**Files:**
- Create: `components/icon-link.tsx`

- [ ] **Step 1: Write the module**

Create `components/icon-link.tsx`:

```tsx
import type { ReactNode } from "react";

/**
 * An icon that links somewhere and says its name on hover — with NO client JS.
 *
 * CLAUDE.md says never hand-roll a primitive the registry already has, and the
 * registry has `tooltip`. It is @base-ui/react's, and it is "use client":
 * using it here would make the public zone's NAVIGATION script-dependent in
 * order to gain a hover label. That is the one trade the zone cannot make — a
 * visitor who cannot navigate has lost the site.
 *
 * So the label is CSS. This is a deviation worth naming rather than hiding, and
 * it is the good direction of it:
 *
 *  - The accessible name is the anchor's `aria-label`, never the visual span
 *    (which is aria-hidden). What a screen reader announces does not depend on
 *    the hover affordance existing at all.
 *  - It WORKS with script off, which the registry component does not. Hand-
 *    rolling is right exactly when the hand-rolled thing is more capable in the
 *    circumstances it is used in.
 *  - It is a label on hover, not a tooltip PRIMITIVE: no portal, no positioning
 *    engine, no focus management, no delay groups. Nothing the registry
 *    component earns its complexity for is needed by three fixed icons in a
 *    corner.
 *
 * The admin keeps the real Tooltip. This component is public-zone only.
 *
 * `group-focus-visible` as well as `group-hover`: a keyboard user tabbing the
 * rail gets the same label a pointer does.
 */
export function IconLink({
  href,
  label,
  children,
}: {
  href: string;
  /** The accessible name AND the visible label — one string, so they cannot drift. */
  label: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className="group/icon relative flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 font-heading text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover/icon:opacity-100 group-focus-visible/icon:opacity-100"
      >
        {label}
      </span>
    </a>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: no errors mentioning `icon-link`.

- [ ] **Step 3: Commit**

```bash
git add components/icon-link.tsx
git commit -m "A hover label that needs no script, so navigation never does"
```

---

## Task 4: The Profane preload, extracted

**Files:**
- Create: `components/brand/profane-preload.tsx`
- Modify: `app/(public)/page.tsx` (replace the inline `<link>`)

- [ ] **Step 1: Write the component**

Create `components/brand/profane-preload.tsx`:

```tsx
import { PROFANE_WOFF2_URL } from "@/app/fonts";

/**
 * The preload for the display face, extracted the moment it gained a second
 * wearer (the public plant page).
 *
 * Profane is NOT bundled — it is served from our Cloudinary (app/fonts.ts
 * records the licence reasoning), so next/font does no build-time work for it
 * and nothing preloads it for us. React hoists this <link> into <head>.
 *
 * `crossOrigin` is required, not decorative: a font fetch is always an
 * anonymous CORS request, and without it the browser downloads the file twice.
 *
 * The rule it preserves: ONLY pages that wear the face ask for it. Two callers
 * today — the landing and the plant page. Do not move this into a layout.
 */
export function ProfanePreload() {
  return (
    <link
      rel="preload"
      href={PROFANE_WOFF2_URL}
      as="font"
      type="font/woff2"
      crossOrigin="anonymous"
    />
  );
}
```

- [ ] **Step 2: Use it on the landing page**

In `app/(public)/page.tsx`, delete the `PROFANE_WOFF2_URL` import and add:

```tsx
import { ProfanePreload } from "@/components/brand/profane-preload";
```

Then replace the whole comment block plus `<link …/>` inside `<main className="pb-20">` — from the `{/* The display face is not bundled …` comment through `/>` — with:

```tsx
      <ProfanePreload />
```

- [ ] **Step 3: Verify nothing else references the constant here**

Run: `grep -n "PROFANE_WOFF2_URL" "app/(public)/page.tsx"`
Expected: no output.

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/brand/profane-preload.tsx "app/(public)/page.tsx"
git commit -m "Extract the Profane preload — the face is about to gain a second wearer"
```

---

## Task 5: Prose at 16 with mono headings

**Files:**
- Modify: `components/markdown.tsx`

- [ ] **Step 1: Make the change**

In `components/markdown.tsx`, replace:

```tsx
    <div className="prose prose-sm max-w-none dark:prose-invert">
```

with:

```tsx
    // `prose`, not `prose-sm`: 16px, the size a portfolio whose whole argument
    // lives in prose should be set at. Headings take the display-adjacent mono
    // face at medium, matching every other heading in both zones (the plant
    // head's h1 is the one exception — it wears Profane).
    //
    // FOUR surfaces, and one is in the admin: /admin/sprout/[slug] renders
    // <Prose> too. That is intended rather than tolerated — the admin's is a
    // PREVIEW of the public render, and a preview set two points smaller than
    // the thing it previews is a preview that lies.
    <div className="prose max-w-none dark:prose-invert prose-headings:font-heading prose-headings:font-medium">
```

- [ ] **Step 2: Verify the markdown suites still pass**

Run: `npm test 2>&1 | tail -20`
Expected: `fail 0`. `lib/markdown.test.ts` and `lib/markdown-conformance.test.ts` assert on emitted HTML structure, not on the wrapper's classes, so they are unaffected.

- [ ] **Step 3: Commit**

```bash
git add components/markdown.tsx
git commit -m "Prose reads at 16, headings wear the mono face"
```

---

## Task 6: The public chrome

**Files:**
- Create: `app/(public)/_components/public-chrome.tsx`
- Modify: `app/(public)/(chrome)/layout.tsx`

- [ ] **Step 1: Write the chrome**

Create `app/(public)/_components/public-chrome.tsx`:

```tsx
import { ArikoIcon } from "@/components/brand/ariko-icon";
import { IconLink } from "@/components/icon-link";
import { LangSwitch } from "@/components/lang-switch";
import { SproutIcon, WaypointsIcon } from "@/components/public-icons";
import type { Lang } from "@/lib/locale";

/**
 * The public zone's chrome: two fixed clusters where a header bar used to be.
 *
 * A SERVER component, and every part of it stays one — this is the half of the
 * slice that does NOT spend the zone's script budget. The glyphs are inline SVG
 * (components/public-icons.tsx) because lucide is "use client"; the hover
 * labels are CSS (components/icon-link.tsx) because the registry Tooltip is
 * too. A visitor with script off can still go everywhere.
 *
 * The mark and "Directory" both point at `/`. That duplication is in the header
 * this replaces, and it is kept deliberately: the mark is the brand, the icon
 * is a nav item, and a nav whose first item is missing reads as broken.
 *
 * The two nav glyphs are the ADMIN RAIL'S OWN — sprout for the directory of
 * plants, waypoints for the beanstalk. Two zones, one vocabulary: a visitor who
 * becomes the author finds the same glyph meaning the same thing.
 */
export function PublicChrome({ lang }: { lang: Lang }) {
  return (
    <>
      <nav
        aria-label="Site"
        className="fixed left-4 top-4 z-40 flex items-center gap-1 rounded-2xl border bg-card/80 p-1.5 shadow-lg backdrop-blur"
      >
        <IconLink href="/" label="Ariko">
          <ArikoIcon className="size-5 text-foreground" />
        </IconLink>
        <IconLink href="/" label="Directory">
          <SproutIcon className="size-4" />
        </IconLink>
        <IconLink href="/beanstalk" label="Beanstalk">
          <WaypointsIcon className="size-4" />
        </IconLink>
      </nav>

      {/* The language switch keeps its own anchor and its own aria-label — it
          is a link to `?lang=…`, not an icon, so it does not go through
          IconLink. */}
      <div className="fixed right-4 top-4 z-40 rounded-xl border bg-card/80 px-3 py-2 shadow-lg backdrop-blur">
        <LangSwitch lang={lang} />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Rewrite the layout**

Replace the whole of `app/(public)/(chrome)/layout.tsx` with:

```tsx
import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { PublicChrome } from "@/app/(public)/_components/public-chrome";
import { TocRail } from "@/components/toc-rail";
import { LANG_COOKIE, resolveLang } from "@/lib/locale";

/**
 * The inner exhibition pages: floating chrome + a reading-width column.
 *
 * The header BAR is gone (the public-plant-page slice). Every other surface in
 * Ariko has learned to get out of the way — the admin rail, the vault
 * popovers, the palette — and this is that move for the public zone: a mark and
 * two nav icons top-left, the language top-right, nothing across the top.
 *
 * The home page deliberately sits OUTSIDE this group (`app/(public)/page.tsx`).
 * It is the landing, not a destination reached from a nav, so it wears the mark
 * large and centred and gets no chrome at all.
 *
 * <TocRail /> is the zone's ONE client island, and it is rendered here rather
 * than by each page so plant, pod and bean all get it without opting in. It
 * reads the rendered document, so it needs no props, and it withdraws on its
 * own when a page has fewer than two headings. Script-off it is not there —
 * which costs nothing, because every heading it indexes is already in the prose
 * beneath it. `pt-24` clears the chrome whether or not the rail renders.
 */
export default async function ChromeLayout({ children }: { children: ReactNode }) {
  // The layout renders the switch; each PAGE resolves the language again for its
  // own prose. Both read the same cookie, so they cannot disagree.
  const lang = resolveLang(undefined, (await cookies()).get(LANG_COOKIE)?.value);
  return (
    <>
      <PublicChrome lang={lang} />
      <TocRail />
      <main className="mx-auto max-w-3xl px-6 pb-20 pt-24">{children}</main>
    </>
  );
}
```

Note: `<TocRail />` does not exist yet — Task 7 creates it. Do Task 7 before running the app.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/_components/public-chrome.tsx" "app/(public)/(chrome)/layout.tsx"
git commit -m "The public header becomes a floating rail, still with no script"
```

---

## Task 7: The TOC rail — the island

**Files:**
- Create: `components/toc-rail.tsx`
- Test: `lib/toc-mount.test.ts`

- [ ] **Step 1: Write the failing mount test**

Create `lib/toc-mount.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * The server render IS the script-off render: useEffect never runs, so
 * TocRail's `mounted` stays false and the island returns null. The public
 * zone's FIRST client island rests on that one fact, and this file is what
 * makes CLAUDE.md's claim about it true rather than aspirational.
 *
 * What it protects, and it is two distinct things:
 *
 *  - **Nothing at all reaches the script-off HTML.** Not a hidden div, not an
 *    empty <nav>. The claim in the spec is the strong one — the rail's absence
 *    costs nothing because every heading it indexes is already in the prose
 *    beneath it — and a server-rendered shell would quietly weaken it.
 *  - **No dead control, and no undismissable one.** The hover panel is a list
 *    of `#fragment` anchors. Server-render them "so the TOC is there on first
 *    paint" and the page grows a fixed-position list over the text that WORKS
 *    but can never be hidden, because hiding it is the hover state that needs
 *    the script. That failure mode is worse than absence, which is why the gate
 *    lives in an OUTER component: no browser-only hook is ever called during a
 *    server render, and moving the gate inward fails here loudly rather than at
 *    request time.
 *
 * No jsdom, like lib/palette-mount.test.ts: renderToStaticMarkup is exactly the
 * no-DOM path being exercised, and needing a DOM to run it would defeat the
 * point.
 */

async function renderScriptOff(element: unknown): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToStaticMarkup(element as any);
}

async function rail(): Promise<unknown> {
  const React = await import("react");
  const { TocRail } = await import("@/components/toc-rail");
  return React.createElement(TocRail);
}

test("the TOC rail server-renders nothing at all", async () => {
  const html = await renderScriptOff(await rail());
  assert.equal(html, "");
});

test("no navigation reaches the script-off HTML", async () => {
  const html = await renderScriptOff(await rail());
  assert.ok(!html.includes("<a"), html);
  assert.ok(!html.includes("<nav"), html);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test 2>&1 | grep -B2 -A6 "toc-mount\|toc rail"`
Expected: FAIL — `Cannot find module '@/components/toc-rail'`.

- [ ] **Step 3: Write the rail**

Create `components/toc-rail.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { shouldRenderToc, TOC_MIN_HEADINGS, tocState, type TocHeading } from "@/lib/toc";

/**
 * The reading position, as a column of dashes in the left gutter — and the
 * PUBLIC ZONE'S FIRST CLIENT ISLAND.
 *
 * It is also the mildest exception in the repo, in the strong sense the media
 * picker's rule uses: it renders NOTHING until it mounts, so script-off the
 * page is byte-for-byte what it was, and its absence never costs anything —
 * every heading it points at is already in the prose beneath it, in document
 * order, with an id on it. The rail adds no destination, no control and no
 * information of its own. It is a position indicator for a document you can
 * already read. And it never writes: no form, no server action, no submit.
 *
 * The gate lives in this OUTER component so no browser-only hook is ever
 * called during a server render. lib/toc-mount.test.ts fails loudly if it moves
 * inward.
 */
export function TocRail() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <MountedTocRail />;
}

/** How far down the viewport the "reading line" sits. A heading counts as read
 *  once it crosses it — the top third, so the active row advances as a section
 *  arrives rather than as it leaves. */
const READING_LINE = 1 / 3;

function MountedTocRail() {
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    // The ids are rehypeSlug's, already on the rendered headings — so the
    // anchors cannot drift from their targets, because they are READ from the
    // targets. See lib/toc.ts for why this is not a server-side extraction.
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("main h2[id], main h3[id]"),
    );
    setHeadings(
      nodes.map((node) => ({
        id: node.id,
        text: (node.textContent ?? "").trim(),
        level: node.tagName === "H3" ? 3 : 2,
      })),
    );
    if (nodes.length < TOC_MIN_HEADINGS) return;

    // The last heading above the reading line. Recomputed from rects rather
    // than inferred from which entries are intersecting: that answer is correct
    // at the bottom of the document too, where the final heading may never
    // become the topmost visible one because the section under it is short.
    const compute = () => {
      const line = window.innerHeight * READING_LINE;
      let next = -1;
      nodes.forEach((node, index) => {
        if (node.getBoundingClientRect().top <= line) next = index;
      });
      setActive(next);
    };

    // An observer, not a scroll listener: a scroll handler runs on every frame
    // of every scroll on a page whose whole job is to be read. Shrinking the
    // root's bottom to the reading line makes the observer fire on exactly the
    // crossings that can change the answer.
    const observer = new IntersectionObserver(compute, {
      rootMargin: `0px 0px -${(1 - READING_LINE) * 100}% 0px`,
    });
    nodes.forEach((node) => observer.observe(node));
    compute();
    return () => observer.disconnect();
  }, []);

  if (!shouldRenderToc(headings)) return null;

  return (
    <nav
      aria-label="On this page"
      /* `hidden xl:block`: below that breakpoint the max-w-3xl column leaves no
         gutter to sit in, and a rail over the text is worse than none. */
      className="group fixed left-6 top-1/2 z-30 hidden -translate-y-1/2 xl:block"
    >
      {/* The dashes. aria-hidden — the panel below carries the same headings as
          real links, and announcing both would say the document's outline
          twice. */}
      <ul
        aria-hidden="true"
        className="flex flex-col gap-2 opacity-100 transition-opacity duration-200 group-hover:opacity-0 group-focus-within:opacity-0"
      >
        {headings.map((heading, index) => (
          <li key={heading.id} className="flex h-2 items-center">
            <span
              className={
                "h-0.5 rounded-full transition-all duration-200 " +
                (heading.level === 3 ? "w-2.5 " : "w-4 ") +
                DASH[tocState(index, active)]
              }
            />
          </li>
        ))}
      </ul>

      {/* The words, on hover or keyboard focus. The only place this rail
          carries text. `invisible` rather than opacity alone so the links are
          not tab-reachable while hidden — the rail must not put a dozen
          invisible stops in the tab order of every page. */}
      <div className="invisible absolute left-0 top-1/2 w-64 -translate-y-1/2 rounded-xl border bg-popover/95 p-3 opacity-0 shadow-lg backdrop-blur transition-opacity duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <ul className="flex flex-col gap-1">
          {headings.map((heading, index) => (
            <li key={heading.id} className={heading.level === 3 ? "pl-3" : undefined}>
              <a
                href={`#${heading.id}`}
                aria-current={tocState(index, active) === "active" ? "location" : undefined}
                className={
                  "block truncate rounded-md px-2 py-1 text-xs transition-colors hover:bg-accent/50 " +
                  LINK[tocState(index, active)]
                }
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

/* The three states, drawn. Default is faint rather than absent: the rail's
   length is itself information — it says how much document there is. */
const DASH: Record<ReturnType<typeof tocState>, string> = {
  passed: "bg-foreground/40",
  active: "bg-foreground",
  default: "bg-foreground/15",
};

const LINK: Record<ReturnType<typeof tocState>, string> = {
  passed: "text-muted-foreground",
  active: "text-foreground font-medium",
  default: "text-muted-foreground/60",
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test 2>&1 | tail -20`
Expected: `fail 0`.

- [ ] **Step 5: Verify the build compiles**

Run: `npm run build 2>&1 | tail -30`
Expected: build succeeds. This is the step that catches a server/client import mistake in the layout from Task 6.

- [ ] **Step 6: Commit**

```bash
git add components/toc-rail.tsx lib/toc-mount.test.ts
git commit -m "A reading-position rail: three states, and nothing at all without script"
```

---

## Task 8: The plant head

**Files:**
- Create: `app/(public)/_components/plant-head.tsx`
- Modify: `app/(public)/(chrome)/plant/[slug]/page.tsx`

- [ ] **Step 1: Write the head**

Create `app/(public)/_components/plant-head.tsx`:

```tsx
import type { Plant } from "@/lib/data";
import { initialsOf } from "@/lib/glyphs";
import { cloudinaryThumb } from "@/lib/image-url";
import { roleLine } from "@/lib/plant-role";
import { statusLabel, statusOf } from "@/lib/plant-status";
import { CrownIcon, ZapIcon, ZapOffIcon } from "@/components/public-icons";
import { Badge } from "@/components/ui/badge";

/**
 * The public plant's head — the admin hero's composition, with every editor
 * removed.
 *
 * A SERVER component. Nothing here opens, nothing here writes, nothing here is
 * a button: the admin's five triggers become five plain facts. That is the
 * whole difference between the two files, and it is why this one is not a
 * shared component with app/admin/_components/plant-hero.tsx — they share a
 * SHAPE, not an implementation, and the admin's is a client island wired to
 * server actions.
 *
 * What they DO share is the vocabulary: the words come from lib/plant-role.ts
 * and lib/plant-status.ts, and the glyphs are lucide's own path data
 * (components/public-icons.tsx), so the crown here is the crown there.
 *
 * VISIBILITY is not on this page and never will be. A private plant
 * notFound()s, so every plant that renders here is public by construction, and
 * a globe icon would be a fact with no counterexample.
 */

/** The mark's shape — the admin hero's radius, as a PERCENTAGE so the same
 *  class is right at every size it is rendered at. */
const SQUIRCLE = "rounded-[28%]";

export function PlantHead({
  plant,
  name,
  description,
  roleDetail,
}: {
  plant: Plant;
  /** Already resolved to the reading language by the page. */
  name: string;
  description: string;
  roleDetail: string;
}) {
  const status = statusOf(plant);
  return (
    <header className="flex flex-col items-center gap-5 text-center">
      {/* The mark, WITH an initials fallback the old left-aligned header did
          not have — and it is forced by the layout, not a flourish. A
          left-aligned logo can be absent and the title simply moves up; a
          CENTRED stack with a missing first element collapses into something
          that reads as broken rather than as logo-less. The fallback is the one
          the garden table, the palette and the admin hero already draw, so a
          plant with no mark looks the same in all four places.

          Decorative either way: the name is the very next element. */}
      <div
        aria-hidden="true"
        className={`size-28 overflow-hidden bg-muted text-muted-foreground ${SQUIRCLE}`}
      >
        {plant.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cloudinaryThumb(plant.logo.url, { width: 224, height: 224 })}
            alt=""
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center font-heading text-3xl tracking-tight">
            {initialsOf(name)}
          </span>
        )}
      </div>

      {/* Profane, and `font-normal` is mandatory rather than a style choice:
          the family ships ONE weight, and app/globals.css records that every
          user pairs it with font-normal so nothing asks it for a bold it does
          not have. */}
      <h1 className="font-display text-4xl font-normal tracking-tight sm:text-5xl">{name}</h1>

      {description ? (
        <p className="max-w-prose text-base text-muted-foreground">{description}</p>
      ) : null}

      {/* Role and status, each an icon and its word.

          BOTH are always present, which overturns this page's old rule — a
          status badge rendered only when inactive, because "active is the
          unmarked default everywhere and a badge saying so on every plant page
          would be noise". That reasoning was right about a BADGE. It is not
          right about an icon+label pair, which is the register this row is now
          in: `⚡ Active` beside `♔ Lead` reads as one of two facts stated about
          the plant, where a lone pill in a strip of pills reads as an assertion
          demanding attention. The admin hero states both unconditionally for
          the same reason. The rule is recorded here rather than deleted so it
          does not come back as a bug report. */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-heading text-xs uppercase tracking-widest text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CrownIcon className="size-3.5" />
          {roleLine(plant.role)}
        </span>
        <span
          className={"flex items-center gap-1.5 " + (status === "active" ? "text-primary" : "")}
        >
          {status === "active" ? (
            <ZapIcon className="size-3.5" />
          ) : (
            <ZapOffIcon className="size-3.5" />
          )}
          {statusLabel(status)}
        </span>
      </div>

      {/* The role's one line of context. Never markdown — plants already have
          `content` for prose. */}
      {roleDetail ? <p className="max-w-prose text-sm text-muted-foreground">{roleDetail}</p> : null}

      {plant.natures.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-1.5">
          {plant.natures.map((nature) => (
            <Badge key={nature} variant="secondary">
              {nature}
            </Badge>
          ))}
        </div>
      ) : null}
    </header>
  );
}
```

- [ ] **Step 2: Rewrite the page's header**

In `app/(public)/(chrome)/plant/[slug]/page.tsx`:

Replace the import block's first ten lines with:

```tsx
import { notFound } from "next/navigation";
import { resolveText, textPart } from "@/lib/data";
import { currentLang } from "@/lib/locale-server";
import { getPublicDataset } from "@/lib/store";
import { resolveEntity } from "@/lib/entity-resolve";
import { PlantHead } from "@/app/(public)/_components/plant-head";
import { ProfanePreload } from "@/components/brand/profane-preload";
import { Prose } from "@/components/markdown";
```

(`roleLine`, `statusLabel`, `statusOf`, `cloudinaryThumb` and `Badge` all move into `PlantHead`; drop those five imports from the page.)

Then replace the entire `<header className="flex flex-col gap-3"> … </header>` block — everything from `<header` through its closing `</header>` — with:

```tsx
      {/* Only pages that wear the face ask for it: the plant page is the
          display face's second wearer, after the landing. */}
      <ProfanePreload />
      <PlantHead
        plant={plant}
        name={resolveText(plant.name, lang)}
        description={resolveText(plant.description ?? "", lang).trim()}
        roleDetail={roleDetail}
      />
```

Leave `roleDetail`, `pods`, `beans`, `<Prose>` and the "Inside" nav exactly as they are.

- [ ] **Step 3: Verify types and build**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: no errors. If `resolveText` or `textPart` is reported unused, remove only the genuinely unused one.

Run: `npm run build 2>&1 | tail -20`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/_components/plant-head.tsx" "app/(public)/(chrome)/plant/[slug]/page.tsx"
git commit -m "The public plant wears its head the way the admin edits it"
```

---

## Task 9: The reference card becomes one link

**Files:**
- Modify: `components/entity.tsx`

- [ ] **Step 1: Rewrite `EntityCard`'s return**

In `components/entity.tsx`, replace everything from `return (` down to the closing `);` of `EntityCard` (the `<Card>` … `</Card>` block) with:

```tsx
  return (
    // The anchor wraps the CARD, not the image — and that placement is
    // load-bearing. components/ui/card.tsx ships `has-[>img:first-child]:pt-0`
    // and `*:[img:first-child]:rounded-t-xl`, and BOTH selectors match a
    // direct-child <img> only: an anchor around the image silently opts out and
    // produces an inset band with square corners instead of a flush one.
    // Wrapping the whole card keeps the image where those selectors can see it.
    //
    // The whole card is the link now, where only the name line used to be — the
    // cover and the description were dead pixels over a link-shaped object. One
    // anchor, one destination, no nesting: the name below is a <span>, so
    // nothing needs an aria-hidden or a tabIndex={-1} to suppress a duplicate,
    // and the accessible name is still the entity's name.
    <a href={entity.href} className="not-prose group my-4 block no-underline">
      <Card className="transition-shadow group-hover:shadow-md">
        {entity.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            // The card renders at the reading column's full width
            // (app/(public)/(chrome)/layout.tsx: `max-w-3xl px-6` -> 768px -
            // 2*24px = 720px at its widest) and h-32 (128px) tall, so 1440x256
            // is that box doubled for a 2x display. Matching the box's own
            // aspect ratio (~5.6:1), rather than picking a rounder but narrower
            // number, keeps Cloudinary's c_fill crop aligned with what
            // object-cover shows instead of cropping a differently-shaped box.
            //
            // Decorative: the name below carries the accessible name.
            src={cloudinaryThumb(entity.cover.url, { width: 1440, height: 256 })}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-32 w-full object-cover"
          />
        ) : null}
        {/* py-8: the card sits in 16px prose now and needs the room. */}
        <CardContent className="flex flex-col gap-1 py-8">
          <span className="text-sm font-medium underline-offset-4 group-hover:underline">
            {entity.name}
          </span>
          {entity.description ? (
            <p className="text-xs text-muted-foreground">{entity.description}</p>
          ) : null}
        </CardContent>
      </Card>
    </a>
  );
```

- [ ] **Step 2: Verify types, tests and build**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: no errors.

Run: `npm test 2>&1 | tail -20`
Expected: `fail 0`.

- [ ] **Step 3: Commit**

```bash
git add components/entity.tsx
git commit -m "The whole reference card is the link, and it has room to breathe"
```

---

## Task 10: CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the sixth exception**

In `CLAUDE.md`, immediately BEFORE the line that reads:

```
Those five are the whole list. Every *other* admin metadata form is unchanged
```

insert:

```markdown
- **The public TOC rail is the sixth, and the first one outside the admin**
  (`components/toc-rail.tsx`, the public-plant-page slice). `app/(public)` had
  no client JS at all; it now has exactly one island. On plant, pod and bean
  pages a column of dashes in the left gutter shows the reading position, in
  three states — passed, active, default — and reveals the headings as links on
  hover.

  It is the mildest exception on this list. It **renders nothing until it
  mounts**, so script-off the page is byte-for-byte what it was, and **its
  absence costs nothing** in the media picker's strong sense: every heading it
  indexes is already in the prose beneath it, in document order, with an `id` on
  it. The rail adds no destination, no control and no information of its own —
  it is a position indicator for a document you can already read. And it
  **never writes**: no form, no server action, no submit.

  Its headings come from a **DOM scan on mount** (`main h2[id], main h3[id]`),
  not from a server-side extraction, and that is deliberate: `lib/markdown.ts`
  already runs `rehypeSlug`, so scanning reads exactly what was emitted and the
  anchors cannot drift from their targets. A server-side extractor would be a
  *fourth reader of the one corpus* — the shape the tiptap slice's conformance
  work found five defects in. Only the arithmetic is pure and tested
  (`lib/toc.ts`, `lib/toc.test.ts`); `lib/toc-mount.test.ts` pins the absence.
```

- [ ] **Step 2: Add the two neighbours**

In the same file, in the paragraph beginning "Three neighbours are worth naming", change "Three neighbours" to "Four neighbours", and append this bullet after the glyphs one:

```markdown
- The public chrome (`app/(public)/_components/public-chrome.tsx`) and the plant
  head (`app/(public)/_components/plant-head.tsx`). Both are **server**
  components, and both had to work at it. Two rules keep the public zone's
  no-script promise while it grows a floating rail and an icon-and-label header:

  > **No lucide in a public server component.** `lucide-react` routes every icon
  > through an `Icon.mjs` carrying `"use client"`, so one `<Crown />` is one
  > client boundary. `components/media.tsx` states the rule; this slice obeys it
  > with `components/public-icons.tsx` — five inline `<svg aria-hidden>` glyphs
  > carrying lucide's own path data (ISC), so the two zones still draw the same
  > vocabulary.
  >
  > **No registry Tooltip in the public chrome.** It is `"use client"` too, and
  > using it would make *navigation* script-dependent to gain a hover label.
  > `components/icon-link.tsx` does the label in CSS instead, with the
  > accessible name on the anchor's `aria-label` rather than on the visual span.

  That second one is a deviation from "never hand-roll what the registry has",
  and it is the good direction of the trade: the hand-rolled version is strictly
  more capable *in this zone*, because it works with script off. The admin keeps
  the real `Tooltip`.
```

- [ ] **Step 3: Verify the count claim is now consistent**

Run: `grep -n "Those five are the whole list\|Three neighbours\|Four neighbours" CLAUDE.md`
Expected: `Four neighbours` present; `Three neighbours` absent.

Then change `Those five are the whole list.` to `Those six are the whole list.` and re-run the grep to confirm.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "CLAUDE.md: the sixth exception, and the public zone's two no-script rules"
```

---

## Task 11: Full verification

**Files:** none modified.

- [ ] **Step 1: The whole suite**

Run: `npm test 2>&1 | tail -25`
Expected: `fail 0`. Confirm `lib/toc.test.ts` and `lib/toc-mount.test.ts` appear in the run.

- [ ] **Step 2: Types**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output.

- [ ] **Step 3: Lint**

Run: `npx next lint 2>&1 | tail -20`
Expected: no errors. Warnings about `<img>` are expected — every one is already suppressed with an inline `eslint-disable-next-line @next/next/no-img-element`.

- [ ] **Step 4: Build**

Run: `npm run build 2>&1 | tail -30`
Expected: build succeeds with no type or import errors.

- [ ] **Step 5: Confirm the public zone still has exactly one client module**

Run: `grep -rln "use client" "app/(public)" components/public-icons.tsx components/icon-link.tsx "app/(public)/_components"`
Expected: **no output.** The only `"use client"` this slice adds is `components/toc-rail.tsx`, which lives outside those paths.

Run: `grep -rn "lucide-react" "app/(public)" components/public-icons.tsx components/icon-link.tsx`
Expected: **no output.**

- [ ] **Step 6: Commit anything outstanding**

```bash
git status --short
```

Expected: clean. If not, inspect before committing.

---

## Deferred to later specs / follow-ups

- **The pod and bean heads.** They get the chrome, the 16px prose and the TOC rail, but keep their
  plain `h1`. A pod has no logo, role or status to build a centred head from; giving them one is a
  separate decision about what a pod *is*, not a styling task.
- **The landing page's chrome.** Left alone deliberately — it is the front door and wears the mark
  large and centred. If it ever wants the language switch, that is one line and its own call.
- **The TOC on narrow viewports.** `hidden xl:block` today. A drawer or a top progress bar for
  tablet and phone is a real feature with its own interaction design, not a breakpoint tweak.
- **`h4`+ in the rail.** Two levels is what the content has. Deepening it is a change to `lib/toc.ts`'s
  `level` union and the DOM query, and should wait until a page actually nests that far.
