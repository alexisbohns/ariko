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
  await db.collection("tokens").deleteMany({ pod: rx });
}

before(async () => {
  if (!hasDb) return;
  await cleanup();
  const db = await getDb();
  await db.collection("pods").insertOne({ slug: `${P}pod`, name: { en: "Pod", fr: "Pode" }, description: "", parents: [`plant:${P}plant`], visibility: "private" });
  await db.collection("beans").insertMany([
    { slug: `${P}b`, name: "B", parents: [`pod:${P}pod`], visibility: "public" },
    { slug: `${P}a`, name: "A", parents: [`pod:${P}pod`], visibility: "private", projected: { source: "pollen", feedId: "f", firstPollenId: "p" } },
  ]);
  token = await mintToken(`${P}pod`, "ping test");
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

test("ping returns the pod, its plant and its beans", { skip: !hasDb }, async () => {
  const res = await GET(req(`Bearer ${token}`));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    pod: `${P}pod`,
    plant: `${P}plant`,
    beans: [
      { slug: `${P}a`, name: "A", visibility: "private", projected: true },
      { slug: `${P}b`, name: "B", visibility: "public" },
    ],
  });
});

test("ping for a pod that no longer exists is 404", { skip: !hasDb }, async () => {
  const db = await getDb();
  await db.collection("pods").deleteOne({ slug: `${P}pod` });
  const res = await GET(req(`Bearer ${token}`));
  assert.equal(res.status, 404);
  assert.match((await res.json()).error, /no longer exists/);
});
