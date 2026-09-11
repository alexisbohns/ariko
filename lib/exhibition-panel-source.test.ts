import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The claim `plant-inside.tsx`'s docblock rests on, enforced rather than
 * written down: the client island composes no Exhibition payload and learns
 * no field name, because the panel's contents are server-rendered by
 * `app/admin/plant/[slug]/page.tsx` and handed down as the `exhibition` prop
 * — `plant-hero.tsx`'s arrangement for `metaForm`, `roleForm` and `logoForm`,
 * for the same reason.
 *
 * Two ways to break that are silent in exactly the shape
 * `lib/server-safe-source.test.ts` and `lib/screen-sheet-source.test.ts`
 * describe for their own files:
 *
 *  - Someone imports `reorderExhibitionAction`, or a field name, into
 *    `plant-inside.tsx` — to fire a "Clear all" straight from the island,
 *    say. `tsc` passes: the action is a plain async function and nothing
 *    stops a client component from importing one. `npm test` passes: nothing
 *    else in the suite reads this file's import list. `npm run build`
 *    passes: a server action imported into a client component is legal
 *    Next — it becomes an RPC. The panel keeps working. What is gone,
 *    silently, is the property `plant-inside.tsx`'s docblock claims: the
 *    island now knows a field name and the next change to it can build a
 *    payload of its own.
 *
 *  - Someone adds `"use client"` to `exhibition-panel.tsx` — to wire a
 *    confirm dialog onto the ✕ button, say. `tsc` passes: a client component
 *    can still return a `<form action={...}>`. `npm test` and `npm run
 *    build` pass for the same reasons. The row still submits. What changes
 *    is WHERE the payload is built — from the server-rendered markup this
 *    file's docblock promises to a client bundle that can reshape it before
 *    the POST, the class of hazard `buildMediaPatch`'s `__ready` marker
 *    exists to catch on a different island.
 *
 * Both are facts about a file's import graph and directive, not about
 * anything a render can observe, so those two get source text —
 * `lib/server-safe-source.test.ts`'s reasoning, restated: "this file imports
 * X" and "this file is a client component" are properties of the file AS
 * WRITTEN, and `renderToStaticMarkup` cannot see either.
 *
 * There used to be a third test here, rendering PlantInside with a marker as
 * `exhibition.panel` and asserting the marker never reached the script-off
 * HTML. It pinned an entry in CLAUDE.md's exception ledger; the rulebook slice
 * replaced that ledger with three invariants, under which an admin island
 * rendering nothing before it mounts is unremarkable. The two rules above are
 * NOT that rule — they are about where a payload is composed, which is
 * invariant 3's territory and survives the ledger intact.
 */

const PLANT_INSIDE = "app/admin/_components/plant-inside.tsx";
const EXHIBITION_PANEL = "app/admin/_components/exhibition-panel.tsx";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test(`${PLANT_INSIDE} imports no server action and no lib module that would let it compose a payload`, () => {
  const text = source(PLANT_INSIDE);
  for (const spec of ["../actions", "@/lib/exhibition", "@/lib/data"]) {
    assert.ok(
      !text.includes(`from "${spec}"`) && !text.includes(`from '${spec}'`),
      `${PLANT_INSIDE} must not import from "${spec}" — that would let the ` +
        `island compose the Exhibition payload plant-hero.tsx's arrangement ` +
        `is meant to keep server-side`,
    );
  }
});

test(`${EXHIBITION_PANEL} is not a client component`, () => {
  const text = source(EXHIBITION_PANEL);
  assert.ok(
    !/^\s*["']use client["']/m.test(text),
    `${EXHIBITION_PANEL} must not be a client component — its forms must ` +
      `stay server-composed, exactly like every other admin metadata form`,
  );
});
