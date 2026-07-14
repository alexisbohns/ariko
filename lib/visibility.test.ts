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
  molecules: [
    { slug: "m-pub", name: "Pub", domain: "music", description: "" },
    { slug: "m-priv", name: "Priv", domain: "music", description: "", visibility: "private" },
  ],
  atoms: [
    { slug: "a-pub", name: "A pub", parents: ["molecule:m-pub"] },
    { slug: "a-priv", name: "A priv", parents: ["molecule:m-pub"], visibility: "private" },
  ],
  versions: [
    { slug: "v-published", name: "Published", type: "song", date: "2026-01-01", description: "", parents: ["atom:a-pub"], state: "published" },
    { slug: "v-draft", name: "Draft", type: "song", date: "2026-01-02", description: "", parents: ["atom:a-pub"], state: "draft" },
    { slug: "v-private", name: "Private", type: "song", date: "2026-01-03", description: "", parents: ["atom:a-pub"], state: "private" },
    { slug: "v-nostate", name: "No state", type: "song", date: "2026-01-04", description: "", parents: ["atom:a-pub"] },
  ],
};

test("filterPublic keeps only published versions", () => {
  const slugs = (filterPublic(raw).versions ?? []).map((v) => v.slug);
  assert.deepEqual(slugs, ["v-published"]);
});

test("filterPublic drops private molecules and atoms, keeps the rest", () => {
  const out = filterPublic(raw);
  assert.deepEqual((out.molecules ?? []).map((m) => m.slug), ["m-pub"]);
  assert.deepEqual((out.atoms ?? []).map((a) => a.slug), ["a-pub"]);
});

test("filterPublic never leaks a draft, private, or stateless version", () => {
  const slugs = new Set((filterPublic(raw).versions ?? []).map((v) => v.slug));
  for (const leaked of ["v-draft", "v-private", "v-nostate"]) {
    assert.equal(slugs.has(leaked), false, `${leaked} must not be public`);
  }
});

test("filterPublic drops a published version whose only atom-parent is private", () => {
  const seed: RawSeed = {
    molecules: [{ slug: "m", name: "M", domain: "music", description: "" }],
    atoms: [{ slug: "a-priv", name: "A", parents: ["molecule:m"], visibility: "private" }],
    versions: [{ slug: "v", name: "V", type: "song", date: "2026-01-01", description: "", parents: ["atom:a-priv"], state: "published" }],
  };
  const out = filterPublic(seed);
  assert.deepEqual((out.atoms ?? []).map((a) => a.slug), []);
  assert.deepEqual((out.versions ?? []).map((v) => v.slug), []);
});

test("filterPublic drops an atom whose only molecule-parent is private (no standalone leak)", () => {
  const seed: RawSeed = {
    molecules: [{ slug: "m-priv", name: "M", domain: "music", description: "", visibility: "private" }],
    atoms: [{ slug: "a", name: "A", parents: ["molecule:m-priv"] }],
    versions: [],
  };
  const out = filterPublic(seed);
  assert.deepEqual((out.molecules ?? []).map((m) => m.slug), []);
  assert.deepEqual((out.atoms ?? []).map((a) => a.slug), []);
});

test("filterPublic drops a published version transitively when its atom is cascaded out", () => {
  const seed: RawSeed = {
    molecules: [{ slug: "m-priv", name: "M", domain: "music", description: "", visibility: "private" }],
    atoms: [{ slug: "a", name: "A", parents: ["molecule:m-priv"] }],
    versions: [{ slug: "v", name: "V", type: "song", date: "2026-01-01", description: "", parents: ["atom:a"], state: "published" }],
  };
  assert.deepEqual((filterPublic(seed).versions ?? []).map((v) => v.slug), []);
});

test("filterPublic keeps a multi-parent atom if at least one molecule-parent is public", () => {
  const seed: RawSeed = {
    molecules: [
      { slug: "m-pub", name: "Pub", domain: "music", description: "" },
      { slug: "m-priv", name: "Priv", domain: "music", description: "", visibility: "private" },
    ],
    atoms: [{ slug: "a", name: "A", parents: ["molecule:m-priv", "molecule:m-pub"] }],
    versions: [],
  };
  assert.deepEqual((filterPublic(seed).atoms ?? []).map((a) => a.slug), ["a"]);
});

test("filterPublic keeps an atom whose only molecule-parent is a dangling (nonexistent) ref", () => {
  const seed: RawSeed = {
    molecules: [],
    atoms: [{ slug: "a", name: "A", parents: ["molecule:ghost"] }],
    versions: [],
  };
  assert.deepEqual((filterPublic(seed).atoms ?? []).map((a) => a.slug), ["a"]);
});

// relations[] scrub matrix (G2). The projection prunes each KEPT version's
// relations to refs whose target itself survives the projection — fail-closed:
// draft/private/cascaded/dangling/unknown-prefix targets can never leak a slug.
function relSeed(): RawSeed {
  return {
    molecules: [
      { slug: "rm-pub", name: "M pub", domain: "music", description: "" },
      { slug: "rm-priv", name: "M priv", domain: "music", description: "", visibility: "private" },
    ],
    atoms: [
      { slug: "ra-pub", name: "A pub", parents: ["molecule:rm-pub"] },
      { slug: "ra-priv", name: "A priv", parents: ["molecule:rm-pub"], visibility: "private" },
    ],
    versions: [
      { slug: "rv-target", name: "Target", type: "song", date: "2026-01-01", description: "", parents: ["atom:ra-pub"], state: "published" },
      { slug: "rv-draft", name: "Draft", type: "song", date: "2026-01-02", description: "", parents: ["atom:ra-pub"], state: "draft" },
      { slug: "rv-nostate", name: "No state", type: "song", date: "2026-01-03", description: "", parents: ["atom:ra-pub"] },
      // Published, but cascaded out with its private atom parent — a relation
      // pointing here must drop even though the target's own state is "published".
      { slug: "rv-under-priv", name: "Hidden", type: "song", date: "2026-01-04", description: "", parents: ["atom:ra-priv"], state: "published" },
      {
        slug: "rv-main",
        name: "Main",
        type: "song",
        date: "2026-01-05",
        description: "",
        parents: ["atom:ra-pub"],
        state: "published",
        relations: [
          { kind: "evolves-from", ref: "version:rv-target" }, // kept: published sibling
          { kind: "evolves-from", ref: "version:rv-draft" }, // dropped: draft
          { kind: "evolves-from", ref: "version:rv-nostate" }, // dropped: stateless
          { kind: "evolves-from", ref: "version:rv-under-priv" }, // dropped: cascaded out
          { kind: "related-to", ref: "atom:ra-pub" }, // kept: public atom
          { kind: "related-to", ref: "atom:ra-priv" }, // dropped: private atom
          { kind: "featured-in", ref: "molecule:rm-pub" }, // kept: public molecule
          { kind: "featured-in", ref: "molecule:rm-priv" }, // dropped: private molecule
          { kind: "related-to", ref: "version:ghost" }, // dropped: dangling
          { kind: "related-to", ref: "capture:x" }, // dropped: unknown prefix
        ],
      },
    ],
  };
}

test("filterPublic tolerates malformed relations fail-closed (one bad doc must not 500 the public site)", () => {
  const seed: RawSeed = {
    molecules: [{ slug: "m", name: "M", domain: "music", description: "" }],
    atoms: [{ slug: "a", name: "A", parents: ["molecule:m"] }],
    versions: [
      { slug: "v-str", name: "V", type: "t", date: "2026-01-01", description: "", parents: ["atom:a"], state: "published", relations: "junk" as never },
      {
        slug: "v-entries", name: "V2", type: "t", date: "2026-01-02", description: "", parents: ["atom:a"], state: "published",
        relations: [null, "version:x", { kind: "k" }, { kind: 5, ref: "atom:a" }, { kind: "ok", ref: "atom:a" }] as never,
      },
    ],
  };
  const out = filterPublic(seed); // must not throw
  const bySlug = new Map((out.versions ?? []).map((v) => [v.slug, v]));
  assert.deepEqual(bySlug.get("v-str")?.relations, []);
  assert.deepEqual(bySlug.get("v-entries")?.relations, [{ kind: "ok", ref: "atom:a" }]);
});

test("filterPublic scrubs relations to refs whose target survives the projection", () => {
  const out = filterPublic(relSeed());
  const main = (out.versions ?? []).find((v) => v.slug === "rv-main");
  assert.deepEqual(main?.relations, [
    { kind: "evolves-from", ref: "version:rv-target" },
    { kind: "related-to", ref: "atom:ra-pub" },
    { kind: "featured-in", ref: "molecule:rm-pub" },
  ]);
});

test("filterPublic leaves an absent relations field absent (no materialized empty array)", () => {
  const out = filterPublic(relSeed());
  const target = (out.versions ?? []).find((v) => v.slug === "rv-target");
  assert.ok(target);
  assert.equal("relations" in target, false);
});

test("filterPublic keeps a present-but-empty relations array as-is", () => {
  const seed: RawSeed = {
    molecules: [],
    atoms: [{ slug: "a", name: "A", parents: [] }],
    versions: [
      { slug: "v", name: "V", type: "song", date: "2026-01-01", description: "", parents: ["atom:a"], state: "published", relations: [] },
    ],
  };
  assert.deepEqual((filterPublic(seed).versions ?? [])[0]?.relations, []);
});

test("filterPublic never mutates the input seed when scrubbing relations (pure)", () => {
  const seed = relSeed();
  const snapshot = structuredClone(seed);
  filterPublic(seed);
  assert.deepEqual(seed, snapshot);
});
