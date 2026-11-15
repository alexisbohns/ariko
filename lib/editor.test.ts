import { JSDOM } from "jsdom";

/**
 * `node --test` has no DOM, and Tiptap's `Editor` needs one to construct at
 * all — that is the exact gap this file exists to close (see the module
 * doc-comment below). Set up jsdom's globals BEFORE anything from `@tiptap/*`
 * or `react-dom` is imported: a handful of files in that dependency graph
 * read `document`/`window`/`navigator` at module-evaluation time (browser
 * detection in prosemirror-view, for one), not just inside function bodies
 * that run later. Static `import` declarations are hoisted and all evaluate
 * before any of THIS file's own top-level statements — including statements
 * textually placed between two import lines — so the only way to guarantee
 * ordering is to install the globals first, synchronously, and reach every
 * DOM-touching module via a dynamic `import()` afterward. Contained to this
 * one file; nothing else in the suite needs a DOM.
 */
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  // Gives us a real requestAnimationFrame/cancelAnimationFrame from jsdom
  // itself instead of a setTimeout shim.
  pretendToBeVisual: true,
});
const { window } = dom;
// Object.assign, not a plain assignment loop: newer Node versions ship their
// own read-only `navigator` global (getter-only, no setter), which a bare
// `globalThis.navigator = ...` throws on. `defineProperty` overwrites it
// unconditionally regardless of how the existing property was declared.
for (const [key, value] of Object.entries({
  window,
  document: window.document,
  navigator: window.navigator,
  Element: window.Element,
  HTMLElement: window.HTMLElement,
  Node: window.Node,
  Text: window.Text,
  DocumentFragment: window.DocumentFragment,
  DOMParser: window.DOMParser,
  getComputedStyle: window.getComputedStyle.bind(window),
  getSelection: window.getSelection.bind(window),
  MutationObserver: window.MutationObserver,
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
})) {
  Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
}

import type { EntityOption } from "./entity-options.js";

// require(), not import: a static `import` declaration is hoisted and
// evaluates before ANY of this file's own top-level statements — including
// statements textually placed above it — so it would reach `@tiptap/core`
// before the jsdom globals above are installed. A plain `require()` call
// runs exactly where it's written, in file order, which is the whole point.
const { test, after } = require("node:test") as typeof import("node:test");
// Explicit type annotation, not `as`: TypeScript's assertion-function
// narrowing (assert.ok's `asserts value` signature) only kicks in when the
// call target's declared type comes from an annotation, not an `as` cast.
const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const { Editor } = require("@tiptap/core") as typeof import("@tiptap/core");
const { buildEditorExtensions, buildBlocks, stagingAllowedAt } = require("../components/editor/editor-extensions.js") as typeof import("../components/editor/editor-extensions.js");
const { createElement } = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");
const ReactMarkdown = require("react-markdown") as typeof import("react-markdown");
const { remarkPlugins, rehypePlugins } = require("./markdown.js") as typeof import("./markdown.js");

// The EXACT chain the public site renders — same helper as
// lib/markdown-conformance.test.ts and lib/entity-refs.test.ts. Whole-document
// "round trips" in this codebase mean RENDER equality, not byte equality:
// marked's own serializer re-pads table columns and re-spaces blank lines
// (see lib/markdown-conformance.test.ts's `table`/`mixed` fixtures, asserted
// there the same way) — that's benign reformatting, not data loss, and byte
// equality is reserved for the entity grammar's own narrow serialization
// rules (lib/entity-markdown.test.ts).
const render = (source: string): string =>
  renderToStaticMarkup(createElement(ReactMarkdown.default, { remarkPlugins, rehypePlugins }, source));

/**
 * A headless mount smoke test: it constructs the REAL `Editor` Tiptap builds
 * in production, from the REAL extension list
 * (components/editor/editor-extensions.ts, extracted from
 * components/editor/prose-editor.tsx for exactly this reason), against a
 * jsdom DOM. `npm run build` typechecks and bundles the editor but never
 * mounts one; the other 530-odd tests never construct an `Editor` either —
 * they exercise `MarkdownManager` and `getSchema()` directly (see
 * lib/entity-markdown.test.ts, lib/markdown-conformance.test.ts). That gap is
 * how two suggestion plugins sharing ProseMirror's default `pluginKey`
 * (`@tiptap/suggestion`'s module-level `SuggestionPluginKey` singleton) broke
 * the editor on all three pages that host it, with every gate green — see
 * commit 65bb5ff. A test that rebuilt a SIMILAR extension array by hand would
 * not have caught that, and would not catch the next defect shaped like it;
 * this one imports `buildEditorExtensions` itself, so it always drives
 * whatever the app actually mounts.
 */

const ENTITIES: EntityOption[] = [
  { ref: "bean:x", kind: "bean", name: "X Bean", description: "a test bean" },
  { ref: "bean:y", kind: "bean", name: "Y Bean" },
  { ref: "pod:garden", kind: "pod", name: "Garden Pod" },
];

function makeEditor(opts: { content?: string; contentType?: "markdown"; entities?: EntityOption[] } = {}) {
  const extensions = buildEditorExtensions({
    entities: opts.entities ?? ENTITIES,
    // No-op menu wiring: this file never opens the `@`/`/` picker, it only
    // needs the plugins registered — see BuildEditorExtensionsOptions'
    // doc-comment in components/editor/editor-extensions.ts.
    onMenu: () => {},
    getMenu: () => null,
    onInsertImage: () => {},
    upload: async () => ({ ok: false, error: "no uploads in a headless editor" }),
    onUploadBusy: () => {},
    lang: "en",
  });
  return new Editor({
    extensions,
    content: opts.content ?? "",
    ...(opts.contentType ? { contentType: opts.contentType } : {}),
  });
}

after(() => {
  // Lets the process exit instead of hanging on jsdom's window.
  dom.window.close();
});

test("1. the editor mounts with the real extension list (both suggestion plugins)", () => {
  let editor: InstanceType<typeof Editor> | undefined;
  assert.doesNotThrow(() => {
    editor = makeEditor();
  });
  assert.ok(editor);
  // `isInitialized` flips true inside a `window.setTimeout(..., 0)` in
  // @tiptap/core (the deferred `onCreate`/autofocus dance), so it is not a
  // useful synchronous mount signal here — `state.config.pluginsByKey` below
  // is: a plugin only lands there once `EditorState.create` has succeeded,
  // which is exactly the step 65bb5ff's bug threw out of.
  //
  // Not just "construction didn't throw" — confirm BOTH suggestion plugins
  // actually registered under their own key, which is the specific thing
  // 65bb5ff fixed: ProseMirror's `Configuration` constructor (prosemirror-state)
  // throws exactly this RangeError when a second plugin's `.key` STRING
  // collides with one already in `pluginsByKey` — which is what happened when
  // both suggestion plugins shared @tiptap/suggestion's default singleton
  // key. `pluginsByKey` has no typed public accessor (PluginKey.get() reaches
  // the same field internally), hence the cast. `new PluginKey(name)` mints
  // "name$" (or "name$N" if this process already minted that name once);
  // checked with `startsWith` so the assertion doesn't depend on test order.
  const { config } = editor!.state as unknown as { config: { pluginsByKey: Record<string, unknown> } };
  const keys = Object.keys(config.pluginsByKey);
  assert.ok(keys.some((k) => k.startsWith("suggestion-entity$")), keys.join(", "));
  assert.ok(keys.some((k) => k.startsWith("suggestion-block$")), keys.join(", "));
  editor!.destroy();
});

test("2. content loads from markdown (heading, table, task list, image, card, mention) and getMarkdown() round-trips it", () => {
  const source = [
    "## Heading",
    "| a | b |\n| --- | --- |\n| 1 | 2 |",
    "- [ ] todo item\n- [x] done item",
    "![alt text](/img.png)",
    "::entity{ref=bean:x}",
    "see :entity[X Bean]{ref=bean:x} inline",
  ].join("\n\n");
  const editor = makeEditor({ content: source, contentType: "markdown" });
  const json = editor.getJSON();
  const asString = JSON.stringify(json);
  // Structural check first: a node type missing here is a node the editor
  // silently dropped on load — the exact failure mode baseExtensions'
  // doc-comment (lib/entity-markdown.ts) warns about for Image/TaskList.
  for (const type of ["heading", "table", "taskList", "taskItem", "image", "entityCard", "entityMention"]) {
    assert.ok(asString.includes(`"${type}"`), `missing "${type}" in ${asString}`);
  }
  // Then meaning: getMarkdown() renders the same as the source (see `render`
  // above for why this is render-equality, not byte-equality).
  assert.equal(render(editor.getMarkdown()), render(source));
  editor.destroy();
});

test("3. a transaction succeeds after loading a card as a list item's only child (C1)", () => {
  // Before lib/entity-markdown.ts's CardLeadingListItem fix (ListItem.extend({
  // content: "block+" })), StarterKit's default listItem content expression
  // ("paragraph block*") does not admit a list item whose ONLY child is a
  // block atom (the entity card) — but ProseMirror's own `createDoc` never
  // validates content on load, so building the editor with this content does
  // NOT throw. The RangeError ("Called contentMatchAt on a node with invalid
  // content") only surfaces on the FIRST transaction dispatched afterward, a
  // DOM event listener no React error boundary catches — silently freezing
  // the editor. So this test's load line is expected to succeed either way;
  // what it actually exercises is the insertContentAt below — targeted at
  // the position immediately after the card, INSIDE the list item (not the
  // end of the document, which sits outside the malformed node entirely and
  // resolves without walking through it). Found empirically: `doc.resolve`
  // only throws for positions that require matching content INSIDE the
  // broken listItem.
  const editor = makeEditor({ content: "- ::entity{ref=bean:x}", contentType: "markdown" });
  let posAfterCard = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "entityCard") {
      posAfterCard = pos + node.nodeSize;
      return false;
    }
    return true;
  });
  assert.notEqual(posAfterCard, -1, "fixture doesn't contain an entityCard");
  assert.doesNotThrow(() => {
    editor.commands.insertContentAt(posAfterCard, {
      type: "paragraph",
      content: [{ type: "text", text: "appended after the card" }],
    });
  });
  editor.destroy();
});

test("4. both entity insert paths (mention, card) produce schema-valid documents", () => {
  const editor = makeEditor();
  // Mirrors the `/` picker's real call site (components/editor/editor-extensions.ts).
  editor.chain().focus().insertContent({ type: "entityCard", attrs: { ref: "bean:x" } }).run();
  assert.doesNotThrow(() => editor.state.doc.check());
  // Mirrors the `@` picker's real call site.
  editor.chain().focus().insertContent({ type: "entityMention", attrs: { ref: "bean:y", label: "Y Bean" } }).run();
  assert.doesNotThrow(() => editor.state.doc.check());
  editor.destroy();
});

test("5. a transaction succeeds after loading an inline image mid-paragraph (item 1)", () => {
  // Same failure class and same proof shape as test 3 above, one node over:
  // before lib/entity-markdown.ts's `Image.configure({ inline: true })` fix,
  // @tiptap/markdown tokenizes "text ![a](/i.png) more" as a paragraph whose
  // inline content includes a BLOCK-group image node (Image's stock
  // `inline: false`) — schema-invalid content ProseMirror's own `createDoc`
  // never validates on load, so building the editor does NOT throw. The
  // RangeError only surfaces on the first transaction that walks INTO the
  // malformed paragraph, same as C1's card-in-list-item bug — this is the
  // real-`Editor` test that would have caught it, mirroring how test 3
  // covers C1 for the card case.
  const editor = makeEditor({ content: "text ![a](/i.png) more", contentType: "markdown" });
  let posAfterImage = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "image") {
      posAfterImage = pos + node.nodeSize;
      return false;
    }
    return true;
  });
  assert.notEqual(posAfterImage, -1, "fixture doesn't contain an image");
  assert.doesNotThrow(() => {
    editor.commands.insertContentAt(posAfterImage, { type: "text", text: " even more" });
  });
  editor.destroy();
});

test("6. the / menu offers Image, and running it clears the typed command and asks the host to pick a file", () => {
  // Captured INSIDE the callback, not after run() returns: both orderings
  // leave the same final document, so an implementation that handed off
  // first and deleted second would pass an after-the-fact assertion
  // identically — and the ordering is the load-bearing part (the file dialog
  // takes focus, so the deletion has to be already committed).
  let asked = 0;
  let textWhenAsked = "";
  const editor = makeEditor({ content: "/image", contentType: "markdown" });
  const blocks = buildBlocks(() => {
    asked++;
    textWhenAsked = editor.getText();
  });
  const image = blocks.find((b) => b.id === "image");
  assert.ok(image, `no image block in: ${blocks.map((b) => b.id).join(", ")}`);

  // The suggestion range for "/image" typed at the start of the only paragraph:
  // position 1 is inside that paragraph, before the "/".
  image!.run(editor, { from: 1, to: 1 + "/image".length });

  assert.equal(asked, 1, "running the block must ask the host to open a file picker");
  assert.ok(
    !textWhenAsked.includes("/image"),
    `the text must be deleted BEFORE the handoff, got: ${JSON.stringify(textWhenAsked)}`,
  );
  editor.destroy();
});

test("7. setImage inserts a node that serializes back to markdown (the /image insert path)", () => {
  const editor = makeEditor({ content: "before", contentType: "markdown" });
  editor.chain().focus().setImage({ src: "https://cdn/x.jpg", alt: "a cat" }).run();
  const markdown = editor.getMarkdown();
  assert.match(markdown, /!\[a cat\]\(https:\/\/cdn\/x\.jpg\)/);
  // And it survives a reload — the failure mode baseExtensions' doc-comment
  // warns about is a node that vanishes on the NEXT save, not the first.
  const reloaded = makeEditor({ content: markdown, contentType: "markdown" });
  assert.ok(JSON.stringify(reloaded.getJSON()).includes('"image"'));
  assert.equal(render(reloaded.getMarkdown()), render(markdown));
  reloaded.destroy();
  editor.destroy();
});

test("8. the / menu offers the five staging blocks, each under an id no other row has", () => {
  // `quote` is already the plain blockquote's row, and the `/` handler picks a
  // row with `blocks.find` — a second `quote` would never run. So the
  // attributed quote is `attributed-quote`, and uniqueness is asserted rather
  // than assumed.
  const ids = buildBlocks(() => {}).map((b) => b.id);
  for (const id of ["figure", "gallery", "compare", "callout", "attributed-quote"]) assert.ok(ids.includes(id), id);
  assert.equal(new Set(ids).size, ids.length, `duplicate / row ids: ${ids.join(", ")}`);
});

test("9. /callout inserts an empty callout with a paragraph inside; /figure inserts an empty figure that saves to nothing", () => {
  const editor = makeEditor();
  const run = (id: string) => buildBlocks(() => {}).find((b) => b.id === id)!.run(editor, { from: 1, to: 1 });
  run("callout");
  assert.equal(editor.getJSON().content?.[0]?.type, "stagedCallout");
  assert.equal(editor.getJSON().content?.[0]?.content?.[0]?.type, "paragraph");
  run("figure");
  assert.ok(JSON.stringify(editor.getJSON()).includes('"stagedFigure"'), "the figure node exists before its form saves");
  assert.doesNotMatch(editor.getMarkdown(), /:::figure/);
  editor.destroy();
});

test("10. /quote inserts a quote whose body is editable and whose `by` is empty until its form sets it", () => {
  const editor = makeEditor();
  buildBlocks(() => {}).find((b) => b.id === "attributed-quote")!.run(editor, { from: 1, to: 1 });
  const node = editor.getJSON().content?.[0];
  assert.equal(node?.type, "stagedQuote");
  assert.equal(node?.attrs?.by, "");
  assert.equal(node?.content?.[0]?.type, "paragraph");
  editor.destroy();
});

test("11. the staging rows are withheld inside a list item, and offered in plain prose", () => {
  const editor = makeEditor({ content: "- item\n\nprose", contentType: "markdown" });
  // Position 3: inside the list item's paragraph (doc > bulletList > listItem > paragraph).
  editor.commands.setTextSelection(3);
  assert.equal(stagingAllowedAt(editor), false);
  editor.commands.setTextSelection(editor.state.doc.content.size - 1);
  assert.equal(stagingAllowedAt(editor), true);
  editor.destroy();
});

test("11b. the staging rows are withheld in a table's header and body cells", () => {
  const editor = makeEditor({ content: "| h |\n| --- |\n| c |", contentType: "markdown" });
  const cells: Record<string, number> = {};
  editor.state.doc.descendants((node, pos) => {
    if ((node.type.name === "tableHeader" || node.type.name === "tableCell") && !(node.type.name in cells)) {
      cells[node.type.name] = pos + 2; // inside the cell's paragraph
    }
  });
  assert.deepEqual(Object.keys(cells).sort(), ["tableCell", "tableHeader"]);
  for (const [name, pos] of Object.entries(cells)) {
    editor.commands.setTextSelection(pos);
    assert.equal(stagingAllowedAt(editor), false, name);
  }
  editor.destroy();
});

test("13. a pasted image URL must be absolute http(s) with no whitespace or control characters", () => {
  const { srcProblem } = require("../components/editor/staging-views.js") as typeof import("../components/editor/staging-views.js");
  for (const ok of ["", "  ", "https://res.cloudinary.com/x/image/upload/a.png", "http://example.com/a.png"]) {
    assert.equal(srcProblem(ok), null, ok);
  }
  for (const bad of ["javascript:alert(1)", "/relative.png", "a.png", "https://a b.png", "https://a\u0007.png", "data:image/png;base64,xx"]) {
    assert.equal(srcProblem(bad), "Use an https:// image URL", bad);
  }
});

test("14. no staging view deletes its node: closing its panel discards the draft, never the block", () => {
  // Source text, on lib/prose-commit-source.test.ts's reasoning: a property
  // of the file as written, which no headless render can observe. The first
  // version deleted an empty block on close, and every close reason — a
  // focus-out, the click that picked the `/` row, a file dialog's blur —
  // became a way to lose one.
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  const source = readFileSync(join(process.cwd(), "components/editor/staging-views.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(source, /deleteNode|deleteSelection|deleteRange/);
});

test("14b. a staged block's panel closes the open `@` / `/` menu first, by the suggestion plugins' own keys", () => {
  // exitMenus (staging-views.tsx) finds the two menus by the `suggestion-`
  // prefix of their extension names in editor-extensions.ts. Rename either
  // and a panel opens over a menu left floating on the prose — so the
  // coupling is driven here against the real plugins, not described.
  const { exitMenus } = require("../components/editor/staging-views.js") as typeof import("../components/editor/staging-views.js");
  const seen: unknown[] = [];
  const extensions = buildEditorExtensions({
    entities: ENTITIES,
    onMenu: (m) => seen.push(m),
    getMenu: () => null,
    onInsertImage: () => {},
    upload: async () => ({ ok: false, error: "none" }),
    onUploadBusy: () => {},
    lang: "en",
  });
  const editor = new Editor({ extensions, content: "" });
  const active = () =>
    editor.state.plugins
      .filter((p) => (p as unknown as { key: string }).key.startsWith("suggestion-"))
      .map((p) => Boolean((p.getState(editor.state) as { active?: boolean }).active));
  assert.equal(active().length, 2, "both suggestion plugins carry the prefix exitMenus looks for");
  editor.commands.insertContent("/");
  assert.deepEqual(active().sort(), [false, true], "typing / opens the block menu");
  exitMenus(editor);
  assert.deepEqual(active(), [false, false]);
  assert.equal(seen.at(-1), null, "the host was told the menu closed");
  editor.destroy();
});

test("12. a callout label typed with brackets is escaped into a label that stays one directive, and escaping is idempotent", () => {
  const { escapeLabel } = require("../components/editor/staging-views.js") as typeof import("../components/editor/staging-views.js");
  const { calloutOpener } = require("./staging-markdown.js") as typeof import("./staging-markdown.js");
  for (const typed of ["a ] b", "[x]", "ends in \\", "already \\] escaped", "\\*not emphasis\\*"]) {
    const label = escapeLabel(typed);
    assert.equal(escapeLabel(label), label, `idempotent for ${JSON.stringify(typed)}`);
    const editor = makeEditor({ content: `${calloutOpener(label)}\nbody\n:::`, contentType: "markdown" });
    const node = editor.getJSON().content?.[0];
    assert.equal(node?.type, "stagedCallout", `${JSON.stringify(typed)} -> ${calloutOpener(label)}`);
    assert.equal(node?.attrs?.label, label);
    editor.destroy();
  }
  assert.equal(escapeLabel("a ] b"), "a \\] b");
  assert.equal(escapeLabel("already \\] escaped"), "already \\] escaped");
});

test("15. Make it a figure: one transaction to a canonical `:::figure`, and one undo gives back the plain image byte for byte", () => {
  const { makeFigure } = require("../components/editor/staging-views.js") as typeof import("../components/editor/staging-views.js");
  const { NodeSelection } = require("@tiptap/pm/state") as typeof import("@tiptap/pm/state");
  const src = "https://res.cloudinary.com/demo/image/upload/moon.png";
  const editor = makeEditor({ content: "Before.\n\nAfter.", contentType: "markdown" });
  try {
    // The image arrives as its own line just now — the /image path, inside
    // the history's grouping delay and touching the range the conversion
    // replaces. Without `closeHistory` the two steps would merge, and the
    // undo would take the image away with the figure.
    editor.commands.insertContentAt(9, {
      type: "paragraph",
      content: [{ type: "image", attrs: { src, alt: "The moon", title: "Close-up" } }],
    });
    const original = editor.getMarkdown();
    let at = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "image") at = pos;
    });
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, at)));

    assert.equal(makeFigure(editor), true);
    const figure = `:::figure\n![The moon](${src})\nClose-up\n:::`;
    assert.equal(editor.getMarkdown(), `Before.\n\n${figure}\n\nAfter.`);
    assert.equal(render(editor.getMarkdown()), render(`Before.\n\n${figure}\n\nAfter.`));
    assert.match(render(figure), /<staged-figure /, "the site draws it as a figure");
    assert.equal(editor.state.selection instanceof NodeSelection && editor.state.selection.node.type.name, "stagedFigure");

    editor.commands.undo();
    assert.equal(editor.getMarkdown(), original, "one undo, and the plain image is back exactly");

    // A text selection converts nothing.
    editor.commands.setTextSelection({ from: 1, to: 5 });
    assert.equal(makeFigure(editor), false);
    assert.equal(editor.getMarkdown(), original);
  } finally {
    editor.destroy();
  }

  // And from a stored article: the undo gives back the SOURCE, not merely an
  // equivalent render.
  const stored = `Before.\n\n![](${src})\n\nAfter.`;
  const loaded = makeEditor({ content: stored, contentType: "markdown" });
  try {
    loaded.view.dispatch(loaded.state.tr.setSelection(NodeSelection.create(loaded.state.doc, 10)));
    assert.equal(makeFigure(loaded), true);
    assert.equal(loaded.getMarkdown(), `Before.\n\n:::figure\n![](${src})\n:::\n\nAfter.`);
    loaded.commands.undo();
    assert.equal(loaded.getMarkdown(), stored);
  } finally {
    loaded.destroy();
  }
});

test("16. a title that reads as an image converts to a caption that stays one across save and reload", () => {
  const { makeFigure } = require("../components/editor/staging-views.js") as typeof import("../components/editor/staging-views.js");
  const { NodeSelection } = require("@tiptap/pm/state") as typeof import("@tiptap/pm/state");
  const src = "https://res.cloudinary.com/demo/image/upload/moon.png";
  const editor = makeEditor({ content: `![a](${src} "![b](https://e.com/b.png)")`, contentType: "markdown" });
  try {
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 1)));
    assert.equal(makeFigure(editor), true);
    // Trimmed: a figure that ends the document gets the trailing paragraph.
    const saved = editor.getMarkdown().trim();
    assert.equal(saved, `:::figure\n![a](${src})\n\\![b](https://e.com/b.png)\n:::`);
    const reloaded = makeEditor({ content: saved, contentType: "markdown" });
    try {
      const nodes = reloaded.getJSON().content ?? [];
      assert.deepEqual(nodes.map((n) => n.type), ["stagedFigure"], "still one figure, not literal fences around two images");
      assert.equal(nodes[0].attrs?.src, src);
      assert.equal(nodes[0].attrs?.caption, "\\![b](https://e.com/b.png)");
      assert.equal(reloaded.getMarkdown().trim(), saved, "and stable");
    } finally {
      reloaded.destroy();
    }
  } finally {
    editor.destroy();
  }
});
