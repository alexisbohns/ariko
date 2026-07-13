import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loadRawSeed } from "./store";
import { closeDb, getDb } from "./db";

const hasDb = Boolean(process.env.MONGODB_URI);

// Release the cached Mongo connection so the test runner exits on its own.
after(async () => {
  await closeDb();
});

test("loadRawSeed returns arrays for all three collections", { skip: !hasDb }, async () => {
  const raw = await loadRawSeed();
  assert.ok(Array.isArray(raw.molecules));
  assert.ok(Array.isArray(raw.atoms));
  assert.ok(Array.isArray(raw.versions));
});

// Insert a probe so this verifies the projection even when the DB is otherwise
// empty (a loop over zero ambient docs would pass vacuously).
test("loadRawSeed returns documents without Mongo _id", { skip: !hasDb }, async () => {
  const db = await getDb();
  const probe = { slug: "__store_probe__", name: "Probe", domain: "music" as const, description: "" };
  await db.collection("molecules").updateOne({ slug: probe.slug }, { $set: probe }, { upsert: true });
  try {
    const found = (await loadRawSeed()).molecules?.find((m) => m.slug === probe.slug);
    assert.ok(found, "probe molecule should be loaded");
    assert.equal("_id" in (found as object), false);
  } finally {
    await db.collection("molecules").deleteOne({ slug: probe.slug });
  }
});
