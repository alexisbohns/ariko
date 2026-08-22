import { test } from "node:test";
import assert from "node:assert/strict";
import { MarkdownManager } from "@tiptap/markdown";
import { headlessExtensions } from "./entity-markdown";

// The editor's parse/serialize pair, headless — no DOM, no React. This is the
// same manager the editor builds (components/editor/prose-editor.tsx) minus the
// node views, which is exactly why the nodes live in lib/ without them.
const manager = new MarkdownManager({ extensions: headlessExtensions });
const roundTrip = (src: string): string => manager.serialize(manager.parse(src)).trim();
const nodeTypes = (src: string): string => JSON.stringify(manager.parse(src));

test("a block card round-trips byte-identically", () => {
  const src = "::entity{ref=bean:karma-accountability}";
  assert.equal(roundTrip(src), src);
  assert.ok(nodeTypes(src).includes('"entityCard"'));
});

test("an inline mention round-trips byte-identically, label and all", () => {
  const src = "see :entity[Prediction Timelines]{ref=bean:prediction-timelines} here";
  assert.equal(roundTrip(src), src);
  assert.ok(nodeTypes(src).includes('"entityMention"'));
});

test("a ref-less directive mints nothing and stays literal text", () => {
  // Mirrors remarkEntity's rule (lib/markdown.ts): no ref, no node.
  for (const src of ["::entity{foo=bar}", "::entity{ref=}", "::entity"]) {
    assert.ok(!nodeTypes(src).includes('"entityCard"'), src);
    assert.equal(roundTrip(src), src);
  }
});

test("indentation follows the CommonMark rule: 3 spaces yes, 4 spaces no", () => {
  assert.ok(nodeTypes("   ::entity{ref=bean:x}").includes('"entityCard"'));
  // 4+ spaces is an indented code block; marked re-emits it as a fence, which
  // renders identically (asserted in lib/markdown-conformance.test.ts).
  assert.ok(!nodeTypes("    ::entity{ref=bean:x}").includes('"entityCard"'));
});

test("code contexts never activate the directive", () => {
  assert.ok(!nodeTypes("```\n::entity{ref=bean:x}\n```").includes('"entityCard"'));
  assert.ok(!nodeTypes("literal `::entity{ref=bean:x}` here").includes('"entityMention"'));
});

test("a mixed document keeps prose, mention and card in order", () => {
  const src = "## Drawer\n\nProse with :entity[X]{ref=bean:x} inline.\n\n::entity{ref=bean:y}";
  assert.equal(roundTrip(src), src);
});

test("a one-character prefix before the block form is enough to keep it literal", () => {
  // Regression: marked calls a tokenizer's `start` with `src.slice(1)`, so an
  // unanchored `^` inside `start`'s regex asserted at real offset 1, not 0 —
  // which let `x::entity{ref=bean:y}` be misread as a card.
  const src = "x::entity{ref=bean:y}";
  assert.ok(!nodeTypes(src).includes('"entityCard"'));
  assert.equal(roundTrip(src), src);
});

test("a labeled block directive is a card, not a mention", () => {
  // `::entity[Label]{ref=…}` is the block form with an (unused) label, not an
  // inline mention — the block tokenizer must claim it before the inline one
  // ever sees it. The label is intentionally dropped on re-serialize:
  // components/markdown.tsx builds the card from data-ref alone and ignores
  // children.
  const src = "::entity[Some Label]{ref=bean:x}";
  const types = nodeTypes(src);
  assert.ok(types.includes('"entityCard"'), types);
  assert.ok(!types.includes('"entityMention"'), types);
  assert.equal(roundTrip(src), "::entity{ref=bean:x}");
});

test("a ref-less node serializes to nothing, never to a literal 'undefined'", () => {
  const card = { type: "doc", content: [{ type: "entityCard", attrs: {} }] };
  assert.equal(manager.serialize(card).trim(), "");
  const mention = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "entityMention", attrs: { label: "x" } }] }],
  };
  assert.equal(manager.serialize(mention).trim(), "");
});

test("a label containing ']' loses the bracket, not the mention", () => {
  // Reachable from data: Task 10 inserts entity names as labels. Silently
  // dropping the whole mention (and its ref) would be worse than dropping one
  // bracket from the display label, so renderMarkdown strips rather than
  // escapes.
  const doc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "entityMention", attrs: { ref: "bean:x", label: "A ] B" } }],
      },
    ],
  };
  const md = manager.serialize(doc).trim();
  assert.equal(md, ":entity[A  B]{ref=bean:x}");
  assert.ok(nodeTypes(md).includes('"entityMention"'));
});

test("emphasis around a mention is dropped by @tiptap/markdown (upstream, not ours)", () => {
  // applyMarkToContent (in @tiptap/markdown) applies marks by recursing into a
  // node's `content`, and an atom node has none — so the mark is silently
  // dropped on serialize. Known upstream limitation, pinned here so a future
  // @tiptap/markdown upgrade surfaces it as a diff rather than a surprise.
  assert.equal(roundTrip("*:entity[X]{ref=bean:y}*"), ":entity[X]{ref=bean:y}");
});
