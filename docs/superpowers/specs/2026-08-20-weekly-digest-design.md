# Slice 5 — Weekly digest: the first synthesis brick

**Date:** 2026-08-20
**Status:** Approved
**Scope:** The weekly cross-plant digest (umbrella spec §7, brick 1): atomic
per-plant digest sprouts plus a cross-plant wrap, drafted weekly by a Claude
routine, landed through a new guarded synthesis write door, reviewed and
published by the human in the admin.

## 1. Problem

Reporting is the practice's core pain point. The federation now carries the
record (slices 1–4: botanical model, pollen contract, arkaik adapter, read
model + beanstalk), but narrating a week still takes a hand-made session
(week 33 took ~84k tokens of manual git archaeology). Slice 5 turns that
ritual into a bee.

## 2. Decisions

| Fork | Decision |
|---|---|
| Data scope | **Beanstalk-scoped.** The digest narrates exactly what the read model holds: the pollen cache (pbbls, arkaik today) plus ariko's own authored sprouts. Coverage grows as adapters land. No GitHub sweep, no second ingestion path. Thin weeks expose missing adapters — that is a feature. |
| Engine | **Claude routine** (claude.ai scheduled routine, Max plan, paulopus-writer lineage). Zero marginal cost; the sandbox reaches public HTTPS only, so both doors are HTTP APIs. |
| Read door | **Full read, guarded.** The routine sees the complete private union — private envelopes and unpublished sprouts included. A public-only digest would re-narrate what is already visible. |
| Write door | **Direct guarded POST** (slice-4 `SYNC_TOKEN` pattern). No workflow_dispatch tunnel: ariko's store is Mongo behind Vercel, so the tunnel would add a hop, a PAT, and async failure reporting for no gain. Precedent for all four synthesis bricks. |
| Composition | **One run, two passes.** Read the week once; draft one sprout per active plant; draft a wrap that references (never restates) them; POST the whole batch as unpublished drafts. |

## 3. Storage anatomy

No new species. The dated content tier — the sprout — carries the digest.

### Containers (curated, in `garden.yml`, part of this slice's PR)

- One authored bean per digested plant: `bean:digest-pbbls`
  (parents `[plant:pbbls]`), `bean:digest-arkaik`, `bean:digest-ariko`.
- `bean:weekly-wrap`, parents `[plant:ariko]`.
- All `visibility: private`.
- New plants get a digest bean when they federate. **The machine never
  creates beans** — the synthesis door writes sprouts only.

### Atoms (machine-written draft sprouts)

- One sprout per (plant, ISO week): slug `digest-<plant>-<week>` (e.g.
  `digest-pbbls-2026-w34`), `type: digest`, `date` = the week's Sunday,
  `parents: [bean:digest-<plant>]`, `content` = markdown narration with links
  down into sources (PR URLs, envelope refs).
- One wrap sprout per week: slug `weekly-wrap-<week>`, same type/date,
  `parents: [bean:weekly-wrap]`, `relations` pointing at that week's plant
  digest sprouts. Content: cross-plant lede, tally, quiet-plants note, next
  pointer. It references the plant digests; it does not restate them.
- Week identity is the ISO week (`2026-W34`), lowercase in slugs
  (`2026-w34`); weeks run Monday–Sunday.

### Publication semantics

- Drafts land with **no `state`** (= unpublished, the existing safe default).
  The human reviews and publishes in the admin — existing machinery, no new
  UI.
- Because the digest beans are `private`, the shelter cascade keeps even
  *published* digest sprouts off the public beanstalk. **Publish means
  reviewed-and-final, not public.** Flipping a plant's digest bean public
  later exposes its published weeks on that plant's timeline — the selective
  publication lever — and requires no data migration.

### Idempotency

- Deterministic slugs; the write door **upserts drafts in place**.
- The door **refuses to overwrite any sprout whose `state` is set**.
  Corrections to a reviewed week are a human act in the admin.

## 4. The synthesis doors

Both bearer-token guarded with a new **`SYNTHESIS_TOKEN`** (distinct from
`SYNC_TOKEN`), provisioned in Vercel prod and the claude.ai cloud
environment.

### Read: `GET /api/synthesis/week?week=2026-W34`

Returns JSON:

- `week`: id plus ISO boundaries (Monday 00:00 – Sunday 24:00, Europe/Paris).
- `plants`: one bucket per plant holding material in the window — pollen
  envelopes from the cache (**full union, private included**) and ariko's
  authored sprouts dated in the window.
- `roster`: every plant in the garden, so the routine derives quiet plants
  by difference.
- Sprouts of `type: digest` are **excluded** from the buckets — the digest
  never narrates itself or last week's wrap.

This is the machine-readable twin of the beanstalk union, unfiltered.
Without a valid token: 401, no partial projection.

### Write: `POST /api/synthesis`

Body `{week, sprouts: [...]}`. Guards, all-or-nothing (a validation failure
names the offending sprout and rejects the batch):

- `week` must be a valid ISO week id and match every sprout slug.
- Every sprout: `type` must be `digest`; `parents` must reference an
  existing digest bean; slug must follow the `digest-<plant>-<week>` /
  `weekly-wrap-<week>` grammar.
- **No `state` field accepted** — the door structurally cannot publish.
- Payload size cap (pollen-style, 32KiB per sprout content).
- Upsert by slug; refuse if the existing sprout has `state` set.

## 5. The routine

- **Schedule:** Mondays 07:00 Europe/Paris, covering the prior ISO week.
- **Run:** `GET` the week window → pass 1: one concise per-plant narration
  sprout per plant with material, links down into sources → pass 2: the wrap
  (lede, tally, quiet plants, next) referencing the plant sprouts → one
  `POST` of the whole batch.
- **Failure:** retry the failed call once, then stop and report in the
  routine transcript. No partial batch (the door is all-or-nothing). A
  missed week is visible as an empty admin Monday and in the routine's run
  history. No alerting machinery in v1.
- **Garden bookkeeping:** flip the `weekly-digest` bee to `status: live`,
  `engine: claude-routine`, `schedule: "Mondays 07:00 Europe/Paris"`, lever
  holding the routine id.

## 6. Rendering

Near-zero by design (zero-CSS hold intact):

- Drafts and published digests surface in the existing admin beanstalk for
  review/publish.
- Per-plant digests group under their bean on the plant-filtered timeline via
  existing parent grouping. Verify with a test that the plant filter renders
  them sensibly; build nothing new.

## 7. Testing

- **Pure builders** (house style): ISO week windowing incl. timezone,
  per-plant bucketing of the envelope+sprout union, quiet-plant derivation,
  slug/week grammar validation.
- **Door tests:** read serves private material only with the token; write
  rejects unknown parents, week/slug mismatch, any `state` field, oversized
  payloads; upsert replaces drafts and refuses reviewed sprouts.
- **Acceptance:** one manual routine run against the real doors for the
  current week. Optionally hand-feed the week-33 wrap through the write door
  as backfill — it doubles as the door's first real exercise.

## 8. Out of scope, seams reserved

- **Monthly review** (brick 2) reads these sprouts later; the shape
  anticipates it, nothing is built.
- **GitHub sweep** for non-federated plants — coverage grows via adapters.
- **Wrap prose quality iteration** — routine-prompt tuning post-ship, the
  paulopus Phase-2 pattern.
- **Alerting/health surface** beyond bee status.
- **Multi-agent synthesis** — the door does not care whether one routine or
  an orchestra produced the payload (umbrella spec §8 seam).
