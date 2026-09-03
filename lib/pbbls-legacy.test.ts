import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import {
  AUTHORED_BEANS,
  LEGACY_BEANS,
  MILESTONE_TYPE,
  SPROUT_MAP,
  STUB_BEANS,
  retireLegacyBeans,
} from "./pbbls-legacy";
import type { RawGarden } from "./data";

// A miniature garden with one of everything the transform cares about: a
// legacy bean with a mapped sprout, an authored bean whose slug is also in
// STUB_BEANS, and a sprout nothing maps.
function fixture(): RawGarden {
  return {
    pods: [
      { slug: "pbbls-pebble", name: "Pebbles & Glyphs", description: "", parents: ["plant:pbbls"] },
      { slug: "pbbls-web", name: "The Web App", description: "", parents: ["plant:pbbls"] },
    ],
    beans: [
      { slug: "pbbls-webapp", name: "Pebbles Webapp", parents: ["plant:pbbls"] },
      { slug: "pbbls-ios", name: "Pebbles iOS", parents: ["plant:pbbls"] },
      { slug: "pbbls-path", name: "The Path", parents: ["plant:pbbls"] },
      { slug: "pbbls-recorder", name: "The Recorder", parents: ["plant:pbbls"] },
      { slug: "pbbls-valence", name: { en: "How a memory became a shape" }, parents: ["pod:pbbls-pebble"] },
      { slug: "unrelated", name: "Unrelated", parents: ["plant:ariko"] },
    ],
    sprouts: [
      {
        slug: "pbbls-webapp-emotion-pearl",
        name: "Emotion Pearl",
        type: "feature",
        date: "2026-03-29",
        description: "",
        parents: ["bean:pbbls-webapp"],
        state: "published",
      },
      {
        slug: "untouched",
        name: "Untouched",
        type: "song",
        date: "2026-01-01",
        description: "",
        parents: ["bean:unrelated"],
        state: "published",
      },
    ],
  };
}

test("retireLegacyBeans drops every legacy bean", () => {
  const out = retireLegacyBeans(fixture());
  const slugs = new Set((out.beans ?? []).map((b) => b.slug));
  for (const slug of LEGACY_BEANS) assert.equal(slugs.has(slug), false, `${slug} must be gone`);
  assert.equal(slugs.has("unrelated"), true, "unrelated beans survive");
});

test("retireLegacyBeans adds every MISSING stub as a private bean under a pod ref", () => {
  const input = fixture();
  const preexisting = new Set((input.beans ?? []).map((b) => b.slug));
  const out = retireLegacyBeans(input);
  const bySlug = new Map((out.beans ?? []).map((b) => [b.slug, b]));
  for (const stub of STUB_BEANS) {
    const got = bySlug.get(stub.slug);
    assert.ok(got, `${stub.slug} must exist`);
    // A slug the garden already carries is left exactly as authored (see the
    // next test), so only the stubs this run ADDED can be asserted private.
    if (preexisting.has(stub.slug)) continue;
    assert.equal(got.visibility, "private", `${stub.slug} must be private`);
  }
});

test("retireLegacyBeans never overwrites a bean that already exists", () => {
  const out = retireLegacyBeans(fixture());
  const valence = (out.beans ?? []).find((b) => b.slug === "pbbls-valence");
  // pbbls-valence is in STUB_BEANS, but the fixture already has an authored
  // one. The catalog must not touch it — this is the rule that keeps a
  // migrate re-run from reverting an authored title to a placeholder.
  assert.deepEqual(valence?.name, { en: "How a memory became a shape" });
  assert.equal(valence?.visibility, undefined);
  assert.equal(valence?.description, undefined, "not even a partial merge of the placeholder");
  assert.equal((out.beans ?? []).filter((b) => b.slug === "pbbls-valence").length, 1, "no duplicate");
});

test("retireLegacyBeans re-parents and retypes exactly the mapped sprouts", () => {
  const out = retireLegacyBeans(fixture());
  const bySlug = new Map((out.sprouts ?? []).map((s) => [s.slug, s]));
  const pearl = bySlug.get("pbbls-webapp-emotion-pearl");
  assert.deepEqual(pearl?.parents, ["bean:pbbls-valence"]);
  assert.equal(pearl?.type, MILESTONE_TYPE);
  assert.equal(pearl?.date, "2026-03-29", "everything else is preserved");
  assert.equal(pearl?.state, "published");
});

test("retireLegacyBeans leaves an unmapped sprout strictly untouched", () => {
  const input = fixture();
  const out = retireLegacyBeans(input);
  const before = (input.sprouts ?? []).find((s) => s.slug === "untouched");
  const after = (out.sprouts ?? []).find((s) => s.slug === "untouched");
  // Same object reference: the transform must not copy what it does not change.
  assert.equal(after, before);
});

test("retireLegacyBeans is idempotent", () => {
  const once = retireLegacyBeans(fixture());
  const twice = retireLegacyBeans(once);
  assert.deepStrictEqual(twice, once);
});

test("retireLegacyBeans handles an empty garden, and stays idempotent on it", () => {
  const once = retireLegacyBeans({});
  assert.equal(once.beans?.length, STUB_BEANS.length, "every stub is seeded from nothing");
  // `sprouts: []` where the input had no key at all. Pinned, not fixed:
  // retierGarden normalises the same way, and both migrations write the two
  // collections unconditionally.
  assert.deepEqual(once.sprouts, []);
  assert.deepStrictEqual(retireLegacyBeans(once), once);
});

test("the catalogs are disjoint and cover every bean in _SLUGS.md", () => {
  const stubs = new Set(STUB_BEANS.map((b) => b.slug));
  const authored = new Set<string>(AUTHORED_BEANS);
  for (const slug of authored) {
    assert.equal(stubs.has(slug), false, `${slug} is authored and must not be stubbed`);
  }
  // A slug that both retires and stubs would be removed and re-added in the
  // same pass. The transform survives that (it derives its guard from the
  // survivors); this keeps it from ever arising.
  for (const slug of LEGACY_BEANS) {
    assert.equal(stubs.has(slug), false, `${slug} retires and must not be stubbed`);
  }
  assert.equal(stubs.size, 36);
  assert.equal(authored.size, 6);

  // Every stub parents into a pod ref, never a plant ref.
  const stubParentRefs = new Set(STUB_BEANS.flatMap((b) => b.parents));
  for (const ref of stubParentRefs) assert.match(ref, /^pod:/);

  // The writers' reference is the other half of this contract. Legacy slugs
  // are subtracted rather than asserted absent, so this passes both before and
  // after Task 5 edits the doc.
  const doc = readFileSync(
    join(process.cwd(), "docs", "pbbls-atelier-editorial", "payloads", "_SLUGS.md"),
    "utf8",
  );
  const legacy = new Set<string>(LEGACY_BEANS);
  const referenced = new Set(
    [...doc.matchAll(/bean:(pbbls-[a-z0-9-]+)/g)].map((m) => m[1]).filter((s) => !legacy.has(s)),
  );
  assert.deepEqual(
    [...referenced].sort(),
    [...stubs, ...authored].sort(),
    "_SLUGS.md and the catalogs have drifted",
  );
});

test("SPROUT_MAP names twelve sprouts and only beans that will exist", () => {
  const entries = Object.entries(SPROUT_MAP);
  assert.equal(entries.length, 12);
  const known = new Set([...STUB_BEANS.map((b) => b.slug), ...AUTHORED_BEANS]);
  const legacy = new Set<string>(LEGACY_BEANS);
  for (const [sprout, bean] of entries) {
    assert.equal(known.has(bean), true, `${sprout} -> ${bean} is not a bean this work creates`);
    assert.equal(legacy.has(bean), false, `${sprout} must not stay on a legacy bean`);
  }
});

// --- data/garden.yml conformance. The seed is edited by hand (yaml.dump would
// erase its comments), so these tests are the proof that the hand edit is
// exactly what the transform would have produced. Editing the seed back fails
// the suite.

function currentGarden(): RawGarden {
  const file = readFileSync(join(process.cwd(), "data", "garden.yml"), "utf8");
  // CORE_SCHEMA keeps dates as plain YYYY-MM-DD strings, same as scripts/migrate-garden.ts.
  return (yaml.load(file, { schema: yaml.CORE_SCHEMA }) as RawGarden) ?? {};
}

test("data/garden.yml is already a fixed point of retireLegacyBeans", () => {
  const before = currentGarden();
  assert.deepStrictEqual(retireLegacyBeans(before), before);
});

test("data/garden.yml carries no legacy pbbls bean", () => {
  const slugs = new Set((currentGarden().beans ?? []).map((b) => b.slug));
  for (const slug of LEGACY_BEANS) assert.equal(slugs.has(slug), false, `${slug} must be gone`);
});

test("data/garden.yml seeds every stub, private, under a pod that exists", () => {
  const raw = currentGarden();
  const bySlug = new Map((raw.beans ?? []).map((b) => [b.slug, b]));
  const podSlugs = new Set((raw.pods ?? []).map((p) => p.slug));
  for (const stub of STUB_BEANS) {
    const got = bySlug.get(stub.slug);
    assert.ok(got, `${stub.slug} must be seeded`);
    assert.equal(got.visibility, "private", `${stub.slug} must be private`);
    assert.deepEqual(got.parents, stub.parents, `${stub.slug} parents`);
    assert.equal(got.name, stub.name, `${stub.slug} name`);
    assert.equal(got.description, stub.description, `${stub.slug} description`);
    for (const ref of got.parents) {
      assert.equal(podSlugs.has(ref.slice("pod:".length)), true, `${stub.slug} -> ${ref} is dangling`);
    }
  }
});

test("data/garden.yml never seeds a bean that is already authored in Mongo", () => {
  // Seeding one would make `npm run migrate` $set its real title back to a
  // placeholder. This is the rule the stub block's comment states.
  const slugs = new Set((currentGarden().beans ?? []).map((b) => b.slug));
  for (const slug of AUTHORED_BEANS) {
    assert.equal(slugs.has(slug), false, `${slug} is authored and must stay out of the seed`);
  }
});

test("data/garden.yml files the twelve changelog sprouts as milestones", () => {
  const bySlug = new Map((currentGarden().sprouts ?? []).map((s) => [s.slug, s]));
  for (const [slug, bean] of Object.entries(SPROUT_MAP)) {
    const s = bySlug.get(slug);
    assert.ok(s, `${slug} must still be in the seed`);
    assert.deepEqual(s.parents, [`bean:${bean}`], `${slug} parents`);
    assert.equal(s.type, MILESTONE_TYPE, `${slug} type`);
  }
});

test("the only seed-dangling sprout target is pbbls-wallet, which is authored", () => {
  // Consequence of the rule above, pinned so nobody "fixes" it by seeding
  // pbbls-wallet: exactly one of the twelve advances an already-authored bean,
  // so the seed carries exactly one bean: ref it does not itself define. Mongo
  // resolves it; buildDataset tolerates a dangling parent by design.
  const raw = currentGarden();
  const seeded = new Set((raw.beans ?? []).map((b) => b.slug));
  const dangling = Object.entries(SPROUT_MAP)
    .filter(([, bean]) => !seeded.has(bean))
    .map(([sprout, bean]) => `${sprout} -> ${bean}`);
  assert.deepEqual(dangling, ["pbbls-webapp-karma -> pbbls-wallet"]);
});
