import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSproutMetaPatch, BlankSproutNameError } from "./sprout-meta";

function form(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

test("buildSproutMetaPatch maps and trims name and description", () => {
  const p = buildSproutMetaPatch(form([
    ["name", "  New name "],
    ["description", "  a note "],
  ]));
  assert.deepEqual(p, { name: "New name", description: "a note" });
});

test("buildSproutMetaPatch composes bilingual pairs", () => {
  const p = buildSproutMetaPatch(form([
    ["name", "New name"],
    ["nameFr", "Nouveau nom"],
    ["description", "a note"],
    ["descriptionFr", "une note"],
  ]));
  assert.deepEqual(p.name, { en: "New name", fr: "Nouveau nom" });
  assert.deepEqual(p.description, { en: "a note", fr: "une note" });
});

test("buildSproutMetaPatch keeps an fr-only field fr-only (no en borrowed)", () => {
  const p = buildSproutMetaPatch(form([["nameFr", "Nom"], ["descriptionFr", "note fr"]]));
  assert.deepEqual(p.name, { fr: "Nom" });
  assert.deepEqual(p.description, { fr: "note fr" });
});

test("buildSproutMetaPatch stores exactly \"\" when both description boxes are blank", () => {
  // Sprout.description is REQUIRED in lib/data.ts, unlike Plant.description —
  // so a cleared description is an empty string, never an omitted key and
  // never a $unset. The patch feeds a $set verbatim.
  const p = buildSproutMetaPatch(form([["name", "n"]]));
  assert.equal(p.description, "");
});

test("buildSproutMetaPatch throws when the name is blank in both languages", () => {
  assert.throws(() => buildSproutMetaPatch(form([["description", "d"]])), BlankSproutNameError);
  assert.throws(() => buildSproutMetaPatch(form([["name", "   "], ["nameFr", "  "]])), BlankSproutNameError);
});

test("BlankSproutNameError carries the message the author reads", () => {
  assert.equal(new BlankSproutNameError().message, "a sprout needs a name in at least one language");
});
