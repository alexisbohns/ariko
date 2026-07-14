# Beanstalk — Bilingual `Text` Widening (name / description) — Design Spec

**Date:** 2026-07-14
**Status:** Approved for planning
**Roadmap:** Track B, item **B1** — first-class bilingual (en/fr) content, deferred since Plan 2a.

---

## 1. Context

The `Text` type (`string | { en?, fr? }`) and `resolveText` have existed since Plan 1, and captures
already carry a bilingual `body` — but the atomic model itself is monolingual: `name`/`description`
are plain `string`, and the triage flow **flattens** a bilingual capture note via `resolveText`
before writing it into a Version. B1 widens the model so bilingual content survives from capture to
exhibition.

### Decisions locked

| Decision | Choice |
|---|---|
| Model | `Molecule.name/description`, `Atom.name`, `Version.name/description` widen from `string` to `Text`. `string` is a member of `Text`, so **every existing document remains valid — no migration.** |
| Strict part access | New pure helper **`textPart(value, lang)`** in `lib/data.ts`: returns exactly that language's part (`string` counts as `en`), **no fallback** — for form prefills, where `resolveText`'s fallback would silently copy `en` into the `fr` box and corrupt data on save. `resolveText` (with fallback) stays the display path. |
| Compose rule | New pure helper **`composeText(en, fr)`**: both blank → `""`; `fr` blank → plain `string` (keeps simple content simple); otherwise `{ en?, fr }` (blank `en` omitted). Used by both form builders. |
| Version forms | Triage promote + edit forms gain optional `fr` inputs for the version's `name` and `description` (`versionNameFr`/`nameFr`, `descriptionFr`). Bare HTML, no toggle — both languages visible, `fr` optional. Prefill via `textPart`. |
| Triage prefill — **WYSIWYG** | The triage **page** prefills per language: name from `capture.title`, both description boxes from `capture.body` via `textPart`. The **builder** never falls back: what the boxes submit is exactly what is stored, so a bilingual note survives promote through the prefilled boxes, clearing a box genuinely clears that language, and a fully cleared name fails validation (consistent with the edit form). *(Revised during review: the original "carry `capture.body` verbatim when blank" rule, combined with prefilled boxes, made deletion inexpressible — clearing the note resurrected it.)* |
| Parent names | New-molecule/new-atom names in the triage form stay plain-string inputs (the model accepts `Text`; bilingual authoring for parents arrives with the A3/A4 editing slices). |
| Validation | "name required" means `resolveText(name)` is non-empty — at least one language present. Messages unchanged. |
| Rendering | Every read surface goes through `resolveText` (default `en`): public pages, admin vault/atom-detail/triage dropdowns/edit context, and `lib/vault.ts` / `lib/atom-detail.ts` row builders (their outputs stay `string` — resolution happens at build time). The public atom page's property dump renders a `Text`-shaped `description` via `resolveText` instead of `[object Object]`. |
| Graph contract | `GraphNode.name` **stays `string`** — `toGraph` resolves via `resolveText`. The graph client's language switch is a D1 concern (a `?lang=` param on `/api/graph` is a cheap later slice); the contract does not change shape now. |
| Language switch | Out of scope. Public pages render `en`-resolved text; a `?lang=fr` query param is deferred to the exhibition work. |
| Validators | `scripts/apply-validators.ts` is checked for any `bsonType: "string"` constraint on the widened fields and updated to accept `string | object` if present. |

---

## 2. Scope

**In scope:** `lib/data.ts` (types + `textPart` + `composeText`), `lib/promote.ts` +
`lib/version-edit.ts` (builders/validators), both version forms, all read surfaces named above,
`lib/vault.ts`, `lib/atom-detail.ts`, `lib/graph.ts` name resolution, validators check, tests.

**Out of scope:** language switcher / `?lang=` params, bilingual parent-name authoring, `content`
rendering (B3), capture-bar changes (the note is already bilingual).

---

## 3. Testing

- `textPart`: string counts as en; exact-part access; no fallback (fr of a plain string is `""`).
- `composeText`: both blank → `""`; en-only → string; fr present → object; blank en omitted.
- `buildVersionInput`/`buildVersionPatch`: compose from paired fields, WYSIWYG (blank boxes store
  blank — nothing resurrected from the capture); the patch's blank description is exactly `""`;
  validation accepts fr-only name and rejects fully-blank name.
- `toGraph`: a `{ en, fr }` name serializes as the resolved string; node shape otherwise unchanged.
- Rendering: `vault`/`atom-detail` builders return resolved strings for `Text` inputs.
- All existing tests must pass unchanged (plain strings are still valid `Text`).

## 4. What this delivers

Bilingual content becomes first-class end to end: a French capture note survives promote, is
editable per-language on the version forms, and renders resolved on every surface — without a data
migration and without changing the graph contract's shape.
