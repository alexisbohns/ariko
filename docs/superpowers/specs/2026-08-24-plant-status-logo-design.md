# Plant Status & Logo — design

**Date:** 2026-08-24
**Status:** approved, ready to implement
**Slice:** the plant tier learns whether it is still alive, and what it looks like

---

## 1. Intention

Two gaps, one tier, one admin page — which is why they ship together.

**Status.** The landing gallery lists every plant in one undifferentiated run. Enerfip and Paulopus
are finished chapters; Ariko and Femfolk are current work. A visitor reading top to bottom has no
way to tell, and the role line does not say it — `Lead · Head of Product` is equally true of a job
held today and a job held in 2022. Status is that distinction, made explicit.

**Logo.** A plant is a *brand* — Enerfip, Melogram, Femfolk all have marks of their own — and the
gallery currently renders each one as bare type. A rounded-square logo above the section title gives
each plant its own visual identity in the gallery, and turns a wall of headings into a portfolio.

Neither field is an internal organizing fact. Both are public and both are read.

## 2. The model

In `lib/data.ts`, beside `PlantNature` and `PlantRole`:

```ts
export type PlantStatus = "active" | "inactive";

export interface Plant {
  // …
  status?: PlantStatus;  // absent ⇒ treated as "active"
  logo?: MediaImage;     // ONE image — an embed is not a logo
}
```

**Both are optional, and `status` is default-tolerant** — the opposite of the choice `role` made one
slice ago, deliberately. `role` is required because there is no honest default: "unclassified plant"
is not a thing. `status` has one. An unmarked plant is a plant Alexis is still on, which is a *true*
reading of absence rather than a convenient one, so `status ?? "active"` makes the TypeScript type a
promise the database keeps. The practical consequence is that this slice needs **no backfill script**
and no fixture churn: every existing plant is already correct.

**`logo` is a single `MediaImage`, not `Media[]`.** A plant has one mark. Modelling it as an array
would make "the first entry is the logo" an implicit rule enforced nowhere, and would admit a
`MediaEmbed` — a SoundCloud player — into a field that is a square image by definition. The type
says image, once.

**`filterPublic` needs no new scrub.** Neither field carries entity refs, and there is no such thing
as a private status or a private logo: if the plant is public, so are both. This is the same
argument `PlantRole` already makes, and it holds for the same reason.

**Validators.** `scripts/apply-validators.ts` gains, inside the existing `plants` validator:

```ts
status: { enum: ["active", "inactive"] },
logo: {
  bsonType: "object",
  required: ["kind", "storageKey", "url"],
  properties: { kind: { enum: ["image"] } },
},
```

`status` is not added to `required[]` — absence is a valid, meaningful state.

## 3. Vocabulary

One word, everywhere: **Inactive**.

The stored value is `"inactive"`. The landing divider reads `Inactive`. The plant-page badge reads
`Inactive`. The admin select offers `active` / `inactive`, matching the lowercase convention the
role select already uses for `kind`.

No synonyms — not "Previously", not "past", not "archived". A vocabulary with three display forms
for one stored value is three chances to drift, and the drift is silent because each surface reads
correctly on its own.

Display forms live in `lib/plant-status.ts` (§6) so the landing, the plant page and the admin cannot
disagree — the same containment `lib/plant-role.ts` provides for role labels.

## 4. Admin — the Meta card

`app/admin/plant/[slug]/page.tsx` today has a Role card and a Content card, and **no way to edit a
plant's name or description at all**. Those are typed into MongoDB by hand. The Meta card closes
that gap and is where `status` belongs — status is a fact about the plant, not about Alexis's
relationship to it, so putting it on the Role card would be a category error.

New component `app/admin/_components/meta-card.tsx`:

| Field | Control | Notes |
|---|---|---|
| Name | `Input` ×2 (en / fr) | at least one non-blank, else `?error` |
| Description | `Input` ×2 (en / fr) | optional as a whole |
| Status | `NativeSelect` | `active` / `inactive` |

**Zero-client-JS**, per CLAUDE.md: styled native controls from `components/ui/native-controls.tsx`
posting to a server action. No Base UI composites, no hidden script-populated inputs.

**Prefills use strict `textPart`, never `resolveText`.** `resolveText` falls back across languages
on read; used as a form default it would copy the fr half into the en box and save it back *as* en.
The Role card documents this trap; the Meta card inherits the rule.

**Slug is not editable.** It is the identity every `parents[]` ref points at; renaming it from a
metadata form would orphan every pod and bean beneath the plant with no cascade to catch it. A slug
change stays a manual, deliberate act.

**Description follows the omit-blank rule.** `composeText` returns `""` when both parts are blank,
and `""` is never stored — a stored empty string renders as a dangling line. This is the same rule
`buildPlantRolePatch` applies to `title` and `detail`, with one difference forced by the tier: a
plant that *already has* a description and whose form comes back blank must lose it, so the builder
reports the blank explicitly (`description: null`) and the writer turns that into an `$unset`.
Omitting the key from the patch, as the role builder does on a create-shaped write, would silently
leave the old description in place.

**Name does not.** A plant's `name` is `Text` and required by the type. A save that would blank it
entirely is rejected with a redirect to `?error=` rather than written — the loud-failure precedent
`InvalidRoleKindError` sets, for the same reason: a nameless plant is a public claim the site cannot
render.

### 4.1 The write path

- **`lib/plant-meta.ts`** — pure. `buildPlantMetaPatch(form): PlantMetaPatch`, throwing
  `BlankPlantNameError` and `InvalidPlantStatusError`. Mirrors `lib/plant-role.ts` in shape.
- **`updatePlantMeta(slug, patch)`** in `lib/botanical.ts` — a **sibling** of `updatePlantRole`,
  not a widening of anything. It names `name`, `description` and `status` explicitly rather than
  spreading a patch, for the reason `updatePlantRole` gives: a spread is what would let a later
  caller reach `visibility`, `natures` or `logo` from a form that has no business touching them.
  A blank description arrives as an explicit `$unset` of `description`; status is always `$set`.
- **`editPlantMetaAction`** in `app/admin/actions.ts` — mirrors `editPlantRoleAction`: load raw,
  404-guard the slug, build, catch the two errors into `?error=`, write, then `revalidatePath` the
  same surfaces the role action does (the landing and the plant page both render these fields) plus
  `/admin/garden`, whose table shows name and status.

## 5. Admin — the Logo card

Its own card, its own form, its own action — `editPlantLogoAction`. Separate from the Meta card by
necessity: the Meta card is zero-client-JS and the picker is a client island, so merging them would
make a metadata form depend on script.

```tsx
<MediaPicker name="logo" initial={plant.logo ? [plant.logo] : []} links={false}
             max={1} submitLabel="Save logo" />
```

**This is the sprout media card's case, not a third exception.** CLAUDE.md's rule is that the
picker's absence never costs anything: a form it merely *adds* to still submits, and a form that is
*only* the picker goes inert rather than destructive. The Logo card is only the picker, so the
picker renders the submit button (`submitLabel`) and script-off the card offers no button at all —
inert, exactly as specified. No existing form changes behaviour, and the widening CLAUDE.md warns
about does not occur.

**One change to `MediaPicker`: a `max?: number` prop.** When the list is full, the add-controls
(the file input and, when `links`, the link field) are not rendered; existing rows stay removable.
`links={false}` already excludes embeds from the UI; the builder rejects them from the payload too,
because the UI is not the contract.

**`buildPlantLogoPatch(current, form)`** in `lib/plant-logo.ts`, mirroring `buildMediaPatch`:

- Dirty-gated. Opening the page and saving untouched writes nothing.
- **Refuses to write without the `logo__ready` marker.** Same defence in depth `buildMediaPatch`
  applies, for the same reason: a POST that never rendered a picker cannot know what the plant
  holds, so its empty payload is not a clear-all. The marker name is derived from `name`, so the
  field name and the marker stay one contract.
- Drops non-image entries, then takes the first.
- An empty list **with** the marker present is a deliberate clear → `$unset: { logo: "" }`.

Writer `updatePlantLogo(slug, logo | null)` in `lib/botanical.ts`, a sibling again — `$set` on a
logo, `$unset` on a clear, and nothing else reachable.

Images upload through the existing `uploadImageAction` to Cloudinary. Nothing about the upload path
changes.

## 6. Public — the landing gallery

`app/(public)/page.tsx`.

**The split.** `splitPlantsByStatus(plants)` in `lib/plant-status.ts` returns `{ active, inactive }`,
each preserving dataset order. The page renders active plants first, exactly as today. If — and only
if — `inactive` is non-empty, an **Inactive** divider is rendered, followed by those sections.
`Unrooted` keeps its current markup and moves to the very end, after the inactive plants: it is the
catch-all, and a catch-all belongs last.

**The divider is not a peer of a plant title.** A plant's name is the `h2` rank on that page. The
divider renders as a thin top rule plus a small uppercase `tracking-widest` label — the same
typographic register the `roleLine` subtitle already uses — wearing the page's `GUTTER` like every
other block. Rendering it as a `font-display text-3xl` heading would make "Inactive" read as loud as
"Femfolk", which inverts the hierarchy the split exists to create.

**No dimming, no per-plant tag.** Separation carries the meaning; opacity would say "deprecated"
where the page means "finished". An inactive plant's cards, cover images and role line render at
full contrast, identically to an active one.

**The logo.** Above the `h2`, inside the same padded column:

- `rounded-xl`, ~48px square (`h-12 w-12`), `object-cover`.
- Served through `cloudinaryThumb(url, { width: 96, height: 96 })` — 2× for retina, the same
  treatment the entry covers already get.
- `alt=""`. It is decorative: the plant's name is the very next element, so alt text would make a
  screen reader say the name twice.
- `loading="lazy"`, `decoding="async"`, matching the cover images.

**Absent ⇒ nothing drawn.** No placeholder square, no initial. The title sits exactly where it does
today. A mixed gallery is briefly ragged while logos are still being uploaded; an empty frame would
be permanently wrong.

## 7. Public — the plant page

`app/(public)/(chrome)/plant/[slug]/page.tsx`.

- The logo renders above the `h1`, same rounded square, same rules.
- An inactive plant carries a `secondary` `Badge` reading **Inactive**, beside the natures and after
  the role badge. A page reached directly — from a search result, a link, the graph — has no
  divider above it to carry the fact, so the badge is where the status becomes visible. An active
  plant carries no badge: "active" is the unmarked default everywhere else in this design, and a
  badge saying so on every plant page would be noise.

## 8. Admin — the remaining surfaces

- **Plant page header** (`app/admin/plant/[slug]/page.tsx`): the logo as a small thumb beside the
  title, and a status badge alongside the existing `plant:slug` / role / visibility badges.
- **Garden table** (`app/admin/garden/page.tsx`): a `status` column, showing `—` for pods (status
  lives at the plant tier only, exactly as `role` does).

## 9. Tests

Node's test runner, `npm test`, matching the existing `lib/**/*.test.ts` layout.

**`lib/plant-meta.test.ts`**
- A blank name in both languages throws `BlankPlantNameError`; the action turns it into `?error=`.
- An fr-only name is valid — the same B1 rule the role title follows.
- A blank description is omitted from the patch as an `$unset`, never stored as `""`.
- An unknown `status` throws `InvalidPlantStatusError` rather than falling back — a wrong status is
  a public claim about whether work is current.
- A missing `status` field in the form is treated as `"active"`.

**`lib/plant-logo.test.ts`**
- Untouched form ⇒ `{ dirty: false }`.
- Missing `logo__ready` marker ⇒ `{ dirty: false }`, even when the plant has a stored logo.
- A `MediaEmbed` in the payload is dropped, not stored.
- Two images in the payload ⇒ the first is taken.
- Empty list **with** the marker ⇒ a clear.

**`lib/plant-status.test.ts`**
- `splitPlantsByStatus` preserves dataset order within each group.
- A plant with no `status` lands in `active`.
- All-active input yields an empty `inactive` (so the divider is not rendered).

**`components/media-picker-mount.test.ts`** (existing, extended)
- With `max={1}` and one entry, the add-controls are not rendered; the remove control still is.

## 10. Out of scope

- Status at the pod or bean tier. Containment already implies it: a pod under an inactive plant is
  inactive by inheritance, and a second stored flag would be a second source of truth.
- Dates (`since` / `until`). A real date range is a richer feature and a separate decision; it is not
  needed to answer "is this current?".
- Status as a graph attribute or a filter in `/api/graph`.
- Logos at any tier below the plant. Beans and pods have covers, derived from their sprouts.
- Any change to slug editing, publish cascades, or the visibility model.

## 11. Lab Note

This slice is visitor-facing — the landing gallery gains logos and a visible split — so the PR
carries a Lab Note, pod `ariko`, type `feature`.
