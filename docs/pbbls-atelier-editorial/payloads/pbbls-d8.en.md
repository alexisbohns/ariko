---
name: The drawing you can no longer change
description: A glyph in the Pebbles market goes permanently read-only for the person who drew it — here is the reasoning that made that the right answer, and what it cost.
date: 2026-09-02
bean: pbbls-d8
---

# The drawing you can no longer change

A glyph goes read-only the moment you submit it to the shop. Not mostly read-only.
You draw a cat, you send it for review, you notice the left ear sits too high —
and the database says no.

Get rejected and you get it back. Get approved, and once somebody owns a copy it
is out of your hands for good.

Two things motivated the read-only lock. The first was delete: if a creator could
remove a glyph, everyone who'd paid for it would watch it disappear off their
pebbles. The second is what a buyer is actually paying for — not a cat, but those
strokes, in that order, wobble included.<!-- src: docs/decisions/log.md 2026-06-30 D8 #496 -->

Underneath both of those is what the market is for. Karma, badges and the market
exist to reward the habit and sustain it, not to imprison anyone. Karma is earned
by recording, which means having lived something first, and it is spent on glyphs
that decorate memories made outside the app. Time-in-app is not the metric.<!-- src: case-study spec §4, author 2026-09-02 -->

[INTENTION? — I could not source the why here. Proposal: the glyphs are
community-supplied rather than a house set so that the symbols on someone's
pebbles come from other pebblers rather than from a design team. Accept, rewrite,
or cut at review.]

## Where the refusal lives

The glyph page in the web app hides its edit and delete buttons once the glyph is
in the market, and puts a "Listed — locked" badge where they were. That is the
courteous version. The real one is two row-level policies: `glyphs` UPDATE and
DELETE were rewritten so the creator's clause fails as soon as the glyph has an
active submission or a single entitlement against it.<!-- src: migrations/20260630003348_glyph_marketplace.sql -->
The reason it lives there rather than in the interface is written down — a
frontend-only guard is bypassable via the raw update path.<!-- src: docs/decisions/log.md 2026-06-30 D8 -->

The lock closes earlier than the sale. It closes at submission. From the moment a
glyph enters the review queue its strokes are fixed, and a rejection releases it
again: the index only blocks a pending or approved row, so a refused glyph can be
redrawn and sent back. An approval followed by one purchase does not release it.

There is one exemption in the policy, and it is a role rather than a person: an
admin can write to a locked glyph, because curating listings is the back office's
job. What the back office does with that permission is set a price, delist,
reattribute, delete. None of it moves a stroke. There is no screen anywhere that
lifts that ear, mine included.<!-- src: apps/admin/app/(authed)/pebblestore/glyphs/actions.ts -->

[TO VERIFY: the approved line "To me as well" reads as a refusal at the database
level. The row policies actually exempt `is_admin` from UPDATE and DELETE; the
claim holds one level up, because no admin surface edits geometry, and it is
written that way here.]

## What a buyer holds

Buying a glyph does not copy it. The purchase writes an entitlement — a row saying
this person may use that glyph — and the strokes stay where they are, one set of
them, still authored by whoever drew them.<!-- src: docs/decisions/log.md 2026-06-30 #496 D1 -->

That single source of truth is what makes delete the first reason and not the
second. Entitlements fall with the glyph. A creator holding a delete button holds
a button that revokes every purchase at once, and the buyers find out by opening
their pebbles. Editing is the same event in slow motion: the cat you paid for
becomes a different cat, and nobody asked you.

How the purchase is made atomic, what a listing costs, and what becomes of a sold
glyph when its creator deletes their account belong to
:entity[Nothing changes hands]{ref=bean:pbbls-market} and account deletion.

## The admin who cannot see the queue he is reviewing

The read half of the same policy has a consequence one step further out.

A glyph is readable if you own it, if it has no owner, if it is approved, or if
you bought it. A pending submission is none of those. So the person reviewing the
queue could not read the strokes of the thing being reviewed. That is not a hole
in the moderation tool. The moderation tool was obeying the market's rule like
everybody else.

[INTENTION? — I could not source the why here. Proposal: submissions are reviewed
by a person before they reach the market because a symbol somebody will carry on
their own memories is not something to let in automatically. Accept, rewrite, or
cut at review.]

There were two ways out: widen the read policy to admins, or widen it to pending
rows. Either one makes the market's rule less exact in order to serve one screen.
What shipped instead is a `SECURITY DEFINER` read function carrying its own
`is_admin` check, joining the geometry server-side and returning the queue
oldest-first. The migration header says why: "the queue read path exists because
the widened glyphs_select (D8) does NOT let an admin read a *pending* submission's
strokes via RLS."<!-- src: migrations/20260630084718_admin_glyph_moderation.sql header -->

The trade is legible. The rule stays narrow, and the exception is one function, in
one file, with its own guard — rather than a permission quietly added to a policy
every client in the product depends on.

## The half the lock did not cover

Locking the strokes settled who may change a glyph. It said nothing about who may
attach one. Those are separate questions and only the first had an answer in the
database: the two functions that write a pebble took a glyph id straight from the
payload and inserted it without an ownership check, and souls wrote theirs
directly to the table. The client was the only gate, which means every client —
web, iOS, Android — was the only gate.<!-- src: docs/superpowers/specs/2026-07-12-glyph-picker-store-harmonization-design.md -->

It surfaced as a user report: I can pick glyphs I never made or bought. Most of
that turned out to be a different and truthful thing — first-party glyphs are
owned by the admin account, so for that one account they genuinely are "Mine" —
but the missing check was real underneath it. On 12 July 2026 a `can_use_glyph`
function went in, wired into both pebble writes and a trigger on souls, so
entitlement is now checked where the glyph is used and not only where it is
edited.<!-- src: migrations/20260712000000_glyph_usability_guard.sql -->

## What the lock costs

The creator's side of it is small and real. You cannot fix the ear. You cannot
change your price; that is the reviewer's. You cannot pull the glyph back once a
copy is out. What you have left is to not submit it, or to ask.

That cost is paid by one person to protect another. The karma a buyer spent was
earned by recording something they actually lived, so what it bought has to keep
being what it was. The log's word for the alternative is bait-and-switch.<!-- src: docs/decisions/log.md 2026-06-30 D8 context -->
The submit dialog says so before you commit: once submitted, you can no longer
edit or delete it.<!-- src: apps/web/lib/i18n/messages/en.json glyphs.submit.confirmDescription -->

The reviewer's side is a note. A rejection requires a written reason, stored on
the submission and shown to the submitter on their own page.<!-- src: docs/decisions/log.md 2026-06-30 #497 -->
That is the market's only channel back to the person who drew the thing, and it
only opens on a refusal.

## Where it stands

The economy is live and behaving. Karma, the wallet, the market, moderation and
curation shipped between 29 June and 31 July 2026 — web first, then iOS, then
Android — and nothing has shipped in this area since. Other work took the summer.

The store was designed to sell more than glyphs. Themes and pebbleskins are
written down as future goods, and the buy path was shaped so a second one reuses
it. Neither exists yet. Creator pay is still the flat transfer; the log notes that
a royalty or revenue-share model would build on the same owner column, and that
work has not started.<!-- src: docs/decisions/log.md 2026-07-01; #494/#496/#497 non-goals -->

The open question is not the lock. The lock does what it says. It is what a
creator does when they want a change made after the sale. Today, nothing.
