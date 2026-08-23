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
