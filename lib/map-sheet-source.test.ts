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

test("the admin's column follows the active segment, so the map stays bleed under its sheet", () => {
  // The sheet's URL is /admin/<tier>/<slug> while the router is still on the
  // map. A column that followed the URL would change <main>'s tree shape and
  // remount the map, the sheet and any editor in it — dropping an unsaved
  // draft — and squeeze the canvas to no height at all.
  const text = code("app/admin/_components/admin-chrome.tsx");
  assert.match(text, /useSelectedLayoutSegment\(\)/);
  assert.match(text, /resolveColumn\(pathname, segment\)/);
});

test("the sheet guards every in-place navigation, once — the ✕ has no guard of its own", () => {
  const text = code(SHEET);
  assert.match(text, /onClickCapture=\{onClickCapture\}/);
  assert.match(text, /isInPlaceNavigation\(/);
  // A guard on the ✕ as well would ask twice.
  assert.equal(/<Link\b[^>]*onClick=/.test(text), false, "the ✕ must not carry its own onClick");
});

test("the links the sheet shows are next/link, so a click swaps the sheet instead of leaving the map", () => {
  // A plain <a> hard-navigates: it leaves the map, and drops an open draft.
  for (const file of [
    "app/admin/_components/table-cells.tsx",
    "app/admin/_components/sprout-table.tsx",
    "app/admin/_components/preview-panel.tsx",
    "components/editor/edit-lang-switch.tsx",
    "app/admin/(chrome)/plant/[slug]/narrative/page.tsx",
  ]) {
    assert.match(code(file), /from "next\/link"/, `${file} must use next/link`);
  }
});
