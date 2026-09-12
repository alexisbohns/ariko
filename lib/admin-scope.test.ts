import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveScope, scopeHref, scopeKeys } from "./admin-scope";

test("the hub's own slug is the scope", () => {
  assert.equal(resolveScope("/admin/plant/ariko", {}), "ariko");
  assert.equal(resolveScope("/admin/plant/ariko/", {}), "ariko");
});

test("an encoded slug comes back decoded", () => {
  assert.equal(resolveScope("/admin/plant/a%20b", {}), "a b");
});

test("elsewhere the scope is the query", () => {
  assert.equal(resolveScope("/admin/sprouts", { plant: "pebbles" }), "pebbles");
  assert.equal(resolveScope("/admin/screens", { plant: "  " }), null);
  assert.equal(resolveScope("/admin/screens", {}), null);
});

test("the path wins over a contradicting query", () => {
  assert.equal(resolveScope("/admin/plant/ariko", { plant: "pebbles" }), "ariko");
});

test("a repeated query key cannot become a scope", () => {
  // ?plant=a&plant=b reaches a page as string[]. It must narrow to nothing
  // rather than stringify into "a,b".
  assert.equal(resolveScope("/admin/sprouts", { plant: ["a", "b"] as unknown as string }), null);
});

test("a filtering section keeps its other dimensions", () => {
  assert.equal(
    scopeHref("/admin/sprouts", { state: "draft", tag: "wip" }, "pebbles"),
    "/admin/sprouts?state=draft&plant=pebbles&tag=wip",
  );
});

test("All drops the key and keeps the section", () => {
  assert.equal(scopeHref("/admin/sprouts", { state: "draft", plant: "x" }, null), "/admin/sprouts?state=draft");
  assert.equal(scopeHref("/admin/screens", { plant: "x" }, null), "/admin/screens");
});

test("from the root, picking a plant opens its hub", () => {
  assert.equal(scopeHref("/admin", {}, "pebbles"), "/admin/plant/pebbles");
  assert.equal(scopeHref("/admin", {}, null), "/admin");
});

test("from a hub, switching goes to the other hub and All comes home", () => {
  assert.equal(scopeHref("/admin/plant/ariko", {}, "pebbles"), "/admin/plant/pebbles");
  assert.equal(scopeHref("/admin/plant/ariko", {}, null), "/admin");
});

test("an unrecognised route is treated as unfilterable, not as a section", () => {
  // A detail page has no filter dimensions to preserve, so switching from one
  // takes you to the plant rather than pinning a query onto a page that would
  // ignore it.
  assert.equal(scopeHref("/admin/bean/abc", {}, "pebbles"), "/admin/plant/pebbles");
  assert.equal(scopeHref("/admin/bean/abc", {}, null), "/admin");
});

test("a slug with URL syntax survives every href", () => {
  assert.equal(scopeHref("/admin", {}, "a b/c"), "/admin/plant/a%20b%2Fc");
  assert.equal(scopeHref("/admin/pods", {}, "a b"), "/admin/pods?plant=a+b");
});

test("every filtering section names its keys, and plant is one of them", () => {
  for (const [path, keys] of Object.entries(scopeKeys)) {
    assert.ok(keys.includes("plant"), path);
  }
});
