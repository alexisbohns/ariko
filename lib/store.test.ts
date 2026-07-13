import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loadRawSeed, getPublicDataset } from "./store";
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

// Inserts BOTH a published and a draft probe: asserting the published one is
// present proves the public dataset isn't degenerately empty, so the "draft is
// absent" assertion can't pass vacuously.
test("public dataset includes published but excludes drafted versions", { skip: !hasDb }, async () => {
  const db = await getDb();
  const base = { type: "note", date: "2099-01-01", description: "leak probe", parents: [] };
  const published = { ...base, slug: "__leak_probe_published__", name: "Published Probe", state: "published" as const };
  const draft = { ...base, slug: "__leak_probe_draft__", name: "Draft Probe", state: "draft" as const };
  await db.collection("versions").updateOne({ slug: published.slug }, { $set: published }, { upsert: true });
  await db.collection("versions").updateOne({ slug: draft.slug }, { $set: draft }, { upsert: true });
  try {
    const slugs = new Set((await getPublicDataset()).timelineVersions().map((e) => e.version.slug));
    assert.equal(slugs.has(published.slug), true, "published version missing — dataset is degenerate, test would pass vacuously");
    assert.equal(slugs.has(draft.slug), false, "draft version leaked into the public dataset");
  } finally {
    await db.collection("versions").deleteMany({ slug: { $in: [published.slug, draft.slug] } });
  }
});
