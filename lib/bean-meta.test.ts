import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBeanMetaPatch, beanMetaUpdate, BlankBeanNameError } from "./bean-meta";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

test("composes both languages into the stored Text", () => {
  const patch = buildBeanMetaPatch(
    form({ name: "Timeline", nameFr: "Chronologie", description: "a feed", descriptionFr: "un fil" }),
  );
  assert.deepEqual(patch.name, { en: "Timeline", fr: "Chronologie" });
  assert.deepEqual(patch.description, { en: "a feed", fr: "un fil" });
});

test("an en-only or fr-only name is valid (B1), and stays one-sided", () => {
  assert.equal(buildBeanMetaPatch(form({ name: "Timeline" })).name, "Timeline");
  assert.deepEqual(buildBeanMetaPatch(form({ nameFr: "Chronologie" })).name, { fr: "Chronologie" });
});

test("a blank description means CLEAR, and crosses the wire as null", () => {
  // Not an omission: the field belongs to a record that already exists, so
  // omitting the key would silently leave the old description in place and the
  // author would see their deletion ignored.
  assert.equal(buildBeanMetaPatch(form({ name: "Timeline", description: "  " })).description, null);
  assert.equal(buildBeanMetaPatch(form({ name: "Timeline" })).description, null);
});

test("a blank name throws rather than falling back", () => {
  assert.throws(() => buildBeanMetaPatch(form({ name: "  ", nameFr: "" })), BlankBeanNameError);
  assert.throws(() => buildBeanMetaPatch(form({})), BlankBeanNameError);
});

test("whitespace around either part is trimmed off before composing", () => {
  assert.equal(buildBeanMetaPatch(form({ name: "  Timeline  " })).name, "Timeline");
});

test("beanMetaUpdate sets the name and unsets a cleared description", () => {
  assert.deepEqual(beanMetaUpdate({ name: "Timeline", description: null }), {
    $set: { name: "Timeline" },
    $unset: { description: "" },
  });
});

test("beanMetaUpdate sets both fields when a description is present", () => {
  assert.deepEqual(beanMetaUpdate({ name: "Timeline", description: "a feed" }), {
    $set: { name: "Timeline", description: "a feed" },
  });
});

test("beanMetaUpdate never emits a duplicate $set key", () => {
  // The bug plantMetaUpdate exists because of: composing this document inline
  // with a spread produced two $set keys and silently dropped fields.
  const doc = beanMetaUpdate({ name: "Timeline", description: "a feed" });
  assert.equal(Object.keys(doc).filter((k) => k === "$set").length, 1);
  assert.ok(!("$unset" in doc), "a present description must not also be unset");
});
