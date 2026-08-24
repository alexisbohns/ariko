import { test } from "node:test";
import assert from "node:assert/strict";
import { filterVaultEntries, distinctPlants, distinctTags } from "./vault";
import type { TimelineEntry } from "./data";

function entry(slug: string, state: string | undefined, plantSlug: string | null, tags?: string[]): TimelineEntry {
  return {
    sprout: { slug, name: slug, type: "t", date: "2025-01-01", description: "", parents: [], ...(state ? { state: state as never } : {}), ...(tags ? { tags } : {}) },
    bean: plantSlug ? { slug: `bean-${slug}`, name: "a", parents: [] } : null,
    plant: plantSlug ? { slug: plantSlug, name: plantSlug, natures: ["work" as const], role: { kind: "owner" as const }, description: "" } : null,
  };
}

const ENTRIES: TimelineEntry[] = [
  entry("v1", "draft", "music", ["demo", "wip"]),
  entry("v2", "published", "music", ["release"]),
  entry("v3", "private", "design"),
  entry("v4", "published", "podcast", ["release"]),
];

test("no filters returns all entries", () => {
  assert.equal(filterVaultEntries(ENTRIES, {}).length, 4);
});

test("filters by state", () => {
  const r = filterVaultEntries(ENTRIES, { state: "published" });
  assert.deepEqual(r.map((e) => e.sprout.slug), ["v2", "v4"]);
});

test("filters by plant", () => {
  const r = filterVaultEntries(ENTRIES, { plant: "music" });
  assert.deepEqual(r.map((e) => e.sprout.slug), ["v1", "v2"]);
});

test("filters by tag (membership)", () => {
  const r = filterVaultEntries(ENTRIES, { tag: "release" });
  assert.deepEqual(r.map((e) => e.sprout.slug), ["v2", "v4"]);
});

test("combined filters intersect", () => {
  const r = filterVaultEntries(ENTRIES, { state: "published", plant: "music" });
  assert.deepEqual(r.map((e) => e.sprout.slug), ["v2"]);
});

test("an unknown state value falls back to all", () => {
  assert.equal(filterVaultEntries(ENTRIES, { state: "bogus" }).length, 4);
});

test("a blank plant value falls back to all", () => {
  assert.equal(filterVaultEntries(ENTRIES, { plant: "  " }).length, 4);
});

test("a blank tag falls back to all; an unmatched tag yields none", () => {
  assert.equal(filterVaultEntries(ENTRIES, { tag: "  " }).length, 4);
  assert.equal(filterVaultEntries(ENTRIES, { tag: "ghost" }).length, 0);
});

test("empty input returns empty", () => {
  assert.deepEqual(filterVaultEntries([], { state: "draft" }), []);
});

test("filterVaultEntries filters by the resolved plant's slug; an unknown slug matches nothing", () => {
  const plant = { slug: "pbbls", name: "P", natures: ["work" as const], role: { kind: "owner" as const }, description: "" };
  const entries: TimelineEntry[] = [
    { sprout: { slug: "v1", name: "V1", type: "t", date: "2026-01-01", description: "", parents: [] }, bean: null, plant },
    { sprout: { slug: "v2", name: "V2", type: "t", date: "2026-01-02", description: "", parents: [] }, bean: null, plant: null },
  ];
  assert.deepEqual(filterVaultEntries(entries, { plant: "pbbls" }).map((e) => e.sprout.slug), ["v1"]);
  assert.deepEqual(filterVaultEntries(entries, { plant: "nope" }), []);
});

test("distinctPlants returns sorted unique plant slugs", () => {
  const p = (slug: string) => ({ slug, name: slug, natures: ["work" as const], role: { kind: "owner" as const }, description: "" });
  const entries: TimelineEntry[] = [
    { sprout: { slug: "a", name: "a", type: "t", date: "2026-01-01", description: "", parents: [] }, bean: null, plant: p("zeta") },
    { sprout: { slug: "b", name: "b", type: "t", date: "2026-01-02", description: "", parents: [] }, bean: null, plant: p("alpha") },
    { sprout: { slug: "c", name: "c", type: "t", date: "2026-01-03", description: "", parents: [] }, bean: null, plant: p("zeta") },
  ];
  assert.deepEqual(distinctPlants(entries), ["alpha", "zeta"]);
});

test("distinctTags returns sorted unique tags across entries", () => {
  assert.deepEqual(distinctTags(ENTRIES), ["demo", "release", "wip"]);
});

test("localized sprout names resolve to display strings at build time (B1)", () => {
  const e = entry("v-fr", "draft", null);
  e.sprout.name = { en: "Name en", fr: "Nom fr" };
  const r = filterVaultEntries([e], {});
  assert.equal(r[0].sprout.name, "Name en");
});
