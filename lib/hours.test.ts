import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSnapshot,
  localStamp,
  MAX_SNAPSHOT_BYTES,
  selectTimestamps,
  sessionize,
  validateSnapshot,
} from "./hours";

const rules = { identities: ["hello@bohns.design"], exclude: [/\[bot\]/i, /^claude </i] };

test("localStamp keeps the author's wall clock and drops the offset", () => {
  assert.equal(localStamp("2026-08-07T07:53:16+02:00"), "2026-08-07T07:53:16");
  assert.equal(localStamp("2026-11-11T02:41:00-05:30"), "2026-11-11T02:41:00");
  assert.equal(localStamp("2026-01-02T03:04:05Z"), "2026-01-02T03:04:05");
  assert.equal(localStamp("garbage"), null);
});

test("selectTimestamps filters identity and excludes, dedups, sorts", () => {
  const lines = [
    "2026-08-07T09:00:00+02:00\tBohns\tHello@Bohns.design",
    "2026-08-07T08:00:00+02:00\tAlexis\thello@bohns.design",
    "2026-08-07T08:00:00+02:00\tAlexis\thello@bohns.design", // rebase copy
    "2026-08-07T08:30:00+02:00\tdependabot[bot]\thello@bohns.design",
    "2026-08-07T08:40:00+02:00\tClaude\tnoreply@anthropic.com",
    "2026-08-07T08:50:00+02:00\tLara\tlara@example.com",
    "",
    "not a log line",
  ];
  assert.deepEqual(selectTimestamps(lines, rules), ["2026-08-07T08:00:00", "2026-08-07T09:00:00"]);
});

test("sessionize: a single commit is one lead-length session", () => {
  assert.deepEqual(sessionize(["2026-08-07T08:00:00"], 120, 30), [
    { start: "2026-08-07T08:00:00", end: "2026-08-07T08:00:00", commits: 1, hours: 0.5 },
  ]);
});

test("sessionize: a gap of exactly gapMinutes stays in the session, one second more splits", () => {
  const same = sessionize(["2026-08-07T08:00:00", "2026-08-07T10:00:00"], 120, 30);
  assert.equal(same.length, 1);
  assert.equal(same[0].hours, 2.5);
  const split = sessionize(["2026-08-07T08:00:00", "2026-08-07T10:00:01"], 120, 30);
  assert.equal(split.length, 2);
});

test("sessionize sorts its input", () => {
  const s = sessionize(["2026-08-07T09:00:00", "2026-08-07T08:00:00"], 120, 30);
  assert.equal(s[0].start, "2026-08-07T08:00:00");
  assert.equal(s[0].commits, 2);
});

const config = {
  since: "2026-03-16",
  gapMinutes: 120,
  leadMinutes: 30,
  repos: [
    { repo: "a/one", name: "one", plant: "p" },
    { repo: "a/two", name: "two", plant: "p" },
    { repo: "a/three", name: "three" },
  ],
};

test("buildSnapshot: parallel work in two repos counts once globally and per plant", () => {
  const snap = buildSnapshot(
    config,
    {
      "a/one": ["2026-08-07T08:00:00", "2026-08-07T09:00:00"],
      "a/two": ["2026-08-07T08:30:00"],
      "a/three": ["2026-08-09T20:00:00"],
    },
    "2026-11-11T00:00:00.000Z",
  );
  assert.equal(snap.v, 1);
  assert.equal(snap.global.key, "global");
  assert.equal(snap.global.sessions.length, 2);
  assert.equal(snap.global.sessions[0].hours, 1.5); // 08:00→09:00 + lead, not 1.5 + 0.5
  assert.deepEqual(snap.plants.map((p) => [p.key, p.repos]), [["plant:p", ["a/one", "a/two"]]]);
  assert.equal(snap.plants[0].sessions.length, 1);
  assert.deepEqual(snap.repos.map((r) => r.key), ["repo:a/one", "repo:a/two", "repo:a/three"]);
  assert.equal(snap.repos[2].plant, undefined);
  assert.equal(snap.global.commits, 4);
});

test("validateSnapshot accepts what buildSnapshot makes", () => {
  const snap = buildSnapshot(config, { "a/one": ["2026-08-07T08:00:00"] }, "2026-11-11T00:00:00.000Z");
  const r = validateSnapshot(JSON.parse(JSON.stringify(snap)));
  assert.equal(r.ok, true);
});

test("validateSnapshot refuses bad shapes", () => {
  const snap = buildSnapshot(config, { "a/one": ["2026-08-07T08:00:00"] }, "2026-11-11T00:00:00.000Z");
  const bad = (mut: (s: any) => void) => {
    const s = JSON.parse(JSON.stringify(snap));
    mut(s);
    return validateSnapshot(s);
  };
  assert.equal(bad((s) => (s.v = 2)).ok, false);
  assert.equal(bad((s) => (s.global.sessions[0].hours = 0)).ok, false);
  assert.equal(bad((s) => (s.global.sessions[0].end = "2026-08-07T07:00:00")).ok, false);
  assert.equal(bad((s) => (s.global.sessions[0].start = "yesterday")).ok, false);
  assert.equal(bad((s) => (s.params.since = "nope")).ok, false);
  assert.equal(bad((s) => delete s.repos).ok, false);
  assert.equal(validateSnapshot(null).ok, false);
  assert.ok(MAX_SNAPSHOT_BYTES >= 512 * 1024);
});
