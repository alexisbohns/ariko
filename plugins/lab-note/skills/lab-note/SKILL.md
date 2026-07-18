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
