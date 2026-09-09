import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyExhibitionOp,
  exhibitionOf,
  exhibitionOpOf,
  exhibitionOrder,
  exhibitionWrites,
} from "./exhibition";

// --- exhibitionOrder: the comparator the strip and the panel share.

test("exhibitionOrder sorts by order ascending", () => {
  const sorted = [{ slug: "c", order: 2 }, { slug: "a", order: 0 }, { slug: "b", order: 1 }].sort(
    exhibitionOrder,
  );
  assert.deepEqual(sorted.map((e) => e.slug), ["a", "b", "c"]);
});

test("exhibitionOrder sorts an entry with no order LAST, never first", () => {
  // Fail-visible: the author said exhibit it, so a missing sort key costs
  // position and never presence. A naive `(a.order ?? 0) - (b.order ?? 0)`
  // would put it at the head of the strip instead.
  const sorted = [{ slug: "b" }, { slug: "a", order: 0 }].sort(exhibitionOrder);
  assert.deepEqual(sorted.map((e) => e.slug), ["a", "b"]);
});

test("exhibitionOrder breaks a tie on slug", () => {
  const sorted = [{ slug: "b", order: 0 }, { slug: "a", order: 0 }].sort(exhibitionOrder);
  assert.deepEqual(sorted.map((e) => e.slug), ["a", "b"]);
  const unordered = [{ slug: "z" }, { slug: "y" }].sort(exhibitionOrder);
  assert.deepEqual(unordered.map((e) => e.slug), ["y", "z"]);
});

test("exhibitionOrder sorts a NaN order last rather than returning NaN", () => {
  // `typeof NaN === "number"` passes a naive guard, so `ao - bo` would be NaN
  // and the sort's behaviour would become implementation-defined. Assert the
  // resulting slug order, not the comparator's return value, because it is the
  // strip's position that matters.
  const sorted = [{ slug: "a", order: 0 }, { slug: "b", order: NaN }].sort(exhibitionOrder);
  assert.deepEqual(sorted.map((e) => e.slug), ["a", "b"]);
});

// --- exhibitionOf: the narrowing exhibitionWrites' first argument requires.

test("exhibitionOf returns only the exhibited entries", () => {
  const screens = [
    { slug: "a", exhibited: true, order: 0 },
    { slug: "b", exhibited: false },
    { slug: "c" },
  ];
  assert.deepEqual(exhibitionOf(screens).map((s) => s.slug), ["a"]);
});

test("exhibitionOf returns them in exhibitionOrder", () => {
  // Built out of order so a missing sort fails this.
  const screens = [
    { slug: "c", exhibited: true, order: 2 },
    { slug: "a", exhibited: true, order: 0 },
    { slug: "b", exhibited: true, order: 1 },
  ];
  assert.deepEqual(exhibitionOf(screens).map((s) => s.slug), ["a", "b", "c"]);
});

test("exhibitionOf does not reorder or filter the array it was given", () => {
  const screens = [
    { slug: "b", exhibited: true, order: 1 },
    { slug: "a", exhibited: true, order: 0 },
  ];
  exhibitionOf(screens);
  assert.deepEqual(screens.map((s) => s.slug), ["b", "a"]);
});

test("exhibitionOf keeps the caller's extra fields", () => {
  // Pins the generic: a caller's rows are never narrowed to ExhibitionEntry.
  const screens = [{ slug: "a", exhibited: true, order: 0, name: "Home screen" }];
  assert.deepEqual(exhibitionOf(screens), [
    { slug: "a", exhibited: true, order: 0, name: "Home screen" },
  ]);
});

// --- exhibitionOpOf: the vocabulary, re-validated rather than trusted.

test("exhibitionOpOf admits the four members", () => {
  assert.equal(exhibitionOpOf("add"), "add");
  assert.equal(exhibitionOpOf("remove"), "remove");
  assert.equal(exhibitionOpOf("up"), "up");
  assert.equal(exhibitionOpOf("down"), "down");
});

test("exhibitionOpOf refuses anything else", () => {
  assert.equal(exhibitionOpOf(""), null);
  assert.equal(exhibitionOpOf("ADD"), null);
  assert.equal(exhibitionOpOf("drop"), null);
});

// --- applyExhibitionOp: the new list, or null for a no-op.

test("add appends to the end of the strip", () => {
  assert.deepEqual(applyExhibitionOp(["a", "b"], "c", "add"), ["a", "b", "c"]);
  assert.deepEqual(applyExhibitionOp([], "a", "add"), ["a"]);
});

test("add is a no-op when the screen is already exhibited", () => {
  assert.equal(applyExhibitionOp(["a", "b"], "a", "add"), null);
});

test("remove drops the screen and keeps the rest in order", () => {
  assert.deepEqual(applyExhibitionOp(["a", "b", "c"], "b", "remove"), ["a", "c"]);
});

test("up and down swap with the neighbour", () => {
  assert.deepEqual(applyExhibitionOp(["a", "b", "c"], "b", "up"), ["b", "a", "c"]);
  assert.deepEqual(applyExhibitionOp(["a", "b", "c"], "b", "down"), ["a", "c", "b"]);
});

test("up at the head and down at the tail are no-ops, not errors", () => {
  // A stray press on a disabled-looking button writes nothing at all, which is
  // what dirty-gates the whole write path.
  assert.equal(applyExhibitionOp(["a", "b"], "a", "up"), null);
  assert.equal(applyExhibitionOp(["a", "b"], "b", "down"), null);
});

test("an unknown slug is a no-op for every op but add", () => {
  assert.equal(applyExhibitionOp(["a"], "ghost", "remove"), null);
  assert.equal(applyExhibitionOp(["a"], "ghost", "up"), null);
  assert.equal(applyExhibitionOp(["a"], "ghost", "down"), null);
});

test("applyExhibitionOp never mutates the list it was given", () => {
  const before = ["a", "b"];
  applyExhibitionOp(before, "b", "up");
  assert.deepEqual(before, ["a", "b"]);
});

// --- exhibitionWrites: only what actually moved.

test("a swap promotes exactly the two screens that moved", () => {
  const before = [{ slug: "a", order: 0 }, { slug: "b", order: 1 }, { slug: "c", order: 2 }];
  const writes = exhibitionWrites(before, ["b", "a", "c"]);
  assert.deepEqual(writes.promote, [{ slug: "b", order: 0 }, { slug: "a", order: 1 }]);
  assert.deepEqual(writes.withdraw, []);
});

test("an added screen is promoted and nothing else is", () => {
  const before = [{ slug: "a", order: 0 }];
  const writes = exhibitionWrites(before, ["a", "b"]);
  assert.deepEqual(writes.promote, [{ slug: "b", order: 1 }]);
  assert.deepEqual(writes.withdraw, []);
});

test("a removed screen is withdrawn and everything after it renumbers", () => {
  const before = [{ slug: "a", order: 0 }, { slug: "b", order: 1 }, { slug: "c", order: 2 }];
  const writes = exhibitionWrites(before, ["a", "c"]);
  assert.deepEqual(writes.promote, [{ slug: "c", order: 1 }]);
  assert.deepEqual(writes.withdraw, ["b"]);
});

test("an exhibited screen with NO stored order is promoted even where it sits", () => {
  // The bug this pins: comparing membership instead of stored order skips this
  // screen forever, so it stays orderless and keeps sorting last no matter how
  // often the author moves it.
  const before = [{ slug: "a", order: 0 }, { slug: "b" }];
  const writes = exhibitionWrites(before, ["a", "b"]);
  assert.deepEqual(writes.promote, [{ slug: "b", order: 1 }]);
});

test("an unchanged strip writes nothing at all", () => {
  const before = [{ slug: "a", order: 0 }, { slug: "b", order: 1 }];
  const writes = exhibitionWrites(before, ["a", "b"]);
  assert.deepEqual(writes.promote, []);
  assert.deepEqual(writes.withdraw, []);
});

test("withdraw is a set difference: present in exhibited and absent from after is withdrawn, present in both is not", () => {
  const before = [{ slug: "a", order: 0 }, { slug: "b", order: 1 }, { slug: "c", order: 2 }];
  const writes = exhibitionWrites(before, ["a", "c"]);
  assert.deepEqual(writes.withdraw, ["b"]);
  assert.ok(!writes.withdraw.includes("a"));
  assert.ok(!writes.withdraw.includes("c"));
});
