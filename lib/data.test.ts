import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDataset, getDataset, publishCascade, type RawSeed } from "./data";

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
