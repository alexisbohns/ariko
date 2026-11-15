import { test } from "node:test";
import assert from "node:assert/strict";
import { stagingProblems } from "./staging-check";
import {
  CLOCK_SVG, DOOR_ONLY_FIXTURES, INERT_FIXTURES, MALFORMED_FIXTURES, NONCANONICAL_FIXTURES, STAGING_FIXTURES,
} from "./staging-fixtures";

test("valid and inert documents have no problems", () => {
  for (const [name, md] of Object.entries({ ...STAGING_FIXTURES, ...INERT_FIXTURES })) assert.deepEqual(stagingProblems(md), [], name);
  for (const name of ["defaultsSpelled", "unknownValues", "captionOnOwnParagraph", "quotedBareValue", "interruptsParagraph"] as const)
    assert.ok(!stagingProblems(NONCANONICAL_FIXTURES[name]).some((p) => /block opener|stray :::/.test(p)), name);
  assert.deepEqual(stagingProblems(Object.values(STAGING_FIXTURES).join("\n\n")), []);
});

test("every malformed and door-only fixture is refused with its message", () => {
  for (const [name, { md, problem }] of Object.entries({ ...MALFORMED_FIXTURES, ...DOOR_ONLY_FIXTURES })) {
    const problems = stagingProblems(md);
    assert.ok(problems.some((p) => problem.test(p)), `${name}: ${JSON.stringify(problems)}`);
  }
});

test("foreign leaf and text directives are not this check's business", () => {
  assert.deepEqual(stagingProblems("::entity{ref=bean:x} and :entity[x]{ref=bean:y} at 10:30"), []);
});

test("unclosed is decided per block, never by where the document ends", () => {
  // Closed, with blank lines after: the node stops before them.
  assert.deepEqual(stagingProblems(`${STAGING_FIXTURES.callout}\n\n\n`), []);
  // Closed, then prose: nothing reaches the end of the document.
  assert.deepEqual(stagingProblems(`${STAGING_FIXTURES.callout}\n\nAfter.`), []);
  // Unclosed after a closed block, and at the very end with blanks.
  assert.ok(stagingProblems(`${STAGING_FIXTURES.callout}\n\n:::callout\nOpen.`).some((p) => /callout: unclosed/.test(p)));
  assert.ok(stagingProblems(":::callout\nOpen.\n\n").some((p) => /callout: unclosed/.test(p)));
  assert.ok(stagingProblems(":::callout").some((p) => /callout: unclosed/.test(p)));
  // An inner fence shorter than the opening one closes the inner block only.
  assert.ok(stagingProblems("::::compare\n:::do\nYes.\n:::\n:::dont\nNo.\n:::").some((p) => /compare: unclosed/.test(p)));
  // A ::: as the last line of an indented code block is content, not a fence.
  assert.ok(stagingProblems(":::callout\nText.\n\n    :::").some((p) => /callout: unclosed/.test(p)));
});

test("the noncanonical-but-valid forms the editor rewrites are not all refused", () => {
  // The door is stricter than the renderer on vocabulary only; these are
  // shape-valid and must pass.
  for (const name of ["defaultsSpelled", "captionOnOwnParagraph", "quotedBareValue", "interruptsParagraph"] as const)
    assert.deepEqual(stagingProblems(NONCANONICAL_FIXTURES[name]), [], name);
  assert.ok(stagingProblems(NONCANONICAL_FIXTURES.unclosed).some((p) => /callout: unclosed/.test(p)));
});

test("a staged name in the leaf form is the commonest slip, named with the fix", () => {
  assert.deepEqual(stagingProblems("::callout[Note]"), ["::callout must be a container — write :::callout … :::"]);
  assert.deepEqual(stagingProblems(`:::figure\n![a](${CLOCK_SVG})\n:::`), []);
});

test("a fence line remark reads as prose is refused, and prose that merely starts with colons is not", () => {
  assert.deepEqual(stagingProblems(":::callout In two words\nx\n:::"), [
    '":::callout In two words" is not a block opener — write :::name[label]{attrs}, with no space before [ or {',
  ]);
  assert.deepEqual(stagingProblems(":::callout\nx\n:::\n:::"), ["a stray ::: closes nothing"]);
  // A failed opener's closer is its own, not a second, stray problem — even
  // across a blank line.
  assert.equal(stagingProblems(":::callout In two words\nx\n\n:::").length, 1);
  // Two colons and a staged name is the same slip; two and a foreign name is
  // another pass's prose, as the leaf rule has it.
  assert.ok(stagingProblems("::callout In two words\nx").some((p) => /is not a block opener/.test(p)));
  // The quoted line is truncated, so a long one does not swamp the message.
  const [long] = stagingProblems(`:::callout ${"word ".repeat(30)}\nx\n:::`);
  assert.ok(long.length < 140, long);
  // Inside a blockquote and a list item, the same slip is the same refusal.
  assert.ok(stagingProblems("> intro\n> :::callout In two words\n> x").some((p) => /is not a block opener/.test(p)));
  assert.ok(stagingProblems("- a\n  :::callout In two words\n  x").some((p) => /is not a block opener/.test(p)));
  // Not openers: one colon is a text directive, a leaf on its own line is a
  // leafDirective (never a paragraph), and a time is prose.
  for (const md of [
    ":entity[the music]{ref=bean:x} plays",
    "Before.\n:entity[x]{ref=bean:y} after",
    "Before.\n::entity{ref=bean:x}",
    "::entity{ref=bean:x}",
    "meet at\n10:30 sharp",
    "a ratio of\n:: 2",
    "`code\n::callout x` spans lines",
  ]) assert.deepEqual(stagingProblems(md), [], md);
});

test("a leading BOM does not shift the source the check reads back", () => {
  assert.deepEqual(stagingProblems("\uFEFF:::callout\nx\n:::"), []);
  assert.ok(stagingProblems("\uFEFF:::callout\nOpen.").some((p) => /callout: unclosed/.test(p)));
});
