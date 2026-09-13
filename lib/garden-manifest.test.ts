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

test("rejects a sprout date that is not YYYY-MM-DD", () => {
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
        date: "09/12/2026"
        name: { en: First entry }
        description: { en: The first entry. }
`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /beans\[0\]\.sprouts\[0\]\.date/);
  assert.match(result.error, /09\/12\/2026/);
});

test("rejects a sprout type with a trailing space", () => {
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
        type: "digest "
        date: 2026-09-13
        name: { en: First entry }
        description: { en: The first entry. }
`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /beans\[0\]\.sprouts\[0\]\.type/);
  assert.match(result.error, /"digest "/);
});

test("rejects a non-kebab-case slug", () => {
  const result = parseManifest(`
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
beans:
  - slug: Krabs_Pod
    name: { en: Ledger }
    description: { en: The ledger bean. }
    sprouts: []
`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /beans\[0\]\.slug must be kebab-case \(got "Krabs_Pod"\)/);
});

test("rejects a duplicate slug across the manifest", () => {
  const result = parseManifest(`
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
beans:
  - slug: krabs
    name: { en: Ledger }
    description: { en: The ledger bean. }
    sprouts: []
`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /duplicate slug "krabs"/);
  assert.match(result.error, /beans\[0\]/);
});

test("rejects content over 64 KiB", () => {
  const big = "a".repeat(64 * 1024 + 1);
  const result = parseManifest(`
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
  content: { en: "${big}" }
beans: []
`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /pod\.content\.en/);
  assert.match(result.error, /64 KiB/);
});

test("rejects an oversized fr content, not just en", () => {
  const big = "a".repeat(64 * 1024 + 1);
  const result = parseManifest(`
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
  content: { en: "Fine.", fr: "${big}" }
beans: []
`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /pod\.content\.fr/);
  assert.match(result.error, /64 KiB/);
});

test("rejects a missing slug distinctly from checkSlug's empty branch", () => {
  const result = parseManifest(`
pod:
  slug: ""
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
beans: []
`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /pod\.slug is required/);
});

test("a non-string slug reports what was actually there, not 'required'", () => {
  const result = parseManifest(`
pod:
  slug: 123
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
beans: []
`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.doesNotMatch(result.error, /is required/);
  assert.match(result.error, /pod\.slug/);
  assert.match(result.error, /123/);
});

test("rejects a duplicate slug between two beans", () => {
  const result = parseManifest(`
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
beans:
  - slug: same-slug
    name: { en: First }
    description: { en: A bean. }
    sprouts: []
  - slug: same-slug
    name: { en: Second }
    description: { en: Another bean. }
    sprouts: []
`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /duplicate slug "same-slug"/);
  assert.match(result.error, /beans\[1\]/);
});

test("rejects a duplicate slug between two sprouts in different beans", () => {
  const result = parseManifest(`
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
beans:
  - slug: bean-one
    name: { en: First }
    description: { en: A bean. }
    sprouts:
      - slug: same-sprout
        type: note
        date: 2026-09-13
        name: { en: One }
        description: { en: First sprout. }
  - slug: bean-two
    name: { en: Second }
    description: { en: Another bean. }
    sprouts:
      - slug: same-sprout
        type: note
        date: 2026-09-13
        name: { en: Two }
        description: { en: Second sprout. }
`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /duplicate slug "same-sprout"/);
  assert.match(result.error, /beans\[1\]\.sprouts\[0\]/);
});

const FORBIDDEN_KEYS = ["visibility", "state", "exhibited", "order", "relations", "parents"];

for (const key of FORBIDDEN_KEYS) {
  test(`rejects "${key}" on a pod`, () => {
    const result = parseManifest(`
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
  ${key}: true
beans: []
`);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, new RegExp(`pod\\.${key}`));
  });

  test(`rejects "${key}" on a bean`, () => {
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
    sprouts: []
    ${key}: true
`);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, new RegExp(`beans\\[0\\]\\.${key}`));
  });

  test(`rejects "${key}" on a sprout`, () => {
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
        ${key}: true
`);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, new RegExp(`beans\\[0\\]\\.sprouts\\[0\\]\\.${key}`));
  });
}

test("rejects content on a bean, naming the field and pointing at a sprout", () => {
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
    sprouts: []
    content: { en: This should not be here. }
`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /beans\[0\]\.content/);
  assert.match(result.error, /has no content/i);
  assert.match(result.error, /sprout/i);
});

// Every other `content` test here asserts a REJECTION, which left the two
// success branches (`pod.content = content.text` and the sprout's equivalent)
// unexercised: deleting either assignment would drop every narrative the
// manifest carries and keep all 34 tests green, while planting printed the same
// plan and wrote a pod and a sprout with no prose in them.
test("a valid bilingual content lands on both the pod and the sprout", () => {
  const result = parseManifest(`
pod:
  slug: krabs
  name: { en: Krabs, fr: Krabs }
  plant: null
  description: { en: A small ledger., fr: Un petit registre. }
  content: { en: "# Pod body", fr: "# Corps du pod" }
beans:
  - slug: ledger
    name: { en: Ledger, fr: Registre }
    description: { en: The ledger bean., fr: Le haricot registre. }
    sprouts:
      - slug: first-entry
        type: note
        date: "2026-01-01"
        name: { en: First entry, fr: Première entrée }
        description: { en: The first entry., fr: La première entrée. }
        content: { en: "Sprout body", fr: "Corps du sprout" }
`);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.manifest.pod.content, { en: "# Pod body", fr: "# Corps du pod" });
  assert.deepEqual(result.manifest.beans[0].sprouts[0].content, {
    en: "Sprout body",
    fr: "Corps du sprout",
  });
});
