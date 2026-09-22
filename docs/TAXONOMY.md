# The Ariko taxonomy

Ariko is a personal central node: a vault of everything Alexis makes, and a
public projection of the part of it that is ready to be read. This document is
the reference for **what lives in that vault, what each thing means, and how
they hang from one another**.

It is descriptive, not aspirational — every rule below is one the code enforces
today, with the file that enforces it named. The type definitions are all in
[`lib/data.ts`](../lib/data.ts); this is the prose around them.

Three companion documents: [`README.md`](../README.md) for orientation and the
HTTP doors, [`CLAUDE.md`](../CLAUDE.md) for the rules that are easy to delete by
accident, [`POLLEN.md`](POLLEN.md) for the federation contract.

---

## 1. The shape, in one screen

```
                    ┌──────────────────────────────────────────┐
                    │  PLANT      the project itself           │  root tier
                    │  ariko · femfolk · bohns-music · arkaik  │  no parents
                    └───┬───────────────┬──────────────┬───────┘
      contains          │               │              │  contains
      ┌─────────────────┘               │              └─────────────┐
      ▼                                 ▼                            ▼
┌──────────────┐                 ┌──────────────┐            ┌──────────────┐
│  POD         │  contains       │  BEAN        │            │  SCREEN      │
│  a body of   │────────────────▶│  a unit of   │            │  one capture │
│  work        │                 │  work        │            │  of an app   │
│  an album,   │                 │  a song, a   │            │              │
│  a podcast,  │                 │  feature, an │            │  hangs from  │
│  a product   │                 │  episode     │            │  the PLANT,  │
└──────────────┘                 └──────┬───────┘            │  beside the  │
                                        │ contains           │  beans       │
       a bean may skip the pod tier     ▼                    └──────────────┘
       and hang straight off a   ┌──────────────┐
       plant                     │  SPROUT      │   the fundamental unit:
                                 │  a demo, a   │   one act of making, dated
                                 │  V2, a post, │
                                 │  a release   │   nothing hangs below it
                                 └──────────────┘

   ┌───────────────┐   ┌───────────────┐   ┌──────────────────────────────┐
   │  BEE          │   │  SEED         │   │  POLLEN                      │
   │  an operation │   │  an untriaged │   │  a foreign event, cached     │
   │  serving one  │   │  capture,     │   │  from a sibling repo's feed  │
   │  or more      │   │  not yet part │   │                              │
   │  plants       │   │  of the tree  │   │  not a species — a contract  │
   └───────────────┘   └───────────────┘   └──────────────────────────────┘
```

**The spine is four tiers: `Plant → Pod → Bean → Sprout`.** Read it as a
sentence: a *plant* is a project, a *pod* is a body of work inside it, a *bean*
is one unit of that work, and a *sprout* is one dated act of making on that
unit. The insight the whole model exists for is the last step — a bean
**evolves**: a song has a demo, a studio take and a live version; a feature has
a POC, an MVP and a V2. The portfolio tells the story of that evolution rather
than only its final state.

Three more species sit off to the side because they are not stages of that
story: a **screen** is an asset held as a thing, a **bee** is machinery, a
**seed** is raw material that has not been placed yet.

---

## 2. The grammar: `parents[]` versus `relations[]`

Every edge in the vault is a string in one prefixed grammar
(`lib/data.ts:342`):

```
plant:<slug>   pod:<slug>   bean:<slug>   sprout:<slug>   bee:<slug>
```

Slugs are `^[a-z0-9][a-z0-9-]*$`, unique per collection (a unique index per
collection, `ensureBotanicalIndexes` in [`lib/botanical.ts`](../lib/botanical.ts)),
and **immutable** — which is what lets them be node ids in the graph payload and
cursor keys everywhere else.

Two arrays carry edges, and the split is load-bearing rather than tidy:

| | `parents[]` | `relations[]` |
|---|---|---|
| means | **containment only** — "I am inside this" | everything else — "I point at this" |
| direction | child declares its container | the declaring entity points outward |
| shape | `string[]` of prefixed refs | `{ kind, ref }[]`, `kind` a free string |
| examples | `["bean:felina"]` | `{ kind: "evolves-from", ref: "sprout:felina-0" }` |
| drives | privacy cascades, timeline grouping, page trees | the graph's non-containment edges, entity cards |
| may point at | `plant:` `pod:` `bean:` only | any prefix, including `sprout:` |

Nothing is ever contained *by* a sprout or a bee: containment stops at the
sprout, which is why `sprout:` and `bee:` appear only in `relations[]` and as
graph node ids.

**There is no referential integrity, by design.** A dangling ref — one whose
target does not exist — is ignored everywhere rather than being an error:
`buildDataset` skips it, `filterPublic` ignores it when deciding a cascade, and
`resolveLineage` drops it. This is what makes deleting an entity safe without a
cleanup pass, and it is what lets the public projection *be* the privacy
mechanism: in the public zone, a ref you cannot resolve is a ref to something
you are not allowed to see, and those two are deliberately indistinguishable.

Relation kinds in use today: `embeds` and `mentions` (derived from prose entity
refs, re-derived on every write — see §5), plus the hand-authored articulation
vocabulary between plants: `distributes`, `chronicles`, `uses`, `publishes-to`,
`monitors`.

---

## 3. The species

### 3.1 Plant — the project

The root tier. Plants carry no parents; everything else parents *into* them.

| field | rule |
|---|---|
| `slug` | unique, immutable |
| `name` | `Text` — a string, or `{ en?, fr? }` |
| `natures[]` | `work \| tool`. An **array**, because melogram is both |
| `role` | **required** — what Alexis *is* to it |
| `status` | `active \| inactive`; absent ⇒ `active` |
| `logo` | ONE `MediaImage`, not an array |
| `links[]` | `PlatformLink[]` — where the plant is found elsewhere |
| `description` | required, one line |
| `content` | optional markdown narrative — the plant's own page |
| `visibility` | `private \| public`; absent ⇒ public |
| `relations[]`, `tags[]` | as §2 |

Two field-level decisions worth knowing, because they point in opposite
directions on purpose:

- **`role` is required.** A plant is by definition something Alexis has a
  relationship with, so there is no "unclassified plant" to default for. It is
  `{ kind, title?, detail? }` where `kind` is the four-value vocabulary
  `owner | co-owner | lead | contributor` (the spine: badges, the admin column),
  `title` is the real local job title rendered *beside* the enum label rather
  than replacing it, and `detail` is one line of context that is never markdown.
  There is no such thing as a private role: if the plant is public, all of this
  is. ([`lib/plant-role.ts`](../lib/plant-role.ts))
- **`status` is default-tolerant.** An unmarked plant is a plant still being
  worked on, which is a *true* reading of absence rather than a convenient one —
  so `status ?? "active"` is a promise the database keeps, and no backfill was
  needed. ([`lib/plant-status.ts`](../lib/plant-status.ts))

`logo` is one image rather than `Media[]` because a plant has one mark, and an
array would make "the first entry is the logo" a rule enforced nowhere — while
admitting a SoundCloud player into a field that is a square image by definition.
`links[]` is deliberately not `media[]`: a "Listen on Apple Podcasts" URL is a
*destination*, not an asset rendered in a body, and its `platform` is derived
server-side from the URL host ([`lib/platforms.ts`](../lib/platforms.ts)) rather
than trusted from the payload.

### 3.2 Pod — the body of work

An album, a podcast, a product line. `parents[]` holds `plant:` refs only.

Same field set as a plant minus the plant-specific ones: `name`, `description`
(required), optional `content` narrative, `visibility` (default public),
`relations[]`, `tags[]`.

A pod with no resolvable plant parent is **unrooted** — not an error, a state.
`Dataset.unrootedPods()` returns them and the landing page groups them under
their own heading.

The retired `domain` field (`music | design | podcast`) is gone; the
re-tiering transform in [`lib/retier.ts`](../lib/retier.ts) strips it from any
document that still carries it. Plants replaced what it was doing.

### 3.3 Bean — the unit of work

A song, a feature, an episode, an article. **The pivot of the whole model**:
it is what a visitor lands on, what the cover art belongs to, and what the
sprouts beneath it are versions *of*.

`parents[]` may hold `pod:` refs **and/or** `plant:` refs — a bean may skip the
pod tier entirely and hang straight off a plant. A bean with neither resolvable
is **standalone** (`Dataset.standaloneBeans()`), the bean-level twin of an
unrooted pod.

| field | rule |
|---|---|
| `description` | **optional** — every bean predates the field; pods and plants require theirs |
| `visibility` | default public; **the one enum that cascades in neither direction** |
| `cover` | an explicit `MediaImage`, overriding the derivation in §5 |
| `keyword` | the one bilingual word the cover wears — "Timeline", "Karma" |
| `tags[]` | the garden's filters compare with `===` and do not trim, hence [`lib/bean-tags.ts`](../lib/bean-tags.ts) |
| `projected` | present ⇒ the bean was machine-created from a pollen feed (§6) |

**A bean has no `content`.** Only `Pod.content` and `Plant.content` exist. A
bean's prose is a *sprout* under it — which is how the timeline orders it, how
the publish cascade finds it, and how it gets a date. The garden manifest
validator refuses a `content` key on a bean **by name**, because it would
otherwise parse, write nothing, and lose the author's paragraphs in silence
([`lib/garden-manifest.ts`](../lib/garden-manifest.ts)).

`keyword` is drawn only on the phone treatment ([`lib/bean-cover.ts`](../lib/bean-cover.ts)):
a word floating over a photograph is a different design, and the same word on a
pod card would name the wrong thing, so a pod borrowing a bean's cover takes the
artwork without the word.

### 3.4 Sprout — the act of making

The fundamental unit. One dated thing that happened to a bean.

| field | rule |
|---|---|
| `type` | **free string**, not an enum — `song`, `feature`, `episode`, `milestone`, `article`, `digest`, … |
| `date` | `YYYY-MM-DD`, validated by shape ([`lib/sprout-date.ts`](../lib/sprout-date.ts)) |
| `state` | `draft \| private \| published`; **absent ⇒ not published** |
| `parents[]` | `bean:` refs only |
| `content` | optional markdown, bilingual |
| `media[]` | assets rendered in the body: `MediaImage` or `MediaEmbed` |
| `links[]` | destinations, never framed inline |
| `source` | provenance: `{ kind, url?, externalId?, capturedAt? }` |
| `[key: string]` | flexible per-type properties |

`type` has no vocabulary, and that is deliberate — but it still goes through a
shape module ([`lib/sprout-type.ts`](../lib/sprout-type.ts)) that rejects
surrounding whitespace as well as blankness. Three places compare `type` against
a bare literal and none of them trims, so a stored `"digest "` draws identically
to `"digest"` everywhere and is exempt from none of the three. That is the
argument for a module for a field with no vocabulary: **the shape is
load-bearing even when the value is free-form.**

Two types carry behaviour:

- **`digest`** — a weekly narration, written by machine (§6). Publishing one
  marks review sign-off, not public exhibition, so it is the single exemption
  from the upward publish cascade
  ([`lib/sprout-edit.ts`](../lib/sprout-edit.ts)) and it is excluded from its own
  bucketing so the digest never narrates itself.
- **`article`** — what `POST /api/articles` writes.

### 3.5 Screen — one captured view

A screenshot of an app, held as a **thing** rather than as an asset hanging off
something else. The species exists because neither place an image could already
live is a library: `Sprout.media[]` holds assets rendered in that sprout's body,
and `Bean.cover` holds one image for one bean.

`parents[]` holds `plant:` refs only — a screen sits *beside* the beans, one
tier below the plant, not under them.

| field | rule |
|---|---|
| `image` | **required** — the one field that cannot be cleared |
| `name`, `legend` | bilingual; the legend is blank on import and written later |
| `exhibited` | the editorial opt-in: membership of the plant's public strip |
| `order` | position in the strip, renormalized to `0..n-1` on every write |
| `capturedAt` | ISO date of the capture run |

**The strip requires two facts, enforced in two places.** `filterPublic`
enforces privacy; `Dataset.exhibitionForPlant` enforces the editorial opt-in;
**neither re-checks the other's**. Collapsing them into one boolean would put a
screen on a plant page because it was public, without anyone having said it
belonged there. In the other direction, `writeExhibition`
([`lib/exhibition.ts`](../lib/exhibition.ts)) writes `visibility: "public"`
beside `exhibited: true` and reverses both on withdrawal, because a screen is
private at birth and an author flipping them separately would produce, as the
commonest mistake, a screen marked for a strip it cannot appear on.

`image` is a `MediaImage` rather than a bare URL because the phone/landscape
treatment is decided from `height > width` — an image that cannot state its own
shape is silently drawn as something else.

### 3.6 Bee — the machinery

Operational species: integration bricks, **not content**. An adapter that emits
pollen, a routine that runs weekly, a workflow, a capability.

| field | rule |
|---|---|
| `kind` | `adapter \| routine \| workflow \| capability` |
| `status` | `planned \| live \| paused \| broken` |
| `engine`, `schedule` | free strings — `claude-routine`, a cron line |
| `levers[]` | `{ label, url?, ref? }` — the handles that operate it |
| `serves[]` | `plant:` refs |
| `visibility` | **default PRIVATE** — the opposite of every content tier |

Bees sit **outside the cascades entirely**: only an explicit
`visibility: "public"` survives `filterPublic`, and each survivor's `serves[]`
is scrubbed to plants that also survived, so an operational document can never
leak a hidden plant slug. Nothing renders a bee today except the graph endpoint —
the species exists so the map shows the future before it runs.

### 3.7 Seed — the untriaged capture

A seed is **pre-taxonomic**: raw inbox material kept deliberately outside the
botanical model until a human places it.

It is the one species that is **not slug-addressable** — it has an `id`
(`crypto.randomUUID()`), because a seed has not earned a name yet.

| field | rule |
|---|---|
| `title`, `body`, `content`, `media[]` | the capture itself |
| `source` | `{ kind, url?, externalId?, capturedAt? }` — `externalId` is the dedup key |
| `suggested` | a hint, never a commitment: `{ plantSlug?, podSlug?, beanSlug?, type?, tags? }` |
| `status` | `inbox \| promoted \| discarded` |
| `promotedTo[]` | sprout slugs — empty until triage |

Seeds never reach the public zone by any route: `filterPublic` does not so much
as see them, because they are not part of `RawGarden`. Triage
(`/admin/triage/[id]`) is where a seed becomes a sprout, optionally creating the
bean above it in the same act ([`lib/promote.ts`](../lib/promote.ts)).

Re-posting a seed with the same `source.externalId` **updates it in place** — a
partial unique index makes that safe while letting manual seeds collide on
nothing ([`lib/seeds.ts`](../lib/seeds.ts)).

### 3.8 Pollen — not a species, a contract

Pollen is what sibling projects *say about themselves*. Ariko aggregates;
sources stay sovereign. An envelope is one event, versioned `v: 1`, normatively
specified in [`POLLEN.md`](POLLEN.md) and validated by
[`lib/pollen.ts`](../lib/pollen.ts).

It touches the taxonomy at exactly two points:

1. **`anchors`** — `{ plant (required), pod?, bean? }`, in the same prefixed ref
   grammar §2 defines. A dangling anchor is the reader's problem, ignored
   fail-closed, never a schema error.
2. **Projected beans** — an envelope carrying a `bean:` anchor whose slug does
   not exist yet materializes a read-only, rebuildable bean carrying
   `projected: { source, feedId, firstPollenId }`
   ([`lib/projected-beans.ts`](../lib/projected-beans.ts)). Authored-or-prior
   always wins; a `"private"` envelope is binding fail-closed and cannot
   materialize a publicly reachable bean even on an exhibited plant.

Envelopes are cached in their own collections (`pollen`, `pollen_cursors`,
`pollen_refusals`) and are never merged into the garden. They appear on the
public beanstalk only when three facts hold, checked in order: the envelope is
not private, the plant is exhibited in [`data/federation.yml`](../data/federation.yml),
and the plant survives `filterPublic` ([`lib/beanstalk.ts`](../lib/beanstalk.ts)).

---

## 4. Visibility: two vocabularies, three cascades

This is the part of the taxonomy that is a **security boundary**, so it is
written as rules rather than as behaviour.

### The two vocabularies

| species | field | absent means | direction of the default |
|---|---|---|---|
| Plant, Pod, Bean, Screen | `visibility: private \| public` | **public** | open, cascade-protected |
| Sprout | `state: draft \| private \| published` | **not published** | closed |
| Bee | `visibility` | **private** | closed, cascade-exempt |
| Seed | — | never public | outside the model |

A sprout is the only tier with a three-value state, because it is the only tier
where "written but not for anyone" and "not finished" are different things.

### Cascade 1 — downward, at read time: `filterPublic`

Every public read passes through `filterPublic` ([`lib/data.ts:546`](../lib/data.ts)).
It is pure, unit-tested, and it is *the* projection — there is no second copy of
any of its checks anywhere.

```
plant private  ──▶ its pods drop ──▶ their beans drop ──▶ their sprouts drop
                                                    └──▶ its screens drop
```

Precisely:

- a **sprout** survives only when `state === "published"`;
- a **plant / pod / bean / screen** survives unless explicitly `private`;
- privacy **cascades downward, fail-closed**: an entity whose every *existing*
  parent was filtered out is dropped. A kept parent in **either** tier shelters
  a bean (a bean parented to both a pod and a plant needs only one of them).
- **dangling parents are ignored**, so standalone-by-dangling items survive —
  matching `buildDataset`, so the two never disagree about what is standalone;
- every survivor's `relations[]` is **scrubbed** to refs whose target also
  survived. Draft, private, cascaded-out, dangling *and* unknown-prefix targets
  all drop, so a hidden slug cannot leak through a property dump or the graph
  endpoint;
- **bees** take none of this: explicit `public` only, `serves[]` scrubbed.

Two absences are conclusions rather than oversights, and the code says so:
`PlantRole` and `PlatformLink` get no scrub because neither contains an entity
ref, and `refSurvives` grows no `screen:` branch because nothing points *at* a
screen yet — a relation naming one drops as an unknown prefix, which is the
fail-closed direction.

### Cascade 2 — upward, at write time: `publishCascade`

The mirror image. Publishing a sprout makes its bean parents public, their pod
parents public, and those pods' plants public — so **a published sprout never
dangles under a private parent**.

```
publish sprout ──▶ bean(s) public ──▶ pod(s) public ──▶ plant(s) public
                        └──────────── direct plant parents ─────┘
```

It is pure and idempotent (it never consults current visibility), it ignores
dangling refs exactly as `filterPublic` does, and it has **one exemption**:
a `digest` sprout does not cascade, because digest beans and plants are curated
private containers and publishing one is review sign-off, not exhibition.

### Cascade 3 — downward recompute, at write time: `unpublishCascade`

Un-publishing or deleting a sprout runs the inverse: a bean with no published
sprout left flips private, a pod with no surviving public bean flips private, a
plant with no surviving public pod **or** direct bean flips private. "Sheltered"
is the operative word — a single surviving public child keeps a parent public.

Callers that still have the sprout adapt through `unpublishCascade`; callers
that no longer do (a delete) capture the bean parents *before* the write and
evaluate `unpublishCascadeForBeans` against the post-write dataset.

### The two rules that are not cascades

- **Bean `visibility` cascades in neither direction.** Downward privacy is
  already a read-time projection, so going private needs no write beneath; going
  public must not republish sprouts that were held back on their own terms.
- **Exhibiting and publishing are one act** for screens (§3.5), and the
  renumbering half of the write is filtered on `exhibited: true` — a reorder
  computed against a stale strip would republish a screen someone had just
  withdrawn.

### Where the cascades are read from matters

The garden has two readers, and which one a caller imports is a privacy
decision: `loadRawGarden` ([`lib/store.ts`](../lib/store.ts)) is live;
`loadCachedGarden` ([`lib/garden-cache.ts`](../lib/garden-cache.ts)) is behind
Next's Data Cache under the `garden` tag. **Every server action reads live**,
because it re-reads after writing so the cascade sees the just-saved state — a
cached read there computes the cascade against the pre-write garden and produces
a published sprout whose bean silently stays private.

---

## 5. What the model derives rather than stores

A large part of the taxonomy is *computed* from the four tiers. Each derivation
lives in exactly one file, and the reason it is worth knowing is that each one is
a question two pages could otherwise answer differently.

| derivation | rule | where |
|---|---|---|
| **A bean's plant** | a direct `plant:` parent wins; otherwise the first resolvable pod's first plant | `Dataset.plantForBean` |
| **A bean's cover** | explicit `Bean.cover` wins; otherwise the first `MediaImage` in the first sprout that has one (newest-first) | [`lib/bean-cover.ts`](../lib/bean-cover.ts) over [`lib/cover.ts`](../lib/cover.ts) |
| **A bean's article** | the first sprout carrying non-blank `content`, newest-first — *not* strictly the newest sprout, so a text-only changelog entry does not cost a bean the cover and prose its last release earned | [`lib/article.ts`](../lib/article.ts) |
| **A pod's cover** | borrowed from its first bean that can offer one — the artwork, never the `keyword` | `podCoverFrom` |
| **A plant's bean set** | beans parented directly to the plant **plus** the beans of each of its pods, deduped | [`lib/plant-hub.ts`](../lib/plant-hub.ts) |
| **The timeline** | every sprout with its bean and that bean's plant, newest first | `Dataset.timelineSprouts` |
| **The beanstalk** | the timeline **unioned with exhibited pollen**, newest first by date part, authored material winning ties | [`lib/beanstalk.ts`](../lib/beanstalk.ts) |
| **Lineage** | the climb from an entity to its plant, rendered as the parenting chrome; the garden is a *parameter*, never loaded inside | [`lib/lineage.ts`](../lib/lineage.ts) |
| **Related beans** | pod siblings first, topped up from the plant, never a bean with nothing written under it | [`lib/related-beans.ts`](../lib/related-beans.ts) |
| **The exhibition strip** | screens with `exhibited === true`, sorted once, `order` absent ⇒ last | `Dataset.exhibitionForPlant` |
| **Entity refs in prose** | `::entity{ref=bean:karma}` (block) and `:entity[label]{ref=plant:paulopus}` (inline) are extracted at **write** time and mirrored into `relations[]` under the kinds `embeds` / `mentions` — derived state, re-derived on every write, so the graph reads stored refs and never parses prose | [`lib/entity-refs.ts`](../lib/entity-refs.ts) |
| **The graph** | every species becomes a node (`kind:slug`); containment becomes `contains` edges, relations become their own kinds, a bee's `serves[]` becomes `serves` | [`lib/graph.ts`](../lib/graph.ts) |

Two of these earn a note. `articleFor` and `coverFor` deliberately **do not
re-check state** — the public page hands them a `filterPublic`-projected dataset,
so "published" is already enforced upstream: one projection, one place. And the
rollup in `plant-hub.ts` exists so a plant's hub and its scoped section **report
the same count because they call the same function**, not because two pieces of
arithmetic happen to agree.

---

## 6. How things come into existence

Nine doors, and the taxonomy is partly *defined* by which of them may publish.
**None of the machine doors can.** Publishing is always a human act in the admin.

| door | writes | may publish? |
|---|---|---|
| The admin editors (`/admin/plant/[slug]`, `/pod/…`, `/bean/…`, `/sprout/…`, `/screens/…`) | every species, every field | **yes** — this is the only place |
| `/admin/triage/[id]` | a seed → a sprout, optionally creating its bean | yes, via the enum rule |
| `POST /api/inbox` | a **seed** (dedup on `source.externalId`) | no — seeds are never public |
| `POST /api/articles` | a **private bean** per article + a **state-less (draft) sprout** under it, plus an optional container narrative | no — `state` is refused on the raw object, whatever its value |
| `POST /api/synthesis` | `digest`-type draft sprouts under curated `digest-*` / `weekly-wrap` beans that must already exist | no |
| `POST /api/pollen/sync` | pollen docs, cursors, refusals — and **projected beans** | no — an envelope's `"public"` is a hint, `"private"` is binding |
| `npm run garden:plant` | a pod, its beans and their sprouts, from a sibling repo's `garden.yml` | **no, by refusal** — `visibility`, `state`, `exhibited` and `order` are *refused* keys, not ignored ones |
| `npm run migrate` | the whole garden from [`data/garden.yml`](../data/garden.yml) | seed data, as authored |
| `npm run import:screens` / `import:casa` | screens and media, skipping what already exists | no — screens are private at birth |

Two properties of that table are the design rather than a coincidence:

- **Machine-written material is private and draft by construction**, so review is
  a gate rather than a cleanup. `/api/articles` and `/api/synthesis` both refuse
  to overwrite a sprout that already has a `state` — the reviewed work is safe
  from a re-post, and a human publish landing mid-batch makes the write collide
  loudly on the unique slug index instead of silently clobbering.
- **There is no HTTP door for planting a project.** A sibling agent writes a
  `garden.yml` and stops; the credential never leaves this repo and the write is
  a human decision made while looking at a diff. `lib/garden-manifest.ts`
  validates the *whole* file before a single write, because a pod that exists
  with three of its five beans missing is a worse state than an untouched garden.

---

## 7. Where each species surfaces

| species | public zone | admin zone | API |
|---|---|---|---|
| **Plant** | `/` (grouped by status), `/plant/[slug]` — role badge, natures, narrative, links, screen strip, index of contents | `/admin/plant/[slug]` + `/narrative`, the chrome's plant switcher, the scope of every section | `/api/graph` |
| **Pod** | `/` , `/pod/[slug]` — name, description, narrative, its beans | `/admin/pods`, `/admin/pod/[slug]` | `/api/graph` |
| **Bean** | `/` (cards with covers), `/bean/[id]` — name, description, **its article**, a related-beans rail | `/admin/beans`, `/admin/bean/[id]` | `/api/graph` |
| **Sprout** | **no page of its own** — a sprout reaches a visitor as its bean's article, or as a line on `/beanstalk` | `/admin/sprouts`, `/admin/sprout/[slug]` | `/api/graph` |
| **Screen** | the strip on `/plant/[slug]` | `/admin/screens`, `/admin/screens/[slug]` (+ intercepted sheet), `/admin/screens/new` | — |
| **Bee** | — | — | `/api/graph` (public only when explicitly public) |
| **Seed** | never | `/admin/inbox`, `/admin/triage/[id]` | `POST /api/inbox` |
| **Pollen** | lines on `/beanstalk`, when exhibited | — | `POST /api/pollen/sync` |

The sprout row is the one that surprises people. It is correct: the sprout is
the unit of *work*, not the unit of *reading*. A visitor reads a bean, and the
bean's newest sprout carrying prose is what they read there. The per-sprout
property dump that used to exist on `/bean/[id]` was retired deliberately — and
it took the sprout's `media[]` and `links[]` with it, so those leave the public
site entirely rather than moving somewhere else.

---

## 8. What the taxonomy refuses

Stated positively, because each of these is a thing someone will reasonably
propose, and each has an answer:

- **Nothing is contained by a sprout.** Containment stops at the fourth tier. If
  a sprout needs to point at something, that is `relations[]`.
- **A bean has no prose of its own.** Its prose is a sprout, which is how it gets
  a date, a place in the timeline, and a state.
- **A screen is not under a bean.** It hangs from the plant, beside the beans,
  because it is a capture of the *product*, not a version of a unit of work.
- **A pod is never projected from a feed.** Projected beans exist; a dangling pod
  anchor is ignored fail-closed.
- **An event concerning two plants is two envelopes.** One anchor set per pollen
  envelope, no exceptions.
- **A slug may not be reused across species in one manifest.** Mongo would allow
  a pod and a bean both called `krabs` — separate unique indexes — but a reader
  would not: a manifest is prose plus references, and a bare mention of a name
  two entities answer to is ambiguous to whoever edits the file next.
- **No enum is written by the click that opens it.** A plant's `status` and
  `visibility`, a sprout's `state` and a bean's `visibility` each open as a list
  of native radios with a Save button disabled until the pick differs from what
  is stored. A one-click flip was the first shape tried and the wrong one: a
  stray click on the globe unpublishes a project, and the undo is another stray
  click on the same pixel.

---

*Types: [`lib/data.ts`](../lib/data.ts). Projection and cascades: same file,
`filterPublic` / `publishCascade` / `unpublishCascade`. Slice histories:
[`superpowers/specs/`](superpowers/specs/).*
