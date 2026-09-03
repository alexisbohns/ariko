---
name: The connection you cannot search for
description: In July 2026 Pebbles learned to let two people see each other — and almost every decision in that feature is about what it refuses to become.
date: 2026-09-02
bean: pbbls-connections
---

# The connection you cannot search for

You have a pebble you want one person to see. Not everyone. One person — the
friend who was actually there. Until the end of July 2026 Pebbles could not do
that at all. Every table in the database was scoped to a single account, and a
journal that had never let two people meet had no idea how to introduce them.

The hard part was not the schema. It was deciding how far "let people see each
other" was allowed to go. The onboarding shipped in April 2026 with a promise: *"No streak to protect, no feed
to scroll."*<!-- src: apps/web/lib/i18n/messages/en.json onboarding, since PR #100 2026-04-04 -->
The second half of that is kept absolutely. No feed, no directory, no search, no
follower graph. Connections exist so you can hand one memory to one person, not
so you can collect people.<!-- src: case-study spec §4, author 2026-09-02 -->

## The decision that came before the code

On 28 July 2026 the store-launch roadmap listed four product decisions taken
before a single milestone under them had a design doc. The fourth one reads:
"Connection discovery — invite link / QR only. No search, no directory, no
follower graphs. Symmetric connections only: accepting an invite *is* the mutual
consent."<!-- src: docs/superpowers/specs/2026-07-28-store-launch-roadmap.md:10 -->

That is a product writing down what it refuses to become, before there was any
code to argue with. Everything after it is enforcement.

There is no screen where you type a name and find a person. There is no list of
who somebody else knows. The only way in is a link they gave you or a code you
scanned off their phone. The design doc treats widening the profiles table — the
obvious first step towards a lookup — as closed rather than costly: the
owner-only rule has been there since the first schema, and adding a
"display columns only" policy to it is "banned outright".<!-- src: docs/superpowers/specs/2026-07-29-mutual-connections-design.md D4 -->

So everything that crosses between two users goes through a function that builds
its own explicit list of what may leave: a display name, and the strokes of the
glyph someone uses as their mark. Never a profile row. The accept screen says
the same thing in one line before you tap: "Connections see each other's name and
glyph. Nothing more."<!-- src: apps/web/lib/i18n/messages/en.json connections.acceptSubtitle -->
Handles and public pages are a different question and live in
handles and public profiles.

The invite token is 32 random bytes. Nothing is enumerable against that, which
is what lets the refusal of search be a real boundary rather than a missing
feature a script could route around.<!-- src: mutual-connections-design.md D2, D4 -->

## One row, not two halves that can disagree

A connection is a single row holding both people, with the two ids stored in a
fixed order and a uniqueness constraint across the pair. There is no status
column on it. Accepting the invite *is* the mutual consent, and the invite table
is the pending state.<!-- src: docs/decisions/log.md 2026-07-30 #658 -->

Two mirrored rows — one for each direction — was the obvious alternative and was
rejected for being two things that can disagree. It turns row counts into an
invariant somebody has to maintain, and reading, removing and purging into
double-entry bookkeeping. One ordered pair with an ignore-on-conflict insert
gives idempotency structurally, for free.<!-- src: mutual-connections-design.md D1 -->

That matters because of how the thing is actually used. The invite is multi-use
and lives seven days, because the picture in the design doc is a QR code on a
phone at a dinner table: re-scans, double-taps and network retries are the
*normal* case, not the edge one. So accepting an invite you already accepted
succeeds and reports that you were already connected, rather than raising an
error three clients would each have to special-case. Re-opening your invite
screen returns the invite you already have instead of minting a new one, so a
link pasted into a chat yesterday does not quietly die because you looked at the
screen today.<!-- src: mutual-connections-design.md D3, D5 -->

## Blocks, on the first day

Blocking shipped with the feature rather than after it. The immediate reason is
external: Apple's guidelines require it of anything with user-to-user content at
launch. The shape it took is not.<!-- src: docs/decisions/log.md 2026-07-30 #658 context -->

A block is one directed row — the remover blocks the removed. The alternatives
are recorded and refused. A symmetric double row says nothing the single row does
not already say. Auto-revoking the remover's invite when they block someone was
turned down in a sentence worth keeping: it "punishes the other N dinner guests
for one bad actor".<!-- src: mutual-connections-design.md D6 -->

Then the block check itself. When someone accepts an invite, it runs in both
directions, and where it finds a block it raises `invite_expired` — the same
error a genuinely dead link returns. The block
row itself is readable only by the person who created it; the blocked account's
session cannot see that the row exists.<!-- src: migrations/20260730070347_mutual_connections.sql, connection_blocks_select policy and accept path -->
The internal note calls it deliberately indistinguishable from real expiry, so a
block is never revealed to either party.<!-- src: mutual-connections-design.md D5 -->

It runs both ways for a plain reason: a block means one party wants no relation,
and checking only one direction would let the blocker reconnect by scanning the
blocked person's invite. And it defends the remover's still-live invite
retroactively, without touching the invite at all — the blocked peer scanning
that same QR gets an expired link, while everyone else at the table keeps using
it.

The migration writes its own limit next to the line that does the masking: the
invite preview is block-unaware by design, and third parties keep succeeding on
the same token, so someone comparing a valid preview against an expired accept
can infer what happened. That is recorded as accepted, in the comment above the
check.<!-- src: migrations/20260730070347_mutual_connections.sql accept path comment -->

## What the refusals cost

Every refusal here costs something.

No search means you cannot find a friend who already uses Pebbles. Somebody has
to hand you something.

No notifications means nothing tells you a connection was accepted; it is simply
there the next time you open the app. There is no push infrastructure in the
product and no realtime anywhere in it, so this is house practice as much as a
choice here.<!-- src: roadmap :28, :91; house constraints §2 -->

[INTENTION? — I could not source the why here. Proposal: an accepted connection
appearing quietly on next open rather than arriving as an alert is the same
refusal as the missing feed, applied to the smaller surface. Accept, rewrite, or
cut at review.]

A block cannot be undone from inside the app. The screen for managing blocks was
deferred to a later milestone, and until it exists an accidental block is
recoverable only by deleting the row with an operator key. The decision entry
says so in its own consequences.<!-- src: docs/decisions/log.md 2026-07-30 #658 consequences -->

And connecting earns nothing. The karma ledger's list of permitted reasons has no
value for it, so an accidental insert would fail the constraint rather than pay
out. The reasoning is one line: social-graph mechanics must not be
karma-farmable, because a connect-and-disconnect loop would otherwise be a
mint.<!-- src: mutual-connections-design.md D9 -->

## Where it stands

Connections were designed on 29 July 2026 and shipped on the 30th — the tables
and their functions, the invite screen with its link and QR code, the accept
page, and the list with remove and block — on web, iOS and Android.<!-- src: journal PR #662, 2026-07-30; migrations/20260730070347_mutual_connections.sql -->
What the shipped copy promises is what the database enforces: two people see each
other's name and glyph, and see it only because both of them tapped accept.

On 17 August a connection stopped being only a name in a list: a pebble graded
for connections shows up on their page. That grade, and the separate business of
a link that opens for anyone, belong to privacy grades
and share links.

The open question is the block you did not mean to make. Everything else in this
feature has a way back — remove someone and a new invite reconnects you, let a
link expire and make another. A block is the one door that closes from the
outside, and the screen that reopens it has not been built.
