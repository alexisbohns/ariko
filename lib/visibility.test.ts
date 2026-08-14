import { test } from "node:test";
import assert from "node:assert/strict";
import { filterPublic, resolveText, type RawSeed } from "./data";

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

const raw: RawSeed = {
  pods: [
    { slug: "m-pub", name: "Pub", domain: "music", description: "" },
    { slug: "m-priv", name: "Priv", domain: "music", description: "", visibility: "private" },
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
  const seed: RawSeed = {
    pods: [{ slug: "m", name: "M", domain: "music", description: "" }],
    beans: [{ slug: "a-priv", name: "A", parents: ["pod:m"], visibility: "private" }],
    sprouts: [{ slug: "v", name: "V", type: "song", date: "2026-01-01", description: "", parents: ["bean:a-priv"], state: "published" }],
  };
  const out = filterPublic(seed);
  assert.deepEqual((out.beans ?? []).map((a) => a.slug), []);
  assert.deepEqual((out.sprouts ?? []).map((v) => v.slug), []);
});

test("filterPublic drops an bean whose only pod-parent is private (no standalone leak)", () => {
  const seed: RawSeed = {
    pods: [{ slug: "m-priv", name: "M", domain: "music", description: "", visibility: "private" }],
    beans: [{ slug: "a", name: "A", parents: ["pod:m-priv"] }],
    sprouts: [],
  };
  const out = filterPublic(seed);
  assert.deepEqual((out.pods ?? []).map((m) => m.slug), []);
  assert.deepEqual((out.beans ?? []).map((a) => a.slug), []);
});

test("filterPublic drops a published sprout transitively when its bean is cascaded out", () => {
  const seed: RawSeed = {
    pods: [{ slug: "m-priv", name: "M", domain: "music", description: "", visibility: "private" }],
    beans: [{ slug: "a", name: "A", parents: ["pod:m-priv"] }],
    sprouts: [{ slug: "v", name: "V", type: "song", date: "2026-01-01", description: "", parents: ["bean:a"], state: "published" }],
  };
  assert.deepEqual((filterPublic(seed).sprouts ?? []).map((v) => v.slug), []);
});

test("filterPublic keeps a multi-parent bean if at least one pod-parent is public", () => {
  const seed: RawSeed = {
    pods: [
      { slug: "m-pub", name: "Pub", domain: "music", description: "" },
      { slug: "m-priv", name: "Priv", domain: "music", description: "", visibility: "private" },
    ],
    beans: [{ slug: "a", name: "A", parents: ["pod:m-priv", "pod:m-pub"] }],
    sprouts: [],
  };
  assert.deepEqual((filterPublic(seed).beans ?? []).map((a) => a.slug), ["a"]);
});

test("filterPublic keeps an bean whose only pod-parent is a dangling (nonexistent) ref", () => {
  const seed: RawSeed = {
    pods: [],
    beans: [{ slug: "a", name: "A", parents: ["pod:ghost"] }],
    sprouts: [],
  };
  assert.deepEqual((filterPublic(seed).beans ?? []).map((a) => a.slug), ["a"]);
});

// relations[] scrub matrix (G2). The projection prunes each KEPT version's
// relations to refs whose target itself survives the projection — fail-closed:
// draft/private/cascaded/dangling/unknown-prefix targets can never leak a slug.
function relSeed(): RawSeed {
  return {
    pods: [
      { slug: "rm-pub", name: "M pub", domain: "music", description: "" },
      { slug: "rm-priv", name: "M priv", domain: "music", description: "", visibility: "private" },
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
          { kind: "related-to", ref: "capture:x" }, // dropped: unknown prefix
        ],
      },
    ],
  };
}

test("filterPublic tolerates malformed relations fail-closed (one bad doc must not 500 the public site)", () => {
  const seed: RawSeed = {
    pods: [{ slug: "m", name: "M", domain: "music", description: "" }],
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
  const seed: RawSeed = {
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
