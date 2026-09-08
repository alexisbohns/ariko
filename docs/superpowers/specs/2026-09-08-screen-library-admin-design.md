# The screen library — the admin surface

*2026-09-08*

Follow-on from the screen store ([`2026-09-08-screen-store-design.md`](2026-09-08-screen-store-design.md) §6.1),
filed as issue #70.

## 0. Where this starts

The store landed a hundred and seventy Paulopus screens in Mongo and
Cloudinary, named from their filenames, legends blank, private at birth. It
renders nothing. Nothing edits them, nothing lists them, and the only way to
see one is to query the collection.

So this slice is the *reader and the writer*, and it is the first surface built
against the `Screen` shape. Two properties of the store decide most of what
follows: a screen is a `Bean` that happens to hold an image, so its containment
is `parents[]` and everything else is `relations[]`; and there are a hundred and
seventy of them, which is what rules out every design that renders one editor
per screen.

## 1. The shape: a library, and a sheet that is a route

`/admin/screens` is a **contact sheet** — the screens as thumbnails, because a
screen is found by looking at it. A hundred and seventy rows of
`match-hero-m104-final-spain-argentina-aet` are not scannable by eye, and the
names are honest stems rather than written titles precisely because the author
was never going to write a hundred and seventy of them.

Editing happens in a **side sheet on the right that pushes the page left** —
`PlantInside`'s move, promoted from a popover to a real panel. The reason it is
a pushing sheet rather than an overlay is the whole design: **the list stays
visible and stays clickable**, so the author edits one screen, sees the next one
they meant, clicks it, and the panel swaps. An overlay would make that two
gestures and a lost place.

And the sheet is **a route rendered in a modal slot**, not a client-side editor:

```
/admin/screens                        the library      (fifth section, wide column)
/admin/screens/new                    the create page  (reading column)
/admin/screens/[slug]                 one screen       (reading column)

app/admin/@sheet/(.)screens/[slug]    the same body, in the side sheet
app/admin/@sheet/(.)screens/new       likewise
app/admin/@sheet/default.tsx          null, on every other admin route
```

Each tile is a real `<a href="/admin/screens/[slug]">`. With script, Next
intercepts the soft navigation and the editors arrive in the panel without
leaving the grid; the index page underneath is *not* re-rendered, which is what
keeps the author's scroll position and is what makes tile-to-tile swapping
instant. Without script, the same click is an ordinary navigation to a page
where every field still works.

That is the property worth stating plainly, because it is what keeps
CLAUDE.md's exception list at six:

> **The panel renders nothing that does not already exist as a page.** Its
> absence costs nothing — every screen it edits has its own route, every
> control in it is an `<a href>` or a `<form>` that route also renders. It is
> the TOC rail's case, not the plant header's.

The one thing script-off loses here is the picker, exactly as on the bean page,
and that exception is already spent.

### 1.1 `next/link`, for the first time in this repo

Interception only happens on a client-side navigation, so the tiles must be
`next/link`. Nothing in `app/` or `components/` imports it today — every
navigation in both zones is a plain `<a href>`, including the chrome's own rail.
This slice introduces it, and confines it to the screens grid and the panel's
own three controls.

The confinement is the point rather than caution: `Link` renders a real anchor
with a real `href`, so the no-script path is byte-identical to what a plain
`<a>` would have produced. Nothing else in the admin gains or needs it.

### 1.2 The push

The layout renders the shifted wrapper and the `@sheet` slot as siblings, and
the wrapper shifts on `:has(~ [data-screen-sheet])` — **pure CSS, no client
state, no open flag**. That is the same idiom `plant-inside.tsx` already uses to
hold its plate open while a portaled popover has focus
(`md:has-[[aria-expanded=true]]:…`), and it is what lets a route-driven panel
push a page that knows nothing about it.

`transition-transform` and nothing else, for the reason `PlantInside` gives: a
transform does not re-flow the document, so the grid keeps its columns and its
scroll position while the panel arrives.

Suppressed below `lg`, where the panel covers rather than pushes — the same
threshold and the same reason: sliding a narrow column that far would push it
under the chrome's own rail.

If the sibling `:has()` proves awkward in Tailwind v4's arbitrary-variant
syntax, the fallback is that the page does not move and the panel floats over
the right of the grid. Worth naming because it is a *degradation, not a
breakage*: nothing about the editors or the navigation depends on the push.

### 1.3 The panel's header

Top-left a prev/next pair, top-right a close. All three are server-rendered
`<a href>`, never `router.back()` and never a click handler:

- **prev/next walk the list the author is actually looking at.** The tiles'
  hrefs carry the active filters (`/admin/screens/karma-top?plant=paulopus`), so
  the slot re-derives the same filtered, sorted rows from its own `searchParams`
  and finds the neighbours. Pure arithmetic (`neighbours` in `lib/screens.ts`),
  table-tested, and correct on the standalone page too — where prev/next work
  with no script at all.
- **close** is `/admin/screens?<filters>`, which on the standalone page reads as
  `← library`.

`Escape` and `←`/`→` are bound over those same three hrefs by a small client
component. That is the vault filters' category of affordance: script-off costs
the *keys*, never a destination.

### 1.4 The open tile is marked by the panel

The index page cannot know which tile is open — interception is exactly what
keeps it from re-rendering — so the panel says so itself, by emitting one
attribute-selector rule for its own slug against the `data-screen-tile` the
tiles carry. Three lines of CSS in the slot, no client code, correct by
construction on every swap.

## 2. What a screen's page holds — three forms

The bean page's arrangement, one species over, and the three forms are separate
for the reasons that page records rather than for tidiness.

### 2.1 Image — the picker, alone

`ScreenImageForm` is nothing but `MediaPicker` (`max={1}`,
`submitLabel="Save image"`), so the picker renders the submit button and
script-off there is no button at all: inert rather than destructive, which is
CLAUDE.md's rule verbatim. It is the fourth member of that family, after the
sprout media card, the plant Logo card and the bean Cover card.

`buildScreenImagePatch` is the fourth sibling of `buildMediaPatch`,
`buildPlantLogoPatch` and `buildBeanCoverPatch` — the same `__ready` guard, the
same dirty gate, the same failed-save discriminator — plus one rule none of them
has:

> **A clear is not expressible.** `Screen.image` is required; a screen with no
> image is not a screen. So where `buildBeanCoverPatch` reads "zero fields
> submitted" as a deliberate clear-all, this reads it as *nothing to do*.

That asymmetry is why it is a sibling rather than a generalization of the other
three. The three cross-reference each other in comments; this one joins that
list, and the day the guard changes in one it must be checked in four.

The writer, `updateScreenImage`, is a plain `$set` with no `$unset` twin — so it
does **not** become the fourth copy of the `$set`/`$unset` shape that
`updateBeanCover`'s comment warns about. (§2.2's writer is where that warning
gets honoured.)

### 2.2 Meta — ordinary, zero-client-JS

One form, one Save, five things: name (en/fr), legend (en/fr), tags, the plant,
and the related bean. Native controls (`NativeSelect`), a real submit button,
works without script — which is what every admin metadata form but the six
exceptions still is.

- **Name** may not be blank in both halves. `buildPlantMetaPatch`'s stance, for
  a related reason: a blank plant name is a public claim rendered wrongly, and a
  blank screen name is a screen that cannot be found in a library of a hundred
  and seventy.
- **Legend** blank means *clear*, as `lib/bean-keyword.ts` argues: the field
  belongs to a record that already exists, so a blank has to cross the wire as
  an instruction rather than as an absence.
- **The plant** is a `NativeSelect` writing `parents[]`. It is the one deviation
  from the issue's list of editable fields, and it is deliberate: containment is
  set once by the import or the create form, and without an editor here a
  mis-parented screen has no path back. `updateVersion`'s "an edit can never
  re-parent" promise is not contradicted — that promise is about a form with no
  parent input; this form has one, explicitly, and the writer names `parents`
  literally.
- **The related bean** is a `NativeSelect` (*— none —*, then every bean) writing
  at most one `{ kind: "shows", ref: "bean:…" }` and **carrying every other
  stored relation through verbatim**. That last clause is load-bearing: the
  import wrote `{ kind: "cover" }` on the eight screens the landing row already
  uses, and that relation is the mapping issue #73 depends on. A relations
  editor that replaced the array wholesale would silently delete it.

The writer is `updateScreenMeta`, and the update document is built by a pure,
tested `screenMetaUpdate(patch)` rather than composed inline. That is
`plantMetaUpdate`'s lesson applied on sight rather than after the fact: this
patch `$set`s name and parents while `$unset`ting a cleared legend, empty tags
and empty relations, and composing two update operators with a spread is
precisely what dropped two of three fields silently in `lib/plant-meta.ts`.

Omission discipline throughout: a blank optional field is **absent**, never a
stored `""` or a materialized empty array — `createScreen`'s rule, and the
reader who pays for breaking it is the gallery's "has a caption" filter.

### 2.3 Delete — a document, and a confirmation

`deleteVersionAction`'s shape exactly: a required confirm checkbox, re-checked
server-side because the browser's `required` is only UX, and a redirect back to
the library.

**The document goes; the Cloudinary asset stays.** That is not laziness, it is
the only correct answer while covers are still inline: `Bean.cover` holds its
own copy of the same asset for the eight cover screens, so deleting the bytes
would break the landing row. `lib/orphan-assets.ts` already enumerates all four
homes of a `storageKey` — screens included — so a genuinely unreferenced asset
is `npm run check:orphans`'s to sweep, and one a bean still points at is
correctly reported as referenced.

The card says so when the screen carries a `cover` relation, rather than leaving
the author to reason about it.

## 3. The index

Rows come from `loadRawGarden()` — the admin's read path, and the only one that
sees private screens (all hundred and seventy of them are private at birth).
`buildDataset` has no screens accessor and does not grow one here: `Dataset` is
the *read model*, and nothing public reads screens until the gallery slice.

- **Tiles.** `aspect-[3/4]` box, `object-contain` on muted ground, so a 9:19.5
  phone capture is shown rather than cropped into a square. Name under it, the
  plant as an `EntityAvatarGlyph` (the island the vault and the palette already
  share, imported rather than reproduced), a bean chip, and a `cover` marker
  when the image is in service.
- **Order.** `capturedAt` descending, then slug — newest capture run first, with
  a stable tie-break, since the import gives a whole run one date.
- **`showing N of M`**, the vault's line.
- **Empty state** names `npm run import:screens` and links to the create page.

### 3.1 Filters, generalized rather than copied

Plant, related bean, tag — server-side, shareable URLs, exactly as `lib/vault.ts`
filters sprouts.

`VaultFilters` is **extended, not duplicated**: its `key` union grows `"bean"`
with an icon and a hotkey in the same `DIMENSIONS` table, and it is renamed
`AdminFilters` (`admin-filters.tsx`) now that it serves two pages. The href
builder both pages need becomes a pure, tested `filterHref` rather than a second
copy of `vaultHref`.

This is the rule CLAUDE.md states for the shared surfaces, applied inside one
zone: if two pages draw the same thing, they draw it from the same file, and
what differs is a parameter.

### 3.2 Filters survive writes

Every form carries the index's query string in a hidden field, and the actions
redirect to `/admin/screens/[slug]?<filters>` (delete → `/admin/screens?<filters>`).
Without it, the first save drops the author out of the filtered set they were
working through.

That field is client-controlled, so it is **re-canonicalized server-side**
through `URLSearchParams`, keeping only the three known keys and re-emitting
them in a fixed order. A hidden field that reached `redirect()` intact would be
an open redirect; one that can only ever produce `plant=`, `bean=` and `tag=` on
a known path is not. Pure, and tested as such.

## 4. The fifth section

One line in `NAV_ITEMS` buys three things, which is the whole argument for
putting it there rather than hanging the page off the plant page:

- the rail icon (`Images`), via `admin-chrome.tsx`'s `ICONS` map;
- the wide column, because `resolveColumn` reads `NAV_ITEMS` rather than a
  parallel list — the index is a section index, so it is wide, and
  `/admin/screens/[slug]` falls through to the reading column;
- a palette row, because `sectionItems()` is built from `NAV_ITEMS` too.

One `SECTIONS` entry (`["/admin/screens", "/admin/screens"]`) lights the rail
from the children as well as the index. Note for the next reader: the file's
comment ("no prefix here is a prefix of another") is now one edit away from
being false — a singular `/admin/screen` route, added in the shape every other
species uses, would be a string prefix of this one.
`resolveNavItem`'s boundary check (`path === prefix || path.startsWith(prefix + "/")`)
already handles it correctly; a test pins that rather than the comment.

**Individual screens are not indexed in the palette.** A hundred and seventy
filename-derived names would be the largest group in it by a factor of three,
and the palette's own rule is that every row is a *faster* route to a page that
still has its slow route. The library's filters are the way to find a screen;
the "Go to → Screens" row is the fast route to them.

## 5. The modules

Pure first, so `npm test` reaches everything that decides anything:

- **`lib/screens.ts`** — the index's arithmetic. `screenRows(raw)` (resolved
  names, the plant, the related bean derived from `relations[]`, the cover
  marker), `filterScreens(rows, filters)`, the three `distinct*` helpers,
  `neighbours(rows, slug)`, and `screensQuery(raw)` for §3.2.
- **`lib/screen-edit.ts`** — `buildScreenMetaPatch(current, form)` and
  `screenMetaUpdate(patch)`.
- **`lib/screen-image.ts`** — the picker sibling of §2.1, shared by create and
  replace.
- **`lib/screen-create.ts`** — `buildNewScreenInput(form)`: slug validation, the
  name falling back to `screenNameFromStem(slug)` when left blank (so the admin
  and the import derive names from the same function), the image required, the
  `__ready` marker required.
- **`lib/image-url.ts`** — a `cloudinaryFit(url, { width })` beside
  `cloudinaryThumb`: shrink to a width with `c_limit`, no crop. A separate
  export rather than an options union, because the two intents genuinely differ
  — "crop into a box" and "shrink to a width" — and the host, marker and
  idempotency guards are shared by an internal helper.
- **`lib/botanical.ts`** — `listScreens`, `getScreen`, `updateScreenMeta`,
  `updateScreenImage`, `deleteScreen`. Each names its fields explicitly rather
  than spreading, which is what keeps a widened caller from reaching `slug`,
  `image` or `visibility` from a form that has no business touching them.
- **`app/admin/actions.ts`** — `createScreenAction`, `editScreenMetaAction`,
  `editScreenImageAction`, `deleteScreenAction`.

### 5.1 Create

`/admin/screens/new`: slug and name inputs, a plant select, and the picker
holding the submit button. It is the one form in the admin that mixes the picker
with text inputs, and that is a decision rather than an oversight:

> **A create that refuses costs nothing.** The two rules the picker's family
> obeys — inert rather than destructive, and never depending on the island —
> are about forms that edit a record that already exists. Script-off, this form
> renders its fields, renders no button (the button is inside the island), and
> cannot create anything. Nothing is lost, because nothing existed.

Two text inputs rather than one is load-bearing, incidentally: a lone text input
in a button-less form submits on Enter, which is the trap the bean Keyword form
documents. With two, there is no implicit submission at all — and the action
refuses a payload with no `image__ready` regardless.

The slug is validated against `/^[a-z0-9][a-z0-9-]*$/`, the pattern
`lib/articles.ts`, `lib/federation.ts` and `lib/pollen.ts` each already carry.
A collision raises `SlugExistsError` from `createScreen`, which the action turns
into a message rather than a 500 — the path that exists only because
`ensureBotanicalIndexes` gives `screens` a unique slug index.

## 6. Tests

- **`lib/screens.test.ts`** — rows (name resolution, the plant, the related bean
  from a `shows` relation *and* from a `cover` one, the cover marker), the three
  filters, the distincts, `neighbours` at both ends and on a missing slug,
  `screensQuery` dropping unknown keys.
- **`lib/screen-edit.test.ts`** — the dirty gate (open and save writes nothing),
  blank name refused, legend cleared by `$unset`, tags parsed and emptied, the
  plant re-parented, a `shows` relation replaced **while a `cover` relation
  survives**, and `screenMetaUpdate` emitting exactly one `$set` and one
  `$unset` key (the `plantMetaUpdate` regression, pinned in advance).
- **`lib/screen-image.test.ts`** — the `__ready` guard, the dirty gate, the
  failed-save discriminator, and the no-clear rule.
- **`lib/screen-create.test.ts`** — slug shape, the `screenNameFromStem`
  fallback, the image and `__ready` requirements.
- **`lib/admin-nav.test.ts`** — the fifth section, the child routes lighting it,
  the wide/reading column split, and the `/admin/screen` ↔ `/admin/screens`
  prefix boundary.
- **`lib/image-url.test.ts`** — `cloudinaryFit`: the transform, a non-Cloudinary
  URL untouched, idempotency.
- **`lib/screen-sheet-source.test.ts`** — the claim §1 rests on, pinned the way
  `lib/chrome-source.test.ts` and `lib/plant-hero-mount.test.ts` pin theirs:
  the intercepted slot imports the **same** editors module the page does, and
  the tiles navigate by `href` rather than by a click handler. Both violations
  pass `tsc`, `npm test` and `npm run build` while silently killing the
  no-script path, which is exactly the shape of failure a source test is for.
- **`lib/botanical.test.ts`** — DB-gated round trips for `updateScreenMeta`,
  `updateScreenImage` and `deleteScreen`, under the existing `{ skip: !hasDb }`
  gate and the `__test__` slug convention, and therefore part of
  `npm run test:db` rather than `npm test`.

## 7. Deliberately absent

Stated so each reads as a decision rather than an oversight:

- **Visibility editing.** Nothing public reads screens until the gallery slice,
  so a control here would write a field with no reader. The store's "private at
  birth" is a decision the gallery slice flips deliberately, per screen.
- **`exhibited` and `order`** — the gallery's, and still absent from the type
  for the store spec's reason.
- **Bulk operations.** Multi-select, bulk retag, bulk delete. A hundred and
  seventy screens is exactly the size where this starts to look necessary and is
  not yet: the import wrote them correctly, and the author's real task is
  sharpening the handful that reach a page.
- **Covers as screen references** — issue #73, unchanged by this slice and
  slightly helped by it: the `cover` relation now has a surface that shows it.
