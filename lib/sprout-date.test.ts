import { test } from "node:test";
import assert from "node:assert/strict";
import { isTimelineDate } from "./sprout-date";

test("isTimelineDate accepts a plain day", () => {
  assert.equal(isTimelineDate("2026-09-12"), true);
});

test("isTimelineDate rejects a day carrying a time", () => {
  // Date-only is the convention lib/beanstalk.ts and lib/synthesis.ts both
  // record, and the pattern lib/articles.ts and lib/synthesis.ts both already
  // enforce at their own write doors. It is also the only thing `<input
  // type="date">` can round-trip. mergeBeanstalk would tolerate a timestamp
  // (it slices to 10), but byDateDesc compares raw and would sort it as a
  // later day than the same date written plainly — so the two sorters would
  // disagree about one sprout.
  assert.equal(isTimelineDate("2026-09-12T10:30:00Z"), false);
  assert.equal(isTimelineDate("2026-09-12T10:30:00.000Z"), false);
  assert.equal(isTimelineDate("2026-09-12 10:30"), false);
  assert.equal(isTimelineDate("2026-09-12T"), false);
  assert.equal(isTimelineDate("2026-09-12 "), false);
});

test("isTimelineDate rejects everything the timeline would misfile", () => {
  // Each of these reaches storage today and sorts as nonsense: mergeBeanstalk
  // compares the first ten characters as a string and never parses them.
  assert.equal(isTimelineDate(""), false);
  assert.equal(isTimelineDate("09/12/2026"), false);
  assert.equal(isTimelineDate("12 September 2026"), false);
  assert.equal(isTimelineDate("2026-9-1"), false);
  assert.equal(isTimelineDate("26-09-12"), false);
  assert.equal(isTimelineDate("  2026-09-12"), false);
  // Ten digits that are not a day: unanchored, this would slice down to
  // 2026-09-12 and claim to be a date it never was.
  assert.equal(isTimelineDate("2026-09-1234"), false);
  assert.equal(isTimelineDate("2026-09-12\n"), false);
});

test("isTimelineDate is shape, not calendar", () => {
  // Named so nobody later reads the guard as a validity check: the invariant
  // it protects is the sort, and a nonsense month sorts fine.
  assert.equal(isTimelineDate("2026-13-45"), true);
});

test("lib/sprout-date.ts imports nothing at all", async () => {
  // lib/sprout-state.test.ts's rule, and for the same reason: the date editor
  // is inside a client island, and a value import that reaches node:fs four
  // hops down fails `npm run build` rather than any test here.
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("lib/sprout-date.ts", "utf8");
  assert.equal(/^import\s/m.test(source), false, "lib/sprout-date.ts must import nothing");
});
