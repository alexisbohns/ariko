import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldCascadePublish } from "./sprout-edit";
import { DIGEST_TYPE } from "./synthesis";

// The publish cascade gate (final review C1): a digest sprout's publish never
// flips its bean/plant public — review sign-off is not public exhibition.
//
// The rest of this file went with buildSproutPatch and validateSproutPatch. The
// cases they covered did not go with them: the bilingual composition and the
// blank-name rejection are lib/sprout-meta.test.ts's now, the state coercion is
// lib/sprout-state.test.ts's, and the date and type guards are the two
// one-field actions' own.

test("shouldCascadePublish: digest sprouts are exempt; every other type cascades", () => {
  assert.equal(shouldCascadePublish(DIGEST_TYPE), false);
  assert.equal(shouldCascadePublish("song"), true);
  assert.equal(shouldCascadePublish("note"), true);
  assert.equal(shouldCascadePublish(""), true);
});
