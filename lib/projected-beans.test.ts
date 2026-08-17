import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveProjectedBeans } from "./projected-beans";
import type { Pollen } from "./pollen";

function pollen(over: Partial<Pollen>): Pollen {
  return {
    v: 1,
    id: "melogram:e1",
    at: "2026-06-01T10:00:00Z",
    source: "melogram",
    kind: "published",
    title: "Celesta is out",
    anchors: { plant: "plant:bohns-music" },
    ...over,
  };
}

test("bean anchor on an unknown slug materializes a projected bean", () => {
  const beans = deriveProjectedBeans(
    [pollen({ anchors: { plant: "plant:bohns-music", pod: "pod:celesta", bean: "bean:damned-thoughts" } })],
    new Set(),
    new Set(["plant:bohns-music"]),
    "melogram-feed", // differs from source on purpose: pins which field is which
  );
  assert.equal(beans.length, 1);
  assert.deepEqual(beans[0], {
    slug: "damned-thoughts",
    name: "damned-thoughts",
    parents: ["plant:bohns-music", "pod:celesta"],
    visibility: "public",
    projected: { source: "melogram", feedId: "melogram-feed", firstPollenId: "melogram:e1" },
  });
});

test("non-exhibited plant projects a PRIVATE bean", () => {
  const beans = deriveProjectedBeans(
    [pollen({ anchors: { plant: "plant:bohns-music", bean: "bean:x" } })],
    new Set(),
    new Set(),
    "melogram",
  );
  assert.equal(beans[0].visibility, "private");
});

test("existing bean (authored or prior projection) is never touched", () => {
  const beans = deriveProjectedBeans(
    [pollen({ anchors: { plant: "plant:bohns-music", bean: "bean:existing" } })],
    new Set(["existing"]),
    new Set(["plant:bohns-music"]),
    "melogram",
  );
  assert.deepEqual(beans, []);
});

test("first envelope wins within a batch", () => {
  const beans = deriveProjectedBeans(
    [
      pollen({ id: "melogram:e1", anchors: { plant: "plant:bohns-music", bean: "bean:x" } }),
      pollen({ id: "melogram:e2", anchors: { plant: "plant:bohns-music", bean: "bean:x" } }),
    ],
    new Set(),
    new Set(),
    "melogram",
  );
  assert.equal(beans.length, 1);
  assert.equal(beans[0].projected?.firstPollenId, "melogram:e1");
});

test("plant-only envelopes project nothing", () => {
  assert.deepEqual(deriveProjectedBeans([pollen({})], new Set(), new Set(), "f"), []);
});
