import { test } from "node:test";
import assert from "node:assert/strict";
import {
  processEnvelopes,
  sliceFeedFile,
  lastEnvelopeId,
  MAX_REFUSAL_RAW_BYTES,
} from "./pollen-sync";

function envelope(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    v: 1,
    id: "arkaik:01H0000000000000000000A001",
    at: "2026-08-01T10:00:00Z",
    source: "arkaik",
    kind: "shipped",
    title: "Something shipped",
    anchors: { plant: "plant:pbbls" },
    ...over,
  };
}

test("valid envelopes come back normalized, invalid become refusals", () => {
  const r = processEnvelopes([envelope(), { junk: true }]);
  assert.equal(r.valid.length, 1);
  assert.equal(r.valid[0].id, "arkaik:01H0000000000000000000A001");
  assert.equal(r.refusals.length, 1);
  assert.match(r.refusals[0].reason, /v must be 1/);
  assert.equal(r.refusals[0].raw, JSON.stringify({ junk: true }));
});

test("non-core kind is a warning, not a refusal", () => {
  const r = processEnvelopes([envelope({ kind: "idea.proposed" })]);
  assert.equal(r.valid.length, 1);
  assert.equal(r.refusals.length, 0);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /not in the v1 core/);
});

test("refusal raw is capped at 4 KiB", () => {
  const r = processEnvelopes([{ big: "x".repeat(10_000) }]);
  assert.equal(r.refusals[0].raw.length, MAX_REFUSAL_RAW_BYTES);
});

test("sliceFeedFile without cursor returns every parsed line", () => {
  const text = `${JSON.stringify(envelope({ id: "a:1" }))}\n\n${JSON.stringify(envelope({ id: "a:2" }))}\n`;
  const r = sliceFeedFile(text, null);
  assert.notEqual(r, "gone");
  if (r === "gone") return;
  assert.equal(r.entries.length, 2);
  assert.deepEqual(r.malformed, []);
});

test("sliceFeedFile with a cursor returns only lines after it", () => {
  const text = [envelope({ id: "a:1" }), envelope({ id: "a:2" }), envelope({ id: "a:3" })]
    .map((e) => JSON.stringify(e))
    .join("\n");
  const r = sliceFeedFile(text, "a:2");
  assert.notEqual(r, "gone");
  if (r === "gone") return;
  assert.deepEqual(r.entries.map((e) => (e as { id: string }).id), ["a:3"]);
});

test("sliceFeedFile with a vanished cursor is gone (410-equivalent)", () => {
  assert.equal(sliceFeedFile(JSON.stringify(envelope({ id: "a:1" })), "a:404"), "gone");
});

test("sliceFeedFile records unparseable lines after the cursor as malformed", () => {
  const text = `${JSON.stringify(envelope({ id: "a:1" }))}\nnot json\n`;
  const r = sliceFeedFile(text, "a:1");
  assert.notEqual(r, "gone");
  if (r === "gone") return;
  assert.deepEqual(r.entries, []);
  assert.equal(r.malformed.length, 1);
  assert.match(r.malformed[0].reason, /unparseable/);
});

test("lastEnvelopeId takes the last string id, skipping junk", () => {
  assert.equal(lastEnvelopeId([envelope({ id: "a:1" }), { junk: true }]), "a:1");
  assert.equal(lastEnvelopeId([{ junk: true }]), null);
  assert.equal(lastEnvelopeId([]), null);
});
