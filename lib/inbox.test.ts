import { test } from "node:test";
import assert from "node:assert/strict";
import { validateInboxPayload, normalizeMedia } from "./inbox";

test("rejects a non-object body", () => {
  const r = validateInboxPayload(null);
  assert.equal(r.ok, false);
});

test("rejects a missing/empty title", () => {
  assert.equal(validateInboxPayload({ source: { kind: "manual" } }).ok, false);
  assert.equal(validateInboxPayload({ title: "  ", source: { kind: "manual" } }).ok, false);
});

test("rejects a missing source.kind", () => {
  assert.equal(validateInboxPayload({ title: "hi" }).ok, false);
  assert.equal(validateInboxPayload({ title: "hi", source: {} }).ok, false);
});

test("rejects a non-array media", () => {
  assert.equal(
    validateInboxPayload({ title: "hi", source: { kind: "manual" }, media: "x" }).ok,
    false,
  );
});

test("accepts a minimal valid payload and defaults media to []", () => {
  const r = validateInboxPayload({ title: "hi", source: { kind: "manual" } });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.title, "hi");
    assert.equal(r.value.source.kind, "manual");
    assert.deepEqual(r.value.media, []);
  }
});

test("carries body, content, suggested, and source fields through", () => {
  const r = validateInboxPayload({
    title: "PR #42",
    body: { en: "hello", fr: "bonjour" },
    source: { kind: "github", url: "https://x", externalId: "42" },
    suggested: { moleculeSlug: "pbbls" },
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.value.body, { en: "hello", fr: "bonjour" });
    assert.equal(r.value.source.externalId, "42");
    assert.equal(r.value.suggested?.moleculeSlug, "pbbls");
  }
});

test("normalizeMedia fills provider for a bare embed via detection", () => {
  const out = normalizeMedia([{ kind: "embed", url: "https://youtu.be/abc123" }]);
  assert.equal(out[0].kind, "embed");
  if (out[0].kind === "embed") {
    assert.equal(out[0].provider, "youtube");
    assert.equal(out[0].embedId, "abc123");
  }
});

test("normalizeMedia leaves an already-typed embed and images untouched", () => {
  const out = normalizeMedia([
    { kind: "embed", provider: "spotify", url: "https://open.spotify.com/x" },
    { kind: "image", storageKey: "k", url: "https://cdn/x.jpg" },
  ]);
  if (out[0].kind === "embed") assert.equal(out[0].provider, "spotify");
  assert.equal(out[1].kind, "image");
});

test("rejects malformed media entries instead of throwing", () => {
  assert.equal(validateInboxPayload({ title: "hi", source: { kind: "manual" }, media: [null] }).ok, false);
  assert.equal(validateInboxPayload({ title: "hi", source: { kind: "manual" }, media: [{}] }).ok, false);
  assert.equal(validateInboxPayload({ title: "hi", source: { kind: "manual" }, media: [{ kind: "embed" }] }).ok, false);
  assert.equal(validateInboxPayload({ title: "hi", source: { kind: "manual" }, media: [{ kind: "image", url: "https://x" }] }).ok, false);
  assert.equal(validateInboxPayload({ title: "hi", source: { kind: "manual" }, media: [42] }).ok, false);
});

test("rejects a present-but-non-string externalId (dedup key must not be silently dropped)", () => {
  assert.equal(validateInboxPayload({ title: "hi", source: { kind: "github", externalId: 42 } }).ok, false);
});

test("accepts a bilingual { en, fr } title and trims its parts", () => {
  const r = validateInboxPayload({
    title: { en: "  Relations ship  ", fr: " Les relations arrivent " },
    source: { kind: "github" },
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.value.title, { en: "Relations ship", fr: "Les relations arrivent" });
  }
});

test("accepts an fr-only object title", () => {
  const r = validateInboxPayload({ title: { fr: "Bonjour" }, source: { kind: "manual" } });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value.title, { fr: "Bonjour" });
});

test("drops blank-string title parts instead of storing them", () => {
  const r = validateInboxPayload({ title: { en: "Hi", fr: "   " }, source: { kind: "manual" } });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value.title, { en: "Hi" });
});

test("rejects junk titles", () => {
  const junk: unknown[] = [42, true, [], {}, { en: "" }, { fr: "   " }, { en: 42 }, { en: "ok", fr: 7 }];
  for (const title of junk) {
    assert.equal(
      validateInboxPayload({ title, source: { kind: "manual" } }).ok,
      false,
      `should reject title ${JSON.stringify(title)}`,
    );
  }
});
