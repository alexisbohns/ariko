import { test } from "node:test";
import assert from "node:assert/strict";
import { SPROUT_STATES, stateOf, isSproutState } from "./sprout-state";

test("SPROUT_STATES is the vocabulary, in render order", () => {
  assert.deepEqual([...SPROUT_STATES], ["draft", "private", "published"]);
});

test("stateOf reads an absent state as draft", () => {
  // lib/data.ts declares `state?: SproutState` with "absent => NOT published
  // (safe default)", and filterPublic requires state === "published". Draft is
  // the reading every other surface already takes; this is the one place it is
  // written down.
  assert.equal(stateOf({}), "draft");
  assert.equal(stateOf({ state: undefined }), "draft");
});

test("stateOf returns a stored state unchanged", () => {
  assert.equal(stateOf({ state: "private" }), "private");
  assert.equal(stateOf({ state: "published" }), "published");
  assert.equal(stateOf({ state: "draft" }), "draft");
});

test("isSproutState accepts every member and nothing else", () => {
  for (const s of SPROUT_STATES) assert.equal(isSproutState(s), true);
  assert.equal(isSproutState("bogus"), false);
  assert.equal(isSproutState(""), false);
  assert.equal(isSproutState("PUBLISHED"), false);
});

test("lib/sprout-state.ts imports nothing that reaches node:", async () => {
  // The whole reason this module exists rather than an export on
  // lib/sprouts.ts: the state popover is inside a client island, and
  // lib/sprouts.ts imports resolveText as a VALUE from lib/data.ts, which
  // opens with node:fs. A value import added here would fail `npm run build`
  // with UnhandledSchemeError and nothing earlier would notice.
  //
  // WHAT THIS ACTUALLY CHECKS, because the failure is otherwise confusing: the
  // SYNTAX of every import statement, not the module each one resolves to. Two
  // consequences, both deliberate.
  //
  // It is STRICTER than the rule it protects. `lib/palette-items.ts` imports a
  // value — just not from a node-reaching module — and would fail this test.
  // That is fine for a file this narrow: the cheapest way to guarantee nothing
  // reaches `node:` four hops down is to let nothing but types in at all, and
  // `lib/server-safe-source.test.ts` is the place that polices import TARGETS
  // when a file needs real dependencies.
  //
  // And it rejects two spellings that are harmless: a per-specifier
  // `import { type Sprout } from "./data"`, and anything that puts a newline
  // between `import` and `type`. Both erase at compile time, so if one of them
  // ever trips this, the test is what is wrong and not the import — rewrite it
  // as a top-level `import type`, or widen the regex. Do NOT delete the test.
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("lib/sprout-state.ts", "utf8");
  assert.equal(
    /^import\s+(?!type\b)/m.test(source),
    false,
    "lib/sprout-state.ts must import only types — see lib/section-keys.ts",
  );
});
