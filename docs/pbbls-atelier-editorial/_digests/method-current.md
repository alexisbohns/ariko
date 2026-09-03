# Method digest — pbbls, the engineering paradigm as a subject

Factual digest. Every claim carries its source. Nothing here is publishable prose.
All paths are relative to `/Users/alexis/code/pbbls` unless stated otherwise.
Repo state read at 2026-09-02 (working tree, branch `main`).

---

## 1. The decision log: why it started, its template, how disciplined it stayed

**Where:** `docs/decisions/log.md`, 490 lines.

**Counts.** 42 dated entries (`grep -c '^## 20'`). Date range **2026-05-26 → 2026-09-02**.
By month: 2026-05 → 5, 2026-06 → 5, 2026-07 → 22, 2026-08 → 7, 2026-09 → 3.
All 42 carry `- **Status:** taken`; **zero** entries are marked `rejected`, `deprecated`
or `superseded-by`, even though the template offers those values. Supersession is
instead expressed in the `Supersedes / Superseded-by` field of the *newer* entry —
14 of 42 entries carry a non-`—` value there (e.g. 2026-09-02 #743 "Supersedes the
'opens nothing on the nightly' clause of the 2026-09-02 entry for #741").

**Why it was started** — entry `2026-05-26 — Track significant decisions in an in-repo log`
(Refs: #477, #482):
> **Context:** "ADRs lived only in GitHub Issues — good for discussion, but not
> greppable from the repo, noisy, and invisible to agents at read time. Settled
> questions kept getting re-litigated because there was no durable, low-token home
> for them."
> **Decision:** "an append-only ledger at `docs/decisions/log.md`, one terse entry per
> significant decision, supersede-don't-edit. The PR checklist in `CLAUDE.md` gains a
> gated micro-step (usually a no-op)."
> **Why:** "Greppable and cheap to read for agents and humans alike… The gated step
> keeps cost near zero on routine PRs while making the bar visible on the ones that
> matter. Significance test: 'would a future agent or human waste real time
> rediscovering or wrongly reversing this?'"
> **Consequences:** "If the log grows unwieldy, we'll revisit splitting it by scope —
> not yet."

**The entry template**, verbatim from `docs/decisions/log.md` (lines 13–27):

```markdown
## YYYY-MM-DD — <decision title>

- **Status:** taken | rejected | deprecated | superseded-by(YYYY-MM-DD title)
- **Scope:** ios | webapp | db | infra | docs (one or more, comma-separated)
- **Context:** the scope, issue, or challenge — a contextual *why now*.
- **Decision:** the "we will …" formula. What we decided, stated as an action.
- **Why:** why this option and not the alternatives.
- **Consequences:** the "how" — what follows from this decision (constraints, follow-ups, things to watch).
- **Supersedes / Superseded-by:** link to the entry this replaces, or `—`.
- **Refs:** #PR, #issue, file paths.
```

The file's own rules block (lines 5–11): "Append-only. Newest entries at the bottom.
**Supersede, don't edit.** … Keep entries terse. If a decision needs prose, link to the
PR/issue under **Refs**. Skip routine choices, style nits, and anything obvious from
the code."

**Discipline.** Every one of the 42 entries carries all eight template fields, in
template order, with a `Refs` line naming PR/issue numbers and file paths. The
"keep entries terse" rule is the one that eroded: the 2026-08-24 web-valence-fan
entry's Consequences field alone runs ~500 words. The `Status` axis is effectively
unused (always `taken`). Discipline on structure: 42/42. Discipline on terseness:
degraded over time.

`CLAUDE.md` (PR checklist step 6) states the gate: "If this PR established or
reversed a **significant** decision, append one entry to `docs/decisions/log.md`
(usually a no-op)… Supersede-don't-edit — status changes are new appended entries,
never edits to prior ones."

---

## 2. "Promote learnings into CLAUDE.md only on hardening, via a milestone grooming pass"

Entry `2026-05-26 — Promote learnings into CLAUDE.md only on hardening, via a
milestone grooming pass` (Status: taken; Scope: docs; Refs: #479, `CLAUDE.md`
"Editing CLAUDE.md / AGENTS.md", `docs/superpowers/specs/2026-04-11-monorepo-audit-design.md`
per-domain checklist item 6).

**The rule.** A learning is *captured cheaply* in the plan's "Lessons learned"
section. It is *promoted* into `CLAUDE.md`/`AGENTS.md` only when it clears **both**
bars:
- **Durable** — "outlives the next refactor", not a quirk of one feature.
- **Action-guiding** — "tells a future agent what to do or avoid, not a passive observation."

**The cadence** is not per-PR. It is "the periodic monorepo-audit grooming pass at
**milestone boundaries**, folded into the audit's existing 'Doc accuracy' domain."
The entry says flatly: "Never a per-PR CLAUDE.md edit for learnings."

**The reasoning**, verbatim from the Context and Why fields:
> "`CLAUDE.md`/`AGENTS.md` load into *every* agent context, so they are the most
> token-precious files in the repo and must hold only durable, action-guiding rules —
> not a junk drawer of observations. Per-PR CLAUDE.md edits for learnings bloat the
> file and dilute its signal."
> "Two-stage pipe — cheap capture, expensive promotion — keeps CLAUDE.md small and
> high-signal while losing nothing. Milestone cadence groups grooming with the audit
> work that already touches the same files, so there is no separate ritual to
> remember. **Precedent:** the 'never await Supabase inside `onAuthStateChange`' rail
> is a learning that hardened into a rule exactly this way."

**Consequences** include a demotion clause, not just promotion: "expect rules to be
**demoted or deleted** during the same pass when they have gone stale." And
"Reviewers can push back on CLAUDE.md edits that fail the durable + action-guiding
bars."

**The rule mirrored in `CLAUDE.md`** ("Editing CLAUDE.md / AGENTS.md" section) adds
the scoping half: "Land each promoted rule at the right scope: root `CLAUDE.md` /
`AGENTS.md` for cross-cutting rules; workspace `CLAUDE.md` (`apps/web`, `apps/ios`,
`apps/android`, `apps/admin`, `packages/supabase`) for surface-specific ones."

**Evidence the pipe actually runs in both directions:**
- *Waiting in the queue:* the 2026-07-30 cross-surface-payload entry (#651) says of
  its own rule: "Candidate for promotion into `CLAUDE.md` at the next monorepo-audit
  grooming pass; until then it lives in the M47 design's D12 + 'Lessons learned'."
  That rule **has since landed** in `CLAUDE.md` §"Standing cross-surface rules"
  ("Test a shared data shape against real payloads produced by the other surfaces…").
- *Flagged for demotion/rewording:* the 2026-08-24 iOS entry (#727) records
  "**`apps/ios/CLAUDE.md`'s 'no `#available` guards' line is now contradicted by the
  codebase** and needs rewording at the next monorepo-audit grooming pass — the rule
  should read as 'no availability guards around APIs that have an iOS 17 equivalent',
  which is what it was always for."
- *Where the captured learnings live:* 13 of 88 plan files under
  `docs/superpowers/plans/` contain a "Lessons learned" section; 3 spec files do.

`CLAUDE.md`'s "Standing cross-surface rules" section is the promoted set, and it is
explicitly labelled: "These are hardened rules promoted from `docs/decisions/log.md` —
breaking one is a regression, not a style choice." It currently holds 7 rules.

---

## 3. Arkaik: the product map

### The bundle now

`docs/arkaik/bundle.json`, `schema_version: 3`, `project.updated_at`
`2026-08-24T23:05:00Z`. Project record: `id: "pebbles"`, `title: "Pebbles"`,
`root_node_id: "V-landing"`.

- **460 nodes, 1001 edges.**
- **Species:** `acceptance` 159, `api-endpoint` 93, `view` 91, `data-model` 63,
  `decision` 40, `flow` 14.
- **Statuses:** `live` 342, `development` 60, `idea` 23, `archived` 22, `backlog` 13.
- **Edge types:** `covers` 249, `queries` 224, `composes` 154, `calls` 118,
  `displays` 106, `impacts` 103, `generates` 43, `supersedes` 4.
- **Platform tagging** (`node.platforms`): all three surfaces 273 nodes, web-only 138,
  ios+android 17, untagged 16, ios+web 6, android-only 5, ios-only 5. Nodes also
  carry a `metadata.platformStatuses` map (per-platform status) and `acceptance`
  nodes carry `metadata.gherkin`.
- Species × status crossings of note: `acceptance` 139 live / 13 backlog / 6
  development / 1 idea; `view` 73 live / 9 idea / 5 archived / 4 development;
  `decision` 38 live / 2 archived.

### Versus the 2026-04 snapshot

Verified directly from git: commit `bf72d36e` (2026-04-01, "introduce arkaik skill
to update pebbles bundle automatically (#76)") holds **67 nodes / 108 edges, all 67
at status `idea`**, species `view` 29, `api-endpoint` 20, `data-model` 11, `flow` 7,
and **no `schema_version` key**. The next commit's copy (`de1518b4`, 2026-04-02) is
already 76/124 with the first node at `development`.

So the delta April → September is: **67 → 460 nodes (6.9×), 108 → 1001 edges (9.3×)**;
schema bumped to v3; two entirely new species appear (`acceptance` 159, `decision` 40 —
i.e. 43% of the current graph is a species that did not exist in April); and the
status distribution inverts from 100% `idea` to 74% `live`. The map went from a
wishlist to a record of a shipped product.

### What "the arkaik map is served from the hosted project" (2026-07-28, #622) changed

Entry `2026-07-28 — The arkaik map is served from the hosted project, and
`apps/admin` stays unlinked (#622)`. Four decisions:

1. `docs/arkaik/arkaik.json` (contents verbatim: `{"project_id": "prj_5dDiZc-G6lseF3cb",
   "remote": "https://arkaik.app"}` — project id + origin, no credential) makes
   `arkaik-mcp` resolve the **hosted** graph. "the local `docs/arkaik/bundle.json`
   stays in the tree but is no longer the plane agents read."
2. Path-scoped repo links `apps/ios`→ios, `apps/android`→android, `apps/web`→web
   "let a PR move the right platform with no annotation."
3. `metadata.ref_policy = true` opts into promotion: "PR opened → development,
   merged → live, closed unmerged → nothing."
4. **`apps/admin` is deliberately left unlinked.**

The stated reason for (4): "Arkaik models only `web | ios | android`, so admin could
only be linked as `web` — and an admin-only PR would then mark the *customer-facing*
web app shipped. Leaving admin unlinked keeps the 'shipped' signal honest."

Also recorded in the same entry, a near-miss: "The prefix in the original brief was
`apps/webapp`, which does not exist here — the API validates path *format*, not
existence, so that link would have returned 201 and then silently matched nothing,
and web would never have promoted."

Superseded: "Supersedes local-first arkaik usage, where `docs/arkaik/bundle.json` was
the authoritative map edited in-repo." Consequence: "`arkaik-mcp` errors hard when a
project is linked but the token is missing, rather than silently falling back to the
stale local bundle." Token lives only in `$ARKAIK_TOKEN`; `.mcp.json` is gitignored.

**So what changed in practice:** the graph stopped being a file an agent hand-patches
and became a service an agent mutates through MCP tools, with status promotion driven
by PR lifecycle rather than by an agent remembering to flip a field. The in-repo
`bundle.json` is now a stale artifact by design.

### How the journal is written

`docs/arkaik/journal.jsonl` — 926 lines, one JSON event per line, ts range
**2026-03-26T20:34:43Z → 2026-08-24T23:05:00Z**.

Three writers, per `.claude/skills/arkaik/SKILL.md` and the data:

- **By agent, by hand (file mode).** The skill's "Dual-write: snapshot + journal"
  section: "The snapshot is authoritative for **current state**; the journal is
  authoritative for **history**. Every change is a **dual-write**: in the *same*
  change you (1) patch the snapshot … **and** (2) append the matching event(s) to the
  journal." Plus: "**Never re-project the snapshot from the journal, or vice versa.**
  If the two ever disagree, that divergence is a signal to surface, not to launder."
  Append-safety is designed in: "git's `merge=union` reorders lines; consumers order
  by `ts`, tiebreaking by `id`."
- **By server (hosted mode).** The skill's mode table: for a hosted map, "Dual-write
  | you do it, by hand | **the server does it — every mutation derives its own
  journal events**". And the hard rule: "**Do not create or edit
  `docs/arkaik/bundle.json` for a hosted map.** … If the MCP tools are unavailable,
  say so and stop rather than falling back to the file — a silent fallback is the
  failure nobody notices."
- **By webhook.** `CLAUDE.md`: "On merge, the Arkaik GitHub App webhook appends the
  note to this project's arkaik journal as a `deliverable.shipped` event (idempotent
  per PR; the Ariko federation reads it from the pollen feed)."

**Actor distribution** (926 events):

| actor | events | what they emit |
|---|---|---|
| `bootstrap` | 359 | `node.created` 275, `node.status_changed` 84 |
| `claude-code` | 323 | `node.created` 186, `edge.added` 95, `node.status_changed` 21, `node.updated` 19, `ref.added` 1, `node.deleted` 1 |
| *(no `actor` field)* | 242 | `deliverable.shipped` 217, `node.status_changed` 14, `release.tagged` 8, `decision.status_changed` 2, `idea.proposed` 1 |
| `alexis` | 1 | `request.filed` 1 |
| `arkaik-sync` | 1 | `ref.status_changed` 1 |

Event-type totals: `node.created` 461, `deliverable.shipped` 217,
`node.status_changed` 119, `edge.added` 95, `node.updated` 19, `release.tagged` 8,
`decision.status_changed` 2, and one each of `request.filed`, `ref.added`,
`ref.status_changed`, `idea.proposed`, `node.deleted`.

By month, with actors:
`2026-03` 33 (bootstrap 11, none 22) · `2026-04` 372 (bootstrap 133, claude-code 146,
none 93) · `2026-05` 90 (none 51, bootstrap 39) · `2026-06` 35 (bootstrap 29,
none 4, claude-code 1, alexis 1) · `2026-07` 326 (bootstrap 147, claude-code 107,
none 71, arkaik-sync 1) · `2026-08` 70 (claude-code 69, none 1).

**What the distribution says.** The human appears exactly **once** as an actor
(`alexis`, one `request.filed`). Everything else is machine-written: `bootstrap`
(the retro-construction of the graph — note `.arkaik/bootstrap/` on disk holds 30
`fragments/*.json` and a `corpus/` of `docs.json`, `prs.jsonl`, `surfaces.json`,
i.e. the graph was back-filled from the repo's own paper trail), `claude-code` (the
agent maintaining the map as a side-effect of feature work), and the actor-less
`deliverable.shipped` block, which is the merge webhook writing 217 shipped-PR
events. The 2026-08 column is 69/70 `claude-code`: by then the map was being kept
current by the agent alone.

---

## 4. Lab Notes as a YAML snippet prefilling the admin from the clipboard (#601)

Entry `2026-07-17 — Lab Notes are a YAML snippet that prefills the admin from the
clipboard (#601)` (Status: taken; Scope: docs, admin).

**The problem it solved.** "the Lab Note step produced an ad-hoc EN/FR markdown
blurb that the maintainer had to re-key into the Lab admin by hand, and the PR
template's 'voice anchors' mechanism (paste 2–3 recent shipped entries as tone
reference) was clunky and the resulting tone unsatisfying."

**The decision.** "The PR Lab Note is now a **strict YAML snippet** matching the
`logs` columns (`species`/`platform`/`status`/`release-date`→`released_at`/
`published`/`en`/`fr`), authored via the new `lab-note` skill
(`.claude/skills/lab-note/`) which carries the schema, allowed values, and a friendly
casual tone (French uses 'Tu'). In the admin, clicking **'New log'** reads the
clipboard during the click gesture and, if it holds a matching snippet, opens the
existing New-log form **prefilled** — no separate import page, no new server action;
submission still goes through the unchanged `createLog`."

**Why that shape.** "A copy-paste-once flow removes the manual re-keying; a
skill-owned schema + tone fixes the voice at the source and keeps CLAUDE.md tiny.
Prefilling the existing form (vs. a bespoke import page/action) reuses all validation
and the `published_at`/`released_at` auto-stamp with the least surface area."

**Consequences recorded.** "The clipboard parser is tolerant of both idiomatic YAML
and the issue's list-of-dashes style. Clipboard read needs a user gesture + secure
context (reliable in Chromium; Firefox may prompt); any failure falls back to a blank
form. The old markdown Lab Note shape is retired — `blog-dossier` harvesting now
expects the YAML block." Refs: `apps/admin/lib/logs/parse-lab-note.ts`,
`apps/admin/app/(authed)/logs/_components/NewLogButton.tsx`,
`.../PrefillableLogForm.tsx`, `.github/PULL_REQUEST_TEMPLATE.md`.

**How the in-app changelog is authored, end to end** (from `.claude/skills/lab-note/SKILL.md`
§"One block, two destinations" and `CLAUDE.md`):

1. An agent finishing a user-facing PR writes **one** `## Lab Note (EN/FR)` section
   holding exactly one ` ```yaml ` fence, per the `lab-note` skill.
2. **Destination A (automatic, on merge):** the note is posted to the Ariko changelog
   vault, idempotent per `owner/repo#N`. *Note the mechanism moved:* the skill text
   still says "the repo's `.github/workflows/lab-note.yml` watches for merged PRs",
   but that workflow no longer exists — it was removed in commit `8d22e405`,
   "chore: lab notes now land in the arkaik journal via the GitHub App webhook
   (#705)". The current path is the Arkaik GitHub App webhook → a
   `deliverable.shipped` journal event → the Ariko federation reading the pollen
   feed (`CLAUDE.md`, and the 217 actor-less `deliverable.shipped` events in
   `journal.jsonl`). `CLAUDE.md`'s CI list still names `lab-note.yml` — stale.
3. **Destination B (manual, at release):** "a human pastes the same YAML into the
   Pebbles Lab admin ('New log' prefills from the clipboard)". The `logs` table is
   what drives the iOS Lab tab.
4. The advisory `lab-note-reminder.yml` comments at PR-open on a missing or malformed
   note; the `no-lab-note` label opts out.
5. Hard rule, repeated in both places: "**Never write to Supabase / `logs` from the
   dev loop.**" The skill: "It is a **proposal only**."

**Relation to the Ariko convention.** They are the same wire block with two readers.
`/Users/alexis/code/ariko/CLAUDE.md` requires a section whose heading *starts with*
`## Lab Note` containing exactly one yaml fence, with `en.title` + `en.summary`
required and an optional `suggested:` block (`molecule`, `type`, `tags`, `atom`).
The pbbls skill states the interop explicitly: "Ariko's gate is a heading that starts
with `## Lab Note` holding one fenced `yaml` block — which our `## Lab Note (EN/FR)`
heading already matches. Ariko requires `en.title` + `en.summary`; it reads the
optional `suggested:` block and **ignores every other top-level key** (`species`,
`platform`, etc.)." pbbls' local schema is a **superset**: it additionally mandates
`fr.*`, and adds `species`/`platform`/`status`/`published` because those are the
`logs` table's own columns. Precedence is stated in `CLAUDE.md`: the repo-local
`lab-note` skill "**takes precedence over the `lab-note@ariko` plugin skill** if both
are present" — and `.claude/settings.json` shows the plugin *is* enabled
(`{"enabledPlugins": {"lab-note@ariko": true}}`).

Two pbbls-only formatting rules exist purely to keep the parser from failing:
"**No em dashes** in either language" and "**Always double-quote every title and
summary**… a colon is the natural way to write a sentence … and it is exactly what an
unquoted YAML value cannot hold, so the parser reads `key: value` and the whole note
fails."

---

## 5. Spec → plan → execution

**Counts.** `docs/superpowers/specs/` = **94 files**; `docs/superpowers/plans/` =
**88 files**; plus 2 loose design docs at `docs/superpowers/` root
(`2026-04-13-ios-path-view-fetch-design.md`, `2026-05-12-ios-snap-upload-coordinator-design.md`).
Total 184 artifacts.

Date range by filename prefix: **2026-04-11 → 2026-08-24** (specs);
2026-04-11 → 2026-08-23 (plans).

By month:

| month | specs | plans |
|---|---|---|
| 2026-04 | 41 | 41 |
| 2026-05 | 24 | 23 |
| 2026-06 | 4 | 4 |
| 2026-07 | 21 | 17 |
| 2026-08 | 4 | 3 |

Naming convention: spec `<date>-<slug>-design.md`, plan `<date>-<slug>.md`
(`CLAUDE.md`, "Where knowledge lives"). Note **no September artifacts** — the three
September decisions (#739, #741, #743) shipped without a spec/plan pair, which is
consistent with the triage rule below.

**The shape of the practice**, from `README.md` §Engineering Paradigm. Thesis:
"specification-driven, agentic execution. Match ceremony to blast radius.
Architecture lives as code-adjacent artifacts, not folklore." Seven stages:

1. **Conception** — GitHub issue `[Type] Description` + species + scope label +
   milestone; living product graph updated whenever architecture moves.
2. **Spec** (`specs/<date>-<slug>-design.md`) — "Pre-flight checklist. Flattens
   ambiguity *before* code." Contains: problem, key decisions + rationale,
   architecture per layer, file-by-file create/modify/delete with pseudocode/SQL,
   data flow, error modes, **out-of-scope**, manual acceptance, PR metadata.
3. **Plan** (`plans/<date>-<slug>.md`) — "Operationalizes the spec. Checkboxable,
   copy-pasteable." 8–15 numbered tasks with files touched, exact bash/SQL/Xcode
   steps and expected output; a spec-drift section; a self-review checklist; and
   post-ship, "'Lessons learned' + PR link annotated back in".
4. **Execution** — triaged by size (table below).
5. **Review** — branch before first commit, conventional commits, PR body
   `Resolves #N`, reviewed against spec acceptance criteria + plan self-review.
6. **QA** — lint/build scoped to change size; manual acceptance checklist from the
   spec; "**Arkaik diff = architectural regression signal**".
7. **Release** — conventional commits feed the changelog; milestones group shipped
   work; "'Lessons learned' feeds back into the next spec template".

**"Ceremony scales with blast radius" — the actual table.** README §4 Execution:

| Size | Ceremony |
|---|---|
| Small (≤150 LOC) | Skip plan/agents; workspace-scoped lint |
| Medium (≤500 LOC) | 2–3 sentence sketch; workspace lint + build |
| Large (cross-app / schema / new surface) | Full Superpowers loop; root lint + build; update Arkaik |

`CLAUDE.md` carries the operational long form, §"Task-size triage (read first)",
prefaced with the rationale: "Match ceremony to task size. **Heavy workflows on small
tasks are the main reason agent work feels slow.**"

- **Small (≤ ~150 LOC, single file or tightly scoped):** "Skip brainstorming,
  planning, TDD ceremony. Just make the change. Skip subagents (Plan, Explore,
  Reviewer) unless you genuinely don't know where something lives. Lint only the
  affected workspace… Skip full `npm run build` unless touching types/config. Skip
  the Arkaik map update unless you added/removed/renamed a screen, route, data model,
  or endpoint."
- **Medium (multi-file, single feature, ≤ ~500 LOC):** "Sketch the approach in 2–3
  sentences before coding. No formal plan doc. Workspace-scoped lint + build. Full
  build only if you changed shared types or `packages/*`. Update Arkaik only if
  architecture changed."
- **Large (cross-app, schema migration, new feature surface):** "Use the
  brainstorming/planning/TDD/review skills. **The ceremony pays for itself here.**
  Full `npm run build` and `npm run lint` from the repo root. Update Arkaik
  (`docs/arkaik/bundle.json`) as part of the same change."

The five stated **operating principles** (README): "1. Spec before code, plan before
keys. 2. Ceremony scales with blast radius. 3. Architecture is a graph, not a vibe.
4. Atomicity is a primitive. 5. Every ship teaches the next one."

---

## 6. Testing and CI as of September 2026

### What runs automatically

`.github/workflows/` holds **five** workflows (plus `.github/scripts/verify-harness.sh`,
`.github/ISSUE_TEMPLATE/{bug,feature}.md`, `PULL_REQUEST_TEMPLATE.md`,
`copilot-instructions.md`):

| workflow | trigger | what it does |
|---|---|---|
| `android.yml` | PR + push to main on `apps/android/**` | "ktlint · unit tests · assemble" — "The repository's first CI workflow (D12)." No secrets needed. |
| `android-release.yml` | push to main on `apps/android/**`; PR labelled `deploy-beta`; `workflow_dispatch` | Signed release AAB → Google Play internal testing. "Bootstrap is fail-soft… it just produces an (unsigned) AAB artifact and skips the publish step." |
| `arkaik.yml` | PR + push on `docs/arkaik/**` or `.claude/skills/arkaik/**` | "Gate the Arkaik product-graph map: a broken bundle or a snapshot the journal contradicts cannot land." Runs `node .claude/skills/arkaik/scripts/validate-bundle.js`. |
| `lab-note-reminder.yml` | PR opened/edited/synchronize/labeled/unlabeled/ready_for_review | Advisory, non-blocking. Calls `alexisbohns/ariko/.github/workflows/lab-note-reminder.yml@main`. Opt out with `no-lab-note`. |
| `supabase.yml` | same-repo PR on `packages/supabase/**`; nightly cron `17 4 * * *`; `workflow_dispatch` | The four anon contract harnesses. |

There is **no root `test` task** (`CLAUDE.md`: "the only root tasks — there is no root
`test`"), and no lint/build workflow for web or admin; those are covered by Vercel
builds. `lab-note.yml` is referenced by `CLAUDE.md` and by the `lab-note` skill but
**does not exist** — deleted in `8d22e405` (#705) when posting moved to the Arkaik
GitHub App webhook.

### The four anon contract harnesses

From `packages/supabase/CLAUDE.md` §"Contract harnesses (`scripts/verify-*.ts`)":
"The database is the contract between four clients, and these Deno scripts are the
proof for anything crossing a surface boundary. They are **acceptance tests, not
simulations**: each signs up throwaway users **against the linked production
project**, exercises the real RLS policies, triggers, RPCs and the real
`delete-account` edge function, then deletes what it made in a `finally` (even on
failure). Every run namespaces its users by a random `runId`."

| command | harness | proves | needs |
|---|---|---|---|
| `db:verify:drafts` | `verify-pebble-drafts.ts` | M47 draft lifecycle | anon |
| `db:verify:visibility` | `verify-pebble-visibility.ts` | grade RLS on pebbles | anon |
| `db:verify:public-profile` | `verify-public-profile.ts` | `get_public_profile` jsonb allowlist | anon |
| `db:verify:guard` | `verify-profiles-privileged-guard.ts` | `profiles_privileged_guard` (#739) | anon |
| `db:verify:purge` | `verify-account-purge.ts` | `purge_account` contract | anon + **service role** |

### Why they became a CI gate (2026-09-02, #741)

Entry `2026-09-02 — The four anon contract harnesses become a CI gate; the purge
harness stays manual because the service-role key stays out of a public repo (#741)`.

Context, verbatim: "`packages/supabase/**` had no CI coverage at all… a PR changing
only migrations or edge functions got two Vercel builds proving the web and admin
apps still compile, which they would with or without any schema change. Meanwhile
the five `verify-*` harnesses — the actual proof for anything crossing a surface
boundary — **ran only when a human remembered to**. #739 is what that costs: a
privilege-escalation gap sat in `profiles_update` from `20260411000001` until an
audit found it, and the guard that closed it (#740) was protected by nothing but a
script somebody had to think to run."

The obstacle, stated: "these harnesses are acceptance tests, not simulations: they
sign up throwaway users against the **linked production project**… so any CI trigger
is a production write."

Design choices and their reasons:
- **Trigger:** PR (path-filtered) + nightly + dispatch. "nightly alone detects a
  dropped guard *after* merge, which is the #739 failure mode again; the
  path-filtered PR trigger blocks it, and the nightly still catches the case nobody
  path-matched."
- **Fork gate:** fork PRs *skip* rather than fail
  (`head.repo.full_name == github.repository`). "`pull_request` from a fork gets no
  secrets, so the harnesses would fail… on every outside contribution — and
  `pull_request_target` is the wrong fix, since it would hand repository secrets to
  fork-authored code."
- **Concurrency:** grouped by ref with `cancel-in-progress: false`, because "a run is
  never killed between signup and its `finally` (which would orphan an account)".
  Different refs may overlap safely: "every harness namespaces its users by a
  per-run uuid and asserts only on rows its own user owns."

Accepted cost, verbatim: "**Every merged PR touching that path now performs a handful
of production signups and deletions; that is the price of the harnesses being proof
rather than simulation.**" Orphan accounts are greppable by the
`drafts-verify-` / `grades-verify-` / `public-verify-` / `guard-verify-` prefixes on
`@example.test`, "and there is no automated sweep because deleting them needs the
service role."

### Why the purge harness stays manual

Same entry: "`verify-account-purge.ts` is **not** in CI: it is the one harness needing
`SUPABASE_SERVICE_ROLE_KEY`, that secret is **not added to this public repo**, and the
harness stays a manual run… a leaked service-role key is total database access, and a
same-repo PR is still code that runs before review, so the purge contract keeps the
human gate it already has rather than trading it for a new class of exposure."

Consequence: "**`purge_account` remains the one contract with no automated gate** —
the standing rule to run `npm run db:verify:purge` after any batch touching it is now
the *only* thing protecting it, and is correspondingly less forgiving."
`packages/supabase/CLAUDE.md` adds: "Do not 'fix' its absence by adding that secret
without deciding it as such."

### The nightly harness and its tracking issue (2026-09-02, #743)

Entry `2026-09-02 — The nightly harness run logs a result table and opens one reused
tracking issue; a failing PR run still opens nothing (#743)`. It supersedes #741's
"a notification is enough to start" clause.

Context: "That notification ends in exactly one place: GitHub's default email/web
notification to whoever last modified the cron syntax, plus a red run in the Actions
tab. This repo has no other failure wiring — no workflow contains `failure()`, no
issue-opening step, no webhook. So the nightly, the one gate that catches a
regression on a PR that never touched `packages/supabase/`, **was also the one gate
whose failure nobody is forced to walk past.**" (Kritik was considered as a
destination and rejected: "the `kritik_*` tools run against a checkout's
`docs/quality/` files, this repo has none"; and the `quality_signals` view /
`QualitySignalsTable` "are product analytics… not engineering signals.")

Decision: every run writes a per-harness table (harness, result, assertion counts) to
`$GITHUB_STEP_SUMMARY` via `.github/scripts/verify-harness.sh`; a **scheduled**
failure "opens one issue titled `[Bug] Nightly contract harnesses are failing`,
commenting on it if it is already open. A **PR** failure opens nothing. **The issue is
closed by hand, never automatically by a subsequent green run.**"

Reasoning: "One reused issue means a contract broken for a week is one thread rather
than seven, and it lands somewhere with labels and a milestone instead of an inbox. A
PR failure needs no issue because the red check is already in front of the person who
caused it. Auto-closing on a green run was rejected: **an intermittent failure would
quietly close its own report, which is the failure mode the whole gate exists to
prevent.**"

The wrapper script's raison d'être, verbatim from the entry and echoed in the script
itself: "the summary needs the harness's stdout, GitHub's default shell is
`bash -e {0}` with **no `pipefail`**, and `harness | tee` under that shell exits 0
for a failing harness — so the wrapper reads `PIPESTATUS[0]`, which is the harness's
own status regardless of pipefail." Confirmed in `.github/scripts/verify-harness.sh`:
`set -uo pipefail`, then `npm run … | tee …; status="${PIPESTATUS[0]}"`, then
`exit "$status"`. It also scrapes each harness's terminal `Summary: passed=N failed=M`
line, reporting `—` when a harness "died before its own summary… which is a failure
whose counts we honestly do not know."

Standing consequence: "**A harness added to `scripts/` now needs three things in the
same change**, not two: a `db:verify:*` script, a workflow step, and that step must
call `.github/scripts/verify-harness.sh` rather than npm directly — calling npm
directly still gates the merge but silently drops the harness from the summary and
from the tracking issue's list of what broke." Also: "The workflow now needs
`issues: write`." And: "a stale open issue means the contract is still broken, so do
not close it to tidy up."

*(Note: the header comment block at the top of `supabase.yml` still says the
scheduled run "opens no issue" — a stale comment; the job body below it contains the
`Open or update the nightly tracking issue` step guarded by
`if: failure() && github.event_name == 'schedule'`.)*

---

## 7. The #687 lesson: two migrations re-emitting one function

Entry `2026-07-31 — Two migrations re-emitting one function off the same base
silently drop each other's appends (#687)` (Status: taken; Scope: db;
Refs: #687, `packages/supabase/supabase/migrations/20260731090000_purge_account_union.sql`,
`packages/supabase/scripts/verify-account-purge.ts`, the 2026-07-30 connections entry).

**The setup.** The M46 account-deletion entry (2026-07-29, #631) had established a
standing rule: "every later milestone appends its new user-owned tables to the
numbered sections of `purge_account` (marker in section 4) AND to the seed +
assertions of `scripts/verify-account-purge.ts`". Functions carry **in-body append
markers** (`purge_account` section (4); `remove_connection` has
`>>> M52/M53: sever seams and pairs <<<`).

**What happened**, verbatim Context:
> "M48 (achievements) and M49 (mutual connections) both landed on `main` within
> hours, and each re-emitted `purge_account` with its own append at the section-(4)
> marker — the pattern the M46 standing rule prescribes. Neither branch saw the
> other's copy, and both were `create or replace` of the whole body. By timestamp the
> M48 copy (`20260730090000`) applies after the M49 one (`20260730070347`), so the
> merged history's final definition carried `achievement_unlocks` and had silently
> lost `connections`, `connection_invites` and `connection_blocks`. **Both branches
> were green: each replayed cleanly on its own, the collision only exists in the
> merged order.** Caught during the #687 apply, before either migration reached the
> linked project."

**Why it is invisible**, verbatim Why:
> "`create or replace function` has no merge semantics — the last writer wins the
> entire body, and **git reports no conflict because the two migrations are different
> files**. Timestamp ordering makes the loser arbitrary (whichever branch merged
> *first* is the one that gets clobbered), so **review of either PR in isolation
> cannot catch it**. The verify harness already asserted both M48's and M49's tables,
> so it would have failed on the merged schema; **nothing ran it between the
> merges**."

**The decision**, verbatim: "The append-marker convention is kept, but it is **not**
collision-safe on its own. When two open branches both re-emit the same whole-body
function, the merge is a **manual union** — re-emit once more in a new migration with
both appends — and the standing rule now extends to the harness: a table added to
`purge_account` must gain its seed **and** its zero-row assertion in
`packages/supabase/scripts/verify-account-purge.ts` in the same change. **That
harness is what turns the collision from silent into loud.**"

**Consequences**, verbatim: "M52/M53 append to both `purge_account` and
`remove_connection` (per the M49 entry's in-body marker) and are the next likely
collision. Before applying any batch of migrations that includes more than one
re-emission of the same function, **diff the bodies pairwise and union them**. Run
`verify-account-purge.ts` against the linked project after any batch that touches
`purge_account`, not just after a single PR."

**It hardened into `CLAUDE.md`** (§Standing cross-surface rules), as two of the seven
promoted rules:
> "**Two migrations that re-emit the same whole function body silently drop each
> other's appends.** `create or replace` has no merge semantics and git reports no
> conflict. Before applying a batch containing more than one re-emission of the same
> function (`purge_account`, `remove_connection` — both use in-body append markers),
> diff the bodies pairwise and union them manually in a new migration."
> "**A table added to `purge_account` gains its seed and its zero-row assertion in
> `verify-account-purge.ts` in the same change.** Run that harness … against the
> linked project after any batch touching `purge_account` — it is the one harness CI
> does not run for you."

**The class recurred outside SQL.** The 2026-08-24 Android entry (#725) records:
"The two branches both re-emitted the same three Arkaik nodes and collided exactly
the way the standing `create or replace` rule warns about; the merge unions them
rather than letting the later branch win." — i.e. the lesson generalised from
Postgres functions to any whole-artifact re-emission.

---

## 8. Human/agent division of labour

### Actors in the journal
See §3. Of 926 events: 682 attributed to a machine actor (`bootstrap` 359,
`claude-code` 323), 242 with no actor (217 of them merge-webhook
`deliverable.shipped`), **1 attributed to `alexis`** (a single `request.filed`), 1 to
`arkaik-sync`.

### Commit authorship
367 commits on `main`. Author lines:

| author | commits |
|---|---|
| `Bohns <hello@bohns.design>` | 359 |
| `Alexis <hello@bohns.design>` | 7 |
| `alexisbohns <58178426+alexisbohns@users.noreply.github.com>` | 1 |

**Every commit is authored by the human.** The agent's presence is in trailers:
**288 of 367 commits (79%) carry at least one `Co-Authored-By: Claude …` line.**
Because merges are squashed, one commit body can carry many trailers; the raw trailer
counts across all bodies read as a model-version census of the project's lifetime:
Opus 4.7 (1M) 437, Fable 5 254, plain "Claude" 142, Opus 4.6 (1M) 124, Opus 4.8 (1M)
86, Sonnet 4.6 75, Opus 4.7 (1M, lowercase variant) 60, Opus 4.8 34, Opus 5 (1M) 26,
Opus 4.6 (1M, lowercase) 25 (top ten).

So: the human is the committer and the reviewer of record; the agent is the
co-author on four of every five commits and the sole actor keeping the product map
current.

### What CLAUDE.md / AGENTS.md tell agents to DO

- **Read the issue first.** "Check the issue description for the specific task and its
  dependencies." (`CLAUDE.md`, "Before you start")
- **Triage ceremony by size** before anything else (`CLAUDE.md`, "Task-size triage
  (read first)").
- **Load knowledge on demand, not up front.** "Keep CLAUDE.md short. Read these when
  relevant — don't pre-load" → `docs/agents/ui-and-styling.md`,
  `docs/agents/data-and-async.md`, the `arkaik` skill,
  `docs/decisions/log.md`, `docs/superpowers/specs|plans/`,
  `.agents/skills/supabase-postgres-best-practices/`, the `lab-note` skill.
- **Read the decision log before an architectural call.** "it is append-only and
  supersede-don't-edit, so the *last* entry on a topic wins."
- **Check for an existing RPC before writing a multi-table Supabase query.** "Grep the
  migrations for `create function public.` and read the relevant ones." (`AGENTS.md`)
- **Regenerate and commit types after a migration.** `npm run db:types …` +
  `git add packages/supabase/types/database.ts` (`AGENTS.md`).
- **Read the vendored Next.js docs first.** `AGENTS.md` opens with a machine-managed
  block: "**This is NOT the Next.js you know** … Read the relevant guide in
  `node_modules/next/dist/docs/` before writing any code."
- **Update the Arkaik map as a side-effect** whenever a screen/route/model/endpoint
  moves (`.claude/skills/arkaik/SKILL.md`: "this skill applies — even if no one
  explicitly asked you to update the map"), and **dual-write** snapshot + journal.
- **Branch before the first commit**; conventional commits; PR body `Resolves #N`;
  labels + milestone always.
- **Write a Lab Note** for user-facing PRs; both languages mandatory.

### What they explicitly tell agents NOT to do

- **"Never refactor existing code without explicit approval. If you see something to
  improve, mention it in a comment — don't change it."** (`CLAUDE.md`, "Before you
  start"). This rule is visibly load-bearing: the 2026-08-24 Android entry (#725)
  deliberately left the draft glue **duplicated** rather than refactor a shipped
  composer, reasoning that "the repo's standing rule is that existing code is not
  refactored without approval, and a bug introduced into `CreatePebbleScreen` while
  porting the flow would be worse than a second copy that is known and recorded."
- **"Never edit CLAUDE.md per-PR for learnings."** (`CLAUDE.md`, "Editing CLAUDE.md /
  AGENTS.md"; decision 2026-05-26.)
- **"Never write to Supabase / `logs` from the dev loop."** (`CLAUDE.md`, Lab Note
  section; the `lab-note` skill: "The skill itself publishes nothing.")
- **"Do not create or edit `docs/arkaik/bundle.json` for a hosted map** … If the MCP
  tools are unavailable, say so and stop rather than falling back to the file — a
  silent fallback is the failure nobody notices." (`.claude/skills/arkaik/SKILL.md`)
- **"Do NOT regenerate the entire map. Make surgical patches."** (same)
- **"Never re-project the snapshot from the journal, or vice versa."** (same)
- **"Never open a PR without labels and milestone"** (unless confirmed). (`CLAUDE.md`
  PR checklist step 4.)
- **"No `any`. No type assertions unless absolutely necessary."** and "New patterns
  require discussion first." (`CLAUDE.md`, Code conventions.)
- **"Never `await` Supabase inside `onAuthStateChange`"** (`README.md` safety rails;
  `docs/agents/data-and-async.md` gives the deadlock mechanism).
- **"Never guard `console.warn`/`console.error` behind `NODE_ENV === 'development'`"**
  (`docs/agents/data-and-async.md`).
- **"Do not hand-write a primitive that the registry ships"**; "Don't surcharge
  shadcn primitives" (`docs/agents/ui-and-styling.md`).
- **Skip the note for non-user-facing work.** "Chore, refactor, infra, or docs-only →
  **no note**: delete the section from the PR body."
- **Skip ceremony on small tasks.** The triage section is as much a prohibition as a
  permission: "Skip brainstorming, planning, TDD ceremony… Skip subagents… Skip the
  Arkaik map update…"
- The `blog-dossier` skill draws the same line for editorial work: "**Do NOT**: write
  the post, paraphrase into 'blog voice', editorialize, fill gaps with
  plausible-sounding narrative, or fabricate quotes. A missing piece is reported as a
  gap, never invented."

### Other division-of-labour evidence

- Several decisions turn on the maintainer being a **single human with a specific
  machine**: "Docker workflows fail often enough that they block work"
  (2026-05-26, remote Supabase); "the maintainer has no Android Studio / local Android
  toolchain and can only download-and-install the CI artifact" (2026-07-11);
  "the maintainer's device-update loop was manual and painful: download the debug-APK
  artifact… unzip, upload to Drive, re-download on the phone, verify, install"
  (2026-07-13).
- Reversals are driven by **on-device human observation**, quoted in the log:
  "Now I have the 1.0.9 and still the straight lines!" (2026-07-14, #555); and #505's
  Live Activity abandonment: "The concern was raised during brainstorming
  (Challenge 2), **wrongly walked back**, and confirmed by device evidence."
- The `.superpowers/brainstorm/` directory holds 6 sessions of served HTML mockups
  (`er-diagram.html`, `souls-grid.html`, `soul-detail.html`, `photo-layout.html`,
  `sonner-style.html`, `foundation.html`, `waiting.html`) — the agent generating
  artifacts for human visual judgement.
- One decision states the agent-first premise outright (2026-07-10, Android
  Kotlin/Compose): "The app will be built **mostly by AI agents with human review**",
  and chose Compose partly because "SwiftUI ↔ Compose are near-isomorphic, making the
  finished iOS app a directly portable reference implementation **for agents**."

---

## What each documentation directory is for

| Path | Purpose | Source |
|---|---|---|
| `docs/decisions/log.md` | Append-only ledger of significant decisions; "Why something is the way it is". | `CLAUDE.md`; the file's own header |
| `docs/superpowers/specs/` (94) | Per-feature design docs: "Pre-flight checklist. Flattens ambiguity *before* code." | `README.md` §2 |
| `docs/superpowers/plans/` (88) | Operationalized specs: 8–15 numbered tasks, self-review checklist, post-ship "Lessons learned" + PR link. | `README.md` §3 |
| `docs/agents/` (2 files) | Load-on-demand topical guides for agents: `ui-and-styling.md` (atomic design, shadcn-first, base-nova-not-Radix quirks, theming, WCAG) and `data-and-async.md` (DataProvider, the `onAuthStateChange` deadlock, `withTimeout`, error-logging rules). | `CLAUDE.md` "Where knowledge lives"; the files |
| `docs/seeds/` | Raw seed geometry consumed by a migration: `domain-glyph-seed.json` (18 domain slugs → `{d, width}` stroke arrays, "matches the legacy webapp stroke format already in the DB") and `shape-seeds/*.svg` (9 files, `{size}-{valence}`). | `docs/superpowers/plans/2026-04-15-remote-pebble-engine-slice-1.md` lines 20–21, 172–183, 684 |
| `docs/poc/admin-analytics/` | "The original POC handoff from Claude Cowork: HTML mockup, SVG layout, MV DDL, TS contracts, server fetchers, and the implementation kickoff prompt. **Reference material — not all of it is buildable on the current schema.**" | `docs/admin-analytics/ROADMAP.md` |
| `docs/admin-analytics/ROADMAP.md` | "the single source of truth for the analytics work on the back-office. It indexes the spec, the original POC handoff, the shipped slice, and the open follow-up issues." Records the arbitration rule: "The POC and the thin-slice spec sometimes disagree. **The spec wins for what we actually ship.**" | the file |
| `docs/arkaik/` | `arkaik.json` (hosted project pointer), `bundle.json` (460-node snapshot, no longer the plane agents read), `journal.jsonl` (926 events), `assets/` (empty). | 2026-07-28 entry; the files |
| `docs/android-play-deploy.md` | The one-time Play Console + secrets runbook only the maintainer can execute. | 2026-07-13 entry; `android-release.yml` header |
| `.claude/skills/` | Repo-local skills: `arkaik` (v3.2.0, + `references/schema.md`, `references/values.md`, `scripts/validate-bundle.js`), `lab-note`, `blog-dossier`. | filesystem |
| `.agents/skills/` | Vendored third-party skills pinned by `skills-lock.json`: `supabase` and `supabase-postgres-best-practices` (30 reference files on RLS, indexing, locking, pooling), both `source: supabase/agent-skills`, `sourceType: github`, with `computedHash` integrity stamps. | `skills-lock.json`; filesystem |
| `.arkaik/` | The graph's back-fill corpus: `bootstrap/` (30 `fragments/*.json`, `manifest.json`, `profile.json`, `slices/`) and `corpus/` (`docs.json`, `prs.jsonl`, `surfaces.json`). | filesystem |
| `.superpowers/brainstorm/` | Six served-HTML brainstorm sessions with `server.log`/`server.pid`/`server-stopped` state. | filesystem |

---

## Hard-won lessons the log records

Each with its date and issue number, as recorded in `docs/decisions/log.md`.

1. **2026-07-31 · #687 — `create or replace` has no merge semantics.** Two branches
   re-emitting one function body off the same base silently drop each other's
   appends; git reports no conflict (different files), timestamp order picks an
   arbitrary loser, and per-PR review cannot catch it. Fix: manual pairwise diff +
   union in a new migration, and a harness assertion added in the same change as the
   table. Recurred in a non-SQL form on Arkaik nodes (2026-08-24, #725).
2. **2026-07-30 · #651 — a same-surface round-trip cannot catch a same-surface
   formatter bug.** Three clients emitted three ISO-8601 precisions (web ms, Postgres
   µs, iOS whole seconds); iOS's single formatter silently decoded every foreign
   `happened_at` to `nil`, "and every iOS test passed throughout, because they encoded
   with the same formatter they decoded with." Fix: test against real foreign
   payloads verbatim; parse tolerantly, emit at the narrowest precision every reader
   accepts. Also: "Anything comparing values that have been through Postgres `jsonb`
   must compare **canonically**" — a naive `JSON.stringify` equality "cost two false
   failures in the harness before the assertion was fixed rather than the product."
3. **2026-07-29 · #616 (and #442 before it) — Postgres views are `security_invoker`
   by default, and "no explicit grant" is not "no access", it is access for `anon`.**
   `v_pebbles_full` shipped without it; a live probe with only the publishable key and
   no session returned "182 pebbles across 20 distinct users". Second occurrence of
   the class. Fix: `with (security_invoker = true)` + explicit revoke/grant on every
   new view; a trailing `auth.uid()` filter is not a substitute.
4. **2026-09-02 · #739 — owning a row is not authority to raise capability in it.**
   `profiles_update` had been owner-scoped with no `with check` and no column scoping
   since `20260411000001`; `is_admin`, `max_media_per_pebble` and the two consent
   timestamps were therefore self-grantable. Found by an external audit
   (`F-2026-08-SEC-supabase-01`), "that audit's only open P0". Fix: a
   `before update of <columns>` trigger, not column privileges ("a table grant covers
   every column… a silent hole the first time someone forgets") and not a `CHECK`
   ("a `CHECK` constraint cannot see `OLD`").
5. **2026-09-02 · #741 — a test that only runs when a human remembers is not a
   gate.** "#739 is what that costs… the guard that closed it (#740) was protected by
   nothing but a script somebody had to think to run."
6. **2026-09-02 · #743 — a failure signal nobody is forced to walk past is not a
   signal.** And: auto-closing a tracking issue on a green run was rejected because
   "an intermittent failure would quietly close its own report." Plus the shell
   lesson: GitHub's default `bash -e {0}` has no `pipefail`, so `harness | tee`
   reports success for a failing harness — read `PIPESTATUS[0]`.
7. **2026-08-23 · #720 — a fixture page that exercises only the fallback path cannot
   catch a regression on the other branch.** "`/sandbox/path` fixtures all carry
   `render_svg: null`… which is exactly how the first cut of `PathStone` shipped bare,
   unwobbled outlines while the sandbox looked correct." Also, the correctness
   argument for round-robin masonry: height-balancing "lets a short card jump the
   queue… on a *Path*, whose entire premise is chronology, that is a correctness bug
   wearing a tidier bottom edge."
8. **2026-07-14 · #555 — a Debug-only experiment gate is invisible on the only
   surface the reviewer uses.** The Android review loop is the Play internal-testing
   *release* pipeline, so the iOS-style Debug gate made the experiment unreviewable
   ("Now I have the 1.0.9 and still the straight lines!").
9. **2026-07-01 · #505 — iOS does not render a foreground app's own Live Activity in
   the Dynamic Island.** The whole feature premise was invalid; "The concern was
   raised during brainstorming (Challenge 2), wrongly walked back, and confirmed by
   device evidence."
10. **2026-07-11 · #530 — a milestone design's premise about the maintainer's machine
    can simply be false.** The secretless-debug-APK design assumed local device
    builds; "That premise is false: the maintainer has no Android Studio / local
    Android toolchain."
11. **2026-07-28 · #622 — an API that validates path *format* rather than existence
    fails open and silently.** The brief's `apps/webapp` prefix "would have returned
    201 and then silently matched nothing, and web would never have promoted."
12. **2026-06-29 · #494 — a `CHECK(balance >= 0)` on the wallet snapshot would break
    pebble deletion.** Earn-side clawbacks must apply even into the negative; the
    non-negative rule belongs only in the `spend_karma` RPC. And an unguarded
    `refund_karma` granted to `authenticated` "is a karma-minting hole".
13. **2026-07-29 · #639 — a `status` column on `pebbles` would have obliged every
    present and future view/analytics migration to carry a `status <> 'draft'` filter
    "that silently leaks drafts into ripple, bounce, week groups and the KPI views the
    day someone forgets it."**
14. **2026-08-24 · #725 — duplication was chosen over refactor on purpose.**
    Two copies of the draft lifecycle exist on Android because the standing
    no-refactor-without-approval rule outranked the drift risk, and the duplication is
    recorded rather than hidden.
15. **2026-08-23 · #723 — a future reader will find two composers and may assume one
    is dead code.** The entry exists mainly to say it is not, and that "Resolving the
    experiment means deleting *one* of them plus the long-press gesture, not merging
    them."

---

## NOT FOUND

- **`.github/workflows/lab-note.yml`** — referenced by both `CLAUDE.md` and
  `.claude/skills/lab-note/SKILL.md` but absent from the working tree; deleted in
  commit `8d22e405` ("chore: lab notes now land in the arkaik journal via the GitHub
  App webhook (#705)"). Both references are stale.
- **A rejected / deprecated / superseded-by decision-log entry.** The template offers
  those `Status` values; no entry uses one.
- **Any spec or plan dated 2026-09.** The last is 2026-08-24.
- **Any per-agent role definition file** (e.g. `.claude/agents/*`). `.claude/` holds
  only `launch.json`, `settings.json`, `settings.local.json` and `skills/`.
  Sub-agents are referenced by name in `CLAUDE.md` ("Plan, Explore, Reviewer") but
  not defined in-repo.
- **`docs/quality/`** — confirmed absent; its absence is the stated reason Kritik was
  rejected as the nightly-failure destination (2026-09-02, #743).
- **A CI workflow for `apps/web` or `apps/admin` lint/build.** Only Vercel builds
  cover those (per the #741 entry's context).
- **An automated sweep for orphaned harness accounts.** Explicitly stated not to
  exist ("deleting them needs the service role").
