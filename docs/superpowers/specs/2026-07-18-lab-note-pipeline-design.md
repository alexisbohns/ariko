# Lab Note pipeline — PR-merge → Beanstalk inbox (C1 · GitHub connector)

*2026-07-18 — design approved in brainstorming; implementation plan to follow.*

## 1. Intent

Every user-facing PR across the five active repos (**pbbls, femfolk, arkaik,
beanstalk, melogram**) should produce a bilingual Lab Note (changelog entry)
that lands in the Beanstalk inbox **automatically at merge time** — the only
human action is closing the PR. The machinery is owned by Beanstalk and
referenced by the other repos, so it is always up to date without any sync
step. This ships the GitHub half of roadmap slice **C1 · Connectors**.

The pbbls repo already has a `lab-note` authoring skill that drafts a YAML
snippet in the PR body for manual copy-paste into the Pebbles Lab admin. This
design harmonizes that pattern across all repos and automates the delivery leg
into Beanstalk.

## 2. Decisions (brainstorm outcomes)

| Question | Decision |
|---|---|
| Delivery mechanism | Push: GitHub Actions on PR close → `POST /api/inbox`. Orchestrators (N8N/Dify/Temporal) and MCP rejected as overkill/wrong layer — the flow is one stateless idempotent HTTP call on an event GitHub already emits. |
| Destination | **Beanstalk inbox only.** Pebbles Lab keeps its separate manual paste flow; Arkaik is out of scope as a destination. |
| Trigger gate | Presence of a `## Lab Note` section in the PR body. No labels; the authoring skill decides in the dev loop which PRs deserve a note. Chore PRs simply have no section. |
| Screenshots/media | Deferred to v2; the YAML contract reserves a `media:` key. |
| Sharing model | Reusable workflow (`workflow_call`) + posting script live in beanstalk, referenced `@main` by ~10-line caller stubs in each repo. The authoring skill is distributed as a Claude Code plugin from beanstalk. |

## 3. The harmonized Lab Note contract

One YAML block per PR, one schema for all repos, tolerant of per-repo extras.

**Gate:** the PR body contains a markdown section whose heading starts with
`## Lab Note` (pbbls' existing `## Lab Note (EN/FR)` matches), containing one
```` ```yaml ```` fence. No section → no post, workflow reports "skipped".

**Core schema** (everything the Beanstalk pipeline reads):

```yaml
en:
  title: Relations join the public graph          # required
  summary: One or two sentences, user-facing.     # required
fr:
  title: Les relations rejoignent le graphe       # recommended
  summary: Une ou deux phrases, adaptées, pas traduites littéralement.
suggested:                                        # optional — prefills triage
  molecule: beanstalk        # molecule slug
  atom: public-graph         # atom slug
  type: feature              # version type
  tags: [changelog, graph]
# media: reserved for v2 (screenshots)
```

**Superset tolerance:** unknown top-level keys are ignored by the parser. This
is what lets pbbls keep a *single* section per PR: its skill emits this schema
plus its Pebbles-only keys (`species`, `platform`, `status`, `published`,
`release-date`) in the same block. The Beanstalk workflow reads only the
harmonized keys; the Pebbles Lab admin importer (already tolerant) reads only
the keys it knows when the same block is manually pasted there at release time.
The `en:`/`fr:` nesting in the current pbbls schema is already identical.

**Tone rules** (carried over from the pbbls skill into the harmonized one):
end-user-facing, benefit-first, short, warm; French uses informal "Tu" and is
an adaptation, not a literal translation.

## 4. Capture mapping

The workflow maps the YAML onto the existing `POST /api/inbox` payload:

| Capture field | Source |
|---|---|
| `title` | `{ en: en.title, fr: fr.title }` (see widening below) |
| `body` | `{ en: en.summary, fr: fr.summary }` |
| `suggested` | `{ moleculeSlug: suggested.molecule, atomSlug: suggested.atom, type, tags }` |
| `source` | `{ kind: "github", url: <PR html url>, externalId: "<owner>/<repo>#<number>" }` |

Dedup: the existing upsert on `(source.kind, source.externalId)` makes every
re-run idempotent — a workflow re-run updates the same capture, never
duplicates it.

**Model change — widen `Capture.title` from `string` to `Text`** (the B1
pattern: plain strings remain valid, no migration). Rationale: the skill
authors a French title; dropping it at capture time would force re-authoring at
triage. The inbox validator accepts `string | { en?, fr? }` for `title`; admin
surfaces render it via the existing `resolveText`. This is the only change to
Beanstalk's data model in this slice.

## 5. Architecture

All shared logic lives in the beanstalk repo (github.com/alexisbohns/beanstalk).

1. **`scripts/lab-note-post.mjs`** — the brains, dependency-light Node:
   - fetches the PR's **current** body via the GitHub API (`gh api`), not the
     event snapshot, so editing a merged PR's body and re-running the job
     picks up the fix;
   - extracts the `## Lab Note` section and its YAML fence;
   - validates (required: `en.title`, `en.summary`); ignores unknown keys;
   - maps to the inbox payload (§4) and POSTs with the bearer token;
   - distinct exit codes/log lines for: posted (201) / updated (200) /
     skipped-no-note / invalid-note / unreachable.
   - Extraction, validation, and mapping are pure functions exported for unit
     tests; only the thin CLI shell does I/O.
2. **`.github/workflows/lab-note.yml`** — reusable workflow:
   - `on: workflow_call` (plus `workflow_dispatch` with `pr_number` and
     `dry_run` inputs for rehearsal/backfill);
   - checks out **beanstalk@main** and runs the script — this checkout is the
     freshness mechanism: every caller runs the current logic on every merge;
   - inputs: `beanstalk_url` (defaults to the production URL — public, not a
     secret); secrets: `inbox_token`.
3. **Caller stubs** — each repo (including beanstalk itself) adds
   `.github/workflows/lab-note.yml`, ~10 lines, written once:
   `on: pull_request: types: [closed]` → job gated on
   `github.event.pull_request.merged == true` →
   `uses: alexisbohns/beanstalk/.github/workflows/lab-note.yml@main` with
   `secrets: inbox_token: ${{ secrets.BEANSTALK_INBOX_TOKEN }}`.
4. **Secrets** — `alexisbohns` is a personal account (no account-wide Actions
   secrets), so `BEANSTALK_INBOX_TOKEN` is set per-repo, once, via a
   documented `gh secret set` loop. Beanstalk-side the token is minted
   kind-scoped in `INBOX_TOKENS` as `github:tok_…` — a leaked CI token can
   only write `kind:"github"` captures, nothing else.
5. **Authoring skill as a plugin** — the canonical `lab-note` skill (harmonized
   schema + tone rules) lives in beanstalk with a minimal `marketplace.json`;
   each repo adds the marketplace and installs the plugin once, then updates
   propagate on plugin update. The pbbls skill is rewritten to emit the
   superset (keeping its Pebbles-only keys and its user-facing gate guidance).

## 6. Data flow

Dev loop: the lab-note skill drafts the YAML section in the PR body (or the PR
ships without one) → **merge the PR — the last human action** → the repo's stub
fires → reusable workflow checks out beanstalk@main → script fetches the live
PR body → no section: exit "skipped"; section: validate → map → POST
`/api/inbox` → capture lands in the inbox, deduped on `owner/repo#N` → later,
in the admin, triage opens prefilled from `suggested` → promote/publish on the
maintainer's schedule.

The human release-time gate of the pbbls flow is preserved — it moves from
"paste YAML into the admin" to "triage a prefilled capture".

## 7. Error handling

Principle: failures are loud in the repo where they happened; every failure is
recoverable by re-run because posting is idempotent.

- **No Lab Note section** → success, logged "skipped". Chore PRs stay silent.
- **Malformed YAML / missing `en.title` or `en.summary`** → the job **fails**,
  log names the exact problem. Recovery: edit the merged PR's body, re-run the
  failed job (live-body fetch picks up the fix).
- **Beanstalk unreachable / 5xx** → job fails; re-run when it's back.
- **401/403** → job fails pointing at the per-repo secret / token scoping.
- **200 vs 201** are both success (update vs create), logged but not
  distinguished as outcomes.

## 8. Testing

- **Unit** (beanstalk `node --test`, no network): section extraction (no
  section / valid / superset with Pebbles keys / malformed YAML / missing
  required fields / multiple fences), payload mapping, `externalId` shape.
- **Validator**: the `Capture.title` widening extends the existing inbox
  validator tests (string title still valid; `{en, fr}` accepted; junk
  rejected).
- **Rehearsal without merging**: `workflow_dispatch` with `pr_number` +
  `dry_run: true` prints the payload it would post; `dry_run: false` against
  an already-merged PR performs a real, dedup-safe post.
- **End-to-end proof**: the first real merged beanstalk PR carrying a note.

## 9. Rollout

**Prerequisite:** Beanstalk deployed at a public URL (planned; not yet live at
design time). Steps 1 can land before it — unit tests and `dry_run` need no
deployment — but the first real post (step 2) and the fan-out (step 4) require
it, and the reusable workflow's `beanstalk_url` default is filled in then.

1. **Beanstalk first**: title widening + script + tests + reusable workflow +
   beanstalk's own caller stub + mint the `github:` token + README/ROADMAP
   update. Beanstalk dogfoods itself.
2. Prove on one real merged beanstalk PR (or a `workflow_dispatch` backfill).
3. Add the plugin marketplace + harmonized `lab-note` skill to beanstalk;
   rewrite the pbbls skill to the superset.
4. Fan out stubs + secrets to pbbls, femfolk, arkaik, melogram — one small PR
   each.

## 10. Out of scope

- Screenshots/media on captures (v2; `media:` key reserved in the contract).
- Arkaik as a destination, and any Beanstalk→elsewhere re-dispatch.
- Automating the Pebbles Lab admin (its manual paste flow continues).
- Auto-promotion past the inbox (triage stays human).
- A GitHub App / webhook receiver in Beanstalk (possible later evolution if
  per-repo stubs become friction).
