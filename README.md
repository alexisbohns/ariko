# Ariko

*Formerly "Beanstalk" — renamed 2026-07-18. Live at [www.ariko.app](https://www.ariko.app) (Vercel). The Mongo database keeps the legacy name `beanstalk`.*

* **Intention**: I want to showcase all my creative and professional work, organized around a botanical content model.
* **Vision**: Everything I create — songs, product features, podcast episodes, blog posts — is a bean. Beans group into pods (albums, products, podcasts, blogs). The key insight is that beans evolve: every bean has one or more sprouts, which are the fundamental unit of work. A song can have a demo, a studio recording, a live take. A feature can have a POC, an MVP, a V2. The portfolio tells the story of evolution, not just the final state.
* **Approach**: Build a Next.js app (App Router) as a POC for a personal portfolio system based on a botanical content model.

## Data model

### Seeding

* pre-seeded from `/data/garden.yml` (human-authored), imported into Mongo via `npm run migrate`

### Architecture

* **Plant**: the root tier — a name, `natures[]` (`work | tool`), a description, and a **`role`**:
  what Alexis *is* to it. `role.kind` is a required four-value enum (`owner | co-owner | lead |
  contributor`); `role.title` is the real local job title ("Head of Product"), rendered *beside* the
  enum label rather than replacing it; `role.detail` is one optional line of context, never markdown.
  It is a public credibility signal — there is no such thing as a private role. Authored through the
  role card on `/admin/plant/[slug]`; the vocabulary → label mapping lives once, in `lib/plant-role.ts`.
* **Pod**: has a name, domain (`music | design | podcast`), and contains beans
* **Bean**: has a name, an optional description (one bilingual line — what the Directory, the graph and future preview cards show), belongs to a pod (optional — can be standalone), and contains sprouts
* **Sprout**: has a name, type, date, description, state (`draft | private | published`), carried media/source, tags, and flexible per-type properties. `parents` refs (`pod:slug` / `bean:slug`) express **containment only** — future non-containment links (lineage, "featured in") will live in a separate `relations[]`.
* **Bilingual (B1)**: `name`/`description` accept the `Text` type (`string | { en?, fr? }`); plain strings remain valid (no migration). Every surface renders via `resolveText` (en-first, blank parts fall through); the triage/edit forms author both languages via paired en/fr inputs (WYSIWYG — the boxes are prefilled per language and what they submit is what is stored).
* **Relations (G2)**: sprouts carry optional non-containment edges `relations: [{ kind, ref }]` (`ref` in the prefixed grammar incl. `sprout:`; `kind` free, e.g. `evolves-from`, `featured-in`). `filterPublic` scrubs each published sprout's relations to targets that survive the projection (fail-closed, malformed shapes tolerated), so private/draft slugs can never leak; deletes need no cascade — hidden targets simply drop their edges. Authoring UI comes later; relations enter via seed or DB for now.

## Pages

* `/` — Directory. For each plant (+ its pods, + an "Unrooted" group for orphan pods and beans): name, role line, natures, description, and the beans beneath it — each bean a link to /bean/[id] with its own one-line description.
* `/beanstalk` — The beanstalk (formerly `/timeline`, which 308-redirects). Authored sprouts and exhibited pollen feed events, sorted by date descending. Above the list: a `<ul>` of domain filter buttons (`all | music | design | podcast`). Below: a `<ul>` of filtered results.
* `/plant/[slug]` and `/pod/[slug]` — Container pages: name, the plant's role badge ahead of its natures, description, the role's `detail` line, the container's own `content` narrative (entity refs resolved live), then a mechanical index of what is inside.
* `/bean/[id]` — Bean detail. `<h1>` bean name, then for each sprout: `<h2>` sprout name, `<ul>` of all key-value properties.

## Rich content

Sprouts carry optional markdown in `content` (localizable — `Text`, like `name`/`description`).

* It renders as prose on `/bean/[id]` (the newest published sprout carrying content, `lib/article.ts`)
  and as a **Preview** card on `/admin/sprout/[slug]`, beside the raw source.
* The pipeline is configured in exactly one place, `lib/markdown.ts`: `remark-gfm` for tables and
  fenced code, `rehype-sanitize` **last**. `rehype-raw` is deliberately absent, so HTML embedded in
  markdown is inert; the sanitizer is belt-and-braces on top of that.
* GFM tables render through the design system's `Table` primitives; everything else through
  `@tailwindcss/typography`.
* **Entity blocks** — content can embed other entities: `::entity{ref=bean:karma}` as a block card,
  `:entity[label]{ref=plant:paulopus}` inline. The `ref` is the same prefixed grammar `parents[]`,
  `relations[]` and pollen anchors use. Blocks resolve **fail-closed**: a ref whose target did not
  survive `filterPublic` renders nothing at all in public, and renders visibly as unresolved in the
  admin. Refs mirror into `relations[]` at write time under the kinds `embeds` / `mentions` — derived
  state, re-derived on every write, so the graph reads stored refs and never parses prose.
  `POST /api/articles` (below) is one of those write paths.
* Not yet rendered: media embeds and syntax highlighting. Design:
  [`docs/superpowers/specs/2026-08-22-content-composition-design.md`](docs/superpowers/specs/2026-08-22-content-composition-design.md).

## Constraints

* **TypeScript**, strict. CI is `tsc`, `eslint`, `npm test`, `npm run build`.
* **The public zone is progressively enhanced.** Every page reads, every link
  navigates and every media item is reachable with script off; islands add and
  never replace. `lib/server-safe-source.test.ts` is the enforcement.
* **The admin zone is a JavaScript application**, behind a password, with one
  user. Server actions are the write path and server-rendered forms are the
  default because they are less code — not because script is forbidden.
* **A write never mis-saves from a partial form** — an island that has not
  mounted is inert, never destructive.
* **Design system:** Tailwind v4 + shadcn on Base UI. Never hand-roll a
  primitive the registry ships.

`CLAUDE.md` §"Script, by zone" states the three invariants in full, and
`docs/audits/2026-09-10-code-quality-audit.md` §1 records why they replaced the
list that used to sit here — *Zero CSS. No styling whatsoever. No UI library.
Plain semantic HTML only.* — which was true when it was written and had been
false for months by the time it was read.

## Database & development

As of the Vault Spine slice, content lives in **MongoDB** (not the static seed). `data/garden.yml` is retained only as migration input.

* Set `MONGODB_URI` and `MONGODB_DB` in `.env.local` (gitignored).
* `npm run migrate` — one-time import of `data/garden.yml` into Mongo (idempotent).
* `npm run migrate:pbbls-legacy` — one-shot (#54), idempotent and safe to re-run: retired the four seeded `pbbls-*` beans (backed up to `data/retired/`), refiled their twelve changelog sprouts as milestones, and seeded the case study's bean tier private. **Dry by default** — it writes nothing to Mongo unless you pass `-- --apply`, and refuses any argument it does not recognise. Deliberately does **not** rewrite `data/garden.yml` — `yaml.dump` would erase the file's comments, so that half is a hand edit held in place by `lib/pbbls-legacy.test.ts`.
* `npm run dev` — needs `MONGODB_URI` set and the cluster reachable (pages query Mongo at request time). The public pages (`/`, `/beanstalk`, `/bean/[id]`) are `force-dynamic`, so they read published-only from Mongo on every request and reflect a publish immediately — and `npm run build` no longer needs DB reachability to prerender them.
* `npm test` — pure unit tests; the DB-backed integration tests auto-skip unless `MONGODB_URI` is set, so a plain run is green without a cluster.
* `npm run test:db` — the eight DB-backed files, run **serially** against a **scratch database**. Both halves are load-bearing (#75): they share one database and delete each other's `__test__` fixtures under parallel execution, and `MONGODB_DB` is forced to `beanstalk_scratch` from the shell (which wins over `.env.local`) so a `cleanup()` can never reach the real garden. Override with `MONGODB_DB=… npm run test:db` if you mean to.

## Ingestion spine

As of the Ingestion Spine slice, content can be captured into Mongo via API instead of only through the seed.

* Set `INBOX_TOKENS` in `.env.local` — comma-separated `kind:token` pairs, e.g. `*:tok_master,github:tok_gh`. A `kind` of `*` accepts the token for any source kind; otherwise the token is only valid for that specific `source.kind`.
* Set `CLOUDINARY_URL` in `.env.local` (from the Cloudinary dashboard, e.g. `cloudinary://<key>:<secret>@<cloud_name>`) — required for `/api/upload` to store images.
* Set `ARTICLES_TOKEN` in `.env.local` — a single bearer token for `POST /api/articles`; unset means the door is closed (fails closed, `401` on every request).
* `npm run validators` — applies the DB-side `$jsonSchema` validators and seed indexes. Run once after pulling this change, and again after any validator edit.
* `npm run backfill:plant-roles` — one-shot, idempotent: gives every pre-`role` plant `{ kind: "owner" }`.
  Run it **before** `npm run validators` (which tightens `role` to required), then correct the
  non-owner plants by hand in `/admin/plant/[slug]`.
* `npm run check:orphans` — lists Cloudinary assets under the upload folder that no `screens.image`, `beans.cover`, `plants.logo` or `sprouts.media[]` still points at. `lib/storage.ts` refuses to derive a `public_id` from a filename (deriving one once overwrote an asset a published sprout pointed at), so replacing an image always leaves the previous one behind — orphans are the standing cost of that trade. **Reports only**; pass `-- --delete` to remove, `-- --folder <prefix>` to sweep elsewhere. Exit `1` means orphans were found and left in place.

### `POST /api/inbox`

Bearer-authenticated seed ingestion: `Authorization: Bearer <token>`.

Body: `{ title, body?, content?, media?: [], source: { kind, url?, externalId? }, suggested? }`. Bodies over 256 KB are rejected with `413` before parsing or auth.

* Dedups/upserts on `(source.kind, source.externalId)` when `externalId` is present; otherwise every post creates a new seed.
* Embed media (`{ kind: "embed", url }`) auto-detects its provider (YouTube, Vimeo, etc.) when `provider` is omitted.
* Returns `{ id, created }` — `201` when a new seed is created, `200` on an upsert of an existing one.
* `401` when the bearer token is missing/unknown, `403` when the token isn't authorized for that `source.kind`, `400` on a malformed or invalid payload, `413` when the body exceeds 256 KB.

### `POST /api/upload`

Bearer-authenticated Cloudinary image upload: `Authorization: Bearer <token>`, body is `multipart/form-data` with a `file` field.

* Returns a `MediaImage` descriptor (`{ kind: "image", storageKey, url, width?, height? }`) on success (`201`).
* `401` when the bearer token is missing/unknown, `400` when the `file` field is absent, `502` if the upload to Cloudinary itself fails (e.g. a placeholder/invalid `CLOUDINARY_URL`).

The admin UI builds on these endpoints. Connectors post to `/api/inbox` with a bearer token; the browser capture bar (below) reaches the same ingestion path through a session-authenticated server action.

### `POST /api/articles`

Bearer-authenticated long-form write door: `Authorization: Bearer <token>`. Content of this kind
should not live in a repo, and until this door existed `Plant.content` / `Pod.content` had no
authoring path at all except editing `data/garden.yml` and running `npm run migrate`.

Body: `{ container, narrative?, articles?: [{ slug, name, description?, date, content }] }`, e.g.:

```json
{
  "container": "plant:paulopus",
  "narrative": "## Context\n…",
  "articles": [
    { "slug": "karma-accountability", "name": "Karma & Accountability", "date": "2026-07-24", "content": "…" }
  ]
}
```

* `container` is a `plant:`/`pod:` ref; a `bean:` ref is refused — a bean's narrative is its
  sprout's content, not a field. `narrative` and `articles` are each optional on their own, but
  the payload must carry at least one.
* `narrative` and each article's `content` are capped at **64 KiB**.
* Sprout slugs are derived as `<article-slug>-0`, so re-posting an unreviewed article corrects it
  in place.

**The door structurally cannot publish.** Any `state` key on an article is refused whatever its
value, beans are created private, and no visibility is ever changed — publication stays a human
act in the admin.

Two refusals, both pre-checked before anything is written and either one aborting the whole
batch: an article whose stored sprout already carries any `state` (a human has reviewed it), and
a container that is already public **and** carries non-blank prose.

* `401` when the bearer token is missing, wrong, or `ARTICLES_TOKEN` is unset.
* `400` on malformed JSON or a payload that fails validation (the validator's message is returned).
* `409` on refusal — either the pre-check kind above, or a sprout reviewed in the gap between the
  pre-check and the write itself.
* `200` with `{ ok: true, written, narrative }` on success.

**Operating sequence.** Keep the container private while its narrative and articles are posted
and reviewed: posting a narrative to an already-public container would put live prose on the site
whose entity cards all resolve to nothing while the articles are still drafts. Review and publish
the sprouts from the admin; `publishCascade` — untouched — then flips the beans and the container
public together, so the narrative, the cards and the articles all go live in the same act.

### Lab Note pipeline (C1 · GitHub connector)

Merging a PR whose body contains a `## Lab Note` section posts a bilingual
seed to the inbox automatically. The section holds one ```yaml fence:

    ## Lab Note

    ```yaml
    en:
      title: "Relations join the public graph"      # required
      summary: "One or two sentences, user-facing." # required
    fr:                                             # recommended — adaptation, not translation
      title: "Les relations rejoignent le graphe"
      summary: "Une ou deux phrases."
    suggested:                                      # optional — prefills triage
      molecule: ariko
      atom: public-graph
      type: feature
      tags: [changelog, graph]
    ```

Every title and summary is **double-quoted**, always. A colon in a sentence
("Heads up: it moved") is the one thing an unquoted YAML value cannot hold, and
it is the malformed note this pipeline sees most; quoting removes the failure
mode outright. Slug-ish values need no quotes.

Unknown top-level keys are ignored (pbbls keeps its superset keys in the same
block). No section → the job logs "skipped". A malformed note fails the job;
edit the merged PR's body and re-run — the script fetches the live body and
posting is idempotent (upsert on `owner/repo#N`).

**Machinery** (all owned by this repo): `scripts/lab-note/` (pure logic +
tests + thin CLI) and the reusable workflow `.github/workflows/lab-note.yml`,
which every repo calls `@main`. This repo triggers the same file directly on
its own merged PRs.

**Authoring** — the harmonized `lab-note` skill ships as a Claude Code plugin
from this repo: `/plugin marketplace add alexisbohns/ariko`, then
`/plugin install lab-note@ariko`. One install serves every repo; pbbls keeps
its repo-local superset skill, which takes precedence there by design.

**Making it a requirement** (C1d) — a skill is discretionary and only present
where the plugin is installed, so three always-on layers keep every repo honest:

1. **`CLAUDE.md`** carries the requirement and a self-sufficient copy of the
   contract, so an agent authors a valid note even with no plugin loaded.
2. **`.github/pull_request_template.md`** pre-seeds the `## Lab Note` section as
   the default PR body (delete it for chore/refactor/infra/docs PRs).
3. An **advisory reminder** — the reusable `lab-note-reminder.yml` workflow —
   comments on a PR that lacks a valid note (and surfaces malformed notes at
   PR-open instead of loudly at merge). It never blocks; add the **`no-lab-note`**
   label to silence it. Machinery: `scripts/lab-note/remind.mjs` +
   `reminderVerdict`/`reminderComment` in `lib.mjs`.

**Wiring another repo** — add `.github/workflows/lab-note.yml` (post on merge):

```yaml
name: lab-note
on:
  pull_request:
    types: [closed]
permissions:
  contents: read
  pull-requests: read
jobs:
  lab-note:
    if: github.event.pull_request.merged == true
    uses: alexisbohns/ariko/.github/workflows/lab-note.yml@main
    secrets:
      inbox_token: ${{ secrets.ARIKO_INBOX_TOKEN }}
```

and set its secret once (the `github:`-scoped token from Ariko's
`INBOX_TOKENS`, so a leaked CI token can only write `kind:"github"` captures):

```bash
gh secret set ARIKO_INBOX_TOKEN --repo alexisbohns/<repo> --body "$TOKEN"
```

For the advisory reminder, add `.github/workflows/lab-note-reminder.yml` too — no
secret needed (it comments with the built-in `GITHUB_TOKEN`):

```yaml
name: lab-note-reminder
on:
  pull_request:
    types: [opened, edited, synchronize, labeled, unlabeled, ready_for_review]
permissions:
  contents: read
  pull-requests: write
jobs:
  lab-note-reminder:
    uses: alexisbohns/ariko/.github/workflows/lab-note-reminder.yml@main
```

**Rehearsal / backfill** (workflow file must be on `main`):

```bash
gh workflow run lab-note.yml --repo alexisbohns/ariko -f pr_number=<N> -f dry_run=true
gh run watch --repo alexisbohns/ariko   # dry_run prints the payload it would post
```

Passing `-f dry_run=false` instead performs a real, dedup-safe post (backfill): posting upserts on `owner/repo#N`, so re-runs update the same capture. Note that `workflow_dispatch` exists only on ariko's own copy of the workflow and resolves `pr_number` against **this repo's** PRs — sibling repos' stubs run on merge only and cannot be dispatched.

## Pollen (federation contract)

Every project of the practice reports activity to Ariko as **pollen** —
one envelope, three verbs (report / read / initiate), carried by bees
between plants. The normative contract lives in
[`docs/POLLEN.md`](docs/POLLEN.md); the reference validator is
`lib/pollen.ts`, and `data/pollen/` is the conformance fixture suite
sibling repos copy to test their adapters. Dry-run any feed with
`npm run pollen:validate -- path/to/feed.ndjson`. Slice 2 of the
federation umbrella (`docs/superpowers/specs/2026-08-14-ariko-federation-design.md`);
ingestion of pollen into the read model is slice 4.

## Federation read model (slice 4)

Ariko syncs every feed in `data/federation.yml` into a disposable Mongo
cache (`pollen`, `pollen_cursors`, `pollen_refusals`) through one guarded
door: `POST /api/pollen/sync` (bearer `SYNC_TOKEN`; cron:
`.github/workflows/pollen-sync.yml`, every 6 h, secret `ARIKO_SYNC_TOKEN`).
Upstream feed tokens live in Vercel env vars named by each feed's
`tokenEnv` (today: `ARKAIK_API_TOKEN`). The public `/beanstalk` merges
authored sprouts with feed events for plants in the config's `exhibit`
list; `/admin/beanstalk` shows everything plus sync status and refusals.
Rebuild one feed from scratch: `npm run pollen:rebuild -- <feedId>`.
Contract: [`docs/POLLEN.md`](docs/POLLEN.md) §Read.

## Admin zone

A password-gated authoring zone: capture into the inbox, triage a seed into the botanical model, edit every tier, and browse the whole archive whatever its state. It is a JavaScript application on the shared design system — see §Constraints above, and `CLAUDE.md` §"Script, by zone" for what that does and does not permit.

`middleware.ts` gates `/admin/:path*` (everything but the login page) on the signed session cookie and redirects a failure to it; every server action in `app/admin/actions.ts` opens with `requireSession()` as well, because a POST passes through no navigation gate. The chrome is rendered once by the layout, not by the pages: a floating icon rail — Inbox, Vault, Garden, Beanstalk, Screens (`lib/admin-nav.ts`) — plus the public-site and log-out buttons top-right; the ⌘K palette rides with it, so it works on every admin route and withdraws with the chrome on the login page. A section index reads in the wide column, every other route in the public site's own measure.

* Set `ADMIN_PASSWORD` in `.env.local` — the login password.
* Set `ADMIN_SESSION_SECRET` in `.env.local` — a long random value (e.g. `openssl rand -hex 32`) used to HMAC-sign the session cookie. Rotating it invalidates existing sessions.

### `/admin/login`

The login gate, and the one admin route the chrome withdraws from. Submitting the correct `ADMIN_PASSWORD` sets an httpOnly, `SameSite=Lax` (Secure in production) signed cookie good for 30 days and redirects to `/admin`; a wrong password re-renders with an error. Either secret unset means every password is wrong — the door fails closed.

### `/admin` — the inbox

The `status:"inbox"` seeds, newest first: source glyph, title, note snippet, media count, age. A row's title is its triage page. Seeds arrive from the sibling repos' CIs through `POST /api/inbox` (§Ingestion spine) and from the capture overlay here — the `+` beside the title, or the `k` key, opens a full-screen sheet with an autofocused title, a note with an en/fr toggle, paste-a-link fields and the media picker in its compact form, posting to the same `createSeedAction` the API path ends in. The garden is loaded separately from the seeds and fails separately: an unreachable garden costs the source column's plant avatars, never the list.

### `/admin/triage/[id]`

Where a seed becomes a sprout, or leaves. Pick an existing plant, pod and bean from the selects or type a new pod/bean slug and name, then fill the sprout's own fields — slug, name (en/fr), type, date, description — and its state (`draft` / `private` / `published`). Prefills come from the seed's title and note, and from the `suggested` block a lab note carries.

Parents are resolved and the sprout validated **before any write**, so a rejected form never leaves an orphan pod or bean behind; a new pod must be paired with a new bean under it rather than have the intent silently dropped. Promoting as published runs `publishCascade` — the write-time mirror of `filterPublic` — flipping the sprout's bean, pod and plant public, so a published sprout can never dangle under a private parent; draft and private leave the lineage untouched. **Discard** drops the seed from the inbox.

### `/admin/vault`

Every sprout in the archive regardless of state or visibility — the authoring counterpart to the public `/beanstalk`. Sprout, state, plant mark, bean, date and tags, newest first, filtered by `state` / `plant` / `tag`. The filter popovers contain nothing but `<a href>` query-param links (`lib/admin-filters.ts`), so filtering stays server-side in `lib/vault.ts` and a filtered URL is shareable; `s`, `p` and `t` open them. A row's name leads to its bean page.

### `/admin/garden`

Plants and pods — the two tiers that hold narrative — in one table: mark and name, tier, role line, status, visibility, and whether the tier has a narrative at all. Mechanical, and the only way to reach a container's editor without typing its URL. Role and status exist at the plant tier only: a pod under an inactive plant is inactive by containment, and a second stored flag would be a second source of truth.

### `/admin/beanstalk`

The federation operations surface (§Federation read model): each configured feed with its cursor, last sync, status and refusal count; a **Sync now** button running the same sync the cron does; the latest refusals with their reasons; and the merged entry list — every authored sprout at every state beside every cached pollen envelope, private and non-exhibited included. The public `/beanstalk` is a strict subset of it.

### The entity editors — `/admin/plant/[slug]`, `/admin/pod/[slug]`, `/admin/bean/[id]`, `/admin/sprout/[slug]`

One page per tier, each reading the **full** dataset rather than the public projection: in the authoring zone a ref to a draft or private entity should resolve and be visible, not vanish the way it does in public.

* **Plant** — the mark centred in a squircle with the name beneath it, and each editor one click behind the thing it edits: the logo behind the logo, name and description behind the title, the role behind a crown, status and visibility behind two icons that open their vocabulary as radios and commit on a separate Save (disabled until the pick differs from what is stored — a stray click should not unpublish a project). Below that is the narrative, unboxed. The index of pods and beans, and the plant's exhibition of screens with ↑ / ↓ / ✕ per row, are panels on a right-hand rail that slides the page left rather than covering it.
* **Pod** — name, ref, visibility, description, the prose editor, and a mechanical index of the beans inside.
* **Bean** — reached by slug, despite the `[id]` segment. Parents, visibility and tags, then the Cover card and, beside it rather than inside it, the Keyword drawn onto a phone-shaped cover; then every sprout of the bean with its scalar fields and an `edit` link. A bean projected from a feed is source-owned and gets no write forms at all — a full feed rebuild deletes the document, and anything authored onto it with it.
* **Sprout** — the most written page. A rendered preview, the prose editor, the media list (whose **first image becomes the bean's cover**, which makes its order an authoring act), the metadata form (name en/fr, type, date, description, state) and a Danger zone. Saving `published` runs the same upward cascade as promote, except for digest types, whose publication marks review sign-off rather than exhibition. An actual un-publish — it *was* published and no longer is — runs the downward `unpublishCascade`, re-privatizing a bean left sheltering no published sprout, and its pod and plant when nothing public remains under them. The recompute is transition-gated, so a routine draft save never flips visibility somebody authored directly. Delete runs that same recompute against the post-delete dataset, its confirm checkbox re-checked server-side; references to a deleted slug elsewhere are left dangling by design, since every read path tolerates them.

### The screen library — `/admin/screens`, `/admin/screens/[slug]`, `/admin/screens/new`

A contact sheet rather than a table. A hundred and seventy rows of `match-hero-m104-final-spain-argentina-aet` are not scannable by eye, and those names are honest filename stems because nobody was ever going to write a hundred and seventy titles — so the page shows the screens themselves, `object-contain` (a 9:19.5 capture cropped to a tile is a picture of its middle third), with the name as the caption and the vault's filter bar carrying `plant` / `bean` / `tag`. `npm run import:screens` fills it; the `+` beside the title is a link to the create page.

A screen's own page carries its metadata, its exhibition — which plant's strip it appears on — its image and a delete, with prev/next walking the *filtered* set. Clicking a tile opens that page in a panel on the right that the index slides out from under: `app/admin/@sheet/(.)screens/[slug]`, a parallel + intercepting route that **imports and renders the page's own module** rather than reimplementing it. That is the whole design — there is nothing in the panel that is not a page, so script-off the same click is an ordinary navigation to the same editors, and prev, next and close stay real `<a href>`s. `lib/screen-sheet-source.test.ts` pins both halves. Two files there look like dead code and are load-bearing: `@sheet/default.tsx` returns null, which is what makes the layout's `:has(~ [data-screen-sheet])` push honest on every other route, and `@sheet/screens/page.tsx` gives the slot a route that matches the library itself — without it a soft navigation keeps the slot's last state and the panel stays open over the grid it just returned to.

Exhibiting and publishing are one act: `writeExhibition` writes `visibility:"public"` beside `exhibited:true` and reverses both on withdrawal, because splitting them would make "marked for a strip it cannot appear on" the commonest state to end up in.

### `GET /admin/palette`

The ⌘K palette's index — every section, plant, pod, bean, sprout and inbox seed as a flat list of rows, fetched on open rather than server-rendered into the layout, so no admin page's render cost changes. It lives under `/admin` rather than `/api` because `middleware.ts` already matches `/admin/:path*`: the index inherits the session gate with no new auth code. It navigates and never writes; on failure it answers `500` and the palette falls back to the sections it builds itself.

## Public graph endpoint

### `GET /api/graph`

The graph playground's data contract (roadmap G1): the published-only dataset as JSON —
`{ nodes: [{ id, kind, name, description?, natures?, cover?, type?, date?, status?, tags? }], edges: [{ source, target, kind }] }` — optional fields ride along only when the entity carries them (`natures` on plants, `cover` on beans, `type`/`date` on sprouts, `type`/`status` on bees).

* Node ids reuse the prefixed-ref grammar — `plant:<slug>`, `pod:<slug>`, `bean:<slug>`, `sprout:<slug>`, `bee:<slug>` — and slugs are immutable, so ids are stable across publishes.
* Unauthenticated and `force-dynamic` — it is the data twin of the public pages and composes the same `filterPublic` projection, so it can never expose more than the public HTML does. A node carries its resolved `description` and, for a bean, the cover image (explicit or derived — the picture only, never the phone treatment, and only when its URL is http(s)); `content`, raw `media` and `source` stay out.
* Edges: containment (from `parents[]`, kind `contains`) plus non-containment relations (from `relations[]`, per-relation kind, plus a bee's `serves` refs); an edge is emitted only when both ends survive the projection.

See `docs/superpowers/specs/` and `docs/superpowers/plans/` for the design and implementation plans.
