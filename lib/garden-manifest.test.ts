import { test } from "node:test";
import assert from "node:assert/strict";
import { parseManifest } from "./garden-manifest";

const MINIMAL = `
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
beans: []
`;

test("parses a minimal pod-only manifest", () => {
  const result = parseManifest(MINIMAL);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.manifest.pod.slug, "krabs");
  assert.equal(result.manifest.pod.plant, null);
  assert.deepEqual(result.manifest.pod.name, "Krabs");
  assert.deepEqual(result.manifest.beans, []);
});

test("a bilingual pair composes to an {en, fr} Text", () => {
  const result = parseManifest(`
pod:
  slug: krabs
  name: { en: Krabs, fr: Krabs }
  plant: null
  description: { en: A small ledger., fr: Un petit registre. }
beans: []
`);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.manifest.pod.description, {
    en: "A small ledger.",
    fr: "Un petit registre.",
  });
});

test("rejects invalid YAML with a readable error", () => {
  const result = parseManifest("pod: [unclosed");
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /YAML/i);
});
