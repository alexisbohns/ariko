# Lab Note requirement — make authoring non-optional (C1d)

*2026-07-19 — design.*

## 1. Intent

C1a–C1c shipped the pipeline, the hardening, and the authoring skill as a plugin.
Yet PRs keep landing with no Lab Note. The requirement lives only in **discretionary,
optional** layers:

- **No always-in-context instruction** — the repo had no `CLAUDE.md`, `AGENTS.md`,
  PR template, or `CONTRIBUTING`. An agent starts a session with nothing loaded
  that even mentions Lab Notes.
- **The skill is discretionary and often absent** — it fires only if the plugin is
  installed in that environment *and* the model chooses to invoke it. The plugin
  sits on the maintainer's laptop, not in the CI / Claude-on-the-web sessions that
  actually open the PRs.
- **The pipeline is not a gate** — `post.mjs` runs only at merge and treats a
  missing note as a silent "skipped". Nothing reminds or blocks earlier.

This slice moves the requirement into layers that are **always loaded** and
**verified early**, across all five repos.

## 2. Decisions

| Question | Decision |
|---|---|
| Enforcement strength | **Advisory**, not blocking. A reusable reminder workflow *comments* on a PR lacking a valid note; it never fails the merge. Escalation to a required check is a future tune. |
| "User-facing" detection | **Not from the diff** (fragile). The reminder nags on any non-draft PR with neither a valid note nor the `no-lab-note` opt-out label. False positives cost one dismissable label. |
| CLAUDE.md depth | **Inline the essentials** — gate + full contract + skeleton + this repo's molecule — so a note is authorable with no plugin installed. The skill stays the source of truth for tone depth. |
| Sibling rollout | **Issue kit**, same pattern as C1c — one templated issue per repo, executed by that repo's own dev loop. No pushes to sibling repos. |
| Reminder credential | **None.** Commenting uses the built-in `GITHUB_TOKEN` (`pull-requests: write`); the reminder never touches the inbox token. |

## 3. The layers (ariko)

1. **`CLAUDE.md`** (root) — project orientation + a self-sufficient Lab Note
   requirement section: the gate, the contract (`## Lab Note` heading + one `yaml`
   fence, `en.title`/`en.summary` required, `fr.*` recommended, `suggested`
   optional), a copy-paste skeleton, molecule `ariko`, and a pointer to the skill.
2. **`.github/pull_request_template.md`** — summary section + a pre-seeded
   `## Lab Note` block; an HTML comment says to delete it for chore/refactor/
   infra/docs PRs. (Agents opening PRs via the GitHub API bypass the template —
   which is why layers 1 and 3 exist.)
3. **Advisory reminder** — reusing the post path's parse:
   - `reminderVerdict(prBody, { hasOptOutLabel, isDraft })` → `ok | missing |
     invalid | skipped` (pure, in `lib.mjs`, on top of `extractLabNoteYaml` +
     `parseLabNote`).
   - `reminderComment(verdict, { molecule })` → the marker-tagged markdown body,
     or `null` when satisfied.
   - `scripts/lab-note/remind.mjs` — thin shell: fetch the live PR, compute the
     verdict, upsert exactly one `<!-- lab-note-reminder -->` comment (delete it
     once satisfied/opted out). `DRY_RUN` runs fully offline from env.
   - `.github/workflows/lab-note-reminder.yml` — reusable (`workflow_call`) +
     direct `pull_request` for ariko's own dogfooding; checks out `ariko@main`
     (freshness); `pull-requests: write`; skips drafts.

## 4. Rollout & verification

1. Ariko PR carries the three layers + docs (README "Making it a requirement",
   ROADMAP C1d) and its own Lab Note.
2. Verification: `npm test` (new `reminderVerdict`/`reminderComment` tests green,
   suite unchanged otherwise) + `tsc --noEmit`; `DRY_RUN` proof of the four
   verdicts; dogfood the reminder on this very PR (present note → no nag; blank it
   → reminder appears and updates in place; `no-lab-note` → silenced).
3. After merge: one requirement issue per sibling (plan §Task, controller-run for
   an all-repo-scoped session), executed by each repo's dev loop.

## 5. Out of scope

- Blocking / required status check (advisory chosen; escalation later).
- Diff-based user-facing classification (the label opt-out replaces it).
- Firing the sibling issues / secrets here (needs all-repo scope) and the parked
  atom-catalog endpoint.
