# Ariko Content & Composition — umbrella design

**Date:** 2026-08-22
**Status:** Approved umbrella design. Each sub-project (§8) gets its own spec → plan → implementation cycle; this document is the shared architecture they all answer to.
**Scope:** Making authored long-form content readable, giving every entity a standalone self-description, and letting a container's page compose live blocks from its children. Acceptance case: the finished Paulopus article set (§7).
**Roadmap:** this is Track B / **B3**, decomposed into three slices and widened — the roadmap entry covered rendering only.

---

## 1. Problem

`Sprout.content?: Text` has been in the model since the data spine, described in
`lib/data.ts:113` as *"optional rich markdown, localizable"*. **Nothing renders it.** There is no
markdown dependency in `package.json`, and the only surface that shows content at all is
`/admin/sprout/[slug]`, which prints it into a `<pre>` (`app/admin/sprout/[slug]/page.tsx:74`).

That gap is already costing something. Slice 5's weekly-digest bee writes markdown digests into
Mongo on a schedule (`lib/synthesis-store.ts:87`, 32 KiB per sprout), and nobody — not even the
author in the admin — can read them as prose. The digests are a machine writing into a drawer that
does not open.

Meanwhile a finished body of authored content is waiting outside the repo. The **Paulopus article
set** (`paulopus/content-ops/paulopus/`, merged as PR #28) is 13 markdown files: one five-drawer
narrative page, eight standalone ~1,100-word focus articles, four Substack adaptations, and 16
relative cross-links binding the narrative to the focuses. It cannot be published into Ariko today
for three independent reasons:

1. nothing renders `content`;
2. the only public per-entity URL is `/bean/[id]` — there is no plant or pod page, so the narrative
   page has nowhere to live;
3. `Bean` has **no `description` field at all** (slug, name, parents, visibility, tags, projected),
   so no entity below the pod tier can describe itself — which blocks preview cards, and also keeps
   `/api/graph` node payloads deliberately empty (`lib/graph.ts:35`: *"no description/content/media/
   source"*, pending exactly this slice).

This umbrella closes all three.

## 2. Decisions (settled during brainstorm, 2026-08-21 → 22)

1. **Markdown is the stored format, everywhere.** Not ProseMirror JSON, not HTML. Routines already
   emit markdown through the synthesis door, `/api/inbox` already accepts a markdown `content`, and
   markdown diffs in review. Any editor is a *surface over the format*, never the format itself.
2. **Entity blocks are a markdown directive, not a second format.** A block-level
   `::bean{ref=bean:<slug>}` (and an inline variant) keeps one wire format that both an agent and a
   rich editor can write. This is the reason the directive-capable remark ecosystem is the default
   candidate in §4.
3. **A container's narrative is authored; its blocks are live.** The Paulopus molecule was tested
   against the "pure roll-up" hypothesis and fails it: two of its five drawers (Context, Intention)
   compress no focus at all, and the three that do are argument with connective tissue
   (*"None of that grading means anything without trustworthy results…"*), not concatenated
   summaries. Prose is authored by a human; **card contents always resolve from the child at render
   time and are never copied into the parent.**
4. **Blocks resolve fail-closed.** A block whose target does not survive `filterPublic` renders as
   nothing on the public side. This is the rule `scrubRelations` already applies to `relations[]`,
   extended to content. It is a leak rule, not a polish rule: a preview card is a place where a
   hidden slug, name and synopsis could escape the projection.
5. **Embedded refs materialize into `relations[]` at write time.** A pure extractor runs on save;
   `/api/graph` and `filterPublic` keep reading stored refs. **The graph never parses prose.**
6. **Every tier carries its own self-description.** `description: Text` down to `Bean`. It is the
   same field the pollen envelope calls `summary` and the Lab Note contract calls `en.summary` — one
   short bilingual sentence by which a thing describes itself elsewhere.
7. **Narrative belongs to the tier; article bodies stay on sprouts.** Sprouts attach to beans only —
   every parent walk in `lib/data.ts` filters on `BEAN_PREFIX`, and `filterPublic` judges sprout
   parents against beans alone — so a plant- or pod-level narrative *structurally cannot* be a
   sprout and must be a field on the tier. Conversely a bean's article body stays a sprout, which
   makes a revised article a new sprout: the "evolution, not just the final state" north star,
   applied to writing.
8. **Paulopus is a plant with beans directly under it — no pod.** The molecule is the story of the
   *project*, which is the plant tier; the pod was the redundant one. Beans may parent straight to a
   plant already (`beansForPlant`, rendered by the Directory). The plant tier stays because
   federation is plant-anchored: `anchors.plant` is required (`docs/POLLEN.md:40`), `exhibit:` is a
   list of plant refs, and the digest roster buckets by plant. A project with no plant cannot report
   pollen, be exhibited, or be digested.
9. **Links today, cards later.** A markdown link is a degraded preview card, and the Paulopus
   cross-links already encode exactly the refs the blocks will use. The import ships after slice 2
   and gains cards at slice 3 by swapping link syntax for directive syntax — nothing gets rewritten,
   nothing gets re-decided.
10. **Tiptap is out of this umbrella.** It is the slice that follows, and it will be the first
    client-JS island in an admin zone whose stated constraint is zero client JS (`CLAUDE.md`). That
    constraint gets retired deliberately, by progressive enhancement over a `<textarea>` — not as a
    side effect of this work.

## 3. Architecture — three layers

1. **Render** — a pure, server-side markdown → HTML pipeline with sanitization, and the public
   surfaces that use it. Depends on nothing else here.
2. **Describe** — `description` on every tier, plus the cover convention, so any entity can be
   previewed by any other. Depends on nothing else here.
3. **Compose** — the entity directive, container pages that resolve blocks live and fail-closed, and
   the write-time mirroring of embedded refs into `relations[]`. Depends on both layers above.

Each layer is independently useful: 1 alone makes the weekly digests readable; 1 + 2 alone let the
Paulopus set publish as prose with links.

## 4. The render layer (slice 1)

**Feature floor**, set by the acceptance case rather than by taste — the Paulopus focuses use all of
it: headings, paragraphs, emphasis, links, lists, blockquotes, inline code, **fenced code blocks
with a language**, and **tables**.

**Untrusted by default.** Content arrives from scheduled routines today and from agentic tasks
tomorrow. Raw HTML never passes through; the renderer sanitizes, in both zones.

**No client JS.** The public zone is server-rendered; rendering happens at request time inside the
existing `force-dynamic` pages.

**Surfaces.**
- `/bean/[id]` renders the newest published sprout's `content` as prose, above the existing property
  dump rather than replacing it (the dump is the model's debug view and stays until the exhibition
  slice retires it deliberately).
- `/admin/sprout/[slug]` gains a rendered preview *beside* — not instead of — the existing `<pre>`
  source view. Round-tripping a routine's output is exactly when you want both.

**Dogfood, not paulopus.** Acceptance for this slice is *the weekly digests become readable*. It
lands with no Paulopus dependency whatsoever.

**Library choice is deferred to the slice spec** (§10), with the constraints fixed here:
server-only, sanitizing (bundled or paired), and **directive-extensible**, because slice 3 needs a
parser hook rather than a regex pass over prose.

## 5. The describe layer (slice 2)

**`description: Text` on `Bean`.** `Plant` and `Pod` already have it; this closes the tier. Text
means en-only is valid, so nothing needs backfilling in two languages.

**Cover, derived before declared.** A bean's cover is the first `MediaImage` in its newest published
sprout's `media[]` — derived, no new field, no authoring step, no migration. An explicit override
field is deferred to the slice spec and only if authoring actually demands it (YAGNI).

**Consumers, all of which get it for free:**
- preview cards (slice 3) — the reason the field exists;
- the Directory, which currently renders bare bean names as links;
- `/api/graph` node payloads, whose deliberate emptiness (`lib/graph.ts:35`) was explicitly pending
  this slice. Nodes gain `description`; the projection stays published-only, so the graph still
  cannot expose more than the public HTML.

## 6. The compose layer (slice 3)

**Grammar.** Block form `::bean{ref=bean:<slug>}`; the `ref` value reuses the prefixed-ref grammar
shared by `parents[]`, `relations[]` and graph node ids (`plant:` / `pod:` / `bean:` / `sprout:`), so
one vocabulary covers containment, relations, graph ids and now embeds. An inline mention variant is
specified in the slice spec.

**Resolution is server-side and cheap.** `getPublicDataset()` already loads the whole projected
garden in one pass, so resolving N cards is a map lookup, not N queries.

**Fail-closed rendering** (decision 4). Public: a block whose target did not survive the projection
renders as nothing. Admin: the same block renders visibly as an unresolved ref, because in the
authoring zone a dangling reference is information, not a leak. This mirrors the existing rule that
every read path tolerates dangling refs by design.

**Write-time mirroring** (decision 5). A pure `extractRefs(content)` runs on save and merges the
found refs into `relations[]` under a dedicated kind, so the graph and the projection keep reading
stored refs only.

**Container pages.** `/plant/[slug]` renders `plant.content` with blocks resolved, followed by a
**mechanical** index of its children. The Directory's plant cards start linking to it. Whether
`/pod/[slug]` ships in the same slice is deferred (§10).

**What stays mechanical, forever:** the Directory, the beanstalk, and a container's child index.
Those are aggregations with no argument to make, and they take no authoring.

## 7. Acceptance case — the Paulopus import

The import itself is a **content task, not an engineering one**, and lands after slice 2. It is
specified here because it is what the three slices are measured against.

**Target shape:**

```
plant:paulopus                       content = the 5 drawers (molecule.md)
  ├── bean:prediction-timelines      description = authored synopsis
  │     └── sprout (type: article)   content = the focus body
  ├── bean:match-anatomy
  └── … 6 more
```

**Frontmatter mapping.** `title` → `name`; `slug` → `slug`; the focus body → its sprout's `content`;
`molecule_drawer` and the molecule's `drawers[].compresses` → `relations[]` edges (already modelled
by G2, already scrubbed by `filterPublic`, already emitted by `/api/graph`); `sources` → dropped.

**The 16 cross-links.** Molecule → focus (10) become links at import and `::bean` blocks at slice 3.
Focus → molecule (6) become links to `/plant/paulopus#<drawer>`.

**Authoring work the import creates, and cannot avoid:** the eight focuses carry no synopsis in
frontmatter, so eight one-or-two-sentence `description`s must be **written**, not generated from the
opening paragraph.

**Explicitly out:** `substack/*.md` — a distribution layer, not a mirror of Ariko (its own spec says
so). It is not imported, in any state.

**Gate before publishing:** `content-ops/paulopus/verification-flags.json` records 8 flags. The
prose was since edited in paulopus `4ea4b3c` but the flags file was not updated, so neither file can
be trusted alone — re-read the flagged claims against the current prose first.

**Acceptance assertions:**

- the eight focus articles render as prose, with their tables and fenced code intact;
- `/plant/paulopus` renders the five drawers and lists its eight beans;
- every cross-link resolves to a real Ariko URL, and no relative `.md` path survives;
- un-publishing one focus makes its molecule reference vanish from the public page and its edge
  vanish from `/api/graph`, while the other seven are untouched;
- `/api/graph` shows the plant → bean containment and the molecule ↔ focus relations.

## 8. Sub-projects and ordering

Each gets its own spec → plan → implementation cycle:

1. **Render** (§4) — markdown pipeline + bean page + admin preview. *Acceptance: the weekly digests
   are readable.*
2. **Describe** (§5) — `description` on Bean, derived cover, Directory + graph payload. *Acceptance:
   every entity can be previewed by another.*
3. **Compose** (§6) — directive, container pages, fail-closed resolution, ref mirroring.
   *Acceptance: the Paulopus molecule renders as narrative + live cards.*

Then **the Paulopus import** (§7) as a content task — publishable after slice 2, richer after
slice 3.

**Out of this umbrella:** the Tiptap authoring surface (decision 10), with mentions and node views
over the same directive grammar. It is the natural next slice and is blocked by nothing here.

## 9. Cross-cutting principles

- **Format sovereignty.** Markdown in the database; every editor is a surface over it. A feature
  that cannot round-trip through markdown does not enter the model.
- **Fail-closed projection.** Nothing rendered may reveal what `filterPublic` hid — content blocks
  included. When in doubt, render nothing.
- **Purity.** Parsing, extracting and resolving are pure functions, unit-tested with no DB, per the
  house rule; only the glue is smoke-tested.
- **Untrusted content.** Sanitize at render, in both zones, regardless of who wrote it.
- **No silent loss.** An unresolvable ref is invisible in public and *visible* in admin.
- **Authored vs mechanical.** If a surface has an argument to make, a human writes it. If it does
  not, it is generated and takes no authoring.

## 10. Open decisions deferred to slices

- Markdown library + sanitizer pairing, against the §4 constraints — **slice 1**.
- Whether the bean page shows only the newest published sprout's content or all of them as an
  evolution list — **slice 1**.
- Explicit `cover` field vs derived-only — **slice 2**, and only if authoring demands it.
- Final directive spelling (`::bean{ref=…}` vs a generic `::entity{ref=…}`) and the inline mention
  form — **slice 3**.
- The `relations[]` kind used for mirrored embeds (a dedicated `embeds`, or reuse of an existing
  vocabulary word) — **slice 3**.
- Whether `/pod/[slug]` ships alongside `/plant/[slug]` — **slice 3**.
- Retiring the public bean page's property dump — the exhibition slice, not here.
- Tiptap and the admin client-JS constraint — the slice after this umbrella.
