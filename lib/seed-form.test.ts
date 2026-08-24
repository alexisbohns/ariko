import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSeedBody } from "./seed-form";
import { validateInboxPayload } from "./inbox";

function form(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

test("maps title + en note into the raw ingestion body", () => {
  const body = buildSeedBody(form([["title", "Hi"], ["note", "hello"], ["lang", "en"]]));
  assert.equal(body.title, "Hi");
  assert.deepEqual(body.body, { en: "hello" });
  assert.deepEqual(body.media, []);
  assert.deepEqual(body.source, { kind: "manual" });
});

test("routes the note into the fr locale when lang=fr", () => {
  const body = buildSeedBody(form([["title", "Salut"], ["note", "bonjour"], ["lang", "fr"]]));
  assert.deepEqual(body.body, { fr: "bonjour" });
});

test("defaults lang to en when the field is missing or unexpected", () => {
  const body = buildSeedBody(form([["title", "Hi"], ["note", "hello"]]));
  assert.deepEqual(body.body, { en: "hello" });
});

test("omits body entirely when the note is blank", () => {
  const body = buildSeedBody(form([["title", "Hi"], ["note", "   "]]));
  assert.equal(body.body, undefined);
});

test("trims the title", () => {
  const body = buildSeedBody(form([["title", "  Hi  "]]));
  assert.equal(body.title, "Hi");
});

test("turns each non-blank link into a bare embed and drops blanks", () => {
  const body = buildSeedBody(
    form([
      ["title", "Hi"],
      ["link", "https://youtu.be/abc123"],
      ["link", "   "],
      ["link", "https://example.com/x"],
    ]),
  );
  assert.deepEqual(body.media, [
    { kind: "embed", url: "https://youtu.be/abc123" },
    { kind: "embed", url: "https://example.com/x" },
  ]);
});

test("output of a valid form passes validateInboxPayload with providers detected", () => {
  const body = buildSeedBody(form([["title", "Hi"], ["link", "https://youtu.be/dQw4w9WgXcQ"]]));
  const r = validateInboxPayload(body);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.media[0].kind, "embed");
    if (r.value.media[0].kind === "embed") {
      assert.equal(r.value.media[0].provider, "youtube");
      assert.equal(r.value.media[0].embedId, "dQw4w9WgXcQ");
    }
  }
});

test("a blank title yields a body that validateInboxPayload rejects", () => {
  const body = buildSeedBody(form([["title", "   "]]));
  assert.equal(body.title, "");
  assert.equal(validateInboxPayload(body).ok, false);
});

test("an image field from the picker becomes an image media entry", () => {
  const form = new FormData();
  form.set("title", "A capture");
  form.append(
    "image",
    JSON.stringify({ kind: "image", storageKey: "beanstalk/k", url: "https://cdn/x.jpg", alt: "a cat" }),
  );
  const body = buildSeedBody(form);
  assert.equal(body.media.length, 1);
  assert.equal(body.media[0].kind, "image");
});

test("links come first, then images, in declaration order", () => {
  const form = new FormData();
  form.set("title", "A capture");
  form.append("link", "https://example.com/a");
  form.append("image", JSON.stringify({ kind: "image", storageKey: "k1", url: "https://cdn/1.jpg" }));
  form.append("image", JSON.stringify({ kind: "image", storageKey: "k2", url: "https://cdn/2.jpg" }));
  const body = buildSeedBody(form);
  assert.deepEqual(
    body.media.map((m) => (m.kind === "image" ? m.storageKey : m.url)),
    ["https://example.com/a", "k1", "k2"],
  );
});

// The picker's fields are client-controlled. One bad entry must not cost the capture.
test("a malformed image field is dropped, and the capture survives", () => {
  const form = new FormData();
  form.set("title", "A capture");
  form.append("image", "}{not json");
  form.append("image", JSON.stringify({ kind: "image", storageKey: "k", url: "https://cdn/ok.jpg" }));
  const body = buildSeedBody(form);
  assert.equal(body.title, "A capture");
  assert.equal(body.media.length, 1);
});

test("a capture with no images is unchanged", () => {
  const form = new FormData();
  form.set("title", "A capture");
  form.append("link", "https://example.com/a");
  assert.equal(buildSeedBody(form).media.length, 1);
});
