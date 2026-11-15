# Garden Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only React Flow map of the garden at `/admin/map` that shows the plant → pod → bean tree, draft sprouts and inbox seeds as leaves, what waits for review, and what is missing.

**Architecture:** A pure builder (`lib/garden-map.ts`) turns the raw garden plus inbox seeds into nodes, edges, flags and stats. A pure layout module (`lib/garden-map-layout.ts`) positions them with dagre. A thin `"use client"` island draws the positioned result with `@xyflow/react`. The page reads the live garden; the toolbar and the scope are URL state.

**Tech Stack:** Next.js 15 / React 19 / TypeScript, `@xyflow/react` 12, `@dagrejs/dagre` 3, Tailwind v4 + shadcn (Base UI), `node:test` via `tsx`.

**Spec:** [`docs/superpowers/specs/2026-11-15-garden-map-design.md`](../specs/2026-11-15-garden-map-design.md)

**Conventions to know before starting** (from `CLAUDE.md`):

- Tests are `node:test`, run with `npm test` (whole suite) or
  `TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/<file>.test.ts` (one file). Every command below that runs one file uses that form.
- The admin reads the **live** garden (`loadRawGarden`), never `loadCachedGarden`.
- A `"use client"` file may not runtime-import `lib/data.ts` or `lib/store.ts` (`node:fs` four hops down breaks the build). `import type` is erased and is fine.
- Never run `npm run build` or touch `.next` in the main checkout (the maintainer's dev server shares it). This worktree has its own `.next`; build here only.
- The local dev server reads the **production** database. Do not start it or drive the page without asking the maintainer first.
- Commit message trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

## File structure

| File | Responsibility |
|---|---|
| `lib/garden-map.ts` (new) | Pure. `buildGardenMap(raw, seeds, {scope, view})` → `{nodes, edges, stats}`. Owns every rule in the spec: what is drawn, waiting, missing, dimmed. |
| `lib/garden-map-layout.ts` (new) | Pure. `layoutGardenMap(map)` → the same map with `x, y, width, height` per node (dagre, left-to-right). |
| `app/admin/_components/garden-map-node.tsx` (new) | The card one node draws: icon, name as a `next/link`, amber ring, chips. Presentational; no React Flow. |
| `app/admin/_components/garden-map.tsx` (new) | `"use client"` island: React Flow canvas, custom node, minimap, controls, dark-mode sync. Imports types only from `lib/`. |
| `app/admin/_components/map-toolbar.tsx` (new) | Server component: the All / Needs review / Has gaps links with counts, in a `Chrome` cluster. |
| `app/admin/(chrome)/map/page.tsx` (new) | Reads the garden and seeds live, composes, renders. |
| `lib/admin-nav.ts` (modify) | `map` id, nav item, section route, `"bleed"` column. |
| `lib/section-keys.ts` (modify) | `map: ["plant"]`. |
| `app/admin/_components/section-icons.ts` (modify) | `map: Network`. |
| `app/admin/_components/admin-chrome.tsx` (modify) | `AdminMain` renders the bleed column. |
| `lib/garden-map.test.ts`, `lib/garden-map-layout.test.ts`, `lib/garden-map-source.test.ts`, `lib/garden-map-node.test.tsx` (new) | Tests. |
| `lib/admin-nav.test.ts` (modify) | The seventh section, hotkeys, `bleed`. |
| `CLAUDE.md` (modify) | Short note: the map is a live reader; why `bleed`. |

---

### Task 1: Dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

```bash
npm install @xyflow/react@12.12.1 @dagrejs/dagre@3.1.3
```

Expected: both added under `dependencies`, no peer warnings (React 19 is within `react: >=17`).

- [ ] **Step 2: Confirm dagre's import shape under the test runner**

```bash
cat > /tmp/__probe.ts <<'EOF'
import dagre from "@dagrejs/dagre";
const g = new dagre.graphlib.Graph();
g.setGraph({ rankdir: "LR" });
g.setDefaultEdgeLabel(() => ({}));
g.setNode("a", { width: 10, height: 10 });
g.setNode("b", { width: 10, height: 10 });
g.setEdge("a", "b");
dagre.layout(g);
console.log(typeof g.node("a").x === "number" ? "dagre ok" : "dagre broken");
EOF
cp /tmp/__probe.ts ./__probe.ts && node --import tsx ./__probe.ts; rm -f ./__probe.ts /tmp/__probe.ts
```

Expected: `dagre ok`. (Verified in a scratch install on 3.1.3; this confirms it inside this repo's tsconfig.)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Deps: @xyflow/react and @dagrejs/dagre for the garden map

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The Map section in the nav, and the `bleed` column

**Files:**
- Modify: `lib/admin-nav.ts`
- Modify: `lib/section-keys.ts`
- Modify: `app/admin/_components/section-icons.ts`
- Modify: `app/admin/_components/admin-chrome.tsx` (`AdminMain`)
- Test: `lib/admin-nav.test.ts`

Map is **appended** after Beanstalk so no existing Alt+digit shortcut moves. Scoped, Beanstalk steps aside, so Map becomes the seventh item either way.

- [ ] **Step 1: Update the failing tests in `lib/admin-nav.test.ts`**

Replace the first test and the hotkey/scoped/column tests with:

```ts
test("the seven sections are the nav, in order", () => {
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.id),
    ["inbox", "pods", "beans", "sprouts", "screens", "beanstalk", "map"],
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
      "/admin/map",
    ],
  );
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.label),
    ["Inbox", "Pods", "Beans", "Sprouts", "Screens", "Beanstalk", "Map"],
  );
});
```

```ts
test("the shortcut digit is the item's position in the rail as drawn", () => {
  assert.deepEqual(
    navItems(null).map((i) => i.hotkey),
    ["1", "2", "3", "4", "5", "6", "7"],
  );
});

test("scoped, the digits follow the rail's new shape rather than the old one", () => {
  const items = navItems("ariko");
  assert.deepEqual(
    items.map((i) => `${i.id}:${i.hotkey}`),
    ["overview:1", "inbox:2", "pods:3", "beans:4", "sprouts:5", "screens:6", "map:7"],
  );
});
```

```ts
test("scoped, Overview leads and Beanstalk steps aside", () => {
  const items = navItems("ariko");
  assert.deepEqual(
    items.map((i) => i.id),
    ["overview", "inbox", "pods", "beans", "sprouts", "screens", "map"],
  );
  assert.equal(items[0].href, "/admin/plant/ariko");
  assert.equal(items[0].label, "Overview");
});
```

Replace the two column tests with:

```ts
test("every section index reads in the wide column, except the map, which bleeds", () => {
  for (const item of NAV_ITEMS) {
    assert.equal(resolveColumn(item.href), item.id === "map" ? "bleed" : "wide", item.href);
  }
});

test("the map is the only bleed — its filter query does not change that", () => {
  assert.equal(resolveColumn("/admin/map"), "bleed");
  assert.equal(resolveColumn("/admin/map/"), "bleed");
  assert.equal(resolveColumn("/admin/mapping"), "reading");
});

test("the map lights its own rail item, and only on a segment boundary", () => {
  assert.equal(resolveNavItem("/admin/map"), "/admin/map");
  assert.equal(resolveNavItem("/admin/mapping"), null);
});

test("navHref carries the scope to the map", () => {
  const map = NAV_ITEMS.find((item) => item.id === "map")!;
  assert.equal(navHref(map, "ariko"), "/admin/map?plant=ariko");
  assert.equal(navHref(map, null), "/admin/map");
});
```

(Leave the welcome-page and detail-page column tests as they are.)

- [ ] **Step 2: Run to verify failure**

```bash
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/admin-nav.test.ts
```

Expected: FAIL (`map` is not a `NavId`; type errors surface as runtime mismatches here).

- [ ] **Step 3: Implement in `lib/admin-nav.ts`**

Add `"map"` to `NavId`:

```ts
export type NavId =
  | "overview"
  | "inbox"
  | "pods"
  | "beans"
  | "sprouts"
  | "screens"
  | "beanstalk"
  | "map";
```

Append to `NAV_ITEMS`:

```ts
  { id: "beanstalk", href: "/admin/beanstalk", label: "Beanstalk" },
  { id: "map", href: "/admin/map", label: "Map" },
];
```

Add to `SECTIONS` (a path-prefix check; `/admin/map` is not a path prefix of anything else here):

```ts
  ["/admin/beanstalk", "/admin/beanstalk"],
  ["/admin/map", "/admin/map"],
];
```

Replace `Column` and `resolveColumn`:

```ts
/** Which measure a route reads in — see `components/page-column.tsx`. `bleed`
 *  is no measure at all: the map's canvas fills the viewport and the floating
 *  chrome sits over it. */
export type Column = "wide" | "reading" | "bleed";

export function resolveColumn(pathname: string): Column {
  const path = normalizePath(pathname);
  if (path === "/admin/map") return "bleed";
  if (path === ROOT_PATH) return "wide";
  return NAV_ITEMS.some((item) => item.href === path) ? "wide" : "reading";
}
```

Keep the existing docblock above `resolveColumn` and append one paragraph to it:

```ts
 * **The map is the one `"bleed"`.** A node-and-edge canvas in a 1024px column
 * defeats its own purpose, so `AdminMain` gives it the whole viewport and the
 * chrome's floating plates sit over it. It is named by path here rather than
 * by a flag on `NavItem` because it is a fact about one page, not a property
 * every section could have.
```

- [ ] **Step 4: `lib/section-keys.ts`** — add the entry (the `Record<ScopedId, …>` type makes `tsc` fail without it):

```ts
export const SECTION_KEYS: Readonly<Record<ScopedId, readonly string[]>> = {
  inbox: ["plant"],
  pods: ["plant"],
  beans: ["plant", "pod"],
  sprouts: SPROUT_KEYS,
  screens: SCREEN_FILTER_KEYS,
  // The map's scope is a plant; its `view` is NOT a scope key, so a plant
  // switch drops it deliberately — a different tree is a different question.
  map: ["plant"],
};
```

- [ ] **Step 5: `app/admin/_components/section-icons.ts`**

```ts
import { Bean, Flower2, Images, Inbox, Network, Package, Sprout, Waypoints } from "lucide-react";
```

and in the record: `map: Network,`.

- [ ] **Step 6: `AdminMain` in `app/admin/_components/admin-chrome.tsx`** — replace its body:

```tsx
export function AdminMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const column = resolveColumn(pathname);
  // A bleed page owns the whole viewport. `z-0` keeps it UNDER the chrome
  // (`Chrome` is `fixed z-40`), so the plates float over the canvas.
  if (column === "bleed") return <main className="fixed inset-0 z-0">{children}</main>;
  return (
    <main className={`${RAIL_CLEARANCE} pb-20 pt-24`}>
      <div className={column === "wide" ? WIDE_COLUMN : READING_COLUMN}>{children}</div>
    </main>
  );
}
```

- [ ] **Step 7: Run and typecheck**

```bash
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/admin-nav.test.ts lib/admin-scope.test.ts lib/section-icons.test.ts
npx tsc --noEmit
```

Expected: all PASS; `tsc` clean. If `lib/admin-scope.test.ts`'s "every NavId … scopable or unscopable" test or a palette test counts sections, fix the expected number to seven — that is a stale count, not a bug.

- [ ] **Step 8: Commit**

```bash
git add lib/admin-nav.ts lib/section-keys.ts app/admin/_components/section-icons.ts app/admin/_components/admin-chrome.tsx lib/admin-nav.test.ts
git commit -m "Admin nav: a Map section and a bleed column for it

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The map builder

**Files:**
- Create: `lib/garden-map.ts`
- Test: `lib/garden-map.test.ts`

- [ ] **Step 1: Write the failing tests**

`lib/garden-map.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Bean, Plant, Pod, RawGarden, Seed, Sprout } from "./data";
import { buildGardenMap, mapViewOf, type GardenMap, type MapNode } from "./garden-map";

// ---- fixtures: a factory per species, defaults chosen to be "complete" so a
// test names only the one thing it makes wrong. -----------------------------

function plant(slug: string, over: Partial<Plant> = {}): Plant {
  return {
    slug,
    name: slug.toUpperCase(),
    natures: ["work"],
    role: { kind: "owner" },
    description: "d",
    content: { en: "Story", fr: "Histoire" },
    visibility: "public",
    ...over,
  };
}
function pod(slug: string, parents: string[], over: Partial<Pod> = {}): Pod {
  return {
    slug,
    name: slug,
    parents,
    description: "d",
    content: { en: "Story", fr: "Histoire" },
    visibility: "public",
    ...over,
  };
}
function bean(slug: string, parents: string[], over: Partial<Bean> = {}): Bean {
  return {
    slug,
    name: slug,
    parents,
    content: { en: "Story", fr: "Histoire" },
    visibility: "public",
    ...over,
  };
}
function sprout(slug: string, over: Partial<Sprout> = {}): Sprout {
  return {
    slug,
    name: slug,
    kind: "log",
    date: "2026-11-01",
    description: "d",
    state: "draft",
    ...over,
  };
}
function seed(id: string, over: Partial<Seed> = {}): Seed {
  return {
    id,
    title: `Seed ${id}`,
    media: [],
    source: { kind: "manual" },
    status: "inbox",
    promotedTo: [],
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
    ...over,
  };
}

function node(map: GardenMap, id: string): MapNode {
  const found = map.nodes.find((n) => n.id === id);
  assert.ok(found, `node ${id} should exist`);
  return found;
}
function hasEdge(map: GardenMap, source: string, target: string): boolean {
  return map.edges.some((e) => e.source === source && e.target === target);
}

// A complete little garden: nothing waits, nothing is missing.
function tidy(): RawGarden {
  return {
    plants: [plant("ariko")],
    pods: [pod("core", ["plant:ariko"])],
    beans: [bean("editor", ["pod:core"])],
    sprouts: [sprout("shipped", { state: "published", about: ["bean:editor"] })],
  };
}

// ---- structure -------------------------------------------------------------

test("plants, pods and beans are nodes joined by containment edges", () => {
  const map = buildGardenMap(tidy(), []);
  assert.deepEqual(
    map.nodes.map((n) => n.id),
    ["plant:ariko", "pod:core", "bean:editor"],
  );
  assert.ok(hasEdge(map, "plant:ariko", "pod:core"));
  assert.ok(hasEdge(map, "pod:core", "bean:editor"));
});

test("a bean that skips the pod hangs off its plant", () => {
  const raw: RawGarden = { plants: [plant("ariko")], beans: [bean("loose", ["plant:ariko"])] };
  const map = buildGardenMap(raw, []);
  assert.ok(hasEdge(map, "plant:ariko", "bean:loose"));
});

test("a bean with two pods is one node with an edge from each", () => {
  const raw: RawGarden = {
    plants: [plant("ariko")],
    pods: [pod("a", ["plant:ariko"]), pod("b", ["plant:ariko"])],
    beans: [bean("shared", ["pod:a", "pod:b"])],
  };
  const map = buildGardenMap(raw, []);
  assert.equal(map.nodes.filter((n) => n.id === "bean:shared").length, 1);
  assert.ok(hasEdge(map, "pod:a", "bean:shared"));
  assert.ok(hasEdge(map, "pod:b", "bean:shared"));
});

test("node hrefs are the admin pages, encoded", () => {
  const raw: RawGarden = {
    plants: [plant("a b")],
    pods: [pod("p/1", ["plant:a b"])],
    beans: [bean("b?", ["pod:p/1"])],
  };
  const map = buildGardenMap(raw, []);
  assert.equal(node(map, "plant:a b").href, "/admin/plant/a%20b");
  assert.equal(node(map, "pod:p/1").href, "/admin/pod/p%2F1");
  assert.equal(node(map, "bean:b?").href, "/admin/bean/b%3F");
});

// ---- unrooted --------------------------------------------------------------

test("a pod with no resolvable plant and a bean with no parent hang off Unrooted", () => {
  const raw: RawGarden = {
    plants: [plant("ariko")],
    pods: [pod("lost", ["plant:gone"])],
    beans: [bean("orphan", [])],
  };
  const map = buildGardenMap(raw, []);
  const unrooted = node(map, "bucket:unrooted");
  assert.equal(unrooted.kind, "bucket");
  assert.ok(hasEdge(map, "bucket:unrooted", "pod:lost"));
  assert.ok(hasEdge(map, "bucket:unrooted", "bean:orphan"));
});

test("there is no Unrooted node when nothing is unrooted", () => {
  const map = buildGardenMap(tidy(), []);
  assert.equal(map.nodes.some((n) => n.id === "bucket:unrooted"), false);
});

// ---- waiting for review ----------------------------------------------------

test("a plant, pod or bean is waiting when it is not public; absent means public", () => {
  const raw: RawGarden = {
    plants: [plant("a", { visibility: "private" }), plant("b", { visibility: undefined })],
    pods: [pod("p", ["plant:a"], { visibility: "private" })],
    beans: [bean("x", ["pod:p"], { visibility: "private" })],
  };
  const map = buildGardenMap(raw, []);
  assert.equal(node(map, "plant:a").waiting, true);
  assert.equal(node(map, "plant:b").waiting, false);
  assert.equal(node(map, "pod:p").waiting, true);
  assert.equal(node(map, "bean:x").waiting, true);
});

// ---- missing ---------------------------------------------------------------

test("no narrative is flagged on a plant, a pod and a bean", () => {
  const raw: RawGarden = {
    plants: [plant("a", { content: undefined })],
    pods: [pod("p", ["plant:a"], { content: "" })],
    beans: [bean("x", ["pod:p"], { content: { en: "  ", fr: "" } })],
    sprouts: [sprout("s", { state: "published", about: ["bean:x"] })],
  };
  const map = buildGardenMap(raw, []);
  for (const id of ["plant:a", "pod:p", "bean:x"]) {
    assert.deepEqual(node(map, id).gaps, ["no-narrative"], id);
  }
});

test("a missing French half is flagged only when English exists", () => {
  const raw: RawGarden = {
    plants: [plant("a", { content: { en: "Only English" } })],
    pods: [pod("p", ["plant:a"], { content: { fr: "Seulement" } })],
    beans: [bean("x", ["pod:p"], { content: "Plain string is the en half" })],
    sprouts: [sprout("s", { state: "published", about: ["bean:x"] })],
  };
  const map = buildGardenMap(raw, []);
  assert.deepEqual(node(map, "plant:a").gaps, ["no-fr"]);
  assert.deepEqual(node(map, "pod:p").gaps, [], "a French-only narrative has no EN gap to name");
  assert.deepEqual(node(map, "bean:x").gaps, ["no-fr"]);
});

test("no narrative is never also reported as no French", () => {
  const raw: RawGarden = { plants: [plant("a", { content: undefined })], pods: [pod("p", ["plant:a"])] };
  assert.deepEqual(node(buildGardenMap(raw, []), "plant:a").gaps, ["no-narrative"]);
});

test("no children: a plant with nothing in it, a pod with no beans", () => {
  const raw: RawGarden = {
    plants: [plant("empty"), plant("full")],
    pods: [pod("hollow", ["plant:full"])],
  };
  const map = buildGardenMap(raw, []);
  assert.deepEqual(node(map, "plant:empty").gaps, ["no-children"]);
  assert.deepEqual(node(map, "plant:full").gaps, []);
  assert.deepEqual(node(map, "pod:hollow").gaps, ["no-children"]);
});

test("a plant whose only child is a direct bean has children", () => {
  const raw: RawGarden = {
    plants: [plant("a")],
    beans: [bean("x", ["plant:a"])],
    sprouts: [sprout("s", { state: "published", about: ["bean:x"] })],
  };
  assert.deepEqual(node(buildGardenMap(raw, []), "plant:a").gaps, []);
});

test("a bean whose only sprout is PUBLISHED has a journal — and draws no sprout node", () => {
  const map = buildGardenMap(tidy(), []);
  assert.deepEqual(node(map, "bean:editor").gaps, []);
  assert.equal(map.nodes.some((n) => n.kind === "sprout"), false);
});

test("a bean with no sprout of any state is flagged no-children", () => {
  const raw: RawGarden = { plants: [plant("a")], beans: [bean("x", ["plant:a"])] };
  assert.deepEqual(node(buildGardenMap(raw, []), "bean:x").gaps, ["no-children"]);
});

test("a projected bean is exempt from every gap", () => {
  const raw: RawGarden = {
    plants: [plant("a")],
    beans: [
      bean("pollen", ["plant:a"], {
        content: undefined,
        projected: { source: "s", feedId: "f", firstPollenId: "p" },
      }),
    ],
  };
  assert.deepEqual(node(buildGardenMap(raw, []), "bean:pollen").gaps, []);
});

// ---- sprouts ---------------------------------------------------------------

test("only draft sprouts are drawn; a private or published one is not", () => {
  const raw: RawGarden = {
    ...tidy(),
    sprouts: [
      sprout("d", { about: ["bean:editor"] }),
      sprout("noState", { state: undefined, about: ["bean:editor"] }),
      sprout("held", { state: "private", about: ["bean:editor"] }),
      sprout("out", { state: "published", about: ["bean:editor"] }),
    ],
  };
  const ids = buildGardenMap(raw, []).nodes.filter((n) => n.kind === "sprout").map((n) => n.id);
  assert.deepEqual(ids, ["sprout:d", "sprout:noState"]);
});

test("a draft sprout is waiting, with an edge per about ref", () => {
  const raw: RawGarden = {
    plants: [plant("a")],
    pods: [pod("p", ["plant:a"])],
    beans: [bean("x", ["pod:p"])],
    sprouts: [sprout("s", { about: ["pod:p", "bean:x"] })],
  };
  const map = buildGardenMap(raw, []);
  assert.equal(node(map, "sprout:s").waiting, true);
  assert.equal(node(map, "sprout:s").href, "/admin/sprout/s");
  assert.ok(hasEdge(map, "pod:p", "sprout:s"));
  assert.ok(hasEdge(map, "bean:x", "sprout:s"));
});

test("a plant-level draft sprout hangs off its plant", () => {
  const raw: RawGarden = {
    plants: [plant("a")],
    sprouts: [sprout("s", { parents: ["plant:a"] })],
  };
  assert.ok(hasEdge(buildGardenMap(raw, []), "plant:a", "sprout:s"));
});

test("an ambiguous or dangling draft sprout falls to Unrooted", () => {
  const raw: RawGarden = {
    plants: [plant("a"), plant("b")],
    pods: [pod("pa", ["plant:a"]), pod("pb", ["plant:b"])],
    sprouts: [
      sprout("two", { about: ["pod:pa", "pod:pb"] }),
      sprout("dangling", { about: ["bean:nothing"] }),
    ],
  };
  const map = buildGardenMap(raw, []);
  assert.ok(hasEdge(map, "bucket:unrooted", "sprout:two"));
  assert.ok(hasEdge(map, "bucket:unrooted", "sprout:dangling"));
});

// ---- seeds -----------------------------------------------------------------

test("an inbox seed attaches to the most specific suggestion that resolves", () => {
  const raw = tidy();
  const map = buildGardenMap(raw, [
    seed("1", { suggested: { beanSlug: "editor", podSlug: "core", plantSlug: "ariko" } }),
    seed("2", { suggested: { beanSlug: "gone", podSlug: "core" } }),
    seed("3", { suggested: { plantSlug: "ariko" } }),
  ]);
  assert.ok(hasEdge(map, "bean:editor", "seed:1"));
  assert.ok(hasEdge(map, "pod:core", "seed:2"), "a dangling bean falls back to the pod");
  assert.ok(hasEdge(map, "plant:ariko", "seed:3"));
  assert.equal(node(map, "seed:1").waiting, true);
  assert.equal(node(map, "seed:1").href, "/admin/triage/1");
});

test("a seed with no resolvable suggestion hangs off the Inbox node", () => {
  const map = buildGardenMap(tidy(), [seed("x"), seed("y", { suggested: { plantSlug: "nope" } })]);
  assert.equal(node(map, "bucket:inbox").kind, "bucket");
  assert.ok(hasEdge(map, "bucket:inbox", "seed:x"));
  assert.ok(hasEdge(map, "bucket:inbox", "seed:y"));
});

test("a promoted or discarded seed is not drawn", () => {
  const map = buildGardenMap(tidy(), [seed("p", { status: "promoted" }), seed("d", { status: "discarded" })]);
  assert.equal(map.nodes.some((n) => n.kind === "seed"), false);
});

// ---- scope -----------------------------------------------------------------

function twoPlants(): RawGarden {
  return {
    plants: [plant("a"), plant("b")],
    pods: [pod("pa", ["plant:a"]), pod("pb", ["plant:b"])],
    beans: [bean("xa", ["pod:pa"]), bean("xb", ["pod:pb"]), bean("direct", ["plant:a"])],
    sprouts: [
      sprout("sa", { about: ["bean:xa"] }),
      sprout("sb", { about: ["bean:xb"] }),
      sprout("floating"),
    ],
  };
}

test("scoped, only that plant's tree, its draft sprouts and its seeds remain", () => {
  const map = buildGardenMap(
    twoPlants(),
    [seed("mine", { suggested: { beanSlug: "xa" } }), seed("theirs", { suggested: { beanSlug: "xb" } }), seed("none")],
    { scope: "a" },
  );
  assert.deepEqual(
    map.nodes.map((n) => n.id).sort(),
    ["bean:direct", "bean:xa", "plant:a", "pod:pa", "seed:mine", "sprout:sa"].sort(),
  );
  assert.equal(map.nodes.some((n) => n.kind === "bucket"), false, "no Unrooted or Inbox when scoped");
});

test("scoped to a slug nothing resolves, the map is empty", () => {
  const map = buildGardenMap(twoPlants(), [], { scope: "ghost" });
  assert.deepEqual(map.nodes, []);
  assert.deepEqual(map.edges, []);
});

test("every edge joins two nodes that exist", () => {
  for (const scope of [null, "a", "b"]) {
    const map = buildGardenMap(twoPlants(), [seed("s")], { scope });
    const ids = new Set(map.nodes.map((n) => n.id));
    for (const e of map.edges) assert.ok(ids.has(e.source) && ids.has(e.target), `${e.id} (${scope})`);
  }
});

// ---- view + stats ----------------------------------------------------------

test("view dims what does not match and hides nothing", () => {
  const raw: RawGarden = {
    plants: [plant("a", { visibility: "private" }), plant("b")],
    pods: [pod("hollow", ["plant:b"])],
  };
  const all = buildGardenMap(raw, []);
  assert.ok(all.nodes.every((n) => !n.dim));

  const review = buildGardenMap(raw, [], { view: "review" });
  assert.equal(review.nodes.length, all.nodes.length);
  assert.deepEqual(
    review.nodes.filter((n) => !n.dim).map((n) => n.id),
    ["plant:a"],
  );

  const gaps = buildGardenMap(raw, [], { view: "gaps" });
  assert.deepEqual(
    gaps.nodes.filter((n) => !n.dim).map((n) => n.id).sort(),
    ["plant:a", "pod:hollow"].sort(),
  );
});

test("stats count the whole map and ignore the view", () => {
  const raw: RawGarden = {
    plants: [plant("a", { visibility: "private" })],
    sprouts: [sprout("s", { parents: ["plant:a"] })],
  };
  const a = buildGardenMap(raw, [seed("1")]);
  const b = buildGardenMap(raw, [seed("1")], { view: "gaps" });
  assert.deepEqual(a.stats, b.stats);
  // plant:a (private), sprout:s and seed:1 wait. plant:a's one gap is
  // no-children: a sprout is not a pod or a bean.
  assert.equal(a.stats.waiting, 3);
  assert.equal(a.stats.gaps, 1);
});

test("mapViewOf accepts the three views and falls back to all", () => {
  assert.equal(mapViewOf("review"), "review");
  assert.equal(mapViewOf("gaps"), "gaps");
  assert.equal(mapViewOf("all"), "all");
  assert.equal(mapViewOf("nonsense"), "all");
  assert.equal(mapViewOf(undefined), "all");
  assert.equal(mapViewOf(["review", "gaps"]), "all");
});
```

- [ ] **Step 2: Run to verify failure**

```bash
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/garden-map.test.ts
```

Expected: FAIL — `Cannot find module './garden-map'`.

- [ ] **Step 3: Implement `lib/garden-map.ts`**

```ts
import {
  BEAN_PREFIX,
  PLANT_PREFIX,
  POD_PREFIX,
  aboutRefs,
  hasNarrative,
  parentsWithPrefix,
  resolveSproutPlant,
  resolveText,
  textPart,
  type RawGarden,
  type Seed,
  type Text,
} from "./data";
import { hubHref } from "./plant-path";
import { visibilityOf } from "./plant-visibility";
import { stateOf } from "./sprout-state";

/**
 * The garden map's model — what is drawn, what waits, what is missing.
 *
 * (spec: docs/superpowers/specs/2026-11-15-garden-map-design.md)
 *
 * PURE, and server-only by reach: it imports `lib/data.ts`, which opens with
 * `node:fs`. The client island therefore imports TYPES from here and nothing
 * else (`lib/garden-map-source.test.ts` pins it) — the `lib/palette.ts` /
 * `lib/palette-items.ts` trap, a fourth time.
 *
 * Nothing here re-derives what the garden already decides. A sprout's plant is
 * `resolveSproutPlant`'s answer; visibility is `visibilityOf`'s; a sprout's
 * state is `stateOf`'s; "has a narrative" is `hasNarrative`'s. The map adds
 * the drawing and the flags, not a second opinion about the data.
 */

export type MapNodeKind = "plant" | "pod" | "bean" | "sprout" | "seed" | "bucket";

/**
 * What can be missing on a node.
 *
 *  - `no-narrative` — plant, pod or bean with nothing in `content`.
 *  - `no-fr` — has an English narrative and an empty French half. Never raised
 *    beside `no-narrative`, and never for a French-only narrative.
 *  - `no-children` — a plant with no pods and no beans, a pod with no beans, a
 *    bean with no journal entry of ANY state.
 */
export type MapGap = "no-narrative" | "no-fr" | "no-children";

/** `all` is also `lib/admin-filters.ts`'s `NO_FILTER`, so an `all` view is the
 *  absent query rather than `?view=all`. */
export type MapView = "all" | "review" | "gaps";
export const MAP_VIEWS: readonly MapView[] = ["all", "review", "gaps"];

export function mapViewOf(raw: unknown): MapView {
  return typeof raw === "string" && (MAP_VIEWS as readonly string[]).includes(raw)
    ? (raw as MapView)
    : "all";
}

export interface MapNode {
  /** `plant:slug` · `pod:slug` · `bean:slug` · `sprout:slug` · `seed:id` ·
   *  `bucket:unrooted` · `bucket:inbox`. The first three are the garden's own
   *  prefixed refs, which is what lets a sprout's `about` name a node directly. */
  id: string;
  kind: MapNodeKind;
  label: string;
  /** The admin page this node opens. Absent on a bucket. */
  href?: string;
  /** Waits for the maintainer's review. */
  waiting: boolean;
  gaps: MapGap[];
  /** The active view does not match this node. Dimmed, never hidden. */
  dim: boolean;
}

export interface MapEdge {
  id: string;
  source: string;
  target: string;
}

export interface GardenMap {
  nodes: MapNode[];
  edges: MapEdge[];
  /** Over the whole (scoped) map, whatever the view. */
  stats: { waiting: number; gaps: number };
}

export interface MapOptions {
  /** A plant slug, or null for the whole garden. */
  scope?: string | null;
  view?: MapView;
}

const UNROOTED = "bucket:unrooted";
const INBOX = "bucket:inbox";
const enc = encodeURIComponent;

function narrativeGaps(content: Text | undefined): MapGap[] {
  if (!hasNarrative(content)) return ["no-narrative"];
  const en = textPart(content, "en").trim() !== "";
  const fr = textPart(content, "fr").trim() !== "";
  return en && !fr ? ["no-fr"] : [];
}

export function buildGardenMap(
  raw: RawGarden,
  seeds: Seed[],
  opts: MapOptions = {},
): GardenMap {
  const scope = opts.scope ?? null;
  const view = opts.view ?? "all";

  const plants = raw.plants ?? [];
  const pods = raw.pods ?? [];
  const beans = raw.beans ?? [];
  const sprouts = raw.sprouts ?? [];

  const plantSlugs = new Set(plants.map((p) => p.slug));
  const podSlugs = new Set(pods.map((p) => p.slug));

  // Containment parents that RESOLVE. A dangling ref is not a parent.
  const podPlants = (pod: { parents?: string[] }) =>
    parentsWithPrefix(pod.parents, PLANT_PREFIX).filter((s) => plantSlugs.has(s));
  const beanPods = (bean: { parents?: string[] }) =>
    parentsWithPrefix(bean.parents, POD_PREFIX).filter((s) => podSlugs.has(s));
  const beanPlants = (bean: { parents?: string[] }) =>
    parentsWithPrefix(bean.parents, PLANT_PREFIX).filter((s) => plantSlugs.has(s));

  // Beans with a journal entry of ANY state — published ones are not drawn, but
  // they are why a bean is not "empty".
  const beansWithJournal = new Set<string>();
  for (const sprout of sprouts) {
    for (const ref of aboutRefs(sprout)) {
      if (ref.startsWith(BEAN_PREFIX)) beansWithJournal.add(ref.slice(BEAN_PREFIX.length));
    }
  }

  const nodes = new Map<string, MapNode>();
  const edges: MapEdge[] = [];
  const edgeIds = new Set<string>();
  const connect = (source: string, target: string): void => {
    const id = `${source}>${target}`;
    if (edgeIds.has(id)) return;
    edgeIds.add(id);
    edges.push({ id, source, target });
  };
  const bucket = (id: string, label: string): string => {
    if (!nodes.has(id)) {
      nodes.set(id, { id, kind: "bucket", label, waiting: false, gaps: [], dim: false });
    }
    return id;
  };
  const labelOf = (text: Text | undefined, fallback: string): string =>
    resolveText(text) || fallback;

  // ---- plants ----
  const keptPlants = plants.filter((p) => scope === null || p.slug === scope);
  for (const plant of keptPlants) {
    const hasChildren =
      pods.some((p) => podPlants(p).includes(plant.slug)) ||
      beans.some((b) => beanPlants(b).includes(plant.slug));
    nodes.set(`plant:${plant.slug}`, {
      id: `plant:${plant.slug}`,
      kind: "plant",
      label: labelOf(plant.name, plant.slug),
      href: hubHref(plant.slug),
      waiting: visibilityOf(plant) !== "public",
      gaps: [...narrativeGaps(plant.content), ...(hasChildren ? [] : (["no-children"] as const))],
      dim: false,
    });
  }

  // ---- pods ----
  const keptPods = pods.filter((p) => scope === null || podPlants(p).includes(scope));
  for (const pod of keptPods) {
    const id = `pod:${pod.slug}`;
    const hasBeans = beans.some((b) => beanPods(b).includes(pod.slug));
    nodes.set(id, {
      id,
      kind: "pod",
      label: labelOf(pod.name, pod.slug),
      href: `/admin/pod/${enc(pod.slug)}`,
      waiting: visibilityOf(pod) !== "public",
      gaps: [...narrativeGaps(pod.content), ...(hasBeans ? [] : (["no-children"] as const))],
      dim: false,
    });
  }
  for (const pod of keptPods) {
    const parents = podPlants(pod).filter((s) => nodes.has(`plant:${s}`));
    if (parents.length === 0) connect(bucket(UNROOTED, "Unrooted"), `pod:${pod.slug}`);
    for (const s of parents) connect(`plant:${s}`, `pod:${pod.slug}`);
  }

  // ---- beans ----
  const keptPodSlugs = new Set(keptPods.map((p) => p.slug));
  const keptBeans = beans.filter(
    (b) =>
      scope === null ||
      beanPlants(b).includes(scope) ||
      beanPods(b).some((s) => keptPodSlugs.has(s)),
  );
  for (const bean of keptBeans) {
    const id = `bean:${bean.slug}`;
    // Machine-projected beans are source-owned and journal-less by
    // construction: every one would flag, which is noise rather than signal.
    const gaps: MapGap[] =
      bean.projected !== undefined
        ? []
        : [
            ...narrativeGaps(bean.content),
            ...(beansWithJournal.has(bean.slug) ? [] : (["no-children"] as const)),
          ];
    nodes.set(id, {
      id,
      kind: "bean",
      label: labelOf(bean.name, bean.slug),
      href: `/admin/bean/${enc(bean.slug)}`,
      waiting: visibilityOf(bean) !== "public",
      gaps,
      dim: false,
    });
  }
  for (const bean of keptBeans) {
    const parents = [
      ...beanPods(bean).map((s) => `pod:${s}`),
      ...beanPlants(bean).map((s) => `plant:${s}`),
    ].filter((id) => nodes.has(id));
    if (parents.length === 0) connect(bucket(UNROOTED, "Unrooted"), `bean:${bean.slug}`);
    for (const parent of parents) connect(parent, `bean:${bean.slug}`);
  }

  // ---- draft sprouts ----
  for (const sprout of sprouts) {
    if (stateOf(sprout) !== "draft") continue;
    const plant = resolveSproutPlant(sprout, raw);
    if (scope !== null && plant?.slug !== scope) continue;

    const id = `sprout:${sprout.slug}`;
    nodes.set(id, {
      id,
      kind: "sprout",
      label: labelOf(sprout.name, sprout.slug),
      href: `/admin/sprout/${enc(sprout.slug)}`,
      waiting: true,
      gaps: [],
      dim: false,
    });

    const about = aboutRefs(sprout);
    let targets: string[] = [];
    if (plant !== null) {
      targets = about.length === 0 ? [`plant:${plant.slug}`] : about.filter((ref) => nodes.has(ref));
      if (targets.length === 0 && nodes.has(`plant:${plant.slug}`)) targets = [`plant:${plant.slug}`];
    }
    if (targets.length === 0) targets = [bucket(UNROOTED, "Unrooted")];
    for (const target of targets) connect(target, id);
  }

  // ---- inbox seeds ----
  for (const seed of seeds) {
    if (seed.status !== "inbox") continue;
    const s = seed.suggested;
    const candidates = [
      s?.beanSlug ? `bean:${s.beanSlug}` : null,
      s?.podSlug ? `pod:${s.podSlug}` : null,
      s?.plantSlug ? `plant:${s.plantSlug}` : null,
    ];
    const target = candidates.find((c): c is string => c !== null && nodes.has(c));
    if (!target && scope !== null) continue; // an unplaced seed is not this plant's
    const id = `seed:${seed.id}`;
    nodes.set(id, {
      id,
      kind: "seed",
      label: labelOf(seed.title, "Untitled seed"),
      href: `/admin/triage/${enc(seed.id)}`,
      waiting: true,
      gaps: [],
      dim: false,
    });
    connect(target ?? bucket(INBOX, "Inbox"), id);
  }

  // ---- view + stats ----
  const matches = (n: MapNode): boolean =>
    view === "review" ? n.waiting : view === "gaps" ? n.gaps.length > 0 : true;
  const list = [...nodes.values()].map((n) => ({ ...n, dim: !matches(n) }));
  return {
    nodes: list,
    edges,
    stats: {
      waiting: list.filter((n) => n.waiting).length,
      gaps: list.filter((n) => n.gaps.length > 0).length,
    },
  };
}
```

- [ ] **Step 4: Run and typecheck**

```bash
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/garden-map.test.ts
npx tsc --noEmit
```

Expected: all PASS; `tsc` clean. If the `Plant`/`Bean` fixtures fail `tsc` on a required field I did not give them, add it to the fixture factory — do not loosen the builder's types.

- [ ] **Step 5: Commit**

```bash
git add lib/garden-map.ts lib/garden-map.test.ts
git commit -m "Garden map: the builder — nodes, edges, what waits, what is missing

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The layout

**Files:**
- Create: `lib/garden-map-layout.ts`
- Test: `lib/garden-map-layout.test.ts`

- [ ] **Step 1: Write the failing tests**

`lib/garden-map-layout.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { GardenMap, MapNode, MapNodeKind } from "./garden-map";
import { KIND_SIZE, layoutGardenMap } from "./garden-map-layout";

function n(id: string, kind: MapNodeKind): MapNode {
  return { id, kind, label: id, waiting: false, gaps: [], dim: false };
}
function map(nodes: MapNode[], pairs: Array<[string, string]>): GardenMap {
  return {
    nodes,
    edges: pairs.map(([source, target]) => ({ id: `${source}>${target}`, source, target })),
    stats: { waiting: 0, gaps: 0 },
  };
}
function overlaps(a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

test("every node gets a top-left position and its kind's size", () => {
  const out = layoutGardenMap(map([n("plant:a", "plant"), n("pod:p", "pod")], [["plant:a", "pod:p"]]));
  for (const node of out.nodes) {
    assert.equal(typeof node.x, "number");
    assert.equal(typeof node.y, "number");
    assert.equal(node.width, KIND_SIZE[node.kind].width);
    assert.equal(node.height, KIND_SIZE[node.kind].height);
  }
});

test("a child sits to the right of its parent", () => {
  const out = layoutGardenMap(map([n("plant:a", "plant"), n("pod:p", "pod")], [["plant:a", "pod:p"]]));
  const [plant, pod] = out.nodes;
  assert.ok(pod.x > plant.x + plant.width - 1);
});

test("a forest of disconnected trees lays out without overlap", () => {
  const nodes = [
    n("plant:a", "plant"), n("pod:a1", "pod"), n("bean:a2", "bean"),
    n("plant:b", "plant"), n("pod:b1", "pod"),
    n("plant:lonely", "plant"),
    n("bucket:unrooted", "bucket"), n("seed:1", "seed"),
  ];
  const out = layoutGardenMap(
    map(nodes, [["plant:a", "pod:a1"], ["pod:a1", "bean:a2"], ["plant:b", "pod:b1"], ["bucket:unrooted", "seed:1"]]),
  );
  assert.equal(out.nodes.length, nodes.length);
  for (let i = 0; i < out.nodes.length; i++) {
    for (let j = i + 1; j < out.nodes.length; j++) {
      assert.equal(overlaps(out.nodes[i], out.nodes[j]), false, `${out.nodes[i].id} vs ${out.nodes[j].id}`);
    }
  }
});

test("a node with two parents is laid out once", () => {
  const out = layoutGardenMap(
    map(
      [n("plant:a", "plant"), n("pod:x", "pod"), n("pod:y", "pod"), n("bean:s", "bean")],
      [["plant:a", "pod:x"], ["plant:a", "pod:y"], ["pod:x", "bean:s"], ["pod:y", "bean:s"]],
    ),
  );
  assert.equal(out.nodes.filter((node) => node.id === "bean:s").length, 1);
});

test("an empty map lays out to an empty map", () => {
  const out = layoutGardenMap(map([], []));
  assert.deepEqual(out.nodes, []);
  assert.deepEqual(out.edges, []);
});

test("layout keeps the builder's flags, stats and edges untouched", () => {
  const input = map([{ ...n("plant:a", "plant"), waiting: true, gaps: ["no-fr"], dim: true }], []);
  const out = layoutGardenMap(input);
  assert.equal(out.nodes[0].waiting, true);
  assert.deepEqual(out.nodes[0].gaps, ["no-fr"]);
  assert.equal(out.nodes[0].dim, true);
  assert.deepEqual(out.stats, input.stats);
});
```

- [ ] **Step 2: Run to verify failure**

```bash
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/garden-map-layout.test.ts
```

Expected: FAIL — `Cannot find module './garden-map-layout'`.

- [ ] **Step 3: Implement `lib/garden-map-layout.ts`**

```ts
import dagre from "@dagrejs/dagre";
import type { GardenMap, MapEdge, MapNode, MapNodeKind } from "./garden-map";

/**
 * Positions for the garden map. Pure, and run on the SERVER: the island ships
 * no layout code, only the finished coordinates.
 *
 * Left to right, because the tree is read as a sentence — plant, then its pods,
 * then their beans, then what waits on them. dagre handles the forest (several
 * disconnected trees) and a node with two parents (a DAG) without help.
 *
 * Sizes are FIXED per kind, which is what makes this layout possible without
 * measuring anything: `garden-map-node.tsx` draws each card to exactly these
 * dimensions. Change one side and the other has to follow — the card's chips
 * wrap inside `overflow-hidden`, so a size that is too small clips rather than
 * overlaps, and the overlap test in `garden-map-layout.test.ts` would not
 * notice a clipped chip. Look at it.
 */
export const KIND_SIZE: Readonly<Record<MapNodeKind, { width: number; height: number }>> = {
  plant: { width: 260, height: 76 },
  pod: { width: 260, height: 76 },
  bean: { width: 260, height: 76 },
  sprout: { width: 200, height: 60 },
  seed: { width: 200, height: 60 },
  bucket: { width: 150, height: 44 },
};

export interface PositionedNode extends MapNode {
  /** Top-left, as React Flow wants it (dagre answers with centres). */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedMap {
  nodes: PositionedNode[];
  edges: MapEdge[];
  stats: GardenMap["stats"];
}

export function layoutGardenMap(map: GardenMap): PositionedMap {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", nodesep: 24, ranksep: 80, marginx: 24, marginy: 24 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of map.nodes) graph.setNode(node.id, KIND_SIZE[node.kind]);
  for (const edge of map.edges) graph.setEdge(edge.source, edge.target);
  dagre.layout(graph);

  const nodes = map.nodes.map((node): PositionedNode => {
    const { width, height } = KIND_SIZE[node.kind];
    const placed = graph.node(node.id);
    return { ...node, width, height, x: placed.x - width / 2, y: placed.y - height / 2 };
  });
  return { nodes, edges: map.edges, stats: map.stats };
}
```

- [ ] **Step 4: Run and typecheck**

```bash
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/garden-map-layout.test.ts
npx tsc --noEmit
```

Expected: all PASS; `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add lib/garden-map-layout.ts lib/garden-map-layout.test.ts
git commit -m "Garden map: dagre layout, run on the server

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The node card

**Files:**
- Create: `app/admin/_components/garden-map-node.tsx`
- Test: `lib/garden-map-node.test.tsx`

Every glyph carries its word (`CLAUDE.md`): the amber ring is colour, so "Waiting" is also a text chip. Gap chips are text already.

- [ ] **Step 1: Write the failing test**

`lib/garden-map-node.test.tsx`:

```tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MapNodeCard } from "@/app/admin/_components/garden-map-node";

const base = { kind: "bean", label: "Editor", href: "/admin/bean/editor", waiting: false, gaps: [], dim: false } as const;

test("the name is a real link to the node's admin page", () => {
  const html = renderToStaticMarkup(<MapNodeCard node={base} />);
  assert.match(html, /<a [^>]*href="\/admin\/bean\/editor"[^>]*>Editor<\/a>/);
});

test("a bucket has no link", () => {
  const html = renderToStaticMarkup(
    <MapNodeCard node={{ ...base, kind: "bucket", label: "Unrooted", href: undefined }} />,
  );
  assert.doesNotMatch(html, /<a /);
  assert.match(html, /Unrooted/);
});

test("waiting is said in words, not only in colour", () => {
  const html = renderToStaticMarkup(<MapNodeCard node={{ ...base, waiting: true }} />);
  assert.match(html, />Waiting</);
  assert.match(html, /data-waiting/);
});

test("a calm node draws no chips", () => {
  const html = renderToStaticMarkup(<MapNodeCard node={base} />);
  assert.doesNotMatch(html, /Waiting|narrative|French|Empty|journal/i);
});

test("each gap has its word, and no-children says what is empty", () => {
  const bean = renderToStaticMarkup(
    <MapNodeCard node={{ ...base, gaps: ["no-narrative", "no-fr", "no-children"] }} />,
  );
  assert.match(bean, /No narrative/);
  assert.match(bean, /No French/);
  assert.match(bean, /No journal/);
  const pod = renderToStaticMarkup(
    <MapNodeCard node={{ ...base, kind: "pod", gaps: ["no-children"] }} />,
  );
  assert.match(pod, /No beans/);
  const plant = renderToStaticMarkup(
    <MapNodeCard node={{ ...base, kind: "plant", gaps: ["no-children"] }} />,
  );
  assert.match(plant, /Empty/);
});

test("a dimmed node says so for CSS and keeps its link", () => {
  const html = renderToStaticMarkup(<MapNodeCard node={{ ...base, dim: true }} />);
  assert.match(html, /data-dim/);
  assert.match(html, /href="\/admin\/bean\/editor"/);
});
```

- [ ] **Step 2: Run to verify failure**

```bash
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/garden-map-node.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `app/admin/_components/garden-map-node.tsx`**

No `"use client"`: it is imported only by the island, so it rides that boundary, and staying directive-free keeps it renderable in a test.

```tsx
import { Bean, Flower2, Inbox, Package, Sprout, Unlink } from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import type { MapGap, MapNode, MapNodeKind } from "@/lib/garden-map";
import { cn } from "@/lib/utils";

/**
 * One node of the garden map, as a card. Presentational: no React Flow in here,
 * so it renders under `renderToStaticMarkup` and `garden-map.tsx` adds the
 * handles around it.
 *
 * `import type` from `lib/garden-map` only — the module opens with `node:fs`
 * four hops down, and a runtime import from a client island fails the build
 * (see `lib/garden-map-source.test.ts`).
 *
 * The card is sized by `lib/garden-map-layout.ts` (`KIND_SIZE`), not by its
 * content: it fills the box dagre reserved for it.
 */

const KIND_ICON: Record<MapNodeKind, ComponentType<{ className?: string }>> = {
  plant: Flower2,
  pod: Package,
  bean: Bean,
  sprout: Sprout,
  seed: Inbox,
  bucket: Unlink,
};

/** The word for a gap. `no-children` depends on what the node is. */
export function gapWord(kind: MapNodeKind, gap: MapGap): string {
  if (gap === "no-narrative") return "No narrative";
  if (gap === "no-fr") return "No French";
  if (kind === "bean") return "No journal";
  if (kind === "pod") return "No beans";
  return "Empty";
}

export function MapNodeCard({
  node,
}: {
  node: Pick<MapNode, "kind" | "label" | "href" | "waiting" | "gaps" | "dim">;
}) {
  const Icon = KIND_ICON[node.kind];
  return (
    <div
      data-kind={node.kind}
      data-waiting={node.waiting || undefined}
      data-dim={node.dim || undefined}
      className={cn(
        "flex size-full flex-col justify-center gap-1 overflow-hidden rounded-xl border bg-card px-3 py-1.5 text-sm text-card-foreground shadow-xs transition-opacity",
        node.waiting && "ring-2 ring-amber-500",
        node.kind === "bucket" && "border-dashed",
        node.dim && "opacity-30",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {node.href ? (
          <Link href={node.href} className="truncate font-medium underline-offset-4 hover:underline">
            {node.label}
          </Link>
        ) : (
          <span className="truncate font-medium">{node.label}</span>
        )}
      </div>
      {node.waiting || node.gaps.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {node.waiting ? (
            <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
              Waiting
            </Badge>
          ) : null}
          {node.gaps.map((gap) => (
            <Badge key={gap} variant="secondary">
              {gapWord(node.kind, gap)}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run and typecheck**

```bash
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/garden-map-node.test.tsx
npx tsc --noEmit
```

Expected: PASS. If `next/link` fails to render outside a router, check how `lib/plant-switcher-a11y.test.ts` handles that and do the same; do not drop the `Link`.

- [ ] **Step 5: Commit**

```bash
git add app/admin/_components/garden-map-node.tsx lib/garden-map-node.test.tsx
git commit -m "Garden map: the node card, waiting said in words

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The island

**Files:**
- Create: `app/admin/_components/garden-map.tsx`

No unit test: React Flow measures the DOM, and `lib/garden-map-source.test.ts` (Task 8) pins what can go wrong at the boundary. It is verified by the build in Task 9 and by looking at it in Task 10.

- [ ] **Step 1: Implement `app/admin/_components/garden-map.tsx`**

```tsx
"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useMemo, useSyncExternalStore } from "react";
import type { PositionedMap, PositionedNode } from "@/lib/garden-map-layout";
import { MapNodeCard } from "./garden-map-node";

/**
 * The garden map's canvas: draws a finished, positioned map and nothing else.
 *
 * It composes no data and holds no state. The page reads the garden, the
 * builder decides every flag, dagre decides every coordinate — this file hands
 * them to React Flow. `import type` from `lib/` only: `lib/garden-map.ts`
 * reaches `lib/data.ts`, which opens with `node:fs`, and a runtime import from
 * here fails `npm run build` rather than anything earlier
 * (`lib/garden-map-source.test.ts`).
 *
 * Read-only on purpose: nodes cannot be dragged, connected or selected, so
 * there is no layout state to lose and no write path to mis-fire. Each card's
 * name is a real `next/link`; panning and zooming are the only gestures.
 * `nodesFocusable` is off so Tab walks the links, not the node wrappers.
 */

type GardenNodeData = { node: PositionedNode };

function GardenNode({ data }: NodeProps<Node<GardenNodeData>>) {
  // Handles exist because React Flow cannot draw an edge to a node without
  // them; they are invisible and inert.
  return (
    <>
      <Handle type="target" position={Position.Left} isConnectable={false} className="pointer-events-none opacity-0" />
      <MapNodeCard node={data.node} />
      <Handle type="source" position={Position.Right} isConnectable={false} className="pointer-events-none opacity-0" />
    </>
  );
}

const NODE_TYPES = { garden: GardenNode };

/**
 * The theme is `localStorage` plus a `dark` class on <html> (`lib/theme.ts`),
 * which the server cannot read, so this follows the class rather than taking a
 * prop. `useSyncExternalStore` is the honest shape for "a value that lives
 * outside React": the server snapshot is light, and a dark visitor corrects on
 * hydration with no effect-driven second render.
 */
function subscribeDark(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
const readDark = () => document.documentElement.classList.contains("dark");
const readDarkOnServer = () => false;

export function GardenMap({ map }: { map: PositionedMap }) {
  const dark = useSyncExternalStore(subscribeDark, readDark, readDarkOnServer);

  const nodes = useMemo<Node<GardenNodeData>[]>(
    () =>
      map.nodes.map((node) => ({
        id: node.id,
        type: "garden",
        position: { x: node.x, y: node.y },
        data: { node },
        // Known up front, so the first paint and `fitView` do not wait on a
        // measurement the fixed-size cards make unnecessary.
        initialWidth: node.width,
        initialHeight: node.height,
        style: { width: node.width, height: node.height },
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
      })),
    [map.nodes],
  );

  const edges = useMemo<Edge[]>(
    () =>
      map.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        selectable: false,
        focusable: false,
        style: { stroke: "var(--muted-foreground)", opacity: 0.5 },
      })),
    [map.edges],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      colorMode={dark ? "dark" : "light"}
      fitView
      fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
      minZoom={0.1}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      nodesFocusable={false}
      edgesFocusable={false}
      aria-label="Garden map"
    >
      <Background gap={24} />
      {/* Bottom-left is clear of the left rail (vertically centred) and the
          top clusters; the minimap goes bottom-right and is dropped below `md`,
          where it would sit under the toolbar. */}
      <Controls showInteractive={false} position="bottom-left" />
      <MiniMap pannable zoomable position="bottom-right" className="hidden md:block" />
    </ReactFlow>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

```bash
npx tsc --noEmit
npx eslint app/admin/_components/garden-map.tsx app/admin/_components/garden-map-node.tsx
```

Expected: clean. If `tsc` rejects `initialWidth`/`initialHeight`, the installed `@xyflow/react` predates them — check `node_modules/@xyflow/react/dist/esm/types/nodes.d.ts` and use `width`/`height` instead; do not cast.

- [ ] **Step 3: Commit**

```bash
git add app/admin/_components/garden-map.tsx
git commit -m "Garden map: the read-only React Flow island

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The toolbar and the page

**Files:**
- Create: `app/admin/_components/map-toolbar.tsx`
- Create: `app/admin/(chrome)/map/page.tsx`

- [ ] **Step 1: Implement the toolbar**

`app/admin/_components/map-toolbar.tsx` — a server component. It floats at an edge, so it is a `Chrome` cluster (shared-surfaces rule), and `Chrome` is server-safe. Each option is a plain link: filtering is server-side and the URL stays the description of the view.

```tsx
import Link from "next/link";
import { Chrome } from "@/components/chrome";
import { filterHref, type FilterValues } from "@/lib/admin-filters";
import { MAP_VIEWS, type MapView } from "@/lib/garden-map";

const PATH = "/admin/map";

const LABEL: Record<MapView, string> = {
  all: "All",
  review: "Needs review",
  gaps: "Has gaps",
};

/**
 * The map's three views, as links. The view is `?view=` in the URL and is read
 * by the page (`lib/admin-filters.ts`'s rule: a filtered view is shareable and
 * filtering is server-side). `all` is `NO_FILTER`, so it is the absent query.
 *
 * `plant` rides through so a view change keeps the scope; `view` is not a
 * `SECTION_KEYS` key, so a plant switch drops it — a different tree is a
 * different question.
 */
export function MapToolbar({
  active,
  view,
  counts,
}: {
  active: FilterValues;
  view: MapView;
  counts: Record<MapView, number>;
}) {
  return (
    <Chrome magnet="bottom-center" content label="Map view">
      {MAP_VIEWS.map((option) => {
        const current = option === view;
        return (
          <Link
            key={option}
            href={filterHref(PATH, active, ["plant", "view"], "view", option)}
            aria-current={current ? "page" : undefined}
            className={
              "rounded-lg px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring " +
              (current
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
            }
          >
            {LABEL[option]} <span className="tabular-nums opacity-70">{counts[option]}</span>
          </Link>
        );
      })}
    </Chrome>
  );
}
```

- [ ] **Step 2: Implement the page**

`app/admin/(chrome)/map/page.tsx`:

```tsx
import { Alert, AlertDescription } from "@/components/ui/alert";
import { resolveScope } from "@/lib/admin-scope";
import { buildGardenMap, mapViewOf } from "@/lib/garden-map";
import { layoutGardenMap, type PositionedMap } from "@/lib/garden-map-layout";
import { listSeeds } from "@/lib/seeds";
import { loadRawGarden } from "@/lib/store";
import { GardenMap } from "../../_components/garden-map";
import { MapToolbar } from "../../_components/map-toolbar";

export const dynamic = "force-dynamic";

const PATH = "/admin/map";

/**
 * The garden as a map: the containment tree, with what waits for review ringed
 * in amber and what is missing chipped on the node. Read-only — every node is
 * a link to the admin page where the actual decision lives.
 *
 * LIVE readers, both: `loadRawGarden` and `listSeeds`, never
 * `loadCachedGarden`. The admin reads live (CLAUDE.md), and a map of "what
 * waits" that lagged a write would show you a garden you had already changed.
 *
 * Scope is `resolveScope`, the one reader of `?plant=`; `?view=` is read here
 * and only here. The page is a `bleed` page (`resolveColumn`): `AdminMain`
 * gives it the whole viewport, so this fills `size-full`.
 */
export default async function AdminMapPage({
  searchParams,
}: {
  searchParams: Promise<{ plant?: string; view?: string }>;
}) {
  const active = await searchParams;
  const scope = resolveScope(PATH, active);
  const view = mapViewOf(active.view);

  let map: PositionedMap | null = null;
  let counts = { all: 0, review: 0, gaps: 0 };
  try {
    const [raw, seeds] = await Promise.all([loadRawGarden(), listSeeds({ status: "inbox" })]);
    const built = buildGardenMap(raw, seeds, { scope, view });
    counts = { all: built.nodes.length, review: built.stats.waiting, gaps: built.stats.gaps };
    map = layoutGardenMap(built);
  } catch {
    map = null;
  }

  if (map === null) {
    return (
      <div className="flex size-full items-center justify-center p-6">
        <Alert variant="destructive" role="alert" className="max-w-md">
          <AlertDescription>Couldn&apos;t load the garden.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (map.nodes.length === 0) {
    return (
      <div className="flex size-full items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">
          {scope ? "Nothing in this plant yet." : "The garden is empty."}
        </p>
      </div>
    );
  }

  return (
    <div className="relative size-full">
      <GardenMap map={map} />
      <MapToolbar active={active} view={view} counts={counts} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

```bash
npx tsc --noEmit
npx eslint "app/admin/(chrome)/map/page.tsx" app/admin/_components/map-toolbar.tsx
```

Expected: clean. If `resolveScope(PATH, active)` rejects the `searchParams` type, mirror `app/admin/(chrome)/pods/page.tsx`'s signature exactly — it passes the same shape.

- [ ] **Step 4: Commit**

```bash
git add app/admin/_components/map-toolbar.tsx "app/admin/(chrome)/map/page.tsx"
git commit -m "Admin: /admin/map — the page and its view toolbar

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Pin the boundary

**Files:**
- Create: `lib/garden-map-source.test.ts`

Everything here passes `tsc`, `npm test` and `npm run build` while quietly becoming false — which is why it is a source test.

- [ ] **Step 1: Write the test**

`lib/garden-map-source.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The garden map's boundary, enforced rather than written down.
 *
 * Source text, because every one of these is a property of an import graph or
 * a directive, which no render can observe.
 */

const read = (path: string): string => readFileSync(join(process.cwd(), path), "utf8");

/** Strips block and line comments so a docblock that NAMES a forbidden thing
 *  is not mistaken for one that USES it. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const ISLAND = "app/admin/_components/garden-map.tsx";
const CARD = "app/admin/_components/garden-map-node.tsx";
const PAGE = "app/admin/(chrome)/map/page.tsx";
const MAP_FILES = [
  "lib/garden-map.ts",
  "lib/garden-map-layout.ts",
  CARD,
  ISLAND,
  "app/admin/_components/map-toolbar.tsx",
  PAGE,
];

test("the island is a client component and the card it draws is not a boundary of its own", () => {
  assert.match(read(ISLAND), /^"use client";/m);
  assert.doesNotMatch(read(CARD), /^"use client"/m);
});

test("the client side imports TYPES from lib/, never values", () => {
  // `lib/garden-map.ts` reaches lib/data.ts, which opens with node:fs. A value
  // import in a client file fails the build four modules downstream.
  for (const file of [ISLAND, CARD]) {
    const imports = code(read(file)).match(/^import[^;]*from\s+["']@\/lib\/[^"']+["'];?/gm) ?? [];
    for (const line of imports) {
      const typeOnly = /^import\s+type\s/.test(line);
      // `cn` from lib/utils is a value and is fine: it reaches no node: module.
      assert.ok(typeOnly || /@\/lib\/utils["']/.test(line), `${file}: ${line}`);
    }
  }
});

test("the client side reaches no server-only module", () => {
  for (const file of [ISLAND, CARD]) {
    const src = code(read(file));
    assert.doesNotMatch(src, /lib\/store|lib\/seeds|lib\/db|node:/, file);
  }
});

test("the map has no write path", () => {
  for (const file of MAP_FILES) {
    const src = code(read(file));
    assert.doesNotMatch(src, /app\/admin\/actions|"use server"|\bformAction\b|<form\b/, file);
  }
});

test("the page reads the LIVE garden, never the cached one", () => {
  const src = code(read(PAGE));
  assert.match(src, /loadRawGarden/);
  assert.match(src, /listSeeds/);
  assert.doesNotMatch(src, /loadCachedGarden|garden-cache/);
});

test("nodes cannot be dragged, connected or selected", () => {
  const src = code(read(ISLAND));
  assert.match(src, /nodesDraggable=\{false\}/);
  assert.match(src, /nodesConnectable=\{false\}/);
  assert.match(src, /elementsSelectable=\{false\}/);
});

test("layout runs on the server: dagre is imported by the layout module and nowhere in the client", () => {
  assert.match(code(read("lib/garden-map-layout.ts")), /@dagrejs\/dagre/);
  for (const file of [ISLAND, CARD]) assert.doesNotMatch(code(read(file)), /dagre/, file);
});

test("a nav item, a scope key list and an icon exist for the map", async () => {
  // Redundant with admin-nav / admin-scope / section-icons tests on purpose:
  // those fail on a rename; this fails on a DELETION of the section entirely.
  const { NAV_ITEMS } = await import("./admin-nav");
  assert.ok(NAV_ITEMS.some((item) => item.id === "map" && item.href === "/admin/map"));
});
```

- [ ] **Step 2: Run**

```bash
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/garden-map-source.test.ts
```

Expected: PASS. If the type-only-import check flags `import { Badge } from "@/components/ui/badge"` — it should not, since that path is `@/components`, not `@/lib`. If it flags something real, fix the source, not the test.

- [ ] **Step 3: Commit**

```bash
git add lib/garden-map-source.test.ts
git commit -m "Garden map: pin the client boundary, the live read and the read-only rule

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: CLAUDE.md and full verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the note**

In `CLAUDE.md`, in the "Rules the tests pin, and why" list, directly after the **"The layout above every admin page reads twelve plants, not the garden."** bullet, add:

```markdown
- **The garden map is a read-only, live-garden reader, and a `bleed` page.**
  `/admin/map` ([`specs/2026-11-15-garden-map-design.md`](docs/superpowers/specs/2026-11-15-garden-map-design.md))
  draws `Plant → Pod → Bean` with draft sprouts and inbox seeds as leaves. What
  waits is an amber ring *and* the word "Waiting"; what is missing is a chip.
  `lib/garden-map.ts` decides every flag and `lib/garden-map-layout.ts` (dagre,
  on the server) every coordinate, so `app/admin/_components/garden-map.tsx` is
  a thin island that imports **types only** from them — `lib/garden-map.ts`
  reaches `lib/data.ts` and so `node:fs`, which fails the build from a client
  file. It reads `loadRawGarden` and `listSeeds`, never the cache, because a map
  of "what waits" that lagged a write shows a garden you already changed. It has
  no write path: each node is a `next/link` to the page where the decision
  lives. It is the one route `resolveColumn` calls `"bleed"` — a canvas in a
  1024px column defeats itself — so `AdminMain` gives it `fixed inset-0 z-0`
  under the chrome's `z-40` plates. A published sprout is **not** drawn (a
  hairball) but still counts toward "bean has no journal", and a machine-
  projected bean is exempt from every gap. `lib/garden-map.test.ts` pins the
  rules, `lib/garden-map-source.test.ts` the boundary.
```

- [ ] **Step 2: Run the whole suite, typecheck and lint**

```bash
npm test
npx tsc --noEmit
npm run lint
```

Expected: all PASS, 0 type errors, 0 lint errors. Any failure in a file this plan did not touch is a stale count or fixture for "six sections" — fix the expectation, never the code under test, and say so in the commit message.

- [ ] **Step 3: Build in this worktree (never the main checkout)**

```bash
npm run build
```

Expected: succeeds; `/admin/map` appears in the route table as dynamic (`ƒ`). If it fails with `UnhandledSchemeError: Reading from "node:…"`, a client file imported a value from `lib/` — find it with the source test's error and make it `import type`.

- [ ] **Step 4: Check the public zone did not gain weight**

```bash
npm run build 2>&1 | grep -E "^(├|└|┌).*(/plant/\[slug\]|/beanstalk|/sprout/\[slug\])"
```

Expected: first-load sizes for those routes match what `main` reports (`/plant/[slug]` 144 kB, `/beanstalk` 105 kB per `CLAUDE.md`). `@xyflow/react` is admin-only; it must not appear in a public route's chunks.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "CLAUDE.md: the garden map is a live reader and a bleed page

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Look at it (ask first)

The local dev server reads the **production** database. The page is read-only, but ask the maintainer before starting it.

- [ ] **Step 1: Ask**

Ask: "The map is built and tested. To look at it I need to run the dev server, which reads your production garden (read-only). OK to start it, or would you rather open the branch yourself?"

- [ ] **Step 2 (only on a yes): Look**

Start the dev server from this worktree on a free port, log in to `/admin`, open `/admin/map`, and check each of these with a screenshot:

1. Unscoped, the forest renders and `fitView` frames it; the left rail and both top clusters are not covered; the minimap is bottom-right, controls bottom-left, the toolbar bottom-centre.
2. **Needs review** dims what is calm and leaves amber-ringed nodes lit; **Has gaps** does the same for chips; the URL is `?view=review` / `?view=gaps`; **All** drops the param.
3. Pick a plant in the switcher: the URL gains `?plant=<slug>`, the map narrows to that tree, no Unrooted or Inbox node, and the rail still shows Map.
4. Click a node name: it navigates client-side to that node's admin page.
5. Toggle dark mode in the public site's menu or via `localStorage`, return to the map: canvas, cards and edges are legible.
6. Narrow the window to ~375px: the minimap is gone, the toolbar fits, nothing is horizontally scrolled.
7. Read the chips on the largest card (waiting + no narrative + no journal): they must not clip at 260px wide. If they do, widen `KIND_SIZE` in `lib/garden-map-layout.ts` — the card and the layout share that one number.

Report what you saw, including anything that looked wrong. Do not claim it works from the tests alone.

---

## Self-review (against the spec)

- **Nodes and edges table** — plants/pods/beans, draft sprouts, inbox seeds, Unrooted, Inbox, two-parent nodes, scope subsetting: Task 3 (builder + tests for each row).
- **Flags** — waiting (visibility via `visibilityOf`, draft sprouts, inbox seeds), missing (no narrative, no FR, no children incl. published sprouts counting, projected exemption): Task 3.
- **Page, scope, column** — `/admin/map`, `NavId`, `SECTION_KEYS`, icon, rail counts and hotkeys, `bleed`: Task 2; page: Task 7. `middleware.ts` needs no change (matcher is `/admin/:path*`).
- **Data flow** — pure builder, server-side dagre layout, thin island, types-only imports, live reads: Tasks 3, 4, 6, 7; pinned: Task 8.
- **Interaction** — read-only, link-per-node, non-draggable, `?view=` toolbar that dims not hides, counts: Tasks 5, 6, 7.
- **Edge cases** — load failure, empty garden/scope, dark mode, dangling seed suggestion: Tasks 3, 6, 7.
- **Testing list** — builder, layout, source, nav/section tests, CLAUDE.md note: Tasks 2, 3, 4, 8, 9.
- **Spec correction made while planning:** the spec's table said sprouts were drawn when "not published" while its flags said "draft"; both now say **draft only** (`stateOf === "draft"`), and projected beans are exempt from every gap, not only "no narrative". Both are in the spec file.
- **Types consistent across tasks:** `MapNode`, `MapEdge`, `GardenMap`, `MapView`, `MAP_VIEWS`, `mapViewOf`, `buildGardenMap`, `KIND_SIZE`, `PositionedNode`, `PositionedMap`, `layoutGardenMap`, `MapNodeCard`, `gapWord`, `GardenMap` (component), `MapToolbar` are each defined once and used with the same names.
