import { test } from "node:test";
import assert from "node:assert/strict";
import type { Media } from "./data";
import { buildMediaPatch } from "./media-edit";

const IMG_A: Media = { kind: "image", storageKey: "k1", url: "https://cdn/1.jpg" };
const IMG_B: Media = { kind: "image", storageKey: "k2", url: "https://cdn/2.jpg" };

// The shape a MOUNTED picker submits: the readiness marker plus its rows.
function formOf(entries: unknown[]): FormData {
  const form = new FormData();
  form.set("media__ready", "1");
  for (const e of entries) form.append("media", JSON.stringify(e));
  return form;
}

// The shape a form submits when the picker never mounted — script off, or a
// submit that beat hydration. No marker, and no rows.
function unmountedForm(): FormData {
  return new FormData();
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

// The defect this guard exists for: MediaPicker renders nothing until it
// mounts, but the "Save media" button is server-rendered and submits fine
// without script. A zero-field submission from an unmounted picker is
// indistinguishable from a deliberate clear-all unless the mounted picker
// says it was there.
test("a form whose picker never mounted writes nothing, even though a real clear-all does", () => {
  const cleared = buildMediaPatch({ media: [IMG_A, IMG_B] }, formOf([]));
  assert.equal(cleared.dirty, true, "an admin who removed every row must still be able to save that");

  const unmounted = buildMediaPatch({ media: [IMG_A, IMG_B] }, unmountedForm());
  assert.equal(unmounted.dirty, false, "a script-off save must not delete stored media");
});

test("an unmounted picker writes nothing even when there is nothing stored", () => {
  assert.equal(buildMediaPatch({}, unmountedForm()).dirty, false);
});

// A stored entry arrives from Mongo and a submitted one is rebuilt by the
// browser; their JSON key ORDER can differ while the entries are identical.
// The comparison must not mistake that for an edit and rewrite the document.
test("key order does not make an unchanged list look dirty", () => {
  const stored: Media = { kind: "image", storageKey: "k", url: "https://cdn/x.jpg", alt: "a" };
  const submitted = { alt: "a", url: "https://cdn/x.jpg", storageKey: "k", kind: "image" };
  assert.equal(buildMediaPatch({ media: [stored] }, formOf([submitted])).dirty, false);
});

// A `|`-joined canonical form collided here: both of these produced
// "image|a|b|c|||", so buildMediaPatch reported dirty:false and the edit was
// silently discarded. `alt` is free-typed and `url` is format-unvalidated, so a
// literal `|` is reachable input.
test("a pipe inside a field cannot forge a match between different entries", () => {
  const stored: Media = { kind: "image", storageKey: "a", url: "b|c" };
  const submitted = { kind: "image", storageKey: "a|b", url: "c" };
  const result = buildMediaPatch({ media: [stored] }, formOf([submitted]));
  assert.equal(result.dirty, true, "a genuine edit must not be swallowed as unchanged");
  if (result.dirty && result.media[0].kind === "image") {
    assert.equal(result.media[0].storageKey, "a|b");
    assert.equal(result.media[0].url, "c");
  }
});

test("alt text containing a pipe round-trips as a real change", () => {
  const stored: Media = { kind: "image", storageKey: "k", url: "https://cdn/x.jpg" };
  const result = buildMediaPatch(
    { media: [stored] },
    formOf([{ ...stored, alt: "before | after" }]),
  );
  assert.equal(result.dirty, true);
  if (result.dirty && result.media[0].kind === "image") {
    assert.equal(result.media[0].alt, "before | after");
  }
});

// A corrupted save must not be mistaken for a deliberate clear-all: the first
// would destroy a stored list, and the two are distinguishable because removing
// every entry submits zero fields rather than unparseable ones.
test("submitting only unparseable entries writes nothing rather than clearing", () => {
  const result = buildMediaPatch({ media: [IMG_A, IMG_B] }, formOf([]));
  assert.equal(result.dirty, true, "a genuine clear-all still clears");

  // formOf([]) for the marker alone — the picker WAS mounted here; what failed
  // is the payload it emitted. Without the marker this would take the
  // never-mounted exit above and stop exercising the parse-failure guard.
  const corrupted = formOf([]);
  corrupted.append("media", "}{not json");
  corrupted.append("media", "also not json");
  const guarded = buildMediaPatch({ media: [IMG_A, IMG_B] }, corrupted);
  assert.equal(guarded.dirty, false, "a total parse failure must not wipe stored media");
});

test("a partial parse failure still saves what survived", () => {
  const partial = formOf([]);
  partial.append("media", "}{not json");
  partial.append("media", JSON.stringify(IMG_B));
  const result = buildMediaPatch({ media: [IMG_A, IMG_B] }, partial);
  assert.equal(result.dirty, true);
  if (result.dirty) assert.deepEqual(result.media.map((m) => (m.kind === "image" ? m.storageKey : "")), ["k2"]);
});

// The leading tuple element is the kind tag, so these can never canonicalize
// alike — pinned rather than left as something a reviewer once checked by hand.
test("an entry changing kind at the same position is a change", () => {
  const result = buildMediaPatch(
    { media: [IMG_A] },
    formOf([{ kind: "embed", url: "https://youtu.be/abc123" }]),
  );
  assert.equal(result.dirty, true);
  if (result.dirty) assert.equal(result.media[0].kind, "embed");
});

test("a dimension-only change is a change", () => {
  const stored: Media = { kind: "image", storageKey: "k", url: "https://cdn/x.jpg", width: 800, height: 600 };
  const result = buildMediaPatch({ media: [stored] }, formOf([{ ...stored, width: 1600 }]));
  assert.equal(result.dirty, true);
  if (result.dirty && result.media[0].kind === "image") assert.equal(result.media[0].width, 1600);
});
