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
  // I3: with Underline disabled (lib/entity-markdown.ts's baseExtensions),
  // "++text++" is no longer a grammar the editor understands — it is
  // literal text on both sides, same as remark always treated it.
  literalPlusPlus: "text with ++not underline++ inside",
  // Item 1: @tiptap/markdown tokenizes an image as INLINE whenever it isn't
  // a lone top-level line — mid-paragraph, or a list item's only content —
  // which `Image.configure({ inline: true })` (lib/entity-markdown.ts) now
  // matches. Before that fix these two were schema-invalid on load (see the
  // schema-check loop below): the document parsed, then the NEXT keystroke
  // threw a RangeError out of dispatchTransaction and froze the editor —
  // invisible to this render-equality loop, which never drives a real
  // Editor or its transactions (that's what lib/editor-mount.test.ts is for).
  imageInline: "text ![a](/i.png) more",
  imageInItem: "- ![a](/i.png)",
  // Item 2: TaskItem defaults to `nested: false` (content "paragraph+"), but
  // its parseMarkdown pushes a nested taskList's tokens unconditionally —
  // schema-invalid on load, same failure class as the two rows above, fixed
  // by `TaskItem.configure({ nested: true })`.
  nestedTask: "- [ ] a\n  - [x] b",
};

for (const [name, source] of Object.entries(FIXTURES)) {
  test(`conformance: ${name} means the same after a round trip`, () => {
    assert.equal(render(roundTrip(source)), render(source));
  });
}

// Item 3: FIXTURES only ever got render-equality — no schema check — which is
// exactly why items 1 (inline image) and 2 (nested task list / card-in-task-
// item) were invisible here: a fixture could round-trip through
// MarkdownManager just fine while still parsing to a document the RUNNING
// ProseMirror schema rejects on the next transaction (the same gap the
// comment above `schema` at the top of this file describes for
// ENTITY_FIXTURES — this is that same check, over the OTHER corpus).
//
// cardInTask is checked here too but deliberately kept OUT of FIXTURES
// itself: it is schema-valid after item 2's fix (this loop passes) but does
// NOT render-equal after the round trip, for a real and unrelated reason —
// see the KNOWN DIVERGENCE test below. Folding it into FIXTURES would make
// the render-equality loop above assert something false.
const SCHEMA_CHECK_FIXTURES: Record<string, string> = {
  ...FIXTURES,
  cardInTask: "- [ ] a\n\n  ::entity{ref=bean:x}",
};

for (const [name, source] of Object.entries(SCHEMA_CHECK_FIXTURES)) {
  test(`${JSON.stringify(name)} (${JSON.stringify(source)}) parses to a schema-valid document`, () => {
    assert.doesNotThrow(() => {
      PMNode.fromJSON(schema, manager.parse(normalizeEmptyListMarkers(source)) as never).check();
    });
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

test("I3 fix: \"++x++\" is literal text, not a synthesized underline mark", () => {
  // Before the fix: StarterKit shipped @tiptap/extension-underline, which
  // registers a markdownTokenizer for "++...++" AND live keyboard shortcuts
  // (Mod-u/Mod-U). Two ways an underline mark could exist in the document:
  // typing/pasting literal "++text++", or selecting plain text and pressing
  // Cmd-U. Either way, @tiptap/markdown serializes the mark back out as
  // "++text++" — and remark + remark-gfm has no "++" rule, so the PUBLIC
  // page rendered that literally: "editor shows underlined text, page shows
  // ++underlined text++". The round trip through the editor's OWN manager is
  // byte-stable in both directions, which is exactly why the render-equality
  // loop above (FIXTURES.literalPlusPlus) cannot, by itself, distinguish
  // "understood the same way" from "coincidentally re-emitted the same
  // bytes" — this test checks the underlying structure instead.
  const source = "++x++";
  assert.equal(render(roundTrip(source)), render(source));
  const json = manager.parse(source) as JSONContent;
  const marks = (json.content?.[0]?.content ?? []).flatMap((n) => n.marks ?? []);
  assert.ok(
    !marks.some((m) => m.type === "underline"),
    "no extension registers a markdown mark for \"++...++\" once Underline is disabled",
  );
  assert.deepEqual(json.content?.[0]?.content?.[0], { type: "text", text: "++x++" });
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

test("KNOWN DIVERGENCE: a card sharing a task item with a blank line renders loose, not tight, after the round trip", () => {
  // Item 2's fix (TaskItem.configure({ nested: true })) makes this shape
  // schema-valid (see the cardInTask row in the schema-check loop above) but
  // does not make it render-identical. @tiptap/core's own
  // renderNestedMarkdownContent — the shared helper every listItem-like
  // node's renderMarkdown calls, TaskItem included — only emits a blank line
  // ahead of a nested child when that child is itself a paragraph
  // (`child.type === "paragraph" ? "\n\n..." : "\n..."`); a non-paragraph
  // child like entityCard always gets a single newline, tight, no matter
  // whether the ORIGINAL markdown had a blank line there. remark's own
  // loose-vs-tight list rule keys off exactly that blank line, so the round
  // trip flips this list from loose (the item's own text wrapped in <p>) to
  // tight (unwrapped) — a rendering difference, not a data-loss one: the
  // card and its ref survive intact, only the list's looseness does not.
  // Upstream in @tiptap/core, not ours to fix — same class as the ordered-
  // list-item and linked-image pins above, and not in FIXTURES for the same
  // reason: it would make the render-equality loop assert something false.
  const source = "- [ ] a\n\n  ::entity{ref=bean:x}";
  const rt = roundTrip(source);
  assert.match(render(source), /<p><input[^>]*\/> a<\/p>/, render(source));
  assert.doesNotMatch(render(rt), /<p><input/, render(rt));
  assert.match(render(rt), /<entity-card data-ref="bean:x">/);
  assert.notEqual(render(rt), render(source));
});

test("KNOWN DIVERGENCE: a nested list under a double-digit ordered item is flattened, not indented", () => {
  // C2 (Markdown.configure({ indentation: { size: 3 } })) fixes ordered-list
  // nesting for single-digit items: `1. ` is 3 columns, so a 3-space child
  // indent matches exactly. But an ordered marker's width is NOT constant —
  // `1.`-`9.` is 3 columns, `10.`-`99.` is 4, `100.`-`999.` is 5 — and
  // `indentation: { size: N }` is one fixed number for the WHOLE document;
  // marked has no per-list-type (let alone per-marker-width) indent option,
  // so there is no single `size` that is simultaneously correct for a
  // single-digit item's children AND a double-digit item's children in the
  // same list. A child nested under item 10 at the (correct, single-digit)
  // 3-space indent under-indents by one column relative to what item 10's
  // OWN marker needs, and remark reads the under-indented line as flattened
  // sibling content rather than a nested list. This is a real editor
  // limitation, not a test gap: pinned here so the existing nestedOrdered /
  // nestedOrderedDeep fixtures (both single-digit) stop implying ordered
  // nesting is fixed in general, and so a future indent-size change that
  // widens this shows up as a diff instead of a silent behavior change.
  const source = "9. i\n10. j\n    1. nested under ten";
  assert.match(render(source), /<ol>\s*<li>nested under ten<\/li>\s*<\/ol>/, "source nests as expected");
  const rt = roundTrip(source);
  assert.equal(rt, "9. i\n10. j\n   1. nested under ten");
  assert.doesNotMatch(render(rt), /<ol>\s*<li>nested under ten<\/li>\s*<\/ol>/, "round trip loses the nesting");
  assert.notEqual(render(rt), render(source));
});

test("REGRESSION (ReDoS): extractRefs stays fast on adversarial input that actually contains a ref", () => {
  // Two catastrophic-backtracking fixes have gone into entity-refs.ts's
  // BLOCK regex: 07129b5 (a per-iteration `[ \t]*` inside the repeated
  // marker group, k^n paths across n markers) and 215fe7f (the lookbehind's
  // `>[ \t]*` / `[ \t]+` overlapping the following `[^\n]*`, O(L^2) per line
  // start on a marker followed by a long run of trailing whitespace). This
  // test's job is to keep BOTH fixed — and to do so honestly.
  //
  // THE TRAP: an adversarial string with NO "::entity" substring ANYWHERE is
  // not a valid regression test, no matter how pathological its
  // whitespace/marker structure is. The regex's required literal
  // ("::entity") lets the engine's own literal pre-scan rule out a match
  // (and skip the expensive backtracking branches entirely) the moment it
  // confirms the literal is absent — fast on a vulnerable regex and a fixed
  // one alike, indistinguishably. 215fe7f's own FIRST reproduction attempt
  // fell into exactly this trap: it measured 0.0ms on adversarial input that
  // happened to contain no "::entity" occurrence, and nearly went
  // unreported as a false negative. The previous version of this test had
  // the same blind spot (200 lines of pure marker-run repetition, no
  // "::entity" anywhere) — it would have stayed green through a regression
  // of EITHER fix above. Every case below plants one real
  // "::entity{ref=…}" so the pre-scan can never bypass the real match
  // attempts, and the assertion below fails loudly if that ever stops being
  // true.
  //
  // Shapes, interleaved through a body sized to what POST /api/articles
  // actually accepts per request (~64 KiB): (1) marker-run lines — the
  // 07129b5 shape; (2) long whitespace-only lines with no marker at all —
  // required by item 4's own review, since a purely-whitespace line is a
  // realistic "body full of indentation" document shape and was never
  // exercised on its own; (3) tab-indented marker lines — tabs satisfy the
  // same `[ \t]` classes as spaces throughout BLOCK, so a tab run is the
  // same hazard in a different whitespace character, and is what the
  // 215fe7f shape (a single marker followed by a long trailing run) looks
  // like when someone's editor indents with tabs instead of spaces.
  const markerRun = "-    ".repeat(40);
  const whitespaceOnly = " ".repeat(220);
  const tabIndentedMarker = "\t>" + "\t".repeat(150);
  const shapes = [markerRun, whitespaceOnly, tabIndentedMarker];
  const lines: string[] = [];
  let bytes = 0;
  let i = 0;
  while (bytes < 64 * 1024) {
    const line = shapes[i % shapes.length];
    lines.push(line);
    bytes += line.length + 1;
    i += 1;
  }
  lines.push("::entity{ref=bean:x}");
  const adversarial = lines.join("\n");
  assert.ok(
    adversarial.includes("::entity{ref="),
    "test is worthless without a real occurrence — see the literal-prefix trap above",
  );

  const start = performance.now();
  const result = extractRefs(adversarial);
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 250, `extractRefs took ${elapsed.toFixed(1)}ms on adversarial input`);
  assert.deepEqual(result, [{ kind: "embeds", ref: "bean:x" }]);

  // THE SHAPE THAT ACTUALLY REPRODUCED IT, and the one the interleaved body
  // above misses. The cost is quadratic in LINE LENGTH, so many short lines
  // are cheap however many you stack up: 220-character lines cost nothing,
  // and the vulnerable regex sails through the assertion above. It needs
  // TWO CONSECUTIVE very long whitespace-only lines — one alone measured
  // 0.5ms, two measured 900ms on the pre-215fe7f regex.
  //
  // Note the bound: 250ms, not 1000ms. The vulnerable form took ~900ms on a
  // 64 KiB body, which would have passed a 1-second assertion. A regression
  // test whose threshold sits above the bug it guards against is decoration.
  const twoLongBlankLines =
    "::entity{ref=bean:x}\n" + `${" ".repeat(32000)}\n`.repeat(2) + "::entity{ref=bean:y}\n";
  const worstStart = performance.now();
  const worstResult = extractRefs(twoLongBlankLines);
  const worstElapsed = performance.now() - worstStart;
  assert.ok(
    worstElapsed < 250,
    `extractRefs took ${worstElapsed.toFixed(1)}ms on two long whitespace-only lines ` +
      `(the pre-215fe7f regex took ~900ms on this exact input)`,
  );
  assert.deepEqual(worstResult, [
    { kind: "embeds", ref: "bean:x" },
    { kind: "embeds", ref: "bean:y" },
  ]);
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
