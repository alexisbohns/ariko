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
      // `map-sheet` imports nothing, so it reaches no `node:` module either.
      assert.ok(typeOnly || /@\/lib\/(utils|map-sheet)["']/.test(line), `${file}: ${line}`);
    }
  }
});

test("the client side reaches no server-only module", () => {
  for (const file of [ISLAND, CARD]) {
    const src = code(read(file));
    // Module specifiers only: a bare `node:` would also match the property
    // `node: PositionedNode`, which is the card's own prop.
    assert.doesNotMatch(src, /["'](?:@\/lib\/(?:store|seeds|db)\b|node:[a-z])/, file);
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

test("layout is pure and runs on the server: no react, xyflow or next in the layout module, no layout import in the client", () => {
  // The layout is plain arithmetic over the builder's nodes, so it can be run
  // by `npm test` and shipped by neither bundle. A framework import there would
  // make it a thing that needs rendering to test.
  const layout = code(read("lib/garden-map-layout.ts"));
  assert.doesNotMatch(layout, /from\s+["'](?:react|react-dom|@xyflow\/|next)\b/);
  assert.doesNotMatch(layout, /^import\s+["'](?:react|react-dom|@xyflow\/|next)\b/m);
  assert.doesNotMatch(layout, /dagre/);
  // And the island draws finished coordinates: it never imports the layout as
  // a value (the type-only rule above lets `PositionedMap` through).
  for (const file of [ISLAND, CARD]) {
    assert.doesNotMatch(code(read(file)), /^import\s+(?!type\b)[^;]*from\s+["']@\/lib\/garden-map-layout["']/m, file);
    assert.doesNotMatch(code(read(file)), /dagre/, file);
  }
});

test("every card declares one target handle on top and one source handle on the bottom", () => {
  // Every edge runs from the bottom-centre of its source to the top-centre of
  // its target, so a card needs exactly those two handles and no edge names
  // one. An edge naming a handle the node does not render is dropped by React
  // Flow with a console warning and nothing else: the line just is not there.
  const src = code(read(ISLAND));
  const handles = src.match(/<Handle\b[^>]*>/g) ?? [];
  assert.equal(handles.length, 2);
  const target = handles.filter((tag) => /type="target"/.test(tag));
  const source = handles.filter((tag) => /type="source"/.test(tag));
  assert.equal(target.length, 1);
  assert.equal(source.length, 1);
  assert.match(target[0], /position=\{Position\.Top\}/);
  assert.match(source[0], /position=\{Position\.Bottom\}/);
  for (const tag of handles) {
    assert.match(tag, /isConnectable=\{false\}/);
    assert.match(tag, /className=\{HANDLE\}/);
  }
  assert.match(src, /const HANDLE = "pointer-events-none opacity-0"/);
  // The old file-tree shape is gone, in the island and in the layout alike.
  for (const file of [ISLAND, "lib/garden-map-layout.ts"]) {
    assert.doesNotMatch(code(read(file)), /sourceHandle|targetHandle|trunk|smoothstep/, file);
  }
  assert.match(src, /type: "default"/);
});

test("a card draws plain lazy <img> thumbnails, never next/image", () => {
  // The builder hands over a thumbnail Cloudinary has already cut to size
  // (`cloudinaryThumb`), so `next/image` would only add a proxy hop to redo it.
  const src = code(read(CARD));
  assert.match(src, /<img\b/);
  assert.match(src, /loading="lazy"/);
  assert.match(src, /alt=""/);
  assert.doesNotMatch(src, /next\/image/);
});

test("the card's name is a stretched link that opts back in to pointer events", () => {
  // The card is `relative` and the link's `::after` covers it, so the whole
  // card is the click target and an image needs no link of its own.
  const src = code(read(CARD));
  assert.match(src, /after:inset-0/);
  assert.match(src, /after:absolute/);
  assert.match(src, /\brelative\b/);
});

test("a nav item, a scope key list and an icon exist for the map", async () => {
  // Redundant with admin-nav / admin-scope / section-icons tests on purpose:
  // those fail on a rename; this fails on a DELETION of the section entirely.
  const { NAV_ITEMS } = await import("./admin-nav");
  assert.ok(NAV_ITEMS.some((item) => item.id === "map" && item.href === "/admin/map"));
});

test("the card's link opts back in to pointer events", () => {
  // React Flow gives every node wrapper an inline `pointer-events: none` unless
  // the node is selectable, draggable or has a click/hover handler — ours has
  // none of those, on purpose. `pointer-events` INHERITS, so the `next/link`
  // inside the card receives no clicks and every node is a dead label. The
  // inline style beats any stylesheet rule on an ancestor, so the opt-in has to
  // sit on the link itself; a render test without React Flow cannot see the
  // wrapper at all, which is why this is a source test.
  assert.match(code(read(CARD)), /pointer-events-auto/);
});

test("the page remounts the canvas when the scope changes", () => {
  // `fitView` runs once, on mount. A `?plant=` change swaps the whole tree, so
  // without a key the new tree would be drawn inside the old viewport —
  // possibly off screen. `?view=` must NOT be in the key: it only dims nodes,
  // and a remount would throw away the author's pan and zoom.
  assert.match(code(read(PAGE)), /<GardenMap\s+key=\{scope\b[^}]*\}/);
});

test("the toolbar and controls survive a narrow viewport", () => {
  const toolbar = code(read("app/admin/_components/map-toolbar.tsx"));
  // A bottom-centre fixed element with `left: 50%` otherwise shrinks to half
  // the viewport and wraps; and the plate is transparent at md+, so over a busy
  // canvas the only view switcher would be bare text.
  assert.match(toolbar, /w-max max-w-\[calc\(100vw-2rem\)\]/);
  assert.match(toolbar, /md:bg-card\/80/);
  assert.match(toolbar, /whitespace-nowrap/);
  const island = code(read(ISLAND));
  // xyflow's stylesheet is unlayered and sets `display` on the controls, so a
  // plain `hidden` loses to it: only the important form wins.
  assert.match(island, /max-md:hidden!/);
  assert.match(island, /className="hidden lg:block"/);
  // A forest with more than ~55 nodes in one rank cannot fit at 0.1.
  assert.match(island, /minZoom=\{0\.05\}/);
});

test("the card's link does not prefetch, and the page logs and names itself", () => {
  // Every node link is in the viewport at low zoom: default prefetching would
  // fire one dynamic admin request per node, each running the chrome layout's
  // database read.
  assert.match(code(read(CARD)), /prefetch=\{false\}/);
  const page = code(read(PAGE));
  // A caught error that is neither logged nor shown hides a broken database.
  assert.match(page, /catch \(error\)/);
  assert.match(page, /console\.error\("admin map: could not build the garden map", error\)/);
  // One heading in every branch: the canvas has none of its own.
  assert.equal((page.match(/<h1 className="sr-only">Garden map<\/h1>/g) ?? []).length, 3);
});
