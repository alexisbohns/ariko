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
  for (const id of Object.keys(SECTION_ICONS) as NavId[]) assert.ok(EVERY_ID.has(id), id);
});

test("no two sections draw the same icon", () => {
  const icons = Object.values(SECTION_ICONS);
  assert.equal(new Set(icons).size, icons.length);
});
