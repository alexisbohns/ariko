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
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("lib/sprout-state.ts", "utf8");
  assert.equal(
    /^import\s+(?!type\b)/m.test(source),
    false,
    "lib/sprout-state.ts must import only types — see lib/section-keys.ts",
  );
});
