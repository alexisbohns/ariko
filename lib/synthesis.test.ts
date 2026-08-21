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

test("week 53 only exists in 53-week years", () => {
  assert.ok(isValidWeekId("2026-W53")); // 2026 has 53 ISO weeks
  assert.ok(!isValidWeekId("2027-W53")); // 2027 has 52
  assert.throws(() => weekBounds("2027-W53"), /invalid week/);
});

test("digest slugs are lowercase and deterministic", () => {
  assert.equal(digestSlug("pbbls", "2026-W34"), "digest-pbbls-2026-w34");
  assert.equal(wrapSlug("2026-W34"), "weekly-wrap-2026-w34");
});

import { bucketWeek, DIGEST_TYPE, type WindowSprout } from "./synthesis";
import type { PollenDoc } from "./pollen-sync";

function env(id: string, at: string, plant: string): PollenDoc {
  return {
    v: 1,
    id,
    at,
    source: "arkaik",
    anchors: { plant: `plant:${plant}` },
    kind: "deliverable.shipped",
    title: `t-${id}`,
  } as PollenDoc;
}
function ws(slug: string, date: string, plant: string | null, type = "note"): WindowSprout {
  return { slug, type, date, plantSlug: plant, name: slug, description: "" };
}

test("bucketWeek: window-filters, groups per plant, derives quiet", () => {
  const bounds = { start: "2026-08-17", end: "2026-08-23" };
  const out = bucketWeek(
    [
      env("p1", "2026-08-18T10:00:00Z", "pbbls"),
      env("p2", "2026-08-16T10:00:00Z", "pbbls"), // before window
      env("p3", "2026-08-23T23:59:00Z", "arkaik"), // Sunday counts
    ],
    [
      ws("s1", "2026-08-19", "ariko"),
      ws("s2", "2026-08-25", "ariko"), // after window
      ws("s3", "2026-08-19", null), // unresolvable plant → dropped
    ],
    ["pbbls", "arkaik", "ariko", "femfolk"],
    bounds,
  );
  assert.deepEqual(Object.keys(out.plants).sort(), ["ariko", "arkaik", "pbbls"].sort());
  assert.equal(out.plants["pbbls"].envelopes.length, 1);
  assert.equal(out.plants["arkaik"].envelopes.length, 1);
  assert.equal(out.plants["ariko"].sprouts.length, 1);
  assert.deepEqual(out.quiet, ["femfolk"]);
});

test("bucketWeek: digest sprouts never narrate themselves", () => {
  const bounds = { start: "2026-08-17", end: "2026-08-23" };
  const out = bucketWeek(
    [],
    [ws("digest-pbbls-2026-w33", "2026-08-17", "pbbls", DIGEST_TYPE)],
    ["pbbls"],
    bounds,
  );
  assert.deepEqual(out.plants, {});
  assert.deepEqual(out.quiet, ["pbbls"]);
});

import { validateDigestBatch, type DraftSprout } from "./synthesis";

const BEANS = new Set(["digest-pbbls", "digest-ariko", "weekly-wrap"]);
function draft(over: Partial<DraftSprout> = {}): DraftSprout {
  return {
    slug: "digest-pbbls-2026-w34",
    name: "Week 34",
    date: "2026-08-23",
    parents: ["bean:digest-pbbls"],
    content: "The week in pbbls…",
    ...over,
  };
}

test("validateDigestBatch: accepts a well-formed batch", () => {
  const r = validateDigestBatch("2026-W34", [
    draft(),
    draft({ slug: "weekly-wrap-2026-w34", parents: ["bean:weekly-wrap"] }),
  ], BEANS);
  assert.deepEqual(r, { ok: true });
});

test("validateDigestBatch: rejections name the offending sprout", () => {
  const bad = (sprouts: DraftSprout[], week = "2026-W34") => {
    const r = validateDigestBatch(week, sprouts, BEANS);
    assert.equal(r.ok, false);
    return r.ok === false ? r.error : "";
  };
  assert.match(bad([draft()], "garbage"), /invalid week/);
  assert.match(bad([draft({ slug: "digest-pbbls-2026-w33" })]), /2026-w33/); // week mismatch
  assert.match(bad([draft({ slug: "renamed-thing" })]), /renamed-thing/); // grammar
  assert.match(bad([draft({ parents: ["bean:nope"] })]), /nope/); // unknown bean
  assert.match(bad([draft({ parents: ["bean:digest-ariko"] })]), /digest-pbbls-2026-w34/); // slug/parent mismatch
  assert.match(
    bad([draft({ state: "published" } as unknown as DraftSprout)]),
    /state/,
  ); // the door cannot publish
  assert.match(bad([draft({ content: "x".repeat(32769) })]), /32KiB/);
  assert.match(bad([draft({ name: " " })]), /name/);
  assert.match(bad([draft(), draft()]), /duplicate/);
});
