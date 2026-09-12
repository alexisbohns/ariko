import { test } from "node:test";
import assert from "node:assert/strict";
import { filterHref, filterQuery, filterValue, type FilterValues } from "./admin-filters";

const KEYS = ["state", "plant", "tag"] as const;

test("filterValue is the one reading of a filter value, sentinel included", () => {
  assert.equal(filterValue("music"), "music");
  assert.equal(filterValue("  music  "), "music");
  assert.equal(filterValue("  "), undefined);
  assert.equal(filterValue(""), undefined);
  assert.equal(filterValue(undefined), undefined);
  // The sentinel. Every reader of a filter URL goes through this function so
  // that a row filter and the chrome above it cannot disagree about ?plant=all.
  assert.equal(filterValue("all"), undefined);
  // Coerced rather than thrown on, so a repeated key matches nothing.
  assert.equal(filterValue(["a", "b"]), "a,b");
});

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

test("filterQuery degrades a repeated key rather than throwing", () => {
  // `?plant=a&plant=b` reaches a Next page as a string[], which FilterValues
  // does not admit but a URL can always produce. The `String(...)` coercion is
  // what makes that a value matching nothing instead of a 500 — reading
  // .trim() off an array throws, and it would throw around the filter bar on
  // every page that has one.
  const repeated = { plant: ["a", "b"] } as unknown as FilterValues;
  assert.equal(filterQuery(repeated, KEYS), "plant=a%2Cb");
});

test("filterHref sets one dimension and preserves the others", () => {
  const href = filterHref("/admin/sprouts", { state: "draft", tag: "wip" }, KEYS, "plant", "music");
  assert.equal(href, "/admin/sprouts?state=draft&plant=music&tag=wip");
});

test("filterHref clears a dimension when the value is 'all'", () => {
  const href = filterHref("/admin/sprouts", { state: "draft", plant: "music" }, KEYS, "plant", "all");
  assert.equal(href, "/admin/sprouts?state=draft");
});

test("filterHref returns the bare base when nothing is active", () => {
  assert.equal(filterHref("/admin/sprouts", { state: "draft" }, KEYS, "state", "all"), "/admin/sprouts");
});
