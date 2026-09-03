# Act 3 — Community & Trust: how a private journal grew a public face

**Factual digest. Not publishable prose.** Every claim carries its source. Where the
sources say nothing, the entry reads NOT FOUND.

Source repo: `/Users/alexis/code/pbbls` (read-only). Window: 2026-07-28 → 2026-09-02,
with April 2026 material pulled in only where it is contradicted.

---

## 1. Timeline

| Date | Event | Source |
|---|---|---|
| 2026-04-03/04 | Onboarding ships with the anti-engagement promise: *"No streak to protect, no feed to scroll. Just a calm ritual that grows with you."* | commit `d0b50eaf` (2026-04-04, PR #100), `lib/config/onboarding-steps.ts:21`; journal `V-onboarding-ritual` created 2026-04-03T22:41:16Z |
| 2026-04-09 | Close of the local-first web prototype — "a Next.js PWA with everything held in the browser… local accounts… **offline install, karma and the bounce streak**" | `docs/arkaik/journal.jsonl:264` (`release.tagged`, `web-prototype`) |
| 2026-04-10 | Terms §9.1 "Engagement Tools, Not Contractual Obligations"; Bounce/Karma defined as regularity measurement "**without constituting a 'streak' or contractual obligation**" | `apps/web/docs/terms/en.md:53,272-274`; present since commit `6126af27` (monorepo migration #222) |
| 2026-04-11 | Local-first data layer designed: localStorage primary, Supabase background sync, offline-created rows pushed on mount | `docs/superpowers/specs/2026-04-11-supabase-provider-design.md` |
| 2026-04-11 | Same day, reversed: "Supabase is the source of truth. **No localStorage cache for data.**" Out of scope: "**Full local-first/offline support (deferred)**" | `docs/superpowers/specs/2026-04-11-auth-data-layer-redesign.md:24-26,156` |
| 2026-07-28 | Store-launch roadmap. Maintainer product decision #4: "Connection discovery — invite link / QR only. **No search, no directory, no follower graphs.**" All ten vision points gate v1.0. | `docs/superpowers/specs/2026-07-28-store-launch-roadmap.md:10` and header |
| 2026-07-29 | Decision: Postgres views are `security_invoker` by default (#616). Live probe with anon key had returned **182 pebbles across 20 users** through `v_pebbles_full`. | `docs/decisions/log.md:272-281` |
| 2026-07-29 | Decision: **Offline is a non-goal on every surface** (#620) | `docs/decisions/log.md:283-292` |
| 2026-07-29 | Decision: account deletion anonymizes externally-referenced glyphs to `user_id = null` (#631) | `docs/decisions/log.md:294-303`; `docs/superpowers/specs/2026-07-29-account-deletion-design.md` |
| 2026-07-29 | Decision: drafts get a separate jsonb table, never a status column on `pebbles`; local autosave is insurance only (#639) | `docs/decisions/log.md:305-314`; drafts design doc |
| 2026-07-29 06:05 | Shipped: "Only you can read your path" — the `v_pebbles_full` leak sealed | journal, PR #624 |
| 2026-07-29 06:41 | Shipped: "Your consent is on the record" — `handle_new_user()` persists consent timestamps; existing accounts backfilled | journal, PR #628; migration `20260729120000_handle_new_user_consent.sql` |
| 2026-07-29 19:48–19:50 | Shipped: account deletion in Settings on web (#634), iOS (#636), Android (#638) — "glyphs other pebblers bought stay with them, without your name" | journal |
| 2026-07-29 22:00–22:50 | Shipped: drafts + local autosave, web (#644) / iOS (#645) / Android (#646) | journal |
| 2026-07-30 | Decision: achievements = client-called idempotent RPC, permanent badges, karma via `grant` at unlock (#664) | `docs/decisions/log.md:327-336` |
| 2026-07-30 | Decision: cross-user reads are definer-RPC projections; `profiles` RLS is never widened (#654) | `docs/decisions/log.md:338-347` |
| 2026-07-30 | Decision: handle policy — lowercase 3–30 `[a-z0-9_]`, trigger-enforced reserved list, freed on deletion, no history (#654) | `docs/decisions/log.md:349-358` |
| 2026-07-30 | Decision: connections — single-row symmetric, invite/QR only, no search, blocks from day one (#658) | `docs/decisions/log.md:360-369` |
| 2026-07-30 07:29 | Shipped: public-profiles backend (#675) — handles + `get_public_profile` | journal |
| 2026-07-30 07:58 → 13:02 | Shipped: achievements web (#676), iOS (#679), Android (#681); admin library (13:21) | journal |
| 2026-07-30 12:38–12:50 | Shipped: "Share your pebbles with a link" — public profile page, web (#677), iOS (#678), Android (#680) | journal |
| 2026-07-30 13:30–13:54 | Shipped: rewarding unlock moment + profile badge shelf ×3 (#684/#685/#686) | journal |
| 2026-07-30 22:28 | Shipped: "Bring your people in" — connections, invites, QR, blocks (#662) | journal |
| 2026-07-31 | Decision: two migrations re-emitting one function off the same base silently drop each other's appends (#687) — purge-function hazard | `docs/decisions/log.md:371-380` |
| 2026-08-17 | Decision: **privacy grades** — backfill to `secret`, `private` reinterpreted as connections-visible, shares expose the row + `render_svg` only (#708) | `docs/decisions/log.md:382-391`; migration `20260817130000_pebble_visibility_grades.sql` |
| 2026-08-17 07:55 → 11:20 | Shipped: grade selectors, `/p/[id]` share page, connection shared-pebbles page across web → iOS → Android | journal; `docs/superpowers/specs/2026-08-17-m51-client-ui-design.md` |
| 2026-09-02 | Decision: **privileged profile columns are pinned by trigger** — "owning a row is not authority to raise capability in it" (#739) | `docs/decisions/log.md:459-468`; migration `20260902090000_profiles_privileged_guard.sql` |
| 2026-09-02 | Decision: the four anon contract harnesses become a CI gate; the purge harness stays manual (service-role key out of a public repo) (#741) | `docs/decisions/log.md:470-479` |
| 2026-09-02 | Decision: nightly harness run logs a result table and reuses one tracking issue (#743) | `docs/decisions/log.md:481-489` |

---

## 2. Privacy grades (2026-08-17, #708)

**Source:** `docs/decisions/log.md:382-391`; migration
`packages/supabase/supabase/migrations/20260817130000_pebble_visibility_grades.sql`;
`docs/superpowers/specs/2026-08-17-m51-client-ui-design.md`.

**The three grades** are pinned by a CHECK: `secret | private | public`
(migration §2, lines 43-48).

- `secret` — owner-only. The new grade, and the new column default.
- `private` — **visible to mutual connections** (M49). This is a *reinterpretation*,
  not a new value.
- `public` — readable by any authenticated user, plus anonymous reach-by-link.

**What `private` meant before.** The column `pebbles.visibility` had existed since the
first schema (`20260411000001_core_tables.sql:59`) as `text not null default 'private'`
with **no CHECK constraint and no RLS policy reading it** — the roadmap calls it
"decorative" (`2026-07-28-store-launch-roadmap.md:16`). It was threaded through
`create_pebble` / `update_pebble` / `v_pebbles_full` and a UI badge, and it meant
"owner-only" only because nothing else could read anything. Once connections existed,
`private` acquired a meaning its owners had never chosen under it.

**Hence the backfill.** Every pre-existing pebble is rewritten to `secret`, with the
`pebbles_updated_at` trigger disabled around the sweep — "a privacy re-grade is not a
user edit, and bumping `updated_at` on every row would scramble client sync heuristics"
(migration §1, lines 25-36). Decision-log rationale: "Letting pre-activation pebbles
become connection-visible the day the grade activates would be a silent privacy
regression — the backfill makes sharing strictly **opt-in per pebble**."

**The read policy** (migration §3):

```sql
create policy "pebbles_select" on public.pebbles
  for select to authenticated using (
    user_id = auth.uid()
    or visibility = 'public'
    or (visibility = 'private' and exists (
          select 1 from public.connections c
           where c.user_a = least(auth.uid(), pebbles.user_id)
             and c.user_b = greatest(auth.uid(), pebbles.user_id)))
  );
revoke all on public.pebbles from anon;
```

Writes stay owner-only. `to authenticated` is deliberate: "the anon road to a public
pebble is `get_shared_pebble` below, **never the table** — a table read with the
publishable key would make public pebbles listable as a directory, while the share link
is meant to be reach-by-uuid only."

**What a share link exposes — exactly.** `get_shared_pebble(p_pebble_id uuid)`,
`security definer`, `stable`, `set search_path = public`, granted to `anon, authenticated`,
returns null unless the row exists **and** `visibility = 'public'`. Projected keys
(migration lines 99-131):

`id`, `name`, `description`, `happened_at` (whole-second UTC), `intensity`,
`positiveness`, `render_svg`, and an `emotion` object (`id`, `slug`, `name`, `color`,
`primary_color`, `secondary_color`).

Deliberately excluded, per the migration's own comment: `user_id` ("no cross-user
identifier leaks, standing rule"), `glyph_id` and raw glyph geometry (`render_svg`
already carries the visual), `visibility` (constant by construction), `created_at` /
`updated_at`, and **all enrichments** — cards, souls, snaps, domains. Snaps are excluded
from public shares in v1.

Two structural notes:
- **Enrichment tables keep owner-only RLS deliberately**, so `v_pebbles_full` returns
  empty enrichment arrays to non-owners via `security_invoker` (decision log). A shared
  pebble is the `pebbles` row plus the baked SVG and nothing else.
- **The uuid is the capability.** "122 unguessable bits; revocation = flip the grade
  back; **no token table in v1**" (migration comment). The web UI makes this literal:
  flipping a public pebble back "kills its `/p/[id]` link (the page 404s)"
  (`2026-08-17-m51-client-ui-design.md` D3).
- Reusing `render_svg` as the cross-user visual "sidesteps cross-user glyph/snap RLS
  entirely" (decision log, Why).

**The accepted defect.** Until each client shipped a three-state selector, "a client that
still sends `visibility: 'private'` explicitly creates a **connections-visible** pebble
its user believes is owner-only" — web was fixed in #708; iOS and Android had to flip
before their next release to connected users (decision log, Consequences). Fixed by
#713/#714 (native `secret` case + default) per the M51 client-UI doc's Depends-on line.

**Contract harness:** `packages/supabase/scripts/verify-pebble-visibility.ts` covers the
whole matrix — owner / connection / stranger / anon × three grades.

**User-facing labels:** Secret / Connections / Public (FR: Secret / Connexions / Public).
`private`'s user-facing label is "Connections" on every surface; "the wire strings never
change" (M51 client-UI doc, D7).

---

## 3. Connections (2026-07-30, #658)

**Source:** `docs/decisions/log.md:360-369`;
`docs/superpowers/specs/2026-07-29-mutual-connections-design.md`;
roadmap `:10`, `§M49`.

### Why single-row symmetric

`connections (id uuid pk, user_a uuid, user_b uuid, check (user_a < user_b),
unique (user_a, user_b), created_at)` — **no status column**. "Accepting the invite *is*
the mutual consent, and the invite table is the pending state" (decision log; roadmap `:87`).

Two alternatives, both rejected in D1:
1. **Two mirrored rows** — "row-count invariants, `get_connections` and purge all become
   double-entry bookkeeping; the ordered pair plus `on conflict do nothing` gives
   structural idempotency for free."
2. **A `status` text on invites** — "`revoked_at`/`expires_at` timestamps carry strictly
   more information (when, not just what), and expiry is evaluated at read time
   everywhere, so a status column could only drift."

The idempotency is not academic: "The multi-use QR at the dinner table makes re-scans,
double-taps and network retries the *normal* case" (D5). `accept_connection_invite`
therefore **succeeds** with `already_connected: true` rather than erroring.

### Why invite/QR only, and explicitly NO search

The prohibition is a maintainer product decision dated 2026-07-28, one of four listed
before any code: **"Connection discovery — invite link / QR only. No search, no
directory, no follower graphs. Symmetric connections only: accepting an invite *is* the
mutual consent."** (`2026-07-28-store-launch-roadmap.md:10`; restated as decision-log
line item at `:169`.)

Supporting architecture rather than separate rationale:
- `profiles_select` has been owner-only since `20260411000001_core_tables.sql:154`.
  Widening it "with a 'display columns only' policy" is "**banned outright**"
  (connections D4, rejected alternative 3).
- Everything cross-user goes through definer-RPC projections returning
  `display_name` + glyph `strokes`/`view_box` — "never a `profiles` row" (roadmap `:89`).
- The token is 32 random bytes, base64url, 43 URL-safe chars, 256 bits. "Nothing is
  enumerable against 2^256 tokens" (D4).

### What the design refuses to become

Directly stated: no search, no directory, **no follower graphs** (roadmap `:10`).
Adjacent refusals from the same design:
- **No asymmetry.** "A block means one party wants no relation… an asymmetry with no
  product meaning in a symmetric-connections model" (D5).
- **No engagement economy on the social graph.** "Connections emit zero karma,
  **structurally**" — `karma_events_reason_check` has no reason for it, so an accidental
  insert violates the CHECK. "Social-graph mechanics must not be karma-farmable (a
  connect/disconnect loop would otherwise be a mint)" (D9).
- **No notifications.** "No push, no realtime: accepted connections surface on next app
  open" (decision log; roadmap `:28,:91`).
- **No implicit consent.** On the sign-up-first funnel, the pending token routes the user
  back to `/invite/<token>` for "an **explicit accept tap** — accept is never fired
  implicitly on sign-up. Consent must be a deliberate act" (D12).

### Why blocks from day one

Three reasons, stacked:
1. **Store review.** "Apple's UGC guidelines require blocking at launch" (decision log
   Context); the roadmap makes UGC review requirements a launch-gate consequence
   (`:8`, decision 3).
2. **Retroactive defence of a live invite.** Blocking "retroactively defends the still-live
   invite with zero invite mutation… the blocked peer scanning the remover's live QR gets
   `invite_expired` while third parties keep using the same invite. This is a deliberate
   property, not an accident" (D6).
3. **Either-direction check, indistinguishable error.** The accept-time block probe runs
   both ways and raises `invite_expired`, "deliberately indistinguishable from real expiry
   so **a block is never revealed to either party**" (D5). RLS on `connection_blocks` is
   `blocker_id = auth.uid()` only — "the blocked user must never learn of the row" (D8).

Block direction is fixed: **the remover blocks the removed**. Rejected: symmetric
double-row blocks; auto-revoking the remover's invite on block ("punishes the other N
dinner guests for one bad actor") (D6).

**Recorded residual risk:** block *management* UI is deferred to M56, so "until then an
accidental block is recoverable only by a service-role row delete" (decision log
Consequences; D6).

**Other structural points.** Five definer RPCs; a fifth, `preview_connection_invite`,
granted to `anon` so the `/invite/[token]` page can render "who invites you" before an
account exists — "the preview reveals exactly what the accepter would learn seconds
after accepting" (D4). One canonical URL, `https://www.pbbls.app/invite/<token>`, via
universal/App Links, **no custom scheme**: "the https URL is its own fallback (a
not-installed user lands on the working web accept page, where a custom scheme
browser-errors)" (D11). RLS is SELECT-only on all three tables; every write lives inside
a definer RPC (D8).

---

## 4. Handle policy (2026-07-30, #654)

**Source:** `docs/decisions/log.md:349-358`;
`docs/superpowers/specs/2026-07-29-public-profiles-design.md` D1–D3, D8;
migration `20260730120000_public_profiles.sql`.

### The exact rules

- Stored **normalized (lowercase)**; display is verbatim; input is `lower(trim(...))`.
- **3–30 characters** of `[a-z0-9_]`, starting and ending alphanumeric. Enforced by a
  CHECK constraint with the regex `'^[a-z0-9][a-z0-9_]{1,28}[a-z0-9]$'` (D1).
- `public_profile = true` **requires** a handle — a second CHECK,
  `profiles_public_requires_handle`, which "makes 'public but unreachable' (no handle →
  no URL) unrepresentable, so no surface needs to special-case it" (D1).
- Uniqueness and the claim race are settled by a **unique index**
  (`profiles_handle_key`): "two concurrent `set_handle('same')` calls resolve to one
  winner and one `unique_violation`, no advisory locking" (D1).
- The reserved list lives in `public.reserved_handles` (single-column PK table),
  `select using (true)`, insert/delete gated on `public.is_admin(auth.uid())` — so it is
  **admin-extensible without a migration** (D2).
- `set_handle(p_handle)` is the sanctioned path — `security invoker`, granted to
  `authenticated` only — and maps failures to three stable codes:
  `invalid_handle` / `handle_reserved` / `handle_taken` (D3).
- `set_handle(null)` **releases** the handle and sets `public_profile = false` in the same
  statement (otherwise the CHECK would reject the orphaned public flag) (D3).
- `public_profile` itself is a direct single-column client update, not an RPC (D3).

**Seeded reserved groups** (D2): every top-level web route current and specced —
`path, record, pebble, drafts, collections, souls, glyphs, carve, wallet, lab, docs,
profile, settings, offline, login, register, onboarding, auth, sw, u, p, invite`;
infra/brand — `admin, api, www, app, pebbles, pbbls, root, system, official, store`;
impersonation/abuse-prone — `support, help, about, contact, legal, terms, privacy,
security, status, team, staff, mod, moderator, null, undefined`.

### Why reserved names are trigger-enforced

Because the direct-write path exists. Decision-log Context, stated flatly: **"`profiles_update`
RLS lets owners write columns directly, so RPC-side validation alone is bypassable."**
D1 restates it: "**Invariants live in CHECK constraints, not only in the RPC**… a client
`.update({ handle: "Bad Handle!" })` must fail structurally, not by convention."

A table-local CHECK cannot do the reserved list, because that needs a **cross-table
lookup**. So: a `before insert or update of handle` trigger with a *security-definer*
trigger function, "so it reads `reserved_handles` regardless of caller", raising
`handle_reserved` (D2). Decision-log Why: "Structural constraints make invalid states
unrepresentable instead of policed by convention; the trigger closes the direct-write
hole a table-local CHECK cannot."

Trigger precedents cited: `handle_new_user`, `apply_karma_event_to_bounce`.

### Why handles are freed on deletion, with no history

- Mechanically free: `purge_account` already deletes the `profiles` row
  (`20260729201326_account_deletion_purge.sql:140`), which frees the handle. **M50 needed
  no purge extension at all** — D8 records this as "a conscious no-op, not an omission,"
  and adds one cheap harness assertion (after purge, the handle resolves null via
  `get_public_profile`, and is re-claimable).
- Product reason for no history: "**A released or purged handle is immediately claimable
  by others: no handle history, no redirects — public share links simply break.**"
  Rationale: "No-history is deliberate product simplicity — **a handle is a pointer, not
  an archive**" (decision log).
- **Accepted risk, named:** "Impersonation risk from handle recycling is accepted at this
  scale and mitigated by the reserved list; revisit if abuse appears (M56 adds
  reporting)" (decision log Consequences).

---

## 5. Achievements / badges (2026-07-30, #664)

**Source:** `docs/decisions/log.md:327-336`;
`docs/superpowers/specs/2026-07-29-achievements-design.md` D1–D15.

### Why a client-called idempotent RPC

`check_achievements() returns table (slug text, karma_granted integer)` —
`security definer`, granted to `authenticated` only. One stats CTE computes each family's
count once; a single `insert … select … on conflict do nothing` against the
`achievement_unlocks` PK `(user_id, achievement_id)` records new unlocks.

The three alternatives, each rejected on a concrete obstruction (D4):
1. **No triggers.** "The eight badge families span six tables (`pebbles`, `pebble_domains`,
   `collections`, `souls`, `glyphs`, `glyph_entitlements`). Triggers there would fire
   during admin operations (`admin_attribute_glyph`), backfills, and `purge_account` — and
   web glyph carving is a direct client insert with no RPC seam anyway."
2. **No cron.** "The repo has no scheduled-job infrastructure and no realtime; the
   screen-open call already covers everything a nightly sweep would."
3. **`create_pebble` untouched.** "Its `returns uuid` is a three-surface wire contract;
   piggybacking unlock data on it would churn all three clients for one of eight families."

The idempotency does double duty: "The unlocks PK makes both the unlock and its karma
exactly-once with zero bookkeeping — a re-run inserts nothing so it pays nothing, which
also makes **failed fire-and-forget calls self-healing**" (decision log Why). And
"**the screen-open call *is* the retroactive grant**": the stats CTE counts live rows, so
a veteran's first visit unlocks everything already earned in one call. "No backfill job
exists or is needed" (D5).

### Why permanent

`achievement_unlocks` has owner-only SELECT and **no insert/update/delete policies at
all** — the `wallet_balances` precedent. "A client structurally cannot mint, edit or
revoke a badge. Badges are permanent (decision, roadmap §5 item 5): deleting pebbles,
glyphs or a buyer's account never removes an unlock, and **there is deliberately no
revocation path to forget about**" (D3).

This is what makes count regression harmless: "Counts may regress — pebble deletion, a
buyer's account purge deleting their entitlements, glyph deletion. Permanence makes that
harmless: the unlock survives, and re-crossing a threshold inserts nothing because the row
already exists" (D6). Retirement is `is_active = false`, never a delete (D12); the only
true delete, `admin_delete_achievement`, "refuses unless the badge has zero unlocks."

### How karma is granted at unlock

Inside the same transaction as the unlock, one `karma_events` row per newly unlocked badge
with `karma_reward > 0`:
`reason = 'grant'` (reserved since `20260629192621` and **emitted nowhere else**),
`type = 'credit'`, `delta = karma_reward` read at unlock time, `ref_id = achievement_id` (D9).

Consequences pinned down in D9:
- Wallet and bounce snapshots fold the grant automatically (both are `after insert`
  triggers on `karma_events`; `grant` is credit-type), so achievement karma is spendable
  **and raises the bounce level**.
- "`karma_reward` is read at unlock time only. An admin edit **never re-emits and never
  retro-pays**."
- The RPC returns what was actually emitted, not the catalog's current value, "so the
  rewarding screen can never display a number the ledger doesn't hold" (D4).
- Default is 0: "Karma default 0 ships the *rail* without changing the economy:
  'cosmetic' is just the default value, and the maintainer prices badges in the admin
  later" (decision log Why). This **supersedes** the roadmap §5 item 5 "achievement karma
  deferred" stance (decision log, Supersedes).

### Does this collide with the April 2026 anti-streak / anti-dark-pattern stance?

**Yes — see REVERSALS §R2 below.** Nothing in the achievements decision entry or design
doc names, cites, or argues against the April stance. **NOT FOUND:** an explicit
reconciliation, an acknowledgement of the onboarding promise, or a decision-log
"Supersedes" pointing at it.

The nearest things the sources *do* say, quoted:

- The design doc names its influences without hedging: three maintainer-requested
  satellites include "a **Duolingo-style** profile showcase" (header) and "a
  **Duolingo-style** celebration" (D13). The section title for D14 is literally
  "Satellite: profile showcase (**the Duolingo shelf**)".
- Restraint is expressed only about *volume*, not about the mechanic:
  > "**Retro grants don't celebrate.** The screen-open call can return a veteran's entire
  > history at once; chaining twenty cards would be punishing. Mutation-path calls fire
  > the moment; the screen-open call renders its results directly in the grid (a subtle
  > 'new' state at most). Dismissal is never blocking — tap-outside/back skips the
  > remaining queue." (D13)
  Encoded as an acceptance criterion: *"Given opening the Achievements screen retroactively
  grants me a whole history of badges at once, When the check completes, Then nothing is
  celebrated and the badges simply appear in the grid."* (`docs/arkaik/bundle.json`)
- "**No per-badge progress bars in v1** — unlocked/locked and `sort_order` only" (D8, D14).
- The only anti-farming argument anywhere in the batch is applied to *connections*, not
  badges: "Social-graph mechanics must not be karma-farmable" (connections D9).
- The standing legal position, unchanged since April: "**Bounce / Karma**: An engagement
  system measuring the regularity of visits and interactions with Pebbles, **without
  constituting a 'streak' or contractual obligation**" and §9.1 "Engagement Tools, Not
  Contractual Obligations… Bounce, Karma, Cairns, and Achievements are optional tools to
  encourage regular engagement with Pebbles. They do not constitute contractual
  obligations, vested rights, or guarantees." (`apps/web/docs/terms/en.md:53,272-274`).
  Note that this clause **already lists Achievements** — i.e. the legal register
  anticipated the feature.

---

## 6. Account deletion (2026-07-29, #631)

**Source:** `docs/decisions/log.md:294-303`;
`docs/superpowers/specs/2026-07-29-account-deletion-design.md`;
migration `20260729201326_account_deletion_purge.sql`; edge function
`packages/supabase/supabase/functions/delete-account/index.ts`; harness
`packages/supabase/scripts/verify-account-purge.ts`.

### What happens to glyphs someone else bought

They **survive, de-named**. A glyph of the deleting user is **anonymized** — `user_id`
set to `null` — rather than deleted, if it is *externally referenced*. The implemented
predicate is deliberately **wider than the roadmap's "sold"** (D1):

- entitlements held by **other** users (= sold), or
- **other** users' souls (`souls.glyph_id` is `ON DELETE RESTRICT`), or
- **other** users' pebbles (`pebbles.glyph_id`, NO ACTION), or
- **other** users' profiles (`profiles.glyph_id`, SET NULL — "included so a counterparty's
  avatar doesn't silently vanish"), or
- a `domains.default_glyph_id` (NO ACTION).

Everything else is deleted. The reason for the wider predicate: "`admin_attribute_glyph`
can hand a formerly-system glyph… to a user while other users' souls already reference
it. A sold-only predicate then **hard-fails on the RESTRICT FK and the purge never
converges**" (D1). Decision log restates it: "The predicate is deliberately wider than the
roadmap's 'sold' so the purge converges under every FK the schema actually has, not just
the marketplace one."

The user-facing promise, fixed in the client contract: confirm copy "must say: permanent,
everything is deleted, **glyphs other pebblers bought stay available to them without the
user's name**, cannot be undone" (D6). Shipped copy on all three surfaces: "glyphs other
pebblers bought stay with them, without your name" (journal, PRs #634/#636/#638).

### The `user_id = null` system state, and why anonymization beats deletion

`user_id = null` is **not a new state** — it is the pre-existing *system-glyph* state.
"`can_use_glyph()` and the `glyphs_select` policy already treat it as usable-by-all — so
**buyers' entitlements keep rendering with no schema change**" (D1). Decision log: "so
buyers keep rendering with **zero schema surface added**."

Deletion is the losing option three times over:
1. Cascade would **revoke paid-for content** — buyers hold `glyph_entitlements` on the
   seller's glyphs (decision-log Context).
2. `souls.glyph_id` is `ON DELETE RESTRICT`, so the delete would **hard-fail** and the
   account could never be closed — which is a store hard blocker (Play policy + Apple
   5.1.1(v)).
3. `glyph_submissions.submitter_id` was `NOT NULL`, so keeping the approved audit trail
   would **block `auth.admin.deleteUser`**. It was made nullable, and submissions are
   detached rather than deleted (D4).

**The delist coupling.** An anonymized glyph is also set `listed = false` **in the same
transaction**, because `buy_glyph` skips the payout when the owner is null — otherwise
"the anonymized glyph [would] sell for nothing" (decision log; D1). Delisting runs *before*
the `submitter_id` detach, because the delist filters on `submitter_id` (D4).

**Accepted consequence, recorded:** "Anonymized glyphs become **de-facto commons**
(usable by all) — accepted."

**Ledger semantics:** personal ledger rows are deleted; "net-zero transfers survive in
counterparties' rows" (decision log).

**Orchestration** (D2): `purge_account` → empty storage prefix
`pebbles-media/{user_id}/` → `auth.admin.deleteUser`, in that order, idempotent and
resumable. "The auth row goes **last**, because the auth row is the caller's ability to
retry." Every failure point converges on re-run; after step 3 the gateway returns 401 =
converged.

**Standing rule born here (M46):** every later milestone appends its new user-owned tables
to the numbered sections of `purge_account` (marker in section 4) **and** to the seed +
assertions of `verify-account-purge.ts` — "the script is the regression harness for this
rule" (D5). Drafts, unlocks, connections, invites and blocks all cite it. Two of the
connections deletes are two-sided (`p_user_id in (user_a, user_b)` /
`(blocker_id, blocked_id)`) — "do not 'simplify' them to a single column."

**Verification on record:** the 2026-07-29 run passed **33/33** — "all seller rows gone
across 14 tables + 4 cascade tables, sold glyph anonymized with strokes intact, submission
approved/delisted/detached, buyer entitlement + favourite survive, unsold glyph deleted,
storage prefix empty, auth user gone, `purge_account` re-run all-zero, buyer deleted
through the same path" (D7).

**Accepted race, recorded:** "a `buy_glyph` committing inside the millisecond window
between the kept-set computation and the glyph delete can leave a seller `glyph_sale`
event that blocks `deleteUser`; the re-run converges" (D8).

**Later hazard on this function:** 2026-07-31 (#687) — "Two migrations re-emitting one
function off the same base silently drop each other's appends"
(`docs/decisions/log.md:371-380`; migration `20260731090000_purge_account_union.sql`).

---

## 7. Drafts (2026-07-29, #639)

**Source:** `docs/decisions/log.md:305-314`;
`docs/superpowers/specs/2026-07-29-drafts-and-autosave-design.md` D1–D14;
migration `20260729213348_pebble_drafts.sql`.

### Why a separate jsonb table and never a status column on `pebbles`

`public.pebble_drafts` — `id`, `user_id`, `payload jsonb`, `created_at`, `updated_at`.
Owner-only via a single `for all` policy; written by direct single-table client calls,
**no RPC** (D8). The list surface reads `payload->>'name'` and `payload->>'emotion_id'`
directly — "no generated or denormalized columns" (D1).

Six reasons the status-column alternative was rejected (D1, condensed in the decision log):

1. `pebbles` has **five NOT NULL semantic columns** a draft may all lack — `name`,
   `happened_at`, `intensity`, `positiveness`, `emotion_id` — "All five NOT NULLs would
   need relaxing, **weakening the constraint for every real pebble**."
2. "Every view and analytics migration would need a forever `status <> 'draft'` filter,
   and forgetting one **silently leaks drafts into ripple, bounce, week groups and the KPI
   views**."
3. Karma: "`create_pebble` is the schema's **only** `pebble_created` emitter and it always
   emits, so any insert-a-draft-row path would have to grow a karma exception." Keeping
   drafts off that path "makes zero karma **structural** rather than a special case."
4. "`update_pebble` is coalesce-based and **cannot null a scalar**… Editing a draft down
   to fewer fields would be impossible; a wholesale jsonb replace is trivial."
5. "No `render_svg` exists pre-publish, so a draft row would sit in `pebbles` with a null
   render that every read path has to special-case."
6. "Autosave wants exactly the same partial payload, so one shape serves both."

The payload is a **partial `compose-pebble` wire payload** with unset keys omitted — the
same shape on all three surfaces, "so publishing is a pass-through: `compose-pebble` once,
then delete the row." Anchoring on the wire shape rather than each platform's composer
struct "is what keeps three hand-written clients in agreement — the in-memory structs are
not symmetric (iOS `UUID`/`Date`/singular `domainId`, Android `String`/`OffsetDateTime`,
web flat `useState`)" (decision log Why).

Deliberate non-validation: "`payload` is deliberately unvalidated — `create_pebble` stays
the single validation authority, at publish time." Because nothing protects the ids inside
the jsonb, **hydration sanitizes stale ids** (a soul or glyph deleted behind a draft's
back is dropped on resume) "rather than letting publish fail on an FK or `can_use_glyph`"
(D7). Drafts relax *saving* only; publishing keeps its `name` + `emotion_id` gate (D5).

Drafts get their own list surface, "never an inline timeline section, because the
timeline's week grouping, ripple, bounce and stats all assume real pebbles" (D4).

### Why local autosave is "insurance only"

The design doc's own framing (header):
> "**Quick capture** — an intentional, server-side draft… Survives reinstalls and is
> visible from every surface.
> **Local autosave** — an unintentional, device-local snapshot of the *open* composer.
> **Crash insurance, nothing more.**"

It is pre-constrained, explicitly, by the offline non-goal:
> "Pre-constrained by `docs/decisions/log.md` (2026-07-29, 'Offline is a non-goal on every
> surface', #620): the local snapshot carries **no merge logic, no cross-device sync**, is
> cleared on publish or server-draft save, and `sw.ts` keeps Supabase requests
> `NetworkOnly`."

The decision entry's Context says why the boundary is drawn so hard: "the two features are
easy to conflate into an offline-sync story that #620 has already ruled out."

The clean line is drawn at media (D3): **server drafts carry `snaps`; local autosave does
not.** Snap bytes are uploaded eagerly at pick time, so a server draft carries them at zero
cost. Local autosave omits them because the web preview is a `blob:` URL that cannot
survive a reload, and a restored descriptor would need a signed-URL fetch "for a snapshot
that is meant to be free."

> "This asymmetry is the honest one: an *intentional* save is worth durable media, an
> *accidental* crash recovery is not." (D3)

Storage per surface (D10): web `useSyncExternalStore` over `localStorage`, key
`pbbls-composer-draft`, ~800 ms debounce, validate-or-discard on read; iOS a JSON file in
the caches directory; Android the JSON string in the existing `pebbles_prefs`
SharedPreferences — "deliberately **not** DataStore."

One contract consequence: "'save as draft' **must skip** the cancel-time
`snaps.cancelAndCleanup`" on iOS and Android, "which would otherwise delete the object the
draft references" (D3). And `happened_at` is stored and published **verbatim** — web's
`isNow()` re-stamp is not applied to a resumed draft, "so publishing hours later does not
move the pebble to publish time" (D6).

---

## 8. Cross-user reads, `profiles` RLS, and the 2026-09-02 trigger

### 8a. Definer-RPC projections (2026-07-30, #654)

**Source:** `docs/decisions/log.md:338-347`;
`docs/superpowers/specs/2026-07-29-public-profiles-design.md` D4.

M50's public profile is "the first read of one user's data by another (and by anonymous
visitors)". The rule:

> "Cross-user reads go through `security definer` RPC **projections** that build an
> explicit jsonb of allowed fields — never through widened RLS on `profiles`, `glyphs`, or
> enrichment tables, and **never through new views**." (decision log)

`get_public_profile(p_handle)` is the template: `definer` + `stable` +
`set search_path = public`; explicit `revoke all … from public` then `grant execute` to
exactly the roles that need it (`anon, authenticated`); **null for unknown *and*
known-but-private targets** (enumeration resistance); engagement recomputed internally for
the target user rather than un-scoping `v_ripple` / `v_bounce` / `get_profile_engagement`.

**Why `profiles` RLS is never widened**, in the decision's own words:

> "A projection makes the exposed field list a **reviewable allowlist in one place**.
> **Widening RLS exposes whole rows to PostgREST's column selection, so every future
> column addition would silently join the public surface.** Recomputing engagement
> internally keeps the owner-scoped views/RPCs untouched and lets the public variant differ
> deliberately (UTC bucketing, no raw counts, no `active_today`)."

The Context names what is on the row that must never cross: `is_admin`, consent
timestamps, quota columns.

**Projected shape** (D4): `display_name`, `handle`, `glyph {strokes, view_box}`,
`pebbles_count`, `ripple_level` (0–6), `bounce_level` (0–7), `assiduity` (28 booleans, UTC),
`days_practiced`, `member_since`, `achievements` (shipped as `[]`, filled by M48).
**Deliberately excluded:** `user_id`, `is_admin`, consent timestamps, quota columns, karma,
`color_world`, the raw counts behind the levels (`pebbles_28d`, `active_days`), and
`active_today` ("a presence signal").

Standing consequences: "M49 (connections), M51 (shared pebbles), and M53 (pairs) must each
**mint their own projection RPCs with their own allowlists** — do not reuse
`get_public_profile` for authenticated-only surfaces by adding fields to it, and **do not
return `user_id` from any public projection**."

The lineage is explicit: this entry "Builds on 2026-07-29 'Postgres views are
`security_invoker` by default' (#616) — this entry covers the **RPC side of the same
boundary**." That #616 entry exists because a live probe with only the publishable key and
no session returned **182 pebbles across 20 distinct users** through `v_pebbles_full`
(`docs/decisions/log.md:276`), and it was "the *second* occurrence of the class" after
`v_ripple` in #442.

One narrow, deliberate exception, recorded 2026-08-17: `/connections/[id]` reads the peer's
shared pebbles with **direct client reads, no new RPC**, because the widened
`pebbles_select` already makes it legal, both reads are single-table single-statement, and
"the M50 'never return `user_id` from a projection' rule concerns *public/anon* projections
— between mutually-consented connections the raw row already carries both ids by design
(M49)" (`2026-08-17-m51-client-ui-design.md` D2).

### 8b. Trigger-pinned privileged columns (2026-09-02, #739) — what attack it closes

**Source:** `docs/decisions/log.md:459-468`; migration
`packages/supabase/supabase/migrations/20260902090000_profiles_privileged_guard.sql`;
harness `packages/supabase/scripts/verify-profiles-privileged-guard.ts`.

**The attack.** `profiles_update` had been `for update using (user_id = auth.uid())` since
`20260411000001_core_tables.sql` — **no `with check`, no column scoping**. Supabase grants
table-level `UPDATE` on `profiles` to `authenticated`, and a table grant covers *every*
column. So any signed-in user, holding nothing but the publishable anon key, could PATCH
their own row and set:

- `is_admin` — "the **sole input** to `is_admin(uuid)`, which gates every admin RPC, all
  analytics RPCs, lab-assets storage writes and unpublished-logs reads";
- `max_media_per_pebble` — the server-side media quota;
- `terms_accepted_at` / `privacy_accepted_at` — consent proof kept for GDPR
  accountability.

The decision states the failure in one line:

> "Because the helper reads only that one column, **an owner-scoped update of it was an
> owner-scoped grant of operator rights.**"

Headline framing: **"Owning a row is not authority to raise capability in it."**
Found by Kritik audit `2026-08` as `F-2026-08-SEC-supabase-01` — **that audit's only open
P0**.

**The fix.** A `before update of is_admin, max_media_per_pebble, terms_accepted_at,
privacy_accepted_at` row trigger (`enforce_profile_privileged_columns`) raises
`profiles_privileged_column` when any of the four changes and `current_user` is
`authenticated` or `anon`. `postgres`, `service_role`, and any `security definer` function
pass through — "which makes the RPC the sanctioned mutation seam." The policy also gains an
explicit `with check (user_id = auth.uid())`.

**Why a trigger, not the obvious alternatives** (decision log Why; migration comment):
- **Not column privileges:** "a table grant covers every column, so moving to per-column
  grants would mean re-granting on every future `ALTER TABLE` — **a silent hole the first
  time someone forgets**."
- **Not a CHECK constraint:** "A `CHECK` constraint cannot see `OLD`, so it cannot express
  'unchanged'."
- **`security invoker`, unlike `enforce_reserved_handle`:** "the function reads nothing and
  needs no elevation, and because **`current_user` must stay the role that actually issued
  the statement** or the exemption means nothing."
- The `of <columns>` clause keeps the trigger off the hot path; the inner `is distinct
  from` means "a client that echoes back an unchanged value is not broken."

**The self-indicting lineage.** The repo had already fixed this class **twice by narrowing
*read* authority** — #442 (`v_ripple`) and #616 (`v_pebbles_full`) — and
`20260730120000` had given `handle` CHECK constraints plus a dedicated
`before update of handle` trigger *for exactly this reason* ("`profiles_update` RLS lets
owners write columns directly"). "But the **write-side capability columns never got the
same pass**." The entry files itself as: "Extends the read-authority narrowing of #442 and
#616 to the **write side**, and generalizes the single-column `handle` guard."

**Standing rule created:** "A new `profiles` column that gates access **must** be added to
the trigger's column list AND to `PINNED` in `verify-profiles-privileged-guard.ts` in the
same change — a privileged column absent from both is writable by every authenticated user,
which is the whole of this bug." Also: "Do not 'fix' a blocked update by dropping the
trigger."

**Recorded gap:** "The harness is not in CI: it signs up a throwaway user against the
linked project, and no `verify-*` harness runs in CI today." That gap was closed the same
day, partially: #741 (`docs/decisions/log.md:470-479`) makes the four **anon** contract
harnesses a CI gate, "the purge harness stays manual because the service-role key stays out
of a public repo"; #743 adds a nightly run logging a result table into one reused tracking
issue.

---

## 9. "Offline is a non-goal on every surface" (#620, 2026-07-29)

**Source:** `docs/decisions/log.md:283-292`; roadmap `§F5` (`:58`), `§M47` (`:78`),
`§6 item 1` (`:166`); `docs/superpowers/specs/2026-07-16-android-parity-audit.md:149`;
`apps/web/app/sw.ts`.

**How it arose.** It is a *documentation* issue, not a feature issue. The Android parity
audit (2026-07-16) listed as item 6 of its recommendations: "**Offline is a non-goal on
every surface** but recorded nowhere — worth one decisions-log line **so it stops being
re-litigated**." The roadmap picked it up as F5: "Decisions-log entry: offline is a
non-goal (asked for by audit §4.6; **prevents drafts/autosave being misread as offline
mode**)."

**The decision, verbatim:**
> "Offline is **not** a goal on web, iOS, or Android. Local autosave and the server
> `pebble_drafts` table do not change that: the local snapshot is crash/offline
> **insurance for the open composer** only (no merge logic, no cross-device local sync,
> cleared on publish or server-draft save), not an offline mode. The web service worker
> keeps Supabase requests **`NetworkOnly`** — the cached-401 precedent (`apps/web/app/sw.ts`)
> stays untouched."

**The exact rationale (Why), verbatim:**
> "A **cached-401-after-sign-in bug already proved that caching Supabase responses is
> unsafe**; treating offline as explicitly out of scope keeps that fix intact and stops
> future work from reintroducing response caching in the name of 'offline support.'"

The bug is documented in the service worker itself (`apps/web/app/sw.ts:14-23`): the
default Serwist runtime caching cached `*.supabase.co` requests "for up to 1 hour with a
10 s network timeout fallback. This means a cached 401 from before [sign-in]…" — fixed by
prepending a `NetworkOnly` rule for Supabase.

**Consequences, verbatim:**
> "Do not add a Supabase caching strategy to `sw.ts`, or local-first sync logic to
> autosave/drafts, without first **superseding this entry**. Composer crash/offline
> insurance stays local-only and single-device."

**What is *not* reversed.** The PWA shell survives. `apps/web/app/sw.ts` still exists;
`offline` is still a reserved handle (public-profiles D2 seed list); and there is still a
shipped acceptance criterion for an offline *screen*: *"Given I have no connection at all,
When I open the app I installed on my phone, Then I get a Pebbles screen telling me I am
offline, not a browser error page."* (`docs/arkaik/bundle.json`). The non-goal is about
**data**, not about installability or the offline fallback page.

---

# REVERSALS

Contradictions with earlier 2026 material, stated explicitly.

## R1 — Local-first / PWA / offline: designed in April, deferred within days, killed in July

| Stage | Position | Source |
|---|---|---|
| 2026-04-09 | Shipped prototype is **local-first by definition**: "a Next.js PWA with everything held in the browser… local accounts… **offline install**". | `docs/arkaik/journal.jsonl:264` (`release.tagged`, `web-prototype`) |
| 2026-04-11 (a) | `SupabaseProvider` designed as an explicitly **local-first** layer: "localStorage is the **primary store** for instant reads/writes. Supabase syncs in the background as a backup." Mount cycle step 3: "Find local items with IDs not in Supabase (**created offline**) → push them to Supabase." | `docs/superpowers/specs/2026-04-11-supabase-provider-design.md` (title, Overview, Architecture) |
| 2026-04-11 (b) | **First reversal, same day.** "Supabase is the source of truth. **No localStorage cache for data.** Mutations go to Supabase first; local state updates only on success." "Graceful degradation when offline. Show last-loaded data as **read-only**. Mutations are blocked… No creating data that can't be saved." Out of scope: "**Full local-first/offline support (deferred)**", "Conflict resolution and merge logic (not needed — Supabase is source of truth)". | `docs/superpowers/specs/2026-04-11-auth-data-layer-redesign.md:24-26,156` |
| 2026-04-26 | The PWA identity is still asserted as a defining property: "`apps/web/` is a PWA (service worker, manifest, install prompts, **offline-first via `LocalProvider`**). Admin work is the opposite of every PWA assumption." | `docs/superpowers/specs/2026-04-26-back-office-app-design.md:22` |
| 2026-07-29 | **Second, terminal reversal (#620).** "Offline is **not** a goal on web, iOS, or Android." Deferred becomes forbidden: reintroducing it "without first superseding this entry" is banned. | `docs/decisions/log.md:283-292` |

**Notes for accuracy.** The April 11 reversal is a *pause* ("deferred"), the July 29 one is
a *prohibition*, and the July entry's stated reason is **not** the April race-condition
list — it is narrower and empirical: the cached-401-after-sign-in bug. The `LocalProvider`
referenced in the April 26 doc had already been deleted by the April 11 redesign ("No
anonymous data layer… `LocalProvider` is deleted") — so that description was stale when
written. Also note the *inverted* order of ambition: the drafts milestone (M47) reintroduces
device-local persistence to **iOS and Android for the first time** ("Neither app has on-disk
persistence today", drafts D10) in the same week that offline is banned — local storage
returns, but stripped of every sync semantic.

## R2 — Anti-streak / anti-dark-pattern (April) vs. the badge economy (July)

| Stage | Position | Source |
|---|---|---|
| 2026-04-04 | Onboarding's closing screen, shipped copy: **"No streak to protect, no feed to scroll. Just a calm ritual that grows with you."** | commit `d0b50eaf` (PR #100), `lib/config/onboarding-steps.ts:21`; still live at `apps/web/lib/i18n/messages/en.json:466`; Arkaik node description at `docs/arkaik/bundle.json:7952` |
| 2026-04-18 | Same register on the welcome/onboarding screens: "Capture moments as they happen — **no blank page, no pressure, no audience**." | `docs/superpowers/specs/2026-04-18-onboarding-screens-design.md:95`; `2026-04-18-ios-welcome-screen-design.md:108` |
| by 2026-04-10 | Terms §9.1 "Engagement Tools, Not Contractual Obligations"; Bounce/Karma "without constituting a '**streak**' or contractual obligation". | `apps/web/docs/terms/en.md:53,272-274` (file moved in `6126af27`) |
| 2026-07-01 | Karma flash is designed with "**no hidden server modifiers** (no streak/first-pebble/anti-abuse adjustment)". | `docs/superpowers/specs/2026-07-01-issue-505-ios-karma-earned-flash-design.md:36` |
| 2026-07-30 | Achievements ship: 8 badge families with **tiered ladders** (`pebble_count` 1·10·25·50·100·250·500·1000), a **locked-badge grid** ("the full ladder is visible, which is the point of tiers", D8), a **Duolingo-style** chained celebration modal (D13), a **Duolingo shelf** on the profile (D14), and **karma paid per badge** into the spendable wallet, which "raises the bounce level" (D9). | `docs/superpowers/specs/2026-07-29-achievements-design.md`; `docs/decisions/log.md:327-336` |
| 2026-07-30 | Public profile ships **streaks as a shareable public artifact**: the Lab Note copy reads "your profile gets its own page (**rings, streaks and all**) that you can share with anyone." The Arkaik acceptance says a visitor sees "my rings, **my streaks** and the badges I earned." | journal PRs #675, #677; `docs/arkaik/bundle.json:3146` |

**The reversal, stated plainly:** the April product promised no streak and no audience.
By 30 July the product has a tiered badge ladder with a celebration modal, a badge shelf,
karma paid at unlock — and it publishes the user's streaks to an audience on a shareable
URL. The word "streaks" appears in shipped user-facing copy for the public profile.

**Qualifications that the sources support:**
- The mechanic being published was **already there in April** — the "bounce streak" is
  listed in the 2026-04-09 prototype release notes (`journal.jsonl:264`). April's promise
  was arguably always about *feed and obligation*, not about the existence of a regularity
  score; the Terms clause from the same week draws exactly that line ("without constituting
  a 'streak' or contractual obligation"). What changed in July is that it became **social**.
- The Terms clause **already named Achievements** as an engagement tool before the feature
  existed, so the legal register anticipated it.
- Restraint survives in specific, documented places: retroactive grants **do not celebrate**
  (D13, and an acceptance criterion enforcing it); **no per-badge progress bars in v1**
  (D8/D14); karma default is 0, "'cosmetic' is just the default value" (D9); no push, no
  realtime, no notifications anywhere in the batch; connections **cannot** earn karma,
  structurally (connections D9).

**NOT FOUND:** any decision-log entry, spec section, or PR note that acknowledges the
April anti-streak stance while designing achievements; any "Supersedes" pointer from the
achievements decision to onboarding copy or Terms §9.1; any recorded debate about whether
badges are a dark pattern. The achievements decision's only "Supersedes" line is internal
to the roadmap ("Supersedes the roadmap §5 item 5 'achievement karma deferred' stance").

## R3 — `private` no longer means private (2026-08-17)

Not a reversal of an *argument* but of a **stored value's meaning**, which the sources
treat as the same danger. `pebbles.visibility` shipped in the very first schema
(`20260411000001_core_tables.sql:59`) defaulting to `'private'`; for four months it was
decorative — "no RLS policy reads it" (roadmap `:16`). On 2026-08-17 the same string
became **connections-visible**, and the owner-only meaning moved to a new word, `secret`.
Every row written under the old meaning was rewritten (`update … set visibility = 'secret'`,
`updated_at` trigger disabled). See §2. The decision entry names the risk it was avoiding:
"a **silent privacy regression**."

## R4 — The consent-timestamp collection gap (April → July fix)

The roadmap's audit records that "consent timestamps [were] collected at signup but
**never persisted** by `handle_new_user()`" — a GDPR accountability bug
(`2026-07-28-store-launch-roadmap.md:26`, F2/#617). Fixed 2026-07-29 (PR #628, migration
`20260729120000_handle_new_user_consent.sql`), with existing accounts backfilled
("existing accounts had theirs recovered", journal). Then, on 2026-09-02, those same two
columns become **client-unwritable** by trigger (#739, §8b) — the same data goes from
*not stored at all* → *stored* → *pinned as evidence* in five weeks.

## R5 — Roadmap prescription vs. implemented predicate (account deletion)

Minor, but the design doc flags it itself: "The roadmap says *anonymize sold glyphs*. The
implemented predicate anonymizes any glyph… **referenced from outside their account**"
(account-deletion D1). The decision log repeats it: "The predicate is deliberately wider
than the roadmap's 'sold'." Not a values reversal — a correctness widening forced by
`ON DELETE RESTRICT`.

---

## Loose ends / NOT FOUND

- **Explicit anti-dark-pattern deliberation on achievements** — NOT FOUND (see R2).
- **Any decision or spec discussing handle *impersonation* beyond one accepted-risk line**
  — NOT FOUND beyond `docs/decisions/log.md:356` ("accepted at this scale… revisit if abuse
  appears (M56 adds reporting)").
- **Block-management UI** — deferred to M56; no design doc for M56 exists in
  `docs/superpowers/specs/` as of 2026-09-02.
- **M52 (soul seaming), M53 (pairs), M54 (whispers), M55–M57** — planned in the roadmap,
  no design docs and no decision-log entries in the read window. The connections and
  deletion functions carry in-body markers reserving their extension points
  (`>>> M52/M53: sever seams and pairs <<<`; `>>> APPEND new per-user tables … HERE <<<`).
- **Migration file contents beyond `20260817130000` and `20260902090000`** were read only
  by targeted grep; `20260730070347_mutual_connections.sql`,
  `20260730090000_achievements.sql` and `20260730120000_public_profiles.sql` are cited via
  their design docs and decision entries, not line-by-line.
