# Related beans rail — design

**Date:** 2026-09-16
**Status:** approved, not yet planned

## What

A rail of up to six other beans at the end of `/bean/[id]`, after the article:
a small heading and a grid of the landing page's own cards — cover, name, one
muted line. Pod siblings first, topped up from the plant.

Public zone only, bean pages only. No island: six `<a>` in the server HTML.

## Why

The bean page ends flat. A visitor finishes the article and the page stops —
the lineage chrome at the top is the only way onward, and it points *up*, never
sideways. Everything needed to say "and here is the next one" is already in the
garden and already on the page's own dataset.

## The relation rule — `lib/related-beans.ts`

Pure and JSX-free, beside `lib/lineage.ts` and `lib/admin-nav.ts`, for the same
reason: the component is rendered, this is arithmetic, and `npm test` reaches
arithmetic without a database.

```ts
export function relatedBeans(dataset: Dataset, bean: Bean, limit = 6): Bean[];
```

**THE GARDEN IS A PARAMETER**, verbatim from `lib/lineage.ts`. The page decides
which dataset it hands over, so privacy stays a page's decision rather than a
component's: `app/(public)/(chrome)/bean/[id]/page.tsx` passes
`getPublicDataset()`, `filterPublic` has already removed every private bean, pod
and plant upstream, and there is **no second check here**. One projection, one
place — and nothing for a future admin caller to have to remember to disable.

The climb, in order:

1. **Pod tier.** `parentsWithPrefix(bean.parents, POD_PREFIX)` → `beansForPod`
   for each, unioned and deduped by slug. The union is not defensive: a bean may
   name two pods, and both sets of siblings are related.
2. **Plant tier.** `dataset.plantForBean(bean.slug)` → `beansForPlantDeep`.
   `plantForBean` climbs *through* the pod (`lib/data.ts:446`), so the common
   case — a bean parented only to a pod — still finds its plant.
   `beansForPlantDeep` is called rather than composed, which is what inherits
   its dedupe of a bean parented to both a pod and that pod's plant; its own
   docblock names the three ways a hand-rolled rollup gets this wrong. Deduped
   again against tier 1.
3. **Self is dropped** from both tiers.
4. **A bean with no article is dropped.** A candidate survives only if
   `articleFor(dataset.sproutsForBean(slug))` is non-null — the *same function*
   the bean page renders by (`lib/article.ts`), not a second test that happens
   to agree. The rail therefore cannot promise a read the destination will not
   give.
5. **Each tier sorted newest-first** by that surviving article's `date`,
   tie-broken by `resolveText(name).localeCompare` and then by slug.
6. Concatenated pod-then-plant, `slice(0, limit)`.

Two properties of that order are load-bearing and easy to lose:

**A pod sibling outranks every plant bean, however old.** That is what "pod
first, then top up" means. Sorting the concatenated set by date — one sort key
instead of two tiers — reads as a simplification, passes every test that only
counts the rail's length, and quietly turns the rail into option C from
brainstorming ("everything under the plant"), where a pod's own three siblings
are invisible in a twenty-bean plant.

**The tie-break is two keys deep, not one.** Two beans can carry articles dated
the same day, and `Dataset`'s arrays are in garden order, which is Mongo's — so
without the name-then-slug tail the rail reshuffles itself between two visits
with nothing in the garden having changed. This is the hazard
`lib/plant-hub.ts`'s `byName` and `lib/screens.ts`'s capture-run sort both
already name; the comparator here is the same shape and deliberately so.

`resolveText(name)` with no `lang` defaults to English, exactly as `byName`
does. The rail's *order* is therefore English-name order regardless of the
reader's language, while its *contents* are resolved per-reader by the page.
That asymmetry is inherited on purpose rather than fixed here: one bean cannot
sort before another for a French reader and after it for an English one without
the two languages disagreeing about which six beans the `slice(0, 6)` kept.

## The card face — `components/bean-card.tsx`

The landing page's vertical card, lifted out of `app/(public)/page.tsx`
unchanged: a 4:3 `overflow-hidden rounded-lg bg-muted` frame, the name in
`font-heading text-sm` with the `group-hover:underline`, one muted line beneath.

**The cover arrives as a SLOT**, exactly as `components/entity-card.tsx` takes
its `coverArt`, and for exactly that file's reason: it is what keeps this file
**server-safe** while the art it frames is not. `components/bean-cover.tsx` is
server-*only* — it reaches `lib/data`, which opens with `node:fs` — so a card
that drew the cover itself could never be imported anywhere a card might one day
be wanted. Handing the frame's contents in from outside costs one prop and
keeps that door open.

Both callers pass the same `<BeanCover cover={beanCoverFor(bean, sprouts)}>`
they pass today. **The landing page's rendering does not change**, and that is
the acceptance test for this half of the slice: the extraction is mechanical, or
it is wrong.

Added to `lib/server-safe-source.test.ts`'s pinned list **the day it is
written**, per CLAUDE.md — a `"use client"`, a `lucide-react` import, a
`next/link` or a `node:` import here all pass `tsc`, `npm test` *and*
`npm run build` while costing the public zone its navigation.

## The grid — in `app/(public)/(chrome)/bean/[id]/page.tsx`

```
grid grid-cols-[repeat(auto-fill,14rem)] gap-4
```

**The cells are exactly 224px, not fluid, and that is the load-bearing
decision.** `components/bean-cover.tsx` reckons the phone's rise in pixels off a
224×168 frame — `top-[58px]` is `168 - 110`, the 110 being how much of the phone
shows at rest — and its docblock says so outright: *the geometry is tied to the
row's `w-56` card; widen the card and the numbers in that file need revisiting*.
Fixed tracks make both callers 224px by construction, so the phone
choreography and the departing keyword come along free and neither file has to
be re-derived.

The arithmetic: `READING_COLUMN` is 768px minus a 24px gutter each side, so
720px of content; `floor((720 + 16) / (224 + 16))` is 3 across, using 704 of
720. A 375px phone gives 327px of content and one card — at the same 224px the
landing row already shows on that phone, so nothing about the card's size is new
at any viewport.

The alternative considered and rejected: fluid cells drawing `fillCoverFor` —
the plain-image sibling `lib/bean-cover.ts` documents for *"a surface that only
wants to know WHICH IMAGE — no phone branch, a fixed frame"*. It responds better
at awkward widths and costs the rail the one move the site is recognised by. If
the fixed tracks ever do read badly, that is the exit, and it is a two-line
change rather than a redesign.

**Placement is after `</article>`, not inside it.** The rail is not part of the
article. It is a `<nav aria-label="Keep reading">` with `border-t pt-8`, and its
heading wears the pod page's existing treatment —
`font-heading text-xs uppercase tracking-widest text-muted-foreground` — so the
footer matches the only other index in the zone rather than inventing a second
one.

### The heading's two decisions

**English-only: "Keep reading."** This matches the zone as it stands — the pod
page's "Inside" and the lineage chrome's "Plants / Pods / Beans" are English
regardless of the language switch. It is an inconsistency the public zone
already carries, recorded here rather than fixed in this slice; making it
bilingual is a two-entry `Record<Lang, string>` whenever that is wanted.

**Tier-neutral, not "More in Paulopus."** The top-up deliberately mixes pod
siblings and plant beans in one grid, so naming the pod over the heading would
be true of slots 1–2 and false of slots 3–6.

## Absence

Fewer than six candidates is a shorter grid. **Zero is no rail at all** — no
heading, no border, no empty box under the word "Keep reading". Three real
gardens reach that path: a standalone bean with neither pod nor plant, the first
bean written under a new plant, and a plant whose other beans are all still
drafts. An absent rail is a statement about the garden; an empty one is a
component that failed.

## Tests

- **`lib/related-beans.test.ts`** — no database, `buildDataset` over a literal
  `RawGarden` as `lib/data.test.ts` does. Pod tier ordered before plant tier
  even when a plant bean is newer; top-up stops at six; self excluded; a bean in
  two pods contributes both sibling sets once; a bean parented to both a pod and
  its plant appears once; a bean whose sprouts carry no content is excluded; a
  bean with no sprouts at all is excluded; newest-first within a tier; equal
  dates tie-break by name then slug; and the three empty cases (no pod, no
  plant, neither).
- **`lib/server-safe-source.test.ts`** — `components/bean-card.tsx` added to the
  pinned list.

## Out of scope

- Pod and plant pages. The pod page already lists its beans under "Inside" and
  the plant page already draws its pods and its exhibition strip; widening the
  rail to them needs a second relation rule, and that is its own slice.
- Any bilingual UI string. See the heading note above.
- Sprout-level or cross-plant relatedness, tags, and anything resembling a
  recommendation score. The rule here is parentage and recency, both of which
  the author controls directly.
