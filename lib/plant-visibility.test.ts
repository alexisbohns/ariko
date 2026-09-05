import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isVisibility,
  nextVisibility,
  visibilityOf,
  PLANT_VISIBILITIES,
} from "./plant-visibility";
import { nextStatus } from "./plant-status";

test("an unmarked plant reads as public, the same rule filterPublic applies", () => {
  assert.equal(visibilityOf({}), "public");
  assert.equal(visibilityOf({ visibility: "public" }), "public");
  assert.equal(visibilityOf({ visibility: "private" }), "private");
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

test("each flip is its own inverse — a toggle pressed twice is a no-op", () => {
  assert.equal(nextVisibility("public"), "private");
  assert.equal(nextVisibility(nextVisibility("public")), "public");
  assert.equal(nextStatus("active"), "inactive");
  assert.equal(nextStatus(nextStatus("active")), "active");
});
