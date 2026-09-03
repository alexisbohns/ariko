---
name: Karma & the Glyph Market
description: The economy inside a private journal — what the currency is for, why nothing in it can mint, and why the symbols on sale were drawn by other people.
pod: pbbls-karma
---

An economy inside a private journal only makes sense if you can say what it is
for. Karma, badges and the market exist to reward the habit and to sustain it,
not to imprison anyone. Karma is earned by recording, which means having lived
something first, and it is spent on glyphs — small hand-drawn symbols — that
decorate memories made outside the app. The aim is to send someone out into
their life to collect something worth keeping. Time-in-app is not the
metric.<!-- src: case-study spec §4, author 2026-09-02 -->

That last line is the one the design has to keep, and it keeps it in arithmetic
more than in copy.

Nothing in this territory makes karma. A sale moves the price from the buyer to
the person who drew the glyph — same amount, same transaction — so the market
cannot mint.<!-- src: docs/decisions/log.md 2026-07-01 #497 -->
Recording is the only place karma comes from, and a pebble pays a small fixed
sum: a point for recording at all, a point each for the things you put in it,
capped at ten. As of 2 September 2026 a community glyph lists at 25 karma by
default, which is about three well-filled pebbles for one
symbol.<!-- src: migrations/20260411000003_rpc_functions.sql; 20260630003348_glyph_marketplace.sql -->

The ledger also refuses to protect itself. There is no floor at zero. Delete a
pebble and the karma it once paid comes back out, even if you have spent it, and
the balance sits below zero until you record something else. The obvious guard —
a constraint forbidding a negative balance — is one line, and it was refused,
then written down twice so it would stay refused: that line makes deleting a
memory fail for anyone who had already spent what recording it
earned.<!-- src: docs/decisions/log.md 2026-06-29 #494 -->
The currency is not allowed to come between a person and their own record.

The stock is not the house's either. Glyphs on sale are drawn by pebblers,
reviewed, priced and listed; buying one grants the right to use it, never a copy,
and the strokes stay with whoever drew them.

[INTENTION? — this question is now marked in three pieces and could be answered
once for all of them. Proposal: the market is stocked by pebblers rather than by
a house set so that a symbol somebody puts on their own memory was drawn by
someone who records too. Accept, rewrite, or cut at review.]

April's onboarding made a promise in two clauses: *"No streak to protect, no feed
to scroll."* The second is kept absolutely, and the decree that keeps it was
written before any of the code it binds. The first is complicated. Bounce, the
regularity rank, has existed since April 2026; what changed in July is that it
became visible on a public profile. No decision entry anywhere acknowledges that
change, and it is better said here than tidied
away.<!-- src: apps/web/lib/i18n/messages/en.json onboarding since PR #100; journal PRs #675/#677; digest act3-community-trust R2 NOT FOUND -->

[INTENTION? — I could not source a position on the streak clause. Proposal:
bounce was always a rank on a moving window rather than a chain that breaks, so
July made it social rather than punishing. Accept, rewrite, or cut at review.]

The written pieces are these. :entity[A wallet with no floor]{ref=bean:pbbls-wallet} is the ledger and
its missing floor. :entity[Nothing changes hands]{ref=bean:pbbls-market} is what a purchase actually
writes: one row, no copy, no minting. :entity[The drawing you can no longer change]{ref=bean:pbbls-d8} is the drawing
its own author can no longer touch once somebody has paid for it. Badges are the
piece not yet written — permanent by design, with no revocation path to forget
about, paying karma at unlock into the same wallet.

Where it stands: the economy was built in one burst. The wallet shipped on
29 June 2026, then the market, then moderation and curation — web first, then
iOS, then Android — and nothing has shipped in this area since 31 July. It is
live and behaving. The second good the store was shaped to sell, themes and
pebbleskins, is named as forthcoming in the specs and does not exist. The work is
not finished and has not been withdrawn; other parts of the product took the
summer.
