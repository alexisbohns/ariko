# The bean page, edited

*2026-09-13*

`/admin/bean/[id]` is the last entity page still shaped like the POC: a `<h1>`,
a five-row property dump, two cover cards bolted on by the phone-covers slice,
and a list of `<Card>`s headed **Versions** — a word that appears nowhere else
in the garden's vocabulary. The plant and the sprout have both been through the
harmonisation the rulebook describes; the bean has not, and an author moving
from a sprout to its bean loses every gesture they just learned.

This slice gives the bean the same head, the same rail and the same table its
siblings have, and makes four of its fields writable from that head.

## What the page becomes

```
LineageChrome (unchanged — pod / plant above)
EntityRail  ┐
  PlantHeader, MARKLESS
    h1  → name, a sheet trigger for name + description (en/fr)
    facts → 👁 visibility   💬 keyword   🏷 tags
  Sprouts (n)
    SproutTable
  rail panels → Cover
```

### The head is markless

`PlantHeader` with no `mark`, exactly as `SproutHero` renders it. A bean HAS a
cover, so this is a real decision rather than an absence: the cover is not a
mark — it is portrait phone art or a landscape screenshot, and a squircle crop
of it is a picture of neither. `components/plant-header.tsx`'s prop comment
already draws this line ("absent is a statement about the entity, never a mark
that failed to load"), and the bean is the second entity to make that statement.
The cover keeps a full-width panel on the rail, where its real aspect survives.

### `BeanHero`, a third copy rather than an abstraction

`app/admin/_components/bean-hero.tsx`, built beat for beat from
`sprout-hero.tsx`: the same `Surface` union, the same `saved` fingerprint that
closes a surface only when a write actually landed, the same `?form=`/`?error=`
reopen, the same `close()` that drops both params with `replaceState`.

This is a third copy of that state machine and the cost is real. The rejected
alternative is generalising `SproutHero` into an `EntityHero` taking an array of
facts — which turns two files a reader can hold in their head into one
indirection layer, and would have to be done *while* changing behaviour on a
page that has never had a write path. The copy ships; a fourth caller is what
would justify the abstraction, and it can be made from three examples rather
than two.

### What each fact posts

| fact | kind | module | write |
|---|---|---|---|
| `visibility` | **vocabulary** | `lib/plant-visibility.ts`, widened | `setBeanVisibilityAction` |
| `keyword` | bilingual free text | `lib/bean-keyword.ts` (exists) | `editBeanKeywordAction` (exists) |
| `tags` | free text list | `lib/bean-tags.ts` (**new**) | `editBeanTagsAction` (**new**) |
| name + description | bilingual free text | `lib/bean-meta.ts` (**new**) | `editBeanMetaAction` (**new**) |

**`visibility` gets the full guard** CLAUDE.md names for an enum: the icon opens
the vocabulary as native radios, and Save is disabled until the pick differs
from what is stored, so the second click is a confirmation rather than a
formality. `lib/plant-visibility.ts` is `Plant`-typed but structurally
identical, so `visibilityOf` widens to `Pick<Bean | Plant, "visibility">` and
`PLANT_VISIBILITIES` is re-exported unchanged. "Absent ⇒ public" is one rule and
a second module holding a second copy of it is a rule that drifts. The constant
keeps its name: renaming it to `VISIBILITIES` would touch every plant call site
for no gain this slice needs.

A bean's visibility does NOT cascade. `updateBeanVisibility` flips one document
and touches nothing above or below it, for `updatePlantVisibility`'s reasons
verbatim: downward privacy is a read-time projection in `filterPublic`, and
going public must not silently republish sprouts that were held back on their
own terms. The radio hints say so on screen.

**`keyword` keeps its server-computed note.** The existing "this cover isn't
phone-shaped, so the word won't be drawn — it shows only on a portrait cover"
line moves into the keyword popover, still derived by
`beanCoverFor(bean, [])?.kind !== "phone"` on the server and handed down as a
boolean prop. The island learns the rule's RESULT, never the rule.

**`tags` invents the shape this admin has never had.** One comma-separated text
input, parsed by a new `lib/bean-tags.ts`:

```ts
export function parseBeanTags(raw: string): string[]
```

Splits on `,`, trims each part, drops blanks, dedupes preserving first-seen
order, and returns `[]` for an empty field — which the patch turns into a clear.
Pure, client-safe (imports nothing), and a module rather than four lines inline
for `lib/sprout-type.ts`'s exact reason: `lib/sprouts.ts`'s tag filter compares
with `===` and does not trim, so a stored `" ariko"` draws identically to
`"ariko"` in every badge and matches nothing at all. The shape is load-bearing
even though the vocabulary is open.

Dedupe is case-SENSITIVE. Nothing in the garden lowercases a tag on read, so
`Ariko` and `ariko` are two different filter keys today; folding them here would
silently delete one of a pair the rest of the system still distinguishes.

**name + description** mirrors `lib/plant-meta.ts` minus its `status` third:

```ts
export interface BeanMetaPatch { name: Text; description: Text | null }
export class BlankBeanNameError extends Error {}
export function buildBeanMetaPatch(form: FormData): BeanMetaPatch
```

`null` means clear, and throwing on a blank name is `buildPlantMetaPatch`'s
stance for its reason: a nameless bean is a public claim the site would render
as though it were authored. No hidden `status` field to carry — a bean has no
status — so the trap `buildPlantMetaPatch` guards against does not exist here.

### Projected beans stay read-only

Today the page hides the two cover cards behind `!bean.projected`, and
`editBeanCoverAction` / `editBeanKeywordAction` each re-check server-side
because a rendered gate is not a guarantee. Every new surface inherits both
halves: `BeanHero` takes `readOnly` and renders its facts as plain words with no
triggers and its title as plain text with no sheet, and each of the three new
actions redirects back untouched on `existing.projected`. The existing Alert
explaining why stays where it is.

### Sprouts, as a table

`Versions (n)` becomes `Sprouts (n)`, and the `<Card>` stack becomes the
`SproutTable` every other sprout listing in the admin already draws.
`beanDetail` returns `Sprout[]` and the table takes `TimelineEntry[]`, so the
page composes the entries — `{ sprout, bean, plant }`, both parents already in
hand from the same view model. The plant comes from `raw`, looked up by the
slug `beanDetail` already resolves.

`SproutTable` grows a `showBean` prop mirroring `showPlant`, with the same
meaning and the same default (`true`): a column whose value is constant on the
page drawing it is a column that says nothing. The bean page passes
`showPlant={false} showBean={false}` — the plant is in the lineage chrome above
and the bean is the page.

The per-sprout scalar dump goes with the cards. It was a debugging surface, and
the sprout's own page is four columns away.

### The rail

`EntityRail` with one item: **Cover**, the existing `BeanCoverForm` unchanged.
One panel is enough to earn the rail — the shell is what makes the bean page
navigate like the sprout page — and the cover is exactly the kind of thing the
rail exists for: a wide visual decision that is not part of the page's subject.

No Delete panel. There is no `deleteBeanAction` and inventing one is a different
slice with its own cascade questions.

The icon comes from `app/admin/_components/rail-icons.ts` — never
`lucide-react` — and the bean page joins `RAIL_PAGES` in
`lib/entity-rail-source.test.ts` the same day it grows a rail. That test is the
only thing in the repo that reports the bare-icon mistake, and every page using
the rail is `force-dynamic`, so `tsc`, `eslint`, `npm test` and `npm run build`
all pass on a page that 500s on every request.

## The write path, and one rule this slice bumps into

Three new store writers in `lib/botanical.ts`:

```ts
updateBeanMeta(slug, patch)          // $set name, $set|$unset description
updateBeanVisibility(slug, value)    // $set only
updateBeanTags(slug, tags | null)    // $set | $unset
```

`updateBeanMeta` builds its update document through a pure `beanMetaUpdate`,
mirroring `plantMetaUpdate` — that helper exists because composing the two-field
document inline with a spread produced two `$set` keys and silently dropped
fields, and a second two-field writer must not re-earn that bug.

`updateBeanTags` is the **fourth** copy of the one-field `$set`/`$unset` shape
(`updatePlantLogo`, `updateBeanCover`, `updateBeanKeyword`). `updateBeanCover`'s
docblock says that if a fourth appears, the move is to extract a pure, tested
update-doc builder. **This slice declines, and amends that sentence rather than
leaving it false.** The same docblock already argues the reason: a helper
generic over both document type and field key lands back at an
`as UpdateFilter<T>` cast, and that cast silences `$set`'s value-type
checking — `{ $set: { cover: "oops" } }` compiles clean with it and fails `tsc`
without it. `plantMetaUpdate`'s extraction was worth its cast because it fixed a
bug that had shipped; extracting this one would introduce the class of bug the
literal copies currently make impossible. Four five-line copies, each naming its
one field literally so a typo is visible on sight, is the cheaper of the two.
The docblock gets one paragraph recording that a fourth copy arrived and why it
stayed a copy.

Every action follows the house shape: `requireSession()`, existence check
first so the error redirect can only target a real page, projected re-check,
build the patch (catching only its own declared error class), write,
`revalidateGarden()`, redirect. `revalidateGarden` is not optional on any of
them — a bean's name, keyword and visibility all reach the public site.

## Tests

New:

- `lib/bean-tags.test.ts` — trim, blank-drop, order-preserving dedupe,
  case-sensitivity, empty ⇒ `[]`.
- `lib/bean-meta.test.ts` — both languages compose, blank name throws,
  blank description ⇒ `null`.
- `lib/bean-hero-a11y.test.ts` — the sibling of `lib/sprout-hero-a11y.test.ts`:
  each closed fact trigger names its STORED value (`Visibility: Public`,
  `Keyword: Timeline`, `Tags: 3`), on the control rather than a visible span,
  and a projected bean renders no trigger at all.

Amended:

- `lib/entity-rail-source.test.ts` — bean page added to `RAIL_PAGES`.
- `lib/admin-table-source.test.ts` — unchanged in kind; `SproutTable` keeps its
  `resolveText` value import, which is what makes a `"use client"` there fail
  the build outright.
- `lib/bean-detail.test.ts` — unchanged. The view model does not move.

The DB-backed writers run under `npm run test:db`.

## Out of scope

- Deleting a bean.
- `parents` editing — re-parenting a bean is a cascade question, not a field.
- `slug` editing, for `updatePlantMeta`'s reason: it is what every `parents[]`
  ref points at.
- Any change to the public bean surfaces.
