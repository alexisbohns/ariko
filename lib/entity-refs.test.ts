import { test } from "node:test";
import assert from "node:assert/strict";
import { extractRefs, mergeMirrored } from "./entity-refs";

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
