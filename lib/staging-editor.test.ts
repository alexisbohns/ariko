import { test } from "node:test";
import assert from "node:assert/strict";
import { MarkdownManager } from "@tiptap/markdown";
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { headlessExtensions } from "./entity-markdown";
import { STAGING_FIXTURES, NONCANONICAL_FIXTURES, MALFORMED_FIXTURES, DOOR_ONLY_FIXTURES } from "./staging-fixtures";

// indentation mirrors components/editor/prose-editor.tsx, as in
// lib/markdown-conformance.test.ts.
const manager = new MarkdownManager({ extensions: headlessExtensions, indentation: { style: "space", size: 3 } });
const schema = getSchema(headlessExtensions as never);
const doc = (md: string) => manager.parse(md);
const roundTrip = (md: string) => manager.serialize(manager.parse(md)).trim();

test("each block parses to its node", () => {
  const types = (md: string) => (doc(md).content ?? []).map((n) => n.type);
  assert.deepEqual(types(STAGING_FIXTURES.phoneFigure), ["stagedFigure"]);
  assert.deepEqual(types(STAGING_FIXTURES.gallery), ["stagedGallery"]);
  assert.deepEqual(types(STAGING_FIXTURES.compare), ["stagedCompare"]);
  assert.deepEqual(types(STAGING_FIXTURES.callout), ["stagedCallout"]);
  assert.deepEqual(types(STAGING_FIXTURES.quote), ["stagedQuote"]);
});

// A text block's children are serialized by the STOCK nodes, and
// @tiptap/extension-hard-break writes a hard break as two trailing spaces,
// never `\` — so quoteHardBreaks comes back as `of  \ncontents`. Same break,
// same render (the conformance loop in lib/markdown-conformance.test.ts
// holds it to that), and not ours to change without replacing a stock node.
// Only the bytes differ; anything else in this set would be a bug.
const textBlockByteExceptions = new Set(["quoteHardBreaks"]);

test("canonical fixtures round-trip byte for byte", () => {
  for (const [name, md] of Object.entries(STAGING_FIXTURES)) {
    if (textBlockByteExceptions.has(name)) continue;
    assert.equal(roundTrip(md), md, name);
  }
});

test("the byte exception is the hard break and nothing else", () => {
  const md = STAGING_FIXTURES.quoteHardBreaks;
  assert.equal(roundTrip(md), md.replace("of\\\ncontents", "of  \ncontents"));
});

test("every parsed document is schema-valid (the freeze-on-next-keystroke class)", () => {
  for (const [name, md] of Object.entries({ ...STAGING_FIXTURES, ...NONCANONICAL_FIXTURES })) {
    assert.doesNotThrow(() => PMNode.fromJSON(schema, doc(md)).check(), name);
  }
});

test("the figure atom stores its fields; the caption is source", () => {
  const node = doc(STAGING_FIXTURES.darkSvgFigure).content![0];
  assert.equal(node.attrs!.size, "wide");
  assert.match(node.attrs!.darkSrc, /clock-dark\.svg$/);
  assert.equal(node.attrs!.caption, "The audio clock is the reference; *everything else* locks onto it.");
});

test("text blocks keep editable children, entity nodes included", () => {
  const node = doc(STAGING_FIXTURES.calloutWithEntity).content![0];
  assert.equal(node.type, "stagedCallout");
  assert.equal(node.attrs!.label, "In two words: haptics");
  const kinds = JSON.stringify(node.content);
  assert.match(kinds, /entityMention/);
  assert.match(kinds, /entityCard/);
});

test("a block interrupting a paragraph is still claimed", () => {
  const types = (doc(NONCANONICAL_FIXTURES.interruptsParagraph).content ?? []).map((n) => n.type);
  assert.deepEqual(types, ["paragraph", "stagedCallout"]);
});

test("malformed blocks are not claimed", () => {
  for (const [name, { md }] of Object.entries(MALFORMED_FIXTURES)) {
    assert.doesNotMatch(JSON.stringify(doc(md)), /"staged/, name);
  }
});

test("a staged block inside a text block is not claimed (nesting)", () => {
  const callout = doc(DOOR_ONLY_FIXTURES.nested.md).content![0];
  assert.equal(callout.type, "stagedCallout");
  assert.doesNotMatch(JSON.stringify(callout.content), /stagedGallery/);
});

test("the nesting guard is released after a text block, so the next block is claimed", () => {
  const types = (doc(`${STAGING_FIXTURES.callout}\n\n${STAGING_FIXTURES.gallery}`).content ?? []).map((n) => n.type);
  assert.deepEqual(types, ["stagedCallout", "stagedGallery"]);
});
