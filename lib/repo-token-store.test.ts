// lib/repo-token-store.test.ts
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { getDb, closeDb } from "./db";
import { authorizeRepo, listTokens, mintToken, revokePlant } from "./repo-token-store";

const hasDb = Boolean(process.env.MONGODB_URI);
const PLANT = "test-repo-token-plant";

async function cleanup() {
  const db = await getDb();
  await db.collection("tokens").deleteMany({ plant: PLANT });
  await db.collection("plants").deleteMany({ slug: PLANT });
}

before(async () => {
  if (!hasDb) return;
  await cleanup();
  const db = await getDb();
  await db.collection("plants").insertOne({ slug: PLANT, name: "T", description: "" });
});
after(async () => {
  if (!hasDb) return;
  await cleanup();
  await closeDb();
});

test("mint → authorize round-trip; plaintext never stored", { skip: !hasDb }, async () => {
  const token = await mintToken(PLANT, "test");
  assert.deepEqual(await authorizeRepo(`Bearer ${token}`), { ok: true, plant: PLANT });
  const db = await getDb();
  const doc = await db.collection("tokens").findOne({ plant: PLANT, revokedAt: { $exists: false } });
  assert.ok(doc);
  assert.equal(JSON.stringify(doc).includes(token), false);
});

test("minting again revokes the previous token", { skip: !hasDb }, async () => {
  const first = await mintToken(PLANT, "one");
  const second = await mintToken(PLANT, "two");
  assert.deepEqual(await authorizeRepo(`Bearer ${first}`), { ok: false });
  assert.deepEqual(await authorizeRepo(`Bearer ${second}`), { ok: true, plant: PLANT });
  const live = (await listTokens()).filter((t) => t.plant === PLANT && !t.revokedAt);
  assert.equal(live.length, 1);
});

test("revokePlant revokes", { skip: !hasDb }, async () => {
  const token = await mintToken(PLANT, "x");
  assert.equal(await revokePlant(PLANT), 1);
  assert.deepEqual(await authorizeRepo(`Bearer ${token}`), { ok: false });
});

test("mintToken refuses an unknown plant", { skip: !hasDb }, async () => {
  await assert.rejects(mintToken("test-repo-token-nope", "x"), /unknown plant/);
});

test("a token document without a plant authorizes nothing", { skip: !hasDb }, async () => {
  const token = "ariko_stray_" + "x".repeat(32);
  const db = await getDb();
  const { hashToken } = await import("./repo-token");
  await db.collection("tokens").insertOne({ pod: "stray", hash: hashToken(token), label: "stray", createdAt: "2026-11-14", plant: undefined });
  try {
    assert.deepEqual(await authorizeRepo(`Bearer ${token}`), { ok: false });
  } finally {
    await db.collection("tokens").deleteOne({ hash: hashToken(token) });
  }
});

test("authorizeRepo: no header, non-repo token, unknown token", async () => {
  // The first two never touch the database, so they run without one.
  assert.deepEqual(await authorizeRepo(null), { ok: false });
  assert.deepEqual(await authorizeRepo("Bearer tok_legacy"), { ok: false });
  if (hasDb) assert.deepEqual(await authorizeRepo("Bearer ariko_x_unknown"), { ok: false });
});
