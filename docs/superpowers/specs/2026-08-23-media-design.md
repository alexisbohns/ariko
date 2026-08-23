# The media slice — the garden learns to hold pictures

**Date:** 2026-08-23
**Roadmap:** Track B — **B2** (image attach on the capture bar) and the open half of **B3**
(media/embed rendering + the embed host-matching hardening).
**Handoff:** [`../handoffs/2026-08-23-media.md`](../handoffs/2026-08-23-media.md)
**Umbrella:** [`2026-08-22-content-composition-design.md`](2026-08-22-content-composition-design.md)
— §5 deferred the cover convention to the slice that would create the images. This is it.
**Status:** Approved design, ready for a plan.

---

## 1. Problem

**Ariko has never created an image, and has never shown one.**

The upload machinery is finished and unused. `POST /api/upload` (`app/api/upload/route.ts`) is
bearer-gated on `INBOX_TOKENS`, takes `multipart/form-data`, and returns a `MediaImage`.
`lib/storage.ts` maps a Cloudinary result to that descriptor through a pure, unit-tested
`toMediaImage`. `lib/inbox.ts:78-104` validates `kind:"image"` entries end to end, and
`lib/promote.ts:81` carries a seed's `media[]` verbatim onto the sprout it promotes into.

Every link in that chain works. **Nothing pulls it.** The capture bar
(`app/admin/page.tsx:78`) has a title, a note, a language radio and two `link` fields — no file
input — and `buildSeedBody` (`lib/seed-form.ts:20`) mints only bare `{kind:"embed"}` entries from
them. There are **zero `MediaImage` records in the production database**, and exactly one
`MediaEmbed`, provider `link`.

The other end is equally empty. **No surface renders `media[]`.** Every `media` hit in the app is
seed, inbox or promote plumbing. `/bean/[id]` renders a sprout's `content` as prose and dumps its
scalar properties; `media[]` is an array, so `dumpRows`' scalar filter drops it silently. The one
embed in the database has never been seen by anyone.

Two consequences follow, and they are why the roadmap pairs these halves:

1. **The cover convention has been deferred twice** (umbrella §5) for want of images to derive it
   from. It stays hypothetical until something creates one.
2. **`lib/embeds.ts:45` matches provider hosts by substring** — `host.includes("vimeo.com")` — so
   `vimeo.com.evil.test` detects as `vimeo`. Harmless while nothing renders an embed. It becomes a
   trust signal the instant one is iframed.

## 2. Decisions

Five decisions were genuinely open. All five are settled here, with the reasoning, so a later
reader can tell a decision from drift.

1. **The capture bar gains a client-JS island. The exception widens, deliberately.**

   `CLAUDE.md` scopes the rule to *metadata* forms and names the prose editor "the one deliberate
   exception… widening it to any other form is a decision, not a convenience." This is that
   decision, taken rather than backed into.

   A zero-JS path exists — a native file input posting multipart to the server action — and was
   rejected. It can upload, but it cannot show a thumbnail, cannot report per-file progress, cannot
   retry a failed upload without re-picking the file, and cannot let a capture proceed while an
   upload is still in flight. Those are the whole substance of the "media pending" UX B2 exists to
   provide.

   **The widening is bounded by a rule, stated in `CLAUDE.md` in the same PR:**

   > The media picker renders **nothing until it mounts**. Without script, the capture bar is
   > byte-for-byte what it is today, and no capture or edit ever depends on the picker.

   That rule is what keeps this an island rather than a slope. The metadata fields around it stay
   native controls posting to a server action; the picker adds a capability and removes none.

2. **Uploads go through a new server action, not a new endpoint and not `/api/upload`.**

   `uploadImageAction(formData)` in `app/admin/actions.ts`: `requireSession()`, guard, `uploadImage()`,
   **return** a result. No token reaches the browser, no second auth mode enters a bearer-gated
   route, and authentication is identical to every other admin action.

   `/api/upload` stays exactly as it is — a machine door whose guarantee is "bearer or nothing".
   Its comment (*"upload failure never costs a seed: inbox and upload are separate calls"*) is a
   design stance this slice honours by construction: the island uploads first and captures second,
   so the two calls stay separate.

   Cost, accepted: server actions cap request bodies at 1MB by default, so `next.config.ts` needs
   `serverActions.bodySizeLimit`. Vercel's platform ceiling is 4.5MB for a route handler *and* a
   server action alike, so no endpoint choice avoids it.

3. **Embeds iframe where the URL is derivable exactly, and render as a link card otherwise.**

   Iframing is the point — a portfolio whose work is music and audio wants a player, and D1 (the
   graph playground) depends on B3 for "what a focused node shows". But an iframe is where provider
   detection stops being a label and becomes a trust boundary, which is why decision 5 ships in the
   same slice.

   Derivation is table-driven and pure, so "which providers are iframed" is a reviewable list
   rather than a property of scattered conditionals. Two providers stay link cards on stated
   evidence rather than taste (§5.2).

4. **The cover stays derived — and the gap that made "derived" hollow gets closed.**

   Umbrella §5: *a bean's cover is the first `MediaImage` in its newest published sprout's
   `media[]` — derived, no new field, no authoring step, no migration.* No `cover` field is added;
   the deferral holds.

   But derived-only was hollow, and it is worth naming why. `updateVersion`
   (`lib/botanical.ts:121-126`) states it "never touches slug / parents / **media** / source /
   content", and nothing else writes a sprout's media. So a cover could only ever be given to a
   bean by capturing a *new* seed with an image and promoting it — **no bean in the garden today
   could get one**. This slice adds media editing on `/admin/sprout/[slug]`, which makes "first
   image" an authoring act rather than an accident of capture order, and makes the derived
   convention actually usable. It is also, precisely, B3's "render `media[]` in the editor" half.

   `updateVersion`'s guarantee is **preserved, not widened**: the new write is a separate narrow
   function (§4.4).

5. **The editor gets `/image` — insertion only, no paste, no drop.**

   Images already round-trip correctly (`Image` is registered in `baseExtensions`,
   `lib/entity-markdown.ts:296`; slice 5 fixed the bug that deleted them on save), and the grammar
   is already pinned by four fixtures in `lib/markdown-conformance.test.ts:80-103`. So insertion is
   the only missing piece, and it adds **no grammar** — the handoff's `@tiptap/markdown` trap does
   not bite here.

   Paste and drop are excluded on cost, not on principle: both need ProseMirror handlers and real
   coverage in `lib/editor-mount.test.ts`, and the paste path is easy to get subtly wrong.

**Shipping.** Two PRs, each independently reviewable, each with its own Lab Note: **PR1 (§4)
creates images**, **PR2 (§5) shows them**. They share no code path — PR2 reads what PR1 writes —
so the split is along a real seam rather than an arbitrary one.

## 3. Architecture

One new pure seam per concern, sitting between a surface and `lib/botanical.ts`, exactly as
`lib/content-edit.ts` and `lib/sprout-edit.ts` already do. Everything testable is a pure function
in `lib/`; components stay thin.

| File | PR | Purpose |
|---|---|---|
| `lib/upload-input.ts` | 1 | `MAX_UPLOAD_BYTES`, `checkUploadFile({size, type})` — pure guard |
| `lib/media-input.ts` | 1 | `parseMediaField(values: string[]): Media[]` — the picker's hidden-JSON fields → entries |
| `lib/media-edit.ts` | 1 | `buildMediaPatch(current, formData)` — pure, dirty-gated |
| `components/admin/media-picker.tsx` | 1 | the client island |
| `lib/embed-src.ts` | 2 | `embedSrc(media)`, `EMBED_FRAME_HOSTS` — pure, table-driven |
| `lib/cover.ts` | 2 | `coverFor(sprouts): MediaImage \| null` |
| `components/media.tsx` | 2 | `MediaList` — server-only rendering |

**One definition of "a valid media entry."** `lib/inbox.ts`'s per-entry validation loop
(`:78-104`) is extracted to an exported `validateMediaEntry(unknown)`, called by both
`validateInboxPayload` and `parseMediaField`. Two independent implementations of that shape would
drift, and the picker's fields are the second place a client-supplied media entry enters the
system.

**Trust.** The picker's hidden fields are client-controlled. They are shape-validated through
`validateMediaEntry` and nothing more: **no host allowlist on the stored URL**. The surface is
admin-authenticated, and an arbitrary URL there is a hotlink, not an injection — an `<img src>`
cannot execute. Stated so the absence reads as a decision.

**Privacy.** `filterPublic` filters documents; it does not scrub `media` from a kept sprout. **There
is no per-media privacy** — anything on a published sprout is public. That is the correct model to
render against, and it is why §5.4's cover derivation needs no state re-check.

---

## 4. PR1 — creating images (B2)

### 4.1 The upload action

```ts
// app/admin/actions.ts
export async function uploadImageAction(formData: FormData): Promise<UploadResult>
```

`requireSession()` → `checkUploadFile` → `uploadImage()` → `{ok:true, media}` or
`{ok:false, error}`. It **returns** rather than redirecting: it is invoked from a client component,
not from a `<form action>`. It never throws to the client — a Cloudinary failure becomes
`{ok:false}`, because a failed upload must not take the page down with it.

`next.config.ts` gets `serverActions.bodySizeLimit: "4mb"`, and `MAX_UPLOAD_BYTES` matches it, so an
oversized file is refused client-side with a real message instead of arriving as an opaque 413.
`checkUploadFile` is also adopted by `app/api/upload/route.ts`, which has no size check today — one
guard, both doors.

**The rejection trap.** A server action invoked directly from a client component returns its
`redirect()` as a **rejected** promise; `components/editor/prose-editor.tsx` documents this at
length and handles it with `unstable_rethrow`. `uploadImageAction` does not redirect on the success
path, but `requireSession()` does when the session has expired mid-session — so the island must use
the same `unstable_rethrow` pattern rather than presenting an expired session as an upload error.

### 4.2 `MediaPicker` — the island

`components/admin/media-picker.tsx`, `"use client"`. Props: `name` (the hidden field name) and an
optional `initial: Media[]` — empty on the capture bar, the sprout's stored `media[]` in §4.4. The
picker holds one ordered list containing both, which is what lets a single component serve both
surfaces.

- **Renders nothing until mounted** (decision 1's rule). Script-off sees today's form exactly.
- A file input (`multiple`) whose `accept` list mirrors `lib/upload-input.ts`'s `ALLOWED_TYPES`
  exactly rather than a loose `image/*` — so SVG, which the server guard rejects, never appears in
  the file dialog in the first place. Then one row per file: *uploading* → *done* or *failed*.
- A done row shows a thumbnail, an **alt-text input** (`MediaImage.alt` exists in the
  model and has never been populated; an empty alt renders as `alt=""`, which is the correct
  markup for a decorative image), and a remove control.

  *Amended during implementation:* this originally also listed the filename. A settled row holds
  a `MediaImage`, which has no filename field — the original name survives only as Cloudinary
  `context`. Retaining it in local state would show a filename for images uploaded in this
  session and nothing for images loaded from the database through `initial`, which is worse than
  showing none. The thumbnail identifies the image better regardless.
- A failed row shows the error and a **retry** that re-uploads the same `File` without re-picking.
- **Only settled entries emit `<input type="hidden" name={name} value={JSON}>`** — every `initial`
  entry plus every done row, in list order. An in-flight or failed row emits nothing.

**It never blocks the capture.** Submit is never disabled. In-flight and failed rows are simply not
in the payload, and a line of copy says so. That is the honest form of "media pending": the seed
survives, and the file is still on disk. No `pending` marker enters the model — a third media kind
to represent "an image that does not exist" would be a model change earning nothing.

### 4.3 The capture bar

`<MediaPicker name="image" />` drops into the existing `<form action={createSeedAction}>`
(`app/admin/page.tsx:78`). The form stays a **server component** and never carries multipart — the
file travels only through the action call from the island; the form carries JSON strings.

`buildSeedBody` gains `parseMediaField(form.getAll("image"))`, appended after the link embeds, so
`media[]` reads links-then-images in declaration order. Order among images is picker order, which
is what makes §5.4's "first image" controllable.

### 4.4 Media editing on `/admin/sprout/[slug]`

A new card, and a **separate form** from both the metadata form and the prose editor — the same
containment that keeps slice 5's exception bounded.

- `<MediaPicker name="media" initial={sprout.media ?? []} />` — one ordered list holding the stored
  entries (images *and* embeds) alongside newly uploaded ones, with move-up / move-down / remove
  across the whole list.
- An "add link" input. The URL is submitted as a bare `{kind:"embed", url}` and run through
  `detectEmbed` **server-side**, so the client never invents a `provider` — the field §5.1 hardens.
- Posts to `editSproutMediaAction` → `buildMediaPatch(current, formData)` → `updateSproutMedia`.

**The wire shape, stated once because both surfaces share it.** The island owns ordering and emits
the **entire list**, in order, as repeated hidden fields under one name — `image` on the capture bar
(images only, appended to the link embeds by `buildSeedBody`), `media` here (the full mixed list).
Reorder and remove are therefore not operations that cross the wire: they are just a different list.
That is what keeps `parseMediaField` and `buildMediaPatch` pure and trivially testable — each takes
a list of strings and returns a list of entries, with no diffing and no client-supplied intent to
interpret.

`buildMediaPatch` is pure and **dirty-gated**: it compares the parsed list against `current.media`
and reports `dirty: false` when they match, so an unchanged open-and-save writes nothing — the same
rule and for the same reason as `buildContentPatch` (`lib/content-edit.ts`).

```ts
// lib/botanical.ts — a sibling of writeContent, not a widening of updateVersion
export async function updateSproutMedia(slug: string, media: Media[]): Promise<void>
```

It names `media` explicitly in its `$set` rather than spreading, exactly as `writeContent` does and
for the reason that function's comment gives: a spread lets a widened caller reach fields it was
never meant to touch. `updateVersion`'s "never touches media" guarantee is untouched.

### 4.5 The editor's `/image`

One row added to `BLOCKS` (`components/editor/editor-extensions.ts:28`), plus an `onInsertImage`
callback threaded through `BuildEditorExtensionsOptions` exactly like the existing `onMenu`. The
command deletes the suggestion range and calls the callback; `ProseEditor` owns a hidden file input,
uploads through `uploadImageAction`, and runs `setImage({ src, alt })`.

The callback indirection is what makes this testable: `lib/editor-mount.test.ts` builds the real
extension array against a headless `Editor` and can assert the row exists and fires, without a DOM
file picker.

### 4.6 The collision fix

**Not on either roadmap entry; found while writing this spec, and in scope because PR1 is what
makes it bite.**

`lib/storage.ts:37` derives Cloudinary's `public_id` from the uploaded filename. Cloudinary defaults
signed uploads to `overwrite: true`, and supplying an explicit `public_id` disables its
`unique_filename` behaviour. So **uploading two files named `Screenshot.png` silently replaces the
first** — including one already referenced by a published sprout, whose stored `url` would then
point at different bytes. `lib/storage.test.ts` covers only the pure `toMediaImage` mapping; the
`public_id` derivation is untested.

Theoretical today, because zero images exist. B2 is exactly what makes it likely — the capture bar
is where you upload `Screenshot 2026-08-23 at 14.02.png` twice in a week. With nothing in
production to migrate, fixing it now is free: let Cloudinary mint the id, keep the original filename
only as non-identifying context, and pin the behaviour with a test.

---

## 5. PR2 — showing them (B3)

### 5.1 Host hardening — four fixes, not one

Three in `lib/embeds.ts`, and a fourth one door over. Found while writing the plan: hardening
detection while leaving the fourth open would lock the front door and leave the side one.

`lib/embeds.ts`:

1. **`:45`** — `host.includes(h)` → `host === h || host.endsWith("." + h)`. Every existing test
   still passes by suffix (`open.spotify.com`, `podcast.ausha.co`, `www.youtube.com`); `youtu.be`
   matches exactly.
2. **`:26`** — `youtubeId()` carries the same substring flaw internally
   (`hostname.includes("youtu.be")`). It uses the hardened helper.
3. **`:36`** — `vimeoId()` regexes the **whole URL** (`/vimeo\.com\/(\d+)/`), so it can lift an id
   out of a query string, and it returns the wrong id for
   `vimeo.com/channels/staffpicks/123456`. Replaced with: parse the URL, take the first numeric
   **path segment**.

And in `lib/inbox.ts`:

4. **`normalizeMedia` passes a client-declared `provider` through unverified** (`:52-60`, pinned by
   a test at `lib/inbox.test.ts:61`). So a payload can claim `provider: "soundcloud"` for *any*
   URL and be framed on an allowlisted host. **The provider is a trust signal only if it is
   derived**, so it is now always derived from the URL and a declared `provider`/`embedId` is
   ignored. Nothing in the repo sends one — verified across `scripts/` and `.github/` — and the
   one `MediaEmbed` in production has provider `link`, so there is no regression to absorb.

   The blast radius before the fix was bounded (the CSP allowlist means a forged provider could
   still only load an allowlisted host), which is why this is a hardening rather than an incident.
   It is fixed in the same slice because §5.2 is what turns `provider` into a decision about what
   third-party code runs on a public page.

### 5.2 `lib/embed-src.ts`

Pure and table-driven. `embedSrc(media: MediaEmbed): { src: string; title: string; aspect: "video"
| "audio" } | null`, plus an exported `EMBED_FRAME_HOSTS`. `aspect` drives the frame box only —
`"video"` is 16:9, `"audio"` is a fixed short height, because an audio player that is 16:9 is mostly
empty space. `title` is the iframe's accessible name (`"<provider> player"`), not a fetched title:
nothing here makes a network call.

| provider | iframe src | basis |
|---|---|---|
| youtube | `www.youtube-nocookie.com/embed/{embedId}` | id already extracted |
| vimeo | `player.vimeo.com/video/{embedId}` | id already extracted (and fixed, §5.1) |
| soundcloud | `w.soundcloud.com/player/?url=…` | takes the share URL verbatim |
| spotify | `open.spotify.com/embed{pathname}` | pathname validated against `(track\|album\|playlist\|episode\|show\|artist)/[A-Za-z0-9]+` |
| deezer | `widget.deezer.com/widget/dark/{type}/{id}` | type allowlisted, id numeric |
| **ausha** | *link card* | share URLs (`podcast.ausha.co/{show}/{episode}`) carry no `podcastId`; the player requires one |
| **figma** | *link card* | `www.figma.com/embed` vs `embed.figma.com` — the current contract is unverified, and there is no Figma content in the database to test against |

The two link-card rows are the honest reading of "iframe where derivable exactly". Each becomes one
table row plus one test the day there is content to verify against.

`null` from `embedSrc` is not a failure — it is the signal to render a link card. Provider `link`
never yields a src.

### 5.3 CSP

`next.config.ts` grows a `headers()` entry sending:

```
Content-Security-Policy: frame-src 'self' <EMBED_FRAME_HOSTS>
```

A policy containing **only** `frame-src` constrains frames and nothing else — there is no
`default-src`, so scripts, styles and fonts are unaffected and no nonces are needed. This is the
first CSP in the repo (`middleware.ts` only gates `/admin/*`; `next.config.ts` has no `headers()`),
which is precisely why it is scoped to one directive.

The header is **built from `EMBED_FRAME_HOSTS`**, imported from `lib/embed-src.ts` (which has
type-only imports and no runtime dependencies), so the allowlist and the src table cannot drift. A
test asserts every host `embedSrc` can emit is in the list.

`frame-ancestors` is a different concern (clickjacking) and is not addressed here.

### 5.4 Rendering

`components/media.tsx` — server-only, no client JS enters the public zone.

- **image** → a plain `<img>` with intrinsic `width`/`height` (both stored by `toMediaImage`),
  `loading="lazy"`, `alt={alt ?? ""}`. Deliberately **not** `next/image`: that needs
  `images.remotePatterns` for Cloudinary and puts an optimizer in front of the public zone for no
  gain at this stage.
- **embed with a src** → `<iframe>` in an aspect box, `loading="lazy"`,
  `referrerPolicy="strict-origin-when-cross-origin"`, `allowFullScreen`.
- **anything else** → a link card: provider badge, hostname, `rel="noopener noreferrer"`.

**Placement.** `<MediaList>` renders inside each sprout's existing card on `/bean/[id]`, under the
property dump. One location, no duplication, and no layout bet that D1 would overturn — the dump is
documented (umbrella §4) as staying "until the exhibition slice retires it deliberately", so media
belongs beside it for now. PR1's admin media card is already B3's "render `media[]` in the editor"
half; nothing there is left owing.

### 5.5 The cover

```ts
// lib/cover.ts
export function coverFor(sprouts: Sprout[]): MediaImage | null
```

Scans the newest-first sprouts the dataset already guarantees and returns **the first `MediaImage`
in the first sprout that has one**.

**One ambiguity in the umbrella's wording, resolved explicitly.** "*the first `MediaImage` in its
newest published sprout's `media[]`*" can mean *strictly the newest sprout, or nothing*. It is
resolved toward its sibling `articleFor` (`lib/article.ts`), which returns "the first sprout
carrying non-blank content" rather than giving up at the newest. A bean whose latest sprout is a
text-only changelog entry keeps the cover its previous release earned, which is the useful
behaviour and the consistent one.

State is **not** re-checked, and that is deliberate: the public page passes the `filterPublic`-
projected dataset, so "published" is already enforced upstream (§3, Privacy). One projection, one
place — the same stance and the same comment as `articleFor`.

**Consumers:**
- `resolveEntity` gains `cover?: MediaImage` for `bean:` refs, via `dataset.sproutsForBean(slug)`.
  `EntityCard` renders a thumbnail. Plant and pod refs never carry one — those tiers have no
  `media` field (§3).
- The Directory's bean rows render a thumbnail.
- `/api/graph` bean nodes gain `cover`. G1 deliberately withheld media from node payloads
  (`lib/graph.ts:38`) pending exactly this; D1 is the immediate consumer, and the projection stays
  published-only, so the graph still cannot expose more than the public HTML.

---

## 6. Testing

All pure logic is a `lib/` function tested with `node:test`, matching the existing convention.
Components are exercised only where a real instance is the point (`editor-mount`).

**PR1**

| Test | Asserts |
|---|---|
| `lib/upload-input.test.ts` | size and type guard boundaries, both sides |
| `lib/media-input.test.ts` | valid JSON → entry; malformed JSON, wrong `kind`, missing `storageKey`/`url` → dropped, never throws |
| `lib/inbox.test.ts` *(extended)* | the `validateMediaEntry` extraction preserves today's exact error strings |
| `lib/seed-form.test.ts` *(extended)* | hidden image fields → media entries; links and images coexist in declaration order; a malformed field cannot break a capture |
| `lib/media-edit.test.ts` | reorder, remove, add-embed via `detectEmbed`, dirty-gate (unchanged → no write), malformed input |
| `lib/storage.test.ts` *(extended)* | two uploads of the same filename cannot collide (§4.6) |
| `lib/editor-mount.test.ts` *(extended)* | against a **real headless `Editor`**: the `/` menu carries the Image row, and running it deletes the range and calls `onInsertImage` |

The `editor-mount` extension is non-negotiable per the handoff's trap — static checks previously
missed a defect that made the editor fail to mount on every page.

**PR2**

| Test | Asserts |
|---|---|
| `lib/embeds.test.ts` *(extended)* | `vimeo.com.evil.test`, `evilvimeo.com`, `notyoutu.be` → `link`; both id-extraction fixes, including `vimeo.com/channels/staffpicks/123456` |
| `lib/inbox.test.ts` *(extended)* | a declared `provider`/`embedId` is ignored in favour of detection (§5.1 fix 4); a declared provider that agrees with the URL is unaffected |
| `lib/embed-src.test.ts` | one derived and one non-derived case per provider; `link` never yields a src; **every host `embedSrc` can emit is in `EMBED_FRAME_HOSTS`** |
| `lib/cover.test.ts` | first image wins; scans past an image-less newest sprout; embeds are not covers; none → `null` |
| `lib/entity-resolve.test.ts` *(extended)* | cover on bean refs; absent for plant/pod; absent when no image |
| `lib/graph.test.ts` *(extended)* | `cover` present on bean nodes, absent when none |

**No new conformance fixtures.** `lib/markdown-conformance.test.ts:80-103` already pins `image`,
`imageTitled`, `imageInline` and `imageInItem`. `/image` inserts that same node, so it adds no
grammar. (Noted in passing: that file records a KNOWN DIVERGENCE where a *linked* image loses its
link on round-trip. `/image` inserts a bare image and stays clear of it.)

## 7. Hands-on verification

Per the handoff's trap — **`.env.local` points at the production database.** Run the dev server with
`MONGODB_DB=<scratch>` plus throwaway `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET`, and drop the
scratch DB afterwards. Never write to `beanstalk`.

**The handoff does not mention the second half of this: there is no scratch Cloudinary.** Verifying
an upload puts real assets in the real account. Uploads during verification go to a
`beanstalk/scratch/` folder and are deleted afterwards. This is the one part of verification that
touches something outside the scratch boundary, so it is called out rather than assumed.

The end-to-end case, run once PR1 lands and again after PR2:

1. Capture a seed with an image and a SoundCloud link.
2. Promote it; confirm `media[]` arrived on the sprout verbatim.
3. Publish; confirm the image and the player render on `/bean/[id]`, and the bean shows a cover on
   the Directory.
4. Reorder the sprout's media so a different image is first; confirm the cover follows.

## 8. Documentation deliverables

- **`CLAUDE.md`** — decision 1's rule, verbatim, as the second named client-JS island. It must read
  as a bounded exception with a stated invariant, not as a relaxation of the zero-JS rule.
- **`docs/superpowers/ROADMAP.md`** — B2 closed; B3 closed, with the host hardening and the CSP
  named; the D1 dependency marked satisfied.
- **Lab Notes** — one per PR. Both halves are user-visible (`CLAUDE.md`'s gate): PR1 lets the author
  attach pictures, PR2 shows them to visitors.

## 9. Acceptance

- A capture with an image survives an upload failure: the seed is created, the failure is visible,
  and the file can be retried without re-picking it.
- With script disabled, the capture bar is byte-for-byte what it is today, and a capture still
  submits.
- An existing sprout's `media[]` can be reordered, added to and removed from, and an unchanged save
  writes nothing.
- `/image` inserts a picture into an article, and the article still round-trips byte-stably.
- A published sprout's images and derivable embeds render on `/bean/[id]`; ausha, figma and `link`
  render as link cards.
- `vimeo.com.evil.test` detects as `link` and is never iframed.
- A bean with an image shows a cover on the Directory, in an `EntityCard`, and in `/api/graph`.
- `npm test` green; `npm run build` clean.

## 10. Out of scope

Recorded so nothing is silently dropped:

- **Paste and drag-drop in the editor** — decision 5.
- **An explicit `cover` field on `Bean`** — decision 4; the deferral holds.
- **Ausha and Figma iframes** — §5.2, on stated evidence. One table row and one test each, later.
- **Deleting a Cloudinary asset** when it is removed from `media[]`. Removal unlinks; the asset
  stays. That is also what makes removal safely undoable.
- **`next/image` optimization** — §5.4.
- **Container media.** `Plant` and `Pod` have no `media` field (`lib/data.ts` — only `Sprout:125`
  and `Seed:155` carry one). This is out of *model* scope, not merely out of slice scope.
- **Per-media privacy.** §3: anything on a published sprout is public. Changing that is a model
  decision, not a rendering one.
