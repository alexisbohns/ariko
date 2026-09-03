# Act 3 digest — the karma economy and the Glyph Market (Pebbles, June–September 2026)

**Status:** factual digest. Not publishable prose. Every claim carries its source.
**Source repo:** `/Users/alexis/code/pbbls` (read-only).
**Sources read:** `docs/decisions/log.md`; specs `2026-06-29-issue-494-karma-wallet-design.md`,
`2026-06-30-issue-496-glyph-marketplace-design.md`, `2026-06-30-issue-497-admin-glyph-moderation-design.md`,
`2026-07-01-issue-507-glyph-swap-ios-design.md`, `2026-07-01-remove-glyph-shape-design.md`,
`2026-07-12-glyph-picker-store-harmonization-design.md`, `2026-07-16-android-glyph-studio-store-design.md`;
`docs/arkaik/journal.jsonl`; migrations under `packages/supabase/supabase/migrations/`;
supporting reads in `apps/web/lib/config/glyphs.ts` and `apps/web/lib/engine/templates.ts`;
`git log` for commit-level reworks.

**Umbrella milestone:** **M36 · Pebblestore & Karma Economy**, split into four sub-projects —
**A** karma wallet (#494), **B** in-app activity (#495), **C** glyph marketplace (#496),
**D** admin moderation/curation (#497). (`docs/superpowers/specs/2026-06-29-issue-494-karma-wallet-design.md`
header; `…-496-…` header; `…-497-…` header.)

---

## 1. Dated timeline

| Date | Event | Surface | Source |
|---|---|---|---|
| 2026-04-11 | `pebble_shapes` reference table created with **6** seeded shapes (`river-smooth`, `creek-flat`, `moss-round`, `canyon-long`, `shore-wide`, `dusk-pebble`); `glyphs.shape_id` created **NOT NULL** FK to it | db | `migrations/20260411000000_reference_tables.sql:30,94`; `20260411000001_core_tables.sql:44` |
| 2026-04-15 | `glyphs.shape_id` made nullable; system-owned (`user_id IS NULL`) glyph rows allowed — the "shapeless glyph" model of issue #278 | db | `migrations/20260415000001_remote_pebble_engine.sql:5,25` |
| 2026-06-29 | **Decision:** karma wallet — one ledger, debt allowed, refunds server-only (#494) | db, web | `log.md` 2026-06-29 |
| 2026-06-29 | Migrations: `type` credit/withdraw axis + reason CHECK + indexes; `wallet_balances` snapshot + trigger + backfill; `spend_karma`/`refund_karma` | db | `20260629192621`, `20260629193636`, `20260629193838` |
| 2026-06-29 (same day, later timestamp) | **Security fix:** `refund_karma` revoked from `authenticated`, granted to `service_role` only | db | `20260629194418_restrict_refund_karma_to_service_role.sql` |
| 2026-06-29 | `v_wallet_summary` added; `bounces` trigger narrowed to **credit-only** so the admin histogram keeps meaning *earned* | db, admin | `20260629194621` |
| 2026-06-29 | PR **#499** shipped — "Your karma, now in a Wallet" (`/wallet` page) | web | `journal.jsonl` 2026-06-29 |
| 2026-06-29 | **Decision:** web in-app notifications = Sonner + explicit-fire, no realtime (#495) | web | `log.md` 2026-06-29 |
| 2026-06-30 | PR **#500** shipped — "+N karma" pill | web | `journal.jsonl` |
| 2026-06-30 | **Decision:** glyph marketplace — use-rights entitlements, per-listing price, atomic buy (#496) | db, web | `log.md` 2026-06-30 |
| 2026-06-30 | **Decision (D8):** glyphs readable when listed/entitled; listed glyphs creator-immutable | db | `log.md` 2026-06-30 |
| 2026-06-30 | Migration `20260630003348_glyph_marketplace.sql`: `glyph_submissions`, `glyph_entitlements`, `glyph_favourites`, `submit_glyph`, `buy_glyph`, `v_glyph_market`, `glyphs` policy rewrite | db | migration file |
| 2026-06-30 | PR **#501** shipped — "A glyph market, powered by your karma" | web | `journal.jsonl` |
| 2026-06-30 | Migration `20260630084718_admin_glyph_moderation.sql`: `review_note`, `admin_list_glyph_submissions`, `approve_glyph`, `reject_glyph`, `set_glyph_price`, `publish_admin_glyph` | db, admin | migration file |
| 2026-06-30 | **Decision:** admin glyph moderation — `is_admin` RPCs, first-party admin-owned glyphs, stroke-only SVG import (#497) | db, admin, web | `log.md` 2026-06-30 |
| 2026-07-01 | **Decision:** glyph sales pay the creator via a **net-zero karma transfer**; **attribution transfers ownership** (#497) | db, admin, web | `log.md` 2026-07-01 |
| 2026-07-01 | Migration `20260701102810_glyph_marketplace_curation.sql`: `listed` flag, `glyph_sale` reason, creator payout inside `buy_glyph`, `set_glyph_listed`, `admin_delete_glyph`, `admin_find_user`, `admin_attribute_glyph` | db | migration file |
| 2026-07-01 | PR **#502** shipped — "Community glyphs are now curated" (admin moderation + upload + playground) | admin, web | `journal.jsonl` |
| 2026-07-01 | **Decision:** dropped `glyphs.shape_id` and the `pebble_shapes` table (#503) | db, ui, ios | `log.md` 2026-07-01; `20260701114205_drop_glyph_shape.sql` |
| 2026-07-01 | **Decision (reversal):** iOS karma flash is an in-app pastille, **not** a Dynamic Island Live Activity (#505) | ios | `log.md` 2026-07-01 |
| 2026-07-01 | PR **#506** shipped — iOS karma pastille with haptics + ceramic sound | ios | `journal.jsonl` |
| 2026-07-02 | PR **#508** shipped — "Swap glyphs with the community": iOS Mine/Owned/Commu tabs + slide-to-confirm swap drawer (#507) | ios | `journal.jsonl`; spec `2026-07-01-issue-507-…` |
| 2026-07-12 | Migration `20260712000000_glyph_usability_guard.sql` (#545): `can_use_glyph`, guard added to `create_pebble`/`update_pebble`, `souls_glyph_usable` trigger | db | migration file |
| 2026-07-12 | PR **#546** shipped — web glyph picker becomes Mine/Owned/Community with inline buy | web | `journal.jsonl`; spec `2026-07-12-…` |
| 2026-07-12 | PR **#548** shipped — same tabbed picker on iOS | ios | `journal.jsonl` |
| 2026-07-13 | **Rework:** commit `fix(db): remove redundant update_pebble migration that reverted the glyph guard (#551)` — a duplicate-timestamp migration would have re-opened the entitlement hole | db | `git log` 2026-07-13 |
| 2026-07-16 | PR **#572** shipped — Android pre-flight: entitled glyphs usable on Android | android | `journal.jsonl` |
| 2026-07-17 | PR **#593** shipped — "Photos and the Glyph Studio arrive on Android": carve + store + swap (M43) | android | `journal.jsonl`; spec `2026-07-16-android-glyph-studio-store-design.md` |
| 2026-07-29 | **Decision:** account deletion anonymizes externally-referenced glyphs to `user_id = null`; personal ledger rows deleted (#631) | db | `log.md` 2026-07-29; `20260729201326_account_deletion_purge.sql` |
| 2026-07-29 | **Rework:** commit `fix(core): re-align web karma mirror with compute_karma_delta caps (#630)` — the web optimistic karma estimate had drifted from the SQL | web | `git log` 2026-07-29 |
| 2026-07-30 | **Decision:** achievements grant karma at unlock via `reason='grant'`, default `karma_reward = 0` (#664) | db | `log.md` 2026-07-30; `20260730090000_achievements.sql` |
| 2026-07-31 | **Decision:** two migrations re-emitting one function off the same base silently drop each other's appends (#687) — merge-order hazard affecting `purge_account` | db | `log.md` 2026-07-31 |
| 2026-08-01 → 2026-09-02 | **NOT FOUND** — no decision-log entry, spec, migration or journal `deliverable.shipped` in the karma/glyph/market/wallet area after 2026-07-31. The August–September log entries cover polaroid path, record flow, valence fan, wobble, privacy grades, profile guards and CI harnesses. | — | `log.md` 2026-08-17 → 2026-09-02; `journal.jsonl` (last market-adjacent event 2026-07-30) |

---

## 2. Question 1 — the karma ledger

### What it is

`public.karma_events` is an **append-only ledger**; the balance is `Σ delta`, snapshotted in
`public.wallet_balances` (`user_id` PK, `balance integer`, `updated_at`), maintained by an
`after insert` trigger `karma_events_apply_to_wallet` → `apply_karma_event_to_wallet()`
(`migrations/20260629193636_wallet_balances.sql`).

Shape as of 2026-07-01:
- `karma_events(id, user_id, delta smallint, reason text, ref_id uuid, created_at, type text)`
- `type text not null default 'credit' check (type in ('credit','withdraw'))` (`20260629192621`)
- `reason` CHECK, final form: credit side `pebble_created | pebble_enriched | pebble_deleted | grant | glyph_sale`;
  withdraw side `purchase | refund` (`20260701102810` §2 re-emits the constraint to add `glyph_sale`).
- Indexes `(user_id, type)` and `(user_id, created_at desc)` (`20260629192621`).
- `v_wallet_summary(user_id, balance, total_earned, total_spent)`, filtered `where wb.user_id = auth.uid()`,
  revoked from `public, anon` (`20260629194621`).

The **`type` axis keys off the category of movement, not the sign of `delta`** — spec #494 §"Core design
decisions" 2: `credit` = earn-side (may be negative), `withdraw` = spend-side (`purchase` negative,
`refund` positive). So: `balance = Σ delta`; `total_earned = Σ delta where credit`;
`total_spent = −Σ delta where withdraw`.

`delta` stays `smallint` deliberately. Verbatim (`20260629192621` header): *"Widening the column would
force dropping & recreating the views that depend on it (v_karma_summary,
v_analytics_bounce_distribution_today) on the live DB — not worth it. Revisit only if a single good ever
needs a price > 32767."*

### Why debt is allowed

Decision log 2026-06-29, verbatim: *"there is deliberately **no `CHECK(balance >= 0)`** on the snapshot, so
earn-side clawbacks may drive the balance **negative (a debt)** the user clears by re-earning."*

Why, verbatim: *"Coupling pebble deletion to wallet state would be wrong UX, so clawbacks must always apply
even into the negative — a column `CHECK` would roll back a legitimate delete. The purchase guard alone
keeps the store safe (a negative balance can't buy anything)."*

The consequence is recorded as a standing prohibition: *"**Do not add `CHECK(balance >= 0)` to
`wallet_balances`** — it would break pebble deletion."* The migration repeats it inline
(`20260629193636`: *"NO non-negative CHECK: earn-side clawbacks (pebble deletion) may legally drive this
below zero. The overdraw guard lives in spend_karma, not here."*)

The guard that actually holds: `spend_karma` inserts a `wallet_balances` row if absent, then
`select balance … for update` (row lock, serializing concurrent spends), and raises
`insufficient_karma` (errcode `P0001`) when `v_balance < p_amount` (`20260629193838`).
Spec #494's integrity table: *"Try to buy while in debt | `balance < 0 < price` → rejected until re-earned."*

### Why refunds are server-only

`refund_karma(p_amount, p_ref_id)` has **no validation against an original purchase**. Verbatim
(`20260629194418_restrict_refund_karma_to_service_role.sql`): *"As written it has no validation against an
original purchase, so granting it to `authenticated` lets any user mint karma via
refund_karma(1_000_000, …). Refunds are issued by trusted server/admin logic only. The buy flow
(sub-project C) needs no client refund: a failed grant rolls back the spend in the same transaction."*

**Note this was a same-day correction, not a clean first cut:** `20260629193838_wallet_rpcs.sql` ends with
`grant execute on function public.refund_karma(integer,uuid) to authenticated;`, and the very next
migration (`…194418`, ~6 minutes later by timestamp) revokes it. The spec (#494 §Migration 3) already
described the service-role-only rule in a comment; the shipped migration did not implement it first time.

### What earns karma, and what it costs

Earning is computed by `compute_karma_delta(p_description, p_cards_count, p_souls_count, p_domains_count,
p_has_glyph, p_snaps_count)` (`20260411000003_rpc_functions.sql:16-45`):

- base **+1**
- **+1** non-empty description
- **+N** per card, `least(p_cards_count, 4)` — capped at 4
- **+1** at least one soul
- **+1** at least one domain
- **+1** a glyph attached
- **+1** at least one snap
- whole result `least(delta, 10)` — hard ceiling of **10 per pebble**

Reasons: `create_pebble` writes `pebble_created`; `update_pebble` writes the *difference*
(`v_new_karma - v_old_karma`) as `pebble_enriched` only when it changed
(`20260426000002_pebble_media_edit.sql:219-226`); `delete_pebble` writes `-v_total_karma` as
`pebble_deleted` (`20260411000003_rpc_functions.sql:369-374`) — the clawback that makes debt possible.
Later additions: `grant` (achievements, `delta = karma_reward` read at unlock, default 0,
`20260730090000_achievements.sql:36-37,242-245`) and `glyph_sale` (creator payout, §4 below).

Costs: the only spend reason accepted by `spend_karma` is `'purchase'` —
`if p_reason not in ('purchase') then raise exception 'invalid_reason'` (`20260629193838`).
Community glyph price default **25 karma** (`glyph_submissions.price integer not null default 25
check (price > 0)`, `20260630003348`), mirrored client-side as `GLYPH_PRICE_DEFAULT = 25`
in `apps/web/lib/config/glyphs.ts` (*"Server (`buy_glyph`) is authoritative; this is for display only."*).

> **Tension worth noting (not a contradiction in the sources, but a live constraint):** the decision log says
> *"New spend-side reasons go through `spend_karma`"*, while the shipped `spend_karma` hard-codes
> `p_reason not in ('purchase')`. Any future good therefore requires editing that guard.

---

## 3. Question 2 — listings, entitlements, and creator immutability

### The listing

**The submission row *is* the market listing** (#496 D3: *"`glyph_submissions.status` drives it:
`pending` (awaiting D) → `approved` (live in Market) → `rejected`. No separate listing table."*).

```
glyph_submissions(
  id uuid pk, glyph_id uuid not null → glyphs(id) on delete cascade,
  submitter_id uuid not null → auth.users(id),
  status text not null default 'pending' check in ('pending','approved','rejected'),
  price integer not null default 25 check (price > 0),
  created_at, reviewed_at, reviewed_by uuid → auth.users(id))
```
plus `review_note text` (added `20260630084718` for reject reasons) and
`listed boolean not null default true` (added `20260701102810`).
A partial unique index `glyph_submissions_one_active on (glyph_id) where status in ('pending','approved')`
allows at most one active submission per glyph (`20260630003348`).

### The entitlement

```
glyph_entitlements(
  id uuid pk, user_id uuid not null → auth.users(id),      -- buyer
  glyph_id uuid not null → glyphs(id) on delete cascade,
  karma_event_id uuid not null → karma_events(id),
  price_paid integer not null check (price_paid > 0),      -- snapshot at purchase
  created_at, unique (user_id, glyph_id))
```
(`20260630003348`). RLS: SELECT own only; **no INSERT policy** — rows are insertable only through the
`security definer` `buy_glyph` (log 2026-06-30 consequences: *"Entitlement rows are insertable **only** via
the `security definer` RPC (no INSERT policy)."*)

### Use-rights, not ownership

#496 D1, verbatim: *"**Buying grants use-rights, not a copy.** A purchase inserts an *entitlement* row
granting the buyer the right to **use** the original glyph (attach to pebbles/souls). One source of truth;
the creator keeps authorship; no stroke duplication."*

Decision log 2026-06-30 gives the rationale: *"Entitlements avoid stroke duplication and keep
authorship/attribution clean, and make a glyph usable everywhere own glyphs are (picker + lookup map)."*
`price_paid` is a **snapshot**: *"preserves a per-glyph purchase ledger (buyers-per-month, revenue) that
survives future price changes — so 'glyph value' can be a derived aggregate, never a stored column (YAGNI:
capture data, defer analytics)."*

Buy is atomic and idempotent: `buy_glyph` does `spend_karma(price,'purchase',glyph_id)` then the
entitlement insert in one transaction; `unique(user_id, glyph_id)` is the race backstop — verbatim:
*"a concurrent double-buy rolls back the loser's spend too, so a buyer is charged at most once."*
Error contract: `not_authenticated`, `not_in_market`, `cannot_buy_own`, `already_owned`,
`insufficient_karma` (#496 §4.2; matches the shipped function).

### Why listed glyphs are creator-immutable (D8)

Decision log 2026-06-30 (D8), decision verbatim: *"The `glyphs` SELECT policy widens to **own ∪ system-seeds
(`user_id is null`) ∪ approved-listed ∪ own-entitled** … The `glyphs` UPDATE/DELETE policies are rewritten
to **lock** a glyph once it has an active submission (`pending`|`approved`) **or** any entitlement: only
`is_admin(auth.uid())` may then modify it; the creator cannot."*

Why, verbatim: *"The lock is backend-enforced (RLS), not UI-only, because a frontend-only guard is
bypassable via the raw update path; `on delete cascade` would otherwise let a creator wipe buyers'
entitlements."* And #496 D8: *"the strokes are what buyers paid for (no bait-and-switch)."*

Standing rule recorded: *"**Do not narrow `glyphs_select` back to own-only** — the market and picker depend
on the widened policy."* The web UI mirrors the lock (`GlyphDetail` hides edit/delete, shows a
"Listed — locked" badge) but *"RLS is the real enforcement"*.

`v_glyph_market` is `security_invoker = true` so the caller's RLS applies; from `20260701102810` it filters
`where s.status = 'approved' and s.listed` and exposes `id, user_id, name, strokes, view_box, created_at,
updated_at, price, owned, favourited`. It does **not** exclude the caller's own rows — clients filter
(iOS spec §"Backend: no changes required"; Android D4: *"Commu: `v_glyph_market` with server-side
`.neq("user_id", me)` (view does NOT exclude own rows)"*).

**Contradiction, spec vs. shipped code (minor):** #496 §4.1/§4.2 specify `submit_glyph … returns uuid` and
`buy_glyph … returns table(entitlement_id uuid, balance integer)`; both shipped as `returns jsonb`
(`20260630003348`). #496 §4.1 also specifies a distinct `not_custom` error for system seeds; the shipped
function folds that into `not_owner` with the comment *"covers system glyphs (null owner)"*.

---

## 4. Question 3 — net-zero karma transfer and "attribution transfers ownership"

### The sale

Decision log 2026-07-01 (#497), verbatim: *"A glyph sale **credits the glyph owner (`glyphs.user_id`) the
full price** as a `glyph_sale` karma credit inside `buy_glyph`, in the same transaction as the buyer's
`spend_karma` withdraw — a **net-zero transfer** (no minting), consistent with the wallet rules (#494)."*

Concretely, inside `buy_glyph` (`20260701102810` §4):

```sql
v_event := public.spend_karma(v_price, 'purchase', p_glyph_id);   -- buyer: -price, withdraw
insert into public.glyph_entitlements (user_id, glyph_id, karma_event_id, price_paid)
values (v_user, p_glyph_id, v_event, v_price);
if v_owner is not null then                                       -- creator: +price, credit
  insert into public.karma_events (user_id, delta, type, reason, ref_id)
  values (v_owner, v_price, 'credit', 'glyph_sale', p_glyph_id);
end if;
```

The `karma_events_apply_to_wallet` trigger applies the creator's credit to their `wallet_balances` in the
same transaction. The `if v_owner is not null` branch is what makes an anonymized (post-account-deletion)
glyph *"sell for nothing"* — see §8 below. The payout is bounded by `delta`'s `smallint`
(log 2026-07-01 consequences).

`glyph_sale` is a **credit**-type reason, which means glyph income counts toward `total_earned` and toward
the admin `bounces` "earned karma" snapshot (credit-only since `20260629194621`).

### Attribution

`admin_attribute_glyph(p_glyph_id, p_user_id)` is an `is_admin`-gated `security definer` RPC that does
literally `update public.glyphs set user_id = p_user_id where id = p_glyph_id` (`20260701102810` §5), with
`admin_find_user(p_email)` resolving the target by email.

Decision log 2026-07-01, verbatim: *"**Attribution transfers ownership**: `admin_attribute_glyph` sets
`glyphs.user_id` to a looked-up user, so they become the creator (glyph appears in their gallery,
`cannot_buy_own` protects them, payouts route to them); admin-owned (unattributed) glyphs pay the admin
account."*

Why one column and not a separate `credited_to`, verbatim: *"Reusing `glyphs.user_id` as the payout target
… keeps ownership, gallery visibility, `cannot_buy_own`, and payouts consistent from one column."*
Forward-looking consequence recorded: *"Future royalty/revenue-share models would build on `glyphs.user_id`
as the creator."*

Two sibling curation controls landed with it:
- **Delisting** — `glyph_submissions.listed`, toggled by `set_glyph_listed` (approved rows only).
  *"a delisted glyph leaves the market but existing owners keep it"*; chosen over flipping `status` because
  it *"preserves the `approved` audit + entitlements while removing buyability"*. Reversible.
- **Deletion** — `admin_delete_glyph`, a definer RPC that cascades to the submission and entitlements.
  *"Delisting is reversible; deletion is not (buyers lose access — the admin UI warns)."*

---

## 5. Question 4 — admin moderation, first-party glyphs, stroke-only SVG import

### What moderation does

All admin mutations are `is_admin(auth.uid())`-gated `SECURITY DEFINER` RPCs, granted to `authenticated`
with the guard doing the real gating, revoked from `public, anon` (`20260630084718` §7):

| RPC | Behaviour | Errors |
|---|---|---|
| `admin_list_glyph_submissions(p_status)` | Read path; joins `glyph_submissions → glyphs` for geometry + `auth.users` for submitter (and, from `20260701102810`, owner) email; `jsonb_agg` ordered `created_at` ascending (FIFO) | `not_admin` |
| `approve_glyph(p_submission_id, p_price default null)` | `pending` → `approved`, stamps `reviewed_at`/`reviewed_by`, `price = coalesce(p_price, price)` | `not_admin`, `bad_price`, `not_found`, `invalid_state` |
| `reject_glyph(p_submission_id, p_note)` | `pending` → `rejected`, **note required**, stored in `review_note` | `missing_note`, `not_found`, `invalid_state` |
| `set_glyph_price(p_submission_id, p_price)` | Re-price an `approved` listing; existing `price_paid` snapshots untouched | `bad_price`, `not_found`, `invalid_state` |
| `publish_admin_glyph(...)` | Insert glyph owned by the admin + auto-approved submission, one transaction | `bad_price`, `empty_glyph` |
| `set_glyph_listed`, `admin_delete_glyph`, `admin_find_user`, `admin_attribute_glyph` | curation (2026-07-01) | see §4 |

The read RPC exists because of a specific RLS gap. Decision log 2026-06-30, verbatim: *"the widened
`glyphs` SELECT policy (D8, #496) does **not** let an admin read a *pending* submission's strokes via
RLS"* — the admin is neither owner, nor entitled, nor is the row approved. *"A `SECURITY DEFINER` read RPC
is the only way to give admins pending-submission previews without weakening the marketplace SELECT
policy."*

`review_note` is *"now part of the submission contract"*; the submitter reads it through the existing
`glyph_submissions_select` policy (`submitter_id = auth.uid()`), surfaced on the web "Mine" tab —
the one cross-app touch of #497 (spec D-D2 / §7). Journal PR #502 blurb: *"If a submission isn't accepted,
you'll now see the reason right on your glyph."*

Rejection frees the glyph to be re-submitted: the partial unique index only blocks `pending`|`approved`
(#497 §3.3).

### Why first-party glyphs are admin-owned

Decision log 2026-06-30, verbatim: *"First-party uploads are **owned by the admin user** (a normal
auto-approved listing), **not** `user_id IS NULL` system seeds — so they reuse all market plumbing,
`cannot_buy_own` protects the admin, and the D8 admin-exemption lets them be re-edited/re-priced."*
Spec D-D3 adds: *"System-seed (`user_id is null`) ownership is explicitly rejected — those are the free
per-domain seeds, a different concept."* And the log's why: *"Admin-owned (vs system-seed) first-party
glyphs avoid special-casing the buy/lock paths."*

`publish_admin_glyph` implements exactly that: `insert into glyphs (user_id = auth.uid(), …)` then
`insert into glyph_submissions (…, status='approved', reviewed_at=now(), reviewed_by=auth.uid())`,
returning `{glyph_id, submission_id}` (`20260630084718` §6).

This choice has a visible side effect, acknowledged later in the picker-harmonization spec (2026-07-12,
§"On the reported 'leak'"), verbatim: *"`publish_admin_glyph` stamps `user_id = the admin` on every glyph
it publishes, so for the publisher/admin account those glyphs are literally 'Mine' and thus appear in the
picker … **Decision:** this is acceptable and truthful."*

### Stroke-only SVG import

Decision log 2026-06-30, verbatim: *"SVG import is **stroke-only**: a documented subset (`<path>/<line>/
<polyline>/<polygon>`, path commands `M L H V Q C Z`) is converted; fills and other elements are
skipped-and-reported; filled icons import as outlines."*

Why, verbatim: *"Stroke-only import keeps the engine unchanged (a filled-glyph render mode would ripple
across web + iOS — deferred); making the limit visible in the live preview is honest UX."*

Because the underlying model is stroke-only: `Mark` ↔ `glyphs`, geometry is
`strokes: {d: string; width: number}[]` + `view_box`; `renderGlyphPaths` *"forces `stroke="black"
fill="none"`"* and normalizes every stroke width, so *"the stored per-stroke `width` is **not** used in the
final market render"* (#497 §1).

Not supported, skipped and reported as a count + list in the preview (#497 §4): `<rect>`, `<circle>`,
`<ellipse>`, `<text>`, `<image>`, `<use>`, gradients, patterns, embedded `<style>`, CSS classes, arcs
(`A/a`), and fills. Conversion *"never throws on unsupported content — it skips and reports"*; it throws
only on unparseable SVG.

Adjust transforms (uniform scale, recenter, flip H/V) are **baked into path coordinates at publish**
(#497 §5), with the `view_box` recomputed from transformed bounds. Rationale in the log: *"Baking
transforms into geometry means downstream renderers need no awareness of the adjust step."* Flip is the
reason baking is required — it *"can't be expressed by adjusting `view_box` alone"*.

Standing consequence: *"A filled-glyph render mode remains a future, separate decision. The admin SVG path
parser supports only the documented command subset; arcs/smooth curves are skipped, not approximated."*

---

## 6. Question 5 — the shape drop, and the nine valence shapes

### What was dropped

`20260701114205_drop_glyph_shape.sql` (#503) drops `glyphs.shape_id` and `drop table public.pebble_shapes`
— in that order, after recreating every dependent object first. Header verbatim: *"Glyphs are shape-agnostic
square drawings: the stroke is always 6px in glyph space and scaled into the pebble slot, so
`glyphs.shape_id` (and the orphaned `pebble_shapes` lookup table it referenced) carry no meaning."*

Dependents recreated in the same migration (log 2026-07-01): `create_pebble` no longer reads
`new_glyph.shape_id`; `publish_admin_glyph` **lost its `p_shape_id` parameter** (signature change → drop +
recreate); `admin_list_glyph_submissions`, `v_pebbles_full` and `v_glyph_market` stop projecting `shape_id`
(`v_glyph_market` needed `DROP VIEW` because `shape_id` was a top-level column there). Web/admin readers
removed: `Mark.shape_id`, provider mappings, `PEBBLE_SHAPES` config, `useShapeName`, the dead
`carve/PebbleOutline.tsx`, shape i18n strings; iOS got comment/test tidy only.

### What replaced them

**Nothing replaced `shape_id` — it was removed, not substituted.** The replacement already existed and
predates the drop:

1. **Glyph geometry** is a shapeless square: `GLYPH_VIEWBOX = "0 0 200 200"`, `GLYPH_CANVAS = 200`,
   `GLYPH_STROKE_WIDTH = 6` (`apps/web/lib/config/glyphs.ts`, citing #278), fitted into the pebble slot at
   render time by `renderGlyphPaths`.
2. **Pebble outlines** come from baked-in engine templates: *"pebble *outlines* are rendered from baked-in
   engine templates (`apps/web/lib/engine/templates.ts`), not from `pebble_shapes`"* (log 2026-07-01).

Decisions recorded: *"Legacy glyph rows keep their original (sometimes non-square) `view_box`; they render
fine because the engine fits by viewBox. Geometry was intentionally NOT normalized."* And, categorically:
*"Reintroducing a glyph→shape association is out of the question — glyphs are squares."*
The spec adds why normalization was refused: *"Normalizing `view_box` would require transforming stored
stroke coordinates — risky, no user-visible benefit."*

### On "the nine hand-drawn valence shapes from April 2026"

**The premise as stated does not match the sources, and I flag it rather than infer.**

- `pebble_shapes` held **six** seeded rows, not nine: `river-smooth`, `creek-flat`, `moss-round`,
  `canyon-long`, `shore-wide`, `dusk-pebble` (`20260411000000_reference_tables.sql:94`). They were
  named/pathed lookup rows created 2026-04-11.
- The **nine** hand-drawn pebble drawings live in `apps/web/lib/engine/templates.ts` as nine
  `DoodleTemplate` constants — `HIGH_/MEDIUM_/LOW_ × NEGATIVE/NEUTRAL/POSITIVE` — indexed by
  `TEMPLATES[intensity][sentiment]` via `getTemplate(intensity: 1|2|3, positiveness: -1|0|1)`
  (`templates.ts:13-308`). Each carries its own `viewBox`, a hand-drawn `pebble-outline` path and a
  `glyphZone` rect. Nine also matches the iOS valence model: *"The valence input on the iOS pebble form is
  a plain `Picker` with nine [options] … nine PDF assets"*
  (`docs/superpowers/specs/2026-04-19-ios-valence-picker-design.md:10,73,88`).

So: **the nine valence shapes were never in `pebble_shapes` and were not affected by the 2026-07-01 drop.**
The drop removed a six-row lookup table that pebble rendering never consulted. The spec says so explicitly:
*"`pebble_shapes` is a confirmed orphan. Its only FK reference is `glyphs.shape_id`. Pebble *outlines* are
rendered from baked-in templates in `apps/web/lib/engine/templates.ts`, **not** from this table."*
Scope §"Out of scope" confirms: *"Any change to pebble-outline rendering (`templates.ts` is untouched)."*

For completeness on the nine shapes' later life (outside this act's scope but adjacent): they were
subsequently reworked by the petroglyph wobble (log 2026-07-13, 2026-08-24) and replaced as a *picker*
presentation by the valence fan on iOS/web (log 2026-08-24). **NOT FOUND:** any link between those changes
and `pebble_shapes`.

---

## 7. Question 6 — per-surface landing and differences

| | Web | iOS | Android |
|---|---|---|---|
| Wallet / karma rails | 2026-06-29, PR #499 (`/wallet` page, balance + paginated history + debt hint) | karma flash pastille 2026-07-01 PR #506; balance read from `PathStatsService.karma` (spec #507) | stats bar with karma 2026-07-16 PR #575; `PathStatsService.applyKarmaBalance` (Android D5) |
| Karma "+N" activity | 2026-06-30 PR #500 (Sonner pill, explicit-fire, credit-only) | 2026-07-01 PR #506 (in-app pastille, pass-through `UIWindow`, glass + haptic + ceramic sound) | karma flash shipped with the record flow 2026-07-13 PR #550 |
| Market | **2026-06-30, PR #501** | **2026-07-02, PR #508** (#507) | **2026-07-17, PR #593** (M43, #583–#587) |
| Admin moderation | 2026-07-01 PR #502 (`apps/admin`, English-only) | n/a | n/a |
| Tabbed picker | 2026-07-12 PR #546 (Mine · Owned · Community, inline buy) | 2026-07-12 PR #548 | in #593 (sub-project D, #587, closes #549) |

### Differences

**Tab naming and set.** Web `/glyphs` is **Mine · Favourites · Market** (#496 §7.1). iOS is
**Mine · Owned · Commu** (#507 goals). Android mirrors iOS with *"Commu"* as a literal label
(Android D3). The web *picker* uses a third naming — **Mine · Owned · Community** (2026-07-12 spec §1).

**Submission.** Web only. #507 non-goals: *"Glyph submission to the community (deferred)."*
Android non-goals: *"Submit-to-market and favourites (web-only on iOS too — not gaps)."*

**Favourites.** Web only (`glyph_favourites` table + heart). Explicitly out of scope on iOS
(*"web has it; not in this iOS task, not in the mockups"*) and Android.

**Buy interaction.** Web: a shadcn confirm dialog → `buyGlyph`, then a *"✨ Glyph unlocked · −N karma"*
Sonner pill (#496 D6, §7.1). iOS/Android: a **slide-to-confirm** drawer that *"morphs SWAP → OWNED in
place"*, with increasing haptics and (iOS) a pebbles-drop tick + bamboo success sound (#507 goals).
Android ships **haptic-only**: *"the audio half (bamboo clack) is deferred with `AudioService` left as a
scaffold"* (Android D6). A purchase never fires the karma-earned flash on any surface
(#496 D6; Android D5: *"Purchases never feed the karma flash"*).

**Backend work.** iOS needed **none**: *"By keeping the three social/attribution values as placeholders
for V1 … the whole feature is reachable with existing surfaces — **no migration, no new RPC**"* (#507).
Android likewise reuses the three iOS queries verbatim (Android D4).

**Drawer data.** iOS ships placeholders for usage count, owners count and creator handle
(*"muted 'Soon'"* / *"BY @community"*), because *"[t]wo of those values are cross-user aggregates behind RLS
and one is behind owner-only profile RLS"* (#507 §"Placeholders"). Real values: created date, cost, balance.

**Mine tab contents.** A named divergence, Android D7 verbatim: *"iOS `listMine` filters
`eq(user_id, me)`, silently dropping system glyphs from its picker; Android's M41 pre-flight deliberately
guaranteed own + system + entitled in the picker (souls default to a system glyph). Regressing that to
close #549 would shrink the picker's contract, so Mine = user-created (newest first) **then** system
glyphs."* Web's picker is Mine = `store.marks` (own) with system defaults deliberately absent from the
pebble picker (2026-07-12 §Non-goals: *"System default glyphs remain usable server-side (grandfathering +
souls' default) but are not offered in the pebble picker."*)

**Timing quirk on Android.** D6 verbatim: *"iOS fires success feedback at the threshold **before** the RPC
— ported as-is (named quirk)."*

**Store entry point on Android** was a reversal within its own plan: *"Store = pushed NavHost route from
the Profile Glyphs tile (**D11 reversal**)"* (Android D3). **NOT FOUND:** the text of the superseded D11.

---

## 8. Question 7 — reversals, regrets and rework

Ordered by date. Each is where a source admits something was wrong.

**1. `refund_karma` shipped user-callable, then revoked hours later (2026-06-29).**
`20260629193838_wallet_rpcs.sql` granted execute to `authenticated`; `20260629194418` is titled
*"Security fix"* and states: *"refund_karma must not be a client-callable karma mint … granting it to
`authenticated` lets any user mint karma via refund_karma(1_000_000, …)."* The #494 spec had already
written the rule in a comment; the first migration did not follow it.

**2. iOS Live Activity abandoned after device evidence (2026-07-01, #505).** The sharpest self-criticism in
the log. Verbatim: *"On-device testing (iPhone 15, iOS 26) showed `Activity.request` succeeding
(`state=active`) but **nothing rendering** in the notch, on the Lock Screen, or when backgrounded within the
window."* And: *"iOS does not render a foreground app's own Live Activity in the Dynamic Island, and karma
is **only ever earned by a foreground in-app action** — so the real DI can never show this flash.
**The concern was raised during brainstorming (Challenge 2), wrongly walked back, and confirmed by device
evidence.**"* Status field: *"Revises presentation decision **D3** of the #505 spec (Live Activity → in-app
pastille)."* The `PebblesWidget` extension, `KarmaLiveActivityController` and `KarmaActivityAttributes` were
**retained, unused**, as *"dead code until the Glyph feature adopts it."* The fix also required a
pass-through `UIWindow` at level `.alert + 1` and the app's first documented `if #available(iOS 26, *)`
exception.

**3. The server-side authorization gap in the glyph picker (2026-07-12, #545/#546).** The harmonization spec
is blunt: *"**Authorization gap (server):** `create_pebble` / `update_pebble` take `glyph_id` verbatim from
the payload and insert it with **no ownership check** (contrast the explicit collection-ownership check in
the same RPC). Souls write `glyph_id` directly to the `souls` table, also unchecked. The client is the only
gate, so any client — web, iOS, Android — can attach a glyph the user does not own."* Fixed by
`can_use_glyph` + RPC guards + a `souls_glyph_usable` trigger (`20260712000000`). The user-reported symptom
("I can pick glyphs I never made or bought") was diagnosed as mostly the admin-ownership side effect, not a
leak — see §5 — but the guard shipped anyway: *"the server guard below makes any residual leak
non-exploitable."*

**4. A latent bug found while recreating a function (2026-07-12).** Same spec/migration: *"Recreating
`update_pebble` also **drops its stale `shape_id` reference** in the inline `new_glyph` INSERT (the
`glyphs.shape_id` column was removed in `20260701114205`; the current `update_pebble` body still references
it and would fail on an inline-glyph update — a latent bug fixed here as a side effect of the recreate)."*
That is: for eleven days, an inline-glyph pebble edit would have failed in production.

**5. A migration that would have silently re-opened the hole (2026-07-13, #551).** Commit message verbatim:
*"`20260712000000_update_pebble_drop_glyph_shape.sql` shared its version with the already-merged
`20260712000000_glyph_usability_guard.sql` (#546) and recreated `update_pebble` from the pre-guard
`20260426000002` baseline, dropping the `can_use_glyph` ownership guard now live in production. On a fresh
db reset it would sort after the guard migration and overwrite the guarded function, re-opening the
glyph-entitlement hole #545/#546 closed."* Resolution: delete the 228-line file.

**6. The web karma mirror had drifted from the ledger (2026-07-29, #630/#621).** Commit verbatim:
*"`apps/web/lib/data/karma.ts` drifted from the SQL RPC: it was missing the 4-card cap and the overall
10-point clamp, so pebbles with 5+ non-empty cards showed an optimistic karma delta higher than what the
ledger actually credits."* Fixed with a unit test pinning both caps *"so the mirror can't silently drift
again."*

**7. Account deletion exposed three traps the market had built (2026-07-29, #631).** Log verbatim:
*"a naive delete-everything hits three traps: buyers hold `glyph_entitlements` on the seller's glyphs
(cascade would revoke paid-for content), `souls.glyph_id` is `ON DELETE RESTRICT` (another user's soul can
reference the deleting user's glyph after an `admin_attribute_glyph` reattribution, so the delete would
hard-fail), and `glyph_submissions.submitter_id` was `NOT NULL`."* The resolution reuses the pre-existing
system state: externally-referenced glyphs are set to `user_id = null` and their submissions delisted, so
*"buyers keep rendering with zero schema surface added"*. Two admissions in the consequences:
*"Anonymized glyphs become de-facto commons (usable by all) — accepted"*, and an
*"[a]ccepted race: a `buy_glyph` committing mid-purge can leave a `glyph_sale` event that blocks
`deleteUser`; the re-run converges."* The purge deliberately uses a predicate *"wider than the roadmap's
'sold' so the purge converges under every FK the schema actually has, not just the marketplace one"*
(`20260729201326` header).

**8. The append-marker convention proved not collision-safe (2026-07-31, #687).** Two branches each
re-emitted `purge_account` off the same base; the merged history *"silently lost `connections`,
`connection_invites` and `connection_blocks`"*. Verbatim: *"Both branches were green: each replayed cleanly
on its own, the collision only exists in the merged order."* Not glyph-specific, but it is the mechanism by
which the market's own `purge_account` appends could be lost.

**9. Deferrals recorded as such (not regrets, but open debts).**
- Filled-glyph render mode: *"a filled-glyph render mode would ripple across web + iOS — deferred"* (#497).
- `spend_karma`'s reason whitelist is `('purchase')` only.
- `refund_karma` has no purchase validation at all — the service-role grant is the only safety.
- Sales analytics: *"'Glyph value' stays a derived aggregate … never a stored column"* (#496 D4);
  #497 §8 confirms analytics views are *"a future issue"*.
- Creator payouts beyond the flat net-zero transfer: *"Future royalty/revenue-share models would build on
  `glyphs.user_id`"* (log 2026-07-01). **NOT FOUND:** any later royalty/revenue-share work.
- Known pre-existing quirk logged in #507 and only fixed five days later by #546/#548:
  *"`GlyphPickerSheet` … calls `GlyphService.list()`, which since the marketplace migration returns approved
  community glyphs via widened RLS — so the picker may show glyphs the user hasn't carved or bought."*

---

## 9. Where sources disagree, and what is missing

**Disagreements found (all minor, all spec-vs-shipped):**
1. `submit_glyph`/`buy_glyph` return types: spec #496 §4 says `uuid` / `table(...)`; shipped as `jsonb`
   (`20260630003348`).
2. #496 §4.1 specifies a `not_custom` error for system seeds; the shipped function raises `not_owner`
   with an inline comment saying it covers that case.
3. #497 §3.5 specifies `publish_admin_glyph(p_name, p_shape_id, p_strokes, p_view_box, p_price)`; the
   parameter was removed four days later by #503 (`20260701114205`), so the spec text is stale by design.
4. Decision log 2026-06-29 says *"New spend-side reasons go through `spend_karma`"*; the shipped
   `spend_karma` rejects every reason except `'purchase'`. Both are true only if "go through" means
   "editing that guard".
5. The task premise "nine hand-drawn valence shapes [in] `pebble_shapes`" does not hold: `pebble_shapes`
   had six rows; the nine valence drawings are `templates.ts` constants and were untouched. Detailed in §6.

**NOT FOUND:**
- Any karma/glyph/market decision, spec, migration or shipped deliverable between **2026-08-01 and
  2026-09-02**. The economy work is a five-week burst (2026-06-29 → 2026-07-31); the "to September" span
  of the subject is, in the sources, a period of silence in this area.
- Any glyph *submission* UI on iOS or Android.
- Any glyph favourites UI on iOS or Android.
- Any sales-analytics view over `price_paid`.
- The superseded text of Android decision "D11" referenced by Android D3.
- Any second good sold in the Pebblestore (themes, pebbleskins) — named repeatedly as future
  (#494 non-goals, #496 §8, #497 §8) and never shipped in the window.
