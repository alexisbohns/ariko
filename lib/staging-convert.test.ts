import { test } from "node:test";
import assert from "node:assert/strict";
import { MarkdownManager } from "@tiptap/markdown";
import { getSchema } from "@tiptap/core";
import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import { headlessExtensions } from "./entity-markdown";
import { figureFromImage, NOT_ALONE, NOT_HERE } from "./staging-convert";

// The editor's own schema and markdown reader, headless (as in
// lib/staging-editor.test.ts) — the function reads a state, not a view.
const manager = new MarkdownManager({ extensions: headlessExtensions, indentation: { style: "space", size: 3 } });
const schema = getSchema(headlessExtensions as never);

const SRC = "https://res.cloudinary.com/demo/image/upload/moon.png";

/** A state over `md` with the FIRST image node-selected. */
function imageSelected(md: string): EditorState {
  const doc = schema.nodeFromJSON(manager.parse(md));
  let at = -1;
  doc.descendants((node, pos) => {
    if (at < 0 && node.type.name === "image") at = pos;
  });
  assert.ok(at >= 0, `an image in ${JSON.stringify(md)}`);
  return EditorState.create({ doc, selection: NodeSelection.create(doc, at) });
}

test("an image alone on its line converts: its paragraph's range, frame none at its default size", () => {
  const state = imageSelected(`Before.\n\n![The moon](${SRC})\n\nAfter.`);
  const r = figureFromImage(state);
  assert.ok(r?.ok, JSON.stringify(r));
  assert.deepEqual(r.attrs, { frame: "none", size: "l", src: SRC, alt: "The moon", darkSrc: "", darkAlt: "", caption: "" });
  const replaced = state.doc.resolve(r.from).nodeAfter;
  assert.equal(replaced?.type.name, "paragraph");
  assert.equal(r.to, r.from + replaced!.nodeSize, "the whole line, so no empty paragraph is left behind");
});

test("the image's title becomes the caption; an empty alt stays empty", () => {
  const r = figureFromImage(imageSelected(`![](${SRC} "Close-up, f/8")`));
  assert.ok(r?.ok);
  assert.equal(r.attrs.caption, "Close-up, f/8");
  assert.equal(r.attrs.alt, "");
});

test("whitespace and hard breaks around the image still count as its own line", () => {
  const doc = schema.node("doc", null, [
    schema.node("paragraph", null, [schema.text("  "), schema.nodes.image.create({ src: SRC }), schema.nodes.hardBreak.create()]),
  ]);
  const state = EditorState.create({ doc, selection: NodeSelection.create(doc, 3) });
  assert.equal(figureFromImage(state)?.ok, true);
});

test("an image sharing its line with text, or with another image, is refused with the reason", () => {
  for (const md of [`Look: ![a](${SRC})`, `![a](${SRC}) — the moon`, `![a](${SRC}) ![b](${SRC})`]) {
    assert.deepEqual(figureFromImage(imageSelected(md)), { ok: false, reason: NOT_ALONE }, md);
  }
});

test("an image in a list item, a table cell, a callout or an attributed quote is refused — the `/` menu's rule", () => {
  const cases = {
    list: `- ![a](${SRC})`,
    task: `- [ ] ![a](${SRC})`,
    table: `| h |\n| --- |\n| ![a](${SRC}) |`,
    callout: `:::callout\n![a](${SRC})\n:::`,
    quote: `:::quote{by="Ada"}\n![a](${SRC})\n:::`,
  };
  for (const [name, md] of Object.entries(cases)) {
    assert.deepEqual(figureFromImage(imageSelected(md)), { ok: false, reason: NOT_HERE }, name);
  }
});

test("a text selection, or a node selection on anything but an image, is not a candidate", () => {
  const state = imageSelected(`Some words.\n\n![a](${SRC})`);
  assert.equal(figureFromImage(state.apply(state.tr.setSelection(TextSelection.create(state.doc, 2, 6)))), null);
  const fig = EditorState.create({ doc: schema.nodeFromJSON(manager.parse(`:::figure\n![a](${SRC})\n:::`)) });
  assert.equal(figureFromImage(fig.apply(fig.tr.setSelection(NodeSelection.create(fig.doc, 0)))), null);
});
