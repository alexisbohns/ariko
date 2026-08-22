# Slice 2 — Describe: every entity says what it is

**Date:** 2026-08-22
**Umbrella:** [`2026-08-22-content-composition-design.md`](2026-08-22-content-composition-design.md) §5 — this slice implements the describe layer, with one deliberate deviation (§2.3 below).
**Status:** Approved design, ready for a plan.

---

## 1. Problem

Three gaps, all of them the same gap:

1. **`Bean` cannot describe itself.** Its fields are `slug`, `name`, `parents`, `visibility`, `tags`,
   `projected` — no `description`, unlike `Pod` and `Plant` which both require one. A bean is the
   tier a focus article will land on, and the tier a preview card will point at.
2. **`Pod` and `Plant` descriptions exist and render nowhere.** The Directory shows a plant's name
   and natures, a pod's name, and a bean's name as a bare link. Every description authored in
   `garden.yml` is invisible.
3. **Projected beans are named by their slug.** `deriveProjectedBeans` writes `name: slug`
   (`lib/projected-beans.ts:25`), so a bean materialized from a pollen feed displays as
   `pbbls-webapp` rather than as anything a person wrote.

Slice 3's preview cards need a synopsis to show; the Directory needs one today. This is the same
field the pollen envelope calls `title`'s companion and the Lab Note contract calls `en.summary`:
one short bilingual sentence by which a thing describes itself elsewhere.

## 2. Decisions

1. **`description?: Text` on `Bean` — optional**, unlike `Pod`/`Plant` where it is required. Every
   existing bean lacks one and there is no migration; optional keeps `garden.yml`, the seed importer
   and every existing document valid as-is.
2. **Authored at birth through triage.** The promote form gains one en/fr pair, exactly like the
   name it sits beside (WYSIWYG: the boxes submit what is stored). **Correcting** a description
   later is not in this slice — Track A's *A3 · Re-parent / edit identity & carried fields* already
   owns edit surfaces, and a bean edit page is most of a slice on its own. Beans authored in
   `garden.yml` stay correctable through `npm run migrate`, which `$set`s the whole document.
3. **The cover moves to slice 3** — a deliberate deviation from umbrella §5. `coverFor` would have
   no consumer until the preview card exists, and no data either: **zero sprouts in the database
   carry a `MediaImage`**. Writing a derivation with neither a caller nor a fixture is exactly the
   speculative work YAGNI is for. It lands in slice 3, next to the card that needs it.
4. **Projected beans adopt the materializing envelope's `title`**, falling back to the slug. Name
   only — the pollen envelope has no `summary` field (`docs/POLLEN.md` §envelope), so a projected
   bean still has no description, and that is correct: Ariko never authors facts a source did not
   emit.
5. **A description renders wherever a name renders.** Directory (plant, pod, bean), the public bean
   page as a lede above the article, the admin bean detail header, and the graph payload.
6. **The graph's minimality rule loosens by exactly one field** — see §4, which is the one decision
   in this slice that reverses an earlier one.

## 3. Model

```ts
export interface Bean {
  slug: string;
  name: Text;
  parents: string[];
  description?: Text; // optional — every existing bean predates it (spec §2.1)
  visibility?: Visibility;
  tags?: string[];
  projected?: { source: string; feedId: string; firstPollenId: string };
}
```

`NewBean` (the `createBean` input) gains `description: Text` so the triage path can write one at
creation. Nothing else in the model changes.

## 4. The graph payload — reversing G1's minimality

`GraphNode` today is deliberately minimal, and `lib/graph.test.ts` currently asserts the point with
fixtures whose descriptions read `"secret notes"` and `"secret"`:

> Node payload is deliberately minimal (spec: no description/content/media/source/levers/serves —
> what a focused node displays is B3's decision).

**This slice is that decision, and it goes the other way for `description` alone.** The reasoning:
`/api/graph` composes `filterPublic` before serializing (`app/api/graph/route.ts`), so every node it
emits is already public HTML — a published bean's synopsis is on its page. Withholding it made the
graph *less* useful than the pages it twins, for no protection anyone can point at.

Concretely:

- `GraphNode` gains `description?: string`, resolved via `resolveText`, **emitted only when
  non-blank** — the same "only when it carries something" rule `tags` already follows.
- Emitted for **every** node kind, bees included. A public bee is an explicit per-bee opt-in
  (`visibility: "public"`, the opposite default from every content tier), so its description is
  already a deliberate publication.
- `content`, `media`, `source`, `parents`, `visibility` and `levers` **still never leak**, and the
  tests keep proving it. What changes is the intent of three assertions, from *"no description"* to
  *"description yes, everything else no"*.
- The safety property is unchanged and stays where it has always been: **the route projects, the
  serializer does not.** `toGraph` on a raw garden exposes raw names today; it will expose raw
  descriptions tomorrow. That is why nothing but the route may call it on unfiltered data.

## 5. Read surfaces

| Surface | What it gains |
|---|---|
| `/` Directory | Plant description under the plant title; pod description under the pod heading; bean description under each bean link, muted and one line. |
| `/bean/[id]` | The bean's description as a lede between the `<h1>` and the article prose. |
| `/admin/bean/[id]` | The description under the header, so the vault shows what the public sees. |
| `GET /api/graph` | `description` on every node that has one (§4). |

The Directory becoming a wall of text is the risk worth naming: bean descriptions render as a single
muted line, and nothing on that page renders markdown — descriptions are plain one-liners, not
content. `Prose` stays out of the Directory by design.

## 6. Testing

Pure logic, no DB, per the house rule:

- **`lib/graph.test.ts`** — rewrite the three "must not leak" assertions to admit `description` while
  still proving `content`/`media`/`source`/`parents`/`visibility` never appear; add: a blank
  description emits no key; a localized description resolves en-first; a bee's description is
  emitted.
- **`lib/projected-beans.test.ts`** — a projected bean takes the materializing envelope's title;
  falls back to the slug when the title resolves blank; the *first* envelope wins when several
  claim the same bean slug (matching the existing `claimed` rule).
- **`lib/promote.test.ts`** — a new pure `buildNewBean(form, slug)`: composes name and description
  from the paired en/fr inputs, falls back to the slug when the name is blank (today's behaviour),
  and omits `description` entirely when both boxes are empty.

## 7. Out of scope, seams reserved

- **The cover** — slice 3, with the preview card that consumes it (§2.3).
- **Editing a bean's description** — Track A / A3.
- **Rendering descriptions as markdown** — they are one-liners; `Prose` is for `content`.
- **A `summary` field on the pollen envelope** — would let projected beans describe themselves, but
  it is a contract change, and contract changes belong with the federation slices.
- **Pod and plant pages** — slice 3. This slice only makes their existing descriptions visible on
  the Directory.
