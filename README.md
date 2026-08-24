# Ariko

*Formerly "Beanstalk" — renamed 2026-07-18. Live at [www.ariko.app](https://www.ariko.app) (Vercel). The Mongo database keeps the legacy name `beanstalk`.*

* **Intention**: I want to showcase all my creative and professional work, organized around a botanical content model.
* **Vision**: Everything I create — songs, product features, podcast episodes, blog posts — is a bean. Beans group into pods (albums, products, podcasts, blogs). The key insight is that beans evolve: every bean has one or more sprouts, which are the fundamental unit of work. A song can have a demo, a studio recording, a live take. A feature can have a POC, an MVP, a V2. The portfolio tells the story of evolution, not just the final state.
* **Approach**: Build a zero-CSS Next.js app (App Router) as a POC for a personal portfolio system based on a botanical content model.

## Data model

### Seeding

* pre-seeded from `/data/seed.yml` (human-authored), imported into Mongo via `npm run migrate`

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

* Zero CSS.
* No styling whatsoever.
* No UI library.
* Plain semantic HTML only.
* TypeScript.
* Public zone is zero-CSS, plain semantic HTML.

## Database & development

As of the Vault Spine slice, content lives in **MongoDB** (not the static seed). `data/seed.yml` is retained only as migration input.

* Set `MONGODB_URI` and `MONGODB_DB` in `.env.local` (gitignored).
* `npm run migrate` — one-time import of `data/seed.yml` into Mongo (idempotent).
* `npm run dev` — needs `MONGODB_URI` set and the cluster reachable (pages query Mongo at request time). The public pages (`/`, `/beanstalk`, `/bean/[id]`) are `force-dynamic`, so they read published-only from Mongo on every request and reflect a publish immediately — and `npm run build` no longer needs DB reachability to prerender them.
* `npm test` — pure unit tests; DB-backed integration tests auto-skip unless `MONGODB_URI` is set (run them with `node --env-file=.env.local --import tsx --test "lib/**/*.test.ts"`).

## Ingestion spine

As of the Ingestion Spine slice, content can be captured into Mongo via API instead of only through the seed.

* Set `INBOX_TOKENS` in `.env.local` — comma-separated `kind:token` pairs, e.g. `*:tok_master,github:tok_gh`. A `kind` of `*` accepts the token for any source kind; otherwise the token is only valid for that specific `source.kind`.
* Set `CLOUDINARY_URL` in `.env.local` (from the Cloudinary dashboard, e.g. `cloudinary://<key>:<secret>@<cloud_name>`) — required for `/api/upload` to store images.
* Set `ARTICLES_TOKEN` in `.env.local` — a single bearer token for `POST /api/articles`; unset means the door is closed (fails closed, `401` on every request).
* `npm run validators` — applies the DB-side `$jsonSchema` validators and seed indexes. Run once after pulling this change, and again after any validator edit.
* `npm run backfill:plant-roles` — one-shot, idempotent: gives every pre-`role` plant `{ kind: "owner" }`.
  Run it **before** `npm run validators` (which tightens `role` to required), then correct the
  non-owner plants by hand in `/admin/plant/[slug]`.

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

As of Plan 2b-i, a password-gated admin zone lets you capture into the inbox from the browser and review it — no curl needed. It is intentionally **bare functional HTML** (no CSS, no client JavaScript) until the project's artistic direction is set; triage/promote/publish (2b-ii) and the vault browser (2b-iii) come next.

* Set `ADMIN_PASSWORD` in `.env.local` — the login password.
* Set `ADMIN_SESSION_SECRET` in `.env.local` — a long random value (e.g. `openssl rand -hex 32`) used to HMAC-sign the session cookie. Rotating it invalidates existing sessions.

### `/admin/login`

The login gate. Submitting the correct `ADMIN_PASSWORD` sets an httpOnly, `SameSite=Lax` (Secure in production) signed session cookie and redirects to `/admin`; a wrong password re-renders with an error. `middleware.ts` protects every `/admin/*` route (except the login page) and redirects unauthenticated requests here; each mutating server action re-checks the session as well.

### `/admin`

* **Quick-capture bar** — title (required), an optional note with an en/fr toggle, and one or more paste-a-link fields. Submitting creates a `Capture` in the inbox via the same `validateInboxPayload` → `createOrUpdateCapture` path as `/api/inbox`; embed providers are auto-detected. Image attach is deferred to a later slice.
* **Inbox** — a read-only table of `status:"inbox"` captures (source, title, note, media, age), newest first. Each row's title links to the capture's triage page.

### `/admin/triage/[id]`

Turns a captured item into a first-class `Version` in the atomic model (or discards it).

* **Promote** — choose an existing molecule and atom from the dropdowns, or type a new slug/name (a blank "new slug" falls back to the selection; new-fields win when filled). Fill the version fields (slug, name, type, date, description) and pick a state: `draft` / `private` / `published`. The capture's media and provenance are carried onto the version.
* **Private by default** — newly created molecules/atoms are `visibility:"private"`. Publishing a version runs the pure `publishCascade` (the write-time mirror of `filterPublic`) which flips that version's parent atom and molecule to `public`, so a published version never dangles under a private parent. Promoting as draft/private leaves the parents untouched.
* **Discard** — drops the capture from the inbox (`status:"discarded"`).
* Run `npm run validators` after pulling this change to ensure the atomic-model slug indexes. Publishing is reflected on the public site immediately (the public pages are `force-dynamic`).

### `/admin/vault`

A read-only browser of the **whole** archive — every molecule/atom/version regardless of state or visibility (the counterpart to the inbox; linked from `/admin`).

* Version-centric table (name, state, domain, atom, date, tags), newest first.
* Filter by `state` / `domain` / `tag` via query-param links (zero-JS, like `/beanstalk`); an unrecognized filter value falls back to "all".
* Read-only — a row's version name links to its atom-detail page, where each version has an `edit` link (see `/admin/version/[slug]` below).

### /admin/atom/[id]

A read-only detail view of a single atom over the **full** dataset (every state/visibility), reached from each vault row's version name — so `draft`/`private` versions no longer 404 (they previously linked to the public `/atom/[id]`, which hides unpublished content).

* Header: the atom's name, slug, visibility, domain, molecule parent(s), and tags.
* Then every version of the atom, newest first, with its `state` (draft/private/published), scalar fields, and tags. Each version has an `edit` link to `/admin/version/[slug]`.
* Gated by the same `/admin/*` middleware; `force-dynamic` so it reflects current DB state.

### /admin/version/[slug]

A dedicated edit page for a single Version, reached from each version's `edit` link on the atom-detail view.

* Editable: `name`, `type`, `date`, `description`, and `state` (draft/private/published). The `slug` is immutable (identity); re-parenting, media, source, content, and tags are out of scope.
* Re-publishing (→ `published`) runs the same upward `publishCascade` as promote, flipping the parent atom/molecule public. Un-publishing (`published` → `draft`/`private`) runs the downward `unpublishCascade` + `setPrivate`: the withdrawn version's atom, left with no published version, is re-privatized — and its molecule too when no public atom remains under it — so pulled work leaves no empty public shell (not even its name). A still-published sibling version keeps its lineage public.
* The recompute is **transition-gated**: it fires only when the version actually leaves `published`. A routine draft save never flips visibility that was authored directly (e.g. seeded name-only public atoms), and re-running `npm run migrate` no longer force-republishes — the migration's public/published defaults apply on first insert only, so admin un-publishes survive a re-migrate.
* **Delete** — a "Danger zone" form at the bottom of the page hard-deletes the version (confirm checkbox required, re-checked server-side). When the deleted version was `published`, the same downward recompute runs against the post-delete dataset (its atom parents are captured before the delete), so a delete can never leave an empty public shell either. References to the deleted slug elsewhere (a capture's `promotedTo`) are left dangling by design — every read path tolerates dangling refs.
* Read-only `slug`/atom context is shown; a blank required field re-renders with an error and writes nothing. Gated by the `/admin/*` middleware and the action's `requireSession()`.

## Public graph endpoint

### `GET /api/graph`

The graph playground's data contract (roadmap G1): the published-only dataset as JSON —
`{ nodes: [{ id, kind, name, domain?, type?, date?, tags? }], edges: [{ source, target, kind: "contains" }] }`.

* Node ids reuse the prefixed-ref grammar (`molecule:<slug>` / `atom:<slug>` / `version:<slug>`); slugs are immutable, so ids are stable across publishes.
* Unauthenticated and `force-dynamic` — it is the data twin of the public pages and composes the same `filterPublic` projection, so it can never expose more than the public HTML does. Node payloads deliberately exclude `description`/`content`/`media`/`source` until the exhibition slice (B3) defines what a focused node shows.
* Edges: containment (from `parents[]`, kind `contains`) plus non-containment relations (from `relations[]`, per-relation kind); an edge is emitted only when both ends survive the projection.

See `docs/superpowers/specs/` and `docs/superpowers/plans/` for the design and implementation plans.
