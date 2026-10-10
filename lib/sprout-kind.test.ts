import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_KIND, DIGEST_KIND, SPROUT_KINDS, isSproutKind, kindForSuggestion } from "./sprout-kind";
import { sproutKindLabel } from "./glyphs";

test("the vocabulary is the six kinds of the journal model, in display order", () => {
  assert.deepEqual([...SPROUT_KINDS], ["log", "milestone", "release", "essay", "decision", "digest"]);
  assert.equal(DEFAULT_KIND, "log");
  assert.equal(DIGEST_KIND, "digest");
});

test("isSproutKind admits members only — no free strings, no padding, no case", () => {
  for (const k of SPROUT_KINDS) assert.equal(isSproutKind(k), true);
  for (const bad of ["", "note", "song", "digest ", " log", "Log", "article", "bla"]) {
    assert.equal(isSproutKind(bad), false, bad);
  }
});

test("every kind has a label, and the label is the word capitalized", () => {
  assert.equal(sproutKindLabel("log"), "Log");
  assert.equal(sproutKindLabel("milestone"), "Milestone");
  assert.equal(sproutKindLabel("release"), "Release");
  assert.equal(sproutKindLabel("essay"), "Essay");
  assert.equal(sproutKindLabel("decision"), "Decision");
  assert.equal(sproutKindLabel("digest"), "Digest");
});

test("kindForSuggestion maps a lab note's type onto the vocabulary, defaulting to log", () => {
  assert.equal(kindForSuggestion("feature"), "milestone");
  assert.equal(kindForSuggestion("improvement"), "milestone");
  assert.equal(kindForSuggestion("announcement"), "release");
  assert.equal(kindForSuggestion("fix"), "log");
  assert.equal(kindForSuggestion("anything"), "log");
  assert.equal(kindForSuggestion(undefined), "log");
  assert.equal(kindForSuggestion("decision"), "decision");
});

test("lib/sprout-kind.ts imports nothing at all", async () => {
  // lib/sprout-state.ts's rule, and for the same reason: the kind popover is
  // inside a client island, and a value import that reaches node:fs four hops
  // down fails `npm run build` rather than any test here.
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("lib/sprout-kind.ts", "utf8");
  assert.equal(/^import\s/m.test(source), false, "lib/sprout-kind.ts must import nothing");
});
