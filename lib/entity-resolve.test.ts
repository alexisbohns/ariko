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
