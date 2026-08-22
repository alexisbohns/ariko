import { test } from "node:test";
import assert from "node:assert/strict";
import { writeArticles } from "./articles-store";
import { getDb, closeDb } from "./db";
import type { ArticlesPayload } from "./articles";

const hasDb = Boolean(process.env.MONGODB_URI);

async function cleanup() {
  const db = await getDb();
  await db.collection("plants").deleteMany({ slug: /^__test__/ });
  await db.collection("pods").deleteMany({ slug: /^__test__/ });
  await db.collection("beans").deleteMany({ slug: /^__test__/ });
  await db.collection("sprouts").deleteMany({ slug: /^__test__/ });
}

test(
  "a fresh post creates the bean, the sprout and the narrative",
  { skip: !hasDb },
  async (t) => {
    t.after(cleanup);
    const db = await getDb();
    await db.collection("plants").insertOne({
      slug: "__test__p",
      name: "P",
      natures: ["work"],
      description: "",
      visibility: "private",
    });

    const payload: ArticlesPayload = {
      container: "plant:__test__p",
      narrative: "Some intro.\n::entity{ref=bean:__test__a}",
      articles: [
        {
          slug: "__test__a",
          name: "A",
          description: "One line.",
          date: "2026-07-24",
          content: "body",
        },
      ],
    };
    const result = await writeArticles(payload);
    assert.deepEqual(result, { ok: true, written: 1, narrative: true });

    const bean = await db.collection("beans").findOne({ slug: "__test__a" });
    assert.equal(bean?.visibility, "private");

    const sprout = await db.collection("sprouts").findOne({ slug: "__test__a-0" });
    assert.ok(sprout);
    assert.ok(!("state" in sprout!));
    assert.deepEqual(sprout!.parents, ["bean:__test__a"]);
    assert.equal(sprout!.content, "body");

    const plant = await db.collection("plants").findOne({ slug: "__test__p" });
    assert.deepEqual(plant?.relations, [{ kind: "embeds", ref: "bean:__test__a" }]);
  },
);

test("a re-post updates the sprout in place", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("plants").insertOne({
    slug: "__test__p",
    name: "P",
    natures: ["work"],
    description: "",
    visibility: "private",
  });

  const base: ArticlesPayload = {
    container: "plant:__test__p",
    articles: [
      { slug: "__test__a", name: "A", description: "", date: "2026-07-24", content: "first" },
    ],
  };
  await writeArticles(base);
  await writeArticles({
    ...base,
    articles: [
      { slug: "__test__a", name: "A", description: "", date: "2026-07-24", content: "second" },
    ],
  });

  const sprouts = await db.collection("sprouts").find({ slug: "__test__a-0" }).toArray();
  assert.equal(sprouts.length, 1);
  assert.equal(sprouts[0].content, "second");
});

test(
  "a reviewed sprout is refused and nothing in the batch is written",
  { skip: !hasDb },
  async (t) => {
    t.after(cleanup);
    const db = await getDb();
    await db.collection("plants").insertOne({
      slug: "__test__p",
      name: "P",
      natures: ["work"],
      description: "",
      visibility: "private",
    });

    await writeArticles({
      container: "plant:__test__p",
      articles: [
        {
          slug: "__test__a",
          name: "A",
          description: "",
          date: "2026-07-24",
          content: "original",
        },
      ],
    });
    // Simulate a human reviewing and publishing the sprout directly in Mongo.
    await db
      .collection("sprouts")
      .updateOne({ slug: "__test__a-0" }, { $set: { state: "published" } });

    const result = await writeArticles({
      container: "plant:__test__p",
      articles: [
        {
          slug: "__test__a",
          name: "A",
          description: "",
          date: "2026-07-24",
          content: "attempted overwrite",
        },
        {
          slug: "__test__b",
          name: "B",
          description: "",
          date: "2026-07-24",
          content: "new",
        },
      ],
    });
    assert.deepEqual(result, { ok: false, refused: ["__test__a-0"] });

    const sprout = await db.collection("sprouts").findOne({ slug: "__test__a-0" });
    assert.equal(sprout?.content, "original");

    const other = await db.collection("sprouts").findOne({ slug: "__test__b-0" });
    assert.equal(other, null);
  },
);

test("a public container carrying prose is refused", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("plants").insertOne({
    slug: "__test__pub",
    name: "Pub",
    natures: ["work"],
    description: "",
    visibility: "public",
    content: "already live",
  });

  const result = await writeArticles({
    container: "plant:__test__pub",
    narrative: "new prose",
  });
  assert.deepEqual(result, { ok: false, refused: ["plant:__test__pub"] });

  // Not just the return value: the refusal must be honored on disk too — a
  // regression that started writing on the refusal path would still pass an
  // assertion that only checks the result.
  const plant = await db.collection("plants").findOne({ slug: "__test__pub" });
  assert.equal(plant?.content, "already live");
  assert.equal(plant?.relations, undefined);
});

test(
  "refusals accumulate: a missing container and a pre-published sprout are both reported, and nothing is written",
  { skip: !hasDb },
  async (t) => {
    t.after(cleanup);
    const db = await getDb();
    // A sprout that some other flow already reviewed and published — no
    // container in this collection has to exist for this row to exist.
    await db.collection("sprouts").insertOne({
      slug: "__test__c-0",
      name: "C",
      type: "article",
      date: "2026-07-01",
      description: "",
      parents: ["bean:__test__c"],
      content: "reviewed content",
      state: "published",
    });

    const result = await writeArticles({
      container: "plant:__test__missing",
      narrative: "hello",
      articles: [
        { slug: "__test__c", name: "C", description: "", date: "2026-07-24", content: "attempt" },
      ],
    });
    // Both refusals surface in one response — the missing-container check
    // does not short-circuit before the sprout-state check runs.
    assert.deepEqual(result, {
      ok: false,
      refused: ["plant:__test__missing (unknown)", "__test__c-0"],
    });

    assert.equal(await db.collection("plants").findOne({ slug: "__test__missing" }), null);
    assert.equal(await db.collection("beans").findOne({ slug: "__test__c" }), null);
    const sprout = await db.collection("sprouts").findOne({ slug: "__test__c-0" });
    assert.equal(sprout?.content, "reviewed content");
    assert.equal(sprout?.state, "published");
  },
);

test(
  "a public container with blank string content still accepts a narrative (the write-time filter, not just the pre-check, must agree)",
  { skip: !hasDb },
  async (t) => {
    t.after(cleanup);
    const db = await getDb();
    await db.collection("plants").insertOne({
      slug: "__test__blankpub",
      name: "BlankPub",
      natures: ["work"],
      description: "",
      visibility: "public",
      content: "",
    });

    const result = await writeArticles({
      container: "plant:__test__blankpub",
      narrative: "first prose",
    });
    assert.deepEqual(result, { ok: true, written: 0, narrative: true });
    const plant = await db.collection("plants").findOne({ slug: "__test__blankpub" });
    assert.equal(plant?.content, "first prose");
  },
);

test(
  "a public container with blank LOCALIZED content still accepts a narrative (the write-time filter's object branch)",
  { skip: !hasDb },
  async (t) => {
    t.after(cleanup);
    const db = await getDb();
    await db.collection("plants").insertOne({
      slug: "__test__blankloc",
      name: "BlankLoc",
      natures: ["work"],
      description: "",
      visibility: "public",
      content: { en: "", fr: "" },
    });

    const result = await writeArticles({
      container: "plant:__test__blankloc",
      narrative: "first prose",
    });
    assert.deepEqual(result, { ok: true, written: 0, narrative: true });
    const plant = await db.collection("plants").findOne({ slug: "__test__blankloc" });
    assert.equal(plant?.content, "first prose");
  },
);

test(
  "a public existing bean is refused, and its name/description and the sprout are untouched",
  { skip: !hasDb },
  async (t) => {
    t.after(cleanup);
    const db = await getDb();
    await db.collection("plants").insertOne({
      slug: "__test__p",
      name: "P",
      natures: ["work"],
      description: "",
      visibility: "private",
    });
    // A bean a human already reviewed and published — this door must never
    // have created it public itself ($setOnInsert always writes private).
    await db.collection("beans").insertOne({
      slug: "__test__pubbean",
      name: "Original Name",
      description: "Original description.",
      parents: ["plant:__test__p"],
      visibility: "public",
    });

    const result = await writeArticles({
      container: "plant:__test__p",
      articles: [
        {
          slug: "__test__pubbean",
          name: "Overwritten Name",
          description: "Overwritten description.",
          date: "2026-07-24",
          content: "attempted overwrite",
        },
      ],
    });
    assert.deepEqual(result, { ok: false, refused: ["bean:__test__pubbean"] });

    const bean = await db.collection("beans").findOne({ slug: "__test__pubbean" });
    assert.equal(bean?.name, "Original Name");
    assert.equal(bean?.description, "Original description.");
    assert.equal(bean?.visibility, "public");

    const sprout = await db.collection("sprouts").findOne({ slug: "__test__pubbean-0" });
    assert.equal(sprout, null);
  },
);

test(
  "a private existing bean is still updated in place (the re-post case keeps working)",
  { skip: !hasDb },
  async (t) => {
    t.after(cleanup);
    const db = await getDb();
    await db.collection("plants").insertOne({
      slug: "__test__p",
      name: "P",
      natures: ["work"],
      description: "",
      visibility: "private",
    });
    await db.collection("beans").insertOne({
      slug: "__test__privbean",
      name: "Draft Name",
      description: "Draft description.",
      parents: ["plant:__test__p"],
      visibility: "private",
    });

    const result = await writeArticles({
      container: "plant:__test__p",
      articles: [
        {
          slug: "__test__privbean",
          name: "Updated Name",
          description: "Updated description.",
          date: "2026-07-24",
          content: "body",
        },
      ],
    });
    assert.deepEqual(result, { ok: true, written: 1, narrative: false });

    const bean = await db.collection("beans").findOne({ slug: "__test__privbean" });
    assert.equal(bean?.name, "Updated Name");
    assert.equal(bean?.description, "Updated description.");
    assert.equal(bean?.visibility, "private");
  },
);

test(
  "a public-bean refusal accumulates alongside a sprout-state refusal in one response",
  { skip: !hasDb },
  async (t) => {
    t.after(cleanup);
    const db = await getDb();
    await db.collection("plants").insertOne({
      slug: "__test__p",
      name: "P",
      natures: ["work"],
      description: "",
      visibility: "private",
    });
    await db.collection("beans").insertOne({
      slug: "__test__pubbean2",
      name: "Original",
      description: "",
      parents: ["plant:__test__p"],
      visibility: "public",
    });
    await db.collection("sprouts").insertOne({
      slug: "__test__reviewed-0",
      name: "Reviewed",
      type: "article",
      date: "2026-07-01",
      description: "",
      parents: ["bean:__test__reviewed"],
      content: "reviewed content",
      state: "published",
    });

    const result = await writeArticles({
      container: "plant:__test__p",
      articles: [
        {
          slug: "__test__pubbean2",
          name: "Overwrite",
          description: "",
          date: "2026-07-24",
          content: "attempt",
        },
        {
          slug: "__test__reviewed",
          name: "Reviewed",
          description: "",
          date: "2026-07-24",
          content: "attempt",
        },
      ],
    });
    assert.deepEqual(result, {
      ok: false,
      refused: ["bean:__test__pubbean2", "__test__reviewed-0"],
    });
  },
);

test.after(async () => {
  if (hasDb) await closeDb();
});
