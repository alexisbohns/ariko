// lib/repo-token-store.test.ts
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { getDb, closeDb } from "./db";
import { authorizeRepo, listTokens, mintToken, revokePod } from "./repo-token-store";

const hasDb = Boolean(process.env.MONGODB_URI);
const POD = "test-repo-token-pod";

async function cleanup() {
  const db = await getDb();
  await db.collection("tokens").deleteMany({ pod: POD });
  await db.collection("pods").deleteMany({ slug: POD });
}

before(async () => {
  if (!hasDb) return;
  await cleanup();
  const db = await getDb();
  await db.collection("pods").insertOne({ slug: POD, name: "T", description: "", parents: [] });
});
after(async () => {
  if (!hasDb) return;
  await cleanup();
  await closeDb();
});

test("mint → authorize round-trip; plaintext never stored", { skip: !hasDb }, async () => {
  const token = await mintToken(POD, "test");
  assert.deepEqual(await authorizeRepo(`Bearer ${token}`), { ok: true, pod: POD });
  const db = await getDb();
  const doc = await db.collection("tokens").findOne({ pod: POD, revokedAt: { $exists: false } });
  assert.ok(doc);
  assert.equal(JSON.stringify(doc).includes(token), false);
});

test("minting again revokes the previous token", { skip: !hasDb }, async () => {
  const first = await mintToken(POD, "one");
  const second = await mintToken(POD, "two");
  assert.deepEqual(await authorizeRepo(`Bearer ${first}`), { ok: false });
  assert.deepEqual(await authorizeRepo(`Bearer ${second}`), { ok: true, pod: POD });
  const live = (await listTokens()).filter((t) => t.pod === POD && !t.revokedAt);
  assert.equal(live.length, 1);
});

test("revokePod revokes", { skip: !hasDb }, async () => {
  const token = await mintToken(POD, "x");
  assert.equal(await revokePod(POD), 1);
  assert.deepEqual(await authorizeRepo(`Bearer ${token}`), { ok: false });
});

test("mintToken refuses an unknown pod", { skip: !hasDb }, async () => {
  await assert.rejects(mintToken("test-repo-token-nope", "x"), /unknown pod/);
});

test("authorizeRepo: no header, non-repo token, unknown token", async () => {
  // The first two never touch the database, so they run without one.
  assert.deepEqual(await authorizeRepo(null), { ok: false });
  assert.deepEqual(await authorizeRepo("Bearer tok_legacy"), { ok: false });
  if (hasDb) assert.deepEqual(await authorizeRepo("Bearer ariko_x_unknown"), { ok: false });
});
