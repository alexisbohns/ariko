import { test } from "node:test";
import assert from "node:assert/strict";
import { createOrUpdateCapture, getCapture, ensureCaptureIndexes, markCapturePromoted, discardCapture } from "./captures";
import { closeDb, getDb } from "./db";

const hasDb = Boolean(process.env.MONGODB_URI);

async function cleanup() {
  const db = await getDb();
  await db.collection("captures").deleteMany({ title: /^__test__/ });
}

test("createOrUpdateCapture inserts a fresh manual capture", { skip: !hasDb }, async (t) => {
  await ensureCaptureIndexes();
  t.after(cleanup);
  const { capture, created } = await createOrUpdateCapture({
    title: "__test__ manual one",
    media: [],
    source: { kind: "manual" },
  });
  assert.equal(created, true);
  assert.equal(capture.status, "inbox");
  assert.deepEqual(capture.promotedTo, []);
  assert.ok(capture.id);
  assert.ok(capture.createdAt);
});

test("two manual captures (no externalId) are distinct documents", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const a = await createOrUpdateCapture({ title: "__test__ dup", media: [], source: { kind: "manual" } });
  const b = await createOrUpdateCapture({ title: "__test__ dup", media: [], source: { kind: "manual" } });
  assert.notEqual(a.capture.id, b.capture.id);
});

test("same (kind, externalId) upserts instead of duplicating", { skip: !hasDb }, async (t) => {
  await ensureCaptureIndexes();
  t.after(cleanup);
  const first = await createOrUpdateCapture({
    title: "__test__ pr v1",
    media: [],
    source: { kind: "github", externalId: "__test__42" },
  });
  assert.equal(first.created, true);
  const second = await createOrUpdateCapture({
    title: "__test__ pr v2",
    media: [],
    source: { kind: "github", externalId: "__test__42" },
  });
  assert.equal(second.created, false);
  assert.equal(second.capture.id, first.capture.id); // same doc
  assert.equal(second.capture.createdAt, first.capture.createdAt); // preserved
  const reread = await getCapture(first.capture.id);
  assert.equal(reread?.title, "__test__ pr v2"); // content overwritten
  assert.notEqual(reread?.updatedAt, first.capture.updatedAt); // bumped
});

test("re-post preserves capturedAt from the first capture", { skip: !hasDb }, async (t) => {
  await ensureCaptureIndexes();
  t.after(cleanup);
  const first = await createOrUpdateCapture({
    title: "__test__ cap",
    media: [],
    source: { kind: "github", externalId: "__test__capA" },
  });
  const firstCapturedAt = first.capture.source.capturedAt;
  assert.ok(firstCapturedAt);
  await new Promise((r) => setTimeout(r, 5));
  const second = await createOrUpdateCapture({
    title: "__test__ cap v2",
    media: [],
    source: { kind: "github", externalId: "__test__capA" },
  });
  assert.equal(second.capture.source.capturedAt, firstCapturedAt);
  assert.notEqual(second.capture.updatedAt, firstCapturedAt);
});

test("markCapturePromoted sets status and appends the version slug", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const { capture } = await createOrUpdateCapture({ title: "__test__ promote", media: [], source: { kind: "manual" } });
  await markCapturePromoted(capture.id, "ver-1");
  await markCapturePromoted(capture.id, "ver-1"); // idempotent add
  await markCapturePromoted(capture.id, "ver-2");
  const reread = await getCapture(capture.id);
  assert.equal(reread?.status, "promoted");
  assert.deepEqual([...(reread?.promotedTo ?? [])].sort(), ["ver-1", "ver-2"]);
});

test("discardCapture sets status discarded", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const { capture } = await createOrUpdateCapture({ title: "__test__ discard", media: [], source: { kind: "manual" } });
  await discardCapture(capture.id);
  const reread = await getCapture(capture.id);
  assert.equal(reread?.status, "discarded");
});

test.after(async () => {
  if (hasDb) await closeDb();
});
