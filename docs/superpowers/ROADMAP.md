# Beanstalk — Roadmap

**Last updated:** 2026-07-14

This is the single, browsable view of where Beanstalk is and what's next. It **aggregates** the
"Deferred to later specs / follow-ups" sections that live at the bottom of each plan in
`docs/superpowers/plans/`. Those per-plan sections remain the authoritative source; this file rolls
them up, adds the *why*, and orders them. When a slice ships, move its item to **Shipped** and prune
the corresponding per-plan note if it's fully covered.

---

## North star (intention)

Beanstalk is a personal **"central node"**: a place that showcases all of Alexis's creative and
professional work on an **atomic content model** — `Molecule → Atom → Version`. An atom is any unit
of work (a song, a product feature, a podcast episode, a post); atoms **evolve** through versions
(demo → studio → live; POC → MVP → V2). The portfolio tells the story of *evolution*, not just the
final state.

The system is **archive-first and private by default**: everything lives in a private vault, and a
**curated `published` subset** is projected to a public exhibition zone. The security-sensitive rule
— only `state === "published"` versions (and their non-private lineage) ever reach the public — is
enforced by the pure `filterPublic` projection, which every public read passes through.

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
| **A1 — Recompute visibility on un-publish** | — | Pure `unpublishCascade` (the downward inverse of `publishCascade`) + `setPrivate`, wired into `editVersionAction`: un-publishing the last published version re-privatizes its atom (and an emptied molecule) — withdrawn work leaves no public shell. Idempotent + self-healing. |

The admin loop is complete end to end: **capture → triage → publish → browse → edit / un-publish**,
and the public projection is now consistent in **both directions** (publish lifts a lineage up,
un-publish walks it back down).

---

## Next steps

Grouped into tracks. Within each track, items are roughly ordered. Each has an **intention** (why it
matters to the north star) and an **explanation** (what it entails / where it originates).

### Track A — Admin write surface (finish the editing story)

- **A2 · Delete a Version**
  - *Intention:* let the admin remove a version entirely, not just soft-hide it via state.
  - *Explanation:* hard-delete from `versions`, then reuse the now-existing `unpublishCascade` on
    the deleted version's lineage (evaluated against a dataset with the version removed) so a delete
    that empties a public parent re-privatizes it. Complements the edit page. *(Origin: edit-version
    plan; visibility story shipped with A1.)*

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

- **B1 · `name` / `description` `string → Text` widening**
  - *Intention:* first-class **bilingual (en/fr)** content — a recurring requirement deferred since
    Plan 2a.
  - *Explanation:* widen the atomic model's `name`/`description` from `string` to the existing
    `Text` type (`string | { en?, fr? }`) at write time, and render via the existing `resolveText`
    on public pages. Touches the model, the triage/edit forms, and public rendering. *(Origin:
    referenced in 2a, 2b-i, 2b-ii, 2b-iii plans.)*

- **B2 · Image attach on the capture bar + media-pending UX**
  - *Intention:* capture images from the browser, not just links — completing the capture surface.
  - *Explanation:* wire the already-built `POST /api/upload` (Cloudinary) into the admin capture bar,
    with UX that lets a capture survive an image-upload failure ("media pending"). *(Origin: 2a, 2b-i,
    2b-ii plans.)*

- **B3 · Rich content + media embed rendering (exhibition dependency)**
  - *Intention:* actually *show* the work — render `content` markdown and media embeds (SoundCloud,
    Spotify, YouTube, Vimeo, Figma…) rather than storing them as metadata.
  - *Explanation:* embeds are currently stored as URL/ID references and never rendered. When rendering
    lands, **harden embed host-matching** from substring (`host.includes("vimeo.com")`) to exact
    (`host === h || host.endsWith("." + h)`) — provider becomes a trust signal once iframed. *(Origin:
    2a deferred follow-ups; ties into public exhibition.)*

### Track C — Ingestion & automation

- **C1 · Connectors (GitHub / Arkaik / changelog → `POST /api/inbox`)**
  - *Intention:* feed the vault automatically from the tools where work already happens.
  - *Explanation:* external services post captures with a bearer token. Going live here triggers two
    already-scoped hardening items: a `catch(E11000) → retry as updateOne` for the **concurrent
    double-upsert race**, and endpoint hardening for untrusted exposure (constant-time token compare,
    max-body-size guard before `request.json()`). *(Origin: 2a deferred follow-ups.)*

- **C2 · AI-assisted classification**
  - *Intention:* reduce triage friction by pre-filling the target molecule/atom/type/tags.
  - *Explanation:* populate a capture's `suggested` field via a model, surfaced as defaults in the
    triage form. *(Origin: 2b-iii / atom-detail plans.)*

### Track D — Public exhibition

- **D1 · Artistic direction + real public design**
  - *Intention:* the payoff — turn the zero-CSS public zone into an actual exhibition.
  - *Explanation:* the "no CSS until artistic direction is set" constraint is a deliberate hold. This
    is the slice that lifts it (design system, layout, motion) and depends on B3 (embed rendering).

- **D2 · Full-text search**
  - *Intention:* make the growing archive navigable.
  - *Explanation:* search across molecules/atoms/versions; likely Atlas Search. *(Origin: memory /
    cross-slice.)*

- **D3 · Public-zone caching / tag-based revalidation**
  - *Intention:* performance headroom **if traffic ever warrants** — explicitly not needed at
    personal-portfolio scale.
  - *Explanation:* the public pages are `force-dynamic` (one Mongo read per request). If needed,
    layer a tagged cache + `revalidateTag` on publish. Also folds in the deferred **dataset caching**
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
  **`updateVersion` → `setPrivate`** can leave a shell on a crash in between — self-heals on the next
  non-published save in that lineage. *(A1)*
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

**A2 — Delete a Version**, now that A1 handed it its visibility story for free (`unpublishCascade`
on the deleted version's lineage). It completes the admin write surface's destructive half. Then
**B1 (`Text` widening)** and **B2 (image attach)** are the natural follow-ons toward the
public-exhibition payoff, with **B3 (embed rendering)** as the gate to D1.
