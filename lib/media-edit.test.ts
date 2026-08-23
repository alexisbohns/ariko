import { test } from "node:test";
import assert from "node:assert/strict";
import type { Media } from "./data";
import { buildMediaPatch } from "./media-edit";

const IMG_A: Media = { kind: "image", storageKey: "k1", url: "https://cdn/1.jpg" };
const IMG_B: Media = { kind: "image", storageKey: "k2", url: "https://cdn/2.jpg" };

function formOf(entries: unknown[]): FormData {
  const form = new FormData();
  for (const e of entries) form.append("media", JSON.stringify(e));
  return form;
}

test("an untouched list writes nothing", () => {
  const result = buildMediaPatch({ media: [IMG_A, IMG_B] }, formOf([IMG_A, IMG_B]));
  assert.equal(result.dirty, false);
});

test("a reorder is a change", () => {
  const result = buildMediaPatch({ media: [IMG_A, IMG_B] }, formOf([IMG_B, IMG_A]));
  assert.equal(result.dirty, true);
  if (result.dirty) {
    assert.deepEqual(result.media.map((m) => (m.kind === "image" ? m.storageKey : "")), ["k2", "k1"]);
  }
});

test("a removal is a change", () => {
  const result = buildMediaPatch({ media: [IMG_A, IMG_B] }, formOf([IMG_A]));
  assert.equal(result.dirty, true);
  if (result.dirty) assert.equal(result.media.length, 1);
});

test("editing alt text is a change", () => {
  const result = buildMediaPatch({ media: [IMG_A] }, formOf([{ ...IMG_A, alt: "a cat" }]));
  assert.equal(result.dirty, true);
  if (result.dirty && result.media[0].kind === "image") {
    assert.equal(result.media[0].alt, "a cat");
  }
});

test("a newly added bare link gets its provider derived server-side", () => {
  const result = buildMediaPatch({ media: [] }, formOf([{ kind: "embed", url: "https://youtu.be/abc123" }]));
  assert.equal(result.dirty, true);
  if (result.dirty && result.media[0].kind === "embed") {
    assert.equal(result.media[0].provider, "youtube");
    assert.equal(result.media[0].embedId, "abc123");
  }
});

test("a sprout with no stored media compares against an empty list", () => {
  assert.equal(buildMediaPatch({}, formOf([])).dirty, false);
  assert.equal(buildMediaPatch({}, formOf([IMG_A])).dirty, true);
});

test("clearing every entry is a change, not a no-op", () => {
  const result = buildMediaPatch({ media: [IMG_A] }, formOf([]));
  assert.equal(result.dirty, true);
  if (result.dirty) assert.deepEqual(result.media, []);
});

// A stored entry arrives from Mongo and a submitted one is rebuilt by the
// browser; their JSON key ORDER can differ while the entries are identical.
// The comparison must not mistake that for an edit and rewrite the document.
test("key order does not make an unchanged list look dirty", () => {
  const stored: Media = { kind: "image", storageKey: "k", url: "https://cdn/x.jpg", alt: "a" };
  const submitted = { alt: "a", url: "https://cdn/x.jpg", storageKey: "k", kind: "image" };
  assert.equal(buildMediaPatch({ media: [stored] }, formOf([submitted])).dirty, false);
});
