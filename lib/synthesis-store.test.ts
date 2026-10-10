import { test, after } from "node:test";
import assert from "node:assert/strict";
import { loadWeekMaterial, upsertDigestDrafts } from "./synthesis-store";
import { closeDb, getDb } from "./db";
import type { DraftSprout } from "./synthesis";

// DB-backed (run via `npm run test:db`). The route tests are DB-free guards —
// 401 and 400 before any read — so the ONE write this door makes is pinned
// here: the stored shape is the journal model's (`kind`, `about`), not the
// wire's (`parents`) nor the pre-migration shape (`type`, `parents`).
const hasDb = Boolean(process.env.MONGODB_URI);

after(async () => {
  await closeDb();
});

async function cleanup() {
  const db = await getDb();
  await db.collection("plants").deleteMany({ slug: /^__test__/ });
  await db.collection("beans").deleteMany({ slug: /^__test__/ });
  await db.collection("sprouts").deleteMany({ slug: /^__test__/ });
}

function draft(over: Partial<DraftSprout> = {}): DraftSprout {
  return {
    slug: "__test__digest-pbbls-2026-w34",
    name: "Week 34",
    date: "2026-08-23",
    parents: ["bean:__test__digest-pbbls"],
    content: "The week in pbbls…",
    ...over,
  };
}

test("a draft is stored with kind digest and about — never type or parents", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  const r = await upsertDigestDrafts([draft()]);
  assert.deepEqual(r, { ok: true, written: 1 });

  const stored = await db.collection("sprouts").findOne({ slug: "__test__digest-pbbls-2026-w34" });
  assert.ok(stored);
  assert.equal(stored.kind, "digest");
  assert.deepEqual(stored.about, ["bean:__test__digest-pbbls"]);
  assert.equal("type" in stored, false);
  assert.equal("parents" in stored, false);
  // Draft by construction: the door structurally cannot publish.
  assert.equal("state" in stored, false);
});

// A digest drafted BEFORE the migration carries `type: "digest"` and
// `parents: ["bean:…"]`. The routine re-posts a week whenever it re-runs, and
// that re-post must leave the sprout in ONE shape — the $unset rides on the
// same write as the $set, so there is no document that has both.
test("a pre-migration draft re-posted loses its type and parents in the same write", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("sprouts").insertOne({
    slug: "__test__digest-pbbls-2026-w34",
    name: "Week 34, old shape",
    type: "digest",
    date: "2026-08-23",
    parents: ["bean:__test__digest-pbbls"],
    content: "old",
    description: "",
  });

  const r = await upsertDigestDrafts([draft({ content: "new" })]);
  assert.deepEqual(r, { ok: true, written: 1 });
  assert.equal(await db.collection("sprouts").countDocuments({ slug: "__test__digest-pbbls-2026-w34" }), 1);

  const stored = await db.collection("sprouts").findOne({ slug: "__test__digest-pbbls-2026-w34" });
  assert.ok(stored);
  assert.equal(stored.content, "new");
  assert.equal(stored.kind, "digest");
  assert.deepEqual(stored.about, ["bean:__test__digest-pbbls"]);
  assert.equal("type" in stored, false);
  assert.equal("parents" in stored, false);
});

test("a reviewed sprout — any state at all — refuses the whole batch", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("sprouts").insertOne({
    slug: "__test__digest-pbbls-2026-w34",
    name: "Reviewed",
    kind: "digest",
    date: "2026-08-23",
    about: ["bean:__test__digest-pbbls"],
    content: "reviewed",
    description: "",
    state: "draft",
  });
  const r = await upsertDigestDrafts([
    draft({ content: "clobber?" }),
    draft({ slug: "__test__weekly-wrap-2026-w34", parents: ["bean:__test__weekly-wrap"] }),
  ]);
  assert.deepEqual(r, { ok: false, refused: ["__test__digest-pbbls-2026-w34"] });
  // All-or-nothing: the sibling that would have been fine was not written either.
  assert.equal(await db.collection("sprouts").findOne({ slug: "__test__weekly-wrap-2026-w34" }), null);
  const stored = await db.collection("sprouts").findOne({ slug: "__test__digest-pbbls-2026-w34" });
  assert.equal(stored?.content, "reviewed");
});

// The read half: the week material names a sprout's `kind` (what bucketWeek
// keys its digest skip on) and its DERIVED plant, from `about` through the bean.
test("loadWeekMaterial flattens kind and the derived plant", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("plants").insertOne({
    slug: "__test__p",
    name: "P",
    natures: ["work"], role: { kind: "owner" as const },
    description: "",
    visibility: "private",
  });
  await db.collection("beans").insertOne({
    slug: "__test__b",
    name: "B",
    parents: ["plant:__test__p"],
    visibility: "private",
  });
  await db.collection("sprouts").insertOne({
    slug: "__test__s",
    name: "S",
    kind: "release",
    date: "2026-08-19",
    about: ["bean:__test__b"],
    description: "",
  });
  const material = await loadWeekMaterial();
  const s = material.sprouts.find((x) => x.slug === "__test__s");
  assert.ok(s);
  assert.equal(s.kind, "release");
  assert.equal(s.plantSlug, "__test__p");
  assert.ok(material.roster.includes("__test__p"));
});
