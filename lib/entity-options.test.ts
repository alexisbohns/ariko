import { test } from "node:test";
import assert from "node:assert/strict";
import { entityOptions } from "./entity-options";
import type { RawGarden } from "./data";

const garden: RawGarden = {
  plants: [
    { slug: "paulopus", name: "Paulopus", natures: ["work"], description: "A project." },
  ],
  pods: [{ slug: "records", name: "Records", description: "" }],
  beans: [
    { slug: "karma", name: { en: "Karma", fr: "Karma FR" }, parents: [], description: "Synopsis." },
    { slug: "anatomy", name: "Anatomy", parents: [] },
  ],
  sprouts: [{ slug: "karma-0", name: "K0", type: "article", date: "2026-07-24", description: "", parents: [] }],
};

test("offers plants, pods and beans, sorted by name", () => {
  assert.deepEqual(
    entityOptions(garden).map((o) => o.ref),
    ["bean:anatomy", "bean:karma", "plant:paulopus", "pod:records"],
  );
});

test("never offers sprouts — a sprout card could not resolve a URL", () => {
  assert.ok(!entityOptions(garden).some((o) => o.ref.startsWith("sprout:")));
});

test("carries kind, resolved name and a non-blank description only", () => {
  const byRef = new Map(entityOptions(garden).map((o) => [o.ref, o]));
  assert.deepEqual(byRef.get("bean:karma"), {
    ref: "bean:karma",
    kind: "bean",
    name: "Karma",
    description: "Synopsis.",
  });
  // No description key at all when it is absent or blank — the menu renders on
  // presence, and an empty string would render an empty line.
  assert.deepEqual(byRef.get("bean:anatomy"), {
    ref: "bean:anatomy",
    kind: "bean",
    name: "Anatomy",
  });
});

test("excludes the entity being edited, so a page cannot reference itself", () => {
  assert.ok(!entityOptions(garden, "plant:paulopus").some((o) => o.ref === "plant:paulopus"));
  assert.equal(entityOptions(garden, "plant:paulopus").length, 3);
});

test("an empty garden yields no options rather than throwing", () => {
  assert.deepEqual(entityOptions({}), []);
});
