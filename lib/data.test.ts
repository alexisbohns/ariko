import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import assert from "node:assert/strict";
import {
  buildDataset,
  composeText,
  filterPublic,
  getDataset,
  hasNarrative,
  publishCascade,
  resolveSproutPlant,
  resolveSproutPlants,
  textPart,
  type RawGarden,
} from "./data";

// Synthetic seed exercising every edge case the directory/timeline must handle:
// multi-parent beans, standalone beans, dangling pod refs, and a sprout whose
// bean has no pod.
const raw: RawGarden = {
  pods: [
    { slug: "m-music", name: "Music Mol", description: "" },
    { slug: "m-design", name: "Design Mol", description: "" },
  ],
  beans: [
    { slug: "a1", name: "A1", parents: ["pod:m-music"] },
    { slug: "a2", name: "A2", parents: ["pod:m-music", "pod:m-design"] },
    { slug: "a-standalone", name: "Lonely", parents: [] },
    { slug: "a-dangling", name: "Dangling", parents: ["pod:nope"] },
  ],
  sprouts: [
    { slug: "v-old", name: "Old", kind: "milestone", date: "2020-01-01", description: "", about: ["bean:a1"] },
    { slug: "v-new", name: "New", kind: "milestone", date: "2026-01-01", description: "", about: ["bean:a1"] },
    { slug: "v-mid", name: "Mid", kind: "milestone", date: "2023-06-15", description: "", about: ["bean:a1"] },
    { slug: "v-orphan", name: "Orphan", kind: "log", date: "2024-01-01", description: "", about: ["bean:a-standalone"] },
  ],
};

test("timelineSprouts sorts all sprouts by date descending", () => {
  const ds = buildDataset(raw);
  const slugs = ds.timelineSprouts().map((e) => e.sprout.slug);
  assert.deepEqual(slugs, ["v-new", "v-orphan", "v-mid", "v-old"]);
});

test("timeline entries tag each sprout with its bean", () => {
  const ds = buildDataset(raw);
  const bySlug = new Map(ds.timelineSprouts().map((e) => [e.sprout.slug, e]));

  const vNew = bySlug.get("v-new")!;
  assert.equal(vNew.bean?.slug, "a1");

  const vOrphan = bySlug.get("v-orphan")!;
  assert.equal(vOrphan.bean?.slug, "a-standalone");
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

// --- publishCascade: upward to the DERIVED plant, and nothing else (spec
// 2026-10-10 §2). There is no unpublish cascade any more.

const cascade: RawGarden = {
  plants: [
    { slug: "p1", name: "P", natures: ["work"], role: { kind: "owner" }, description: "", visibility: "private" },
    { slug: "p2", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" },
  ],
  pods: [{ slug: "pod", name: "Pod", description: "", parents: ["plant:p1"], visibility: "private" }],
  beans: [
    { slug: "b", name: "B", parents: ["pod:pod"], visibility: "private" },
    { slug: "b2", name: "B", parents: ["plant:p2"] },
  ],
  sprouts: [
    { slug: "s", name: "S", kind: "log", date: "2026-01-01", description: "", about: ["bean:b"] },
    { slug: "s-plant", name: "S", kind: "log", date: "2026-01-02", description: "", parents: ["plant:p1"] },
    { slug: "s-two", name: "S", kind: "log", date: "2026-01-03", description: "", about: ["bean:b", "bean:b2"] },
    { slug: "s-dangling", name: "S", kind: "log", date: "2026-01-04", description: "", about: ["bean:nope"] },
  ],
};

test("publishCascade names the sprout's DERIVED plant and nothing else — the bean and pod stay as they are", () => {
  assert.deepEqual(publishCascade(cascade, "s"), { plantSlugs: ["p1"] });
  assert.deepEqual(publishCascade(cascade, "s-plant"), { plantSlugs: ["p1"] });
});

test("publishCascade is idempotent — the plant is named regardless of its current visibility", () => {
  assert.deepEqual(publishCascade(cascade, "s-two" /* ambiguous */), { plantSlugs: [] });
  assert.deepEqual(publishCascade(cascade, "s-dangling"), { plantSlugs: [] });
  assert.deepEqual(publishCascade(cascade, "unknown"), { plantSlugs: [] });
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

test("hasNarrative is true for an English-only string, exactly as before French was writable", () => {
  assert.equal(hasNarrative("hello"), true);
});

test("hasNarrative is true for an fr-only object — a narrative can now exist as { fr } alone", () => {
  assert.equal(hasNarrative({ fr: "Salut" }), true);
});

test("hasNarrative is true when either half is non-blank, false only when both are", () => {
  assert.equal(hasNarrative({ en: "Hi", fr: "" }), true);
  assert.equal(hasNarrative({ en: "", fr: "Salut" }), true);
  assert.equal(hasNarrative({ en: "  ", fr: "  " }), false);
  assert.equal(hasNarrative(undefined), false);
  assert.equal(hasNarrative(""), false);
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

// --- Plant tier (slice 1 PR2): containment one tier up. ---

const PLANTED: RawGarden = {
  plants: [
    { slug: "bohns-music", name: "Bohns Music", natures: ["work"], role: { kind: "owner" as const }, description: "" },
    { slug: "pbbls", name: "Pebbles", natures: ["work"], role: { kind: "owner" as const }, description: "" },
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
    { slug: "felina-0", name: "F0", kind: "milestone", date: "2026-01-01", description: "", about: ["bean:felina"] },
    { slug: "webapp-0", name: "W0", kind: "milestone", date: "2026-01-02", description: "", about: ["bean:pbbls-webapp"] },
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
    ...(raw.pods ?? []).flatMap((p) => p.parents ?? []),
    ...(raw.beans ?? []).flatMap((b) => b.parents ?? []),
    ...(raw.plants ?? []).flatMap((p) => (p.relations ?? []).map((r) => r.ref)),
    ...(raw.sprouts ?? []).flatMap((s) => [
      ...(s.parents ?? []),
      ...(s.relations ?? []).map((r) => r.ref),
    ]),
  ];
  assert.ok(refs.length > 0);
  for (const ref of refs) {
    assert.match(ref, /^(plant|pod|bean|sprout):/, `legacy prefix survived: ${ref}`);
  }
});

test("getPlant and getPod look a container up by slug", () => {
  const data = buildDataset({
    plants: [{ slug: "p", name: "P", natures: ["work"], role: { kind: "owner" as const }, description: "" }],
    pods: [{ slug: "m", name: "M", description: "", parents: ["plant:p"] }],
  });
  assert.equal(data.getPlant("p")?.slug, "p");
  assert.equal(data.getPod("m")?.slug, "m");
  assert.equal(data.getPlant("ghost"), undefined);
  assert.equal(data.getPod("ghost"), undefined);
});

test("filterPublic keeps links on a public plant and drops them with a private one", () => {
  const raw: RawGarden = {
    plants: [
      {
        slug: "casa",
        name: "CASA Podcast",
        natures: ["work" as const],
        role: { kind: "owner" as const },
        description: "A podcast",
        links: [{ platform: "spotify", url: "https://open.spotify.com/show/abc" }],
      },
      {
        slug: "hidden",
        name: "Hidden",
        natures: ["work" as const],
        role: { kind: "owner" as const },
        description: "Nope",
        visibility: "private" as const,
        links: [{ platform: "spotify", url: "https://open.spotify.com/show/secret" }],
      },
    ],
  };

  const out = filterPublic(raw);

  assert.equal(out.plants?.length, 1);
  // PlatformLink carries no entity refs, so there is nothing to scrub — the
  // array must survive intact rather than be dropped defensively.
  assert.deepEqual(out.plants?.[0].links, [
    { platform: "spotify", url: "https://open.spotify.com/show/abc" },
  ]);
  // And the private plant takes its links with it.
  assert.equal(JSON.stringify(out).includes("secret"), false);
});

// --- The exhibition (the gallery slice): buildDataset's one screen accessor.

const EXHIBIT_IMAGE = {
  kind: "image" as const,
  storageKey: "beanstalk/x",
  url: "https://res.cloudinary.com/x/x.png",
  width: 1179,
  height: 2556,
};

const EXHIBITED: RawGarden = {
  plants: [
    { slug: "pl", name: "Plant", natures: ["work"], role: { kind: "owner" }, description: "" },
    { slug: "pl-other", name: "Other", natures: ["work"], role: { kind: "owner" }, description: "" },
  ],
  screens: [
    { slug: "s-second", name: "Second", image: EXHIBIT_IMAGE, parents: ["plant:pl"], exhibited: true, order: 1 },
    { slug: "s-first", name: "First", image: EXHIBIT_IMAGE, parents: ["plant:pl"], exhibited: true, order: 0 },
    { slug: "s-unordered", name: "Unordered", image: EXHIBIT_IMAGE, parents: ["plant:pl"], exhibited: true },
    { slug: "s-stored", name: "Stored", image: EXHIBIT_IMAGE, parents: ["plant:pl"] },
    { slug: "s-elsewhere", name: "Elsewhere", image: EXHIBIT_IMAGE, parents: ["plant:pl-other"], exhibited: true, order: 0 },
    { slug: "s-dangling", name: "Dangling", image: EXHIBIT_IMAGE, parents: ["plant:ghost"], exhibited: true, order: 0 },
    { slug: "s-shared", name: "Shared", image: EXHIBIT_IMAGE, parents: ["plant:pl", "plant:pl-other"], exhibited: true, order: 9 },
  ],
};

test("exhibitionForPlant returns the plant's exhibited screens, in order", () => {
  const d = buildDataset(EXHIBITED);
  assert.deepEqual(d.exhibitionForPlant("pl").map((s) => s.slug), [
    "s-first",
    "s-second",
    "s-shared",
    "s-unordered",
  ]);
});

test("exhibitionForPlant omits a stored screen that was never exhibited", () => {
  // Storing a screen is not publishing it: the store holds a hundred and
  // seventy and the strip shows the handful marked for it.
  const d = buildDataset(EXHIBITED);
  assert.equal(d.exhibitionForPlant("pl").some((s) => s.slug === "s-stored"), false);
});

test("exhibitionForPlant does not borrow another plant's screens", () => {
  const d = buildDataset(EXHIBITED);
  assert.equal(d.exhibitionForPlant("pl").some((s) => s.slug === "s-elsewhere"), false);
  assert.deepEqual(d.exhibitionForPlant("pl-other").map((s) => s.slug), ["s-elsewhere", "s-shared"]);
});

test("exhibitionForPlant ignores a screen whose plant parent does not resolve", () => {
  // Same rule podsByPlant/beansByPlant already follow: only resolvable refs
  // index. A dangling screen survives filterPublic as standalone and simply
  // has no page to appear on.
  const d = buildDataset(EXHIBITED);
  assert.deepEqual(d.exhibitionForPlant("ghost"), []);
});

test("exhibitionForPlant is empty for a slug that names no plant", () => {
  // Pins the `?? []` fallback: "nobody" is not a plant in EXHIBITED at all,
  // as distinct from a plant that merely has no screens.
  const d = buildDataset(EXHIBITED);
  assert.deepEqual(d.exhibitionForPlant("nobody"), []);
});

test("exhibitionForPlant lets a screen with two plant parents appear in both strips", () => {
  // The index's inner loop over parentsWithPrefix exists exactly for this: a
  // refactor to `parents.find(...)` (taking only the first resolvable plant)
  // would pass the rest of this suite, since no other fixture screen has two
  // plant parents.
  const d = buildDataset(EXHIBITED);
  assert.equal(d.exhibitionForPlant("pl").some((s) => s.slug === "s-shared"), true);
  assert.equal(d.exhibitionForPlant("pl-other").some((s) => s.slug === "s-shared"), true);
});

// --- The journal model (spec 2026-10-10 §1.2): a sprout's plant is DERIVED
// from `about`, and the dataset indexes entries by bean, pod and plant.

const derivation: RawGarden = {
  plants: [
    { slug: "p1", name: "P1", natures: ["work"], role: { kind: "owner" }, description: "" },
    { slug: "p2", name: "P2", natures: ["work"], role: { kind: "owner" }, description: "" },
  ],
  pods: [
    { slug: "pod1", name: "Pod 1", description: "", parents: ["plant:p1"] },
    { slug: "pod2", name: "Pod 2", description: "", parents: ["plant:p2"] },
    { slug: "unrooted", name: "Unrooted", description: "", parents: [] },
  ],
  beans: [
    { slug: "b-in-pod", name: "B", parents: ["pod:pod1"] },
    { slug: "b-direct", name: "B", parents: ["plant:p1"] },
    { slug: "b-other", name: "B", parents: ["pod:pod2"] },
    { slug: "b-orphan", name: "B", parents: ["pod:unrooted"] },
  ],
  sprouts: [],
};

test("resolveSproutPlants follows bean → pod → plant and bean → plant", () => {
  assert.deepEqual(resolveSproutPlants({ about: ["bean:b-in-pod"] }, derivation).map((p) => p.slug), ["p1"]);
  assert.deepEqual(resolveSproutPlants({ about: ["bean:b-direct"] }, derivation).map((p) => p.slug), ["p1"]);
  assert.deepEqual(resolveSproutPlants({ about: ["pod:pod2"] }, derivation).map((p) => p.slug), ["p2"]);
});

test("two refs under one plant resolve to that plant once; refs under two plants list both", () => {
  assert.deepEqual(
    resolveSproutPlants({ about: ["bean:b-in-pod", "bean:b-direct", "pod:pod1"] }, derivation).map((p) => p.slug),
    ["p1"],
  );
  assert.deepEqual(
    resolveSproutPlants({ about: ["bean:b-in-pod", "bean:b-other"] }, derivation).map((p) => p.slug),
    ["p1", "p2"],
  );
});

test("dangling and unrooted refs contribute nothing", () => {
  assert.deepEqual(resolveSproutPlants({ about: ["bean:nope", "pod:nope"] }, derivation), []);
  assert.deepEqual(resolveSproutPlants({ about: ["bean:b-orphan"] }, derivation), []);
});

test("with about empty, the sprout's own plant parent is the plant; with about present, parents are ignored", () => {
  assert.deepEqual(resolveSproutPlants({ parents: ["plant:p2"] }, derivation).map((p) => p.slug), ["p2"]);
  assert.deepEqual(resolveSproutPlants({ about: [], parents: ["plant:p2"] }, derivation).map((p) => p.slug), ["p2"]);
  assert.deepEqual(
    resolveSproutPlants({ about: ["bean:b-in-pod"], parents: ["plant:p2"] }, derivation).map((p) => p.slug),
    ["p1"],
  );
  assert.deepEqual(resolveSproutPlants({ parents: ["plant:nope"] }, derivation), []);
  assert.deepEqual(resolveSproutPlants({}, derivation), []);
});

test("a non-array about (a direct DB write) reads as no refs, in the derivation and in the dataset", () => {
  // aboutRefs is the ONE door both read the field through: a malformed doc
  // must not throw on every read, and must not be mistaken for an anchor.
  const junk = { about: "bean:b-in-pod" as unknown as string[] };
  assert.deepEqual(resolveSproutPlants(junk, derivation), []);
  const ds = buildDataset({
    ...derivation,
    sprouts: [{ slug: "junk", name: "S", kind: "log", date: "2026-01-01", description: "", ...junk }],
  });
  assert.deepEqual(ds.sproutsForBean("b-in-pod"), []);
  assert.equal(ds.timelineSprouts()[0]?.plant, null);
});

test("resolveSproutPlant is the derivation when it names exactly one plant, else null (fail-closed)", () => {
  assert.equal(resolveSproutPlant({ about: ["bean:b-in-pod"] }, derivation)?.slug, "p1");
  assert.equal(resolveSproutPlant({ about: ["bean:b-in-pod", "bean:b-other"] }, derivation), null);
  assert.equal(resolveSproutPlant({ about: ["bean:nope"] }, derivation), null);
});

test("a bean moved to another pod moves its sprouts with it", () => {
  const sprout = { about: ["bean:b-in-pod"] };
  assert.equal(resolveSproutPlant(sprout, derivation)?.slug, "p1");
  const moved: RawGarden = {
    ...derivation,
    beans: derivation.beans!.map((b) => (b.slug === "b-in-pod" ? { ...b, parents: ["pod:pod2"] } : b)),
  };
  assert.equal(resolveSproutPlant(sprout, moved)?.slug, "p2");
});

const journal: RawGarden = {
  ...derivation,
  sprouts: [
    { slug: "s-bean", name: "S", kind: "log", date: "2026-01-03", description: "", about: ["bean:b-in-pod"] },
    { slug: "s-pod", name: "S", kind: "log", date: "2026-01-02", description: "", about: ["pod:pod1"] },
    { slug: "s-plant", name: "S", kind: "log", date: "2026-01-04", description: "", parents: ["plant:p1"] },
    { slug: "s-other", name: "S", kind: "log", date: "2026-01-01", description: "", about: ["bean:b-other"] },
    { slug: "s-two", name: "S", kind: "log", date: "2026-01-05", description: "", about: ["bean:b-in-pod", "bean:b-direct"] },
  ],
};

test("sproutsForBean lists the sprouts about that bean, newest first", () => {
  const ds = buildDataset(journal);
  assert.deepEqual(ds.sproutsForBean("b-in-pod").map((s) => s.slug), ["s-two", "s-bean"]);
  assert.deepEqual(ds.sproutsForBean("b-direct").map((s) => s.slug), ["s-two"]);
  assert.deepEqual(ds.sproutsForBean("nope"), []);
});

test("sproutsForPod lists sprouts about the pod OR about a bean inside it, newest first, once each", () => {
  const ds = buildDataset(journal);
  assert.deepEqual(ds.sproutsForPod("pod1").map((s) => s.slug), ["s-two", "s-bean", "s-pod"]);
  assert.deepEqual(ds.sproutsForPod("pod2").map((s) => s.slug), ["s-other"]);
});

test("sproutsForPlant lists every sprout whose DERIVED plant is this one, newest first", () => {
  const ds = buildDataset(journal);
  assert.deepEqual(ds.sproutsForPlant("p1").map((s) => s.slug), ["s-two", "s-plant", "s-bean", "s-pod"]);
  assert.deepEqual(ds.sproutsForPlant("p2").map((s) => s.slug), ["s-other"]);
});

test("timeline entries carry the first about-bean (or null) and the derived plant", () => {
  const byslug = new Map(buildDataset(journal).timelineSprouts().map((e) => [e.sprout.slug, e]));
  assert.equal(byslug.get("s-bean")!.bean?.slug, "b-in-pod");
  assert.equal(byslug.get("s-bean")!.plant?.slug, "p1");
  assert.equal(byslug.get("s-pod")!.bean, null);
  assert.equal(byslug.get("s-pod")!.plant?.slug, "p1");
  assert.equal(byslug.get("s-plant")!.bean, null);
  assert.equal(byslug.get("s-plant")!.plant?.slug, "p1");
});
