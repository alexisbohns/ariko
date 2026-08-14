import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSproutPatch, validateSproutPatch } from "./sprout-edit";

function form(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

test("buildSproutPatch maps and trims the editable fields", () => {
  const p = buildSproutPatch(
    form([
      ["name", "  New name "],
      ["type", " demo "],
      ["date", "2025-05-05"],
      ["description", "  a note "],
      ["state", "published"],
    ]),
  );
  assert.deepEqual(p, {
    name: "New name",
    type: "demo",
    date: "2025-05-05",
    description: "a note",
    state: "published",
  });
});

test("buildSproutPatch stores exactly \"\" when both description boxes are blank", () => {
  // The patch feeds a Mongo $set verbatim — the blank case must stay a plain
  // empty string (never undefined/omitted, which would serialize as null or
  // stop clearing descriptions from the edit form).
  const p = buildSproutPatch(form([["name", "n"], ["type", "t"], ["date", "2025-01-01"]]));
  assert.equal(p.description, "");
});

test("buildSproutPatch: state falls back to draft when missing", () => {
  assert.equal(buildSproutPatch(form([["name", "n"]])).state, "draft");
});

test("buildSproutPatch: state falls back to draft on an unrecognized value", () => {
  assert.equal(buildSproutPatch(form([["state", "bogus"]])).state, "draft");
});

test("buildSproutPatch: accepts private and published", () => {
  assert.equal(buildSproutPatch(form([["state", "private"]])).state, "private");
  assert.equal(buildSproutPatch(form([["state", "published"]])).state, "published");
});

test("validateSproutPatch: passes a complete patch (empty description is allowed)", () => {
  assert.deepEqual(
    validateSproutPatch({ name: "n", type: "t", date: "2025-01-01", description: "", state: "draft" }),
    { ok: true },
  );
});

// --- Bilingual widening (B1): the edit form's paired en/fr fields compose via
// composeText; validation counts a name present in either language.

test("buildSproutPatch composes bilingual name/description from the paired fr fields", () => {
  const p = buildSproutPatch(
    form([["name", "New name"], ["nameFr", "Nouveau nom"], ["type", "t"], ["date", "2025-05-05"], ["description", "a note"], ["descriptionFr", "une note"]]),
  );
  assert.deepEqual(p.name, { en: "New name", fr: "Nouveau nom" });
  assert.deepEqual(p.description, { en: "a note", fr: "une note" });
});

test("buildSproutPatch keeps fr-only fields as fr-only objects (no en borrowed)", () => {
  const p = buildSproutPatch(form([["nameFr", "Nom"], ["descriptionFr", "note fr"]]));
  assert.deepEqual(p.name, { fr: "Nom" });
  assert.deepEqual(p.description, { fr: "note fr" });
});

test("validateSproutPatch accepts an fr-only name", () => {
  assert.deepEqual(
    validateSproutPatch({ name: { fr: "Nom" }, type: "t", date: "2025-01-01", description: "", state: "draft" }),
    { ok: true },
  );
});

test("validateSproutPatch rejects a name with no language present, message unchanged", () => {
  assert.deepEqual(validateSproutPatch({ name: {}, type: "t", date: "d", description: "", state: "draft" }), {
    ok: false,
    error: "sprout name is required",
  });
});

test("validateSproutPatch: missing name / type / date are each rejected with their message", () => {
  assert.deepEqual(validateSproutPatch({ name: "", type: "t", date: "d", description: "", state: "draft" }), {
    ok: false,
    error: "sprout name is required",
  });
  assert.deepEqual(validateSproutPatch({ name: "n", type: "", date: "d", description: "", state: "draft" }), {
    ok: false,
    error: "sprout type is required",
  });
  assert.deepEqual(validateSproutPatch({ name: "n", type: "t", date: "", description: "", state: "draft" }), {
    ok: false,
    error: "sprout date is required",
  });
});
