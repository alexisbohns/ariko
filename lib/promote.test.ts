import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveParentChoice, buildVersionInput, validateVersionInput } from "./promote";
import type { Capture } from "./data";

const capture: Capture = {
  id: "c1",
  title: "Song idea",
  body: { en: "hummed melody", fr: "mélodie" },
  media: [{ kind: "embed", provider: "youtube", url: "https://youtu.be/x", embedId: "x" }],
  source: { kind: "manual", capturedAt: "2025-01-01T00:00:00.000Z" },
  status: "inbox",
  promotedTo: [],
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

function form(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

test("resolveParentChoice: a non-blank new slug wins (create)", () => {
  assert.deepEqual(resolveParentChoice("  new-slug ", "existing"), { mode: "create", slug: "new-slug" });
});

test("resolveParentChoice: falls back to the selected existing slug", () => {
  assert.deepEqual(resolveParentChoice("", " picked "), { mode: "existing", slug: "picked" });
});

test("resolveParentChoice: none when both blank", () => {
  assert.deepEqual(resolveParentChoice("  ", ""), { mode: "none" });
});

test("buildVersionInput prefills name/description from the capture and carries media/source", () => {
  const v = buildVersionInput(form([["versionSlug", "v1"], ["type", "demo"], ["date", "2025-02-02"]]), capture, "a1");
  assert.equal(v.slug, "v1");
  assert.equal(v.name, "Song idea"); // prefilled from capture.title
  assert.equal(v.description, "hummed melody"); // prefilled from capture.body via resolveText
  assert.equal(v.type, "demo");
  assert.equal(v.date, "2025-02-02");
  assert.equal(v.state, "draft"); // default
  assert.deepEqual(v.parents, ["atom:a1"]);
  assert.deepEqual(v.media, capture.media);
  assert.deepEqual(v.source, capture.source);
});

test("buildVersionInput uses provided fields over prefill and parses state", () => {
  const v = buildVersionInput(
    form([["versionSlug", "v1"], ["versionName", "Live cut"], ["type", "live"], ["date", "2025-02-02"], ["description", "at the club"], ["state", "published"]]),
    capture,
    "a1",
  );
  assert.equal(v.name, "Live cut");
  assert.equal(v.description, "at the club");
  assert.equal(v.state, "published");
});

test("buildVersionInput yields a parentless version when atomParentSlug is null", () => {
  const v = buildVersionInput(form([["versionSlug", "v1"], ["type", "t"], ["date", "2025-02-02"]]), capture, null);
  assert.deepEqual(v.parents, []);
});

test("buildVersionInput coerces an unexpected state to draft", () => {
  const v = buildVersionInput(form([["versionSlug", "v1"], ["type", "t"], ["date", "2025-02-02"], ["state", "bogus"]]), capture, null);
  assert.equal(v.state, "draft");
});

test("validateVersionInput rejects missing required fields", () => {
  const base = buildVersionInput(form([["versionSlug", "v1"], ["type", "t"], ["date", "2025-02-02"]]), capture, null);
  assert.equal(validateVersionInput(base).ok, true);
  assert.equal(validateVersionInput({ ...base, slug: "" }).ok, false);
  assert.equal(validateVersionInput({ ...base, type: "" }).ok, false);
  assert.equal(validateVersionInput({ ...base, date: "" }).ok, false);
});

test("validateVersionInput rejects an empty name (e.g. blank title + blank field)", () => {
  const v = buildVersionInput(form([["versionSlug", "v1"], ["type", "t"], ["date", "2025-02-02"]]), { ...capture, title: "" }, null);
  assert.equal(v.name, "");
  assert.equal(validateVersionInput(v).ok, false);
});
