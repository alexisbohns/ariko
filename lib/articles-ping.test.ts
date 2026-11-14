// lib/articles-ping.test.ts
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/articles/ping/route";
import { getDb, closeDb } from "./db";
import { mintToken } from "./repo-token-store";

const hasDb = Boolean(process.env.MONGODB_URI);
const P = "test-ping-";
let token = "";

const req = (auth?: string) =>
  new Request("http://localhost/api/articles/ping", { headers: auth ? { authorization: auth } : {} });

async function cleanup() {
  const db = await getDb();
  const rx = new RegExp(`^${P}`);
  for (const c of ["plants", "pods", "beans"]) await db.collection(c).deleteMany({ slug: rx });
  await db.collection("tokens").deleteMany({ plant: rx });
}

before(async () => {
  if (!hasDb) return;
  await cleanup();
  const db = await getDb();
  await db.collection("plants").insertOne({ slug: `${P}plant`, name: "Plant", description: "" });
  await db.collection("pods").insertMany([
    { slug: `${P}pod`, name: { en: "Pod", fr: "Pode" }, description: "", parents: [`plant:${P}plant`], visibility: "private" },
    { slug: `${P}pod2`, name: "Pod 2", description: "", parents: [`plant:${P}plant`] },
    { slug: `${P}other`, name: "Other", description: "", parents: [`plant:${P}elsewhere`], visibility: "private" },
  ]);
  await db.collection("beans").insertMany([
    { slug: `${P}b`, name: "B", parents: [`pod:${P}pod`], visibility: "public" },
    { slug: `${P}a`, name: "A", parents: [`pod:${P}pod`], visibility: "private", projected: { source: "pollen", feedId: "f", firstPollenId: "p" } },
    { slug: `${P}c`, name: "C", parents: [`pod:${P}pod2`], visibility: "private" },
    { slug: `${P}d`, name: "D", parents: [`plant:${P}plant`], visibility: "private" },
    { slug: `${P}x`, name: "X", parents: [`pod:${P}other`], visibility: "private" },
  ]);
  token = await mintToken(`${P}plant`, "ping test");
});
after(async () => {
  if (!hasDb) return;
  await cleanup();
  await closeDb();
});

test("ping without a repo token is 401", async () => {
  assert.equal((await GET(req())).status, 401);
  assert.equal((await GET(req("Bearer tok_legacy"))).status, 401);
});

test("ping returns the plant, every pod of it and every bean under them", { skip: !hasDb }, async () => {
  const res = await GET(req(`Bearer ${token}`));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    plant: `${P}plant`,
    pods: [
      { slug: `${P}pod`, name: "Pod", visibility: "private" },
      { slug: `${P}pod2`, name: "Pod 2", visibility: "public" },
    ],
    beans: [
      { slug: `${P}a`, name: "A", pod: `${P}pod`, visibility: "private", projected: true },
      { slug: `${P}b`, name: "B", pod: `${P}pod`, visibility: "public" },
      { slug: `${P}c`, name: "C", pod: `${P}pod2`, visibility: "private" },
      { slug: `${P}d`, name: "D", pod: null, visibility: "private" },
    ],
  });
});

test("ping for a plant that no longer exists is 404", { skip: !hasDb }, async () => {
  const db = await getDb();
  await db.collection("plants").deleteOne({ slug: `${P}plant` });
  const res = await GET(req(`Bearer ${token}`));
  assert.equal(res.status, 404);
  assert.match((await res.json()).error, /no longer exists/);
});
