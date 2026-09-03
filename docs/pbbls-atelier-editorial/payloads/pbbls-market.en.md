---
name: Nothing changes hands
description: A glyph sale in Pebbles moves no money, mints no karma and copies no drawing. It writes one row — and that row is most of the design.
date: 2026-09-02
bean: pbbls-market
---

# Nothing changes hands

Someone draws a small symbol — a wave, a key, a cat with one ear too high — and
sends it to the shop. Weeks later somebody else wants that symbol on a memory of
their own, and pays for it in karma they earned by recording things they actually
lived. No money moves. No karma is created. The drawing does not go anywhere: one
set of strokes, still the first person's.

Karma, badges and the market exist to reward the habit and sustain it, not to
imprison anyone. Karma is earned by recording — which means having lived something
first — and spent on glyphs that decorate memories made outside the app.
Time-in-app is not the metric.<!-- src: case-study spec §4, author 2026-09-02 -->

[INTENTION? — I could not source the why here. Proposal: the glyphs on sale are
supplied by other pebblers rather than by a house set, so the symbols in someone's
journal are drawn by people who record too. Accept, rewrite, or cut at review.]

## What a purchase writes

A purchase does not copy the glyph. It writes an entitlement: one row naming the
buyer, the glyph, the karma event that paid for it, and the price at that moment.
The decision is written as a single sentence — buying grants use-rights, not a
copy — and the rest follows from it. One source of truth. The creator keeps
authorship. No strokes are duplicated anywhere.<!-- src: docs/decisions/log.md 2026-06-30 #496 D1 -->

That row is not something a client can write. The entitlements table has a policy
for reading your own rows and no insert policy at all, so the only way a row
appears is through the purchase function running with the database's own
authority.<!-- src: migrations/20260630003348_glyph_marketplace.sql -->

The price column on that row is a snapshot, not a reference. A listing's price can
be changed later by the back office, and when it is, every entitlement already
written keeps the number its buyer actually paid.<!-- src: docs/decisions/log.md 2026-06-30 #496 D4 -->
So the history of a glyph stays readable after the glyph gets more expensive.

What a glyph must do before it can be bought at all — pass review, be approved,
stay listed — belongs to glyph moderation. Why the drawing goes
read-only the moment it is submitted belongs to :entity[The drawing you can no longer change]{ref=bean:pbbls-d8}.

## The transfer that mints nothing

The buy function is a single transaction, and it runs in order. It reads the price
from the approved listing server-side, so the client never supplies it. It refuses your own
glyph. It refuses a glyph you already own. It spends the buyer's karma through the
wallet's spend path, which is where the overdraw guard lives
(:entity[A wallet with no floor]{ref=bean:pbbls-wallet}). Then it credits the glyph's owner the full price
as a sale event on the same ledger.

Buyer down, creator up, same amount, same transaction. The log calls it a net-zero
transfer, and the reason is one line: net-zero keeps the economy
closed.<!-- src: docs/decisions/log.md 2026-07-01 #497 -->
Nothing in the market can make karma. Karma is made by recording something, and
that is the only place it is made.

The order of those steps is what protects the buyer. Karma leaves first; the
entitlement is written second; and the entitlements table carries a unique
constraint on the pair of buyer and glyph. So if two purchases of the same glyph by
the same account land at the same instant, the second insert fails, and the failure
takes its own transaction down with it — including the spend. Verbatim: "a
concurrent double-buy rolls back the loser's spend too, so a buyer is charged at
most once."<!-- src: migrations/20260630003348_glyph_marketplace.sql, buy_glyph -->
The constraint that keeps the row honest is the same constraint that keeps the
balance honest. There was no need for a second mechanism.

## One column carries the creator

There is no `credited_to` column, no payee table, no separate notion of the person
who gets paid. The glyph's owner column does all of it: whose gallery the glyph
appears in, who the buy function compares you against when it refuses to let you
buy your own work, and where the sale credit is
sent.<!-- src: docs/decisions/log.md 2026-07-01 #497 -->

That is why reattribution is one write. First-party glyphs are uploaded by the
admin account and are therefore owned by it, and paid to it. When one of them
belongs to a real person, an admin looks them up by email and the attribution
function does literally one thing: set the owner column to that user. From then on
the glyph sits in their gallery, they cannot buy it, and sales pay
them.<!-- src: migrations/20260701102810_glyph_marketplace_curation.sql, admin_attribute_glyph -->
From then on, and not before — the ledger is append-only, so a reattribution
changes who the next sale pays, never who the last one paid.

The same column is where a royalty model would have to start, and the log says so
in as many words. That work has not been started.

## The number that is never stored

There is no "value" on a glyph. Not a column, not a counter, not a cached total.
How many people own it and what it has earned are computable at any moment by
summing the entitlements, because every purchase kept its own price. The rule is
recorded as such: glyph value stays a derived aggregate, never a stored
column.<!-- src: docs/superpowers/specs/2026-06-30-issue-496-glyph-marketplace-design.md D4 -->

The reasoning on the record is unglamorous: capture the data, defer the analytics.
A stored counter is a number somebody has to keep true, through every re-pricing,
refund and deletion, forever. A derived one is only ever as wrong as the rows
underneath it, and the rows are the receipts.

The cost is real and it is visible in the product. Owners count and usage count are
cross-user aggregates sitting behind row-level security, so they are not cheap to
read from a client, and the phone drawer that would show them shipped with the slot
drawn and the value replaced by the word "Soon". The follow-up was described in the
spec as one small read function. It has not
landed.<!-- src: docs/superpowers/specs/2026-07-01-issue-507-glyph-swap-ios-design.md §Placeholders -->
The history is being kept faithfully and nobody is reading it yet.

[TO VERIFY: the spec specifies the placeholder copy as a muted "Soon" and marks the
exact wording as a visual detail to finalise during implementation. I have not
confirmed which string shipped.]

## Sliding instead of clicking

The market opened on the web on 30 June 2026, with a confirmation dialog and a
"Glyph unlocked" pill afterwards.<!-- src: apps/web/lib/i18n/messages/en.json activity.glyphUnlocked -->
The web is also where the other half of the
market lives: submitting your own glyph, and favouriting somebody else's. Neither
went to the phones — recorded as deferred on iOS and as "not gaps" on
Android.<!-- src: docs/superpowers/specs/2026-07-01-issue-507-glyph-swap-ios-design.md §Non-goals -->

iOS got it on 2 July 2026 and does not use a dialog. Tapping a community glyph
opens a drawer with a slide-to-confirm control that gives more haptic feedback as
it travels, and when it completes, the drawer morphs SWAP → OWNED in place rather
than closing.<!-- src: apps/ios/Pebbles/Features/Glyph/Views/GlyphDetailDrawer.swift -->
Android shipped the same drawer on 17 July, haptics only; the sound half was
deferred with its audio service left as a scaffold.

The phones also say something about the entitlement. iOS needed no migration and
no new function to ship the whole feature, and Android reused the iOS queries
verbatim. A purchase
that writes one row, with the price on the row, is a purchase every surface can
make with the reads it already
had.<!-- src: docs/superpowers/specs/2026-07-01-issue-507-glyph-swap-ios-design.md §Backend -->

## Where it stands

The market is live and behaving. It was built fast: the wallet, the market,
moderation and curation all shipped between 29 June and 31 July 2026, web first,
then iOS, then Android. Nothing has shipped in this area since. Other priorities
took the summer.

Two things named as next are still named as next. The store was designed to sell
more than glyphs — themes and pebbleskins are written down as future goods in three
separate specs, and the buy path was shaped so a second good could reuse
it.<!-- src: #494/#496/#497 non-goals -->
Neither exists. The spend function still accepts exactly one reason, `purchase`, so
the second good starts with editing that guard; the edit is small and the guard is
where you would look for it.

Creator pay is still the flat transfer: one sale, one payment, full price, once.
The open question is whether that is the right pay for something that keeps being
used after it is bought. A glyph that ends up on a thousand pebbles pays its author
the same way as one that ends up on two. The log notes royalties as a future model
built on the owner column. That is the right column to start from. There is no date
on it.
