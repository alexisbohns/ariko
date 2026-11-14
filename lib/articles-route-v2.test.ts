// lib/articles-route-v2.test.ts
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/articles/route";
import { getDb, closeDb } from "./db";
import { mintToken, revokePlant } from "./repo-token-store";

const hasDb = Boolean(process.env.MONGODB_URI);
const P = "test-route-v2-";
const PLANT = `${P}plant`;
const POD = `${P}pod`;
let token = "";

function req(body: unknown, auth?: string): Request {
  return new Request("http://localhost/api/articles", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(body),
  });
}

async function cleanup() {
  const db = await getDb();
  const rx = new RegExp(`^${P}`);
  for (const c of ["plants", "pods", "beans", "sprouts"]) await db.collection(c).deleteMany({ slug: rx });
  await db.collection("tokens").deleteMany({ plant: rx });
}

before(async () => {
  if (!hasDb) return;
  await cleanup();
  const db = await getDb();
  await db.collection("plants").insertOne({ slug: PLANT, name: "Plant", description: "" });
  await db.collection("pods").insertOne({ slug: POD, name: "Pod", description: "", parents: [`plant:${PLANT}`], visibility: "private" });
  token = await mintToken(PLANT, "route test");
});
after(async () => {
  if (!hasDb) return;
  await cleanup();
  await closeDb();
});

const essay = { slug: `${P}essay`, date: "2026-11-14", name: "E", content: "Body", about: [POD] };

test("repo token + v2 shape → written", { skip: !hasDb }, async () => {
  const res = await POST(req({ essays: [essay] }, `Bearer ${token}`));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    ok: true,
    essays: [`${P}essay`],
    narratives: [],
    admin: [`/admin/sprout/${P}essay`],
  });
});

test("admin links name the kind each narrative turned out to be", { skip: !hasDb }, async () => {
  const res = await POST(
    req(
      { narratives: [{ slug: POD, content: "Pod body" }, { slug: `${P}bean`, pod: POD, name: "B", content: "Bean body" }] },
      `Bearer ${token}`,
    ),
  );
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).admin, [`/admin/pod/${POD}`, `/admin/bean/${P}bean`]);
});

test("repo token + legacy shape → 400 naming the v2 shape", { skip: !hasDb }, async () => {
  const res = await POST(req({ container: `pod:${POD}`, narrative: "x" }, `Bearer ${token}`));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /essays, narratives/);
});

test("legacy token + v2 shape → 400 asking for a repo token", async () => {
  const prior = process.env.ARTICLES_TOKEN;
  process.env.ARTICLES_TOKEN = "tok_art_test";
  try {
    const res = await POST(req({ essays: [essay] }, "Bearer tok_art_test"));
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /needs a repo token/);
  } finally {
    if (prior === undefined) delete process.env.ARTICLES_TOKEN;
    else process.env.ARTICLES_TOKEN = prior;
  }
});

test("revoked or unknown repo token → 401", { skip: !hasDb }, async () => {
  assert.equal((await POST(req({ essays: [essay] }, "Bearer ariko_x_nope"))).status, 401);
});

test("scope refusal → 409 with refused", { skip: !hasDb }, async () => {
  const res = await POST(req({ essays: [{ ...essay, slug: `${P}e2`, about: ["somewhere-else"] }] }, `Bearer ${token}`));
  assert.equal(res.status, 409);
  assert.deepEqual((await res.json()).refused, [`${P}e2: about somewhere-else is not in plant ${PLANT}`]);
});

test("an image not hosted by Ariko → 400", { skip: !hasDb }, async () => {
  const res = await POST(
    req({ essays: [{ ...essay, slug: `${P}e3`, content: "![x](https://example.com/a.png)" }] }, `Bearer ${token}`),
  );
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /not hosted by Ariko/);
});

// Last on purpose: minting revokes the plant's previous token, so every test
// above that uses `token` must have run.
test("a revoked repo token → 401", { skip: !hasDb }, async () => {
  const dead = await mintToken(PLANT, "to be revoked");
  await revokePlant(PLANT);
  assert.equal((await POST(req({ essays: [essay] }, `Bearer ${dead}`))).status, 401);
});
