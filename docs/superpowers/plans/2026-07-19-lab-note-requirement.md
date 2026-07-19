# Lab Note Requirement (C1d) Implementation Plan

**Goal:** Move the Lab Note requirement off the discretionary skill into always-on
layers (CLAUDE.md + PR template + advisory reminder), in ariko now, and hand the
four sibling repos the same via templated issues — no pushes to sibling repos.

**Spec:** `docs/superpowers/specs/2026-07-19-lab-note-requirement-design.md`

**Environment notes:** Branch `claude/lab-note-requirement-repos-1ka5hj`. Gates:
`node --test` in `scripts/lab-note` (all pass) and `npx tsc --noEmit` (clean —
`.mjs`/markdown/YAML only). The reminder needs no secret.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `CLAUDE.md` | Create | Always-loaded requirement + self-sufficient contract |
| `.github/pull_request_template.md` | Create | Pre-seeded `## Lab Note` section |
| `scripts/lab-note/lib.mjs` | Modify | `reminderVerdict`, `reminderComment`, `REMINDER_MARKER`, `OPT_OUT_LABEL` |
| `scripts/lab-note/lib.test.mjs` | Modify | Verdict + comment tests |
| `scripts/lab-note/remind.mjs` | Create | Thin shell: verdict → upsert/delete one marker comment |
| `.github/workflows/lab-note-reminder.yml` | Create | Reusable advisory reminder + ariko dogfood |
| `README.md`, `docs/superpowers/ROADMAP.md` | Modify | "Making it a requirement" + C1d row/status |

---

### Task 1: The three ariko layers — DONE on this branch

CLAUDE.md, the PR template, and the reminder (pure `reminderVerdict`/`reminderComment`
reusing `extractLabNoteYaml`/`parseLabNote`, the `remind.mjs` shell, the reusable
workflow). Gate/parse are shared with the post path — no second parser. Reminder
posts exactly one `<!-- lab-note-reminder -->` comment and removes it when the PR
is satisfied or carries the `no-lab-note` label. Verified via `node --test` and
`DRY_RUN=true LAB_NOTE_BODY=… node remind.mjs` across ok/missing/invalid/skipped.

### Task 2: Docs — DONE on this branch

README "Making it a requirement" + reminder stub; ROADMAP C1d row + C1 status.

### Task 3: PR + backfill

`git push -u origin claude/lab-note-requirement-repos-1ka5hj`; open the PR with its
own Lab Note (below); dogfood the reminder; backfill `#??` in the ROADMAP row.

Lab Note for this PR (fenced yaml, verbatim):

```yaml
en:
  title: Every repo now remembers its Lab Note
  summary: Opening a PR now prompts for the bilingual changelog note automatically, so shipped work always tells its own story instead of slipping by unrecorded.
fr:
  title: Chaque dépôt se souvient désormais de sa Lab Note
  summary: Ouvrir une PR te rappelle maintenant d'écrire la note de changelog bilingue, pour que le travail livré raconte toujours son histoire au lieu de passer inaperçu.
suggested:
  molecule: ariko
  type: improvement
  tags: [changelog, tooling]
```

### Task 4: Post-merge ops — requirement issues (controller-run, all-repo scope)

Run only AFTER the ariko PR merges (issues link to `@main`). One issue per sibling
via `gh issue create --repo alexisbohns/<repo> --title "Adopt the Lab Note
requirement (CLAUDE.md + PR template + advisory reminder)" --body-file <generated>`.
Substitute `{{REPO}}`, `{{MOLECULE}}`; append the pbbls extra section only for pbbls.

````markdown
## Context

Ariko's Lab Note pipeline is live, but authoring depended on a discretionary skill,
so PRs shipped without notes. C1d added three always-on layers in ariko (see
[README §Making it a requirement](https://github.com/alexisbohns/ariko#lab-note-pipeline-c1--github-connector)):
a `CLAUDE.md` requirement block, a PR template, and a reusable **advisory** reminder
workflow. This issue brings {{REPO}} onto the same page.

## Intention

Make {{REPO}}'s user-facing PRs reliably carry a Lab Note, regardless of whether
the plugin is installed in the session that opens them.

## Definition of done

- `CLAUDE.md` carries the Lab Note requirement with this repo's molecule
  (`{{MOLECULE}}`) and a self-sufficient copy of the contract.
- `.github/pull_request_template.md` seeds the `## Lab Note` section.
- `.github/workflows/lab-note-reminder.yml` (stub below) is on `main`.
- On a later PR: no note → the reminder comments; add a note or the `no-lab-note`
  label → it goes quiet.

## Specs

Reminder stub, verbatim (no secret needed):

```yaml
name: lab-note-reminder
on:
  pull_request:
    types: [opened, edited, synchronize, labeled, unlabeled, ready_for_review]
permissions:
  contents: read
  pull-requests: write
jobs:
  lab-note-reminder:
    uses: alexisbohns/ariko/.github/workflows/lab-note-reminder.yml@main
```

- CLAUDE.md requirement: copy ariko's § "Lab Note requirement" and set the molecule
  to `{{MOLECULE}}` and the "this repo's molecule slug" line accordingly.
- PR template: copy ariko's `.github/pull_request_template.md`, set
  `molecule: {{MOLECULE}}`.
- The reminder is advisory (never blocks) and needs no `ARIKO_INBOX_TOKEN`.

## Implementation guidelines

1. Install the authoring skill once per machine (`/plugin marketplace add
   alexisbohns/ariko`, `/plugin install lab-note@ariko`) — optional now that
   CLAUDE.md is self-sufficient, but nice for tone depth.
2. Land the three files in a PR whose body carries this repo's Lab Note (dogfood).
3. Merge.

## Sanity check

- Open a throwaway PR with no note → the `lab-note-reminder` run posts one comment.
- Add a valid note (or the `no-lab-note` label) → the comment is removed on the
  next event.
````

pbbls extra section (append before "## Sanity check"):

````markdown
## pbbls only — fold the requirement into the local skill/instructions

pbbls keeps a repo-local `lab-note` skill that takes precedence over the plugin.
Add the requirement to pbbls' `CLAUDE.md` (or its skill) pointing at that local
skill instead of the harmonized one, keep its `## Lab Note (EN/FR)` heading (it
already matches the prefix gate), and set `molecule: pbbls`. The advisory reminder
and PR template apply unchanged.
````

---

## Deferred follow-ups

- Escalate the advisory reminder to a required/blocking check once tuned.
- Diff-based user-facing classification (superset of the label opt-out).
