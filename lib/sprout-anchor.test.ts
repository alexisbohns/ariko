import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAnchor } from "./sprout-anchor";
import type { SproutGarden } from "./data";

const garden: SproutGarden = {
  plants: [
    { slug: "p1", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" },
    { slug: "p2", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" },
  ],
  pods: [{ slug: "pod1", name: "Pod", description: "", parents: ["plant:p1"] }],
  beans: [
    { slug: "b1", name: "B", parents: ["pod:pod1"] },
    { slug: "b2", name: "B", parents: ["plant:p2"] },
  ],
};

test("about refs under one plant resolve to an about anchor and that plant", () => {
  assert.deepEqual(resolveAnchor(["bean:b1", "pod:pod1"], null, garden), {
    ok: true, anchor: { about: ["bean:b1", "pod:pod1"] }, plantSlug: "p1",
  });
});

test("refs are trimmed and deduped, in first-seen order", () => {
  const r = resolveAnchor([" bean:b1", "bean:b1", "pod:pod1 "], null, garden);
  assert.ok(r.ok);
  assert.deepEqual(r.anchor, { about: ["bean:b1", "pod:pod1"] });
});

test("an unknown ref, a wrong prefix and a blank are each refused by name", () => {
  assert.deepEqual(resolveAnchor(["bean:nope"], null, garden), { ok: false, error: "unknown ref bean:nope" });
  assert.deepEqual(resolveAnchor(["plant:p1"], null, garden), { ok: false, error: "an about ref names a pod or a bean, not plant:p1" });
  assert.deepEqual(resolveAnchor(["sprout:x"], null, garden), { ok: false, error: "an about ref names a pod or a bean, not sprout:x" });
  assert.deepEqual(resolveAnchor([""], null, garden), { ok: false, error: "an about ref names a pod or a bean, not (blank)" });
});

test("refs that roll up to two plants are refused, naming both", () => {
  assert.deepEqual(resolveAnchor(["bean:b1", "bean:b2"], null, garden), {
    ok: false, error: "about refs roll up to two plants (p1, p2) — a sprout belongs to one",
  });
});

test("a ref that rolls up to no plant is refused", () => {
  const unrooted: SproutGarden = { ...garden, pods: [{ slug: "pod1", name: "Pod", description: "", parents: [] }] };
  assert.deepEqual(resolveAnchor(["bean:b1"], null, unrooted), {
    ok: false, error: "about refs roll up to no plant — root the pod or bean under a plant first",
  });
});

test("a stated plant must agree with the derived one", () => {
  assert.equal(resolveAnchor(["bean:b1"], "p1", garden).ok, true);
  assert.deepEqual(resolveAnchor(["bean:b1"], "p2", garden), {
    ok: false, error: "about refs roll up to p1, not the chosen plant p2",
  });
});

test("with no refs, the plant is the anchor; it must exist", () => {
  assert.deepEqual(resolveAnchor([], "p1", garden), { ok: true, anchor: { plant: "p1" }, plantSlug: "p1" });
  assert.deepEqual(resolveAnchor([], "nope", garden), { ok: false, error: "unknown plant nope" });
  assert.deepEqual(resolveAnchor([], null, garden), { ok: false, error: "a sprout needs a plant, a pod or a bean" });
  assert.deepEqual(resolveAnchor([], "", garden), { ok: false, error: "a sprout needs a plant, a pod or a bean" });
});
