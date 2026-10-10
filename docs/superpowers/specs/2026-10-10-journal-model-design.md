# The journal model — a bean has a narrative, a sprout is an entry

*2026-10-10*

## 0. The observation

The spine `Plant → Pod → Bean → Sprout` was founded on one idea: a sprout is a
version of a bean, and a bean's story is the list of its sprouts. A read of the
production garden on 2026-10-10 (12 plants, 21 pods, 103 beans, 128 sprouts)
shows the content stopped agreeing with that idea some time ago.

- **Sprouts mean three things.** Versions (teale's "Mindfulness POC / MVP / V2",
  three takes of "Damned Thoughts"); dated journal entries (41 `note`s, essays,
  decisions and releases written by the garden manifests); and **the bean's own
  article** — 17 `article` sprouts, each the sole `<slug>-0` child of a bean
  created for it, with the bean's title. The last is a bean with prose wearing a
  sprout costume, forced by the rule "a bean has no content".
- **The public bean page renders one sprout** (`articleFor`: newest published
  with a body). Every other sprout is invisible except as a line on
  `/beanstalk`. The journal has no reading surface; the narrative has no home.
- **The rich writing sits in the tier the model treats as a folder.** Pebbles
  has 11 pods carrying ~4k-word bilingual narratives, all private, and 42 beans
  of which 29 are empty stubs. 45 of 47 published sprouts have no body; 68
  sprouts with real writing are drafts.
- **`type` is a free string** with 11 values (`bla` among them); only `digest`
  and `article` carry behaviour.
- **Pollen never anchors a bean** (0 of 400 sampled), so the projected-bean
  mechanism meant to tie Arkaik's history to features has never fired.

The author's intent, stated in the design conversation, separates two kinds of
content the spine conflates: a **narrative** — the polished present state of a
thing, rewritten in place — and a **journal** — a dated record of work,
learnings, decisions and reflections, authored or fed.

## 1. The model

The spine survives. Two definitions change and one species gains a door.

| species | is | changes |
|---|---|---|
| Plant | a project | none |
| Pod | an optional coherent cluster of beans (an album, Pebbles' record flow, Oxymore's three products) | none |
| Bean | a **feature**, with one evolving narrative | gains `content` |
| Sprout | a **dated journal entry** about a plant and the things in it | re-anchored, closed `kind` |
| Seed | the inbox **and the idea pile** | gains a second door: grow into a bean |
| Screen, Pollen, Bee | unchanged | none |

### 1.1 Bean

```ts
type Bean = {
  // …as today…
  content?: Text; // the narrative: what it is now and how it got there
};
```

The narrative is one body, perpetually actualized — never versioned, never
appended. A demo, a prototype and a studio recording are *states* of one bean,
told in its narrative and dated by its journal. An instrumental, an unplugged
and a symphonic version are **sibling beans**. `/api/articles` and the garden
manifest stop refusing the key.

A bean's `visibility` becomes purely editorial. It is no longer flipped by its
sprouts in either direction (§2).

### 1.2 Sprout

```ts
type Sprout = {
  slug: string;
  name: Text;
  kind: SproutKind;            // replaces `type`
  date: string;                // YYYY-MM-DD, unchanged
  description: Text;
  about?: string[];            // "pod:…" / "bean:…" refs — the plant is DERIVED from them
  parents?: string[];          // one "plant:…" ref, ONLY when `about` is empty — typed as
                               // the other tiers' `parents`, held to one by the writer
  relations?: Relation[];      // unchanged: embeds/mentions mirrored from prose
  state?: SproutState;         // unchanged
  content?: Text; media?; links?; source?; tags?;  // unchanged
};
```

A sprout's plant is **derived, not stored**. `about` is a new typed field — not
a relation kind — because it is authored, validated and rendered as doors, while
`relations` is machine-mirrored from prose and scrubbed. Every `about` ref rolls
up to a plant (bean → pod → plant, bean → plant, pod → plant), and all of a
sprout's refs must roll up to the **same** plant or the action refuses. `parents`
is written only when `about` is empty: a plant-level entry with no feature to
hang on — the exception, not the rule. A sprout carries exactly one of the two,
never both, so there is no second source of truth to drift when a bean moves.
`resolveSproutPlant(sprout, garden)` in `lib/data.ts` is the one place that
spells the derivation; `filterPublic`, the timelines and the admin tables all
call it.

`kind` is a closed vocabulary in `lib/sprout-kind.ts`, which replaces
`lib/sprout-type.ts` and follows `lib/sprout-state.ts`'s pattern (named members,
`isSproutKind`, a display form in `lib/glyphs.ts`):

| kind | meaning |
|---|---|
| `log` | a dated note on work done — the default |
| `milestone` | a state reached: shipped, launched, demo recorded |
| `release` | a tagged version, usually mirrored from a feed |
| `essay` | a retrospective, a reflection, a learning |
| `decision` | a choice made, and why |
| `digest` | a machine-written weekly wrap |

Sub-species (retrospective, learning, experiment) are free `tags` on the sprout,
through `lib/bean-tags.ts`'s trimming rule generalized. The digest exemption in
`shouldCascadePublish` keys on `kind === "digest"`.

A sprout regains a public page.

### 1.3 Seed

Shape unchanged. `source` already separates a GitHub Lab Note from a manual
seed, and a manual seed is an idea. Promotion gains a second target: a seed may
grow into a **bean** (title → name, body → content, suggested
plant/pod → parents) as well as into a sprout. `promotedTo` records either ref.

## 2. Publishing

- Publishing a sprout makes **its plant** public. Nothing else — the beans and
  pods it is about are not flipped. The digest exemption stays.
- **The unpublish cascade is deleted.** A plant stays public once chosen; a bean
  with no published sprout is simply a bean. `unpublishCascade` and its tests
  go.
- `filterPublic` scrubs `about` refs to private entities exactly as it scrubs
  `relations`, fail-closed: a public sprout about a private bean shows the
  sprout and not the door. A sprout whose **derived** plant is private, or
  cannot be derived (every ref dangling), is dropped.
- Machine doors (`/api/articles`, `/api/synthesis`, `/api/pollen/sync`,
  `garden:plant`) still never publish; the garden rule in CLAUDE.md is
  unchanged.

## 3. Surfaces

### Public

- **`/plant/[slug]`**: head, links, screen strip, narrative (the pitch), then the
  pods and direct beans as covered doors, then **the journal**: this plant's
  published sprouts and its exhibited pollen merged newest-first by
  `mergeBeanstalk`, each line linking to `/sprout/[slug]` or the pollen source.
- **`/pod/[slug]`**: narrative, its beans as doors, the journal filtered to
  sprouts about this pod or about any bean inside it.
- **`/bean/[id]`**: narrative first, then the journal filtered to sprouts about
  it. `articleFor` and the one-article rendering are deleted. The related-beans
  rail stays — and when slice two deletes `narrativeFor`'s sprout fallback it
  must give the rail a date source of its own (the newest journal entry about
  each bean), because today the rail is dated by that fallback's sprout: with
  it gone every candidate is undated and the rail silently degrades to name
  order.
- **`/sprout/[slug]`** (new): kind badge, date, name, body with entity refs,
  media, links, and "about" doors. Progressively enhanced like every public
  page; added to `lib/server-safe-source.test.ts` the day it is written.
- **`/beanstalk`** keeps its all-plants, `?plant=` form; the badge now reads
  `kind`.

### Admin

- **Bean page** gains the prose editor the pod page already has, under the
  `?lang=` rule (`lib/edit-lang.ts`, `editorHalves`, `buildContentPatch` with a
  required `lang`). The Meta sheet is unchanged.
- **Sprout page**: the `type` popover becomes a `kind` popover drawn as native
  radios under the enum rule (Save disabled until the pick differs;
  `lib/sprout-hero-a11y.test.ts` pins it). A new **About** panel on the entity
  rail (`app/admin/_components/sprout-about-form.tsx`, mounted exactly as the
  Meta and Danger panels are) lists the plant's pods and beans as checkboxes,
  server-rendered by the page and handed down as a `ReactNode`, per the rail
  rule; it posts to `setSproutAboutAction`, which validates through
  `resolveAnchor` and writes through `updateSproutAnchor`. The sprout's plant
  is shown, not edited: moving a sprout between plants is not a slice-one
  feature.
- **Create sprout** asks for the plant first, then `about`, then kind.
- **Seed overlay**: a "Grow into a bean" action beside "Promote", posting to a
  new `promoteSeedToBeanAction` that writes through `createBean`.
- Tables: the sprout table's plant column reads `parents`, a new "about" count
  column; the four tier tables' glyphs for `kind` via `lib/glyphs.ts`.

### Doors

- **`/api/articles`** writes a bean with `content` directly, no companion sprout.
  A container narrative still goes to the pod or plant. In slice one
  `ArticleInput.date` stays accepted and validated but is recorded nowhere — a
  bean has no date — so an existing caller keeps working; slice two may turn it
  into a milestone entry in the bean's journal.
- **Garden manifest** (`lib/garden-manifest.ts`, `plugins/garden-plant/`):
  `bean.content` is accepted; a sprout names its `kind` (`type` is refused by
  name, and so is `kind: digest` — machine-written) and the applier writes a
  nested sprout as `about: ["bean:…"]`, never `parents`. Moving `sprouts` out of
  beans to a top-level list on the pod (or plant), each with its own
  `about: [slugs]` resolved against the same file, is **slice four**; until
  then nesting is the shorthand for one ref. Refused keys stay refused.
- **`/api/synthesis`** writes `kind: "digest"`; `/api/pollen/sync` unchanged.
  Mapping pollen `anchors.bean` to `about` is a later, separate decision.

## 4. Migration

One script, `scripts/migrate-journal.ts`, in **two phases over one read** —
phase one the article fold (step 2), phase two the re-anchor (steps 1 and 3)
— dry-run by default, run once against production after a `mongodump`. It is
idempotent: a sprout already carrying `kind` and no `type` is skipped. It
refuses to write while **either** phase has a refusal, because a half-migrated
garden — some sprouts on `kind`, some on `type` — renders two ways at once; so
the two operator pre-steps (step 1's rooting and step 4's deletion) gate the
fold as well as the re-anchor. Every rule is in `lib/journal-migration.ts`
with its own tests; the script applies two plans.

1. **Precondition.** Every sprout must resolve to exactly one plant through
   `bean → pod → plant` or `bean → plant`. The script lists the failures and
   refuses to write while any remain. Today that is the 25 krabs sprouts: the
   `krabs` pod has `parents: []`. **The author roots it in the admin before the
   migration runs**; the script does not guess.
2. **Article fold.** For each of the 17 `type: "article"` sprouts: copy
   `content` (both halves) into the bean's `content`, carry `relations` onto the
   bean, delete the sprout. If a bean already has content, refuse. The fold
   finds its sprouts by querying `type: "article"`, so it MUST run before step 3
   renames `type` to `kind` on the same database — run after, it reads zero
   articles, reports a clean "0 fold(s)", and leaves every article sprout in
   place with nothing failing.
3. **Re-anchor.** Every remaining sprout: `about = ["bean:<old parent>"]`,
   `parents` unset, `type` → `kind` by the table below, `type` unset. Step 1's
   resolution is what guarantees the derived plant exists afterwards.
4. **Delete** the one `type: "bla"` test sprout (`Tentative`) — **an operator
   act, in the admin, before the script runs.** An unknown `type` is refused
   by name with the remedy spelled out, never mapped to a default: the script
   retypes nothing it was not told how to, and a refusal here blocks the fold
   too (above).
5. **Leave alone** the 29 empty Pebbles stub beans and the three empty
   `digest-*` beans. Deleting content is editorial.

| old `type` | `kind` |
|---|---|
| note | log |
| milestone, feature, song, episode | milestone |
| release | release |
| essay | essay |
| decision | decision |
| digest | digest |
| article | folded (step 2); one reaching the re-anchor is a refusal |
| anything else | refused, by name — the operator retypes or deletes it |

The script does not call `revalidateGarden()` (no request store, per the
garden-plant rule); the deploy that ships it invalidates on first write.

## 5. Shape of the work

Four slices, each its own plan and PR, in this order so every intermediate
state renders:

1. **Bean narrative.** `Bean.content`, the admin bean editor, the public bean
   page reads `content` before falling back to `articleFor`. `/api/articles`
   and the manifest accept `content`. The article fold (migration step 2) ships
   here.
2. **The journal.** `kind` vocabulary, `about` with the derived plant, the sprout
   admin changes, `/sprout/[slug]`, the plant/pod/bean journals, cascade
   changes, `articleFor` deleted. Migration steps 1, 3, 4 ship here.
3. **Seeds grow into beans.** `promoteSeedToBeanAction` and the overlay action.
4. **Doors and plugin.** Manifest sprouts with `about`, `plugins/garden-plant/`
   skill text, `/api/synthesis` kind, Lab Note docs.

## 6. What the tests must pin

Each of these passes `tsc`, `npm test` and `npm run build` while silently false,
so each gets a source or behaviour test on the day it lands:

- A sprout action refuses `about` refs that roll up to two plants, and refuses
  a sprout carrying both `about` and `parents`.
- `resolveSproutPlant` follows bean → pod → plant and bean → plant, and a bean
  moved to another pod moves its sprouts with it (a behaviour test).
- `filterPublic` scrubs `about` to private refs and drops a sprout under a
  private plant.
- `publishCascade` flips the plant and **not** the beans in `about`.
- `kind` is validated against `lib/sprout-kind.ts`; a free string is refused.
- `/sprout/[slug]` is in `lib/server-safe-source.test.ts` (Part B, below).
- The migration refuses on an unrooted sprout and on a bean that already has
  content.
- A manifest sprout nested under a bean is written `about` that bean, never
  under it; the top-level `sprouts` list with its own `about` is slice four.

## Part B — the public surfaces

The plan that shipped this spec's model (`plans/2026-10-10-journal-model.md`)
is **Part A**: the vocabulary, `about` and the derived plant, the cascade
changes, the admin surfaces, the doors and the migration. The public zone
still renders what it did — the bean page through `narrativeFor` and
`sproutsForBean` (now by `about`), both beanstalks with `kind` — and a sprout
still has no page of its own. The §3 Public surfaces are the **next plan**:
`/sprout/[slug]` (added to `lib/server-safe-source.test.ts` the day it is
written), the plant, pod and bean journals, and deleting `articleFor` with
the related-beans rail given a date source of its own. The §3 Doors sentence
about top-level manifest sprouts and §6's nested-manifest refusal are slice
four.
- The garden manifest refuses a sprout nested under a bean (the old shape) with
  a message naming the new one.
