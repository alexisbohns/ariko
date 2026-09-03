---
name: Connecting & Sharing
description: How a private journal grew a public face without becoming a social network — invite or QR only, and an architecture built so that stays true.
pod: pbbls-public
---

You have one memory you want one person to see. The friend who was actually
there. Not everyone. That is what this territory is for: handing a single thing
to a single person, and — if you want it — a page that shows what you keep to
somebody you gave the link to. What it is built to prevent is everything else.
Being found. Being followed. Being counted.

The refusal came first, and it is unusually well dated. On 28 July 2026, before a
single one of these features had a design document, the store-launch roadmap
listed four product decisions. The fourth reads: "Connection discovery — invite
link / QR only. No search, no directory, no follower graphs. Symmetric
connections only: accepting an invite *is* the mutual
consent."<!-- src: docs/superpowers/specs/2026-07-28-store-launch-roadmap.md:10 -->
Everything built afterwards is enforcement of a sentence written before there was
any code to argue with it.

This is also where April's onboarding promise is kept. *"No feed to scroll"* is
absolute: no feed, no directory, no search, no follower graph. There is no screen
where you type a name and find a person, and no list of who somebody else knows.
The only way in is a link they handed you or a code you scanned off their
phone.<!-- src: case-study spec §4, author 2026-09-02 -->

The architecture underneath says the same thing in a duller register. Everything
that crosses between two people goes through a function that builds an explicit
list of what is allowed to leave — a display name, the strokes of the glyph
someone uses as their mark — rather than through a table opened wide enough to be
convenient. The reason is written down: an explicit list is an allowlist you can
review in one place, while a widened table quietly enrols every column somebody
adds to it later.<!-- src: docs/decisions/log.md 2026-07-30 #654 -->

That habit did not arrive by instinct. This half of the product was built
alongside a deliberate security and quality audit, outlined with Arkaik and
scoped across the data layer and the client contract. It is where the privacy
grades came from, the projection rule above, capability columns pinned by a
trigger so that owning a row is not authority to raise capability in it, and a
set of contract harnesses that sign up real accounts against the real project and
were then promoted to a merge gate. Proof rather than simulation, and structural
rather than remembered — the checks outlive whoever would have had to remember
them.<!-- src: case-study spec §8; docs/decisions/log.md 2026-09-02 #741 -->

The written piece is :entity[The connection you cannot search for]{ref=bean:pbbls-connections} — one row holding two
people, invite or QR only, and blocking present on the first day and silent by
design, because a block that announces itself is a message.

The rest is named and not yet written. Handles and public profiles: lowercase,
claimable, and released the moment an account is deleted, with no history and no
redirects, because a handle is a pointer rather than an archive. Share links:
what a public pebble exposes is the row and its baked drawing, and nothing else —
no cards, no souls, no photos. Privacy grades: three of them, secret,
connections, and public, with every pre-existing pebble rewritten to secret in a
single sweep rather than allowed to inherit a meaning its owner had never chosen.
And account deletion and consent: consent kept as evidence rather than as a
checkbox, and a deletion that leaves the glyphs other pebblers bought working for
them, without your name attached.

Where it stands. Connections shipped on 30 July 2026 across web, iOS and Android;
the grades and the share page followed on 17 August. One thing sits open and
deserves to be said here rather than left implicit: a public profile shows your
rings and your regularity rank, which is the complicated half of April's promise.
The mechanic existed in April. What July gave it was an audience.

The open question is smaller and more practical. A block cannot be undone from
inside the app: the screen for managing blocks is deferred, and until it exists an
accidental block is a door that closes from the outside.
