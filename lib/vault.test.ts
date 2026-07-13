import { test } from "node:test";
import assert from "node:assert/strict";
import { filterVaultEntries, distinctTags } from "./vault";
import type { TimelineEntry } from "./data";

function entry(slug: string, state: string | undefined, domain: string | null, tags?: string[]): TimelineEntry {
  return {
    version: { slug, name: slug, type: "t", date: "2025-01-01", description: "", parents: [], ...(state ? { state: state as never } : {}), ...(tags ? { tags } : {}) },
    atom: domain ? { slug: `atom-${slug}`, name: "a", parents: [] } : null,
    domain: domain as never,
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
  assert.deepEqual(r.map((e) => e.version.slug), ["v2", "v4"]);
});

test("filters by domain", () => {
  const r = filterVaultEntries(ENTRIES, { domain: "music" });
  assert.deepEqual(r.map((e) => e.version.slug), ["v1", "v2"]);
});

test("filters by tag (membership)", () => {
  const r = filterVaultEntries(ENTRIES, { tag: "release" });
  assert.deepEqual(r.map((e) => e.version.slug), ["v2", "v4"]);
});

test("combined filters intersect", () => {
  const r = filterVaultEntries(ENTRIES, { state: "published", domain: "music" });
  assert.deepEqual(r.map((e) => e.version.slug), ["v2"]);
});

test("an unknown state value falls back to all", () => {
  assert.equal(filterVaultEntries(ENTRIES, { state: "bogus" }).length, 4);
});

test("an unknown domain value falls back to all", () => {
  assert.equal(filterVaultEntries(ENTRIES, { domain: "nope" }).length, 4);
});

test("a blank tag falls back to all; an unmatched tag yields none", () => {
  assert.equal(filterVaultEntries(ENTRIES, { tag: "  " }).length, 4);
  assert.equal(filterVaultEntries(ENTRIES, { tag: "ghost" }).length, 0);
});

test("empty input returns empty", () => {
  assert.deepEqual(filterVaultEntries([], { state: "draft" }), []);
});

test("distinctTags returns sorted unique tags across entries", () => {
  assert.deepEqual(distinctTags(ENTRIES), ["demo", "release", "wip"]);
});
