import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldRenderToc, tocState, type TocHeading } from "./toc";

const h = (id: string, level: 2 | 3 = 2): TocHeading => ({ id, text: id, level });

test("the row at the active index is active", () => {
  assert.equal(tocState(1, 1), "active");
});

test("rows before the active index are passed", () => {
  assert.equal(tocState(0, 2), "passed");
  assert.equal(tocState(1, 2), "passed");
});

test("rows after the active index are default", () => {
  assert.equal(tocState(3, 2), "default");
});

// At the very top of a document nothing has been read yet. -1 is the honest
// answer, and it must not make the first row active by accident.
test("an active index of -1 leaves every row default", () => {
  assert.equal(tocState(0, -1), "default");
  assert.equal(tocState(5, -1), "default");
});

test("a rail needs at least two headings", () => {
  assert.equal(shouldRenderToc([]), false);
  assert.equal(shouldRenderToc([h("one")]), false);
  assert.equal(shouldRenderToc([h("one"), h("two")]), true);
  assert.equal(shouldRenderToc([h("one"), h("two", 3), h("three")]), true);
});
