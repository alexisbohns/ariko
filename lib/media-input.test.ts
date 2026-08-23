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
