import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDataset, filterPublic, type RawGarden } from "./data";
import { resolveEntity } from "./entity-resolve";

const garden: RawGarden = {
  plants: [{ slug: "paulopus", name: "Paulopus", natures: ["work"], description: "The oracle." }],
  pods: [{ slug: "celesta", name: "Celesta", description: "An album.", parents: ["plant:paulopus"] }],
  beans: [
    { slug: "karma", name: "Karma", description: "How it scores.", parents: ["plant:paulopus"] },
    { slug: "hidden", name: "Hidden", parents: ["plant:paulopus"], visibility: "private" },
  ],
};

test("each kind resolves to its page", () => {
  const data = buildDataset(garden);
  assert.deepEqual(resolveEntity(data, "plant:paulopus"), {
    ref: "plant:paulopus",
    kind: "plant",
    href: "/plant/paulopus",
    name: "Paulopus",
    description: "The oracle.",
  });
  assert.equal(resolveEntity(data, "pod:celesta")?.href, "/pod/celesta");
  assert.equal(resolveEntity(data, "bean:karma")?.href, "/bean/karma");
});

test("a description is omitted when blank", () => {
  const data = buildDataset({ beans: [{ slug: "b", name: "B", parents: [] }] });
  assert.equal("description" in resolveEntity(data, "bean:b")!, false);
});

test("unknown slug, unknown prefix and sprout refs resolve to null", () => {
  const data = buildDataset(garden);
  assert.equal(resolveEntity(data, "bean:ghost"), null);
  assert.equal(resolveEntity(data, "bee:something"), null);
  assert.equal(resolveEntity(data, "sprout:anything"), null);
  assert.equal(resolveEntity(data, "nonsense"), null);
});

test("fail-closed: a target the projection dropped resolves to null", () => {
  const publicData = buildDataset(filterPublic(garden));
  assert.equal(resolveEntity(publicData, "bean:hidden"), null);
  assert.notEqual(resolveEntity(publicData, "bean:karma"), null);
});

test("a bean ref resolves with the cover derived from its newest sprout with an image", () => {
  const data = buildDataset({
    beans: [{ slug: "cover-bean", name: "Cover Bean", parents: [] }],
    sprouts: [
      {
        slug: "newer",
        name: "Newer",
        type: "t",
        date: "2026-06-01",
        description: "",
        parents: ["bean:cover-bean"],
      },
      {
        slug: "older",
        name: "Older",
        type: "t",
        date: "2026-01-01",
        description: "",
        parents: ["bean:cover-bean"],
        media: [{ kind: "image", storageKey: "k9", url: "https://cdn/9.jpg", alt: "nine" }],
      },
    ],
  });
  const resolved = resolveEntity(data, "bean:cover-bean");
  assert.equal(resolved?.cover?.storageKey, "k9");
  assert.equal(resolved?.cover?.alt, "nine");
});

test("a bean with no images resolves with no cover key at all", () => {
  const data = buildDataset({ beans: [{ slug: "bare", name: "Bare", parents: [] }] });
  const resolved = resolveEntity(data, "bean:bare");
  assert.ok(resolved);
  assert.equal(resolved!.cover, undefined);
  assert.ok(!("cover" in resolved!), "an absent cover should be omitted, not set to undefined");
});

test("plant and pod refs never carry a cover — those tiers have no media field", () => {
  const data = buildDataset({
    plants: [{ slug: "pl", name: "P", natures: ["work"], description: "" }],
    pods: [{ slug: "po", name: "Po", description: "", parents: ["plant:pl"] }],
  });
  assert.equal(resolveEntity(data, "plant:pl")?.cover, undefined);
  assert.equal(resolveEntity(data, "pod:po")?.cover, undefined);
});
