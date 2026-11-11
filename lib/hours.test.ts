import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSnapshot,
  localStamp,
  MAX_SNAPSHOT_BYTES,
  realDay,
  realLocal,
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
    "2026-08-07T08:41:00+02:00\tClaude\thello@bohns.design", // ^claude < exclude, identity matches
    "2026-08-07T08:42:00+02:00\t Claude\thello@bohns.design", // leading whitespace must not dodge it
    "2026-08-07T08:43:00+02:00\tClaude \t hello@bohns.design ",
    "2026-08-07T08:50:00+02:00\tLara\tlara@example.com",
    "",
    "not a log line",
  ];
  assert.deepEqual(selectTimestamps(lines, rules), ["2026-08-07T08:00:00", "2026-08-07T09:00:00"]);
});

test("selectTimestamps drops commits GitHub itself committed (squash/rebase merges, web edits)", () => {
  const lines = [
    "2026-09-20T14:42:44+02:00\tBohns\thello@bohns.design\tnoreply@github.com", // squash merge click
    "2026-09-20T10:00:00+02:00\tAlexis\thello@bohns.design\thello@bohns.design", // the real PR commit
    "2026-09-20T11:00:00+02:00\tAlexis\thello@bohns.design\t NoReply@GitHub.com ", // case and spaces don't dodge it
    "2026-09-20T12:00:00+02:00\tAlexis\thello@bohns.design", // no committer field: kept (older log format)
  ];
  assert.deepEqual(selectTimestamps(lines, rules), ["2026-09-20T10:00:00", "2026-09-20T12:00:00"]);
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

test("realLocal and realDay refuse dates that do not exist", () => {
  assert.equal(realLocal("2026-08-07T08:00:00"), true);
  assert.equal(realLocal("2028-02-29T23:59:59"), true);
  assert.equal(realLocal("2026-13-45T99:00:00"), false);
  assert.equal(realLocal("2026-02-31T10:00:00"), false);
  assert.equal(realLocal("2026-02-28T25:00:00"), false);
  assert.equal(realLocal("2026-08-07"), false);
  assert.equal(realDay("2026-03-16"), true);
  assert.equal(realDay("2026-02-31"), false);
  assert.equal(realDay("2026-99-99"), false);
  assert.equal(realDay("2027-02-29"), false);
  assert.equal(realDay("nope"), false);
});

const fresh = () =>
  JSON.parse(
    JSON.stringify(buildSnapshot(config, { "a/one": ["2026-08-07T08:00:00"] }, "2026-11-11T00:00:00.000Z")),
  );
const bad = (mut: (s: any) => void) => {
  const s = fresh();
  mut(s);
  return validateSnapshot(s);
};
const refused = (r: ReturnType<typeof validateSnapshot>, msg: RegExp) => {
  assert.equal(r.ok, false);
  assert.match((r as { ok: false; error: string }).error, msg);
};

test("validateSnapshot refuses bad shapes, and says why", () => {
  refused(bad((s) => (s.v = 2)), /v must be 1/);
  refused(bad((s) => (s.global.sessions[0].hours = 0)), /hours/);
  refused(bad((s) => (s.global.sessions[0].end = "2026-08-07T07:00:00")), /ends before it starts/);
  refused(bad((s) => (s.global.sessions[0].start = "yesterday")), /start must be a local timestamp/);
  refused(bad((s) => (s.params.since = "nope")), /params\.since/);
  refused(bad((s) => delete s.repos), /repos must be a list/);
  refused(validateSnapshot(null), /snapshot must be an object/);
  assert.equal(MAX_SNAPSHOT_BYTES, 512 * 1024);
});

test("validateSnapshot refuses dates that do not exist", () => {
  refused(bad((s) => (s.global.sessions[0].start = "2026-13-45T99:00:00")), /start must be a local timestamp/);
  refused(bad((s) => (s.global.sessions[0].end = "2026-02-31T25:00:00")), /end must be a local timestamp/);
  refused(bad((s) => (s.params.since = "2026-99-99")), /params\.since/);
  refused(bad((s) => (s.params.since = "2026-02-31")), /params\.since/);
});

test("validateSnapshot checks hours against the method's invariant, not a fixed cap", () => {
  // 40 h on a zero-length span: 0 + 0.5 h lead is the only legitimate value.
  refused(bad((s) => (s.global.sessions[0].hours = 40)), /hours/);
  refused(bad((s) => (s.global.sessions[0].hours = Number.NaN)), /hours/);
  refused(bad((s) => (s.global.sessions[0].hours = null)), /hours/);
  refused(bad((s) => (s.global.sessions[0].hours = 0.503)), /hours/);
  // within rounding slack
  assert.equal(bad((s) => (s.global.sessions[0].hours = 0.5009)).ok, true);
});

test("validateSnapshot accepts a legitimate 19 h session and built snapshots", () => {
  // a stamp every 2 h from 08:00 to 02:00 next day, then 02:30: one 18.5 h span + 0.5 h lead = 19 h
  const stamps = Array.from({ length: 10 }, (_, i) => `2026-08-${i < 8 ? "07" : "08"}T${String((8 + 2 * i) % 24).padStart(2, "0")}:00:00`);
  stamps.push("2026-08-08T02:30:00");
  const snap = buildSnapshot(config, { "a/one": stamps }, "2026-11-11T00:00:00.000Z");
  assert.equal(snap.global.sessions[0].hours, 19);
  assert.equal(snap.global.sessions.length, 1);
  assert.equal(validateSnapshot(JSON.parse(JSON.stringify(snap))).ok, true);
});

test("validateSnapshot refuses an absurd session even when internally consistent", () => {
  refused(
    bad((s) => {
      s.global.sessions[0].end = "2026-08-20T08:00:00"; // 13 days
      s.global.sessions[0].hours = 13 * 24 + 0.5;
    }),
    /hours/,
  );
});

test("validateSnapshot refuses bad params", () => {
  refused(bad((s) => (s.params.gapMinutes = 0)), /gapMinutes/);
  refused(bad((s) => (s.params.gapMinutes = -5)), /gapMinutes/);
  refused(bad((s) => (s.params.gapMinutes = 1.5)), /gapMinutes/);
  refused(bad((s) => (s.params.gapMinutes = "120")), /gapMinutes/);
  refused(bad((s) => (s.params.leadMinutes = 0)), /leadMinutes/);
  refused(bad((s) => (s.params.leadMinutes = 0.5)), /leadMinutes/);
  refused(bad((s) => (s.params.leadMinutes = Number.NaN)), /leadMinutes/);
  refused(bad((s) => (s.generatedAt = "yesterday")), /generatedAt/);
  refused(bad((s) => (s.generatedAt = "2026-11-11")), /generatedAt/);
  refused(bad((s) => (s.generatedAt = "2026-11-11T00:00:00+02:00")), /generatedAt/);
  refused(bad((s) => (s.generatedAt = "2026-13-11T00:00:00Z")), /generatedAt/);
  assert.equal(bad((s) => (s.generatedAt = "2026-11-11T00:00:00Z")).ok, true);
});

test("validateSnapshot returns a fresh object holding only the known fields", () => {
  const s = fresh();
  s._id = "current";
  s.foo = "bar";
  s.params.extra = 1;
  s.global.secret = "x";
  s.global.sessions[0].email = "a@b.c";
  s.repos[0].sessions[0].email = "a@b.c";
  if (s.plants[0]) s.plants[0].junk = true;
  const r = validateSnapshot(s);
  assert.equal(r.ok, true);
  const out = (r as { ok: true; snapshot: any }).snapshot;
  assert.notEqual(out, s);
  assert.deepEqual(Object.keys(out).sort(), ["generatedAt", "global", "params", "plants", "repos", "v"]);
  assert.deepEqual(Object.keys(out.params).sort(), ["gapMinutes", "leadMinutes", "since"]);
  assert.equal("secret" in out.global, false);
  assert.deepEqual(Object.keys(out.global.sessions[0]).sort(), ["commits", "end", "hours", "start"]);
  assert.deepEqual(Object.keys(out.repos[0].sessions[0]).sort(), ["commits", "end", "hours", "start"]);
  assert.deepEqual(out, fresh());
});

test("validateSnapshot keeps unit.plant only when present", () => {
  const out = (validateSnapshot(fresh()) as { ok: true; snapshot: any }).snapshot;
  assert.equal("plant" in out.global, false);
  assert.equal(out.repos[0].plant, "p");
});
