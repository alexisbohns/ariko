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

// ── Text blocks are always valid documents ──────────────────────────────────

const valid = (json: unknown) => PMNode.fromJSON(schema, json as never).check();
const para = (text?: string) => ({ type: "paragraph", ...(text ? { content: [{ type: "text", text }] } : {}) });
const serialize = (...content: unknown[]) => manager.serialize({ type: "doc", content } as never).trim();

test("a claimed body that yields no nodes holds one empty paragraph", () => {
  for (const md of [":::callout\n[1]: https://e.com\n:::", ":::callout\n[^1]: x\n:::", ":::quote{by=A}\n[1]: https://e.com\n:::"]) {
    const d = doc(md);
    assert.match(d.content![0].type!, /^staged(Callout|Quote)$/, md);
    assert.doesNotThrow(() => valid(d), md);
  }
});

test("an emptied text block writes no fence: a label becomes its paragraph, nothing else stays", () => {
  const callout = (label: string | null, ...content: unknown[]) => ({ type: "stagedCallout", attrs: { label }, content });
  assert.equal(serialize(callout("In two words: haptics", para())), "In two words: haptics");
  assert.equal(serialize(callout(null, para(), para())), "");
  assert.equal(serialize({ type: "stagedQuote", attrs: { by: "Alexis", role: null }, content: [para()] }), "");
  // A label that would start a block is escaped, not promoted to a heading.
  assert.equal(serialize(callout("# One", para())), "\\# One");
  assert.equal(serialize(para("before"), callout(null, para()), para("after")), "before\n\n\n\nafter");
});

test("an emptied labelled callout in a list item does not merge into the item's text", () => {
  const md = serialize({
    type: "bulletList",
    content: [{ type: "listItem", content: [para("item"), { type: "stagedCallout", attrs: { label: "Label" }, content: [para()] }] }],
  });
  const item = doc(md).content![0].content![0];
  assert.deepEqual(item.content!.map((n) => JSON.stringify(n.content?.[0]?.text)), ['"item"', '"Label"']);
});

test("an editor-built list item holding a two-paragraph callout survives two saves exactly", () => {
  // The shape the reviewer found: written, it re-parsed invalid, merged the
  // two paragraphs, and gained an indent space per pass.
  const built = {
    type: "doc",
    content: [{
      type: "bulletList",
      content: [{
        type: "listItem",
        content: [para("item"), { type: "stagedCallout", attrs: { label: "L" }, content: [para("Body one."), para("Body two.")] }],
      }],
    }],
  };
  assert.doesNotThrow(() => valid(built));
  const once = manager.serialize(built as never).trim();
  const reparsed = doc(once);
  assert.doesNotThrow(() => valid(reparsed));
  const callout = reparsed.content![0].content![0].content![1];
  assert.equal(callout.type, "stagedCallout");
  assert.deepEqual(callout.content!.map((n) => n.content?.[0]?.text), ["Body one.", "Body two."]);
  assert.equal(roundTrip(once), once);
});

test("a blank line before a staged block in a list item is remembered, and only there", () => {
  const loose = doc("- item\n\n  :::callout\n  x\n  :::").content![0].content![0].content![1];
  const tight = doc("- item\n  :::callout\n  x\n  :::").content![0].content![0].content![1];
  assert.equal(loose.attrs!.spaced, true);
  assert.equal(tight.attrs!.spaced, false);
  // At the top level the document already separates blocks; nothing extra.
  assert.equal(roundTrip(`para\n\n${STAGING_FIXTURES.callout}`), `para\n\n${STAGING_FIXTURES.callout}`);
});
