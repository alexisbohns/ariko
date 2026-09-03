---
name: A wallet with no floor
description: The karma ledger in Pebbles will let your balance go below zero. That was a refusal rather than an oversight — here is what it protects, and what stops you overspending instead.
date: 2026-09-02
bean: pbbls-wallet
---

# A wallet with no floor

You delete a pebble. Wrong day, bad day, or you recorded it twice. Recording it
earned you karma at the time, so deleting it takes that karma back — and if you
have already spent it, your balance goes below zero and stays there until you
record something else.

That is not a state you found by accident. It is the one thing the ledger was
built to allow.

Karma exists to reward the habit and keep it going, not to hold anyone in place.
You earn it by recording, which means having lived something first, and you spend
it on glyphs that decorate memories made outside the app. Time in the app is not
the metric.<!-- src: case-study spec §4, author 2026-09-02 -->
Which leaves the currency with one thing it may never do: get between a person
and their own record.

## One ledger, and everything is a row in it

`karma_events` is append-only. The balance is the sum of it. Nothing is ever
overwritten — a correction is another row, a purchase is another row, a deletion's
clawback is another row — and a small snapshot table carries the running total so
the balance can be read and locked in one place.<!-- src: docs/decisions/log.md 2026-06-29 #494 -->

Rows carry a direction as well as a sign, and the two are not the same thing. The
direction is the category of movement: earn-side or spend-side. A deletion
clawback is a negative number on the earn side; a refund is a positive number on
the spend side. Keeping those apart is what lets the wallet page say "total
earned" and "total spent" and have both be true.<!-- src: spec 2026-06-29-issue-494-karma-wallet-design.md §Core design decisions 2 -->

Earning is a small fixed sum, computed once per pebble: a point for recording at
all, and a point each for the things you put in it — a description, a soul, a
domain, a glyph, a photo, the cards — then the whole thing is capped at ten. As
of 2 September 2026 a community glyph lists at 25 karma by default, so the
cheapest thing in the shop costs about three well-filled pebbles.<!-- src: migrations/20260411000003_rpc_functions.sql compute_karma_delta; 20260630003348_glyph_marketplace.sql -->

[INTENTION? — I could not source the why for the ceiling of ten. Proposal: a
pebble is capped so that filling one in is worth something and grinding one is
worth nothing, because the karma is meant to follow a lived moment rather than
the effort of typing. Accept, rewrite, or cut at review.]

## The floor that was refused

The obvious guard is one line. Put `CHECK (balance >= 0)` on the balance column
and no account can ever go under. It was refused, and then written down twice so
it would stay refused.<!-- src: docs/decisions/log.md 2026-06-29 #494 consequences; migrations/20260629193636_wallet_balances.sql header -->

Deletion is why. Deleting a pebble sums everything that pebble ever earned and
writes the negative of it back to the ledger. With a non-negative constraint in
place, that write fails whenever the karma has since been spent — and the failed
write takes the delete with it. The result is somebody unable to delete a memory
because they had already spent what recording it paid them.

The log puts it in fewer words: "Coupling pebble deletion to wallet state would be
wrong UX, so clawbacks must always apply even into the negative — a column CHECK
would roll back a legitimate delete."<!-- src: docs/decisions/log.md 2026-06-29 #494 -->
The consequence is recorded as a standing rule rather than a preference — do not
add that constraint, it would break pebble deletion — and the migration repeats
it inline, at the exact spot where the next person would be tempted.

So the debt is real and it is shown. The wallet does not clamp the number to zero
or hide the history that produced it; a negative balance appears as a negative
balance, with one line under it: earn karma to clear your balance before you can
shop again. The spec asked for exactly that, in those terms — honestly, never
hidden, never alarming.<!-- src: spec §Wallet page 2; apps/web/lib/i18n/messages/en.json wallet.debtHint -->

## What stops you overspending instead

The guard did not disappear. It moved up one level, from the column to the
function that spends.

Every purchase in the product goes through `spend_karma`. It takes a row lock on
your balance, compares it to the price, and refuses with `insufficient_karma` if
it falls short. The lock is what makes two devices buying at the same moment
behave: the second one reads the balance the first one left, rather than the one
it started with.<!-- src: migrations/20260629193838_wallet_rpcs.sql -->

You can end up negative. You cannot spend your way there. And debt needs no
special handling at the till, because a balance below zero is already below every
price.

The same function accepts exactly one reason for spending, `purchase` [which is a
narrow door for a store that was designed from the start to sell more than
glyphs]. How a purchase stays atomic with the thing it grants belongs to
:entity[Nothing changes hands]{ref=bean:pbbls-market}; why a listed glyph stops being editable belongs
to :entity[The drawing you can no longer change]{ref=bean:pbbls-d8}.

## The refund, and who may call it

`refund_karma` puts a spend back. It takes an amount and a reference and writes a
positive row on the spend side. What it does not do is look for the purchase it
is reversing — there is no validation against an original, by design and still
today.

The spec had already written down who should be allowed to call it: trusted
server and admin logic, and nobody else. The migration that shipped the function
granted execute to `authenticated` — which is every signed-in account. The next
migration, timestamped under six minutes later and titled "Security fix", revoked
that grant and gave it to `service_role` instead.<!-- src: migrations/20260629193838_wallet_rpcs.sql vs 20260629194418_restrict_refund_karma_to_service_role.sql -->

Its header says what changed and why: "As written it has no validation against an
original purchase, so granting it to `authenticated` lets any user mint karma via
refund_karma(1_000_000, …). Refunds are issued by trusted server/admin logic
only."<!-- src: migrations/20260629194418_restrict_refund_karma_to_service_role.sql header -->
It also says why the client never needed the function: a failed grant rolls back
the spend in the same transaction, so a buy that goes wrong has nothing left to
undo from outside.

The permission is the whole of that function's safety, and it is written down as
being the whole of it rather than assumed.

## Where it stands

The economy is live and behaving. Karma stopped being a score and became a
currency on 29 June 2026; the wallet, the market, moderation and curation
followed over the next month, web first and then iOS and Android. The last
decision recorded in this area is dated 30 July 2026, when achievements began
paying karma through a credit reason the ledger had been holding open for them —
that is badges.<!-- src: docs/decisions/log.md 2026-07-30 #664 -->

[TO VERIFY: the bean slug for the achievements/badges piece — I used
`pbbls-badges`.]

Nothing has shipped in this corner since the end of July. The summer went to
other parts of the product,
and the intention to carry this further has not been withdrawn — the store was
shaped for a second good, and creator pay is still the flat transfer the log
describes as a starting point rather than a model. What becomes of a sold glyph
and its ledger rows when someone deletes their account is
account deletion.

Two things stay open and are named as open. `spend_karma` accepts one reason, so
a second kind of purchase means editing that guard rather than adding a row.
`refund_karma` still has no check against an original purchase, so the
service-role grant is the only thing between it and a mint.
