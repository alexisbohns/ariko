# Pollen — Federation Envelope + Contract (Slice 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the pollen contract — the normative `docs/POLLEN.md`, a dependency-free reference validator (`lib/pollen.ts`), a cross-repo conformance fixture suite (`data/pollen/`), and a `--validate`-style CLI — so slices 3+ implement one envelope instead of inventing shapes.

**Architecture:** Pure boundary guards in the `lib/inbox.ts` house style (hand-rolled, no schema library, `{ok,value}|{ok,error}` results — extended with a `warnings` channel for non-core kinds). The shared B1 `Text` normalization is extracted from `lib/inbox.ts` into `lib/text-input.ts` so both doors enforce the identical shape. Fixtures are data-driven tests: adding a fixture *is* adding a test, and sibling repos copy `data/pollen/` to conformance-test their adapters. Nothing in this slice touches Mongo, the network, or the garden.

**Tech Stack:** TypeScript 5.7, `node --test` + tsx, zero new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-15-pollen-federation-contract-design.md` (child of the umbrella spec §10.2)

**Verification commands** (repo root, both must pass at every commit):
- Typecheck: `npx tsc --noEmit`
- Tests: `npm test`

**Branch:** work continues on `spec/pollen-contract` (spec already committed there); rename or re-branch to `feat/pollen-contract` at PR time if preferred.

---

## File structure

| File | Change |
|---|---|
| `lib/text-input.ts` | **Create** — `isObject`, `nonEmptyString`, `normalizeTextInput` extracted verbatim from `lib/inbox.ts` |
| `lib/inbox.ts` | **Modify** — drop the four moved helpers, import from `./text-input`; zero behavior change |
| `lib/pollen.ts` | **Create** — types, constants, `validatePollen`, `validateIntent`, `validateFeed` |
| `lib/pollen.test.ts` | **Create** — unit tests (field-by-field rejection, warning channel, feed lines) |
| `lib/pollen-fixtures.test.ts` | **Create** — data-driven conformance tests over `data/pollen/` |
| `data/pollen/valid/*.json`, `data/pollen/valid/feed-sample.ndjson` | **Create** — nine valid envelopes + one intent + a feed file |
| `data/pollen/invalid/*.json`, `data/pollen/invalid/manifest.json` | **Create** — nine invalid envelopes paired with expected errors |
| `scripts/pollen-validate.ts` | **Create** — CLI dry-run for feed files / single envelopes |
| `package.json` | **Modify** — add `pollen:validate` script |
| `docs/POLLEN.md` | **Create** — the normative contract document, v1 |
| `README.md` | **Modify** — add a `## Pollen` section pointing at the contract |

---

### Task 1: Extract shared text-input helpers

Pure refactor — `lib/inbox.ts` currently owns `isObject`, `nonEmptyString`, `textPartInput`, `normalizeTextInput` (lines 27–59). Pollen needs the same B1 `Text` boundary shape; move them to a shared module instead of duplicating. Existing inbox tests are the safety net; no new tests needed.

**Files:**
- Create: `lib/text-input.ts`
- Modify: `lib/inbox.ts`

- [ ] **Step 1: Create `lib/text-input.ts` with the four helpers moved verbatim**

```ts
// Shared boundary helpers for raw JSON payloads (inbox, pollen). Extracted
// from lib/inbox.ts so every door enforces the same B1 Text shape.

import type { Text } from "./data";

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function nonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

// One language part of an incoming Text: absent is fine, non-strings are junk,
// blank strings are dropped (mirrors composeText's blank-part behavior).
function textPartInput(v: unknown): { ok: boolean; part?: string } {
  if (v === undefined) return { ok: true };
  if (typeof v !== "string") return { ok: false };
  const t = v.trim();
  return t ? { ok: true, part: t } : { ok: true };
}

// The B1 Text shape at the payload boundary: a non-empty string, or { en?, fr? }
// with at least one non-empty part. Null means invalid.
export function normalizeTextInput(v: unknown): Text | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t ? t : null;
  }
  if (isObject(v)) {
    const en = textPartInput(v.en);
    const fr = textPartInput(v.fr);
    if (!en.ok || !fr.ok) return null;
    if (!en.part && !fr.part) return null;
    return { ...(en.part ? { en: en.part } : {}), ...(fr.part ? { fr: fr.part } : {}) };
  }
  return null;
}
```

- [ ] **Step 2: In `lib/inbox.ts`, delete the four function definitions (current lines 27–59) and add the import**

At the top, after the existing imports:

```ts
import { isObject, nonEmptyString, normalizeTextInput } from "./text-input";
```

Nothing else in the file changes.

- [ ] **Step 3: Verify zero behavior change**

Run: `npx tsc --noEmit && npm test`
Expected: both pass; inbox tests all green.

- [ ] **Step 4: Commit**

```bash
git add lib/text-input.ts lib/inbox.ts
git commit -m "refactor: extract shared text-input boundary helpers from inbox"
```

---

### Task 2: Pollen types, constants, and `validatePollen`

The core of the slice. TDD: write the test file first with the full rejection/acceptance matrix, watch it fail, then implement.

**Files:**
- Create: `lib/pollen.test.ts`
- Create: `lib/pollen.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/pollen.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { CORE_KINDS, POLLEN_VERSION, validatePollen } from "./pollen";

// A minimal valid envelope; individual tests break one field at a time.
function grain(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    v: 1,
    id: "arkaik:evt_857",
    at: "2026-08-10T18:12:00Z",
    source: "arkaik",
    kind: "shipped",
    title: "Lab-note webhook shipped",
    anchors: { plant: "plant:pbbls" },
    ...overrides,
  };
}

test("a minimal valid envelope passes with no warnings", () => {
  const r = validatePollen(grain());
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.warnings, []);
    assert.equal(r.value.id, "arkaik:evt_857");
    assert.equal(r.value.kind, "shipped");
  }
});

test("core vocabulary is exactly the umbrella's nine kinds", () => {
  assert.equal(POLLEN_VERSION, 1);
  assert.deepEqual([...CORE_KINDS].sort(), [
    "decided", "drafted", "milestone", "published", "release.tagged",
    "review.requested", "shipped", "task.done", "task.opened",
  ]);
});

test("field-by-field rejections carry clear, field-named errors", () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ v: undefined }, "v must be 1"],
    [{ v: 0 }, "v must be 1"],
    [{ v: 2 }, "newer than this validator"],
    [{ id: "" }, "id is required"],
    [{ id: undefined }, "id is required"],
    [{ at: "2026-08-10" }, "ISO 8601"],
    [{ at: "2026-08-10T18:12:00" }, "ISO 8601"], // timezone required
    [{ at: "not-a-date" }, "ISO 8601"],
    [{ source: "Arkaik" }, "source must be a lowercase slug"],
    [{ source: undefined }, "source must be a lowercase slug"],
    [{ kind: undefined }, "kind is required"],
    [{ kind: "Shipped" }, "kind must be lowercase dotted words"],
    [{ kind: "shipped." }, "kind must be lowercase dotted words"],
    [{ kind: "a".repeat(65) }, "kind must be lowercase dotted words"],
    [{ title: "" }, "title is required"],
    [{ title: { en: "" } }, "title is required"],
    [{ anchors: undefined }, "anchors.plant is required"],
    [{ anchors: {} }, "anchors.plant is required"],
    [{ anchors: { plant: "pbbls" } }, 'anchors.plant must be a "plant:<slug>" ref'],
    [{ anchors: { plant: "plant:pbbls", pod: "journal" } }, 'anchors.pod must be a "pod:<slug>" ref'],
    [{ anchors: { plant: "plant:pbbls", bean: "pod:x" } }, 'anchors.bean must be a "bean:<slug>" ref'],
    [{ refs: [{ url: "https://x" }] }, "each ref requires a label"],
    [{ refs: [{ label: "pr" }] }, "requires url or ref"],
    [{ visibility: "hidden" }, 'visibility must be "public" or "private"'],
    [{ payload: "detail" }, "payload must be an object"],
  ];
  for (const [overrides, want] of cases) {
    const r = validatePollen(grain(overrides));
    assert.equal(r.ok, false, JSON.stringify(overrides));
    if (!r.ok) assert.ok(r.error.includes(want), `${JSON.stringify(overrides)}: got "${r.error}", want "${want}"`);
  }
});

test("non-object input is rejected", () => {
  for (const bad of [null, "grain", 7, ["x"]]) {
    const r = validatePollen(bad);
    assert.equal(r.ok, false);
  }
});

test("a non-core kind matching the grammar passes with exactly one warning", () => {
  const r = validatePollen(grain({ kind: "practiced" }));
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.warnings, ['kind "practiced" is not in the v1 core vocabulary']);
});

test("dotted extension kinds are accepted", () => {
  const r = validatePollen(grain({ kind: "task.progress" }));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.warnings.length, 1);
});

test("unknown top-level keys are ignored, not copied through", () => {
  const r = validatePollen(grain({ mood: "sunny" }));
  assert.equal(r.ok, true);
  if (r.ok) assert.ok(!("mood" in r.value));
});

test("bilingual title normalizes like the inbox boundary", () => {
  const r = validatePollen(grain({ title: { en: " Shipped ", fr: "" } }));
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value.title, { en: "Shipped" });
});

test("payload over 32 KiB serialized is rejected", () => {
  const r = validatePollen(grain({ payload: { blob: "x".repeat(33 * 1024) } }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.includes("32 KiB"));
});

test("full envelope round-trips all optional fields", () => {
  const r = validatePollen(grain({
    anchors: { plant: "plant:bohns-music", pod: "pod:celesta", bean: "bean:felina" },
    refs: [{ label: "album", url: "https://melogram.app/celesta", ref: "album_12" }],
    visibility: "private",
    payload: { plays: 1000 },
  }));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.value.anchors, { plant: "plant:bohns-music", pod: "pod:celesta", bean: "bean:felina" });
    assert.deepEqual(r.value.refs, [{ label: "album", url: "https://melogram.app/celesta", ref: "album_12" }]);
    assert.equal(r.value.visibility, "private");
    assert.deepEqual(r.value.payload, { plays: 1000 });
  }
});

test("timezone offsets other than Z are accepted", () => {
  const r = validatePollen(grain({ at: "2026-08-10T20:12:00.500+02:00" }));
  assert.equal(r.ok, true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './pollen'` (or equivalent tsx resolution error).

- [ ] **Step 3: Implement `lib/pollen.ts`**

```ts
import type { Text } from "./data";
import { isObject, nonEmptyString, normalizeTextInput } from "./text-input";

// The pollen contract, v1 — normative document: docs/POLLEN.md.
// Pure guards, no DB, no network; the same result idiom as lib/inbox.ts
// plus a warnings channel (non-core kinds are recorded, never refused —
// umbrella §11, no silent loss).

export const POLLEN_VERSION = 1;

// v1 core vocabulary — exactly the umbrella's nine (slice-2 spec §4).
export const CORE_KINDS = [
  "shipped",
  "release.tagged",
  "published",
  "drafted",
  "decided",
  "milestone",
  "task.opened",
  "review.requested",
  "task.done",
] as const;

// Provisional until slice 7 — the Intent shape is normative, this list is not.
export const INTENT_KINDS = ["research", "draft"] as const;

export const KIND_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/;
export const MAX_KIND_LENGTH = 64;
export const MAX_PAYLOAD_BYTES = 32 * 1024;

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
// Strict ISO 8601 with explicit timezone: seconds required, optional
// fraction, Z or ±hh:mm. `at` is when the event happened, source truth.
const AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export interface PollenAnchors {
  plant: string; // "plant:<slug>"
  pod?: string;  // "pod:<slug>"
  bean?: string; // "bean:<slug>"
}

export interface PollenRef {
  label: string;
  url?: string; // deep link
  ref?: string; // native id — at least one of url | ref
}

export interface Pollen {
  v: 1;
  id: string;
  at: string;
  source: string;
  kind: string;
  title: Text;
  anchors: PollenAnchors;
  refs?: PollenRef[];
  visibility?: "public" | "private";
  payload?: Record<string, unknown>;
}

export interface Intent {
  v: 1;
  id: string;
  at: string;
  target: string;
  kind: string;
  brief: Text;
  anchors?: PollenAnchors;
  refs?: PollenRef[];
}

export type PollenResult =
  | { ok: true; value: Pollen; warnings: string[] }
  | { ok: false; error: string };

export type IntentResult =
  | { ok: true; value: Intent; warnings: string[] }
  | { ok: false; error: string };

function checkV(v: unknown): string | null {
  if (v === POLLEN_VERSION) return null;
  if (typeof v === "number" && Number.isInteger(v) && v > POLLEN_VERSION) {
    return `v ${v} is newer than this validator (pollen v${POLLEN_VERSION})`;
  }
  return `v must be ${POLLEN_VERSION}`;
}

function checkAt(at: unknown): string | null {
  if (!nonEmptyString(at) || !AT_PATTERN.test(at) || Number.isNaN(Date.parse(at))) {
    return "at must be a strict ISO 8601 timestamp with timezone";
  }
  return null;
}

function checkKind(kind: unknown): string | null {
  if (!nonEmptyString(kind)) return "kind is required";
  if (kind.length > MAX_KIND_LENGTH || !KIND_PATTERN.test(kind)) {
    return "kind must be lowercase dotted words (max 64 chars)";
  }
  return null;
}

function anchorRef(
  v: unknown,
  tier: "plant" | "pod" | "bean",
): { error?: string; ref?: string } {
  if (v === undefined) {
    return tier === "plant" ? { error: "anchors.plant is required" } : {};
  }
  const prefix = `${tier}:`;
  if (
    typeof v !== "string" ||
    !v.startsWith(prefix) ||
    !SLUG_PATTERN.test(v.slice(prefix.length))
  ) {
    return { error: `anchors.${tier} must be a "${tier}:<slug>" ref` };
  }
  return { ref: v };
}

function checkAnchors(a: unknown): { error?: string; anchors?: PollenAnchors } {
  if (a === undefined) return { error: "anchors.plant is required" };
  if (!isObject(a)) return { error: "anchors must be an object" };
  const plant = anchorRef(a.plant, "plant");
  if (plant.error) return { error: plant.error };
  const pod = anchorRef(a.pod, "pod");
  if (pod.error) return { error: pod.error };
  const bean = anchorRef(a.bean, "bean");
  if (bean.error) return { error: bean.error };
  return {
    anchors: {
      plant: plant.ref as string,
      ...(pod.ref ? { pod: pod.ref } : {}),
      ...(bean.ref ? { bean: bean.ref } : {}),
    },
  };
}

function checkRefs(r: unknown): { error?: string; refs?: PollenRef[] } {
  if (r === undefined) return {};
  if (!Array.isArray(r)) return { error: "refs must be an array" };
  const refs: PollenRef[] = [];
  for (const entry of r) {
    if (!isObject(entry) || !nonEmptyString(entry.label)) {
      return { error: "each ref requires a label" };
    }
    if (entry.url !== undefined && !nonEmptyString(entry.url)) {
      return { error: "ref.url must be a non-empty string" };
    }
    if (entry.ref !== undefined && !nonEmptyString(entry.ref)) {
      return { error: "ref.ref must be a non-empty string" };
    }
    if (entry.url === undefined && entry.ref === undefined) {
      return { error: `ref "${entry.label}" requires url or ref` };
    }
    refs.push({
      label: entry.label,
      ...(nonEmptyString(entry.url) ? { url: entry.url } : {}),
      ...(nonEmptyString(entry.ref) ? { ref: entry.ref } : {}),
    });
  }
  return { refs };
}

function checkPayload(p: unknown): { error?: string; payload?: Record<string, unknown> } {
  if (p === undefined) return {};
  if (!isObject(p)) return { error: "payload must be an object" };
  if (Buffer.byteLength(JSON.stringify(p), "utf8") > MAX_PAYLOAD_BYTES) {
    return { error: "payload exceeds 32 KiB serialized — put detail behind a ref" };
  }
  return { payload: p };
}

function kindWarnings(kind: string, core: readonly string[]): string[] {
  return core.includes(kind)
    ? []
    : [`kind "${kind}" is not in the v1 core vocabulary`];
}

// Pure guard for one envelope. Unknown top-level keys are ignored (forward
// compatibility); malformed envelopes are rejected, never silently dropped.
export function validatePollen(value: unknown): PollenResult {
  if (!isObject(value)) return { ok: false, error: "envelope must be a JSON object" };
  const vErr = checkV(value.v);
  if (vErr) return { ok: false, error: vErr };
  if (!nonEmptyString(value.id)) return { ok: false, error: "id is required" };
  const atErr = checkAt(value.at);
  if (atErr) return { ok: false, error: atErr };
  if (!nonEmptyString(value.source) || !SLUG_PATTERN.test(value.source)) {
    return { ok: false, error: "source must be a lowercase slug" };
  }
  const kindErr = checkKind(value.kind);
  if (kindErr) return { ok: false, error: kindErr };
  const kind = value.kind as string;
  const title = normalizeTextInput(value.title);
  if (title === null) return { ok: false, error: "title is required" };
  const anchors = checkAnchors(value.anchors);
  if (anchors.error) return { ok: false, error: anchors.error };
  const refs = checkRefs(value.refs);
  if (refs.error) return { ok: false, error: refs.error };
  if (
    value.visibility !== undefined &&
    value.visibility !== "public" &&
    value.visibility !== "private"
  ) {
    return { ok: false, error: 'visibility must be "public" or "private"' };
  }
  const payload = checkPayload(value.payload);
  if (payload.error) return { ok: false, error: payload.error };

  return {
    ok: true,
    value: {
      v: POLLEN_VERSION,
      id: value.id,
      at: value.at as string,
      source: value.source,
      kind,
      title,
      anchors: anchors.anchors as PollenAnchors,
      ...(refs.refs ? { refs: refs.refs } : {}),
      ...(value.visibility ? { visibility: value.visibility as "public" | "private" } : {}),
      ...(payload.payload ? { payload: payload.payload } : {}),
    },
    warnings: kindWarnings(kind, CORE_KINDS),
  };
}
```

(`validateIntent` and `validateFeed` arrive in Tasks 3–4 — the test file so far only imports what exists.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsc --noEmit && npm test`
Expected: all pollen tests PASS; whole suite green.

- [ ] **Step 5: Commit**

```bash
git add lib/pollen.ts lib/pollen.test.ts
git commit -m "feat: pollen envelope types + validatePollen reference guard"
```

---

### Task 3: `validateIntent`

**Files:**
- Modify: `lib/pollen.test.ts` (append)
- Modify: `lib/pollen.ts` (append)

- [ ] **Step 1: Append the failing tests to `lib/pollen.test.ts`**

Add `validateIntent` to the import from `./pollen`, then:

```ts
function intent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    v: 1,
    id: "ariko:intent-0001",
    at: "2026-08-15T08:00:00Z",
    target: "femfolk",
    kind: "research",
    brief: { en: "Research the song heard at the cafe" },
    anchors: { plant: "plant:femfolk" },
    ...overrides,
  };
}

test("a valid intent passes; anchors are optional", () => {
  assert.equal(validateIntent(intent()).ok, true);
  const bare = validateIntent(intent({ anchors: undefined }));
  assert.equal(bare.ok, true);
  if (bare.ok) assert.ok(!("anchors" in bare.value));
});

test("intent rejections: target, brief, malformed anchors", () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ target: "Femfolk" }, "target must be a lowercase slug"],
    [{ target: undefined }, "target must be a lowercase slug"],
    [{ brief: undefined }, "brief is required"],
    [{ brief: { en: "" } }, "brief is required"],
    [{ anchors: { plant: "femfolk" } }, 'anchors.plant must be a "plant:<slug>" ref'],
    [{ v: 2 }, "newer than this validator"],
    [{ kind: "Research!" }, "kind must be lowercase dotted words"],
  ];
  for (const [overrides, want] of cases) {
    const r = validateIntent(intent(overrides));
    assert.equal(r.ok, false, JSON.stringify(overrides));
    if (!r.ok) assert.ok(r.error.includes(want), `got "${r.error}", want "${want}"`);
  }
});

test("non-provisional intent kind warns, never rejects", () => {
  const r = validateIntent(intent({ kind: "compose" }));
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.warnings, ['kind "compose" is not in the v1 core vocabulary']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `validateIntent` is not exported.

- [ ] **Step 3: Append `validateIntent` to `lib/pollen.ts`**

```ts
// The reverse envelope (spec §5). Delivery is project-native and outside
// this contract; status returns through the target's ordinary report feed.
export function validateIntent(value: unknown): IntentResult {
  if (!isObject(value)) return { ok: false, error: "intent must be a JSON object" };
  const vErr = checkV(value.v);
  if (vErr) return { ok: false, error: vErr };
  if (!nonEmptyString(value.id)) return { ok: false, error: "id is required" };
  const atErr = checkAt(value.at);
  if (atErr) return { ok: false, error: atErr };
  if (!nonEmptyString(value.target) || !SLUG_PATTERN.test(value.target)) {
    return { ok: false, error: "target must be a lowercase slug" };
  }
  const kindErr = checkKind(value.kind);
  if (kindErr) return { ok: false, error: kindErr };
  const kind = value.kind as string;
  const brief = normalizeTextInput(value.brief);
  if (brief === null) return { ok: false, error: "brief is required" };
  let anchors: PollenAnchors | undefined;
  if (value.anchors !== undefined) {
    const checked = checkAnchors(value.anchors);
    if (checked.error) return { ok: false, error: checked.error };
    anchors = checked.anchors;
  }
  const refs = checkRefs(value.refs);
  if (refs.error) return { ok: false, error: refs.error };

  return {
    ok: true,
    value: {
      v: POLLEN_VERSION,
      id: value.id,
      at: value.at as string,
      target: value.target,
      kind,
      brief,
      ...(anchors ? { anchors } : {}),
      ...(refs.refs ? { refs: refs.refs } : {}),
    },
    warnings: kindWarnings(kind, INTENT_KINDS),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/pollen.ts lib/pollen.test.ts
git commit -m "feat: validateIntent — the reverse envelope"
```

---

### Task 4: `validateFeed` (NDJSON lines)

**Files:**
- Modify: `lib/pollen.test.ts` (append)
- Modify: `lib/pollen.ts` (append)

- [ ] **Step 1: Append the failing tests**

Add `validateFeed` to the import, then:

```ts
test("validateFeed reports 1-based line numbers, skips blank lines", () => {
  const good = JSON.stringify(grain());
  const feed = `${good}\n\n{not json}\n${JSON.stringify(grain({ id: "" }))}\n${good}\n`;
  const results = validateFeed(feed);
  assert.deepEqual(
    results.map((r) => [r.line, r.result.ok]),
    [[1, true], [3, false], [4, false], [5, true]],
  );
  const line3 = results[1].result;
  if (!line3.ok) assert.equal(line3.error, "invalid JSON");
  const line4 = results[2].result;
  if (!line4.ok) assert.ok(line4.error.includes("id is required"));
});

test("validateFeed on empty input returns no results", () => {
  assert.deepEqual(validateFeed(""), []);
  assert.deepEqual(validateFeed("\n\n"), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `validateFeed` is not exported.

- [ ] **Step 3: Append `validateFeed` to `lib/pollen.ts`**

```ts
export interface FeedLineResult {
  line: number; // 1-based, in the raw file
  result: PollenResult;
}

// Validate a committed feed file (pollen/feed.ndjson): one envelope per
// line, blank lines ignored. Pure — the CLI wraps this for exit codes.
export function validateFeed(ndjson: string): FeedLineResult[] {
  const out: FeedLineResult[] = [];
  const lines = ndjson.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      out.push({ line: i + 1, result: { ok: false, error: "invalid JSON" } });
      continue;
    }
    out.push({ line: i + 1, result: validatePollen(parsed) });
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/pollen.ts lib/pollen.test.ts
git commit -m "feat: validateFeed — line-numbered NDJSON feed validation"
```

---

### Task 5: Conformance fixtures + data-driven tests

The fixture suite is the cross-repo conformance artifact (spec §8): sibling repos copy `data/pollen/` to test their adapters. Adding a fixture is adding a test — the test file enumerates the directories.

**Files:**
- Create: `data/pollen/valid/` (9 JSON envelopes + 1 intent + 1 NDJSON feed)
- Create: `data/pollen/invalid/` (9 JSON envelopes + `manifest.json`)
- Create: `lib/pollen-fixtures.test.ts`

- [ ] **Step 1: Write the failing fixture-driven test**

Create `lib/pollen-fixtures.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateFeed, validateIntent, validatePollen } from "./pollen";

const ROOT = join(process.cwd(), "data", "pollen");

test("every valid fixture passes; only noncore-kind warns", () => {
  const files = readdirSync(join(ROOT, "valid")).filter((f) => f.endsWith(".json"));
  assert.ok(files.length >= 10, "expected the full valid fixture set");
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(join(ROOT, "valid", file), "utf8"));
    const result = file.startsWith("intent-") ? validateIntent(parsed) : validatePollen(parsed);
    assert.equal(result.ok, true, `${file}: ${result.ok ? "" : result.error}`);
    if (!result.ok) continue;
    if (file === "noncore-kind.json") {
      assert.equal(result.warnings.length, 1, file);
    } else {
      assert.deepEqual(result.warnings, [], file);
    }
  }
});

test("the sample feed validates clean", () => {
  const results = validateFeed(readFileSync(join(ROOT, "valid", "feed-sample.ndjson"), "utf8"));
  assert.equal(results.length, 3);
  for (const { line, result } of results) {
    assert.equal(result.ok, true, `line ${line}: ${result.ok ? "" : result.error}`);
  }
});

test("every invalid fixture fails with its manifest error; no orphans", () => {
  const manifest: { file: string; error: string }[] = JSON.parse(
    readFileSync(join(ROOT, "invalid", "manifest.json"), "utf8"),
  );
  const files = readdirSync(join(ROOT, "invalid"))
    .filter((f) => f.endsWith(".json") && f !== "manifest.json");
  assert.deepEqual(files.sort(), manifest.map((m) => m.file).sort());
  for (const { file, error } of manifest) {
    const parsed = JSON.parse(readFileSync(join(ROOT, "invalid", file), "utf8"));
    const result = validatePollen(parsed);
    assert.equal(result.ok, false, file);
    if (!result.ok) {
      assert.ok(result.error.includes(error), `${file}: got "${result.error}", want "${error}"`);
    }
  }
});
```

Run: `npm test` — Expected: FAIL (`ENOENT` on `data/pollen/valid`).

- [ ] **Step 2: Create the valid fixtures**

`data/pollen/valid/arkaik-shipped.json`:

```json
{
  "v": 1,
  "id": "arkaik:evt_857",
  "at": "2026-08-10T18:12:00Z",
  "source": "arkaik",
  "kind": "shipped",
  "title": "Lab-note webhook shipped",
  "anchors": { "plant": "plant:pbbls" },
  "refs": [{ "label": "journal node", "ref": "evt_857" }]
}
```

`data/pollen/valid/arkaik-decided.json`:

```json
{
  "v": 1,
  "id": "arkaik:evt_858",
  "at": "2026-08-11T09:00:00Z",
  "source": "arkaik",
  "kind": "decided",
  "title": "Panels port from femfolk, never Oxymore",
  "anchors": { "plant": "plant:arkaik" },
  "refs": [{ "label": "decision", "ref": "evt_858" }]
}
```

`data/pollen/valid/melogram-published.json`:

```json
{
  "v": 1,
  "id": "melogram:album-celesta-published",
  "at": "2026-06-01T10:00:00Z",
  "source": "melogram",
  "kind": "published",
  "title": { "en": "Celesta is out", "fr": "Celesta est sorti" },
  "anchors": { "plant": "plant:bohns-music", "pod": "pod:celesta" },
  "refs": [{ "label": "album", "url": "https://melogram.example/celesta", "ref": "album_celesta" }],
  "payload": { "tracks": 9 }
}
```

`data/pollen/valid/melogram-milestone.json`:

```json
{
  "v": 1,
  "id": "melogram:felina-1000-plays",
  "at": "2026-08-12T00:00:00Z",
  "source": "melogram",
  "kind": "milestone",
  "title": "Felina crossed 1000 plays",
  "anchors": { "plant": "plant:bohns-music", "pod": "pod:celesta", "bean": "bean:felina" },
  "payload": { "plays": 1000 }
}
```

`data/pollen/valid/femfolk-drafted.json`:

```json
{
  "v": 1,
  "id": "femfolk:dossier-42-drafted",
  "at": "2026-08-14T02:30:00Z",
  "source": "femfolk",
  "kind": "drafted",
  "title": { "en": "Song dossier drafted", "fr": "Dossier chanson en brouillon" },
  "anchors": { "plant": "plant:femfolk" },
  "visibility": "private"
}
```

`data/pollen/valid/femfolk-review-requested.json`:

```json
{
  "v": 1,
  "id": "femfolk:dossier-42-review",
  "at": "2026-08-14T02:31:00Z",
  "source": "femfolk",
  "kind": "review.requested",
  "title": "Dossier 42 waiting on femfolk",
  "anchors": { "plant": "plant:femfolk" },
  "refs": [{ "label": "intent", "ref": "ariko:intent-0001" }]
}
```

`data/pollen/valid/github-release-tagged.json`:

```json
{
  "v": 1,
  "id": "github:ariko-v0.2.0",
  "at": "2026-08-13T16:45:00Z",
  "source": "github",
  "kind": "release.tagged",
  "title": "ariko v0.2.0",
  "anchors": { "plant": "plant:ariko" },
  "refs": [{ "label": "release", "url": "https://github.com/example/ariko/releases/tag/v0.2.0" }]
}
```

`data/pollen/valid/task-lifecycle.json`:

```json
{
  "v": 1,
  "id": "femfolk:task-intent-0001-opened",
  "at": "2026-08-15T09:00:00Z",
  "source": "femfolk",
  "kind": "task.opened",
  "title": "Research task opened",
  "anchors": { "plant": "plant:femfolk" },
  "refs": [{ "label": "intent", "ref": "ariko:intent-0001" }]
}
```

`data/pollen/valid/noncore-kind.json`:

```json
{
  "v": 1,
  "id": "melogram:setlist-2026-08-14",
  "at": "2026-08-14T21:00:00Z",
  "source": "melogram",
  "kind": "setlist.changed",
  "title": "Setlist updated",
  "anchors": { "plant": "plant:bohns-music" }
}
```

`data/pollen/valid/intent-research.json`:

```json
{
  "v": 1,
  "id": "ariko:intent-0001",
  "at": "2026-08-15T08:00:00Z",
  "target": "femfolk",
  "kind": "research",
  "brief": { "en": "Research the song heard at the cafe", "fr": "Recherche la chanson entendue au cafe" },
  "anchors": { "plant": "plant:femfolk" }
}
```

`data/pollen/valid/feed-sample.ndjson` — three lines, each the single-line JSON of an existing fixture (build it from the files so it can't drift):

```bash
node --import tsx -e '
const { readFileSync, writeFileSync } = require("node:fs");
const files = ["arkaik-shipped.json", "melogram-published.json", "femfolk-review-requested.json"];
const lines = files.map((f) => JSON.stringify(JSON.parse(readFileSync(`data/pollen/valid/${f}`, "utf8"))));
writeFileSync("data/pollen/valid/feed-sample.ndjson", lines.join("\n") + "\n");
'
```

- [ ] **Step 3: Create the invalid fixtures + manifest**

`data/pollen/invalid/manifest.json`:

```json
[
  { "file": "missing-id.json", "error": "id is required" },
  { "file": "bad-at.json", "error": "ISO 8601" },
  { "file": "bad-kind.json", "error": "kind must be lowercase dotted words" },
  { "file": "missing-plant.json", "error": "anchors.plant is required" },
  { "file": "unprefixed-anchor.json", "error": "anchors.plant must be a \"plant:<slug>\" ref" },
  { "file": "ref-without-target.json", "error": "requires url or ref" },
  { "file": "oversize-payload.json", "error": "payload exceeds 32 KiB" },
  { "file": "newer-version.json", "error": "newer than this validator" },
  { "file": "blank-title.json", "error": "title is required" }
]
```

Each invalid fixture is the minimal valid envelope with one field broken:

`missing-id.json`:

```json
{ "v": 1, "at": "2026-08-10T18:12:00Z", "source": "arkaik", "kind": "shipped", "title": "x", "anchors": { "plant": "plant:pbbls" } }
```

`bad-at.json`:

```json
{ "v": 1, "id": "arkaik:evt_1", "at": "yesterday", "source": "arkaik", "kind": "shipped", "title": "x", "anchors": { "plant": "plant:pbbls" } }
```

`bad-kind.json`:

```json
{ "v": 1, "id": "arkaik:evt_1", "at": "2026-08-10T18:12:00Z", "source": "arkaik", "kind": "Shipped!", "title": "x", "anchors": { "plant": "plant:pbbls" } }
```

`missing-plant.json`:

```json
{ "v": 1, "id": "arkaik:evt_1", "at": "2026-08-10T18:12:00Z", "source": "arkaik", "kind": "shipped", "title": "x", "anchors": {} }
```

`unprefixed-anchor.json`:

```json
{ "v": 1, "id": "arkaik:evt_1", "at": "2026-08-10T18:12:00Z", "source": "arkaik", "kind": "shipped", "title": "x", "anchors": { "plant": "pbbls" } }
```

`ref-without-target.json`:

```json
{ "v": 1, "id": "arkaik:evt_1", "at": "2026-08-10T18:12:00Z", "source": "arkaik", "kind": "shipped", "title": "x", "anchors": { "plant": "plant:pbbls" }, "refs": [{ "label": "pr" }] }
```

`newer-version.json`:

```json
{ "v": 2, "id": "arkaik:evt_1", "at": "2026-08-10T18:12:00Z", "source": "arkaik", "kind": "shipped", "title": "x", "anchors": { "plant": "plant:pbbls" } }
```

`blank-title.json`:

```json
{ "v": 1, "id": "arkaik:evt_1", "at": "2026-08-10T18:12:00Z", "source": "arkaik", "kind": "shipped", "title": { "en": "" }, "anchors": { "plant": "plant:pbbls" } }
```

`oversize-payload.json` — generated (33 KiB blob is not hand-written):

```bash
node --import tsx -e '
const { writeFileSync } = require("node:fs");
writeFileSync("data/pollen/invalid/oversize-payload.json", JSON.stringify({
  v: 1, id: "arkaik:evt_1", at: "2026-08-10T18:12:00Z", source: "arkaik",
  kind: "shipped", title: "x", anchors: { plant: "plant:pbbls" },
  payload: { blob: "x".repeat(33 * 1024) },
}));
'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsc --noEmit && npm test`
Expected: all three fixture tests PASS; suite green.

- [ ] **Step 5: Commit**

```bash
git add data/pollen lib/pollen-fixtures.test.ts
git commit -m "test: pollen conformance fixture suite (valid + invalid + feed sample)"
```

---

### Task 6: `pollen-validate` CLI

Thin wrapper over the lib — all logic already tested; the CLI is verified by running it.

**Files:**
- Create: `scripts/pollen-validate.ts`
- Modify: `package.json`

- [ ] **Step 1: Create `scripts/pollen-validate.ts`**

```ts
// Producer-side dry-run for pollen (slice-2 spec §1; umbrella §11 —
// "ingest doors have --validate-only dry-runs", this is the feed twin).
//
// Usage:
//   npm run pollen:validate -- path/to/feed.ndjson
//   npm run pollen:validate -- path/to/envelope.json
//   npm run pollen:validate -- path/to/intent.json --intent
//
// Exit codes: 0 valid (warnings allowed), 1 invalid, 2 usage/read error.

import { readFileSync } from "node:fs";
import { validateFeed, validateIntent, validatePollen } from "../lib/pollen";

const intentMode = process.argv.includes("--intent");
const path = process.argv.slice(2).find((a) => a !== "--intent");
if (!path) {
  console.error("usage: pollen-validate <feed.ndjson | envelope.json> [--intent]");
  process.exit(2);
}

let text: string;
try {
  text = readFileSync(path, "utf8");
} catch {
  console.error(`cannot read ${path}`);
  process.exit(2);
}

let failed = false;

if (path.endsWith(".ndjson")) {
  for (const { line, result } of validateFeed(text)) {
    if (!result.ok) {
      failed = true;
      console.error(`line ${line}: ${result.error}`);
    } else {
      for (const w of result.warnings) console.warn(`line ${line}: warning: ${w}`);
    }
  }
} else {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("invalid JSON");
    process.exit(1);
  }
  const result = (intentMode ? validateIntent : validatePollen)(parsed);
  if (!result.ok) {
    failed = true;
    console.error(result.error);
  } else {
    for (const w of result.warnings) console.warn(`warning: ${w}`);
  }
}

console.log(failed ? "invalid" : "valid");
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Add the npm script**

In `package.json` `"scripts"`, after `"validators"`:

```json
"pollen:validate": "node --import tsx scripts/pollen-validate.ts",
```

- [ ] **Step 3: Verify against the fixtures**

```bash
npm run pollen:validate -- data/pollen/valid/feed-sample.ndjson; echo "exit=$?"
npm run pollen:validate -- data/pollen/valid/noncore-kind.json; echo "exit=$?"
npm run pollen:validate -- data/pollen/invalid/missing-id.json; echo "exit=$?"
npm run pollen:validate -- data/pollen/valid/intent-research.json --intent; echo "exit=$?"
```

Expected, in order: `valid` exit=0; `valid` with one kind warning, exit=0; `id is required` + `invalid`, exit=1; `valid` exit=0.

- [ ] **Step 4: Typecheck + full suite still green**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/pollen-validate.ts package.json
git commit -m "feat: pollen-validate CLI — feed and envelope dry-runs"
```

---

### Task 7: The normative contract — `docs/POLLEN.md` + README pointer

**Files:**
- Create: `docs/POLLEN.md`
- Modify: `README.md` (insert a `## Pollen` section between the Lab Note pipeline section and `## Admin zone`)

- [ ] **Step 1: Create `docs/POLLEN.md`**

```markdown
# Pollen — the Ariko federation contract

**Version: 1** · This document is normative. It versions with the repo;
the reference validator is [`lib/pollen.ts`](../lib/pollen.ts) and the
conformance fixtures are [`data/pollen/`](../data/pollen/). A sibling
project should be able to build a conforming adapter from this document
alone.

Bees carry pollen between plants: every sovereign project of the
practice reports its activity as **pollen** — one envelope shape, three
verbs (report / read / initiate). Ariko aggregates; sources stay
sovereign.

## The envelope

One event, one JSON object:

​```json
{
  "v": 1,
  "id": "melogram:album-celesta-published",
  "at": "2026-06-01T10:00:00Z",
  "source": "melogram",
  "kind": "published",
  "title": { "en": "Celesta is out", "fr": "Celesta est sorti" },
  "anchors": { "plant": "plant:bohns-music", "pod": "pod:celesta" },
  "refs": [{ "label": "album", "url": "https://…", "ref": "album_celesta" }],
  "payload": { "tracks": 9 }
}
​```

| Field | Req | Rule |
|---|---|---|
| `v` | ✓ | Contract version, integer `1`. Consumers refuse a `v` they don't know — loudly, never a silent partial parse. |
| `id` | ✓ | Globally unique, **stable forever** — the idempotency key. Convention: `"<source>:<native-id>"`. Re-emitting an id is a no-op for every consumer. |
| `at` | ✓ | When the event *happened* (source truth, not emission time). Strict ISO 8601 with seconds and explicit timezone; UTC `Z` recommended. |
| `source` | ✓ | Slug of the emitting **tool** (`arkaik`, `melogram`, `femfolk`…) — not always the anchored plant (melogram emits for `plant:bohns-music`). |
| `kind` | ✓ | See vocabulary below. |
| `title` | ✓ | Human-grade one-liner. A non-empty string, or `{ "en"?, "fr"? }` with at least one non-empty part. |
| `anchors` | ✓ | What it concerns, in practice-graph refs: `plant` (required), `pod?`, `bean?` — prefixed (`plant:<slug>`). One anchor set per envelope; an event concerning two plants is two envelopes. Dangling anchors are the reader's problem (ignored fail-closed), not a schema error. |
| `refs` | | Deep links / native ids: `{ label, url?, ref? }[]`, each with at least one of `url` \| `ref`. |
| `visibility` | | `"private"` is **binding and fail-closed**: recorded, never published. `"public"` (or absent) is only a hint — publishing is always a human act on the ariko side. |
| `payload` | | Optional native detail, schema owned by the source, opaque to ariko. Serialized size ≤ **32 KiB**; bigger detail belongs behind a `ref`. |

Unknown top-level keys are **ignored** (forward compatibility).
Envelopes are **immutable** once emitted: a correction is a new envelope
(new `id`, a `ref` to the corrected one).

## `kind` vocabulary

Grammar: lowercase dotted words, `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$`,
max 64 chars. The v1 core:

| kind | meaning |
|---|---|
| `shipped` | a feature/change delivered |
| `release.tagged` | a repo release cut |
| `published` | a public artefact went live |
| `drafted` | a draft artefact created |
| `decided` | a decision recorded |
| `milestone` | a threshold/anniversary crossed |
| `task.opened` | dispatched work acknowledged |
| `review.requested` | work waiting on the human gate |
| `task.done` | dispatched work finished |

Any kind matching the grammar is **accepted**; non-core kinds produce a
warning and generic handling (a beanstalk line, no special projection) —
never a rejection, never silent loss. Promoting a kind into the core is
an additive change (no `v` bump).

`task.opened → review.requested → task.done / published` is the dispatch
status arc; the correlating intent id travels in `refs`
(`{ "label": "intent", "ref": "<intent id>" }`).

## Report — two transports

**HTTP feed** (hosted sources):

​```
GET <base>/pollen?after=<id>&limit=<n>   →   { "pollen": [ …envelopes… ] }
​```

Append order. `after` absent ⇒ from the beginning. `limit` capped at 200
by the server. Empty array ⇒ caught up — the consumer's cursor is simply
the last id it processed. Unknown `after` ⇒ **410 Gone** ⇒ the consumer
discards its cursor and rebuilds from the start. Auth (bearer token or
public) is per-adapter, outside this contract.

**Committed feed file** (unhosted sources): `pollen/feed.ndjson` in the
source repo — one envelope per line, UTF-8, append-only, blank lines
ignored. RSS, literally. The source's bee entry in the garden points at
it via `levers`. Rotation is reserved for a future version.

Feeds are append-only in normal operation. Rewriting history is legal
only as a coordinated event: consumers drop cursors and rebuild.

## Read — guarantees

Implemented ariko-side (read model, slice 4); stated here because
producers and consumers both rely on them: idempotent by `id`; cursor =
last processed id per source; full rebuild possible at any time from the
feed itself; ariko's copy is a disposable projection, never a live
proxy; synthesis bricks query the cache, not the sources.

## Initiate — the reverse envelope

​```json
{
  "v": 1,
  "id": "ariko:intent-0001",
  "at": "2026-08-15T08:00:00Z",
  "target": "femfolk",
  "kind": "research",
  "brief": { "en": "Research the song heard at the cafe" },
  "anchors": { "plant": "plant:femfolk" }
}
​```

Same field rules as the envelope, with `target` (receiving project slug)
instead of `source`, required `brief` (Text) instead of `title`, and
`anchors` optional. Delivered through the target's **native door**
(intake API, arkaik `file_request`, `workflow_dispatch`, backlog PR) —
delivery is not part of this contract. **Status returns through the
target's ordinary report feed**, never a second mechanism. The intent
kind vocabulary (`research`, `draft`) is provisional until the dispatch
pilot (slice 7); the shape is normative now.

## Security posture

Normative for every adapter (inherited from the umbrella): executors
hold at most one secret (a PAT scoped to `actions:write`); DB
credentials never leave the owning project's CI; write doors validate
and dedupe, refusals are logged and never fatal; inbox tokens stay
per-source-kind scoped. The ariko inbox (`POST /api/inbox`) remains the
third door for homeless sources and human capture — pollen does not
replace it.

## Versioning

- `v` bumps only on breaking change (new required field, changed
  semantics of an existing one).
- Additive, same `v`: new optional fields, core-kind promotions, new
  transports. Consumers ignore unknown keys.
- Validate with `npm run pollen:validate -- <feed.ndjson | envelope.json>`
  (add `--intent` for intents).

## Changelog

- **v1** (2026-08-15) — initial contract: envelope, nine core kinds,
  report/read/initiate, two transports.
```

**Note for the implementer:** the ` ​``` ` fences above are shown with a
zero-width placeholder so the plan's own fence doesn't break — write
plain ` ``` ` fences in the real file.

- [ ] **Step 2: Add the README section**

In `README.md`, immediately before `## Admin zone` (currently line 179), insert:

```markdown
## Pollen (federation contract)

Every project of the practice reports activity to Ariko as **pollen** —
one envelope, three verbs (report / read / initiate), carried by bees
between plants. The normative contract lives in
[`docs/POLLEN.md`](docs/POLLEN.md); the reference validator is
`lib/pollen.ts`, and `data/pollen/` is the conformance fixture suite
sibling repos copy to test their adapters. Dry-run any feed with
`npm run pollen:validate -- path/to/feed.ndjson`. Slice 2 of the
federation umbrella (`docs/superpowers/specs/2026-08-14-ariko-federation-design.md`);
ingestion of pollen into the read model is slice 4.

```

- [ ] **Step 3: Sanity-check the contract against the validator**

Re-read `docs/POLLEN.md` once, checking each stated rule has a
corresponding test in `lib/pollen.test.ts` or a fixture — the acceptance
bar is that the document and the validator never disagree. Then:

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/POLLEN.md README.md
git commit -m "docs: POLLEN.md — the normative federation contract, v1"
```

---

### Task 8: Final verification against the spec's acceptance list

**Files:** none (verification only)

- [ ] **Step 1: Run the full acceptance checklist** (spec §9)

```bash
npx tsc --noEmit
npm test
npm run pollen:validate -- data/pollen/valid/feed-sample.ndjson
git diff main --stat
```

Confirm, against spec §9: POLLEN.md self-sufficient (no reference back
into ariko code needed to implement an adapter); all valid fixtures
pass, `noncore-kind.json` with exactly one warning; every invalid
fixture fails with its manifest error; unknown keys ignored and `v: 2`
refused (both unit-tested); CLI exits non-zero on invalid input with
`line N: <error>` output; **no new dependencies** in `package.json`; no
DB or network access anywhere in the diff.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin spec/pollen-contract
gh pr create --title "Slice 2 — pollen: federation envelope + contract" --body "$(cat <<'EOF'
Implements docs/superpowers/specs/2026-08-15-pollen-federation-contract-design.md
(umbrella §10.2): the normative docs/POLLEN.md (v1), the reference
validator lib/pollen.ts (validatePollen / validateIntent / validateFeed),
the cross-repo conformance fixture suite data/pollen/, and the
pollen:validate CLI. Zero new dependencies; nothing touches Mongo or the
network.

No Lab Note — spec/contract/tooling only, nothing user-visible.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EpUoUMA1ezLKvHcpdyNkGy
EOF
)"
```

(Chore-shaped PR: no Lab Note per the CLAUDE.md gate; add the
`no-lab-note` label if the advisory reminder comments.)
