import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDataset, filterPublic, resolveText, type RawGarden } from "./data";

test("resolveText returns plain strings unchanged", () => {
  assert.equal(resolveText("hello"), "hello");
});

test("resolveText picks the requested language, falling back to en then fr", () => {
  assert.equal(resolveText({ en: "Hi", fr: "Salut" }, "fr"), "Salut");
  assert.equal(resolveText({ en: "Hi" }, "fr"), "Hi");
  assert.equal(resolveText({ fr: "Salut" }, "en"), "Salut");
  assert.equal(resolveText(undefined), "");
});

test("resolveText falls through blank parts (a hand-authored empty en never blanks the name)", () => {
  assert.equal(resolveText({ en: "", fr: "Nom" }, "en"), "Nom");
  assert.equal(resolveText({ en: "Hi", fr: "" }, "fr"), "Hi");
  assert.equal(resolveText({ en: "", fr: "" }), "");
});

// Every fixture that expects a sprout to SURVIVE roots it under a public plant:
// a sprout's plant is derived from its `about` (spec 2026-10-10 §1.2), and one
// whose refs roll up to no plant drops, fail-closed.
const raw: RawGarden = {
  plants: [{ slug: "pl", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" }],
  pods: [
    { slug: "m-pub", name: "Pub", description: "", parents: ["plant:pl"] },
    { slug: "m-priv", name: "Priv", description: "", visibility: "private", parents: ["plant:pl"] },
  ],
  beans: [
    { slug: "a-pub", name: "A pub", parents: ["pod:m-pub"] },
    { slug: "a-priv", name: "A priv", parents: ["pod:m-pub"], visibility: "private" },
  ],
  sprouts: [
    { slug: "v-published", name: "Published", kind: "milestone", date: "2026-01-01", description: "", about: ["bean:a-pub"], state: "published" },
    { slug: "v-draft", name: "Draft", kind: "milestone", date: "2026-01-02", description: "", about: ["bean:a-pub"], state: "draft" },
    { slug: "v-private", name: "Private", kind: "milestone", date: "2026-01-03", description: "", about: ["bean:a-pub"], state: "private" },
    { slug: "v-nostate", name: "No state", kind: "milestone", date: "2026-01-04", description: "", about: ["bean:a-pub"] },
  ],
};

test("filterPublic keeps only published sprouts", () => {
  const slugs = (filterPublic(raw).sprouts ?? []).map((v) => v.slug);
  assert.deepEqual(slugs, ["v-published"]);
});

test("filterPublic drops private pods and beans, keeps the rest", () => {
  const out = filterPublic(raw);
  assert.deepEqual((out.pods ?? []).map((m) => m.slug), ["m-pub"]);
  assert.deepEqual((out.beans ?? []).map((a) => a.slug), ["a-pub"]);
});

test("filterPublic never leaks a draft, private, or stateless sprout", () => {
  const slugs = new Set((filterPublic(raw).sprouts ?? []).map((v) => v.slug));
  for (const leaked of ["v-draft", "v-private", "v-nostate"]) {
    assert.equal(slugs.has(leaked), false, `${leaked} must not be public`);
  }
});

// Under the journal model a private bean no longer takes its sprouts with it —
// a published sprout about a private bean under a PUBLIC plant is kept with
// the door scrubbed (see the `about` tests below). With no plant anywhere, the
// sprout's refs roll up to nothing and it drops, fail-closed.
test("filterPublic drops a published sprout about a private bean that rolls up to no plant", () => {
  const seed: RawGarden = {
    pods: [{ slug: "m", name: "M", description: "" }],
    beans: [{ slug: "a-priv", name: "A", parents: ["pod:m"], visibility: "private" }],
    sprouts: [{ slug: "v", name: "V", kind: "milestone", date: "2026-01-01", description: "", about: ["bean:a-priv"], state: "published" }],
  };
  const out = filterPublic(seed);
  assert.deepEqual((out.beans ?? []).map((a) => a.slug), []);
  assert.deepEqual((out.sprouts ?? []).map((v) => v.slug), []);
});

test("filterPublic drops an bean whose only pod-parent is private (no standalone leak)", () => {
  const seed: RawGarden = {
    pods: [{ slug: "m-priv", name: "M", description: "", visibility: "private" }],
    beans: [{ slug: "a", name: "A", parents: ["pod:m-priv"] }],
    sprouts: [],
  };
  const out = filterPublic(seed);
  assert.deepEqual((out.pods ?? []).map((m) => m.slug), []);
  assert.deepEqual((out.beans ?? []).map((a) => a.slug), []);
});

test("filterPublic drops a published sprout whose bean is cascaded out and rolls up to no plant", () => {
  const seed: RawGarden = {
    pods: [{ slug: "m-priv", name: "M", description: "", visibility: "private" }],
    beans: [{ slug: "a", name: "A", parents: ["pod:m-priv"] }],
    sprouts: [{ slug: "v", name: "V", kind: "milestone", date: "2026-01-01", description: "", about: ["bean:a"], state: "published" }],
  };
  assert.deepEqual((filterPublic(seed).sprouts ?? []).map((v) => v.slug), []);
});

test("filterPublic keeps a multi-parent bean if at least one pod-parent is public", () => {
  const seed: RawGarden = {
    pods: [
      { slug: "m-pub", name: "Pub", description: "" },
      { slug: "m-priv", name: "Priv", description: "", visibility: "private" },
    ],
    beans: [{ slug: "a", name: "A", parents: ["pod:m-priv", "pod:m-pub"] }],
    sprouts: [],
  };
  assert.deepEqual((filterPublic(seed).beans ?? []).map((a) => a.slug), ["a"]);
});

test("filterPublic keeps an bean whose only pod-parent is a dangling (nonexistent) ref", () => {
  const seed: RawGarden = {
    pods: [],
    beans: [{ slug: "a", name: "A", parents: ["pod:ghost"] }],
    sprouts: [],
  };
  assert.deepEqual((filterPublic(seed).beans ?? []).map((a) => a.slug), ["a"]);
});

// relations[] scrub matrix (G2). The projection prunes each KEPT version's
// relations to refs whose target itself survives the projection — fail-closed:
// draft/private/cascaded/dangling/unknown-prefix targets can never leak a slug.
function relSeed(): RawGarden {
  return {
    plants: [
      { slug: "rp-pub", name: "P pub", natures: ["work"], role: { kind: "owner" }, description: "" },
      { slug: "rp-priv", name: "P priv", natures: ["work"], role: { kind: "owner" }, description: "", visibility: "private" },
    ],
    pods: [
      { slug: "rm-pub", name: "M pub", description: "", parents: ["plant:rp-pub"] },
      { slug: "rm-priv", name: "M priv", description: "", visibility: "private", parents: ["plant:rp-pub"] },
    ],
    beans: [
      { slug: "ra-pub", name: "A pub", parents: ["pod:rm-pub"] },
      { slug: "ra-priv", name: "A priv", parents: ["pod:rm-pub"], visibility: "private" },
    ],
    sprouts: [
      { slug: "rv-target", name: "Target", kind: "milestone", date: "2026-01-01", description: "", about: ["bean:ra-pub"], state: "published" },
      { slug: "rv-draft", name: "Draft", kind: "milestone", date: "2026-01-02", description: "", about: ["bean:ra-pub"], state: "draft" },
      { slug: "rv-nostate", name: "No state", kind: "milestone", date: "2026-01-03", description: "", about: ["bean:ra-pub"] },
      // Published, but its derived plant is private, so it is cascaded out — a
      // relation pointing here must drop even though the target's own state is
      // "published". (A private BEAN no longer cascades: see the `about` tests.)
      { slug: "rv-under-priv", name: "Hidden", kind: "milestone", date: "2026-01-04", description: "", parents: ["plant:rp-priv"], state: "published" },
      {
        slug: "rv-main",
        name: "Main",
        kind: "milestone",
        date: "2026-01-05",
        description: "",
        about: ["bean:ra-pub"],
        state: "published",
        relations: [
          { kind: "evolves-from", ref: "sprout:rv-target" }, // kept: published sibling
          { kind: "evolves-from", ref: "sprout:rv-draft" }, // dropped: draft
          { kind: "evolves-from", ref: "sprout:rv-nostate" }, // dropped: stateless
          { kind: "evolves-from", ref: "sprout:rv-under-priv" }, // dropped: cascaded out
          { kind: "related-to", ref: "bean:ra-pub" }, // kept: public atom
          { kind: "related-to", ref: "bean:ra-priv" }, // dropped: private atom
          { kind: "featured-in", ref: "pod:rm-pub" }, // kept: public molecule
          { kind: "featured-in", ref: "pod:rm-priv" }, // dropped: private molecule
          { kind: "related-to", ref: "sprout:ghost" }, // dropped: dangling
          { kind: "related-to", ref: "seed:x" }, // dropped: unknown prefix
          { kind: "powered-by", ref: "bee:song-identifier" }, // dropped: bees are never public relation targets
        ],
      },
    ],
  };
}

test("filterPublic tolerates malformed relations fail-closed (one bad doc must not 500 the public site)", () => {
  const seed: RawGarden = {
    plants: [{ slug: "pl", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" }],
    pods: [{ slug: "m", name: "M", description: "", parents: ["plant:pl"] }],
    beans: [{ slug: "a", name: "A", parents: ["pod:m"] }],
    sprouts: [
      { slug: "v-str", name: "V", kind: "milestone", date: "2026-01-01", description: "", about: ["bean:a"], state: "published", relations: "junk" as never },
      {
        slug: "v-entries", name: "V2", kind: "milestone", date: "2026-01-02", description: "", about: ["bean:a"], state: "published",
        relations: [null, "sprout:x", { kind: "k" }, { kind: 5, ref: "bean:a" }, { kind: "ok", ref: "bean:a" }] as never,
      },
    ],
  };
  const out = filterPublic(seed); // must not throw
  const bySlug = new Map((out.sprouts ?? []).map((v) => [v.slug, v]));
  assert.deepEqual(bySlug.get("v-str")?.relations, []);
  assert.deepEqual(bySlug.get("v-entries")?.relations, [{ kind: "ok", ref: "bean:a" }]);
});

test("filterPublic scrubs relations to refs whose target survives the projection", () => {
  const out = filterPublic(relSeed());
  const main = (out.sprouts ?? []).find((v) => v.slug === "rv-main");
  assert.deepEqual(main?.relations, [
    { kind: "evolves-from", ref: "sprout:rv-target" },
    { kind: "related-to", ref: "bean:ra-pub" },
    { kind: "featured-in", ref: "pod:rm-pub" },
  ]);
});

test("filterPublic leaves an absent relations field absent (no materialized empty array)", () => {
  const out = filterPublic(relSeed());
  const target = (out.sprouts ?? []).find((v) => v.slug === "rv-target");
  assert.ok(target);
  assert.equal("relations" in target, false);
});

test("filterPublic keeps a present-but-empty relations array as-is", () => {
  const seed: RawGarden = {
    plants: [{ slug: "pl", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" }],
    pods: [],
    beans: [{ slug: "a", name: "A", parents: ["plant:pl"] }],
    sprouts: [
      { slug: "v", name: "V", kind: "milestone", date: "2026-01-01", description: "", about: ["bean:a"], state: "published", relations: [] },
    ],
  };
  assert.deepEqual((filterPublic(seed).sprouts ?? [])[0]?.relations, []);
});

test("filterPublic never mutates the input seed when scrubbing relations (pure)", () => {
  const seed = relSeed();
  const snapshot = structuredClone(seed);
  filterPublic(seed);
  assert.deepEqual(seed, snapshot);
});

// --- Plant tier (PR2): the same fail-closed rules, one tier up. ---

test("filterPublic drops a private plant and cascades out its pods, beans and sprouts", () => {
  const seed: RawGarden = {
    plants: [{ slug: "pl-priv", name: "P", natures: ["work"], role: { kind: "owner" as const }, description: "", visibility: "private" }],
    pods: [{ slug: "m", name: "M", description: "", parents: ["plant:pl-priv"] }],
    beans: [
      { slug: "a", name: "A", parents: ["pod:m"] },
      { slug: "direct", name: "D", parents: ["plant:pl-priv"] },
    ],
    sprouts: [{ slug: "v", name: "V", kind: "milestone", date: "2026-01-01", description: "", about: ["bean:a"], state: "published" }],
  };
  const out = filterPublic(seed);
  assert.deepEqual((out.plants ?? []).map((p) => p.slug), []);
  assert.deepEqual((out.pods ?? []).map((p) => p.slug), []);
  assert.deepEqual((out.beans ?? []).map((b) => b.slug), []);
  assert.deepEqual((out.sprouts ?? []).map((v) => v.slug), []);
});

test("filterPublic keeps a pod whose only plant-parent is a dangling ref (matches the pod-tier rule)", () => {
  const seed: RawGarden = {
    plants: [],
    pods: [{ slug: "m", name: "M", description: "", parents: ["plant:ghost"] }],
  };
  assert.deepEqual((filterPublic(seed).pods ?? []).map((p) => p.slug), ["m"]);
});

test("filterPublic keeps a bean sheltered by a public parent in EITHER tier", () => {
  const seed: RawGarden = {
    plants: [{ slug: "pl", name: "P", natures: ["work"], role: { kind: "owner" as const }, description: "" }],
    pods: [{ slug: "m-priv", name: "M", description: "", visibility: "private" }],
    beans: [{ slug: "a", name: "A", parents: ["pod:m-priv", "plant:pl"] }],
  };
  assert.deepEqual((filterPublic(seed).beans ?? []).map((b) => b.slug), ["a"]);
});

test("filterPublic scrubs plant relations to surviving targets, exactly like sprout relations", () => {
  const seed: RawGarden = {
    plants: [
      {
        slug: "melogram", name: "Melogram", natures: ["work", "tool"], role: { kind: "owner" as const }, description: "",
        relations: [
          { kind: "distributes", ref: "plant:bohns-music" }, // kept
          { kind: "chronicles", ref: "plant:hidden" }, // dropped: private target
          { kind: "uses", ref: "pod:ghost" }, // dropped: dangling
        ],
      },
      { slug: "bohns-music", name: "BM", natures: ["work"], role: { kind: "owner" as const }, description: "" },
      { slug: "hidden", name: "H", natures: ["tool"], role: { kind: "owner" as const }, description: "", visibility: "private" },
    ],
  };
  const melogram = (filterPublic(seed).plants ?? []).find((p) => p.slug === "melogram");
  assert.deepEqual(melogram?.relations, [{ kind: "distributes", ref: "plant:bohns-music" }]);
});

// I6: editContainerContentAction writes relations[] onto pod documents too
// (mirroring plants), but Pod had no declared field and filterPublic never
// scrubbed it — an undeclared, unscrubbed array that could point at a
// private bean. This closes the trap the same way the plant test above does.
test("filterPublic scrubs pod relations to surviving targets — a relation pointing at a private bean does not survive", () => {
  const seed: RawGarden = {
    pods: [
      {
        slug: "rm-narrative", name: "Narrative pod", description: "",
        relations: [
          { kind: "features", ref: "bean:rm-public" }, // kept
          { kind: "features", ref: "bean:rm-private" }, // dropped: private target
        ],
      },
    ],
    beans: [
      { slug: "rm-public", name: "Public bean", parents: [] },
      { slug: "rm-private", name: "Private bean", parents: [], visibility: "private" },
    ],
  };
  const pod = (filterPublic(seed).pods ?? []).find((p) => p.slug === "rm-narrative");
  assert.deepEqual(pod?.relations, [{ kind: "features", ref: "bean:rm-public" }]);
});

// A bean's narrative mirrors refs into relations[] exactly as a pod's does
// (buildContentPatch → extractRefs). Pods are scrubbed in filterPublic; a bean
// that is not would publish a private slug inside a public document.
test("filterPublic scrubs a bean's relations to refs that survive", () => {
  const raw: RawGarden = {
    plants: [
      { slug: "p", name: "P", natures: ["work" as const], role: { kind: "owner" as const }, description: "" },
    ],
    pods: [],
    beans: [
      {
        slug: "open",
        name: "Open",
        parents: ["plant:p"],
        content: "see [[bean:hidden]] and [[bean:shown]]",
        relations: [
          { kind: "mentions", ref: "bean:hidden" },
          { kind: "mentions", ref: "bean:shown" },
          { kind: "mentions", ref: "sprout:ghost" },
        ],
      },
      { slug: "hidden", name: "Hidden", parents: ["plant:p"], visibility: "private" as const },
      { slug: "shown", name: "Shown", parents: ["plant:p"] },
    ],
    sprouts: [],
    screens: [],
    bees: [],
  };
  const pub = filterPublic(raw);
  const open = pub.beans?.find((b) => b.slug === "open");
  assert.ok(open);
  assert.deepEqual(open.relations, [{ kind: "mentions", ref: "bean:shown" }]);
  assert.equal(open.content, "see [[bean:hidden]] and [[bean:shown]]");
});

// --- Screen species (the screen store): the bean's rules, with only the plant
// tier above it.
//
// Nothing public READS screens in this slice, which is exactly why the cascade
// is pinned here rather than when a reader arrives: filterPublic is the
// security boundary, and the leak these tests describe would ship silently on
// the day someone adds a gallery. They live beside the plant-tier cascade and
// scrub tests above rather than in lib/data.test.ts, because this file is where
// anyone auditing filterPublic looks.

const SCREEN_IMAGE = {
  kind: "image" as const,
  storageKey: "beanstalk/abc",
  url: "https://res.cloudinary.com/x/abc.png",
  width: 1179,
  height: 2556,
};

function screenSeed(): RawGarden {
  return {
    plants: [
      { slug: "pl-pub", name: "Public plant", natures: ["work"], role: { kind: "owner" }, description: "" },
      { slug: "pl-priv", name: "Private plant", natures: ["work"], role: { kind: "owner" }, description: "", visibility: "private" },
    ],
    pods: [],
    beans: [
      { slug: "b-pub", name: "B", parents: ["plant:pl-pub"] },
      { slug: "b-priv", name: "B priv", parents: ["plant:pl-pub"], visibility: "private" },
    ],
    sprouts: [
      { slug: "s-pub", name: "S", kind: "milestone", date: "2026-01-01", description: "", about: ["bean:b-pub"], state: "published" },
    ],
    screens: [
      { slug: "sc-private", name: "Private", image: SCREEN_IMAGE, parents: ["plant:pl-pub"], visibility: "private" },
      { slug: "sc-cascaded", name: "Cascaded", image: SCREEN_IMAGE, parents: ["plant:pl-priv"] },
      { slug: "sc-public", name: "Public", image: SCREEN_IMAGE, parents: ["plant:pl-pub"] },
      { slug: "sc-dangling", name: "Standalone", image: SCREEN_IMAGE, parents: ["plant:ghost"] },
      {
        slug: "sc-linked",
        name: "Linked",
        image: SCREEN_IMAGE,
        parents: ["plant:pl-pub"],
        relations: [
          { kind: "cover", ref: "bean:b-pub" }, // kept: public bean
          { kind: "cover", ref: "bean:b-priv" }, // dropped: private bean
          { kind: "shows", ref: "sprout:s-pub" }, // kept: published sprout
        ],
      },
    ],
  };
}

const keptScreenSlugs = (raw: RawGarden) => (filterPublic(raw).screens ?? []).map((s) => s.slug);

test("filterPublic drops an explicitly private screen", () => {
  assert.equal(keptScreenSlugs(screenSeed()).includes("sc-private"), false);
});

test("filterPublic drops a screen whose only plant parent is private", () => {
  assert.equal(keptScreenSlugs(screenSeed()).includes("sc-cascaded"), false);
});

test("filterPublic keeps a screen under a public plant", () => {
  assert.equal(keptScreenSlugs(screenSeed()).includes("sc-public"), true);
});

test("filterPublic keeps a screen whose only plant parent is a dangling ref (standalone)", () => {
  // Matches every other tier: a nonexistent parent is ignored, not fatal.
  assert.equal(keptScreenSlugs(screenSeed()).includes("sc-dangling"), true);
});

test("filterPublic scrubs screen relations to refs whose target survives the projection", () => {
  const linked = (filterPublic(screenSeed()).screens ?? []).find((s) => s.slug === "sc-linked");
  // The surviving sprout ref is not decoration: it pins that the scrub runs
  // AFTER the kept-sprout set is built. Judged any earlier, a perfectly public
  // sprout ref would drop.
  assert.deepEqual(linked?.relations, [
    { kind: "cover", ref: "bean:b-pub" },
    { kind: "shows", ref: "sprout:s-pub" },
  ]);
});

test("filterPublic never leaks a hidden screen's slug or asset URL", () => {
  const seed = screenSeed();
  seed.screens![0].image = { ...SCREEN_IMAGE, url: "https://res.cloudinary.com/x/secret.png" };
  const dumped = JSON.stringify(filterPublic(seed));
  assert.equal(dumped.includes("secret.png"), false);
  assert.equal(dumped.includes("sc-cascaded"), false);
});

test("filterPublic keeps only explicitly public bees (default is PRIVATE) and scrubs serves to kept plants", () => {
  const seed: RawGarden = {
    plants: [
      { slug: "femfolk", name: "F", natures: ["work"], role: { kind: "owner" as const }, description: "" },
      { slug: "secret", name: "S", natures: ["tool"], role: { kind: "owner" as const }, description: "", visibility: "private" },
    ],
    bees: [
      { slug: "song-identifier", name: "SI", kind: "capability", status: "live", levers: [], serves: ["plant:femfolk", "plant:secret", "plant:ghost"], description: "", visibility: "public" },
      { slug: "default-private", name: "DP", kind: "routine", status: "planned", levers: [], serves: ["plant:femfolk"], description: "" },
    ],
  };
  const out = filterPublic(seed);
  assert.deepEqual((out.bees ?? []).map((b) => b.slug), ["song-identifier"]);
  assert.deepEqual(out.bees?.[0]?.serves, ["plant:femfolk"]); // private and dangling plants scrubbed
});

test("filterPublic tolerates malformed bee serves entries fail-closed (one bad doc must not 500 the public site)", () => {
  const seed: RawGarden = {
    plants: [{ slug: "femfolk", name: "F", natures: ["work"], role: { kind: "owner" as const }, description: "" }],
    bees: [
      {
        slug: "b", name: "B", kind: "routine", status: "live", levers: [], description: "", visibility: "public",
        serves: [null, 5, "plant:femfolk"] as unknown as string[],
      },
    ],
  };
  const out = filterPublic(seed); // must not throw
  assert.deepEqual(out.bees?.[0]?.serves, ["plant:femfolk"]);
});

test("filterPublic never mutates the input when scrubbing plant relations or bee serves (pure)", () => {
  const seed: RawGarden = {
    plants: [
      {
        slug: "pl", name: "P", natures: ["work"], role: { kind: "owner" as const }, description: "",
        relations: [
          { kind: "uses", ref: "plant:other" }, // kept
          { kind: "uses", ref: "pod:ghost" }, // dropped: dangling — forces a scrub
        ],
      },
      { slug: "other", name: "O", natures: ["tool"], role: { kind: "owner" as const }, description: "" },
    ],
    bees: [
      {
        slug: "b", name: "B", kind: "routine", status: "live", levers: [], description: "", visibility: "public",
        serves: ["plant:pl", "plant:ghost"], // dangling entry forces a scrub
      },
    ],
  };
  const snapshot = structuredClone(seed);
  filterPublic(seed);
  assert.deepEqual(seed, snapshot);
});

test("the exhibition is the seam: privacy drops a screen, the opt-in selects one", () => {
  // The two halves of the rule are enforced in two places and this test is the
  // seam between them: filterPublic is the security boundary, so
  // exhibitionForPlant never re-checks visibility — a second copy of a security
  // check would be a second behaviour.
  //
  // Both halves are asserted, and that is the point. Pinning only the private
  // screen's absence would pass just as well against an accessor that always
  // returned nothing, so the test would survive the thing it exists to protect
  // being deleted.
  const seed = screenSeed();
  seed.screens![0] = { ...seed.screens![0], exhibited: true, order: 0 }; // sc-private
  seed.screens![1] = { ...seed.screens![1], exhibited: true, order: 0 }; // sc-cascaded
  seed.screens![2] = { ...seed.screens![2], exhibited: true, order: 1 }; // sc-public

  const d = buildDataset(filterPublic(seed));

  // The explicitly private screen is gone; the public one is there. Only
  // filterPublic can tell those two apart.
  assert.deepEqual(d.exhibitionForPlant("pl-pub").map((s) => s.slug), ["sc-public"]);

  // And the cascade half, which is defended twice over: filterPublic drops a
  // screen whose only plant parent was filtered out, AND buildDataset's index
  // refuses to file one under a plant that is not in the garden it was handed.
  assert.deepEqual(d.exhibitionForPlant("pl-priv"), []);
});

// --- The journal model (spec 2026-10-10 §2): a sprout's plant is DERIVED from
// its `about`, the derivation decides whether it survives, and `about` is
// scrubbed like `relations`.

test("filterPublic keeps a published sprout whose DERIVED plant is public, through a bean or a pod", () => {
  const seed: RawGarden = {
    plants: [{ slug: "p", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" }],
    pods: [{ slug: "pod", name: "Pod", description: "", parents: ["plant:p"] }],
    beans: [{ slug: "b", name: "B", parents: ["pod:pod"] }],
    sprouts: [
      { slug: "via-bean", name: "S", kind: "log", date: "2026-01-01", description: "", about: ["bean:b"], state: "published" },
      { slug: "via-pod", name: "S", kind: "log", date: "2026-01-02", description: "", about: ["pod:pod"], state: "published" },
      { slug: "plant-level", name: "S", kind: "log", date: "2026-01-03", description: "", parents: ["plant:p"], state: "published" },
    ],
  };
  assert.deepEqual((filterPublic(seed).sprouts ?? []).map((s) => s.slug).sort(), ["plant-level", "via-bean", "via-pod"]);
});

test("filterPublic drops a published sprout under a private plant, and one whose plant cannot be derived", () => {
  const seed: RawGarden = {
    plants: [
      { slug: "pub", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" },
      { slug: "priv", name: "P", natures: ["work"], role: { kind: "owner" }, description: "", visibility: "private" },
    ],
    pods: [{ slug: "pod-priv", name: "Pod", description: "", parents: ["plant:priv"] }],
    beans: [
      { slug: "b-priv-plant", name: "B", parents: ["pod:pod-priv"] },
      { slug: "b-pub", name: "B", parents: ["plant:pub"] },
    ],
    sprouts: [
      { slug: "under-private-plant", name: "S", kind: "log", date: "2026-01-01", description: "", about: ["bean:b-priv-plant"], state: "published" },
      { slug: "dangling", name: "S", kind: "log", date: "2026-01-02", description: "", about: ["bean:nope"], state: "published" },
      { slug: "ambiguous", name: "S", kind: "log", date: "2026-01-03", description: "", about: ["bean:b-pub", "bean:b-priv-plant"], state: "published" },
      { slug: "no-anchor", name: "S", kind: "log", date: "2026-01-04", description: "", state: "published" },
    ],
  };
  assert.deepEqual(filterPublic(seed).sprouts, []);
});

test("filterPublic keeps a sprout about a PRIVATE bean under a PUBLIC plant, and scrubs the door", () => {
  const seed: RawGarden = {
    plants: [{ slug: "p", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" }],
    pods: [{ slug: "pod", name: "Pod", description: "", parents: ["plant:p"] }],
    beans: [
      { slug: "b-pub", name: "B", parents: ["pod:pod"] },
      { slug: "b-priv", name: "B", parents: ["pod:pod"], visibility: "private" },
    ],
    sprouts: [
      { slug: "s", name: "S", kind: "log", date: "2026-01-01", description: "", about: ["bean:b-priv", "bean:b-pub", "pod:pod", "bean:gone"], state: "published" },
      { slug: "untouched", name: "S", kind: "log", date: "2026-01-02", description: "", about: ["bean:b-pub"], state: "published" },
      { slug: "no-about", name: "S", kind: "log", date: "2026-01-03", description: "", parents: ["plant:p"], state: "published" },
    ],
  };
  const out = filterPublic(seed).sprouts ?? [];
  const s = out.find((x) => x.slug === "s")!;
  assert.deepEqual(s.about, ["bean:b-pub", "pod:pod"]);
  // Pure: the input is never mutated, and an unchanged array is the SAME array.
  assert.deepEqual(seed.sprouts![0].about, ["bean:b-priv", "bean:b-pub", "pod:pod", "bean:gone"]);
  assert.equal(out.find((x) => x.slug === "untouched")!.about, seed.sprouts![1].about);
  // Absent stays absent — never materialize [].
  assert.equal("about" in out.find((x) => x.slug === "no-about")!, false);
});

test("filterPublic tolerates a malformed about from a direct DB write (non-array → [], non-strings dropped)", () => {
  const seed = {
    plants: [{ slug: "p", name: "P", natures: ["work"], role: { kind: "owner" }, description: "" }],
    beans: [{ slug: "b", name: "B", parents: ["plant:p"] }],
    sprouts: [
      { slug: "junk", name: "S", kind: "log", date: "2026-01-01", description: "", about: "bean:b", parents: ["plant:p"], state: "published" },
      { slug: "mixed", name: "S", kind: "log", date: "2026-01-02", description: "", about: ["bean:b", 7, null], state: "published" },
    ],
  } as unknown as RawGarden;
  const out = filterPublic(seed).sprouts ?? [];
  // A non-array `about` is empty for derivation purposes (parents decide) and
  // is scrubbed to [] rather than leaked as whatever string it was.
  assert.deepEqual(out.find((x) => x.slug === "junk")!.about, []);
  assert.deepEqual(out.find((x) => x.slug === "mixed")!.about, ["bean:b"]);
});
