import { test } from "node:test";
import assert from "node:assert/strict";
import { CORE_KINDS, POLLEN_VERSION, validatePollen } from "./pollen";

// A minimal valid envelope; individual tests break one field at a time.
function grain(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    v: 1,
    id: "arkaik:evt_857",
    at: "2026-08-10T18:12:00Z",
    source: "arkaik",
    kind: "shipped",
    title: "Lab-note webhook shipped",
    anchors: { plant: "plant:pbbls" },
    ...overrides,
  };
}

test("a minimal valid envelope passes with no warnings", () => {
  const r = validatePollen(grain());
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.warnings, []);
    assert.equal(r.value.id, "arkaik:evt_857");
    assert.equal(r.value.kind, "shipped");
  }
});

test("core vocabulary is exactly the umbrella's nine kinds", () => {
  assert.equal(POLLEN_VERSION, 1);
  assert.deepEqual([...CORE_KINDS].sort(), [
    "decided", "drafted", "milestone", "published", "release.tagged",
    "review.requested", "shipped", "task.done", "task.opened",
  ]);
});

test("field-by-field rejections carry clear, field-named errors", () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ v: undefined }, "v must be 1"],
    [{ v: 0 }, "v must be 1"],
    [{ v: 2 }, "newer than this validator"],
    [{ id: "" }, "id is required"],
    [{ id: undefined }, "id is required"],
    [{ at: "2026-08-10" }, "ISO 8601"],
    [{ at: "2026-08-10T18:12:00" }, "ISO 8601"], // timezone required
    [{ at: "not-a-date" }, "ISO 8601"],
    [{ source: "Arkaik" }, "source must be a lowercase slug"],
    [{ source: undefined }, "source must be a lowercase slug"],
    [{ kind: undefined }, "kind is required"],
    [{ kind: "Shipped" }, "kind must be lowercase dotted words"],
    [{ kind: "shipped." }, "kind must be lowercase dotted words"],
    [{ kind: "a".repeat(65) }, "kind must be lowercase dotted words"],
    [{ title: "" }, "title is required"],
    [{ title: { en: "" } }, "title is required"],
    [{ anchors: undefined }, "anchors.plant is required"],
    [{ anchors: {} }, "anchors.plant is required"],
    [{ anchors: { plant: "pbbls" } }, 'anchors.plant must be a "plant:<slug>" ref'],
    [{ anchors: { plant: "plant:pbbls", pod: "journal" } }, 'anchors.pod must be a "pod:<slug>" ref'],
    [{ anchors: { plant: "plant:pbbls", bean: "pod:x" } }, 'anchors.bean must be a "bean:<slug>" ref'],
    [{ refs: [{ url: "https://x" }] }, "each ref requires a label"],
    [{ refs: [{ label: "pr" }] }, "requires url or ref"],
    [{ visibility: "hidden" }, 'visibility must be "public" or "private"'],
    [{ payload: "detail" }, "payload must be an object"],
  ];
  for (const [overrides, want] of cases) {
    const r = validatePollen(grain(overrides));
    assert.equal(r.ok, false, JSON.stringify(overrides));
    if (!r.ok) assert.ok(r.error.includes(want), `${JSON.stringify(overrides)}: got "${r.error}", want "${want}"`);
  }
});

test("non-object input is rejected", () => {
  for (const bad of [null, "grain", 7, ["x"]]) {
    const r = validatePollen(bad);
    assert.equal(r.ok, false);
  }
});

test("a non-core kind matching the grammar passes with exactly one warning", () => {
  const r = validatePollen(grain({ kind: "practiced" }));
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.warnings, ['kind "practiced" is not in the v1 core vocabulary']);
});

test("dotted extension kinds are accepted", () => {
  const r = validatePollen(grain({ kind: "task.progress" }));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.warnings.length, 1);
});

test("unknown top-level keys are ignored, not copied through", () => {
  const r = validatePollen(grain({ mood: "sunny" }));
  assert.equal(r.ok, true);
  if (r.ok) assert.ok(!("mood" in r.value));
});

test("bilingual title normalizes like the inbox boundary", () => {
  const r = validatePollen(grain({ title: { en: " Shipped ", fr: "" } }));
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value.title, { en: "Shipped" });
});

test("payload over 32 KiB serialized is rejected", () => {
  const r = validatePollen(grain({ payload: { blob: "x".repeat(33 * 1024) } }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.includes("32 KiB"));
});

test("full envelope round-trips all optional fields", () => {
  const r = validatePollen(grain({
    anchors: { plant: "plant:bohns-music", pod: "pod:celesta", bean: "bean:felina" },
    refs: [{ label: "album", url: "https://melogram.app/celesta", ref: "album_12" }],
    visibility: "private",
    payload: { plays: 1000 },
  }));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.value.anchors, { plant: "plant:bohns-music", pod: "pod:celesta", bean: "bean:felina" });
    assert.deepEqual(r.value.refs, [{ label: "album", url: "https://melogram.app/celesta", ref: "album_12" }]);
    assert.equal(r.value.visibility, "private");
    assert.deepEqual(r.value.payload, { plays: 1000 });
  }
});

test("timezone offsets other than Z are accepted", () => {
  const r = validatePollen(grain({ at: "2026-08-10T20:12:00.500+02:00" }));
  assert.equal(r.ok, true);
});

test("calendar-invalid timestamps that Date.parse rolls over are rejected", () => {
  for (const at of ["2026-02-30T00:00:00Z", "2026-08-10T24:00:00Z", "2026-13-01T00:00:00Z"]) {
    const r = validatePollen(grain({ at }));
    assert.equal(r.ok, false, at);
    if (!r.ok) assert.ok(r.error.includes("ISO 8601"), at);
  }
});

test("non-JSON-serializable payload is rejected, not thrown", () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  const r = validatePollen(grain({ payload: circular }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.includes("JSON-serializable"));
});

test("payload cap is inclusive at exactly 32 KiB", () => {
  const overhead = Buffer.byteLength(JSON.stringify({ blob: "" }), "utf8");
  const exact = validatePollen(grain({ payload: { blob: "x".repeat(32 * 1024 - overhead) } }));
  assert.equal(exact.ok, true);
  const over = validatePollen(grain({ payload: { blob: "x".repeat(32 * 1024 - overhead + 1) } }));
  assert.equal(over.ok, false);
});
