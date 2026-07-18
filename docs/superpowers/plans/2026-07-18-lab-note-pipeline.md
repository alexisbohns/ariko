# Lab Note Pipeline (C1 · GitHub connector) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merged PRs across the five repos post a bilingual Lab Note capture into the Ariko inbox automatically, via a reusable GitHub Actions workflow owned by ariko.

**Architecture:** A dependency-light Node script (`scripts/lab-note/`) extracts a `## Lab Note` YAML section from the live PR body, validates it, and POSTs to the existing `/api/inbox` (idempotent upsert on `owner/repo#N`). A reusable workflow (`.github/workflows/lab-note.yml`) checks out ariko@main and runs it; ariko itself dogfoods the same file via a `pull_request: closed` trigger. `Capture.title` widens from `string` to `Text` (the B1 pattern) so the French title survives capture.

**Tech Stack:** Next.js 15 / TS repo conventions; plain-JS ESM for the CI script (`js-yaml` only); `node --test` via the existing `npm test`; GitHub Actions `workflow_call` + `workflow_dispatch`.

**Spec:** `docs/superpowers/specs/2026-07-18-lab-note-pipeline-design.md`

**Deliberate deviations from the spec (approved rationale):**
1. Script lives at `scripts/lab-note/post.mjs` + `lib.mjs` (not a single `scripts/lab-note-post.mjs`): the directory is a tiny self-contained npm package (`js-yaml` only, own lockfile) so CI installs in ~2s via `npm ci --prefix scripts/lab-note` instead of installing the whole Next.js tree; pure functions get a clean test seam. Locally the repo root already has `js-yaml`, so tests run without the nested install.
2. The script fetches the PR body with native `fetch` + `GITHUB_TOKEN` (not a `gh api` subprocess). Same live-body freshness, no subprocess, and the CLI stays a thin shell.
3. Ariko's own caller stub is folded into the reusable workflow itself (`pull_request: types: [closed]` trigger on the same file) because the stub filename `.github/workflows/lab-note.yml` collides with the reusable workflow in this repo. Other repos keep the spec's ~10-line stub shape verbatim.

**Out of scope for this plan** (separate follow-up plans, per spec rollout steps 3–4): the `lab-note` authoring skill + plugin marketplace in ariko, the pbbls skill rewrite, and the caller-stub PRs to pbbls/femfolk/arkaik/melogram. Also out: media/screenshots (v2).

**Environment notes for executors:**
- Work on branch `claude/c1-lab-note` (already exists, holds the spec).
- `npm test` runs the full suite; DB-backed tests need `.env.local` with Atlas reachability (present on this machine). Gate every task on `npm test` (0 fail) and `npx tsc --noEmit` (clean).
- The Vercel project is named `beanstalk` (scope `bohns`) — never `vercel link` to anything else.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `lib/data.ts` | Modify | `Capture.title: string` → `Text` |
| `lib/inbox.ts` | Modify | `InboxInput.title: Text`; payload validator accepts `string \| { en?, fr? }` |
| `lib/inbox.test.ts` | Modify | New title-widening cases |
| `app/admin/page.tsx` | Modify | Render title via `resolveText` |
| `app/admin/triage/[id]/page.tsx` | Modify | Render via `resolveText`; per-language name prefills via `textPart` |
| `scripts/apply-validators.ts` | Modify | Mongo `$jsonSchema`: `title` accepts string or `{en,fr}` object |
| `scripts/lab-note/package.json` | Create | Nested package: `js-yaml` only |
| `scripts/lab-note/package-lock.json` | Create | Lockfile for `npm ci --prefix` |
| `scripts/lab-note/lib.mjs` | Create | Pure: extract / parse / map / classify |
| `scripts/lab-note/lib.test.mjs` | Create | Unit tests for the above |
| `scripts/lab-note/post.mjs` | Create | Thin CLI shell: fetch PR → run pures → POST |
| `.github/workflows/lab-note.yml` | Create | Reusable workflow + ariko self-trigger |
| `package.json` | Modify | Test glob gains `scripts/lab-note/*.test.mjs` |
| `README.md` | Modify | Lab Note pipeline section (contract, stub, rehearsal) |
| `docs/superpowers/ROADMAP.md` | Modify | C1 GitHub half → Shipped |

---

### Task 1: Widen `Capture.title` to `Text` (types + payload validator + admin surfaces)

The type change, validator, and admin render sites must land together or `tsc` breaks between commits.

**Files:**
- Modify: `lib/inbox.test.ts`
- Modify: `lib/inbox.ts`
- Modify: `lib/data.ts:97` (Capture interface)
- Modify: `app/admin/page.tsx`
- Modify: `app/admin/triage/[id]/page.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `lib/inbox.test.ts` (match the file's existing `test`/`assert` imports):

```ts
test("accepts a bilingual { en, fr } title and trims its parts", () => {
  const r = validateInboxPayload({
    title: { en: "  Relations ship  ", fr: " Les relations arrivent " },
    source: { kind: "github" },
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.value.title, { en: "Relations ship", fr: "Les relations arrivent" });
  }
});

test("accepts an fr-only object title", () => {
  const r = validateInboxPayload({ title: { fr: "Bonjour" }, source: { kind: "manual" } });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value.title, { fr: "Bonjour" });
});

test("drops blank-string title parts instead of storing them", () => {
  const r = validateInboxPayload({ title: { en: "Hi", fr: "   " }, source: { kind: "manual" } });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value.title, { en: "Hi" });
});

test("rejects junk titles", () => {
  const junk: unknown[] = [42, true, [], {}, { en: "" }, { fr: "   " }, { en: 42 }, { en: "ok", fr: 7 }];
  for (const title of junk) {
    assert.equal(
      validateInboxPayload({ title, source: { kind: "manual" } }).ok,
      false,
      `should reject title ${JSON.stringify(title)}`,
    );
  }
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test 2>&1 | tail -20`
Expected: the four new tests FAIL (object titles currently rejected / string-only), all pre-existing tests still pass.

- [ ] **Step 3: Implement the widening**

In `lib/data.ts`, change the `Capture` interface field (line ~97):

```ts
  title: Text; // bilingual since C1; plain strings remain valid (no migration)
```

In `lib/inbox.ts`:

1. Add `Text` to the type import:
```ts
import type { LocalizedText, Media, MediaImage, Source, CaptureSuggestion, Text } from "./data";
```
2. Change `InboxInput`:
```ts
export interface InboxInput {
  title: Text;
  body?: LocalizedText;
  content?: LocalizedText;
  media: Media[];
  source: Source;
  suggested?: CaptureSuggestion;
}
```
3. Add below `nonEmptyString`:
```ts
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
function normalizeTextInput(v: unknown): Text | null {
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
4. In `validateInboxPayload`, replace the title guard
   (`if (!nonEmptyString(body.title)) return { ok: false, error: "title is required" };`) with:
```ts
  const title = normalizeTextInput(body.title);
  if (title === null) return { ok: false, error: "title is required" };
```
   and in the `value` literal replace `title: (body.title as string).trim(),` with `title,`.

- [ ] **Step 4: Fix the two admin render sites (required for tsc)**

`app/admin/page.tsx`:
- Add import: `import { resolveText } from "@/lib/data";`
- In the inbox table row, change `{c.title}` to `{resolveText(c.title)}`.

`app/admin/triage/[id]/page.tsx` (already imports `resolveText, textPart`):
- Change `<h2>{capture.title}</h2>` to `<h2>{resolveText(capture.title)}</h2>`.
- Change the Name input to `defaultValue={textPart(capture.title, "en")}`.
- Give Name (fr) a prefill: `defaultValue={textPart(capture.title, "fr")}`.
- Leave the comment block above the name inputs untouched — "Prefills use the STRICT textPart" now describes the title prefills too.

- [ ] **Step 5: Run gates**

Run: `npm test 2>&1 | tail -5` — Expected: 0 fail (new tests pass).
Run: `npx tsc --noEmit` — Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add lib/inbox.ts lib/inbox.test.ts lib/data.ts app/admin/page.tsx "app/admin/triage/[id]/page.tsx"
git commit -m "feat: widen Capture.title to Text (C1) — bilingual titles at the inbox boundary"
```

---

### Task 2: Widen the Mongo `$jsonSchema` validator for `captures.title`

**Files:**
- Modify: `scripts/apply-validators.ts:32`

- [ ] **Step 1: Widen the schema**

In the `captures` validator, replace `title: { bsonType: "string" },` with:

```ts
      // Text since C1: plain string or { en?, fr? } — mirrors lib/inbox.ts normalizeTextInput.
      title: {
        oneOf: [
          { bsonType: "string" },
          {
            bsonType: "object",
            properties: { en: { bsonType: "string" }, fr: { bsonType: "string" } },
            additionalProperties: false,
          },
        ],
      },
```

- [ ] **Step 2: Apply to the live DB and verify**

Run: `npm run validators`
Expected output includes `validator applied: captures` … `atomic indexes ensured` and exit 0.

- [ ] **Step 3: Run gates**

Run: `npx tsc --noEmit` — Expected: clean. `npm test 2>&1 | tail -3` — Expected: 0 fail.

- [ ] **Step 4: Commit**

```bash
git add scripts/apply-validators.ts
git commit -m "feat: captures.title accepts Text in the DB validator"
```

---

### Task 3: `scripts/lab-note` package + section extraction (TDD)

**Files:**
- Create: `scripts/lab-note/package.json`
- Create: `scripts/lab-note/package-lock.json` (generated)
- Create: `scripts/lab-note/lib.mjs`
- Create: `scripts/lab-note/lib.test.mjs`
- Modify: `package.json:9` (test glob)

- [ ] **Step 1: Create the nested package**

`scripts/lab-note/package.json`:
```json
{
  "name": "ariko-lab-note",
  "private": true,
  "description": "Posts a merged PR's Lab Note section to the Ariko inbox. Run by .github/workflows/lab-note.yml; pure logic in lib.mjs, I/O shell in post.mjs.",
  "dependencies": {
    "js-yaml": "^4.1.0"
  }
}
```

Generate the lockfile (no node_modules locally — root already provides js-yaml):
```bash
npm install --prefix scripts/lab-note --package-lock-only --no-audit --no-fund
```

- [ ] **Step 2: Add the new test glob to the root test script**

In `package.json`, change the `test` script to:
```json
    "test": "node --import tsx --test \"lib/**/*.test.ts\" \"scripts/lab-note/*.test.mjs\"",
```

- [ ] **Step 3: Write the failing extraction tests**

`scripts/lab-note/lib.test.mjs`:
```js
import test from "node:test";
import assert from "node:assert/strict";
import { extractLabNoteYaml } from "./lib.mjs";

const F = "```";
const note = (heading, lines) => [heading, `${F}yaml`, ...lines, F].join("\n");

test("extractLabNoteYaml: null when there is no Lab Note section", () => {
  assert.equal(extractLabNoteYaml("## Summary\n\nJust a chore PR."), null);
  assert.equal(extractLabNoteYaml(""), null);
  assert.equal(extractLabNoteYaml(undefined), null);
});

test("extractLabNoteYaml: extracts the yaml fence from the section", () => {
  const body = ["## Summary", "stuff", note("## Lab Note", ["en:", "  title: Hello"]), "## After", "tail"].join("\n");
  assert.equal(extractLabNoteYaml(body), "en:\n  title: Hello");
});

test("extractLabNoteYaml: matches pbbls' '## Lab Note (EN/FR)' heading", () => {
  const body = note("## Lab Note (EN/FR)", ["en:", "  title: Hi"]);
  assert.equal(extractLabNoteYaml(body), "en:\n  title: Hi");
});

test("extractLabNoteYaml: the section ends at the next level-2 heading", () => {
  const body = ["## Lab Note", "prose only", "## Next", `${F}yaml`, "en:", F].join("\n");
  assert.equal(extractLabNoteYaml(body), null);
});

test("extractLabNoteYaml: a level-3 heading does not end the section", () => {
  const body = ["## Lab Note", "### context", `${F}yaml`, "en:", "  title: Hi", F].join("\n");
  assert.equal(extractLabNoteYaml(body), "en:\n  title: Hi");
});

test("extractLabNoteYaml: first fence wins when the section holds several", () => {
  const body = ["## Lab Note", `${F}yaml`, "a: 1", F, `${F}yaml`, "b: 2", F].join("\n");
  assert.equal(extractLabNoteYaml(body), "a: 1");
});

test("extractLabNoteYaml: null on an unterminated fence", () => {
  const body = ["## Lab Note", `${F}yaml`, "en:"].join("\n");
  assert.equal(extractLabNoteYaml(body), null);
});

test("extractLabNoteYaml: handles CRLF bodies (GitHub sends \\r\\n)", () => {
  const body = ["## Lab Note", `${F}yaml`, "en:", "  title: Hi", F].join("\r\n");
  assert.equal(extractLabNoteYaml(body), "en:\n  title: Hi");
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test 2>&1 | tail -10`
Expected: FAIL — `lib.mjs` does not exist / `extractLabNoteYaml` undefined. Existing suites still pass.

- [ ] **Step 5: Implement extraction**

`scripts/lab-note/lib.mjs`:
```js
// Pure logic for the Lab Note pipeline (spec: docs/superpowers/specs/2026-07-18-lab-note-pipeline-design.md).
// No I/O here — post.mjs is the only file that touches the network.
import yaml from "js-yaml";

// The gate (spec §3): a level-2 heading starting with "## Lab Note" opens the
// section; the next level-2 heading (or EOF) closes it. First ```yaml fence
// inside wins; extra fences are ignored. Returns the fence body or null.
export function extractLabNoteYaml(prBody) {
  if (typeof prBody !== "string" || prBody === "") return null;
  const lines = prBody.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+Lab Note/.test(l));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const section = lines.slice(start + 1, end);
  const fenceStart = section.findIndex((l) => /^\s*```ya?ml\s*$/.test(l));
  if (fenceStart === -1) return null;
  const rest = section.slice(fenceStart + 1);
  const fenceLen = rest.findIndex((l) => /^\s*```\s*$/.test(l));
  if (fenceLen === -1) return null;
  return rest.slice(0, fenceLen).join("\n");
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test 2>&1 | tail -5`
Expected: 0 fail.

- [ ] **Step 7: Commit**

```bash
git add scripts/lab-note/package.json scripts/lab-note/package-lock.json scripts/lab-note/lib.mjs scripts/lab-note/lib.test.mjs package.json
git commit -m "feat: lab-note package + PR-body section extraction (C1)"
```

---

### Task 4: Lab Note parsing, payload mapping, response classification (TDD)

**Files:**
- Modify: `scripts/lab-note/lib.test.mjs`
- Modify: `scripts/lab-note/lib.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/lab-note/lib.test.mjs` (extend the import line to
`import { extractLabNoteYaml, parseLabNote, buildInboxPayload, classifyResponse } from "./lib.mjs";`):

```js
const VALID = [
  "en:",
  "  title: Relations join the public graph",
  "  summary: One or two sentences, user-facing.",
  "fr:",
  "  title: Les relations rejoignent le graphe",
  "  summary: Une ou deux phrases.",
  "suggested:",
  "  molecule: ariko",
  "  atom: public-graph",
  "  type: feature",
  "  tags: [changelog, graph]",
].join("\n");

test("parseLabNote: accepts the full core schema", () => {
  const r = parseLabNote(VALID);
  assert.equal(r.ok, true);
  assert.deepEqual(r.note, {
    en: { title: "Relations join the public graph", summary: "One or two sentences, user-facing." },
    fr: { title: "Les relations rejoignent le graphe", summary: "Une ou deux phrases." },
    suggested: { molecule: "ariko", atom: "public-graph", type: "feature", tags: ["changelog", "graph"] },
  });
});

test("parseLabNote: tolerates the pbbls superset (unknown keys ignored)", () => {
  const superset = VALID + "\nspecies: app\nplatform: ios\npublished: true\nrelease-date: 2026-08-01";
  const r = parseLabNote(superset);
  assert.equal(r.ok, true);
  assert.equal(r.note.en.title, "Relations join the public graph");
  assert.equal("species" in r.note, false);
});

test("parseLabNote: en-only note is valid, fr defaults empty", () => {
  const r = parseLabNote("en:\n  title: Hi\n  summary: A note.");
  assert.equal(r.ok, true);
  assert.deepEqual(r.note.fr, {});
  assert.equal("suggested" in r.note, false);
});

test("parseLabNote: names the exact problem", () => {
  assert.match(parseLabNote("en: [broken").error, /invalid YAML/);
  assert.match(parseLabNote("- just\n- a list").error, /mapping/);
  assert.match(parseLabNote("fr:\n  title: Salut").error, /en\.title/);
  assert.match(parseLabNote("en:\n  title: Hi").error, /en\.summary/);
  assert.match(parseLabNote("en:\n  title: ''\n  summary: s").error, /en\.title/);
});

test("parseLabNote: junk suggested entries are dropped, not fatal", () => {
  const r = parseLabNote("en:\n  title: Hi\n  summary: S.\nsuggested:\n  tags: [1, 2]\n  molecule: 42");
  assert.equal(r.ok, true);
  assert.equal("suggested" in r.note, false);
});

test("buildInboxPayload: full bilingual mapping (spec §4)", () => {
  const { note } = parseLabNote(VALID);
  const p = buildInboxPayload(note, { repo: "alexisbohns/pbbls", number: 12, url: "https://github.com/alexisbohns/pbbls/pull/12" });
  assert.deepEqual(p, {
    title: { en: "Relations join the public graph", fr: "Les relations rejoignent le graphe" },
    body: { en: "One or two sentences, user-facing.", fr: "Une ou deux phrases." },
    source: { kind: "github", url: "https://github.com/alexisbohns/pbbls/pull/12", externalId: "alexisbohns/pbbls#12" },
    suggested: { moleculeSlug: "ariko", atomSlug: "public-graph", type: "feature", tags: ["changelog", "graph"] },
  });
});

test("buildInboxPayload: en-only note maps to a plain-string title", () => {
  const { note } = parseLabNote("en:\n  title: Hi\n  summary: A note.");
  const p = buildInboxPayload(note, { repo: "alexisbohns/ariko", number: 3, url: "u" });
  assert.equal(p.title, "Hi");
  assert.deepEqual(p.body, { en: "A note." });
  assert.equal(p.source.externalId, "alexisbohns/ariko#3");
  assert.equal("suggested" in p, false);
});

test("classifyResponse: maps /api/inbox statuses to outcomes (spec §7)", () => {
  assert.deepEqual(classifyResponse(201), { outcome: "posted", exitCode: 0 });
  assert.deepEqual(classifyResponse(200), { outcome: "updated", exitCode: 0 });
  assert.deepEqual(classifyResponse(400), { outcome: "rejected", exitCode: 2 });
  assert.deepEqual(classifyResponse(401), { outcome: "unauthorized", exitCode: 4 });
  assert.deepEqual(classifyResponse(403), { outcome: "unauthorized", exitCode: 4 });
  assert.deepEqual(classifyResponse(500), { outcome: "unreachable", exitCode: 3 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | tail -10`
Expected: new tests FAIL (`parseLabNote` undefined); extraction tests still pass.

- [ ] **Step 3: Implement**

Append to `scripts/lab-note/lib.mjs`:

```js
function nonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function isMapping(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Validates the harmonized contract (spec §3): en.title + en.summary required,
// fr recommended, suggested optional, unknown keys ignored (pbbls superset).
// CORE_SCHEMA for the same reason as lib/data.ts: unquoted dates stay strings.
export function parseLabNote(yamlText) {
  let doc;
  try {
    doc = yaml.load(yamlText, { schema: yaml.CORE_SCHEMA });
  } catch (err) {
    return { ok: false, error: `invalid YAML: ${err.message}` };
  }
  if (!isMapping(doc)) return { ok: false, error: "lab note must be a YAML mapping" };
  const en = isMapping(doc.en) ? doc.en : {};
  if (!nonEmptyString(en.title)) return { ok: false, error: "en.title is required" };
  if (!nonEmptyString(en.summary)) return { ok: false, error: "en.summary is required" };
  const fr = isMapping(doc.fr) ? doc.fr : {};
  const note = {
    en: { title: en.title.trim(), summary: en.summary.trim() },
    fr: {
      ...(nonEmptyString(fr.title) ? { title: fr.title.trim() } : {}),
      ...(nonEmptyString(fr.summary) ? { summary: fr.summary.trim() } : {}),
    },
  };
  if (isMapping(doc.suggested)) {
    const s = doc.suggested;
    const suggested = {
      ...(nonEmptyString(s.molecule) ? { molecule: s.molecule.trim() } : {}),
      ...(nonEmptyString(s.atom) ? { atom: s.atom.trim() } : {}),
      ...(nonEmptyString(s.type) ? { type: s.type.trim() } : {}),
      ...(Array.isArray(s.tags) && s.tags.length > 0 && s.tags.every((t) => nonEmptyString(t))
        ? { tags: s.tags.map((t) => t.trim()) }
        : {}),
    };
    if (Object.keys(suggested).length > 0) note.suggested = suggested;
  }
  return { ok: true, note };
}

// Maps a parsed note onto the POST /api/inbox payload (spec §4).
// pr: { repo: "owner/name", number, url }.
export function buildInboxPayload(note, pr) {
  const payload = {
    title: note.fr.title ? { en: note.en.title, fr: note.fr.title } : note.en.title,
    body: { en: note.en.summary, ...(note.fr.summary ? { fr: note.fr.summary } : {}) },
    source: { kind: "github", url: pr.url, externalId: `${pr.repo}#${pr.number}` },
  };
  if (note.suggested) {
    const { molecule, atom, type, tags } = note.suggested;
    payload.suggested = {
      ...(molecule ? { moleculeSlug: molecule } : {}),
      ...(atom ? { atomSlug: atom } : {}),
      ...(type ? { type } : {}),
      ...(tags ? { tags } : {}),
    };
  }
  return payload;
}

// Outcome/exit-code table (spec §7). 200 and 201 are both success; 400 means the
// payload was rejected by the inbox validator (should not happen after parseLabNote,
// so it fails loudly); anything else is a delivery problem worth a re-run.
export function classifyResponse(status) {
  if (status === 201) return { outcome: "posted", exitCode: 0 };
  if (status === 200) return { outcome: "updated", exitCode: 0 };
  if (status === 401 || status === 403) return { outcome: "unauthorized", exitCode: 4 };
  if (status === 400) return { outcome: "rejected", exitCode: 2 };
  return { outcome: "unreachable", exitCode: 3 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | tail -5`
Expected: 0 fail.

- [ ] **Step 5: Commit**

```bash
git add scripts/lab-note/lib.mjs scripts/lab-note/lib.test.mjs
git commit -m "feat: lab-note parsing, inbox payload mapping, outcome classification"
```

---

### Task 5: CLI shell `post.mjs`

**Files:**
- Create: `scripts/lab-note/post.mjs`

- [ ] **Step 1: Write the shell**

`scripts/lab-note/post.mjs`:
```js
#!/usr/bin/env node
// Thin I/O shell (spec §5.1) — all decisions live in lib.mjs. Reads env:
//   LAB_NOTE_REPO  owner/name of the repo whose PR fired (required)
//   LAB_NOTE_PR    PR number (required)
//   GITHUB_TOKEN   token able to read that PR (required)
//   ARIKO_URL      inbox origin (default https://www.ariko.app)
//   DRY_RUN        "true" prints the payload instead of posting
//   INBOX_TOKEN    bearer token for /api/inbox (required unless DRY_RUN)
// Exit codes: 0 posted/updated/skipped · 2 invalid note · 3 unreachable · 4 auth · 5 usage.
import { extractLabNoteYaml, parseLabNote, buildInboxPayload, classifyResponse } from "./lib.mjs";

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`lab-note: missing required env ${name}`);
    process.exit(5);
  }
  return v;
}

const repo = need("LAB_NOTE_REPO");
const prNumber = need("LAB_NOTE_PR");
const githubToken = need("GITHUB_TOKEN");
const arikoUrl = (process.env.ARIKO_URL || "https://www.ariko.app").replace(/\/+$/, "");
const dryRun = process.env.DRY_RUN === "true";

// Live body, not the event snapshot: editing a merged PR and re-running picks up the fix.
const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";
const prRes = await fetch(`${apiBase}/repos/${repo}/pulls/${prNumber}`, {
  headers: { authorization: `Bearer ${githubToken}`, accept: "application/vnd.github+json" },
});
if (!prRes.ok) {
  console.error(`lab-note: could not fetch PR ${repo}#${prNumber}: HTTP ${prRes.status}`);
  process.exit(3);
}
const pr = await prRes.json();

const yamlText = extractLabNoteYaml(pr.body ?? "");
if (yamlText === null) {
  console.log(`lab-note: skipped — no "## Lab Note" section in ${repo}#${prNumber}`);
  process.exit(0);
}

const parsed = parseLabNote(yamlText);
if (!parsed.ok) {
  console.error(`lab-note: invalid note in ${repo}#${prNumber}: ${parsed.error}`);
  console.error("lab-note: edit the merged PR's body and re-run this job (posting is idempotent).");
  process.exit(2);
}

const payload = buildInboxPayload(parsed.note, { repo, number: Number(prNumber), url: pr.html_url });

if (dryRun) {
  console.log(`lab-note: dry run — would POST to ${arikoUrl}/api/inbox:`);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

const inboxToken = need("INBOX_TOKEN");
let res;
try {
  res = await fetch(`${arikoUrl}/api/inbox`, {
    method: "POST",
    headers: { authorization: `Bearer ${inboxToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
} catch (err) {
  console.error(`lab-note: ${arikoUrl} unreachable: ${err.message} — re-run when it is back.`);
  process.exit(3);
}

const { outcome, exitCode } = classifyResponse(res.status);
const detail = await res.text();
if (exitCode === 0) {
  console.log(`lab-note: ${outcome} (HTTP ${res.status}) ${detail}`);
} else if (outcome === "unauthorized") {
  console.error(
    `lab-note: unauthorized (HTTP ${res.status}) — check this repo's ARIKO_INBOX_TOKEN secret and its github: scoping in Ariko's INBOX_TOKENS.`,
  );
} else {
  console.error(`lab-note: ${outcome} (HTTP ${res.status}) ${detail}`);
}
process.exit(exitCode);
```

- [ ] **Step 2: Smoke it locally (dry run, read-only)**

Run (PR #15 is merged and has no Lab Note section):
```bash
LAB_NOTE_REPO=alexisbohns/ariko LAB_NOTE_PR=15 DRY_RUN=true GITHUB_TOKEN=$(gh auth token) node scripts/lab-note/post.mjs; echo "exit=$?"
```
Expected: `lab-note: skipped — no "## Lab Note" section in alexisbohns/ariko#15` and `exit=0`.

Run the usage guard:
```bash
node scripts/lab-note/post.mjs; echo "exit=$?"
```
Expected: `lab-note: missing required env LAB_NOTE_REPO` and `exit=5`.

- [ ] **Step 3: Run gates**

Run: `npm test 2>&1 | tail -3` — Expected: 0 fail. `npx tsc --noEmit` — Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add scripts/lab-note/post.mjs
git commit -m "feat: lab-note CLI shell — live PR body fetch, dry-run, distinct exit codes"
```

---

### Task 6: Reusable workflow (+ ariko self-trigger)

**Files:**
- Create: `.github/workflows/lab-note.yml`

- [ ] **Step 1: Write the workflow**

`.github/workflows/lab-note.yml`:
```yaml
# Reusable Lab Note workflow (C1). Other repos call it @main via a ~10-line stub
# (see README "Lab Note pipeline"); ariko itself dogfoods the same file through
# the pull_request trigger below. Checking out ariko@main on every run is the
# freshness mechanism: callers always execute the current logic.
name: lab-note

on:
  workflow_call:
    inputs:
      ariko_url:
        description: Ariko origin to post to
        type: string
        required: false
        default: https://www.ariko.app
      dry_run:
        description: Print the payload instead of posting
        type: boolean
        required: false
        default: false
    secrets:
      inbox_token:
        required: true
  workflow_dispatch:
    inputs:
      pr_number:
        description: PR number to rehearse or backfill
        type: string
        required: true
      ariko_url:
        description: Ariko origin to post to
        type: string
        required: false
        default: https://www.ariko.app
      dry_run:
        description: Print the payload instead of posting
        type: boolean
        required: false
        default: true
  pull_request:
    types: [closed]

permissions:
  contents: read
  pull-requests: read

jobs:
  post:
    # Direct pull_request runs (ariko's own PRs) only proceed on merge; a called
    # run inherits the caller's event, so the same guard covers their PRs too.
    # workflow_dispatch passes through (backfill/rehearsal of any PR).
    if: github.event_name != 'pull_request' || github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          repository: alexisbohns/ariko
          ref: main
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci --prefix scripts/lab-note --no-audit --no-fund
      - name: Post lab note
        env:
          LAB_NOTE_REPO: ${{ github.repository }}
          LAB_NOTE_PR: ${{ inputs.pr_number || github.event.pull_request.number }}
          ARIKO_URL: ${{ inputs.ariko_url || 'https://www.ariko.app' }}
          DRY_RUN: ${{ inputs.dry_run == true && 'true' || 'false' }}
          GITHUB_TOKEN: ${{ github.token }}
          # inbox_token when called; ariko's own repo secret on direct runs.
          INBOX_TOKEN: ${{ secrets.inbox_token || secrets.ARIKO_INBOX_TOKEN }}
        run: node scripts/lab-note/post.mjs
```

- [ ] **Step 2: Syntax-check the YAML**

Run:
```bash
node --import tsx -e "import yaml from 'js-yaml'; import { readFileSync } from 'node:fs'; yaml.load(readFileSync('.github/workflows/lab-note.yml','utf8')); console.log('yaml ok')"
```
Expected: `yaml ok`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/lab-note.yml
git commit -m "ci: reusable lab-note workflow — workflow_call + dispatch + ariko self-trigger"
```

---

### Task 7: Docs — README pipeline section + ROADMAP

**Files:**
- Modify: `README.md` (after the `POST /api/inbox` docs, around line 71)
- Modify: `docs/superpowers/ROADMAP.md` (C1 entry, line ~99, + Shipped table)

- [ ] **Step 1: README section**

Insert after the paragraph ending "…reaches the same capture path through a session-authenticated server action." (line ~71). The snippet below is delimited by a FOUR-backtick fence because it contains triple-backtick fences of its own — everything between the four-backtick markers goes into the README verbatim:

````markdown
### Lab Note pipeline (C1 · GitHub connector)

Merging a PR whose body contains a `## Lab Note` section posts a bilingual
capture to the inbox automatically. The section holds one ```yaml fence:

    ## Lab Note

    ```yaml
    en:
      title: Relations join the public graph      # required
      summary: One or two sentences, user-facing. # required
    fr:                                           # recommended — adaptation, not translation
      title: Les relations rejoignent le graphe
      summary: Une ou deux phrases.
    suggested:                                    # optional — prefills triage
      molecule: ariko
      atom: public-graph
      type: feature
      tags: [changelog, graph]
    ```

Unknown top-level keys are ignored (pbbls keeps its superset keys in the same
block). No section → the job logs "skipped". A malformed note fails the job;
edit the merged PR's body and re-run — the script fetches the live body and
posting is idempotent (upsert on `owner/repo#N`).

**Machinery** (all owned by this repo): `scripts/lab-note/` (pure logic +
tests + thin CLI) and the reusable workflow `.github/workflows/lab-note.yml`,
which every repo calls `@main`. This repo triggers the same file directly on
its own merged PRs.

**Wiring another repo** — add `.github/workflows/lab-note.yml`:

```yaml
name: lab-note
on:
  pull_request:
    types: [closed]
permissions:
  contents: read
  pull-requests: read
jobs:
  lab-note:
    if: github.event.pull_request.merged == true
    uses: alexisbohns/ariko/.github/workflows/lab-note.yml@main
    secrets:
      inbox_token: ${{ secrets.ARIKO_INBOX_TOKEN }}
```

and set its secret once (the `github:`-scoped token from Ariko's
`INBOX_TOKENS`, so a leaked CI token can only write `kind:"github"` captures):

```bash
gh secret set ARIKO_INBOX_TOKEN --repo alexisbohns/<repo> --body "$TOKEN"
```

**Rehearsal / backfill** (workflow file must be on `main`):

```bash
gh workflow run lab-note.yml --repo alexisbohns/ariko -f pr_number=<N> -f dry_run=true
gh run watch --repo alexisbohns/ariko   # dry_run prints the payload it would post
```
````

- [ ] **Step 2: ROADMAP update**

In `docs/superpowers/ROADMAP.md`: append this row to the Shipped table (columns are `| Slice | PR | What it delivered |`; lines 40–48). `#??` is filled in by Task 8 Step 3 once the PR number exists:

```markdown
| **C1a — Lab Note pipeline (GitHub connector)** | #?? | Merged PRs post bilingual Lab Note captures to `/api/inbox` via a reusable workflow owned by ariko (self-dogfooding trigger included); `Capture.title` widened to `Text`. |
```

and inside the C1 bullet (line ~99), append this as a new sub-line after the *Explanation* item:

```markdown
  - *Status:* GitHub half shipped 2026-07-18 (Lab Note pipeline, spec `2026-07-18-lab-note-pipeline-design.md`). Remaining: skill/plugin distribution + caller-stub fan-out (deferred follow-ups in the plan), Arkaik/changelog connectors, and the two go-live hardening items above.
```

- [ ] **Step 3: Commit**

```bash
git add README.md docs/superpowers/ROADMAP.md
git commit -m "docs: Lab Note pipeline — contract, caller stub, rehearsal (README + ROADMAP)"
```

---

### Task 8: Wire ariko's own secret, open the PR (with a Lab Note), prove E2E

**Files:** none (operations task)

- [ ] **Step 1: Set `ARIKO_INBOX_TOKEN` on the ariko repo**

The value is the token part of the `github:` entry in Vercel's production `INBOX_TOKENS` (minted during the 2026-07-18 rotation). Pull it without printing:

```bash
cd /Users/alexis/code/ariko
npx -y vercel@latest env pull --environment=production /tmp/ariko-prod.env
TOKEN=$(grep '^INBOX_TOKENS=' /tmp/ariko-prod.env | cut -d= -f2- | tr -d '"' | tr ',' '\n' | grep '^github:' | head -1 | cut -d: -f2)
test -n "$TOKEN" && echo "token extracted (${#TOKEN} chars)"
gh secret set ARIKO_INBOX_TOKEN --repo alexisbohns/ariko --body "$TOKEN"
rm /tmp/ariko-prod.env
gh secret list --repo alexisbohns/ariko
```
Expected: `token extracted (55 chars)` (or similar), then `ARIKO_INBOX_TOKEN` listed.

- [ ] **Step 2: Push and open the PR — its own body carries the first real Lab Note**

```bash
git push -u origin claude/c1-lab-note
```

PR title: `C1: Lab Note pipeline — merged PRs post bilingual captures to the inbox`.
The PR body MUST include this section (this makes merging the PR the end-to-end proof — the self-trigger fires with the file present on the PR's merge ref):

    ## Lab Note

    ```yaml
    en:
      title: Ariko now writes its own changelog
      summary: Merging a pull request now files a bilingual lab note straight into the inbox — no copy-paste, no forgetting.
    fr:
      title: Ariko écrit désormais son propre journal
      summary: Fusionner une pull request dépose maintenant une note de labo bilingue directement dans l'inbox — sans copier-coller, sans oubli.
    suggested:
      molecule: ariko
      type: feature
      tags: [changelog, connectors]
    ```

Plus the usual summary of changes and a pointer to the spec. End the body with the standard attribution line.

- [ ] **Step 3: Backfill the PR number into the ROADMAP row**

After `gh pr create` reports the PR number, replace `#??` in the Shipped-table row added by Task 7 with the real `#<N>`, then:

```bash
git add docs/superpowers/ROADMAP.md
git commit -m "docs: fill C1a PR number in ROADMAP shipped table"
git push
```

- [ ] **Step 4: After review + merge — verify the E2E proof**

```bash
gh run list --repo alexisbohns/ariko --workflow=lab-note.yml --limit 3
gh run view --repo alexisbohns/ariko <run-id> --log | grep 'lab-note:'
```
Expected: `lab-note: posted (HTTP 201) {"id":"…","created":true}`.

Then in the admin UI (https://www.ariko.app/admin): the capture appears in the inbox with the EN title, source `github`; its triage page shows the FR prefill in Name (fr).

Idempotency proof: re-run the same job (`gh run rerun <run-id> --repo alexisbohns/ariko`) → log shows `lab-note: updated (HTTP 200)` and the inbox still holds ONE capture for `alexisbohns/ariko#<PR>`.

- [ ] **Step 5: Rehearsal command sanity (optional but cheap)**

```bash
gh workflow run lab-note.yml --repo alexisbohns/ariko -f pr_number=15 -f dry_run=true
gh run watch --repo alexisbohns/ariko
```
Expected: job succeeds with `lab-note: skipped — no "## Lab Note" section in alexisbohns/ariko#15`.

---

## Deferred follow-ups (tracked, not in this plan)

- **Rollout step 3:** harmonized `lab-note` authoring skill + plugin `marketplace.json` in ariko; rewrite the pbbls skill to emit the superset. (Separate plan; touches the pbbls repo.)
- **Rollout step 4:** caller stubs + `ARIKO_INBOX_TOKEN` secrets for pbbls, femfolk, arkaik, melogram — one small PR each, using the README stub verbatim.
- Media/screenshots on captures (v2; `media:` reserved in the contract).
- GitHub App/webhook receiver if per-repo stubs become friction (spec §10).
- **C1 go-live hardening** (ROADMAP already ties these to this connector going live — fast-follow candidates): `catch(E11000) → retry as updateOne` for the concurrent double-upsert race; constant-time token compare in `lib/auth.ts`; max-body-size guard before `request.json()` in `/api/inbox`.
