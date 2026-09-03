# Digest — the pebble as a visual object: May 2026 → September 2026

**Compiled:** 2026-09-02 · **Source repo:** `/Users/alexis/code/pbbls` (read-only)
**Scope:** shapes, valence, glyphs, colour, animation. Factual only — no editorial prose.

Every claim below carries its source. Where the corpus asked a question the repo
does not answer, the line reads **NOT FOUND**.

---

## 1. May 2026 → September 2026, element by element

| Visual element | May 2026 | September 2026 | Source |
|---|---|---|---|
| **The nine forms** | 9 hand-drawn canvases = 3 intensities × 3 polarities, selected server-side from `engine/shapes/*.ts` and client-side from `apps/web/lib/engine/templates.ts` | Unchanged in count and in axis. Still 3 × 3. The *database* table that once named them (`pebble_shapes`) is gone; the art was never in it | `packages/supabase/supabase/functions/_shared/engine/shapes/index.ts`; `apps/web/lib/engine/templates.ts:283`; decision log 2026-07-01 (#503) |
| **Axis values** | `intensity` 1/2/3 × `positiveness` −1/0/+1 | Identical. "`positiveness` (-1/0/+1) and `intensity` (1/2/3) are what they always were" | `packages/supabase/supabase/functions/_shared/engine/resolve.ts`; decision log 2026-08-24 (#729, Android) |
| **`glyphs.shape_id` / `pebble_shapes`** | Present but dead — every writer already wrote `shape_id = null` | Dropped system-wide, 2026-07-01. "Reintroducing a glyph→shape association is out of the question — glyphs are squares" | decision log 2026-07-01 (#503); migration `20260701114205_drop_glyph_shape.sql` |
| **Valence picker** | Nine tiles with flat template icons from `Assets.xcassets/Valence/`, grouped under Day / Week / Month headers with a sentence each (shipped 2026-04-19) | **Valence fan** on all three surfaces: nine *real wobbled stones* fanned bottom-centre + a two-axis swipe roll on the word beneath. Edit sheets keep the nine-tile grid | journal `AC-valence-picker-cairn` (2026-04-19) → `AC-valence-fan-roll` (2026-08-24, status `live`, all 3 platforms); `docs/superpowers/specs/2026-08-24-ios-valence-fan-picker-design.md` |
| **Stroke quality** | Even vector strokes. Flat, deliberate | **Petroglyph wobble** — leaky filled outlines whose width breathes — generated at runtime on-device, now shipped in Release on iOS and in production on web | decision log 2026-07-13 (#555), 2026-08-24 (#727), 2026-08-24 (#729 web) |
| **Wobble gate** | Not yet existing (spike opens 2026-07-13) | Deliberately diverged 3 ways: iOS `true` unconditionally, web `true` unconditionally, Android still `BuildConfig.WOBBLE_ENABLED` (true only in debug + Play internal-testing) | `apps/ios/.../Wobble/WobbleFlags.swift`; `apps/web/lib/wobble/flags.ts`; `apps/android/.../wobble/WobbleFlags.kt`; decision log 2026-08-24 (#729 web) |
| **Pebble frame / backdrop** | New in May: a per-(size × valence) **fill-only silhouette** layered behind the render at each consumer site — no compose-pipeline change, no `render_version` bump (iOS #473, shipped `pr-475` 2026-05-20) | Still the model everywhere. `PebbleOutlineBackdropView` (iOS), `PebbleOutlineBackdrop` (Android/web); the nine `Outlines/*.svg` are the shared asset | `docs/superpowers/specs/2026-05-19-pebble-outline-frame-ios-design.md`; `apps/ios/Pebbles/Resources/Outlines/`; journal `pr-475`, `pr-498` (web, 2026-06-29) |
| **Colour source** | Emotion category palette: 4 hex slots (`primary`, `secondary`, `light`, `surface`) on `emotion_categories`, exposed via `v_emotions_with_palette` | 6 slots — `shaded_color` and `dark_color` added 2026-07-17 (#599 / #605). Composed SVG stays monochrome `currentColor`; colour is applied per-surface, per-theme, at render time | spec `2026-05-06-emotion-categories-palettes-design.md`; migration `20260717000000_emotion_categories_shaded_dark.sql`; `apps/ios/.../Models/EmotionPalette.swift` |
| **Palette editing** | Supabase Studio by hand ("Admin UI for editing palettes" explicitly out of scope) | Admin app screen: `admin_update_emotion_palette` + `admin_update_emotion_emoji` RPCs, `apps/admin/app/(authed)/emotions/{palettes,emojis}` | migration `20260717120000_admin_emotion_management.sql` (#608); journal `pr-609` 2026-07-17 |
| **Emotion emoji** | `emotions.emoji` seeded, not editable | Editable in admin; surfaced on `v_emotions_with_palette` | same as above |
| **Read-page colour** | Pebble tinted; page chrome neutral | iOS pebble detail page tints wholesale to the emotion palette (background, title, date, tiles, description, soul glyphs), light and dark | journal `pr-610` 2026-07-18 (ios); `PetroglyphColors` in `EmotionPalette.swift` |
| **Animation manifest** | **Already gone.** `pebbles.render_manifest` dropped 2026-04-29; motion moved to a client-owned timings table keyed by `render_version` | Still gone. `PebbleAnimationTimings.swift` (iOS) owns the 3-phase glyph → shape → fossil → settle model | spec `2026-04-29-ios-pebble-stroke-animation-design.md`; migration `20260429000000_drop_pebbles_render_manifest.sql` |
| **Launch animation** | Rive logo (`pbbls-logo-appear_idle.riv`) held by a hardcoded ~2.5 s timer | Native `HandcraftedLogoView`: draws the logo stroke-by-stroke, boils it, settles — gated on a real readiness event with an 8 s ceiling. Rive removed from the launch flow | decision log 2026-07-17 (#598); journal `pr-600` 2026-07-17 |
| **Rive, remaining** | Logo splash + week-roll cairn | Week-roll cairn only, iOS only (`pbbls-cairn-states.riv`) + the Android `RiveLogo` welcome wrapper still in tree | `apps/ios/.../WeekRollCairnCell.swift`; `apps/android/.../rive/RiveLogo.kt` |
| **Highlight gradient** | Did not exist | A warm `MeshGradient` (hues 3°–41°) sampled from a reference image at 16 control points — drawn 3 different ways on 3 surfaces from one set of hexes | spec `2026-08-24-ios-valence-fan-picker-design.md` rev. 5; decision log 2026-08-24 (#729 web) |

---

## 2. Do the nine shapes still exist?

**Yes — and they never lived in `pebble_shapes`.**

The nine forms are `3 sizes × 3 polarities`:
`small|medium|large` × `lowlight|neutral|highlight`, resolved from the two DB
columns by `intensityToSize(1|2|3)` and `positivenessToValence(-1|0|1)`
(`packages/supabase/supabase/functions/_shared/engine/resolve.ts`).

A pebble's form comes from **three different baked-in template sets today**, not
from a table:

1. **Server compose** — `packages/supabase/supabase/functions/_shared/engine/shapes/`
   holds nine `.ts` files (`small-lowlight.ts` … `large-highlight.ts`) behind a
   `TABLE[size][valence]` lookup in `shapes/index.ts`. This is what
   `render_svg` is composed from.
2. **Web client fallback** — `apps/web/lib/engine/templates.ts` (170 KB), keyed
   `TEMPLATES[IntensityKey][SentimentKey]`, used only when `pebble.render_svg`
   is null (legacy rows, unauthenticated previews).
3. **The silhouette/backdrop frame** — nine `Outlines/<size>-<polarity>.svg`
   files shipped as app resources, each a single `<path fill="#FF00FF">`
   sentinel, colour-substituted at render time
   (`apps/ios/Pebbles/Resources/Outlines/`, copied verbatim to Android
   `res/raw` and to `apps/web/lib/config/pebble-outlines`).

**What was dropped (2026-07-01, #503):** `glyphs.shape_id` and the
`pebble_shapes` table, plus every reader (`Mark.shape_id`, `PEBBLE_SHAPES`
config, `useShapeName`, the dead `carve/PebbleOutline.tsx`, shape i18n
strings). Stated reason: *"No live data flowed through `shape_id` — it was pure
backward-compat cruft… Removing both eliminates a misleading data model (glyphs
are shape-agnostic)."* Consequence recorded: *"Reintroducing a glyph→shape
association is out of the question — glyphs are squares."*
(decision log 2026-07-01; migration `20260701114205_drop_glyph_shape.sql`)

A tenth artwork set now exists alongside the outlines: nine
`ValenceArt/valence-<polarity><Size>.svg` files — the pebble's outline plus its
creature and fossil — drawn *inside* the backdrop by the fan picker
(`apps/ios/Pebbles/Resources/ValenceArt/`).

---

## 3. Valence fan vs valence grid

**The grid** (shipped 2026-04-19, `pr-379`-era; journal node
`AC-valence-picker-cairn`): nine tiles carrying flat template icons from
`Assets.xcassets/Valence/`, a polarity label and a rounded-rectangle background,
grouped under three headers — "Day event" / "Week event" / "Month event" — each
with a sentence of description. Gherkin as recorded: *"I see nine illustrated
pebble shapes grouped as day, week and month events, each with the copy that
explains what that cairn means."*

**The fan** (2026-08-24, #727 iOS / #728 / #729 Android + web; journal node
`AC-valence-fan-roll`, status `live` on all three platforms):

- Nine **real stones** — the same wobbled `Outlines/<size>-<polarity>.svg`
  silhouettes every other pebble surface draws — arranged on an arc from a
  bottom-centre origin. Polarity picks the angle (−34° / 0° / +34°), size picks
  the radius (78 / 150 / 232 pt) and the stone's height (48 / 78 / 110 pt).
  No tiles, no headers, no icon assets.
- A stone is a **backdrop plus artwork**, not a stroked silhouette: the wobbled
  silhouette is filled and never stroked, and the `Valence/valence-*` artwork is
  tinted and drawn inside it, scaled by `PebbleOutlineGeometry.pebbleScale`
  (spec revision 1).
- Under the fan, a **two-line typographic lockup** (word + span, e.g.
  *Highlight* / *OF MY MONTH*) in Caveat, which doubles as the picker's second
  input: a **two-axis roll** — swipe sideways for polarity, up/down for size,
  1:1 with the finger, detented at the half step, springing and buzzing at each
  detent, rubber-band clamped at the ends (spec revisions 2–4).
- Selection **inverts the stone's two roles** — the wash becomes the solid and
  the ink goes pale — the same treatment `EmotionPalette.pebbleFrameColors(forIntensity: 3)`
  gives a hero pebble on the Path. Dim 0.45, scale 1.14 (revision 5).

**Why the fan arrived in August 2026.** Stated in the spec's Problem section and
in the 2026-08-24 decision entries: *"the thing you are choosing looks nothing
like the thing you get. Every other pebble surface … draws a real wobbled stone
silhouette. The picker draws an icon."* It arrived as part of M58's record flow
(#723 / #725 / #729), the one-question-per-step composer.

**Why the edit sheets keep the grid.** Structural, stated verbatim in the
2026-08-24 web entry (#729): *"a sheet that commits and closes on pick
structurally cannot host a roll that changes the value at every detent — the
first swipe would dismiss it."* iOS answered this by adding a **Done** button and
local staging to `ValencePickerSheet` (spec revision 3); Android did the same in
#735. Web did **not**, because *"doing that on web means changing three host call
sites and `PickerSheet`'s contract, which is its own change and outside a
record-flow issue."* Consequence recorded: *"Web's edit sheets are now the only
valence grid left in the repo"* and *"adding a Continue or Done button to the
grid would be the cost of the fan without the fan."*

The fan also broke a flow rule on purpose: valence **commits in place and
`Continue` advances**, unlike every other tile step, *"because the fan is a
comparison, and a tap that leaves the screen denies the user the look at what
they chose next to the eight they did not"* (spec revision 1, item 2).

---

## 4. The petroglyph wobble

**What it is.** Issue #555's "handcrafted stroke": every line breathes with an
uneven, leaky ink edge instead of a perfectly even vector stroke
(`docs/arkaik/bundle.json`, node `AC-petroglyph-wobble-ink`). The pipeline, per
the 2026-07-13 decision and `apps/web/lib/wobble/`:

SVG 1.1 §15.19 fractalNoise port → flatten the path into ~2-unit chords →
dual-edge outline (caps/rings) → displace every contour point → fill.
Canonical params for a 200-unit box: amplitude 18, frequency 0.024, 5 octaves,
flatten step 2, seed 3 (`apps/web/lib/wobble/params.ts`). The displacement sign
is **minus**, matching the playground bake and `feDisplacementMap`'s inverse
sampling — issue §2.3's "+" is explicitly superseded, with a standing "do not
correct this" note.

**Why runtime on-device, not authored/baked.** Issue #555 §0 recommended baking
at build time. The decision log rejects that in four steps (2026-07-13):

- pbbls glyphs are **user-carved and marketplace-traded** — fully dynamic, so
  build-time baking is impossible;
- a server-side (write-time) bake would *"iterate slowly (redeploy + backfill per
  look tweak), persist a wrong look across every platform at once, grow
  `render_svg` ~5–15×, and still miss the glyph-only surfaces (souls grids, glyph
  picker/market, carve preview) that bypass `render_svg`"*;
- on-device generation *"keeps stored data pristine and the whole experiment
  disposable … covers all surfaces including client-side previews, adds zero
  payload, and makes boil trivial later"*;
- parity is bought instead with **golden fixtures**
  (`apps/ios/PebblesTests/Wobble/WobbleGolden.json`, regenerable only via
  `apps/ios/Scripts/generate-wobble-golden.mjs`; LCG exact, turbulence/
  displacement ≤ 1e-9) that the Kotlin and TS ports must reproduce.

Standing rule from that entry: *"`render_svg` / `render_version` are untouched —
do not bump the engine or backfill for wobble."*

**Leaky filled outlines.** From `apps/web/lib/wobble/outline.ts`: *"offset both
stroke edges from the centerline first, then displace every contour point
independently. The independent displacement is what makes the width breathe
('leaky') — a stroked wobbled centerline would stay constant-width."* The
decision log adds the second reason the centerline mode was rejected: *"`trim()`-based
draw-on cannot animate a fill"* — so the appear animation is preserved as a fat
trimmed **mask** stroking along the wobbled centerline, reusing
`PebbleAnimationTimings` unchanged.

**Why an `#available` guard.** Not the wobble itself — the fan's highlight
stones. `apps/ios/CLAUDE.md` said *"iOS 17 APIs only. No backports, no `if
#available` guards."* `MeshGradient` is iOS 18+ and has **no iOS 17
equivalent**. The alternatives were raising the deployment target (drops iOS 17
users for one gradient) or dropping the mesh (loses the look that motivated the
redesign). So `ValenceStoneStyle` carries the app's first
`#available(iOS 18, *)`, with a `LinearGradient` over the same hues below, used
for **fill and stroke both** *"so a 17 device gets a coherent stone rather than a
mixed one."* Recorded consequence: *"`apps/ios/CLAUDE.md`'s 'no `#available`
guards' line is now contradicted by the codebase"* and needs rewording to *"no
availability guards around APIs that have an iOS 17 equivalent."*
(decision log 2026-08-24, #727)

**Shipping status, per surface, today:**

| Surface | Flag | Value |
|---|---|---|
| iOS | `WobbleFlags.isEnabled` | `true` in every configuration (since #727) |
| web | `WOBBLE_ENABLED` (`apps/web/lib/wobble/flags.ts`) | `true` unconditionally (since #729); `NEXT_PUBLIC_WOBBLE` env var is gone |
| Android | `BuildConfig.WOBBLE_ENABLED` | `true` in debug + Play internal-testing only; R8 strips it elsewhere |

The three-way divergence is deliberate and marked *"should not be 'aligned'"* —
Android's flag guards an AndroidSVG fallback web has no equivalent of. The
2026-07-14 standing note to flip Android's flag before a public track *"still
stands for Android alone."*

**Boil** (multi-frame animated wobble) ships **only in the iOS launch loader**
(`HandcraftedLogoView`, seeds 3/4/5, 4 fps, ping-pong `[0,1,2,1]`). The pebble
wobble modules note *"boil variants would use seed + k later"* — not implemented
(`WobbleParams.swift:20`, `params.ts:20`).

---

## 5. Where pebble rendering happens today

**There is still one shared TypeScript engine — but only on the server, and it
is not called from an RPC.** The direction is the reverse of the corpus claim.

| Layer | Location | Role today |
|---|---|---|
| **Server compose engine** | `packages/supabase/supabase/functions/_shared/engine/` (`types.ts`, `glyph.ts`, `layout.ts`, `compose.ts`, `resolve.ts`, `shapes/`) | Pure Deno TS. Layers shape + glyph + optional fossil into one **monochrome** SVG. Returns `{ svg, canvas }` only |
| **Compose + write** | `_shared/compose-and-write.ts` | Loads the pebble, resolves glyph strokes, runs the engine, writes `render_svg` / `render_version` (`0.1.0`) |
| **Edge functions** | `compose-pebble/`, `compose-pebble-update/`, `backfill-pebble-render/` | `compose-pebble` **wraps** `create_pebble`: auth-forwards the JWT → calls the RPC → calls compose-and-write → returns `{ pebble_id, karma_delta, render_svg, render_version }` |
| **Web** | `apps/web/lib/engine/` (client fallback), `components/pebble/PebbleVisual.tsx`, `PathStone.tsx`, `PebbleOutlineBackdrop.tsx`, `carve/StrokeRenderer.tsx`, `lib/wobble/` | Prefers server `render_svg`; falls back to the client engine for legacy rows and unauthenticated previews. Wobbles the composed SVG at render time |
| **iOS** | `apps/ios/Pebbles/Features/Path/Render/` — `PebbleStaticRenderView` (SVGView), `PebbleAnimatedRenderView`, `PebbleSVGModel`, `SVGPathParser`, `PebbleOutlineBackdropView`, `Wobble/` | Parses `render_svg` into layers; draws them as SwiftUI shapes with `.trim()`; wobbles on device |
| **Android** | `apps/android/.../features/path/render/` — `PebbleStaticRender`, `PebbleSvgModel`, `PebbleOutlineBackdrop`, `GlyphImage`, `wobble/` | Kotlin port of the same pipeline, pinned by the golden fixtures |

So: **one shared compose engine (server, TS)**, plus **three hand-written
per-surface render/wobble implementations** whose parity is enforced by fixtures
rather than by shared code. The 2026-07-13 entry names this trade explicitly:
*"Android/web ports must pass the golden fixtures before shipping (implementation
drift is the accepted trade)."*

The composed SVG carries **no colour**: `compose.ts` strips every fill to
`fill="none"` and rewrites every stroke to `stroke="currentColor"` — *"The client
applies the emotion color at render time."*

Consolidating the wobble into the server engine *"remains possible once the look
freezes, but is a new decision"* (2026-07-13).

---

## 6. Emotion colour

**Palettes.** Colour is a property of the **emotion category**, not the emotion
(spec `2026-05-06-emotion-categories-palettes-design.md`, issue #366). Seven
categories (anger, fear, joy, peace, pride, sadness, shame) each carry an inlined
palette on `public.emotion_categories`. All values are **8-digit hex
`#RRGGBBAA`**; `surface_color` is derived by convention as primary + `1A` (10 %
alpha). Emotions join via `category_id`; clients read
`public.v_emotions_with_palette`.

Slots grew from four to six:

| Slot | Added | Role |
|---|---|---|
| `primary_color` | 2026-05-06 (#366) | pebble stroke in light mode; hero backfill |
| `secondary_color` | 2026-05-06 | pebble stroke in dark mode |
| `light_color` | 2026-05-06 | hero stroke; small/medium backfill in light |
| `surface_color` | 2026-05-06 | 10 %-alpha wash behind small/medium on the Path |
| `shaded_color` | 2026-07-17 (#605) | deeper tint — read-page title / tile label / description in light |
| `dark_color` | 2026-07-17 (#599) | solid small/medium backfill in dark mode |

(migration `20260717000000_emotion_categories_shaded_dark.sql`)

**Admin emoji/palette editor** (#608, migration `20260717120000_admin_emotion_management.sql`,
journal `pr-609` 2026-07-17): two `security definer` admin RPCs —
`admin_update_emotion_palette(uuid, primary, secondary, light, shaded, dark)`
which validates hex, uppercases, and **re-derives `surface_color` as
`primary[0:7] || '1A'`**; and `admin_update_emotion_emoji(uuid, text)` which
accepts 1–16 characters (a single emoji may be several codepoints via ZWJ). Both
revoked from `public`/`anon`. UI lives at
`apps/admin/app/(authed)/emotions/{palettes,emojis}` with `PaletteEditor.tsx`,
`ColorField.tsx`, `EmojiRow.tsx`.

**How the read page tints** (#599 / #610, journal 2026-07-18): *"On iPhone the
whole pebble detail view (background, title, date, tiles, description and soul
glyphs) now colours to the pebble's emotion palette, in both light and dark."*
The rule is a size × scheme table in
`apps/ios/Pebbles/Features/Path/Models/EmotionPalette.swift`
(`petroglyphColors(forSize:scheme:)`):

| layer | light | dark |
|---|---|---|
| small/medium strokes | `primary` | `secondary` |
| small/medium backfill | `light` | `dark` |
| large strokes | `light` | `light` |
| large backfill | `primary` | `primary` |

Deliberately distinct from the theme-neutral `pebbleFrameColors` the Path rows
use (which still washes small/medium with `surface`). Hex is trimmed to 6 digits
before SVG injection because *"SVGView only renders 6-digit hex reliably"*, with
alpha carried separately as view opacity.

**On web**, the equivalent is CSS-only: `PebbleVisual.tsx` sets
`--pebble-stroke-light` / `--pebble-stroke-dark` from the palette and lets
`globals.css` pick, *"so theme switches are CSS-only (no JS subscription, no
hydration mismatch)."*

Two defects recorded and **not** fixed (decision log 2026-08-23, #720):
`dark_color` *"is unreachable in production"* on web — absent from
`EmotionPalette` and from the `v_emotions_with_palette` select there — and
`PebbleVisual` *"silently drops `strokeOverride` on client-engine renders."*

`emotions.color` (6-digit, per-emotion) remains **soft-deprecated, not dropped**,
because shipped iOS builds read it.

---

## 7. Rive

**What it does now:** one animation, one surface. `pbbls-cairn-states.riv` drives
the horizontal week-roll cairn on iOS — a state machine with an `isSelected`
bool input and a `strokeColor` Data Binding colour property, one `RiveViewModel`
per cell (`apps/ios/Pebbles/Features/Path/Components/WeekRollCairnCell.swift`,
`apps/ios/Pebbles/Theme/Color+Rive.swift`).

**Assets in `packages/rive/`:** `pbbls-cairn-states`, `pbbls-cairn.riv`,
`pbbls-logo-appear_idle.riv`, `pbbls-logo.riv`. No README or docs in that
package — **NOT FOUND**.

**What replaced what:**

- Rive **replaced nothing** in pebble rendering — pebbles have never been Rive.
- Rive **was replaced** in the launch flow. The app used to open on a *fake*
  loader: `pbbls-logo-appear_idle.riv` held by a hardcoded ~2.5 s timer. On
  2026-07-17 (#598) a native `HandcraftedLogoView` took over — draws the logo
  SVG stroke-by-stroke, boils it (#555 vocabulary, seeds 3/4/5, 4 fps, ping-pong
  `[0,1,2,1]`), then settles, gated on a real readiness event (auth + reference
  data) with an 8 s ceiling and no spinner anywhere. *"The Rive splash asset
  usage is removed from the launch flow (`.riv` files and `WeekRollCairnCell`'s
  Rive stay)."*
- Android still ships `RiveLogo.kt` wrapping `pbbls_logo_appear_idle.riv` for
  Welcome; the handcrafted port is **pending**, specified in
  `docs/superpowers/specs/2026-07-17-handcrafted-logo-loader-porting.md`
  (`AC-handcrafted-launch-loader`, status `development`).
- On **web**, `@rive-app/react-canvas@^4.21.0` is still in `apps/web/package.json`
  and `WeekRoll.tsx` still carries a comment about *"the Rive canvases"* — but
  `WeekRollCairn.tsx` renders a plain text button with no Rive and no cairn art.
  The dependency and the comment are residue; whether web ever shipped a Rive
  cairn is **NOT FOUND** in the decision log or journal.

---

## 8. Visual elements abandoned between May and September 2026

Ordered by date. Only items with a stated reason in the repo are listed.

| Date | Abandoned | Stated reason | Source |
|---|---|---|---|
| **2026-04-08** *(pre-window, for the record)* | **Emotion Pearl** — the glowing pearl above the emotion grid (`V-emotion-pearl`, `DM-emotion-pearl`, `API-create-emotion-pearl` all → `archived`) | No reason recorded in the journal — status change only | `docs/arkaik/journal.jsonl:241-243`; shipped `pr-37` 2026-03-29 |
| **2026-04-29** *(pre-window, for the record)* | **`pebbles.render_manifest`** — the server-emitted `AnimationManifest`, with `buildManifest`, `extractPaths`, `estimatePathLength` and the `TIMING` constant | *"It duplicates information already present in the composed SVG (path `d` strings and per-stroke `length` estimates) and adds non-trivial payload for what is, conceptually, a small ordered list of phase timings… drop the manifest entirely, let the SVG carry structure, and put motion on the client where it belongs."* | spec `2026-04-29-ios-pebble-stroke-animation-design.md`; migration `20260429000000_drop_pebbles_render_manifest.sql` |
| **2026-05-19/20** | **The square/rounded-square card chrome** behind pebble renders | *"The squared chrome reads as 'interface' — heavy, generic — and fights with the organic, hand-drawn feel of the pebble itself."* Also rejected: #473's proposal to embed the silhouette *inside* the composed SVG — *"cascades into canvas expansion, layer translation, `render_version` bump, backfill migration…"* | spec `2026-05-19-pebble-outline-frame-ios-design.md`; journal `pr-475` 2026-05-20 |
| **2026-07-01** | **`glyphs.shape_id` + the `pebble_shapes` table**, and every reader: `Mark.shape_id`, `PEBBLE_SHAPES` config, `useShapeName`, `carve/PebbleOutline.tsx`, shape i18n strings, `publish_admin_glyph`'s `p_shape_id` param | *"No live data flowed through `shape_id` — it was pure backward-compat cruft, and `pebble_shapes` had no reader after the FK went away. Removing both eliminates a misleading data model (glyphs are shape-agnostic)."* | decision log 2026-07-01 (#503) |
| **2026-07-13** | **Build-time / server-side wobble baking** (issue #555 §0's own recommendation), and **the centerline-stroke render mode** of its §4 contract | Baking: glyphs are user-carved and traded, so it is impossible; a write-time bake iterates slowly, grows `render_svg` 5–15×, and misses the glyph-only surfaces. Centerline: *"a stroked wobbled centerline … cannot reproduce"* the breathing width, and *"`trim()`-based draw-on cannot animate a fill."* | decision log 2026-07-13 (#555) |
| **2026-07-17** | **The Rive splash** (`pbbls-logo-appear_idle.riv` on a hardcoded ~2.5 s timer) in the iOS launch flow, and the spinner | *"The app opened on a fake loader… #598 decided the app should open with an actual handcrafted animation that loads."* The event-gated transition *"reflects real readiness instead of a guessed duration… and avoids the brutal time-based cuts that duration math produced."* | decision log 2026-07-17 (#598) |
| **2026-08-24** | **The nine-tile valence grid with icon assets** in the record flow, on all three surfaces (kept only in web's three edit sheets) | *"The thing you are choosing looks nothing like the thing you get. Every other pebble surface … draws a real wobbled stone silhouette. The picker draws an icon."* | spec `2026-08-24-ios-valence-fan-picker-design.md`; decision log 2026-08-24 (#727, #729) |
| **2026-08-24** | **Debug-only / dev-and-preview wobble gating** on iOS and web | *"Making the picker the one always-wobbly surface in an otherwise smooth app was the worse of the two inconsistencies."* Also: *"promoting the flag was cheaper and more honest."* | decision log 2026-08-24 (#727 iOS, #729 web) |
| **2026-08-24, in-spec** | The fan's **one-line caption** ("A small highlight.") + `Valence.caption`'s nine strings | Replaced by a three-line typographic lockup from designs supplied after the first build | spec revision 2 |
| **2026-08-24, in-spec** | The **`A BIG` / `BIG` overtitle** + `Valence.Headline.prefix` | *"Size is carried by the word's own size and by the pyramid, which is what the two axes were always meant to say without a third line saying it again."* | spec revision 4 |
| **2026-08-24, in-spec** | **`Valence.sizesAbove` / `sizesBelow`** as rendered marks above and below the lockup | *"Changed the block's height on every size step and shoved the whole thing up and down the page."* | spec revision 3 |
| **2026-08-24, in-spec** | The **shadow behind the selected stone** | Replaced by role inversion — *"the chosen stone reads as filled in rather than as merely less faded than its neighbours."* | spec revision 5 |
| **2026-08-24, in-spec** | The **purple → indigo → pink → orange → yellow mesh**, and two failed successors (a mesh from three emotion-category secondaries; a full-hue-wheel pastel) | *"The original purple / pink / orange / yellow read as a photo filter"*; the category mesh *"was no better"*; the hue wheel *"was clownish however its ink was tuned."* Replaced by a warm reference sampled at 16 control points, all hues 3°–41°: *"Hue range is the setting that mattered, not saturation or lightness."* | spec revision 5 |
| **2026-08-24, in-spec** | The **stroked silhouette** first cut of the fan stone | *"The wash and the line landed on the same edge — which is not how the Path or the read sheet draws a pebble."* | spec revision 1 |
| **2026-08-24, in-spec** | **`ValenceSizeGroup.description`** rendering (the day/week/month sentences), and the picker's use of `Assets.xcassets/Valence/` + `Valence.assetName` | Left on the model / in place, but no longer drawn anywhere. Meaning survives for VoiceOver via `ValenceSizeGroup.name` + `Valence.shortLabel` | spec, Selection/accessibility + "Out of scope" |
| **Undated** | **Web's cairn artwork** in `WeekRollCairn.tsx` (now a plain text button, though `@rive-app/react-canvas` and a stale Rive comment remain) | **NOT FOUND** — no decision entry or journal event explains this | `apps/web/components/path/WeekRollCairn.tsx`; `apps/web/components/path/WeekRoll.tsx:48` |

---

## 9. STALE — no longer true

The four background claims from the April–May corpus, tested:

### ① "Intensity (1–3) × valence (−2..+2) produced NINE canvases" — **PARTLY STALE (and was never right)**

The count is correct and current: nine. The axis is not. `positiveness` is
**−1 / 0 / +1**, never −2..+2 — 3 × 3 = 9, not 3 × 5. The decision log restates
this as recently as 2026-08-24: *"`positiveness` (-1/0/+1) and `intensity`
(1/2/3) are what they always were."* See
`packages/supabase/supabase/functions/_shared/engine/resolve.ts`.

"Hand-drawn without AI in April 2026" — **NOT FOUND**. Neither the decision log
nor the specs record provenance of the nine canvases.

"Style deliberately flat" — **STALE since 2026-08-24.** Flat is now what the app
*doesn't* look like. Every stone on every surface draws through the petroglyph
wobble in production; a wobbled stone is *"a wobbled silhouette with wobbled ink
inside it."* The flat template icons were specifically the thing the fan replaced.

### ② "Emotion Pearls abandoned; emotion colour moved into the SVG fill" — **HALF STALE**

Abandonment: **true, and older than the corpus** — `V-emotion-pearl`,
`DM-emotion-pearl` and `API-create-emotion-pearl` all went to `archived` on
**2026-04-08** (`docs/arkaik/journal.jsonl:241-243`). They now survive only as an
admin-analytics metric name in `docs/poc/admin-analytics/`.

"Colour moved into the SVG fill": **STALE, and inverted.** The server-composed
SVG carries no colour at all — `compose.ts` forces `fill="none"` on every shape
element and rewrites every stroke to `stroke="currentColor"`, with the comment
*"The client applies the emotion color at render time."* Colour is applied
per-surface, per-theme, from the **emotion category** palette (six hex slots),
not from the emotion and not in the fill. The only place a colour is baked into
SVG is web's legacy client-engine fallback (`recolor()` in
`apps/web/lib/engine/render.ts`), which runs only when `render_svg` is null.

### ③ "A shared pure-TypeScript engine (`engine/`: types/glyph/layout/compose) composed shape + optional fossil + glyph into a monochrome SVG with an animation manifest, called from Supabase RPCs `create_pebble`/`update_pebble`" — **TWO PARTS STALE**

Still true: the engine exists at
`packages/supabase/supabase/functions/_shared/engine/` with exactly those
modules (plus `resolve.ts` and `shapes/`), it is pure TS, and it composes shape +
glyph + optional fossil into a **monochrome** SVG.

**Stale part A — the animation manifest is gone**, and was already gone before
the corpus was written. `pebbles.render_manifest`, `AnimationManifest`,
`buildManifest`, `extractPaths`, `estimatePathLength` and the `TIMING` constant
were all removed on **2026-04-29** (`20260429000000_drop_pebbles_render_manifest.sql`).
`composePebble()` returns `{ svg, canvas }` only. Motion moved to a client-owned
timings table keyed by `render_version`.

**Stale part B — the call direction is backwards.** The engine is not called
*from* the RPCs. The **edge function `compose-pebble` wraps the RPC**: it
auth-forwards the caller's JWT, calls `create_pebble(payload)` to get a
`pebble_id`, then runs `composeAndWriteRender` to write `render_svg` /
`render_version`. Same shape for `compose-pebble-update` and the ops-only
`backfill-pebble-render`. (`packages/supabase/supabase/functions/compose-pebble/index.ts`,
`_shared/compose-and-write.ts`. The arkaik node from 2026-04-16 already said so:
*"Pebble artwork is composed server-side by an edge function wrapping
create_pebble."*)

**Also stale — "a shared engine" as a description of rendering.** Composition is
shared; **rendering is not**. Three hand-written per-surface implementations now
draw the pebble (iOS Swift, Android Kotlin, web TS), each with its own wobble
port, kept in agreement by golden fixtures rather than shared code — an
explicitly accepted drift risk (decision log 2026-07-13). Web additionally keeps
a *second*, divergent client-side compose engine (`apps/web/lib/engine/`) as a
legacy fallback.

### ④ "A 'valence picker sheet' shipped 19 April 2026: 'nine shapes, two polarities — one gesture'" — **STALE**

The date is right and something did ship on 2026-04-19 (journal:
*"Choose how big a moment felt, by picture"*, node `AC-valence-picker-cairn`).
But:

- **"Two polarities" is wrong** — there are and always were **three**:
  `lowlight` / `neutral` / `highlight`. Nine = 3 sizes × 3 polarities.
- **The April sheet is superseded.** Its recorded behaviour was *"nine
  illustrated pebble shapes grouped as day, week and month events, each with the
  copy that explains what that cairn means"* — tiles, headers, sentences, flat
  icons. Since 2026-08-24 the record flow on all three platforms shows the fan
  (`AC-valence-fan-roll`, `live`): *"nine real pebble stones fanned out small to
  large, and I can tap one or swipe the word underneath — sideways for how it
  landed, up and down for how big it was."*
- **"One gesture" is now literally two axes** — polarity and size — plus tap.
- The grid survives **only in web's three edit sheets** (`PebbleDetail`,
  `PebbleEdit`, `QuickPebbleEditor`), by an explicit decision, because a sheet
  that commits and closes on pick cannot host a roll. iOS and Android converted
  their sheets to stage-and-commit-on-**Done**.

---

## 10. NOT FOUND

- Provenance of the nine canvases ("hand-drawn without AI in April 2026") — no
  record in `docs/decisions/log.md`, the specs, or the journal.
- Decision-log entries dated 2026-05-06 and 2026-07-17/18 for the emotion
  palette work. `docs/decisions/log.md` **begins at 2026-05-26**; the palette
  work is documented in specs, migrations and journal entries instead. The two
  2026-07-17 log entries that do exist are about Lab Notes (#601) and the app-open
  loader (#598), not palettes.
- Why web's `WeekRollCairn` lost its artwork, and whether it ever rendered Rive.
- Any README or documentation inside `packages/rive/`.
- Any `deliverable.shipped` journal entry after **2026-08-03** — the valence fan
  and the wobble's production ship appear in the journal only as `node.created` /
  `node.status_changed` events for `AC-valence-fan-roll` (2026-08-24). The
  wobble's own node `AC-petroglyph-wobble-ink` still reads `status:
  "development"` on all three platforms in `docs/arkaik/bundle.json`, which
  contradicts the 2026-08-24 decision entries; the bundle is behind.
