# A PWA and a new mark — Ariko becomes installable, and the brand stops costing 90 kB a page

*2026-09-12*

## 0. Where this starts

Two requests arrive together, and they turn out to be one slice.

The first is an install: *"turn Ariko into a PWA I can install as a standalone
desktop app through Chromium based navigators like Chrome."* The second is a
brand replacement — two new SVG exports, an icon-logo and a complete wordmark,
replacing every mark in the repo.

They are one slice because a PWA's manifest is, mostly, a list of icons. Doing
the marks without the manifest would mean rasterizing the new artwork twice;
doing the manifest without the marks would mean shipping an install whose app
icon is the old logo.

They are also the next thing on the runway. The audit at
[`docs/audits/2026-09-10-code-quality-audit.md`](../../audits/2026-09-10-code-quality-audit.md)
§6 sequences ten slices and puts **Assets** third, behind the garden cache and
the rulebook rewrite, both of which have shipped:

> **Assets.** svgo the brand marks; subset Inclusive Sans to woff2; Profane
> fallback metrics; `preconnect`; transform gallery and markdown images;
> eager + `fetchPriority` on the first row; SVG favicon. (§4)

This slice takes **the first and the last** of that list — svgo the brand marks,
SVG favicon — because those are the two the new artwork forces anyway. The
fonts, the `preconnect` and the image transforms are a separate slice and stay
that way; they share a heading in the audit and nothing else.

What a visitor gets: a new mark, and an app they can install. What the author
gets: the same, plus a portfolio whose every chrome page stops carrying 90 kB
of inline path data.

## 1. What is true today

### 1.1 The marks

`components/brand/ariko-icon.tsx` (92,611 bytes of source) and
`ariko-logo.tsx` (104,840) are inline React SVGs. They are good citizens in one
respect — the letterforms are painted with `currentColor` and the two leaf
greens come from `--ariko-leaf-dark` / `--ariko-leaf-light`, which
`app/globals.css:67-68` declares and `:105-106` re-declares under `.dark` — and
a serious cost in another. The audit, §4.2:

> `components/brand/ariko-logo.tsx` renders to **102,774 bytes** of HTML on `/`
> (44.7 kB gzip); `ariko-icon.tsx` renders to **90,787 bytes** on every chrome
> page, for a 20 px glyph (`public-chrome.tsx:38`). That is thirty times the TOC
> rail and a third of the framework JS, in HTML that cannot be cached separately
> from the page. Paths carry three-decimal coordinates in a 1035×549 box; one
> `d` attribute is 39 kB (`ariko-logo.tsx:158`); both files carry the same 21
> `id`s.

Two consumers, both public: `app/(public)/page.tsx:178` renders the wordmark at
`h-20`, and `app/(public)/_components/public-chrome.tsx:38` renders the icon at
`size-5`.

**Neither file is in `SERVER_SAFE`** (`lib/server-safe-source.test.ts:39-65`).
Both are public-rendered, both would silently cost the public zone its
no-script promise if someone added a directive, and the list's own docblock says
*"ADDING A FILE HERE IS THE CHEAP HALF."* This is the day they get added.

### 1.2 The favicons

`app/layout.tsx:28-44` hand-writes three `<link>` tags:

```html
<link rel="icon" href="/icon-light.png" media="(prefers-color-scheme: light)">
<link rel="icon" href="/icon-dark.png"  media="(prefers-color-scheme: dark)">
<link rel="apple-touch-icon" href="/icon-light.png">
```

`public/icon-light.png` is 195,043 bytes and `public/icon-dark.png` is 191,419
— 386 kB of `public/` for a 16 px glyph, with the `apple-touch-icon` pointed at
the larger of the two. The audit lists them at 520×520.

There is no `manifest.webmanifest`, no `app/manifest.ts`, no `metadata.icons`,
no service worker, and no `theme_color`. `app/layout.tsx`'s `metadata` export
is two lines: a `title` and a `description`.

### 1.3 The new artwork

Two exports, `ariko-icon-2.svg` (320×320) and `ariko-logo-2.svg` (910×313).
They are structurally far cleaner than what they replace — 16 and 20 flat
paths, **no `id`s**, no nested groups, and exactly three literal colours:

| colour | role | count (icon / logo) |
|---|---|---|
| `black` | the letterforms | 1 / 5 |
| `#006400` | the dark leaf | 7 / 7 |
| `#90EE90` | the light leaf | 8 / 8 |

That three-colour vocabulary is the same vocabulary the old components
tokenised. §3.2 is why that matters more than it looks.

## 2. The three decisions, and what was not chosen

### 2.1 One app, whole site

The manifest declares `start_url: "/"` and `scope: "/"`. One install, one icon,
the portfolio at the door and `/admin` reachable inside the same window because
it is inside the scope.

The alternative considered and rejected was **two manifests, one per zone** — a
root manifest for the portfolio and a second, linked only from `/admin` pages,
declaring `start_url: "/admin"` and its own name. Chrome installs whichever
manifest the installing page declares, so that would have produced a genuine
"Ariko Studio" desktop app alongside a visitor-installable portfolio, and it
mirrors the repo's two-zone architecture closely.

It was not chosen, and the reason is worth recording: **the zones share a
scope in a way they do not share chrome.** Two manifests means two `scope`s,
and a link from the studio window to a public page would leave the window. The
author moving between writing a sprout and reading it is the single commonest
path through this app, and a design that puts a browser boundary across it is
worse than one icon too few. One app it is.

`display: "standalone"` rather than `minimal-ui`: the point of the request is a
window without browser chrome.

### 2.2 A service worker, offline fallback only

Chrome and Edge dropped the service-worker requirement for desktop
installability; an HTTPS origin with a valid manifest is installable today
([Chrome for Developers, *Revisiting Chrome's installability
criteria*](https://developer.chrome.com/blog/update-install-criteria)). So the
service worker in this slice is **not** load-bearing for the install. It buys
exactly one thing: an offline page that belongs to Ariko instead of the
browser's dino.

Two alternatives were considered. **No service worker at all** is the option
that adds literally zero bytes to the public zone and was the recommendation;
it was passed over because the author wants the offline surface to be the
site's. **An offline-first read cache** — caching visited pages and Cloudinary
images so the portfolio reads offline — was rejected for a sharper reason than
complexity: it would put a second cache layer in front of pages whose freshness
is already governed by the Data Cache under the `garden` tag
([`2026-09-11-cache-the-garden-design.md`](2026-09-11-cache-the-garden-design.md)).
Two caches that can disagree about whether a sprout is published is a privacy
bug wearing a performance costume.

§4 is the shape that gets the offline page without acquiring either problem.

### 2.3 The marks stay inline React components

`components/brand/*.tsx` are regenerated rather than replaced by static files
in `public/` served through `<img>`.

The `<img>` option is what the audit's byte-count argues for, and it is
cheaper: ~0 bytes of HTML, a file cached separately from the page, one fewer
moving part. It was rejected because it forfeits `currentColor`. The marks
today follow `text-foreground`; a static file cannot, and `.dark` is declared
in `globals.css` even if nothing yet adds it (audit §4.4). Trading a
theme-following mark for a cacheable one is a trade that gets harder to undo
the longer it sits.

That rejection only holds if the inline version is **cheap enough**, and if the
new artwork is actually themeable. §3 establishes both.

## 3. The marks

### 3.1 Generation, not hand-editing

The two exports are committed as sources at **`assets/brand/ariko-icon.svg`**
and **`assets/brand/ariko-logo.svg`** — a new top-level directory, for files
that are inputs rather than served assets.

**`scripts/build-brand.ts`**, run as `npm run brand:build`, is the only thing
that writes derived brand artifacts. It reads the two sources and emits seven
files (§3.2, §3.3). It joins `scripts/migrate-*.ts` as a committed, manually-run
script rather than a build step: the brand changes at the pace of a rebrand, not
a deploy, and every output is committed.

It exists because the alternative is that the next person to change the logo
re-derives the colour mapping, the precision setting, the maskable safe zone
and the Apple background from scratch — or, far likelier, does not, and ships a
manifest icon that disagrees with the favicon. One command, seven outputs, no
archaeology.

`sharp` moves from a transitive dependency of Next to an explicit
`devDependency`. It already resolves in `node_modules` and renders these SVGs
correctly (verified), but a script that imports a package nothing declares is a
script that breaks on the next `npm ci` in a different dependency tree. `svgo`
is added as a `devDependency` for the same reason.

### 3.2 The colour mapping

This is the step that makes "keep them inline" coherent. The new artwork's
three literal colours map onto the vocabulary the old components already used:

| source | emitted |
|---|---|
| `black` | `currentColor` |
| `#006400` | `var(--ariko-leaf-dark)` |
| `#90EE90` | `var(--ariko-leaf-light)` |

Nothing in `app/globals.css` changes. The two leaf tokens exist, at `:67-68`
with `.dark` overrides at `:105-106`, and the new marks inherit the exact
convention the old ones established — the letterforms follow the text colour of
whatever they sit in, the leaves follow the theme.

The components keep their present signature verbatim:

```ts
export function ArikoIcon({ title, ...props }: SVGProps<SVGSVGElement> & { title?: string })
```

including the `role={title ? "img" : "presentation"}` / `aria-hidden` pair, so
both call sites are untouched. Each emitted file opens with a banner naming
`npm run brand:build` and its source, so an editor knows the file is generated
before they edit it by hand.

### 3.3 Measured, not estimated

`svgo --precision 1`, against the new sources:

| | source | precision 1 | gzip |
|---|---|---|---|
| icon | 71,412 B | **20,092 B** | 8,272 B |
| logo | 78,003 B | **22,392 B** | 9,070 B |

Precision 2 was measured too (31,789 / 34,046) and rejected: precision 1 was
rasterized against the unoptimized source at 512 px and 900 px with no visible
degradation, and the difference is ~12 kB a page.

Against what ships today, per page:

| | today | after | |
|---|---|---|---|
| icon, on every chrome page | 90,787 B | 20,092 B | **−78%** |
| logo, on `/` | 102,774 B | 22,392 B | **−78%** |

The audit predicted *"`svgo --precision 1` and id removal typically save
50–70 %"*. The new artwork beats that because it arrives with no `id`s at all.

### 3.4 Pinned

`components/brand/ariko-icon.tsx` and `components/brand/ariko-logo.tsx` are
added to `SERVER_SAFE` in `lib/server-safe-source.test.ts`. They are rendered by
`app/(public)/page.tsx` and `app/(public)/_components/public-chrome.tsx`, they
have always qualified, and they were never listed.

## 4. The service worker

### 4.1 The invariant: nothing is written to the cache at runtime

`public/sw.js`, scope `/`:

```
install   → precache ["/offline.html", "/icons/icon-192.png"], skipWaiting()
activate  → delete every cache key ≠ VERSION, clients.claim()
fetch     → if (event.request.mode !== "navigate") return;   // pass through
            respondWith(fetch(request).catch(() => caches.match("/offline.html")))
```

Requests that are not top-level navigations never reach `respondWith` at all —
the handler returns without calling it, and the browser proceeds exactly as if
there were no service worker. Navigations are fetched from the network every
time; the cache is consulted only when that fetch *rejects*.

**The cache therefore contains exactly two entries, fixed at install, forever.**

That is the whole safety argument, and it is worth stating as an invariant
rather than a consequence, because the service worker's scope is `/` and that
includes `/admin`. A runtime cache under this scope could store an
authenticated admin response and serve it to the next request, or serve a page
composed against a pre-write garden after a publish. Neither is possible if
nothing is ever written. The rule is not *"be careful what you cache"* — it is
*"the runtime writes to no cache"*, which is a property a test can check (§6).

An offline **navigation to `/admin`** therefore renders the offline page.
That is correct: the alternative is a cached login form that posts into
nothing.

`skipWaiting()` + `clients.claim()` are safe here for the same reason they are
usually dangerous. The classic hazard is a new worker taking over clients
holding assets from the old build; this worker serves no assets.

### 4.2 The offline page is static HTML, not a Next route

**`public/offline.html`** — a self-contained document: inline `<style>` with
literal token values, `system-ui` as the family, `<img src="/icons/icon-192.png">`
(precached alongside it), and two short lines, English then French, because the
site is bilingual and a service worker has no good way to read the language
cookie.

The rejected alternative is `app/offline/page.tsx`, which would share the design
system and the fonts. It is rejected because an offline fallback that depends on
a hashed CSS chunk and three font files is an offline fallback that works until
the next deploy and then renders unstyled — and does so only for people who are
offline, which is to say nobody who can report it. Every byte the offline page
needs is either inline or in `PRECACHE`.

This is the one place in the repo where the two zones' "draw it from one file"
rule is deliberately not applied. The offline page is not a page of the app; it
is the thing that renders when the app is unreachable, and its requirement —
*zero network, zero build-dependent URLs* — is the opposite of every other
surface's.

### 4.3 Registration is a script tag, not an island

In `app/layout.tsx`:

```tsx
<script
  dangerouslySetInnerHTML={{
    __html:
      `if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'))`,
  }}
/>
```

~110 bytes of inline text in server-rendered HTML. No `"use client"`, no
component boundary, no hydration, no chunk. **The public zone still has exactly
one island** (`components/toc-rail.tsx`, 1.2 kB), and `lib/toc-mount.test.ts`'s
claim is untouched.

This satisfies CLAUDE.md §"Script, by zone" on both counts. It *adds* — an
offline surface — and it is not the only route to anything: a visitor with
script off registers no worker, sees the browser's own offline behaviour, and
loses nothing else.

Two details that would otherwise need rediscovering:

- **No nonce is needed.** The CSP in `next.config.ts` is deliberately one
  directive plus `object-src`; there is no `script-src`, so inline script is
  unconstrained. The docblock there already argues why the policy is that
  narrow.
- **`middleware.ts` matches `/admin/:path*`**, so `/sw.js`,
  `/manifest.webmanifest`, `/offline.html` and `/icons/*` sit outside the
  session gate by construction. This is the same inheritance the rulebook
  records in reverse for `app/admin/palette/route.ts`.

## 5. Manifest and icons

### 5.1 Next's file conventions replace the hand-written `<head>`

The three `<link>` tags at `app/layout.tsx:28-44` are deleted. In their place:

| file | convention | what it is |
|---|---|---|
| `app/icon.svg` | `<link rel="icon">` | the two-tone favicon, one file |
| `app/apple-icon.png` | `<link rel="apple-touch-icon">` | 180×180, **white ground** |
| `app/manifest.ts` | `<link rel="manifest">` | `/manifest.webmanifest` |

**`app/icon.svg`** carries an embedded `<style>` that flips the ink under
`@media (prefers-color-scheme: dark)`; the two greens read on both grounds and
stay literal. This reproduces exactly what the two `media`-switched PNGs do
today, in one file of ~20 kB instead of two totalling 386 kB.

**`app/apple-icon.png` is composited on white** rather than left transparent,
because iOS composites transparency onto black and the wordmark's letterforms
are black. A transparent Apple icon would render as a green vine on a black
square with the *A* invisible.

### 5.2 The manifest

`app/manifest.ts` returns a `MetadataRoute.Manifest`:

```ts
{
  name: SITE_NAME,
  short_name: SITE_NAME,
  description: SITE_DESCRIPTION,
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#ffffff",
  theme_color: "#ffffff",
  icons: [
    { src: "/icons/icon-192.png",          sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/icon-512.png",          sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
}
```

Three notes on the values:

- **The colours are hex, not tokens.** `--background` is `oklch(1 0 0)`;
  manifest parsers do not accept `oklch`. `#ffffff` is that colour written in
  the syntax the format takes. Light-only is honest: `.dark` is declared in
  `globals.css` and nothing adds it (audit §4.4).
- **Manifest icons live in `public/icons/`, not under `app/`.** Next's
  `app/icon.*` convention emits a *hashed* URL, which is right for a `<link>`
  Next writes itself and wrong for a JSON file naming a path. `public/` paths
  are stable.
- **`purpose: "maskable"` is a separate entry**, not added to the `any` entry's
  purpose list. A maskable icon is padded artwork; the same file used as `any`
  renders as a small mark adrift in whitespace.

The maskable icon composites the artwork at ~60% of the canvas on a white
field, so it survives Android's circle and ChromeOS's squircle: the spec's safe
zone is a circle of 80% diameter, and 60% clears it with margin.

### 5.3 One name, two consumers

`name` and `description` are `SITE_NAME` and `SITE_DESCRIPTION` from a new
**`lib/site.ts`**, imported by both `app/manifest.ts` and `app/layout.tsx`'s
`metadata` export. The description is the string already in the layout: *"An
atomic portfolio of creative and professional work."*

Two files naming the app is exactly the shape `READING_COLUMN` exists to
prevent — and an install whose window title disagrees with the page title is the
version of that bug nobody notices for a year.

## 6. What the tests pin

A new **`lib/pwa-source.test.ts`**, written in the idiom
`lib/server-safe-source.test.ts` established: assert the source text, because
each of these passes `tsc`, `npm test` and `npm run build` while being false.

1. **Every `PRECACHE` path in `sw.js` exists in `public/`.** A typo makes
   `addAll` reject, which makes `install` reject, which means the worker never
   activates — and *nothing visibly breaks*. The site simply has no offline page,
   forever, and the only symptom is visible to someone with no network.

2. **`sw.js` calls `caches.open(` and `cache.put(` nowhere outside the install
   handler.** This is §4.1's invariant as a test rather than a comment. Adding
   runtime caching is a three-line change that looks like an improvement and is
   the only way this design can serve a stale or authenticated response.

3. **`VERSION` embeds a hash of the precached bytes.** The test hashes
   `public/offline.html` and the precached icon and asserts the digest appears
   in `VERSION`. This converts *"remember to bump the cache version when you
   edit the offline page"* from discipline into a failing test that prints the
   string to paste. Without it, editing `offline.html` is a change that deploys
   and has no effect on any browser that already installed the worker.

4. **Every `src` in `app/manifest.ts`'s `icons` exists in `public/`.** A
   manifest naming a missing icon is not an error anywhere — Chrome declines to
   offer the install and says so only in DevTools.

And in `lib/server-safe-source.test.ts`, the two brand components join
`SERVER_SAFE` (§3.4).

**§6.2's invariant joins CLAUDE.md** §"Rules the tests pin, and why", in one
sentence: *the service worker writes to no cache at runtime, because its scope
includes `/admin`*. That section is three invariants rather than a ledger of
exceptions ([`2026-09-10-guidelines-rewrite-design.md`](2026-09-10-guidelines-rewrite-design.md)),
and this is an invariant of the same kind — a rule whose violation is a
three-line change that passes every check and serves an authenticated response.
Nothing else in this slice reaches the rulebook: the marks, the manifest and the
icons are ordinary code that breaks loudly.

## 7. What is deleted

| | bytes |
|---|---|
| `public/icon-light.png` | 195,043 |
| `public/icon-dark.png` | 191,419 |
| the three `<link>` tags at `app/layout.tsx:28-44` | — |

## 8. Files

| file | | |
|---|---|---|
| `assets/brand/ariko-icon.svg` | create | source export |
| `assets/brand/ariko-logo.svg` | create | source export |
| `scripts/build-brand.ts` | create | the generator |
| `package.json` | edit | `brand:build` script; `sharp` + `svgo` devDependencies |
| `components/brand/ariko-icon.tsx` | replace | generated |
| `components/brand/ariko-logo.tsx` | replace | generated |
| `app/icon.svg` | create | generated, two-tone |
| `app/apple-icon.png` | create | generated, 180×180 on white |
| `public/icons/icon-192.png` | create | generated |
| `public/icons/icon-512.png` | create | generated |
| `public/icons/icon-maskable-512.png` | create | generated, ~60% on white |
| `app/manifest.ts` | create | the manifest |
| `lib/site.ts` | create | `SITE_NAME`, `SITE_DESCRIPTION` |
| `public/sw.js` | create | navigation-only, no runtime cache |
| `public/offline.html` | create | self-contained |
| `app/layout.tsx` | edit | drop the `<head>` block, add registration, import `lib/site.ts` |
| `lib/pwa-source.test.ts` | create | §6.1–6.4 |
| `lib/server-safe-source.test.ts` | edit | the two brand components |
| `public/icon-light.png` | delete | |
| `public/icon-dark.png` | delete | |
| `CLAUDE.md` | edit | §6.2's invariant joins the rulebook |

## 9. Out of scope, and one of them is a real cost

**The 20 px problem.** `public-chrome.tsx:38` renders the icon at `size-5`, and
the favicon is 16 px. The new artwork is a detailed illustrated pea pod over a
serif *A*; rasterized at 40 px it is already busy, and at 20 px it reads as a
green smudge. The audit anticipated precisely this — *"a simplified silhouette
for the icon size is the other half"* (§4.2) — and that half is **not in this
slice**.

This is a real regression in legibility at the smallest size, accepted
knowingly rather than overlooked. It is out of scope because a simplified mark
is an artwork decision, not an engineering one, and folding it in would make
this slice wait on a drawing. The fix, when it comes, is a third source in
`assets/brand/` and one more branch in `scripts/build-brand.ts`.

**Also out of scope**, and staying in audit §4's remaining slice: the Inclusive
Sans woff2 subset, the Profane fallback metrics, the `preconnect` to
`res.cloudinary.com`, and the gallery and markdown image transforms.

**Not attempted:** offline reading, background sync, push notifications,
install prompts or any `beforeinstallprompt` UI. The browser's own install
affordance is the install affordance.

## 10. The Lab Note

This ships a new mark and an installable app — visitor-facing on both counts —
so the PR carries a Lab Note. Pod slug `ariko`, type `feature`.
