import { test } from "node:test";
import assert from "node:assert/strict";
import { greeting } from "./greeting";

// A fixed Paris OFFSET (+02:00, CEST — in effect in September) rather than
// local Date components. The earlier fixture built a Date from local
// wall-clock parts and read it back through the same zone, so the round trip
// cancelled and the test stayed green under any `TZ` the suite happened to
// run with — it could not fail for the only reason the function can be
// wrong. An explicit offset pins the instant regardless of the machine
// running the suite.
const parisAt = (hour: number) => new Date(`2026-09-12T${String(hour).padStart(2, "0")}:00:00+02:00`);

test("the day has three parts", () => {
  assert.equal(greeting(parisAt(0)), "Good morning"); // midnight, explicitly
  assert.equal(greeting(parisAt(11)), "Good morning");
  assert.equal(greeting(parisAt(12)), "Good afternoon");
  assert.equal(greeting(parisAt(17)), "Good afternoon");
  assert.equal(greeting(parisAt(18)), "Good evening");
  assert.equal(greeting(parisAt(23)), "Good evening");
});

test("the word is Paris's, not the runtime's", () => {
  // 23:00 UTC on the 12th is 01:00 CEST on the 13th: late night by a
  // UTC-reading clock, the small hours of the morning in Paris. Reading
  // `now.getHours()` on a UTC runtime (Vercel) would see 23 and answer "Good
  // evening"; the correct, Paris-framed answer for this instant is "Good
  // morning". No DST test needed — this reads the wall clock, which already
  // carries the season's offset.
  assert.equal(greeting(new Date("2026-09-12T23:00:00Z")), "Good morning");
});
