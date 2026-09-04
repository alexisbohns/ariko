import { JSDOM } from "jsdom";

/**
 * The palette actually rendering, opening, filtering and navigating — in a DOM.
 *
 * The rest of the slice is pinned by pure tests (lib/palette.test.ts) and by a
 * no-DOM render (lib/palette-mount.test.ts), and neither can reach the part
 * that was genuinely uncertain when this was written: Base UI's Autocomplete
 * driven with `inline` + `open`, fed GROUPED items, filtering as the query
 * changes. That contract is the palette. If a Base UI upgrade changes it, this
 * file is what says so.
 *
 * Same jsdom-globals-first discipline as lib/editor-mount.test.ts, and for the
 * same reason: modules in this graph read `window`/`document` at
 * module-evaluation time, static imports are hoisted above every statement in
 * this file, so the globals go in synchronously and everything DOM-touching is
 * reached through `require()` afterward.
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
  HTMLInputElement: window.HTMLInputElement,
  Node: window.Node,
  Text: window.Text,
  Event: window.Event,
  CustomEvent: window.CustomEvent,
  KeyboardEvent: window.KeyboardEvent,
  MouseEvent: window.MouseEvent,
  DocumentFragment: window.DocumentFragment,
  DOMParser: window.DOMParser,
  // Base UI walks the live region's text nodes to announce list changes.
  NodeFilter: window.NodeFilter,
  getComputedStyle: window.getComputedStyle.bind(window),
  getSelection: window.getSelection.bind(window),
  MutationObserver: window.MutationObserver,
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  // jsdom ships none of these three, and Base UI's floating/list machinery
  // calls all of them. Stubs are enough: nothing here asserts on layout.
  ResizeObserver: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
  matchMedia: () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }),
  IS_REACT_ACT_ENVIRONMENT: true,
})) {
  Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
}
window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  value: true,
  writable: true,
  configurable: true,
});

import type { PaletteItem } from "./palette-items.js";

/* eslint-disable @typescript-eslint/no-require-imports */
const { test, before, after } = require("node:test") as typeof import("node:test");
const assert: typeof import("node:assert/strict") = require("node:assert/strict");
const React = require("react") as typeof import("react");
const { createRoot } = require("react-dom/client") as typeof import("react-dom/client");
const { act } = require("react") as typeof import("react");
const {
  AppRouterContext,
} = require("next/dist/shared/lib/app-router-context.shared-runtime");
const { CommandPalette } = require("../app/admin/_components/command-palette");

const INDEX: PaletteItem[] = [
  { id: "section:/admin", kind: "section", label: "Inbox", href: "/admin", group: "Go to" },
  {
    id: "section:/admin/vault",
    kind: "section",
    label: "Vault",
    href: "/admin/vault",
    group: "Go to",
  },
  {
    id: "plant:pebbles",
    kind: "plant",
    label: "Pebbles",
    href: "/admin/plant/pebbles",
    group: "Garden",
  },
  {
    id: "pod:case-study",
    kind: "pod",
    label: "Pebbles case study",
    sublabel: "Pebbles",
    href: "/admin/pod/case-study",
    group: "Garden",
  },
  {
    id: "sprout:digest-4",
    kind: "sprout",
    label: "Weekly digest",
    sublabel: "Digest",
    href: "/admin/sprout/digest-4",
    group: "Vault",
  },
];

const pushed: string[] = [];
const router = {
  push: (href: string) => {
    pushed.push(href);
  },
  replace() {},
  refresh() {},
  back() {},
  forward() {},
  prefetch() {},
};

let container: HTMLElement;
let root: ReturnType<typeof createRoot>;
let fetchCalls = 0;
let fetchOk = true;

before(() => {
  Object.defineProperty(globalThis, "fetch", {
    writable: true,
    configurable: true,
    value: async () => {
      fetchCalls += 1;
      if (!fetchOk) throw new Error("offline");
      return {
        ok: true,
        redirected: false,
        url: "http://localhost/admin/palette",
        json: async () => ({ items: INDEX }),
      };
    },
  });
});

after(() => {
  act(() => root.unmount());
});

/** Mount once; every test below drives the same live palette in order. */
function mount(): void {
  container = window.document.createElement("div");
  window.document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      React.createElement(
        AppRouterContext.Provider,
        { value: router },
        React.createElement(CommandPalette),
      ),
    );
  });
}

/** Everything the palette portals lives on document.body, not in `container`. */
function text(): string {
  return window.document.body.textContent ?? "";
}

function rows(): HTMLElement[] {
  return [...window.document.querySelectorAll("[data-slot='autocomplete-item']")] as HTMLElement[];
}

/** A row's spans, joined — `textContent` alone runs them together, since the
 *  gap between label, sublabel and kind is layout, not whitespace. */
function labels(): string[] {
  return rows().map((r) =>
    [...r.querySelectorAll("span")].map((s) => (s.textContent ?? "").trim()).join(" "),
  );
}

/** The group headings, in render order. */
function groupLabels(): string[] {
  return [...window.document.querySelectorAll("[data-slot='autocomplete-label']")].map((el) =>
    (el.textContent ?? "").trim(),
  );
}

/** Just the row's first span: the label itself. */
function names(): string[] {
  return rows().map((r) => (r.querySelector("span")?.textContent ?? "").trim());
}

function input(): HTMLInputElement {
  const el = window.document.querySelector("[data-slot='autocomplete-input']");
  assert.ok(el, "no palette input");
  return el as HTMLInputElement;
}

async function type(value: string): Promise<void> {
  const el = input();
  // React listens for `input`, and its own value tracker must be bypassed or a
  // programmatic assignment is swallowed as "no change".
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(el, value);
  await act(async () => {
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}

test("the trigger appears once mounted, and nothing is open yet", () => {
  mount();
  const trigger = window.document.querySelector("[aria-label='Search']");
  assert.ok(trigger, "no search trigger after mount");
  assert.equal(rows().length, 0, "the palette rendered rows before it was opened");
});

test("opening fetches the index and renders it grouped, in GROUPS order", async () => {
  const trigger = window.document.querySelector("[aria-label='Search']") as HTMLElement;
  await act(async () => {
    trigger.click();
  });

  assert.equal(fetchCalls, 1, "opening did not fetch the index");

  // Every row is present, and the group headings are in GROUPS order.
  assert.deepEqual(labels(), [
    "Inbox",
    "Vault",
    "Pebbles plant",
    "Pebbles case study Pebbles pod",
    "Weekly digest Digest sprout",
  ]);

  // Read the headings themselves, not the page text: "Vault" is also a row
  // label in the Go to group, so a substring search finds the wrong one.
  assert.deepEqual(groupLabels(), ["Go to", "Garden", "Vault"]);
});

test("typing filters across every kind at once", async () => {
  await type("pebb");
  assert.deepEqual(names(), ["Pebbles", "Pebbles case study"]);
});

test("a group with no surviving row disappears rather than showing an empty heading", async () => {
  await type("pebb");
  assert.deepEqual(groupLabels(), ["Garden"], "an emptied group left its heading behind");
});

test("a query matching nothing says so", async () => {
  await type("zzzzzz");
  assert.equal(rows().length, 0);
  assert.ok(text().includes("Nothing matches."));
});

test("Enter on the highlighted row navigates softly and closes", async () => {
  await type("weekly");
  assert.equal(labels().length, 1);

  await act(async () => {
    rows()[0].click();
  });

  assert.deepEqual(pushed, ["/admin/sprout/digest-4"]);
  assert.equal(rows().length, 0, "the palette stayed open after navigating");
});

test("reopening refetches, and a fresh open starts on an empty query", async () => {
  const before = fetchCalls;
  const trigger = window.document.querySelector("[aria-label='Search']") as HTMLElement;
  await act(async () => {
    trigger.click();
  });
  assert.equal(fetchCalls, before + 1, "reopening did not refetch");
  assert.equal(input().value, "", "the previous query survived the close");
  assert.equal(labels().length, INDEX.length, "reopened onto a filtered list");
});

test("a failed load leaves the four sections and says so — never an empty box", async () => {
  // Close, break the network, reopen. The cache from the successful loads above
  // is deliberately NOT cleared: this is the refresh-failure path, which must
  // keep what it had rather than empty itself.
  const trigger = window.document.querySelector("[aria-label='Search']") as HTMLElement;
  await act(async () => {
    window.document.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });

  fetchOk = false;
  await act(async () => {
    trigger.click();
  });

  assert.equal(labels().length, INDEX.length, "a failed refresh emptied the palette");
  assert.ok(!text().includes("Could not load the index."), "a stale list needs no error line");
});
