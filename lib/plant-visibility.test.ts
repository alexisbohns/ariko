import { test } from "node:test";
import assert from "node:assert/strict";
import { isVisibility, visibilityOf, PLANT_VISIBILITIES } from "./plant-visibility";

test("an unmarked plant reads as public, the same rule filterPublic applies", () => {
  assert.equal(visibilityOf({}), "public");
  assert.equal(visibilityOf({ visibility: "public" }), "public");
  assert.equal(visibilityOf({ visibility: "private" }), "private");
});

test("a bean reads the same 'absent means public' rule a plant does", () => {
  // One rule, one file. A lib/bean-visibility.ts holding a second copy of
  // "absent means public" is a copy that drifts from filterPublic's !== private.
  type Beanish = { slug: string; visibility?: "public" | "private" };
  const unmarked: Beanish = { slug: "a-bean" };
  const hidden: Beanish = { slug: "a-bean", visibility: "private" };
  assert.equal(visibilityOf(unmarked), "public");
  assert.equal(visibilityOf(hidden), "private");
});

test("the vocabulary is exactly the two members, public first", () => {
  assert.deepEqual([...PLANT_VISIBILITIES], ["public", "private"]);
});

test("isVisibility guards the toggle's posted value", () => {
  assert.equal(isVisibility("public"), true);
  assert.equal(isVisibility("private"), true);
  assert.equal(isVisibility("unlisted"), false);
  assert.equal(isVisibility(""), false);
});
