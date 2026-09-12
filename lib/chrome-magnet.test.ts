import { test } from "node:test";
import assert from "node:assert/strict";

import { MAGNETS, magnetLabelSide, magnetPosition, type Magnet } from "./chrome-magnet";

/**
 * The chrome's arithmetic, pinned.
 *
 * Two of these are shape tests rather than value tests, and they are the ones
 * that would actually catch a mistake. A ninth magnet added without a position
 * is a cluster that renders in the document flow, halfway down the page, with
 * no error anywhere: `Record<Magnet, string>` catches a MISSING key at compile
 * time, but not an empty or a duplicated one.
 */

test("every magnet has a position, and no two share one", () => {
  const seen = new Set<string>();
  for (const magnet of MAGNETS) {
    const position = magnetPosition(magnet);
    assert.ok(position.length > 0, `${magnet} has no position`);
    assert.ok(!seen.has(position), `${magnet} duplicates the position of another magnet`);
    seen.add(position);
  }
  assert.equal(seen.size, 8);
});

test("a magnet's position names the edges it is pinned to", () => {
  // The class strings are complete literals so Tailwind can read them, which
  // means a typo is invisible to tsc. This is the guard against one.
  const expected: Record<Magnet, string> = {
    "top-left": "left-4 top-4",
    "top-center": "left-1/2 top-4 -translate-x-1/2",
    "top-right": "right-4 top-4",
    left: "left-4 top-1/2 -translate-y-1/2",
    right: "right-4 top-1/2 -translate-y-1/2",
    "bottom-left": "bottom-4 left-4",
    "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
    "bottom-right": "bottom-4 right-4",
  };
  for (const magnet of MAGNETS) assert.equal(magnetPosition(magnet), expected[magnet]);
});

test("labels open away from the edge the cluster is pinned to", () => {
  // The five clusters this replaced each chose their side by hand and all five
  // agreed, because there is only one right answer. These are those answers.
  assert.equal(magnetLabelSide("top-left"), "bottom"); // the public nav
  assert.equal(magnetLabelSide("top-right"), "bottom"); // the account cluster
  assert.equal(magnetLabelSide("left"), "right"); // the admin rail
  assert.equal(magnetLabelSide("right"), "left"); // the plant's Exhibition rail
  assert.equal(magnetLabelSide("bottom-center"), "top");
});

test("a vertical rail never opens its labels vertically", () => {
  // Stacked labels on a vertical rail would cover the icons above and below the
  // one being hovered — the one arrangement that is not merely ugly but wrong.
  for (const magnet of ["left", "right"] as const) {
    const side = magnetLabelSide(magnet);
    assert.ok(side === "left" || side === "right", `${magnet} opens ${side}`);
  }
});
