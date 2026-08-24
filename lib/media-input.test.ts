import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMediaField } from "./media-input";

test("parses an image entry the picker emitted", () => {
  const out = parseMediaField([
    JSON.stringify({ kind: "image", storageKey: "beanstalk/k", url: "https://cdn/x.jpg", width: 8, height: 6 }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "image");
  if (out[0].kind === "image") assert.equal(out[0].storageKey, "beanstalk/k");
});

test("derives an embed's provider server-side from a bare entry", () => {
  const out = parseMediaField([JSON.stringify({ kind: "embed", url: "https://youtu.be/abc123" })]);
  assert.equal(out.length, 1);
  if (out[0].kind === "embed") {
    assert.equal(out[0].provider, "youtube");
    assert.equal(out[0].embedId, "abc123");
  }
});

test("preserves order across a mixed list — the cover depends on it", () => {
  const out = parseMediaField([
    JSON.stringify({ kind: "embed", url: "https://example.com/a" }),
    JSON.stringify({ kind: "image", storageKey: "k1", url: "https://cdn/1.jpg" }),
    JSON.stringify({ kind: "image", storageKey: "k2", url: "https://cdn/2.jpg" }),
  ]);
  assert.deepEqual(out.map((m) => (m.kind === "image" ? m.storageKey : m.kind)), [
    "embed",
    "k1",
    "k2",
  ]);
});

// A hidden field is client-controlled. A malformed one must never take down a
// capture — it is dropped, and everything valid around it still lands.
test("drops malformed entries instead of throwing, keeping the valid ones", () => {
  const out = parseMediaField([
    "not json at all",
    "null",
    "[]",
    JSON.stringify({ kind: "image", url: "https://cdn/x.jpg" }), // no storageKey
    JSON.stringify({ kind: "video", url: "https://cdn/x.mp4" }),
    JSON.stringify({ kind: "image", storageKey: "k", url: "https://cdn/ok.jpg" }),
  ]);
  assert.equal(out.length, 1);
  if (out[0].kind === "image") assert.equal(out[0].storageKey, "k");
});

test("an empty field list is an empty media list", () => {
  assert.deepEqual(parseMediaField([]), []);
});

// The exact shapes components/admin/media-picker.tsx emits — not shapes this
// test invented. parseMediaField DROPS what it cannot validate, so a mismatch
// here would make entries vanish silently on save rather than erroring: a
// future tightening of validateMediaEntry that rejected the empty-string
// provider would lose every added link, with a green suite.
test("parses the exact shapes MediaPicker emits", () => {
  const out = parseMediaField([
    // addLink: provider is the empty-string sentinel, not an omitted key —
    // MediaEmbed requires the field, so "undeclared" has to be spelled.
    JSON.stringify({ kind: "embed", provider: "", url: "https://youtu.be/abc123" }),
    // an alt box typed into and then cleared emits alt: ""
    JSON.stringify({ kind: "image", storageKey: "k", url: "https://cdn/x.jpg", alt: "" }),
  ]);
  assert.equal(out.length, 2, "neither shape may be dropped");
  assert.equal(out[0].kind, "embed");
  if (out[0].kind === "embed") assert.equal(out[0].provider, "youtube");
  assert.equal(out[1].kind, "image");
  // An empty alt is absent, not stored as "" — nonEmptyString drops it.
  if (out[1].kind === "image") assert.equal(out[1].alt, undefined);
});
