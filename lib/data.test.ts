import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDataset, getDataset, type RawSeed } from "./data";

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
