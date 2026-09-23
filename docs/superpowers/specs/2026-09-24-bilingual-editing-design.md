# Editing an article's French half

**Date:** 2026-09-24
**Status:** designed, not yet implemented

## What this finishes

Ariko stores every piece of authored prose as `Text` — a plain string, or
`{ en?, fr? }` — and the public zone reads either half through `resolveText`.
Names, descriptions, legends and keywords already have a paired `(fr)` box in
their meta forms. **Article bodies do not.** The sprout body, the plant
narrative and the pod narrative all load `textPart(content, "en")` into the
editor and post it back as English; `buildContentPatch` carries a stored `fr`
half through verbatim so nothing is lost, but nothing can write it either.

The Tiptap slice ([`2026-08-23-tiptap-editor-design.md`](2026-08-23-tiptap-editor-design.md)
§2.9, and its out-of-scope list: *"an fr box for `content`. §2.9 keeps the data
safe until it lands"*) left this slot open on purpose. This slice fills it.

## Decisions

| Question | Answer |
|---|---|
| What changes when the author switches to French? | **The article body only.** The editor loads, saves and spellchecks the `fr` half. Heads, lineage, tables, palette and chrome stay English. |
| Where does the choice live? | **In the URL, per page:** `?lang=fr` on the editing page. Every page opens in English. The choice is not carried across navigation. |
| What does an empty French half open as? | **Blank**, with a **Start from English** action that copies the English body in as an unsaved draft. |

The URL answer follows the admin's standing rule that the subject lives in the
URL (`lib/admin-scope.ts`): a reload, a shared link or a redirect after a save
all say which half is on screen. A cookie would have made a translation session
more convenient, but it would also make the same URL mean two different
editors — and an author typing French into what they believe is the English
body is exactly the confusion this slice must not create.

### Approaches considered

1. **`?lang=` read by each content page** — chosen. Switching is a real link,
   and the write path stays one pure function with one new parameter.
2. **Separate routes** (`/admin/sprout/[slug]/fr`). Just as honest a URL, at
   the cost of three duplicated pages or wrappers for one variable. Rejected.
3. **Client tabs holding both halves in one island.** Unsaved edits live in two
   places at once, a reload forgets which tab was open, and one Save has to
   decide which half it means. Rejected, together with the side-by-side layout,
   which is the same shape laid out differently.

## Design

### 1. `lib/edit-lang.ts` — reading the parameter, building the switch

Pure, and server-side: it reads `Text` through `textPart`, and `lib/data.ts`
opens with `node:fs`. The editor island never imports it — the switch needs only
`Lang` and `LANG_SHORT`, which it takes from `lib/locale.ts`. Reuses `Lang` and
`parseLang` from there too, so there is still one definition of what a language
is.

- `editorHalves(content, lang)` — what an editor opens on: `textPart(content, lang)`,
  plus the English body as `seed` when the French half is blank (§4).
- `parseEditLangField(value)` and `withEditLang(href, lang)` — the actions'
  halves of §5, pure so they are tested without a database.

- `editLang(param: unknown): Lang` — `parseLang(param) ?? "en"`. A value that
  is not a language (`?lang=de`, `?lang=` repeated) is English, never an error:
  it comes from a URL bar.
- `editLangHrefs(pathname, searchParams): Record<Lang, string>` — the two
  links. Every parameter is preserved (`?plant=` scope among them) **except**
  `lang`, `error` and `form`: a switch is a fresh view, and carrying a rejected
  save's banner onto the other half would describe a write that half never
  received. `en` spells the clean URL (no `lang` parameter at all); `fr` sets
  `lang=fr`.

The parameter is named `lang`, the same as the public zone's. That is safe
because `middleware.ts`'s language branch runs only when the path does **not**
start with `/admin`; an admin request falls straight through to the session
gate with its query string intact. A test pins it, because moving that branch
below the `/admin` check would strip the parameter and redirect every French
editor back to English with nothing failing.

### 2. The three editing pages

`sprout/[slug]/page.tsx`, `plant/[slug]/narrative/page.tsx` and
`pod/[slug]/page.tsx` (through `ContentCard`) each:

- read `lang = editLang(searchParams.lang)`;
- load `textPart(content, lang)` — STRICT, so an empty `fr` half opens as an
  empty editor and never as the English body wearing a French label;
- pass `hidden={{ …, lang }}` so the save says which half it is;
- pass `key={lang}` on the editor, so switching remounts it with the right
  baseline instead of diffing French against an English one;
- pass `langSwitch` (§3) and, when `lang === "fr"`, `seed={textPart(content, "en")}` (§4).

The sprout rail's **Source** panel reads the same `textPart(content, lang)` as
the editor, for the reason its comment already gives: the diagnostic must not
disagree with the surface it diagnoses.

`ContentCard` gains `lang`, `langHrefs` props and forwards them. Nothing else
on any of the three pages changes — the sprout head still draws
`resolveText(name)` in English.

### 3. The switch lives in the editor

`ProseEditor` gains an optional `langSwitch: { current: Lang; hrefs: Record<Lang, string> }`.
When present, the floating commit bar draws two links — `EN` and `FR` — beside
Save, in a `role="group"` named *Language being edited*, with
`aria-current="page"` on the active one. Each accessible name starts with the
visible code and says what it does (`EN — edit English`), so a voice-control
user who says "click FR" finds it (WCAG 2.5.3).

It lives **inside** the editor rather than in the page head because only the
editor knows whether there is unsaved text. **While the document is dirty,
both links are disabled**: no `href` at all, but still a focusable
`role="link"` with `aria-disabled`, so assistive tech is told the control
exists and is unavailable rather than meeting plain text, and *Save first*
reaches everyone — the registry Tooltip for pointer and focus, and
`aria-describedby` for screen readers. The editor has no `beforeunload` guard today; without this, a stray
click on `FR` in the middle of a paragraph would navigate and drop it, and the
French editor that opened would be empty — indistinguishable from a paragraph
that was never written.

The links are `next/link`, like every other admin navigation.

The editable surface gets `lang={current}` so the browser spellchecks French as
French.

### 4. Start from English

`ProseEditor` gains an optional `seed?: string`. When `lang === "fr"`, the
loaded French half is blank (trimmed-empty) and `seed` is not, the editor shows
one action, **Start from English**, which replaces the (empty) document with
the seed markdown and marks it dirty.

It writes nothing. The copy only becomes the French half when the author
presses Save — so opening the French view and walking away leaves the stored
value byte-identical, and so does pressing Start from English and walking away.
The action disappears once the document is non-empty; it is a way in, not a
reset.

### 5. The write path

`buildContentPatch(current, markdown, lang)` — `lang` is a **required**
parameter, never a defaulted one, on the same argument as `contentPatch`'s
`relations`: a default of `"en"` is precisely the value under which a future
call site would silently write French text into the English half.

- **Dirty-gating** compares against `textPart(stored, lang)`.
- **The other half is carried back verbatim.**
- **Shape** follows `composeText`'s rules without its trimming (markdown
  whitespace is meaningful; "blank" means blank once trimmed):
  - `fr` blank → a plain string holding `en` (clearing the French body
    un-translates the article, and keeps simple content simple);
  - `en` blank and `fr` not → `{ fr }`;
  - both present → `{ en, fr }`;
  - both blank → `""`.
- The 64 KiB ceiling applies to the half being written. A document is two
  halves of at most 64 KiB each; the article door's ceiling was always about
  one document in one language.

Both actions (`editContentAction`, `editContainerContentAction`) read `lang`
from the form:

- **absent → `"en"`.** Every editor before this slice posted English without a
  `lang` field; a tab left open across the deploy must keep saving where it
  always did.
- **present but not a language → rejected**, with the ordinary `?error=`
  redirect. Something posted `lang=de`; guessing which half it meant is the one
  thing a write path must not do.

Both actions **redirect back with `?lang=fr` when the save was French**, on the
success path and the error path alike. Without it a French save lands the
author on the English editor, which reads as the French text having vanished.

### 6. Relations read both halves

`extractRefs(content)` (`lib/entity-refs.ts`) currently reads
`resolveText(content)` — the English half, or French only when English is
blank. Once French is editable, an entity card or mention that exists only in
the French body would never become an `embeds` / `mentions` relation: not on
the graph, not in the related-beans rail, not scrubbed by `filterPublic`.

It becomes the **union** of refs found in `textPart(content, "en")` and
`textPart(content, "fr")`, deduplicated by the existing `kind ref` key, English
refs first so existing relation order is unchanged for every English-only
document. The article door (`lib/articles.ts` accepts `{ en?, fr? }` bodies)
and the garden-plant script (`lib/garden-manifest.ts` builds `{ en, fr }`
bodies) ALREADY write French halves, and call the same function — so they
inherit the fix rather than being untouched by it: a ref only their French half
carries now mirrors, where before it was silently dropped.

No backfill. Checked read-only against production on 2026-09-24: 5 sprouts and
3 pods carry refs in their French half, and every one of those refs already has
its relation, because the English half references the same entities. Any
future gap closes on the document's next content write.

## Out of scope

- French heads, lineage, tables, palette or chrome in the admin.
- Carrying `?lang=` across admin navigation.
- Any change to `/api/articles` or `garden.yml`, which already accept French
  bodies (§6 is the only way this slice touches them).
- A `beforeunload` guard for the editor in general (§3 guards only the switch).
- Any public-zone change: `resolveText` already serves `fr` to French readers
  and falls back to English where there is none.

## Tests

- **`lib/content-edit.test.ts`** — a French save over a plain string yields
  `{ en, fr }`; a French save leaves `en` byte-identical; clearing French on
  `{ en, fr }` collapses to the plain `en` string; an English-blank document
  stores `{ fr }`; an untouched French save is not dirty; the ceiling applies
  per half.
- **`lib/entity-refs.test.ts`** — a ref present only in `fr` is extracted; a
  ref in both halves appears once; an English-only document's output is
  unchanged.
- **`lib/edit-lang.test.ts`** — parsing (`fr`, `FR`, `fr-CA`, `de`, absent);
  hrefs preserve `plant` and drop `lang`, `error`, `form`; `en` is the clean URL.
- **Middleware** — an `/admin/...?lang=fr` request is not redirected by the
  language branch (with a valid session it passes through with `lang` intact).
- **Actions** — `lang` absent saves English; `lang=de` is refused; a French
  save's redirect carries `lang=fr`.
- **Switch SSR** — `EditLangSwitch` (its own component, because the float
  commit renders nothing until the editor mounts, so the editor has no server
  HTML to test) renders real hrefs with `aria-current` on the active language,
  and no `href` at all while disabled.
- **`editorHalves`** — a French editor over an English-only document opens
  empty with the English body as `seed`, never as its `initialMarkdown`.
- **Source** — the editor disables the switch on `dirty` in both commit
  shapes, and every editing page loads through `editorHalves` and keys the
  editor on `lang`.

## Lab Note

This ships something the author notices, so the PR carries one — roughly
*"Write in French too"*: every article now has a French side you can switch to
and write, starting from the English if you like.
