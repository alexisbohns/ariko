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

test("parses a bean with a sprout, including a YAML date scalar", () => {
  const result = parseManifest(`
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
beans:
  - slug: ledger
    name: { en: Ledger }
    description: { en: The ledger bean. }
    sprouts:
      - slug: first-entry
        type: note
        date: 2026-09-13
        name: { en: First entry }
        description: { en: The first entry. }
`);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.manifest.beans[0].slug, "ledger");
  const sprout = result.manifest.beans[0].sprouts[0];
  assert.equal(sprout.slug, "first-entry");
  assert.equal(sprout.type, "note");
  assert.equal(sprout.date, "2026-09-13");
});

test("a nested error names its full path", () => {
  const result = parseManifest(`
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
beans:
  - slug: first-bean
    name: { en: First bean }
    description: { en: A bean. }
    sprouts: []
  - slug: second-bean
    name: { en: Second bean }
    description: { en: Another bean. }
    sprouts:
      - slug: missing-name
        type: note
        date: 2026-09-13
        description: { en: No name here. }
`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /beans\[1\]\.sprouts\[0\]\.name/);
});
