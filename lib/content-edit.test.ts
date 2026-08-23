import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContentPatch, MAX_CONTENT_BYTES } from "./content-edit";

test("an unchanged document is not dirty and yields no patch", () => {
  assert.deepEqual(buildContentPatch({ content: "same" }, "same"), { ok: true, dirty: false });
  assert.deepEqual(buildContentPatch({ content: { en: "same" } }, "same"), { ok: true, dirty: false });
  // A document that has never had content, saved empty, is also not dirty.
  assert.deepEqual(buildContentPatch({}, ""), { ok: true, dirty: false });
});

test("a plain string stays a plain string", () => {
  const result = buildContentPatch({ content: "old" }, "new");
  assert.equal(result.ok && result.dirty && result.patch.content, "new");
});

test("a bilingual value keeps its fr half untouched", () => {
  // Spec §2.9: the editor only ever edits `en`, and must never destroy `fr`.
  const result = buildContentPatch({ content: { en: "old", fr: "français" } }, "new");
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
  );
  assert.deepEqual(result.ok && result.dirty && result.patch.relations, [
    { kind: "evolves-from", ref: "sprout:earlier" },
    { kind: "embeds", ref: "bean:fresh" },
    { kind: "mentions", ref: "plant:p" },
  ]);
});

test("content over the ceiling is refused, and the message names the limit", () => {
  const tooBig = "x".repeat(MAX_CONTENT_BYTES + 1);
  const result = buildContentPatch({}, tooBig);
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.error : "", /64 KiB/);
});

test("the ceiling counts bytes, not characters", () => {
  // "é" is two bytes in UTF-8, so half the ceiling in é's must exceed it.
  const result = buildContentPatch({}, "é".repeat(MAX_CONTENT_BYTES / 2 + 1));
  assert.equal(result.ok, false);
});
