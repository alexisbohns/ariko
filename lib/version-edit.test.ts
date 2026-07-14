import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVersionPatch, validateVersionPatch } from "./version-edit";

function form(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

test("buildVersionPatch maps and trims the editable fields", () => {
  const p = buildVersionPatch(
    form([
      ["name", "  New name "],
      ["type", " demo "],
      ["date", "2025-05-05"],
      ["description", "  a note "],
      ["state", "published"],
    ]),
  );
  assert.deepEqual(p, {
    name: "New name",
    type: "demo",
    date: "2025-05-05",
    description: "a note",
    state: "published",
  });
});

test("buildVersionPatch: state falls back to draft when missing", () => {
  assert.equal(buildVersionPatch(form([["name", "n"]])).state, "draft");
});

test("buildVersionPatch: state falls back to draft on an unrecognized value", () => {
  assert.equal(buildVersionPatch(form([["state", "bogus"]])).state, "draft");
});

test("buildVersionPatch: accepts private and published", () => {
  assert.equal(buildVersionPatch(form([["state", "private"]])).state, "private");
  assert.equal(buildVersionPatch(form([["state", "published"]])).state, "published");
});

test("validateVersionPatch: passes a complete patch (empty description is allowed)", () => {
  assert.deepEqual(
    validateVersionPatch({ name: "n", type: "t", date: "2025-01-01", description: "", state: "draft" }),
    { ok: true },
  );
});

test("validateVersionPatch: missing name / type / date are each rejected with their message", () => {
  assert.deepEqual(validateVersionPatch({ name: "", type: "t", date: "d", description: "", state: "draft" }), {
    ok: false,
    error: "version name is required",
  });
  assert.deepEqual(validateVersionPatch({ name: "n", type: "", date: "d", description: "", state: "draft" }), {
    ok: false,
    error: "version type is required",
  });
  assert.deepEqual(validateVersionPatch({ name: "n", type: "t", date: "", description: "", state: "draft" }), {
    ok: false,
    error: "version date is required",
  });
});
