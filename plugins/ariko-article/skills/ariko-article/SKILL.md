---
name: ariko-article
description: >
  Write an essay about THIS repo's project, or rewrite the narrative of the
  project or one of its features, and post it to Ariko as a draft — images
  included — once the maintainer approves it. Use whenever someone asks to
  write, publish, post or draft an article, essay, blog post, write-up or
  feature narrative "for Ariko" or "on the portfolio". Nothing is committed to
  this repo.
---

# Writing for Ariko

Ariko is the maintainer's portfolio. This repo is one **plant** there; the
plant is split into **pods** (an app, a platform, an area of the product) and
its features are **beans** inside them. You write one of two things:

| Kind | What it is | Lands as |
|---|---|---|
| **Essay** | A dated piece — a redesign told, a decision explained, a release looked back on — about some pods and/or beans, or about the whole project. | A draft sprout of kind `essay`, shown in the journals of what it is `about` (or the plant's, with no `about`). |
| **Narrative** | What one pod, or one feature, **is now** and how it got there. Rewritten in place, never appended. | The pod's or bean's `content`. |

"Write about how we redesigned the feed" → essay. "Update the feed's
narrative" / "describe what the feed does now" → narrative. If you cannot tell,
ask — one question.

**You can only write what is still private.** A pod or bean the maintainer has
published is reviewed work: this door refuses it (`already reviewed`) — even if
its narrative is blank — and so it refuses an essay that was published. The
door never publishes; the maintainer does, in the admin.

## 0. Before anything: ping

```bash
curl -fsS -H "Authorization: Bearer $ARIKO_TOKEN" "${ARIKO_URL:-https://www.ariko.app}/api/articles/ping"
```

It returns your scope:

```json
{ "plant": "pbbls",
  "pods":  [{ "slug": "pbbls-ios", "name": "…", "visibility": "private" }, …],
  "beans": [{ "slug": "feed", "name": "…", "pod": "pbbls-ios", "visibility": "private", "projected"?: true }, …] }
```

You may only write about the plant, those pods and those beans (or a new bean
you create with a narrative in the same post). A pod or bean with
`"visibility": "public"` cannot take a narrative; a `"projected": true` bean can
be an essay's `about` but never takes one. A bean's `"pod": null` means it sits
directly under the plant.

If it fails, **stop and say exactly which**:

- `ARIKO_TOKEN` empty → "ARIKO_TOKEN is not set. Locally: the repo's `.env`.
  In a cloud session: the environment preset's variables."
- connection refused, DNS failure, or a proxy 403 → "Ariko is unreachable —
  add `www.ariko.app` to this cloud environment's allowed domains."
- `401` → "The token was refused — it was revoked or mistyped; re-mint it with
  `npm run token:mint -- --plant <plant>` in the Ariko repo."
- `404` → the plant was deleted in Ariko; tell the maintainer.

## 1. Draft — outside the repo

Write in the session's scratchpad, or `$TMPDIR/ariko-article/<slug>/`. **Never
in the repo, never committed**: the repo does not store content or assets.

- Markdown. GFM tables, `>` quotes, code, headings, `![alt](path)` images —
  the inline form only; `![alt][id]` reference images are refused.
- Mention another Ariko entity inline with `:entity[Label]{ref=bean:slug}` —
  this is how you point at something outside your plant.
- English always; French when asked, as an **adaptation** in "tu", not a
  literal translation. Both go in `{ "en": "…", "fr": "…" }`.
- Essay slug: kebab-case, specific (`feed-redesign-2026`), not a bean's slug.
  Date: the day the thing happened or the day of writing, `YYYY-MM-DD`.
- Alt text on every image says what the image shows, not "screenshot".

Images: screenshots you can take, files the maintainer points at, exports from
the repo. PNG, JPEG, GIF, WebP or AVIF, 4 MB max each. (Renaming an SVG to
`.png` does not work: Ariko's image host judges the bytes, and the upload
fails.)

SVG is accepted **only as a figure's image** (`:::figure`, below) — a diagram
or an illustration, crisp at any size. Anywhere else, a plain `![]()`, a
gallery or a compare side included, the post is refused with
`<url>: SVG is accepted only inside :::figure`. A dark-mode twin is a second
SVG in the same figure, with `dark`. The upload checks the file against an
allowlist and **refuses** — never cleans up — anything that could run or
fetch, naming what it found (`svg refused: <foreignObject> is not allowed`):

- no `<script>`, `<foreignObject>`, `<image>`, `<a>`, `<filter>` or animation
  elements; no `on…` attributes;
- no `href` / `xlink:href` except `#id`, no `url()` except `url(#id)`, no
  `@import`, no backslash in CSS, no DOCTYPE;
- the root is one `<svg>` in the SVG namespace, with a `viewBox`; 1 MB max.

Fonts: a drawing tool that embeds its fonts writes them as `url(data:…)`
inside the file, and that is refused
(`svg refused: url() must point inside the file (url(#id))`). Export with the
text as outlines, or without embedded fonts. (Excalidraw's own `<metadata>`
is fine.)

## 1b. Staging

Five blocks stage what plain markdown cannot. Reach for one only when the
writing needs it; a plain `![alt](url)` and a plain `>` stay right for most
images and quotes.

| You have | Use |
|---|---|
| one screen or one drawing that deserves a frame or a size | `figure` |
| screens meant to be looked at together | `gallery` |
| a rule shown by its opposite | `compare` |
| a definition or an aside the reader may skip | `callout` |
| someone's own words, attributed | `quote` |

```md
:::figure{frame=phone}
![Two scenes framed for a phone: the lake with its two moons, and the abbey with its embers](https://res.cloudinary.com/…/lake.png)
Scenes zoom in on the subject when the phone is upright.
:::

:::figure{size=wide dark}
![The conductor's clock driving picture, sound and haptics](https://res.cloudinary.com/…/clock.svg)
![The conductor's clock, drawn for a dark page](https://res.cloudinary.com/…/clock-dark.svg)
The audio clock is the reference; *everything else* locks onto it.
:::

:::gallery
![The moon drawn with the classic ramp](https://res.cloudinary.com/…/moon.png "Classic")
![The same moon in three ramps](https://res.cloudinary.com/…/ramps.png "Three ramps")
![The same moon in four tints](https://res.cloudinary.com/…/tints.png "Four tints")
One moon, drawn four ways.
:::

::::compare
:::do
![An almost still cromlech](https://res.cloudinary.com/…/still.png)
Show an almost still picture and drop the events.
:::
:::dont
![The cromlech with shooting stars](https://res.cloudinary.com/…/stars.png)
Keep every event running and ignore the system setting.
:::
::::

:::callout[In two words: dithering]
When you only have a few shades of grey to work with, you mix them in a fine
pattern so the eye rebuilds the in-between tones.
:::

:::quote{by=Alexis role="reviewing the feed explorations"}
The Spine is truly a masterclass.
:::
```

Rules — the post is refused (`400`) with the problem named, so fix what it
says:

- `frame` is `phone`, `desktop` or `none` (the default). `size` is `s`, `m`,
  `l` or `wide`; a phone defaults to `m`, everything else to `l`. A figure
  takes `frame`, `size` and `dark`; a gallery takes `frame`; a quote takes
  `by` and `role`; a callout and a compare take nothing. Anything else in the
  braces is refused (`figure: size=xl is not one of s, m, l, wide`,
  `figure: unknown attribute colour`, and `{.warn}` is
  `callout: unknown attribute class`).
- A figure holds **one** image (two with `dark`: light, then dark), then an
  optional one-line caption under it. Its caption is that line, never the
  image's `"title"` (`figure: an image title is not a caption — write the
  caption on its own line`). Nothing else goes inside: no headings, no
  second paragraph, no image after the caption.
- A gallery holds **two** or more images (`gallery: needs at least two
  images`); each image's `"title"` is its own caption, and one line after the
  images captions the whole row.
- A compare is exactly one `:::do` then one `:::dont`. Each side holds at
  most one image and **must** have a line of text (`compare: do needs a line
  of text`). The "Do" / "Don't" words are added for you, in the page's
  language.
- A callout needs some text under its `[label]`; the label is optional. Only
  a callout takes a `[label]` (`figure takes no [label]`).
- A quote needs `by` (`quote: by is required`). Quote any value with a space:
  `role="lead designer"`. Inside a callout or a quote, ordinary markdown —
  paragraphs, lists, `:entity` mentions and `::entity` cards — is fine.
- An opener is `:::name[label]{attrs}` with **no space** before `[` or `{`,
  and nothing else on its line. An admonition-style title goes in the
  `[label]`: `:::callout[In two words]`, never `:::callout In two words`. A
  line that starts with colons and is not a well-formed opener is refused
  (`":::callout In two words" is not a block opener — write
  :::name[label]{attrs}, with no space before [ or {`) — so are an unclosed
  `[` or `{`, and a `\"` inside a quoted value, which has no escape. A `:::`
  that closes no block is refused too (`a stray ::: closes nothing`).
- `compare` takes **four** colons (`::::compare … ::::`) around its `:::do`
  and `:::dont`; every other block takes three. Close every block
  (`callout: unclosed — no matching :::`).
- Blocks do not nest (`gallery: a staged block cannot sit inside callout`).
  `:::do` / `:::dont` live only in a compare (`do: only inside ::::compare`).
  `::figure` with two colons is not a block
  (`::figure must be a container — write :::figure … :::`), and no other
  name is one (`:::warning is not a staging block (figure, gallery, compare,
  callout, quote)`). A fence inside a code block is code, and is left alone.
- Put each block at the top level of the article, on lines of its own —
  not inside a list item or a table cell.
- A caption, and a compare side's text, is one line. A line break inside
  one is accepted, but it is folded into a space the next time the
  maintainer saves the article in the editor — so write it as one line.
- Captions, labels and roles are translated by writing them in the French
  half — each half is its own markdown, staged the same way.

A refusal reads `<slug>: content.<lang>: <problem>; <problem>` — every
problem in that half at once.

## 2. Show the draft and wait

Show the whole draft (both languages) with each image path, and ask for
approval. **Upload nothing before an explicit yes.** Revise as often as asked.

## 3. Upload the images

One request per file:

```bash
curl -sS -w '\nHTTP %{http_code}\n' -H "Authorization: Bearer $ARIKO_TOKEN" \
  -F "file=@/abs/path/shot.png;type=image/png" "${ARIKO_URL:-https://www.ariko.app}/api/articles/assets"
# → { "url": "https://res.cloudinary.com/…", "width": 1170, "height": 2532 }
# → HTTP 200
```

Always declare the type: curl sends `.webp` and `.avif` as
`application/octet-stream`, which Ariko refuses with a 400. `type=` must match
the file's real format — `image/png`, `image/jpeg`, `image/gif`, `image/webp`,
`image/avif`, or `image/svg+xml` for a figure's drawing (an SVG declared as
anything else is treated as a raster, and refused). (No `-f` here: it would hide the error body, which says what
was wrong. `-w` prints the status after the body.)

Replace each local path in the markdown with its returned `url`. Ariko accepts
**only** URLs this endpoint returned — an upload on its own image host — and
refuses any other image URL, hotlinks included.

- `400` → the file was refused (too big, not a raster type); the message says
  which. Fix the file, do not retry unchanged.
- `400 svg refused: <what>` → the drawing holds something the check refuses
  (see "SVG" under Draft). Fix the drawing and re-export it; do not retry
  unchanged.
- `502 upload failed` → the image host rejected it, most often because the
  bytes are not a raster image (an SVG renamed `.png`). Try a real PNG.

## 4. Post

```bash
curl -sS -w '\nHTTP %{http_code}\n' -X POST -H "Authorization: Bearer $ARIKO_TOKEN" -H "content-type: application/json" \
  --data @payload.json "${ARIKO_URL:-https://www.ariko.app}/api/articles"
```

```json
{
  "essays": [{
    "slug": "feed-redesign-2026",
    "date": "2026-11-14",
    "name": { "en": "Redrawing the feed", "fr": "Redessiner le fil" },
    "description": { "en": "One line.", "fr": "Une ligne." },
    "content": { "en": "…", "fr": "…" },
    "about": ["pbbls-ios", "feed"]
  }],
  "narratives": [{
    "slug": "feed",
    "content": { "en": "…", "fr": "…" }
  }, {
    "slug": "offline-mode",
    "pod": "pbbls-ios",
    "name": { "en": "Offline mode", "fr": "Mode hors ligne" },
    "description": { "en": "One line.", "fr": "Une ligne." },
    "content": { "en": "…", "fr": "…" }
  }]
}
```

- `about`: bare slugs from the ping — pods' and beans'. **Omit it** for an essay
  about the whole project (it lands in the plant's journal); if present, list
  at least one.
- A narrative's `slug` is a pod's or a bean's from the ping. A **new** bean
  needs `name` and `pod` (one of the ping's pods — it is created private there)
  and should get a `description`. `pod` on an existing bean must be the pod it
  is already in (moving a bean is the maintainer's, in the admin); a pod's own
  narrative takes no `pod`.
- **Refused keys** — never send: `state`, `visibility`, `kind`, `type`,
  `parents`, `exhibited`. Publishing is the maintainer's, in the admin. Any
  other key is refused by name as well (`unknown key descripton` — a typo is an
  error, not silently dropped).
- **Halves are merged, never replaced.** Posting only `{ "en": … }` keeps the
  stored French on `content`, `name` and `description` (and the reverse).
  Posting a plain string means English. An omitted `description` on a re-post
  leaves the stored one alone.
- **Re-posting.** An essay slug can be re-posted only while it is still a
  **draft this door wrote for this plant**; then it is replaced. Otherwise it is
  refused: `(already reviewed)` once the maintainer published it, or
  `(not written by this door)` if it is the maintainer's own sprout or another
  plant's. A pod or bean is rewritten in place only while it is private.

Responses:

- `200` → `{ ok, essays, narratives, admin: ["/admin/bean/…", "/admin/sprout/…", …] }`.
- `400` → the payload's shape, an image URL, an SVG outside a figure, or a
  staging block (see 1b); the message names the field and the problem.
- `409` → `{ "error": "refused", "refused": [...], "written": [...] }`.
  `refused` lists what was turned away and why — already published
  (`already reviewed`), outside the plant, or a new bean lacking a name or a pod. The
  batch is checked whole before anything is written, so **nothing was written
  unless `written` lists something**: that happens only when a race interrupted
  the batch mid-way, and what it lists is private/draft. Either way, fix what
  `refused` names and **re-post the whole payload** — it is safe to repeat.
  A rare 409 may carry only `{ "error": "refused: a slug was taken mid-write; …" }`
  (no `refused` list): someone created that slug a moment ago. Re-ping and retry.

## 5. Report

Tell the maintainer what was posted and give the admin links: each `admin`
path from the response, prefixed with `ARIKO_URL`
(`https://www.ariko.app/admin/sprout/<slug>` etc.). It is a draft: they review
and publish it there.

## Troubleshooting

- **A token leaked** (pasted in a chat, committed, shown in a log): tell the
  maintainer at once. The image door has no rate limit, so a leaked token is
  revoked, not waited out: `npm run token:revoke -- --plant <plant>` in the Ariko
  repo, then `npm run token:mint -- --plant <plant>` for a new one.
- **Everything is `401` after it worked**: the token was re-minted or revoked —
  minting a new one revokes the previous one. Get the new value.
- **`(already reviewed)` on something you meant to update**: the maintainer
  published it. Ask them to take it back to private in the admin, or write an
  essay instead.
