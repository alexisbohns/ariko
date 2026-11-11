import { test, after } from "node:test";
import assert from "node:assert/strict";
import { closeDb, getDb } from "./db";
import { loadHoursSnapshot, saveHoursSnapshot } from "./hours-store";
import { buildSnapshot } from "./hours";
import { POST } from "../app/api/hours/route";
import { GET as weekGET } from "../app/api/synthesis/week/route";

const cfg = { since: "2026-03-16", gapMinutes: 120, leadMinutes: 30, repos: [{ repo: "a/one", name: "one" }] };
const full = buildSnapshot(cfg, { "a/one": ["2026-08-07T08:00:00"] }, "2026-11-11T00:00:00.000Z");
const empty = buildSnapshot(cfg, {}, "2026-11-11T01:00:00.000Z");

const hasDb = Boolean(process.env.MONGODB_URI);

after(async () => {
  if (!hasDb) return;
  await (await getDb()).collection("hours").deleteMany({});
  await closeDb();
});

test("save then load round-trips the snapshot, replacing the previous one", { skip: !hasDb }, async () => {
  await saveHoursSnapshot(empty);
  await saveHoursSnapshot(full);
  const got = await loadHoursSnapshot();
  assert.deepEqual(got, full);
  assert.equal(await (await getDb()).collection("hours").countDocuments(), 1);
});

test("door refuses a snapshot that would wipe stored sessions, unless forced", { skip: !hasDb }, async () => {
  process.env.HOURS_TOKEN = "tok_hours_test";
  try {
    await saveHoursSnapshot(full);
    const post = (q = "") =>
      POST(new Request(`http://localhost/api/hours${q}`, {
        method: "POST",
        headers: { authorization: "Bearer tok_hours_test", "content-type": "application/json" },
        body: JSON.stringify(empty),
      }));
    assert.equal((await post()).status, 409);
    assert.deepEqual(await loadHoursSnapshot(), full);
    assert.equal((await post("?force=1")).status, 200);
    assert.equal((await loadHoursSnapshot())?.global.sessions.length, 0);
  } finally {
    delete process.env.HOURS_TOKEN;
  }
});

test("synthesis week door carries the hours tally (null without a snapshot)", { skip: !hasDb }, async () => {
  process.env.SYNTHESIS_TOKEN = "tok_synth_test";
  try {
    const get = async (week: string) =>
      (await weekGET(
        new Request(`http://localhost/api/synthesis/week?week=${week}`, {
          headers: { authorization: "Bearer tok_synth_test" },
        }),
      )).json();
    await (await getDb()).collection("hours").deleteMany({});
    assert.equal((await get("2026-W32")).hours, null);
    await saveHoursSnapshot(full); // one 08:00 commit on 2026-08-07, 30 min lead
    const inWeek = (await get("2026-W32")).hours;
    assert.equal(inWeek.total, 0.5);
    assert.equal(inWeek.sessions, 1);
    assert.deepEqual(inWeek.byRepo, [{ repo: "one", hours: 0.5 }]);
    const other = (await get("2026-W33")).hours;
    assert.equal(other.total, 0);
    assert.equal(other.sessions, 0);
  } finally {
    delete process.env.SYNTHESIS_TOKEN;
  }
});
