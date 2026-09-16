import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDataset, type RawGarden, type Bean } from "./data";
import { relatedBeans } from "./related-beans";

/** A sprout carrying real content, so `articleFor` answers for its bean. */
function written(slug: string, bean: string, date: string) {
  return {
    slug,
    name: slug,
    type: "note",
    date,
    description: "",
    parents: [`bean:${bean}`],
    content: `# ${slug}\n\nBody.`,
  };
}

/** A sprout with NO content — present, dated, and invisible to `articleFor`. */
function blank(slug: string, bean: string, date: string) {
  return { slug, name: slug, type: "note", date, description: "", parents: [`bean:${bean}`] };
}

const garden: RawGarden = {
  // `natures`, `role` and `description` are REQUIRED on Plant (lib/data.ts:107)
  // — `role` deliberately so, per its own comment. tsc catches an omission.
  plants: [
    {
      slug: "paulopus",
      name: "Paulopus",
      natures: ["work"],
      role: { kind: "owner" },
      description: "",
    },
    {
      slug: "other-plant",
      name: "Other",
      natures: ["work"],
      role: { kind: "owner" },
      description: "",
    },
  ],
  pods: [
    { slug: "karma", name: "Karma", description: "", parents: ["plant:paulopus"] },
    { slug: "atlas", name: "Atlas", description: "", parents: ["plant:paulopus"] },
    { slug: "far", name: "Far", description: "", parents: ["plant:other-plant"] },
  ],
  beans: [
    { slug: "here", name: "Here", parents: ["pod:karma"] },       // the bean being read
    { slug: "sib-old", name: "Sib Old", parents: ["pod:karma"] },  // pod sibling, older
    { slug: "sib-new", name: "Sib New", parents: ["pod:karma"] },  // pod sibling, newer
    { slug: "cousin", name: "Cousin", parents: ["pod:atlas"] },    // same plant, other pod
    { slug: "direct", name: "Direct", parents: ["plant:paulopus"] }, // same plant, no pod
    { slug: "stranger", name: "Stranger", parents: ["pod:far"] },  // other plant entirely
  ],
  sprouts: [
    written("s-here", "here", "2026-01-01"),
    written("s-sib-old", "sib-old", "2020-01-01"),
    written("s-sib-new", "sib-new", "2024-01-01"),
    written("s-cousin", "cousin", "2026-06-01"),   // NEWER than both pod siblings
    written("s-direct", "direct", "2025-01-01"),
    written("s-stranger", "stranger", "2026-09-01"),
  ],
};

function slugsFor(raw: RawGarden, beanSlug: string, limit?: number): string[] {
  const ds = buildDataset(raw);
  const bean = ds.getBean(beanSlug)!;
  return relatedBeans(ds, bean, limit).map((b: Bean) => b.slug);
}

test("pod siblings come before plant beans, even when a plant bean is newer", () => {
  // cousin (2026-06) is newer than sib-new (2024) and sib-old (2020), and still
  // sorts below both: the tier is the first key, the date only the second.
  assert.deepEqual(slugsFor(garden, "here"), ["sib-new", "sib-old", "cousin", "direct"]);
});

test("the bean being read never appears in its own rail", () => {
  assert.ok(!slugsFor(garden, "here").includes("here"));
});

test("a bean under another plant is never related", () => {
  assert.ok(!slugsFor(garden, "here").includes("stranger"));
});

test("within a tier, newest article first", () => {
  const out = slugsFor(garden, "here");
  assert.deepEqual(out.slice(0, 2), ["sib-new", "sib-old"]);
});

test("a bean with no sprout carrying content is excluded", () => {
  const raw: RawGarden = {
    ...garden,
    sprouts: [written("s-here", "here", "2026-01-01"), blank("s-sib-new", "sib-new", "2024-01-01")],
  };
  assert.deepEqual(slugsFor(raw, "here"), []);
});

test("a bean with no sprouts at all is excluded", () => {
  const raw: RawGarden = { ...garden, sprouts: [written("s-here", "here", "2026-01-01")] };
  assert.deepEqual(slugsFor(raw, "here"), []);
});

test("a bean in two pods contributes both sibling sets, once each", () => {
  const raw: RawGarden = {
    ...garden,
    beans: [...garden.beans!, { slug: "both", name: "Both", parents: ["pod:karma", "pod:atlas"] }],
    sprouts: [...garden.sprouts!, written("s-both", "both", "2026-07-01")],
  };
  const out = slugsFor(raw, "both");
  // Siblings from BOTH pods, each listed once, newest-first across the merged
  // tier — cousin (2026-06) and here (2026-01) are karma's and atlas's, and
  // "both" itself is absent. `direct` is the plant tier topping up behind them.
  assert.deepEqual(out, ["cousin", "here", "sib-new", "sib-old", "direct"]);
});

test("a bean parented to both a pod and that pod's plant appears once", () => {
  const raw: RawGarden = {
    ...garden,
    beans: garden.beans!.map((b) =>
      b.slug === "cousin" ? { ...b, parents: ["pod:atlas", "plant:paulopus"] } : b,
    ),
  };
  const out = slugsFor(raw, "here");
  assert.equal(out.filter((s) => s === "cousin").length, 1);
});

test("the rail caps at the limit", () => {
  assert.equal(slugsFor(garden, "here", 2).length, 2);
  assert.deepEqual(slugsFor(garden, "here", 2), ["sib-new", "sib-old"]);
});

test("equal article dates tie-break by English name, then slug", () => {
  const raw: RawGarden = {
    ...garden,
    beans: [
      { slug: "here", name: "Here", parents: ["pod:karma"] },
      { slug: "z-bean", name: "Alpha", parents: ["pod:karma"] },
      { slug: "a-bean", name: "Beta", parents: ["pod:karma"] },
    ],
    sprouts: [
      written("s-here", "here", "2026-01-01"),
      written("s-z", "z-bean", "2025-05-05"),
      written("s-a", "a-bean", "2025-05-05"),
    ],
  };
  // Same date: NAME decides, so "Alpha" (slug z-bean) precedes "Beta" (slug a-bean).
  assert.deepEqual(slugsFor(raw, "here"), ["z-bean", "a-bean"]);
});

test("a bean parented straight to a plant still gets the plant tier", () => {
  // "direct" has no pod, so tier 1 is empty and the whole rail is tier 2 —
  // every other written bean under paulopus, newest article first.
  assert.deepEqual(slugsFor(garden, "direct"), ["cousin", "here", "sib-new", "sib-old"]);
});

test("a bean whose pod has no plant gets pod siblings only", () => {
  const raw: RawGarden = {
    ...garden,
    pods: [{ slug: "karma", name: "Karma", description: "" }], // no plant parent
  };
  // atlas and far are gone with their beans' pod refs dangling, so only the
  // karma siblings remain — and no plant tier to top up from.
  assert.deepEqual(slugsFor(raw, "here"), ["sib-new", "sib-old"]);
});

test("a standalone bean gets nothing", () => {
  const raw: RawGarden = {
    ...garden,
    beans: [{ slug: "lonely", name: "Lonely", parents: [] }, ...garden.beans!],
    sprouts: [...garden.sprouts!, written("s-lonely", "lonely", "2026-01-01")],
  };
  assert.deepEqual(slugsFor(raw, "lonely"), []);
});
