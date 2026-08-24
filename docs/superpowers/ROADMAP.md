# Ariko — Roadmap

**Last updated:** 2026-07-18

This is the single, browsable view of where Ariko is and what's next. It **aggregates** the
"Deferred to later specs / follow-ups" sections that live at the bottom of each plan in
`docs/superpowers/plans/`. Those per-plan sections remain the authoritative source; this file rolls
them up, adds the *why*, and orders them. When a slice ships, move its item to **Shipped** and prune
the corresponding per-plan note if it's fully covered.

---

## North star (intention)

Ariko is a personal **"central node"**: a place that showcases all of Alexis's creative and
professional work on an **atomic content model** — `Molecule → Atom → Version`. An atom is any unit
of work (a song, a product feature, a podcast episode, a post); atoms **evolve** through versions
(demo → studio → live; POC → MVP → V2). The portfolio tells the story of *evolution*, not just the
final state.

The system is **archive-first and private by default**: everything lives in a private vault, and a
**curated `published` subset** is projected to a public exhibition zone. The security-sensitive rule
— only `state === "published"` versions (and their non-private lineage) ever reach the public — is
enforced by the pure `filterPublic` projection, which every public read passes through.

The public exhibition's end-state is an **interactive graph playground**: molecules, atoms, and
versions as explorable nodes; containment, evolution, and cross-links as edges. Brand, artistic
direction, and the graph interface itself come **after** the functional roadmap — but the functional
work below is sequenced so the graph needs no rework when it arrives (see Track G).

Guiding constraints (today): the admin/tooling UI is intentionally **bare functional HTML** (no CSS,
no client JS, no UI framework) until an artistic direction is set; the public zone is likewise
zero-CSS plain semantic HTML **for now**. TypeScript throughout. Tests: pure logic is unit-tested
with no DB; DB/glue is smoke-tested.

---

## Where we are (shipped)

| Slice | PR | What it delivered |
|---|---|---|
| **Plan 1 — Data Spine** | #1 | Extended atomic model, pure `filterPublic` (published-only + downward privacy cascade), Mongo store (`lib/db`/`lib/store`), seed migration, public pages read Mongo. |
| **Plan 2a — Ingestion Spine** | #3 | `captures` collection, `POST /api/inbox` (bearer auth, validation, embed normalization, dedup/upsert), `POST /api/upload` (Cloudinary), DB `$jsonSchema` validators. |
| **Plan 2b-i — Admin auth + capture + inbox** | #4 | Password gate (HMAC session cookie, `/admin/*` middleware), zero-JS quick-capture bar, read-only inbox. |
| **Plan 2b-ii — Triage → promote → publish** | #6 | Triage workspace, first atomic-model **writes** (private-by-default), pure upward `publishCascade` + `setPublic`. |
| **Plan 2b-iii — Public revalidation + vault browser** | #7 | `force-dynamic` public pages (publishes appear instantly), read-only `/admin/vault` browser with state/domain/tag filters. |
| **Admin atom-detail view** | #8 | Read-only `/admin/atom/[id]` over the full dataset; fixed the vault link so draft/private versions no longer 404. |
| **Edit / un-publish a Version** | #9 | `/admin/version/[slug]` edit page + `editVersionAction`; edit core fields, re-publish (reuse cascade), un-publish (state-only). |
| **A1 — Recompute visibility on un-publish** | #11 | Pure `unpublishCascade` (the downward inverse of `publishCascade`) + `setPrivate`, wired into `editVersionAction` and **gated on the actual `published → non-published` transition**: un-publishing the last published version re-privatizes its atom (and an emptied molecule) — withdrawn work leaves no public shell, while routine draft saves never touch seed-authored visibility. Also fixed `migrate-seed` so a re-run no longer clobbers admin un-publishes ($setOnInsert defaults). |
| **A2 — Delete a Version** | #11 | Hard delete from the edit page's "Danger zone" (confirm checkbox, re-checked server-side). The recompute core is now atom-keyed (`unpublishCascadeForAtoms`; `unpublishCascade` is a thin adapter): parents + published state are captured **before** the delete, sheltering is evaluated against the post-delete dataset — a delete can't leave an empty public shell. |
| **G1 — Public graph endpoint** | #11 | `GET /api/graph`: pure `toGraph` serializer (`lib/graph.ts`) over `filterPublic` — stable prefixed-ref node ids (incl. `version:`), containment edges with the both-ends prune rule, minimal node payload (no description/content/media/source until B3). The graph playground's data contract is live. |
| **B1 — Bilingual `Text` widening** | — | `name`/`description` widened to `Text` across the model (plain strings stay valid — no migration); strict `textPart` + `composeText` helpers; WYSIWYG en/fr inputs on the triage/edit forms; every read surface resolves via `resolveText` (blank parts fall through); `GraphNode.name` stays `string`. |
| **G2 — `relations[]` non-containment edges** | — | `Relation { kind, ref }` on Version (prefixed refs incl. `version:`); `filterPublic` scrubs relations fail-closed to projection-surviving targets (malformed shapes tolerated — one bad doc can't 500 the public site); `toGraph` emits per-kind relation edges with `(source, target, kind)` dedup; public dump renders `kind → ref`. No referential integrity needed, by design. Authoring UI deferred. |
| **C1a — Lab Note pipeline (GitHub connector)** | #17 | Merged PRs post bilingual Lab Note captures to `/api/inbox` via a reusable workflow owned by ariko (self-dogfooding trigger included); `Capture.title` widened to `Text`. Spec `2026-07-18-lab-note-pipeline-design.md`; shipped 2026-07-18. |
| **C1b — Inbox go-live hardening** | #18 | E11000 single-retry on the dedup upsert (concurrent posts converge); constant-time bearer-token compare (SHA-256 + `timingSafeEqual`, no-early-exit scan); 256 KB body cap on `/api/inbox` (413 before auth). |
| **C1c — Lab Note fan-out kit** | #19 | Harmonized authoring skill shipped as a Claude Code plugin (`ariko` marketplace); sibling rollout via templated issues + centrally-set secrets — no pushes to sibling repos. |
| **C1d — Lab Note requirement** | #?? | Moved the requirement off the discretionary skill into always-on layers: a root `CLAUDE.md` with the contract inlined, a PR template seeding the `## Lab Note` section, and a reusable **advisory** reminder workflow (`lab-note-reminder.yml` + `remind.mjs`) that comments on PRs missing/malforming a note (opt out with `no-lab-note`) and shifts validation left. Sibling rollout via the same issue-kit pattern. |
| **Slice 5 — Tiptap editor** | #43 | **The admin learns to write.** `Sprout.content`, `Plant.content` and `Pod.content` get their first authoring surface: a Tiptap island over markdown with `@` entity mentions, `/` blocks and reference cards, in its own form and its own action so the metadata forms stay zero-JS. New `/admin/plant/[slug]`, `/admin/pod/[slug]` and `/admin/garden`. The conformance work (one corpus, three readers — remark renders, the marked tokenizer writes, `extractRefs` feeds the graph) found five defects in already-shipped code, including a `remark-directive` bug that rendered any `10:30` in prose as an empty `<div>`, and a ReDoS in `extractRefs` reachable from `/api/articles`. Spec `2026-08-23-tiptap-editor-design.md`. |

The admin loop is complete end to end: **capture → triage → publish → browse → edit / un-publish**,
and the public projection is now consistent in **both directions** (publish lifts a lineage up,
un-publish walks it back down).

---

## Next steps

Grouped into tracks. Within each track, items are roughly ordered. Each has an **intention** (why it
matters to the north star) and an **explanation** (what it entails / where it originates).

### Track A — Admin write surface (finish the editing story)

- **A3 · Re-parent / edit identity & carried fields**
  - *Intention:* correct structural mistakes (wrong atom, wrong media) after creation.
  - *Explanation:* the edit page deliberately excludes `slug` (identity), `parents` (re-parenting),
    and carried `media`/`source`/`content`/`tags`. Add these as a distinct, more careful slice —
    slug changes ripple to `parents` refs and the unique index; re-parenting must re-run the
    visibility cascades. *(Origin: edit-version plan.)*

- **A4 · Molecule detail view + cross-linking**
  - *Intention:* make the molecule a navigable first-class object in the admin, like the atom.
  - *Explanation:* there is no molecule detail page yet; the atom-detail view shows `molecule:` refs
    as plain text. Add `/admin/molecule/[slug]` (its atoms/versions, visibility) and cross-link from
    the atom view. *(Origin: atom-detail plan.)*

### Track B — Content richness (bilingual + media + rich text)

- **B2 · Image attach on the capture bar + media-pending UX**
  - *Handoff:* [`handoffs/2026-08-23-media.md`](handoffs/2026-08-23-media.md) — verified state of the
    upload door, the zero-`MediaImage` fact, the open zero-JS decision, and the traps this area sets.
  - *Intention:* capture images from the browser, not just links — completing the capture surface.
  - *Explanation:* wire the already-built `POST /api/upload` (Cloudinary) into the admin capture bar,
    with UX that lets a capture survive an image-upload failure ("media pending"). *(Origin: 2a, 2b-i,
    2b-ii plans.)*
  - *Status:* **shipped 2026-08-24.** The capture bar and `/admin/sprout/[slug]` both carry a media
    picker; uploads go through `uploadImageAction`; the editor's `/image` puts a picture inside an
    article. The picker is the second deliberate client-JS island (`CLAUDE.md`), bounded by a rule
    that its *absence* never costs anything — a form it merely adds to still submits, and a form
    that is only the picker goes inert rather than destructive. `updateVersion`'s "never touches
    media" guarantee was preserved by giving media its own narrow writer, so the metadata form's
    blast radius is unchanged. Also fixed a latent Cloudinary defect the slice would have triggered:
    `public_id` derived from the filename, so two same-named uploads silently replaced each other.

- **B3 · Rich content + media embed rendering (exhibition dependency)**
  - *Intention:* actually *show* the work — render `content` markdown and media embeds (SoundCloud,
    Spotify, YouTube, Vimeo, Figma…) rather than storing them as metadata.
  - *Explanation:* embeds are currently stored as URL/ID references and never rendered. When rendering
    lands, **harden embed host-matching** from substring (`host.includes("vimeo.com")`) to exact
    (`host === h || host.endsWith("." + h)`) — provider becomes a trust signal once iframed. *(Origin:
    2a deferred follow-ups; ties into public exhibition.)*
  - *Status:* the **render half** shipped 2026-08-22 (`lib/markdown.ts`, `lib/article.ts`,
    `components/markdown.tsx`, bean page + admin preview) as slice 1 of the Content & Composition
    umbrella (`docs/superpowers/specs/2026-08-22-content-composition-design.md`). Media/embed
    rendering and the host-matching hardening remain open; entity blocks are that umbrella's slice 3.
    Slice 2 (describe) followed the same day: `Bean.description`, descriptions rendered on the
    Directory and both bean pages, `description` in the `/api/graph` payload (reversing G1's
    withholding — the route already projects), and projected beans named from their envelope's title.
    Slice 3 (compose) closed the umbrella: the `::entity{ref=…}` directive, `/plant/[slug]` and
    `/pod/[slug]`, fail-closed block resolution, refs mirrored into `relations[]` on write, and a fix
    for promote silently dropping a capture's body. **The cover moved to B2** — it needs the images
    B2 creates. Media/embed rendering and the host-matching hardening are all that remain of B3.
    Slice 4 (the article door) shipped 2026-08-22: `POST /api/articles`, a guarded write door
    through which an agent or routine posts long-form content, giving `Plant.content`/`Pod.content`
    an authoring path for the first time — previously the only way to fill a container's narrative
    was editing `data/garden.yml` and running `npm run migrate`. Track A still owes an admin surface
    for *editing* a container's narrative: today, correcting a published one means re-privatizing
    the container or editing the database directly.
    **The media half closed 2026-08-24, and B3 with it.** `media[]` renders on `/bean/[id]`:
    images as images, derivable embeds as players (youtube, vimeo, soundcloud, spotify, deezer),
    with ausha, figma and Deezer shows as link cards — each because its embed contract could not be
    verified, not by oversight. Host matching hardened from substring to exact (`vimeo.com.evil.test`
    no longer detects as vimeo), and the provider is now **derived** from the URL on every write
    rather than accepted from a payload — hardening detection while trusting a declared provider
    would have locked the front door and left the side one. A `frame-src`/`object-src` CSP, the
    repo's first, is generated from the same allowlist `lib/embed-src.ts` builds URLs from, and its
    test fails loudly if a provider is added without an allowlist entry. The cover convention landed
    derived, as specced: `coverFor` scans newest-first for the first sprout carrying an image, and
    the Directory, entity cards and `/api/graph` bean nodes all consume it — reversing G1's
    withholding, which had pointed at exactly this. **D1's dependency is satisfied.**

    **Slice 5 (Tiptap) closed that on 2026-08-23** — `/admin/plant/[slug]` and `/admin/pod/[slug]`
    edit a container's narrative directly, and revising a sprout's prose no longer requires a
    re-post through `/api/articles`. Container *name/description/visibility* editing remains open
    (Track A), because flipping a container's visibility by hand is cascade-adjacent. The editor is
    the first client-JS island in the admin; `CLAUDE.md` records the scoped exception.

### Track C — Ingestion & automation

- **C1 · Connectors (GitHub / Arkaik / changelog → `POST /api/inbox`)**
  - *Intention:* feed the vault automatically from the tools where work already happens.
  - *Explanation:* external services post captures with a bearer token. Go-live hardening shipped as **C1b** (see Shipped). *(Origin: 2a deferred follow-ups.)*
  - *Status:* Plugin + fan-out kit shipped as C1c; the requirement layers (CLAUDE.md + PR template + advisory reminder) shipped as C1d so notes stop depending on a discretionary skill. Caller/requirement stubs land via per-repo issues (C1 GitHub half done when they close). Remaining: Arkaik/changelog connectors.

- **C2 · AI-assisted classification**
  - *Intention:* reduce triage friction by pre-filling the target molecule/atom/type/tags.
  - *Explanation:* populate a capture's `suggested` field via a model, surfaced as defaults in the
    triage form. *(Origin: 2b-iii / atom-detail plans.)*

### Track G — Graph playground runway (functional, pre-design)

The endgame interface is an interactive graph. Everything here is **zero-design, functional-only**
groundwork that makes the eventual graph client a pure rendering problem instead of a re-modeling
project. The model is already close: `parents[]` refs (`molecule:slug` / `atom:slug`) are a uniform
node/edge grammar, multi-parent is structurally supported, and `filterPublic` is a pure
`RawSeed → RawSeed` projection any serializer can sit behind.

- **G1 · Public graph projection endpoint (`GET /api/graph`)** — ✅ **shipped** (see the table
  above). The contract every later slice plugs into: D1 renders it, G2 enriches it, D2 returns
  refs into it, D3 caches it (one JSON blob + `revalidateTag` beats caching N HTML pages).

- **G2 · `relations[]`** — ✅ **shipped** (see the table above). Remaining follow-ups: an admin
  authoring UI for relations (A3-era editing), C2-suggested relations, kind-vocabulary curation.

- **G3 · Shared adjacency resolver (`neighbors(dataset, ref)`)**
  - *Intention:* one pure "what connects to this node" answer used by the admin (A4 molecule detail
    is the first graph-shaped view), the serializer (G1), and any future "related" panel.
  - *Explanation:* generalize instead of writing another one-off like `atomDetail`; A4 built on it
    is the serializer's dry run.

### Track D — Public exhibition

- **D1 · Artistic direction + real public design (the graph playground)**
  - *Intention:* the payoff — turn the zero-CSS public zone into the interactive graph exhibition.
  - *Explanation:* the "no CSS / no client JS until artistic direction is set" constraint is a
    deliberate hold. This is the slice that lifts it — and it consumes G1's data contract rather
    than styling the current pages. Depends on B3 (embed rendering, for what a focused node shows)
    and G1/G2 (nodes + edges worth exploring). The current semantic-HTML pages remain as the
    no-JS/SEO fallback.

- **D2 · Full-text search**
  - *Intention:* make the growing archive navigable.
  - *Explanation:* search across molecules/atoms/versions; likely Atlas Search. Results should
    return prefixed node refs (not page URLs) so they can drive graph focus. *(Origin: memory /
    cross-slice.)*

- **D3 · Public-zone caching / tag-based revalidation**
  - *Intention:* performance headroom **if traffic ever warrants** — explicitly not needed at
    personal-portfolio scale.
  - *Explanation:* the public pages are `force-dynamic` (one Mongo read per request). If needed,
    layer a tagged cache + `revalidateTag` on publish — with G1's single graph blob as the primary
    cache target. Also folds in the deferred **dataset caching**
    (`getPublicDataset`/`getFullDataset` re-query per call). *(Origin: Plan 1, 2b-iii plans.)*

---

## Appendix — Hardening & tech debt (non-blocking)

Small items surfaced in reviews, each parked against the moment it starts to matter. None blocks
current work. Full context lives in the originating plan's "Deferred follow-ups" section.

**Data integrity / safety**
- **DB-side value validation before richer writes** — `visibility`/`state` are enforced by
  TypeScript + the `$jsonSchema` validators; consider a runtime guard in `loadRawSeed` so a malformed
  value written directly to Mongo can't fail *open*. *(Plan 1)*
- **`createVersion` → `setPublic` isn't transactional** — a crash between them can leave a published
  version whose parents aren't fully public. `filterPublic` keeps it safe (just hidden); consider a
  "republish" affordance. *(2b-ii)* The mirror gap now exists on the other side:
  **`updateVersion` → `setPrivate`** can leave a shell on a crash in between — heals via a
  re-publish → un-publish cycle of that version. *(A1)*
- **Concurrent publish/un-publish compute-then-write races** — two overlapping actions on one
  lineage (either direction, incl. promote-publish vs edit-un-publish, and delete's
  `getVersion` → `deleteVersion` TOCTOU where a concurrent publish makes `wasPublished` stale) each
  load a snapshot, then write; the last `setPublic`/`setPrivate` wins and can briefly hide a
  just-published version (never leaks — `filterPublic` fails closed). Accepted at single-admin
  scale; revisit if writes ever get concurrent (sessions/transactions or a version-stamped flip).
  *(A1/A2 review)*
- **`buildVersionPatch` silently coerces an unrecognized `state` to `draft`** — pre-existing seam
  behavior; now that un-publish cascades, a malformed POST on a published version un-publishes AND
  re-privatizes its lineage instead of failing validation. Consider rejecting unrecognized values.
  *(A1 review)*
- **Read-side empty-shell pruning in `filterPublic`** — belt-and-braces for A1: also drop, at read
  time, a public atom with no published version (and a molecule with no surviving atom), making
  shells *impossible* regardless of stored visibility (crash between writes, forged write). Deferred
  because the write-side recompute keeps the vault's stored visibility truthful, which read-side
  pruning alone would not. *(A1 spec §6)*
- **Re-validate "existing" parent selections** — a forged admin POST with a nonexistent
  `moleculeSlug`/`atomSlug` is written straight into `parents` (degrades safely as a dangling ref, no
  error shown). Add an existence check. *(2b-ii)*
- **Version-layer cascade tests** — add mirrored version→atom multi-parent/dangling tests for full
  symmetry with the atom→molecule layer. *(Plan 1)*

**Admin UX**
- **Parentless versions have no browse → edit path** — triage allows promoting a version with no
  atom parent; the vault renders it as unlinked text (only atom-detail pages carry `edit` links), so
  `/admin/version/[slug]` must be typed by hand. Link vault rows straight to the edit page (or gate
  parentless promotion). *(audit)*
- **Post-save/delete redirect trusts parent refs** — the edit and delete actions land on
  `/admin/atom/<first atom parent>` without an existence check, so a hand-authored dangling parent
  ref 404s after a successful write. Harmless (admin-gated, write completed) and consistent with
  dangling-ref tolerance; fall back to the vault if it ever grates. *(A2 review)*
- **Validation bounce loses in-flight edits** — the version forms' name inputs dropped the browser
  `required` (an fr-only name is valid, so `required` on the en box would be wrong), so a fully
  cleared name now round-trips to the server, which redirects with `?error=` and re-renders from
  the stored doc — any other fields typed in that submission are lost. Bare-HTML limitation;
  address with form echo-back (or client JS post-D1). *(B1 review)*

**Auth / endpoint hygiene**
- **HMAC domain separation** — `hmacHex` is shared by session signing and password verification;
  add a `"session:"`/`"pw:"` context prefix before any user input could reach session-value creation.
  *(2b-i)*
- **`LOGIN_PATH` constant** — `"/admin/login"` literal is repeated across middleware/session/actions;
  extract a shared export as the admin zone grows. *(2b-i)*
- **Capture DB-error UX** — `createCaptureAction` propagates a Mongo failure to Next's error boundary
  instead of redirecting to `/admin?error=…` like the validation path. Make it symmetric. *(2b-i)*
- **`SlugExistsError` assumes slug is the sole unique index** — harden `isDuplicateKey` with an
  `err.keyPattern` check if a second unique index is ever added. *(2b-ii)*

**Testing**
- **Server-action / page integration tests** — promote→cascade and edit→save are covered by pure
  unit tests + manual smoke; add HTTP-level tests when a server-action test harness exists. *(2b-ii,
  edit-version)*

**Docs**
- Keep this roadmap and the per-plan "Deferred" sections in sync as slices ship.

---

## Recommended next

With A2, G1, B1, G2, **B2 and B3** shipped, **D1 — the graph playground — is unblocked.** Every
public node now carries name, description and (for beans) a cover, which is what a focused node
needs to show; G1's contract and G2's edges have been live and waiting.

Two observations from building the media slice are D1's to resolve, recorded in
[`specs/2026-08-23-media-design.md`](specs/2026-08-23-media-design.md) §5.4 rather than left to be
rediscovered: media can land far from the prose it belongs to (the article comes from the first
sprout *carrying content* while cards render strictly newest-first), and a sprout card now reads as
a spec sheet capped with photographs — muted key/value traceability rows beside images meant to be
looked at. Neither is broken; both are exactly what an exhibition slice exists to fix.

A4/G3 (molecule detail on a shared `neighbors()` resolver) and a relations authoring UI remain good
parallel fillers.
