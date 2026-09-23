import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContentPatch, MAX_CONTENT_BYTES } from "./content-edit";

test("an unchanged document is not dirty and yields no patch", () => {
  assert.deepEqual(buildContentPatch({ content: "same" }, "same", "en"), { ok: true, dirty: false });
  assert.deepEqual(buildContentPatch({ content: { en: "same" } }, "same", "en"), { ok: true, dirty: false });
  // A document that has never had content, saved empty, is also not dirty.
  assert.deepEqual(buildContentPatch({}, "", "en"), { ok: true, dirty: false });
});

test("a plain string stays a plain string", () => {
  const result = buildContentPatch({ content: "old" }, "new", "en");
  assert.equal(result.ok && result.dirty && result.patch.content, "new");
});

test("a bilingual value keeps its fr half untouched", () => {
  // Spec §2.9: the editor only ever edits `en`, and must never destroy `fr`.
  const result = buildContentPatch({ content: { en: "old", fr: "français" } }, "new", "en");
  assert.deepEqual(result.ok && result.dirty && result.patch.content, {
    en: "new",
    fr: "français",
  });
});

test("mirrored relations are re-derived and hand-authored kinds survive", () => {
  // Spec §2.10 — the regression articles-store would have introduced by
  // passing `undefined` as the existing relations.
  const result = buildContentPatch(
    {
      content: "::entity{ref=bean:gone}",
      relations: [
        { kind: "evolves-from", ref: "sprout:earlier" },
        { kind: "embeds", ref: "bean:gone" },
      ],
    },
    "::entity{ref=bean:fresh}\n\nand :entity[M]{ref=plant:p} inline",
    "en",
  );
  assert.deepEqual(result.ok && result.dirty && result.patch.relations, [
    { kind: "evolves-from", ref: "sprout:earlier" },
    { kind: "embeds", ref: "bean:fresh" },
    { kind: "mentions", ref: "plant:p" },
  ]);
});

test("content over the ceiling is refused, and the message names the limit", () => {
  const tooBig = "x".repeat(MAX_CONTENT_BYTES + 1);
  const result = buildContentPatch({}, tooBig, "en");
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.error : "", /64 KiB/);
});

test("the ceiling counts bytes, not characters", () => {
  // "é" is two bytes in UTF-8, so half the ceiling in é's must exceed it.
  const result = buildContentPatch({}, "é".repeat(MAX_CONTENT_BYTES / 2 + 1), "en");
  assert.equal(result.ok, false);
});

test("a French save over a plain string makes it bilingual", () => {
  const result = buildContentPatch({ content: "english" }, "français", "fr");
  assert.deepEqual(result.ok && result.dirty && result.patch.content, { en: "english", fr: "français" });
});

test("a French save leaves the English half byte-identical", () => {
  const en = "  # Title\n\ntrailing spaces kept  \n";
  const result = buildContentPatch({ content: { en, fr: "ancien" } }, "nouveau", "fr");
  assert.deepEqual(result.ok && result.dirty && result.patch.content, { en, fr: "nouveau" });
});

test("clearing the French half un-translates the article back to a plain string", () => {
  const result = buildContentPatch({ content: { en: "english", fr: "français" } }, "", "fr");
  assert.equal(result.ok && result.dirty && result.patch.content, "english");
  // Whitespace-only counts as blank.
  const ws = buildContentPatch({ content: { en: "english", fr: "français" } }, " \n ", "fr");
  assert.equal(ws.ok && ws.dirty && ws.patch.content, "english");
});

test("an English-blank document stores only its French half", () => {
  const result = buildContentPatch({}, "seulement", "fr");
  assert.deepEqual(result.ok && result.dirty && result.patch.content, { fr: "seulement" });
  const cleared = buildContentPatch({ content: { en: "english", fr: "français" } }, "", "en");
  assert.deepEqual(cleared.ok && cleared.dirty && cleared.patch.content, { fr: "français" });
});

test("an untouched French save is not dirty", () => {
  assert.deepEqual(buildContentPatch({ content: { en: "e", fr: "f" } }, "f", "fr"), { ok: true, dirty: false });
  // Opening the French view of an English-only article and saving it empty
  // writes nothing — the editor's own gate normally stops this first.
  assert.deepEqual(buildContentPatch({ content: "english" }, "", "fr"), { ok: true, dirty: false });
});

test("French refs mirror into relations", () => {
  const result = buildContentPatch({ content: "prose" }, "::entity{ref=bean:k}", "fr");
  assert.deepEqual(result.ok && result.dirty && result.patch.relations, [{ kind: "embeds", ref: "bean:k" }]);
});

test("the ceiling applies to the half being written", () => {
  // Each half may be close to the ceiling: the article door's limit was always
  // about one document in one language.
  const near = "x".repeat(MAX_CONTENT_BYTES - 1);
  const ok = buildContentPatch({ content: { en: near } }, near, "fr");
  assert.equal(ok.ok, true);
  const over = buildContentPatch({ content: "short" }, "x".repeat(MAX_CONTENT_BYTES + 1), "fr");
  assert.equal(over.ok, false);
});
