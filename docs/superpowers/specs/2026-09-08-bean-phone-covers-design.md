# Bean covers — a phone in a little window

*2026-09-08*

## 0. The observation

The landing page draws every bean and pod the same way: a 224px card, a 4:3
frame, `object-cover`, and a 3% scale on hover (`app/(public)/page.tsx`). That
is the right treatment for a photograph and the wrong one for a **screenshot of
an app**, which is the only kind of cover art the Paulopus beans have. A phone
screen cropped to 4:3 shows a band across its middle and reads as a mistake.

Eight beans document Paulopus. Each is about one screen, and each has a word
that names it — Timeline, Match, Karma, Data, Editorial, Voice, Accuracy,
Retro. The cover should say both: the word, and the screen.

So the frame stays exactly what it is, and what happens *inside* it changes. A
phone sits in the frame, cropped at the bottom so the frame reads as a window
onto something taller. The word sits above it. On hover the word slides up and
out, and the phone shrinks and rises into the space it left, showing more of
itself.

This spec is one slice. It touches the public landing page, the bean's stored
shape, and the bean admin page — which today can edit nothing at all.

## 1. What a bean gains

Two optional fields on `Bean` (`lib/data.ts`), flat rather than nested:

```ts
export interface Bean {
  // …
  cover?: MediaImage; // explicit cover art, overriding the derivation
  keyword?: Text;     // the one word the cover wears — bilingual, like name
}
```

Flat because each field has a different owner in the admin, and a nested
`cover: { image, keyword }` would force them into one form. §5 says why that
form cannot exist.

`cover` is an **override**, not a replacement. `lib/cover.ts` is untouched: a
bean with no `cover` still shows the first image in its newest sprout carrying
one, exactly as today. What the field buys is the two things the derivation
cannot give: cover art that does not drift the day a newer sprout ships an
image, and cover art that does not have to live inside a sprout's body to
exist.

`keyword` is `Text` because everything else a bean can say is (`name`,
`description`) and the words are not language-neutral — *Accuracy* is
*Justesse*, *Retro* is *Rétro*. It follows `composeText` / `textPart` like
every other bilingual field: en-only, fr-only and both are all valid.

Neither field is required, and no existing bean has either. Nothing in the
garden changes appearance on the day this merges.

## 2. The resolver — `lib/bean-cover.ts`

Pure, server-safe, one export. Everything the landing page needs to know about a
bean's cover is decided here and nowhere else.

```ts
export type BeanCover =
  | { kind: "phone"; image: MediaImage; keyword?: Text }
  | { kind: "fill"; image: MediaImage };

export function beanCoverFor(bean: Bean, sprouts: Sprout[]): BeanCover | null;
```

The rules, in order:

1. **`bean.cover` set, and portrait** (`height > width`) → `{ kind: "phone" }`,
   carrying `bean.keyword` when there is one.
2. **`bean.cover` set, anything else** → `{ kind: "fill" }`. A landscape or
   square cover is a picture, and pictures fill frames.
3. **No `bean.cover`** → `coverFor(sprouts)`, and always `{ kind: "fill" }`.
4. **Nothing** → `null`, the empty muted frame.

Rule 3's "always" is the load-bearing one. **The phone treatment is reachable
only through an explicit `cover`.** Deriving it from portrait-ness alone would
mean a bean whose newest sprout happens to carry a portrait photograph — a
person, a poster, a book — silently grows a phone bezel around it. Setting the
field *is* the opt-in; the image's shape only decides how the opt-in is drawn.

Rule 1's fallback matters too: `width`/`height` are optional on `MediaImage`.
Cloudinary stores both on upload (`lib/storage.ts`'s `toMediaImage`), but a
pasted third-party URL carries neither, and `lib/inbox.ts` deliberately permits
those. An image with no dimensions is not portrait, so it fills. The safe
failure is "no phone", never "no cover".

`keyword` rides on the `phone` variant only. A word floating over a photograph
is a different design that nobody asked for, and a `fill` cover that quietly
dropped its keyword would be a field with no visible effect.

### 2.1 What the pod borrows

`podEntry` already borrows the first cover its beans can offer. It now borrows
the **resolved `BeanCover`, with the keyword stripped**:

```ts
const borrowed = beans.map((b) => beanCoverFor(b, data.sproutsForBean(b.slug))).find(Boolean);
const cover = borrowed?.kind === "phone" ? { ...borrowed, keyword: undefined } : borrowed;
```

A pod showing a phone is right — it is the same artwork, and the pod really does
contain that app. A pod wearing one of its beans' words is not: the word names
the bean, and on a pod card it would name the wrong thing.

### 2.2 The image alone — `fillCoverFor`

A second, smaller export in the same file, for the surfaces that draw a cover in
a fixed frame and have no phone branch:

```ts
export function fillCoverFor(bean: Bean, sprouts: Sprout[]): MediaImage | null;
```

`bean.cover ?? coverFor(sprouts)`, and nothing else. `beanCoverFor` answers
"what TREATMENT"; `fillCoverFor` answers "which IMAGE". Two callers want only
the second — the prose entity card (via `lib/entity-resolve.ts`) and the public
graph payload (`lib/graph.ts`) — and §8 says why they have no use for the first.

It must never grow a branch on the image's shape. A caller that wants to know
whether the cover is a phone is calling the wrong sibling, and a test pins that
a portrait cover comes back here as a plain `MediaImage`.

Without it, `lib/data.ts`'s "explicit cover art, OVERRIDING the derivation" is a
claim honoured by ONE reader out of three: an authored bean shows its phone on
the landing page while its entity card shows a different image, or — in the
field's own motivating case, cover art that does not live inside a sprout's
body — shows nothing at all.

`lib/cover.ts` is still the derivation and its behaviour is unchanged. What
changes there is its doc header, which opened "a bean's cover is DERIVED — no
field, no authoring step, no migration". True when it was written; false the
moment `bean.cover` existed, and read by both of the surfaces that were getting
it wrong.

## 3. The cover, drawn — `components/bean-cover.tsx`

A server component. No `"use client"`, no `lucide-react`, and **added to
`SERVER_SAFE` in `lib/server-safe-source.test.ts` on the day it is written** —
that file's own header asks for exactly this, and this is the public zone's
critical path.

It draws the inside of the frame; the frame itself stays in
`app/(public)/page.tsx` where it is (`aspect-[4/3] w-full overflow-hidden
rounded-lg bg-muted`). Given a `BeanCover | null` it renders one of three
things:

- **`null`** → nothing. The empty muted frame, unchanged.
- **`fill`** → today's `<img>` with `cloudinaryThumb(url, {width: 448, height:
  336})`, `object-cover`, `group-hover:scale-[1.03]`. Byte-for-byte what the
  page renders now.
- **`phone`** → the word and the bezel, below.

### 3.1 Geometry

Tied to the row's `w-56` card, which is a fixed width; the numbers below are
that card's, and they move together if it ever changes.

| | |
|---|---|
| frame | 224 × 168 (`aspect-[4/3]`) |
| phone width | 112 (half the frame) |
| phone height | 242, for a 390×844 capture — it runs 132px past the frame's bottom |
| phone top, at rest | 58 — clear of the word, per layout B |
| word | absolute, `inset-x-0 top-0`, centred, `pt-[9px]`, `text-[34px]` |

The keyword wears **`font-display`** — Profane, the public zone's display face.
The landing page already calls `ProfanePreload`, so the face is loaded on this
page whether or not a single card uses it: the keyword costs no new request.

The phone is an ink-coloured rounded box (`rounded-2xl`, small inset padding,
**no bottom padding**) holding the screenshot. Open at the bottom, because the
bezel is a real object continuing past the frame and a closed one would read as
a sticker.

`aria-hidden` on the word. The bean's name sits two lines below it and the word
is a compressed restatement of it — the same reasoning that already puts
`alt=""` on the cover image beside it.

### 3.2 The derivative

`cloudinaryThumb(url, { width: 224, height: 484 })` — the phone's 112×242 box
doubled for a retina display. The ratio is 0.4628 against a 390×844 capture's
0.4621, so `c_fill` crops under a tenth of a percent and the arithmetic holds
without touching `lib/image-url.ts`.

Requesting the **full** phone height, not the ~110px visible at rest, is
deliberate: hover reveals more of the image, and a derivative sized to the rest
state would blur exactly when the visitor leans in.

### 3.3 The bezel is CSS, not a baked-in frame

The stored image is the raw capture. The dark surround, its radius and its
shadow are drawn by this component.

Baking the frame into the PNG would make `cloudinaryThumb` crop a composited
image instead of a screen, put the design system's radius inside a file, and
turn "re-shoot that screen" into "re-composite that screen". None of those is
worth the pixel fidelity it buys.

## 4. The motion

Both moves are CSS `group-hover`, on the `group` anchor that already wraps the
card. **No client JavaScript.** `app/(public)` keeps its exactly-one island (the
TOC rail), and nothing here joins CLAUDE.md's exception list.

| | rest | hover |
|---|---|---|
| word | `translate-y-0` | `-translate-y-[110%]`, clipped by the frame's `overflow-hidden` |
| phone | `translate-y-0 scale-100`, `origin-top` | `-translate-y-[46px] scale-[0.80]` |

Which shows 110px of the phone at rest and ~156px of a shrunk one on hover —
45% of the screen becoming 80%.

Duration ~420ms, `cubic-bezier(.2,.7,.2,1)`, the word leading the phone by a
beat so it has cleared the top before the phone arrives under it.

`motion-reduce:transition-none` on both. The states still swap — the hover is
information, not decoration — they simply stop travelling.

**Touch devices have no hover**, so the rest state is the poster state: word up
top, phone cropped. Nothing on the card is reachable only by hovering, and the
whole card is one link either way.

## 5. The admin

`/admin/bean/[id]` is a read-only property dump today. Beans are created by
promotion or through the article door, and `lib/botanical.ts` has no bean writer
at all. Both fields need somewhere to be authored, so the page gains two forms —
and **two, not one**, for a reason the plant page already demonstrates.

### 5.1 The Cover card — picker only

`app/admin/_components/bean-cover-form.tsx`, a near-copy of
`plant-logo-form.tsx`:

```tsx
<form action={editBeanCoverAction}>
  <input type="hidden" name="slug" value={bean.slug} />
  <MediaPicker
    key={JSON.stringify(bean.cover ?? null)}
    name="cover"
    initial={bean.cover ? [bean.cover] : []}
    max={1}
    submitLabel="Save cover"
  />
</form>
```

The form is **nothing but the picker**, so the picker renders the submit button
and script-off there is no button at all — inert rather than destructive, which
is CLAUDE.md's rule verbatim. The `key` re-seeds the island after a save, for
the reason `plant-logo-form.tsx` gives: `MediaPicker` reads `initial` once, in
its `useState` initializer.

`lib/bean-cover-edit.ts` — `buildBeanCoverPatch`, a sibling of
`buildPlantLogoPatch` and not a generalization of it, holding the same three
guards: the `cover__ready` marker (defence in depth against a POST that never
rendered a button), a dirty gate so opening the page and saving untouched writes
nothing, and "entries submitted, none of them an image" treated as a failed save
rather than a clear.

### 5.2 The Keyword form — zero client JS

`app/admin/_components/bean-keyword-form.tsx`: two `Input`s (en, fr), a real
`Button`, posting to `editBeanKeywordAction`. An ordinary metadata form, which
is what every admin form but the six exceptions still is.

`lib/bean-keyword.ts` — `buildBeanKeywordPatch(form): Text | null`, where
`null` **means clear**, the instruction `PlantMetaPatch.description` already
carries and for the same reason: the field belongs to a record that exists, so
a blank has to cross the wire as an instruction rather than as an absence.
Prefills use the **strict** `textPart`, never `resolveText` — the fallback would
copy the fr half into the en box and save it back as en, the trap
`plant-meta-form.tsx` documents.

### 5.3 Why two forms and not one

A single form holding the picker *and* a text input is the shape the
media-picker rule exists to prevent. Script-off it renders no button (the button
is inside the island) but it *does* render the text input — and a form with one
text input and no button permits **implicit submission on Enter**. The author
types a keyword, presses Return, and posts a form carrying no `__ready` and no
media. `buildBeanCoverPatch` would refuse to write, so nothing is destroyed —
but the keyword is silently lost, and the page gives no sign.

Two forms make the failure impossible instead of survivable. It is also exactly
the plant's arrangement: a zero-JS Meta card beside a picker-only Logo card, on
one page.

### 5.4 Actions and writers

`app/admin/actions.ts` gains two, both shaped like `editPlantLogoAction` —
`requireSession()`, read the bean out of `loadRawGarden()`, build the patch,
write only when dirty, `revalidatePath("/admin")`, redirect back to the bean:

- `editBeanCoverAction`
- `editBeanKeywordAction`

`lib/botanical.ts` gains two narrow writers, siblings of `updatePlantLogo` —
each writing one field, each `$unset`-ing on `null`:

- `updateBeanCover(slug, cover: MediaImage | null)`
- `updateBeanKeyword(slug, keyword: Text | null)`

Narrow rather than one `updateBeanMeta`, for the reason `updatePlantStatus`
gives: a writer that can touch a field it was not asked about is a writer that
eventually does.

## 6. The screenshots

A content operation, run once. Nothing about it is wired into the build.

**Capture.** An agent drives a headless Chrome against the Paulopus dev server
running locally, at 390×844 with a 2× device pixel ratio. Local, so no
production data and no rate limits. Thirty-one candidate screens have already
been captured this way during design.

**The mapping**, one screen per bean:

| Keyword | Bean | Screen |
|---|---|---|
| Timeline | `prediction-timelines` | the home Upcoming tab — see §6.1 |
| Match | `match-anatomy` | match debrief: hero, verdict, "Paulopus predicted 2–1", the three tabs |
| Karma | `karma-accountability` | the verdict-bands drawer, four asymmetric bands with their weights |
| Data | `live-data-pipeline` | brief source chips sitting over the openfootball credit line |
| Editorial | `agentic-editorial-pipeline` | the structured DetailedBrief the routine wrote |
| Voice | `brand-voice` | the teams grid — sand/ink/orange, Tiny5, 48 pixel flags |
| Accuracy | `prediction-performance` | accuracy-over-time and karma-by-experience, one frame |
| Retro | `research-process-reflection` | a RedCard verdict reading "still in its tank" where the call should be |

**Storage.** Each PNG goes up through `uploadImageAction` — never browser to
Cloudinary directly, the rule `components/admin/media-picker.tsx` already
carries — and lands on its bean through the Cover card from §5.1. The keywords
go in through the Keyword form.

### 6.1 The Timeline mock, and its escape hatch

The Upcoming tab — a live, revisable call sitting ahead of kickoff — is the one
screen that cannot be photographed. It was removed from Paulopus's
`app/page.tsx` when the tournament ended, and every kickoff in the static data
is two months past. `splitByKickoff` reads the clock **server-side**, so faking
it in the browser does nothing.

Reviving it takes three edits, all in a **scratch copy** of the Paulopus repo:

1. Restore the third tab in `app/page.tsx` (~15 lines: a `TabsTrigger` and
   `TabsContent`, `grid-cols-2` → `grid-cols-3`, map `upcoming` through
   `toMatchView`).
2. Copy `data/matches.json`, move a handful of kickoffs into the future and
   **delete their `result`, `karma` and `debrief`** — a record that keeps its
   result renders the real score and the graded verdict, so it reads as history
   even inside the Upcoming tab. Keep `drafts`: that is what supplies the muted
   predicted score and the statement bubble.
3. Point `lib/db.ts` at the copy — one line.

**Nothing is committed to the Paulopus repo, and it comes out of this work
untouched.** That repo is not in scope; the scratch copy is a darkroom, not a
change.

**The escape hatch.** If the mock turns out to cost more than those three edits
— if the tab needs components that no longer exist, or the data shape has moved
— it is abandoned rather than pursued, and the Timeline cover ships from
`match-pronostic-revisions`, which shows the revision trail (four revisions on
one match) without the tab split. Half the bean's story, at none of the cost.
One cover is not worth an excavation.

## 7. Tests

- **`lib/bean-cover.test.ts`** — `fillCoverFor` (§2.2): the explicit cover wins
  over an available derivation, falls back to it when absent, is null when
  there is neither, and — the case that keeps the split honest — an explicit
  PORTRAIT cover comes back as a plain `MediaImage` rather than anything
  phone-shaped. Plus the resolver, exhaustively: explicit portrait
  cover → `phone` with the keyword; explicit landscape and square → `fill`;
  explicit cover with **no stored dimensions** → `fill`; no explicit cover →
  `coverFor`'s answer as `fill`, *even when that image is portrait*; nothing →
  `null`; and the pod's borrowed cover keeping the image while losing the word.
  This is where the opt-in rule lives, so this is where it is pinned.
- **`lib/bean-cover-edit.test.ts`** — `buildBeanCoverPatch`: the missing
  `cover__ready` marker writes nothing, the untouched save is not dirty, an
  entries-but-no-image submission is a failed save and not a clear, and a
  removed row *is* a clear.
- **`lib/bean-keyword.test.ts`** — `buildBeanKeywordPatch`: en-only, fr-only,
  both, and blank meaning clear.
- **`lib/server-safe-source.test.ts`** — `components/bean-cover.tsx` added to
  `SERVER_SAFE`.
- **`lib/media-picker-mount.test.ts`** — extended to the Cover form: script-off
  it renders no submit button.

The motion is CSS. There is nothing there worth pinning that `tsc` does not
already catch, and a test asserting a Tailwind class string is a test of the
test.

## 8. Out of scope

- **The phone treatment on the prose entity card**
  (`components/entity-card.tsx`), which keeps its 720×128 letterbox. A phone
  cannot sit in that shape, and redesigning it is a different slice with a
  different argument. The public graph payload (`lib/graph.ts`) is the same
  case for the same reason: no frame, so no treatment.

  What both are excused from is the TREATMENT, never the OVERRIDE — a
  distinction the first cut of this line blurred by saying the card keeps "its
  plain cover". More precisely: the card keeps **the same image the landing
  page draws, in its existing letterbox**. Both resolve through `fillCoverFor`
  (§2.2), so an authored `cover` wins there exactly as it does on the landing
  page, minus the bezel and the word.
- **A composed cover preview in the admin.** The Cover card shows the media
  picker's own thumbnail. Drawing the real cover there would mean the admin and
  the public site drawing the same thing — which CLAUDE.md would then require
  come from one file, and `components/bean-cover.tsx` is written to allow
  exactly that when someone wants it.
- **Video or animated covers.** A still is a still.
- **Any change to the Paulopus repo.** §6.1.
