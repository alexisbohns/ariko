# Slice 3 — Arkaik Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Arkaik serves its hosted journals as a pollen feed and ingests Lab Notes from merged PRs into the journal; ariko's `lab-note.yml` stub is retired for arkaik-mapped repos.

**Architecture:** All new code lands in the **arkaik repo**: a vendored copy of ariko's pollen contract, a pure journal→pollen projection, a read-only feed route on the hosted graph API, and a lab-note handler bolted onto the existing GitHub App webhook. Cross-repo retirement (pbbls, arkaik, ariko garden) follows as small text-only PRs plus a manual ops checklist. Spec: `docs/superpowers/specs/2026-08-15-arkaik-adapter-design.md` (ariko repo); contract: ariko `docs/POLLEN.md` v1.

**Tech Stack:** Next.js route handlers (nodejs runtime), Postgres via `lib/services/db`, `@arkaik/schema` (zod), the `yaml` package (already a dependency), arkaik's hand-rolled `node` test scripts with TS-transpiling loaders.

**Repos touched:** `~/code/arkaik` (Tasks 1–9), `~/code/pbbls` (Task 11), `~/code/ariko` (Task 12). Task 10 is manual ops.

**PR boundaries:** Tasks 1–9 = one arkaik PR (needs a Lab Note — it ships a user-visible feature: the federation feed + settings panel). Task 11 = pbbls PR (no note — infra). Task 12 = ariko PR (no note — infra). Retirement PRs merge only after Task 10's ops checklist is done.

---

## Task 1: Vendor the pollen contract + conformance fixtures (arkaik)

The reference validator and fixtures come from ariko (slice 2 planned exactly this vendoring). Copy, don't rewrite.

**Files:**
- Create: `lib/pollen/support.ts`
- Create: `lib/pollen/contract.ts` (copy of ariko `lib/pollen.ts`)
- Create: `tests/fixtures/pollen/` (copy of ariko `data/pollen/`)
- Create: `tests/app/load-pollen.js`
- Create: `tests/app/pollen-conformance.test.js`
- Modify: `package.json` (scripts)
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Copy the fixtures**

```bash
mkdir -p tests/fixtures/pollen
cp -R ~/code/ariko/data/pollen/valid ~/code/ariko/data/pollen/invalid tests/fixtures/pollen/
```

(`invalid/manifest.json` comes along inside `invalid/`.)

- [ ] **Step 2: Create `lib/pollen/support.ts`**

Copy ariko's `lib/text-input.ts` body verbatim, replacing its `import type { Text } from "./data"` with a local definition. Result:

```ts
// Vendored from ariko (lib/text-input.ts + the Text type from lib/data.ts).
// Do not edit here — fix upstream in ariko and re-vendor.

export interface LocalizedText {
  en?: string;
  fr?: string;
}
export type Text = string | LocalizedText;

// …then the exact bodies of isObject, nonEmptyString, normalizeTextInput
// from ~/code/ariko/lib/text-input.ts, unchanged.
```

- [ ] **Step 3: Create `lib/pollen/contract.ts`**

Copy `~/code/ariko/lib/pollen.ts` verbatim, changing only the two import lines to:

```ts
// Vendored from ariko lib/pollen.ts — the reference validator for
// docs/POLLEN.md v1. Do not edit here; fix upstream in ariko and re-vendor.
// Conformance fixtures: tests/fixtures/pollen (from ariko data/pollen).
import type { Text } from "./support";
import { isObject, nonEmptyString, normalizeTextInput } from "./support";
```

- [ ] **Step 4: Create the loader `tests/app/load-pollen.js`**

Follow the `tests/app/load-decision-utils.js` idiom exactly (transpile with `typescript`, CommonJS, no schema build needed — `lib/pollen/*` has no `@arkaik/schema` value imports):

```js
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const ROOT = path.join(__dirname, "..", "..");
const BUILD_DIR = path.join(__dirname, ".test-build-pollen");

const MODULES = [
  ["lib/pollen/support.ts", "support"],
  ["lib/pollen/contract.ts", "contract"],
  ["lib/pollen/map.ts", "map"], // exists from Task 3 on; tolerate absence
];

function loadPollen() {
  fs.rmSync(BUILD_DIR, { recursive: true, force: true });
  fs.mkdirSync(BUILD_DIR, { recursive: true });
  fs.writeFileSync(path.join(BUILD_DIR, "package.json"), JSON.stringify({ type: "commonjs" }));

  for (const [srcRel, outName] of MODULES) {
    const srcPath = path.join(ROOT, srcRel);
    if (!fs.existsSync(srcPath)) continue;
    const source = fs.readFileSync(srcPath, "utf8");
    const { outputText } = ts.transpileModule(source, {
      fileName: path.basename(srcRel),
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    });
    fs.writeFileSync(path.join(BUILD_DIR, `${outName}.js`), outputText);
  }
  for (const [, outName] of MODULES) delete require.cache[path.join(BUILD_DIR, `${outName}.js`)];

  return {
    contract: require(path.join(BUILD_DIR, "contract.js")),
    map: fs.existsSync(path.join(BUILD_DIR, "map.js")) ? require(path.join(BUILD_DIR, "map.js")) : null,
  };
}

module.exports = { loadPollen, BUILD_DIR };
```

- [ ] **Step 5: Write `tests/app/pollen-conformance.test.js`**

Mirror ariko's fixture iteration: every `valid/*.json` passes, `noncore-kind.json` with exactly one warning, `feed-sample.ndjson` clean through `validateFeed`, every `invalid/*.json` fails with its `manifest.json` error (substring match). Use the house PASS/FAIL counter pattern (see `tests/app/decision-utils.test.js`):

```js
#!/usr/bin/env node
// Conformance: the vendored validator must judge ariko's fixtures identically.
// A drift here means re-vendor lib/pollen/* from ariko, not patch locally.
const fs = require("fs");
const path = require("path");
const { loadPollen } = require("./load-pollen");

const { contract } = loadPollen();
const { validatePollen, validateIntent, validateFeed } = contract;
const FIXTURES = path.join(__dirname, "..", "fixtures", "pollen");

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log(`PASS: ${name}`);
  else { failures++; console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`); }
}

for (const file of fs.readdirSync(path.join(FIXTURES, "valid"))) {
  const full = path.join(FIXTURES, "valid", file);
  if (file.endsWith(".ndjson")) {
    const results = validateFeed(fs.readFileSync(full, "utf8"));
    check(`valid/${file} feed clean`, results.every((r) => r.result.ok));
    continue;
  }
  const value = JSON.parse(fs.readFileSync(full, "utf8"));
  const result = file.startsWith("intent-") ? validateIntent(value) : validatePollen(value);
  check(`valid/${file} passes`, result.ok, result.ok ? "" : result.error);
  if (file === "noncore-kind.json") check("noncore-kind has exactly one warning", result.ok && result.warnings.length === 1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURES, "invalid", "manifest.json"), "utf8"));
for (const { file, error } of manifest) {
  const value = JSON.parse(fs.readFileSync(path.join(FIXTURES, "invalid", file), "utf8"));
  const result = validatePollen(value);
  check(`invalid/${file} fails with "${error}"`, !result.ok && result.error.includes(error), result.ok ? "passed" : result.error);
}

process.exit(failures ? 1 : 0);
```

Note: check ariko's `data/pollen/invalid/manifest.json` shape first (array of `{file, error}` per the slice-2 spec) and adjust the iteration if it differs.

- [ ] **Step 6: Register and run**

`package.json` scripts: `"test:pollen-conformance": "node tests/app/pollen-conformance.test.js"`.
`.github/workflows/ci.yml`: add a step `run: npm run test:pollen-conformance` next to the other `tests/app` steps (the build job, not the Postgres job).

Run: `npm run test:pollen-conformance` → all PASS. Run `npx tsc --noEmit` → clean.

- [ ] **Step 7: Commit**

```bash
git add lib/pollen tests/fixtures/pollen tests/app/load-pollen.js tests/app/pollen-conformance.test.js package.json .github/workflows/ci.yml
git commit -m "feat(pollen): vendor ariko's pollen contract + conformance fixtures"
```

## Task 2: Schema additions — `lab_note` on deliverables, `pollen` on project metadata (arkaik)

Both additive, both `.catchall`-compatible; the explicit fields exist so writers are typed and docs are honest.

**Files:**
- Modify: `packages/schema/src/journal.ts:138-148` (`DeliverableShippedEvent`)
- Modify: `packages/schema/src/journal-events.ts:109-120` (`DeliverableShippedEventSchema`)
- Modify: `packages/schema/src/bundle.ts:293-320` (`ProjectMetadata` + schema)
- Modify: `docs/spec/journal.md` (event vocabulary table)
- Test: `tests/schema/emit.test.js` (append assertions)

- [ ] **Step 1: Write the failing assertions in `tests/schema/emit.test.js`**

Append at the end, following the file's existing assert style:

```js
// deliverable.shipped may carry a Lab Note (slice 3): typed, validated, preserved.
const shippedWithNote = makeEvent("deliverable.shipped", {
  deliverable_id: "pr-42",
  title: "Find your way around",
  summary: "A sidebar on wide screens.",
  url: "https://github.com/x/y/pull/42",
  lab_note: {
    en: { title: "Find your way around", summary: "A sidebar on wide screens." },
    fr: { title: "Trouve ton chemin", summary: "Une barre latérale sur grand écran." },
    suggested: { molecule: "pbbls", type: "feature" },
  },
}, { actor: "github-app" });
assert(shippedWithNote.lab_note.fr.title === "Trouve ton chemin", "lab_note survives makeEvent");
```

(Adapt the assert helper name to the file's existing one.)

- [ ] **Step 2: Run to verify current behavior**

Run: `npm run test:emit`
Expected: PASS already (`.catchall` preserves it) — this step pins the behavior; the schema change below makes it typed rather than incidental.

- [ ] **Step 3: Add the typed fields**

`packages/schema/src/journal.ts` — inside `DeliverableShippedEvent`, after `platform?`:

```ts
  /** Slice 3: the Lab Note a merged PR carried (docs/spec/journal.md § Event Vocabulary). */
  lab_note?: {
    en: { title: string; summary: string };
    fr?: { title?: string; summary?: string };
    suggested?: Record<string, unknown>;
  };
```

`packages/schema/src/journal-events.ts` — inside `DeliverableShippedEventSchema`'s object, after `platform`:

```ts
    lab_note: z
      .object({
        en: z.object({ title: z.string(), summary: z.string() }).catchall(z.unknown()),
        fr: z.object({ title: z.string().optional(), summary: z.string().optional() }).catchall(z.unknown()).optional(),
        suggested: z.record(z.string(), z.unknown()).optional(),
      })
      .catchall(z.unknown())
      .optional()
      .meta({ description: "The Lab Note a merged PR carried (slice 3); en.title/en.summary required when present." }),
```

`packages/schema/src/bundle.ts` — `ProjectMetadata` gains:

```ts
  /** Federation (pollen) settings for hosted serving; `plant` is the ariko plant slug this project anchors to. */
  pollen?: { plant?: string } & Record<string, unknown>;
```

and `ProjectMetadataSchema`'s object gains:

```ts
    pollen: z
      .object({ plant: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).optional() })
      .catchall(z.unknown())
      .optional()
      .meta({ description: "Federation settings — docs/spec/services.md § Pollen feed. `plant` enables the feed." }),
```

- [ ] **Step 4: Document in `docs/spec/journal.md`**

In the Event Vocabulary table, extend the `deliverable.shipped` payload cell to `…, platform?, lab_note?` and add one sentence after the deliverables bullet in § Releases, Compaction & Growth:

> A deliverable born from a merged PR's Lab Note carries the full note under `lab_note` (`en` required, `fr`/`suggested` optional) — the bilingual half exists so downstream projections (the pollen feed) keep both languages.

- [ ] **Step 5: Verify**

Run: `npm run test:emit && npm run test:journal && npx tsc --noEmit`
Expected: all PASS, tsc clean.

- [ ] **Step 6: Commit**

```bash
git add packages/schema/src/journal.ts packages/schema/src/journal-events.ts packages/schema/src/bundle.ts docs/spec/journal.md tests/schema/emit.test.js
git commit -m "feat(schema): lab_note on deliverable.shipped, pollen.plant on project metadata"
```

## Task 3: The journal→pollen projection (arkaik)

Pure function, fixture-tested, validating every envelope it emits through the vendored contract — skip-and-report on anything the contract refuses.

**Files:**
- Create: `lib/pollen/map.ts`
- Test: `tests/app/pollen-map.test.js`
- Modify: `package.json`, `.github/workflows/ci.yml` (register `test:pollen-map` in the build job)

- [ ] **Step 1: Write the failing test `tests/app/pollen-map.test.js`**

```js
#!/usr/bin/env node
// journal→pollen projection (lib/pollen/map.ts) — the arkaik adapter's core.
// Spec: ariko docs/superpowers/specs/2026-08-15-arkaik-adapter-design.md §3.
const { loadPollen } = require("./load-pollen");

const { contract, map } = loadPollen();
const { journalToPollen } = map;
const { validatePollen } = contract;

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log(`PASS: ${name}`);
  else { failures++; console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`); }
}

const CONFIG = { plant: "pbbls" };
const NODES = [{ id: "DEC-postgres-first", species: "decision", title: "PostgreSQL-first relational schema", status: "live" }];

// --- unmapped families are silently absent (not skipped-with-reason) ---
{
  const { pollen, skipped } = journalToPollen(
    [
      { id: "01A", ts: "2026-08-01T10:00:00Z", type: "node.created", node_id: "V-x", species: "view", title: "X" },
      { id: "01B", ts: "2026-08-01T10:01:00Z", type: "edge.added", edge_id: "e1", source_id: "a", target_id: "b", edge_type: "composes" },
      { id: "01C", ts: "2026-08-01T10:02:00Z", type: "idea.proposed", title: "an idea" },
    ],
    NODES, CONFIG,
  );
  check("graph noise unmapped", pollen.length === 0 && skipped.length === 0);
}

// --- deliverable.shipped → shipped ---
{
  const events = [
    { id: "01D", ts: "2026-08-02T10:00:00Z", type: "deliverable.shipped", deliverable_id: "pr-23",
      title: "Your path, laid out day by day", summary: "Grouped by day.", url: "https://github.com/x/pbbls/pull/23",
      node_ids: ["V-timeline"] },
  ];
  const { pollen } = journalToPollen(events, NODES, CONFIG);
  const p = pollen[0];
  check("shipped kind", p.kind === "shipped");
  check("shipped id", p.id === "arkaik:01D");
  check("shipped at = event ts", p.at === "2026-08-02T10:00:00Z");
  check("shipped source", p.source === "arkaik");
  check("shipped anchor", p.anchors.plant === "plant:pbbls");
  check("shipped title from event", p.title === "Your path, laid out day by day");
  check("shipped PR ref", p.refs.some((r) => r.label === "pull request" && r.url === "https://github.com/x/pbbls/pull/23"));
  check("shipped deliverable ref", p.refs.some((r) => r.label === "deliverable" && r.ref === "pr-23"));
  check("shipped payload", p.payload.summary === "Grouped by day." && p.payload.node_ids[0] === "V-timeline");
  check("shipped validates", validatePollen(p).ok && validatePollen(p).warnings.length === 0);
}

// --- bilingual title from lab_note ---
{
  const events = [
    { id: "01E", ts: "2026-08-02T11:00:00Z", type: "deliverable.shipped", deliverable_id: "pr-24",
      title: "Fallback", summary: "en summary", url: "https://github.com/x/pbbls/pull/24",
      lab_note: { en: { title: "Benefit first", summary: "en summary" }, fr: { title: "Bénéfice d'abord", summary: "résumé fr" },
        suggested: { molecule: "pbbls", type: "feature" } } },
  ];
  const { pollen } = journalToPollen(events, NODES, CONFIG);
  const p = pollen[0];
  check("bilingual title", p.title.en === "Benefit first" && p.title.fr === "Bénéfice d'abord");
  check("suggested in payload", p.payload.suggested.molecule === "pbbls");
  check("fr summary in payload", p.payload.summary_fr === "résumé fr");
  check("bilingual validates", validatePollen(p).ok);
}

// --- re-append = corrects envelope ---
{
  const events = [
    { id: "01F", ts: "2026-08-03T10:00:00Z", type: "deliverable.shipped", deliverable_id: "pr-25", title: "First", url: "https://x/pull/25" },
    { id: "01G", ts: "2026-08-03T11:00:00Z", type: "deliverable.shipped", deliverable_id: "pr-25", title: "First, edited", url: "https://x/pull/25" },
  ];
  const { pollen } = journalToPollen(events, NODES, CONFIG);
  check("both occurrences emitted", pollen.length === 2);
  check("first has no corrects", !pollen[0].refs.some((r) => r.label === "corrects"));
  check("second corrects first", pollen[1].refs.some((r) => r.label === "corrects" && r.ref === "arkaik:01F"));
}

// --- release.tagged ---
{
  const events = [
    { id: "01H", ts: "2026-08-04T10:00:00Z", type: "release.tagged", version: "1.3.0", notes: "Big one.", platform: "web" },
  ];
  const { pollen } = journalToPollen(events, NODES, CONFIG);
  const p = pollen[0];
  check("release kind", p.kind === "release.tagged");
  check("release title", p.title === "1.3.0 released (web)");
  check("release payload", p.payload.version === "1.3.0" && p.payload.notes === "Big one." && p.payload.platform === "web");
  check("release validates", validatePollen(p).ok);
}

// --- decision approved → decided; other transitions unmapped ---
{
  const events = [
    { id: "01J", ts: "2026-08-05T10:00:00Z", type: "decision.status_changed", node_id: "DEC-postgres-first", from: "proposed", to: "approved" },
    { id: "01K", ts: "2026-08-05T11:00:00Z", type: "decision.status_changed", node_id: "DEC-postgres-first", from: "approved", to: "enacted" },
    { id: "01L", ts: "2026-08-05T12:00:00Z", type: "decision.status_changed", node_id: "DEC-gone", from: "proposed", to: "approved" },
  ];
  const { pollen } = journalToPollen(events, NODES, CONFIG);
  check("only approved maps", pollen.length === 2);
  check("decided kind", pollen[0].kind === "decided");
  check("decided title from snapshot", pollen[0].title === "PostgreSQL-first relational schema");
  check("decided ref", pollen[0].refs.some((r) => r.label === "decision" && r.ref === "DEC-postgres-first"));
  check("deleted node falls back to id", pollen[1].title === "DEC-gone");
  check("decided validates", validatePollen(pollen[0]).ok);
}

// --- an inexpressible event is skipped with a reason, never thrown ---
{
  const events = [
    { id: "01M", ts: "not-a-timestamp", type: "release.tagged", version: "1.4.0" },
  ];
  const { pollen, skipped } = journalToPollen(events, NODES, CONFIG);
  check("invalid event skipped", pollen.length === 0 && skipped.length === 1 && skipped[0].id === "01M");
  check("skip carries the validator's reason", typeof skipped[0].reason === "string" && skipped[0].reason.length > 0);
}

process.exit(failures ? 1 : 0);
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/app/pollen-map.test.js`
Expected: crash — `map` is null (no `lib/pollen/map.ts` yet).

- [ ] **Step 3: Implement `lib/pollen/map.ts`**

```ts
// journal → pollen: the arkaik adapter's projection (slice 3).
// Pure — no DB, no network. Every emitted envelope is run through the
// vendored validator; anything it refuses is skipped WITH a reason, so the
// route can log it (umbrella §11: no silent loss) and a test can see it.
import type { JournalEvent, Node } from "@arkaik/schema";
import { validatePollen, type Pollen } from "./contract";

export interface PollenMapConfig {
  /** ariko plant slug — anchors become `plant:<slug>`. */
  plant: string;
}

export interface MappedFeed {
  pollen: Pollen[];
  skipped: { id: string; reason: string }[];
}

const SOURCE = "arkaik";

export function journalToPollen(
  events: readonly JournalEvent[],
  nodes: readonly Pick<Node, "id" | "title">[],
  config: PollenMapConfig,
): MappedFeed {
  const titles = new Map(nodes.map((n) => [n.id, n.title]));
  /** deliverable_id → pollen id of its FIRST occurrence (corrects target). */
  const firstOccurrence = new Map<string, string>();
  const plant = `plant:${config.plant}`;
  const pollen: Pollen[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const event of events) {
    const candidate = mapEvent(event, plant, titles, firstOccurrence);
    if (candidate === null) continue; // unmapped family — by design, not an error
    const result = validatePollen(candidate);
    if (!result.ok) {
      skipped.push({ id: String(event.id ?? "?"), reason: result.error });
      continue;
    }
    pollen.push(result.value);
  }
  return { pollen, skipped };
}

function mapEvent(
  event: JournalEvent,
  plant: string,
  titles: Map<string, string>,
  firstOccurrence: Map<string, string>,
): Record<string, unknown> | null {
  const base = { v: 1, id: `arkaik:${event.id}`, at: event.ts, source: SOURCE, anchors: { plant } };

  if (event.type === "deliverable.shipped") {
    const deliverableId = String(event.deliverable_id);
    const note = event.lab_note as
      | { en: { title: string; summary: string }; fr?: { title?: string; summary?: string }; suggested?: Record<string, unknown> }
      | undefined;
    const title =
      note?.fr?.title ? { en: note.en.title, fr: note.fr.title } : note?.en.title ?? (event.title as string);
    const refs: Record<string, unknown>[] = [];
    if (typeof event.url === "string" && event.url) refs.push({ label: "pull request", url: event.url });
    refs.push({ label: "deliverable", ref: deliverableId });
    const first = firstOccurrence.get(deliverableId);
    if (first) refs.push({ label: "corrects", ref: first });
    else firstOccurrence.set(deliverableId, `arkaik:${event.id}`);
    const payload: Record<string, unknown> = {};
    if (typeof event.summary === "string") payload.summary = event.summary;
    if (note?.fr?.summary) payload.summary_fr = note.fr.summary;
    if (note?.suggested) payload.suggested = note.suggested;
    if (Array.isArray(event.node_ids)) payload.node_ids = event.node_ids;
    return { ...base, kind: "shipped", title, refs, payload };
  }

  if (event.type === "release.tagged") {
    const platform = typeof event.platform === "string" ? event.platform : undefined;
    const payload: Record<string, unknown> = { version: event.version };
    if (platform) payload.platform = platform;
    if (typeof event.notes === "string") payload.notes = event.notes;
    return {
      ...base,
      kind: "release.tagged",
      title: platform ? `${event.version} released (${platform})` : `${event.version} released`,
      payload,
    };
  }

  if (event.type === "decision.status_changed" && event.to === "approved") {
    const nodeId = String(event.node_id);
    return {
      ...base,
      kind: "decided",
      title: titles.get(nodeId) ?? nodeId,
      refs: [{ label: "decision", ref: nodeId }],
      payload: { from: event.from, to: event.to },
    };
  }

  return null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node tests/app/pollen-map.test.js`
Expected: all PASS. Also `npx tsc --noEmit` clean.

- [ ] **Step 5: Register and commit**

`package.json`: `"test:pollen-map": "node tests/app/pollen-map.test.js"`. `ci.yml`: step in the build job next to `test:pollen-conformance`.

```bash
git add lib/pollen/map.ts tests/app/pollen-map.test.js package.json .github/workflows/ci.yml
git commit -m "feat(pollen): journal→pollen projection with corrects refs and skip-reporting"
```

## Task 4: The feed route (arkaik)

**Files:**
- Create: `app/api/graph/projects/[projectId]/pollen/route.ts`
- Test: `tests/services/pollen-feed.test.js` + `tests/services/load-pollen-feed.js`
- Modify: `package.json`, `.github/workflows/ci.yml` (the **Postgres** job, next to `test:graph`)

- [ ] **Step 1: Write the failing integration test**

Create `tests/services/load-pollen-feed.js` by copying `tests/services/load-graph-api.js` and adding the new route file to its module list (open that loader first and follow its structure exactly — it already transpiles `lib/services/graph/*` and stubs `next/server`; add `app/api/graph/projects/[projectId]/pollen/route.ts` and `lib/pollen/*.ts` the same way the graph routes are listed).

Create `tests/services/pollen-feed.test.js` modeled on `tests/services/graph-api.test.js` (real Postgres, house PASS/FAIL). Scenarios, in order, against one seeded project owned by token A:

```js
// Seed: create a project via the store (as graph-api.test.js does), set
// snapshot.project.metadata.pollen = { plant: "pbbls" }, and insert journal
// events via applyMutation/direct graph_events inserts:
//   e1 deliverable.shipped pr-1  (with lab_note en+fr)
//   e2 release.tagged 1.0.0
//   e3 node.created (noise — must not appear)
//   e4 deliverable.shipped pr-1  (re-append/edit)
//
// Checks:
//   1. no token                          → 401
//   2. token without graph:read          → 403
//   3. other owner's token               → 404
//   4. project with NO metadata.pollen   → 404 (feed is opt-in)
//   5. full read: GET …/pollen           → 200, pollen.length === 3 (e1, e2, e4),
//      order is journal server order, e4 carries corrects ref to e1's pollen id,
//      every envelope passes the vendored validatePollen
//   6. paging: ?limit=1 → [e1]; ?after=<e1 pollen id>&limit=10 → [e2, e4]
//   7. caught up: ?after=<e4 pollen id> → 200, []
//   8. unknown cursor: ?after=arkaik:NOPE → 410
//   9. limit is capped: ?limit=999 behaves as 200-cap (no error)
```

Write these as real assertions with the same client/seeding helpers `graph-api.test.js` uses (read it first; reuse its token-minting and project-creation code verbatim).

- [ ] **Step 2: Run to verify it fails**

Run: `DATABASE_URL=… node tests/services/pollen-feed.test.js` (same env the other services tests document at the top of `graph-api.test.js`).
Expected: FAIL — route module missing.

- [ ] **Step 3: Implement the route**

`app/api/graph/projects/[projectId]/pollen/route.ts`:

```ts
import { getCaller, hasScope } from "@/lib/services/auth";
import { servicesConfigured, servicesUnavailable } from "@/lib/services/db";
import { getJournal, getProject } from "@/lib/services/graph/store";
import { journalToPollen } from "@/lib/pollen/map";

/**
 * GET /api/graph/projects/{projectId}/pollen?after=<id>&limit=<n>
 *
 * The arkaik adapter's report verb (ariko docs/POLLEN.md § Report, HTTP
 * transport): this project's journal, projected to pollen envelopes, in the
 * journal's server order. Opt-in — a project without
 * `project.metadata.pollen.plant` serves the same 404 as a project that does
 * not exist, so the feed cannot be used to probe for ids either.
 *
 * Not `graphReadRoute` because the contract needs two things it doesn't have:
 * query-parameter paging and the 410-Gone cursor reset.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  if (!servicesConfigured()) return servicesUnavailable("Graph");

  const caller = await getCaller(req);
  if (!caller) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!hasScope(caller, "graph:read")) {
    return Response.json({ error: "insufficient_scope", required: "graph:read" }, { status: 403 });
  }

  const { projectId } = await params;
  const url = new URL(req.url);
  const after = url.searchParams.get("after");
  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;

  try {
    const found = await getProject(projectId, caller.ownerIds);
    if (!found) return Response.json({ error: "not_found" }, { status: 404 });

    const plant = found.bundle.project.metadata?.pollen?.plant;
    if (typeof plant !== "string" || !plant) {
      // Feed not enabled — indistinguishable from no project.
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    const events = (await getJournal(projectId, caller.ownerIds)) ?? [];
    const { pollen, skipped } = journalToPollen(events, found.bundle.nodes, { plant });
    for (const s of skipped) {
      console.warn(`[pollen] ${projectId}: skipped event ${s.id}: ${s.reason}`);
    }

    let start = 0;
    if (after !== null) {
      const index = pollen.findIndex((p) => p.id === after);
      // Unknown cursor → 410: the consumer drops its cursor and rebuilds from
      // the start (docs/POLLEN.md § Report). Happens legitimately after a
      // bundle restore replaced the journal.
      if (index === -1) return Response.json({ error: "unknown_cursor" }, { status: 410 });
      start = index + 1;
    }
    return Response.json({ pollen: pollen.slice(start, start + limit) }, { status: 200 });
  } catch (err) {
    console.error("[pollen] GET feed failed:", err instanceof Error ? err.message : "unknown error");
    return Response.json({ error: "internal_error", message: "Failed to load pollen feed." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `DATABASE_URL=… node tests/services/pollen-feed.test.js`
Expected: all PASS. `npx tsc --noEmit` clean.

- [ ] **Step 5: Register and commit**

`package.json`: `"test:pollen-feed": "node tests/services/pollen-feed.test.js"`. `ci.yml`: add `run: npm run test:pollen-feed` in the **services/Postgres** job (after `npm run test:graph`).

```bash
git add "app/api/graph/projects/[projectId]/pollen" tests/services/pollen-feed.test.js tests/services/load-pollen-feed.js package.json .github/workflows/ci.yml
git commit -m "feat(pollen): per-project feed endpoint with cursor paging and 410 reset"
```

## Task 5: Lab Note parsing (arkaik, pure half)

Same contract as ariko's `scripts/lab-note/lib.mjs`: section heading starts with `## Lab Note`, exactly one ```` ```yaml ```` fence, `en.title`/`en.summary` required, unknown top-level keys ignored. Read ariko's `lib.mjs` first and port its extraction/validation behavior; use arkaik's existing `yaml` dependency for parsing.

**Files:**
- Create: `lib/services/github/lab-note-parse.ts` (no `server-only`, no DB — pure)
- Test: `tests/services/lab-note-parse.test.js` + `tests/services/load-lab-note-parse.js`
- Modify: `package.json`, `.github/workflows/ci.yml` (**build** job — no Postgres needed)

- [ ] **Step 1: Write the failing test**

Loader: copy the `load-decision-utils.js` idiom for `lib/services/github/lab-note-parse.ts` (its only import is `yaml`, which `require` resolves from root `node_modules` — no rewrite needed).

`tests/services/lab-note-parse.test.js` cases:

```js
// extractLabNoteYaml
//  - body without "## Lab Note"                        → null
//  - "## Lab Notes and more" heading (startsWith)      → extracts
//  - section ends at the next "## " heading
//  - no yaml fence in the section                      → { error } mentioning the fence count
//  - two yaml fences in the section                    → { error } mentioning the fence count
// parseLabNote
//  - full note (en+fr+suggested, quoted colons: "Heads up: it moved") → ok, values intact
//  - missing en.title                                  → { ok:false, error: "en.title is required" }
//  - missing en.summary                                → error naming en.summary
//  - fr optional; suggested optional; unknown top-level key ignored
//  - YAML syntax error (unquoted colon)                → ok:false with a parse error, not a throw
```

Write each as a concrete body string and assertion (house PASS/FAIL pattern). Example body:

````js
const FULL = [
  "Some PR description.",
  "",
  "## Lab Note",
  "",
  "```yaml",
  'en:',
  '  title: "Heads up: it moved"',
  '  summary: "The button lives in the toolbar now."',
  'fr:',
  '  title: "Attention : ça a bougé"',
  '  summary: "Le bouton vit dans la barre d\'outils."',
  'suggested:',
  '  molecule: pbbls',
  '  type: improvement',
  "```",
  "",
  "## Another section",
].join("\n");
````

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/services/lab-note-parse.test.js` → module missing.

- [ ] **Step 3: Implement `lib/services/github/lab-note-parse.ts`**

```ts
// The Lab Note contract, arkaik side (slice 3) — the same wire contract as
// ariko's scripts/lab-note/lib.mjs: a "## Lab Note" section with exactly one
// yaml fence; en.title/en.summary required; fr/suggested optional; unknown
// top-level keys ignored. Pure: parsing only, no I/O.
import { parse as parseYaml } from "yaml";

export interface LabNote {
  en: { title: string; summary: string };
  fr?: { title?: string; summary?: string };
  suggested?: Record<string, unknown>;
}

export type LabNoteResult = { ok: true; note: LabNote } | { ok: false; error: string };

/**
 * The `## Lab Note` section's yaml fence content. `null` means the body has
 * no such section (the no-note case, not an error); a section with anything
 * other than exactly one fence is an error.
 */
export function extractLabNoteYaml(body: string): { yaml: string } | { error: string } | null {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith("## Lab Note"));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) { end = i; break; }
  }
  const section = lines.slice(start + 1, end).join("\n");
  const fences = [...section.matchAll(/```yaml\n([\s\S]*?)```/g)];
  if (fences.length !== 1) {
    return { error: `expected exactly one \`\`\`yaml fence in the Lab Note section, found ${fences.length}` };
  }
  return { yaml: fences[0][1] };
}

function nonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function parseLabNote(yamlText: string): LabNoteResult {
  let raw: unknown;
  try {
    raw = parseYaml(yamlText);
  } catch (err) {
    return { ok: false, error: `YAML parse error: ${err instanceof Error ? err.message : "unknown"}` };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "Lab Note must be a YAML mapping" };
  }
  const value = raw as Record<string, unknown>;
  const en = value.en as Record<string, unknown> | undefined;
  if (!en || typeof en !== "object") return { ok: false, error: "en is required" };
  if (!nonEmpty(en.title)) return { ok: false, error: "en.title is required" };
  if (!nonEmpty(en.summary)) return { ok: false, error: "en.summary is required" };

  const note: LabNote = { en: { title: en.title.trim(), summary: en.summary.trim() } };
  const fr = value.fr as Record<string, unknown> | undefined;
  if (fr && typeof fr === "object") {
    const frOut: { title?: string; summary?: string } = {};
    if (nonEmpty(fr.title)) frOut.title = fr.title.trim();
    if (nonEmpty(fr.summary)) frOut.summary = fr.summary.trim();
    if (frOut.title || frOut.summary) note.fr = frOut;
  }
  const suggested = value.suggested;
  if (suggested && typeof suggested === "object" && !Array.isArray(suggested)) {
    note.suggested = suggested as Record<string, unknown>;
  }
  return { ok: true, note };
}
```

Before finalizing, diff behavior against ariko's `lib.mjs` (fence handling, heading match, required-field error wording) and align wording where cheap — the two parsers implement one contract.

- [ ] **Step 4: Run to verify it passes**

Run: `node tests/services/lab-note-parse.test.js` → all PASS; `npx tsc --noEmit` clean.

- [ ] **Step 5: Register and commit**

`package.json`: `"test:lab-note-parse": "node tests/services/lab-note-parse.test.js"`; `ci.yml` build job step.

```bash
git add lib/services/github/lab-note-parse.ts tests/services/lab-note-parse.test.js tests/services/load-lab-note-parse.js package.json .github/workflows/ci.yml
git commit -m "feat(github): Lab Note extraction + parsing (ariko wire contract, TS port)"
```

## Task 6: Lab Note → journal append (arkaik, DB half + webhook wiring)

**Files:**
- Create: `lib/services/github/lab-note.ts`
- Modify: `lib/services/graph/store.ts` (add `appendJournalEvents`)
- Modify: `lib/services/github/pull-request.ts` (export `ownerIdsFor`)
- Modify: `app/api/github/webhook/route.ts:117-139` (call the handler, report outcomes)
- Test: `tests/services/lab-note-webhook.test.js` (+ loader, modeled on `github-webhook.test.js`)
- Modify: `package.json`, `.github/workflows/ci.yml` (Postgres job)

- [ ] **Step 1: Write the failing integration test**

Copy the harness bones of `tests/services/github-webhook.test.js` (signature signing, delivery ids, seeded project + `project_repos` link). Scenarios:

```js
// PR merged with a valid Lab Note (en+fr) in the body:
//   → exactly one graph_events row per linked project:
//     type deliverable.shipped, deliverable_id "pr-<n>", actor "github-app",
//     title/summary from en, url = PR html_url, lab_note carries fr+suggested
//   → response body's labNotes outcome says appended
// Redelivery of the SAME payload (new delivery id):
//   → no second row (content dedupe); outcome says unchanged
// Edited PR body redelivered (summary changed):
//   → a SECOND row with same deliverable_id (the correction path)
// Merged PR without a Lab Note section:
//   → no row; outcome no_note; acceptance handling untouched
// Merged PR with an INVALID note (missing en.summary):
//   → no row; outcome invalid with the parse error; response still 200
// Non-merged close:
//   → no lab-note handling at all
```

- [ ] **Step 2: Run to verify it fails**

Run: `DATABASE_URL=… node tests/services/lab-note-webhook.test.js` → fails (no handler).

- [ ] **Step 3: Add `appendJournalEvents` to the store**

In `lib/services/graph/store.ts`, next to `getJournal`:

```ts
/**
 * Append pre-stamped journal events WITHOUT touching the snapshot — the
 * journal-only write path (slice 3: the Lab Note webhook). Unlike
 * `applyMutation` there are no graph ops and no version bump: the snapshot is
 * authoritative for state and unchanged; the journal is authoritative for
 * history and grows. Owner-scoped like every other write.
 */
export async function appendJournalEvents(
  projectId: string,
  ownerIds: readonly string[],
  events: readonly JournalEvent[],
  actor: string,
): Promise<{ ok: true } | StoreFailure> {
  const { rows } = await query<{ id: string }>(
    `select id from graph_projects where id = $1 and owner_id = any($2::text[]) and archived_at is null`,
    [projectId, ownerIds],
  );
  if (rows.length === 0) return { ok: false, reason: "not_found" };
  for (const event of events) {
    await query(
      `insert into graph_events (id, project_id, event, actor) values ($1, $2, $3, $4)`,
      [event.id, projectId, JSON.stringify(event), actor],
    );
  }
  return { ok: true };
}
```

- [ ] **Step 4: Implement `lib/services/github/lab-note.ts`**

```ts
import "server-only";

import { makeEvent, type DeliverableShippedEvent } from "@arkaik/schema";
import { query } from "@/lib/services/db";
import { appendJournalEvents } from "@/lib/services/graph/store";
import { extractLabNoteYaml, parseLabNote, type LabNote } from "@/lib/services/github/lab-note-parse";
import { linkedProjects, ownerIdsFor, type PullRequestEvent } from "@/lib/services/github/pull-request";

/**
 * The Lab-Note-into-journal half of a merged-PR delivery (slice 3).
 *
 * Independent of acceptance promotion by design: a refused note never blocks
 * a status transition, and vice versa. Parse problems are OUTCOMES (logged,
 * reported in the delivery response, never fatal); only infrastructure
 * failures throw, so the webhook's existing claim-release/retry covers them —
 * and the content dedupe below makes the retry safe after a partial append.
 */
export type LabNoteOutcome =
  | { projectId: string; status: "appended"; eventId: string }
  | { projectId: string; status: "unchanged" }
  | { status: "no_note" }
  | { status: "invalid"; error: string };

export async function applyLabNote(event: PullRequestEvent): Promise<LabNoteOutcome[]> {
  const extracted = extractLabNoteYaml(event.body);
  if (extracted === null) return [{ status: "no_note" }];
  const parsed = "error" in extracted ? { ok: false as const, error: extracted.error } : parseLabNote(extracted.yaml);
  if (!parsed.ok) {
    console.warn(`[lab-note] ${event.repoFullName}#${event.number}: ${parsed.error}`);
    return [{ status: "invalid", error: parsed.error }];
  }

  const projectIds = [...new Set((await linkedProjects(event.repoFullName)).map((r) => r.projectId))];
  const outcomes: LabNoteOutcome[] = [];
  for (const projectId of projectIds) {
    outcomes.push(await appendToProject(projectId, event, parsed.note));
  }
  return outcomes;
}

/** The fields whose equality means "this re-delivery brings nothing new". */
function contentKey(payload: { title: string; summary?: string; url?: string; lab_note?: LabNote }): string {
  return JSON.stringify([payload.title, payload.summary ?? null, payload.url ?? null, payload.lab_note ?? null]);
}

async function appendToProject(projectId: string, event: PullRequestEvent, note: LabNote): Promise<LabNoteOutcome> {
  const deliverableId = `pr-${event.number}`;
  const payload = {
    deliverable_id: deliverableId,
    title: note.en.title,
    summary: note.en.summary,
    url: event.url,
    lab_note: note,
  };

  // Latest occurrence for this deliverable — byte-identical content is a
  // redelivery, not an edit, and must not grow the journal.
  const { rows } = await query<{ event: DeliverableShippedEvent }>(
    `select event from graph_events
      where project_id = $1 and event->>'type' = 'deliverable.shipped' and event->>'deliverable_id' = $2
      order by seq desc limit 1`,
    [projectId, deliverableId],
  );
  if (rows.length > 0) {
    const prev = rows[0].event;
    if (contentKey({ title: prev.title, summary: prev.summary, url: prev.url, lab_note: prev.lab_note as LabNote }) === contentKey(payload)) {
      return { projectId, status: "unchanged" };
    }
  }

  const journalEvent = makeEvent("deliverable.shipped", payload, { actor: "github-app" });
  const ownerIds = await ownerIdsFor(projectId);
  const result = await appendJournalEvents(projectId, ownerIds, [journalEvent], "github-app");
  if (!result.ok) {
    console.warn(`[lab-note] ${projectId}: append refused (${result.reason})`);
    return { projectId, status: "unchanged" };
  }
  return { projectId, status: "appended", eventId: journalEvent.id };
}
```

In `lib/services/github/pull-request.ts`, change `async function ownerIdsFor` (line ~2017) to `export async function ownerIdsFor`.

- [ ] **Step 5: Wire into the webhook route**

In `app/api/github/webhook/route.ts`, import `applyLabNote` and, inside the existing `try` right after `const outcomes = await applyPullRequestEvent(prEvent);` add:

```ts
    // The Lab-Note half runs only for a merge, inside the same try: a
    // transient failure releases the delivery claim and the retry redoes both
    // halves — both are idempotent (promotions by construction, notes by
    // content dedupe).
    const labNotes =
      prEvent.action === "closed" && prEvent.merged ? await applyLabNote(prEvent) : [];
```

and include `labNotes` in both success responses: `{ status: "ok", outcomes, labNotes, … }`.

- [ ] **Step 6: Run to verify it passes**

Run: `DATABASE_URL=… node tests/services/lab-note-webhook.test.js` and `DATABASE_URL=… node tests/services/github-webhook.test.js` (regressions).
Expected: all PASS. `npx tsc --noEmit` clean.

- [ ] **Step 7: Register and commit**

`package.json`: `"test:lab-note-webhook": "node tests/services/lab-note-webhook.test.js"`; `ci.yml` Postgres job step.

```bash
git add lib/services/github/lab-note.ts lib/services/graph/store.ts lib/services/github/pull-request.ts app/api/github/webhook/route.ts tests/services/lab-note-webhook.test.js tests/services/load-lab-note-webhook.js package.json .github/workflows/ci.yml
git commit -m "feat(github): merged-PR Lab Notes land in the journal as deliverable.shipped"
```

## Task 7: Federation settings panel (arkaik)

A plant-slug field on the project settings page, hosted projects only — sitting next to the Linked repositories panel.

**Files:**
- Create: `components/settings/FederationPanel.tsx`
- Modify: `app/project/[id]/settings/page.tsx` (render it under the Linked repositories section, same hosted-only condition as `RepoLinksPanel`)

- [ ] **Step 1: Read the neighbors**

Open `components/settings/RepoLinksPanel.tsx` and the settings page. Match their data-loading pattern (how the panel gets the project id and calls APIs) and their shadcn/ui composition.

- [ ] **Step 2: Implement `FederationPanel.tsx`**

A client component with one input (plant slug, placeholder `pbbls`, pattern `^[a-z0-9][a-z0-9-]*$`) and a save button. Save flow — **read-merge-write, because PATCH replaces `metadata` wholesale** (maps, products and display options live in it):

```tsx
// On save:
//  1. GET  /api/graph/projects/{id}          → current project (metadata included)
//  2. PATCH /api/graph/projects/{id} with
//     { project: { metadata: { ...current.metadata, pollen: slug ? { plant: slug } : undefined } } }
//     (omit the pollen key entirely to disable the feed)
//  3. Surface the result; on failure show the API's error string.
```

Copy explanatory copy into the card: "Serves this project's journal as a pollen feed for the Ariko federation. Leave empty to keep the feed off."

- [ ] **Step 3: Verify by hand**

Run: `npm run dev`, open a hosted project's settings, set a plant slug, save, then:

```bash
curl -H "Authorization: Bearer $ARKAIK_TOKEN" "http://localhost:3000/api/graph/projects/<prj_id>/pollen?limit=5"
```

Expected: `{"pollen":[…]}` (or `[]` for an empty journal); removing the slug returns the route to 404. Confirm an existing map/product still renders after the save (metadata merge, not clobber).

- [ ] **Step 4: Lint, build, commit**

Run: `npm run lint && npm run build` → clean.

```bash
git add components/settings/FederationPanel.tsx "app/project/[id]/settings/page.tsx"
git commit -m "feat(settings): federation panel — plant slug enables the pollen feed"
```

## Task 8: Arkaik docs (arkaik)

**Files:**
- Modify: `docs/spec/services.md` (new § Pollen feed under Hosted Graph Projects)
- Modify: `docs/hosted-projects.md` (short how-to section after the GitHub App part)
- Modify: `CLAUDE.md` (Lab Note section: posting mechanism note)

- [ ] **Step 1: `docs/spec/services.md` — normative section**

Add under the hosted-graph section, in the file's register:

```markdown
### Pollen feed

`GET /api/graph/projects/{projectId}/pollen?after=<id>&limit=<n>` — the
project's journal projected to pollen envelopes (the Ariko federation
contract; normative document lives in the ariko repo as `docs/POLLEN.md`,
reference validator vendored at `lib/pollen/contract.ts`).

- Opt-in: served only when `project.metadata.pollen.plant` is set; otherwise
  the same `not_found` a missing project produces.
- Auth: `graph:read`, owner-scoped — identical to `…/journal`.
- Order: journal server order. `after` is the last pollen id the consumer
  processed; an unknown `after` answers **410 Gone** (drop the cursor,
  rebuild). `limit` defaults to 100, capped at 200.
- Mapping (v1): `deliverable.shipped` → `shipped` (re-appends emit a
  `corrects` ref to the first occurrence), `release.tagged` →
  `release.tagged`, `decision.status_changed` into `approved` → `decided`.
  Everything else is not exported. Events the contract cannot express are
  skipped and logged, never a 500.
- A bundle restore replaces the journal; surviving ids keep their envelopes
  (event ULIDs are preserved), vanished cursors get the 410.
```

- [ ] **Step 2: `docs/hosted-projects.md` — how-to**

After the GitHub App sections:

```markdown
## Federation feed (optional)

A hosted project can serve its journal as a **pollen feed** — the transport
the Ariko federation reads. In the project's settings, set a **plant slug**
under Federation; the feed then answers at
`/api/graph/projects/{id}/pollen` for any token with `graph:read`.

While you're there: with the GitHub App installed, a merged PR whose body
carries a `## Lab Note` section also lands that note in the project's
journal as a `deliverable.shipped` event — which the feed serves as a
`shipped` envelope. No note, no event; a malformed note is reported in the
delivery response and never blocks acceptance promotion.
```

- [ ] **Step 3: `CLAUDE.md` — one paragraph in the Lab Note section**

After "Merging the PR posts it to the Ariko inbox automatically — no copy-paste.", replace that sentence with:

```markdown
Merging the PR lands it automatically — for this repo, the GitHub App
webhook appends it to the project's arkaik journal as a
`deliverable.shipped` event, and the Ariko federation reads it from the
pollen feed. (Repos not mapped to a hosted arkaik project still post
straight to the Ariko inbox via the reusable workflow.)
```

Leave the authoring contract untouched — the ritual survives.

- [ ] **Step 4: Commit**

```bash
git add docs/spec/services.md docs/hosted-projects.md CLAUDE.md
git commit -m "docs: pollen feed spec + how-to; Lab Note posting mechanism note"
```

## Task 9: Arkaik PR

- [ ] **Step 1: Full local gate**

Run: `npm run lint && npm run build && npx tsc --noEmit`, then every script touched: `npm run test:pollen-conformance && npm run test:pollen-map && npm run test:lab-note-parse && npm run test:emit && npm run test:journal`, and with a local Postgres the services ones: `test:pollen-feed`, `test:lab-note-webhook`, `test:github`, `test:graph`.

- [ ] **Step 2: Open the PR — with a Lab Note**

The PR ships user-facing capability (federation feed + settings panel). Body must carry (per arkaik CLAUDE.md, values always double-quoted):

````markdown
## Lab Note

```yaml
en:
  title: "Your project's story, served as a feed"
  summary: "Hosted projects can now publish their journal as a federation feed, and merged PRs' Lab Notes land straight in the journal."
fr:
  title: "L'histoire de ton projet, servie en flux"
  summary: "Tes projets hébergés peuvent maintenant publier leur journal en flux de fédération, et les Lab Notes de tes PRs fusionnées atterrissent directement dans le journal."
suggested:
  molecule: arkaik
  type: feature
  tags: [changelog]
```
````

(Fix the fr summary wording naturally when writing — no literal translation; check the PR's advisory comment after opening.)

- [ ] **Step 3: Merge when green; deploy arkaik.app** (its normal deploy path).

## Task 10: Ops checklist (manual — needs the account owner)

Nothing here is code; record outcomes in the PR/issue thread.

- [ ] **pbbls:** in the arkaik app, open the pbbls hosted project (`prj_5dDiZc-G6lseF3cb`) settings → Federation → plant slug `pbbls`. Verify: `curl -H "Authorization: Bearer $ARKAIK_TOKEN" "https://arkaik.app/api/graph/projects/prj_5dDiZc-G6lseF3cb/pollen?limit=3"` returns envelopes.
- [ ] **arkaik self-map:** create a hosted project for arkaik itself (the seed `seed/arkaik-self-map.json` exists — import it, or create empty; the journal starts with whatever the graph plane writes). Set plant slug `arkaik`. In the repo: `npx arkaik link --project <prj_…>` and commit `docs/arkaik/arkaik.json`.
- [ ] **GitHub App:** confirm the App is installed on `alexisbohns/pbbls` and install it on `alexisbohns/arkaik`; link the arkaik repo to the new project in the app's Repos panel.
- [ ] **Smoke test:** merge any small PR with a Lab Note in pbbls; confirm a `deliverable.shipped` row lands (journal endpoint) and the feed serves it as `shipped` with the bilingual title.

## Task 11: pbbls retirement (pbbls repo)

Only after Task 10's pbbls line is verified.

**Files:**
- Delete: `.github/workflows/lab-note.yml` (the stub calling ariko's reusable workflow — keep `lab-note-reminder.yml`)
- Modify: `CLAUDE.md` (Lab Note section)

- [ ] **Step 1:** `git rm .github/workflows/lab-note.yml`
- [ ] **Step 2:** In CLAUDE.md's Lab Note section, replace the "Merging the PR posts it to the Ariko inbox automatically" sentence with the same paragraph as arkaik's Task 8 Step 3 (webhook → journal → pollen feed), keeping the authoring contract and the reminder intact.
- [ ] **Step 3:** Commit, PR (no lab note — infra; add the `no-lab-note` label if the reminder nags), merge.

```bash
git checkout -b chore/lab-note-via-arkaik
git add -A && git commit -m "chore: lab notes now land in the arkaik journal via the GitHub App webhook"
```

## Task 12: Arkaik-repo retirement + ariko garden (two small PRs)

- [ ] **Step 1 (arkaik repo):** after Task 10's arkaik-self-map line is done — `git rm .github/workflows/lab-note.yml` (keep the reminder), commit `chore: lab notes land in our own journal via the webhook`, PR with the `no-lab-note` label, merge.

- [ ] **Step 2 (ariko repo): garden update.** In `data/garden.yml`:
  - `lab-note-pipeline` bee: remove `plant:pbbls` and `plant:arkaik` from `serves`; append to `description`: "Pbbls and Arkaik now report through the arkaik journal instead."
  - `arkaik-adapter` bee: keep `status: planned` (spec: live only when slice 4 reads the feed); set `engine: hosted-api`; fill levers:

```yaml
    levers:
      - label: pbbls feed
        url: https://arkaik.app/api/graph/projects/prj_5dDiZc-G6lseF3cb/pollen
      - label: arkaik feed
        url: https://arkaik.app/api/graph/projects/<prj_… from Task 10>/pollen
      - label: lab-note webhook
        ref: arkaik app/api/github/webhook
    description: Serves the arkaik journal as a pollen feed (slice 3); the Ariko read model ingests it in slice 4.
```

- [ ] **Step 3 (ariko repo): verify + PR.** Run ariko's checks (`npx tsc --noEmit && npm test` — the garden guard validates the YAML). Commit on a branch (`chore/garden-arkaik-adapter`), open a docs-only PR, **no lab note** (infra — label `no-lab-note` if the reminder comments), merge.

---

## Self-review notes (already applied)

- Spec §3 feed semantics → Task 4; §3 mapping table → Task 3; §3 conformance → Task 1; §4 webhook → Tasks 5–6; §5 config → Tasks 2 & 7; §6 retirement scope/order → Tasks 10–12; §7 docs → Task 8; §8 testing → each task's test steps; §9 acceptance → Tasks 9–10 gates.
- Names used across tasks: `journalToPollen` (T3, T4), `extractLabNoteYaml`/`parseLabNote`/`LabNote` (T5, T6), `applyLabNote` (T6 webhook wiring), `appendJournalEvents` (T6), `ownerIdsFor` export (T6), `metadata.pollen.plant` (T2, T4, T7, T8).
- Known judgment calls for the implementer: exact loader module lists (mirror the neighboring loaders), ariko `manifest.json` shape (check before Task 1 Step 5), the settings-page hosted-only condition (mirror `RepoLinksPanel`), fr copy in the arkaik PR's Lab Note.
