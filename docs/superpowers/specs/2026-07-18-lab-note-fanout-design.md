# Lab Note fan-out — plugin + issue-driven sibling rollout (C1c)

*2026-07-18 — design approved in brainstorming; implementation plan to follow.*

## 1. Intent

C1a shipped the pipeline (ariko posts to itself); C1b hardened the endpoint.
This slice makes the pipeline useful across the five repos: the harmonized
authoring skill ships as a Claude Code plugin from ariko, and each sibling
(pbbls, femfolk, arkaik, melogram) wires its own caller stub — guided by a
GitHub issue, executed by that repo's own dev loop. **Nothing is pushed to
sibling repos from this rollout.**

## 2. Decisions (brainstorm outcomes)

| Question | Decision |
|---|---|
| Sibling rollout mechanism | **One GitHub issue per repo** (same template, per-repo variables: repo name, molecule slug, pbbls extra section). Each repo's dev loop adds its own stub via its own PR, whose body carries that repo's first Lab Note — merging it is the per-repo E2E proof (bootstrap works: the workflow file is on the PR's merge ref). No stub PRs from us. |
| pbbls skill rewrite | Also via its issue (it is a push to another repo otherwise). pbbls keeps a repo-local superset skill; the plugin skill serves the other repos and ariko. Repo-local skill takes precedence in pbbls — by design. |
| Secrets | `ARIKO_INBOX_TOKEN` set **centrally, now, from this session** on all four repos (issues on public repos cannot carry the value; sibling loops never handle the credential). Issues state the secret is already in place. |
| Atom catalog | **Skipped — future slice.** Sketch (parked): token-gated `GET /api/inbox/catalog?molecule=<slug>` (any valid `INBOX_TOKENS` bearer, like `/api/upload`), returning all atoms (slug+name) of a molecule including private ones, consumed by the authoring skill in the dev loop when a local token is available. Until then `suggested.atom` is only written when confidently known. |
| Issue timing | Issues created **after** the ariko PR merges, so they link to the shipped plugin/marketplace `@main`. |

## 3. The plugin (ariko repo)

- `.claude-plugin/marketplace.json` at repo root — marketplace name `ariko`,
  one plugin entry `lab-note` sourced from `./plugins/lab-note`.
- `plugins/lab-note/.claude-plugin/plugin.json` — name, description, version.
- `plugins/lab-note/skills/lab-note/SKILL.md` — the harmonized authoring skill:
  - **Gate:** user-facing change → note; chore/refactor/infra/docs → no section.
  - **Contract:** heading starting `## Lab Note`, one ```yaml fence, core schema
    (`en.title`/`en.summary` required, `fr.*` recommended, `suggested` optional),
    unknown top-level keys ignored (superset tolerance).
  - **Tone rules** carried from the pbbls skill verbatim (benefit-first, short,
    warm/playful, French informal "Tu", adaptation not translation, no jargon).
  - **Per-repo `suggested.molecule` table:** `pbbls`, `femfolk` (exist in the
    vault); `arkaik`, `melogram`, `ariko` (to be created at triage — suggest
    anyway, triage shows suggestions read-only even when unmatched).
  - **`suggested.atom`:** only when confidently known; no catalog yet.
  - **Recovery note:** malformed note fails the merge job loudly; edit the
    merged PR body and re-run (posting is idempotent).
- Install once per machine (`/plugin marketplace add alexisbohns/ariko`,
  `/plugin install lab-note@ariko`) — serves every repo including ariko.

## 4. The issue template (× 4)

Sections: **Context** (pipeline live; links to ariko README §Lab Note pipeline,
PRs #17/#18), **Intention**, **Definition of done** (stub on main; first merged
PR with a note logs `lab-note: posted (HTTP 201)`; capture in the Ariko inbox),
**Specs** (stub YAML verbatim from ariko README; heading gate; core schema;
this repo's `suggested.molecule`; note that the secret is already set),
**Implementation guidelines** (stub via a PR carrying the repo's first Lab
Note; add marketplace + install plugin for authoring), **Sanity check**
(job log posted/201; re-run → updated/200; capture visible in admin).
pbbls extra section: rewrite `.claude/skills/lab-note` to the superset — keep
all Pebbles keys, its gate guidance, and the `## Lab Note (EN/FR)` heading
(already matches the prefix gate), add `suggested`, note the auto-post at merge
(the manual paste-to-Lab-admin flow at release time continues unchanged).

## 5. Rollout & verification

1. Ariko PR: plugin files + README plugin-install note + ROADMAP C1c row
   (`#??` backfilled) — PR body carries its own Lab Note, as usual.
2. After merge: set 4 secrets, create 4 issues (ops, from this session).
3. C1 GitHub connector **done** when the four issues close on merged stub PRs.
- No unit-testable code in this slice: validation = JSON-parse both manifests,
  frontmatter sanity on the skill, and dogfooding the plugin on ariko's own
  next PR. Issue-template correctness = review before creation.

## 6. Out of scope

- The atom catalog endpoint (sketch parked in §2).
- C2 AI classification; Arkaik/changelog connectors.
- Automating anything inside sibling repos.
