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
/* eslint-disable @typescript-eslint/no-require-imports */
const { test, after } = require("node:test") as typeof import("node:test");
// Explicit type annotation, not `as`: TypeScript's assertion-function
// narrowing (assert.ok's `asserts value` signature) only kicks in when the
// call target's declared type comes from an annotation, not an `as` cast.
const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const { Editor } = require("@tiptap/core") as typeof import("@tiptap/core");
const { buildEditorExtensions } = require("../components/editor/editor-extensions.js") as typeof import("../components/editor/editor-extensions.js");
const { createElement } = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");
const ReactMarkdown = require("react-markdown") as typeof import("react-markdown");
const { remarkPlugins, rehypePlugins } = require("./markdown.js") as typeof import("./markdown.js");
/* eslint-enable @typescript-eslint/no-require-imports */

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
