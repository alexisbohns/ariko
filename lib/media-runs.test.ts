import { test } from "node:test";
import assert from "node:assert/strict";

import { mediaRuns } from "./media-runs";
import type { Media } from "./data";

/**
 * The gallery's whole decision, isolated from any markup.
 *
 * Pure here and thin in the component, the way lib/toc.ts holds the arithmetic
 * and components/toc-rail.tsx holds the DOM — so a grouping bug and a layout
 * bug are not diagnosed through the same surface.
 *
 * The threshold is TWO, and the one-image case is the load-bearing one: it must
 * come back as a `single`, because that is what keeps every existing sprout's
 * markup byte-for-byte unchanged by this slice.
 */

const img = (n: number): Media => ({ kind: "image", storageKey: `k${n}`, url: `https://cdn.test/${n}.jpg` });
const embed = (n: number): Media => ({ kind: "embed", provider: "spotify", url: `https://open.spotify.com/episode/${n}` });

test("two or more adjacent images become one gallery", () => {
  assert.deepEqual(mediaRuns([img(1), img(2), img(3)]), [
    { kind: "gallery", images: [img(1), img(2), img(3)] },
  ]);
});

test("a lone image stays a single — today's markup, unchanged", () => {
  assert.deepEqual(mediaRuns([img(1)]), [{ kind: "single", item: img(1) }]);
});

test("embeds are never grouped, however many are adjacent", () => {
  assert.deepEqual(mediaRuns([embed(1), embed(2)]), [
    { kind: "single", item: embed(1) },
    { kind: "single", item: embed(2) },
  ]);
});

test("a run is broken by an embed, and both sides group independently", () => {
  assert.deepEqual(mediaRuns([img(1), img(2), embed(1), img(3), img(4)]), [
    { kind: "gallery", images: [img(1), img(2)] },
    { kind: "single", item: embed(1) },
    { kind: "gallery", images: [img(3), img(4)] },
  ]);
});

test("the CASA episode 1 shape: two embeds, then six slides", () => {
  const runs = mediaRuns([embed(1), embed(2), img(1), img(2), img(3), img(4), img(5), img(6)]);
  assert.equal(runs.length, 3);
  assert.equal(runs[0].kind, "single");
  assert.equal(runs[1].kind, "single");
  assert.deepEqual(runs[2], { kind: "gallery", images: [img(1), img(2), img(3), img(4), img(5), img(6)] });
});

test("a lone image between two embeds is a single, and survives the trailing flush", () => {
  // Two thin spots the run-grouping could have had, in one shape: an image run
  // of exactly one that is neither first nor last, and — in the second case —
  // a run that ends the array and therefore only reaches a run list through
  // the flush() AFTER the loop.
  assert.deepEqual(mediaRuns([embed(1), img(1), embed(2)]), [
    { kind: "single", item: embed(1) },
    { kind: "single", item: img(1) },
    { kind: "single", item: embed(2) },
  ]);
  assert.deepEqual(mediaRuns([embed(1), img(1)]), [
    { kind: "single", item: embed(1) },
    { kind: "single", item: img(1) },
  ]);
});

test("order is preserved and nothing is dropped", () => {
  const input = [img(1), embed(1), img(2), img(3)];
  const flat = mediaRuns(input).flatMap((r) => (r.kind === "gallery" ? r.images : [r.item]));
  assert.deepEqual(flat, input);
});

test("an empty list yields no runs", () => {
  assert.deepEqual(mediaRuns([]), []);
});
