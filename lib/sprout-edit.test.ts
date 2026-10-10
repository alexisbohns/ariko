import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldCascadePublish } from "./sprout-edit";
import { DIGEST_KIND, SPROUT_KINDS } from "./sprout-kind";

test("shouldCascadePublish: a digest is exempt; every other kind cascades", () => {
  for (const kind of SPROUT_KINDS) {
    assert.equal(shouldCascadePublish(kind), kind !== DIGEST_KIND, kind);
  }
});
