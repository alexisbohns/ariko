import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/articles/route";
import { getDb, closeDb } from "./db";

const hasDb = Boolean(process.env.MONGODB_URI);

function req(body: unknown, auth?: string): Request {
  return new Request("http://localhost/api/articles", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  });
}

// lib/articles.ts's SLUG regex (^[a-z0-9][a-z0-9-]*$) forbids underscores
// entirely, so a literal "__test__"-prefixed slug can never pass
// validateArticlesPayload and reach the DB path through the real POST route
// (unlike lib/articles-store.test.ts, which calls writeArticles directly and
// bypasses that regex). "test-articles-route-" is this file's equivalent
// test-data marker: SLUG-valid, unambiguous, and fully cleaned up below.
const TEST_PREFIX = "test-articles-route-";

async function cleanup() {
  const db = await getDb();
  const rx = new RegExp(`^${TEST_PREFIX}`);
  await db.collection("plants").deleteMany({ slug: rx });
  await db.collection("pods").deleteMany({ slug: rx });
  await db.collection("beans").deleteMany({ slug: rx });
  await db.collection("sprouts").deleteMany({ slug: rx });
}

test("write door: ARTICLES_TOKEN unset refuses everything (fail closed)", async () => {
  delete process.env.ARTICLES_TOKEN;
  assert.equal((await POST(req({}, "Bearer anything"))).status, 401);
});

test("write door: wrong or missing token is 401", async () => {
  process.env.ARTICLES_TOKEN = "tok_art_test";
  try {
    assert.equal((await POST(req({}))).status, 401);
    assert.equal((await POST(req({}, "Bearer wrong"))).status, 401);
  } finally {
    delete process.env.ARTICLES_TOKEN;
  }
});

test("write door: malformed JSON body is 400", async () => {
  process.env.ARTICLES_TOKEN = "tok_art_test";
  try {
    const raw = new Request("http://localhost/api/articles", {
      method: "POST",
      headers: { authorization: "Bearer tok_art_test" },
      body: "not json",
    });
    const res = await POST(raw);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /JSON/i);
  } finally {
    delete process.env.ARTICLES_TOKEN;
  }
});

test("write door: bad token wins over malformed JSON — 401, not 400 (body is never read)", async () => {
  process.env.ARTICLES_TOKEN = "tok_art_test";
  try {
    const raw = new Request("http://localhost/api/articles", {
      method: "POST",
      headers: { authorization: "Bearer wrong" },
      body: "not json",
    });
    assert.equal((await POST(raw)).status, 401);

    const rawNoAuth = new Request("http://localhost/api/articles", {
      method: "POST",
      body: "not json",
    });
    assert.equal((await POST(rawNoAuth)).status, 401);
  } finally {
    delete process.env.ARTICLES_TOKEN;
  }
});

test("write door: a payload failing pure validation is 400 and names the offender", async () => {
  process.env.ARTICLES_TOKEN = "tok_art_test";
  try {
    // article carrying state:"published" — the door structurally cannot publish
    const res1 = await POST(
      req(
        {
          container: "plant:test-articles-route-p",
          articles: [
            {
              slug: "test-articles-route-a",
              name: "A",
              date: "2026-07-24",
              content: "body",
              state: "published",
            },
          ],
        },
        "Bearer tok_art_test",
      ),
    );
    assert.equal(res1.status, 400);
    const body1 = await res1.json();
    assert.match(body1.error, /state/);

    // bean: container is rejected — only plant: or pod: are accepted
    const res2 = await POST(
      req({ container: "bean:test-articles-route-a", narrative: "hi" }, "Bearer tok_art_test"),
    );
    assert.equal(res2.status, 400);
    const body2 = await res2.json();
    assert.match(body2.error, /container/);
  } finally {
    delete process.env.ARTICLES_TOKEN;
  }
});

test(
  "write door: a valid payload against a seeded container returns 200",
  { skip: !hasDb },
  async (t) => {
    t.after(cleanup);
    process.env.ARTICLES_TOKEN = "tok_art_test";
    t.after(() => {
      delete process.env.ARTICLES_TOKEN;
    });
    const db = await getDb();
    await db.collection("plants").insertOne({
      slug: `${TEST_PREFIX}p`,
      name: "P",
      natures: ["work"], role: { kind: "owner" as const },
      description: "",
      visibility: "private",
    });

    const res = await POST(
      req(
        {
          container: `plant:${TEST_PREFIX}p`,
          narrative: "Some intro.",
          articles: [
            {
              slug: `${TEST_PREFIX}a`,
              name: "A",
              description: "One line.",
              date: "2026-07-24",
              content: "body",
            },
          ],
        },
        "Bearer tok_art_test",
      ),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { ok: true, written: 1, narrative: true });
  },
);

test(
  "write door: a payload whose sprout has already been published is refused with 409",
  { skip: !hasDb },
  async (t) => {
    t.after(cleanup);
    process.env.ARTICLES_TOKEN = "tok_art_test";
    t.after(() => {
      delete process.env.ARTICLES_TOKEN;
    });
    const db = await getDb();
    await db.collection("plants").insertOne({
      slug: `${TEST_PREFIX}p`,
      name: "P",
      natures: ["work"], role: { kind: "owner" as const },
      description: "",
      visibility: "private",
    });
    await db.collection("sprouts").insertOne({
      slug: `${TEST_PREFIX}a-0`,
      name: "A",
      type: "article",
      date: "2026-07-24",
      description: "",
      parents: [`bean:${TEST_PREFIX}a`],
      content: "reviewed content",
      state: "published",
    });

    const res = await POST(
      req(
        {
          container: `plant:${TEST_PREFIX}p`,
          articles: [
            {
              slug: `${TEST_PREFIX}a`,
              name: "A",
              date: "2026-07-24",
              content: "attempted overwrite",
            },
          ],
        },
        "Bearer tok_art_test",
      ),
    );
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.deepEqual(body.refused, [`${TEST_PREFIX}a-0`]);

    const sprout = await db.collection("sprouts").findOne({ slug: `${TEST_PREFIX}a-0` });
    assert.equal(sprout?.content, "reviewed content");
  },
);

test.after(async () => {
  if (hasDb) await closeDb();
});
