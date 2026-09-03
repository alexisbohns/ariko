---
name: Backstage
description: The private surface where the product's art direction, its moderation queue and everything it knows about itself all live.
pod: pbbls-backstage
---

Some of what Pebbles is made of cannot be decided by code, because it is taste and
judgement. Which five shades a family of feelings is drawn in. Which emoji stands
for a given emotion. Whether a drawing a stranger submitted is allowed into the
shop, and what it should cost. What a badge is worth. Backstage is the room where
a person makes those calls, and the only place the product talks back to the
people using it.

It is a second web app rather than a section of the first, and the reasoning is
about the platform rather than tidiness. The consumer app is a progressive web
app: service worker, manifest, install prompt. Admin work is the opposite of every
one of those assumptions — always online, never installed, one trusted account.
Mixing them fights the platform. A separate subdomain also gives a clean cookie
boundary, so a consumer session cannot grant admin access. The split happened in
April 2026, at what was named as the cheapest moment it would ever
be.<!-- src: docs/superpowers/specs/2026-04-26-back-office-app-design.md -->

The analytics page answers what the product is actually doing: how many people
have signed up, how many are here today, this week, this month, how many pebbles a
day, an active-users curve, and a retention heatmap by weekly cohort. Every figure
is read through admin-gated functions, and the underlying views are revoked from
anonymous and signed-in roles, so this page is the only door.

The proposal it came from wanted twelve surfaces on twelve nightly-refreshed
materialized views. What shipped was a strip of six cards and one chart, on plain
queries, with the function signatures shaped so that swapping in a materialized
view later is a one-line change. As of 2 September 2026 there are still no
materialized views and no scheduled refresh anywhere in the database. The volume
has not asked for them.

[INTENTION? — I could not source why the product measures itself at all, which is
worth getting right given the stated position that time-in-app is not the metric.
Proposal: the numbers exist to say whether people come back, not to be maximised.
Accept, rewrite, or cut at review.]

Glyph moderation is a queue. Submissions filtered by state, previewed, approved
into the market with an optional price override, or refused with a written reason
that is stored and shown to the person who drew the thing. That reason is the only
channel the market has back to a creator, and it only opens on a refusal.

The queue also produced the clearest small illustration of how this codebase
treats its own rules. An admin could not read the strokes of a pending submission,
because the market's read policy does not permit it — and nobody was willing to
widen a policy every client depends on in order to serve one screen. What shipped
instead was a single read function carrying its own admin check. The lock that
makes that policy so narrow is :entity[The drawing you can no longer change]{ref=bean:pbbls-d8}.

Beside the queue sit the editors for the things that are art direction rather than
data. Each emotion category carries five hand-set colours; the surface tint is not
one of them, because it is re-derived from the primary on every save rather than
being something a person can get subtly wrong. Emotions have their emoji, life
domains their name and their glyph, achievements their karma reward. Before these
editors existed, those rows were typed into a database console by
hand.<!-- src: docs/superpowers/specs/2026-05-06-emotion-categories-palettes-design.md -->

The Lab is the part of Backstage whose output people see: the in-app changelog and
announcements, filed under news and community. Writing an entry starts with a copy
and a paste. Clicking "New log" reads the clipboard during the click itself, and
if what is on it is the small block an agent wrote into a pull request
description, the form opens already filled in. Nothing publishes itself — the
block is a proposal, and writing to that table from the development loop is
forbidden outright.

Inside this pod: the analytics, the moderation queue, and the Lab.

Backstage is
deliberately missing from the product map. The map models web, iOS
and Android, so admin could only be filed under web — and an admin-only pull
request would then mark the customer-facing web app as shipped. Leaving it
unlinked keeps that signal honest. Adding the link later is a one-line request,
and the decision explicitly forbids doing it as a convenience
fix.<!-- src: docs/decisions/log.md 2026-07-28 #622 -->
