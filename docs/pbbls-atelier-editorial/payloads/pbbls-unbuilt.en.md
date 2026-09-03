---
name: The Cairn is still a sentence
description: Everything Pebbles meant to build and hasn't — sorted by how real each intention actually is, from a promise printed in the app down to a thought that never left a prototype.
date: 2026-09-02
bean: pbbls-unbuilt
---

# The Cairn is still a sentence

Record a moment in Pebbles and the app asks how big it felt. Choose the smallest
stone and a line of copy tells you what you just chose: *This moment impacted my
day and will be wrapped in my weekly Cairn.* Choose the largest and it promises a
yearly one.

There is no Cairn. There has never been a Cairn.

The sentence has been in the product since the valence picker shipped in April
2026, and it is still on screen today in the web app's edit sheets.<!-- src: apps/web/lib/i18n/messages/en.json record.valencePicker; apps/web/components/record/ValenceIntensityGrid.tsx:166 -->
On iPhone and on Android the same sentences survive in the string files and are
no longer drawn anywhere, which is a different situation and a better one.<!-- src: apps/ios/.../Models/Valence.swift:85; apps/android/.../res/values/strings.xml:318 -->

What a Cairn was meant to be is written down properly. A weekly wrap: the week
completes, you get an intro screen, you review the pebbles you made, you confirm,
and the week stacks into a cairn that persists. The reward rides the existing
karma rails rather than inventing new ones. The issue asking for it was filed on
10 April 2026 and rescoped on 12 July 2026 after a backlog triage, and it is open
as of 2 September 2026.<!-- src: pbbls#220 -->

That one goes first because it sets the scale everything else is measured
against. Not everything unbuilt is unbuilt in the same way. A sentence in the
app is held by somebody who read it. A line in a spec is held by me. A node on a
map is held by nobody at all. This piece is sorted by that difference, hardest
first.

[INTENTION? — I could not source the why for keeping this ledger public at all.
Proposal: an unbuilt thing that stays written down is a thing that can still be
argued with, where an unbuilt thing that quietly disappears cannot. Accept,
rewrite, or cut at review.]

## Written into the product, and not built

The Cairn is not the only one.

The privacy policy served at `/docs/privacy` describes a product wider than the
one that exists. It has a section on therapist access, with granular permissions
you grant and revoke. It defines Decisions — evaluations of emotional impact,
scored on a range. It has a section on Cairns as anonymized weekly and monthly
aggregations.<!-- src: apps/web/docs/privacy/en.md:49,51,59,139,214 -->
None of it is in the app. The store-launch roadmap of 28 July 2026 already
schedules the rewrite, and names those sections plainly as fictional.<!-- src: docs/superpowers/specs/2026-07-28-store-launch-roadmap.md §M56 -->

That policy was written when Pebbles was still a therapy-adjacent tool, and the
product moved away from that position deliberately. Legal copy is the last text
in a product to notice that something changed, because nothing in the build
breaks when it goes stale. Which is exactly why it belongs at the top of this
page rather than in a footnote: it is the only category here where a person
outside the project is holding the claim.

There is a small detail in the valence copy worth keeping. It promises a weekly
Cairn, a monthly one and a yearly one. The product map only ever imagined a
weekly one and a monthly one.<!-- src: docs/arkaik/bundle.json nodes F-weekly-wrap, F-monthly-wrap -->
The yearly Cairn was never designed at all. It exists in one sentence, in one
string file, and nowhere else.

## Specified, and not landed

Open a glyph in the market on iPhone or Android and the drawer shows you when it
was carved, what it costs, and what you have to spend. The rest of the drawer is
inert: how many people own this glyph, how often it has been used, and who made
it. Each of those says *Soon*.<!-- src: docs/superpowers/specs/2026-07-01-issue-507-glyph-swap-ios-design.md §Placeholders -->

The reason is written into the spec that shipped them. Some of those values are
cross-user aggregates sitting behind row-level security, and another is behind
owner-only profile rules, so none of them is cheaply available to a client. The
whole feature was designed to need no migration and no new function, and keeping
the layout with placeholders in it was the price of that. The spec goes further
and describes the follow-up exactly: one `SECURITY DEFINER` detail function,
additive, dropping into the same view code. It has not been written.

The same shape, with more at stake, sits under blocks. Blocking shipped with
:entity[connections]{ref=bean:pbbls-connections} on 30 July 2026 because Apple's
guidelines require it at launch, and it works: the block is directed, checked in
both directions, and never revealed to the blocked party. What did not ship is
any screen to undo one. The decision entry records the consequence in its own
words — until the compliance milestone, an accidental block is recoverable only
by a service-role row delete.<!-- src: docs/decisions/log.md 2026-07-30 #658 Consequences -->
Which means: somebody with operator access removes the row by hand.

Both of these are the same grade, and it is a respectable one. The work is
specified, the cost of not doing it is written down next to the thing that caused
it, and neither was discovered by a user filing a complaint.

## Named as a future

The store was built to sell more than glyphs. The wallet spec says so in its
first paragraph — the rails are the foundation the rest of the shop spends
against, and nothing in them hard-codes "glyph" as the thing being bought. The
market spec lists themes and pebbleskins under out-of-scope. The decision that
closed the market says new goods reuse the buy shape: validate the listing, spend
the karma, grant the entitlement, one transaction.<!-- src: specs 2026-06-29-issue-494 §Scope, 2026-06-30-issue-496 §8; docs/decisions/log.md 2026-06-30 -->
:entity[One ledger]{ref=bean:pbbls-wallet} is deliberately generic and
:entity[the buy path]{ref=bean:pbbls-market} was shaped for a second good. The
shop still sells one kind of thing.

Creator pay is in the same position. A sale credits the glyph's owner the full
price as a matching karma credit inside the same transaction as the buyer's
spend, which is a transfer rather than a mint. The log notes that a royalty or
revenue-share model would build on the same owner column that already carries
:entity[authorship]{ref=bean:pbbls-d8}. That work has not started.<!-- src: docs/decisions/log.md 2026-07-01 #497 Consequences -->

Above all of these sits the roadmap itself, dated 28 July 2026: soul seaming,
aggregated pebbles, server-encrypted notes, and the compliance batches, with ten
vision points gating a public v1.0 and nothing held back as post-launch. Each
milestone gets its design document when it starts, and as of 2 September 2026
none of those has one.<!-- src: docs/superpowers/specs/2026-07-28-store-launch-roadmap.md §1, §3 -->
The most ordinary thing on that list is the one worth naming: there is no
password reset and no email change on any surface.

Why none of it is built is ordinary: other work took the summer.

## Known gaps, found on purpose

On 16 July 2026 the Android port was audited against iOS, file by file, across
every feature area. Every headline gap was attacked with a full-tree search
before it was allowed into the document, and none of them turned out to be
false.<!-- src: docs/superpowers/specs/2026-07-16-android-parity-audit.md header -->
What follows is that audit's output, still open.

The substantive one is Sign in with Apple. Android has email and Google; it does
not have Apple. Someone who created their account on iPhone with an Apple ID has
no way into the Android build at all — not a degraded way, no way. The audit
calls it the highest-value auth item and sizes it as a small port on a path
Android already runs for Google. The issue has been open since the day of the
audit.<!-- src: parity audit §3 Entry funnel; pbbls#570 -->

The rest are cosmetic, and they are all still true. The launcher on the internal
track shows the stock system icon, because the layered design source does not
exist yet. Onboarding renders placeholder surfaces where illustrations go, and
the artwork is sitting in the iOS asset catalogue waiting for an export. The
week-roll cairn is a static drawable where iPhone runs a Rive state machine. The
karma flash buzzes on Android and does not ring — the ceramic sound and the
enveloped haptic are both named deviations, and the sound file has never been
copied across.<!-- src: apps/android/CLAUDE.md; apps/android/.../SlideToConfirm.kt:74 -->

An audit that produces a list this specific is an audit that worked.

## Still open

One question has been open longer than anything else here.

Bounce is the regularity signal: a rank over a rolling 28-day window, shipped on
1 April 2026. In mid-May a prototype asked what to do with it, and forked. Path A
kept the 28 slots and varied only the visual metaphor: calendar grid, cairn,
ripple field, stepping-stone trail. Path B stepped back
and asked whether a discrete level was the right mental model at all, sketching a
continuous gauge with a healthy ceiling above which more is not better.
[Path A and Path B have nothing to do with the Path you scroll; the collision of
vocabulary is unfortunate and mine.]

Neither was chosen. What happened instead is that Ripples shipped that same week
— a ring badge over the same rolling window, still discrete, still a level — and
bounce was left exactly where it was, in the database, in the analytics, and on
the profile. Both signals are on the public profile today, one above the other.
So Path A was taken in practice, in one of its costumes, and Path B was never
answered.

[TO VERIFY: `bounce-explorations.html` (15 May 2026) is not in the read-only
pbbls repo. Its Path A / Path B split is recorded in `00-chronologie.md` and
described in detail only in `brouillons/B5`, which is an agent-written draft from
May 2026 and not evidence of what I concluded. The reading above — that Ripples
resolved Path A in practice without settling Path B — is mine from the shipped
code, not a claim the sources make.]

The product map is the other open ledger, and it is the least trustworthy
document on this page. Twenty-three of its nodes still read `idea`. Nine of them
are the Cairn: the weekly and monthly wrap flows, their intro, review and result
screens, and the data model underneath.<!-- src: docs/arkaik/bundle.json, snapshot 2026-08-24 -->
The cairn endpoints beside them are marked archived, so the map disagrees with
itself about whether the feature was abandoned or is merely waiting.

And the rest of that count cannot be trusted. Some nodes still marked `idea`
describe functions that have been in production since April. The local snapshot
stopped being the map agents read on 28 July 2026, when the graph moved to a
hosted service, and it has drifted since. The honest summary is that the ledger
of what is not built is the least maintained ledger in the repository, which is
about what you would expect: nothing breaks when it is wrong.

## Where it stands

As of 2 September 2026: a promise about Cairns is on screen and in the privacy
policy, and no Cairn exists. The glyph drawer's real numbers, and a way to
undo a block without an operator, are both specified and unwritten. A second good
for the shop and a creator revenue model are named as future in the specs that
made room for them. The Android audit's list is intact
and one item on it locks a real group of people out of a real app. And the oldest
open question is whether a regularity score should be a level at all.

I am not going to give any of them a date.

The one thing I would defend about this list is its order. The distance between
its top and its bottom is not the amount of work left — the Cairn is a milestone
and the Android app icon is an afternoon. It is who is holding the claim. A
sentence in the app made a stranger the creditor. A node in a map costs nobody
anything, including me, which is precisely why the map is full of them and the
app is not.
