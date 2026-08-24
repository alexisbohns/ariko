import { JSDOM } from "jsdom";
import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * The sibling of lib/media-picker-mount.test.ts, on the other side of the
 * mount. That one pins what the picker renders with NO script; this one pins
 * what it renders once script has run — specifically `max`, the one-image cap
 * the plant Logo card depends on.
 *
 * jsdom globals go up FIRST, synchronously, before anything from `react-dom`
 * is imported: parts of that graph read `document`/`window` at
 * module-evaluation time, and static imports are hoisted above this file's own
 * statements. Everything DOM-touching is therefore reached through dynamic
 * `import()` below. Same reasoning, and the same shape, as
 * lib/editor-mount.test.ts.
 */
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});
const { window } = dom;
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
  MutationObserver: window.MutationObserver,
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
})) {
  Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
}
// React's own flag for act(); without it React 19 warns on every render here.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const logo = {
  kind: "image" as const,
  storageKey: "mark",
  url: "https://res.cloudinary.com/x/mark.png",
};

/** Mounts the picker for real, so `useEffect` runs and the island appears. */
async function mount(props: Record<string, unknown>): Promise<HTMLElement> {
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { MediaPicker } = await import("@/components/admin/media-picker");

  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  await React.act(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createRoot(container).render(React.createElement(MediaPicker as any, props));
  });
  return container as unknown as HTMLElement;
}

test("with no max, the picker always offers the file input", async () => {
  const container = await mount({ name: "media", initial: [logo] });
  assert.ok(container.querySelector('input[type="file"]'), "the file input must still be there");
});

test("max={1} withdraws the add controls once the one slot is filled", async () => {
  const container = await mount({ name: "logo", initial: [logo], max: 1, links: true });
  // `=== null` rather than assert.equal(el, null): a failed assert.equal would
  // try to render a jsdom element into the diff, which takes tens of seconds
  // and reports nothing useful.
  assert.ok(
    container.querySelector('input[type="file"]') === null,
    "a full list must not offer another upload",
  );
  assert.ok(
    container.querySelector('input[type="url"]') === null,
    "the link field is an add control too",
  );
  // The cap withdraws ADDING, never editing: the stored row stays removable,
  // or the logo could never be changed once set.
  assert.ok(
    [...container.querySelectorAll("button")].some((b) => b.textContent?.includes("Remove")),
    "the row must stay removable",
  );
});

test("max={1} on an empty picker still offers the file input", async () => {
  const container = await mount({ name: "logo", initial: [], max: 1 });
  assert.ok(container.querySelector('input[type="file"]'), "an empty slot must be fillable");
});

test("the ready marker is rendered whatever the cap says", async () => {
  // The marker's whole job is to be present whenever the island mounted,
  // independent of row count — buildPlantLogoPatch reads its ABSENCE as
  // "this form does not know what the plant holds".
  const container = await mount({ name: "logo", initial: [logo], max: 1 });
  assert.ok(container.querySelector('input[name="logo__ready"]'));
});
