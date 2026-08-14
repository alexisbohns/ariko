import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import assert from "node:assert/strict";
import {
  buildDataset,
  composeText,
  getDataset,
  publishCascade,
  textPart,
  unpublishCascade,
  unpublishCascadeForBeans,
  type RawGarden,
  type SproutState,
  type Visibility,
} from "./data";

// Synthetic seed exercising every edge case the directory/timeline must handle:
// multi-parent atoms, standalone atoms, dangling molecule refs, and a version
// whose atom has no molecule (domainless).
const raw: RawGarden = {
  pods: [
    { slug: "m-music", name: "Music Mol", domain: "music", description: "" },
    { slug: "m-design", name: "Design Mol", domain: "design", description: "" },
  ],
  beans: [
    { slug: "a1", name: "A1", parents: ["pod:m-music"] },
    { slug: "a2", name: "A2", parents: ["pod:m-music", "pod:m-design"] },
    { slug: "a-standalone", name: "Lonely", parents: [] },
    { slug: "a-dangling", name: "Dangling", parents: ["pod:nope"] },
  ],
  sprouts: [
    { slug: "v-old", name: "Old", type: "song", date: "2020-01-01", description: "", parents: ["bean:a1"] },
    { slug: "v-new", name: "New", type: "song", date: "2026-01-01", description: "", parents: ["bean:a1"] },
    { slug: "v-mid", name: "Mid", type: "song", date: "2023-06-15", description: "", parents: ["bean:a1"] },
    { slug: "v-orphan", name: "Orphan", type: "note", date: "2024-01-01", description: "", parents: ["bean:a-standalone"] },
  ],
};

test("timelineSprouts sorts all sprouts by date descending", () => {
  const ds = buildDataset(raw);
  const slugs = ds.timelineSprouts().map((e) => e.sprout.slug);
  assert.deepEqual(slugs, ["v-new", "v-orphan", "v-mid", "v-old"]);
});

test("timeline entries tag each sprout with its bean and derived domain", () => {
  const ds = buildDataset(raw);
  const bySlug = new Map(ds.timelineSprouts().map((e) => [e.sprout.slug, e]));

  const vNew = bySlug.get("v-new")!;
  assert.equal(vNew.bean?.slug, "a1");
  assert.equal(vNew.domain, "music");

  const vOrphan = bySlug.get("v-orphan")!;
  assert.equal(vOrphan.bean?.slug, "a-standalone");
  assert.equal(vOrphan.domain, null);
});

test("beansForPod indexes beans by pod, including multi-parent beans", () => {
  const ds = buildDataset(raw);
  assert.deepEqual(ds.beansForPod("m-music").map((a) => a.slug), ["a1", "a2"]);
  assert.deepEqual(ds.beansForPod("m-design").map((a) => a.slug), ["a2"]);
});

test("standaloneBeans are beans with no resolvable pod parent", () => {
  const ds = buildDataset(raw);
  assert.deepEqual(ds.standaloneBeans().map((a) => a.slug), ["a-standalone", "a-dangling"]);
});

test("domain is derived from an bean's first pod parent", () => {
  const ds = buildDataset(raw);
  assert.equal(ds.domainForBean("a1"), "music");
  assert.equal(ds.domainForBean("a2"), "music");
  assert.equal(ds.domainForBean("a-standalone"), null);
  assert.equal(ds.domainForBean("a-dangling"), null);
});

test("sproutsForBean returns that bean's sprouts sorted by date descending", () => {
  const ds = buildDataset(raw);
  assert.deepEqual(ds.sproutsForBean("a1").map((v) => v.slug), ["v-new", "v-mid", "v-old"]);
});

test("getAtom looks up an bean by slug", () => {
  const ds = buildDataset(raw);
  assert.equal(ds.getBean("a2")?.name, "A2");
  assert.equal(ds.getBean("missing"), undefined);
});

test("getDataset keeps sprout dates as plain YYYY-MM-DD strings", () => {
  // js-yaml's default schema coerces unquoted dates into Date objects, which
  // breaks date rendering and drops `date` from scalar-property listings.
  const version = getDataset().timelineSprouts()[0].sprout;
  assert.equal(typeof version.date, "string");
  assert.match(version.date, /^\d{4}-\d{2}-\d{2}$/);
});

const RAW = {
  pods: [{ slug: "m1", name: "M1", domain: "music" as const, description: "" }],
  beans: [
    { slug: "a1", name: "A1", parents: ["pod:m1"] },
    { slug: "a2", name: "A2", parents: ["pod:m1", "pod:mX"] }, // mX dangling
  ],
  sprouts: [
    { slug: "v1", name: "V1", type: "t", date: "2025-01-01", description: "", parents: ["bean:a1"] },
    { slug: "v2", name: "V2", type: "t", date: "2025-01-01", description: "", parents: ["bean:a1", "bean:a2"] },
    { slug: "v3", name: "V3", type: "t", date: "2025-01-01", description: "", parents: [] },
    { slug: "v4", name: "V4", type: "t", date: "2025-01-01", description: "", parents: ["bean:ghost"] },
  ],
};

test("publishCascade returns the bean parent and its pod parent", () => {
  const r = publishCascade(RAW, "v1");
  assert.deepEqual(r.beanSlugs, ["a1"]);
  assert.deepEqual(r.podSlugs, ["m1"]);
});

test("publishCascade unions multiple bean parents and their pods, ignoring dangling pod refs", () => {
  const r = publishCascade(RAW, "v2");
  assert.deepEqual([...r.beanSlugs].sort(), ["a1", "a2"]);
  assert.deepEqual(r.podSlugs, ["m1"]); // mX is dangling → excluded
});

test("a parentless sprout cascades nothing", () => {
  assert.deepEqual(publishCascade(RAW, "v3"), { plantSlugs: [], podSlugs: [], beanSlugs: [] });
});

test("a dangling bean parent is ignored", () => {
  assert.deepEqual(publishCascade(RAW, "v4"), { plantSlugs: [], podSlugs: [], beanSlugs: [] });
});

test("an unknown sprout slug cascades nothing", () => {
  assert.deepEqual(publishCascade(RAW, "nope"), { plantSlugs: [], podSlugs: [], beanSlugs: [] });
});

test("parents are returned regardless of current visibility (idempotent flip)", () => {
  const raw = {
    pods: [{ slug: "m1", name: "M1", domain: "music" as const, description: "", visibility: "public" as const }],
    beans: [{ slug: "a1", name: "A1", parents: ["pod:m1"], visibility: "public" as const }],
    sprouts: [{ slug: "v1", name: "V1", type: "t", date: "2025-01-01", description: "", parents: ["bean:a1"] }],
  };
  const r = publishCascade(raw, "v1");
  assert.deepEqual(r.beanSlugs, ["a1"]);
  assert.deepEqual(r.podSlugs, ["m1"]);
});

test("an bean with two real pod parents cascades both pods", () => {
  const raw = {
    pods: [
      { slug: "m1", name: "M1", domain: "music" as const, description: "" },
      { slug: "m2", name: "M2", domain: "design" as const, description: "" },
    ],
    beans: [{ slug: "a1", name: "A1", parents: ["pod:m1", "pod:m2"] }],
    sprouts: [
      { slug: "v1", name: "V1", type: "t", date: "2025-01-01", description: "", parents: ["bean:a1"] },
    ],
  };
  const r = publishCascade(raw, "v1");
  assert.deepEqual(r.beanSlugs, ["a1"]);
  assert.deepEqual([...r.podSlugs].sort(), ["m1", "m2"]);
});

// --- unpublishCascade: the downward inverse (roadmap A1). Fixtures are built per
// test because the interesting variable is the surviving published/public siblings.

function ver(slug: string, parents: string[], state: SproutState) {
  return { slug, name: slug.toUpperCase(), type: "t", date: "2025-01-01", description: "", parents, state };
}
const mol = (slug: string, visibility: Visibility) => ({
  slug, name: slug.toUpperCase(), domain: "music" as const, description: "", visibility,
});
const atom = (slug: string, parents: string[], visibility: Visibility) => ({
  slug, name: slug.toUpperCase(), parents, visibility,
});

test("unpublishCascade re-privatizes the bean and its pod when the last published sprout is pulled", () => {
  const raw: RawGarden = {
    pods: [mol("m1", "public")],
    beans: [atom("a1", ["pod:m1"], "public")],
    sprouts: [ver("v1", ["bean:a1"], "draft")], // just un-published
  };
  assert.deepEqual(unpublishCascade(raw, "v1"), { plantSlugs: [], podSlugs: ["m1"], beanSlugs: ["a1"] });
});

test("unpublishCascade keeps the whole lineage when a published sibling sprout remains", () => {
  const raw: RawGarden = {
    pods: [mol("m1", "public")],
    beans: [atom("a1", ["pod:m1"], "public")],
    sprouts: [ver("v1", ["bean:a1"], "draft"), ver("v2", ["bean:a1"], "published")],
  };
  assert.deepEqual(unpublishCascade(raw, "v1"), { plantSlugs: [], podSlugs: [], beanSlugs: [] });
});

test("unpublishCascade flips the atom but keeps a pod that still has another public bean", () => {
  const raw: RawGarden = {
    pods: [mol("m1", "public")],
    beans: [atom("a1", ["pod:m1"], "public"), atom("a2", ["pod:m1"], "public")],
    sprouts: [ver("v1", ["bean:a1"], "draft")],
  };
  assert.deepEqual(unpublishCascade(raw, "v1"), { plantSlugs: [], podSlugs: [], beanSlugs: ["a1"] });
});

test("unpublishCascade evaluates each bean parent of a multi-parent sprout independently", () => {
  const raw: RawGarden = {
    pods: [mol("m1", "public"), mol("m2", "public")],
    beans: [atom("a1", ["pod:m1"], "public"), atom("a2", ["pod:m2"], "public")],
    sprouts: [ver("v1", ["bean:a1", "bean:a2"], "draft"), ver("v2", ["bean:a2"], "published")],
  };
  // a2 keeps its published sibling; a1 empties, and with it m1.
  assert.deepEqual(unpublishCascade(raw, "v1"), { plantSlugs: [], podSlugs: ["m1"], beanSlugs: ["a1"] });
});

test("unpublishCascade lists a pod shared by two flipped beans once", () => {
  const raw: RawGarden = {
    pods: [mol("m1", "public")],
    beans: [atom("a1", ["pod:m1"], "public"), atom("a2", ["pod:m1"], "public")],
    sprouts: [ver("v1", ["bean:a1", "bean:a2"], "draft")],
  };
  const r = unpublishCascade(raw, "v1");
  assert.deepEqual([...r.beanSlugs].sort(), ["a1", "a2"]);
  assert.deepEqual(r.podSlugs, ["m1"]);
});

test("unpublishCascade ignores dangling bean and pod refs", () => {
  const raw: RawGarden = {
    pods: [],
    beans: [atom("a1", ["pod:ghost"], "public")],
    sprouts: [ver("v1", ["bean:ghost", "bean:a1"], "draft")],
  };
  assert.deepEqual(unpublishCascade(raw, "v1"), { plantSlugs: [], podSlugs: [], beanSlugs: ["a1"] });
});

test("a parentless sprout un-cascades nothing", () => {
  const raw: RawGarden = { pods: [], beans: [], sprouts: [ver("v1", [], "draft")] };
  assert.deepEqual(unpublishCascade(raw, "v1"), { plantSlugs: [], podSlugs: [], beanSlugs: [] });
});

test("an unknown sprout slug un-cascades nothing", () => {
  const raw: RawGarden = { pods: [], beans: [], sprouts: [] };
  assert.deepEqual(unpublishCascade(raw, "nope"), { plantSlugs: [], podSlugs: [], beanSlugs: [] });
});

test("unpublishCascade is a no-op while the sprout is still published (its own state shelters its parents)", () => {
  const raw: RawGarden = {
    pods: [mol("m1", "public")],
    beans: [atom("a1", ["pod:m1"], "public")],
    sprouts: [ver("v1", ["bean:a1"], "published")],
  };
  assert.deepEqual(unpublishCascade(raw, "v1"), { plantSlugs: [], podSlugs: [], beanSlugs: [] });
});

test("an explicitly-private sibling bean does not count as remaining public for the pod rule", () => {
  const raw: RawGarden = {
    pods: [mol("m1", "public")],
    beans: [atom("a1", ["pod:m1"], "public"), atom("a2", ["pod:m1"], "private")],
    sprouts: [ver("v1", ["bean:a1"], "draft")],
  };
  assert.deepEqual(unpublishCascade(raw, "v1"), { plantSlugs: [], podSlugs: ["m1"], beanSlugs: ["a1"] });
});

test("flip targets are returned regardless of their current visibility (idempotent flip)", () => {
  const raw: RawGarden = {
    pods: [mol("m1", "private")],
    beans: [atom("a1", ["pod:m1"], "private")],
    sprouts: [ver("v1", ["bean:a1"], "draft")],
  };
  assert.deepEqual(unpublishCascade(raw, "v1"), { plantSlugs: [], podSlugs: ["m1"], beanSlugs: ["a1"] });
});

test("inverse symmetry: un-publish flips back exactly what publish flipped (single-sprout lineage)", () => {
  const pods = [mol("m1", "public")];
  const beans = [atom("a1", ["pod:m1"], "public")];
  const published = publishCascade({ pods, beans, sprouts: [ver("v1", ["bean:a1"], "published")] }, "v1");
  const unpublished = unpublishCascade({ pods, beans, sprouts: [ver("v1", ["bean:a1"], "draft")] }, "v1");
  assert.deepEqual(unpublished, published);
});

// --- unpublishCascadeForBeans: the atom-keyed core (roadmap A2). The delete flow
// seeds a version's atom parents BEFORE the delete and evaluates them against the
// POST-delete dataset — where the version no longer exists to shelter anything.

test("delete-shaped: last published sprout already gone from the dataset flips bean and pod", () => {
  const raw: RawGarden = {
    pods: [mol("m1", "public")],
    beans: [atom("a1", ["pod:m1"], "public")],
    sprouts: [], // the deleted version was a1's only version
  };
  assert.deepEqual(unpublishCascadeForBeans(raw, ["a1"]), { plantSlugs: [], podSlugs: ["m1"], beanSlugs: ["a1"] });
});

test("delete-shaped: a surviving published sibling shelters the bean (and pod)", () => {
  const raw: RawGarden = {
    pods: [mol("m1", "public")],
    beans: [atom("a1", ["pod:m1"], "public")],
    sprouts: [ver("v2", ["bean:a1"], "published")], // sibling of the deleted version
  };
  assert.deepEqual(unpublishCascadeForBeans(raw, ["a1"]), { plantSlugs: [], podSlugs: [], beanSlugs: [] });
});

test("delete-shaped: a surviving draft sibling does not shelter", () => {
  const raw: RawGarden = {
    pods: [mol("m1", "public")],
    beans: [atom("a1", ["pod:m1"], "public")],
    sprouts: [ver("v2", ["bean:a1"], "draft")],
  };
  assert.deepEqual(unpublishCascadeForBeans(raw, ["a1"]), { plantSlugs: [], podSlugs: ["m1"], beanSlugs: ["a1"] });
});

test("unpublishCascadeForBeans ignores unknown bean slugs", () => {
  const raw: RawGarden = {
    pods: [mol("m1", "public")],
    beans: [atom("a1", ["pod:m1"], "public")],
    sprouts: [],
  };
  const r = unpublishCascadeForBeans(raw, ["ghost", "a1"]);
  assert.deepEqual(r, { plantSlugs: [], podSlugs: ["m1"], beanSlugs: ["a1"] });
});

test("unpublishCascadeForBeans ignores a flipped bean's dangling pod refs", () => {
  const raw: RawGarden = {
    pods: [],
    beans: [atom("a1", ["pod:ghost"], "public")],
    sprouts: [],
  };
  assert.deepEqual(unpublishCascadeForBeans(raw, ["a1"]), { plantSlugs: [], podSlugs: [], beanSlugs: ["a1"] });
});

test("unpublishCascadeForBeans on empty input flips nothing", () => {
  const raw: RawGarden = {
    pods: [mol("m1", "public")],
    beans: [atom("a1", ["pod:m1"], "public")],
    sprouts: [],
  };
  assert.deepEqual(unpublishCascadeForBeans(raw, []), { plantSlugs: [], podSlugs: [], beanSlugs: [] });
});

test("unpublishCascadeForBeans dedupes repeated bean slugs", () => {
  const raw: RawGarden = {
    pods: [mol("m1", "public")],
    beans: [atom("a1", ["pod:m1"], "public")],
    sprouts: [],
  };
  assert.deepEqual(unpublishCascadeForBeans(raw, ["a1", "a1"]), { plantSlugs: [], podSlugs: ["m1"], beanSlugs: ["a1"] });
});

test("delete-shaped: two flipped beans sharing one pod list it once", () => {
  const raw: RawGarden = {
    pods: [mol("m1", "public")],
    beans: [atom("a1", ["pod:m1"], "public"), atom("a2", ["pod:m1"], "public")],
    sprouts: [], // the deleted version was the only version of both atoms
  };
  const r = unpublishCascadeForBeans(raw, ["a1", "a2"]);
  assert.deepEqual([...r.beanSlugs].sort(), ["a1", "a2"]);
  assert.deepEqual(r.podSlugs, ["m1"]);
});

test("delete-shaped: already-private flip targets are still returned (idempotent flip)", () => {
  const raw: RawGarden = {
    pods: [mol("m1", "private")],
    beans: [atom("a1", ["pod:m1"], "private")],
    sprouts: [],
  };
  assert.deepEqual(unpublishCascadeForBeans(raw, ["a1"]), { plantSlugs: [], podSlugs: ["m1"], beanSlugs: ["a1"] });
});

// --- textPart / composeText: the strict-access and compose halves of the bilingual
// Text widening (B1). textPart backs form prefills, where resolveText's fallback
// would silently copy en into the fr box (and corrupt data on save); composeText is
// the form builders' inverse, turning the paired inputs back into a Text.

test("textPart treats a plain string as the en part", () => {
  assert.equal(textPart("hello", "en"), "hello");
});

test("textPart never falls back: the fr part of a plain string is empty", () => {
  assert.equal(textPart("hello", "fr"), "");
});

test("textPart returns exactly the requested part of a localized object", () => {
  assert.equal(textPart({ en: "Hi", fr: "Salut" }, "en"), "Hi");
  assert.equal(textPart({ en: "Hi", fr: "Salut" }, "fr"), "Salut");
});

test("textPart returns empty for a missing part (no cross-language fallback)", () => {
  assert.equal(textPart({ en: "Hi" }, "fr"), "");
  assert.equal(textPart({ fr: "Salut" }, "en"), "");
});

test("textPart of an absent value is empty", () => {
  assert.equal(textPart(undefined, "en"), "");
  assert.equal(textPart(undefined, "fr"), "");
});

test("composeText with both parts blank is the empty string", () => {
  assert.equal(composeText("", ""), "");
  assert.equal(composeText("  ", " "), "");
});

test("composeText keeps en-only content a plain string (trimmed)", () => {
  assert.equal(composeText("Hi", ""), "Hi");
  assert.equal(composeText(" Hi ", "  "), "Hi");
});

test("composeText builds a localized object when fr is present", () => {
  assert.deepEqual(composeText("Hi", "Salut"), { en: "Hi", fr: "Salut" });
});

test("composeText omits a blank en from the object", () => {
  const t = composeText("", "Salut");
  assert.deepEqual(t, { fr: "Salut" });
  assert.equal(typeof t === "object" && "en" in t, false, "blank en must be omitted, not empty");
});

test("adapter equivalence: unpublishCascade(slug) === unpublishCascadeForBeans(that sprout's bean refs)", () => {
  const raw: RawGarden = {
    pods: [mol("m1", "public"), mol("m2", "public")],
    beans: [atom("a1", ["pod:m1"], "public"), atom("a2", ["pod:m2"], "public")],
    sprouts: [ver("v1", ["bean:a1", "bean:a2", "bean:ghost"], "draft"), ver("v2", ["bean:a2"], "published")],
  };
  assert.deepEqual(
    unpublishCascade(raw, "v1"),
    unpublishCascadeForBeans(raw, ["a1", "a2", "ghost"]),
  );
});

// --- Plant tier (slice 1 PR2): containment one tier up. ---

const PLANTED: RawGarden = {
  plants: [
    { slug: "bohns-music", name: "Bohns Music", natures: ["work"], description: "" },
    { slug: "pbbls", name: "Pebbles", natures: ["work"], description: "" },
  ],
  pods: [
    { slug: "celesta", name: "Celesta", description: "", parents: ["plant:bohns-music"] },
    { slug: "orphan-pod", name: "Orphan", description: "", parents: ["plant:ghost"] },
  ],
  beans: [
    { slug: "felina", name: "Felina", parents: ["pod:celesta"] },
    { slug: "pbbls-webapp", name: "Webapp", parents: ["plant:pbbls"] },
    { slug: "loose", name: "Loose", parents: [] },
  ],
  sprouts: [
    { slug: "felina-0", name: "F0", type: "song", date: "2026-01-01", description: "", parents: ["bean:felina"] },
    { slug: "webapp-0", name: "W0", type: "feature", date: "2026-01-02", description: "", parents: ["bean:pbbls-webapp"] },
  ],
};

test("buildDataset exposes plants, pods-per-plant and unrooted pods", () => {
  const d = buildDataset(PLANTED);
  assert.deepEqual(d.getPlants().map((p) => p.slug), ["bohns-music", "pbbls"]);
  assert.deepEqual(d.podsForPlant("bohns-music").map((p) => p.slug), ["celesta"]);
  assert.deepEqual(d.unrootedPods().map((p) => p.slug), ["orphan-pod"]); // dangling plant ref = unrooted
});

test("buildDataset treats a bean parented directly to a plant as first-class, not standalone", () => {
  const d = buildDataset(PLANTED);
  assert.deepEqual(d.beansForPlant("pbbls").map((b) => b.slug), ["pbbls-webapp"]);
  assert.deepEqual(d.standaloneBeans().map((b) => b.slug), ["loose"]);
});

test("plantForBean resolves via the pod chain, direct plant parents winning over the pod route", () => {
  const d = buildDataset(PLANTED);
  assert.equal(d.plantForBean("felina")?.slug, "bohns-music"); // bean -> pod -> plant
  assert.equal(d.plantForBean("pbbls-webapp")?.slug, "pbbls"); // bean -> plant direct
  assert.equal(d.plantForBean("loose"), null);
  const both = buildDataset({
    ...PLANTED,
    beans: [{ slug: "b", name: "B", parents: ["pod:celesta", "plant:pbbls"] }],
  });
  assert.equal(both.plantForBean("b")?.slug, "pbbls"); // direct wins
});

test("timelineSprouts carries the resolved plant on each entry", () => {
  const d = buildDataset(PLANTED);
  const byslug = new Map(d.timelineSprouts().map((e) => [e.sprout.slug, e]));
  assert.equal(byslug.get("felina-0")?.plant?.slug, "bohns-music");
  assert.equal(byslug.get("webapp-0")?.plant?.slug, "pbbls");
});

test("garden.yml parses into a garden with only botanical prefixes", () => {
  const file = readFileSync(join(process.cwd(), "data", "garden.yml"), "utf8");
  const raw = yaml.load(file, { schema: yaml.CORE_SCHEMA }) as RawGarden;
  assert.ok((raw.pods ?? []).length > 0);
  const refs = [
    ...(raw.beans ?? []).flatMap((b) => b.parents ?? []),
    ...(raw.sprouts ?? []).flatMap((s) => [
      ...(s.parents ?? []),
      ...(s.relations ?? []).map((r) => r.ref),
    ]),
  ];
  assert.ok(refs.length > 0);
  for (const ref of refs) {
    assert.match(ref, /^(pod|bean|sprout):/, `legacy prefix survived: ${ref}`);
  }
});

// --- Cascades one tier up (PR2). Same idempotent-flip, dangling-tolerant rules. ---

const CASCADE_GARDEN: RawGarden = {
  plants: [
    { slug: "pl1", name: "P1", natures: ["work"], description: "" },
    { slug: "pl2", name: "P2", natures: ["work"], description: "" },
  ],
  pods: [{ slug: "m1", name: "M1", description: "", parents: ["plant:pl1", "plant:ghost"] }],
  beans: [
    { slug: "a1", name: "A1", parents: ["pod:m1"] },
    { slug: "direct", name: "D", parents: ["plant:pl2"] },
  ],
  sprouts: [
    { slug: "v1", name: "V1", type: "t", date: "2026-01-01", description: "", parents: ["bean:a1"], state: "published" },
    { slug: "v-direct", name: "VD", type: "t", date: "2026-01-02", description: "", parents: ["bean:direct"], state: "published" },
  ],
};

test("publishCascade climbs pod -> plant, ignoring dangling plant refs", () => {
  assert.deepEqual(publishCascade(CASCADE_GARDEN, "v1"), {
    plantSlugs: ["pl1"],
    podSlugs: ["m1"],
    beanSlugs: ["a1"],
  });
});

test("publishCascade climbs a bean's DIRECT plant parent (no pod tier)", () => {
  assert.deepEqual(publishCascade(CASCADE_GARDEN, "v-direct"), {
    plantSlugs: ["pl2"],
    podSlugs: [],
    beanSlugs: ["direct"],
  });
});

test("unpublishCascade flips the whole lineage up to the plant when nothing shelters it", () => {
  const raw = structuredClone(CASCADE_GARDEN);
  raw.sprouts![0].state = "draft"; // v1 just un-published
  const r = unpublishCascade(raw, "v1");
  assert.deepEqual(r, { plantSlugs: ["pl1"], podSlugs: ["m1"], beanSlugs: ["a1"] });
});

test("unpublishCascade honors a plant sheltered by a surviving public pod", () => {
  const raw = structuredClone(CASCADE_GARDEN);
  raw.pods!.push({ slug: "m2", name: "M2", description: "", parents: ["plant:pl1"] });
  raw.beans!.push({ slug: "a2", name: "A2", parents: ["pod:m2"] });
  raw.sprouts![0].state = "draft";
  const r = unpublishCascade(raw, "v1");
  // m2 is public (default) and points at pl1 -> the plant is sheltered.
  assert.deepEqual(r, { plantSlugs: [], podSlugs: ["m1"], beanSlugs: ["a1"] });
});

test("unpublishCascade honors a plant sheltered by a surviving public DIRECT bean", () => {
  const raw: RawGarden = {
    plants: [{ slug: "pl", name: "P", natures: ["work"], description: "" }],
    pods: [],
    beans: [
      { slug: "flipping", name: "F", parents: ["plant:pl"] },
      { slug: "shelter", name: "S", parents: ["plant:pl"] },
    ],
    sprouts: [{ slug: "v", name: "V", type: "t", date: "2026-01-01", description: "", parents: ["bean:flipping"], state: "draft" }],
  };
  assert.deepEqual(unpublishCascade(raw, "v"), { plantSlugs: [], podSlugs: [], beanSlugs: ["flipping"] });
});

test("unpublishCascade flips a plant reached only through a directly-parented bean", () => {
  const raw: RawGarden = {
    plants: [{ slug: "pl", name: "P", natures: ["work"], description: "" }],
    pods: [],
    beans: [{ slug: "b", name: "B", parents: ["plant:pl"] }],
    sprouts: [{ slug: "v", name: "V", type: "t", date: "2026-01-01", description: "", parents: ["bean:b"], state: "draft" }],
  };
  assert.deepEqual(unpublishCascade(raw, "v"), { plantSlugs: ["pl"], podSlugs: [], beanSlugs: ["b"] });
});

test("an explicitly-private pod does not shelter a plant", () => {
  const raw = structuredClone(CASCADE_GARDEN);
  raw.pods!.push({ slug: "m2", name: "M2", description: "", parents: ["plant:pl1"], visibility: "private" });
  raw.beans!.push({ slug: "a2", name: "A2", parents: ["pod:m2"] });
  raw.sprouts![0].state = "draft";
  const r = unpublishCascade(raw, "v1");
  // m2 points at pl1 but is private -> no shelter; the plant flips with its lineage.
  assert.deepEqual(r, { plantSlugs: ["pl1"], podSlugs: ["m1"], beanSlugs: ["a1"] });
});

test("an explicitly-private direct bean does not shelter a plant", () => {
  const raw: RawGarden = {
    plants: [{ slug: "pl", name: "P", natures: ["work"], description: "" }],
    pods: [],
    beans: [
      { slug: "flipping", name: "F", parents: ["plant:pl"] },
      { slug: "shelter", name: "S", parents: ["plant:pl"], visibility: "private" },
    ],
    sprouts: [{ slug: "v", name: "V", type: "t", date: "2026-01-01", description: "", parents: ["bean:flipping"], state: "draft" }],
  };
  assert.deepEqual(unpublishCascade(raw, "v"), { plantSlugs: ["pl"], podSlugs: [], beanSlugs: ["flipping"] });
});
