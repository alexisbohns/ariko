import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The admin's shared tables are SERVER components, and this is what says so.
 *
 * They draw client glyphs — `components/admin/glyphs.tsx` carries its own
 * directive, which is the established way a server-rendered table gets a
 * lucide icon into a cell — and that arrangement is invisible from the outside:
 * the rendered table looks the same either way. So adding `"use client"` to
 * one of these six files, to wire a sort header or a row hover onto it, passes
 * `tsc`, passes `npm test` and passes `npm run build`, and what changes is only
 * that the table and everything it imports now ships to the browser and the
 * rows stop being server-rendered markup.
 *
 * `sprout-table.tsx` is the one file that would fail on its own — it imports
 * `resolveText` as a value from `lib/data.ts`, which opens with `node:fs`, the
 * trap `lib/palette.ts`'s split exists to document. The other five import from
 * `lib/data.ts` with `import type` or not at all, so nothing in the build
 * stops them. That asymmetry is precisely why the property is asserted here
 * for all six rather than left to the compiler.
 *
 * Source text rather than a render, for `lib/server-safe-source.test.ts`'s
 * reason: "this file is a client component" is a property of the file AS
 * WRITTEN, and `renderToStaticMarkup` cannot see it.
 */

const SERVER_TABLES = [
  "app/admin/_components/table-cells.tsx",
  "app/admin/_components/plant-table.tsx",
  "app/admin/_components/pod-table.tsx",
  "app/admin/_components/bean-table.tsx",
  "app/admin/_components/sprout-table.tsx",
  "app/admin/_components/preview-panel.tsx",
];

for (const path of SERVER_TABLES) {
  test(`${path} is not a client component`, () => {
    const text = readFileSync(join(process.cwd(), path), "utf8");
    assert.ok(
      !/^\s*["']use client["']/m.test(text),
      `${path} must not be a client component — it draws server-rendered rows, ` +
        `and reaches its icons through the glyph island rather than by becoming one`,
    );
  });
}
