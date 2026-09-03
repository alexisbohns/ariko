---
name: "Every commit is mine. Four in five have a co-author."
description: How one person kept four surfaces, an economy and a community moving with AI agents — by building the memory, the guardrails and the proofs that let agents work at scale.
date: 2026-09-02
bean: pbbls-agentic
---

# Every commit is mine. Four in five have a co-author.

364 commits on `main`. Every one authored by me. 285 of them — 78% — carry a
`Co-Authored-By: Claude` trailer.<!-- src: git rev-list --count main @ 2026-09-02 = 364; 285 commit bodies contain a Co-Authored-By: Claude trailer -->
Four surfaces, a currency, a marketplace, a small community, one person. The
interesting part is not that agents wrote code. It is everything I had to build
before they could.

## The trailer census

Merges are squashed, so one body can carry many trailers: 1,310 across `main`, and
together they read as a model-version history of the project. Opus 4.7 (1M context)
497, Fable 5 266, plain "Claude" 142, Opus 4.6 (1M) 149, Opus 4.8 in its two forms
133, Sonnet 4.6 76, Opus 5 44, Sonnet 5 3.<!-- src: git log main --format='%B' | grep -i 'Co-Authored-By: Claude' | sort | uniq -c, 2026-09-02 -->

That is the thesis in one statistic, and it is not "AI wrote my app". It is a
specific, auditable split: the human is the committer and the reviewer of record;
the agent is the co-author on four commits in five, and the only actor keeping the
map of the product current. Everything below is the infrastructure that split
required, and almost none of it is code.

## The decision log, because settled questions kept getting re-litigated

Until 26 May 2026 the architecture decisions lived in GitHub Issues. The entry
that ended that arrangement is blunt about why it failed. Issues are
> "good for discussion, but not greppable from the repo, noisy, and invisible to
> agents at read time. Settled questions kept getting re-litigated because there
> was no durable, low-token home for them."<!-- src: docs/decisions/log.md 2026-05-26 "Track significant decisions in an in-repo log" #477 #482 -->

Three adjectives, and the third is the one specific to agents. A human who argued a
question in March remembers arguing it. An agent starts every
session with no memory of anything not in the repository. If the reasoning is not
written where it will be read, the same question gets answered again —
differently, and at full price.

So: an append-only ledger, one terse entry per significant decision,
supersede-don't-edit, eight fields, and a gated micro-step in the PR checklist,
"usually a no-op". One significance test governs it:
"would a future agent or human waste real time rediscovering or wrongly reversing
this?"<!-- src: docs/decisions/log.md, header block lines 1-11 -->

Forty-two entries later, the discipline report is instructively
mixed.<!-- src: docs/decisions/log.md, grep -c '^## 20' = 42, entries dated 2026-05-26 to 2026-09-02 -->
All 42 carry all eight fields in template order, `Refs` line included; not one is
missing a `Why`. What eroded is brevity — the
Consequences field of a single August entry runs to roughly 500 words. [The rule
that says "keep entries terse" is at the top of the same
file.]<!-- src: docs/decisions/log.md 2026-08-24 web valence fan entry; rules block lines 5-11 -->
The `Status` axis eroded differently: it is unused. The template offers `rejected`,
`deprecated` and `superseded-by`; all 42 say `taken`, and supersession happens
instead in the newer entry's own `Supersedes` field.<!-- src: docs/decisions/log.md, field census 2026-09-02: 14 of 42 carry a non-em-dash Supersedes value -->
Structure is the thing you notice missing. Terseness is the thing you only notice
in aggregate, which is to say never.

The ledger is the deep memory; a shallower, more expensive one sits above it.
`CLAUDE.md` and `AGENTS.md` load into *every* agent context, which makes them
> "the most token-precious files in the repo and must hold only durable,
> action-guiding rules — not a junk drawer of observations."<!-- src: docs/decisions/log.md 2026-05-26 "Promote learnings into CLAUDE.md only on hardening" #479 -->

Hence a two-stage pipe, decided the same day as the log itself. A lesson is
*captured cheaply*, in the "Lessons learned" section of the plan that produced it —
13 of the 88 plan files have one.<!-- src: docs/superpowers/plans/, grep for "Lessons learned", 2026-09-02 -->
It is *promoted* into `CLAUDE.md` only when it clears two bars: **durable**
("outlives the next refactor") and **action-guiding** ("tells a future agent what to
do or avoid, not a passive observation"). Promotion is a milestone grooming pass
folded into the existing monorepo audit, never a per-PR
gesture.<!-- src: docs/decisions/log.md 2026-05-26 #479 -->
The promoted set is seven rules under a heading that says what promotion buys:
"breaking one is a regression, not a style choice."<!-- src: CLAUDE.md §"Standing cross-surface rules", 2026-09-02 -->

The half people skip is demotion, and it is the half that proves the pipe is real. A
cross-surface payload rule written on 30 July flagged itself as a candidate at the
next grooming pass, and has since landed in the standing
rules.<!-- src: docs/decisions/log.md 2026-07-30 #651; CLAUDE.md §Standing cross-surface rules -->
An iOS rule went the other way: the 24 August entry records that
`apps/ios/CLAUDE.md`'s "no `#available` guards" line "is now contradicted by the
codebase" and needs rewording to what it always meant — no guards around APIs that
have an iOS 17 equivalent.<!-- src: docs/decisions/log.md 2026-08-24 #727 -->
A stale rule is more expensive than no rule, because an agent will obey it.

## Ceremony scales with blast radius

The next piece of infrastructure is a permission to do less. The task-size triage
opens with a diagnosis rather than a rule: "**Heavy workflows on small tasks are the
main reason agent work feels slow.**"<!-- src: CLAUDE.md §"Task-size triage (read first)" -->

Three tiers. Under about 150 lines: skip brainstorming, planning, TDD ceremony,
subagents and the map update. Under about 500: sketch the approach in two or three
sentences, no plan document. Cross-app, schema migration or a new surface: the full
loop — "the ceremony pays for itself
here."<!-- src: README.md §4 Execution; CLAUDE.md §Task-size triage -->
That section is as much prohibition as duty, and the prohibitions are the
load-bearing half.

The artifact count shows where the blast radius actually was: 94 specs and 88 plans
between 11 April and 24 August 2026.<!-- src: docs/superpowers/specs/ = 94 files, docs/superpowers/plans/ = 88 files, 2026-09-02 -->
April produced 41 of each; June produced four; September produced none at all, and
its three decisions shipped without a spec/plan
pair.<!-- src: filename-prefix census of docs/superpowers/{specs,plans}/, 2026-09-02: specs 41/24/4/21/4 and plans 41/23/4/17/3 for Apr-Aug -->
That is the rule working, not lapsing. April was a monorepo, a database and four
surfaces from nothing; June was maintenance. Process volume that stays flat across
those two months measures the process, not the work.

One prohibition earns its keep by costing something and getting obeyed anyway:
"Never refactor existing code without explicit
approval."<!-- src: CLAUDE.md §"Before you start" -->
On 24 August an Android change duplicated the draft-lifecycle glue rather than
refactor a shipped composer, reasoning that "a bug introduced into
`CreatePebbleScreen` while porting the flow would be worse than a second copy that
is known and recorded."<!-- src: docs/decisions/log.md 2026-08-24 #725; a further entry, 2026-08-23 #723, exists to tell a future reader neither copy is dead code -->
Duplication chosen deliberately and written down is a different object from
duplication that happened.

## The map stopped being a file

Pebbles keeps a product graph — screens, endpoints, data models, acceptance criteria,
decisions, and the edges between them. On 1 April 2026 it held 67 nodes and 108
edges, all of them at status
`idea`.<!-- src: pbbls commit bf72d36e, 2026-04-01, docs/arkaik/bundle.json -->
It was a wishlist with a schema.

Today it holds 460 nodes and 1,001 edges: 342 `live`, 60 in development, 23 still
`idea`, 22 archived, 13 backlog. Two species that did not exist in April —
`acceptance` at 159 nodes and `decision` at 40 — are 43% of the graph, and the
status distribution inverted from 100% wishlist to 74%
shipped.<!-- src: docs/arkaik/bundle.json, schema_version 3, project.updated_at 2026-08-24T23:05:00Z -->

The mechanical change matters more than the growth. On 28 July the map moved off
disk. A two-key file holding a project id and an origin, no credential, points the
agent tooling at a hosted graph, so "the local `docs/arkaik/bundle.json` stays in
the tree but is no longer the plane agents read." Path-scoped repository links "let
a PR move the right platform with no annotation", and status is promoted by the
pull-request lifecycle itself: "PR opened → development, merged → live, closed
unmerged → nothing."<!-- src: docs/decisions/log.md 2026-07-28 #622 -->
The graph went from a file an agent hand-patches to a service an agent mutates, with
promotion driven by merges rather than by memory.

One deliberate omission is the entry's sharpest call: the admin app is left
unlinked, because "Arkaik models only `web | ios | android`, so admin could
only be linked as `web` — and an admin-only PR would then mark the
*customer-facing* web app shipped." Leaving it out "keeps the 'shipped' signal
honest", and the entry forbids adding the link later "as a convenience fix for the
'missing' link".<!-- src: docs/decisions/log.md 2026-07-28 #622 -->

### The journal, and the number everyone misreads

The graph keeps a history alongside its snapshot: 926 events from 26 March to 24
August 2026. The actor distribution reads `bootstrap` 359, `claude-code` 323, no
actor at all 242 (217 of those merge-webhook `deliverable.shipped` events),
`arkaik-sync` 1, and `alexis` 1.<!-- src: docs/arkaik/journal.jsonl, 926 lines, actor census 2026-09-02 -->

One. A single `request.filed`.

The wrong reading is that the human stopped working. The journal is not a record of
who did the work; it records what the automation captured, and the automation exists
so that nobody writes to it by hand. `bootstrap` is the graph being back-filled from
the repository's own paper trail.<!-- src: .arkaik/bootstrap/ (30 fragment files) and .arkaik/corpus/, filesystem 2026-09-02 -->
`claude-code` is the map maintained as a side effect of feature work, because the
skill says it applies "even if no one explicitly asked you to update the
map."<!-- src: .claude/skills/arkaik/SKILL.md -->
The actor-less events are a webhook noticing merges. My one entry is a
`request.filed`, the only operation in that system nothing else can perform: wanting
something.

A journal in which the maintainer appears three hundred times is a journal being
kept as a chore. This one appears once because the labour moved upstream — into the
skill file, the dual-write rule, the hosted link, the reference policy. August is 69
of 70 events from `claude-code`: by then the back-fill was done and the map was
simply current. The instinct that makes that safe is in the skill itself: "If the MCP
tools are unavailable, say so and stop rather than falling back to the file — a
silent fallback is the failure nobody notices."<!-- src: .claude/skills/arkaik/SKILL.md -->

## Two migrations, one function, and no conflict

Here is the bug the workflow itself created.

A milestone in late July established a standing rule: every later milestone appends
its new user-owned tables to the numbered sections of the `purge_account` Postgres
function, and to the harness that verifies it. The function carries an in-body
marker so the append lands in the right
place.<!-- src: docs/decisions/log.md 2026-07-29 #631 -->
It is a good rule. Two agents obeyed it at once.

M48 (achievements) and M49 (mutual connections) landed on `main` within hours of
each other. Each re-emitted `purge_account` with its own append at the marker,
exactly as prescribed. Neither branch saw the other's copy, and both were a
`create or replace` of the whole body. By migration timestamp one copy applies
after the other, so the merged history's final definition carried the achievements
table and had silently lost `connections`, `connection_invites` and
`connection_blocks`.<!-- src: docs/decisions/log.md 2026-07-31 #687 -->

Both branches were green; each replayed cleanly on its own. The collision exists
only in the merged order:
> "`create or replace function` has no merge semantics — the last writer wins the
> entire body, and **git reports no conflict because the two migrations are
> different files**. Timestamp ordering makes the loser arbitrary … so **review of
> either PR in isolation cannot catch it**."<!-- src: docs/decisions/log.md 2026-07-31 #687 -->

Caught during the apply, before either migration reached the linked project; the fix
was a third migration re-emitting the body with both
appends.<!-- src: docs/decisions/log.md 2026-07-31 #687; packages/supabase/supabase/migrations/20260731090000_purge_account_union.sql -->

Nothing about that bug requires an agent. It requires *parallelism*, which is what
the whole arrangement is for: two branches in flight, each correct, each following
the standing rule, neither able to see the other. One person on one branch at a time
never produces it. So the rule survived with its limits stated — the marker
convention "is **not** collision-safe on its own", the merge of two such branches is
"a **manual union**", and the rule now extends to the harness, because "that harness
is what turns the collision from silent into
loud."<!-- src: docs/decisions/log.md 2026-07-31 #687 -->

It hardened into `CLAUDE.md` as two of the seven standing rules, which is the
promotion pipe running.<!-- src: CLAUDE.md §"Standing cross-surface rules" -->
Then the class recurred outside SQL: on 24 August two branches both re-emitted the
same three Arkaik nodes and collided the same way.<!-- src: docs/decisions/log.md 2026-08-24 #725 -->
The lesson had generalised from Postgres functions to any whole-artifact
re-emission, which is the sort of thing you only learn by having it happen twice.

One more sentence in the July entry is the bridge to everything after: the verify
harness already asserted both milestones' tables, so it would have failed on the
merged schema. Nothing ran it between the
merges.<!-- src: docs/decisions/log.md 2026-07-31 #687 -->

## Proof rather than simulation

The database is the contract between four clients, and five Deno scripts are the
proof for anything crossing a surface boundary:
> "They are **acceptance tests, not simulations**: each signs up throwaway users
> **against the linked production project**, exercises the real RLS policies,
> triggers, RPCs and the real `delete-account` edge function, then deletes what it
> made in a `finally`."<!-- src: packages/supabase/CLAUDE.md §"Contract harnesses (scripts/verify-*.ts)"; the finally runs even on failure -->

Until 2 September 2026 those scripts were wired to nothing. A pull request changing
only migrations or edge functions "got two Vercel builds proving the web and admin
apps still compile, which they would with or without any schema change", while the
harnesses "ran only when a human remembered
to."<!-- src: docs/decisions/log.md 2026-09-02 #741 -->
Pebbles ran a deliberate security and quality audit across the data layer and the
client contract; a guard that programme produced was, for a time, protected by
nothing but a script somebody had to think to run. A test that only runs when a
human remembers is not a gate. It is a habit with good intentions.

So four of the five became a merge gate, path-filtered, plus a nightly and a manual
dispatch — because "nightly alone detects a dropped guard *after* merge … the
path-filtered PR trigger blocks it, and the nightly still catches the case nobody
path-matched." The cost is stated rather than absorbed: "Every merged PR touching
that path now performs a handful of production signups and deletions; that is the
price of the harnesses being proof rather than
simulation."<!-- src: docs/decisions/log.md 2026-09-02 #741 -->

The fifth harness stays manual, and the reason is the repository itself. It is the
one needing a service-role key; that key is not added to a public repo; and "a
same-repo PR is still code that runs before review", so the contract "keeps the human
gate it already has rather than trading it for a new class of exposure." The
consequence is written down without softening: that contract "remains the one
contract with no automated gate", and the rule to run the harness by hand "is now the
*only* thing protecting it, and is correspondingly less
forgiving."<!-- src: docs/decisions/log.md 2026-09-02 #741; packages/supabase/CLAUDE.md -->

Then the gate needed a gate. The same day, a second entry superseded the first's
assumption that a notification was enough. The repository has no failure wiring at
all — no `failure()` step anywhere, no webhook — so
> "the nightly, the one gate that catches a regression on a PR that never touched
> `packages/supabase/`, **was also the one gate whose failure nobody is forced to
> walk past.**"<!-- src: docs/decisions/log.md 2026-09-02 #743 -->

Now every run writes a per-harness result table to the job summary. A scheduled
failure opens one reused tracking issue; a pull-request failure opens nothing, since
the red check is already in front of whoever caused it. And the issue
is closed by hand. Auto-closing on green was rejected, in the best sentence in the
log: "an intermittent failure would quietly close its own report, which is the
failure mode the whole gate exists to
prevent."<!-- src: docs/decisions/log.md 2026-09-02 #743 -->

One detail of that plumbing is the whole ethic in miniature. GitHub's default shell
has no `pipefail`, so piping a failing harness through `tee` exits 0 and reports
success; the wrapper reads the harness's own status
instead.<!-- src: .github/scripts/verify-harness.sh, reads PIPESTATUS[0] -->
A reporting layer that reports success is worse than none.

## Where it stands, 2 September 2026

Forty-two recorded decisions. Ninety-four specs, eighty-eight plans. A 460-node
product graph maintained by an agent as a side effect of shipping. Five contract
harnesses, four of them a merge gate and one deliberately not. Seven standing rules,
two of which exist because two branches once re-emitted the same Postgres function.

Four surfaces: web and admin deploy to Vercel, Android builds a signed bundle to
Google Play internal testing, iOS builds on Xcode Cloud. **No surface has a public
release.** The store roadmap holds v1.0 as still ahead, with ten product points
gating it: "nothing here is post-launch."<!-- src: _digests/surfaces-current.md §8, drawn from README.md §Deployment, android-release.yml, apps/ios/ci_scripts/ci_post_clone.sh, and the 2026-07-28 store roadmap -->

Documentation for agents decays exactly like documentation for humans, at the same
rate. `CLAUDE.md` and the Lab Note skill both still reference a workflow file deleted
when note-posting moved to a webhook; the header comment on the harness workflow
still says the scheduled run opens no issue, and the job body below it opens
one.<!-- src: .github/workflows/lab-note.yml absent, deleted in commit 8d22e405 (#705); .github/workflows/supabase.yml header comment vs job body, 2026-09-02 -->
Both are three-line fixes waiting for the next grooming pass; that they are still
there is the honest measure of how well the pipe runs.

The open question is that pipe's second direction. One iOS rule is contradicted by
its own codebase and queued for rewording. Promotion has run demonstrably; demotion
has run once. A memory that only accumulates will eventually mislead the thing
reading it, so the number worth watching six months from now is not how many rules
stand. It is how many came down.

What is left for the human is what an agent structurally cannot do: hold a
preference across months, pick up an actual phone and see that the lines are still
straight,<!-- src: docs/decisions/log.md 2026-07-14 #555, on-device observation reversing the wobble experiment -->
and decide that a rule which was right in May is wrong in August. That work did not
shrink. It moved up a level, which is the only place it was ever going to go.
