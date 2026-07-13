import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loadRawSeed } from "./store";
import { closeDb } from "./db";

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

test("loadRawSeed strips Mongo _id from documents", { skip: !hasDb }, async () => {
  const raw = await loadRawSeed();
  for (const doc of [...(raw.molecules ?? []), ...(raw.atoms ?? []), ...(raw.versions ?? [])]) {
    assert.equal("_id" in (doc as object), false);
  }
});
