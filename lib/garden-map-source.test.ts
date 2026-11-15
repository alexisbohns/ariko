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
