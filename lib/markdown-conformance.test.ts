import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import { MarkdownManager } from "@tiptap/markdown";
import { getSchema, type JSONContent } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { remarkPlugins, rehypePlugins } from "./markdown";
import { headlessExtensions, normalizeEmptyListMarkers } from "./entity-markdown";
import { extractRefs } from "./entity-refs";
import { ENTITY_FIXTURES } from "./entity-fixtures";

// C1's durable half: MarkdownManager (used for `editorVerdict` below) does
// NOT enforce the ProseMirror schema — `manager.parse` happily returns a
// document ProseMirror itself would reject, which is exactly how a card as a
// list item's first child (`- ::entity{ref=bean:x}`) shipped invisibly: it
// "parsed" fine here, and Tiptap's `EditorState.create` doesn't validate
// content either, so the break only surfaced on the NEXT transaction, as a
// `RangeError` thrown out of `dispatchTransaction` (a DOM event listener, so
// no React error boundary catches it) — silently freezing the editor. This
// schema is the actual ProseMirror gate: it's what the running editor
// enforces on every transaction, even though `parse`/`EditorState.create`
// don't enforce it on load.
const schema = getSchema(headlessExtensions as never);

// Spec §6. The editor writes markdown with `marked`; the site renders it with
// `remark`. This asserts they MEAN the same thing, by comparing rendered HTML
// rather than markdown — markdown comparison would fail on harmless
// normalization (spec §2.5) and would be a test about formatting, not meaning.
// indentation MUST mirror components/editor/prose-editor.tsx's
// `Markdown.configure(...)` — this manager is the headless stand-in for the
// editor's own MarkdownManager (constructed internally with whatever the
// `Markdown` extension is configured with), and a mismatch here would mean
// these tests exercise indentation the real editor never produces. size: 3
// is C2's fix for nested ORDERED lists (see that file's comment).
const manager = new MarkdownManager({
  extensions: headlessExtensions,
  indentation: { style: "space", size: 3 },
});

// The EXACT chain the app renders — same helper as lib/entity-refs.test.ts:12.
const render = (source: string): string =>
  renderToStaticMarkup(createElement(Markdown, { remarkPlugins, rehypePlugins }, source));

// normalizeEmptyListMarkers mirrors what components/editor/prose-editor.tsx
// applies to `initialMarkdown` before it ever reaches the editor (I2) — this
// keeps `roundTrip` an accurate stand-in for what the real editor does with
// stored markdown, not just what MarkdownManager does on its own.
const roundTrip = (source: string): string =>
  manager.serialize(manager.parse(normalizeEmptyListMarkers(source))).trim();

const FIXTURES: Record<string, string> = {
  heading: "## Execution",
  emphasis: "plain *em* and **strong** text",
  underscoreEmphasis: "_em_ and __strong__",
  link: "see [the docs](https://example.com)",
  linkTitle: '[x](https://e.com "T")',
  bullets: "- one\n- two",
  nestedList: "- a\n  - b\n- c",
  ordered: "1. first\n2. second",
  // C2: an ordered item's marker (`1. `) is 3 columns wide, so CommonMark
  // needs a 3-space child indent to keep a nested ordered list attached to
  // its parent item — 2 undershoots and the nesting is silently lost.
  nestedOrdered: "1. outer one\n   1. inner a\n   2. inner b\n2. outer two",
  nestedOrderedDeep: "1. a\n   1. b\n      1. c",
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
  // I2: a bullet marker followed by exactly one trailing space and nothing
  // else — the shape marked's block-start check misreads as plain text
  // instead of an empty list item — with a card as the item's only real
  // content. See lib/entity-markdown.ts's normalizeEmptyListMarkers.
  emptyListItemCard: "- \n  ::entity{ref=bean:x}",
  emptyOrderedItemCard: "1. \n   ::entity{ref=bean:x}",
};

for (const [name, source] of Object.entries(FIXTURES)) {
  test(`conformance: ${name} means the same after a round trip`, () => {
    assert.equal(render(roundTrip(source)), render(source));
  });
}

test("I2 fix: an empty list item ahead of a card is not silently rewritten as an orphaned card on save", () => {
  // Before the fix: marked's block-start check misreads "- \n" (a bullet
  // marker with exactly one trailing space and nothing else) as plain
  // paragraph text, not an empty list item — the list is gone from the
  // moment the document is opened, and the card that was the item's only
  // real content becomes an orphaned top-level node. Re-serializing that
  // then permanently corrupts the stored markdown: round-trip DATA LOSS, not
  // a display difference. This asserts the editor now agrees with remark
  // both on what the page looks like AND on the underlying structure — the
  // card ends up inside the list, not next to it.
  const source = "- \n  ::entity{ref=bean:x}";
  assert.equal(render(roundTrip(source)), render(source));
  const json = manager.parse(normalizeEmptyListMarkers(source)) as JSONContent;
  assert.equal(json.content?.[0]?.type, "bulletList");
  assert.equal(json.content?.[0]?.content?.[0]?.type, "listItem");
  assert.equal(json.content?.[0]?.content?.[0]?.content?.[0]?.type, "entityCard");
  // And it stays schema-valid — C1's fix (listItem content "block+") is what
  // lets a list item whose only real content is a card exist at all.
  assert.doesNotThrow(() => {
    PMNode.fromJSON(schema, manager.parse(normalizeEmptyListMarkers(source)) as never).check();
  });
});

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

test("KNOWN DIVERGENCE: a card in an ordered list item is invisible to the editor", () => {
  // Upstream in @tiptap/markdown, not ours to fix: its bullet-list handling
  // block-tokenizes an item's content (so `- ::entity{ref=…}` parses as a
  // card, per ENTITY_FIXTURES), but its ordered-list handling does not — an
  // ordered item's content is only ever inline-tokenized, so the block
  // tokenizer that recognizes `::entity{…}` never runs on it. The page and
  // the graph agree it is a card (both walk the real remark/regex source,
  // not the editor's schema); only the editor's own parse of its own syntax
  // disagrees. Crucially: no data is lost. The round trip is byte-stable —
  // the author just sees raw `::entity{...}` syntax instead of a live card
  // when reopening a document with a card in this one position.
  //
  // All three ordered-marker spellings CommonMark allows (`1.`, `1)`, and a
  // multi-digit `10.`) hit the same upstream gap identically. Content is
  // never lost for any of them; `1)` is the one spelling where the marker
  // ITSELF is not byte-stable — the editor's serializer always re-emits an
  // ordered marker as `N.`, never `N)`, regardless of which one was parsed.
  // That is marker-style normalization, not data loss: the ref and the rest
  // of the line survive untouched either way.
  const roundTrips: Record<string, string> = {
    "1.": "1. ::entity{ref=bean:x}",
    "1)": "1. ::entity{ref=bean:x}",
    "10.": "10. ::entity{ref=bean:x}",
  };
  for (const marker of ["1.", "1)", "10."]) {
    const source = `${marker} ::entity{ref=bean:x}`;
    assert.match(render(source), /<entity-card data-ref="bean:x">/, source);
    assert.deepEqual(extractRefs(source), [{ kind: "embeds", ref: "bean:x" }], source);
    assert.ok(!JSON.stringify(manager.parse(source)).includes('"entityCard"'), source);
    assert.equal(roundTrip(source), roundTrips[marker], source);
  }
});

test("KNOWN DIVERGENCE: a linked image silently loses its link on the round trip", () => {
  // The same failure class as the image loss Task 3c's Step 1 fixed — a node
  // the editor's schema cannot fully represent — one layer down and upstream:
  // @tiptap/markdown parses `[![alt](/i.png)](https://e.com)` into a plain
  // image node with no memory of the enclosing link, and
  // `Image.configure({ inline: true })` does not change that. Unlike the
  // character-entity and footnote pins above, this one is silent: the author
  // sees a normal-looking image both before and after, with no visual sign
  // the link URL is gone. Pinned so an @tiptap/markdown upgrade that fixes it
  // shows up as a diff here rather than as a surprise in production.
  const source = "[![alt](/i.png)](https://e.com)";
  assert.match(render(source), /<a href="https:\/\/e\.com"><img src="\/i\.png" alt="alt"\/><\/a>/);
  assert.equal(roundTrip(source), "![alt](/i.png)");
  assert.doesNotMatch(render(roundTrip(source)), /<a /);
});

test("REGRESSION (ReDoS): extractRefs stays fast on adversarial marker-run input", () => {
  // Task 3c widened entity-refs.ts's BLOCK regex to tolerate blockquote/list
  // markers before a card. An earlier version of that widening put a `[ \t]*`
  // INSIDE the repeated marker group, which is ambiguous: a run of k
  // whitespace characters between two markers can be split between "end of
  // one iteration" and "start of the next" in k different ways, and with n
  // markers the engine explores k^n paths once the string fails to end in
  // `::entity{...}` — catastrophic backtracking. extractRefs runs on every
  // write path, including the up-to-64-KiB body /api/articles accepts, and a
  // regex hang blocks Node's entire event loop for every concurrent request.
  // This asserts adversarial input that reproduced multi-second hangs on the
  // vulnerable regex still completes in well under a second. Shape: 200 lines
  // (a realistic document length), each 40 marker-plus-run-of-spaces
  // repetitions wide with no `::entity{...}` to ever match — the worst case,
  // since every line fully exhausts the ambiguous split before failing.
  const line = "-    ".repeat(40);
  const adversarial = Array.from({ length: 200 }, () => line).join("\n");
  const start = performance.now();
  extractRefs(adversarial);
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 1000, `extractRefs took ${elapsed.toFixed(1)}ms on adversarial input`);
});

// Reads what each implementation believes the fixture contains.
const remarkVerdict = (md: string): "card" | "mention" | "none" => {
  const html = render(md);
  if (html.includes("<entity-card")) return "card";
  if (html.includes("<entity-link")) return "mention";
  return "none";
};

const editorVerdict = (md: string): "card" | "mention" | "none" => {
  // normalizeEmptyListMarkers: see roundTrip above — same reasoning.
  const json = JSON.stringify(manager.parse(normalizeEmptyListMarkers(md)));
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

  // C1's durable half: every fixture must also parse to a document the
  // running ProseMirror schema actually accepts — not just one `manager.parse`
  // is willing to hand back. This is the check `editorVerdict` above cannot
  // do: MarkdownManager has no schema opinion at all.
  test(`${JSON.stringify(md)} parses to a schema-valid document`, () => {
    assert.doesNotThrow(() => {
      PMNode.fromJSON(schema, manager.parse(normalizeEmptyListMarkers(md)) as never).check();
    });
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
