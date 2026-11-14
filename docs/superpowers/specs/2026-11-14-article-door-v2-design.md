# Article door v2 — a repo posts its own drafts

*2026-11-14*

## 0. The observation

Sibling repos are meant to write about themselves on Ariko: ask the agent in
`pbbls` for an article, approve it, and find a draft in the admin. Today that
fails in three ways.

- **A cloud session cannot post.** `POST /api/articles` takes one shared
  `ARTICLES_TOKEN`. A Claude Code cloud container has neither the secret nor,
  by default, `www.ariko.app` on its network allowlist. The Lab Note pipeline
  works only because CI posts it after merge — a route the maintainer rejects
  here: **repos must not store content or assets**, so there is nothing for CI
  to post from.
- **A repo cannot carry an image.** The door takes JSON only. `![](url)`
  renders, but only for an image already hosted somewhere public; a screenshot
  on the agent's disk has no way in. `garden.yml` solved this for covers and
  media (manifest-relative paths, `checkUploadFile`, server-side upload); the
  article door never got it.
- **The door writes one kind of thing.** Since the journal model
  (`2026-10-10-journal-model-design.md`) an "article" posted here is a bean's
  narrative — rewritten in place, undated. The pbbls blog posts that prompted
  this are the other kind: a dated piece about a project or some of its
  features, which Ariko calls a sprout of kind `essay`. The door cannot create
  one.

Staging — callouts, attributed quotes, phone/desktop frames, galleries,
do-and-don't, vector figures — is a **second slice** with its own spec: it is
mostly visual decisions and editor round-tripping, and nothing in it is needed
for a cloud session to post a draft with inline images and plain `>` quotes.

## 1. Decisions

| # | Decision | Rejected |
|---|---|---|
| 1 | The agent posts **directly** to the API, from a local or cloud session. | CI-on-merge: forces the repo to store content and assets. |
| 2 | **One token per repo, scoped to its pod.** | One shared token: every container holds a key that writes anywhere; rotation is all-or-nothing. |
| 3 | Tokens are minted by **CLI** (`npm run token:mint`). | An admin page: a new surface for ~5 tokens. |
| 4 | The door writes **essays (sprouts) and narratives (pods/beans)**; the skill picks from the request. | Only one of the two. |
| 5 | Assets upload **one per request**, before the article. | One multipart bundle: Vercel caps a request body at ~4.5 MB. |
| 6 | An essay's `about` resolves **inside the token's pod only**. Cross-pod mentions are inline `:entity[…]` links. | Garden-wide `about`: a pbbls token could anchor an entry to an Arkaik bean. |

## 2. Tokens

A `tokens` collection, one document per issued token:

```ts
interface RepoToken {
  pod: string;          // the pod slug this token writes into
  hash: string;         // sha256 hex of the token; the token itself is never stored
  label: string;        // free text, e.g. "pbbls — 2026-11-14"
  createdAt: string;
  lastUsedAt?: string;  // updated on each authorized request, best effort
  revokedAt?: string;
}
```

- The token is `ariko_<pod>_<32 random base64url chars>`. The prefix is for a
  human reading an `.env`; authorization is by hash lookup only — the prefix is
  never parsed as a claim.
- `npm run token:mint -- --pod <slug>` refuses an unknown pod, revokes any live
  token for that pod (one live token per repo), inserts the new hash and prints
  the token **once**. `token:list` prints pod, label, created, last used,
  revoked. `token:revoke -- --pod <slug>` revokes.
- **Minting hands over the setup, not just the secret.** The maintainer
  configures one Claude Code cloud environment preset per repo, so `token:mint`
  prints a **setup card** per pod and can write it where it is needed:

  ```bash
  npm run token:mint -- --pod pbbls --env ../pbbls/.env
  npm run token:mint -- --pod pbbls --pod arkaik --pod femfolk --sheet ~/Desktop/ariko-cloud-setup.md
  ```

  `--pod` is repeatable. Each card holds, for one repo:
  1. **Cloud preset → Environment variables:** `ARIKO_TOKEN=<token>` and
     `ARIKO_URL=https://www.ariko.app`, ready to paste.
  2. **Cloud preset → Network access:** add `www.ariko.app` to the allowed
     domains (or use full access). Nothing else: images go through Ariko,
     never straight to Cloudinary.
  3. **Repo → `.claude/settings.json`:** the `extraKnownMarketplaces` /
     `enabledPlugins` snippet (§4).
  4. **Repo → `CLAUDE.md`:** the "Writing for Ariko" fallback section, to
     paste (§4).
  5. **Check:** open a cloud session in that repo and ask it to ping Ariko; it
     should answer with the pod's name.

  `--env <path>` writes the token into that repo's `.env`, inside a marked
  block that a later mint **replaces** rather than appends to:

  ```bash
  # >>> ariko (minted 2026-11-14 by `npm run token:mint -- --pod pbbls`)
  # Drafts for Ariko: the ariko-article skill reads these.
  # CLOUD SESSIONS do not see this file. In the Claude Code cloud environment
  # preset for this repo, also:
  #   - Environment variables: ARIKO_TOKEN and ARIKO_URL, same values as below
  #   - Network access: allow www.ariko.app
  ARIKO_TOKEN=ariko_pbbls_…
  ARIKO_URL=https://www.ariko.app
  # <<< ariko
  ```

  It refuses a file that git tracks (`git ls-files --error-unmatch` in that
  file's repo), and, inside a work tree, one that is not gitignored
  (`git check-ignore`) — several sibling repos are public, and a tracked `.env` there
  would publish the token on the next push.

  `--sheet <path>` writes every card into one markdown file, to have open while
  creating the presets. It refuses a path inside any git working tree (the
  Ariko repo is public), writes it `0600`, and the sheet's first line says to
  delete it once the presets are done. Without `--env` or `--sheet`, the cards
  go to stdout only. Ariko itself stores hashes, so a lost sheet means
  re-minting, never recovering.
- `lib/repo-token-store.ts` (the Mongo half; `lib/repo-token.ts` is the pure half) exports `authorizeRepo(header): Promise<{ ok: true; pod } |
  { ok: false }>` (the route answers 401): hash the bearer, find a non-revoked document by
  hash. A missing header, unknown hash and revoked token are all 401 with the
  same body — the door does not say which.
- **Transition.** `ARTICLES_TOKEN` keeps working on the legacy payload shape
  (`container` / `narrative` / `articles`) unchanged. The v2 shape is accepted
  only with a repo token. Retiring the legacy token is a later one-line PR,
  once no sibling posts the old shape.

### 2.1 Amendment (2026-11-14, after merge): the scope is a plant, not a pod

Decisions 2 and 6 assumed a repo is a pod. Minting showed otherwise: in
production the `pbbls` plant has eleven pods, `arkaik` six, and `femfolk` and
`melogram` none; only `krabs` is one plant with one pod of the same name. A
pod-scoped token would have made the pbbls repo hold eleven tokens and left two
repos with nothing to mint. **The token is scoped to a plant** — decisions 2 and
6 read "plant" where they say "pod" — and everything below §2 that says the
token's pod now means the plant's pods, with these consequences:

- `RepoToken.pod` is `plant`; `token:mint|revoke` take `--plant`; the prefix is
  `ariko_<plant>_`. No pod-scoped token was ever minted, so nothing migrates.
- Scope: the plant's pods (`parents` has `plant:<plant>`), and the beans under
  any of them or directly under the plant.
- A narrative slug naming one of the plant's pods means the pod. A **new bean**
  needs `pod:` — one of the plant's pods — since the door can no longer infer
  it. `pod:` on an existing bean must name the pod it is in (so re-posting the
  payload that created it is safe); on a pod narrative it is refused.
- An essay's `about` is **optional**: omitted, the essay is about the plant and
  is written with `parents: ["plant:<plant>"]` and no `about` (the sprout model's
  plant-level entry; one or the other, never both). This is what lets a plant
  with no pods take essays.
- Ownership (`source.externalId`) is the plant.
- Ping returns `{ plant, pods: [{ slug, name, visibility }], beans: [{ slug,
  name, pod, visibility, projected? }] }`, `pod: null` for a bean directly
  under the plant; 404 when the plant is gone.
- The write result carries `written` refs in write order; the route maps them
  to admin links (`pod:x` → `/admin/pod/x`), since the slug alone no longer says
  which kind it was.

## 3. Doors

All three live under `/api/articles` (not `/admin`: they are token-gated, not
session-gated — same as today's door). All return JSON; all errors are
`{ error }` with a message that names the offender.

### 3.1 `GET /api/articles/ping`

Returns the token's scope so the agent can check its setup before writing a
word, and learn what it may anchor to:

```json
{ "pod": "pbbls", "plant": "pebbles",
  "beans": [{ "slug": "feed", "name": "Feed", "visibility": "public" }] }
```

`name` is resolved to English. Projected beans are listed with
`"projected": true` (they can be `about` targets but take no narrative).

### 3.2 `POST /api/articles/assets`

`multipart/form-data`, one field `file`. Checked by `checkUploadFile` (4 MB,
the raster list in `lib/upload-input.ts` — SVG stays out until slice 2
decides how to sanitize it), uploaded server-side through the same
`uploadImage` the admin uses, and returned:

```json
{ "url": "https://res.cloudinary.com/…", "width": 1170, "height": 2532 }
```

The upload is not tied to an article. An asset uploaded for a draft that is
never posted is an orphan, which `npm run check:orphans` already sweeps.

### 3.3 `POST /api/articles` — the v2 payload

```ts
interface ArticlesV2 {
  essays?: EssayInput[];
  narratives?: NarrativeInput[];
}
interface EssayInput {
  slug: string;              // the sprout slug
  date: string;              // YYYY-MM-DD, validated by lib/sprout-date.ts
  name: Text;
  description?: Text;
  content: Text;
  about: string[];           // bare slugs: the token's pod and/or its beans; ≥1
}
interface NarrativeInput {
  slug: string;              // the token's pod, or a bean in it (new or existing)
  name?: Text;               // required when the bean does not exist yet
  description?: Text;
  content: Text;
}
```

`Text` is the door's existing shape (string or `{ en?, fr? }`, unknown language
keys refused, 512 KiB per part). The v2 shape is told apart from the legacy one
by the presence of `essays` / `narratives`; a body carrying both shapes is
refused.

**Refused keys**, on every essay and narrative, whatever their value:
`state`, `visibility`, `kind`, `type`, `parents`, `exhibited`. The door cannot
publish, cannot pick a kind other than `essay`, and cannot anchor outside
`about` — the same refusal-by-name the manifest makes.

**Scope.** Every essay `about` slug must be the token's pod or a bean whose
parent is that pod; it is written as `pod:<slug>` / `bean:<slug>`. Every
narrative slug must be the pod or one of its beans, or — for a bean that does
not exist — is created under the pod. Anything else is refused by name, e.g.
`about "arkaik-graph" is not in pod pbbls`.

**What "public" means here.** A pod or bean with no `visibility` field is
public — `lib/data.ts` and `filterPublic` read it that way — so this door
treats it as reviewed and refuses it. Writable means `visibility: "private"`.
This holds even for a public pod whose narrative is still blank: writing it
would put the door's text live with no review, which is the one thing this
door exists not to do.

**Halves are merged, never replaced.** A post carrying only `{ en }` keeps a
stored `fr` (and vice versa) on `content`, `name` and `description` — the
admin's "halves are edited one at a time" rule, applied to this door. An
omitted `description` on a re-post leaves the stored one alone.

**A bean under two pods** can be written by either pod's token. A slug equal
to the pod's always names the pod.

**Essays.** Written through `createSprout` as `state: "draft"`,
`kind: "essay"`, with `about` set and no `parents` (`updateSproutAnchor`'s
one-field rule). Re-posting a slug:

- no sprout with that slug → create;
- a **draft essay this door wrote for this pod** (`kind: "essay"`,
  `source: { kind: "article-door", externalId: <pod> }`) → replace `name`,
  `description`, `content`, `date`, `about`;
- a published or private sprout → refused (`already reviewed`); any other
  sprout — the maintainer's own draft, another pod's essay — → refused
  (`not written by this door`).

**Narratives.** The pod or bean's `content` (and `name` / `description` when
given) through the existing store logic, with its existing refusals: a
projected bean is refused; a public bean is refused; a public pod with
non-blank content is refused. A new bean is created private under the pod.
Hand-authored `relations` are preserved (`contentPatch`'s required parameter).

**Image rule.** Every image URL in every posted `content` part — markdown
`![…](url)` — must be an upload on Ariko's Cloudinary cloud: parsed as a URL,
`https://res.cloudinary.com`, normalized path
`/<cloud>/image/upload/(v…/)?<folder>/` — the shape `uploadImage` returns. A
raw prefix check is not enough: `/<cloud>/../other/` and `/<cloud>/image/fetch/<remote>`
both start with the prefix, and the second is a proxied hotlink. Anything else is refused by name. This is what makes the draft the
maintainer approved in the session the draft that is stored: no hotlink can
change or vanish after review.

**All-or-nothing**, as today: every refusal is collected before any write and
returned together (`409` with `refused: [...]`). If a write loses a race
mid-batch, the 409 also lists what was already `written` (all private or
draft), and the route still invalidates for those; `400` for shape. After a
successful write, `revalidateGarden()`.

## 4. The `ariko-article` plugin

`plugins/ariko-article/skills/ariko-article/SKILL.md`, listed in
`.claude-plugin/marketplace.json` beside `lab-note` and `garden-plant`.

The sequence the skill teaches:

1. **Ping.** `GET /api/articles/ping` with `ARIKO_TOKEN` against `ARIKO_URL`
   (default `https://www.ariko.app`). On failure, name the cause and stop:
   variable unset → "ARIKO_TOKEN is not set"; connection refused / DNS / proxy
   403 → "Ariko is unreachable — is www.ariko.app on this environment's
   network allowlist?"; 401 → "the token was refused (revoked or mistyped)".
2. **Decide the kind.** "Write about X" → essay; "update / rewrite the
   narrative of feature Y" → narrative. Ask when unclear.
3. **Draft in scratch**, never in the repo: the session's scratchpad or
   `$TMPDIR/ariko-article/<slug>/`. Bilingual where the user wants it, FR as an
   adaptation in "tu".
4. **Gather images** — screenshots the agent can take, files the user points
   to. Raster only in this slice.
5. **Show the draft and wait for an explicit yes.** Nothing is uploaded before
   approval, so a rejected draft leaves no orphans.
6. **Upload**, rewrite each local path to the returned URL, **post**.
7. **Report** the admin URL (`/admin/sprout/<slug>`, `/admin/bean/<slug>` or
   the pod page) and that it is a draft to publish there.

Setup checklist, in the skill and in the README, per repo:

1. `npm run token:mint -- --pod <slug>` in the Ariko repo.
2. `ARIKO_TOKEN` in the repo's `.env` (gitignored) **and** in the cloud
   environment's variables.
3. `www.ariko.app` on the cloud environment's allowed domains.
4. In the repo's `.claude/settings.json`:
   ```json
   { "extraKnownMarketplaces": { "ariko": { "source": { "source": "github", "repo": "alexisbohns/ariko" } } },
     "enabledPlugins": { "ariko-article@ariko": true } }
   ```
   Cloud sessions honouring project-level `enabledPlugins` is to be confirmed
   with one real session before the rollout relies on it; the fallback below
   covers it either way.
5. A short **"Writing for Ariko"** section in the repo's `CLAUDE.md` —
   endpoints, variables, the seven steps, the refused keys — self-sufficient
   without the plugin, exactly like the Lab Note section.

## 5. Tests

- `lib/articles-v2.test.ts` — pure validation: refused keys by name, `about`
  non-empty, date shape, legacy and v2 shapes mutually exclusive, image URL
  rule (Cloudinary passes, anything else refused by name, data: URIs refused).
- `lib/repo-token.test.ts` — mint/verify round-trip, revoked token refused,
  one live token per pod, the stored document carries no plaintext.
- `lib/articles-route.test.ts` (extended) — legacy token cannot post v2, repo
  token cannot post legacy; pbbls token cannot narrate an Arkaik bean nor
  anchor `about` there; ping returns the scope.
- `lib/articles-store.test.ts` (extended, `npm run test:db`) — essay created
  as a draft essay with `about` and no `parents`; re-post replaces a draft;
  published sprout refused; one bad item writes nothing.
- `lib/articles-source.test.ts` — the v2 store never writes `state: "published"`
  nor `visibility`, and the route calls `revalidateGarden`
  (`garden-cache-source.test.ts` already pins the door; extend its list if the
  new routes are separate files).

## 6. Out of scope

- The staging grammar (slice 2): callout, attributed quote, figure with
  frame and size, gallery, compare, SVG figures, and their Tiptap nodes.
- An admin page for tokens.
- Retiring `ARTICLES_TOKEN`.
- Rolling the plugin out to each sibling repo — a checklist, run per repo
  after merge.
