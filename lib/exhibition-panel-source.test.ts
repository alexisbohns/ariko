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
 * The third property — that the popover's contents genuinely do not reach
 * the script-off HTML — IS observable by rendering, and gets
 * `lib/plant-hero-mount.test.ts`'s technique exactly: hand `PlantInside` a
 * recognisable marker as `exhibition.panel` and assert the marker never
 * appears in `renderToStaticMarkup`'s output. It does not, because the
 * popover is CLOSED on a server render (no script, no `open` state) and Base
 * UI does not mount closed content — the same reason none of
 * `plant-hero-mount.test.ts`'s sheets or popovers leak a field name either.
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

async function renderScriptOff(element: unknown): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToStaticMarkup(element as any);
}

test("the Exhibition panel's contents do not reach the script-off HTML", async () => {
  const React = await import("react");
  const { PlantInside } = await import("@/app/admin/_components/plant-inside");

  // A marker rather than a real ExhibitionPanel: what this test pins is that
  // PlantInside never renders WHATEVER it is handed while the popover is
  // closed, not that ExhibitionPanel in particular behaves — that half is
  // exhibition-panel.tsx's own concern.
  const marker = React.createElement("input", { name: "__exhibition_marker__" });

  const html = await renderScriptOff(
    React.createElement(PlantInside, {
      items: [],
      exhibition: { count: 3, panel: marker },
      children: React.createElement("div", null, "body"),
    }),
  );

  assert.ok(
    !html.includes("__exhibition_marker__"),
    `the Exhibition panel's contents leaked into the script-off render:\n${html}`,
  );
});
