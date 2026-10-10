import { test } from "node:test";
import assert from "node:assert/strict";
import { parseManifest } from "./garden-manifest";
import { MAX_CONTENT_BYTES } from "./content-edit";

const CAP = new RegExp(`${MAX_CONTENT_BYTES / 1024} KiB`);

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
        kind: log
        date: 2026-09-13
        name: { en: First entry }
        description: { en: The first entry. }
`);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.manifest.beans[0].slug, "ledger");
  const sprout = result.manifest.beans[0].sprouts[0];
  assert.equal(sprout.slug, "first-entry");
  assert.equal(sprout.kind, "log");
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
        kind: log
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
        kind: log
        date: "09/12/2026"
        name: { en: First entry }
        description: { en: The first entry. }
`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /beans\[0\]\.sprouts\[0\]\.date/);
  assert.match(result.error, /09\/12\/2026/);
});

/**
 * One sprout inside an otherwise valid manifest, so a test about the sprout's
 * own keys reads as those keys and not as forty lines of pod. `slug`, `name`
 * and `description` are placed; every OTHER key is emitted verbatim as a
 * quoted scalar — `type` included, since that key's REFUSAL is under test.
 */
function withSprout(sprout: Record<string, string>): string {
  const { slug, name, description, ...rest } = sprout;
  const extra = Object.entries(rest)
    .map(([key, value]) => `        ${key}: ${JSON.stringify(value)}`)
    .join("\n");
  return `
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
      - slug: ${slug}
        name: { en: ${name} }
        description: { en: ${description || "An entry."} }
${extra}
`;
}

// `kind` is a vocabulary (`lib/sprout-kind.ts`), not the free string `type`
// was: a word outside the six is refused, naming all six, because the admin
// draws the field as radios and a stored member it cannot draw would be a
// sprout with no kind on every table.
test("a sprout's kind is a member of the vocabulary", () => {
  const r = parseManifest(withSprout({ slug: "s", name: "S", kind: "essay", date: "2026-01-01", description: "" }));
  assert.ok(r.ok, r.ok ? "" : r.error);
  if (!r.ok) return;
  assert.equal(r.manifest.beans[0].sprouts[0].kind, "essay");
  const bad = parseManifest(withSprout({ slug: "s", name: "S", kind: "note", date: "2026-01-01", description: "" }));
  assert.ok(!bad.ok);
  if (bad.ok) return;
  assert.match(bad.error, /kind must be one of log, milestone, release, essay, decision, digest \(got "note"\)/);
  // `isSproutKind` is exact; this pins that a future `.trim()` cannot pass
  // silently — `lib/sprout-type.ts` existed for exactly the `"digest "` bug.
  const spaced = parseManifest(withSprout({ slug: "s", name: "S", kind: "log ", date: "2026-01-01", description: "" }));
  assert.ok(!spaced.ok);
  if (spaced.ok) return;
  assert.match(spaced.error, /kind must be one of .* \(got "log "\)/);
});

test("a non-string kind reports what was there, not 'got \"\"'", () => {
  const r = parseManifest(withSprout({ slug: "s", name: "S", date: "2026-01-01", description: "" }).replace("date:", "kind: 3\n        date:"));
  assert.ok(!r.ok);
  if (r.ok) return;
  assert.match(r.error, /sprouts\[0\]\.kind must be a string \(got 3\)/);
});

// A digest is the one member the manifest refuses: machine-written, cascade-
// exempt, skipped by the weekly wrap — a file in another repo authoring one
// would be a contradiction nothing anywhere reports.
test("kind: digest is refused by name — machine-written, not authored", () => {
  const r = parseManifest(withSprout({ slug: "s", name: "S", kind: "digest", date: "2026-01-01", description: "" }));
  assert.ok(!r.ok);
  if (r.ok) return;
  assert.match(r.error, /sprouts\[0\]\.kind "digest" is machine-written \(the weekly wrap\) and cannot be authored in a manifest — pick one of log, milestone, release, essay, decision$/);
});

// The pre-journal key is refused BY NAME, the way a bean's `content` once was
// and a sprout's `cover` still is: a manifest written against the old shape
// would otherwise parse, read `kind` as "", and fail on a message about a key
// the author never typed.
test("the old `type` key is refused BY NAME, naming `kind`", () => {
  const r = parseManifest(withSprout({ slug: "s", name: "S", type: "note", date: "2026-01-01", description: "" }));
  assert.ok(!r.ok);
  if (r.ok) return;
  assert.match(r.error, /sprouts\[0\]\.type is not a key any more — a sprout's kind is `kind:`/);
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

test("rejects content over the cap", () => {
  const big = "a".repeat(MAX_CONTENT_BYTES + 1);
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
  assert.match(result.error, CAP);
});

test("rejects an oversized fr content, not just en", () => {
  const big = "a".repeat(MAX_CONTENT_BYTES + 1);
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
  assert.match(result.error, CAP);
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
        kind: log
        date: 2026-09-13
        name: { en: One }
        description: { en: First sprout. }
  - slug: bean-two
    name: { en: Second }
    description: { en: Another bean. }
    sprouts:
      - slug: same-sprout
        kind: log
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
        kind: log
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

// A bean carries its narrative — what the feature is NOW and how it got there
// — under the same rules as a pod's. The manifest used to refuse this key by
// name; the journal model made the bean the thing that has a narrative.
test("accepts content on a bean, bilingual, under a pod's rules", () => {
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
    content: { en: now, fr: maintenant }
`);
  assert.equal(result.ok, true, result.ok ? "" : result.error);
  if (!result.ok) return;
  assert.deepEqual(result.manifest.beans[0].content, { en: "now", fr: "maintenant" });
});

test("rejects a bean content over the cap, the way a pod's is", () => {
  const big = "a".repeat(MAX_CONTENT_BYTES + 1);
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
    content: { en: "${big}" }
`);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /beans\[0\]\.content\.en/);
  assert.match(result.error, CAP);
});

// The bean's acceptance test above covers its own `bean.content = content.text`;
// every other `content` test here asserts a REJECTION, which would leave the
// pod's and the sprout's success branches unexercised: deleting either
// assignment would drop the narrative the manifest carries for that tier and
// keep every other test green, while planting printed the same plan and wrote
// a pod or a sprout with no prose in it.
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
        kind: log
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

const WITH_IMAGES = (cover: string, media: string) => `
pod:
  slug: krabs
  name: { en: Krabs }
  plant: null
  description: { en: A small ledger. }
beans:
  - slug: ledger
    name: { en: Ledger }
    description: { en: The ledger bean. }
    cover: ${cover}
    sprouts:
      - slug: first-entry
        kind: log
        date: 2026-09-13
        name: { en: First entry }
        description: { en: The first entry. }
        media: ${media}
`;

test("a bean cover and sprout media parse as manifest-relative paths, bare or with alt", () => {
  const result = parseManifest(
    WITH_IMAGES("shots/ledger.png", '[shots/one.jpg, { file: shots/two.webp, alt: "The second" }]'),
  );
  assert.equal(result.ok, true, result.ok ? "" : result.error);
  if (!result.ok) return;
  assert.deepEqual(result.manifest.beans[0].cover, { file: "shots/ledger.png" });
  assert.deepEqual(result.manifest.beans[0].sprouts[0].media, [
    { file: "shots/one.jpg" },
    { file: "shots/two.webp", alt: "The second" },
  ]);
});

test("an image path must be relative and inside the repo", () => {
  const abs = parseManifest(WITH_IMAGES("/Users/me/shot.png", "[]"));
  assert.equal(abs.ok, false);
  if (!abs.ok) assert.match(abs.error, /beans\[0\]\.cover\.file must be a path relative/);
  const up = parseManifest(WITH_IMAGES("shots/a.png", "[../../etc/shot.png]"));
  assert.equal(up.ok, false);
  if (!up.ok) assert.match(up.error, /sprouts\[0\]\.media\[0\]\.file must be a path relative/);
});

test("an image must be a raster the upload door accepts — never an SVG", () => {
  const result = parseManifest(WITH_IMAGES("shots/logo.svg", "[]"));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /beans\[0\]\.cover\.file must be a raster image/);
});

test("media must be a list", () => {
  const result = parseManifest(WITH_IMAGES("shots/a.png", "shots/b.png"));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /media must be a list/);
});

test("an image key on the wrong tier is refused and told where it belongs", () => {
  const onSprout = parseManifest(WITH_IMAGES("shots/a.png", "[]").replace("media: []", "cover: shots/b.png"));
  assert.equal(onSprout.ok, false);
  if (!onSprout.ok) assert.match(onSprout.error, /sprouts\[0\]\.cover: a sprout has no cover/);
  const onBean = parseManifest(WITH_IMAGES("shots/a.png", "[]").replace("cover: shots/a.png", "media: [shots/a.png]"));
  assert.equal(onBean.ok, false);
  if (!onBean.ok) assert.match(onBean.error, /beans\[0\]\.media: a bean has no media/);
});
