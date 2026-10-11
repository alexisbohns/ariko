import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildDataset, type RawGarden, type Bean, type Sprout } from "./data";
import { relatedBeans } from "./related-beans";

/** An entry about a bean — dated, and all a journal entry needs to be here. */
function entry(slug: string, bean: string, date: string): Sprout {
  return { slug, name: slug, kind: "log", date, description: "", about: [`bean:${bean}`] };
}

/** A bean with a narrative of its own — the ONE admission test now. */
function readable(slug: string, name: string, parents: string[]): Bean {
  return { slug, name, parents, content: `# ${name}\n\nBody.` };
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
    readable("here", "Here", ["pod:karma"]),            // the bean being read
    readable("sib-old", "Sib Old", ["pod:karma"]),      // pod sibling, older
    readable("sib-new", "Sib New", ["pod:karma"]),      // pod sibling, newer
    readable("cousin", "Cousin", ["pod:atlas"]),        // same plant, other pod
    readable("direct", "Direct", ["plant:paulopus"]),   // same plant, no pod
    readable("stranger", "Stranger", ["pod:far"]),      // other plant entirely
  ],
  sprouts: [
    entry("s-here", "here", "2026-01-01"),
    entry("s-sib-old", "sib-old", "2020-01-01"),
    entry("s-sib-new", "sib-new", "2024-01-01"),
    entry("s-cousin", "cousin", "2026-06-01"),   // NEWER than both pod siblings
    entry("s-direct", "direct", "2025-01-01"),
    entry("s-stranger", "stranger", "2026-09-01"),
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

test("within a tier, newest entry first", () => {
  const out = slugsFor(garden, "here");
  assert.deepEqual(out.slice(0, 2), ["sib-new", "sib-old"]);
});

test("a bean with no narrative is excluded", () => {
  // `sib-new` has an entry about it — dated, published, present — and no prose
  // of its own. An entry DATES a candidate; it never admits one.
  const raw: RawGarden = {
    ...garden,
    beans: [
      readable("here", "Here", ["pod:karma"]),
      { slug: "sib-new", name: "Sib New", parents: ["pod:karma"] },
      { slug: "cousin", name: "Cousin", parents: ["pod:atlas"] },
      { slug: "direct", name: "Direct", parents: ["plant:paulopus"] },
    ],
    sprouts: [entry("s-here", "here", "2026-01-01"), entry("s-sib-new", "sib-new", "2024-01-01")],
  };
  assert.deepEqual(slugsFor(raw, "here"), []);
});

test("a bean with no narrative and no entries is excluded", () => {
  const raw: RawGarden = {
    ...garden,
    beans: [
      readable("here", "Here", ["pod:karma"]),
      { slug: "sib-old", name: "Sib Old", parents: ["pod:karma"] },
      { slug: "sib-new", name: "Sib New", parents: ["pod:karma"] },
      { slug: "cousin", name: "Cousin", parents: ["pod:atlas"] },
      { slug: "direct", name: "Direct", parents: ["plant:paulopus"] },
    ],
    sprouts: [entry("s-here", "here", "2026-01-01")],
  };
  assert.deepEqual(slugsFor(raw, "here"), []);
});

test("a bean in two pods contributes both sibling sets, once each", () => {
  const raw: RawGarden = {
    ...garden,
    beans: [...garden.beans!, readable("both", "Both", ["pod:karma", "pod:atlas"])],
    sprouts: [...garden.sprouts!, entry("s-both", "both", "2026-07-01")],
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
      b.slug === "sib-new" ? { ...b, parents: ["pod:karma", "plant:paulopus"] } : b,
    ),
  };
  // `sib-new` reaches BOTH tiers — pod sibling of `here`, and a direct child of
  // paulopus — so this pins `relatedBeans`'s own cross-tier guard rather than
  // the dedupe inside `beansForPlantDeep`. The whole rail is asserted, because
  // a duplicate is only visible in the full array.
  assert.deepEqual(slugsFor(raw, "here"), ["sib-new", "sib-old", "cousin", "direct"]);
});

test("the rail caps at the limit", () => {
  assert.equal(slugsFor(garden, "here", 2).length, 2);
  assert.deepEqual(slugsFor(garden, "here", 2), ["sib-new", "sib-old"]);
});

test("the default rail is six beans, not five and not seven", () => {
  // Eight candidates for `here`: six pod siblings and two plant beans.
  const extras = ["e1", "e2", "e3", "e4"];
  const raw: RawGarden = {
    ...garden,
    beans: [...garden.beans!, ...extras.map((s) => readable(s, s, ["pod:karma"]))],
    sprouts: [...garden.sprouts!, ...extras.map((s) => entry(`s-${s}`, s, "2023-01-01"))],
  };
  assert.equal(slugsFor(raw, "here").length, 6);
});

test("equal entry dates tie-break by English name, then slug", () => {
  const raw: RawGarden = {
    ...garden,
    beans: [
      readable("here", "Here", ["pod:karma"]),
      readable("z-bean", "Alpha", ["pod:karma"]),
      readable("a-bean", "Beta", ["pod:karma"]),
      // Same name AND same date as z-bean, so only the SLUG can separate them
      // — and it is listed last, so garden order disagrees with slug order.
      // Without the tie-break's second key the stable sort leaves these two in
      // garden order (z-bean, m-bean) and this assertion fails, which is the
      // whole point of the third bean.
      readable("m-bean", "Alpha", ["pod:karma"]),
    ],
    sprouts: [
      entry("s-here", "here", "2026-01-01"),
      entry("s-z", "z-bean", "2025-05-05"),
      entry("s-a", "a-bean", "2025-05-05"),
      entry("s-m", "m-bean", "2025-05-05"),
    ],
  };
  // Same date: NAME decides first, so both Alphas precede "Beta" (slug a-bean).
  // Between the two Alphas the SLUG decides, and "m-bean" < "z-bean".
  assert.deepEqual(slugsFor(raw, "here"), ["m-bean", "z-bean", "a-bean"]);
});

test("the order is English-name order even when French would disagree", () => {
  const raw: RawGarden = {
    ...garden,
    beans: [
      readable("here", "Here", ["pod:karma"]),
      { ...readable("x-bean", "Alpha", ["pod:karma"]), name: { en: "Alpha", fr: "Zèbre" } },
      { ...readable("y-bean", "Beta", ["pod:karma"]), name: { en: "Beta", fr: "Aube" } },
    ],
    sprouts: [
      entry("s-here", "here", "2026-01-01"),
      entry("s-x", "x-bean", "2025-05-05"),
      entry("s-y", "y-bean", "2025-05-05"),
    ],
  };
  // Same date, so the name decides — and the two languages disagree about it:
  // EN is Alpha before Beta, FR is Aube before Zèbre, i.e. the reverse. The
  // comparator resolves to English for every reader, which is what stops the
  // `slice(0, limit)` keeping a different six beans per language.
  assert.deepEqual(slugsFor(raw, "here"), ["x-bean", "y-bean"]);
});

test("a bean parented straight to a plant still gets the plant tier", () => {
  // "direct" has no pod, so tier 1 is empty and the whole rail is tier 2 —
  // every other readable bean under paulopus, newest entry first.
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
    beans: [readable("lonely", "Lonely", []), ...garden.beans!],
    sprouts: [...garden.sprouts!, entry("s-lonely", "lonely", "2026-01-01")],
  };
  assert.deepEqual(slugsFor(raw, "lonely"), []);
});

// The one assertion that is about SOURCE rather than behaviour, and it is here
// because behaviour cannot reach it: `relatedBeans` builds both tiers as Maps
// and re-sorts them, so the Map absorbs everything `beansForPlantDeep` does
// that a hand-rolled `beansForPlant` + `podsForPlant.flatMap(beansForPod)`
// concat would not — its dedupe and its ordering alike. Swapping the call for
// that concat passes `tsc`, all thirteen tests above, and `npm run build`,
// while leaving a second definition of "every bean under a plant" to drift
// from the one `/admin/beans` and the plant hub already count with.
// lib/admin-section-source.test.ts pins the same function the same way.
test("the plant tier is built by CALLING beansForPlantDeep, not by composing it", () => {
  const text = readFileSync(join(process.cwd(), "lib/related-beans.ts"), "utf8");
  assert.match(
    text,
    /import\s*\{[^}]*\bbeansForPlantDeep\b[^}]*\}\s*from\s*["']\.\/plant-hub["']/,
    "lib/related-beans.ts must import beansForPlantDeep from lib/plant-hub",
  );
  assert.match(
    text,
    /beansForPlantDeep\(\s*dataset\s*,\s*plant\.slug\s*\)/,
    "lib/related-beans.ts must build its plant tier from " +
      "beansForPlantDeep(dataset, plant.slug) — the one definition of what a " +
      "plant contains, which the plant hub and /admin/beans already share",
  );
});

// --- The bean's OWN narrative admits it, by the test the bean page renders by.

test("a sibling with a narrative of its own and no sprouts appears in the rail", () => {
  const raw: RawGarden = {
    ...garden,
    beans: [...garden.beans!, { slug: "written", name: "Written", parents: ["pod:karma"], content: "prose" }],
  };
  // `written` has no entry about it at all, and is admitted by its `content` —
  // `hasNarrative`, the same test the destination renders by. Undated, it sits
  // LAST in the pod tier, ahead of every plant-tier bean.
  assert.deepEqual(slugsFor(raw, "here"), ["sib-new", "sib-old", "written", "cousin", "direct"]);
});

test("within a tier a bean nobody has written about sorts after one with an entry; two such sort by name", () => {
  const raw: RawGarden = {
    ...garden,
    beans: [
      readable("here", "Here", ["pod:karma"]),
      // Dated by its entry, and OLD — still ahead of every bean with none.
      readable("sib-old", "Sib Old", ["pod:karma"]),
      // Listed Z before A so that garden order disagrees with name order.
      { slug: "zed", name: "Zed", parents: ["pod:karma"], content: "prose" },
      { slug: "ann", name: "Ann", parents: ["pod:karma"], content: { en: "prose" } },
    ],
    sprouts: [entry("s-here", "here", "2026-01-01"), entry("s-sib-old", "sib-old", "2020-01-01")],
  };
  assert.deepEqual(slugsFor(raw, "here"), ["sib-old", "ann", "zed"]);
});

// --- Dated by the newest journal entry ABOUT it — the date source the rail was
// given when the article fallback went. Without one every candidate is undated
// and the rail degrades, silently, to name order — which the first test below
// reports, and the second does for a date taken from a bean's OLDEST entry.

test("a candidate is dated by its newest journal entry: newer entry first", () => {
  const g: RawGarden = {
    ...garden,
    beans: [readable("here", "Here", ["pod:karma"]), readable("a", "A", ["pod:karma"]), readable("b", "B", ["pod:karma"])],
    sprouts: [entry("a-old", "a", "2020-01-01"), entry("b-new", "b", "2026-06-01")],
  };
  const d = buildDataset(g);
  assert.deepEqual(relatedBeans(d, d.getBean("here")!).map((b) => b.slug), ["b", "a"]);
});

test("a candidate's date is its NEWEST entry, not its first", () => {
  const g: RawGarden = {
    ...garden,
    beans: [readable("here", "Here", ["pod:karma"]), readable("a", "Zed", ["pod:karma"]), readable("b", "Ann", ["pod:karma"])],
    sprouts: [entry("a-old", "a", "2020-01-01"), entry("b-mid", "b", "2026-01-01"), entry("a-new", "a", "2026-06-01")],
  };
  const d = buildDataset(g);
  assert.deepEqual(relatedBeans(d, d.getBean("here")!).map((b) => b.slug), ["a", "b"]);
});
