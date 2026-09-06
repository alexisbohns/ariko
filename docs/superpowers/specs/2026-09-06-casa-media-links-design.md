# CASA — a gallery, and where a thing can be found

*2026-09-06*

## 0. The observation

The CASA Podcast has been in the garden since the baseline migration, and it is
three names and nothing else:

```
plant:casa  "CASA Podcast"
├── bean:casa-dating     → sprout:casa-dating-0     "CASA Episode 1"  2026-02-18
└── bean:casa-tolerance  → sprout:casa-tolerance-0  "CASA Episode 2"  2026-02-19
```

Two episodes exist in the world. Each has a carousel of Instagram slides sitting
on a disk, and each is listenable on four platforms. **The model can hold
neither.**

The first gap is presentational. `Sprout.media?: Media[]` is real and
`MediaList` renders it — one image per row, full width. Eight 1080×1350
portraits that way is eight screens of scroll before the reader reaches
anything else. There is no such thing as a *set* of images.

The second gap is structural, and it is the interesting one. "Listen on
Spotify" is not an asset. It is a **destination** — a place this thing can be
found, which is exactly the kind of fact `media[]` is not for and `relations[]`
is not for either (`relations[]` is strictly internal graph edges, in the
prefixed `plant:`/`pod:`/`bean:` grammar). Ariko has no field that means *here is
where this lives elsewhere*, so today the only home for six URLs is prose in a
`content` blob — where nothing can read them, badge them, or notice when one
rots.

This spec closes both, and imports the actual content.

## 1. `links[]` — a second list, deliberately not `media[]`

### 1.1 The type

```ts
export interface PlatformLink {
  platform: string;   // spotify | apple-podcasts | deezer | ausha | instagram | linktree | link
  url: string;
  label?: Text;       // optional bilingual override; the platform's own name otherwise
}
```

Added to **two** tiers:

```ts
export interface Plant  { …; logo?: MediaImage; links?: PlatformLink[] }
export interface Sprout { …; media?: Media[];   links?: PlatformLink[] }
```

`Plant` gains `links` and **not** `media`. It has `logo?: MediaImage` — one
image, singular, because "a plant has one mark" — and giving it an assets array
so that six URLs have somewhere to sit would be inventing a body for something
that has none. §1.2 is why those six are not assets in the first place.

Not on `Pod`, not on `Bean`. Nothing needs them there, and the day something
does is the day to add it — the same stance `Bean.description` records for
having arrived late.

`PlatformLink` contains no entity refs, so `filterPublic` needs **no scrub** for
it. That is the same property `PlantRole` has, and it is written down here for
the same reason it is written down there: the absence of a scrub should be a
stated conclusion, not an oversight nobody noticed.

### 1.2 Why not just widen `media[]`

Because the type would stop saying what is stored, and `MediaList` would have to
guess.

`media[]` means *assets rendered in the body* — an image, or a player framed
inline. `links[]` means *destinations*, which are never rendered inline and are
never framed. Putting an Apple Podcasts show URL into `media[]` would make it
indistinguishable from a Spotify episode URL that genuinely is meant to become
a 152px player, and the only thing separating them would be a rule living in a
renderer's control flow.

They also live at different **levels**, which a single array cannot express: the
show's platform row belongs to `plant:casa`, the episode's to each sprout. A
plant has no `media[]` at all today, and giving it one to carry six links would
be inventing an assets list for something that has no assets.

### 1.3 `lib/platforms.ts` — the one place a platform is decided

Four exports, and the file is the sole authority on all four:

- `PLATFORM_HOSTS: Array<[string, string]>` — host → platform, first match wins.
- `detectPlatform(url): string` — reuses `hostMatches` from `lib/embeds.ts`
  (exact host or subdomain, **never** substring), falling back to `"link"`.
- `PLATFORM_LABEL: Record<string, string>` — the display form, looked up and
  never derived, exactly as `PROVIDER_LABEL` and `lib/glyphs.ts` are.
- `normalizeLinkUrl(url): string` — see below.

The initial host table:

| host | platform |
|---|---|
| `open.spotify.com`, `spotify.com` | `spotify` |
| `podcasts.apple.com`, `music.apple.com` | `apple-podcasts` |
| `deezer.com` | `deezer` |
| `ausha.co` | `ausha` |
| `instagram.com` | `instagram` |
| `linktr.ee` | `linktree` |
| `youtube.com`, `youtu.be` | `youtube` |
| `soundcloud.com` | `soundcloud` |

**This is deliberately a separate table from `HOST_PROVIDERS`.** That one decides
what gets loaded into an iframe, and `lib/embeds.ts` is under a
dependency-free constraint because `next.config.ts` imports `EMBED_FRAME_HOSTS`
while Next reads its config, before the app exists. Widening the embed table so
Linktree can have a chip would change framing behaviour to gain a label —
the wrong direction of trade. `lib/platforms.ts` imports one function from
`lib/embeds.ts` and nothing else.

### 1.4 `normalizeLinkUrl` is load-bearing, not hygiene

Stripped query parameters: `stkn`, `si`, `nd`, `dlsi`, and anything matching
`utm_*`. Fragment dropped. Everything else preserved verbatim.

This exists because of a real value in the real input. The Instagram post URL
supplied for this slice was:

```
https://www.instagram.com/p/DVAxzXvDNkZ/?utm_source=ig_web_copy_link&stkn=MzRlODBiNWFlZA==
```

`stkn` is Instagram's **private-share token**. Storing it puts a credential-ish
value in the database and then serves it on a public page. The Spotify episode
URLs arrived carrying `nd` and `dlsi`, Spotify's share-attribution parameters,
which are equally not part of the address.

Normalization runs at the **write** boundary (the migrate derivation in §4.1 and
the import script in §4.2), never at render. A stored URL is already clean.

### 1.5 `platform` is derived, never declared

`detectPlatform` runs server-side over the URL, and the caller's opinion is
discarded. This is the rule `lib/inbox.ts` already applies to
`MediaEmbed.provider`, restated because it is the property that makes
`PLATFORM_LABEL[link.platform]` safe to render: a `platform` string can only
ever be a member of the table above.

## 2. The gallery — a run-grouping rule, not a new field

### 2.1 The rule

`MediaList` chunks `media[]` into **consecutive runs** by kind. A run of two or
more `kind: "image"` entries renders as one scroll-snap strip. Everything else —
embeds, and a run of exactly one image — keeps today's markup byte for byte.

That last clause is what bounds the blast radius: the only rows that change
appearance are rows with two adjacent images, and `data/garden.yml` authors no
`media` at all — every existing entry was written through the admin picker.
**Verify before merging** (`db.sprouts.find({ "media.1": { $exists: true } })`)
rather than assuming; if an existing sprout does hold an adjacent pair, it
becomes a strip too, and that is either fine or a reason to gate on count.

The chunking is pure and lives in `lib/media-runs.ts` with its own test. The
component keeps only the markup. This is the repo's standing habit — `lib/toc.ts`
holds the arithmetic and `components/toc-rail.tsx` holds the DOM — and it applies
here for the same reason: a grouping bug and a layout bug should not have to be
diagnosed through the same surface.

### 2.2 The strip

```
┌──────────────────────────────┐
│ ┌───────┐ ┌───────┐ ┌─────   │
│ │  1/8  │ │  2/8  │ │  3/8  →│
│ └───────┘ └───────┘ └─────   │
└──────────────────────────────┘
```

- `overflow-x-auto`, `scroll-snap-type: x mandatory`, `scroll-snap-align: start`
  per slide, `gap-3`.
- Slide width `min(78vw, 22rem)`; the stored `width`/`height` still ride on each
  `<img>`, so the 4:5 box is reserved and the page does not reflow as slides
  arrive.
- The strip is `tabIndex={0}` with a group `aria-label` naming the count, so it
  is arrow-scrollable from the keyboard.
- Inside the reading measure, not bleeding past it. `READING_COLUMN` is the same
  string in both zones and a carousel is not a reason to make it not be.

**Server component. No `"use client"`, no `lucide-react`.** The whole affordance
is CSS — there is no JS carousel here, no dots, no arrows, and therefore nothing
that stops working without script. This is the `toc-rail` bar cleared without
needing an island at all.

### 2.3 Alt text

`MediaImage.alt` is `string`, not `Text` — it does not localize. The CASA slides
carry French text, so the alt written for them is French, and it stays French
for an English reader.

That is a pre-existing limitation of the type and this slice does not fix it.
Named here so the next person finds a decision rather than a bug.

## 3. Instagram becomes a framable provider

### 3.1 The three edits

**`lib/embeds.ts`** — `["instagram.com", "instagram"]` joins `HOST_PROVIDERS`,
and `instagramId()` extracts the shortcode from `/p/{code}/` or `/reel/{code}/`,
validated against `/^[A-Za-z0-9_-]{5,32}$/`.

Validated *here* rather than escaped at the point of use, which is the discipline
`YOUTUBE_ID` records: a shortcode that is not a shortcode degrades to a link
card, instead of building a URL on a trusted host out of arbitrary stored text.

**`lib/embed-src.ts`** — one case:

```ts
case "instagram":
  return media.embedId
    ? { src: `https://www.instagram.com/p/${encodeURIComponent(media.embedId)}/embed`,
        title: "Instagram post", aspect: "social" }
    : null;
```

and `"https://www.instagram.com"` joins `EMBED_FRAME_HOSTS`, from which
`next.config.ts` builds the CSP `frame-src`. No hand-edited CSP.

Origin safety holds by the same argument the file's header already makes: the
URL is reduced to a charset-bounded id and the origin is a literal. A forged
`provider`/`embedId` pair produces the wrong post on an allowlisted origin,
never an unallowlisted one.

**`components/media.tsx`** — `FRAME_BOX` gains `social: "h-[720px] w-full"`.
It gains it *because the build fails without it*: `FRAME_BOX` is typed
`Record<EmbedFrame["aspect"], string>`, so a fourth aspect cannot silently
inherit the 166px audio box. That guard is the reason the union is typed at all,
and this slice is the first thing to exercise it.

720px is the taller end of a 4:5 carousel plus Instagram's own header and action
bar — the same "clipping loses content, padding only loses whitespace" rule the
audio boxes follow.

### 3.2 The accepted duplication

Episode 1 will render the Instagram embed **and** the six uploaded slides — the
same carousel twice on one page.

This was raised and chosen. What it buys: live like and comment counts on top,
and durable copies underneath that survive the post being deleted, plus both
episode pages keeping the same shape as each other. What it costs: a Meta iframe
and its cookies on a public page, and a visible repeat.

Recorded so it reads as a decision rather than an accident.

## 4. Authoring — links in yml, images in a script

The split follows what each store can actually hold.

### 4.1 Links: `data/garden.yml` + a derivation in migrate

`migrate-garden.ts` already spreads the whole yml document into `$set`, so a
`links:` key flows through with no new write path. The yml carries **only the
URL**, and migrate derives the rest:

```yaml
- slug: casa
  links:
    - url: https://open.spotify.com/show/5NDGxBSeMxeTguOpWl2MDI
    - url: https://podcasts.apple.com/fr/podcast/casa-podcast/id1878359919
```

One helper, applied to plants and sprouts alike before the upsert:

```ts
const linked = <T extends { links?: { url: string }[] }>(doc: T) =>
  doc.links
    ? { ...doc, links: doc.links.map((l) => {
        const url = normalizeLinkUrl(l.url);
        return { ...l, url, platform: detectPlatform(url) };
      }) }
    : doc;
```

This keeps §1.5 true through the one path that writes links, and keeps the yml
terse enough that a hand-authored entry cannot get `platform` wrong.

### 4.2 Images: `scripts/import-casa-media.ts`

Uploads what yml cannot hold. Reads the two folders in filename order, pushes
each file through the existing `uploadImage()` (Cloudinary mints the public_id —
never a filename-derived one, per `lib/storage.ts`), and `$set`s `media[]` on the
sprout.

Re-running `migrate-garden` afterwards cannot clobber it: `media` is not a yml
field, so it is not in the `$set` document.

Order matters here — it is a carousel — which is the whole reason this is a
script rather than a drag into the admin picker, where multi-file drop order is
not guaranteed.

The script is **idempotent by slug**: it writes the full `media[]` array, so a
second run replaces rather than appends. It logs each upload and the two final
counts.

### 4.3 What is out of scope

**There is no admin editor for `links[]`.** Adding one means a card on
`/admin/plant/[slug]`, which is now a hero with sheets rather than a stack of
cards — a decision of its own, not a rider on this slice. Until then, links are
authored in `data/garden.yml` and applied by `npx tsx scripts/migrate-garden.ts`,
which is how plant metadata is authored today anyway.

## 5. The content

### 5.1 `plant:casa`

| platform | url |
|---|---|
| spotify | `https://open.spotify.com/show/5NDGxBSeMxeTguOpWl2MDI` |
| apple-podcasts | `https://podcasts.apple.com/fr/podcast/casa-podcast/id1878359919` |
| deezer | `https://www.deezer.com/fr/show/1002670521` |
| ausha | `https://podcast.ausha.co/casa-podcast` |
| instagram | `https://www.instagram.com/casa.lepodcast` |
| linktree | `https://linktr.ee/casa.lepodcast` |

### 5.2 `sprout:casa-dating-0` — Episode 1, *Dating : jumelles, pizza et photos de pieds*

`links[]`:

| platform | url |
|---|---|
| spotify | `https://open.spotify.com/episode/4PkLhHEbiZTSXYCmJENwqT` |
| apple-podcasts | `https://podcasts.apple.com/fr/podcast/dating-jumelles-pizza-et-photos-de-pieds/id1878359919?i=1000750486031` |
| deezer | `https://www.deezer.com/fr/episode/846725011` |
| ausha | `https://podcast.ausha.co/casa-podcast/dating-jumelles-pizza-et-photos-de-pieds` |

`media[]`, in order:

1. embed — `https://open.spotify.com/episode/4PkLhHEbiZTSXYCmJENwqT` → 152px player
2. embed — `https://www.instagram.com/p/DVAxzXvDNkZ/` → 720px Meta iframe
3. the six 1080×1350 images from `/Users/alexis/Podcast/01-dating/post/`,
   `post-dating 1.jpg` … `post-dating 6.jpg`

The eight 1080×1920 `story-dating-*.jpg` files are **not** imported — those
visuals were never posted.

### 5.3 `sprout:casa-tolerance-0` — Episode 2, *Couple : accepter l'autre malgré la romantasy et les calamars vampiriques*

`links[]`:

| platform | url |
|---|---|
| spotify | `https://open.spotify.com/episode/6haxhA84s8YavAPdMyjn3J` |
| apple-podcasts | `https://podcasts.apple.com/fr/podcast/couple-accepter-lautre-malgre-la-romantasy-et-les-calamars/id1878359919?i=1000750485891` |
| deezer | `https://www.deezer.com/fr/episode/846724991` |
| ausha | `https://podcast.ausha.co/casa-podcast/couple-accepter-l-autre-malgre-la-romantasy-et-les-calamars-vampiriques` |

`media[]`, in order:

1. embed — `https://open.spotify.com/episode/6haxhA84s8YavAPdMyjn3J` → 152px player
2. the eight 1080×1350 images from `/Users/alexis/Podcast/02-couple/`,
   `post-couple-01.jpg` … `post-couple-08.jpg`

### 5.4 A naming note

The sprout slugs read `casa-dating-0` / `casa-tolerance-0`, and their `name`s are
`CASA Episode 1` / `CASA Episode 2`. Ausha publishes both on 2026-02-19; the
garden dates them 2026-02-18 and 2026-02-19.

Neither is corrected here. The dates are what orders them in the timeline and
they order correctly; renaming the sprouts to their real titles is a content
edit, not a model one, and belongs in the admin rather than in this slice.

## 6. Rendering

### 6.1 `components/link-row.tsx`

A server component taking `PlatformLink[]`, rendering a wrapping row of chips.
Each chip is `target="_blank" rel="noopener noreferrer"` with the `sr-only`
"(opens in a new tab)" span `components/media.tsx` already established as the
public zone's convention.

An absent or empty `links` renders `null`, the same contract `MediaList` has.

### 6.2 Text chips, and why there are no brand marks yet

Each chip is the platform's **name as text**, on the existing `Badge` — which is
exactly the row the approved design previewed: `[Spotify] [Apple] [Deezer]
[Ausha]`.

Brand marks are deliberately **not** in this slice, and the reason is a rule the
repo already enforces rather than a shrug. `components/public-icons.tsx` says of
its own glyphs: *"copy `__iconNode` out of node_modules/lucide-react — do not
eyeball it"*, and `components/public-icons.test.tsx` renders lucide's component
beside each copy and compares the geometry, so a drifted path fails a test
instead of reaching a visitor.

There is no equivalent source in the tree for a Spotify or Instagram mark.
lucide has no brand icons (its `apple` is the fruit), and `simple-icons` is not
a dependency. Hand-drawing five brand paths would be precisely the eyeballing
that file forbids, with no test able to catch a wrong one.

So the marks are a follow-up with a real prerequisite: add `simple-icons` as a
devDependency, copy its paths into a **new** `components/platform-icons.tsx`,
and give it the drift test `public-icons.test.tsx` already models. They do not
belong in `public-icons.tsx` — that file's header and its test both assert
"every glyph here is lucide's", and a CC0 brand mark would make both false.

### 6.3 Where the row appears

**There is no public sprout route.** The public zone is `/`, `/beanstalk`,
`/plant/[slug]`, `/pod/[slug]` and `/bean/[id]` — and a sprout renders as a
`Card` inside its bean's page, beside the property dump. So:

- `app/(public)/(chrome)/plant/[slug]/page.tsx` — `plant.links`, beneath
  `<PlantHead>`.
- `app/(public)/(chrome)/bean/[id]/page.tsx` — `sprout.links`, inside each
  sprout `Card`, immediately above its `<MediaList>`.

Both pages are server components already and `LinkRow` is server-safe, so
neither grows a boundary.

One thing that needs no work: the bean page's property dump renders a row per
scalar property, and `isScalar` rejects arrays — so `links[]` stays out of the
dump the same way `media[]` already does.

## 7. Tests

| file | what it pins |
|---|---|
| `lib/platforms.test.ts` | host table; `detectPlatform` exact-host matching (`instagram.com.evil.test` → `link`); `normalizeLinkUrl` strips `stkn`/`si`/`nd`/`dlsi`/`utm_*` and preserves the rest |
| `lib/media-runs.test.ts` | chunking: all-images, all-embeds, alternating, a single image staying a single, empty |
| `lib/embeds.test.ts` | `instagram` detection; shortcode extraction from `/p/` and `/reel/`; an over-long or bad-charset code yielding no `embedId` |
| `lib/embed-src.test.ts` | the host table gains exactly one origin; a missing `embedId` returns `null` |
| `components/media.test.tsx` | a forged instagram row renders an `instagram.com` src and nothing else; a two-image run renders one strip; a one-image run renders today's markup |
| `components/link-row.test.tsx` | empty → `null`; each chip's href, label and new-tab announcement |
| `lib/server-safe-source.test.ts` | the four public-zone files carry no `"use client"`, no `lucide-react`, no `node:` |
| `lib/data.test.ts` | `filterPublic` leaves `links` intact on a public plant and drops the plant entirely when private |

## 8. Order of work

1. `lib/platforms.ts` + test. No consumers yet.
2. `PlatformLink`, `Plant.links`, `Sprout.links` in `lib/data.ts`; `filterPublic` note + test.
3. `lib/media-runs.ts` + test; the strip in `components/media.tsx` + test.
4. Instagram: `lib/embeds.ts`, `lib/embed-src.ts`, `FRAME_BOX`, the three tests.
5. `components/public-icons.tsx` marks; `components/link-row.tsx` + test; wire into the plant and sprout pages.
6. `data/garden.yml` links (§5) + the `linked()` derivation in `migrate-garden.ts`.
7. `scripts/import-casa-media.ts`; run it; verify both pages.

Steps 1–5 ship no content and change nothing visible. Steps 6–7 are the content.

## 9. Verification

- `npm test`, `npx tsc --noEmit`, `npm run build`.
- `lib/chrome-source.test.ts`'s rule applies to every new public-zone file: no
  `"use client"`, no `lucide-react`, no `node:`. A violation passes all three
  commands above, which is why that test exists — but it currently reads one
  hard-coded file. Generalize it to a list (`git mv` to
  `lib/server-safe-source.test.ts`) covering `components/chrome.tsx`,
  `components/media.tsx`, `components/public-icons.tsx` and
  `components/link-row.tsx`.
- Load both episode pages with **JavaScript disabled**: the strip must still
  scroll, the chips must still link. Only the two iframes should be missing.
- Confirm the served CSP `frame-src` contains `https://www.instagram.com`.
- Confirm `plant:casa`, both beans and both sprouts are actually published
  before treating the pages as live — the baseline migration set those defaults
  on insert and they may have been changed since.

## 10. Lab Note

This ships something a visitor notices, so the PR carries one.

```yaml
en:
  title: CASA Podcast, with the pictures and the players
  summary: >-
    Both CASA episodes now have their Instagram slides as a swipeable gallery,
    and a row of buttons to listen wherever you already listen — Spotify, Apple
    Podcasts, Deezer or Ausha.
fr:
  title: CASA Podcast, en images et en écoute
  summary: >-
    Les deux épisodes de CASA ont maintenant leurs visuels Instagram en galerie,
    et tu peux lancer l'écoute directement, ou filer sur Spotify, Apple
    Podcasts, Deezer ou Ausha.
suggested:
  molecule: ariko
  type: feature
  tags: [changelog]
```
