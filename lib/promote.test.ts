import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveParentChoice, buildVersionInput, validateVersionInput } from "./promote";
import type { Capture } from "./data";

const capture: Capture = {
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

test("buildVersionInput is WYSIWYG: blank boxes store blank (nothing resurrected from the capture)", () => {
  // The triage PAGE prefills the boxes (name from capture.title, descriptions per
  // language via textPart) — the builder itself never falls back, so clearing a
  // box genuinely clears that content and a blank name fails validation.
  const v = buildVersionInput(form([["versionSlug", "v1"], ["type", "demo"], ["date", "2025-02-02"]]), capture, "a1");
  assert.equal(v.slug, "v1");
  assert.equal(v.name, "");
  assert.equal(v.description, "");
  assert.equal(validateVersionInput(v).ok, false);
  assert.equal(v.type, "demo");
  assert.equal(v.date, "2025-02-02");
  assert.equal(v.state, "draft"); // default
  assert.deepEqual(v.parents, ["atom:a1"]);
  assert.deepEqual(v.media, capture.media);
  assert.deepEqual(v.source, capture.source);
});

test("buildVersionInput uses provided fields over prefill and parses state", () => {
  const v = buildVersionInput(
    form([["versionSlug", "v1"], ["versionName", "Live cut"], ["type", "live"], ["date", "2025-02-02"], ["description", "at the club"], ["state", "published"]]),
    capture,
    "a1",
  );
  assert.equal(v.name, "Live cut");
  assert.equal(v.description, "at the club");
  assert.equal(v.state, "published");
});

test("buildVersionInput yields a parentless version when atomParentSlug is null", () => {
  const v = buildVersionInput(form([["versionSlug", "v1"], ["type", "t"], ["date", "2025-02-02"]]), capture, null);
  assert.deepEqual(v.parents, []);
});

test("buildVersionInput coerces an unexpected state to draft", () => {
  const v = buildVersionInput(form([["versionSlug", "v1"], ["type", "t"], ["date", "2025-02-02"], ["state", "bogus"]]), capture, null);
  assert.equal(v.state, "draft");
});

test("validateVersionInput rejects missing required fields", () => {
  const base = buildVersionInput(
    form([["versionSlug", "v1"], ["versionName", "n"], ["type", "t"], ["date", "2025-02-02"]]),
    capture,
    null,
  );
  assert.equal(validateVersionInput(base).ok, true);
  assert.equal(validateVersionInput({ ...base, slug: "" }).ok, false);
  assert.equal(validateVersionInput({ ...base, type: "" }).ok, false);
  assert.equal(validateVersionInput({ ...base, date: "" }).ok, false);
});

test("validateVersionInput rejects a name cleared in both languages", () => {
  const v = buildVersionInput(form([["versionSlug", "v1"], ["type", "t"], ["date", "2025-02-02"]]), capture, null);
  assert.equal(v.name, "");
  assert.equal(validateVersionInput(v).ok, false);
});

// --- Bilingual widening (B1): paired en/fr fields compose via composeText,
// WYSIWYG (the page prefills, the builder never falls back); validation counts a
// name present in either language.

test("buildVersionInput composes a bilingual name from the paired fields", () => {
  const v = buildVersionInput(
    form([["versionSlug", "v1"], ["versionName", "Live cut"], ["versionNameFr", "Prise live"], ["type", "t"], ["date", "2025-02-02"]]),
    capture,
    null,
  );
  assert.deepEqual(v.name, { en: "Live cut", fr: "Prise live" });
});

test("buildVersionInput keeps an fr-only name (no capture-title fallback, no en borrowed)", () => {
  const v = buildVersionInput(
    form([["versionSlug", "v1"], ["versionNameFr", "Prise live"], ["type", "t"], ["date", "2025-02-02"]]),
    capture,
    null,
  );
  assert.deepEqual(v.name, { fr: "Prise live" });
});

test("buildVersionInput composes a bilingual description — a typed pair wins over the note", () => {
  const v = buildVersionInput(
    form([["versionSlug", "v1"], ["type", "t"], ["date", "2025-02-02"], ["description", "at the club"], ["descriptionFr", "au club"]]),
    capture,
    null,
  );
  assert.deepEqual(v.description, { en: "at the club", fr: "au club" });
});

test("buildVersionInput: an fr-only typed description also wins over the note", () => {
  const v = buildVersionInput(
    form([["versionSlug", "v1"], ["type", "t"], ["date", "2025-02-02"], ["descriptionFr", "au club"]]),
    capture,
    null,
  );
  assert.deepEqual(v.description, { fr: "au club" });
});

test("buildVersionInput: blank description fields and no capture body yield an empty string", () => {
  const v = buildVersionInput(
    form([["versionSlug", "v1"], ["type", "t"], ["date", "2025-02-02"]]),
    { ...capture, body: undefined },
    null,
  );
  assert.equal(v.description, "");
});

test("validateVersionInput accepts an fr-only name", () => {
  const base = buildVersionInput(form([["versionSlug", "v1"], ["type", "t"], ["date", "2025-02-02"]]), capture, null);
  assert.equal(validateVersionInput({ ...base, name: { fr: "Nom" } }).ok, true);
});

test("validateVersionInput rejects a name with no language present, message unchanged", () => {
  const base = buildVersionInput(form([["versionSlug", "v1"], ["type", "t"], ["date", "2025-02-02"]]), capture, null);
  assert.deepEqual(validateVersionInput({ ...base, name: {} }), { ok: false, error: "version name is required" });
});
