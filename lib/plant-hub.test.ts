import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDataset, type RawGarden } from "./data";
import { beansForPlantDeep, podsForPlantSorted } from "./plant-hub";

const GARDEN: RawGarden = {
  plants: [
    {
      slug: "ariko",
      name: "Ariko",
      natures: ["work"],
      description: "",
      role: { kind: "owner" },
    },
    {
      slug: "empty",
      name: "Empty",
      natures: ["work"],
      description: "",
      role: { kind: "owner" },
    },
  ],
  pods: [
    { slug: "studio", name: "Studio", description: "", parents: ["plant:ariko"] },
    { slug: "atelier", name: "Atelier", description: "", parents: ["plant:ariko"] },
    // Belongs to a DIFFERENT plant — what makes the other plant's rollup a
    // test of scoping rather than of "empty has nothing to traverse".
    { slug: "greenhouse", name: "Greenhouse", description: "", parents: ["plant:empty"] },
  ],
  beans: [
    { slug: "direct", name: "Direct", parents: ["plant:ariko"] },
    { slug: "in-pod", name: "In pod", parents: ["pod:studio"] },
    // Parented to BOTH — the case that makes a naive concat count it twice.
    { slug: "both", name: "Both", parents: ["pod:atelier", "plant:ariko"] },
    { slug: "elsewhere", name: "Elsewhere", parents: ["plant:other"] },
    // Reachable ONLY through empty's own pod — proves pod traversal actually
    // runs, rather than "empty has none" being true by having nothing at all.
    { slug: "isolated", name: "Isolated", parents: ["pod:greenhouse"] },
  ],
};

test("a plant's beans are its own plus every pod's, deduped and sorted", () => {
  const beans = beansForPlantDeep(buildDataset(GARDEN), "ariko");
  assert.deepEqual(
    beans.map((b) => b.slug),
    ["both", "direct", "in-pod"],
  );
});

test("a bean reachable only through another plant's pod does not leak in", () => {
  const dataset = buildDataset(GARDEN);
  assert.deepEqual(
    beansForPlantDeep(dataset, "empty").map((b) => b.slug),
    ["isolated"],
  );
  assert.equal(
    beansForPlantDeep(dataset, "ariko").some((b) => b.slug === "isolated"),
    false,
  );
});

test("an unknown plant has none rather than throwing", () => {
  assert.deepEqual(beansForPlantDeep(buildDataset(GARDEN), "nope"), []);
});

test("pods come back sorted by name", () => {
  assert.deepEqual(
    podsForPlantSorted(buildDataset(GARDEN), "ariko").map((p) => p.slug),
    ["atelier", "studio"],
  );
});

test("sorting the hub's copy leaves the dataset's own order alone", () => {
  // Dataset.podsForPlant hands back its OWN array by reference — a plain
  // `.sort()` (no defensive copy) would reorder it in place, and every other
  // reader would silently see name order instead of garden order from then
  // on. Garden order here is ["studio", "atelier"] (raw.pods order); sorted
  // order is the reverse, so a regression here is not a coincidence away
  // from being caught.
  const dataset = buildDataset(GARDEN);
  podsForPlantSorted(dataset, "ariko");
  assert.deepEqual(
    dataset.podsForPlant("ariko").map((p) => p.slug),
    ["studio", "atelier"],
  );
});
