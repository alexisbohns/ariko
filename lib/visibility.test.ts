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

const raw: RawGarden = {
  pods: [
    { slug: "m-pub", name: "Pub", description: "" },
    { slug: "m-priv", name: "Priv", description: "", visibility: "private" },
  ],
  beans: [
    { slug: "a-pub", name: "A pub", parents: ["pod:m-pub"] },
    { slug: "a-priv", name: "A priv", parents: ["pod:m-pub"], visibility: "private" },
  ],
  sprouts: [
    { slug: "v-published", name: "Published", type: "song", date: "2026-01-01", description: "", parents: ["bean:a-pub"], state: "published" },
    { slug: "v-draft", name: "Draft", type: "song", date: "2026-01-02", description: "", parents: ["bean:a-pub"], state: "draft" },
    { slug: "v-private", name: "Private", type: "song", date: "2026-01-03", description: "", parents: ["bean:a-pub"], state: "private" },
    { slug: "v-nostate", name: "No state", type: "song", date: "2026-01-04", description: "", parents: ["bean:a-pub"] },
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

test("filterPublic drops a published sprout whose only bean-parent is private", () => {
  const seed: RawGarden = {
    pods: [{ slug: "m", name: "M", description: "" }],
    beans: [{ slug: "a-priv", name: "A", parents: ["pod:m"], visibility: "private" }],
    sprouts: [{ slug: "v", name: "V", type: "song", date: "2026-01-01", description: "", parents: ["bean:a-priv"], state: "published" }],
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

test("filterPublic drops a published sprout transitively when its bean is cascaded out", () => {
  const seed: RawGarden = {
    pods: [{ slug: "m-priv", name: "M", description: "", visibility: "private" }],
    beans: [{ slug: "a", name: "A", parents: ["pod:m-priv"] }],
    sprouts: [{ slug: "v", name: "V", type: "song", date: "2026-01-01", description: "", parents: ["bean:a"], state: "published" }],
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
    pods: [
      { slug: "rm-pub", name: "M pub", description: "" },
      { slug: "rm-priv", name: "M priv", description: "", visibility: "private" },
    ],
    beans: [
      { slug: "ra-pub", name: "A pub", parents: ["pod:rm-pub"] },
      { slug: "ra-priv", name: "A priv", parents: ["pod:rm-pub"], visibility: "private" },
    ],
    sprouts: [
      { slug: "rv-target", name: "Target", type: "song", date: "2026-01-01", description: "", parents: ["bean:ra-pub"], state: "published" },
      { slug: "rv-draft", name: "Draft", type: "song", date: "2026-01-02", description: "", parents: ["bean:ra-pub"], state: "draft" },
      { slug: "rv-nostate", name: "No state", type: "song", date: "2026-01-03", description: "", parents: ["bean:ra-pub"] },
      // Published, but cascaded out with its private atom parent — a relation
      // pointing here must drop even though the target's own state is "published".
      { slug: "rv-under-priv", name: "Hidden", type: "song", date: "2026-01-04", description: "", parents: ["bean:ra-priv"], state: "published" },
      {
        slug: "rv-main",
        name: "Main",
        type: "song",
        date: "2026-01-05",
        description: "",
        parents: ["bean:ra-pub"],
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
    pods: [{ slug: "m", name: "M", description: "" }],
    beans: [{ slug: "a", name: "A", parents: ["pod:m"] }],
    sprouts: [
      { slug: "v-str", name: "V", type: "t", date: "2026-01-01", description: "", parents: ["bean:a"], state: "published", relations: "junk" as never },
      {
        slug: "v-entries", name: "V2", type: "t", date: "2026-01-02", description: "", parents: ["bean:a"], state: "published",
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
    pods: [],
    beans: [{ slug: "a", name: "A", parents: [] }],
    sprouts: [
      { slug: "v", name: "V", type: "song", date: "2026-01-01", description: "", parents: ["bean:a"], state: "published", relations: [] },
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
    sprouts: [{ slug: "v", name: "V", type: "song", date: "2026-01-01", description: "", parents: ["bean:a"], state: "published" }],
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
      { slug: "s-pub", name: "S", type: "note", date: "2026-01-01", description: "", parents: ["bean:b-pub"], state: "published" },
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

test("a private screen never reaches the exhibition, however it is marked", () => {
  // The two halves of the rule are enforced in two places and this is the
  // seam between them: filterPublic is the security boundary and drops the
  // screen, so exhibitionForPlant never has to re-check visibility — and a
  // second copy of a security check would be a second behaviour.
  const seed = screenSeed();
  seed.screens![0] = { ...seed.screens![0], exhibited: true, order: 0 }; // sc-private
  const d = buildDataset(filterPublic(seed));
  assert.deepEqual(d.exhibitionForPlant("pl-pub"), []);
});
