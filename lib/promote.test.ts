import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveParentChoice, buildSproutInput, validateSproutInput } from "./promote";
import type { Seed } from "./data";

const seed: Seed = {
  id: "c1",
  title: "Song idea",
  body: { en: "hummed melody", fr: "mélodie" },
  media: [{ kind: "embed", provider: "youtube", url: "https://youtu.be/x", embedId: "x" }],
  source: { kind: "manual", capturedAt: "2025-01-01T00:00:00.000Z" },
  status: "inbox",
  promotedTo: [],
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

function form(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

test("resolveParentChoice: a non-blank new slug wins (create)", () => {
  assert.deepEqual(resolveParentChoice("  new-slug ", "existing"), { mode: "create", slug: "new-slug" });
});

test("resolveParentChoice: falls back to the selected existing slug", () => {
  assert.deepEqual(resolveParentChoice("", " picked "), { mode: "existing", slug: "picked" });
});

test("resolveParentChoice: none when both blank", () => {
  assert.deepEqual(resolveParentChoice("  ", ""), { mode: "none" });
});

test("buildSproutInput is WYSIWYG: blank boxes store blank (nothing resurrected from the seed)", () => {
  // The triage PAGE prefills the boxes (name from seed.title, descriptions per
  // language via textPart) — the builder itself never falls back, so clearing a
  // box genuinely clears that content and a blank name fails validation.
  const v = buildSproutInput(form([["sproutSlug", "v1"], ["type", "demo"], ["date", "2025-02-02"]]), seed, "a1");
  assert.equal(v.slug, "v1");
  assert.equal(v.name, "");
  assert.equal(v.description, "");
  assert.equal(validateSproutInput(v).ok, false);
  assert.equal(v.type, "demo");
  assert.equal(v.date, "2025-02-02");
  assert.equal(v.state, "draft"); // default
  assert.deepEqual(v.parents, ["bean:a1"]);
  assert.deepEqual(v.media, seed.media);
  assert.deepEqual(v.source, seed.source);
});

test("buildSproutInput uses provided fields over prefill and parses state", () => {
  const v = buildSproutInput(
    form([["sproutSlug", "v1"], ["sproutName", "Live cut"], ["type", "live"], ["date", "2025-02-02"], ["description", "at the club"], ["state", "published"]]),
    seed,
    "a1",
  );
  assert.equal(v.name, "Live cut");
  assert.equal(v.description, "at the club");
  assert.equal(v.state, "published");
});

test("buildSproutInput yields a parentless sprout when beanParentSlug is null", () => {
  const v = buildSproutInput(form([["sproutSlug", "v1"], ["type", "t"], ["date", "2025-02-02"]]), seed, null);
  assert.deepEqual(v.parents, []);
});

test("buildSproutInput coerces an unexpected state to draft", () => {
  const v = buildSproutInput(form([["sproutSlug", "v1"], ["type", "t"], ["date", "2025-02-02"], ["state", "bogus"]]), seed, null);
  assert.equal(v.state, "draft");
});

test("validateSproutInput rejects missing required fields", () => {
  const base = buildSproutInput(
    form([["sproutSlug", "v1"], ["sproutName", "n"], ["type", "t"], ["date", "2025-02-02"]]),
    seed,
    null,
  );
  assert.equal(validateSproutInput(base).ok, true);
  assert.equal(validateSproutInput({ ...base, slug: "" }).ok, false);
  assert.equal(validateSproutInput({ ...base, type: "" }).ok, false);
  assert.equal(validateSproutInput({ ...base, date: "" }).ok, false);
});

test("validateSproutInput rejects a name cleared in both languages", () => {
  const v = buildSproutInput(form([["sproutSlug", "v1"], ["type", "t"], ["date", "2025-02-02"]]), seed, null);
  assert.equal(v.name, "");
  assert.equal(validateSproutInput(v).ok, false);
});

// --- Bilingual widening (B1): paired en/fr fields compose via composeText,
// WYSIWYG (the page prefills, the builder never falls back); validation counts a
// name present in either language.

test("buildSproutInput composes a bilingual name from the paired fields", () => {
  const v = buildSproutInput(
    form([["sproutSlug", "v1"], ["sproutName", "Live cut"], ["sproutNameFr", "Prise live"], ["type", "t"], ["date", "2025-02-02"]]),
    seed,
    null,
  );
  assert.deepEqual(v.name, { en: "Live cut", fr: "Prise live" });
});

test("buildSproutInput keeps an fr-only name (no seed-title fallback, no en borrowed)", () => {
  const v = buildSproutInput(
    form([["sproutSlug", "v1"], ["sproutNameFr", "Prise live"], ["type", "t"], ["date", "2025-02-02"]]),
    seed,
    null,
  );
  assert.deepEqual(v.name, { fr: "Prise live" });
});

test("buildSproutInput composes a bilingual description — a typed pair wins over the note", () => {
  const v = buildSproutInput(
    form([["sproutSlug", "v1"], ["type", "t"], ["date", "2025-02-02"], ["description", "at the club"], ["descriptionFr", "au club"]]),
    seed,
    null,
  );
  assert.deepEqual(v.description, { en: "at the club", fr: "au club" });
});

test("buildSproutInput: an fr-only typed description also wins over the note", () => {
  const v = buildSproutInput(
    form([["sproutSlug", "v1"], ["type", "t"], ["date", "2025-02-02"], ["descriptionFr", "au club"]]),
    seed,
    null,
  );
  assert.deepEqual(v.description, { fr: "au club" });
});

test("buildSproutInput: blank description fields and no seed body yield an empty string", () => {
  const v = buildSproutInput(
    form([["sproutSlug", "v1"], ["type", "t"], ["date", "2025-02-02"]]),
    { ...seed, body: undefined },
    null,
  );
  assert.equal(v.description, "");
});

test("validateSproutInput accepts an fr-only name", () => {
  const base = buildSproutInput(form([["sproutSlug", "v1"], ["type", "t"], ["date", "2025-02-02"]]), seed, null);
  assert.equal(validateSproutInput({ ...base, name: { fr: "Nom" } }).ok, true);
});

test("validateSproutInput rejects a name with no language present, message unchanged", () => {
  const base = buildSproutInput(form([["sproutSlug", "v1"], ["type", "t"], ["date", "2025-02-02"]]), seed, null);
  assert.deepEqual(validateSproutInput({ ...base, name: {} }), { ok: false, error: "sprout name is required" });
});
