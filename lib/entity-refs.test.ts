import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import { extractRefs, mergeMirrored } from "./entity-refs";
import { remarkPlugins, rehypePlugins } from "./markdown";

// Drives the EXACT chain the app renders (same helper as markdown.test.ts) so
// the six-row table below can assert extractRefs against the real pipeline's
// opinion, not just the regex's own.
function render(source: string): string {
  return renderToStaticMarkup(createElement(Markdown, { remarkPlugins, rehypePlugins }, source));
}

test("block refs extract as embeds, inline as mentions", () => {
  assert.deepEqual(
    extractRefs("intro\n\n::entity{ref=bean:karma}\n\nsee :entity[here]{ref=plant:paulopus}"),
    [
      { kind: "embeds", ref: "bean:karma" },
      { kind: "mentions", ref: "plant:paulopus" },
    ],
  );
});

test("duplicates collapse, and a localized value reads its en part", () => {
  assert.deepEqual(extractRefs("::entity{ref=bean:k}\n\n::entity{ref=bean:k}"), [
    { kind: "embeds", ref: "bean:k" },
  ]);
  assert.deepEqual(extractRefs({ en: "::entity{ref=bean:k}" }), [{ kind: "embeds", ref: "bean:k" }]);
});

test("no content, no refs", () => {
  assert.deepEqual(extractRefs(undefined), []);
  assert.deepEqual(extractRefs("just prose"), []);
});

test("mergeMirrored replaces prior mirrored entries and keeps authored ones", () => {
  const existing = [
    { kind: "evolves-from", ref: "bean:old" },
    { kind: "embeds", ref: "bean:gone" },
  ];
  assert.deepEqual(mergeMirrored(existing, [{ kind: "embeds", ref: "bean:new" }]), [
    { kind: "evolves-from", ref: "bean:old" },
    { kind: "embeds", ref: "bean:new" },
  ]);
});

test("mergeMirrored is idempotent", () => {
  const mirrored = [{ kind: "embeds", ref: "bean:k" }];
  const once = mergeMirrored([], mirrored);
  assert.deepEqual(mergeMirrored(once, mirrored), once);
});

// The six-row agreement table (finding 5). Each row checks extractRefs
// against what react-markdown + the app's remark/rehype chain actually
// render, since a scan-not-parse extractor can only be validated against the
// real pipeline it is meant to mirror.

test("flush block ref: extracted, and the pipeline renders an entity-card", () => {
  const src = "::entity{ref=bean:a}";
  assert.deepEqual(extractRefs(src), [{ kind: "embeds", ref: "bean:a" }]);
  assert.match(render(src), /<entity-card data-ref="bean:a">/);
});

test("2-space indented block ref: extracted, and the pipeline still renders a card (CommonMark allows up to 3 leading spaces)", () => {
  const src = "  ::entity{ref=bean:b}";
  assert.deepEqual(extractRefs(src), [{ kind: "embeds", ref: "bean:b" }]);
  assert.match(render(src), /<entity-card data-ref="bean:b">/);
});

test("3-space indented block ref: extracted, and the pipeline still renders a card", () => {
  const src = "   ::entity{ref=bean:c}";
  assert.deepEqual(extractRefs(src), [{ kind: "embeds", ref: "bean:c" }]);
  assert.match(render(src), /<entity-card data-ref="bean:c">/);
});

test("4-space indented block ref: NOT extracted, matching the pipeline treating it as an indented code block", () => {
  const src = "    ::entity{ref=bean:d}";
  assert.deepEqual(extractRefs(src), []);
  assert.doesNotMatch(render(src), /entity-card/);
});

test("block ref inside a fenced code block: NOT extracted (no phantom edge), matching the pipeline rendering it as literal code", () => {
  const src = "```\n::entity{ref=bean:e}\n```";
  assert.deepEqual(extractRefs(src), []);
  assert.doesNotMatch(render(src), /entity-card/);
});

test("inline ref inside a code span: NOT extracted (no phantom edge), matching the pipeline rendering it as literal code", () => {
  const src = "see `:entity[x]{ref=bean:f}` here";
  assert.deepEqual(extractRefs(src), []);
  assert.doesNotMatch(render(src), /entity-link/);
});
