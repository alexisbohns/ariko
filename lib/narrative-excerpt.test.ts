import { test } from "node:test";
import assert from "node:assert/strict";
import { narrativeExcerpt } from "./narrative-excerpt";

/**
 * The hub's narrative preview draws ONE line of text, from a document that can
 * contain anything the prose editor can write. Every case below is a shape
 * that, left alone, would put punctuation on the hub where a sentence belongs
 * — a row of backticks, a bare `#`, an entity card's `ref=`, a table's pipes.
 */

test("plain prose survives unchanged", () => {
  assert.equal(narrativeExcerpt("Ariko is a personal central node."), "Ariko is a personal central node.");
});

test("an empty or whitespace-only document is empty", () => {
  assert.equal(narrativeExcerpt(""), "");
  assert.equal(narrativeExcerpt("  \n\n\t"), "");
});

test("a document that opens with a heading yields the heading's words", () => {
  assert.equal(narrativeExcerpt("# The story\n\nIt began badly."), "The story It began badly.");
});

test("a fenced block contributes nothing — not its code, not its backticks", () => {
  const md = "Before.\n\n```ts\nconst secret = 1;\n```\n\nAfter.";
  assert.equal(narrativeExcerpt(md), "Before. After.");
});

test("inline code keeps its text and loses its ticks", () => {
  assert.equal(narrativeExcerpt("Call `loadRawGarden` first."), "Call loadRawGarden first.");
});

test("a link keeps its text; an image contributes nothing", () => {
  assert.equal(narrativeExcerpt("See [the spec](/docs/x.md) for more."), "See the spec for more.");
  assert.equal(narrativeExcerpt("![a screenshot](/x.png)\n\nBody."), "Body.");
});

test("an entity card drops out; an inline entity keeps its label", () => {
  assert.equal(narrativeExcerpt("::entity{ref=bean:one}\n\nBody."), "Body.");
  assert.equal(
    narrativeExcerpt("Built with :entity[Melogram]{ref=plant:melogram} last year."),
    "Built with Melogram last year.",
  );
});

test("emphasis markers do not survive", () => {
  assert.equal(narrativeExcerpt("A **bold** and _quiet_ ~~thing~~."), "A bold and quiet thing.");
});

test("list, quote and rule markers do not survive", () => {
  assert.equal(narrativeExcerpt("- one\n- two\n\n> quoted\n\n---\n\nEnd."), "one two quoted End.");
  assert.equal(narrativeExcerpt("1. first\n2. second"), "first second");
});

test("a table reads as its cells, not as its pipes", () => {
  const md = "| kind | count |\n| --- | --- |\n| pod | 4 |";
  assert.equal(narrativeExcerpt(md), "kind count pod 4");
});

test("text under the budget is not cut and gains no ellipsis", () => {
  const text = narrativeExcerpt("Short enough.", 40);
  assert.equal(text, "Short enough.");
});

test("text over the budget is cut on a word boundary, with an ellipsis", () => {
  const md = "one two three four five six seven eight nine ten";
  const text = narrativeExcerpt(md, 20);
  assert.ok(text.endsWith("…"), `expected an ellipsis, got ${JSON.stringify(text)}`);
  assert.ok(text.length <= 21, `expected the budget to hold, got ${JSON.stringify(text)}`);
  // The cut lands between words — never mid-word, and never on a dangling space.
  assert.equal(text, "one two three four…");
});

test("a single word longer than the budget is still cut", () => {
  const text = narrativeExcerpt("supercalifragilisticexpialidocious", 10);
  assert.equal(text, "supercalif…");
});
