import { test } from "node:test";
import assert from "node:assert/strict";
import { filterQuery, filterHref } from "./admin-filters";

const KEYS = ["state", "plant", "tag"] as const;

test("filterQuery keeps only the named keys, in the order given", () => {
  assert.equal(filterQuery({ tag: "release", plant: "music", rogue: "x" }, KEYS), "plant=music&tag=release");
});

test("filterQuery drops blank, whitespace and 'all' values", () => {
  assert.equal(filterQuery({ state: "all", plant: "  ", tag: "" }, KEYS), "");
});

test("filterQuery encodes values", () => {
  assert.equal(filterQuery({ plant: "a b&c" }, KEYS), "plant=a+b%26c");
});

test("filterQuery ignores a key that is not in the list", () => {
  assert.equal(filterQuery({ error: "boom" }, KEYS), "");
});

test("filterHref sets one dimension and preserves the others", () => {
  const href = filterHref("/admin/vault", { state: "draft", tag: "wip" }, KEYS, "plant", "music");
  assert.equal(href, "/admin/vault?state=draft&plant=music&tag=wip");
});

test("filterHref clears a dimension when the value is 'all'", () => {
  const href = filterHref("/admin/vault", { state: "draft", plant: "music" }, KEYS, "plant", "all");
  assert.equal(href, "/admin/vault?state=draft");
});

test("filterHref returns the bare base when nothing is active", () => {
  assert.equal(filterHref("/admin/vault", { state: "draft" }, KEYS, "state", "all"), "/admin/vault");
});
