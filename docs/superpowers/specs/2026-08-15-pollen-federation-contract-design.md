# Slice 2 — Pollen: federation envelope + contract

**Date:** 2026-08-15
**Status:** Approved design. Child of the umbrella spec
[`2026-08-14-ariko-federation-design.md`](2026-08-14-ariko-federation-design.md) (§10, sub-project 2).
**Shape:** One PR — the contract document, a reference validator, conformance
fixtures, and a validate CLI. No ingestion, no persistence, no adapters.

---

## 1. Goal

Make the federation envelope real before anything implements it. Slice 1
reserved the name: bees carry **pollen** between plants. This slice defines
pollen precisely — the envelope schema, the `kind` vocabulary (deferred to
here by umbrella §12), the three verbs (report / read / initiate), and the
versioning rules — so that slice 3 (arkaik adapter), slice 4 (read model)
and every later adapter implement one contract instead of inventing shapes.

Deliverables:

1. **`docs/POLLEN.md`** — the normative contract, v1. Self-contained: a
   sibling repo must be able to build a conforming adapter from it alone.
2. **`lib/pollen.ts`** — reference TypeScript validator, house style.
3. **`data/pollen/`** — conformance fixtures (valid + invalid), the suite
   every adapter tests against (umbrella §11: adapters fixture-tested
   against recorded feed samples).
4. **`scripts/pollen-validate.ts`** — CLI dry-run for feed files (umbrella
   §11: ingest doors have `--validate-only` dry-runs; this is the
   producer-side twin).

## 2. Approach decision

Three shapes were weighed:

- **A — spec document only.** Lightest, but unenforced: slice 3/4 would
  each hand-roll validation and drift.
- **B — spec + reference validator + fixtures in this repo** ✅ chosen.
  The markdown is normative, the validator is the executable reference,
  the fixtures are the cross-repo conformance artifact (adapters copy
  them). Zero new dependencies; matches the `lib/inbox.ts` hand-rolled
  guard style and `node --test`.
- **C — shared published npm package.** Strongest harmonization, but
  publishing overhead for a one-person federation; all consumers are
  TS repos that can vendor `lib/pollen.ts` + fixtures. YAGNI.

No JSON Schema artifact in v1: two normative machine artifacts drift, and
every planned consumer is TypeScript. Revisit if a non-TS consumer appears.

## 3. The envelope

```ts
export const POLLEN_VERSION = 1;

interface PollenAnchors {
  plant: string;                 // "plant:<slug>" — required
  pod?: string;                  // "pod:<slug>"
  bean?: string;                 // "bean:<slug>"
}

interface PollenRef {
  label: string;                 // human-grade
  url?: string;                  // deep link
  ref?: string;                  // native id (arkaik node id, PR number, album id…)
}                                // at least one of url | ref

interface Pollen {
  v: 1;                          // contract version
  id: string;                    // globally unique, stable — THE idempotency key
  at: string;                    // ISO 8601 UTC, e.g. "2026-08-15T09:30:00Z"
  source: string;                // emitting tool slug: arkaik, melogram, femfolk…
  kind: string;                  // §4
  title: Text;                   // string | { en?, fr? }, ≥1 non-empty part (B1 shape)
  anchors: PollenAnchors;
  refs?: PollenRef[];
  visibility?: "public" | "private";
  payload?: Record<string, unknown>;  // source-owned schema, opaque to ariko
}
```

Field semantics locked here:

- **`id`** — convention `"<source>:<native-id>"` (`arkaik:evt_857`,
  `melogram:album-celesta-published`). Must never change for the same
  event; re-emitting the same id is a no-op for every consumer.
- **`at`** — when the event happened (source truth), not when it was
  emitted. Strict ISO 8601 with timezone; UTC `Z` recommended.
- **`source`** — the emitting *tool*, which is not always the anchored
  plant (melogram emits pollen anchored to `plant:bohns-music`). Lexical
  slug check only; garden cross-checks are read-side business (slice 4).
- **`anchors`** — prefixed refs, same style as `parents[]`/`serves[]`.
  One anchor set per envelope; an event concerning two plants is two
  envelopes with distinct ids. Dangling anchors are the *reader's*
  problem (ignored fail-closed, as everywhere in ariko), not a schema
  error — sources may anchor to plants ariko hasn't seeded yet.
- **`title`** — the exact `Text` boundary shape the inbox already
  enforces (string, or `{en?, fr?}` with at least one non-empty part).
  Bilingual sources (femfolk, lab notes) keep their richness; English-only
  sources send a plain string.
- **`visibility`** — `"private"` is **binding and fail-closed**: the
  event exists in the record but never crosses `filterPublic`, same tier
  rule as everything botanical. `"public"` (and absent) is only a hint —
  publishing remains a human act; projection defaults per source are
  slice 4 business.
- **`payload`** — optional native detail; serialized size ≤ **32 KiB**
  (validator-enforced). Anything bigger belongs behind a `ref`. Unknown
  payload internals are never validated by ariko.
- **Unknown top-level keys are ignored** (lab-note precedent) — forward
  compatibility for minor additions.

## 4. `kind` vocabulary — v1 core

Exactly the umbrella's seeds (§5 + §7), no additions:

| kind | meaning | typical source |
|---|---|---|
| `shipped` | a feature/change delivered | arkaik journal, GitHub |
| `release.tagged` | a repo release cut | GitHub |
| `published` | a public artefact went live | melogram, femfolk, blogs |
| `drafted` | a draft artefact created | femfolk dossiers, synthesis bricks |
| `decided` | a decision recorded | arkaik |
| `milestone` | a threshold/anniversary crossed | melogram play counts |
| `task.opened` | dispatched work acknowledged | any initiate target |
| `review.requested` | work waiting on the human gate | femfolk, synthesis |
| `task.done` | dispatched work finished | any initiate target |

**Extension rule:** the lexical grammar is
`^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$` (lowercase dotted words, ≤ 64
chars). The validator **accepts any kind matching the grammar**; kinds
outside the core list produce a *warning*, never a rejection — umbrella
§11, no silent loss: an unknown kind is recorded and handled generically
(a beanstalk line, no special projection). Promoting a kind into the core
is an additive spec change, no version bump (§7).

`task.opened → review.requested → task.done / published` is the dispatch
status arc (§6); the correlating intent id travels in `refs`.

## 5. The verbs

### Report — two transports, one envelope

- **HTTP feed** (hosted sources):
  `GET <base>/pollen?after=<id>&limit=<n>` → `{ "pollen": Pollen[] }`
  in append order. `after` absent ⇒ from the beginning; `limit` capped
  at 200 by the server. Empty array ⇒ caught up (the consumer's cursor
  is simply the last id it processed). Unknown `after` ⇒ **410 Gone** ⇒
  the consumer discards its cursor and rebuilds from the start. Auth is
  per-adapter (bearer token or public), outside this contract.
- **Committed feed file** (unhosted sources): `pollen/feed.ndjson` in the
  source repo — one JSON envelope per line, UTF-8, append-only. RSS,
  literally. The source's bee entry in the garden points at it via
  `levers`. Rotation is reserved for a future version; v1 is one file.

Feeds are **append-only in normal operation**. Envelopes are immutable
once emitted; a correction is a *new* envelope (new id, a `ref` to the
old one). Rewriting feed history is legal only as a coordinated event:
consumers drop cursors and rebuild — which slice 4's read model must
support by construction anyway (disposable projection).

### Read — the guarantees consumers rely on

Defined here, implemented in slice 4: idempotent by `id`; cursor = last
processed id per source; full rebuild possible at any time from the feed
itself; ariko's copy is a disposable projection, never a live proxy;
synthesis bricks query the cache, not the sources.

### Initiate — the reverse envelope

```ts
interface Intent {
  v: 1;
  id: string;                    // "ariko:<slug-or-uuid>" — delivery idempotency
  at: string;                    // ISO 8601 UTC
  target: string;                // receiving project slug: femfolk, arkaik…
  kind: string;                  // same grammar as §4; provisional core: research, draft
  brief: Text;                   // the ask, human-grade
  anchors?: PollenAnchors;
  refs?: PollenRef[];
}
```

Delivered through the target's native door (intake API, `file_request`,
`workflow_dispatch`, backlog PR) — delivery is *not* part of this
contract. Status returns through the target's ordinary report feed
(`task.opened` carrying `refs: [{ label: "intent", ref: "<intent id>" }]`),
never a second mechanism. The intent kind vocabulary (`research`,
`draft`) is explicitly **provisional until slice 7** — the shape is
normative now, the vocabulary is not.

## 6. Versioning & security posture

- `v` bumps only on breaking change (new required field, changed
  semantics). Optional-field additions, core-kind promotions, new
  transports: additive, same `v`. Consumers ignore unknown keys; a
  consumer receiving `v` greater than it knows refuses the envelope
  loudly (no silent partial parse).
- `docs/POLLEN.md` carries a changelog section; the document in the repo
  is the single source of truth — instructions version with the repo.
- Security (restated from umbrella §5, normative for adapters): executors
  hold at most one secret (`actions:write` PAT, paulopus pattern); DB
  credentials never leave the owning project's CI; write doors validate
  and dedupe; refusals are logged, never fatal; inbox tokens stay
  per-source-kind scoped. The inbox remains the third door for homeless
  sources — pollen does not replace it.

## 7. Reference implementation — `lib/pollen.ts`

House style: pure guards, no dependencies, no DB, same result shape as
`lib/inbox.ts` plus a warnings channel:

```ts
type PollenResult =
  | { ok: true; value: Pollen; warnings: string[] }   // e.g. non-core kind
  | { ok: false; error: string };

validatePollen(value: unknown): PollenResult
validateIntent(value: unknown): IntentResult
validateFeed(ndjson: string): { line: number; result: PollenResult }[]
```

Exported constants: `POLLEN_VERSION`, `CORE_KINDS`, `KIND_PATTERN`.
`Text` normalization reuses the exact logic of the inbox boundary
(extract `normalizeTextInput` from `lib/inbox.ts` into a shared helper
rather than duplicating it). Errors are clear, field-named strings
(`"anchors.plant is required"`), matching spec-c1 tone: malformed
envelopes are rejected, never silently dropped.

## 8. Conformance fixtures — `data/pollen/`

- `valid/` — one per adapter-matrix row and kind family:
  `arkaik-shipped.json`, `arkaik-decided.json`,
  `melogram-published.json`, `melogram-milestone.json`,
  `femfolk-drafted.json`, `femfolk-review-requested.json`,
  `github-release-tagged.json`, `noncore-kind.json` (valid + warning),
  `intent-research.json`, plus `feed-sample.ndjson`.
- `invalid/` — each paired with its expected error in a
  `manifest.json` (`{ file, error }`): missing id, bad `at`, kind
  grammar violation, missing `anchors.plant`, unprefixed anchor, ref
  with neither url nor ref, oversize payload, unknown `v`, blank title.
- Tests iterate both directories — adding a fixture *is* adding a test.
  Sibling repos copy this directory to conformance-test their adapters.

## 9. Acceptance

- `docs/POLLEN.md` reviewed as self-sufficient: envelope, kinds, verbs,
  transports, versioning, security — no reference back into ariko code.
- Every `valid/` fixture passes `validatePollen`/`validateIntent`;
  `noncore-kind.json` passes with exactly one warning.
- Every `invalid/` fixture fails with its manifest error (substring
  match).
- Unknown top-level keys ignored; `v: 2` refused loudly.
- `validateFeed` reports line-numbered results; the CLI exits non-zero
  on any invalid line, prints `line N: <error>`, and validates
  `feed-sample.ndjson` clean.
- `npx tsc --noEmit` and `npm test` green; no new dependencies; no DB or
  network touched anywhere in the slice.

## 10. Out of scope

Ingestion, persistence, cursors in practice (slice 4); arkaik
journal→pollen mapping and lab-note retirement (slice 3); intent
delivery and the intent kind vocabulary's finalization (slice 7); feed
file rotation; JSON Schema artifact; shared npm package; any garden or
schema change (no new species — pollen is a wire format, not a stored
one… until slice 4 decides its storage).

## 11. Decisions taken autonomously (flag for review)

Made during a background brainstorm; each is cheap to reverse before
implementation:

1. **Approach B** (spec + reference validator + fixtures, no JSON
   Schema, no package) — §2.
2. **`v: 1` field required** in every envelope — cheap now, priceless
   later.
3. **Kind core = exactly the umbrella's nine**, warn-don't-reject
   extension grammar — §4.
4. **`visibility: "private"` binding / `"public"` advisory** — §3.
5. **Contract lives at `docs/POLLEN.md`** (ROUTINE.md-style repo-versioned
   caps document), fixtures at `data/pollen/`.
6. **410-Gone cursor-reset semantics** for the HTTP transport — §5.
7. **NDJSON** (not YAML) for the committed feed file — appendable,
   line-oriented, one-parse-per-line.
8. **Intent shape normative now, intent vocabulary provisional** — §5.
