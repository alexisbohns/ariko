import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ensureAtomicIndexes,
  createMolecule,
  createAtom,
  createVersion,
  deleteVersion,
  setPublic,
  setPrivate,
  listMolecules,
  listAtoms,
  SlugExistsError,
} from "./atomic";
import { getDb, closeDb } from "./db";

const hasDb = Boolean(process.env.MONGODB_URI);

async function cleanup() {
  const db = await getDb();
  await db.collection("molecules").deleteMany({ slug: /^__test__/ });
  await db.collection("atoms").deleteMany({ slug: /^__test__/ });
  await db.collection("versions").deleteMany({ slug: /^__test__/ });
}

test("createMolecule/createAtom insert private-by-default", { skip: !hasDb }, async (t) => {
  await ensureAtomicIndexes();
  t.after(cleanup);
  const m = await createMolecule({ slug: "__test__m", name: "M", domain: "music", description: "" });
  assert.equal(m.visibility, "private");
  const a = await createAtom({ slug: "__test__a", name: "A", moleculeSlug: "__test__m" });
  assert.equal(a.visibility, "private");
  assert.deepEqual(a.parents, ["molecule:__test__m"]);
  const molecules = await listMolecules();
  const atoms = await listAtoms();
  assert.ok(molecules.some((x) => x.slug === "__test__m"));
  assert.ok(atoms.some((x) => x.slug === "__test__a"));
});

test("createAtom with no molecule is parentless", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const a = await createAtom({ slug: "__test__solo", name: "Solo", moleculeSlug: null });
  assert.deepEqual(a.parents, []);
});

test("createVersion writes parents/state/media/source", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const v = await createVersion({
    slug: "__test__v",
    name: "V",
    type: "demo",
    date: "2025-01-01",
    description: "d",
    state: "draft",
    parents: ["atom:__test__a"],
    media: [{ kind: "embed", provider: "youtube", url: "https://youtu.be/x", embedId: "x" }],
    source: { kind: "manual" },
  });
  assert.equal(v.state, "draft");
  assert.deepEqual(v.parents, ["atom:__test__a"]);
});

test("setPublic flips visibility to public", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  await createMolecule({ slug: "__test__pm", name: "M", domain: "music", description: "" });
  await createAtom({ slug: "__test__pa", name: "A", moleculeSlug: "__test__pm" });
  await setPublic(["__test__pm"], ["__test__pa"]);
  const db = await getDb();
  const m = await db.collection("molecules").findOne({ slug: "__test__pm" });
  const a = await db.collection("atoms").findOne({ slug: "__test__pa" });
  assert.equal(m?.visibility, "public");
  assert.equal(a?.visibility, "public");
});

test("setPublic is a no-op on empty arrays", { skip: !hasDb }, async () => {
  await setPublic([], []); // must not throw
});

test("setPrivate flips visibility back to private", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  await createMolecule({ slug: "__test__qm", name: "M", domain: "music", description: "" });
  await createAtom({ slug: "__test__qa", name: "A", moleculeSlug: "__test__qm" });
  await setPublic(["__test__qm"], ["__test__qa"]);
  await setPrivate(["__test__qm"], ["__test__qa"]);
  const db = await getDb();
  const m = await db.collection("molecules").findOne({ slug: "__test__qm" });
  const a = await db.collection("atoms").findOne({ slug: "__test__qa" });
  assert.equal(m?.visibility, "private");
  assert.equal(a?.visibility, "private");
});

test("setPrivate is a no-op on empty arrays", { skip: !hasDb }, async () => {
  await setPrivate([], []); // must not throw
});

test("deleteVersion removes only the targeted version doc", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const base = {
    name: "Del",
    type: "demo",
    date: "2025-01-01",
    description: "",
    state: "draft" as const,
    parents: [],
    media: [],
    source: { kind: "manual" },
  };
  await createVersion({ slug: "__test__del", ...base });
  await createVersion({ slug: "__test__keep", ...base });
  await deleteVersion("__test__del");
  const db = await getDb();
  assert.equal(await db.collection("versions").findOne({ slug: "__test__del" }), null);
  // The delete must be slug-scoped — a sibling doc survives.
  assert.notEqual(await db.collection("versions").findOne({ slug: "__test__keep" }), null);
});

test("deleteVersion on a missing slug does not throw", { skip: !hasDb }, async () => {
  await deleteVersion("__test__never-existed"); // deleteOne matches 0 → no-op
});

test("a duplicate slug throws SlugExistsError", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  await createMolecule({ slug: "__test__dup", name: "M", domain: "music", description: "" });
  await assert.rejects(
    () => createMolecule({ slug: "__test__dup", name: "M2", domain: "music", description: "" }),
    (err) => err instanceof SlugExistsError && err.slug === "__test__dup",
  );
});

test.after(async () => {
  if (hasDb) await closeDb();
});
