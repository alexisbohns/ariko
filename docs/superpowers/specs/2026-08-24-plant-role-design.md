# Plant Role — design

**Date:** 2026-08-24
**Status:** approved, ready to implement
**Slice:** the plant tier learns to say what you are to it

---

## 1. Intention

A visitor scanning Ariko sees a row of plants — Pebbles, Arkaik, Enerfip, Teale — and has no way
to know that some of them are things Alexis *built* and others are things Alexis *works on*. Those
are very different claims, and today the site makes neither.

`role` is that claim, made explicit at the plant tier: **a public credibility signal**, not an
internal organizing fact and not (yet) a graph attribute. It is meant to be *read*.

Worked examples, which the design must express without contortion:

| Plant | kind | title |
|---|---|---|
| Pebbles, Arkaik, Paulopus, Femfolk, Melogram, Bohns Music | `owner` | — |
| Oxymore | `co-owner` | — |
| Enerfip | `lead` | "Head of Product" |
| Teale | `lead` | "Product & Design Lead" |
| Skilleteplaît (future) | `contributor` | — |

The enum is the spine; the title is the truth. Both render.

## 2. The model

In `lib/data.ts`, beside `PlantNature`:

```ts
export type PlantRoleKind = "owner" | "co-owner" | "lead" | "contributor";

export interface PlantRole {
  kind: PlantRoleKind;   // the machine-readable spine
  title?: Text;          // the real local title, bilingual — "Head of Product"
  detail?: Text;         // ONE bilingual line of context, never markdown
}

export interface Plant {
  // …
  role: PlantRole;       // REQUIRED
}
```

**`role` is required**, not optional-with-a-default. A plant is by definition something Alexis has a
relationship with; there is no meaningful "unclassified plant". This is a deliberate departure from
the codebase's two existing softness precedents — `Bean.description` is optional because every bean
predates it, and `visibility` is "default treated as public" — and it is taken knowingly, because a
tolerant read (`role ?? owner`) would make the TypeScript type a promise the database does not keep.
This repo has been careful not to do that.

The cost is named up front: every plant fixture in the test suite needs a `role`, and every
plant-creating path (`lib/retier.ts`) needs to supply one. That churn is the largest single part of
the diff, and it is mechanical.

**Blank parts are omitted, not stored as `""`.** A blank `title` or `detail` is absent from the
document, the same rule `createBean` already applies to `description` — an empty string would render
as a dangling line.

### 2.1 Why `title` does not replace the enum

The enum label and the title render **together** — `Lead · Head of Product` — rather than the title
superseding the enum. Keeping the vocabulary visible everywhere is what makes it a vocabulary: a
reader who has seen `Owner` on six plants reads `Lead ·` as a deliberate contrast rather than as a
different kind of statement. The redundancy on title-less plants is nil, because they simply render
`Owner`.

### 2.2 Why `detail` is one line and not markdown

Plants already have two prose slots: `description` (one line) and `content` (full markdown narrative
with entity refs). A third markdown slot would compete with `content` for the same job. `detail` is
sized for what the other two cannot say — one sentence of scope and tenure, sitting with the role
rather than with the plant.

## 3. Privacy

`role` rides on the plant document and **contains no entity refs**. `filterPublic` therefore needs no
scrub for it, unlike `relations[]`: there is nothing in a `PlantRole` that could name a private slug.
`detail` never passes through `extractRefs` or the markdown pipeline, so it cannot mirror refs into
`relations[]` either.

The corollary is load-bearing and must be stated where the author can see it:

> **There is no private role.** If the plant is public, its role is public — `detail` included.

The admin card carries that sentence on its face, so `detail` never quietly becomes a scratchpad for
something not meant to be read.

## 4. Rendering

One pure module, `lib/plant-role.ts`, owns the vocabulary → label mapping, so three surfaces cannot
drift apart:

```ts
roleParts(role: PlantRole, lang?: "en" | "fr") → { label: string; title: string | null }
```

`label` is the enum's display form (`owner` → `Owner`, `co-owner` → `Co-owner`, …). `title` is the
resolved custom title, or `null` when absent. Surfaces compose the two; the module does not decide
typography.

| Surface | Treatment |
|---|---|
| `/plant/[slug]` | A `Badge variant="default"` **first** in the existing badge row, ahead of the `secondary` natures: `Lead · Head of Product`, or just `Owner`. `detail` follows as a muted line beneath `description`. |
| `/` (home gallery) | Beneath the plant's display-face `<h2>`, above its description: a small muted line — **not** a badge. `detail` is off this surface. |
| `/admin/garden` | A new `role` column, between `tier` and `visibility`. |

The gallery uses a line rather than a pill deliberately: a badge beside a `text-4xl` display title
reads as UI chrome interrupting the typography, where a small line reads as a subtitle.

## 5. Authoring — the role card

There is no plant *metadata* form in the admin today; `/admin/plant/[slug]` edits only the narrative
`content`. This slice does **not** build the general plant metadata form (that stays parked with
roadmap A3, which owns the harder `slug` / `parents` / `visibility` questions). It builds one narrow
card that edits the role and nothing else — a **sibling** of `ContentCard`, in the idiom this repo
already uses for `writeContent` and `updateSproutMedia`.

The card is **zero-client-JS**, per the CLAUDE.md rule for admin metadata forms.

- **`app/admin/_components/role-card.tsx`** — server component. A plain `<form action={editPlantRoleAction}>`
  carrying a hidden `slug`, a `NativeSelect name="kind"` over the four values (`defaultValue` from the
  stored role), and paired en/fr `Input`s: `title` / `titleFr`, `detail` / `detailFr`.

  Prefills use `textPart(x, "en")` and `textPart(x, "fr")` — **strict**, never `resolveText`. This is
  the same trap `ContentCard`'s comment already warns about: `resolveText`'s en-first fallback would
  load the `fr` half into the `en` box, and the next save would store it as `en`, silently corrupting
  the pair.

- **`lib/plant-role.ts`** — the pure half, alongside `roleParts`:
  - `buildPlantRolePatch(form: FormData) → PlantRole` — `composeText` over both pairs; blank parts
    omitted.
  - `validatePlantRoleKind(raw: string)` — an unrecognized `kind` is an **error**, not a silent
    default. This deliberately differs from `buildSproutPatch`, where an unknown `state` falls back to
    `"draft"`. That fallback is safe because it *hides* things; a wrong role is a public claim about
    Alexis's relationship to someone else's project, and it must fail loudly instead.

- **`lib/botanical.ts`** — `updatePlantRole(slug, role)`. `$set: { role }` with the field **named, not
  spread**, carrying the same rationale as `writeContent` and `updateSproutMedia`: a spread is what
  lets a later, widened caller reach `visibility` or `natures`.

- **`app/admin/actions.ts`** — `editPlantRoleAction`: `requireSession()` → build → validate → on
  failure `redirect('/admin/plant/{slug}?error=…')` (the page already renders that slot) →
  `updatePlantRole` → `revalidatePath` → back to the plant page.

## 6. Migration

Two steps, strictly in this order:

1. **`scripts/backfill-plant-roles.ts`** (`npm run backfill:plant-roles`) —
   `updateMany({ role: { $exists: false } }, { $set: { role: { kind: "owner" } } })`. Idempotent and
   safe to re-run.
2. **`scripts/apply-validators.ts`** — the `plants` validator gains `required: ["role"]` and a `role`
   property (`bsonType: "object"`, `required: ["kind"]`, `kind: { enum: [...] }`). `title` and `detail`
   stay unconstrained, because `Text` is `string | object` — exactly how `name` and `description` are
   treated today. Then `npm run validators`.

Backfill precedes the validator so that no write can be rejected mid-flight. (`validationLevel` is
`"moderate"`, so existing documents are not retroactively rejected either — but the ordering is the
part that should not depend on that.)

Afterwards the four non-`owner` plants are corrected **by hand** through the new card: Oxymore →
`co-owner`; Teale → `lead` + "Product & Design Lead"; Enerfip → `lead` + "Head of Product". This is
deliberate — it makes the form's first real exercise the same act that fixes the data.

## 7. Tests

`lib/plant-role.test.ts` covers the pure half:

- `roleParts` returns the right label for each of the four kinds;
- title present → returned; title absent → `null`;
- `buildPlantRolePatch` composes en/fr for both pairs;
- blank `title` / `detail` are omitted from the result, not stored as `""`;
- an fr-only title is valid (mirrors the B1 rule for names);
- an unrecognized `kind` is rejected rather than defaulted.

Plus the fixture churn from §2. Everything else in the slice is glue over already-tested cascades.

## 8. Out of scope

Recorded as follow-ups, not omissions:

- **`role` in the `/api/graph` plant node payload.** Cheap to add later — `lib/graph.ts:111` already
  decorates plant nodes with `natures` — and deliberately excluded here.
- **Role history over time** (contributor → lead). One current role only.
- **Roles at the pod or bean tier.** The claim is about a body of work, which is what a plant is.
- **The full plant metadata form** (name, natures, visibility). Stays with roadmap A3.

## 9. Lab Note

This slice is visitor-facing — the landing page and every plant page change — so the PR **requires** a
Lab Note.
