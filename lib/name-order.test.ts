import { test } from "node:test";
import assert from "node:assert/strict";
import { byResolvedName } from "./name-order";

test("by name, and the slug breaks the tie", () => {
  const rows = [
    { name: "Zephyr", slug: "zephyr" },
    { name: "Ariko", slug: "b-ariko" },
    { name: "Ariko", slug: "a-ariko" },
  ];
  assert.deepEqual(
    [...rows].sort(byResolvedName).map((r) => r.slug),
    ["a-ariko", "b-ariko", "zephyr"],
  );
});

test("two rows with the same name keep ONE order whatever order they arrive in", () => {
  // The half that goes silently false: drop `|| a.slug.localeCompare(b.slug)`
  // and the order between same-named rows is the garden's, which is Mongo's,
  // and shuffles under the author between visits.
  const a = { name: "Ariko", slug: "a-ariko" };
  const b = { name: "Ariko", slug: "b-ariko" };
  assert.deepEqual([a, b].sort(byResolvedName), [b, a].sort(byResolvedName));
  assert.ok(byResolvedName(a, b) < 0);
});

test("accented names sort where a reader expects, not where their code points fall", () => {
  // `localeCompare` rather than the plain `<` this repo uses on slugs: "Élan"
  // belongs beside "Elm", and `"É" < "Z"` is false.
  const rows = [
    { name: "Zephyr", slug: "z" },
    { name: "Élan", slug: "e" },
  ];
  assert.deepEqual(
    [...rows].sort(byResolvedName).map((r) => r.slug),
    ["e", "z"],
  );
});
