# Admin hub & scope — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a plant the admin's subject — the root lists plants, the chrome carries a plant scope in `?plant=`, every section narrows to it, and the plant page becomes a hub.

**Architecture:** All routing/scope/filter rules land in pure, JSX-free `lib/` modules that `npm test` can reach (`admin-nav`, `admin-scope`, `sprouts`, `plant-hub`, `greeting`, `inbox-filter`). Pages stay server components that read `loadRawGarden()` and render shared table components; the only new client island is the plant switcher, which renders plain anchors and therefore writes nothing.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind v4 + shadcn on Base UI, `node:test` via `npm test`.

**Spec:** [`docs/superpowers/specs/2026-09-12-admin-hub-scope-design.md`](../specs/2026-09-12-admin-hub-scope-design.md)

> **Tailwind note for whoever edits this file:** Tailwind v4 scans `docs/` as source text, so a class name in a code fence here is minted into the stylesheet. Every class quoted below already exists elsewhere in the repo. Don't invent new ones in this document — put them in the component.

---

## File Structure

**Created**

| file | responsibility |
|---|---|
| `lib/admin-scope.ts` | the scope rule: read it from a URL, build the hrefs that change it |
| `lib/admin-scope.test.ts` | its tests |
| `lib/sprouts.ts` | `lib/vault.ts`, renamed, plus `SPROUT_KEYS` |
| `lib/sprouts.test.ts` | `lib/vault.test.ts`, renamed |
| `lib/plant-hub.ts` | a plant's full bean set, and its hub counts |
| `lib/plant-hub.test.ts` | its tests |
| `lib/greeting.ts` | `Date` → "Good morning/afternoon/evening" |
| `lib/greeting.test.ts` | its tests |
| `lib/inbox-filter.ts` | seeds narrowed by suggested plant |
| `lib/inbox-filter.test.ts` | its tests |
| `app/admin/inbox/page.tsx` | the seed table, moved from `app/admin/page.tsx` |
| `app/admin/sprouts/page.tsx` | the sprout table, moved from `app/admin/vault/page.tsx` |
| `app/admin/pods/page.tsx` | the pod index |
| `app/admin/beans/page.tsx` | the bean index |
| `app/admin/_components/plant-table.tsx` | the root's plant table, rendered twice |
| `app/admin/_components/pod-table.tsx` | pod rows — section + hub |
| `app/admin/_components/bean-table.tsx` | bean rows — section + hub |
| `app/admin/_components/sprout-table.tsx` | sprout rows — section + hub |
| `app/admin/_components/screen-strip.tsx` | the hub's thumbnail row (plain anchors) |
| `app/admin/_components/plant-switcher.tsx` | the scope control (client island) |
| `app/admin/_components/palette-search.tsx` | the root's bare autocomplete shell |
| `app/admin/_components/preview-panel.tsx` | heading + count + `all n →` wrapper |

**Modified**

| file | change |
|---|---|
| `lib/admin-nav.ts` | ids, six items, `navItems(scope)`, `navHref`, new SECTIONS, root column |
| `lib/admin-nav.test.ts` | follows |
| `app/admin/_components/section-icons.ts` | keyed by id, six + overview |
| `lib/section-icons.test.ts` | follows |
| `lib/palette-items.ts` | `sectionItems()` off ids; new GROUPS |
| `lib/palette.ts` | regrouped rows |
| `lib/palette.test.ts` | follows |
| `app/admin/_components/command-palette.tsx` | split: `PaletteAutocomplete` + dialog shell |
| `app/admin/page.tsx` | becomes the welcome page |
| `app/admin/plant/[slug]/page.tsx` | becomes the hub |
| `app/admin/_components/plant-inside.tsx` | becomes `PlantRail`, Exhibition only |
| `app/admin/_components/admin-chrome.tsx` | top-left cluster, scope-aware rail |
| `app/admin/layout.tsx` | reads the garden, passes plant marks |
| `app/admin/screens/page.tsx` | honours the scope |
| `app/admin/actions.ts` | redirect targets |
| `next.config.ts` | two redirects |
| `CLAUDE.md`, `README.md` | the map they describe |

**Deleted:** `app/admin/garden/page.tsx`, `app/admin/vault/page.tsx`, `lib/vault.ts`, `lib/vault.test.ts`.

---

## Task 1: The nav model learns ids, six sections and a scope

**Files:**
- Modify: `lib/admin-nav.ts`
- Test: `lib/admin-nav.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the contents of `lib/admin-nav.test.ts` with:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, navHref, navItems, resolveColumn, resolveNavItem } from "./admin-nav";

test("the six sections are the nav, in order", () => {
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.id),
    ["inbox", "pods", "beans", "sprouts", "screens", "beanstalk"],
  );
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.href),
    [
      "/admin/inbox",
      "/admin/pods",
      "/admin/beans",
      "/admin/sprouts",
      "/admin/screens",
      "/admin/beanstalk",
    ],
  );
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.label),
    ["Inbox", "Pods", "Beans", "Sprouts", "Screens", "Beanstalk"],
  );
});

test("the root is not a section — it lights nothing", () => {
  assert.equal(resolveNavItem("/admin"), null);
  assert.equal(resolveNavItem("/admin/"), null);
});

test("section roots resolve to themselves", () => {
  assert.equal(resolveNavItem("/admin/inbox"), "/admin/inbox");
  assert.equal(resolveNavItem("/admin/pods"), "/admin/pods");
  assert.equal(resolveNavItem("/admin/beans"), "/admin/beans");
  assert.equal(resolveNavItem("/admin/sprouts"), "/admin/sprouts");
  assert.equal(resolveNavItem("/admin/beanstalk"), "/admin/beanstalk");
});

test("detail routes resolve to the section they belong to", () => {
  assert.equal(resolveNavItem("/admin/sprout/my-sprout"), "/admin/sprouts");
  assert.equal(resolveNavItem("/admin/bean/abc123"), "/admin/beans");
  assert.equal(resolveNavItem("/admin/pod/some-pod"), "/admin/pods");
  assert.equal(resolveNavItem("/admin/triage/abc123"), "/admin/inbox");
});

test("a plant page belongs to Overview, which only exists when scoped", () => {
  assert.equal(resolveNavItem("/admin/plant/ariko"), "/admin/plant/ariko");
});

test("login belongs to no section", () => {
  assert.equal(resolveNavItem("/admin/login"), null);
});

test("an unknown admin route highlights nothing", () => {
  assert.equal(resolveNavItem("/admin/nowhere"), null);
  assert.equal(resolveNavItem("/"), null);
});

test("a prefix must end at a segment boundary", () => {
  assert.equal(resolveNavItem("/admin/podsy"), null);
  assert.equal(resolveNavItem("/admin/beanstalked"), null);
  assert.equal(resolveNavItem("/admin/screenshots"), null);
  assert.equal(resolveNavItem("/admin/screen/karma-top"), null);
});

test("unscoped, the rail is exactly NAV_ITEMS", () => {
  assert.deepEqual(navItems(null), NAV_ITEMS);
});

test("scoped, Overview leads and Beanstalk steps aside", () => {
  const items = navItems("ariko");
  assert.deepEqual(
    items.map((i) => i.id),
    ["overview", "inbox", "pods", "beans", "sprouts", "screens"],
  );
  assert.equal(items[0].href, "/admin/plant/ariko");
  assert.equal(items[0].label, "Overview");
});

test("a scoped slug is encoded into Overview's href", () => {
  assert.equal(navItems("a b/c")[0].href, "/admin/plant/a%20b%2Fc");
});

test("navHref carries the scope to a section and leaves Overview alone", () => {
  assert.equal(navHref(NAV_ITEMS[1], "ariko"), "/admin/pods?plant=ariko");
  assert.equal(navHref(NAV_ITEMS[1], null), "/admin/pods");
  const overview = navItems("ariko")[0];
  assert.equal(navHref(overview, "ariko"), "/admin/plant/ariko");
});

test("every section index reads in the wide column", () => {
  for (const item of NAV_ITEMS) assert.equal(resolveColumn(item.href), "wide", item.href);
});

test("the welcome page is wide too — it holds two tables", () => {
  assert.equal(resolveColumn("/admin"), "wide");
  assert.equal(resolveColumn("/admin/"), "wide");
});

test("detail pages read in the same column the public site does", () => {
  assert.equal(resolveColumn("/admin/plant/ariko"), "reading");
  assert.equal(resolveColumn("/admin/pod/some-pod"), "reading");
  assert.equal(resolveColumn("/admin/bean/abc123"), "reading");
  assert.equal(resolveColumn("/admin/sprout/my-sprout"), "reading");
  assert.equal(resolveColumn("/admin/triage/abc123"), "reading");
  assert.equal(resolveColumn("/admin/screens/karma-top"), "reading");
});

test("login is bare — it has no chrome to clear", () => {
  assert.equal(resolveColumn("/admin/login"), "bare");
  assert.equal(resolveColumn("/admin/login/"), "bare");
});

test("an unknown route reads rather than sprawls", () => {
  assert.equal(resolveColumn("/admin/nowhere"), "reading");
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm test 2>&1 | grep -A3 "admin-nav"`
Expected: failures — `navItems` and `navHref` are not exported.

- [ ] **Step 3: Rewrite `lib/admin-nav.ts`**

Keep the file's existing docblock intent but update it to the new rules. Full contents:

```ts
/**
 * The admin rail's model. Pure and JSX-free so `npm test` can reach it: the
 * rail itself is a client component, and icons are bound to these ids there.
 *
 * The rail has a SUBJECT now (lib/admin-scope.ts). Two things follow, and both
 * are why `navItems` exists rather than a conditional in the component:
 *
 *  - scoped, the rail gains **Overview** — the plant's own page, the one item
 *    that cannot aggregate, since the all-plants overview IS the root;
 *  - scoped, it loses **Beanstalk** — it merges sprouts with pollen envelopes
 *    from sibling repos, and an envelope has no plant, so a filtered Beanstalk
 *    would answer half its own question and hide the other half.
 *
 * `id` rather than `href` is the key SECTION_ICONS uses, because Overview's
 * href is per-plant and an href-keyed map cannot hold an icon for it.
 *
 * "/admin" is no longer a section: it is the welcome page, reached by the mark
 * in the top-left cluster. That retires the exact-match special case this file
 * used to open with — the root now lights nothing, like any non-section.
 */

export type NavId =
  | "overview"
  | "inbox"
  | "pods"
  | "beans"
  | "sprouts"
  | "screens"
  | "beanstalk";

export interface NavItem {
  id: NavId;
  href: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "inbox", href: "/admin/inbox", label: "Inbox" },
  { id: "pods", href: "/admin/pods", label: "Pods" },
  { id: "beans", href: "/admin/beans", label: "Beans" },
  { id: "sprouts", href: "/admin/sprouts", label: "Sprouts" },
  { id: "screens", href: "/admin/screens", label: "Screens" },
  { id: "beanstalk", href: "/admin/beanstalk", label: "Beanstalk" },
];

/** The rail for a given scope. See the docblock for why it is a function. */
export function navItems(scope: string | null): NavItem[] {
  if (!scope) return NAV_ITEMS;
  return [
    {
      id: "overview",
      href: `/admin/plant/${encodeURIComponent(scope)}`,
      label: "Overview",
    },
    ...NAV_ITEMS.filter((item) => item.id !== "beanstalk"),
  ];
}

/**
 * A rail item's href, carrying the scope. Overview already IS the scope, so it
 * is left alone — appending ?plant= to a plant's own page would be a second
 * spelling of the same fact, and `resolveScope` would then have two sources to
 * disagree about.
 */
export function navHref(item: NavItem, scope: string | null): string {
  if (!scope || item.id === "overview") return item.href;
  return `${item.href}?plant=${encodeURIComponent(scope)}`;
}

// [route prefix, the nav href it lights]. Order is irrelevant — no prefix here
// is a prefix of another, and the boundary check below is what keeps that true
// as routes are added.
const SECTIONS: ReadonlyArray<readonly [string, string]> = [
  ["/admin/inbox", "/admin/inbox"],
  ["/admin/triage", "/admin/inbox"],
  ["/admin/pods", "/admin/pods"],
  ["/admin/pod", "/admin/pods"],
  ["/admin/beans", "/admin/beans"],
  ["/admin/bean", "/admin/beans"],
  ["/admin/sprouts", "/admin/sprouts"],
  ["/admin/sprout", "/admin/sprouts"],
  ["/admin/screens", "/admin/screens"],
  ["/admin/beanstalk", "/admin/beanstalk"],
];

/**
 * The href of the nav item a pathname belongs to, or null when it belongs to
 * none (the welcome page, the login page, and anything unrecognized — an
 * unknown route lights nothing rather than guessing).
 *
 * A plant page resolves to ITSELF, which is how Overview lights: the rail's
 * Overview href for scope `s` is `/admin/plant/s`, and that is the pathname.
 */
export function resolveNavItem(pathname: string): string | null {
  const path = normalize(pathname);
  if (path.startsWith(PLANT_PREFIX_PATH)) return path;
  for (const [prefix, href] of SECTIONS) {
    // The boundary check is what keeps "/admin/podsy" out of Pods.
    if (path === prefix || path.startsWith(`${prefix}/`)) return href;
  }
  return null;
}

function normalize(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

/** Which measure a route reads in — see `components/page-column.tsx`. */
export type Column = "bare" | "wide" | "reading";

/**
 * The admin's column, from its pathname.
 *
 * **A section index is wide, the welcome page is wide, everything else reads,
 * and login is bare.** The section indexes are exactly the NAV_ITEMS hrefs, so
 * this reads NAV_ITEMS rather than a parallel array that could drift from it.
 * The root is spelled as its own clause rather than pushed back into NAV_ITEMS,
 * because it is not a section — it is the page the sections hang off.
 *
 * An unrecognized route gets the reading column rather than the wide one.
 * Detail pages outnumber indexes and always will, and a document that renders
 * 80px too narrow is a smaller wrong than one that renders 280px too wide.
 */
export function resolveColumn(pathname: string): Column {
  const path = normalize(pathname);
  if (path === LOGIN_PATH) return "bare";
  if (path === ROOT_PATH) return "wide";
  return NAV_ITEMS.some((item) => item.href === path) ? "wide" : "reading";
}

const LOGIN_PATH = "/admin/login";
const ROOT_PATH = "/admin";
const PLANT_PREFIX_PATH = "/admin/plant/";
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npm test 2>&1 | grep -E "admin-nav|^# (pass|fail)"`
Expected: `admin-nav` tests pass. `section-icons` and `palette` tests now FAIL — Tasks 2 and 3 fix them.

- [ ] **Step 5: Do not commit yet**

The suite is red until Task 3. Move straight on.

---

## Task 2: `SECTION_ICONS` keyed by id

**Files:**
- Modify: `app/admin/_components/section-icons.ts`
- Test: `lib/section-icons.test.ts`

- [ ] **Step 1: Write the failing test**

Replace `lib/section-icons.test.ts` with:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, navItems, type NavId } from "./admin-nav";
import { SECTION_ICONS } from "@/app/admin/_components/section-icons";

/**
 * The rail and the palette draw the sections from ONE map, and this is what
 * keeps it honest: an item with no icon beside it is the defect that shipped
 * when Screens was added — the palette fell through to its generic section icon
 * and two sections became the same picture, silently, past `tsc` and past every
 * other test in this suite.
 *
 * Keyed by `id` since the scope slice: Overview's href is per-plant, so an
 * href-keyed map could not hold an icon for it and this test would have had to
 * be weakened to let it through.
 */

// Every id the rail can ever render — Overview included, which NAV_ITEMS alone
// does not contain.
const EVERY_ID = new Set([...NAV_ITEMS, ...navItems("any-plant")].map((i) => i.id));

test("every rail item has an icon", () => {
  for (const id of EVERY_ID) assert.ok(id in SECTION_ICONS, id);
});

test("and no icon outlives its section", () => {
  // Narrowed rather than widening the map: `Object.keys` gives string[], and
  // the assertion's meaning is about NavIds.
  for (const id of Object.keys(SECTION_ICONS) as NavId[]) assert.ok(EVERY_ID.has(id), id);
});

test("no two sections draw the same icon", () => {
  const icons = Object.values(SECTION_ICONS);
  assert.equal(new Set(icons).size, icons.length);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test 2>&1 | grep -B2 -A6 "section-icons"`
Expected: FAIL — `"overview" in SECTION_ICONS` is false.

- [ ] **Step 3: Re-key the map**

In `app/admin/_components/section-icons.ts`, change the import line and the map (leave the docblock, updating its last paragraph to say the map is keyed by `NavId`):

```ts
import { Bean, Flower2, Images, Inbox, Package, Sprout, Waypoints } from "lucide-react";
import type { ComponentType } from "react";
import type { NavId } from "@/lib/admin-nav";

export const SECTION_ICONS: Record<NavId, ComponentType<{ className?: string }>> = {
  overview: Flower2,
  inbox: Inbox,
  pods: Package,
  beans: Bean,
  sprouts: Sprout,
  screens: Images,
  beanstalk: Waypoints,
};
```

The four icons chosen for the new ids are the ones `command-palette.tsx` already
draws for those kinds (`Flower2` plant, `Package` pod, `Bean` bean, `Sprout`
sprout), so a pod looks like a pod in the rail, in the palette's "Go to" rows
and in its pod rows alike.

- [ ] **Step 4: Run it and watch it pass**

Run: `npm test 2>&1 | grep -A4 "section-icons"`
Expected: the three section-icons tests pass.

---

## Task 3: The palette follows the rename

**Files:**
- Modify: `lib/palette-items.ts`, `lib/palette.ts`
- Test: `lib/palette.test.ts`

- [ ] **Step 1: Update `lib/palette-items.ts`**

`PaletteItem` keeps its shape. Change `GROUPS` and `sectionItems`:

```ts
/** The group headings, in the order the palette renders them. */
export const GROUPS = ["Go to", "Plants", "Pods", "Beans", "Sprouts", "Inbox"] as const;

/**
 * The "Go to" rows — the sections, built from the rail's own model rather than
 * re-typed, so a new section appears in both places or in neither. The UNSCOPED
 * rail: the palette is a navigator, and Overview is a destination that only
 * means something relative to a scope the palette does not have.
 */
export function sectionItems(): PaletteItem[] {
  return NAV_ITEMS.map((nav) => ({
    id: `section:${nav.id}`,
    kind: "section" as const,
    label: nav.label,
    href: nav.href,
    group: "Go to",
  }));
}
```

**Re-keying the map is a breaking change to its call sites, so they move in
this same commit** — `tsc` does not tolerate the gap, and `lib/palette-render.test.ts`
mounts the real `command-palette.tsx` rather than a stub. Three consumers:

- `app/admin/_components/admin-chrome.tsx` — `SECTION_ICONS[item.href]` becomes
  `SECTION_ICONS[item.id]`. Nothing else in that file moves here; the rail's
  scope-awareness is Task 14.
- `app/admin/_components/command-palette.tsx` — a section row's id is
  `section:<NavId>` now, so `iconFor` strips the prefix instead of looking up an
  href. Export `SECTION_ID_PREFIX = "section:"` from `lib/palette-items.ts` and
  use it in both `sectionItems()` and `iconFor`, so the two halves of the id
  grammar cannot drift.
- `lib/palette-render.test.ts` — its fixture names the old groups and section
  ids. Update the FIXTURE, not what the test proves: it exists to show rows
  render grouped in `GROUPS` order with empty groups dropped, and must still
  show that.

- [ ] **Step 2: Update `lib/palette.ts` groups**

In `buildPaletteIndex`, change four `group:` values — plants `"Garden"` →
`"Plants"`, pods `"Garden"` → `"Pods"`, beans `"Vault"` → `"Beans"`, sprouts
`"Vault"` → `"Sprouts"`. Seeds stay `"Inbox"`. No href changes: every detail
route is unmoved.

- [ ] **Step 3: Update `lib/palette.test.ts`**

Two assertions move. At the `sectionItems()` comparison (around line 138),
rebuild the expected rows from the new model:

```ts
const items = NAV_ITEMS.map((nav) => ({
  id: `section:${nav.id}`,
  kind: "section" as const,
  label: nav.label,
  href: nav.href,
  group: "Go to",
}));
assert.deepEqual(sectionItems(), items);
```

And at the grouping test (around line 177):

```ts
assert.deepEqual(
  groupPaletteItems(items).map((g) => g.value),
  ["Go to", "Plants", "Pods", "Beans", "Sprouts", "Inbox"],
);
```

Fix the comment under it — it says "Garden is plants then pods; Vault is beans
then sprouts" and each group now holds one kind.

- [ ] **Step 4: Run the whole suite green**

Run: `npm test 2>&1 | tail -15`
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add lib/admin-nav.ts lib/admin-nav.test.ts lib/section-icons.test.ts \
  app/admin/_components/section-icons.ts lib/palette-items.ts lib/palette.ts lib/palette.test.ts
git commit -m "admin: six sections, keyed by id, named for their tier"
```

---

## Task 4: `lib/admin-scope.ts`

**Files:**
- Create: `lib/admin-scope.ts`, `lib/admin-scope.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/admin-scope.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveScope, scopeHref, scopeKeys } from "./admin-scope";

test("the hub's own slug is the scope", () => {
  assert.equal(resolveScope("/admin/plant/ariko", {}), "ariko");
  assert.equal(resolveScope("/admin/plant/ariko/", {}), "ariko");
});

test("an encoded slug comes back decoded", () => {
  assert.equal(resolveScope("/admin/plant/a%20b", {}), "a b");
});

test("elsewhere the scope is the query", () => {
  assert.equal(resolveScope("/admin/sprouts", { plant: "pebbles" }), "pebbles");
  assert.equal(resolveScope("/admin/screens", { plant: "  " }), null);
  assert.equal(resolveScope("/admin/screens", {}), null);
});

test("the path wins over a contradicting query", () => {
  assert.equal(resolveScope("/admin/plant/ariko", { plant: "pebbles" }), "ariko");
});

test("a repeated query key cannot become a scope", () => {
  // ?plant=a&plant=b reaches a page as string[]. It must narrow to nothing
  // rather than stringify into "a,b".
  assert.equal(resolveScope("/admin/sprouts", { plant: ["a", "b"] as unknown as string }), null);
});

test("a filtering section keeps its other dimensions", () => {
  assert.equal(
    scopeHref("/admin/sprouts", { state: "draft", tag: "wip" }, "pebbles"),
    "/admin/sprouts?state=draft&plant=pebbles&tag=wip",
  );
});

test("All drops the key and keeps the section", () => {
  assert.equal(scopeHref("/admin/sprouts", { state: "draft", plant: "x" }, null), "/admin/sprouts?state=draft");
  assert.equal(scopeHref("/admin/screens", { plant: "x" }, null), "/admin/screens");
});

test("from the root, picking a plant opens its hub", () => {
  assert.equal(scopeHref("/admin", {}, "pebbles"), "/admin/plant/pebbles");
  assert.equal(scopeHref("/admin", {}, null), "/admin");
});

test("from a hub, switching goes to the other hub and All comes home", () => {
  assert.equal(scopeHref("/admin/plant/ariko", {}, "pebbles"), "/admin/plant/pebbles");
  assert.equal(scopeHref("/admin/plant/ariko", {}, null), "/admin");
});

test("an unrecognised route is treated as unfilterable, not as a section", () => {
  // A detail page has no filter dimensions to preserve, so switching from one
  // takes you to the plant rather than pinning a query onto a page that would
  // ignore it.
  assert.equal(scopeHref("/admin/bean/abc", {}, "pebbles"), "/admin/plant/pebbles");
  assert.equal(scopeHref("/admin/bean/abc", {}, null), "/admin");
});

test("a slug with URL syntax survives every href", () => {
  assert.equal(scopeHref("/admin", {}, "a b/c"), "/admin/plant/a%20b%2Fc");
  assert.equal(scopeHref("/admin/pods", {}, "a b"), "/admin/pods?plant=a+b");
});

test("every filtering section names its keys, and plant is one of them", () => {
  for (const [path, keys] of Object.entries(scopeKeys)) {
    assert.ok(keys.includes("plant"), path);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test 2>&1 | grep -A3 "admin-scope"`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/admin-scope.ts`**

> **Superseded — read the file, not this block.** The code below is the version
> as first planned. Code review found four real defects in it and they are fixed
> in the shipped module: `"all"` now reads as no scope (it was written by
> `scopeHref` and never read back); the plant URL grammar moved to
> `lib/plant-path.ts` and is shared with `resolveNavItem`, which parsed it by a
> different rule; the key map is keyed by `NavId` so it cannot drift from
> `NAV_ITEMS`; a malformed escape returns `null` rather than a raw slug; and two
> docblock paragraphs that described mechanisms the code does not use are gone.
> Any later task touching this module must read `lib/admin-scope.ts` and
> `lib/plant-path.ts` as they stand.

```ts
import { filterHref, type FilterValues } from "./admin-filters";
import { SCREEN_FILTER_KEYS } from "./screens";
import { SPROUT_KEYS } from "./sprouts";

/**
 * The admin's SUBJECT, and the one place that knows how to change it.
 *
 * The scope is a plant, and it lives in the URL — `?plant=` on a section, and
 * the slug itself on `/admin/plant/[slug]`. Not a cookie: `lib/admin-filters.ts`
 * exists to keep a filtered view shareable and filtering server-side, and the
 * scope is a filter with a better control, not a different kind of thing. Not a
 * path prefix: that is truer to Vercel and costs a duplicate page module per
 * section for the scoped and unscoped forms, to reach the same behaviour.
 *
 * Pure and JSX-free, so `npm test` reaches the rule rather than the chrome
 * that renders it.
 */

/** Filtering sections, and the dimensions each one admits. `filterHref` needs
 *  a NAMED key list — it is what keeps a hand-typed query key from surviving a
 *  click — so the scope control needs to know, per route, what that list is. */
export const scopeKeys: Record<string, readonly string[]> = {
  "/admin/inbox": ["plant"],
  "/admin/pods": ["plant"],
  "/admin/beans": ["plant", "pod"],
  "/admin/sprouts": SPROUT_KEYS,
  "/admin/screens": SCREEN_FILTER_KEYS,
};

const HUB_PREFIX = "/admin/plant/";
const ROOT = "/admin";

function normalize(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function hubHref(slug: string): string {
  return `${HUB_PREFIX}${encodeURIComponent(slug)}`;
}

/**
 * The scoped plant, or null.
 *
 * The hub's own slug wins over any `?plant=`, so the switcher never reads "All"
 * while the page under it is a plant, and a stray query on a hub URL cannot
 * make the chrome contradict the page.
 *
 * `String(...)` rather than a plain read for the reason `filterQuery` gives: a
 * REPEATED query key reaches a Next page as `string[]`, which this type does
 * not admit but a URL can always produce. An array stringifies to "a,b", which
 * is a slug no plant has — so the guard below turns it into no scope at all
 * rather than into a phantom one.
 */
export function resolveScope(pathname: string, active: FilterValues): string | null {
  const path = normalize(pathname);
  if (path.startsWith(HUB_PREFIX)) {
    const slug = path.slice(HUB_PREFIX.length);
    if (slug && !slug.includes("/")) return safeDecode(slug);
  }
  const raw = active.plant;
  if (Array.isArray(raw)) return null;
  const value = String(raw ?? "").trim();
  return value ? value : null;
}

function safeDecode(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    // A malformed escape is not a slug. Returning it raw keeps the chrome
    // showing something the garden will simply fail to resolve, which renders
    // as "All" — the same place every other unresolvable scope lands.
    return slug;
  }
}

/**
 * Where a switcher row points: stay on a filtering section and set the
 * dimension, or go to the plant's hub. `null` means All — which drops the key
 * on a section, and comes home to the root from anywhere else.
 */
export function scopeHref(
  pathname: string,
  active: FilterValues,
  slug: string | null,
): string {
  const path = normalize(pathname);
  const keys = scopeKeys[path];
  if (keys) return filterHref(path, active, keys, "plant", slug ?? "all");
  return slug ? hubHref(slug) : ROOT;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npm test 2>&1 | grep -A4 "admin-scope"`
Expected: pass — *after* Task 5 provides `lib/sprouts.ts`. If `SPROUT_KEYS`
cannot resolve yet, do Task 5 first and return here.

- [ ] **Step 5: Commit (with Task 5)**

---

## Task 5: `lib/vault.ts` becomes `lib/sprouts.ts`

**Files:**
- Create: `lib/sprouts.ts`, `lib/sprouts.test.ts`
- Delete: `lib/vault.ts`, `lib/vault.test.ts`

- [ ] **Step 1: Move the files with git**

```bash
git mv lib/vault.ts lib/sprouts.ts
git mv lib/vault.test.ts lib/sprouts.test.ts
```

- [ ] **Step 2: Rename the symbols**

In `lib/sprouts.ts`: `VaultFilters` → `SproutFilters`, `filterVaultEntries` →
`filterSproutEntries`. Add the key list the vault page used to spell inline, so
`lib/admin-scope.ts` and the page read one definition:

```ts
/** The section's dimensions, named for `filterHref` — the list that decides
 *  which keys a filter URL may carry. It lived in the page while the page was
 *  the only caller; the scope control is the second. */
export const SPROUT_KEYS = ["state", "plant", "tag"] as const;
```

Keep the existing `STATES`, `filterSproutEntries`, `distinctPlants` and
`distinctTags` bodies untouched. Update the file's comments where they say
"vault".

In `lib/sprouts.test.ts`: update the import and the two renamed symbols. Add:

```ts
test("the section's dimensions are state, plant and tag", () => {
  assert.deepEqual([...SPROUT_KEYS], ["state", "plant", "tag"]);
});
```

- [ ] **Step 3: Point the remaining importer at it**

`app/admin/vault/page.tsx` is the only other importer today; Task 8 moves it.
For now update its import so `tsc` stays clean:

```bash
grep -rn "lib/vault\|filterVaultEntries" --include="*.ts" --include="*.tsx" app components lib
```

Expected after edits: only `app/admin/vault/page.tsx`, which Task 8 deletes.

- [ ] **Step 4: Run the suite**

Run: `npm test 2>&1 | tail -5`
Expected: `# fail 0`.

- [ ] **Step 5: Commit Tasks 4 and 5 together**

```bash
git add lib/admin-scope.ts lib/admin-scope.test.ts lib/sprouts.ts lib/sprouts.test.ts app/admin/vault/page.tsx
git commit -m "admin: the scope rule, and a vault that admits it lists sprouts"
```

---

## Task 6: `lib/plant-hub.ts` — the bean rollup

**Files:**
- Create: `lib/plant-hub.ts`, `lib/plant-hub.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDataset, type RawGarden } from "./data";
import { beansForPlantDeep, podsForPlantSorted } from "./plant-hub";

const GARDEN: RawGarden = {
  plants: [
    { slug: "ariko", name: "Ariko", description: "", role: { kind: "owner" } },
    { slug: "empty", name: "Empty", description: "", role: { kind: "owner" } },
  ],
  pods: [
    { slug: "studio", name: "Studio", description: "", parents: ["plant:ariko"] },
    { slug: "atelier", name: "Atelier", description: "", parents: ["plant:ariko"] },
  ],
  beans: [
    { slug: "direct", name: "Direct", parents: ["plant:ariko"] },
    { slug: "in-pod", name: "In pod", parents: ["pod:studio"] },
    // Parented to BOTH — the case that makes a naive concat count it twice.
    { slug: "both", name: "Both", parents: ["pod:atelier", "plant:ariko"] },
    { slug: "elsewhere", name: "Elsewhere", parents: ["plant:other"] },
  ],
};

test("a plant's beans are its own plus every pod's, deduped and sorted", () => {
  const beans = beansForPlantDeep(buildDataset(GARDEN), "ariko");
  assert.deepEqual(
    beans.map((b) => b.slug),
    ["both", "direct", "in-pod"],
  );
});

test("a plant with neither pods nor beans has none", () => {
  assert.deepEqual(beansForPlantDeep(buildDataset(GARDEN), "empty"), []);
});

test("an unknown plant has none rather than throwing", () => {
  assert.deepEqual(beansForPlantDeep(buildDataset(GARDEN), "nope"), []);
});

test("pods come back sorted by name", () => {
  assert.deepEqual(
    podsForPlantSorted(buildDataset(GARDEN), "ariko").map((p) => p.slug),
    ["atelier", "studio"],
  );
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test 2>&1 | grep -A3 "plant-hub"`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/plant-hub.ts`**

```ts
import { resolveText, type Bean, type Dataset, type Pod } from "./data";

/**
 * What a plant contains, as the hub and the sections both need it.
 *
 * `Dataset.beansForPlant` is beans parented DIRECTLY to the plant. A plant's
 * real bean set is that plus the beans of each of its pods, and composing it at
 * a page would be a fourth way to miss one: lib/palette.ts's docblock already
 * names the trap — there is no whole-bean accessor on Dataset, and faking one
 * out of beansForPlant + beansForPod + standaloneBeans is three chances to drop
 * a bean.
 *
 * One definition, two callers — the hub's preview and `/admin/beans` scoped to
 * a plant — so the preview's count and the section's count are the same number
 * by construction rather than by coincidence.
 */

function byName(a: { name: unknown }, b: { name: unknown }): number {
  return resolveText(a.name as never).localeCompare(resolveText(b.name as never));
}

/** Every bean under a plant: its own, and every pod's. Deduped by slug — a
 *  bean may name both a pod and that pod's plant in `parents`. */
export function beansForPlantDeep(dataset: Dataset, slug: string): Bean[] {
  const seen = new Map<string, Bean>();
  for (const bean of dataset.beansForPlant(slug)) seen.set(bean.slug, bean);
  for (const pod of dataset.podsForPlant(slug)) {
    for (const bean of dataset.beansForPod(pod.slug)) seen.set(bean.slug, bean);
  }
  return [...seen.values()].sort(byName);
}

/** A plant's pods, by name. The order the hub and the section both show. */
export function podsForPlantSorted(dataset: Dataset, slug: string): Pod[] {
  return [...dataset.podsForPlant(slug)].sort(byName);
}
```

If `byName`'s cast reads badly to you, give it a concrete signature instead —
`(a: { name: Text }, b: { name: Text })` with `Text` imported. Pick one and use
it in both sorts.

- [ ] **Step 4: Run it and watch it pass**

Run: `npm test 2>&1 | grep -A4 "plant-hub"`
Expected: the four tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/plant-hub.ts lib/plant-hub.test.ts
git commit -m "admin: a plant's beans are its own plus every pod's"
```

---

## Task 7: `lib/greeting.ts` and `lib/inbox-filter.ts`

**Files:**
- Create: `lib/greeting.ts`, `lib/greeting.test.ts`, `lib/inbox-filter.ts`, `lib/inbox-filter.test.ts`

- [ ] **Step 1: Write both failing tests**

`lib/greeting.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { greeting } from "./greeting";

const at = (hour: number) => new Date(2026, 8, 12, hour, 0, 0);

test("the day has three parts", () => {
  assert.equal(greeting(at(0)), "Good morning");
  assert.equal(greeting(at(11)), "Good morning");
  assert.equal(greeting(at(12)), "Good afternoon");
  assert.equal(greeting(at(17)), "Good afternoon");
  assert.equal(greeting(at(18)), "Good evening");
  assert.equal(greeting(at(23)), "Good evening");
});
```

`lib/inbox-filter.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Seed } from "./data";
import { filterSeedsByPlant } from "./inbox-filter";

const seed = (id: string, plantSlug?: string): Seed =>
  ({
    id,
    title: id,
    body: {},
    media: [],
    status: "inbox",
    createdAt: "2026-09-12T00:00:00.000Z",
    source: { kind: "manual" },
    ...(plantSlug ? { suggested: { plantSlug } } : {}),
  }) as unknown as Seed;

const SEEDS = [seed("a", "ariko"), seed("b", "pebbles"), seed("c"), seed("d", "ghost")];

test("no scope is no filter", () => {
  assert.equal(filterSeedsByPlant(SEEDS, null).length, 4);
});

test("a scope keeps only the seeds that suggest it", () => {
  assert.deepEqual(
    filterSeedsByPlant(SEEDS, "ariko").map((s) => s.id),
    ["a"],
  );
});

test("a seed suggesting nothing is not evidence of membership", () => {
  // It appears under All and nowhere else — the rule plantMark already follows
  // when it declines to draw an avatar for an unresolvable suggestion.
  assert.equal(
    filterSeedsByPlant(SEEDS, "ariko").some((s) => s.id === "c"),
    false,
  );
});

test("a suggestion naming nothing real simply matches nothing real", () => {
  assert.deepEqual(
    filterSeedsByPlant(SEEDS, "ghost").map((s) => s.id),
    ["d"],
  );
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test 2>&1 | grep -E "greeting|inbox-filter" | head`
Expected: module-not-found failures.

- [ ] **Step 3: Write both modules**

`lib/greeting.ts`:

> **Superseded — read the file.** The version below reads `now.getHours()`,
> which is the timezone of the RUNTIME, not of the reader. This repo deploys to
> Vercel (UTC) and its author reads in Paris, so it greets "Good evening" at
> 01:30 and "Good morning" at 14:30 — about four wrong hours a day. The shipped
> function takes a `timeZone` parameter defaulting to `"Europe/Paris"` and
> resolves the hour through `Intl`, which stays pure and needs no island. The
> "deliberate shrug" paragraph below argued a false dichotomy and is gone.

```ts
/**
 * The welcome page's one line. Pure so the boundaries are testable — a
 * greeting computed inline in a server component is a string nobody can assert
 * on, and the boundaries are the only thing about it worth asserting.
 *
 * Server-rendered, so it reads the SERVER's clock. That is a deliberate
 * shrug: the alternative is an island whose only job is to know the hour, and
 * this page has better islands to spend.
 */
export function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
```

`lib/inbox-filter.ts`:

```ts
import type { Seed } from "./data";

/**
 * The inbox, narrowed to a plant.
 *
 * A seed's plant is a SUGGESTION that arrived over the wire from a sibling
 * repo's lab note, so it can name a plant that was renamed or never existed.
 * The inbox already refuses to draw an avatar for one it cannot resolve
 * (`plantMark` in app/admin/inbox/page.tsx); filtering follows the same rule
 * from the other side — an absent suggestion is not evidence of membership, so
 * a seed that suggests nothing appears under All and under no plant.
 *
 * Unresolvable-but-present is left alone on purpose: `?plant=ghost` narrows to
 * the seeds that say "ghost", which is exactly what was asked for, and the
 * chrome above will be reading "All" because the garden has no such plant.
 */
export function filterSeedsByPlant(seeds: Seed[], plant: string | null): Seed[] {
  if (!plant) return seeds;
  return seeds.filter((seed) => seed.suggested?.plantSlug === plant);
}
```

- [ ] **Step 4: Run them and watch them pass**

Run: `npm test 2>&1 | tail -5`
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add lib/greeting.ts lib/greeting.test.ts lib/inbox-filter.ts lib/inbox-filter.test.ts
git commit -m "admin: a greeting, and an inbox that can be narrowed"
```

---

## Task 8: Move the routes

**Files:**
- Create: `app/admin/inbox/page.tsx`, `app/admin/sprouts/page.tsx`
- Delete: `app/admin/garden/page.tsx`, `app/admin/vault/page.tsx`
- Modify: `app/admin/actions.ts`, `next.config.ts`

`app/admin/page.tsx` is rewritten in Task 13; until then it keeps its current
contents and is simply also reachable at `/admin/inbox`.

- [ ] **Step 1: Move the inbox**

```bash
mkdir -p app/admin/inbox
git mv app/admin/page.tsx app/admin/inbox/page.tsx
```

In the moved file, change the exported function name `AdminPage` →
`AdminInboxPage`. Nothing else changes yet (Task 12 adds the scope).

- [ ] **Step 2: Move the vault**

```bash
mkdir -p app/admin/sprouts
git mv app/admin/vault/page.tsx app/admin/sprouts/page.tsx
rmdir app/admin/vault
```

In the moved file: rename `VaultPage` → `AdminSproutsPage`; import
`filterSproutEntries` and `SPROUT_KEYS` from `@/lib/sprouts`; delete the local
`VAULT_KEYS` const; change every `/admin/vault` string to `/admin/sprouts`; and
change the two headings and the failure copy from "Vault" to "Sprouts"
("Couldn't load the sprouts.").

**Do not skip the `VAULT_KEYS` deletion.** The page still declares its own copy
of that list under a near-verbatim copy of `SPROUT_KEYS`' docblock — two
definitions of one list, which the rename commit left transitional on the
explicit promise that this step ends it.

- [ ] **Step 3: Delete the garden**

```bash
git rm app/admin/garden/page.tsx
```

- [ ] **Step 4: Repoint the actions**

```bash
grep -n "/admin/vault\|/admin/garden" app/admin/actions.ts
```

Change every `/admin/vault` to `/admin/sprouts`. For the six `/admin/garden`
targets, read each one: a redirect after a *plant* write goes to that plant's
hub (`/admin/plant/<slug>`) where the action has the slug, and otherwise to
`/admin`. Prefer the hub wherever the slug is in hand — a save that returns you
to the thing you saved is the point of the hub.

- [ ] **Step 5: Add the redirects**

In `next.config.ts`, inside the config object:

```ts
async redirects() {
  return [
    { source: "/admin/garden", destination: "/admin", permanent: false },
    { source: "/admin/vault", destination: "/admin/sprouts", permanent: false },
  ];
},
```

`permanent: false` — a 308 is cached by browsers forever, and these are
conveniences for bookmarks, not promises.

- [ ] **Step 6: Tidy the one test that names a dead route**

`lib/admin-filters.test.ts` uses `"/admin/vault"` as an arbitrary base string in
four assertions. Nothing breaks if it stays, but a test naming a route that no
longer exists is a test that reads as stale. Change the base to
`"/admin/sprouts"` in all four, expectations included.

- [ ] **Step 7: Verify**

```bash
grep -rn "/admin/vault\|/admin/garden" --include="*.ts" --include="*.tsx" app components lib
```
Expected: only the two `next.config.ts` sources.

Run: `npm test 2>&1 | tail -5` → `# fail 0`
Run: `npx tsc --noEmit` → clean

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "admin: the inbox and the sprouts get addresses of their own"
```

---

## Task 9: The table components

**Files:**
- Create: `app/admin/_components/plant-table.tsx`, `pod-table.tsx`, `bean-table.tsx`, `sprout-table.tsx`, `preview-panel.tsx`

All five are **server** components (no `"use client"`). They import the glyph
island, which carries its own directive, exactly as the pages do today.

- [ ] **Step 1: `preview-panel.tsx`**

```tsx
import type { ReactNode } from "react";

/**
 * A hub preview: a heading, the count, the rows, and the way out to the
 * section that owns them. The wrapper is here rather than repeated four times
 * so the four previews cannot disagree about what a preview looks like.
 *
 * `allHref` is the section pre-filtered by ?plant=, built by the page — this
 * component composes no query and learns no key name.
 */
export function PreviewPanel({
  title,
  count,
  allHref,
  children,
}: {
  title: string;
  count: number;
  allHref: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-heading text-base tracking-tight">
          {title} <span className="text-muted-foreground">({count})</span>
        </h2>
        {count > 0 ? (
          <a
            href={allHref}
            className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            all {count} →
          </a>
        ) : null}
      </div>
      {count === 0 ? <p className="text-sm text-muted-foreground">nothing yet</p> : children}
    </section>
  );
}
```

- [ ] **Step 2: `plant-table.tsx`**

Rows are prepared by the page; this draws them. Lift the row markup out of the
deleted `app/admin/garden/page.tsx` (name cell with `EntityAvatar`, slug under
the name, then the glyph cells), minus tier and visibility.

```tsx
import {
  EntityAvatar,
  NarrativeGlyph,
  RoleGlyph,
  StatusGlyph,
} from "@/components/admin/glyphs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PlantStatus, PlantRoleKind, Visibility } from "@/lib/data";

export interface PlantRow {
  slug: string;
  name: string;
  logoUrl?: string;
  role: { kind: PlantRoleKind; label: string };
  status: PlantStatus;
  hasNarrative: boolean;
  /** Which of the two tables the row belongs to. The table draws no column for
   *  it — the heading above it is the column. */
  visibility: Visibility;
}

/**
 * The root's plant table — rendered twice, once per visibility, which is why
 * it is a component and not markup in the page: two tables that differ only in
 * their rows must not be two pieces of markup that can drift.
 *
 * There is no visibility column, deliberately. The two tables ARE the
 * visibility, and a column repeating the heading of the table it sits in is a
 * column saying nothing. There is no tier column either: only plants are here.
 */
export function PlantTable({ rows }: { rows: PlantRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>name</TableHead>
          <TableHead>role</TableHead>
          <TableHead>status</TableHead>
          <TableHead>narrative</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.slug}>
            <TableCell>
              <div className="flex items-center gap-2.5">
                <EntityAvatar mark={{ name: row.name, logoUrl: row.logoUrl }} />
                <div className="flex flex-col leading-tight">
                  <a
                    href={`/admin/plant/${encodeURIComponent(row.slug)}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {row.name}
                  </a>
                  <span className="font-heading text-xs text-muted-foreground">{row.slug}</span>
                </div>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">
              <RoleGlyph kind={row.role.kind} label={row.role.label} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              <StatusGlyph status={row.status} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {row.hasNarrative ? <NarrativeGlyph /> : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 3: `pod-table.tsx`**

```tsx
import { NarrativeGlyph, VisibilityGlyph, EntityAvatarGlyph, type EntityMark } from "@/components/admin/glyphs";
import type { Visibility } from "@/lib/data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface PodRow {
  slug: string;
  name: string;
  visibility: Visibility;
  hasNarrative: boolean;
  beanCount: number;
  plant?: EntityMark;
}

/**
 * Pod rows — `/admin/pods` and the hub's preview, one file, two callers.
 * `limit` is what differs; `showPlant` is the other parameter, because the hub
 * is already inside a plant and a column repeating it would be noise.
 */
export function PodTable({
  rows,
  limit,
  showPlant = true,
}: {
  rows: PodRow[];
  limit?: number;
  showPlant?: boolean;
}) {
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>name</TableHead>
          {showPlant ? <TableHead>plant</TableHead> : null}
          <TableHead>beans</TableHead>
          <TableHead>visibility</TableHead>
          <TableHead>narrative</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shown.map((row) => (
          <TableRow key={row.slug}>
            <TableCell>
              <div className="flex flex-col leading-tight">
                <a
                  href={`/admin/pod/${encodeURIComponent(row.slug)}`}
                  className="underline-offset-4 hover:underline"
                >
                  {row.name}
                </a>
                <span className="font-heading text-xs text-muted-foreground">{row.slug}</span>
              </div>
            </TableCell>
            {showPlant ? (
              <TableCell>
                {row.plant ? (
                  <EntityAvatarGlyph mark={row.plant} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            ) : null}
            <TableCell className="text-muted-foreground">{row.beanCount}</TableCell>
            <TableCell>
              <VisibilityGlyph visibility={row.visibility} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {row.hasNarrative ? <NarrativeGlyph /> : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 4: `bean-table.tsx`**

Two tables that happen to rhyme, written out rather than generified — a shared
config object here would have more lines than both.

```tsx
import { EntityAvatarGlyph, VisibilityGlyph, type EntityMark } from "@/components/admin/glyphs";
import type { Visibility } from "@/lib/data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface BeanRow {
  slug: string;
  name: string;
  visibility: Visibility;
  sproutCount: number;
  /** The pod that holds it, where one does — a bean may skip the pod tier. */
  pod?: string;
  plant?: EntityMark;
}

/** Bean rows — `/admin/beans` and the hub's preview, one file, two callers. */
export function BeanTable({
  rows,
  limit,
  showPlant = true,
}: {
  rows: BeanRow[];
  limit?: number;
  showPlant?: boolean;
}) {
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>name</TableHead>
          {showPlant ? <TableHead>plant</TableHead> : null}
          <TableHead>pod</TableHead>
          <TableHead>sprouts</TableHead>
          <TableHead>visibility</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shown.map((row) => (
          <TableRow key={row.slug}>
            <TableCell>
              <div className="flex flex-col leading-tight">
                <a
                  href={`/admin/bean/${encodeURIComponent(row.slug)}`}
                  className="underline-offset-4 hover:underline"
                >
                  {row.name}
                </a>
                <span className="font-heading text-xs text-muted-foreground">{row.slug}</span>
              </div>
            </TableCell>
            {showPlant ? (
              <TableCell>
                {row.plant ? (
                  <EntityAvatarGlyph mark={row.plant} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            ) : null}
            <TableCell className="text-muted-foreground">{row.pod ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">{row.sproutCount}</TableCell>
            <TableCell>
              <VisibilityGlyph visibility={row.visibility} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 5: `sprout-table.tsx`**

The table currently inside `app/admin/sprouts/page.tsx`, lifted whole — the same
six columns, the same `Badge` for state, the same `EntityAvatarGlyph` for the
plant. It is a move, not a redesign: the page must look identical in the browser
afterwards.

```tsx
import { resolveText, type TimelineEntry } from "@/lib/data";
import { EntityAvatarGlyph } from "@/components/admin/glyphs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Sprout rows — `/admin/sprouts` and the hub's preview, one file, two callers. */
export function SproutTable({
  entries,
  limit,
  showPlant = true,
}: {
  entries: TimelineEntry[];
  limit?: number;
  showPlant?: boolean;
}) {
  const shown = limit ? entries.slice(0, limit) : entries;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>sprout</TableHead>
          <TableHead>state</TableHead>
          {showPlant ? <TableHead>plant</TableHead> : null}
          <TableHead>bean</TableHead>
          <TableHead>date</TableHead>
          <TableHead>tags</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shown.map((e) => (
          <TableRow key={e.sprout.slug}>
            <TableCell>
              {e.bean ? (
                <a
                  href={`/admin/bean/${encodeURIComponent(e.bean.slug)}`}
                  className="underline-offset-4 transition-colors hover:underline"
                >
                  {resolveText(e.sprout.name)}
                </a>
              ) : (
                resolveText(e.sprout.name)
              )}
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{e.sprout.state ?? "—"}</Badge>
            </TableCell>
            {showPlant ? (
              <TableCell>
                {e.plant ? (
                  <EntityAvatarGlyph
                    mark={{
                      name: resolveText(e.plant.name),
                      hint: e.plant.slug,
                      ...(e.plant.logo ? { logoUrl: e.plant.logo.url } : {}),
                    }}
                  />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            ) : null}
            <TableCell className="text-muted-foreground">{e.bean?.slug ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">{e.sprout.date}</TableCell>
            <TableCell className="text-muted-foreground">
              {(e.sprout.tags ?? []).join(", ") || "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

Then the page renders `<SproutTable entries={entries} />` where its table was.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` → clean
Run: `npm test 2>&1 | tail -5` → `# fail 0`
Run: `npm run lint` → clean

- [ ] **Step 7: Commit**

```bash
git add app/admin/_components app/admin/sprouts/page.tsx
git commit -m "admin: one file per tier's table, two callers each"
```

---

## Task 10: `/admin/pods`

**Files:**
- Create: `app/admin/pods/page.tsx`

- [ ] **Step 1: Write the page**

Model it on `app/admin/sprouts/page.tsx`: `dynamic = "force-dynamic"`, read
`loadRawGarden()` in a try/catch that renders the destructive `Alert` on
failure, build rows, render `AdminFilters` then the table.

```tsx
import { buildDataset, resolveText, textPart, PLANT_PREFIX, parentsWithPrefix } from "@/lib/data";
import { loadRawGarden } from "@/lib/store";
import { filterHref } from "@/lib/admin-filters";
import { resolveScope, scopeKeysFor } from "@/lib/admin-scope";
import { PodTable, type PodRow } from "../_components/pod-table";
import { AdminFilters, type FilterGroup } from "../_components/admin-filters";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

const PATH = "/admin/pods";
// The accessor, not a bare index: `tsconfig.json` has `strict` without
// `noUncheckedIndexedAccess`, so a bare `scopeKeys[PATH]` is typed as always
// present and a renamed path would reach `filterQuery` as undefined — "keys is
// not iterable" at runtime, clean through `tsc`, `npm test` and `npm run build`.
const KEYS = scopeKeysFor(PATH) ?? [];
```

Rows: for each pod, `plantSlug` is `parentsWithPrefix(pod.parents, PLANT_PREFIX)[0]`;
`beanCount` is `dataset.beansForPod(pod.slug).length`; `hasNarrative` is
`textPart(pod.content, "en").trim().length > 0`; `visibility` is
`pod.visibility ?? "public"`; `plant` is the `EntityMark` built the way
`app/admin/sprouts/page.tsx` builds its plant marks (name, hint: slug, logoUrl
when there is a logo), and **absent when the plant does not resolve** — the
unrooted-pod case, drawn as the em dash rather than as a wrong name.

Narrowing: `const scope = resolveScope(PATH, active)`, then keep rows whose
`plantSlug === scope` when `scope` is non-null.

The filter bar has one group, `plant`, whose options are `["all", ...distinct
plant slugs]` and whose hrefs come from `filterHref(PATH, active, KEYS, "plant",
opt)`. Sort rows by name. Show the `showing n of m` line the sprouts page shows.
Heading: `Pods`.

- [ ] **Step 2: Verify by eye**

```bash
npm run dev
```
Visit `http://localhost:3333/admin/pods`, then `…/admin/pods?plant=<a real slug>`,
then `…?plant=nope` (expect the empty state, not a crash). Stop the server.

- [ ] **Step 3: Commit**

```bash
git add app/admin/pods/page.tsx
git commit -m "admin: pods get an index"
```

---

## Task 11: `/admin/beans`

**Files:**
- Create: `app/admin/beans/page.tsx`

- [ ] **Step 1: Write the page**

The same shape as Task 10 with two dimensions, `plant` and `pod`
(`scopeKeysFor("/admin/beans")`). Rows carry `sproutCount` from
`dataset.sproutsForBean(bean.slug).length`, `pod` from
`parentsWithPrefix(bean.parents, POD_PREFIX)[0]`, and `plant` from
`dataset.plantForBean(bean.slug)` — the accessor that already resolves a bean's
plant through its pod, so a bean in a pod shows its plant here without this page
re-deriving containment.

**Narrowing by plant uses `beansForPlantDeep`**, not the row's own plant field:

```tsx
const scope = resolveScope(PATH, active);
const visible = scope
  ? new Set(beansForPlantDeep(dataset, scope).map((b) => b.slug))
  : null;
const rows = all.filter((row) => (visible ? visible.has(row.slug) : true));
```

That is the point of Task 6 — this count and the hub's preview count are the
same number because they are the same function.

- [ ] **Step 2: Verify by eye**

`npm run dev`, visit `/admin/beans` and `/admin/beans?plant=<slug>`; check that
a bean parented to a pod appears under that pod's plant. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add app/admin/beans/page.tsx
git commit -m "admin: beans get the index they never had"
```

---

## Task 12: Inbox and Screens honour the scope

**Files:**
- Modify: `app/admin/inbox/page.tsx`, `app/admin/screens/page.tsx`

- [ ] **Step 1: The inbox**

Widen its `searchParams` to `{ error?: string; plant?: string }`, and after the
seeds load:

```tsx
const scope = resolveScope("/admin/inbox", { plant });
const visible = filterSeedsByPlant(seeds ?? [], scope);
```

Render `visible` in the table, and put both numbers in the heading when a scope
is active — `Inbox (3 of 11)` — so a narrowed inbox never looks like an empty
one. Below the table, when `scope` is set and `visible.length < seeds.length`,
a muted line: `n more under All`, linking to `/admin/inbox`.

Add the plant filter bar the same way the other sections have one, so the
narrowing is reachable without the switcher.

- [ ] **Step 2: Screens**

`app/admin/screens/page.tsx` already filters on `plant` through
`filterScreens` — it needs nothing except to keep working, because the switcher
writes the same key. Confirm with:

```bash
grep -n "SCREEN_FILTER_KEYS\|filterScreens(" app/admin/screens/page.tsx lib/screens.ts
```

No edit if that holds. Do **not** add `?plant=` handling to the screen sheet
routes: they carry the query through `screensHref` already.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → clean
Run: `npm test 2>&1 | tail -5` → `# fail 0`

- [ ] **Step 4: Commit**

```bash
git add app/admin/inbox/page.tsx app/admin/screens/page.tsx
git commit -m "admin: the inbox narrows to a plant"
```

---

## Task 13: The welcome page

**Files:**
- Modify: `app/admin/page.tsx` (create it fresh — Task 8 moved the old one)
- Create: `app/admin/_components/palette-search.tsx`
- Modify: `app/admin/_components/command-palette.tsx`

- [ ] **Step 1: Split the palette**

In `command-palette.tsx`, extract everything between the `Autocomplete` open and
close tags — the input, the list, the groups, the rows, `iconFor`, `RowMark`,
the fetch-on-open effect and its state — into an exported
`PaletteAutocomplete({ autoFocus, onNavigate })` component in the same file.
`CommandPalette` keeps the hotkey, the trigger and the `Dialog` shell and
renders `<PaletteAutocomplete />` inside it.

Two details that must survive the split:

- the import stays `@/lib/palette-items`, **never** `@/lib/palette` — the latter
  reaches `lib/data.ts`, which opens with `node:fs`, and importing it from the
  browser fails the build rather than merely bloating it;
- `iconFor` already looks a section up by id (Task 3 moved it there) — leave it
  alone; the split must not change what a row draws.

- [ ] **Step 2: `palette-search.tsx`**

```tsx
"use client";

import { PaletteAutocomplete } from "./command-palette";

/**
 * The welcome page's search — the ⌘K index, inline and auto-focused.
 *
 * Not a second implementation: the input, the rows and the fetch are
 * `PaletteAutocomplete`, shared with the dialog in the chrome. What differs is
 * the shell, which is the whole of this file.
 *
 * Script-off it renders nothing, and costs nothing: every plant it can reach is
 * a row in a table below it.
 */
export function PaletteSearch() {
  return (
    <div className="mx-auto w-full max-w-xl">
      <PaletteAutocomplete autoFocus />
    </div>
  );
}
```

- [ ] **Step 3: Write `app/admin/page.tsx`**

```tsx
import { resolveText, textPart } from "@/lib/data";
import { loadRawGarden } from "@/lib/store";
import { greeting } from "@/lib/greeting";
import { roleLine } from "@/lib/plant-role";
import { statusOf } from "@/lib/plant-status";
import { visibilityOf } from "@/lib/plant-visibility";
import { PlantTable, type PlantRow } from "./_components/plant-table";
import { PaletteSearch } from "./_components/palette-search";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

/**
 * The admin's front door, and the whole point of the scope slice: the garden
 * used to open onto a table of plants AND pods, with a tier column to say which
 * was which and a visibility column to say which state each was in. Both
 * columns were the table apologising for mixing lists that were never one list.
 *
 * Here a plant is the subject. Published and private are two tables rather than
 * a column, and pods are not on this page at all — a pod without its plant is a
 * row that must say which plant it belongs to before it can say anything else,
 * which is exactly the column the old table needed.
 */
export default async function AdminPage() {
  let plants: PlantRow[] | null = null;
  let published: PlantRow[] = [];
  let priv: PlantRow[] = [];
  try {
    const raw = await loadRawGarden();
    plants = (raw.plants ?? []).map((p) => ({
      slug: p.slug,
      name: resolveText(p.name),
      ...(p.logo?.url ? { logoUrl: p.logo.url } : {}),
      // Composed here rather than in the glyph: the glyph is a client island
      // and lib/plant-role.ts reaches lib/data's runtime half.
      role: { kind: p.role.kind, label: roleLine(p.role) },
      status: statusOf(p),
      hasNarrative: textPart(p.content, "en").trim().length > 0,
      visibility: visibilityOf(p),
    })).sort((a, b) => a.name.localeCompare(b.name));
    published = plants.filter((p) => p.visibility === "public");
    priv = plants.filter((p) => p.visibility !== "public");
  } catch {
    plants = null;
  }

  return (
    <article className="flex flex-col gap-10">
      <section className="flex flex-col items-center gap-6 pt-4">
        <h1 className="font-heading text-2xl font-medium tracking-tight">{greeting(new Date())}</h1>
        <PaletteSearch />
      </section>

      {plants === null ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>Couldn&apos;t load the garden.</AlertDescription>
        </Alert>
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <h2 className="font-heading text-lg tracking-tight">
              Published <span className="text-muted-foreground">({published.length})</span>
            </h2>
            {published.length === 0 ? (
              <p className="text-sm text-muted-foreground">No published plants.</p>
            ) : (
              <PlantTable rows={published} />
            )}
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="font-heading text-lg tracking-tight">
              Private <span className="text-muted-foreground">({priv.length})</span>
            </h2>
            {priv.length === 0 ? (
              <p className="text-sm text-muted-foreground">No private plants.</p>
            ) : (
              <PlantTable rows={priv} />
            )}
          </section>
        </>
      )}
    </article>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → clean
Run: `npm test 2>&1 | tail -5` → `# fail 0` (`lib/palette-render.test.ts` renders
`CommandPalette`; if the split moved a prop it asserts on, fix the component,
not the test.)
Run: `npm run dev`, visit `/admin` — the input is focused on load, ⌘K still
opens the dialog, and both tables list plants. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add app/admin/page.tsx app/admin/_components/palette-search.tsx app/admin/_components/command-palette.tsx app/admin/_components/plant-table.tsx
git commit -m "admin: a front door that knows whose garden it is"
```

---

## Task 14: The chrome carries the scope

**Files:**
- Create: `app/admin/_components/plant-switcher.tsx`
- Modify: `app/admin/_components/admin-chrome.tsx`, `app/admin/layout.tsx`

- [ ] **Step 1: The layout reads the garden**

`PlantMark` is declared in `plant-switcher.tsx` (Step 2) and imported here — a
route file is a poor home for a type two components share, and a layout that
exports one invites imports pointing at `../layout`.

```tsx
import { Suspense } from "react";
import { resolveText } from "@/lib/data";
import { loadRawGarden } from "@/lib/store";
import { visibilityOf } from "@/lib/plant-visibility";
import type { PlantMark } from "./_components/plant-switcher";
```

In `AdminLayout`, before the return:

```tsx
// The switcher's trigger must draw the scoped plant's name and mark BEFORE its
// popover opens, so it cannot use the palette's fetch-on-open trick — that
// would flash "All" on every admin page load and routinely misstate the scope
// for as long as a round trip takes.
//
// The LIVE reader, never loadCachedGarden: CLAUDE.md's rule is that the admin
// and every server action read live, and the chrome is the surface most likely
// to be looked at immediately after a rename.
let plants: PlantMark[] = [];
try {
  plants = ((await loadRawGarden()).plants ?? []).map((p) => ({
    slug: p.slug,
    name: resolveText(p.name),
    ...(p.logo?.url ? { logoUrl: p.logo.url } : {}),
    visibility: visibilityOf(p),
  }));
} catch {
  plants = []; // an unreachable garden costs the switcher, never the page
}
```

Make the component `async`, and pass `<AdminChrome plants={plants} />`. The
layout is a server component and the chrome is a client one, so this is the
`ExhibitionPanel` pattern: the server composes, the island receives a prop.

- [ ] **Step 2: `plant-switcher.tsx`**

```tsx
"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { scopeHref } from "@/lib/admin-scope";
import { EntityAvatar } from "@/components/admin/glyphs";
import { ChromeItem, chromeItemClass } from "@/components/chrome";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Visibility } from "@/lib/data";

/** What the chrome needs to draw a plant: the layout composes these and hands
 *  them down, the way the plant page hands down its Exhibition panel. */
export interface PlantMark {
  slug: string;
  name: string;
  logoUrl?: string;
  visibility: Visibility;
}

/**
 * The admin's subject, as a control.
 *
 * EVERY ROW IS A PLAIN ANCHOR. Picking a plant is a navigation, not a write —
 * no server action, no cookie — which is what makes the resulting URL a
 * description of the view, and what makes this island inert rather than
 * destructive with script off: it simply never opens, and every destination it
 * offers is a row in a table on the root.
 *
 * Where each row points is `lib/admin-scope.ts`'s, not this file's: on a
 * filtering section it sets the dimension and keeps the others, and anywhere
 * else it opens the plant's hub.
 */
export function PlantSwitcher({ plants, scope }: { plants: PlantMark[]; scope: string | null }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = Object.fromEntries(params.entries());
  const current = scope ? plants.find((p) => p.slug === scope) : undefined;

  const published = plants.filter((p) => p.visibility === "public");
  const priv = plants.filter((p) => p.visibility !== "public");

  return (
    <Popover>
      <ChromeItem label="Switch plant">
        <PopoverTrigger
          aria-label={`Plant: ${current ? current.name : "All"}`}
          className={chromeItemClass()}
        >
          {current ? (
            <EntityAvatar mark={{ name: current.name, logoUrl: current.logoUrl }} className="size-4" />
          ) : (
            <ChevronsUpDown className="size-4" />
          )}
        </PopoverTrigger>
      </ChromeItem>
      <PopoverContent align="start" className="w-64 p-1">
        <ul className="flex flex-col">
          <li>
            <a href={scopeHref(pathname, active, null)} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
              All plants
            </a>
          </li>
          {[...published, ...priv].map((plant) => (
            <li key={plant.slug}>
              <a
                href={scopeHref(pathname, active, plant.slug)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <EntityAvatar mark={{ name: plant.name, logoUrl: plant.logoUrl }} className="size-4" />
                {plant.name}
              </a>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
```

The trigger's accessible name states the stored value — `Plant: Ariko`, not a
bare `Plant` — for the reason `lib/plant-hero-a11y.test.ts` pins on the hero's
five icons: the only place a reader learns what the scope currently IS is this
name.

If `EntityAvatar` does not accept a size through `className`, render it at its
default and drop the class rather than editing the glyph island.

- [ ] **Step 3: The chrome**

In `admin-chrome.tsx`:

```tsx
export function AdminChrome({ plants }: { plants: PlantMark[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  if (pathname === BARE) return null;

  const scope = resolveScope(pathname, Object.fromEntries(params.entries()));
  const active = resolveNavItem(pathname);
  const items = navItems(scope);
  // …
}
```

Render the rail from `items`, each `ChromeLink` with `href={navHref(item, scope)}`,
`key={item.id}` and `SECTION_ICONS[item.id]`. Add the new cluster above it:

```tsx
<Chrome magnet="top-left">
  <ChromeLink href="/admin" label="Ariko">
    <ArikoIcon className="size-4" />
  </ChromeLink>
  <PlantSwitcher plants={plants} scope={scope} />
</Chrome>
```

`ArikoIcon` is `components/brand/ariko-icon.tsx` — the generated mark. Do not
hand-edit it; `npm run brand:build` owns it.

Wrap the chrome in a `Suspense` boundary in the layout, because
`useSearchParams` requires one:

```tsx
<Suspense fallback={null}>
  <AdminChrome plants={plants} />
</Suspense>
```

`AdminMain` also reads the pathname; it needs no scope and no Suspense.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → clean
Run: `npm run build` → clean (this is the step that catches a missing Suspense)
Run: `npm run dev` and walk it: `/admin` → pick a plant → lands on the hub, the
rail shows Overview and no Beanstalk; click Sprouts → `?plant=` is in the URL
and the table is narrowed; click Screens → the plant is still there; pick All →
the scope is gone and Beanstalk is back.

- [ ] **Step 5: Commit**

```bash
git add app/admin/_components/plant-switcher.tsx app/admin/_components/admin-chrome.tsx app/admin/layout.tsx
git commit -m "admin: the chrome carries a plant, and the rail changes shape around it"
```

---

## Task 15: The hub

**Files:**
- Modify: `app/admin/plant/[slug]/page.tsx`, `app/admin/_components/plant-inside.tsx`
- Create: `app/admin/_components/screen-strip.tsx`

- [ ] **Step 1: `plant-inside.tsx` becomes `PlantRail`**

```bash
git mv app/admin/_components/plant-inside.tsx app/admin/_components/plant-rail.tsx
```

Remove the `items` prop, the `InsideItem` type, the `Boxes` import and the
Inside `Popover` entirely; keep the wrapper, the page-nudge, the rail and the
Exhibition popover exactly as they are. Rename the component to `PlantRail` and
rewrite the docblock's first paragraphs: the Inside panel existed because the
page had nowhere to put a plant's pods and beans, and the hub is that place now.
Keep every word about the Exhibition panel — including why this island composes
no payload, which `lib/exhibition-panel-source.test.ts` pins.

- [ ] **Step 2: `screen-strip.tsx`**

```tsx
import { cloudinaryFit } from "@/lib/image-url";

export interface StripItem {
  slug: string;
  name: string;
  url: string;
  alt: string;
}

/**
 * The hub's screens, as thumbnails.
 *
 * PLAIN ANCHORS, not the library's tiles. Those tiles are this repo's only
 * `next/link`, deliberately confined to the four files of the interception
 * slice so that a click in the library opens the side sheet; importing them
 * here would spread the library past its boundary, and
 * lib/screen-sheet-source.test.ts exists to notice. A click from the hub is an
 * ordinary navigation into the library — which is right, because the hub is not
 * a place to edit screens.
 */
export function ScreenStrip({ items }: { items: StripItem[] }) {
  return (
    <ul className="grid grid-cols-4 gap-3">
      {items.map((item) => (
        <li key={item.slug}>
          <a href={`/admin/screens/${encodeURIComponent(item.slug)}`} className="block">
            <img
              src={cloudinaryFit(item.url, 320)}
              alt={item.alt}
              className="aspect-[3/4] w-full rounded-md object-contain"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}
```

Check `cloudinaryFit`'s signature before using it:
`grep -n "export function cloudinaryFit" -A3 lib/image-url.ts`, and match the
call to it.

- [ ] **Step 3: The hub page**

In `app/admin/plant/[slug]/page.tsx`:

- swap `PlantInside` for `PlantRail` and drop the `items` prop and the `inside`
  array that fed it;
- change the back-link from `← garden` / `/admin/garden` to `← plants` / `/admin`;
- below the `ProseEditor`, add the previews:

```tsx
const scopeQuery = `?plant=${encodeURIComponent(slug)}`;
const pods = podsForPlantSorted(dataset, slug);
const beans = beansForPlantDeep(dataset, slug);
const sprouts = filterSproutEntries(dataset.timelineSprouts(), { plant: slug });
```

```tsx
<div className="grid gap-8 lg:grid-cols-2">
  <PreviewPanel title="Pods" count={pods.length} allHref={`/admin/pods${scopeQuery}`}>
    <PodTable rows={podRows} limit={5} showPlant={false} />
  </PreviewPanel>
  <PreviewPanel title="Beans" count={beans.length} allHref={`/admin/beans${scopeQuery}`}>
    <BeanTable rows={beanRows} limit={5} showPlant={false} />
  </PreviewPanel>
  <PreviewPanel title="Sprouts" count={sprouts.length} allHref={`/admin/sprouts${scopeQuery}`}>
    <SproutTable entries={sprouts} limit={5} showPlant={false} />
  </PreviewPanel>
  <PreviewPanel title="Screens" count={plantScreens.length} allHref={`/admin/screens${scopeQuery}`}>
    <ScreenStrip items={stripItems} />
  </PreviewPanel>
</div>
```

`podRows` and `beanRows` are built exactly as `/admin/pods` and `/admin/beans`
build theirs, minus the plant mark (the hub is already inside a plant).
`stripItems` is `plantScreens.slice(0, 4)` mapped to `{ slug, name, url: s.image.url, alt: s.image.alt ?? "" }`.

`plantScreens` already exists in this file — keep it, and keep the whole
`exhibition` prop and its `exhibitionRows`, unchanged.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` → clean
Run: `npm test 2>&1 | tail -5` → `# fail 0`, and confirm
`lib/exhibition-panel-source.test.ts` and `lib/plant-hero-a11y.test.ts` are
among the passes:
`npm test 2>&1 | grep -E "exhibition-panel-source|plant-hero-a11y"`
Run: `npm run dev` and open a plant with pods, beans, sprouts and screens; then
one with none of them (every preview should say `nothing yet`, with no `all →`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "admin: the plant page becomes a hub"
```

---

## Task 16: The docs catch up

**Files:**
- Modify: `CLAUDE.md`, `README.md`

- [ ] **Step 1: Find what is now false**

```bash
grep -n "garden\|Vault\|vault\|/admin\b" CLAUDE.md README.md | head -40
```

- [ ] **Step 2: Fix `CLAUDE.md`**

Three places need the truth:

- the chrome paragraph — the admin chrome is now two clusters plus the rail, and
  the rail changes shape with the scope;
- `resolveColumn`'s description in the shared-surfaces bullet — "a section index
  is `WIDE_COLUMN`" gains the welcome page;
- add one invariant under **Rules the tests pin, and why**:

  > **The admin's subject lives in the URL.** `lib/admin-scope.ts` reads it
  > (`/admin/plant/[slug]` first, `?plant=` second) and builds every href that
  > changes it; the switcher renders plain anchors, so picking a plant is a
  > navigation and never a write. Scoped, the rail gains Overview — the page
  > that cannot aggregate — and loses Beanstalk, which merges sprouts with
  > pollen envelopes that have no plant. `lib/admin-scope.test.ts` and
  > `lib/admin-nav.test.ts` pin both halves.

Also correct the garden-cache bullet if it names `/admin/garden`, and note that
`app/admin/layout.tsx` is now a garden reader — the live one.

- [ ] **Step 3: Fix `README.md`**

Update any route map or admin tour that names `/admin/garden` or `/admin/vault`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: the admin's map, as it now is"
```

---

## Task 17: Full verification and the PR

- [ ] **Step 1: The whole suite**

```bash
npm test 2>&1 | tail -10
npx tsc --noEmit
npm run lint
npm run build
```
Expected: `# fail 0`, no type errors, no lint errors, a clean build. Paste the
actual output — do not claim any of these passed without having run it.

- [ ] **Step 2: The source-rule tests, by name**

```bash
npm test 2>&1 | grep -E "server-safe|garden-cache-source|exhibition-panel-source|screen-sheet-source|media-picker-mount|toc-mount|pwa-source|brand-source"
```
Expected: all passing. `lib/server-safe-source.test.ts` matters even though this
slice is admin-only: it pins that no public-rendered file gained a client
boundary, and a shared component edited here could.

- [ ] **Step 3: Walk it once more**

`npm run dev`, then: `/admin` → `/admin/inbox` → `/admin/pods` → `/admin/beans` →
`/admin/sprouts` → `/admin/screens` → `/admin/beanstalk`; pick a plant and repeat;
check `/admin/garden` and `/admin/vault` redirect; check `/admin/login` still has
no chrome and a centred card.

- [ ] **Step 4: Open the PR with a Lab Note**

```bash
git push -u origin admin-hub-scope
```

PR body ends with a Lab Note — this is author-facing, and the author is a user:

```yaml
en:
  title: The admin knows which project you're working on
  summary: Pick a plant once and it follows you everywhere — the inbox, the sprouts, the screens all narrow to it. Its page is now a proper home, with everything inside it in one place.
fr:
  title: L'admin sait sur quel projet tu bosses
  summary: Choisis une plante une fois et elle te suit partout — la boîte de réception, les pousses, les écrans s'y réduisent. Sa page devient un vrai QG, avec tout ce qu'elle contient au même endroit.
suggested:
  molecule: ariko
  type: improvement
  tags: [changelog]
```

And the attribution line required for PR descriptions:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Notes for the implementer

- **Every commit leaves `npm test` green** except the deliberate red between
  Tasks 1 and 3, which is why those three share one commit.
- **Never add `"use client"` or a `lucide-react` import to a file under
  `components/` that the public zone renders.** `lib/server-safe-source.test.ts`
  pins the list; a violation passes `tsc`, `npm test` and `npm run build` while
  costing the public site its navigation. Everything new in this plan lives
  under `app/admin/`, where client code is ordinary.
- **Read `lib/palette-items.ts`, never `lib/palette.ts`, from any client
  component.** The latter reaches `lib/data.ts` and `node:fs`; the build fails.
- **`loadRawGarden`, never `loadCachedGarden`, anywhere in `app/admin`** —
  including the layout's new read.
