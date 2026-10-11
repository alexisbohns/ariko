import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDataset, filterPublic, type RawGarden } from "./data";

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

test("getBeans: the projected dataset's beans, so a pollen line's bean door can only name a public bean", () => {
  const mixed: RawGarden = {
    ...garden,
    beans: [
      { slug: "b", name: "B", parents: ["pod:pod"] },
      { slug: "hidden", name: "Hidden", parents: ["pod:pod"], visibility: "private" },
    ],
  };
  assert.deepEqual(
    buildDataset(filterPublic(mixed)).getBeans().map((b) => b.slug),
    ["b"],
  );
  assert.deepEqual(
    buildDataset(mixed).getBeans().map((b) => b.slug),
    ["b", "hidden"],
  );
});

// The public sprout page's notFound() rests on this: it asks the PROJECTED
// dataset for the entry and draws nothing when the answer is undefined. A
// sprout with no `state` is unpublished — filterPublic keeps only
// `"published"` — so its address must answer 404 even though its bean, pod and
// plant are all public and a published sibling about the same bean resolves.
test("entryForSprout: a private sprout is not in the projected dataset", () => {
  const mixed: RawGarden = {
    ...garden,
    sprouts: [
      { slug: "out", name: "Out", kind: "log", date: "2026-01-03", description: "", about: ["bean:b"], state: "published" },
      { slug: "held", name: "Held", kind: "log", date: "2026-01-04", description: "", about: ["bean:b"] },
    ],
  };
  const projected = buildDataset(filterPublic(mixed));
  assert.equal(projected.entryForSprout("held"), undefined);
  assert.equal(projected.entryForSprout("out")?.bean?.slug, "b");
  // The contrast: the unfiltered dataset knows it, so the absence above is the
  // projection's doing and not a typo in the fixture.
  assert.equal(buildDataset(mixed).entryForSprout("held")?.sprout.slug, "held");
});
