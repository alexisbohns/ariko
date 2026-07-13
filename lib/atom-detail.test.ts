import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDataset, type RawSeed } from "./data";
import { atomDetail } from "./atom-detail";

const SEED: RawSeed = {
  molecules: [{ slug: "rom", name: "Republic", domain: "music", description: "" }],
  atoms: [
    { slug: "rom-win", name: "Win", parents: ["molecule:rom"] },
    { slug: "loner", name: "Loner", parents: [] },
    { slug: "dangler", name: "Dangler", parents: ["molecule:ghost"] },
  ],
  versions: [
    { slug: "win-v1", name: "Win v1", type: "t", date: "2025-01-01", description: "", parents: ["atom:rom-win"], state: "draft" },
    { slug: "win-v2", name: "Win v2", type: "t", date: "2025-03-01", description: "", parents: ["atom:rom-win"], state: "published" },
  ],
};
const DATASET = buildDataset(SEED);

test("unknown slug returns null", () => {
  assert.equal(atomDetail(DATASET, "nope"), null);
});

test("found atom returns the atom and its versions newest-first", () => {
  const view = atomDetail(DATASET, "rom-win");
  assert.ok(view);
  assert.equal(view!.atom.slug, "rom-win");
  assert.deepEqual(view!.versions.map((v) => v.slug), ["win-v2", "win-v1"]);
});

test("domain resolves via the molecule parent", () => {
  assert.equal(atomDetail(DATASET, "rom-win")!.domain, "music");
});

test("moleculeParents surfaces the molecule: refs (as-is)", () => {
  assert.deepEqual(atomDetail(DATASET, "rom-win")!.moleculeParents, ["molecule:rom"]);
});

test("a standalone atom has no molecule parents and a null domain", () => {
  const view = atomDetail(DATASET, "loner");
  assert.deepEqual(view!.moleculeParents, []);
  assert.equal(view!.domain, null);
});

test("a dangling molecule ref is surfaced as-is but yields a null domain", () => {
  const view = atomDetail(DATASET, "dangler");
  assert.deepEqual(view!.moleculeParents, ["molecule:ghost"]);
  assert.equal(view!.domain, null);
});

test("an atom with no versions returns an empty versions array", () => {
  assert.deepEqual(atomDetail(DATASET, "loner")!.versions, []);
});
