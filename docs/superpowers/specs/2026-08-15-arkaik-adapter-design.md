# Slice 3 — Arkaik adapter: journal → pollen, lab notes → journal

**Date:** 2026-08-15
**Status:** Approved design. Child of the umbrella spec
[`2026-08-14-ariko-federation-design.md`](2026-08-14-ariko-federation-design.md)
(§10, sub-project 3), implementing the contract of
[`2026-08-15-pollen-federation-contract-design.md`](2026-08-15-pollen-federation-contract-design.md)
(`docs/POLLEN.md` v1).
**Shape:** Work lands mostly in the **arkaik repo** (feed + webhook), with a
retirement pass across **pbbls** and **arkaik** and a garden/docs touch in
**ariko**. No ariko read model — that is slice 4; this slice makes arkaik a
conforming pollen *producer*.

---

## 1. Goal

Arkaik becomes the first federated source: its hosted journals are exposed as
a pollen feed (report verb, HTTP transport), and the Lab Note ritual moves
one layer down — merged PRs of arkaik-mapped repos land their note in the
**arkaik journal** (where decision→delivery already lives) instead of posting
straight to the ariko inbox. Ariko's reusable `lab-note.yml` is retired for
those repos; everyone else keeps it.

Deliverables:

1. **Pollen feed endpoint** (arkaik) —
   `GET /api/graph/projects/{projectId}/pollen?after=<id>&limit=<n>`,
   serving `{ "pollen": [...] }` per `docs/POLLEN.md`.
2. **Journal→pollen mapping** (arkaik) — a pure, fixture-tested projection
   from hosted journal events to envelopes.
3. **Lab-Note-into-journal webhook extension** (arkaik) — the existing
   GitHub App webhook parses `## Lab Note` from merged PR bodies and appends
   a `deliverable.shipped` event carrying the note.
4. **Federation config** (arkaik) — a per-project plant anchor; the feed is
   opt-in per project.
5. **Retirement** (pbbls, arkaik, ariko) — stub workflows removed from
   arkaik-mapped repos, CLAUDE.md contracts updated, garden bees updated.

## 2. Approach decision

Three shapes were weighed:

- **A — ariko-side adapter.** Ariko polls arkaik's existing
  `GET …/journal` endpoint and maps events to envelopes inside its read
  model. Least arkaik work, but it breaks the federation's core rule —
  sources report pollen, ariko reads one contract — and bakes an
  arkaik-special-case into ariko forever. The lab-note webhook would still
  require arkaik-side work, so the savings are small anyway.
- **B — arkaik-side producer** ✅ chosen. Arkaik serves the pollen feed
  itself, per hosted project, reusing the hosted read plane (auth, ownership,
  journal store). The mapping lives where the vocabulary lives; ariko's
  slice-4 reader stays source-agnostic. When femfolk graduates to hosted
  (slice 7 decides), the same endpoint serves it with zero new code.
- **C — committed feed files.** A scheduled Action in each mapped repo
  projects the sidecar journal into `pollen/feed.ndjson`. Works without
  hosting, but webhook-authored events (acceptance promotions, lab notes)
  live in the *hosted* journal and cannot reach a repo file from the
  webhook; and it multiplies transports per repo. Stays what POLLEN.md
  already says it is: the fallback transport for unhosted sources, unused
  by this slice.

## 3. The feed (arkaik)

### Endpoint

`GET /api/graph/projects/{projectId}/pollen?after=<id>&limit=<n>` on the
hosted API, next to the existing `…/journal` route.

- **Auth:** same read plane as every graph read — `ark_` token with
  `graph:read`, owner-scoped. Ariko's slice-4 sync will hold exactly one
  secret (an arkaik token), satisfying the umbrella's one-secret rule.
  No public mode in v1.
- **Order & cursor:** envelopes in the journal's server order (the same
  order `getJournal` serves). `after` is the last **pollen id** the consumer
  processed; unknown `after` → **410 Gone** (consumer drops its cursor and
  rebuilds — POLLEN.md semantics). `limit` defaults to 100, capped at 200.
  Empty array ⇒ caught up.
- **Opt-in:** a project with no federation config (§5) does not serve a
  feed — `404`, indistinguishable from no route.
- **Rebuild reality:** a bundle import/restore replaces the hosted journal
  wholesale (`replaceJournalRows`); event ULIDs are preserved, so a rebuild
  converges on the same envelope ids. Cursors that survive keep working;
  cursors that don't get the 410. This is exactly the "coordinated rewrite"
  case the contract reserves.

### Mapping — journal event → envelope

A pure function `(events, snapshot, config) → Pollen[]` in the arkaik house
style (projections are pure; the route is a thin shell). v1 maps **three
event families** — the showcase-grade record, per the umbrella's rule that
ariko never mirrors arkaik's fine-grained graph:

| journal event | pollen kind | title | refs | payload |
|---|---|---|---|---|
| `deliverable.shipped` | `shipped` | `lab_note` titles (en+fr) when present, else event `title` | `{pull request, url}`, `{deliverable, ref: deliverable_id}`; on a re-append, `{corrects, ref: <first occurrence's pollen id>}` | `summary`, `node_ids?`, `suggested?` |
| `release.tagged` | `release.tagged` | `"<version> released"` (+ platform when scoped) | — | `version`, `platform?`, `notes?` |
| `decision.status_changed` with `to: "approved"` | `decided` | the decision node's `title` from the snapshot (fallback: `node_id`) | `{decision, ref: node_id}` | `from`, `to` |

Envelope constants: `v: 1`; `id: "arkaik:<event ULID>"`; `at` = event `ts`;
`source: "arkaik"`; `anchors: { plant: "plant:<configured slug>" }`;
`visibility` omitted (publishing stays a human act ariko-side).

Everything else — `node.created`, `node.updated`, `node.status_changed`,
edges, refs, baselines, `idea.proposed`, `request.filed` — is **unmapped**
in v1. Ideas/requests are the first candidates for promotion when synthesis
(slice 5) wants the idea-to-delivery arc; that is an additive change.

Re-appended deliverables honour envelope immutability: each occurrence is
its own journal event, hence its own envelope; occurrences after the first
carry a `corrects` ref to the first occurrence's pollen id instead of
mutating it.

An event a strict mapping cannot express (malformed `ts`, blank title) is
skipped and logged server-side — never a 500, never silently uncounted in
tests.

### Conformance

Arkaik vendors ariko's reference validator (`lib/pollen.ts`) and the
`data/pollen/` fixtures, as slice 2 planned for sibling repos. Tests assert:
every envelope the mapping emits passes `validatePollen` with zero warnings;
recorded journal fixtures (a pbbls-shaped sample) project to expected
envelopes; the ariko conformance fixtures still pass the vendored validator
unchanged (drift alarm).

## 4. Lab Note into the journal (arkaik webhook)

The GitHub App webhook already turns PR events of linked repos into
acceptance promotions through `applyMutation`, with journal events and the
`github-app` actor. This slice adds a second, independent handler on
**merged** PRs:

1. Extract the `## Lab Note` section (same contract as ariko's pipeline:
   heading starts with `## Lab Note`, exactly one ```` ```yaml ```` fence);
   parse with the `yaml` dependency arkaik already ships.
2. **No note → no event** — the gate is unchanged: chores don't ship
   deliverables.
3. **Valid note** → append one `deliverable.shipped` event to each linked
   project's journal: `deliverable_id: "pr-<number>"` (the convention the
   pbbls journal already uses), `title`/`summary` from `en`, `url` = PR URL,
   `actor: "github-app"`, plus a new **optional `lab_note` field** carrying
   the full parsed note (`en`, `fr?`, `suggested?`) so the bilingual title
   survives into pollen. Adding an optional field is additive under the
   journal spec's forward-compatibility rule; `docs/spec/journal.md` gains
   the field.
4. **Invalid note** → logged refusal in the delivery response, never fatal,
   never blocking the acceptance-promotion handler. The authoring ritual
   (PR template, `lab-note-reminder.yml`, CLAUDE.md contract) survives
   untouched — the reminder still surfaces problems at PR-open time.
5. **Idempotency:** GitHub redelivery re-appends the same `deliverable_id`;
   journal semantics already resolve that latest-wins. A content-equality
   guard against the latest occurrence skips byte-identical re-appends so
   redelivery doesn't grow the journal. Editing a merged PR body and
   redelivering *is* the correction path — it lands a new occurrence, which
   the feed emits as a `corrects` envelope.

This appends via a small direct journal-append store function (no snapshot
change — `deliverable.shipped` has no snapshot cross-check), not through
`applyMutation`'s graph ops.

## 5. Federation config (arkaik)

A per-project setting: the **plant anchor** (`plant_slug`, e.g. `pbbls`),
set in the project settings UI next to products and linked repos. Present ⇒
feed served with `anchors.plant = "plant:<slug>"`; absent ⇒ no feed. The
source stays sovereign over its anchors, and arkaik-the-product gains a
generic feature, not an ariko hardcode. Anchor depth stops at plant in v1
(matching the conformance fixtures); pod/bean anchoring is a later additive
refinement.

## 6. Mapping the repos & retirement

- **pbbls** — already linked to hosted `prj_5dDiZc-G6lseF3cb` with the App
  installed. Set its plant slug; delete `.github/workflows/lab-note.yml`
  (the stub calling ariko's reusable workflow); update pbbls CLAUDE.md: the
  note now lands in the arkaik journal on merge and reaches ariko through
  the feed. The authoring contract and reminder stub stay.
- **arkaik (the repo)** — gets mapped to a minimal hosted project of its
  own (journal-first: a `journal.baseline`-clean skeleton is legitimate;
  the graph grows later), repo linked, plant slug `arkaik`; then the same
  stub retirement and CLAUDE.md update. This is what lets arkaik's own
  decisions (the `decided` fixture is literally the Oxymore-panels decision)
  reach the beanstalk.
- **femfolk, melogram, ariko** — keep the ariko `lab-note.yml` stub;
  femfolk is repo-bundle (unhosted), melogram is unmapped, ariko dogfoods
  its own inbox. Femfolk's graduation is slice 7's decision.
- **The latency window** — between this slice and slice 4, retired repos'
  notes accumulate in journals/feeds instead of appearing in the ariko
  inbox. That is the umbrella's idempotency posture (a missed run costs
  latency, never correctness), and re-adding a stub is a one-file revert if
  slice 4 stalls.
- **ariko garden** — `arkaik-adapter` bee: levers gain the feed URLs and
  the webhook route; **status stays `planned`** until slice 4 actually
  ingests (a feed nobody reads is not a live brick).
  `lab-note-pipeline` bee: `serves` drops `plant:pbbls` and
  `plant:arkaik`. Docs-only PR, no lab note (infra).

## 7. Documentation (arkaik)

- `docs/spec/journal.md` — the optional `lab_note` field on
  `deliverable.shipped`.
- `docs/spec/services.md` — the pollen feed route, cursor/410 semantics,
  federation config.
- `docs/hosted-projects.md` — a short "Federation feed" how-to (set the
  plant slug, point a consumer at the feed).
- CLAUDE.md updates in pbbls and arkaik (§6).

## 8. Testing

Arkaik house style (`node --test`-equivalent per repo conventions, pure
logic first):

- Mapping unit tests per event family, including re-append `corrects`,
  decision-title fallback, skip-and-log on malformed events, bilingual
  titles from `lab_note`.
- Vendored conformance fixtures pass; every emitted envelope validates.
- Feed route tests: cursor paging, unknown-`after` 410, limit cap,
  opt-in 404, auth/ownership refusals.
- Webhook tests: note extraction/parse (quoted-colon cases from the
  CLAUDE.md contract), no-note no-op, invalid-note non-fatal refusal,
  redelivery dedupe, independence from the promotion handler.
- Nothing in this slice touches ariko's runtime code — ariko CI stays
  green by construction (garden.yml passes the garden guard).

## 9. Acceptance

- A `graph:read` token can page a configured project's feed from empty
  cursor to caught-up; every envelope validates against ariko's
  `lib/pollen.ts` unchanged.
- Merging a PR with a valid Lab Note in a mapped repo lands exactly one
  `deliverable.shipped` (with `lab_note`) per linked project; the feed then
  serves it as a `shipped` envelope with the bilingual title.
- Merging without a note, or with an invalid note, changes nothing except
  (for invalid) a logged refusal; acceptance promotions are unaffected
  either way.
- pbbls and arkaik no longer call ariko's `lab-note.yml`; femfolk,
  melogram and ariko still do; the reusable workflow itself is untouched.
- Garden reflects the new wiring; arkaik `npm test`/typecheck green; no
  new arkaik dependencies beyond what's already shipped.

## 10. Out of scope

Ariko's read model, cursors-in-practice, projected beans, the beanstalk
(slice 4); idea/request kinds; pod/bean anchor depth; committed-feed-file
transport; femfolk hosting (slice 7); melogram mapping (slice 6); paulopus
bootstrap (slice 4); public/unauthenticated feeds; feed-file rotation;
sidecar↔hosted journal reconciliation tooling (the import/restore replace
path plus 410 rebuild is the contract's answer today).

## 11. Decisions taken autonomously (flag for review)

Made during a background brainstorm; each is cheap to reverse before
implementation:

1. **Approach B** — arkaik-side per-project HTTP feed; committed feed files
   remain the unhosted fallback, unused here — §2.
2. **Feed auth = existing `graph:read` token plane**, no public mode, no
   new scope — §3.
3. **v1 maps exactly three event families** (`deliverable.shipped`,
   `release.tagged`, `decision.status_changed→approved`); ideas/requests
   deferred — §3.
4. **Re-appends become `corrects` envelopes** (immutability preserved)
   rather than mutating or suppressing — §3.
5. **Lab note rides `deliverable.shipped`** via a new optional `lab_note`
   field, `deliverable_id: "pr-<n>"`, appended by the webhook with
   content-dedupe — §4.
6. **Plant anchor is arkaik-side per-project config**, opt-in, plant-only
   depth — §5.
7. **Arkaik-the-repo gets mapped inside this slice** (minimal hosted
   project) so its decisions federate; femfolk/melogram/ariko keep the
   stub — §6.
8. **Retirement lands in this slice** despite the slice-4 latency window —
   §6.
9. **`arkaik-adapter` bee stays `planned`** until slice 4 reads the feed —
   §6.
10. **Spec and plan live in ariko** (federation narrative home), even
    though most code lands in arkaik — consistent with slices 1–2.
