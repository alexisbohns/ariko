import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentType, SVGProps } from "react";

import { Crown, Sprout, Waypoints, Zap, ZapOff } from "lucide-react";
import {
  CrownIcon,
  SproutIcon,
  WaypointsIcon,
  ZapIcon,
  ZapOffIcon,
} from "./public-icons";

/**
 * The one thing that keeps `components/public-icons.tsx` honest.
 *
 * That file inlines lucide's path data so the public zone never crosses
 * lucide-react's "use client" boundary, and its header makes a claim on the
 * strength of that copy: the crown on a public plant page is the same crown as
 * on /admin/plant/[slug], because it is the same twelve numbers. Nothing
 * enforced it. package.json pins `"lucide-react": "^1.33.0"` — a CARET — and
 * lucide redraws icons in minor releases, so a routine `npm install` could
 * change the admin's glyph and leave the public one untouched. That drift is
 * invisible to `tsc` (the copy is a string), invisible to `npm test` (nothing
 * read it) and invisible to CI: the two zones simply start disagreeing, and the
 * first person to notice is a visitor comparing two pages.
 *
 * So this test renders both and compares the GEOMETRY. On a lucide bump that
 * moves any of the five, it fails loudly — which is the point: the fix is for
 * someone to re-copy the data deliberately, not for the divergence to ship.
 *
 * Two deliberate limits on what is compared:
 *
 *  - The public API only. `lucide-react` publishes no `exports` subpath map, so
 *    reaching into dist/esm/icons/<name>.mjs for `__iconNode` would be reading a
 *    private implementation detail that a future package layout is free to move.
 *    Rendering the exported component is the contract lucide actually offers.
 *  - Geometry ONLY — every <path>/<circle>'s `d`, `cx`, `cy`, `r`, in document
 *    order. Stroke, fill, class and size legitimately differ: our SvgFrame sets
 *    its own defaults and callers size the glyph themselves. Asserting on those
 *    would make this test fail for a reason that has nothing to do with the
 *    shape it exists to protect.
 *
 * renderToStaticMarkup, no jsdom — same route as components/media.test.tsx,
 * which also explains why `tsconfig.test.json` exists.
 */

/** One drawing primitive, reduced to the numbers that define its shape. */
type Geometry = Record<string, string | undefined>;

const GEOMETRY_ATTRS = ["d", "cx", "cy", "r"] as const;

/**
 * Attribute order inside a tag is an implementation detail of whoever emitted
 * it, so each element is reduced to a keyed record rather than compared as a
 * string. Element order is NOT an implementation detail — a path drawn before a
 * circle is a different picture — so the list stays in document order.
 */
const geometryOf = (markup: string): Geometry[] => {
  const shapes: Geometry[] = [];
  for (const tag of markup.matchAll(/<(path|circle)\b([^>]*)>/g)) {
    const [, , attrs] = tag;
    const shape: Geometry = { tag: tag[1] };
    for (const name of GEOMETRY_ATTRS) {
      const found = attrs.match(new RegExp(`\\b${name}="([^"]*)"`));
      if (found) shape[name] = found[1];
    }
    shapes.push(shape);
  }
  return shapes;
};

const render = (Icon: ComponentType<SVGProps<SVGSVGElement>>) =>
  geometryOf(renderToStaticMarkup(<Icon />));

const pairs: ReadonlyArray<
  readonly [
    string,
    ComponentType<SVGProps<SVGSVGElement>>,
    ComponentType<SVGProps<SVGSVGElement>>,
  ]
> = [
  ["crown", Crown, CrownIcon],
  ["sprout", Sprout, SproutIcon],
  ["waypoints", Waypoints, WaypointsIcon],
  ["zap", Zap, ZapIcon],
  ["zap-off", ZapOff, ZapOffIcon],
];

for (const [name, Upstream, Ours] of pairs) {
  test(`our ${name} is lucide's ${name}`, () => {
    const upstream = render(Upstream);

    // Non-vacuous: a regex that matched nothing would make every comparison
    // below pass by drawing two empty pictures.
    assert.ok(
      upstream.length > 0,
      `no geometry parsed out of lucide's ${name} — the extractor, not the icon, is broken`,
    );

    assert.deepEqual(
      render(Ours),
      upstream,
      `components/public-icons.tsx has drifted from lucide's ${name}: re-copy its path data`,
    );
  });
}
