# The sprout's edition page, harmonized

**Date:** 2026-09-12
**Status:** design, approved for planning
**Slice:** the first of the edition-page harmonization. Sprout now; bean, pod
and screen follow, against the shells this slice extracts.

---

## 1. Why

The four admin edition pages diverged. Each one grew whatever its slice needed,
in the shape that slice found convenient, and nothing pulled them back together
afterwards:

| | head | metadata | prose | danger |
|---|---|---|---|---|
| **plant** | `PlantHeader` + five icon editors | overlay sheet + two enum popovers | its own page (`narrative/`) | — |
| **sprout** | `<h1>Edit version</h1>` + a `slug`/`bean` list | one big card at the bottom | `ContentCard`, mid-page | a card at the bottom |
| **pod** | `<h1>` + a list | — | `ContentCard` | — |
| **screen** | `<h1>` + slug | a card | — | a card |

The plant is the one that got the attention, and it is the one that is right:
the head states what the entity IS, every editor is one click behind the thing
it edits, and the page below the head is about the entity's contents rather
than about its fields. The sprout is the furthest from it and the most-used
page in the admin, so it goes first — and the shells it needs are extracted
rather than written sprout-first, because three more entities are queued behind
it.

This slice also finishes the sprout's share of
[#88](https://github.com/alexisbohns/ariko/issues/88) — the botanical rename
never reached the sprout's write path (`editVersionAction`, `updateVersion`,
`deleteVersion`) or the string the author reads ("Edit version"). Those four
identifiers are being rewritten by this slice anyway; renaming them now costs
nothing and costs a second pass later. `ATOM_PREFIX = "bean:"` stays for #88.

## 2. The shape

```
← <bean name>                                  ┌──────────┐
                                               │  SOURCE  │ ▐ ← rail
        The sprout's title  ← button           │          │ ▐   ⟨⟩ source
        one-line description                   │ # Title  │ ▐   ▤  media
        [⚡ state] [📅 date] [🏷 type]            │ body…    │ ▐   🗑  delete
                                               │          │
─── the editor, bare, 768px ───                └──────────┘
                    ( ✓ Up to date )  ← floating, bottom-centre
```

The document holds **the head and the editor, and nothing else**. What leaves
it: the Preview card (the editor is a WYSIWYG over the same markdown `<Prose>`
renders — a preview beside it is a second rendering of the same bytes, and the
one place the two can disagree is the Source panel, which survives), the
`<details>` Source collapse, the Media card, the whole metadata form, and the
Danger zone.

The page is the sibling of `app/admin/(chrome)/plant/[slug]/narrative/page.tsx`
— a head, a bare editor, and one link back — with the difference that a sprout
has no hub above it to carry its fields, so its head carries them.

## 3. The head

### 3.1 `components/plant-header.tsx` gains an optional mark

One prop change: `mark?: ReactNode`. The sprout head is then the plant head
minus the squircle — same file, same `TITLE` token, same `<h1>`, same centred
stack, same `description` treatment.

This is the shared-surfaces rule applied inside one zone rather than across
two: *if two pages draw the same thing, they draw it from the same file, and
what differs is a parameter.* The file's docblock already argues the mark's
fallback is not optional **for a plant** — a centred stack whose first element
is missing reads as broken. A sprout has no logo and no initials to fall back
to, so there is no first element to miss: the stack simply starts at the title.
That distinction goes in the prop's comment, because the next reader's
temptation will be to give the sprout an initials mark for symmetry, and a
monogram for a piece of writing is a decoration standing where a fact belongs.

The file stays **server-safe** — no `"use client"`, no `lucide-react` — which
`lib/server-safe-source.test.ts` already pins and which this change must not
disturb. Nothing here becomes a control; every trigger stays in the admin
island.

### 3.2 The link back

`← <bean name>`, flush left above the head, resolved from the garden the page
already loaded rather than printed as a slug — the shape
`plant/[slug]/narrative` uses for its own way out. A sprout with no bean parent
(possible: `parents[]` is not enforced to hold one) falls back to
`← sprouts`, which is where `backHref` already points today.

The `slug` / `bean` definition list the page carries today goes away. The bean
is this link, and the slug is a read-only line in the meta overlay (§3.5) —
neither is a fact the head states, because neither is a thing the author can
change.

### 3.3 `app/admin/_components/sprout-hero.tsx` — the island

Mirrors `plant-hero.tsx` beat for beat, and deliberately so: an author moving
between a plant and a sprout should find the same gestures.

- The **title** is a button inside the `<h1>`, never instead of it, so the page
  keeps exactly one document title. It opens `OverlaySheet` onto the meta form.
- The **facts row** is three ghost icon triggers.
- One `Surface` union tracks which surface is open, in one place rather than in
  four independently uncontrolled primitives.
- A rejected save arrives as `?error=…&form=meta|date|type|state` and reopens
  onto the surface it came from, because the form is behind a closed surface
  and the banner would otherwise have nowhere to live.
- `close()` drops `?error=` and `?form=` with `replaceState` — tidying the URL,
  not navigating.
- The `saved` fingerprint closes a surface when a write lands.

**The fingerprint covers all four surfaces**, which is a correction to the
plant's rather than a copy of it. `plant-hero.tsx` fingerprints name,
description, role and logo — not status, not visibility — so a status save
leaves its popover open over a freshly-disabled Save. The sprout's fingerprint
is every field its head can write:

```ts
saved={JSON.stringify([
  textPart(sprout.name, "en"), textPart(sprout.name, "fr"),
  textPart(sprout.description, "en"), textPart(sprout.description, "fr"),
  sprout.date, sprout.type, stateOf(sprout),
])}
```

STRICT `textPart` on both halves, so an fr-only edit still moves the
fingerprint — `resolveText`'s fallback would hide it.

### 3.4 The three triggers

| Trigger | Icon | Popover holds | Posts |
|---|---|---|---|
| state | `PencilLine` / `Lock` / `Globe` | three native radios + Save | a named member of a vocabulary |
| date | `Calendar` | `<input type="date" required>` + Save | a date string |
| type | `Tag` | `<input type="text" required>` + Save | free text |

**None of the three writes on the click that opens it.** The icon opens, the
author picks or types, and a Save commits. For state the Save is disabled until
the pick differs from what is stored, exactly as the plant's two enums are —
and state earns that rule harder than either of them, because publishing a
sprout runs the visibility cascade upward through its bean, pod and plant, and
un-publishing runs the downward recompute. A stray click on a globe that
published a project's whole spine, with the undo being another stray click on
the same pixel, is the failure this shape exists to prevent.

For date and type the Save is a plain submit: a text field's "differs from
stored" is what the author can already see in the field.

**Date and type are not enums, and the difference is recorded rather than
smoothed over.** `Sprout.type` is a free-form string — `lib/sprouts.ts` filters
sprouts by state, plant and tag and never by type, and the seed-promotion path
writes whatever the source carried. So there is no vocabulary to post a member
of, and the action validates only that the field is non-empty. If a type
vocabulary is ever wanted, it arrives as `lib/sprout-type.ts` beside
`lib/sprout-state.ts` and this popover becomes radios; until then, a `<select>`
over the types that happen to exist today would be a vocabulary invented by its
own UI.

**Each trigger's accessible name states its STORED value** — `State: Draft`,
`Date: 2026-09-12`, `Type: article` — set on the control, not on a visible
span, because the hover label is CSS. Replace `State: Draft` with a bare
`State` and the page looks identical and stops saying what it is.
`lib/sprout-hero-a11y.test.ts` pins it, as `lib/plant-hero-a11y.test.ts` does
for the plant.

`Lock` and `Globe` are `VisibilityGlyph`'s own icons, taken deliberately
rather than by coincidence: a sprout's state IS its visibility plus a stage
before it, and `private` on a sprout means exactly what `private` on a plant
means. Drawing them differently would assert a distinction that does not
exist. `PencilLine` is the new one, and it is the only member that has no
counterpart in the visibility vocabulary — which is the honest reading of
draft: not a privacy setting, a stage.

Tone: draft is muted (the at-rest default), private takes `text-foreground`,
published takes `text-primary`. The rule is `StatusGlyph`'s — a lit glyph reads
as live — not `VisibilityGlyph`'s emphasis-on-the-exception, because for a
sprout "published" is the consequential state rather than the unusual one.

### 3.5 `app/admin/_components/sprout-meta-form.tsx`

A server component, handed to the island as a `ReactNode` prop exactly as
`metaForm` / `roleForm` / `logoForm` are — which is what keeps `sprout-hero.tsx`
free of every field name on the sprout, and keeps the island a shell rather
than a write path.

Four fields: `name` / `nameFr` / `description` / `descriptionFr`. Prefills use
STRICT `textPart`; `resolveText`'s fallback would copy the fr half into the en
box and save it back as en, which is the trap the plant's Meta and Role forms
both carry a comment about. No `required` on the en inputs — an fr-only name is
valid and the pair is validated as a whole server-side.

The slug is shown as a read-only line above the fields, not as an input. It is
what every `parents[]` ref points at and what `promotedTo` on a seed records,
so renaming it from this form would orphan things with no cascade to catch it.
It is identity, and the overlay is where identity is read.

## 4. The write path

### 4.1 Four narrow actions replace one wide one

`editVersionAction` is the last whole-record write in the sprout's path:
`buildSproutPatch` reads seven form fields into a `SproutPatch` and
`updateVersion` spreads it into one `$set`. That shape is only safe while every
one of those fields is on one form — which is precisely what this slice ends.

Deleted: `editVersionAction`, `SproutPatch`, `buildSproutPatch`,
`validateSproutPatch`, `updateVersion`. `shouldCascadePublish` stays and moves
under the state action.

Added, following the rule `updatePlantRole` / `updatePlantMeta` /
`updateSproutMedia` already state — *siblings, never widenings; fields named
explicitly, never spread, so a later widened caller cannot reach a field its
form has no business touching*:

| Action | Writer | Writes |
|---|---|---|
| `editSproutMetaAction` | `updateSproutMeta(slug, patch)` | `name`, `description` |
| `setSproutStateAction` | `updateSproutState(slug, state)` | `state` — **and runs the cascade** |
| `setSproutDateAction` | `updateSproutDate(slug, date)` | `date` |
| `setSproutTypeAction` | `updateSproutType(slug, type)` | `type` |

`updateSproutMeta` needs no `$unset` half and therefore no pure
`sproutMetaUpdate` beside it: `Sprout.description` is **required** in
`lib/data.ts`, unlike `Plant.description`, so a cleared description stores `""`
rather than having to cross the wire as an instruction to remove a key. That is
the one place this path is simpler than the plant's, and the reason belongs in
the writer's comment so nobody adds the missing half for symmetry.

`lib/sprout-meta.ts` is the pure seam — `buildSproutMetaPatch(form)`, throwing
`BlankSproutNameError` on a name blank in both languages, the stance
`buildPlantMetaPatch` takes. The action turns the throw into an `?error`
redirect.

**The cascade lives in exactly one action.** `setSproutStateAction` keeps
`editVersionAction`'s logic verbatim: publish → `publishCascade` + `setPublic`,
gated on `shouldCascadePublish(type)` so a digest's sign-off is not a
publication; an actual un-publish (it *was* published and no longer is) →
`unpublishCascade` + `setPrivate`. Both branches re-read with `loadRawGarden`
**after** the write, never `loadCachedGarden`, so the cascade evaluates the
just-saved state — the rule CLAUDE.md states and
`lib/garden-cache-source.test.ts` pins per-function.

The type gate has a consequence worth naming: `setSproutTypeAction` can change
a sprout's type from `digest` to something else *while it is published*,
without running the cascade that the same transition would have run at publish
time. This slice does not change that — it is the behaviour `editVersionAction`
already had, since a form save carried both fields and only `patch.state ===
"published"` triggered the cascade — but it is now visible as a gap between two
actions rather than hidden inside one. Recorded here, not fixed here.

### 4.2 Every save returns to the sprout

`editVersionAction` redirects to the bean page on success. That made sense for
a form at the bottom of a page whose save was the end of a visit; it is wrong
for an in-place edit inside a header. All four actions redirect to
`/admin/sprout/<slug>`; only `deleteSproutAction` still leaves, to the bean.

### 4.3 `lib/sprout-state.ts` — the vocabulary, client-safe

```ts
export const SPROUT_STATES: readonly SproutState[] = ["draft", "private", "published"];
export function stateOf(sprout: Pick<Sprout, "state">): SproutState  // absent ⇒ "draft"
export function isSproutState(raw: string): raw is SproutState
```

A new module rather than an export added to `lib/sprouts.ts`, for
`lib/section-keys.ts`'s recorded reason: `lib/sprouts.ts` imports `resolveText`
as a *value* from `lib/data.ts`, which opens with `node:fs`, and the state
popover is inside a client island. Importing the vocabulary from there would
fail `npm run build` with `UnhandledSchemeError` — the third time that boundary
has bitten (`lib/palette-items.ts`, then `lib/section-keys.ts`), and the third
time the fix is a client-safe module beside the server one. CLAUDE.md names the
first pair as a rule; this is the pattern, not a coincidence.

`lib/sprouts.ts`'s own `const STATES: SproutState[]` is deleted and imported
from here, so there is one list rather than two that agree today.

The **words** go in `lib/glyphs.ts` (`sproutStateLabel`), not here — that file
is the one place a display form is decided for a value the admin draws, which
is the same split `lib/plant-visibility.ts` makes against `visibilityLabel`.

## 5. The rail

### 5.1 `app/admin/_components/entity-rail.tsx` — a shared shell

`Chrome magnet="right" orientation="vertical"` plus a panel plus the push.
Extracted rather than written sprout-first because it is provably generic: it
takes `items: { id, label, icon, panel: ReactNode }[]`, an `openOnError?:
string` (§6), and children — and it **learns no field name**. Source, Media
and Delete are all server-rendered by
`app/admin/(chrome)/sprout/[slug]/page.tsx` and handed down, exactly as
`ExhibitionPanel` is handed to `PlantRail`. `lib/entity-rail-source.test.ts`
pins that, as `lib/exhibition-panel-source.test.ts` pins its sibling.

It carries its own copy of `plant-rail.tsx`'s `PLATE_WHILE_OPEN` — the plate
held open by `md:has-[[aria-expanded=true]]:…` rather than by state, so an open
panel's trigger does not ghost away underneath it. A copy rather than an
import: `PLATE_WHILE_OPEN` is a private constant of a file this slice does not
otherwise touch, and exporting it would make `plant-rail.tsx` a module
`entity-rail.tsx` depends on for one string. It is lifted into the shared file
when the plant's own turn converts that rail (§10).

One difference from the plant's: its trigger is a Base UI `PopoverTrigger`,
which sets `aria-expanded` itself. These triggers are plain buttons, so the
rail sets `aria-expanded` by hand — which it must do anyway, because a button
that opens a panel and never says so is a control a screen reader cannot
report.

The panel wears `side-sheet.tsx`'s look: `inset-y-0 right-0 w-[28rem] border-l
bg-card/95 backdrop-blur-xl`, `duration-200`. It is **not** `SideSheet` itself:
that component is filled by a parallel route and hooks the layout's
`:has(~ [data-screen-sheet])` push, which a page-owned panel cannot reach from
inside its own column.

### 5.2 All three panels stay mounted

Toggled with `inert` + `translate-x-full`, not unmounted.

This departs from `EnumPopover`'s rule — *an abandoned pick is not a pending
write, and Base UI unmounting the popover is what discards it with nothing to
reset by hand* — and the exception is specific to one panel.
`MediaPicker` uploads to Cloudinary **immediately** through
`uploadImageAction` and persists the list only on Save. Unmounting on close
would therefore strand real assets in the bucket — the thing
`npm run check:orphans` exists to sweep — and would do it on a mis-click, which
is the failure mode the two-act enum rule is itself built to avoid. React
preserves state across `inert`, so closing and reopening the panel returns the
author to the list they were building.

The cost is that the picker mounts on page load rather than on first open,
which is exactly what it does today: the Media card is unconditionally in the
document. Nothing regresses.

Source and Delete are cheap enough that treating all three the same is simpler
than special-casing one, and a rule with an exception in it is the thing that
rots.

Media keeps both halves of its data-loss guard unchanged: the `key` re-seed
after a save, and `submitLabel` so the submit is rendered **by** the island. A
form whose entire meaningful content is the picker must not server-render a
button, because an empty media list is indistinguishable from a deliberate
clear-all and would delete every stored image.
`lib/media-picker-mount.test.ts` follows the form to its new file.

### 5.3 The push

```
min-[76rem]:-translate-x-56
```

A **translate**, not padding, and the arithmetic is recorded the way
`RAIL_CLEARANCE` records its own.

The layout's docblock says padding, not translate — and says why: *a transform
does not make room, it MOVES*, and the screen library's 14rem move pushed a
wide grid's left edge past the viewport. Both halves of that reasoning invert
here. This is the reading column, which has gutters to spare, exactly
`PlantRail`'s case. And the same docblock states the other half outright:
*"'keeps its columns' is a benefit for a prose editor, whose measured width and
caret position must not move under the author."* Re-flowing a WYSIWYG surface
while the author has a caret in it is the thing to avoid; padding re-flows,
a transform does not.

Padding is also simply unavailable. The page renders *inside*
`READING_COLUMN` (`AdminMain` → `div.mx-auto.max-w-3xl.px-6` → the page), so a
`pr-[28rem]` added by the rail lands inside a 768px box and squeezes the editor
to roughly 320px. Only the layout can pad, and only for its own `@sheet` slot.

The arithmetic, with `main`'s `px-20` (160px total) and a 448px panel:

- column width 768, centred → left edge `(vw − 768) / 2`, right edge `(vw + 768) / 2`
- after `−224` (14rem, half the panel): left `(vw − 768)/2 − 224`, right `(vw + 768)/2 − 224`
- clear the panel: `(vw + 768)/2 − 224 ≤ vw − 448` → **vw ≥ 1216**
- stay on screen: `(vw − 768)/2 − 224 ≥ 0` → **vw ≥ 1216**

Both bounds land on the same number, which is what makes 1216px the honest
breakpoint rather than a chosen one: below it there is no translate that both
clears the panel and keeps the column on screen, so there is no translate at
all. Below `min-[76rem]` the panel floats over the prose, dismissible, as the
library's does below `lg`.

`transition-transform duration-200 ease-out`, matching the panel's own duration
so the two are one movement rather than a page that moves before anything
arrives to justify it.

(Tailwind v4 scans this file as TEXT, so every utility spelled above is minted
into the stylesheet whether or not the code ends up using it — the caveat
`app/admin/(chrome)/layout.tsx` records about its own docblock. Every class
named in this spec is one the implementation is meant to emit, which is why
they are spelled here and not there.)

### 5.4 The three items

**Source** (`FileCode2`) — `resolveText(sprout.content)` in a `<pre>`,
read-only, zero JS. It survives the Preview card's deletion because it is not a
second rendering of the document: it is the stored bytes, and the diagnostic
for when the editor's serializer and `<Prose>`'s parser disagree. Empty
content draws the panel's em dash rather than an empty box.

**Media** (`Images`) — the form that is today's Media card, moved whole. It
keeps its `CardDescription`, because the sentence is load-bearing and its
consequence is invisible from the panel: *the first image becomes this bean's
cover.* Order is an authoring act.

**Delete** (`Trash2`) — today's Danger zone form, moved whole: the confirm
checkbox, the interpolated name, the destructive submit, the server-side
re-check of `confirm`, the `unpublishCascadeForBeans` recompute when the
sprout was published. Renamed `deleteSproutAction`.

## 6. Where a rejected save's message lands

Five surfaces can now reject a save, and every one of them is behind something
the author has to reopen. `?form=` names which:

| `?form=` | Reopened by | Rejections |
|---|---|---|
| `meta` | the hero's overlay sheet | a name blank in both languages |
| `state` / `date` / `type` | the hero's matching popover | an unknown state, an empty date or type |
| `delete` | the rail's Delete panel | the confirm box unchecked |
| *absent / unknown* | a page-level `<Alert>` between head and editor | anything else |

The hero owns four values and the rail owns one, each reopening onto the
surface the message belongs to and rendering it inside — the plant hero's rule,
extended to a second island. An unknown `?form=` opens nothing and falls
through to the page-level banner, so a stale or hand-edited URL can never leave
a message with nowhere to appear.

Two write paths are deliberately absent from the table. The **content** save
never redirects with `?error=`: the editor invokes its action directly and
renders its own failure in the floating cluster (§7), which is where the author
is looking. The **media** save has no rejection path at all — `buildMediaPatch`
either finds the island's `__ready` marker and writes, or finds nothing and
does nothing.

The rail therefore takes one prop for this — `openOnError?: string`, compared
against each item's `id` — and it is the only thing `entity-rail.tsx` knows
about errors. It never renders a message; the panel it opens does, because the
panel is the thing that was server-rendered by the page.

Both islands drop `?error=` and `?form=` with `replaceState` when their surface
closes. Left in the URL they outlive the surface: close, reload, and the banner
returns about an edit that no longer exists in any field.

## 7. The floating save

`components/editor/prose-editor.tsx` gains a `float` prop. Set, the inline save
row becomes a `Chrome magnet="bottom-center" content` cluster holding one
button.

`float` is separate from `bare` on purpose. They happen to be set together on
this page, but they are two decisions — `bare` is about the frame around the
writing surface, `float` is about where the commit lives — and the pod and bean
pages still reach this component through `ContentCard`, where both stay off and
the inline row, with its `No changes to save` and `Could not save: …` lines, is
unchanged.

The sprout page stops using `ContentCard` and renders `ProseEditor` directly,
as `plant/[slug]/narrative` does: a card's header above an editor that is the
page's only content is a frame around the page.

| State | Draws | Enabled |
|---|---|---|
| clean | `CloudCheck`, ghost, muted — "Up to date" | no |
| dirty | primary — "Save" | yes |
| saving | `LoaderCircle` spinning — "Saving…" | no |
| failed | `CloudAlert`, destructive — "Couldn't save" | yes, to retry |

The theme's primary **is** green (`base-nova`, green theme), so the active
state needs no colour of its own; hard-coding one would be the first place the
page stopped following the design system.

Failure is a fourth **appearance**, not a fourth mode: a save that failed must
not read as saved, and the inline `Could not save: …` line has nowhere to live
once the button floats. The message goes in the cluster's label.

**"Up to date" is made truthful.** Today `unchanged` only becomes true *after*
a save attempt that found no diff; the rest of the time the button says "Save
content" whether or not there is anything to save. The float's resting state
is a claim about the document, so it needs a real signal: `onUpdate` schedules
a 200ms-debounced comparison of `editor.getMarkdown()` against `baselineRef`
(the editor's own first serialization, not the stored prop — those differ by
normalization on essentially every real document, which is why comparing
against the stored string never detects "unchanged"). Undo back to the original
therefore returns the button to clean, correctly.

The dirty-gate in `editContentAction` is untouched, and the save path's
`unstable_rethrow` handling of `NEXT_REDIRECT` is untouched.

Only the commit floats. The editor's `@` / `/` hint line and the `/image`
command's "Uploading image…" and "Could not add image: …" messages stay in the
document, under the writing surface: they are about the caret's neighbourhood
rather than about the document's state, and a fixed cluster at the bottom of
the viewport is the wrong distance from the thing they describe. `imageBusy`
still disables the save, for the reason it already does — saving mid-upload
persists a document missing the image that is seconds from being inserted.

The cluster is `fixed`, so it does not travel with §5.3's translate. It does
not need to: at 1216px and above, the viewport's centre sits 384px clear of the
panel's left edge, and the gap only widens.

**No auto-save**, per the deferral. The debounced dirty signal is the half of
auto-save this shape needs anyway, so adding it later is a timer over a signal
that already exists rather than a rewrite.

## 8. The state glyph, and the sprouts table

`SPROUT_STATE_ICONS` goes in `components/admin/glyphs.tsx` beside
`PLANT_STATUS_ICONS`, and `SproutStateGlyph` beside `StatusGlyph`.

`/admin/sprouts`' state column stops drawing `<Badge>{state}</Badge>` and draws
the glyph. That is not decoration: `plant-hero.tsx` argues that a header's icon
must be **imported from** the table's map rather than re-picked from the same
lucide names, because a comment claiming the two agree is what a third `Zap`
silently falsifies. The sprouts table has no map to import today, so the claim
would be unmakeable — including the table is what makes it true, and it is the
same harmonization this slice is for: the icon on the header is the icon on the
row that links to it.

Every glyph carries its word in an `sr-only` span from `lib/glyphs.ts`. No
value is ever icon-only in the accessibility tree.

`lib/glyphs.test.ts` and `components/admin/glyphs.test.tsx` grow the sprout
state cases.

## 9. Files

**New**

- `lib/sprout-state.ts` — vocabulary, client-safe
- `lib/sprout-meta.ts` — `buildSproutMetaPatch`, `BlankSproutNameError`
- `app/admin/_components/sprout-hero.tsx` — the island
- `app/admin/_components/sprout-meta-form.tsx` — server component
- `app/admin/_components/sprout-delete-form.tsx` — extracted from the page
- `app/admin/_components/entity-rail.tsx` — the shared shell

**Modified**

- `components/plant-header.tsx` — `mark` optional
- `components/editor/prose-editor.tsx` — `float`, debounced dirty, four appearances
- `components/admin/glyphs.tsx` — `SPROUT_STATE_ICONS`, `SproutStateGlyph`
- `lib/glyphs.ts` — `sproutStateLabel`
- `lib/sprouts.ts` — `STATES` imported from `lib/sprout-state.ts`
- `lib/sprout-edit.ts` — down to `shouldCascadePublish`
- `lib/botanical.ts` — four narrow writers in, `updateVersion` out, `deleteVersion` → `deleteSprout`
- `app/admin/actions.ts` — four actions in, `editVersionAction` out, `deleteVersionAction` → `deleteSproutAction`
- `app/admin/(chrome)/sprout/[slug]/page.tsx` — rewritten
- `app/admin/_components/sprout-table.tsx` — Badge → glyph

**Tests**

- `lib/sprout-state.test.ts` — the vocabulary, `stateOf`'s absent-⇒-draft default
- `lib/sprout-meta.test.ts` — the patch builder, the blank-name throw
- `lib/sprout-hero-a11y.test.ts` — the three triggers name their stored value
- `lib/entity-rail-source.test.ts` — the rail composes no payload
- `lib/media-picker-mount.test.ts` — updated to the media form's new file
- `lib/garden-cache-source.test.ts` — the four new actions read live and revalidate
- `lib/glyphs.test.ts`, `components/admin/glyphs.test.tsx` — sprout state cases
- `lib/sprout-edit.test.ts` — trimmed to `shouldCascadePublish`; the
  `buildSproutPatch` / `validateSproutPatch` cases move to `lib/sprout-meta.test.ts`
  in the form the narrow patch takes, and the state and date coercions they
  covered move to `lib/sprout-state.test.ts`

`actions.ts` is already 963 lines and flagged for splitting by entity (ROADMAP
item 6). The four new actions stay in it rather than seeding
`app/admin/actions/sprout.ts` now: a half-migration would leave sprout actions
in two files, and the split wants to move all of them at once behind one
`withEntity` guard.

## 10. What this slice does not do

- **Bean, pod and screen.** They keep their current pages. The shells this
  slice extracts — the optional mark, `entity-rail.tsx` — are what they will be
  built against.
- **Auto-save.** Deferred; §7 says what remains.
- **A type vocabulary.** §3.4 says why inventing one from the types that
  happen to exist would be worse than free text.
- **`ATOM_PREFIX`.** Stays for #88.
- **`PlantRail`'s popover.** The plant's Exhibition panel keeps its popover and
  its 7rem nudge. Converting it to `entity-rail.tsx` is the obvious follow-up
  and belongs to the plant's turn, not the sprout's — a w-80 list of thumbnails
  is not cramped the way a markdown source is, so the panel shape is not
  clearly wrong there.
