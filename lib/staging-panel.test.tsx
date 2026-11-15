import { JSDOM } from "jsdom";

/**
 * The staging blocks' forms, opened in the rail's panel (spec 2026-11-15 §11),
 * driven end to end in jsdom: a REAL editor built from the real extension list,
 * mounted inside a REAL `EntityRail`, with React rendering both.
 *
 * Two things here are not visible to any source test. That the rail's context
 * reaches a Tiptap node view at all — node views render through portals that
 * `EditorContent` owns, so it should, and a version of @tiptap/react that
 * rendered them into a separate root would leave every block uneditable with
 * everything green. And that the form, rendered by the rail OUTSIDE the node
 * view, writes to the node as it stands now and closes when the node goes.
 *
 * jsdom's globals go in before anything that touches the DOM is loaded, for
 * the reason lib/editor.test.ts gives at length — hence `require` below.
 */
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/admin/pod/x",
  pretendToBeVisual: true,
});
const { window } = dom;
for (const key of Object.getOwnPropertyNames(window)) {
  if (key in globalThis) continue;
  Object.defineProperty(globalThis, key, {
    value: (window as unknown as Record<string, unknown>)[key],
    writable: true,
    configurable: true,
  });
}
for (const [key, value] of Object.entries({
  window,
  document: window.document,
  navigator: window.navigator,
  getComputedStyle: window.getComputedStyle.bind(window),
  getSelection: window.getSelection.bind(window),
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  IS_REACT_ACT_ENVIRONMENT: true,
})) {
  Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
}

const { test, after } = require("node:test") as typeof import("node:test");
const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const React = require("react") as typeof import("react");
const { act } = React;
const { createRoot } = require("react-dom/client") as typeof import("react-dom/client");
const { EditorContent, useEditor } = require("@tiptap/react") as typeof import("@tiptap/react");
type Editor = import("@tiptap/core").Editor;
const { buildEditorExtensions, buildBlocks } =
  require("../components/editor/editor-extensions") as typeof import("../components/editor/editor-extensions");
const { EntityRail } = require("../app/admin/_components/entity-rail") as typeof import("../app/admin/_components/entity-rail");

after(() => dom.window.close());

function Host({ onEditor }: { onEditor: (e: Editor) => void }) {
  const extensions = React.useMemo(
    () =>
      buildEditorExtensions({
        entities: [],
        onMenu: () => {},
        getMenu: () => null,
        onInsertImage: () => {},
        upload: async () => ({ ok: false, error: "no uploads here" }),
        onUploadBusy: () => {},
        lang: "en",
      }),
    [],
  );
  const editor = useEditor({ extensions, content: "", immediatelyRender: true });
  React.useEffect(() => {
    if (editor) onEditor(editor);
  }, [editor, onEditor]);
  return <EditorContent editor={editor} />;
}

async function mount(withRail: boolean) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let editor: Editor | null = null;
  const host = <Host onEditor={(e) => (editor = e)} />;
  await act(async () => {
    root.render(withRail ? <EntityRail label="Test panels" items={[]}>{host}</EntityRail> : host);
  });
  assert.ok(editor, "the editor mounted");
  return {
    editor: editor as Editor,
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

const panel = () => document.querySelector<HTMLElement>("aside[aria-labelledby]");
const heading = () => panel()?.querySelector("h2")?.textContent ?? null;

function typeInto(input: HTMLInputElement, value: string) {
  // React tracks an input's value through the prototype setter; assigning
  // `.value` directly would be swallowed as "no change".
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
  set.call(input, value);
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
}

function fieldByLabel(root: HTMLElement, text: string): HTMLInputElement {
  const label = [...root.querySelectorAll("label")].find((l) => l.textContent === text);
  assert.ok(label, `a "${text}" field`);
  return root.querySelector<HTMLInputElement>(`#${CSS.escape(label.htmlFor)}`)!;
}

const figureAttrs = (editor: Editor) =>
  editor.getJSON().content?.find((n) => n.type === "stagedFigure")?.attrs as Record<string, unknown> | undefined;

test("a freshly inserted figure opens its form in the rail's panel, and Save writes the node and closes it", async () => {
  const { editor, container, unmount } = await mount(true);
  try {
    await act(async () => {
      buildBlocks(() => {}).find((b) => b.id === "figure")!.run(editor, { from: 1, to: 1 });
    });
    assert.equal(heading(), "Figure", "the panel opened on insert, titled by the block");
    const save = [...panel()!.querySelectorAll("button")].find((b) => b.textContent === "Save")!;
    assert.equal(save.disabled, true, "nothing to save yet");

    await act(async () => typeInto(fieldByLabel(panel()!, "…or image URL"), "https://res.cloudinary.com/demo/image/upload/a.png"));
    assert.equal(figureAttrs(editor)?.src, "", "typing writes nothing: the form edits a draft");
    assert.equal(save.disabled, false);

    await act(async () => save.click());
    assert.equal(figureAttrs(editor)?.src, "https://res.cloudinary.com/demo/image/upload/a.png");
    assert.equal(panel(), null, "Save closes the panel, and a page panel unmounts");

    // The trigger reopens it, on a fresh draft of the node as stored.
    const trigger = container.querySelector<HTMLElement>('[role="button"][aria-label^="Edit figure"]');
    assert.ok(trigger, "the preview is a control while a rail hosts it");
    await act(async () => trigger.click());
    assert.equal(heading(), "Figure");
    assert.equal(fieldByLabel(panel()!, "…or image URL").value, "https://res.cloudinary.com/demo/image/upload/a.png");
    assert.equal(trigger.getAttribute("aria-expanded"), "true");

    // Escape discards the draft and returns focus to the trigger.
    await act(async () => typeInto(fieldByLabel(panel()!, "Caption"), "abandoned"));
    await act(async () => {
      document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    assert.equal(panel(), null);
    assert.equal(document.activeElement, trigger, "focus goes back to the block that opened the panel");
    assert.equal(figureAttrs(editor)?.caption, "", "an abandoned draft is not written");
  } finally {
    // Unmounted even on a failed assertion: a live editor and root keep
    // the process alive, and the file then fails on a timeout instead.
    await unmount();
  }
});

test("a block deleted while its panel is open closes the panel, and the form never saves over newer attrs", async () => {
  const { editor, container, unmount } = await mount(true);
  try {
    await act(async () => {
      editor.commands.setContent(":::figure{frame=none}\n![a](https://res.cloudinary.com/demo/image/upload/a.png)\n:::", { contentType: "markdown" });
    });
    assert.ok(figureAttrs(editor), "the figure loaded from markdown");
    const trigger = container.querySelector<HTMLElement>('[role="button"][aria-label^="Edit figure"]')!;
    await act(async () => trigger.click());
    assert.equal(heading(), "Figure");

    // The node changes underneath the open form (an undo, a second door): the
    // form follows it rather than keeping a draft of what it was.
    await act(async () => {
      editor.commands.command(({ tr, state }) => {
        state.doc.descendants((node, pos) => {
          if (node.type.name === "stagedFigure") tr.setNodeAttribute(pos, "caption", "newer");
        });
        return true;
      });
    });
    assert.equal(fieldByLabel(panel()!, "Caption").value, "newer");

    await act(async () => {
      editor.commands.setContent("");
    });
    assert.equal(panel(), null, "the panel of a deleted block closes");
  } finally {
    // Unmounted even on a failed assertion: a live editor and root keep
    // the process alive, and the file then fails on a timeout instead.
    await unmount();
  }
});

test("without a rail, a staged block draws its preview and offers no control", async () => {
  const { editor, container, unmount } = await mount(false);
  try {
    await act(async () => {
      buildBlocks(() => {}).find((b) => b.id === "figure")!.run(editor, { from: 1, to: 1 });
    });
    assert.ok(container.textContent?.includes("Empty figure"), "the placeholder draws");
    assert.equal(container.querySelector('[role="button"]'), null);
    assert.equal(container.querySelector("[data-node-view-wrapper] [tabindex]"), null, "and is not a tab stop");
    assert.equal(panel(), null);
  } finally {
    // Unmounted even on a failed assertion: a live editor and root keep
    // the process alive, and the file then fails on a timeout instead.
    await unmount();
  }
});
