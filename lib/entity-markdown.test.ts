import { test } from "node:test";
import assert from "node:assert/strict";
import { MarkdownManager } from "@tiptap/markdown";
import { headlessExtensions } from "./entity-markdown";

// The editor's parse/serialize pair, headless — no DOM, no React. This is the
// same manager the editor builds (components/editor/prose-editor.tsx) minus the
// node views, which is exactly why the nodes live in lib/ without them.
const manager = new MarkdownManager({ extensions: headlessExtensions });
const roundTrip = (src: string): string => manager.serialize(manager.parse(src)).trim();
const nodeTypes = (src: string): string => JSON.stringify(manager.parse(src));

test("a block card round-trips byte-identically", () => {
  const src = "::entity{ref=bean:karma-accountability}";
  assert.equal(roundTrip(src), src);
  assert.ok(nodeTypes(src).includes('"entityCard"'));
});

test("an inline mention round-trips byte-identically, label and all", () => {
  const src = "see :entity[Prediction Timelines]{ref=bean:prediction-timelines} here";
  assert.equal(roundTrip(src), src);
  assert.ok(nodeTypes(src).includes('"entityMention"'));
});

test("a ref-less directive mints nothing and stays literal text", () => {
  // Mirrors remarkEntity's rule (lib/markdown.ts): no ref, no node.
  for (const src of ["::entity{foo=bar}", "::entity{ref=}", "::entity"]) {
    assert.ok(!nodeTypes(src).includes('"entityCard"'), src);
    assert.equal(roundTrip(src), src);
  }
});

test("indentation follows the CommonMark rule: 3 spaces yes, 4 spaces no", () => {
  assert.ok(nodeTypes("   ::entity{ref=bean:x}").includes('"entityCard"'));
  // 4+ spaces is an indented code block; marked re-emits it as a fence, which
  // renders identically (asserted in lib/markdown-conformance.test.ts).
  assert.ok(!nodeTypes("    ::entity{ref=bean:x}").includes('"entityCard"'));
});

test("code contexts never activate the directive", () => {
  assert.ok(!nodeTypes("```\n::entity{ref=bean:x}\n```").includes('"entityCard"'));
  assert.ok(!nodeTypes("literal `::entity{ref=bean:x}` here").includes('"entityMention"'));
});

test("a mixed document keeps prose, mention and card in order", () => {
  const src = "## Drawer\n\nProse with :entity[X]{ref=bean:x} inline.\n\n::entity{ref=bean:y}";
  assert.equal(roundTrip(src), src);
});
