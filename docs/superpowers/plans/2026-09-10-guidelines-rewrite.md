# The rulebook, rewritten — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `CLAUDE.md`'s six-exception zero-client-JavaScript ledger with three invariants, retire the tests that pin rules the same change deletes, fix the three documents that contradict the tree, and add the linter whose absence a test comment currently documents.

**Architecture:** Docs-and-tests slice. One forced code change — extending `lib/server-safe-source.test.ts` to the `components/ui/` files the public zone renders fails until three stock `"use client"` directives drop, which is worth −8.5 kB on every prose page. Order matters: the code and tests land first so the prose describes the tree as it actually is, and the linter lands before the prose so its own closing comment is true when written.

**Tech Stack:** Next 15.3, React 19, TypeScript (strict), `node:test` + `tsx`, ESLint 9 flat config.

## Status — 2026-09-11

**Tasks 1 and 2 are shipped** (PR on `claude/rulebook-rewrite`). **Tasks 3–12
remain**, and they are the slice's substance: the rulebook itself is still
unwritten, `CLAUDE.md` is still 458 lines, and the three drifted documents are
still drifted.

| Task | State |
|---|---|
| 1 — `.env.example` | ✅ `782766f` |
| 2 — `table` server-safe, `badge`/`card` guarded | ✅ `7191987` |
| 3 — `separator` probe | ⬜ |
| 4 — retire `palette-mount` | ⬜ |
| 5 — `plant-hero-mount` → `plant-hero-a11y` | ⬜ |
| 6 — trim `exhibition-panel-source` | ⬜ |
| 7 — rename `editor-mount` | ⬜ |
| 8 — ESLint | ⬜ |
| 9 — rewrite `CLAUDE.md` | ⬜ |
| 10 — `README` §Constraints | ⬜ |
| 11 — replace `ROADMAP` | ⬜ |
| 12 — final verification | ⬜ |

**Three corrections were folded into this plan during execution**, each found by
an implementer told to stop on any mismatch rather than reconcile it:

1. **Task 1 Step 3** used `git check-ignore -v`, which prints whichever pattern
   matched *including a negated one* and exits 0 either way — it cannot answer
   "is this ignored?". Now `-q` plus a `git status` cross-check.
2. **Task 1's variable list had eleven names; ten are right.** `ARIKO_URL` is
   read only by `scripts/lab-note/post.mjs`, with the value supplied by the Lab
   Note workflow — a CI variable, like `LAB_NOTE_*`. Conversely `CLOUDINARY_URL`
   never appears as `process.env` in app code at all, because the Cloudinary SDK
   reads it itself, so a `process.env` sweep finds nine of the ten.
3. **Task 2 named `label.tsx` as public-rendered. It is admin-only.** The
   annotation came from a grep that combined `ui/label` and `ui/separator`, so
   `/beanstalk` matched on *separator*. The public zone renders exactly four
   `ui/` files — `table`, `badge`, `card`, `separator` — and `badge` and `card`
   were unguarded, which is the same gap that hid `table` for twenty slices.

The lesson for Tasks 3–12: the "Expected:" lines in this plan are claims, not
facts, and an implementer that stops on a mismatch is worth the round trip. Three
for three so far.

---

**Spec:** [`docs/superpowers/specs/2026-09-10-guidelines-rewrite-design.md`](../specs/2026-09-10-guidelines-rewrite-design.md)

**Audit:** [`docs/audits/2026-09-10-code-quality-audit.md`](../../audits/2026-09-10-code-quality-audit.md)

---

## File structure

**Created**

| File | Responsibility |
|---|---|
| `.env.example` | The ten runtime env vars, named and commented, no values |
| `eslint.config.mjs` | ESLint 9 flat config, scoped to `react-hooks` + `@next/next` |
| `lib/plant-hero-a11y.test.ts` | The surviving half of `plant-hero-mount.test.ts`: every trigger's accessible name carries its stored value |

**Modified**

| File | Change |
|---|---|
| `CLAUDE.md` | Lines 46–408 replaced by three invariants + a rescued-rules section; `chrome-source.test.ts` → `server-safe-source.test.ts` at line 30 |
| `README.md` | §Constraints (lines 57–64) replaced |
| `docs/superpowers/ROADMAP.md` | Replaced wholesale with a one-screen "where we are" |
| `.gitignore` | `!.env.example` negation under the `.env*` rule |
| `package.json` | `lint` script + three devDependencies |
| `.github/workflows/test.yml` | A `npm run lint` step |
| `lib/server-safe-source.test.ts` | `SERVER_SAFE` gains the public-rendered `ui/` files |
| `components/ui/table.tsx` | Drop `"use client"` |
| `components/ui/badge.tsx`, `components/ui/card.tsx` | Unchanged — added to `SERVER_SAFE` so they stay server components |
| `components/ui/separator.tsx` | Drop `"use client"` **if** Base UI permits (Task 3 decides) |
| `lib/exhibition-panel-source.test.ts` | Third test + its docblock paragraph removed |
| `lib/toc-mount.test.ts` | The forty-line "this repo ships no ESLint" comment becomes a two-line pointer |

**Deleted**

| File | Why |
|---|---|
| `lib/palette-mount.test.ts` | A pure ledger artifact — "the palette server-renders nothing" is only interesting while the ledger demands it |
| `lib/plant-hero-mount.test.ts` | Replaced by `lib/plant-hero-a11y.test.ts` (its one surviving test) |

**Renamed**

| From | To | Why |
|---|---|---|
| `lib/editor-mount.test.ts` | `lib/editor.test.ts` | It constructs a real Tiptap editor and tests schema validity and markdown round-trips. Nothing to do with mounting |

**Untouched, deliberately** — `components/ui/native-controls.tsx`, `components/public-icons.tsx` and its test, `lib/media-picker-mount.test.ts`, `lib/screen-sheet-source.test.ts`, `lib/toc-mount.test.ts`'s assertions, `lib/exhibition-source.test.ts`. Spec §5 says why each.

---

## Task 1: `.env.example`

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`

**Context:** `.gitignore:12` is `.env*`, which would swallow the new file. The negation must come after it.

- [ ] **Step 1: Confirm the file would be ignored**

```bash
cd /Users/alexis/code/ariko
printf 'probe\n' > .env.example
git check-ignore -v .env.example
```

Expected: `.gitignore:12:.env*	.env.example` — proof the negation is needed.

- [ ] **Step 2: Add the negation**

Append to `.gitignore`, immediately after the `.env*` line:

```
# .env.example carries names and comments only, never values — it is the one
# .env file that belongs in the repo.
!.env.example
```

- [ ] **Step 3: Verify the negation works**

Use `-q`, not `-v`. `check-ignore -v` prints whichever pattern matched **including
a negated one** and exits 0 either way, so it cannot answer "is this ignored?".
`-q` is the boolean form.

```bash
git check-ignore -q .env.example ; echo "exit=$?"
git status --short .env.example
```

Expected: `exit=1` (not ignored), and `?? .env.example` — untracked, which is
only possible if the negation took.

- [ ] **Step 4: Write the real file**

```bash
cat > .env.example <<'EOF'
# Ariko — runtime environment.
# Copy to .env.local and fill in. Names only here, never values.
#
# CI deliberately needs none of these: the DB-backed tests skip themselves
# without MONGODB_URI, lib/db.ts reads its env inside a function rather than at
# module load, and every page is force-dynamic so the build touches no database.
# See .github/workflows/test.yml.

# --- Database ---------------------------------------------------------------
# Connection string for the cluster.
MONGODB_URI=
# Database name. Production is `beanstalk` (the pre-rename name, kept).
# `npm run test:db` forces `beanstalk_scratch` unless you override it.
MONGODB_DB=

# --- Admin session ----------------------------------------------------------
# The single admin password. There is one user.
ADMIN_PASSWORD=
# HMAC key for the session cookie. Any long random string; rotating it logs the
# admin out.
ADMIN_SESSION_SECRET=

# --- Media ------------------------------------------------------------------
# cloudinary://<key>:<secret>@<cloud>. Every upload goes through the server;
# the browser never talks to Cloudinary directly.
CLOUDINARY_URL=
# Folder prefix for uploads. `npm run check:orphans` sweeps within it.
CLOUDINARY_FOLDER=

# --- Ingestion doors --------------------------------------------------------
# Comma-separated bearer tokens accepted by POST /api/inbox, one per sibling
# repo, so one can be revoked without touching the others.
INBOX_TOKENS=
# Bearer token for POST /api/articles.
ARTICLES_TOKEN=
# Bearer token for the pollen sync door.
SYNC_TOKEN=
# Bearer token for POST /api/synthesis and /api/synthesis/week.
SYNTHESIS_TOKEN=

# --- Not here, deliberately -------------------------------------------------
# ARIKO_URL and the LAB_NOTE_* family belong to the Lab Note CI job, which sets
# them itself (.github/workflows/lab-note.yml). Setting them locally does
# nothing. DRY_RUN and COLUMNS are read by individual scripts; NODE_ENV and
# GITHUB_API_URL come from the platform.
EOF
```

- [ ] **Step 5: Verify every name is real and none is missing**

Two adjustments the first run of this task earned, both verified in the tree:

- **`CLOUDINARY_URL` never appears as `process.env.CLOUDINARY_URL` in `app/` or
  `lib/`** — the Cloudinary SDK reads it from the environment itself
  (`lib/storage.ts:27`). It is required to run the app and invisible to the
  grep, so it is added to the expected set by hand.
- **`ARIKO_URL` is not a runtime variable.** Its only reader is
  `scripts/lab-note/post.mjs:24`, and `.github/workflows/lab-note.yml:66`
  supplies the value. It belongs with `LAB_NOTE_*` in the exclusions, not in
  the file.

```bash
diff <(grep -oE '^[A-Z_]+=' .env.example | tr -d '=' | sort) \
     <( { grep -rhoE 'process\.env\.[A-Z_0-9]+' app lib middleware.ts next.config.ts \
            | sed 's/process\.env\.//' \
            | grep -vE '^(NODE_ENV|COLUMNS|DRY_RUN|GITHUB_API_URL|LAB_NOTE_.*)$'
          echo CLOUDINARY_URL
        } | sort -u )
```

Expected: no output, and the file carries **ten** names. Any line means a name
was invented or forgotten.

- [ ] **Step 6: Commit**

```bash
git add .env.example .gitignore
git commit -m "docs: .env.example — the ten runtime variables, named

The audit's §1.2: the env surface was documented only in README prose. Names
and comments, never values. The .gitignore negation is required because .env*
would otherwise swallow it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: The public-safe `ui/` primitives

**Files:**
- Modify: `lib/server-safe-source.test.ts:43-51`
- Modify: `components/ui/table.tsx:1`

**Context:** `components/ui/table.tsx` carries shadcn's stock `"use client"` and is imported by the **server** component `components/markdown.tsx:8-15`, so every prose page (`/plant/[slug]`, `/pod/[slug]`, `/bean/[id]`) ships `clsx` + `tailwind-merge` — 8.5 kB gzip — for nothing. It contains no hook, no event handler and no Base UI import — only `react` and `cn`.

The public zone renders exactly **four** `ui/` files: `table`, `badge`, `card` and `separator`. `badge` and `card` are server components already; they join the list so a future `npx shadcn add` cannot quietly change that. `separator` is Task 3's, because it imports a Base UI primitive.

This is TDD in its literal form: the test extension is the failing test, and deleting the directive is the implementation.

- [ ] **Step 1: Record the baseline bundle**

```bash
npm run build 2>&1 | tee /tmp/build-before.txt | grep -E "^[├└│ ]*[ƒ○]|First Load JS" | head -40
```

Expected: `/plant/[slug]`, `/pod/[slug]` and `/bean/[id]` show **111 kB** First Load JS; `/` shows **102 kB**. Write the three numbers down — Step 6 compares against them.

- [ ] **Step 2: Write the failing test**

In `lib/server-safe-source.test.ts`, replace the `SERVER_SAFE` array (lines 43–51) with:

```ts
const SERVER_SAFE = [
  "components/chrome.tsx",
  "components/media.tsx",
  "components/public-icons.tsx",
  "components/link-row.tsx",
  "components/bean-cover.tsx",
  "components/phone-frame.tsx",
  "components/screen-strip.tsx",
  // Registry primitives the public zone renders. shadcn ships these with a
  // stock "use client" that none of them needs — no hook, no handler, no Base
  // UI — and the directive on table.tsx cost every prose page 8.5 kB of
  // clsx+tailwind-merge for twenty slices, because this list used to stop at
  // components/. If `npx shadcn add` ever overwrites one, this test is what
  // notices.
  "components/ui/table.tsx", // components/markdown.tsx, for GFM tables
  "components/ui/badge.tsx", // plant-head.tsx, beanstalk, components/media.tsx
  "components/ui/card.tsx",  // bean/[id], components/entity-card.tsx
];
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npm test 2>&1 | grep -A3 "ui/table\|ui/badge\|ui/card"
```

Expected: FAIL — **one** failure, `components/ui/table.tsx must not be a client component — the public zone renders it`. `badge.tsx` and `card.tsx` pass immediately; listing them is what keeps them passing.

- [ ] **Step 4: Drop the directives**

Delete line 1 of `components/ui/table.tsx` (`"use client"`) and the blank line under it. The file should then begin with `import * as React from "react"`.

```bash
sed -i '' '1{/^"use client"$/d;}' components/ui/table.tsx
sed -i '' '1{/^$/d;}' components/ui/table.tsx
head -3 components/ui/table.tsx
```

Expected: the file starts with `import * as React from "react"`.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx tsc --noEmit && npm test 2>&1 | tail -20
```

Expected: `tsc` silent; the suite green, with two more passing tests than before.

- [ ] **Step 6: Measure the receipt**

```bash
npm run build 2>&1 | tee /tmp/build-after.txt | grep -E "plant/\[slug\]|pod/\[slug\]|bean/\[id\]|^[├└│ ]*[ƒ○] / " 
```

Expected: `/plant/[slug]`, `/pod/[slug]`, `/bean/[id]` fall from **111 kB to ~102.5 kB**, matching `/`.

**If the number does not move**, the 8.5 kB attribution in the spec is wrong. Do not delete the change — the directive is still unnecessary — but record the real number and strike the 8.5 kB claim from the PR body rather than repeating it.

- [ ] **Step 7: Commit**

```bash
git add lib/server-safe-source.test.ts components/ui/table.tsx
git commit -m "perf: the public zone stops shipping clsx for a table

components/ui/table.tsx carried shadcn's stock \"use client\" and is imported
by the server component components/markdown.tsx, so every prose page shipped
clsx+tailwind-merge — 8.5 kB gzip — to render a GFM table. It has no hook, no
handler and no Base UI import; the directive was shadcn's, not ours.

badge.tsx and card.tsx join the list unchanged. They are the other two ui/
files the public zone renders, they are server components today, and nothing
was watching that.

server-safe-source.test.ts's list used to stop at components/, which is why
this survived twenty slices while the rule it belongs to was enforced
elsewhere. The list now reaches into ui/, so the next \`npx shadcn add\`
that reinstates a directive fails the suite.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: The `separator` probe

**Files:**
- Modify: `lib/server-safe-source.test.ts` (SERVER_SAFE)
- Modify: `components/ui/separator.tsx:1`

**Context:** Unlike `table`, `badge` and `card`, `components/ui/separator.tsx:3` imports `@base-ui/react/separator`. Base UI's own module may carry `"use client"`, in which case dropping the wrapper's directive changes nothing but is harmless; or the primitive may use a hook or context, in which case the build breaks. **This task may legitimately end in "keep the directive."** That is a result, not a failure.

- [ ] **Step 1: Add it to the list and drop the directive**

Add to `SERVER_SAFE` in `lib/server-safe-source.test.ts`, after the `card.tsx` line:

```ts
  "components/ui/separator.tsx", // <- app/(public)/(chrome)/beanstalk/page.tsx
```

Then:

```bash
sed -i '' '1{/^"use client"$/d;}' components/ui/separator.tsx
sed -i '' '1{/^$/d;}' components/ui/separator.tsx
head -3 components/ui/separator.tsx
```

- [ ] **Step 2: Run the full gate**

```bash
npx tsc --noEmit && npm test 2>&1 | tail -5 && npm run build 2>&1 | tail -30
```

Expected, **if Base UI permits**: all three clean.
Expected, **if it does not**: `npm run build` fails on `/beanstalk` with a message naming a hook or `createContext` used outside a client component.

- [ ] **Step 3a: If the gate is clean — commit**

```bash
git add lib/server-safe-source.test.ts components/ui/separator.tsx
git commit -m "perf: separator joins the server-safe list

Base UI's Separator renders in a server tree, so the wrapper's stock
\"use client\" was buying nothing on /beanstalk either.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 3b: If the build fails — revert and record why**

```bash
git checkout components/ui/separator.tsx
```

Then remove the `separator.tsx` line from `SERVER_SAFE` and add this comment in its place, with the real error text substituted for `<the error>`:

```ts
  // components/ui/separator.tsx is NOT here, and stays a client component:
  // @base-ui/react/separator needs the boundary (<the error>). It is the one
  // registry primitive the public zone renders that genuinely earns its
  // directive — checked 2026-09-10, recheck on the next Base UI bump.
```

```bash
npx tsc --noEmit && npm test 2>&1 | tail -5 && npm run build 2>&1 | tail -5
git add lib/server-safe-source.test.ts
git commit -m "docs: record why separator keeps its client directive

Probed as part of the rulebook slice: unlike table.tsx, badge.tsx and card.tsx, Base UI's
Separator does not render in a server tree. The list now says so, so nobody
re-probes it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Retire `lib/palette-mount.test.ts`

**Files:**
- Delete: `lib/palette-mount.test.ts`

**Context:** Its two assertions are "the palette server-renders nothing at all" and "no search trigger reaches the script-off HTML". Both are interesting only while the ledger requires the palette to justify its existence. Under invariant 2 the admin is a JavaScript application and an admin island rendering nothing script-off is unremarkable. Nothing about a *write* is asserted here — the palette never writes.

- [ ] **Step 1: Confirm what is being given up**

```bash
grep -n "^test(" lib/palette-mount.test.ts
```

Expected: exactly two tests, both asserting emptiness. If a third test exists that asserts anything about a write, a redirect, or an accessible name, **stop** — it must be rescued the way Task 5 rescues one, and this plan did not anticipate it.

- [ ] **Step 2: Delete**

```bash
git rm lib/palette-mount.test.ts
```

- [ ] **Step 3: Fix the three files that cite it**

Deleting a file this repo's docblocks name is how a comment starts lying. Three
files point at `lib/palette-mount.test.ts` by name:

`lib/palette-render.test.ts:7` — replace `and by a\n * no-DOM render (lib/palette-mount.test.ts), and neither can reach the part`
with:

```
 * no-DOM render, and neither could reach the part
```

`lib/toc-mount.test.ts:38` — replace the sentence beginning `No jsdom, like lib/palette-mount.test.ts:` with:

```
 * No jsdom: renderToStaticMarkup is exactly the
```

`app/admin/_components/command-palette.tsx:118` — replace `lib/palette-mount.test.ts pins exactly this.` with:

```
 * that has no router.
```

(The palette's real coverage is `lib/palette-render.test.ts`, which drives it in
a DOM and survives untouched — so the component's docblock loses a pointer, not
its guarantee.)

Verify none remain:

```bash
grep -rn "palette-mount" lib components app 2>/dev/null || echo "clean"
```

Expected: `clean`.

- [ ] **Step 4: Verify the suite still passes**

```bash
npx tsc --noEmit && npm test 2>&1 | tail -10
```

Expected: green, two tests fewer.

- [ ] **Step 5: Commit**

```bash
git add lib/palette-render.test.ts lib/toc-mount.test.ts app/admin/_components/command-palette.tsx
git commit -m "test: retire palette-mount

\"The palette server-renders nothing\" pinned an entry in a ledger this slice
deletes. The palette never writes, so nothing here guards a write path.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `plant-hero-mount` → `plant-hero-a11y`

**Files:**
- Create: `lib/plant-hero-a11y.test.ts`
- Delete: `lib/plant-hero-mount.test.ts`

**Context:** Three of the four tests assert emptiness and go. The fourth — "the triggers still NAME the stored values" — asserts that each icon trigger's accessible name carries the value it represents (`Status: Active`, `Visibility: Public`). That is an **accessibility** property: five icon-only buttons whose meaning exists nowhere else in the tree. It survives the ledger and must keep running under a name that says what it checks.

- [ ] **Step 1: Write the new test file**

```bash
cat > lib/plant-hero-a11y.test.ts <<'EOF'
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Plant } from "./data";

/**
 * The plant header's five editors are icon triggers — a logo, a crown, a
 * status dot, a globe. An icon is not a label, so the only place a reader
 * (screen reader, or anyone hovering) learns what `status` and `visibility`
 * currently ARE is each trigger's accessible name.
 *
 * That is what this file pins, and it is easy to lose by accident: the
 * accessible name is set on the control, not on a visible span (the hover
 * label is CSS — components/chrome.tsx), so nothing on screen changes if
 * someone replaces `Status: Active` with a bare `Status`. The page would look
 * identical and would stop saying what it is.
 *
 * This is the surviving half of the former lib/plant-hero-mount.test.ts. The
 * other three tests asserted the header renders no form fields without script.
 * They pinned an entry in CLAUDE.md's exception ledger, which the rulebook
 * slice replaced with three invariants; the admin is a JavaScript application
 * and an admin island rendering nothing script-off no longer needs a test to
 * say so. No write path is affected — the three big forms are still
 * server-rendered by app/admin/plant/[slug]/page.tsx and handed down as
 * props, which lib/exhibition-panel-source.test.ts pins for its sibling.
 *
 * No jsdom: renderToStaticMarkup is enough to read an accessible name out of
 * the markup, and the header's values are server-rendered.
 */

async function render(element: unknown): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToStaticMarkup(element as any);
}

const plant: Plant = {
  slug: "melogram",
  name: "Melogram",
  natures: ["work"],
  role: { kind: "lead", title: "Head of Product" },
  description: "A listening machine",
};

// Dynamic, and inside the test: the header pulls in the Base UI dialog and
// popover trees, plus the admin's server actions, at module-evaluation time.
async function hero(overrides: Partial<Plant> = {}): Promise<unknown> {
  const React = await import("react");
  const { PlantHero } = await import("@/app/admin/_components/plant-hero");
  const { statusOf } = await import("./plant-status");
  const { visibilityOf } = await import("./plant-visibility");
  const { roleParts } = await import("./plant-role");
  const subject = { ...plant, ...overrides };
  const { label, title } = roleParts(subject.role);
  return React.createElement(PlantHero, {
    slug: subject.slug,
    name: "Melogram",
    description: "A listening machine",
    logoUrl: subject.logo?.url,
    status: statusOf(subject),
    visibility: visibilityOf(subject),
    role: { label, title, detail: "" },
    metaForm: React.createElement("input", { name: "nameFr" }),
    roleForm: React.createElement("input", { name: "kind" }),
    logoForm: React.createElement("input", { name: "logo" }),
    saved: "x",
  });
}

test("the name and the mark are server-rendered, not behind a trigger", async () => {
  const html = await render(await hero());
  assert.ok(html.includes("Melogram"), html);
  assert.ok(html.includes("A listening machine"), html);
});

test("each enum trigger names its stored value in its accessible name", async () => {
  const active = await render(await hero());
  assert.ok(active.includes("Status: Active"), active);
  assert.ok(active.includes("Visibility: Public"), active);

  const hidden = await render(
    await hero({ status: "inactive", visibility: "private" }),
  );
  assert.ok(hidden.includes("Status: Inactive"), hidden);
  assert.ok(hidden.includes("Visibility: Private"), hidden);
});
EOF
```

- [ ] **Step 2: Run the new file alone to verify it passes**

```bash
TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/plant-hero-a11y.test.ts
```

Expected: 2 tests, both passing.

- [ ] **Step 3: Delete the old file**

```bash
git rm lib/plant-hero-mount.test.ts
```

- [ ] **Step 4: Fix the file that cites it**

`app/admin/actions.ts:503` names `lib/plant-hero-mount.test.ts` in the docblock
above the status/visibility actions. Replace:

```
 * it lives inside a client-only popover — script-off there is no form here at
 * all, which is what lib/plant-hero-mount.test.ts pins. That is deliberate:
```

with:

```
 * it lives inside a client-only popover. That is deliberate:
```

The sentence that follows — the stray-click argument — is one of the four
domain rules Task 9 rescues into `CLAUDE.md`, so it stays exactly as written.

Verify:

```bash
grep -rn "plant-hero-mount" lib components app 2>/dev/null || echo "clean"
```

Expected: `clean`.

- [ ] **Step 5: Run the full suite**

```bash
npx tsc --noEmit && npm test 2>&1 | tail -10
```

Expected: green, two tests fewer overall (four retired, two added).

- [ ] **Step 6: Commit**

```bash
git add lib/plant-hero-a11y.test.ts app/admin/actions.ts
git commit -m "test: plant-hero-mount becomes plant-hero-a11y

Three of its four tests asserted the header renders no form fields without
script — an entry in the ledger this slice deletes. The fourth asserts that
each icon trigger's accessible name carries its stored value, which is the
only place a reader learns what status and visibility ARE. That one is an
accessibility property, it survives, and it now runs under a name that says so.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Trim `lib/exhibition-panel-source.test.ts`

**Files:**
- Modify: `lib/exhibition-panel-source.test.ts` — remove lines 82–110 and the docblock paragraph at lines 44–51

**Context:** Two of its three tests are **coupling** rules that have nothing to do with script: `plant-inside.tsx` must import no server action (so the island composes no payload and learns no field name), and `exhibition-panel.tsx` must stay a server component (so the payload is built from server-rendered markup). Both survive. The third — "the Exhibition panel's contents do not reach the script-off HTML" — is the ledger's rule and goes.

- [ ] **Step 1: Remove the third test**

Delete lines 82–110 of `lib/exhibition-panel-source.test.ts` — the `renderScriptOff` helper and the `test("the Exhibition panel's contents do not reach the script-off HTML", …)` block. The file now ends after the `${EXHIBITION_PANEL} is not a client component` test.

- [ ] **Step 2: Replace the orphaned docblock paragraph**

Replace lines 44–51 (the paragraph beginning `* The third property — that the popover's contents genuinely do not reach`) with:

```
 * There used to be a third test here, rendering PlantInside with a marker as
 * `exhibition.panel` and asserting the marker never reached the script-off
 * HTML. It pinned an entry in CLAUDE.md's exception ledger; the rulebook slice
 * replaced that ledger with three invariants, under which an admin island
 * rendering nothing before it mounts is unremarkable. The two rules above are
 * NOT that rule — they are about where a payload is composed, which is
 * invariant 3's territory and survives the ledger intact.
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit && TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/exhibition-panel-source.test.ts
```

Expected: 2 tests, both passing. No unused-import warnings from `tsc` (the file still uses `readFileSync` and `join`).

- [ ] **Step 4: Commit**

```bash
git add lib/exhibition-panel-source.test.ts
git commit -m "test: exhibition-panel keeps its coupling rules, drops its ledger one

The two source-text tests are about WHERE the Exhibition payload is composed —
plant-inside.tsx imports no action, exhibition-panel.tsx stays a server
component. Those are invariant 3's territory and survive. The render test
asserted the popover's contents stay out of the script-off HTML, which was the
ledger's claim about an admin island, and goes with it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Rename `editor-mount.test.ts`

**Files:**
- Rename: `lib/editor-mount.test.ts` → `lib/editor.test.ts`

**Context:** Its six tests construct a real Tiptap editor and check the extension list, markdown round-tripping, schema validity after loading a card in a list item, both entity insert paths, an inline image mid-paragraph, and the `/` menu's Image command. None of it is about mounting or about script-off. It was named for the family it was written alongside, and that family is being retired around it. The `npm test` glob is `lib/**/*.test.ts`, so the new name is still collected.

- [ ] **Step 1: Rename**

```bash
git mv lib/editor-mount.test.ts lib/editor.test.ts
```

**Its own docblock needs no change.** It calls itself "a headless mount smoke
test: it constructs the REAL `Editor` Tiptap builds" — `mount` there is Tiptap's
sense (constructing an editor), not this slice's. Accurate before, accurate
after. Leave every line of it, and every assertion, untouched.

- [ ] **Step 2: Update the ten files that cite it by name**

This is the step to get right: ten other files name `lib/editor-mount.test.ts`
in a docblock, and a rename that leaves them behind turns ten accurate comments
into ten wrong ones.

```bash
grep -rln "editor-mount" lib components app 2>/dev/null
```

Expected, exactly: `lib/media-picker-max.test.ts`,
`lib/markdown-conformance.test.ts`, `lib/media-picker-mount.test.ts`,
`lib/palette-render.test.ts`, `components/media.test.tsx`,
`components/editor/prose-editor.tsx`, `components/editor/editor-extensions.ts`
(four occurrences).

```bash
grep -rl "editor-mount" lib components app 2>/dev/null \
  | xargs sed -i '' 's|lib/editor-mount\.test\.ts|lib/editor.test.ts|g'
grep -rn "editor-mount" lib components app 2>/dev/null || echo "clean"
```

Expected: `clean`.

- [ ] **Step 3: Verify it is still collected and still passes**

```bash
npm test 2>&1 | grep -c "^ok" ; TSX_TSCONFIG_PATH=tsconfig.test.json node --import tsx --test lib/editor.test.ts 2>&1 | tail -8
```

Expected: the file runs its six tests, all passing, and the suite total is unchanged from Task 6.

- [ ] **Step 4: Check for stale references**

```bash
grep -rn "editor-mount" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next
```

Expected: no output, **except** possibly `docs/` files, which are history and stay as written.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: editor-mount is not a mount test

Six tests that construct a real Tiptap editor and check the extension list,
markdown round-tripping and schema validity. It was named for the family it
was written beside; that family is being retired around it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: ESLint

**Files:**
- Create: `eslint.config.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/test.yml`
- Modify: `lib/toc-mount.test.ts:31-38`

**Context:** `lib/toc-mount.test.ts` currently carries forty lines explaining that `react-hooks/rules-of-hooks` goes unenforced because the repo has no ESLint. This task makes that comment false, then shortens it.

**Named risk (spec §7):** 468 files have never been linted. The fallout size is unknown until Step 3 runs. **Fix what is a real defect; if the list is larger than a handful, downgrade the noisy rules to `warn`, file the remainder as an issue, and say so in the PR body.** A `lint` step that is red on merge is worse than no lint step.

- [ ] **Step 1: Install**

```bash
npm install --save-dev eslint@^9 @next/eslint-plugin-next eslint-plugin-react-hooks
```

- [ ] **Step 2: Write the config**

```bash
cat > eslint.config.mjs <<'EOF'
// Scoped deliberately: react-hooks and @next/next, nothing else.
//
// This is not a style pass. There is no formatter in this repo and this config
// does not pretend to be one — style here is consistent by discipline, and the
// day that stops being true is the day to add Prettier as its own decision.
//
// What it IS for is the class of bug that tsc, node:test and next build all
// pass: a conditional hook (React only throws at runtime, and only on the path
// that hits it) and Next's own footguns. lib/toc-mount.test.ts documented the
// gap for a whole slice before this file existed.
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [".next/**", "node_modules/**", "public/**", "docs/**", "data/**"],
  },
  {
    files: ["**/*.{ts,tsx,mjs,js}"],
    plugins: { "@next/next": nextPlugin, "react-hooks": reactHooks },
    linterOptions: {
      // Several test files carry `eslint-disable-next-line
      // @typescript-eslint/no-explicit-any` from before this config existed.
      // @typescript-eslint is not installed, so those directives are inert;
      // reporting them as unused would be noise about a plugin we chose not to
      // add.
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      // The two rules `eslint-plugin-react-hooks`'s recommended preset sets,
      // spelled out rather than spread, so a major bump that moves the preset's
      // export path cannot silently disable them.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
];
EOF
```

- [ ] **Step 3: Run it and read the fallout**

```bash
npx eslint . 2>&1 | tail -60
npx eslint . -f json 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);const c={};for(const f of r)for(const m of f.messages)c[m.ruleId]=(c[m.ruleId]||0)+1;console.table(c)})"
```

Expected: a per-rule count. **Decide here, and record the decision in the PR body:**
- Zero or a handful of errors → fix them in Step 4.
- Many errors concentrated in one rule → set that rule to `"warn"` in `eslint.config.mjs` with a one-line comment naming the count and the follow-up, and fix the rest.
- `react-hooks/rules-of-hooks` errors are **never** downgraded — that rule is the reason this task exists, and a violation is a real runtime crash.

- [ ] **Step 4: Fix what is real, then verify clean**

```bash
npx eslint .
echo "exit=$?"
```

Expected: `exit=0`. Warnings are permitted; errors are not.

- [ ] **Step 5: Add the script**

In `package.json`, add to `"scripts"` immediately after `"start"`:

```json
    "lint": "eslint .",
```

Verify:

```bash
npm run lint && echo "lint ok"
```

- [ ] **Step 6: Add the CI step**

In `.github/workflows/test.yml`, insert between the `npx tsc --noEmit` step and the `npm test` step:

```yaml
      # The class of bug the other three miss: a conditional hook passes tsc,
      # passes the suite and builds, and throws only at runtime on the path
      # that reaches it. Scoped to react-hooks and @next/next — not a style
      # gate, and still secret-free like everything else here.
      - run: npm run lint
```

- [ ] **Step 7: Shorten the comment this task made false**

In `lib/toc-mount.test.ts`, replace the sentence spanning lines 31–36 — from `React itself catches that one, at runtime,` through `statically.` — with:

```
 * React itself catches that one, at runtime, by throwing on the conditional
 * hook — and `react-hooks/rules-of-hooks` (eslint.config.mjs, added with the
 * rulebook slice) catches it statically, which it could not when this comment
 * was written.
```

- [ ] **Step 8: Verify the whole gate**

```bash
npx tsc --noEmit && npm run lint && npm test 2>&1 | tail -5 && npm run build 2>&1 | tail -5
```

Expected: all four clean.

- [ ] **Step 9: Commit**

```bash
git add eslint.config.mjs package.json package-lock.json .github/workflows/test.yml lib/toc-mount.test.ts
git commit -m "ci: add ESLint, scoped to react-hooks and @next/next

The gap lib/toc-mount.test.ts spent forty lines documenting: a conditional
hook passes tsc, passes the suite and builds, and throws only at runtime on
the path that reaches it. Not a style pass — there is still no formatter, and
adding one is its own decision.

That comment is now false, so it is now two lines.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Rewrite `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` — line 30, and lines 46–408 replaced

**Context:** This is the slice. Lines 1–45 (design system, the four shared-surfaces one-file rules) and 409–458 (orientation, Lab Note) stay verbatim — neither is about script. Lines 46–408 are 363 lines narrating six exceptions and five non-exceptions. **Four domain rules and three factorization notes are buried in them and must be rescued before they are deleted** — spec §3. Losing one is the only real risk in this slice, and the check in Step 5 exists for exactly that.

- [ ] **Step 1: Back up, then fix the stale test name at line 30**

The backup must predate every edit — Step 6 diffs against it to prove the kept
sections survived verbatim.

```bash
cp CLAUDE.md /tmp/claude-md-before.md
grep -n "chrome-source.test.ts" CLAUDE.md
sed -i '' 's|`lib/chrome-source.test.ts`|`lib/server-safe-source.test.ts`|g' CLAUDE.md
grep -n "server-safe-source" CLAUDE.md | head -3
```

Expected: the reference at line 30 now names the file that exists.

- [ ] **Step 2: Verify the boundaries before cutting**

```bash
sed -n '45,47p' CLAUDE.md
echo "--- 407..411 ---"
sed -n '407,411p' CLAUDE.md
```

Expected: line 45 ends the shared-surfaces bullet (`belongs here too — grep for the name rather than copying the classes.`); line 46 starts `- **The admin's *metadata* forms stay zero-client-JS**`; line 408 is blank or ends the public-chrome paragraph; line 409 starts `Orientation lives in`. **If these do not match, re-derive the range with `grep -n` before cutting** — Step 1's `sed` does not change line counts, but a previous task might have.

- [ ] **Step 3: Replace lines 46–408**

```bash
{ sed -n '1,45p' CLAUDE.md
  cat <<'EOF'

## Script, by zone

**The public zone is progressively enhanced.** Every page reads, every link
navigates and every media item is reachable with script off. Islands add — a
reading position, a lightbox, a filter that narrows without a reload — and
never replace. A component the public zone renders must not carry
`"use client"` unless it renders nothing until it mounts, and must never be the
only route to anything.

`lib/server-safe-source.test.ts` **is** that rule, not a restatement of it: it
pins the list of public-rendered files, it forbids `lucide-react` (one import
is one client boundary, via an `Icon.mjs` carrying the directive), and it
forbids `node:` imports. **Add a file to it the day you write it.** All three
violations pass `tsc`, `npm test` and `npm run build` while quietly costing the
public site its navigation or its media list — which is how a stock
`"use client"` on `components/ui/table.tsx` shipped 8.5 kB to every prose page
for twenty slices. `components/public-icons.tsx` is the way around lucide in
the chrome; `components/chrome.tsx` does its hover labels in CSS for the same
reason, with the accessible name on the control's `aria-label`.

Today the public zone has exactly one island, `components/toc-rail.tsx`
(1.2 kB), and `lib/toc-mount.test.ts` pins that it renders nothing until it
mounts.

**The admin zone is a JavaScript application.** Server actions are the write
path and a server-rendered `<form action>` is the default form, because both
are less code and are testable without a browser — not because script is
forbidden. That is also why `components/ui/native-controls.tsx` stays: 49 lines
that let six metadata forms keep a styled `<select>` and radio without becoming
islands. Reaching for the Base UI Select/RadioGroup/Checkbox composites there
would turn five server components into client ones and write more code, which
is the opposite of the reason the default exists.

Client state, hotkeys, popovers, sheets, editors and pickers are ordinary tools
here and need no justification paragraph. Use the registry's primitives,
including the client ones — `npx shadcn@latest add <name>` rather than
hand-rolling what the registry already has.

**A write never mis-saves from a partial form.** When a form's controls live
inside an island, the island also owns the submit, and the action refuses a
payload lacking the island's intent marker (`__ready`, checked by
`buildMediaPatch`, `buildPlantLogoPatch`, `buildBeanCoverPatch`,
`buildScreenImagePatch` and `buildNewScreenInput`). This is what makes an
unmounted island **inert** rather than **destructive**: a form that is nothing
but the picker renders no submit button script-off, because a server-rendered
button there would post an empty media list, and an empty list is
indistinguishable from a deliberate clear-all. It would silently delete every
stored image.

A form carrying its own fields *plus* an island's submit is admissible only
where it **creates** — a record that never came into existence loses nothing
and mis-saves nothing (`app/admin/_components/screen-create-form.tsx`, and
`lib/screen-create.ts`'s docblock argues it at the write path). Two details
there are load-bearing: **two** text inputs rather than one, because a lone
text input in a button-less form submits on Enter, and the `__ready` refusal
regardless. Widening this shape to a form that EDITS would be a different
decision, and a worse one.

`lib/media-picker-mount.test.ts` pins the data-loss half.

## Rules the tests pin, and why

These are not about script, and they are the easiest things in the repo to
delete by accident — each one passes `tsc`, `npm test` and `npm run build`
while quietly becoming false.

- **Exhibiting and publishing are one act.** A screen is private at birth, so
  `writeExhibition` writes `visibility: "public"` beside `exhibited: true` and
  reverses both on withdrawal. An author who had to flip visibility separately
  would produce, as the commonest mistake, a screen marked for a strip it
  cannot appear on.
- **The strip requires both facts.** `filterPublic` enforces privacy,
  `Dataset.exhibitionForPlant` enforces the editorial opt-in, and **neither
  re-checks the other's** — which is why a screen made public by some other
  route never silently appears on a plant page. The renumbering half of the
  write is filtered on `exhibited: true` for a related reason: a reorder
  computed against a stale strip would republish a screen someone had just
  withdrawn.
- **Neither plant enum writes on the click that opens it.** The icon opens the
  vocabulary as a list of native radios, the author picks a member, and a Save
  button commits it — disabled until the pick differs from what is stored, so
  the second click is a confirmation rather than a formality. A one-click flip
  was the first shape tried and the wrong one: a stray click on the globe
  unpublishes a project, and the undo is another stray click on the same pixel.
  The two enums post **a named member of a vocabulary**
  (`lib/plant-status.ts`, `lib/plant-visibility.ts`) which the action
  re-validates rather than trusting. The Meta sheet still carries `status` as a
  hidden input because `buildPlantMetaPatch` reads an absent status as
  `active`, so dropping the field would silently reactivate an inactive plant
  on every name edit.
- **A screen's image cannot be cleared**, because `Screen.image` is required —
  the one rule `buildScreenImagePatch` has that its three siblings lack.
- **The Exhibition panel composes no payload.** Its contents are
  server-rendered by `app/admin/plant/[slug]/page.tsx` and handed down as a
  prop, exactly as `metaForm` / `roleForm` / `logoForm` are, so
  `plant-inside.tsx` learns no field name.
  `lib/exhibition-panel-source.test.ts` pins it.
- **The screen sheet's slot imports the page's own module.**
  `app/admin/@sheet/(.)screens/[slug]` wraps
  `app/admin/screens/[slug]/page.tsx` rather than reimplementing it, and every
  tile, prev, next and close is a real `href` — never `router.back()` — so the
  same click is an ordinary navigation when interception does not happen.
  `lib/screen-sheet-source.test.ts` pins both halves. The library is this
  repo's only use of `next/link`, and it stays confined to that slice's four
  files: interception needs a client-side navigation.
- **`lib/palette.ts` is server-only; `lib/palette-items.ts` is the client
  half.** `lib/palette.ts` imports `lib/data.ts`, which opens with `node:fs`.
  Importing the wrong one from the palette component does not merely bloat the
  bundle — it fails the build. (The same trap is why `lib/exhibition.ts` may
  import `MediaImage` only as a type, pinned by
  `lib/exhibition-source.test.ts`.)
- **Every glyph carries its word.** `components/admin/glyphs.tsx` draws the
  admin tables' values as icons, and each also renders its word in an
  `sr-only` span from `lib/glyphs.ts` — the one place a display form is
  decided, exactly as `lib/plant-status.ts` is for its enum. No value is ever
  icon-only in the accessibility tree. Four consumers share that one island:
  the three tables, the palette's plant rows, and the screen library's tiles.

The slice histories that used to be narrated here — the prose editor, the media
picker, the seed overlay, the ⌘K palette, the plant hero, the TOC rail, the
screen library — live in `docs/superpowers/specs/`, which is where history
belongs. `docs/audits/2026-09-10-code-quality-audit.md` §1 explains why this
section is three invariants rather than a ledger of six exceptions.
EOF
  sed -n '409,$p' CLAUDE.md
} > /tmp/claude-md-new.md && mv /tmp/claude-md-new.md CLAUDE.md
wc -l CLAUDE.md
```

Expected: `CLAUDE.md` is now roughly **200 lines**, down from 458.

- [ ] **Step 4: Verify the structure**

```bash
grep -n "^#\|^## " CLAUDE.md
```

Expected, in order: `# CLAUDE.md — working in the Ariko repo`, `## Script, by zone`, `## Rules the tests pin, and why`, `## Lab Note requirement — read before opening a PR`. Nothing else.

- [ ] **Step 5: Verify no rescued rule was lost**

This is the check the task exists for. Each phrase below must appear exactly once:

```bash
for phrase in "Exhibiting and publishing are one act" \
              "neither re-checks the other" \
              "writes on the click that opens it" \
              "image cannot be cleared" \
              "composes no payload" \
              "page's own module" \
              "server-only" \
              "carries its word"; do
  printf '%-46s %s\n' "$phrase" "$(grep -c "$phrase" CLAUDE.md)"
done
```

Expected: every line ends in `1`. A `0` means a rescued rule was dropped — restore it from `/tmp/claude-md-before.md` before continuing.

- [ ] **Step 6: Verify the kept sections survived verbatim**

```bash
diff <(sed -n '1,45p' /tmp/claude-md-before.md) <(sed -n '1,45p' CLAUDE.md)
diff <(sed -n '/^## Lab Note requirement/,$p' /tmp/claude-md-before.md) \
     <(sed -n '/^## Lab Note requirement/,$p' CLAUDE.md)
```

Expected: the first `diff` shows **only** the `chrome-source.test.ts` → `server-safe-source.test.ts` change from Step 1. The second shows nothing at all.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: three invariants replace the six-exception ledger

CLAUDE.md was 458 lines, 363 of them narrating six numbered exceptions to a
zero-client-JavaScript rule and five neighbours arguing why they did not count.
It had stopped being a rule and become a ledger of exemptions, one paragraph
per slice, that an agent had to hold entire to judge whether the seventh island
was admissible.

Its premise had also expired: the condition the rule was written under — until
an artistic direction is set — was met months ago.

Three invariants now: the public zone is progressively enhanced and
server-safe-source.test.ts IS the rule; the admin zone is a JavaScript
application; a write never mis-saves from a partial form. The four domain
rules and four factorization notes buried in the deleted narratives are
rescued into a section of their own, because none of them was ever about
script — and each passes tsc, npm test and npm run build while quietly
becoming false.

458 -> ~200 lines. The slice histories live in docs/superpowers/specs/.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: `README.md` §Constraints

**Files:**
- Modify: `README.md:57-64`

**Context:** The section currently reads *"Zero CSS. No styling whatsoever. No UI library. Plain semantic HTML only. TypeScript. Public zone is zero-CSS, plain semantic HTML."* Every line but `TypeScript` is false and has been for months. It is the most likely thing in the repo to mislead a new agent, because it reads as authoritative and sits under a heading that promises exactly that.

- [ ] **Step 1: Confirm the boundaries**

```bash
sed -n '55,67p' README.md
```

Expected: line 57 is `## Constraints`, line 64 is `* Public zone is zero-CSS, plain semantic HTML.`, line 65 is blank, line 66 is `## Database & development`.

- [ ] **Step 2: Replace the section**

Replace lines 57–64 with:

```markdown
## Constraints

* **TypeScript**, strict. CI is `tsc`, `eslint`, `npm test`, `npm run build`.
* **The public zone is progressively enhanced.** Every page reads, every link
  navigates and every media item is reachable with script off; islands add and
  never replace. `lib/server-safe-source.test.ts` is the enforcement.
* **The admin zone is a JavaScript application**, behind a password, with one
  user. Server actions are the write path and server-rendered forms are the
  default because they are less code — not because script is forbidden.
* **A write never mis-saves from a partial form** — an island that has not
  mounted is inert, never destructive.
* **Design system:** Tailwind v4 + shadcn on Base UI. Never hand-roll a
  primitive the registry ships.

`CLAUDE.md` §"Script, by zone" states the three invariants in full, and
`docs/audits/2026-09-10-code-quality-audit.md` §1 records why they replaced the
list that used to sit here — *Zero CSS. No styling whatsoever. No UI library.
Plain semantic HTML only.* — which was true when it was written and had been
false for months by the time it was read.
```

- [ ] **Step 3: Verify**

```bash
sed -n '/^## Constraints/,/^## Database/p' README.md
grep -c "Zero CSS" README.md
```

Expected: the new section renders correctly, and `Zero CSS` appears exactly **1** time — inside the closing paragraph that quotes it as history.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README constraints stop describing a repo that no longer exists

\"Zero CSS. No styling whatsoever. No UI library. Plain semantic HTML only\" —
under a heading that promises to be authoritative, in a repo with Tailwind v4,
shadcn on Base UI, two typefaces, a floating chrome, popovers, sheets and a
command palette. The most likely thing here to mislead a new agent.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Replace `docs/superpowers/ROADMAP.md`

**Files:**
- Modify: `docs/superpowers/ROADMAP.md` (292 lines → ~60)

**Context:** Dated 2026-07-18. Uses `Molecule → Atom → Version` throughout, a vocabulary retired in the botanical slice. Describes the admin as *"bare functional HTML (no CSS, no client JS, no UI framework) until an artistic direction is set"*. Its own preamble says it "aggregates" each plan's deferred sections and should be pruned as slices ship; it has not been touched through twenty slices. That is evidence about the arrangement, not about discipline — so the arrangement changes. It stops aggregating.

- [ ] **Step 1: Write the replacement**

```bash
cat > docs/superpowers/ROADMAP.md <<'EOF'
# Ariko — where we are

**Last updated:** 2026-09-10

One screen. This file does **not** aggregate the plans' deferred sections any
more — that arrangement asked for a prune on every slice, got one on none, and
spent twenty slices describing a vocabulary and a constraint set that had both
been retired. History lives in [`specs/`](specs/), one document per slice, and
that is the authoritative record.

---

## The thing

Ariko is a personal **central node**: a portfolio on a botanical content model,
`Pod → Bean → Sprout`, with inbox `Seed`s arriving from sibling repos' CIs. A
pod is a body of work, a bean a unit within it, a sprout a piece of writing or
a release. Plants sit above pods as the projects themselves.

**Archive-first and private by default.** Everything lives in a private vault;
a curated subset is projected to the public zone. The security rule — only
published entities and their non-private lineage ever reach the public — is
enforced by the pure `filterPublic` projection, which every public read passes
through and which is unit-tested.

Two zones, one design system (Tailwind v4 + shadcn on Base UI). The public zone
is progressively enhanced; the admin is a JavaScript application behind a
password with one user. `CLAUDE.md` §"Script, by zone" is the rulebook.

Live at [www.ariko.app](https://www.ariko.app). Stack: Next 15 / React 19 /
TypeScript / MongoDB / Cloudinary.

---

## Shipped

The vault spine and the admin over it; the botanical rename; the ingestion
spine (`/api/inbox`, `/api/articles`, `/api/synthesis`) and the pollen
federation contract; the Lab Note pipeline across five repos; Tiptap and the
media slice; bilingual reading; the brand mark; the landing gallery; plant
status, role, logo and visibility; the fluid admin — seed overlay, vault
filters, table glyphs, ⌘K; the plant page as its own object, public and admin;
the shared-surfaces slice; bean covers and the phone frame; the screen store,
library and exhibition; the public TOC rail.

Per-slice detail: [`specs/`](specs/), and the merged PRs they name.

---

## What's next

From [`../audits/2026-09-10-code-quality-audit.md`](../audits/2026-09-10-code-quality-audit.md)
§6, whose ordering this follows — except that the guidelines rewrite went
first, because the slices below it are shaped by which rulebook is in force.

1. ~~**Rewrite the guidelines.**~~ Shipped — [`specs/2026-09-10-guidelines-rewrite-design.md`](specs/2026-09-10-guidelines-rewrite-design.md).
2. **Cache the garden.** `unstable_cache` + `revalidateTag("garden")`, replacing
   29 `revalidatePath` calls that invalidate nothing because every page is
   `force-dynamic`. Plus `serverSelectionTimeoutMS`, `app/(public)/error.tsx`
   and `app/not-found.tsx`. The highest-leverage change in the repo: TTFB stops
   depending on Mongo and an outage becomes stale rather than 500.
3. **Assets.** svgo the two brand SVGs (102 kB and 91 kB of rendered HTML);
   subset Inclusive Sans to woff2 (−180 kB per first visit); Profane fallback
   metrics; `preconnect` to Cloudinary; transform the gallery and markdown
   images; eager + `fetchPriority` on the first row.
4. **Delete the trap.** `getDataset` and the `node:fs` import in `lib/data.ts`
   are dead outside tests, and they are the sole reason that module is
   server-only — the trap `CLAUDE.md` still has to describe twice.
5. **Form kit.** `field` from the registry; `TextField`, `BilingualField`,
   `StateRadios`, `ConfirmDeleteForm`, `ActionError`, `LoadFailure`.
6. **Action split.** `app/admin/actions.ts` is 964 lines and 27 exports; split
   by entity behind one `withEntity` guard, plus `lib/form-data.ts`,
   `lib/media-input.ts`, `parseRef`, a shared `SLUG`. Validate promote's slugs
   and make it compensate.
7. **Hotspot splits.** `plant-hero` → `media-picker` → `prose-editor` →
   `command-palette` → triage → sprout.
8. **Route-group the admin chrome**, so `AdminChrome` stops being a client
   component just to read the pathname.
9. **Language in the URL** (`/fr/…`), then `generateMetadata`, `hreflang`,
   `lang` from the route, and ISR for the public zone.

Further out, unsequenced: the lightbox (`components/screen-strip.tsx` already
links every phone to its full image, which is what the island would intercept),
and the interactive graph the public zone is aimed at.
EOF
wc -l docs/superpowers/ROADMAP.md
```

- [ ] **Step 2: Verify the retired vocabulary is gone**

```bash
grep -nE "Molecule|Atom|Version|bare functional|no client JS" docs/superpowers/ROADMAP.md
```

Expected: no output. (`molecule` in lowercase survives only in `CLAUDE.md`'s Lab Note YAML, which is a wire contract and stays.)

- [ ] **Step 3: Verify the links resolve**

```bash
ls docs/superpowers/specs/2026-09-10-guidelines-rewrite-design.md docs/audits/2026-09-10-code-quality-audit.md docs/superpowers/specs
```

Expected: both files listed, no error.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/ROADMAP.md
git commit -m "docs: the ROADMAP stops aggregating and starts describing

Dated 2026-07-18, Molecule/Atom/Version throughout, and describing the admin as
bare functional HTML with no client JS. Its own preamble asked for a prune on
every slice and got one on none — which is evidence about the arrangement, not
about discipline.

So the arrangement changes. One screen: what the thing is, what shipped, what's
next. History lives in specs/, one document per slice, which was already true.

292 -> ~90 lines.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Final verification and PR

**Files:** none

- [ ] **Step 1: Run the whole gate from clean**

```bash
rm -rf .next
npx tsc --noEmit && echo "TSC OK"
npm run lint && echo "LINT OK"
npm test 2>&1 | tail -8
npm run build 2>&1 | grep -E "plant/\[slug\]|pod/\[slug\]|bean/\[id\]|beanstalk|First Load"
```

Expected: `tsc` and `lint` clean; the suite green with **no failures** (the total is ~1,140 minus the retired assertions plus the two added — record the actual number, do not predict it); the build clean with the prose routes at ~102.5 kB.

- [ ] **Step 2: Verify no dangling references to deleted files**

```bash
grep -rn "palette-mount\|plant-hero-mount\|editor-mount" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=docs .
```

Expected: no output. Hits under `docs/` are history and are fine; hits anywhere else must be fixed.

- [ ] **Step 3: Verify the claims the PR body will make**

```bash
echo "CLAUDE.md:  $(wc -l < CLAUDE.md) lines (was 458)"
echo "ROADMAP:    $(wc -l < docs/superpowers/ROADMAP.md) lines (was 292)"
git diff --stat main...HEAD | tail -3
```

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin HEAD
gh pr create --title "The rulebook, rewritten: three invariants for a ledger of six exceptions" --label no-lab-note --body "$(cat <<'BODY'
`CLAUDE.md` was 458 lines, 363 of them narrating six numbered exceptions to a
zero-client-JavaScript rule and five neighbours arguing why they did not count.
It had stopped being a rule and become a ledger of exemptions — one paragraph
per slice — that an agent had to hold entire to judge whether the seventh
island was admissible.

Its premise had expired too. The condition it was written under, *until an
artistic direction is set*, was met months ago.

Three invariants replace it: **the public zone is progressively enhanced** (and
`lib/server-safe-source.test.ts` IS the rule, not a restatement of it); **the
admin zone is a JavaScript application**; **a write never mis-saves from a
partial form**. Four domain rules and four factorization notes buried in the
deleted narratives are rescued into a section of their own — none of them was
ever about script, and each passes `tsc`, `npm test` and `npm run build` while
quietly becoming false.

This is [audit](docs/audits/2026-09-10-code-quality-audit.md) slice 5, shipped
first: the form kit, the action split and the hotspot splits are all shaped by
which rulebook is in force, so doing the code before the words would bake in
the rule this retires.
[Spec.](docs/superpowers/specs/2026-09-10-guidelines-rewrite-design.md)

### The one code change, and it is a receipt

`components/ui/table.tsx` carried shadcn's stock `"use client"` and is imported
by the **server** component `components/markdown.tsx`, so every prose page
shipped `clsx` + `tailwind-merge` — **8.5 kB gzip** — to render a GFM table.
`server-safe-source.test.ts`'s list stopped at `components/`, which is how it
survived twenty slices while the rule it belongs to was enforced elsewhere. The
rule caught the cheap thing (five inline glyphs, ~1.5 kB) and missed the
expensive one.

`/plant/[slug]`, `/pod/[slug]`, `/bean/[id]`: **111 kB → 102.5 kB**.

### Two corrections to the audit

**`native-controls.tsx` stays.** The audit proposed retiring it; that
contradicts its own next sentence. Those 49 lines are what let six
*server-rendered* metadata forms have a styled select without becoming islands.
Swapping them for Base UI composites turns five server components into client
ones and writes more code, in service of an argument about less.

**The test purge is ~182 lines, not ~1,160.** The audit tallied a 1,438-line
"script-off enforcement footprint" and implied the bulk retired. Roughly **87 %
of it enforces something that is not the script rule at all** — coupling, data
loss, accessibility, schema. The prose was the bloat; the tests were mostly
earning their keep under names that misdescribed them. Retired:
`palette-mount` (a pure ledger artifact), three of `plant-hero-mount`'s four
tests, one of `exhibition-panel-source`'s three. `editor-mount.test.ts` is
renamed `editor.test.ts` because it constructs a real Tiptap editor and has
nothing to do with mounting.

### Also

- **ESLint**, scoped to `react-hooks` + `@next/next` — the gap
  `lib/toc-mount.test.ts` spent forty lines documenting. That comment is now
  two lines, because it is now false. Not a style pass; there is still no
  formatter.
- **`.env.example`** — the ten runtime variables, names and comments only.
- **`README.md` §Constraints** stops saying *Zero CSS. No styling whatsoever.
  No UI library.*
- **`docs/superpowers/ROADMAP.md`** replaced: it was dated 2026-07-18, used
  `Molecule → Atom → Version`, and described the admin as bare functional HTML.
  It stops aggregating the plans' deferred sections — an arrangement that asked
  for a prune every slice and got one on none — and becomes one screen.

No behaviour changes. Nothing a visitor or the author can see changes, which is
why there is no Lab Note: the 8.5 kB is the removal of a regression nobody knew
had happened, not a feature.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

- [ ] **Step 5: Fill in the real numbers**

The PR body above states `111 kB → 102.5 kB` and `~182 lines`. Replace both with what Step 1 and Step 3 actually measured. **If the bundle did not move, strike the receipt section rather than repeating a claim the build disproves** — Task 2 Step 6 says the same thing, and it matters more here because this is the public claim.

---

## Notes for the executor

- **Task 3 may end in "no".** Base UI's `Separator` might genuinely need the
  client boundary. Step 3b is a real branch, not a fallback for a mistake.
- **Task 8's fallout size is unknown.** The rule: fix real defects; downgrade a
  noisy rule to `warn` with a filed follow-up rather than widening the slice;
  **never** downgrade `react-hooks/rules-of-hooks`.
- **Task 9 Step 5 is the one that matters.** Everything else in this plan is
  reversible from git. A domain rule silently dropped from `CLAUDE.md` is not —
  it becomes a rule nobody knows about until something breaks. Run the check.
- **Do not fold in adjacent audit findings.** Caching, `error.tsx`, the
  `getDataset` deletion, the form kit and the action split are each their own
  slice. Spec §8 lists them by name so they are not smuggled in.
