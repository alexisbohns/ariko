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
  ],
  beans: [
    { slug: "direct", name: "Direct", parents: ["plant:ariko"] },
    { slug: "in-pod", name: "In pod", parents: ["pod:studio"] },
    // Parented to BOTH — the case that makes a naive concat count it twice.
    { slug: "both", name: "Both", parents: ["pod:atelier", "plant:ariko"] },
    { slug: "elsewhere", name: "Elsewhere", parents: ["plant:other"] },
  ],
};

test("a plant's beans are its own plus every pod's, deduped and sorted", () => {
  const beans = beansForPlantDeep(buildDataset(GARDEN), "ariko");
  assert.deepEqual(
    beans.map((b) => b.slug),
    ["both", "direct", "in-pod"],
  );
});

test("a plant with neither pods nor beans has none", () => {
  assert.deepEqual(beansForPlantDeep(buildDataset(GARDEN), "empty"), []);
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
