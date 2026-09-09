# The screen gallery — an exhibition drawn from the store

*2026-09-09*

## 0. Where this starts

The screen store ([`2026-09-08-screen-store-design.md`](2026-09-08-screen-store-design.md))
put a hundred and seventy Paulopus screens into Cloudinary and Mongo, and
rendered none of them. Its §6.2 filed the gallery and §6.3 filed the lightbox,
and both are now issues (#71, #72) whose design decisions were settled in the
same conversation that produced that spec.

This spec builds **the gallery**. The lightbox is §9, designed here and shipped
separately, for the reason §9 gives.

## 1. The shape of the thing

A plant page today is: head → platform links → narrative → *Inside*. The gallery
goes **above the narrative** — show first, explain after — as one horizontal
CSS scroll-snap row of phones, each cropped at the bottom, each with its legend
visible underneath.

Four decisions arrive already made, from the store spec's brainstorm:

- **A phone strip, not a carousel.** The same run-grouping primitive the CASA
  slice built (`components/media.tsx`'s `Gallery`, `lib/media-runs.ts`) —
  `overflow-x-auto` plus scroll snapping, a `tabIndex={0}` so the arrow keys
  reach it, and no script.
- **Legends always visible.** Not hover-only. A caption the visitor has to
  discover is a caption most visitors never read.
- **Before the narrative.**
- **Exhibition is an explicit opt-in.** The store holds everything; the page
  shows the handful marked for it. Storing a screen is never a publishing act —
  `createScreen` writes `visibility: "private"` for exactly this reason, and
  its docblock already says the gallery's flip "is a deliberate act on the
  screens it chooses to exhibit".

## 2. The two fields

`lib/data.ts`'s `Screen` gains the two its own comment said it would:

```ts
exhibited?: boolean; // the editorial opt-in
order?: number;      // position in the plant's strip; normalized 0..n-1 on every write
```

Nothing else. A plant still grows no `screens[]`: containment points upward
from the screen, which is what the store spec argued and what keeps the privacy
cascade the bean's cascade rather than a second one.

### 2.1 Why both, when either could nearly do

`order` alone could imply membership ("has a position, therefore exhibited"),
and `exhibited` alone cannot order. Two fields look like one too many.

They are not, and the reason is §3: the strip requires **`exhibited === true`
AND a screen that survived `filterPublic`**. Those are two different facts —
one editorial, one about privacy — enforced in two different places, and
collapsing them would mean a screen made public by any other route (a
hand-edit, a future visibility control, a migration) appears on a plant page
because nothing asked whether anyone meant it to.

An **exhibited screen with no `order`** sorts LAST rather than disappearing.
That is the fail-visible direction: the author said exhibit it, so a missing
sort key should cost position, never presence.

## 3. Privacy, and the lockstep

Every screen is private at birth. `filterPublic` drops private screens. So
`exhibited: true` on its own would render nothing at all — which is the first
thing this slice has to solve, and neither issue mentions it.

**Exhibiting and publishing are one act.** Adding a screen to a plant's
exhibition writes `visibility: "public"` beside `exhibited: true`; withdrawing
it writes `visibility: "private"` and unsets both fields.

That is a deliberate collapse of two controls into one, and it is defensible
for a screen specifically: nothing else in the public zone links a screen, so a
screen that is public but on no strip is a distinction with no observable
difference. Making the author perform it as two saves on two pages would buy
nothing and would produce, as its commonest failure, a screen marked exhibited
and stored private — rendering nothing, with nothing on any page to say why.

The redundancy that remains is belt-and-braces in the other direction, and §2.1
is where it earns its place.

## 4. `lib/exhibition.ts` — the arithmetic

Pure, and with **no value imports** — near `lib/image-url.ts`'s property, and
load-bearing here rather than tidy: `lib/data.ts` imports this file (§5), so a
value import back out of it would be a runtime cycle. It works on slugs and on
structural `{ slug, order? }` shapes, never on `Screen`. The one `import type`
it carries (`MediaImage`, for the row type §7 hands the strip) is erased at
build and is not a cycle.

- `exhibitionOrder(a, b)` — `order` ascending; an entry without one sorts last;
  slug as the tie-break, with the plain `<` comparison `lib/screens.ts` and
  `byDateDesc` already use, so one collation governs the whole repo's
  slug ordering.
- `applyExhibitionOp(ordered: string[], slug: string, op: ExhibitionOp): string[] | null`
  — the whole of what the four buttons do. Returns the new ordered list, or
  `null` for a no-op: `up` at the head, `down` at the tail, `add` for a slug
  already present, `remove`/`up`/`down` for a slug that is not. `null` is what
  dirty-gates the write, so a stray press writes nothing at all.
- `exhibitionWrites(before: string[], after: string[]): { promote: { slug: string; order: number }[]; withdraw: string[] }`
  — `promote` carries **only** the screens whose index actually changed. A swap
  writes two documents, not the whole strip.

`ExhibitionOp` is a named vocabulary (`"add" | "remove" | "up" | "down"`) that
the action re-validates rather than trusts, which is `lib/plant-status.ts`'s
stance and for its reason: a stale page can then only ever name a member the
vocabulary already has.

## 5. The read path

`Dataset` grows one accessor:

```ts
exhibitionForPlant(slug: string): Screen[];
```

`buildDataset` groups screens by plant parent exactly as it already groups pods
and beans, keeps `exhibited === true`, and sorts with `exhibitionOrder`.

The two halves of §2.1's rule are each enforced where they belong. The public
page reads the filtered dataset, so **`filterPublic` is what enforces privacy**
— this accessor never re-checks `visibility`, because a second copy of a
security check is a second behaviour. And **this accessor is what enforces the
opt-in**. The admin reads the raw garden and calls the same arithmetic, where
"exhibited" is all it wants to know.

## 6. The admin: two halves, in two places

A 256px floating panel can hold a strip of eight. It cannot hold a library of a
hundred and seventy to pick from. So the surface splits, and the split is what
makes the script-off story small:

**Adding and withdrawing live on the screen's own page**, `/admin/screens/[slug]`
— an Exhibition card beside the Details, Image and Danger-zone cards, holding
one button: *Add to <plant>'s exhibition*, or *Remove from the exhibition*. An
ordinary zero-client-JS metadata form, in the shape every card on that page
already has. A screen with no plant parent gets a sentence instead of a button:
there is no exhibition for it to join.

**Ordering lives in a panel on the plant admin's right-hand rail**, beside
*Inside* — the mirror of the chrome's rail that `plant-inside.tsx` already
owns. It lists the exhibited screens in order, each row a thumbnail, its name,
and ↑ / ↓ / ✕. Each row is one `<form>` with three submit buttons
(`name="op"`), which is why a row needs no client code at all.

### 6.1 What that costs without script, exactly

The panel is a popover: script-off it does not open. So **ordering is
unreachable without script, and nothing else is.** Membership is not — it is on
the screen's page. Withdrawal is not — same button. And the gallery still
renders, in `exhibitionOrder`'s fallback: unordered entries sort last, by slug.

That is a real cost and it is one sentence long, which is the whole reason for
the split in §6. The alternative shapes were a panel holding both halves
(making membership script-only too) and a dedicated page (costing nothing, but
also not what was asked for).

### 6.2 The panel stays a shell

`plant-inside.tsx`'s docblock currently says "nothing here writes and nothing
here is a form". It will now carry forms — but **it will not compose them**.
The panel's contents are server-rendered by `app/admin/plant/[slug]/page.tsx`
and handed down as a prop, exactly as the hero takes `metaForm`, `roleForm` and
`logoForm`. The client island learns no field name and builds no payload; it
owns the open state and nothing else.

That is the same property that keeps the hero honest, and it is what keeps this
from being a seventh exception rather than an amendment to a neighbour.

### 6.3 The write

`lib/botanical.ts` gains:

- `listScreensForPlant(plantSlug)` — a real query on `parents`, replacing
  `listScreens()`, whose docblock already said to delete it "if that slice
  lands on a different read". It does.
- `writeExhibition(promote, withdraw)` — the §3 lockstep, as a bulk write.
  `promote` sets `exhibited`, `visibility: "public"` and `order`; `withdraw`
  sets `visibility: "private"` and `$unset`s the other two.

Two thin actions in `app/admin/actions.ts` sit over one core. They differ only
in where they redirect — back to the screen with its filters preserved
(`screensHref`), or back to the plant page — which is the only reason they are
two.

## 7. The public strip

**`components/phone-frame.tsx`** — extracted, not copied. `components/bean-cover.tsx`
already owns the phone's geometry (`rounded-2xl bg-neutral-900 p-1 pb-0
shadow-lg`, a `rounded-t-xl` screen, a portrait Cloudinary derivative), and its
numbers are tied to the landing card's `w-56`. The frame moves into a file both
callers draw from; the cover keeps its own positioning, its hover choreography
and its word, because those are the cover's and not the phone's.

**`components/screen-strip.tsx`** — the row. `aspect-[3/4]` windows with
`overflow-hidden`, each phone pinned to the top of its window and running past
the bottom edge, so the strip reads as a rank of phones rather than a row of
cropped pictures. `role="group"`, an `aria-label` naming the plant, `tabIndex={0}`
for the arrow keys — `components/media.tsx`'s `Gallery`, which is the primitive
this reuses rather than reinvents.

Each phone is wrapped in a real `<a href>` to the full Cloudinary image. It
costs this slice nothing (the URL is already on the page) and it is the thing
§9 intercepts.

The strip takes **already-resolved rows** — `{ slug, name, legend, image }`
with the two `Text`s resolved to strings by the page — rather than `Screen`s.
That keeps it genuinely isomorphic rather than server-only-but-server-safe,
which is the state `components/bean-cover.tsx`'s docblock has to spend a
paragraph explaining; and it is what lets §9's client island share the row type
with a plain `import type`.

Both files are **server-safe** and go into `SERVER_SAFE` in
`lib/server-safe-source.test.ts` on the day they are written — no `"use client"`,
no `lucide-react`. `app/(public)` still has exactly one client island when this
slice lands.

## 8. Tests

- `lib/exhibition.test.ts` — the comparator (ascending, unordered last, slug
  tie-break), every `null` no-op in §4, and the write diff: a swap promotes two
  slugs and no more.
- `lib/visibility.test.ts` — `exhibitionForPlant` beside the screen cascade
  tests already there: exhibited-only, ordered, and a private exhibited screen
  absent because `filterPublic` took it.
- `lib/botanical.test.ts` — a DB-gated round trip of `writeExhibition` under
  the existing `{ skip: !hasDb }` gate and the `__test__` slug convention:
  promote sets all three fields, withdraw unsets two and re-privatizes.
- `components/screen-strip.test.tsx` — in `bean-cover.test.tsx`'s family:
  the anchors are real and point at the full image, the legends are in the
  markup, an empty exhibition renders nothing.

## 9. The lightbox — designed here, shipped after

Issue #72, and **`app/(public)`'s second client island**. It ships as its own
PR for one reason: this slice adds no exception to CLAUDE.md's list, and that
one does. A diff that widens the client-JS set deserves to be read on its own.

It is also the property that makes the lightbox admissible. The gallery is
finished and useful without it — every screen is already a working link to its
full image — so the island **intercepts** rather than provides:

- Renders **nothing** until it mounts (`lib/screen-lightbox-mount.test.ts`, in
  the family of `lib/toc-mount.test.ts` and `lib/plant-hero-mount.test.ts`).
- The anchors are the **gallery's**, server-rendered. The island adds behaviour,
  never a destination.
- It intercepts a plain left click only — a modified click (⌘, Ctrl, Shift, Alt,
  middle button) still opens the image the way the visitor asked for.
- Base UI's `Dialog` for the focus trap and Escape. The CSS-label exception in
  `components/chrome.tsx` covers clusters magnetized to a viewport corner; this
  is not one.
- Arrow keys move between screens; the legend travels with the image.
- CLAUDE.md gains it as the **seventh exception**, with what it costs
  script-off — which, built this way, is nothing beyond the overlay itself.

## 10. What this slice does not do

- **No `screen:` refs.** Nothing points AT a screen yet, so `filterPublic`'s
  `refSurvives` grows no branch and a relation naming one still drops as an
  unknown prefix — the fail-closed direction the store spec chose.
- **No covers-become-screen-references.** That is the store spec's §6.4 and
  still the last of the four. Until it lands a cover and a screen may hold the
  same Cloudinary asset twice, and the `{ kind: "cover" }` relation is what
  keeps the two knowable from each other.
- **No exhibition on a pod or a bean page.** A screen's containment is a plant
  and only a plant.
