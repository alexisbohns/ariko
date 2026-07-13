import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCaptureBody } from "./capture-form";
import { validateInboxPayload } from "./inbox";

function form(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

test("maps title + en note into the raw ingestion body", () => {
  const body = buildCaptureBody(form([["title", "Hi"], ["note", "hello"], ["lang", "en"]]));
  assert.equal(body.title, "Hi");
  assert.deepEqual(body.body, { en: "hello" });
  assert.deepEqual(body.media, []);
  assert.deepEqual(body.source, { kind: "manual" });
});

test("routes the note into the fr locale when lang=fr", () => {
  const body = buildCaptureBody(form([["title", "Salut"], ["note", "bonjour"], ["lang", "fr"]]));
  assert.deepEqual(body.body, { fr: "bonjour" });
});

test("defaults lang to en when the field is missing or unexpected", () => {
  const body = buildCaptureBody(form([["title", "Hi"], ["note", "hello"]]));
  assert.deepEqual(body.body, { en: "hello" });
});

test("omits body entirely when the note is blank", () => {
  const body = buildCaptureBody(form([["title", "Hi"], ["note", "   "]]));
  assert.equal(body.body, undefined);
});

test("trims the title", () => {
  const body = buildCaptureBody(form([["title", "  Hi  "]]));
  assert.equal(body.title, "Hi");
});

test("turns each non-blank link into a bare embed and drops blanks", () => {
  const body = buildCaptureBody(
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
  const body = buildCaptureBody(form([["title", "Hi"], ["link", "https://youtu.be/abc123"]]));
  const r = validateInboxPayload(body);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.media[0].kind, "embed");
    if (r.value.media[0].kind === "embed") {
      assert.equal(r.value.media[0].provider, "youtube");
      assert.equal(r.value.media[0].embedId, "abc123");
    }
  }
});

test("a blank title yields a body that validateInboxPayload rejects", () => {
  const body = buildCaptureBody(form([["title", "   "]]));
  assert.equal(body.title, "");
  assert.equal(validateInboxPayload(body).ok, false);
});
