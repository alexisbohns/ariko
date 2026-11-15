import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STAGED_BLOCKS, FRAMES, SIZES, DEFAULT_SIZE, BLOCK_ATTRIBUTES, COMPARE_LABELS,
  isStagedBlock, resolveFrame, resolveSize, isSvgUrl,
} from "./staging";

test("the five blocks, in grammar order", () => {
  assert.deepEqual([...STAGED_BLOCKS], ["figure", "gallery", "compare", "callout", "quote"]);
  assert.equal(isStagedBlock("figure"), true);
  assert.equal(isStagedBlock("do"), false); // a compare side is not a block
  assert.equal(isStagedBlock("warning"), false);
});

test("frame and size are closed vocabularies with defaults", () => {
  assert.deepEqual([...FRAMES], ["phone", "desktop", "none"]);
  assert.deepEqual([...SIZES], ["s", "m", "l", "wide"]);
  assert.equal(resolveFrame("tablet"), "none");
  assert.equal(resolveFrame(undefined), "none");
  assert.equal(resolveSize(undefined, "phone"), "m");
  assert.equal(resolveSize("xl", "desktop"), "l");
  assert.equal(resolveSize("s", "desktop"), "s");
  assert.deepEqual(DEFAULT_SIZE, { phone: "m", desktop: "l", none: "l" });
});

test("each block names the attributes it accepts", () => {
  assert.deepEqual(BLOCK_ATTRIBUTES.figure, ["frame", "size", "dark"]);
  assert.deepEqual(BLOCK_ATTRIBUTES.gallery, ["frame"]);
  assert.deepEqual(BLOCK_ATTRIBUTES.compare, []);
  assert.deepEqual(BLOCK_ATTRIBUTES.callout, []);
  assert.deepEqual(BLOCK_ATTRIBUTES.quote, ["by", "role"]);
});

test("compare labels exist in both languages", () => {
  assert.deepEqual(COMPARE_LABELS.en, { do: "Do", dont: "Don't" });
  assert.deepEqual(COMPARE_LABELS.fr, { do: "À faire", dont: "À éviter" });
});

test("an SVG is recognised by its path, not its query", () => {
  assert.equal(isSvgUrl("https://res.cloudinary.com/c/image/upload/v1/beanstalk/a.svg"), true);
  assert.equal(isSvgUrl("https://res.cloudinary.com/c/image/upload/v1/beanstalk/a.SVG"), true);
  assert.equal(isSvgUrl("https://res.cloudinary.com/c/image/upload/v1/beanstalk/a.png?x=.svg"), false);
  assert.equal(isSvgUrl("not a url.svg"), true);
});
