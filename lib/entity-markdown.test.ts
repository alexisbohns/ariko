import { test } from "node:test";
import assert from "node:assert/strict";
import { MarkdownManager } from "@tiptap/markdown";
import { headlessExtensions, normalizeEmptyListMarkers } from "./entity-markdown";

// The editor's parse/serialize pair, headless — no DOM, no React. This is the
// same manager components/editor/prose-editor.tsx builds minus the node
// views, which is exactly why the nodes live in lib/ without them.
const manager = new MarkdownManager({ extensions: headlessExtensions });
const roundTrip = (src: string): string => manager.serialize(manager.parse(src)).trim();
const docJson = (src: string): string => JSON.stringify(manager.parse(src));

test("a block card round-trips byte-identically", () => {
  const src = "::entity{ref=bean:karma-accountability}";
  assert.equal(roundTrip(src), src);
  assert.ok(docJson(src).includes('"entityCard"'));
});

test("an inline mention round-trips byte-identically, label and all", () => {
  const src = "see :entity[Prediction Timelines]{ref=bean:prediction-timelines} here";
  assert.equal(roundTrip(src), src);
  assert.ok(docJson(src).includes('"entityMention"'));
});

test("a ref-less directive mints nothing and stays literal text", () => {
  // Mirrors remarkEntity's rule (lib/markdown.ts): no ref, no node.
  for (const src of ["::entity{foo=bar}", "::entity{ref=}", "::entity"]) {
    assert.ok(!docJson(src).includes('"entityCard"'), src);
    assert.equal(roundTrip(src), src);
  }
});

test("indentation follows the CommonMark rule: 3 spaces yes, 4 spaces no", () => {
  assert.ok(docJson("   ::entity{ref=bean:x}").includes('"entityCard"'));
  // 4+ spaces is an indented code block; marked re-emits it as a fence, and
  // lib/markdown-conformance.test.ts's `indentedCode` fixture asserts that
  // renders identically to the source.
  assert.ok(!docJson("    ::entity{ref=bean:x}").includes('"entityCard"'));
});

test("code contexts never activate the directive", () => {
  assert.ok(!docJson("```\n::entity{ref=bean:x}\n```").includes('"entityCard"'));
  assert.ok(!docJson("literal `::entity{ref=bean:x}` here").includes('"entityMention"'));
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
  assert.ok(!docJson(src).includes('"entityCard"'));
  assert.equal(roundTrip(src), src);
});

test("a labeled block directive is a card, not a mention", () => {
  // `::entity[Label]{ref=…}` is the block form with an (unused) label, not an
  // inline mention — the block tokenizer must claim it before the inline one
  // ever sees it. The label is intentionally dropped on re-serialize:
  // components/markdown.tsx builds the card from data-ref alone and ignores
  // children.
  const src = "::entity[Some Label]{ref=bean:x}";
  const types = docJson(src);
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

test("a ref containing '}' or whitespace serializes to nothing, not a broken or truncated card", () => {
  // Guarded the same way as the label's ']', and for the more important
  // field: an unescaped '}' closes the brace early and drops the whole card
  // on re-parse, and whitespace gets silently truncated by REF instead —
  // either way the ref is lost, which "" avoids.
  const brace = { type: "doc", content: [{ type: "entityCard", attrs: { ref: "bean:x}" } }] };
  assert.equal(manager.serialize(brace).trim(), "");
  const space = { type: "doc", content: [{ type: "entityCard", attrs: { ref: "bean:x y" } }] };
  assert.equal(manager.serialize(space).trim(), "");
});

test("a ref-less card between paragraphs leaves a spurious empty paragraph on reparse", () => {
  // This is why nothing may create a ref-less node in the first place (Task 10
  // enforces that on insert) — serializing one to "" does not vanish cleanly.
  const doc = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "before" }] },
      { type: "entityCard", attrs: {} },
      { type: "paragraph", content: [{ type: "text", text: "after" }] },
    ],
  };
  assert.equal(manager.serialize(doc), "before\n\n\n\nafter");
});

test("a ref-less card as a list item's only child destroys the list on reparse", () => {
  const doc = {
    type: "doc",
    content: [
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [{ type: "entityCard", attrs: {} }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "b" }] }] },
        ],
      },
    ],
  };
  const md = manager.serialize(doc);
  assert.equal(md, "- \n- b");
  // The swallowed bullet marker turns the first item into a plain-text
  // paragraph, stranding the second item alone in a one-item list.
  assert.equal(
    docJson(md),
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"- "}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"b"}]}]}]}]}',
  );
});

test("a label containing ']' loses the bracket, not the mention, and the double space is collapsed", () => {
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
  assert.equal(md, ":entity[A B]{ref=bean:x}");
  assert.ok(docJson(md).includes('"entityMention"'));
});

test("normalizeEmptyListMarkers: strips the ONE trailing space/tab marked's list-start check can't handle (I2)", () => {
  // See lib/entity-markdown.ts's comment: marked reads "-\n" (nothing after
  // the marker) and "-  \n" / "- x" (two-plus trailing characters) as an
  // empty list item fine; only exactly one trailing space or tab, with
  // nothing else on the line, falls through to plain text.
  assert.equal(normalizeEmptyListMarkers("- \n  ::entity{ref=bean:x}"), "-\n  ::entity{ref=bean:x}");
  assert.equal(normalizeEmptyListMarkers("-\t\n  x"), "-\n  x");
  // Ordered markers, and both allowed punctuation styles.
  assert.equal(normalizeEmptyListMarkers("1. \n   x"), "1.\n   x");
  assert.equal(normalizeEmptyListMarkers("1) \n   x"), "1)\n   x");
  // A later, not just the first, sibling item.
  assert.equal(normalizeEmptyListMarkers("- a\n- \n- c"), "- a\n-\n- c");
  // Untouched: no trailing space at all, two-plus trailing characters, or
  // real content after the marker.
  for (const src of ["-\n  x", "-  \n  x", "- x", "- text", "1.\n2. two"]) {
    assert.equal(normalizeEmptyListMarkers(src), src, src);
  }
});

test("a mention's marks are dropped, on parse as well as on serialize", () => {
  // Two separate losses, easy to conflate: `applyMarkToContent` (in
  // @tiptap/markdown) applies marks by recursing into a node's `content`, and
  // an atom node has neither. So `*:entity[X]{ref=bean:y}*` already parses
  // with no marks on the mention (checked here), and a mention a caller hand-
  // sets a mark on also drops it on serialize (checked separately below).
  // Both are upstream limitations, not something this file can fix — pinned
  // here so a future @tiptap/markdown upgrade surfaces them as a diff rather
  // than a surprise.
  const parsed = manager.parse("*:entity[X]{ref=bean:y}*") as {
    content?: Array<{ content?: Array<{ type?: string; marks?: unknown[] }> }>;
  };
  const mention = parsed.content?.[0]?.content?.find((n) => n.type === "entityMention");
  assert.ok(mention, JSON.stringify(parsed));
  assert.ok(!mention?.marks?.length, JSON.stringify(mention));

  const doc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "entityMention", attrs: { ref: "bean:y", label: "X" }, marks: [{ type: "italic" }] },
        ],
      },
    ],
  };
  assert.equal(manager.serialize(doc).trim(), ":entity[X]{ref=bean:y}");
});
