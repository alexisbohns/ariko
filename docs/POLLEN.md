# Pollen — the Ariko federation contract

**Version: 1** · This document is normative. It versions with the repo;
the reference validator is [`lib/pollen.ts`](../lib/pollen.ts) and the
conformance fixtures are [`data/pollen/`](../data/pollen/). A sibling
project should be able to build a conforming adapter from this document
alone.

Bees carry pollen between plants: every sovereign project of the
practice reports its activity as **pollen** — one envelope shape, three
verbs (report / read / initiate). Ariko aggregates; sources stay
sovereign.

## The envelope

One event, one JSON object:

```json
{
  "v": 1,
  "id": "melogram:album-celesta-published",
  "at": "2026-06-01T10:00:00Z",
  "source": "melogram",
  "kind": "published",
  "title": { "en": "Celesta is out", "fr": "Celesta est sorti" },
  "anchors": { "plant": "plant:bohns-music", "pod": "pod:celesta" },
  "refs": [{ "label": "album", "url": "https://…", "ref": "album_celesta" }],
  "payload": { "tracks": 9 }
}
```

| Field | Req | Rule |
|---|---|---|
| `v` | ✓ | Contract version, integer `1`. Consumers refuse a `v` they don't know — loudly, never a silent partial parse. |
| `id` | ✓ | Globally unique, **stable forever** — the idempotency key. Convention: `"<source>:<native-id>"`. Re-emitting an id is a no-op for every consumer. |
| `at` | ✓ | When the event *happened* (source truth, not emission time). Strict ISO 8601 with seconds and explicit timezone; UTC `Z` recommended. Shape `YYYY-MM-DDTHH:MM:SS[.fff](Z|±HH:MM)`; calendar-invalid values (Feb 30, hour 24) are rejected. |
| `source` | ✓ | Slug of the emitting **tool** (`arkaik`, `melogram`, `femfolk`…) — not always the anchored plant (melogram emits for `plant:bohns-music`). |
| `kind` | ✓ | See vocabulary below. |
| `title` | ✓ | Human-grade one-liner. A non-empty string, or `{ "en"?, "fr"? }` with at least one non-empty part. Parts are trimmed; whitespace-only counts as empty. |
| `anchors` | ✓ | What it concerns, in practice-graph refs: `plant` (required), `pod?`, `bean?` — prefixed (`plant:<slug>`). One anchor set per envelope; an event concerning two plants is two envelopes. Dangling anchors are the reader's problem (ignored fail-closed), not a schema error. |
| `refs` | | Deep links / native ids: `{ label, url?, ref? }[]`, each with at least one of `url` \| `ref`. |
| `visibility` | | `"private"` is **binding and fail-closed**: recorded, never published. `"public"` (or absent) is only a hint — publishing is always a human act on the ariko side. |
| `payload` | | Optional native detail — a JSON **object** (not an array or scalar), schema owned by the source, opaque to ariko. Serialized size ≤ **32 KiB**; bigger detail belongs behind a `ref`. |

Slugs — `source`, `target`, and the `<slug>` part of every anchor ref —
match `^[a-z0-9][a-z0-9-]*$`: lowercase letters, digits, and hyphens only.

Unknown top-level keys are **ignored** (forward compatibility).
Envelopes are **immutable** once emitted: a correction is a new envelope
(new `id`, a `ref` to the corrected one).

## `kind` vocabulary

Grammar: lowercase dotted words, `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$`,
max 64 chars. The v1 core:

| kind | meaning |
|---|---|
| `shipped` | a feature/change delivered |
| `release.tagged` | a repo release cut |
| `published` | a public artefact went live |
| `drafted` | a draft artefact created |
| `decided` | a decision recorded |
| `milestone` | a threshold/anniversary crossed |
| `task.opened` | dispatched work acknowledged |
| `review.requested` | work waiting on the human gate |
| `task.done` | dispatched work finished |

Any kind matching the grammar is **accepted**; non-core kinds produce a
warning and generic handling (a beanstalk line, no special projection) —
never a rejection, never silent loss. Promoting a kind into the core is
an additive change (no `v` bump).

`task.opened → review.requested → task.done / published` is the dispatch
status arc; the correlating intent id travels in `refs`
(`{ "label": "intent", "ref": "<intent id>" }`).

## Report — two transports

**HTTP feed** (hosted sources):

```
GET <base>/pollen?after=<id>&limit=<n>   →   { "pollen": [ …envelopes… ] }
```

Append order. `after` absent ⇒ from the beginning. `limit` capped at 200
by the server. Empty array ⇒ caught up — the consumer's cursor is simply
the last id it processed. Unknown `after` ⇒ **410 Gone** ⇒ the consumer
discards its cursor and rebuilds from the start. Auth (bearer token or
public) is per-adapter, outside this contract.

**Committed feed file** (unhosted sources): `pollen/feed.ndjson` in the
source repo — one envelope per line, UTF-8, append-only, blank lines
ignored. RSS, literally. The source's bee entry in the garden points at
it via `levers`. Rotation is reserved for a future version.

Feeds are append-only in normal operation. Rewriting history is legal
only as a coordinated event: consumers drop cursors and rebuild.

## Read — guarantees

Implemented ariko-side by the slice-4 read model
(`docs/superpowers/specs/2026-08-17-read-model-beanstalk-design.md`);
stated here because
producers and consumers both rely on them: idempotent by `id`; cursor =
last processed id per source; full rebuild possible at any time from the
feed itself; ariko's copy is a disposable projection, never a live
proxy; synthesis bricks query the cache, not the sources.

## Initiate — the reverse envelope

```json
{
  "v": 1,
  "id": "ariko:intent-0001",
  "at": "2026-08-15T08:00:00Z",
  "target": "femfolk",
  "kind": "research",
  "brief": { "en": "Research the song heard at the cafe" },
  "anchors": { "plant": "plant:femfolk" }
}
```

Same field rules as the envelope, with `target` (receiving project slug)
instead of `source`, required `brief` (Text) instead of `title`, and
`anchors` optional. Delivered through the target's **native door**
(intake API, arkaik `file_request`, `workflow_dispatch`, backlog PR) —
delivery is not part of this contract. **Status returns through the
target's ordinary report feed**, never a second mechanism. The intent
kind vocabulary (`research`, `draft`) is provisional until the dispatch
pilot (slice 7); the shape is normative now. Non-listed intent kinds
follow the same rule as report kinds: accepted with a warning, never
rejected.

## Security posture

Normative for every adapter (inherited from the umbrella): executors
hold at most one secret (a PAT scoped to `actions:write`); DB
credentials never leave the owning project's CI; write doors validate
and dedupe, refusals are logged and never fatal; inbox tokens stay
per-source-kind scoped. The ariko inbox (`POST /api/inbox`) remains the
third door for homeless sources and human capture — pollen does not
replace it.

## Versioning

- `v` bumps only on breaking change (new required field, changed
  semantics of an existing one).
- Additive, same `v`: new optional fields, core-kind promotions, new
  transports. Consumers ignore unknown keys.
- Validate with `npm run pollen:validate -- <feed.ndjson | envelope.json>`
  (add `--intent` for intents).

## Changelog

- **v1** (2026-08-15) — initial contract: envelope, nine core kinds,
  report/read/initiate, two transports.
