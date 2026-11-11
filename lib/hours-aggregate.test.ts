import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, aggregateUnit, calendarWeeks, heatLevel, mondayOf, weekHours } from "./hours-aggregate";
import type { HoursSnapshot, HoursUnit } from "./hours";

const s = (start: string, end: string, hours: number, commits = 2) => ({ start, end, hours, commits });
const unit = (sessions: HoursUnit["sessions"]): HoursUnit => ({
  key: "global", name: "All", repos: [], commits: 0, sessions,
});

test("mondayOf and addDays handle year boundaries", () => {
  assert.equal(mondayOf("2026-11-11"), "2026-11-09");
  assert.equal(mondayOf("2026-11-09"), "2026-11-09");
  assert.equal(mondayOf("2026-11-15"), "2026-11-09"); // Sunday
  assert.equal(mondayOf("2027-01-01"), "2026-12-28");
  assert.equal(mondayOf("2027-01-03"), "2026-12-28"); // Sunday
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("heatLevel steps at 1, 3, 6, 9 hours", () => {
  assert.deepEqual([0, 0.5, 1, 2.9, 3, 6, 8.9, 9, 20].map(heatLevel), [0, 1, 2, 2, 3, 4, 4, 5, 5]);
});

test("aggregateUnit: days include everything, totals start at since", () => {
  const a = aggregateUnit(
    unit([
      s("2026-03-01T10:00:00", "2026-03-01T11:00:00", 1.5), // before since
      s("2026-03-16T09:00:00", "2026-03-16T10:00:00", 1.5),
      s("2026-03-16T20:00:00", "2026-03-16T21:00:00", 1.5),
      s("2026-03-25T23:00:00", "2026-03-26T01:00:00", 2.5), // crosses midnight → 25th
      s("2026-04-01T08:00:00", "2026-04-01T08:00:00", 0.5),
    ]),
    "2026-03-16",
    "2026-04-12", // 4 weeks since 2026-03-16 (28 days)
  );
  assert.deepEqual(a.days["2026-03-01"], { hours: 1.5, sessions: 1 });
  assert.deepEqual(a.days["2026-03-16"], { hours: 3, sessions: 2 });
  assert.deepEqual(a.days["2026-03-25"], { hours: 2.5, sessions: 1 });
  assert.equal(a.totalSince, 6);
  assert.equal(a.sessionsSince, 4);
  assert.deepEqual(a.weeks, { "2026-03-16": 3, "2026-03-23": 2.5, "2026-03-30": 0.5 });
  assert.deepEqual(a.months, { "2026-03": 5.5, "2026-04": 0.5 });
  assert.equal(a.activeWeeks, 3);
  assert.equal(a.avgWeek, 1.5); // 6 / 4 weeks
  assert.equal(a.avgActiveWeek, 2);
  assert.equal(a.peakWeek?.week, "2026-03-16");
  assert.equal(a.medianSession, 1.5);
  assert.equal(a.longestSession, 2.5);
  // Mon 03-16 (3h), Wed 03-25 (2.5h), Wed 04-01 (0.5h)
  assert.deepEqual(a.byWeekday, [3, 0, 3, 0, 0, 0, 0]);
  assert.equal(a.byHour[23], 2.5);
  assert.equal(a.longestStreak, 1);
});

test("aggregateUnit: streak counts consecutive active days", () => {
  const a = aggregateUnit(
    unit([
      s("2026-05-01T10:00:00", "2026-05-01T10:00:00", 0.5),
      s("2026-05-02T10:00:00", "2026-05-02T10:00:00", 0.5),
      s("2026-05-03T10:00:00", "2026-05-03T10:00:00", 0.5),
      s("2026-05-05T10:00:00", "2026-05-05T10:00:00", 0.5),
    ]),
    "2026-03-16",
    "2026-05-10",
  );
  assert.equal(a.longestStreak, 3);
});

test("aggregateUnit on an empty unit is all zeros, no NaN", () => {
  const a = aggregateUnit(unit([]), "2026-03-16", "2026-04-12");
  assert.equal(a.totalSince, 0);
  assert.equal(a.avgActiveWeek, 0);
  assert.equal(a.medianSession, 0);
  assert.equal(a.peakWeek, null);
});

test("calendarWeeks: 53 Monday-first columns ending on today's week, future days null", () => {
  const cols = calendarWeeks("2026-11-11");
  assert.equal(cols.length, 53);
  assert.equal(cols[52][0], "2026-11-09");
  assert.equal(cols[52][2], "2026-11-11");
  assert.equal(cols[52][3], null);
  assert.equal(cols[0][0], "2025-11-10");
});

test("weekHours tallies a week by plant and repo", () => {
  const snap = {
    v: 1, generatedAt: "2026-11-11T00:00:00Z",
    params: { since: "2026-03-16", gapMinutes: 120, leadMinutes: 30 },
    global: { ...unit([s("2026-11-03T10:00:00", "2026-11-03T12:00:00", 2.5), s("2026-11-12T10:00:00", "2026-11-12T10:00:00", 0.5)]) },
    plants: [{ key: "plant:pbbls", name: "pbbls", plant: "pbbls", repos: ["a/pbbls"], commits: 1, sessions: [s("2026-11-03T10:00:00", "2026-11-03T12:00:00", 2.5)] }],
    repos: [{ key: "repo:a/pbbls", name: "pbbls", plant: "pbbls", repos: ["a/pbbls"], commits: 1, sessions: [s("2026-11-03T10:00:00", "2026-11-03T12:00:00", 2.5)] }],
  } satisfies HoursSnapshot;
  assert.deepEqual(weekHours(snap, "2026-11-02", "2026-11-08"), {
    total: 2.5,
    sessions: 1,
    byPlant: [{ plant: "pbbls", hours: 2.5 }],
    byRepo: [{ repo: "pbbls", hours: 2.5 }],
  });
});

test("medianSession averages the two middle values of an even count", () => {
  const med = (hs: number[]) =>
    aggregateUnit(
      unit(hs.map((h, i) => s(`2026-04-${String(1 + i).padStart(2, "0")}T10:00:00`, `2026-04-${String(1 + i).padStart(2, "0")}T10:00:00`, h))),
      "2026-03-16",
      "2026-04-12",
    ).medianSession;
  assert.equal(med([0.5, 1.5, 1.5, 2.5]), 1.5);
  assert.equal(med([0.5, 1.5]), 1);
  assert.equal(med([2.5, 0.5, 1.5, 4.5]), 2); // order-independent
  assert.equal(med([0.5, 1.5, 9]), 1.5); // odd: the middle one
});

test("aggregateUnit: since on a Wednesday starts the first week on the Monday before it", () => {
  const a = aggregateUnit(
    unit([
      s("2026-03-16T10:00:00", "2026-03-16T10:00:00", 0.5), // Monday before since: excluded
      s("2026-03-17T10:00:00", "2026-03-17T10:00:00", 0.5), // Tuesday before since: excluded
      s("2026-03-18T10:00:00", "2026-03-18T10:00:00", 0.5), // since itself (Wednesday): counted
      s("2026-03-24T10:00:00", "2026-03-24T11:00:00", 1.5),
    ]),
    "2026-03-18",
    "2026-03-31", // 14 days inclusive = exactly 2 weeks
  );
  assert.equal(a.totalSince, 2);
  assert.equal(a.sessionsSince, 2);
  assert.deepEqual(a.weeks, { "2026-03-16": 0.5, "2026-03-23": 1.5 }); // first key = Monday before since
  assert.equal(Object.keys(a.weeks)[0], mondayOf("2026-03-18"));
  assert.equal(a.weeksElapsed, 2);
  assert.equal(a.avgWeek, 1);
  // the calendar still sees the excluded days
  assert.deepEqual(a.days["2026-03-16"], { hours: 0.5, sessions: 1 });
  assert.deepEqual(a.days["2026-03-17"], { hours: 0.5, sessions: 1 });
});

test("aggregateUnit: avgWeek uses fractional weeks, inclusive days / 7", () => {
  const a = aggregateUnit(
    unit([s("2026-03-18T10:00:00", "2026-03-18T10:00:00", 3.5)]),
    "2026-03-18",
    "2026-03-24", // 7 days inclusive = 1 week
  );
  assert.equal(a.weeksElapsed, 1);
  assert.equal(a.avgWeek, 3.5);
  const b = aggregateUnit(
    unit([s("2026-03-18T10:00:00", "2026-03-18T10:00:00", 3.5)]),
    "2026-03-18",
    "2026-03-21", // 4 days inclusive = 4/7 week
  );
  assert.equal(b.weeksElapsed, 0.57);
  assert.equal(b.avgWeek, 6.13); // 3.5 / (4/7)
});

test("aggregateUnit: weeks and months key across the 2026 to 2027 boundary", () => {
  const a = aggregateUnit(
    unit([
      s("2026-12-30T10:00:00", "2026-12-30T10:00:00", 0.5), // Wednesday
      s("2027-01-03T10:00:00", "2027-01-03T11:00:00", 1.5), // Sunday, same ISO week
      s("2027-01-04T10:00:00", "2027-01-04T10:00:00", 0.5), // Monday, next week
    ]),
    "2026-12-01",
    "2027-01-10",
  );
  assert.deepEqual(a.weeks, { "2026-12-28": 2, "2027-01-04": 0.5 });
  assert.deepEqual(a.months, { "2026-12": 0.5, "2027-01": 2 });
  assert.equal(a.activeWeeks, 2);
  assert.deepEqual(a.byWeekday, [0.5, 0, 0.5, 0, 0, 0, 1.5]);
});
