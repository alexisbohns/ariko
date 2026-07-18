# Lab Note Fan-Out (C1c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the harmonized Lab Note authoring skill as a Claude Code plugin from ariko, and roll the caller stubs out to the four sibling repos via GitHub issues (no pushes to sibling repos).

**Architecture:** Ariko gains `.claude-plugin/marketplace.json` + `plugins/lab-note/` (manifest + SKILL.md). Docs updated. After the ariko PR merges: `ARIKO_INBOX_TOKEN` secrets set centrally on the four repos and one templated issue created per repo; each sibling's own dev loop lands its stub in a PR that carries that repo's first Lab Note (self-proving E2E).

**Tech Stack:** Claude Code plugin/marketplace JSON manifests; markdown; `gh` CLI ops. No app code.

**Spec:** `docs/superpowers/specs/2026-07-18-lab-note-fanout-design.md`

**Environment notes:** Branch `claude/c1-fanout` (exists; holds the spec). Gates per task: `npm test 2>&1 | tail -3` (0 fail — nothing here should move test counts: 210 pass / 20 skip) and `npx tsc --noEmit` (clean). Never print or commit `.env.local`.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `.claude-plugin/marketplace.json` | Create | Marketplace `ariko`, one plugin entry |
| `plugins/lab-note/.claude-plugin/plugin.json` | Create | Plugin manifest |
| `plugins/lab-note/skills/lab-note/SKILL.md` | Create | The harmonized authoring skill |
| `README.md` | Modify | Plugin-install note in the Lab Note pipeline section |
| `docs/superpowers/ROADMAP.md` | Modify | C1c shipped row (`#??` → backfilled) + C1 Status line update |

---

### Task 1: Plugin — marketplace, manifest, skill

**Files:**
- Create: `.claude-plugin/marketplace.json`
- Create: `plugins/lab-note/.claude-plugin/plugin.json`
- Create: `plugins/lab-note/skills/lab-note/SKILL.md`

- [ ] **Step 1:** `.claude-plugin/marketplace.json`:

```json
{
  "name": "ariko",
  "owner": {
    "name": "Alexis Bohns"
  },
  "plugins": [
    {
      "name": "lab-note",
      "source": "./plugins/lab-note",
      "description": "Author bilingual (EN/FR) Lab Notes in PR bodies — merged PRs post them to the Ariko inbox automatically."
    }
  ]
}
```

- [ ] **Step 2:** `plugins/lab-note/.claude-plugin/plugin.json`:

```json
{
  "name": "lab-note",
  "description": "Author bilingual (EN/FR) Lab Notes in PR bodies — merged PRs post them to the Ariko inbox automatically.",
  "version": "0.1.0",
  "author": {
    "name": "Alexis Bohns"
  }
}
```

- [ ] **Step 3:** `plugins/lab-note/skills/lab-note/SKILL.md` — full content:

````markdown
---
name: lab-note
description: >
  Author the bilingual (EN/FR) Lab Note for a user-facing PR as a YAML section
  in the PR body. Use whenever you are wrapping up a PR that ships something a
  user, visitor, or listener would notice, in any repo wired to the Ariko inbox
  (pbbls, femfolk, arkaik, melogram, ariko itself). Merging the PR posts the
  note automatically — no copy-paste. Chore, refactor, infra, and docs-only PRs
  get no Lab Note.
---

# Lab Note Authoring (harmonized)

A **Lab Note** is the end-user-facing changelog entry for a change. You draft
it in the PR body under a `## Lab Note` heading; when the PR merges, a GitHub
Action posts it to the Ariko inbox automatically (idempotent — a re-run updates
the same capture, never duplicates). The maintainer triages it later in the
Ariko admin.

## When to write one

Write a note when the PR changes something a user, visitor, or listener would
notice. No note for chores, refactors, infra, or docs-only changes — simply
leave the section out of the PR body entirely.

## The section

One section whose heading **starts with** `## Lab Note` (pbbls' longer
`## Lab Note (EN/FR)` qualifies), containing exactly one ```yaml fence:

```yaml
en:
  title: Swap glyphs with the community           # required
  summary: One or two sentences, user-facing.     # required
fr:
  title: Échange des glyphes avec la communauté   # recommended
  summary: Une ou deux phrases, adaptées, pas traduites littéralement.
suggested:                                        # optional — prefills triage in the Ariko admin
  molecule: pbbls        # this repo's molecule slug — see the table below
  atom: glyphs           # ONLY if you are confident the atom slug exists; omit otherwise
  type: feature          # e.g. feature | improvement | fix | announcement
  tags: [changelog]
```

Unknown top-level keys are **ignored** by Ariko — a repo may keep extra keys
for its own tooling in the same block (pbbls does exactly this for its Lab
admin).

## `suggested.molecule` per repo

| Repo | molecule slug | Note |
|---|---|---|
| pbbls | `pbbls` | exists in the vault |
| femfolk | `femfolk` | exists in the vault |
| arkaik | `arkaik` | created at triage — suggest it anyway |
| melogram | `melogram` | created at triage — suggest it anyway |
| ariko | `ariko` | created at triage — suggest it anyway |

Suggestions never break anything: the triage page shows them read-only even
when nothing matches yet. For `suggested.atom` there is no catalog yet — write
it only when you know the slug, never guess.

## Tone of voice

Write for **end users, not engineers**:

- **Lead with the benefit**, not the mechanism. "Find a glyph you love and
  swap it" beats "Added a swap endpoint to the Glyphs tab."
- **Short.** A title of a few words; a summary of one or two sentences.
- **Warm and a little playful**, never corporate. No "We are pleased to
  announce."
- **French uses the informal "Tu"** — casual and friendly, addressing the user
  directly ("Ta page", "Trouve", "Échange"). Never "Vous".
- French is a real **adaptation, not a literal translation** — keep it natural.
- No engineering jargon, ticket numbers, or internal names.

## If the posted note is wrong

A malformed note **fails the merge job loudly** (the log names the exact
problem, e.g. `en.title is required`). Recovery: edit the merged PR's body and
re-run the failed job — the workflow fetches the live body and posting is
idempotent.
````

- [ ] **Step 4: Validate.** Run:
```bash
node -e "for (const f of ['.claude-plugin/marketplace.json','plugins/lab-note/.claude-plugin/plugin.json']) { JSON.parse(require('fs').readFileSync(f,'utf8')); console.log(f, 'ok'); }"
head -12 plugins/lab-note/skills/lab-note/SKILL.md
```
Expected: both `ok`; the head shows well-formed frontmatter (`---`, `name: lab-note`, `description: >`, closing `---` within the block).

- [ ] **Step 5: Gates.** `npm test 2>&1 | tail -3` (0 fail) and `npx tsc --noEmit` (clean — JSON/markdown only, nothing should change).

- [ ] **Step 6: Commit**
```bash
git add .claude-plugin plugins
git commit -m "feat: lab-note authoring skill as a Claude Code plugin (ariko marketplace)"
```

---

### Task 2: Docs — README plugin note + ROADMAP C1c row

**Files:**
- Modify: `README.md` (Lab Note pipeline section)
- Modify: `docs/superpowers/ROADMAP.md`

- [ ] **Step 1: README.** In the `### Lab Note pipeline (C1 · GitHub connector)` section, insert this paragraph immediately BEFORE the `**Wiring another repo**` paragraph:

```markdown
**Authoring** — the harmonized `lab-note` skill ships as a Claude Code plugin
from this repo: `/plugin marketplace add alexisbohns/ariko`, then
`/plugin install lab-note@ariko`. One install serves every repo; pbbls keeps
its repo-local superset skill, which takes precedence there by design.
```

- [ ] **Step 2: ROADMAP.** Append to the Shipped table after the C1b row (`#??` backfilled by Task 3):

```markdown
| **C1c — Lab Note fan-out kit** | #?? | Harmonized authoring skill shipped as a Claude Code plugin (`ariko` marketplace); sibling rollout via templated issues + centrally-set secrets — no pushes to sibling repos. |
```

And in the Track C C1 bullet's *Status* sub-item, replace the phrase `Remaining: skill/plugin distribution + caller-stub fan-out (deferred follow-ups in the plan), and Arkaik/changelog connectors (hardening shipped as C1b).` with `Plugin + fan-out kit shipped as C1c; caller stubs land via per-repo issues (C1 GitHub half done when they close). Remaining: Arkaik/changelog connectors.`

- [ ] **Step 3:** `grep -c '^```' README.md` — still even (the new paragraph adds no fences). `grep -n "C1c" docs/superpowers/ROADMAP.md` — 2 hits (row + status).

- [ ] **Step 4: Commit**
```bash
git add README.md docs/superpowers/ROADMAP.md
git commit -m "docs: record C1c fan-out kit (plugin install note + ROADMAP)"
```

---

### Task 3: PR + backfill

- [ ] **Step 1:** `git push -u origin claude/c1-fanout`; `gh pr create` — title `C1c: Lab Note fan-out — authoring plugin + issue-driven sibling rollout`; body: summary (plugin, issue-driven rollout, secrets-central decision, catalog parked), spec/plan pointers, gates line, and this Lab Note (fenced yaml, verbatim):

```yaml
en:
  title: Every repo learns to speak Lab Note
  summary: The bilingual changelog skill is now a plugin any of the five repos can install — write the note once in the PR, and merging does the rest.
fr:
  title: Tous les dépôts parlent désormais Lab Note
  summary: Le talent de rédaction bilingue est maintenant un plugin que chacun des cinq dépôts peut installer — écris la note dans la PR, la fusion fait le reste.
suggested:
  molecule: ariko
  type: feature
  tags: [changelog, connectors, tooling]
```

End with the standard attribution line.

- [ ] **Step 2:** Backfill `#??` → real number in the ROADMAP C1c row; commit `docs: fill C1c PR number in ROADMAP`; push.

---

### Task 4: Post-merge ops — secrets + issues (controller-run)

Run only AFTER the PR merges (issues link to the plugin `@main`).

- [ ] **Step 1: Secrets.** From this session (token in the scratchpad rotation file, part after `github:` in `INBOX_TOKENS`):
```bash
for r in pbbls femfolk arkaik melogram; do
  gh secret set ARIKO_INBOX_TOKEN --repo "alexisbohns/$r" --body "$TOKEN"
done
# verify: gh secret list --repo alexisbohns/<r> shows ARIKO_INBOX_TOKEN, all four
```

- [ ] **Step 2: Issues.** One per repo via `gh issue create --repo alexisbohns/<repo> --title "Wire the Ariko Lab Note pipeline (caller stub + authoring skill)" --body-file <generated>`. Template (substitute `{{REPO}}`, `{{MOLECULE}}`; append the pbbls extra section only for pbbls):

````markdown
## Context

Ariko's Lab Note pipeline is live: merging a PR whose body carries a `## Lab Note`
section posts a bilingual changelog capture to the Ariko inbox automatically
(idempotent upsert on `owner/repo#N`). Machinery and contract live in
[ariko's README §Lab Note pipeline](https://github.com/alexisbohns/ariko#lab-note-pipeline-c1--github-connector);
shipped in alexisbohns/ariko#17 (pipeline) and alexisbohns/ariko#18 (hardening).

## Intention

Wire {{REPO}} in, so its merged user-facing PRs file their own changelog into
the Ariko vault — the only human action is merging.

## Definition of done

- `.github/workflows/lab-note.yml` (the ~10-line stub below) is on `main`.
- One merged PR carrying a Lab Note shows `lab-note: posted (HTTP 201)` in its
  workflow log, and the capture is visible in the Ariko admin inbox.

## Specs

The stub, verbatim:

```yaml
name: lab-note
on:
  pull_request:
    types: [closed]
permissions:
  contents: read
  pull-requests: read
jobs:
  lab-note:
    if: github.event.pull_request.merged == true
    uses: alexisbohns/ariko/.github/workflows/lab-note.yml@main
    secrets:
      inbox_token: ${{ secrets.ARIKO_INBOX_TOKEN }}
```

- Gate: a PR-body section whose heading starts with `## Lab Note`, holding one
  fenced `yaml` block. No section → the job logs "skipped" (chore PRs stay silent).
- Core schema: `en.title` + `en.summary` required; `fr.*` recommended;
  optional `suggested: { molecule, atom, type, tags }`; unknown top-level keys
  are ignored.
- This repo's `suggested.molecule`: `{{MOLECULE}}`.
- The `ARIKO_INBOX_TOKEN` secret is **already set** on this repo — no
  credential handling needed.

## Implementation guidelines

1. Install the authoring skill (once per machine):
   `/plugin marketplace add alexisbohns/ariko` then `/plugin install lab-note@ariko`.
2. Add the stub in a PR whose body carries this repo's **first Lab Note**
   (authored with the skill). The bootstrap works: the workflow file is on the
   PR's merge ref, so merging that very PR fires it.
3. Merge. That merge is the end-to-end proof.

## Sanity check

- `gh run list --workflow=lab-note.yml --limit 1` → success;
  log line `lab-note: posted (HTTP 201) {"id":"…","created":true}`.
- Re-run the job → `lab-note: updated (HTTP 200)` and still ONE capture
  for this PR in the inbox (idempotency).
- A malformed note fails the job naming the exact problem; fix the merged PR's
  body and re-run.
````

pbbls extra section (append before "## Sanity check"):

````markdown
## pbbls only — rewrite the local `lab-note` skill to the superset

Keep `.claude/skills/lab-note/SKILL.md` (it takes precedence over the plugin
here, by design) and update it to emit ONE block serving both destinations:

- Keep ALL Pebbles keys (`species`, `platform`, `status`, `release-date`,
  `published`), the PR-time defaults, the feat-label/Arkaik-view gate, the
  tone rules, and the `## Lab Note (EN/FR)` heading (it already matches
  Ariko's prefix gate).
- Add the harmonized optional `suggested:` block (`molecule: pbbls`, `atom`
  only when confidently known, `type`, `tags`).
- Document the new delivery leg: on merge, the note auto-posts to the Ariko
  inbox; the manual paste into the Pebbles Lab admin at release time
  continues unchanged.
````

- [ ] **Step 3: Verify.** `gh issue list --repo alexisbohns/<r>` shows the issue on all four; spot-check one rendered issue body for fence balance (the stub yaml block is the template's ONLY fenced block; no other line in the body may start with triple backticks).

---

## Deferred follow-ups

- Atom catalog endpoint (sketch in spec §2) — future slice.
- C2 AI classification; Arkaik/changelog connectors.
