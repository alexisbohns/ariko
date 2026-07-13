import { test } from "node:test";
import assert from "node:assert/strict";
import { filterPublic, resolveText, type RawSeed } from "./data";

test("resolveText returns plain strings unchanged", () => {
  assert.equal(resolveText("hello"), "hello");
});

test("resolveText picks the requested language, falling back to en then fr", () => {
  assert.equal(resolveText({ en: "Hi", fr: "Salut" }, "fr"), "Salut");
  assert.equal(resolveText({ en: "Hi" }, "fr"), "Hi");
  assert.equal(resolveText({ fr: "Salut" }, "en"), "Salut");
  assert.equal(resolveText(undefined), "");
});

const raw: RawSeed = {
  molecules: [
    { slug: "m-pub", name: "Pub", domain: "music", description: "" },
    { slug: "m-priv", name: "Priv", domain: "music", description: "", visibility: "private" },
  ],
  atoms: [
    { slug: "a-pub", name: "A pub", parents: ["molecule:m-pub"] },
    { slug: "a-priv", name: "A priv", parents: ["molecule:m-pub"], visibility: "private" },
  ],
  versions: [
    { slug: "v-published", name: "Published", type: "song", date: "2026-01-01", description: "", parents: ["atom:a-pub"], state: "published" },
    { slug: "v-draft", name: "Draft", type: "song", date: "2026-01-02", description: "", parents: ["atom:a-pub"], state: "draft" },
    { slug: "v-private", name: "Private", type: "song", date: "2026-01-03", description: "", parents: ["atom:a-pub"], state: "private" },
    { slug: "v-nostate", name: "No state", type: "song", date: "2026-01-04", description: "", parents: ["atom:a-pub"] },
  ],
};

test("filterPublic keeps only published versions", () => {
  const slugs = (filterPublic(raw).versions ?? []).map((v) => v.slug);
  assert.deepEqual(slugs, ["v-published"]);
});

test("filterPublic drops private molecules and atoms, keeps the rest", () => {
  const out = filterPublic(raw);
  assert.deepEqual((out.molecules ?? []).map((m) => m.slug), ["m-pub"]);
  assert.deepEqual((out.atoms ?? []).map((a) => a.slug), ["a-pub"]);
});

test("filterPublic never leaks a draft, private, or stateless version", () => {
  const slugs = new Set((filterPublic(raw).versions ?? []).map((v) => v.slug));
  for (const leaked of ["v-draft", "v-private", "v-nostate"]) {
    assert.equal(slugs.has(leaked), false, `${leaked} must not be public`);
  }
});
