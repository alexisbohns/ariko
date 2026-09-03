# Retiring the Legacy Pebbles Beans — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the four seeded `pbbls-*` beans, re-parent their twelve changelog sprouts onto the beans the Pebbles case study actually uses, and seed the 36 missing beans as private stubs so every ref in `_SLUGS.md` resolves.

**Architecture:** One pure, idempotent transform (`lib/pbbls-legacy.ts`) is the single definition of "migrated". It is applied to Mongo by a `--dry-run`-capable one-shot script, and to `data/garden.yml` **by hand** — because `yaml.dump` erases the file's nine load-bearing comments, including the one this work has to add. The test suite closes that loop: it asserts `data/garden.yml` is already a fixed point of the transform, so a hand edit that drifts fails the build.

**Tech Stack:** TypeScript, `node --test` + `node:assert/strict`, `js-yaml` (CORE_SCHEMA), MongoDB driver, `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-04-pbbls-legacy-bean-retirement-design.md`
**Issue:** #54

---

## File structure

| File | Responsibility |
|---|---|
| `lib/pbbls-legacy.ts` | **new** — the four catalogs (`LEGACY_BEANS`, `AUTHORED_BEANS`, `SPROUT_MAP`, `STUB_BEANS`) and the pure `retireLegacyBeans` transform. No I/O. |
| `lib/pbbls-legacy.test.ts` | **new** — fixture tests for the transform, plus conformance tests against the real `data/garden.yml` and `_SLUGS.md`. |
| `scripts/migrate-pbbls-legacy.ts` | **new** — applies the catalogs to Mongo; backs up then deletes. Never writes YAML. |
| `data/garden.yml` | **modify** — remove 4 beans, re-parent + retype 12 sprouts, append the 36-stub block. |
| `data/retired/2026-09-04-legacy-pbbls-beans.json` | **new, generated** — the deleted beans, committed as the reversal path. |
| `package.json` | **modify** — one `migrate:pbbls-legacy` script. |
| `docs/pbbls-atelier-editorial/payloads/_SLUGS.md` | **modify** — the legacy warning goes; a "every ref resolves" note replaces it. |
| `docs/superpowers/specs/2026-09-02-pbbls-case-study-design.md` | **modify** — §5.3's wrong total, §9.2 marked done. |
| `README.md` | **modify** — one line for the new script. |

Everything the transform needs is a plain array or record, so `lib/pbbls-legacy.ts` stays a data file with one function at the bottom. It is read by exactly two callers (the test and the script) and depends only on `lib/data`'s types.

---

## Task 1: The catalogs and the transform

**Files:**
- Create: `lib/pbbls-legacy.ts`
- Test: `lib/pbbls-legacy.test.ts`

This task is entirely fixture-based and self-contained. Task 2 adds the tests that read the real `data/garden.yml`.

- [ ] **Step 1: Write the failing test**

Create `lib/pbbls-legacy.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test 2>&1 | head -30
```

Expected: FAIL — `Cannot find module './pbbls-legacy'`.

- [ ] **Step 3: Write the implementation**

Create `lib/pbbls-legacy.ts`:

```ts
import type { Bean, RawGarden } from "./data";

// Issue #54 / spec 2026-09-04-pbbls-legacy-bean-retirement-design.
//
// A pure, idempotent transform over a RawGarden, in the shape lib/retier.ts
// established: the catalogs below are the single definition of "migrated", and
// both halves of the migration read them — scripts/migrate-pbbls-legacy.ts for
// Mongo, lib/pbbls-legacy.test.ts to prove data/garden.yml's hand edit matches.
//
// The YAML half is NOT written by a script, deliberately. migrate-retier.ts
// ends with yaml.dump, which erases comments; garden.yml's comments are
// load-bearing and one of them is the warning this very work adds. So the file
// is edited by hand and the suite asserts it is already a fixed point here.

// The four seeded beans that retire. `pbbls-ios` and `pbbls-path` slug-shadow
// the pods of the same name; `pbbls-webapp` is superseded by the pod tier;
// `pbbls-recorder` never held anything.
export const LEGACY_BEANS = ["pbbls-webapp", "pbbls-ios", "pbbls-path", "pbbls-recorder"] as const;

// Beans already authored through the admin, living only in Mongo. They are
// deliberately absent from STUB_BEANS and from data/garden.yml: migrate $sets
// name and description on every run, so a seed entry would revert their real
// titles to placeholders.
export const AUTHORED_BEANS = [
  "pbbls-wallet",
  "pbbls-market",
  "pbbls-d8",
  "pbbls-connections",
  "pbbls-cut",
  "pbbls-unbuilt",
] as const;

// Spec 2026-09-02 §6 calls these "milestone sprouts": dated, content-free, one
// per shipped deliverable. The twelve below were seeded as `feature`; retyping
// makes them one set with the deliverable.shipped events #55 will import.
export const MILESTONE_TYPE = "milestone" as const;

// The twelve changelog sprouts, and the bean each one actually advances.
// Four assignments are named in spec 2026-09-02 §9.2; three were judgement
// calls, decided domain-first (spec 2026-09-04 §4). Slugs are NOT renamed: the
// webapp-/ios- prefix records which surface shipped it, which is the fact a
// milestone ledger wants.
export const SPROUT_MAP: Record<string, string> = {
  "pbbls-webapp-core": "pbbls-path-nav",
  "pbbls-webapp-color": "pbbls-colour",
  "pbbls-webapp-record-flow": "pbbls-record-flow",
  "pbbls-webapp-emotion-pearl": "pbbls-valence",
  "pbbls-webapp-pwa": "pbbls-web-shell",
  "pbbls-webapp-karma": "pbbls-wallet",
  "pbbls-ios-core": "pbbls-ios-jump",
  "pbbls-ios-record-flow": "pbbls-record-flow",
  "pbbls-ios-profile": "pbbls-ios-jump",
  "pbbls-ios-pebble-detail": "pbbls-path-nav",
  "pbbls-ios-pebble-render": "pbbls-render",
  "pbbls-ios-emotion-colored-pebbles": "pbbls-colour",
};

// The 36 beans of spec 2026-09-02 §5.3 that do not exist yet, seeded PRIVATE so
// every ref in payloads/_SLUGS.md resolves and no writing agent has to link a
// bean that renders as a hole. Names and descriptions are PLACEHOLDERS: when a
// bean is authored, delete its entry from data/garden.yml (see the comment
// there) so the next migrate cannot revert the real title.
export const STUB_BEANS: Bean[] = [
  // pod:pbbls-web
  { slug: "pbbls-web-shell", name: "The Web Shell", parents: ["pod:pbbls-web"], visibility: "private", description: "The PWA that stopped pretending to be offline." },
  { slug: "pbbls-polaroid-wall", name: "The Polaroid Wall", parents: ["pod:pbbls-web"], visibility: "private", description: "The Path as a wall of polaroids, dealt round-robin rather than height-balanced." },
  // pod:pbbls-ios
  { slug: "pbbls-ios-jump", name: "The Jump to SwiftUI", parents: ["pod:pbbls-ios"], visibility: "private", description: "Web to native, and the TestFlight builds that settled whether Pebbles was an app." },
  { slug: "pbbls-ios-two-composers", name: "Two Composers", parents: ["pod:pbbls-ios"], visibility: "private", description: "Why two ways of writing a pebble coexist on purpose." },
  { slug: "pbbls-ios-live-activity", name: "The Live Activity", parents: ["pod:pbbls-ios"], visibility: "private", description: "The Live Activity that device evidence killed, and the widget target left behind." },
  // pod:pbbls-android
  { slug: "pbbls-android-six-days", name: "Six Days to Parity", parents: ["pod:pbbls-android"], visibility: "private", description: "Bootstrap to parity in six days, across nine milestones." },
  { slug: "pbbls-android-parity-audit", name: "The Parity Audit", parents: ["pod:pbbls-android"], visibility: "private", description: "The July audit that counted what was still missing, and found three defects in shipped code." },
  { slug: "pbbls-android-divergence", name: "Deliberate Divergence", parents: ["pod:pbbls-android"], visibility: "private", description: "Duplicated draft glue, kept on purpose, with the debt named and enforceable." },
  // pod:pbbls-backstage
  { slug: "pbbls-analytics", name: "Analytics", parents: ["pod:pbbls-backstage"], visibility: "private", description: "Measuring the product without making the numbers the point." },
  { slug: "pbbls-moderation", name: "The Glyph Queue", parents: ["pod:pbbls-backstage"], visibility: "private", description: "Human review of submitted glyphs, and the read that exists because the market policy would not be weakened." },
  { slug: "pbbls-lab", name: "The Lab", parents: ["pod:pbbls-backstage"], visibility: "private", description: "The in-app changelog, prefilled from the clipboard." },
  // pod:pbbls-record
  { slug: "pbbls-record-flow", name: "The Recording Flow", parents: ["pod:pbbls-record"], visibility: "private", description: "Fifteen steps, then seconds, then two composers." },
  { slug: "pbbls-cards", name: "The Cards", parents: ["pod:pbbls-record"], visibility: "private", description: "Beck, hidden in plain sight." },
  { slug: "pbbls-drafts", name: "Drafts", parents: ["pod:pbbls-record"], visibility: "private", description: "Keeping the half-formed thoughts — a table of its own, never a status column." },
  // pod:pbbls-pebble
  { slug: "pbbls-valence", name: "Valence", parents: ["pod:pbbls-pebble"], visibility: "private", description: "How a memory became a shape." },
  { slug: "pbbls-wobble", name: "The Wobble", parents: ["pod:pbbls-pebble"], visibility: "private", description: "The petroglyph wobble, computed at runtime on the device." },
  { slug: "pbbls-glyph-carving", name: "Carving a Glyph", parents: ["pod:pbbls-pebble"], visibility: "private", description: "How a symbol gets drawn by hand, submitted, and accepted." },
  { slug: "pbbls-render", name: "The Render Engine", parents: ["pod:pbbls-pebble"], visibility: "private", description: "Compose once on the server, parse everywhere." },
  { slug: "pbbls-colour", name: "Colour", parents: ["pod:pbbls-pebble"], visibility: "private", description: "Emotion categories, palettes, and per-surface tinting." },
  // pod:pbbls-path
  { slug: "pbbls-path-nav", name: "The Path", parents: ["pod:pbbls-path"], visibility: "private", description: "Neither a list, nor a thread, nor stories." },
  { slug: "pbbls-collections", name: "Collections", parents: ["pod:pbbls-path"], visibility: "private", description: "Stack, Pack and Track — three ways of gathering pebbles." },
  // pod:pbbls-karma
  { slug: "pbbls-reward-not-prison", name: "Reward, Not Prison", parents: ["pod:pbbls-karma"], visibility: "private", description: "An economy that rewards recording without ever becoming a streak to protect." },
  { slug: "pbbls-badges", name: "Badges", parents: ["pod:pbbls-karma"], visibility: "private", description: "Achievements — idempotent, permanent, and paid at unlock." },
  // pod:pbbls-souls
  { slug: "pbbls-souls-not-users", name: "Souls, Not Users", parents: ["pod:pbbls-souls"], visibility: "private", description: "Why the people in someone's pebbles are called souls." },
  { slug: "pbbls-domains-greek", name: "The Greek Domains", parents: ["pod:pbbls-souls"], visibility: "private", description: "Five Greek domains seeded, and the eighteen plain-English ones entered four days later." },
  { slug: "pbbls-emotions", name: "The Emotion Model", parents: ["pod:pbbls-souls"], visibility: "private", description: "The emotion model as it actually shipped." },
  // pod:pbbls-public
  { slug: "pbbls-profiles-handles", name: "Handles", parents: ["pod:pbbls-public"], visibility: "private", description: "A handle is a pointer, not an archive." },
  { slug: "pbbls-sharing", name: "Sharing", parents: ["pod:pbbls-public"], visibility: "private", description: "What a share link exposes — one row, and nothing else." },
  { slug: "pbbls-privacy-grades", name: "Privacy Grades", parents: ["pod:pbbls-public"], visibility: "private", description: "Secret and private, as connections-visible and shared." },
  { slug: "pbbls-deletion-consent", name: "Deletion & Consent", parents: ["pod:pbbls-public"], visibility: "private", description: "Anonymising rather than destroying, so what someone bought keeps rendering." },
  // pod:pbbls-atelier
  { slug: "pbbls-naming", name: "Nomen Omen", parents: ["pod:pbbls-atelier"], visibility: "private", description: "How Pebbles got its name." },
  { slug: "pbbls-pivot", name: "The Pivot", parents: ["pod:pbbls-atelier"], visibility: "private", description: "From Beck's columns to a pebble." },
  { slug: "pbbls-psychology", name: "The Psychology", parents: ["pod:pbbls-atelier"], visibility: "private", description: "Beck, Barrett, Maslow, Kahneman, Clear, Lembke, SDT." },
  { slug: "pbbls-agentic", name: "The Agentic Method", parents: ["pod:pbbls-atelier"], visibility: "private", description: "One author, and the co-author trailers on most of the commits." },
  { slug: "pbbls-arkaik", name: "Arkaik", parents: ["pod:pbbls-atelier"], visibility: "private", description: "Sixty-seven nodes to four hundred and sixty — the map that updates itself." },
  { slug: "pbbls-harnesses", name: "The Harnesses", parents: ["pod:pbbls-atelier"], visibility: "private", description: "Proof rather than simulation — the audit programme, and the contract harnesses that became a merge gate." },
];

const legacy = new Set<string>(LEGACY_BEANS);

/**
 * Retires the legacy beans, seeds the missing stubs, and files the twelve
 * changelog sprouts under the beans they advance.
 *
 * Two rules, both about not destroying authored work:
 *  - a stub is only ever ADDED; a slug that already exists is skipped whole, so
 *    the catalog can never overwrite a name or a description;
 *  - a sprout moves only if SPROUT_MAP names it. Nothing is inferred from a
 *    slug prefix.
 *
 * Idempotent: f(f(x)) deep-equals f(x), which is what lets one set of
 * assertions cover both the pre- and post-migration garden.
 */
export function retireLegacyBeans(raw: RawGarden): RawGarden {
  const inBeans = raw.beans ?? [];
  const kept = inBeans.filter((b) => !legacy.has(b.slug));
  // `present` is derived from the SURVIVORS, not from the input: a slug that is
  // both retired and stubbed must come back as the stub in one pass, not vanish
  // on the first run and reappear on the second.
  const present = new Set(kept.map((b) => b.slug));

  const beans = [
    ...kept,
    ...STUB_BEANS.filter((b) => !present.has(b.slug)).map((b) => structuredClone(b)),
  ];

  const sprouts = (raw.sprouts ?? []).map((s) => {
    // Own properties only: every slug is a legal key, and a sprout slugged
    // `constructor` would otherwise inherit Object.prototype and re-parent onto
    // a ref built from a function source.
    if (!Object.hasOwn(SPROUT_MAP, s.slug)) return s;
    const target = SPROUT_MAP[s.slug];
    // The parents array is REPLACED, not appended to: these twelve are seeded
    // changelog sprouts with exactly one parent, and the whole point is to move
    // them off the bean that retires. A second parent would be dropped — which
    // is why the move is by explicit catalog entry and never by slug prefix.
    const parents = [`bean:${target}`];
    if (s.type === MILESTONE_TYPE && JSON.stringify(s.parents) === JSON.stringify(parents)) return s;
    return { ...s, parents, type: MILESTONE_TYPE };
  });

  // Spread raw first so unknown top-level keys pass through untouched.
  return { ...raw, beans, sprouts };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test 2>&1 | tail -20
```

Expected: PASS — all `pbbls-legacy` tests green, and the rest of the suite unchanged.

If `the catalogs are disjoint and cover every bean in _SLUGS.md` fails, the diff it prints names the drift: a slug in `_SLUGS.md` with no catalog entry, or vice versa. Fix the catalog, not the assertion.

- [ ] **Step 5: Commit**

```bash
git add lib/pbbls-legacy.ts lib/pbbls-legacy.test.ts
git commit -m "feat: the legacy pbbls bean retirement transform and its catalogs"
```

---

## Task 2: `data/garden.yml`

**Files:**
- Modify: `data/garden.yml`
- Test: `lib/pbbls-legacy.test.ts` (append)

The transform is the oracle; this task makes the file agree with it. **The edit is by hand and the script never touches this file** — `yaml.dump` erases comments, and `garden.yml` carries nine that are load-bearing.

- [ ] **Step 1: Write the failing conformance tests**

In `lib/pbbls-legacy.test.ts`, extend the import block at the top of the file:

```ts
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
```

Then append to the end of the file:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test 2>&1 | grep -A 4 "not ok" | head -40
```

Expected: FAIL — `data/garden.yml is already a fixed point…` and the three that follow it. `data/garden.yml never seeds a bean that is already authored in Mongo` should already PASS (the seed has never held those six).

- [ ] **Step 3a: Delete the four legacy bean entries**

In `data/garden.yml`, find this contiguous 16-line run inside `beans:` (it sits between `rom-damned-thoughts` and the `# Slice 5 — digest containers` comment) and **delete all of it**:

```yaml
  - slug: pbbls-webapp
    name: Pebbles Webapp
    parents:
      - plant:pbbls
  - slug: pbbls-ios
    name: Pebbles iOS
    parents:
      - plant:pbbls
  - slug: pbbls-path
    name: Pebbles Path
    parents:
      - plant:pbbls
  - slug: pbbls-recorder
    name: Pebbles Recorder
    parents:
      - plant:pbbls
```

- [ ] **Step 3b: Re-parent and retype the twelve sprouts**

Still in `data/garden.yml`, inside `sprouts:`, the twelve entries run from `- slug: pbbls-webapp-core` to `- slug: pbbls-ios-emotion-colored-pebbles`. For **each** of them make exactly two line edits — `type: feature` → `type: milestone`, and the single `- bean:…` line under `parents:` → the mapped bean:

| Sprout `slug:` | `parents:` line becomes |
|---|---|
| `pbbls-webapp-core` | `      - bean:pbbls-path-nav` |
| `pbbls-webapp-color` | `      - bean:pbbls-colour` |
| `pbbls-webapp-record-flow` | `      - bean:pbbls-record-flow` |
| `pbbls-webapp-emotion-pearl` | `      - bean:pbbls-valence` |
| `pbbls-webapp-pwa` | `      - bean:pbbls-web-shell` |
| `pbbls-webapp-karma` | `      - bean:pbbls-wallet` |
| `pbbls-ios-core` | `      - bean:pbbls-ios-jump` |
| `pbbls-ios-record-flow` | `      - bean:pbbls-record-flow` |
| `pbbls-ios-profile` | `      - bean:pbbls-ios-jump` |
| `pbbls-ios-pebble-detail` | `      - bean:pbbls-path-nav` |
| `pbbls-ios-pebble-render` | `      - bean:pbbls-render` |
| `pbbls-ios-emotion-colored-pebbles` | `      - bean:pbbls-colour` |

That is 24 changed lines and nothing else — `name`, `date` and `description` are untouched.

Sanity check before moving on:

```bash
grep -c "type: milestone" data/garden.yml
```

Expected: `12`

- [ ] **Step 3c: Append the stub block**

The 36 stubs are already committed as `STUB_BEANS` in `lib/pbbls-legacy.ts`, so **generate the YAML from that catalog rather than retyping it** — the fixed-point test in Step 4 is what proves the splice landed correctly.

```bash
node --import tsx -e '
import { STUB_BEANS } from "./lib/pbbls-legacy.ts";
import yaml from "js-yaml";
process.stdout.write(
  STUB_BEANS.map((b) =>
    yaml.dump([b], { lineWidth: 100 }).split("\n").filter(Boolean).map((l) => "  " + l).join("\n"),
  ).join("\n") + "\n",
);
' > /tmp/stub-block.yml
head -12 /tmp/stub-block.yml
```

Expected first twelve lines:

```yaml
  - slug: pbbls-web-shell
    name: The Web Shell
    parents:
      - pod:pbbls-web
    visibility: private
    description: The PWA that stopped pretending to be offline.
  - slug: pbbls-polaroid-wall
    name: The Polaroid Wall
    parents:
      - pod:pbbls-web
    visibility: private
    description: The Path as a wall of polaroids, dealt round-robin rather than height-balanced.
```

Now insert into `data/garden.yml`, immediately **before** the `sprouts:` line (i.e. at the very end of the `beans:` list, after the `weekly-wrap` entry), first this comment block:

```yaml
  # Pebbles case-study bean tier (spec 2026-09-04-pbbls-legacy-bean-retirement, #54).
  # PLACEHOLDER names and descriptions, seeded private so every ref in
  # payloads/_SLUGS.md resolves instead of rendering as a hole mid-sentence.
  # migrate $sets name and description on EVERY run, so the day a bean is
  # authored through the admin, DELETE ITS ENTRY HERE -- or the next migrate
  # reverts the real title to the placeholder. The six already authored
  # (wallet, market, d8, connections, cut, unbuilt) are absent for that reason.
```

then the whole contents of `/tmp/stub-block.yml`. Order matters: the stubs must be in `STUB_BEANS` order and at the end of the list, or the fixed-point test fails on array ordering.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test 2>&1 | tail -20
```

Expected: PASS, whole suite. In particular `data/garden.yml is already a fixed point of retireLegacyBeans` — if that one fails, the diff it prints points straight at the drift (a mis-ordered stub, a missed sprout, a typo in a description).

Also confirm the shape:

```bash
node --import tsx -e '
import { readFileSync } from "node:fs";
import yaml from "js-yaml";
const g = yaml.load(readFileSync("data/garden.yml", "utf8"), { schema: yaml.CORE_SCHEMA });
console.log(g.beans.length, "beans,", g.sprouts.length, "sprouts,", g.pods.length, "pods");
'
```

Expected: `59 beans, 39 sprouts, 14 pods` (27 beans − 4 legacy + 36 stubs).

- [ ] **Step 5: Commit**

```bash
git add data/garden.yml lib/pbbls-legacy.test.ts
git commit -m "chore: retire the legacy pbbls beans and seed the bean tier in garden.yml"
```

---

## Task 3: The migration script

**Files:**
- Create: `scripts/migrate-pbbls-legacy.ts`
- Modify: `package.json`

No new tests: the transform this script applies is already covered, and the script itself is I/O over the same catalogs. Its safety comes from `--dry-run` and from the abort guard in step 3.

- [ ] **Step 1: Write the script**

Create `scripts/migrate-pbbls-legacy.ts`:

```ts
// One-shot (#54): retires the four seeded pbbls beans, files their twelve
// changelog sprouts under the beans they advance, and seeds the 36 missing
// bean stubs. Catalogs and rules live in lib/pbbls-legacy.ts.
// Usage: npm run migrate:pbbls-legacy [-- --dry-run]
// Operator sequence: dry-run, read the plan, run for real, dry-run again
// expecting all no-ops, then commit the backup file it wrote.
//
// Unlike scripts/migrate-retier.ts this NEVER writes data/garden.yml. That
// script ends in yaml.dump, which erases comments; garden.yml's comments are
// load-bearing and one of them is the warning this work adds. The YAML half is
// a hand edit, proven correct by lib/pbbls-legacy.test.ts.
//
// Idempotent: stubs are $setOnInsert, sprout writes are diffed per doc, and the
// delete is a no-op once the beans are gone.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDb, closeDb } from "../lib/db";
import { LEGACY_BEANS, MILESTONE_TYPE, SPROUT_MAP, STUB_BEANS } from "../lib/pbbls-legacy";
import type { Bean, Sprout } from "../lib/data";

const DRY = process.argv.includes("--dry-run");
const p = () => (DRY ? "[dry] " : "");
const BACKUP_DIR = join(process.cwd(), "data", "retired");
const BACKUP = join(BACKUP_DIR, "2026-09-04-legacy-pbbls-beans.json");

async function main() {
  const db = await getDb();
  const beansCol = db.collection<Bean>("beans");
  const sproutsCol = db.collection<Sprout>("sprouts");

  // 1) Stubs FIRST — step 2 re-parents sprouts onto them, so they must exist
  //    before anything points at them.
  let inserted = 0;
  for (const stub of STUB_BEANS) {
    const existing = await beansCol.findOne({ slug: stub.slug }, { projection: { _id: 0, slug: 1 } });
    if (existing) {
      console.log(`${p()}bean ${stub.slug} already present — untouched`);
      continue;
    }
    console.log(`${p()}insert stub bean ${stub.slug}`);
    inserted++;
    // $setOnInsert, belt to lib/pbbls-legacy.ts's braces: even if the guard
    // above were wrong, an existing authored bean could not be overwritten.
    if (!DRY) {
      await beansCol.updateOne({ slug: stub.slug }, { $setOnInsert: { ...stub } }, { upsert: true });
    }
  }

  // 2) Re-parent and retype the twelve, diffed so a re-run logs nothing.
  let moved = 0;
  for (const [slug, bean] of Object.entries(SPROUT_MAP)) {
    const doc = await sproutsCol.findOne({ slug }, { projection: { _id: 0, parents: 1, type: 1 } });
    if (!doc) {
      console.warn(`${p()}WARN sprout ${slug} not found in Mongo — skipped`);
      continue;
    }
    const parents = [`bean:${bean}`];
    if (doc.type === MILESTONE_TYPE && JSON.stringify(doc.parents) === JSON.stringify(parents)) continue;
    console.log(`${p()}re-parent sprout ${slug} -> bean:${bean}, type ${MILESTONE_TYPE}`);
    moved++;
    if (!DRY) await sproutsCol.updateOne({ slug }, { $set: { parents, type: MILESTONE_TYPE } });
  }

  // 3) Back up, then delete. LAST, when nothing points at them any more.
  const legacyRefs = LEGACY_BEANS.map((s) => `bean:${s}`);
  const stillHeld = await sproutsCol.countDocuments({ parents: { $in: legacyRefs } });
  if (stillHeld > 0) {
    throw new Error(
      `${stillHeld} sprout(s) still parented to a legacy bean — aborting before the delete. ` +
        `Re-run without --dry-run to move them first, or extend SPROUT_MAP.`,
    );
  }

  const doomed = await beansCol.find({ slug: { $in: [...LEGACY_BEANS] } }, { projection: { _id: 0 } }).toArray();
  if (doomed.length === 0) {
    console.log(`${p()}no legacy bean left to delete`);
  } else {
    // Written even on a dry run: it is a read of the DB, and the operator
    // should be able to read the backup BEFORE authorising the delete. Guarded
    // by the length check above so a re-run cannot clobber it with [].
    mkdirSync(BACKUP_DIR, { recursive: true });
    writeFileSync(BACKUP, JSON.stringify(doomed, null, 2) + "\n", "utf8");
    console.log(`${p()}backed up ${doomed.length} bean(s) to ${BACKUP}`);
    for (const b of doomed) console.log(`${p()}delete bean ${b.slug}`);
    if (!DRY) await beansCol.deleteMany({ slug: { $in: [...LEGACY_BEANS] } });
  }

  console.log(
    `${p()}done — ${inserted} stub(s) inserted, ${moved} sprout(s) refiled, ${doomed.length} bean(s) retired.`,
  );
  await closeDb();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

- [ ] **Step 2: Register the npm script**

In `package.json`, add the line after `"migrate:retier"`:

```json
    "migrate:pbbls-legacy": "node --env-file=.env.local --import tsx scripts/migrate-pbbls-legacy.ts",
```

- [ ] **Step 3: Verify it compiles and the suite is still green**

```bash
npx tsc --noEmit -p tsconfig.json && npm test 2>&1 | tail -5
```

Expected: no type errors, suite PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-pbbls-legacy.ts package.json
git commit -m "feat: one-shot migration retiring the legacy pbbls beans"
```

---

## Task 4: Run the migration

**Files:**
- Create (generated): `data/retired/2026-09-04-legacy-pbbls-beans.json`

Needs `MONGODB_URI` and `MONGODB_DB` in `.env.local` and the cluster reachable.

- [ ] **Step 1: Dry run, and read the plan it prints**

```bash
npm run migrate:pbbls-legacy -- --dry-run
```

Expected, in this order:
- `[dry] insert stub bean …` × **36**
- `[dry] re-parent sprout … -> bean:…, type milestone` × **12**
- `[dry] backed up 4 bean(s) to …/data/retired/2026-09-04-legacy-pbbls-beans.json`
- `[dry] delete bean pbbls-webapp` / `pbbls-ios` / `pbbls-path` / `pbbls-recorder`
- `[dry] done — 36 stub(s) inserted, 12 sprout(s) refiled, 4 bean(s) retired.`

If any `WARN sprout … not found` appears, **stop** — the seed and Mongo have diverged and `SPROUT_MAP` needs checking before anything is deleted.

- [ ] **Step 2: Read the backup the dry run wrote**

```bash
cat data/retired/2026-09-04-legacy-pbbls-beans.json
```

Expected: four objects, each with `slug`, `name`, `parents: ["plant:pbbls"]`, `visibility: "public"`. This is the reversal path — confirm it is not empty before running for real.

- [ ] **Step 3: Run for real**

```bash
npm run migrate:pbbls-legacy
```

Expected: the same lines without the `[dry]` prefix.

- [ ] **Step 4: Dry run again — everything must be a no-op**

```bash
npm run migrate:pbbls-legacy -- --dry-run
```

Expected:
- `[dry] bean … already present — untouched` × **36**
- no `re-parent sprout` lines at all
- `[dry] no legacy bean left to delete`
- `[dry] done — 0 stub(s) inserted, 0 sprout(s) refiled, 0 bean(s) retired.`

- [ ] **Step 5: Verify the live state directly**

```bash
node --env-file=.env.local --import tsx -e '
import { getDb, closeDb } from "./lib/db.ts";
const db = await getDb();
const legacy = await db.collection("beans").countDocuments({ slug: { $in: ["pbbls-webapp","pbbls-ios","pbbls-path","pbbls-recorder"] } });
const beans = await db.collection("beans").countDocuments({ slug: /^pbbls/ });
const pub = await db.collection("beans").countDocuments({ slug: /^pbbls/, visibility: "public" });
const ms = await db.collection("sprouts").countDocuments({ slug: /^pbbls/, type: "milestone" });
const orphans = await db.collection("sprouts").countDocuments({ parents: { $in: ["bean:pbbls-webapp","bean:pbbls-ios","bean:pbbls-path","bean:pbbls-recorder"] } });
console.log({ legacy, beans, pub, ms, orphans });
await closeDb();
'
```

Expected: `{ legacy: 0, beans: 42, pub: 0, ms: 12, orphans: 0 }` — no legacy bean, the full 42-bean map present, none of them public, the twelve retyped, nothing orphaned.

- [ ] **Step 6: Commit the backup**

```bash
git add data/retired/2026-09-04-legacy-pbbls-beans.json
git commit -m "chore: back up the retired legacy pbbls beans"
```

A deletion whose backup is not committed is a deletion. This file is the whole reversal path.

---

## Task 5: Documentation

**Files:**
- Modify: `docs/pbbls-atelier-editorial/payloads/_SLUGS.md`
- Modify: `docs/superpowers/specs/2026-09-02-pbbls-case-study-design.md`
- Modify: `README.md`

- [ ] **Step 1: `_SLUGS.md` — the writers' reference**

Replace the whole `## Notes` section at the bottom of the file. Delete this:

```markdown
- `bean:pbbls-agentic` is specified but its first draft was **rejected and binned**.
  Link to it only if the subject genuinely belongs there.
- Legacy seeded beans `bean:pbbls-webapp` and `bean:pbbls-ios` still exist in the
  garden and are scheduled to retire (spec §9.2). **Never link to either** — and
  note `bean:pbbls-ios` is NOT the iOS pod, which is `pod:pbbls-ios`.
```

and write this in its place:

```markdown
- **All 42 beans exist, so every ref on this page resolves.** Six carry their
  authored titles; the other 36 are private stubs. Linking a stub is correct —
  it renders a card, not a hole.
- **A stub's title is a placeholder, not a decision.** The names in the admin
  picker for the 36 unwritten beans were generated from the spec's subject
  column to keep cards from being nameless. Do not treat one as a brief: the
  bean's real title is chosen when its piece is written. The subject that
  governs is spec §5.3's, not the placeholder's.
- `bean:pbbls-agentic` is specified but its first draft was **rejected and binned**.
  Link to it only if the subject genuinely belongs there.
- The four legacy seeded beans — `pbbls-webapp`, `pbbls-ios`, `pbbls-path`,
  `pbbls-recorder` — were **deleted on 2026-09-04** (#54). `pbbls-ios` and
  `pbbls-path` used to slug-shadow the pods of the same name; they are gone, so
  `pod:pbbls-ios` and `pod:pbbls-path` are now unambiguous.
```

Also, in the `## Beans` heading area, add the count so the file states its own size — change:

```markdown
## Beans
```

to:

```markdown
## Beans — 42
```

- [ ] **Step 2: Parent spec §5.3 — the wrong total**

In `docs/superpowers/specs/2026-09-02-pbbls-case-study-design.md`, find:

```markdown
Total: 11 pods, 35 beans. 5 tier-A, 20 tier-B, 10 tier-C.
```

Replace with:

```markdown
Total: 11 pods, **42 beans. 7 tier-A, 23 tier-B, 12 tier-C** — corrected
2026-09-04 (#54) by counting the tables above; the previous "35 beans, 5/20/10"
never matched them. §10's "five tier-A pieces" is still right: it describes
wave 1, which does not include the two ledger beans of §5.3b.
```

- [ ] **Step 3: Parent spec §9.2 — mark it done**

Replace the body of `### 9.2 The legacy bean migration` (the two paragraphs beginning `bean:pbbls-webapp` and `Opportunity while there:`) with:

```markdown
**Done, 2026-09-04 (#54).** Spec:
`docs/superpowers/specs/2026-09-04-pbbls-legacy-bean-retirement-design.md`.

Two things this section got wrong, found while surveying:

- **Four beans, not two.** `bean:pbbls-path` and `bean:pbbls-recorder` were
  public with nothing in them, rendering as empty pages on the live site.
- **Two slug shadows, not one.** `bean:pbbls-path` shadowed `pod:pbbls-path`
  exactly as `bean:pbbls-ios` shadowed `pod:pbbls-ios`.

All four were deleted (backed up to `data/retired/`), the twelve changelog
sprouts were refiled as `type: milestone` under the beans they advance, and the
36 beans of §5.3 that did not exist yet were seeded as private stubs so every
ref in `payloads/_SLUGS.md` resolves.

Consequence, accepted at the time: `plant:pbbls` is public and carries no
narrative, so those four beans were its entire public content. `/plant/pbbls` is
deliberately empty until the case study publishes.

Still open: only 12 of the pbbls changelog's 47 entries were ever imported. The
remaining 35, plus 217 `deliverable.shipped` journal events, are a ready-made
milestone ledger — #55.
```

- [ ] **Step 4: `README.md`**

In the `## Database & development` list, add after the `npm run migrate` bullet:

```markdown
* `npm run migrate:pbbls-legacy` — one-shot (#54), idempotent and safe to re-run: retired the four seeded `pbbls-*` beans (backed up to `data/retired/`), refiled their twelve changelog sprouts as milestones, and seeded the case study's bean tier private. Takes `-- --dry-run`. Deliberately does **not** rewrite `data/garden.yml` — `yaml.dump` would erase the file's comments, so that half is a hand edit held in place by `lib/pbbls-legacy.test.ts`.
```

- [ ] **Step 5: Verify the docs still agree with the catalogs**

The `_SLUGS.md` edit is load-bearing: one test parses that file.

```bash
npm test 2>&1 | tail -5
```

Expected: PASS. If `the catalogs are disjoint and cover every bean in _SLUGS.md` fails, a bean ref was lost or mistyped in Step 1.

- [ ] **Step 6: Commit**

```bash
git add docs/pbbls-atelier-editorial/payloads/_SLUGS.md docs/superpowers/specs/2026-09-02-pbbls-case-study-design.md README.md
git commit -m "docs: the pbbls bean map is real, and its total was wrong"
```

---

## Task 6: Open the PR

- [ ] **Step 1: Final check**

```bash
npm test 2>&1 | tail -5 && npx tsc --noEmit -p tsconfig.json && git status --short
```

Expected: suite PASS, no type errors, and a clean tree apart from any file that was already dirty before this work began (`docs/pbbls-atelier-editorial/04-voice-charter-en.md` and the case-study spec were modified on `main` before this branch — **do not commit them**).

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin issue-54-retire-legacy-pbbls-beans
gh pr create --title "Retire the legacy Pebbles beans and seed the bean tier" --body "$(cat <<'BODY'
Closes #54.

Deletes the four seeded `pbbls-*` beans, refiles their twelve changelog sprouts
onto the beans the case study actually uses, and seeds the 36 missing beans of
spec §5.3 as private stubs so every ref in `_SLUGS.md` resolves.

Two corrections to the record, found while surveying:

- **Two slug shadows, not one.** `bean:pbbls-path` shadowed `pod:pbbls-path`
  exactly as `bean:pbbls-ios` shadowed `pod:pbbls-ios`. §9.2 named only the
  latter.
- **42 beans, not 35.** §5.3's closing total never matched its own tables, and
  #56's "remaining 27 beans" inherits the undercount.

**One visible change, accepted deliberately.** `plant:pbbls` is public and has no
narrative, so those four beans and twelve sprouts were its entire public content.
`/plant/pbbls` is empty until the case study publishes — better than four thin
pages, two of which were literally blank.

**How it is safe.** One pure idempotent transform (`lib/pbbls-legacy.ts`) is the
single definition of "migrated". The script applies it to Mongo behind
`--dry-run` and backs the deleted beans up to `data/retired/` before removing
them. It deliberately does *not* rewrite `data/garden.yml` — `yaml.dump` erases
comments, and the file's comments are load-bearing — so that half is a hand edit,
held in place by a test asserting the seed is already a fixed point of the
transform.

Stub titles are placeholders, flagged as such in `_SLUGS.md` so no writing agent
mistakes one for a brief.

No Lab Note: structural work, and the one visitor-facing effect is the removal of
four thin pages.
BODY
)"
```

- [ ] **Step 3: Add the `no-lab-note` label if the reminder comments**

```bash
gh pr edit --add-label no-lab-note
```
