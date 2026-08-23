import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import { MarkdownManager } from "@tiptap/markdown";
import { remarkPlugins, rehypePlugins } from "./markdown";
import { headlessExtensions } from "./entity-markdown";
import { extractRefs } from "./entity-refs";
import { ENTITY_FIXTURES } from "./entity-fixtures";

// Spec §6. The editor writes markdown with `marked`; the site renders it with
// `remark`. This asserts they MEAN the same thing, by comparing rendered HTML
// rather than markdown — markdown comparison would fail on harmless
// normalization (spec §2.5) and would be a test about formatting, not meaning.
const manager = new MarkdownManager({ extensions: headlessExtensions });

// The EXACT chain the app renders — same helper as lib/entity-refs.test.ts:12.
const render = (source: string): string =>
  renderToStaticMarkup(createElement(Markdown, { remarkPlugins, rehypePlugins }, source));

const roundTrip = (source: string): string => manager.serialize(manager.parse(source)).trim();

const FIXTURES: Record<string, string> = {
  heading: "## Execution",
  emphasis: "plain *em* and **strong** text",
  underscoreEmphasis: "_em_ and __strong__",
  link: "see [the docs](https://example.com)",
  linkTitle: '[x](https://e.com "T")',
  bullets: "- one\n- two",
  nestedList: "- a\n  - b\n- c",
  ordered: "1. first\n2. second",
  quote: "> quoted line",
  inlineCode: "call `filterPublic()` first",
  fenced: "```ts\nconst x: number = 1\n```",
  indentedCode: "    ::entity{ref=bean:x}",
  table: "| a | b |\n| --- | --- |\n| 1 | 2 |",
  hardWrap: "line one\nline two",
  entityCard: "::entity{ref=bean:karma-accountability}",
  entityInline: "see :entity[Prediction Timelines]{ref=bean:prediction-timelines} here",
  entityInFence: "```\n::entity{ref=bean:x}\n```",
  entityInInlineCode: "literal `::entity{ref=bean:x}` here",
  reflessBlock: "::entity{foo=bar}",
  emptyRef: "::entity{ref=}",
  mixed: "## Drawer\n\nProse with :entity[X]{ref=bean:x} inline.\n\n::entity{ref=bean:y}",
  image: "![alt text](/img.png)",
  imageTitled: '![alt](/i.png "Title")',
  taskList: "- [ ] todo item\n- [x] done item",
  bom: "﻿meet at 10:30 tomorrow",
};

for (const [name, source] of Object.entries(FIXTURES)) {
  test(`conformance: ${name} means the same after a round trip`, () => {
    assert.equal(render(roundTrip(source)), render(source));
  });
}

test("a ref-less inline directive degrades to prose, not to a <div> in a <p>", () => {
  // compose §3: "a directive whose ref is missing or malformed produces no
  // element at all". Before this slice the unhandled mdast node reached
  // mdast-util-to-hast, which renders it as a bare <div> — inside a <p>, which
  // is invalid nesting.
  assert.equal(render("see :entity[Label]{} here"), "<p>see Label here</p>");
});

test("KNOWN DIVERGENCE: a malformed inline directive is the one case the parsers read differently", () => {
  // remark CONSUMES the directive syntax and keeps the label; marked never
  // tokenizes it, so it survives as literal text and serializes with escaped
  // brackets. Neither is wrong — they disagree only on input the editor can
  // never produce, and which only reaches the vault by hand through
  // /api/articles. Asserted so it stays known rather than surprising; if this
  // test starts failing, the parsers have converged and it can be deleted.
  const source = "see :entity[Label]{} here";
  assert.equal(render(source), "<p>see Label here</p>");
  assert.equal(roundTrip(source), "see :entity\\[Label\\]{} here");
  assert.notEqual(render(roundTrip(source)), render(source));
});

test("KNOWN DIVERGENCE: a character entity survives remark but not the round trip", () => {
  // remark decodes `&copy;` to the actual glyph; marked's serializer re-escapes
  // the leading `&` of anything that still looks like an entity, so a second
  // pass through the editor turns it into literal `&amp;copy;` text. No
  // extension can fix this — it is `@tiptap/markdown`'s own serialization
  // rule. Pinned here so an upgrade that changes it shows up as a diff.
  const source = "AT&amp;T &copy; x";
  assert.equal(roundTrip(source), "AT&amp;T &amp;copy; x");
  assert.notEqual(render(roundTrip(source)), render(source));
});

test("KNOWN DIVERGENCE: a GFM footnote survives remark but not the round trip", () => {
  // remark-gfm renders a real footnote (a superscript ref plus a backref
  // section); marked has no footnote syntax at all, so it reads `[^1]` as
  // plain text and `[^1]: note` as a reference-style link, producing
  // `text[^1](note)` — a visibly different, but not silently lossy, document.
  const source = "text[^1]\n\n[^1]: note";
  assert.equal(roundTrip(source), "text[^1](note)");
  assert.notEqual(render(roundTrip(source)), render(source));
});

// Reads what each implementation believes the fixture contains.
const remarkVerdict = (md: string): "card" | "mention" | "none" => {
  const html = render(md);
  if (html.includes("<entity-card")) return "card";
  if (html.includes("<entity-link")) return "mention";
  return "none";
};

const editorVerdict = (md: string): "card" | "mention" | "none" => {
  const json = JSON.stringify(manager.parse(md));
  if (json.includes('"entityCard"')) return "card";
  if (json.includes('"entityMention"')) return "mention";
  return "none";
};

const refsVerdict = (md: string): "card" | "mention" | "none" => {
  const kinds = extractRefs(md).map((r) => r.kind);
  if (kinds.includes("embeds")) return "card";
  if (kinds.includes("mentions")) return "mention";
  return "none";
};

for (const { md, expect } of ENTITY_FIXTURES) {
  test(`all three readers agree on ${JSON.stringify(md)}`, () => {
    assert.equal(remarkVerdict(md), expect, "remark (renders the page)");
    assert.equal(editorVerdict(md), expect, "marked tokenizer (the editor writes)");
    assert.equal(refsVerdict(md), expect, "extractRefs (feeds the graph)");
  });
}

test("a time of day survives rendering", () => {
  assert.equal(render("meet at 10:30 tomorrow"), "<p>meet at 10:30 tomorrow</p>");
});

test("a ratio survives rendering", () => {
  assert.equal(render("a ratio of 3:2 today"), "<p>a ratio of 3:2 today</p>");
});

test("a directive we do not handle is left as the text the author wrote", () => {
  // remark-directive parses ALL directive syntax, not just ours. Anything we
  // do not claim must be handed back verbatim rather than rendered as a <div>.
  assert.equal(render("see :something[here] in prose"), "<p>see :something[here] in prose</p>");
  assert.equal(render("::callout{type=warn}"), "<p>::callout{type=warn}</p>");
});

test("a foreign container directive unwraps to its children, preserving structure — not one run-on paragraph", () => {
  // Task 3b's byte-offset restoration is right for a single-line foreign
  // leaf/text directive, but wrong for a container: slicing raw source would
  // flatten `:::note`'s two paragraphs into one paragraph of literal text.
  const html = render(":::note\npara one\n\npara two\n:::");
  assert.equal(html, "<p>para one</p>\n<p>para two</p>");
  assert.ok(!html.includes("<div"));
});

test(":::entity{...} is a CONTAINER, not ours — Ariko's grammar has no container form", () => {
  // Even though the name matches, a triple-colon `:::entity{…}` is not the
  // block card: Ariko only claims leafDirective and textDirective. It falls
  // through to the same unwrap-to-children handling as any other foreign
  // container; with nothing between the fences, that unwraps to nothing.
  const html = render(":::entity{ref=bean:x}");
  assert.ok(!html.includes("entity-card"));
  assert.ok(!html.includes("<div"));
});

test("a foreign container wrapping a real card lets the card still render, matching what extractRefs already mints", () => {
  // The page/graph disagreement this slice exists to eliminate: extractRefs
  // is a raw scan and already saw the nested ::entity{ref=…} regardless of
  // its container, but before this fix the page discarded the whole
  // container — and the card inside it — as one run-on paragraph of text.
  const src = ":::grid\n::entity{ref=bean:x}\n:::";
  assert.match(render(src), /<entity-card data-ref="bean:x">/);
  assert.deepEqual(extractRefs(src), [{ kind: "embeds", ref: "bean:x" }]);
});

test("no rendered output ever contains a div at all", () => {
  // This pipeline never legitimately mints a div, so any div — empty or not —
  // is the bare-directive bug. Matching only the literal "<div></div>" would
  // have missed the `:something[here]` -> `<div>here</div>` case that
  // motivated Task 3b in the first place.
  for (const md of ["meet at 10:30", "3:2", ":x", "a:b:c", "::callout{type=warn}"]) {
    assert.ok(!render(md).includes("<div"), md);
  }
});
