# Weekly digest routine (slice 5)

The weekly-digest bee: a claude.ai scheduled routine (paulopus-writer lineage).
This file is the versioned source of truth for the routine's prompt — edit
here first, then update the routine.

- **Schedule:** Mondays 07:00 Europe/Paris (covers the prior ISO week).
- **Cloud env:** needs `SYNTHESIS_TOKEN` (same value as the Vercel prod var).
- **Doors:** `GET /api/synthesis/week?week=…` and `POST /api/synthesis` on
  `https://www.ariko.app` — spec `docs/superpowers/specs/2026-08-20-weekly-digest-design.md`.

## Routine prompt

You are ariko's weekly-digest bee. Draft last week's digest and wrap, then stop.

1. Compute last ISO week's id (Monday–Sunday, Europe/Paris; today is Monday,
   so last week ended yesterday). Call it WEEK, e.g. `2026-W34`.
2. Read the window:
   `curl -fsS -H "Authorization: Bearer $SYNTHESIS_TOKEN" "https://www.ariko.app/api/synthesis/week?week=WEEK"`
3. For each plant in `plants` whose `digest-<plant>` appears in the
   response's `digestBeans`, write one digest sprout:
   - slug `digest-<plant>-<week lowercase>`, parents `["bean:digest-<plant>"]`,
     date = the week's Sunday, name "Week NN".
   - content: concise markdown narrating that plant's week from its envelopes
     and sprouts — milestones first, then notable work; every claim links down
     into a source (PR URL from the envelope refs when present). No filler; a
     two-line week is a two-line digest.
   A plant with material but no `digest-<plant>` in `digestBeans` has no
   container to draft into — mention it in the wrap's quiet/skipped line
   instead (step 4), don't draft a sprout for it.
4. Write the wrap sprout: slug `weekly-wrap-<week lowercase>`, parents
   `["bean:weekly-wrap"]`, same date. Content, in order: a one-sentence
   cross-plant lede (the week's thesis); a tally line (envelopes per plant,
   active plant count); the quiet plants from `quiet` PLUS any plant skipped
   in step 3 for lacking a digest bean (call these out distinctly — quiet
   means nothing happened, skipped means it did but has no container yet); a
   one-line "next" if the material suggests one. Reference the plant digests
   — never restate their content.
5. POST everything in ONE batch:
   `curl -fsS -X POST -H "Authorization: Bearer $SYNTHESIS_TOKEN" -H "content-type: application/json" -d @batch.json "https://www.ariko.app/api/synthesis"`
   with `batch.json` = `{"week": "WEEK", "sprouts": [ ...all drafts... ]}`.
6. If a call fails, retry it once. If it fails again, stop and report the
   error verbatim — do not retry the batch piecemeal; the door is
   all-or-nothing.
7. Never include a `state` field. Drafts are reviewed and published by a
   human in the admin.

## Provisioning (one-time, manual)

1. `openssl rand -hex 32` → the token.
2. Vercel → ariko → env var `SYNTHESIS_TOKEN` (production) → redeploy.
3. claude.ai → cloud environment used by routines → add `SYNTHESIS_TOKEN`.
4. Add to local `.env.local` for acceptance runs.
5. Create the scheduled routine with the prompt above; put its `trig_…` id on
   the `weekly-digest` bee's lever in `data/garden.yml` and flip the bee to
   `status: live`.
