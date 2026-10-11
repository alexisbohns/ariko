import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDataset, type RawGarden } from "./data";

// The smallest garden with both anchor shapes: an entry ABOUT a bean under a
// pod under a plant, and a plant-level entry with no `about`.
const garden: RawGarden = {
  plants: [{ slug: "p", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" }],
  pods: [{ slug: "pod", name: "Pod", description: "", parents: ["plant:p"] }],
  beans: [{ slug: "b", name: "B", parents: ["pod:pod"] }],
  sprouts: [
    { slug: "s1", name: "S1", kind: "log", date: "2026-01-02", description: "", about: ["bean:b"] },
    { slug: "s2", name: "S2", kind: "release", date: "2026-01-01", description: "", parents: ["plant:p"] },
  ],
};

test("entryForSprout: the sprout, its first about-bean and its derived plant", () => {
  const e = buildDataset(garden).entryForSprout("s1");
  assert.equal(e?.sprout.slug, "s1");
  assert.equal(e?.bean?.slug, "b");
  assert.equal(e?.plant?.slug, "p");
});

test("entryForSprout: a plant-level entry has no bean and keeps its plant", () => {
  const e = buildDataset(garden).entryForSprout("s2");
  assert.equal(e?.bean, null);
  assert.equal(e?.plant?.slug, "p");
});

test("entryForSprout: an unknown slug is undefined, not a throw", () => {
  assert.equal(buildDataset(garden).entryForSprout("nope"), undefined);
});
