# Ariko Federation — umbrella design

**Date:** 2026-08-14
**Status:** Approved umbrella design. Each sub-project (§10) gets its own spec → plan → implementation cycle; this document is the shared architecture they all answer to.
**Scope:** Ariko as the cross-project hub — the living map of the whole practice, the aggregation of everything done, the synthesis of digests/reviews/showcase material, and the dispatch of work into sovereign projects.

---

## 1. Problem

The practice spans many projects (pbbls, arkaik, femfolk, melogram, paulopus, oxymore, blogs, podcast, teale). The pain point is not doing the work — it is **keeping an overview of everything ongoing and done, and telling it**: digests, reviews, articles, portfolio material. Reporting is the bottleneck; it must become systematic, from idea to delivery.

Existing layers already cover fragments of that chain:

- **Arkaik journals** (pbbls: 857 events; femfolk; arkaik itself) — decision→delivery within a project, append-only, with backlog/changelog projections.
- **Lab Notes** — curated per-PR notes flowing from five repos into Ariko's inbox via a reusable workflow.
- **Paulopus writer** — a proven nightly-agent pattern (state-derived work-list, guarded ingest, `workflow_dispatch` transport, repo-versioned ROUTINE.md).
- **Ariko** — capture inbox with per-source-kind token scoping, Capture → triage → publish pipeline, public/private split.

Nothing aggregates across projects; nothing synthesizes; the chain does not start at "idea" for anything that is not already a PR.

## 2. Decisions (settled during brainstorm)

1. **Ariko is the hub.** Its graph is the canonical cross-project map; its inbox is the aggregation door; its public side is the showcase terminus.
2. **Roll-up ownership ladder, no duplication.** Pebbles owns code → Arkaik owns the Journal → Ariko owns the Meta. Each layer reads the one below and adds only what the layer below cannot produce. Generalized: every project is sovereign over its own domain (Melogram over music artefacts, Femfolk over its editorial pipeline); Ariko never authors journal-grade facts, only projects them.
3. **Botanical vocabulary, all in.** bean (atom), pod (molecule), plant (practice-level container), beanstalk (the growth timeline). Schema rename included, done before the practice-graph slice. One cosmology everywhere; no chemistry/botany mix.
4. **v1 sources: all four.** Arkaik journals, GitHub beyond lab notes, creative streams (blogs, podcast, music), teale (private-only, manual-ritual shaped).
5. **v1 synthesis: all four outputs.** Weekly digest (private), monthly review (publishable), milestone showcase drafts (event-triggered), article seeds (feeding dispatch). Staged in that order.
6. **Engine per brick.** Recurring bricks may run as Claude routines (subscription) or Gemini-powered Actions (metered). The architecture is engine-agnostic: the transport is the contract.
7. **Surface: D1 first.** The cockpit is a product. Pull D1 (artistic direction — including the botanical visual identity) forward as a parallel design track; build the proper web surface after it; native iOS after that. The data spine does not wait for the surface.
8. **Human gate everywhere.** Machines draft, feeds announce, the human publishes. Applies identically to femfolk dossiers and ariko's own synthesis output.

## 3. Architecture — four layers

1. **The map** — Ariko's practice graph: every project, integration brick, and outlet is a node; relations express how they articulate. Simultaneously the portfolio's content and the cockpit's control surface.
2. **The intake** — activity arrives either through **federated feeds** (sovereign projects reporting) or through the existing **inbox** (`POST /api/inbox`) for sources with no home to be readable from: raw ideas, podcast notes, teale. Per-source-kind token scoping is the security model.
3. **The synthesis** — scheduled bricks read the accumulated record + map through Ariko's APIs and write digests/reviews/drafts back through one guarded write door on ariko itself (`workflow_dispatch` → validated ingest → draft beans; the paulopus tunnel, ported).
4. **The exhibition** — synthesized material flows through the existing triage → publish cascade. Teale-sourced material is structurally non-publishable.

Arkaik stays exactly what it is — per-project product truth — and becomes Ariko's richest upstream source. Oxymore is represented in the map, read-only, no automation (third-party-owned repo).

## 4. Practice graph (botanical model)

- **Plants** are practice-level containers, of two natures:
  - **works** — bodies of work: Pebbles, Femfolk (editorial), Bohns Music, the podcast, teale…
  - **tools** — platforms where works live: Melogram, Arkaik, the repos. One codebase can be both (Melogram-the-app is a work; Melogram-the-platform distributes Bohns Music).
- **Pods and beans** carry the showcase-grade entities under plants. Exact placement of kinds (plant tier vs pod/bean fields) is decided in the practice-graph slice against the real `lib/data.ts`.
- **Bricks** — integration components (connectors/adapters, routines, workflows, capabilities like the song-identifier) — are nodes with operational status (planned / live / paused / broken) and pointers to their levers (workflow file, routine, schedule). This is what "centrally control integration bricks" acts on.
- **Relations as articulations:** `uses`, `feeds`, `publishes-to`, `monitors`, `distributes` (Melogram → Bohns Music), `chronicles` (Arkaik → Pebbles). The systems diagram is a query, not a drawing.
- **Projected vs authored** — the crisp rule:
  - A **projected** bean is machine-created from a source's feed (e.g. the "Damned Thoughts" bean under Bohns Music when Melogram reports a publication). Read-only in Ariko; the source owns it; rebuildable at any time.
  - An **authored** bean is meta-prose (the Glyph Marketplace V2 piece, a monthly review), anchored to coarse showcase nodes with refs pointing down into native ids (arkaik node ids, PRs, melogram album ids). Ariko never mirrors arkaik's fine-grained graph — it holds only nodes that deserve showcase existence.
- **The beanstalk** — the timeline — renders the union of feed events and authored material; growth-over-time is the page's meaning.

## 5. Federation contract — one envelope, three verbs

The harmonization core. A small versioned spec living in this repo; every adapter implements it.

### The envelope

```yaml
id:        # stable, unique — idempotency key
at:        # timestamp
source:    # emitting tool (arkaik, melogram, femfolk…)
anchors:   # what it concerns, in practice-graph terms: plant / pod? / bean?
kind:      # small shared vocabulary: shipped, published, drafted, decided,
           # task.opened, task.done, review.requested, milestone…
title:     # one line, human-grade
refs:      # deep links / native ids
payload:   # optional native detail, schema owned by the source
```

### The verbs

- **Report** — each project exposes its activity as an append-only, cursor-based feed of envelopes (arkaik journal semantics, generalized). Idempotent by `id`. Two transports, same envelope:
  - **HTTP feed endpoint** for hosted projects (arkaik, melogram, femfolk once hosted);
  - **committed feed file** in the repo for unhosted ones (a routine/Action appends and commits — RSS, literally).
  The ariko inbox remains the third door for homeless sources and human capture.
- **Read** — Ariko syncs feeds into a **rebuildable read model** (cursor = last event id; full rebuild from source export at any time) and projects beans from them. Never a live proxy: ariko's availability is not chained to upstreams, and synthesis bricks query the cache, not the sources. Ownership stays upstream; ariko's copy is a disposable projection.
- **Initiate** — the reverse envelope: an intent (`target project, anchors, brief, kind`) delivered through the project's native door (arkaik `file_request` / mutations API, a `workflow_dispatch`, a backlog-file PR, an intake API). Execution lives entirely project-side. **Status returns through the same feed** (`task.opened` → `review.requested` → `task.done` / `published`) — no RPC, no executor polling, no second mechanism.

### Security posture (inherited, generalized)

- Agents/executors hold at most one secret (a PAT scoped to `actions:write`, paulopus pattern); DB credentials never leave the owning project's CI.
- Ariko write door: validated ingest with write-once/dedupe guards; refusals logged, never fatal.
- Inbox tokens stay per-source-kind scoped.

## 6. Adapter matrix

| Project | Report | Initiate | Notes |
|---|---|---|---|
| **Arkaik** | Journal + export → envelope mapping; closest to done | mutations API / `file_request` | Webhook extension ingests `## Lab Note` YAML from merged PR bodies into the journal; the writing ritual (PR template, reminder) survives; ariko's reusable `lab-note.yml` is retired for arkaik-mapped repos |
| **Pebbles** | via Arkaik (chronicled) | via Arkaik | Nothing new project-side |
| **Melogram** | New duty — the "Arkaik of music": domain events (album/track published, setlist changed, play-count milestones from `track_play_counts`) anchored to Bohns Music | later (roadmap/planning intents) | Most work on Melogram's side; optionally arkaik-map its dev side (replay/bootstrap machinery exists) |
| **Femfolk** | Authenticated API (drafts/intake state, for Jarvis + routine) + public API (published material) | Intake collection in its DB; Action serves the due-list to the nightly routine | Entity-based dossiers, not PRs (see §8). Graduates femfolk from local-first JSON to a hosted app with a real store — deliberate decision inside that slice |
| **Paulopus** | Read-only; optional one-time bootstrap into the record | — | Finished project; showcase material |
| **Oxymore** | Represented in map only | — | Third-party repo; no automation |
| **Blogs / podcast** | RSS poll or manual capture via inbox | — | Anchored to their plants |
| **Teale** | Manual weekly-ritual capture via inbox, private-only kind | — | Structurally non-publishable |

## 7. Synthesis bricks

One pattern, four triggers; all outputs are **authored draft beans** through the guarded ariko write door, then the human gate:

1. **Weekly digest** (calendar) — the week's events across all plants, structured, with links down into sources. Private. First brick; first engine decision.
2. **Monthly review** (calendar) — publishable prose drafted from the weekly digests → triage → publish cascade.
3. **Milestone showcase drafts** (event) — a showcase-worthy `shipped`/`release.tagged` event spawns a prose draft anchored to the right pods/beans. The systematic version of the pre-written paulopus articles.
4. **Article seeds** (event) — feed material that deserves a femfolk piece or blog post becomes a dispatch intent: synthesis feeding the initiate verb.

## 8. Dispatch, end to end (the femfolk song scenario)

1. Song heard → capture into ariko inbox (mobile transport decided in the surface slice; the inbox API exists today).
2. Classification (roadmap C2, with the map as target vocabulary) suggests: *femfolk research intent, anchors*. Human confirms in triage (high-confidence auto-dispatch is a later relaxation).
3. Ariko posts the intent to femfolk's intake.
4. Nightly, femfolk's routine gets its due-list from the Action (paulopus `due.ts` pattern), researches, and writes the **song dossier** — typed entity bits (artist bio, song context, punchline nugget, femfolk debrief, …), the paulopus match-constellation shape — as **drafts** via the guarded ingest.
5. `review.requested` flows back on the feed; Jarvis surfaces "dossiers waiting on femfolk."
6. Human reviews and publishes in femfolk → `published` event → ariko references the piece → the weekly digest narrates the whole arc, idea to delivery, with zero reporting labor.

**Out of scope, seam reserved:** slicing the research production into a multi-agent workflow (routing/research/assessment/writer/editorialist subagents). The ingest contract does not care whether one routine or an orchestra produced the payload; it plugs in later without redesign.

## 9. Surface track

- **D1 — artistic direction** starts as a parallel design track: visual identity, the botanical cosmology as presentation language, the interactive graph playground (whose content the practice graph now supplies for free).
- **Cockpit** (post-D1): map rendering with brick health, triage, beanstalk, digest reading, dispatch confirmation.
- **Native iOS** after the cockpit: capture + review + Jarvis on the phone.
- Until then the spine ships UI-less; digests are readable in the unstyled admin. The zero-CSS/no-client-JS hold stays intact — it was protecting exactly this sequencing.
- **Jarvis conversational brick** comes last (Vercel AI / TanStack AI candidates; Gemini key reserved for the intent/thinking graph). Interim Jarvis: claude.ai / Claude Code over the arkaik remote MCP + ariko's APIs.

## 10. Sub-projects and ordering

Each gets its own spec → plan → implementation cycle:

1. **Botanical rename + practice graph** (ariko) — vocabulary in the bones; plant natures (work/tool); relations; projected-vs-authored rule; seed the map with all plants.
2. **Federation contract** — envelope schema + verbs as a small versioned spec in this repo.
3. **Arkaik adapter** — journal→envelope mapping; Lab-Note-into-journal webhook; retire ariko's lab-note workflow for arkaik-mapped repos.
4. **Ariko read model + beanstalk** — cursor-synced cache, projected beans, timeline rendering (unstyled).
5. **Weekly digest** — first synthesis brick; first engine decision.
6. **Melogram music feed** — the Arkaik-of-music duty; optionally arkaik-map melogram's dev side.
7. **Femfolk platformization + dispatch pilot** — hosting/store decision, intake, both APIs, guarded ingest, nightly researcher; first full initiate→report loop.
8. **Synthesis wave 2** — monthly review, milestone drafts, article seeds.
9. **D1 → cockpit → native iOS** — parallel design track from early on.
10. **Jarvis conversational brick** — over everything above.

1→5 is the shortest path to the pain point (overview + digest). 6→8 extend the federation. 9 runs in parallel, blocked by nothing.

## 11. Cross-cutting principles

- **Idempotency by construction**: append-only feeds, stable ids, cursor sync, write-once ingest filters, semantic dedupe. A missed run costs latency, never correctness.
- **Instructions version with the repo**: every routine's prompt is one line pointing at a repo-versioned ROUTINE.md; merging is deploying.
- **No silent loss**: refused ingests are logged and surfaced; deferred work reappears next run.
- **Privacy tiers**: teale (and any private kind) never crosses `filterPublic`; publishing is always a human act.
- **Testing**: pure logic (gates, mappings, projections) unit-tested per repo, paulopus/ariko style; adapters fixture-tested against recorded feed samples; ingest doors have `--validate-only` dry-runs.

## 12. Open decisions deferred to slices

- Engine (Claude routine vs Gemini Action) — per brick, at spec time (§2.6).
- Femfolk hosting/store — inside slice 7.
- Melogram dev-side arkaik-mapping — inside slice 6.
- Schema-rename mechanics (migration of `beanstalk` DB naming irony included) — inside slice 1.
- Mobile capture transport pre-iOS — inside slice 9's early phase.
- Exact envelope `kind` vocabulary — inside slice 2, seeded from §5.
