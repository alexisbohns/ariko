import { test } from "node:test";
import assert from "node:assert/strict";
import type { Screen } from "./data";
import { buildScreenMetaPatch, screenMetaUpdate, parseTags } from "./screen-edit";

const SCREEN: Screen = {
  slug: "karma-top",
  name: { en: "Karma top", fr: "Karma haut" },
  legend: "The leaderboard",
  image: { kind: "image", storageKey: "k", url: "https://x.test/a.png" },
  parents: ["plant:paulopus"],
  relations: [{ kind: "cover", ref: "bean:karma-accountability" }],
  tags: ["hero"],
};

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** The form as the page renders it for SCREEN — every field at its stored value. */
function unchanged(over: Record<string, string> = {}): FormData {
  return form({
    name: "Karma top",
    nameFr: "Karma haut",
    legend: "The leaderboard",
    legendFr: "",
    tags: "hero",
    plant: "paulopus",
    bean: "",
    ...over,
  });
}

test("parseTags splits, trims, drops blanks and de-duplicates in order", () => {
  assert.deepEqual(parseTags(" hero , wip,, hero "), ["hero", "wip"]);
  assert.deepEqual(parseTags("   "), []);
});

test("an untouched save writes nothing", () => {
  assert.deepEqual(buildScreenMetaPatch(SCREEN, unchanged()), { ok: true, dirty: false });
});

test("a blank name in both halves is refused", () => {
  const result = buildScreenMetaPatch(SCREEN, unchanged({ name: "", nameFr: "  " }));
  assert.deepEqual(result, {
    ok: false,
    error: "a screen needs a name in at least one language",
  });
});

test("an fr-only name is valid", () => {
  const result = buildScreenMetaPatch(SCREEN, unchanged({ name: "", nameFr: "Karma haut" }));
  assert.equal(result.ok, true);
  // composeText drops a blank `en` half rather than storing "", so an fr-only
  // name is the OBJECT { fr } and never a plain string — a plain string is the
  // en part by textPart's definition.
  assert.deepEqual(result.ok && result.dirty && result.patch.name, { fr: "Karma haut" });
});

test("a blank legend MEANS clear", () => {
  const result = buildScreenMetaPatch(SCREEN, unchanged({ legend: "" }));
  assert.equal(result.ok && result.dirty && result.patch.legend, null);
});

test("emptying the tags field clears them", () => {
  const result = buildScreenMetaPatch(SCREEN, unchanged({ tags: "" }));
  assert.deepEqual(result.ok && result.dirty && result.patch.tags, []);
});

test("choosing a plant rewrites parents[]", () => {
  const result = buildScreenMetaPatch(SCREEN, unchanged({ plant: "melogram" }));
  assert.deepEqual(result.ok && result.dirty && result.patch.parents, ["plant:melogram"]);
});

test("choosing no plant empties parents[]", () => {
  const result = buildScreenMetaPatch(SCREEN, unchanged({ plant: "" }));
  assert.deepEqual(result.ok && result.dirty && result.patch.parents, []);
});

test("a shows relation is added WITHOUT losing the cover relation", () => {
  const result = buildScreenMetaPatch(SCREEN, unchanged({ bean: "brand-voice" }));
  assert.deepEqual(result.ok && result.dirty && result.patch.relations, [
    { kind: "cover", ref: "bean:karma-accountability" },
    { kind: "shows", ref: "bean:brand-voice" },
  ]);
});

test("a shows relation is REPLACED in place, not appended twice", () => {
  const withShows: Screen = {
    ...SCREEN,
    relations: [
      { kind: "shows", ref: "bean:one" },
      { kind: "cover", ref: "bean:karma-accountability" },
    ],
  };
  const result = buildScreenMetaPatch(withShows, unchanged({ bean: "two" }));
  assert.deepEqual(result.ok && result.dirty && result.patch.relations, [
    { kind: "shows", ref: "bean:two" },
    { kind: "cover", ref: "bean:karma-accountability" },
  ]);
});

test("clearing the bean drops only the shows relation", () => {
  const withShows: Screen = {
    ...SCREEN,
    relations: [
      { kind: "shows", ref: "bean:one" },
      { kind: "cover", ref: "bean:karma-accountability" },
    ],
  };
  const result = buildScreenMetaPatch(withShows, unchanged({ bean: "" }));
  assert.deepEqual(result.ok && result.dirty && result.patch.relations, [
    { kind: "cover", ref: "bean:karma-accountability" },
  ]);
});

test("screenMetaUpdate puts every present field in ONE $set", () => {
  const update = screenMetaUpdate({
    name: "A",
    legend: "L",
    tags: ["x"],
    parents: ["plant:p"],
    relations: [{ kind: "shows", ref: "bean:b" }],
  });
  assert.deepEqual(update, {
    $set: {
      name: "A",
      parents: ["plant:p"],
      legend: "L",
      tags: ["x"],
      relations: [{ kind: "shows", ref: "bean:b" }],
    },
  });
});

test("screenMetaUpdate $unsets the three optional fields when they are empty", () => {
  const update = screenMetaUpdate({ name: "A", legend: null, tags: [], parents: [], relations: [] });
  assert.deepEqual(update, {
    $set: { name: "A", parents: [] },
    $unset: { legend: "", tags: "", relations: "" },
  });
});

test("screenMetaUpdate never emits two $set keys", () => {
  const update = screenMetaUpdate({ name: "A", legend: "L", tags: [], parents: [], relations: [] });
  assert.deepEqual(Object.keys(update), ["$set", "$unset"]);
  assert.deepEqual(update.$set, { name: "A", parents: [], legend: "L" });
  assert.deepEqual(update.$unset, { tags: "", relations: "" });
});
