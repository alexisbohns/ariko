# The rulebook, rewritten — three invariants for a ledger of six exceptions

*2026-09-10*

## 0. Where this starts

The audit at [`docs/audits/2026-09-10-code-quality-audit.md`](../../audits/2026-09-10-code-quality-audit.md)
read the whole repo and filed ten sequenced slices. This is the first of them,
and it is **not** the first one the audit proposed.

The audit puts "Cache the garden" first and "Rewrite the guidelines" fifth. That
ordering is wrong for a reason the audit itself supplies: slices 6–9 — the form
kit, the action split, the hotspot splits, the admin chrome route-group — are
exactly the ones whose *shape* is decided by which rulebook is in force. Build
the form kit under today's `CLAUDE.md` and it must preserve
`components/ui/native-controls.tsx` and grow a seventh exception paragraph;
build it under the new one and it reaches for the registry. Doing the code
before the words bakes in a rule this slice exists to retire.

So the words go first. **Nothing a visitor or the author can see changes.**
Behaviour does not change. One bundle changes, by −8.5 kB on every prose page,
and that change is *forced* by a test extension rather than chosen — §4.

## 1. What the rule became

`CLAUDE.md` is 458 lines. Lines 46–408 — 363 of them — narrate **six numbered
exceptions** to a zero-client-JavaScript rule (prose editor, media picker, seed
overlay, command palette, plant hero, TOC rail), then **five neighbours that are
not exceptions**, each with its own argument for why it does not count.

The rule is no longer a rule. It is a ledger of exemptions, and every slice adds
a paragraph. An agent reading it must hold the whole ledger to decide whether
the seventh island is admissible — which is the opposite of what a guideline is
for.

Its premise has also expired. `README.md:57-62` still lists the constraints as
*"Zero CSS. No styling whatsoever. No UI library. Plain semantic HTML only."*
and `docs/superpowers/ROADMAP.md:30-33` still says the admin is *"bare
functional HTML (no CSS, no client JS, no UI framework) **until an artistic
direction is set**"*. That condition was met months ago: Tailwind v4, shadcn on
Base UI, two typefaces, a floating chrome, popovers, sheets, a command palette.

And the enforcement caught the cheap thing while missing the expensive one. The
"no lucide in a public server component" rule saves roughly 1.5–2 kB gzip across
all five glyphs. Meanwhile the *stock* `"use client"` on
`components/ui/table.tsx:1`, imported by the server component
`components/markdown.tsx:8-15`, costs **8.5 kB on every prose page** — and went
unnoticed for twenty slices, because the rule is enforced by a grep over a
hand-maintained list (`lib/server-safe-source.test.ts:43-51`) that never
included `ui/`.

Finally: **the admin has one user, behind a password, who authors in Tiptap.**
There is no script-off admin session and there never will be. The public site is
a different question, and a real one — a portfolio *should* survive crawlers,
reader modes, link previews and a bad connection. But that property is
**progressive enhancement**, a discipline with a two-sentence rule, not a
prohibition with six exceptions.

## 2. The three invariants

`CLAUDE.md`'s script section — lines 46–408 in full — becomes this, and nothing
else. The domain rules currently *buried* in those lines do not go here; they
move to the sections they actually belong to, which is §3.

> ### Script, by zone
>
> **The public zone is progressively enhanced.** Every page reads, every link
> navigates and every media item is reachable with script off. Islands add — a
> reading position, a lightbox, a filter that narrows without a reload — and
> never replace. A component the public zone renders must not carry
> `"use client"` unless it renders nothing until it mounts, and must never be
> the only route to anything. **`lib/server-safe-source.test.ts` is the rule**,
> not a restatement of it: it pins the list, it forbids `lucide-react` (one
> import is one client boundary, via `Icon.mjs`), and it forbids `node:`
> imports. Add a file to it the day you write it. `components/public-icons.tsx`
> is the way around lucide in the chrome.
>
> **The admin zone is a JavaScript application.** Server actions are the write
> path and server-rendered `<form action>` is the default form, because both are
> less code and are testable without a browser — not because script is
> forbidden. That is also why `components/ui/native-controls.tsx` stays: 49
> lines that let six metadata forms keep a styled `<select>` without becoming
> islands. Client state, hotkeys, popovers, sheets, editors and pickers are
> ordinary tools here and need no justification paragraph. Use the registry's
> primitives, including the client ones.
>
> **A write never mis-saves from a partial form.** When a form's controls live
> inside an island, the island also owns the submit, and the action refuses a
> payload lacking the island's intent marker. This is what makes an unmounted
> island *inert* rather than *destructive*. A form carrying its own fields
> *plus* an island's submit is admissible only where it **creates** — a record
> that never came into existence loses nothing and mis-saves nothing.

Three paragraphs for three hundred and sixty-three lines. The slice histories
they replace already live in `docs/superpowers/specs/`, which is where history
belongs.

### 2.1 The correction to the audit's draft

The audit's Appendix A proposed retiring `native-controls.tsx` "in favour of the
registry `Select`/`RadioGroup`/`Checkbox` where a client form is already
warranted". That contradicts its own next sentence. `native-controls` is 49
lines, and it is precisely what lets six *server-rendered* metadata forms have a
styled select and radio without becoming client components:
`app/admin/sprout/[slug]/page.tsx`, `app/admin/triage/[id]/page.tsx`,
`plant-role-form.tsx`, `entity-select.tsx`, `screen-delete-form.tsx`,
`plant-hero.tsx`. Swapping them for Base UI composites turns five server
components into islands and writes *more* code, in service of a rule the same
document argues is about less code.

It stays. Its **justification paragraph** goes, and the invariant above says in
one sentence why it exists, so nobody re-derives the question.

### 2.2 The lucide rule is the test, not the prose

The audit proposed downgrading "no lucide in a public server component" to a
preference. But `lib/server-safe-source.test.ts:63-72` enforces it hard, and a
preference in prose beside a hard test is drift waiting to happen.

Resolution: **the test is the rule.** The prose points at the test rather than
restating it, which is the only arrangement where the two cannot disagree.

## 3. What is pulled out of the ledger before it is deleted

Lines 46–408 are not homogeneous. Four things buried in the exception narratives
are **domain rules**, not script rules, and must survive the deletion. Losing
them is the one real risk in this slice.

| Rule | Today | Why it is not a script rule |
|---|---|---|
| **Exhibiting and publishing are one act.** `writeExhibition` writes `visibility: "public"` beside `exhibited: true` and reverses both on withdrawal | `CLAUDE.md` §plant-hero | Editorial correctness. An author flipping visibility separately produces, as the commonest mistake, a screen marked for a strip it cannot appear on |
| **The strip requires both facts.** `filterPublic` enforces privacy, `Dataset.exhibitionForPlant` enforces the editorial opt-in, and neither re-checks the other's | `CLAUDE.md` §plant-hero | **Security.** It is why a screen made public by some other route never silently appears on a plant page |
| **Neither enum field writes on the click that opens it.** The icon opens a vocabulary; a Save button commits, disabled until the pick differs | `CLAUDE.md` §plant-hero | UX safety. A one-click flip means a stray click on the globe unpublishes a project, and the undo is another stray click on the same pixel |
| **A screen's image cannot be cleared**, because `Screen.image` is required | `CLAUDE.md` §screen-library | Schema invariant |

Three more survive as **factorization** notes rather than exceptions:

- The `lib/palette.ts` (server-only, imports `lib/data.ts` → `node:fs`) versus
  `lib/palette-items.ts` (client half) split. Importing the wrong one fails the
  build. *(This note retires when the audit's step 4 deletes `getDataset` and
  the `node:fs` import — a later slice.)*
- The screen sheet's slot imports `app/admin/screens/[slug]/page.tsx`'s own
  module rather than reimplementing it.
- Every glyph carries its word in an `sr-only` span, from `lib/glyphs.ts` — so
  no value is icon-only in the accessibility tree.

Lines 1–45 (design system, and the four shared-surfaces one-file rules) and
409–458 (orientation, Lab Note) are kept verbatim. Neither is about script.

**Net: `CLAUDE.md` ~458 → ~200 lines.**

## 4. The forced code change

`lib/server-safe-source.test.ts`'s `SERVER_SAFE` list gains the `components/ui/`
files the public zone renders. The extension **fails until the directives drop**,
so the test change and the code change are one atomic edit:

| File | Imports | Public consumer | Action |
|---|---|---|---|
| `components/ui/table.tsx` | `react`, `cn` — no hooks, no Base UI | `components/markdown.tsx:8-15` → `/plant/[slug]`, `/pod/[slug]`, `/bean/[id]` | Drop the directive. **This is the 8.5 kB** |
| `components/ui/label.tsx` | `react`, `cn` — no hooks, no Base UI | `app/(public)/(chrome)/beanstalk/page.tsx` | Drop the directive |
| `components/ui/separator.tsx` | `@base-ui/react/separator` | `/beanstalk` | **Attempt.** If Base UI's primitive will not render server-side, keep the directive and record why in the list's comment |

The first two are verified safe by inspection: neither file contains a hook, an
event handler, or a Base UI import. The third is genuinely unknown until it is
tried, and this spec does not pretend otherwise.

## 5. The test ledger — and the audit's second overstatement

The audit tallies a "script-off enforcement footprint" of **1,438 lines** and
implies the bulk of it retires with the paragraphs it pins. Having read them,
that is wrong, and the direction of the error is worth recording: **roughly
87 % of those lines enforce something that is not the script rule at all.** The
prose was the bloat. The tests were mostly earning their keep under names that
misdescribed them.

| File | Lines | Fate |
|---|---|---|
| `lib/editor-mount.test.ts` | 291 | **Lives.** It constructs a real Tiptap editor and tests schema validity and markdown round-trips — nothing to do with mounting. Rename to `lib/editor.test.ts` |
| `lib/media-picker-mount.test.ts` | 210 | **Lives.** Its assertion is data-loss, reframed under invariant 3 |
| `lib/screen-sheet-source.test.ts` | 196 | **Lives.** A composition invariant: the slot imports the page's own module, and tiles navigate by `href` |
| `components/public-icons.tsx` + `.test.tsx` | 119 + 108 | **Lives.** Geometry fidelity against lucide's path data |
| `lib/exhibition-panel-source.test.ts` | 110 | **Half.** "The panel's contents do not reach the script-off HTML" dies. "`plant-inside.tsx` imports no server action" lives — it is a *coupling* rule (the island composes no payload and learns no field name) → ~50 lines |
| `lib/plant-hero-mount.test.ts` | 106 | **Part.** The three emptiness tests die. "The triggers still NAME the stored values" lives, reframed as an accessibility test: every trigger's accessible name carries its stored value → ~35 lines, renamed `lib/plant-hero-a11y.test.ts` |
| `lib/server-safe-source.test.ts` | 77 | **Lives and extends** (§4) |
| `lib/toc-mount.test.ts` | 64 | **Lives.** The audit lists it as retiring; it is the *only* test pinning invariant 1's "renders nothing until it mounts" for the public zone |
| `lib/exhibition-source.test.ts` | 57 | **Lives for now.** Retires with `getDataset` in a later slice |
| `components/ui/native-controls.tsx` | 49 | **Lives** (§2.1) |
| `lib/palette-mount.test.ts` | 51 | **Dies.** A pure ledger artifact: "the palette server-renders nothing" is only interesting while the ledger demands it |

**Net: ~182 lines retired, not ~1,160.** The PR body should say so; it is the
more honest version of the audit's claim, and it is a partial vindication of the
tests even as the prose they grew alongside is deleted.

### 5.1 One closure

`lib/toc-mount.test.ts:31-38` carries a forty-line comment explaining that
React's rules-of-hooks go unenforced *because the repo has no ESLint*. This
slice adds ESLint, so that comment becomes a two-line pointer at the config —
the audit's own observation that "a 40-line test comment sits where a 10-line
lint config belongs", closed in the same PR that makes it true.

## 6. Documentation

### 6.1 `README.md`

`README.md:57-62` §Constraints is replaced by a pointer to the two zone
invariants in `CLAUDE.md`, plus TypeScript. The current list is simply false and
is the most likely thing to mislead a new agent, because it reads as
authoritative and sits under a heading that promises exactly that.

### 6.2 `docs/superpowers/ROADMAP.md`

Replaced, not refreshed. The file is dated 2026-07-18, uses
`Molecule → Atom → Version` throughout, and describes the admin as bare
functional HTML. Its own preamble says it "aggregates" each plan's deferred
sections and should be pruned as slices ship; it has not been touched through
twenty slices, which is evidence about the arrangement rather than about
discipline.

The replacement is one screen:

- **Where we are** — the current model (`Pod → Bean → Sprout`, inbox `Seed`s),
  the design system, the two zones.
- **What shipped** — a short list, not a per-slice narrative.
- **What's next** — the audit's remaining nine slices, in its order.
- **History lives in `docs/superpowers/specs/`** — stated, so nobody rebuilds
  the aggregation.

### 6.3 `.env.example`

New. Eleven runtime variables, enumerable from source, each with a one-line
comment and no value:

`MONGODB_URI`, `MONGODB_DB`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`,
`CLOUDINARY_URL`, `CLOUDINARY_FOLDER`, `ARIKO_URL`, `INBOX_TOKENS`,
`ARTICLES_TOKEN`, `SYNC_TOKEN`, `SYNTHESIS_TOKEN`.

Excluded deliberately: the `LAB_NOTE_*` family (set by CI), `DRY_RUN` and
`COLUMNS` (script-local), `NODE_ENV` and `GITHUB_API_URL` (platform).

### 6.4 The `CLAUDE.md:30` rename

`CLAUDE.md` still references `lib/chrome-source.test.ts`, renamed to
`lib/server-safe-source.test.ts` several slices ago. Fixed in passing.

## 7. ESLint

`eslint` + `eslint-config-next` (Next 15.3, React 19 — flat config), scoped to
**`react-hooks` and `@next/next` only**. Not a style pass: there is no formatter
in this repo and this slice does not add one. A `lint` script, and the CI
workflow gains a step.

**Named risk.** 468 files have never been linted. The size of the first run's
output is unknown until it runs. The rule for this slice: fix what is a real
defect, and if the fallout is larger than a handful, **report the remainder
rather than silently widening the slice** — a `lint` step that is red on merge
is worse than no lint step, and a slice that quietly triples is worse than both.
If the two plugins alone produce an unmanageable list, the fallback is to land
the config with the noisy rules set to `warn` and a follow-up issue, which is
still strictly better than the status quo of no enforcement at all.

## 8. What this slice does not do

Named so they are not smuggled in:

- **No caching.** `unstable_cache`, `revalidateTag` and the 29 `revalidatePath`
  calls are the audit's slice 1 and stay there.
- **No `error.tsx` / `not-found.tsx`.** They ship with the caching slice, which
  is what makes the failure mode stale-rather-than-500.
- **No `getDataset` deletion.** Audit slice 4. It retires
  `lib/exhibition-source.test.ts` and the palette-split note, and it deserves
  its own PR because it removes a trap this document still has to describe.
- **No form kit, no action split, no hotspot splits.** Slices 6–8. They are the
  reason this one goes first.
- **No formatter.**
- **No assets work.** Slice 3.

## 9. Verification

- `npx tsc --noEmit` clean.
- `npm test` green. Expected count: 1,140 minus the retired assertions, and the
  exact number is recorded in the PR body rather than predicted here.
- `npm run build` clean, and the route manifest re-read: `/plant/[slug]`,
  `/pod/[slug]`, `/bean/[id]` should fall from 111 kB to ~102.5 kB, matching `/`.
  **That number is the receipt for §4** — if it does not move, the directive
  drop did not do what this spec claims and the claim comes out of the PR body.
- `npm run lint` green, or red with a recorded, filed remainder (§7).
- A read of the new `CLAUDE.md` against §3's table: all four domain rules and
  all three factorization notes present.

## 10. Lab Note

**None.** This slice ships nothing a visitor, user or listener would notice. Per
`CLAUDE.md`'s gate — chore, refactor, infra or docs-only → no note — the PR
carries the `no-lab-note` label instead.

The −8.5 kB is real but is not a user-facing *change*; it is the removal of a
regression nobody knew had happened, and a Lab Note announcing it would be
announcing a bug fix for a bug that was never visible.
