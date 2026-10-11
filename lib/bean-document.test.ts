import { test } from "node:test";
import assert from "node:assert/strict";
import { beanDocument } from "./botanical";

const base = { slug: "b", name: "B", description: "", podSlug: null, plantSlug: "p" };

test("beanDocument: private at birth, rooted under the pod when given, else the plant", () => {
  assert.deepEqual(beanDocument({ ...base, podSlug: "pod" }).parents, ["pod:pod"]);
  assert.deepEqual(beanDocument(base).parents, ["plant:p"]);
  assert.equal(beanDocument(base).visibility, "private");
});

test("beanDocument: blank description, blank content and empty relations are omitted, not stored", () => {
  const doc = beanDocument({ ...base, content: { en: "  ", fr: "" }, relations: [] });
  assert.equal("description" in doc, false);
  assert.equal("content" in doc, false);
  assert.equal("relations" in doc, false);
});

test("beanDocument: a narrative and its relations are stored verbatim", () => {
  const relations = [{ kind: "mentions", ref: "bean:x" }];
  const doc = beanDocument({ ...base, description: "d", content: { en: "# Hi" }, relations });
  assert.equal(doc.description, "d");
  assert.deepEqual(doc.content, { en: "# Hi" });
  assert.deepEqual(doc.relations, relations);
});
