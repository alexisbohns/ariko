# Slice 4 — Ariko read model + beanstalk: pollen consumer, projected beans, the growth timeline

**Date:** 2026-08-17
**Status:** Approved design. Child of the umbrella spec
[`2026-08-14-ariko-federation-design.md`](2026-08-14-ariko-federation-design.md)
(§10, sub-project 4), consuming the contract of
[`2026-08-15-pollen-federation-contract-design.md`](2026-08-15-pollen-federation-contract-design.md)
(`docs/POLLEN.md` v1) as served by the slice-3 arkaik producer
([`2026-08-15-arkaik-adapter-design.md`](2026-08-15-arkaik-adapter-design.md)).
**Shape:** All runtime work lands in **ariko** (sync engine, cache
collections, beanstalk pages, garden updates), plus one repo-versioned
GitHub Actions workflow. A thin optional tail touches **paulopus**
(a hand-curated committed feed file).

---

## 1. Goal

Ariko becomes a conforming pollen **consumer**: it syncs federated feeds
into a rebuildable read model (the "Read" verb, POLLEN.md §Read), projects
beans from envelopes that anchor one, and renders the **beanstalk** — the
timeline as the union of feed events and authored material, growth-over-time
as the page's meaning (umbrella §4). This closes the loop slice 3 opened:
the latency window ends, retired repos' lab notes reach ariko again (now via
the arkaik journal), and the `arkaik-adapter` bee finally flips `live`.

Deliverables:

1. **Read model** (ariko) — a `pollen` Mongo collection (write-once cache,
   unique by envelope `id`), per-feed cursors, logged-and-surfaced refusals.
2. **Sync engine** (ariko) — a pure page-processing core behind
   `POST /api/pollen/sync`, HTTP-feed and committed-feed-file transports,
   410/rewrite rebuild semantics, full-rebuild path.
3. **Projected beans** (ariko) — envelopes with a `bean` anchor materialize
   read-only, rebuildable beans; authored beans always win.
4. **The beanstalk** (ariko) — public `/beanstalk` (renamed from
   `/timeline`) merging published sprouts with exhibited feed events;
   `/admin/beanstalk` showing everything plus sync operations.
5. **Trigger** (ariko repo) — a scheduled GitHub Actions workflow holding
   one secret, calling the sync door; plus a manual admin "Sync now".
6. **Garden & docs** — `arkaik-adapter` → `live`, new `pollen-sync` bee,
   POLLEN.md cross-reference, README §federation.
7. **Optional tail** (paulopus) — a hand-curated `pollen/feed.ndjson`
   bootstrapping paulopus history into the record via the file transport.

## 2. Approach decision — shape of the read model

Three shapes were weighed:

- **A — project envelopes into sprouts.** Reuse the whole existing
  spine (timeline, vault, publish machinery) by turning each envelope into
  a machine-authored sprout. Rejected: it tangles the projected and
  authored records the umbrella keeps crisply apart (§4), floods the
  vault/triage surfaces with machine rows, and breaks disposability — a
  rebuild would have to distinguish machine sprouts from human ones
  forever. The publish cascade semantics also fit prose, not event lines.
- **B — separate `pollen` cache, merged at render** ✅ chosen. Envelopes
  live in their own collection, immutable and write-once, a disposable
  projection exactly as POLLEN.md promises. The beanstalk merges the two
  records at read time with a pure builder. Authored material keeps its
  existing lifecycle untouched; the cache can be dropped and rebuilt from
  the feeds at any time without touching a single authored document.
- **C — no cache, render from upstream.** Query the arkaik feed at page
  load. Rejected outright: POLLEN.md's Read guarantees say "never a live
  proxy" — ariko's availability must not chain to upstreams, and slice-5
  synthesis needs a local record to query.

## 3. Read model (ariko)

### Collections

- **`pollen`** — one document per envelope, stored verbatim (the validated
  envelope fields) plus sync provenance: `{ ...envelope, feedId, syncedAt }`.
  Unique index on `id`; secondary indexes on `at` (beanstalk sort) and
  `anchors.plant` (filtering). **Write-once**: inserts use
  `$setOnInsert`-style upserts keyed by `id`; a re-seen id is a no-op
  (envelope immutability — corrections arrive as new envelopes with a
  `corrects` ref, and render as their own beanstalk lines in v1).
- **`pollen_cursors`** — one document per feed:
  `{ feedId, cursor, lastSyncAt, lastStatus, lastError? }` (refusal counts
  are derived from `pollen_refusals` at render time, not stored).
  `cursor` is the last processed envelope id (POLLEN.md semantics).
- **`pollen_refusals`** — no silent loss (umbrella §11): an envelope that
  fails `validatePollen` is recorded, not dropped:
  `{ feedId, at, reason, raw }` with `raw` capped at 4 KiB. Refusals are
  surfaced on `/admin/beanstalk`; a refusal never aborts the sync run.
  Validator **warnings** (non-core kinds) are logged and the envelope is
  stored normally — generic handling, never rejection (POLLEN.md §kind).

DB `$jsonSchema` validators for the new collections join
`scripts/apply-validators.ts`, house style.

### Sync algorithm

A pure core, thin shell (house style — the route does I/O, the logic is
unit-testable without a DB):

For each configured feed, in `data/federation.yml` order:

1. Load the cursor.
2. **HTTP transport:** `GET <url>?after=<cursor>&limit=200`, bearer token
   from the feed's `tokenEnv`. Repeat until an empty page (caught up).
   **410 Gone** ⇒ discard the cursor and restart from the beginning —
   the write-once upserts make the replay converge (the contract's
   coordinated-rewrite case; slice 3 §3 "rebuild reality").
3. **File transport:** fetch the ndjson URL, split lines (blank lines
   ignored), skip until the line *after* the cursor id; a cursor id no
   longer present in the file is the 410-equivalent ⇒ restart from the
   top. Same downstream processing.
4. Per envelope: `validatePollen` → refusal doc on error, upsert on
   success, warning logged on non-core kind. Advance the cursor after each
   page (HTTP) or at end (file), so a crashed run re-covers at most one
   page — idempotent by construction, a missed run costs latency never
   correctness.
5. Record `lastSyncAt`/`lastStatus` per feed. One feed's failure (network,
   auth, 5xx) is logged on its cursor doc and does not stop the other
   feeds.

**Full rebuild** (manual, per feed): delete the feed's `pollen` docs +
cursor + projected beans, then sync — exposed as a dev script
(`npm run pollen:rebuild -- <feedId>`), not an admin button (destructive
operations stay deliberate).

### Feed configuration — `data/federation.yml`

Repo-versioned (umbrella §11: merging is deploying), read at runtime like
`garden.yml`:

```yaml
feeds:
  - id: arkaik-pbbls
    source: arkaik
    transport: http
    url: https://arkaik.app/api/graph/projects/prj_5dDiZc-G6lseF3cb/pollen
    tokenEnv: ARKAIK_API_TOKEN
  - id: arkaik-arkaik
    source: arkaik
    transport: http
    url: https://arkaik.app/api/graph/projects/prj_-p3xhVj7e3EvBksO/pollen
    tokenEnv: ARKAIK_API_TOKEN
  # - id: paulopus
  #   source: paulopus
  #   transport: file
  #   url: https://raw.githubusercontent.com/…/paulopus/main/pollen/feed.ndjson

exhibit:            # plants whose feed events render on the PUBLIC beanstalk
  - plant:pbbls
  - plant:arkaik
```

Secrets stay in Vercel env vars — the config names the env var, never the
value. Both arkaik feeds share one `graph:read` token: ariko holds exactly
one upstream secret (umbrella one-secret rule).

## 4. Exhibition rule — when feed events go public

POLLEN.md is explicit: envelope `visibility: "private"` is **binding and
fail-closed**; `"public"`/absent is *only a hint* — publishing is a human
act on the ariko side. A per-event human gate would defeat the point of
federation (zero reporting labor), so the human act happens at **plant
granularity**: the `exhibit` list in `data/federation.yml`. Flipping a
plant into exhibition is a reviewed commit — a deliberate, versioned,
human decision (§11 again), made once per plant instead of once per event.

A pollen event renders on the **public** beanstalk only when *all* hold:

1. envelope `visibility` is not `"private"` (fail-closed, checked first);
2. its `anchors.plant` is in the `exhibit` list;
3. that plant survives `filterPublic` (a private plant exhibits nothing —
   the existing cascade keeps ruling).

Everything synced renders on the **admin** beanstalk regardless. Teale
never enters this path at all (inbox-only source, umbrella §6).

## 5. Projected beans

The umbrella's crisp rule (§4): a projected bean is machine-created from a
feed, read-only in ariko, source-owned, rebuildable. Mechanics:

- After a feed's envelopes are stored, every envelope carrying an
  `anchors.bean` whose slug does not exist in `beans` materializes one:
  `{ slug, name: slug, parents: [anchors.plant, anchors.pod?],
  visibility, projected: { source, feedId, firstPollenId } }`.
  `projected` is a new optional field on `Bean` — additive, no migration.
- `visibility` derives from the exhibition rule at projection time:
  `"public"` when the anchor plant is exhibited, `"private"` otherwise.
  Rebuilds recompute it, so flipping the exhibit list and rebuilding
  re-derives the beans consistently.
- **Authored wins, write-once:** an existing bean with the same slug —
  authored *or* previously projected — is never touched; the collision is
  logged. Corrections flow through rebuild, never mutation.
- Projected beans are **read-only in the admin** (no edit affordance;
  they carry a "projected from <source>" marker in the admin bean detail view)
  but are perfectly legal anchor targets for authored sprouts — that is
  exactly how meta-prose attaches to federated showcase nodes.
- Reality check: the slice-3 arkaik mapping anchors at **plant depth
  only**, so this machinery goes live with zero rows until melogram
  (slice 6) or a deeper arkaik mapping arrives. It ships now because the
  umbrella names it in this slice and the file-transport fixtures exercise
  it; deferring it would put contract machinery and contract text out of
  sync.
- Pods are **not** projected in v1 (`anchors.pod` on an unknown pod leaves
  the ref dangling — the reader's problem, ignored fail-closed, per
  POLLEN.md). Pod projection is a later additive refinement if a source
  ever needs it.

## 6. The beanstalk

### Public — `/beanstalk`

The `/timeline` route is renamed `/beanstalk` (the cosmology finally
reaches the URL; `/timeline` 308-redirects via `next.config.ts`). The page
stays zero-CSS, no-client-JS, `force-dynamic`, reading Mongo only — never
upstream feeds.

A pure builder merges two records into one list, newest first:

- **Sprout entries** — exactly today's `timelineSprouts()` over
  `filterPublic`, unchanged semantics.
- **Pollen entries** — cached envelopes passing the §4 exhibition rule:
  rendered as `title (resolveText) — date — kind — source`, with the first
  `url`-bearing ref as the line's link, and a `/bean/<slug>` link when a
  publicly-kept bean is anchored.

The existing plant filter covers both entry types (`anchors.plant` for
pollen, the resolved plant for sprouts). Ties on date keep sprouts before
pollen (authored material leads).

### Admin — `/admin/beanstalk`

Behind the existing admin session gate:

- The full union — every sprout state, every cached envelope including
  `visibility: "private"` and non-exhibited plants, each line marked
  with its provenance (feed id / authored).
- **Sync operations:** per-feed status from `pollen_cursors` (cursor,
  last sync time, last status, refusal count), recent `pollen_refusals`
  with reasons, and a "Sync now" button (server action calling the same
  core as the API route). Refusal rows are how "logged and surfaced"
  becomes real.

## 7. Trigger & security

- **`POST /api/pollen/sync`** — the one sync door. Bearer-token guarded
  (`SYNC_TOKEN` env var, timing-safe compare reusing `lib/auth`
  primitives); 401 before any work; response summarizes per-feed results
  (`{ feedId, stored, refused, status }[]`). No GET, no public mode.
- **`.github/workflows/pollen-sync.yml`** (ariko repo) — `schedule` cron
  every 6 hours + `workflow_dispatch`, one step, one secret
  (`ARIKO_SYNC_TOKEN`) POSTing to the door. The Action holds one secret;
  the ariko server holds the upstream token; DB credentials move nowhere —
  the paulopus transport posture, ported.
- Vercel cron was rejected: the Hobby tier caps cron at daily granularity
  and the Actions workflow keeps the trigger repo-versioned and manually
  dispatchable, consistent with every other brick.
- Admin "Sync now" (§6) covers the impatient-human path; the cron covers
  the steady state; both call the same core, both idempotent.

## 8. Garden & docs

- `arkaik-adapter` bee: **status `planned` → `live`** — the condition
  slice 3 set ("a feed nobody reads is not a live brick") is now met.
- New **`pollen-sync`** bee: `kind: workflow`, `engine: action`,
  `schedule: "every 6h"`, levers → the workflow file, the sync route, and
  `data/federation.yml`; `serves: [plant:ariko]`; default-private like
  every bee.
- `docs/POLLEN.md` §Read gains a one-line pointer to this spec (the
  guarantees it states are now implemented).
- README: a short "Federation read model" section (collections, sync door,
  federation.yml, rebuild script).
- Env var documentation: `ARKAIK_API_TOKEN`, `SYNC_TOKEN` (Vercel),
  `ARIKO_SYNC_TOKEN` (GitHub secret).

## 9. Optional tail — paulopus bootstrap

The umbrella (§6) lists paulopus as "read-only; optional one-time
bootstrap". The file transport (§3) makes this a pure content exercise: a
**hand-curated** `pollen/feed.ndjson` in the paulopus repo (~10–20
milestone envelopes — launch, writer routine, Phase 2 — `source:
"paulopus"`, anchored to `plant:paulopus`, validated with
`npm run pollen:validate`), plus one `feeds` entry and one `exhibit` line
here. No script, no automation, no paulopus runtime change. **Droppable
without touching acceptance** — the file transport itself is
fixture-tested in ariko regardless.

## 10. Testing

House style — pure logic first, no DB in unit tests:

- **Sync core:** page-loop over mocked transports (multi-page, empty-page
  caught-up, 410 cursor reset, file-transport cursor-vanished rebuild,
  per-feed failure isolation, cursor advance per page); refusal recording
  on each `data/pollen/invalid/` fixture; warning-not-refusal on non-core
  kinds; write-once no-op on re-seen ids.
- **Exhibition rule:** the §4 predicate — private-visibility always loses,
  non-exhibited plant loses, `filterPublic`-hidden plant loses, the happy
  path passes.
- **Projected beans:** derivation from bean-anchored fixtures (parents,
  visibility from exhibit list, `projected` provenance), authored-wins
  collision no-op, plant-only envelopes project nothing.
- **Beanstalk builder:** merge order (newest first, sprout-before-pollen
  ties), plant filtering across both entry types, link selection
  (url-bearing ref, kept-bean anchor).
- **Conformance:** `data/pollen/valid/` fixtures flow through the full
  pure pipeline (validate → store-shape → beanstalk entry) unchanged.
- **Routes:** sync door 401/happy-path smoke (inbox-route style, fetch
  mocked); redirect `/timeline` → `/beanstalk`.
- The federation.yml loader validates shape at read time (unknown
  transport, missing tokenEnv on http ⇒ loud config error).

## 11. Acceptance

- With real tokens configured, `POST /api/pollen/sync` pages both arkaik
  feeds to caught-up; a second run stores nothing new (idempotent);
  every stored envelope round-trips `validatePollen` clean.
- Merging a lab-noted PR in pbbls appears on the public beanstalk after
  the next sync — the first end-to-end federated line, closing the
  slice-3 latency window.
- The public beanstalk shows pollen only for exhibited, publicly-kept
  plants; `visibility: "private"` envelopes never render publicly; the
  admin beanstalk shows everything with provenance and per-feed sync
  status; "Sync now" works.
- A forced upstream rewrite (410) converges after resync with no
  duplicates; `pollen:rebuild` restores a wiped feed to the same envelope
  set (provenance timestamps aside).
- `/timeline` redirects; the sprout-only rendering of surviving entries is
  unchanged.
- Garden reflects §8; `npm test` + typecheck green; validators applied;
  the PR carries a Lab Note (a visitor-facing page rename + new content is
  showcase-grade).

## 12. Out of scope

Synthesis bricks and digest queries over the cache (slice 5); melogram
feed (slice 6); femfolk anything (slice 7); dispatch/initiate handling
(the status-arc kinds render as generic lines); pod projection;
per-event public curation UI; beanstalk styling (D1 owns presentation);
feed-file rotation; `corrects`-aware rendering (correction envelopes are
plain lines in v1); automatic exhibit onboarding; deleting refusal rows
(manual DB hygiene for now).

## 13. Decisions taken autonomously (flag for review)

Made during a background brainstorm; each is cheap to reverse before
implementation:

1. **Approach B** — separate write-once `pollen` cache merged at render;
   envelopes never become sprouts — §2.
2. **Exhibition is a per-plant, repo-versioned human act** — the
   `exhibit` list in `data/federation.yml`; per-event gating rejected as
   defeating zero-labor reporting — §4.
3. **Feed config lives in `data/federation.yml`**, not in bee levers and
   not in Mongo; secrets stay env-named — §3.
4. **Trigger = GitHub Actions cron every 6 h + admin "Sync now"**, both
   through one guarded `POST /api/pollen/sync`; Vercel cron rejected
   (Hobby daily cap, less controllable) — §7.
5. **Projected beans ship now** (generic, fixture-tested) despite arkaik's
   plant-only anchors meaning zero live rows until slice 6; visibility
   derives from the exhibit list; authored-or-prior always wins — §5.
6. **`/timeline` renamed `/beanstalk`** with a permanent redirect — §6.
7. **File transport ships in this slice; the paulopus feed file is a
   hand-curated optional tail**, droppable without touching
   acceptance — §3, §9.
8. **Full rebuild is a dev script, not an admin button** — destructive
   paths stay deliberate — §3.
9. **Refusals get their own surfaced collection** (`pollen_refusals`,
   4 KiB raw cap) rather than log-lines only — §3.
10. **Cursors are per-feed, not per-source** (two arkaik feeds, one
    token, independent cursors) — §3.
