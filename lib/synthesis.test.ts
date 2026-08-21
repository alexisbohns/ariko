import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isoWeekId,
  weekBounds,
  digestSlug,
  wrapSlug,
  isValidWeekId,
} from "./synthesis";

test("isoWeekId: maps dates to ISO weeks incl. year boundaries", () => {
  assert.equal(isoWeekId("2026-08-17"), "2026-W34"); // a Monday
  assert.equal(isoWeekId("2026-08-23"), "2026-W34"); // its Sunday
  assert.equal(isoWeekId("2026-01-01"), "2026-W01"); // Thu → week 1 of 2026
  assert.equal(isoWeekId("2027-01-01"), "2026-W53"); // Fri → belongs to 2026
});

test("weekBounds: Monday through Sunday, date-only strings", () => {
  assert.deepEqual(weekBounds("2026-W34"), {
    start: "2026-08-17",
    end: "2026-08-23",
  });
  assert.deepEqual(weekBounds("2026-W01"), {
    start: "2025-12-29",
    end: "2026-01-04",
  });
});

test("weekBounds and isoWeekId round-trip", () => {
  const { start, end } = weekBounds("2026-W34");
  assert.equal(isoWeekId(start), "2026-W34");
  assert.equal(isoWeekId(end), "2026-W34");
});

test("week id grammar", () => {
  assert.ok(isValidWeekId("2026-W34"));
  assert.ok(!isValidWeekId("2026-w34")); // ids are uppercase; slugs are lowercase
  assert.ok(!isValidWeekId("2026-W60"));
  assert.ok(!isValidWeekId("garbage"));
});

test("digest slugs are lowercase and deterministic", () => {
  assert.equal(digestSlug("pbbls", "2026-W34"), "digest-pbbls-2026-w34");
  assert.equal(wrapSlug("2026-W34"), "weekly-wrap-2026-w34");
});
