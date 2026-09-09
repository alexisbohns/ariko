import { test } from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS } from "./admin-nav";
import { SECTION_ICONS } from "@/app/admin/_components/section-icons";

/**
 * The rail and the palette draw the sections from ONE map now, and this is what
 * keeps it honest: an href in NAV_ITEMS with no icon beside it is the defect
 * that shipped when Screens was added — the palette fell through to its generic
 * section icon and two sections became the same picture, silently, past `tsc`
 * and past every other test in this suite.
 *
 * A `Record<string, …>` cannot express "keyed by exactly the NAV_ITEMS hrefs"
 * in the type system, so it is expressed here instead.
 */

test("every section has an icon", () => {
  for (const item of NAV_ITEMS) assert.ok(item.href in SECTION_ICONS, item.href);
});

test("and no icon outlives its section", () => {
  // The other direction, which is the one that rots quietly: a section removed
  // from the rail leaves an orphan here that nothing renders and nothing flags.
  const hrefs = new Set(NAV_ITEMS.map((item) => item.href));
  for (const href of Object.keys(SECTION_ICONS)) assert.ok(hrefs.has(href), href);
});

test("no two sections draw the same icon", () => {
  // The failure this file exists for was not a missing entry per se — it was two
  // rows looking identical. Sameness is the thing to assert.
  const icons = Object.values(SECTION_ICONS);
  assert.equal(new Set(icons).size, icons.length);
});
