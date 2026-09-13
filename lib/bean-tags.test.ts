import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBeanTags } from "./bean-tags";

test("splits on commas and trims every part", () => {
  assert.deepEqual(parseBeanTags("ariko, design ,  code"), ["ariko", "design", "code"]);
});

test("drops blanks, including from trailing and doubled commas", () => {
  assert.deepEqual(parseBeanTags("ariko,,design,"), ["ariko", "design"]);
  assert.deepEqual(parseBeanTags("   "), []);
  assert.deepEqual(parseBeanTags(""), []);
});

test("dedupes, preserving the order each tag was first seen in", () => {
  assert.deepEqual(parseBeanTags("b, a, b, c, a"), ["b", "a", "c"]);
});

test("dedupes CASE-SENSITIVELY, because nothing in the garden folds case on read", () => {
  // lib/sprouts.ts's tag filter compares with === and does not lowercase, so
  // Ariko and ariko are two distinct filter keys. Folding them here would
  // silently delete one of a pair the rest of the system still distinguishes.
  assert.deepEqual(parseBeanTags("Ariko, ariko"), ["Ariko", "ariko"]);
});

test("a parsed tag is always its own trimmed self, which is what the === comparisons need", () => {
  for (const tag of parseBeanTags(" a , b ")) assert.equal(tag.trim(), tag);
});
