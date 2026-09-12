import { test } from "node:test";
import assert from "node:assert/strict";
import { isSproutType } from "./sprout-type";
import { DIGEST_TYPE } from "./synthesis";

test("isSproutType accepts an ordinary type", () => {
  assert.equal(isSproutType("note"), true);
  assert.equal(isSproutType("weekly-wrap"), true);
  assert.equal(isSproutType(DIGEST_TYPE), true);
  // Two words is a type, not a mistake: the space that matters is at the ends.
  assert.equal(isSproutType("live set"), true);
});

test("isSproutType rejects a type with nothing in it", () => {
  // A blank type renders as an empty <Badge> on the public beanstalk, an empty
  // <span> on the admin one, and a typeless sprout node on /api/graph. Nothing
  // fails; the sprout just stops saying what it is.
  assert.equal(isSproutType(""), false);
  assert.equal(isSproutType(" "), false);
  assert.equal(isSproutType("   "), false);
  assert.equal(isSproutType("\t"), false);
  assert.equal(isSproutType("\n"), false);
});

test("isSproutType rejects surrounding whitespace, because three comparisons use ===", () => {
  // The sharp one. shouldCascadePublish (type !== DIGEST_TYPE), the digest skip
  // in lib/synthesis.ts and the milestone match in lib/pbbls-legacy.ts all
  // compare a stored type to a literal and none of them trims. A padded digest
  // draws identically in every badge and is exempt from none of the three, so
  // publishing it flips its curated private bean and plant public.
  assert.equal(isSproutType(`${DIGEST_TYPE} `), false);
  assert.equal(isSproutType(` ${DIGEST_TYPE}`), false);
  assert.equal(isSproutType("note "), false);
  assert.equal(isSproutType(" note"), false);
  assert.equal(isSproutType("  note  "), false);
  assert.equal(isSproutType("note\n"), false);
});

test("isSproutType is what covers setSproutTypeAction's .trim()", () => {
  // Named rather than left implicit: no test can reach inside the action, so
  // the property that matters is that dropping its `.trim()` would turn a
  // padded paste into a LOUD rejection rather than a silently mismatched
  // literal. That is true only while the untrimmed form is rejected here.
  const padded = "  note  ";
  assert.equal(isSproutType(padded), false);
  assert.equal(isSproutType(padded.trim()), true);
});

test("isSproutType is shape, not vocabulary", () => {
  // Named so nobody later reads the guard as a membership check. There is no
  // list to be a member of — lib/sprouts.ts filters by state, plant and tag and
  // never by type — and inventing one at the one form with a text input would
  // make the UI the definition.
  assert.equal(isSproutType("banana"), true);
  assert.equal(isSproutType("!!!"), true);
});

test("lib/sprout-type.ts imports nothing at all", async () => {
  // lib/sprout-date.ts's rule, and for the same reason: the type editor is
  // inside a client island, and a value import that reaches node:fs four hops
  // down fails `npm run build` rather than any test here.
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("lib/sprout-type.ts", "utf8");
  assert.equal(/^import\s/m.test(source), false, "lib/sprout-type.ts must import nothing");
});
