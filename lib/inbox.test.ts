import { test } from "node:test";
import assert from "node:assert/strict";
import { validateInboxPayload, normalizeMedia, validateMediaEntry } from "./inbox";

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
    suggested: { podSlug: "pbbls" },
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.value.body, { en: "hello", fr: "bonjour" });
    assert.equal(r.value.source.externalId, "42");
    assert.equal(r.value.suggested?.podSlug, "pbbls");
  }
});

test("normalizeMedia fills provider for a bare embed via detection", () => {
  const out = normalizeMedia([{ kind: "embed", url: "https://youtu.be/dQw4w9WgXcQ" }]);
  assert.equal(out[0].kind, "embed");
  if (out[0].kind === "embed") {
    assert.equal(out[0].provider, "youtube");
    assert.equal(out[0].embedId, "dQw4w9WgXcQ");
  }
});

test("normalizeMedia re-derives a typed embed's provider and leaves images untouched", () => {
  const out = normalizeMedia([
    { kind: "embed", provider: "spotify", url: "https://open.spotify.com/x" },
    { kind: "image", storageKey: "k", url: "https://cdn/x.jpg" },
  ]);
  // Same answer as before, but now because the URL says so, not the payload.
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

test("suggestion accepts legacy wire keys moleculeSlug/atomSlug as plantSlug/beanSlug", () => {
  const legacy = validateInboxPayload({
    title: "t",
    source: { kind: "github", externalId: "o/r#1" },
    suggested: { moleculeSlug: "pbbls", atomSlug: "ios", type: "feature" },
  });
  assert.ok(legacy.ok);
  assert.deepEqual(legacy.ok && legacy.value.suggested, {
    plantSlug: "pbbls",
    beanSlug: "ios",
    type: "feature",
  });
  const canonical = validateInboxPayload({
    title: "t",
    source: { kind: "github", externalId: "o/r#2" },
    suggested: { podSlug: "pbbls" },
  });
  assert.deepEqual(canonical.ok && canonical.value.suggested, { podSlug: "pbbls" });
});

test("suggested.moleculeSlug maps to plantSlug — repo slugs are plants since the re-tiering", () => {
  const r = validateInboxPayload({
    title: "t",
    source: { kind: "manual" },
    suggested: { moleculeSlug: "pbbls", atomSlug: "pbbls-webapp" },
  });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.value.suggested, { plantSlug: "pbbls", beanSlug: "pbbls-webapp" });
});

test("a blank canonical plantSlug shadows the legacy moleculeSlug (?? keeps the empty string)", () => {
  const r = validateInboxPayload({
    title: "t",
    source: { kind: "manual" },
    suggested: { plantSlug: "", moleculeSlug: "x" },
  });
  assert.ok(r.ok);
  // "" is not nullish, so ?? never reaches moleculeSlug; the blank then fails the
  // non-empty filter and NOTHING survives — suggested itself normalizes away.
  if (r.ok) assert.equal(r.value.suggested, undefined);
});

test("canonical plantSlug wins over the legacy moleculeSlug; podSlug passes through untouched", () => {
  const r = validateInboxPayload({
    title: "t",
    source: { kind: "manual" },
    suggested: { plantSlug: "ariko", moleculeSlug: "ignored", podSlug: "celesta" },
  });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.value.suggested, { plantSlug: "ariko", podSlug: "celesta" });
});

test("validateMediaEntry accepts a bare embed, leaving provider for normalizeMedia", () => {
  const r = validateMediaEntry({ kind: "embed", url: "https://youtu.be/abc123" });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value, { kind: "embed", url: "https://youtu.be/abc123" });
});

test("validateMediaEntry accepts an image with its optional fields", () => {
  const r = validateMediaEntry({
    kind: "image",
    storageKey: "beanstalk/k",
    url: "https://res.cloudinary.com/x.jpg",
    alt: "a cat",
    width: 800,
    height: 600,
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.kind, "image");
    if (r.value.kind === "image") {
      assert.equal(r.value.alt, "a cat");
      assert.equal(r.value.width, 800);
    }
  }
});

// provider is a TRUST SIGNAL once embeds are iframed (lib/embed-src.ts), and a
// signal a caller can set is no signal at all.
test("normalizeMedia derives the provider from the url, ignoring a declared one", () => {
  const out = normalizeMedia([
    { kind: "embed", provider: "soundcloud", url: "https://evil.test/anything" },
  ]);
  assert.equal(out[0].kind, "embed");
  if (out[0].kind === "embed") {
    assert.equal(out[0].provider, "link");
    assert.equal(out[0].url, "https://evil.test/anything");
  }
});

test("a declared embedId cannot be smuggled past detection either", () => {
  const out = normalizeMedia([
    { kind: "embed", provider: "youtube", embedId: "HIJACKED", url: "https://evil.test/x" },
  ]);
  if (out[0].kind === "embed") {
    assert.equal(out[0].provider, "link");
    assert.equal(out[0].embedId, undefined);
  }
});

test("a declared provider that agrees with the url is unaffected", () => {
  const out = normalizeMedia([
    { kind: "embed", provider: "spotify", url: "https://open.spotify.com/track/abc" },
  ]);
  if (out[0].kind === "embed") assert.equal(out[0].provider, "spotify");
});

// The exact strings validateInboxPayload has always returned. They are part of
// /api/inbox's contract, so the extraction must not reword them.
test("validateMediaEntry returns the established error strings", () => {
  assert.deepEqual(validateMediaEntry(null), {
    ok: false,
    error: "each media entry must be an object",
  });
  assert.deepEqual(validateMediaEntry({ kind: "embed" }), {
    ok: false,
    error: "embed media requires a url",
  });
  assert.deepEqual(validateMediaEntry({ kind: "image", url: "https://x" }), {
    ok: false,
    error: "image media requires storageKey and url",
  });
  assert.deepEqual(validateMediaEntry({ kind: "video", url: "https://x" }), {
    ok: false,
    error: "media entry kind must be 'embed' or 'image'",
  });
});
