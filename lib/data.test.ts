import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDataset,
  getDataset,
  publishCascade,
  unpublishCascade,
  unpublishCascadeForAtoms,
  type RawSeed,
  type VersionState,
  type Visibility,
} from "./data";

// Synthetic seed exercising every edge case the directory/timeline must handle:
// multi-parent atoms, standalone atoms, dangling molecule refs, and a version
// whose atom has no molecule (domainless).
const raw: RawSeed = {
  molecules: [
    { slug: "m-music", name: "Music Mol", domain: "music", description: "" },
    { slug: "m-design", name: "Design Mol", domain: "design", description: "" },
  ],
  atoms: [
    { slug: "a1", name: "A1", parents: ["molecule:m-music"] },
    { slug: "a2", name: "A2", parents: ["molecule:m-music", "molecule:m-design"] },
    { slug: "a-standalone", name: "Lonely", parents: [] },
    { slug: "a-dangling", name: "Dangling", parents: ["molecule:nope"] },
  ],
  versions: [
    { slug: "v-old", name: "Old", type: "song", date: "2020-01-01", description: "", parents: ["atom:a1"] },
    { slug: "v-new", name: "New", type: "song", date: "2026-01-01", description: "", parents: ["atom:a1"] },
    { slug: "v-mid", name: "Mid", type: "song", date: "2023-06-15", description: "", parents: ["atom:a1"] },
    { slug: "v-orphan", name: "Orphan", type: "note", date: "2024-01-01", description: "", parents: ["atom:a-standalone"] },
  ],
};

test("timelineVersions sorts all versions by date descending", () => {
  const ds = buildDataset(raw);
  const slugs = ds.timelineVersions().map((e) => e.version.slug);
  assert.deepEqual(slugs, ["v-new", "v-orphan", "v-mid", "v-old"]);
});

test("timeline entries tag each version with its atom and derived domain", () => {
  const ds = buildDataset(raw);
  const bySlug = new Map(ds.timelineVersions().map((e) => [e.version.slug, e]));

  const vNew = bySlug.get("v-new")!;
  assert.equal(vNew.atom?.slug, "a1");
  assert.equal(vNew.domain, "music");

  const vOrphan = bySlug.get("v-orphan")!;
  assert.equal(vOrphan.atom?.slug, "a-standalone");
  assert.equal(vOrphan.domain, null);
});

test("atomsForMolecule indexes atoms by molecule, including multi-parent atoms", () => {
  const ds = buildDataset(raw);
  assert.deepEqual(ds.atomsForMolecule("m-music").map((a) => a.slug), ["a1", "a2"]);
  assert.deepEqual(ds.atomsForMolecule("m-design").map((a) => a.slug), ["a2"]);
});

test("standaloneAtoms are atoms with no resolvable molecule parent", () => {
  const ds = buildDataset(raw);
  assert.deepEqual(ds.standaloneAtoms().map((a) => a.slug), ["a-standalone", "a-dangling"]);
});

test("domain is derived from an atom's first molecule parent", () => {
  const ds = buildDataset(raw);
  assert.equal(ds.domainForAtom("a1"), "music");
  assert.equal(ds.domainForAtom("a2"), "music");
  assert.equal(ds.domainForAtom("a-standalone"), null);
  assert.equal(ds.domainForAtom("a-dangling"), null);
});

test("versionsForAtom returns that atom's versions sorted by date descending", () => {
  const ds = buildDataset(raw);
  assert.deepEqual(ds.versionsForAtom("a1").map((v) => v.slug), ["v-new", "v-mid", "v-old"]);
});

test("getAtom looks up an atom by slug", () => {
  const ds = buildDataset(raw);
  assert.equal(ds.getAtom("a2")?.name, "A2");
  assert.equal(ds.getAtom("missing"), undefined);
});

test("getDataset keeps version dates as plain YYYY-MM-DD strings", () => {
  // js-yaml's default schema coerces unquoted dates into Date objects, which
  // breaks date rendering and drops `date` from scalar-property listings.
  const version = getDataset().timelineVersions()[0].version;
  assert.equal(typeof version.date, "string");
  assert.match(version.date, /^\d{4}-\d{2}-\d{2}$/);
});

const RAW = {
  molecules: [{ slug: "m1", name: "M1", domain: "music" as const, description: "" }],
  atoms: [
    { slug: "a1", name: "A1", parents: ["molecule:m1"] },
    { slug: "a2", name: "A2", parents: ["molecule:m1", "molecule:mX"] }, // mX dangling
  ],
  versions: [
    { slug: "v1", name: "V1", type: "t", date: "2025-01-01", description: "", parents: ["atom:a1"] },
    { slug: "v2", name: "V2", type: "t", date: "2025-01-01", description: "", parents: ["atom:a1", "atom:a2"] },
    { slug: "v3", name: "V3", type: "t", date: "2025-01-01", description: "", parents: [] },
    { slug: "v4", name: "V4", type: "t", date: "2025-01-01", description: "", parents: ["atom:ghost"] },
  ],
};

test("publishCascade returns the atom parent and its molecule parent", () => {
  const r = publishCascade(RAW, "v1");
  assert.deepEqual(r.atomSlugs, ["a1"]);
  assert.deepEqual(r.moleculeSlugs, ["m1"]);
});

test("publishCascade unions multiple atom parents and their molecules, ignoring dangling molecule refs", () => {
  const r = publishCascade(RAW, "v2");
  assert.deepEqual([...r.atomSlugs].sort(), ["a1", "a2"]);
  assert.deepEqual(r.moleculeSlugs, ["m1"]); // mX is dangling → excluded
});

test("a parentless version cascades nothing", () => {
  assert.deepEqual(publishCascade(RAW, "v3"), { moleculeSlugs: [], atomSlugs: [] });
});

test("a dangling atom parent is ignored", () => {
  assert.deepEqual(publishCascade(RAW, "v4"), { moleculeSlugs: [], atomSlugs: [] });
});

test("an unknown version slug cascades nothing", () => {
  assert.deepEqual(publishCascade(RAW, "nope"), { moleculeSlugs: [], atomSlugs: [] });
});

test("parents are returned regardless of current visibility (idempotent flip)", () => {
  const raw = {
    molecules: [{ slug: "m1", name: "M1", domain: "music" as const, description: "", visibility: "public" as const }],
    atoms: [{ slug: "a1", name: "A1", parents: ["molecule:m1"], visibility: "public" as const }],
    versions: [{ slug: "v1", name: "V1", type: "t", date: "2025-01-01", description: "", parents: ["atom:a1"] }],
  };
  const r = publishCascade(raw, "v1");
  assert.deepEqual(r.atomSlugs, ["a1"]);
  assert.deepEqual(r.moleculeSlugs, ["m1"]);
});

test("an atom with two real molecule parents cascades both molecules", () => {
  const raw = {
    molecules: [
      { slug: "m1", name: "M1", domain: "music" as const, description: "" },
      { slug: "m2", name: "M2", domain: "design" as const, description: "" },
    ],
    atoms: [{ slug: "a1", name: "A1", parents: ["molecule:m1", "molecule:m2"] }],
    versions: [
      { slug: "v1", name: "V1", type: "t", date: "2025-01-01", description: "", parents: ["atom:a1"] },
    ],
  };
  const r = publishCascade(raw, "v1");
  assert.deepEqual(r.atomSlugs, ["a1"]);
  assert.deepEqual([...r.moleculeSlugs].sort(), ["m1", "m2"]);
});

// --- unpublishCascade: the downward inverse (roadmap A1). Fixtures are built per
// test because the interesting variable is the surviving published/public siblings.

function ver(slug: string, parents: string[], state: VersionState) {
  return { slug, name: slug.toUpperCase(), type: "t", date: "2025-01-01", description: "", parents, state };
}
const mol = (slug: string, visibility: Visibility) => ({
  slug, name: slug.toUpperCase(), domain: "music" as const, description: "", visibility,
});
const atom = (slug: string, parents: string[], visibility: Visibility) => ({
  slug, name: slug.toUpperCase(), parents, visibility,
});

test("unpublishCascade re-privatizes the atom and its molecule when the last published version is pulled", () => {
  const raw: RawSeed = {
    molecules: [mol("m1", "public")],
    atoms: [atom("a1", ["molecule:m1"], "public")],
    versions: [ver("v1", ["atom:a1"], "draft")], // just un-published
  };
  assert.deepEqual(unpublishCascade(raw, "v1"), { moleculeSlugs: ["m1"], atomSlugs: ["a1"] });
});

test("unpublishCascade keeps the whole lineage when a published sibling version remains", () => {
  const raw: RawSeed = {
    molecules: [mol("m1", "public")],
    atoms: [atom("a1", ["molecule:m1"], "public")],
    versions: [ver("v1", ["atom:a1"], "draft"), ver("v2", ["atom:a1"], "published")],
  };
  assert.deepEqual(unpublishCascade(raw, "v1"), { moleculeSlugs: [], atomSlugs: [] });
});

test("unpublishCascade flips the atom but keeps a molecule that still has another public atom", () => {
  const raw: RawSeed = {
    molecules: [mol("m1", "public")],
    atoms: [atom("a1", ["molecule:m1"], "public"), atom("a2", ["molecule:m1"], "public")],
    versions: [ver("v1", ["atom:a1"], "draft")],
  };
  assert.deepEqual(unpublishCascade(raw, "v1"), { moleculeSlugs: [], atomSlugs: ["a1"] });
});

test("unpublishCascade evaluates each atom parent of a multi-parent version independently", () => {
  const raw: RawSeed = {
    molecules: [mol("m1", "public"), mol("m2", "public")],
    atoms: [atom("a1", ["molecule:m1"], "public"), atom("a2", ["molecule:m2"], "public")],
    versions: [ver("v1", ["atom:a1", "atom:a2"], "draft"), ver("v2", ["atom:a2"], "published")],
  };
  // a2 keeps its published sibling; a1 empties, and with it m1.
  assert.deepEqual(unpublishCascade(raw, "v1"), { moleculeSlugs: ["m1"], atomSlugs: ["a1"] });
});

test("unpublishCascade lists a molecule shared by two flipped atoms once", () => {
  const raw: RawSeed = {
    molecules: [mol("m1", "public")],
    atoms: [atom("a1", ["molecule:m1"], "public"), atom("a2", ["molecule:m1"], "public")],
    versions: [ver("v1", ["atom:a1", "atom:a2"], "draft")],
  };
  const r = unpublishCascade(raw, "v1");
  assert.deepEqual([...r.atomSlugs].sort(), ["a1", "a2"]);
  assert.deepEqual(r.moleculeSlugs, ["m1"]);
});

test("unpublishCascade ignores dangling atom and molecule refs", () => {
  const raw: RawSeed = {
    molecules: [],
    atoms: [atom("a1", ["molecule:ghost"], "public")],
    versions: [ver("v1", ["atom:ghost", "atom:a1"], "draft")],
  };
  assert.deepEqual(unpublishCascade(raw, "v1"), { moleculeSlugs: [], atomSlugs: ["a1"] });
});

test("a parentless version un-cascades nothing", () => {
  const raw: RawSeed = { molecules: [], atoms: [], versions: [ver("v1", [], "draft")] };
  assert.deepEqual(unpublishCascade(raw, "v1"), { moleculeSlugs: [], atomSlugs: [] });
});

test("an unknown version slug un-cascades nothing", () => {
  const raw: RawSeed = { molecules: [], atoms: [], versions: [] };
  assert.deepEqual(unpublishCascade(raw, "nope"), { moleculeSlugs: [], atomSlugs: [] });
});

test("unpublishCascade is a no-op while the version is still published (its own state shelters its parents)", () => {
  const raw: RawSeed = {
    molecules: [mol("m1", "public")],
    atoms: [atom("a1", ["molecule:m1"], "public")],
    versions: [ver("v1", ["atom:a1"], "published")],
  };
  assert.deepEqual(unpublishCascade(raw, "v1"), { moleculeSlugs: [], atomSlugs: [] });
});

test("an explicitly-private sibling atom does not count as remaining public for the molecule rule", () => {
  const raw: RawSeed = {
    molecules: [mol("m1", "public")],
    atoms: [atom("a1", ["molecule:m1"], "public"), atom("a2", ["molecule:m1"], "private")],
    versions: [ver("v1", ["atom:a1"], "draft")],
  };
  assert.deepEqual(unpublishCascade(raw, "v1"), { moleculeSlugs: ["m1"], atomSlugs: ["a1"] });
});

test("flip targets are returned regardless of their current visibility (idempotent flip)", () => {
  const raw: RawSeed = {
    molecules: [mol("m1", "private")],
    atoms: [atom("a1", ["molecule:m1"], "private")],
    versions: [ver("v1", ["atom:a1"], "draft")],
  };
  assert.deepEqual(unpublishCascade(raw, "v1"), { moleculeSlugs: ["m1"], atomSlugs: ["a1"] });
});

test("inverse symmetry: un-publish flips back exactly what publish flipped (single-version lineage)", () => {
  const molecules = [mol("m1", "public")];
  const atoms = [atom("a1", ["molecule:m1"], "public")];
  const published = publishCascade({ molecules, atoms, versions: [ver("v1", ["atom:a1"], "published")] }, "v1");
  const unpublished = unpublishCascade({ molecules, atoms, versions: [ver("v1", ["atom:a1"], "draft")] }, "v1");
  assert.deepEqual(unpublished, published);
});

// --- unpublishCascadeForAtoms: the atom-keyed core (roadmap A2). The delete flow
// captures a version's atom parents BEFORE the delete and evaluates them against the
// POST-delete dataset — where the version no longer exists to shelter anything.

test("delete-shaped: last published version already gone from the dataset flips atom and molecule", () => {
  const raw: RawSeed = {
    molecules: [mol("m1", "public")],
    atoms: [atom("a1", ["molecule:m1"], "public")],
    versions: [], // the deleted version was a1's only version
  };
  assert.deepEqual(unpublishCascadeForAtoms(raw, ["a1"]), { moleculeSlugs: ["m1"], atomSlugs: ["a1"] });
});

test("delete-shaped: a surviving published sibling shelters the atom (and molecule)", () => {
  const raw: RawSeed = {
    molecules: [mol("m1", "public")],
    atoms: [atom("a1", ["molecule:m1"], "public")],
    versions: [ver("v2", ["atom:a1"], "published")], // sibling of the deleted version
  };
  assert.deepEqual(unpublishCascadeForAtoms(raw, ["a1"]), { moleculeSlugs: [], atomSlugs: [] });
});

test("delete-shaped: a surviving draft sibling does not shelter", () => {
  const raw: RawSeed = {
    molecules: [mol("m1", "public")],
    atoms: [atom("a1", ["molecule:m1"], "public")],
    versions: [ver("v2", ["atom:a1"], "draft")],
  };
  assert.deepEqual(unpublishCascadeForAtoms(raw, ["a1"]), { moleculeSlugs: ["m1"], atomSlugs: ["a1"] });
});

test("unpublishCascadeForAtoms ignores unknown atom slugs", () => {
  const raw: RawSeed = {
    molecules: [mol("m1", "public")],
    atoms: [atom("a1", ["molecule:m1"], "public")],
    versions: [],
  };
  const r = unpublishCascadeForAtoms(raw, ["ghost", "a1"]);
  assert.deepEqual(r, { moleculeSlugs: ["m1"], atomSlugs: ["a1"] });
});

test("unpublishCascadeForAtoms ignores a flipped atom's dangling molecule refs", () => {
  const raw: RawSeed = {
    molecules: [],
    atoms: [atom("a1", ["molecule:ghost"], "public")],
    versions: [],
  };
  assert.deepEqual(unpublishCascadeForAtoms(raw, ["a1"]), { moleculeSlugs: [], atomSlugs: ["a1"] });
});

test("unpublishCascadeForAtoms on empty input flips nothing", () => {
  const raw: RawSeed = {
    molecules: [mol("m1", "public")],
    atoms: [atom("a1", ["molecule:m1"], "public")],
    versions: [],
  };
  assert.deepEqual(unpublishCascadeForAtoms(raw, []), { moleculeSlugs: [], atomSlugs: [] });
});

test("unpublishCascadeForAtoms dedupes repeated atom slugs", () => {
  const raw: RawSeed = {
    molecules: [mol("m1", "public")],
    atoms: [atom("a1", ["molecule:m1"], "public")],
    versions: [],
  };
  assert.deepEqual(unpublishCascadeForAtoms(raw, ["a1", "a1"]), { moleculeSlugs: ["m1"], atomSlugs: ["a1"] });
});

test("delete-shaped: two flipped atoms sharing one molecule list it once", () => {
  const raw: RawSeed = {
    molecules: [mol("m1", "public")],
    atoms: [atom("a1", ["molecule:m1"], "public"), atom("a2", ["molecule:m1"], "public")],
    versions: [], // the deleted version was the only version of both atoms
  };
  const r = unpublishCascadeForAtoms(raw, ["a1", "a2"]);
  assert.deepEqual([...r.atomSlugs].sort(), ["a1", "a2"]);
  assert.deepEqual(r.moleculeSlugs, ["m1"]);
});

test("delete-shaped: already-private flip targets are still returned (idempotent flip)", () => {
  const raw: RawSeed = {
    molecules: [mol("m1", "private")],
    atoms: [atom("a1", ["molecule:m1"], "private")],
    versions: [],
  };
  assert.deepEqual(unpublishCascadeForAtoms(raw, ["a1"]), { moleculeSlugs: ["m1"], atomSlugs: ["a1"] });
});

test("adapter equivalence: unpublishCascade(slug) === unpublishCascadeForAtoms(that version's atom refs)", () => {
  const raw: RawSeed = {
    molecules: [mol("m1", "public"), mol("m2", "public")],
    atoms: [atom("a1", ["molecule:m1"], "public"), atom("a2", ["molecule:m2"], "public")],
    versions: [ver("v1", ["atom:a1", "atom:a2", "atom:ghost"], "draft"), ver("v2", ["atom:a2"], "published")],
  };
  assert.deepEqual(
    unpublishCascade(raw, "v1"),
    unpublishCascadeForAtoms(raw, ["a1", "a2", "ghost"]),
  );
});
