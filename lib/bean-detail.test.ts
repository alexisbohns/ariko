import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDataset, type RawGarden } from "./data";
import { beanDetail } from "./bean-detail";

const SEED: RawGarden = {
  plants: [{ slug: "bohns-music", name: "Bohns Music", natures: ["work"], role: { kind: "owner" as const }, description: "" }],
  pods: [{ slug: "rom", name: "Republic", description: "", parents: ["plant:bohns-music"] }],
  beans: [
    { slug: "rom-win", name: "Win", parents: ["pod:rom"] },
    { slug: "loner", name: "Loner", parents: [] },
    { slug: "dangler", name: "Dangler", parents: ["pod:ghost"] },
  ],
  sprouts: [
    { slug: "win-v1", name: "Win v1", type: "t", date: "2025-01-01", description: "", parents: ["bean:rom-win"], state: "draft" },
    { slug: "win-v2", name: "Win v2", type: "t", date: "2025-03-01", description: "", parents: ["bean:rom-win"], state: "published" },
  ],
};
const DATASET = buildDataset(SEED);

test("unknown slug returns null", () => {
  assert.equal(beanDetail(DATASET, "nope"), null);
});

test("found atom returns the bean and its sprouts newest-first", () => {
  const view = beanDetail(DATASET, "rom-win");
  assert.ok(view);
  assert.equal(view!.bean.slug, "rom-win");
  assert.deepEqual(view!.sprouts.map((v) => v.slug), ["win-v2", "win-v1"]);
});

test("plant resolves via the pod parent", () => {
  assert.equal(beanDetail(DATASET, "rom-win")!.plant, "bohns-music");
});

test("beanDetail resolves the plant slug for the admin view", () => {
  const d = buildDataset({
    plants: [{ slug: "pl", name: "P", natures: ["work"], role: { kind: "owner" as const }, description: "" }],
    pods: [{ slug: "m", name: "M", description: "", parents: ["plant:pl"] }],
    beans: [{ slug: "a", name: "A", parents: ["pod:m"] }],
  });
  assert.equal(beanDetail(d, "a")?.plant, "pl");
});

test("podParents surfaces the pod: refs (as-is)", () => {
  assert.deepEqual(beanDetail(DATASET, "rom-win")!.podParents, ["pod:rom"]);
});

test("a standalone bean has no pod parents and a null plant", () => {
  const view = beanDetail(DATASET, "loner");
  assert.deepEqual(view!.podParents, []);
  assert.equal(view!.plant, null);
});

test("a dangling pod ref is surfaced as-is but yields a null plant", () => {
  const view = beanDetail(DATASET, "dangler");
  assert.deepEqual(view!.podParents, ["pod:ghost"]);
  assert.equal(view!.plant, null);
});

test("an bean with no sprouts returns an empty sprouts array", () => {
  assert.deepEqual(beanDetail(DATASET, "loner")!.sprouts, []);
});

test("localized bean/sprout text resolves to display strings at build time (B1)", () => {
  const seed: RawGarden = {
    beans: [{ slug: "bi", name: { en: "Win", fr: "Victoire" }, parents: [] }],
    sprouts: [
      { slug: "bi-v1", name: { fr: "Prise une" }, type: "t", date: "2025-01-01", description: { en: "first", fr: "première" }, parents: ["bean:bi"] },
    ],
  };
  const view = beanDetail(buildDataset(seed), "bi")!;
  assert.equal(view.bean.name, "Win");
  assert.equal(view.sprouts[0].name, "Prise une"); // fr-only → display fallback
  assert.equal(view.sprouts[0].description, "first");
});
