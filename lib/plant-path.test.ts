import { test } from "node:test";
import assert from "node:assert/strict";
import { hubHref, normalizePath, plantSlugFromPath } from "./plant-path";

test("normalizePath strips a trailing slash, except the root's own", () => {
  assert.equal(normalizePath("/admin/plant/ariko/"), "/admin/plant/ariko");
  assert.equal(normalizePath("/admin/plant/ariko"), "/admin/plant/ariko");
  assert.equal(normalizePath("/"), "/");
});

test("hubHref encodes the slug", () => {
  assert.equal(hubHref("ariko"), "/admin/plant/ariko");
  assert.equal(hubHref("a b"), "/admin/plant/a%20b");
});

test("hubHref encodes a slash in the slug so it cannot be mistaken for a path separator", () => {
  assert.equal(hubHref("a b/c"), "/admin/plant/a%20b%2Fc");
});

test("plantSlugFromPath decodes the hub's own slug", () => {
  assert.equal(plantSlugFromPath("/admin/plant/ariko"), "ariko");
  assert.equal(plantSlugFromPath("/admin/plant/ariko/"), "ariko");
  assert.equal(plantSlugFromPath("/admin/plant/a%20b"), "a b");
});

test("a hub child route names the same plant as the hub itself", () => {
  assert.equal(plantSlugFromPath("/admin/plant/ariko/settings"), "ariko");
});

test("a slug's own encoded slash survives — split(\"/\") sees one segment, not two", () => {
  assert.equal(plantSlugFromPath("/admin/plant/a%20b%2Fc"), "a b/c");
});

test("a non-plant path names no plant", () => {
  assert.equal(plantSlugFromPath("/admin/pods"), null);
  assert.equal(plantSlugFromPath("/admin"), null);
});

test("an empty slug segment names no plant", () => {
  assert.equal(plantSlugFromPath("/admin/plant/"), null);
});

test("a malformed escape is not a slug", () => {
  assert.equal(plantSlugFromPath("/admin/plant/a%ZZ"), null);
});

test("round-trip: hubHref then plantSlugFromPath recovers the slug", () => {
  for (const slug of ["ariko", "a b", "a b/c", "50% off"]) {
    assert.equal(plantSlugFromPath(hubHref(slug)), slug);
  }
});
