import { test } from "node:test";
import assert from "node:assert/strict";
import { createOrUpdateSeed, getSeed, ensureSeedIndexes, markSeedPromoted, discardSeed, withDuplicateKeyRetry } from "./seeds";
import { closeDb, getDb } from "./db";

const hasDb = Boolean(process.env.MONGODB_URI);

async function cleanup() {
  const db = await getDb();
  await db.collection("captures").deleteMany({ title: /^__test__/ });
}

function dupErr(): Error & { code: number } {
  return Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
}

test("withDuplicateKeyRetry returns the second result after a lost upsert race", async () => {
  let calls = 0;
  const result = await withDuplicateKeyRetry(async () => {
    calls += 1;
    if (calls === 1) throw dupErr();
    return "winner";
  });
  assert.equal(result, "winner");
  assert.equal(calls, 2);
});

test("withDuplicateKeyRetry calls fn once on success", async () => {
  let calls = 0;
  assert.equal(await withDuplicateKeyRetry(async () => ++calls), 1);
  assert.equal(calls, 1);
});

test("withDuplicateKeyRetry propagates a second consecutive 11000", async () => {
  let calls = 0;
  await assert.rejects(
    withDuplicateKeyRetry(async () => {
      calls += 1;
      throw dupErr();
    }),
    (err: Error & { code?: number }) => err.code === 11000,
  );
  assert.equal(calls, 2);
});

test("withDuplicateKeyRetry propagates non-duplicate errors immediately", async () => {
  let calls = 0;
  await assert.rejects(
    withDuplicateKeyRetry(async () => {
      calls += 1;
      throw new Error("network down");
    }),
    /network down/,
  );
  assert.equal(calls, 1);
});

test("createOrUpdateSeed inserts a fresh manual seed", { skip: !hasDb }, async (t) => {
  await ensureSeedIndexes();
  t.after(cleanup);
  const { seed, created } = await createOrUpdateSeed({
    title: "__test__ manual one",
    media: [],
    source: { kind: "manual" },
  });
  assert.equal(created, true);
  assert.equal(seed.status, "inbox");
  assert.deepEqual(seed.promotedTo, []);
  assert.ok(seed.id);
  assert.ok(seed.createdAt);
});

test("two manual seeds (no externalId) are distinct documents", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const a = await createOrUpdateSeed({ title: "__test__ dup", media: [], source: { kind: "manual" } });
  const b = await createOrUpdateSeed({ title: "__test__ dup", media: [], source: { kind: "manual" } });
  assert.notEqual(a.seed.id, b.seed.id);
});

test("same (kind, externalId) upserts instead of duplicating", { skip: !hasDb }, async (t) => {
  await ensureSeedIndexes();
  t.after(cleanup);
  const first = await createOrUpdateSeed({
    title: "__test__ pr v1",
    media: [],
    source: { kind: "github", externalId: "__test__42" },
  });
  assert.equal(first.created, true);
  const second = await createOrUpdateSeed({
    title: "__test__ pr v2",
    media: [],
    source: { kind: "github", externalId: "__test__42" },
  });
  assert.equal(second.created, false);
  assert.equal(second.seed.id, first.seed.id); // same doc
  assert.equal(second.seed.createdAt, first.seed.createdAt); // preserved
  const reread = await getSeed(first.seed.id);
  assert.equal(reread?.title, "__test__ pr v2"); // content overwritten
  assert.notEqual(reread?.updatedAt, first.seed.updatedAt); // bumped
});

test("re-post preserves capturedAt from the first seed", { skip: !hasDb }, async (t) => {
  await ensureSeedIndexes();
  t.after(cleanup);
  const first = await createOrUpdateSeed({
    title: "__test__ cap",
    media: [],
    source: { kind: "github", externalId: "__test__capA" },
  });
  const firstCapturedAt = first.seed.source.capturedAt;
  assert.ok(firstCapturedAt);
  await new Promise((r) => setTimeout(r, 5));
  const second = await createOrUpdateSeed({
    title: "__test__ cap v2",
    media: [],
    source: { kind: "github", externalId: "__test__capA" },
  });
  assert.equal(second.seed.source.capturedAt, firstCapturedAt);
  assert.notEqual(second.seed.updatedAt, firstCapturedAt);
});

test("markSeedPromoted sets status and appends the sprout slug", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const { seed } = await createOrUpdateSeed({ title: "__test__ promote", media: [], source: { kind: "manual" } });
  await markSeedPromoted(seed.id, "ver-1");
  await markSeedPromoted(seed.id, "ver-1"); // idempotent add
  await markSeedPromoted(seed.id, "ver-2");
  const reread = await getSeed(seed.id);
  assert.equal(reread?.status, "promoted");
  assert.deepEqual([...(reread?.promotedTo ?? [])].sort(), ["ver-1", "ver-2"]);
});

test("discardSeed sets status discarded", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const { seed } = await createOrUpdateSeed({ title: "__test__ discard", media: [], source: { kind: "manual" } });
  await discardSeed(seed.id);
  const reread = await getSeed(seed.id);
  assert.equal(reread?.status, "discarded");
});

test.after(async () => {
  if (hasDb) await closeDb();
});
