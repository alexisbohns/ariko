/**
 * Where a floating chrome cluster sits, and which way its labels open.
 *
 * Pure and JSX-free so `npm test` can reach it — the same split
 * `lib/admin-nav.ts` makes for the rail's model, and for the same reason: the
 * component that consumes this is rendered, this is arithmetic.
 *
 * Eight magnets and no ninth. There is deliberately no centre-centre: a cluster
 * there would cover the page it floats over, which is the one thing a chrome
 * must not do.
 *
 * The second function is the whole reason this file exists. Before it, the
 * label side was chosen five times by hand — `side="right"` on the admin rail,
 * `side="bottom"` on the account cluster, `side="left"` on the plant's Inside
 * rail, `top-full` hard-coded in IconLink — and they happened to agree. They
 * agreed because there is only ever ONE correct answer: a cluster pinned to an
 * edge can only open its labels away from that edge. So it is derived rather
 * than passed, and a sixth cluster cannot get it wrong.
 *
 * This is also the argument for not reaching for Base UI here, which CLAUDE.md
 * otherwise insists on. The registry's positioning solves collision detection
 * for a floating element anchored to an arbitrary in-flow trigger — every
 * popover, sheet and the palette keep it. A cluster magnetized to a viewport
 * corner has nothing to collide with. What it needs is this table.
 */

export type Magnet =
  | "top-left"
  | "top-center"
  | "top-right"
  | "left"
  | "right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/** Every magnet, for tests and for anything that wants to enumerate them. */
export const MAGNETS: readonly Magnet[] = [
  "top-left",
  "top-center",
  "top-right",
  "left",
  "right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

/** The side a label opens toward — away from the edge the cluster is pinned to. */
export type LabelSide = "top" | "right" | "bottom" | "left";

// Tailwind cannot see class names it did not read in a source file, so these
// are complete literals rather than composed from `${edge}-4` fragments.
const POSITION: Record<Magnet, string> = {
  "top-left": "left-4 top-4",
  "top-center": "left-1/2 top-4 -translate-x-1/2",
  "top-right": "right-4 top-4",
  left: "left-4 top-1/2 -translate-y-1/2",
  right: "right-4 top-1/2 -translate-y-1/2",
  "bottom-left": "bottom-4 left-4",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
  "bottom-right": "bottom-4 right-4",
};

const LABEL_SIDE: Record<Magnet, LabelSide> = {
  "top-left": "bottom",
  "top-center": "bottom",
  "top-right": "bottom",
  // The two edge-centred magnets are the only ones whose labels open sideways:
  // a vertical rail's labels would otherwise stack on top of each other.
  left: "right",
  right: "left",
  "bottom-left": "top",
  "bottom-center": "top",
  "bottom-right": "top",
};

/** The fixed-position classes for a magnet. */
export function magnetPosition(magnet: Magnet): string {
  return POSITION[magnet];
}

/** Which way a cluster's hover labels open. Derived, never passed. */
export function magnetLabelSide(magnet: Magnet): LabelSide {
  return LABEL_SIDE[magnet];
}
