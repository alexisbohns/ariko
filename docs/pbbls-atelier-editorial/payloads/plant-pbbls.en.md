---
name: Pebbles
description: A private journal where a kept moment becomes a small stone — built for one person's habit, then taught to hold several without becoming the thing it had refused to be.
plant: pbbls
---

## Context

In 2022 a psychologist handed me a table. You fill it in one column at a time: the
thought, the feeling, the evidence against it. Those are Beck's columns, the
standard exercise of cognitive therapy, and they worked. What did not work was
doing them on paper at the end of a bad day. The exercise asks for the most
structured writing you are capable of at the moment you are least capable of it.

So it moved into Notion — a database first, then a guided form once Notion shipped
forms, so it could be filled from a phone on the way home. I shared the template
with people. They said it looked great. Nobody used it.

[INTENTION? — the reading is not sourced. Proposal: the failure was not about the
exercise but about the container it was in. Accept, rewrite, or cut at review.]

Autumn 2025 was the first attempt at an actual app. A web app with accounts and a
journal of situations, emotions and life areas modelled on Apple Health. It worked
end to end and it was miserable to fill in — a table had become a fifteen-step
form. I abandoned it, and wrote down why at the time: I had built the client and
the data model at once while the model was still
moving.<!-- src: _digests/apple-journal.md, "First Version" 2026-03-25 -->

[TO VERIFY: everything in this section that predates March 2026 — the 2022
exercise, the Notion template and its failure to be adopted, the autumn 2025 web
app — survives only in `00-chronologie.md` and `_digests/apple-journal.md`, both
compiled by an agent in May 2026 from a personal draft and a set of Apple Journal
entries. Neither primary is in the pbbls repo or in this one, so the quotations
cannot be checked against their originals.]

The turn has a date. On 25 March 2026, early in a month-long app contest, I dropped
the clinical framing and wrote the rule the product has kept since: never talk
about therapy. It is simpler legally, and it is truer about what people want — you
want to speak the language, not to do the exercises. The same day set the
references in its place: Duolingo for rewards that are quick and also durable,
Polarsteps for sharing worth looking at, Pokémon cards for the plain pleasure of
collecting.<!-- src: dev-log 2026-03-25 "Duolingo vs Babel", "Flush Start" -->

The psychology stayed. It stopped introducing itself.

## Intention

Pebbles is what a moment becomes when you keep it. You record something in
seconds — a coffee with a friend, a concert, a conversation that went badly — and
it turns into a small stone whose form carries how big the moment felt and how it
landed, with a hand-drawn symbol inside it saying what it was. The stones lie along
a Path you walk back through. Record it in seconds: no blank page, no pressure, no
audience.<!-- src: apps/web/lib/i18n/messages/en.json onboarding.steps.pebble.body -->

The hard part was never the recording. It was the coming back. On the first weekend
of work the navigation of a history was named as the biggest challenge in the
product, with its constraint attached: neither a list, nor a thread, nor
stories.<!-- src: _digests/apple-journal.md, 2026-03-25 "End of the week" -->
All three are refusals, and refusing them costs something, because a feed is the
solved problem and everything else is not.

Which is why the economy that arrived later has to be stated plainly, since from
the outside it looks like the thing this product said it would not do. Karma,
badges and the market exist to reward the habit and to sustain it, not to imprison
anyone. Karma is earned by recording, which means having lived something first, and
it is spent on glyphs — small hand-drawn symbols — that decorate memories made
outside the app. The aim is to send someone out into their life to collect
something worth keeping. Time in the app is not the
metric.<!-- src: case-study spec §4, author 2026-09-02 -->

April 2026's onboarding put half of that in one line: no streak to protect, no feed
to scroll. The second half is kept absolutely, and the decree keeping it was written
before any of the code it binds — no feed, no directory, no search, no follower
graph, connections by invite or QR only. The first half is complicated, and it is
the open question at the bottom of this page.

## Execution

The build falls into arcs that are legible from the outside. A browser prototype
ran through late March 2026 and was closed in April. A native iPhone app started on
12 April and was on TestFlight within a week. Then, from the end of June, an
economy, a public face, and a third client.

What follows is how the product is actually divided: where it runs, what it does,
and how it got made.

The web app is where a feature becomes real first. The house cadence is written
down and followed — the migration, then the web reference implementation, then iOS,
then Android — so a shape gets argued out while changing it is still cheap.

::entity{ref=pod:pbbls-web}

iOS is where the quality bar sits: how a stone is drawn, how it settles, what your
hand feels when you finish recording something. It is the surface the other two are
measured against, and the one whose finished code became the reference for the port
that followed.

::entity{ref=pod:pbbls-ios}

Android is that port — Kotlin and Compose, mirroring the iOS architecture rather
than sharing a line of code with it. Six days from an empty Gradle module to
parity, with an audit halfway through that stopped to count what six days does not
buy.

::entity{ref=pod:pbbls-android}

Backstage is the private surface, and the room where taste happens: which shades a
family of feelings is drawn in, whether a drawing a stranger submitted is allowed
into the shop, what it should cost.

::entity{ref=pod:pbbls-backstage}

Then what the product does. Recording is the few seconds of willingness you have
before a moment stops feeling worth writing down, and it is the territory that has
been rebuilt the most — including once in a direction it had already abandoned.

::entity{ref=pod:pbbls-record}

The pebble is the object those seconds produce. A form for how something landed, a
glyph for what it was, and a colour that is nowhere in the stored drawing because
it gets applied at the last possible moment.

::entity{ref=pod:pbbls-pebble}

The Path is the reading side, and the one named hardest on day one. Weeks are the
unit of memory. There is no search on it, no filter, and no way to jump to a date.

::entity{ref=pod:pbbls-path}

Karma is the economy: a ledger that allows debt on purpose, a market where nothing
is minted and no drawing is ever copied, and a stock supplied by the people who use
the app rather than by a house set.

::entity{ref=pod:pbbls-karma}

Souls are the people in your memories, deliberately not accounts — naming your
sister in a pebble does not reach your sister, ever. Domains are the part of a life
a moment belongs to, and the taxonomy the app ships is not the one it started with.

::entity{ref=pod:pbbls-souls}

The public layer is the newest of them, and almost every decision inside it is
about what the product refuses to become.

::entity{ref=pod:pbbls-public}

And the workshop: the words chosen and the words refused, the day it stopped being
a health app, the paperwork that lets one person keep this many surfaces moving,
and a product map that keeps itself.

::entity{ref=pod:pbbls-atelier}

## Outcome

As of 2 September 2026, Pebbles runs on four surfaces — a web app, an iPhone app,
an Android app and the private back office. They sit on one Postgres database,
which is the only thing they share; models and queries are hand-written per surface
by design, and a shared-types bridge is forbidden without a new
decision.<!-- src: docs/decisions/log.md 2026-07-10 -->

The economy has been live since the end of June, and nothing has shipped in it
since 31 July. That is a pause rather than an ending. The wallet, the market,
moderation and curation are live and behaving, the store was deliberately shaped to
sell a second kind of good it does not yet sell, and other parts of the product took
the summer.

The community layer arrived at the end of July. Two people can connect by invite
link or QR code, and since mid-August a pebble can be graded so that a connection
sees it, or so that anyone holding the link does.

The audience is a closed beta of roughly twenty-one people, growing since
mid-February 2026.

[TO VERIFY: that figure comes from a single closed-beta analytics report dated
1 May 2026 ("~21 users since mid-February"), and `00-chronologie.md` itself flags
the mid-February start as unexplained, since the contest build only began on
24 March — those accounts may belong to the earlier web app. Nothing in the current
corpus gives a number for 2 September 2026.]

And none of it has a public release. Web and admin deploy to Vercel on every push.
Android publishes a signed bundle to Google Play internal testing. iOS builds on
Xcode Cloud and has never been submitted to the App Store. Every "shipped" on this
page means shipped to a closed track.

## Reflection

A decision is half-done when the code lands. The other half is the reason, and the
reason has to live somewhere greppable or it gets re-litigated six weeks later by
somebody — including me — who no longer remembers the argument. An append-only log
started on 26 May 2026 for exactly that, with a blunt test for what belongs in it:
would a future agent or human waste real time rediscovering or wrongly reversing
this.<!-- src: docs/decisions/log.md 2026-05-26 #477 #482 -->
The return on that habit is that this case study can be written at all, including
the two pages that decay on every ship: what was cut, and what was never built.

::entity{ref=bean:pbbls-cut}

::entity{ref=bean:pbbls-unbuilt}

The second thing is about proof. The public half of the product was built alongside
a deliberate security and quality audit, outlined with Arkaik and scoped across the
data layer and the client contract. What came out of it is an architecture rather
than a list: privacy grades; a projection rule where anything crossing between two
accounts goes through a function carrying an explicit list of what may leave rather
than a table widened until it is convenient; capability columns pinned by a
trigger, because owning a row is not authority to raise capability in it; and a
set of contract harnesses that sign up real accounts against the real project
rather than mocking one. On 2 September 2026 those harnesses became a merge gate,
for the plainest reason available — a check that runs only when somebody remembers
to run it is not a
check.<!-- src: docs/decisions/log.md 2026-09-02 #739 #741; case-study spec §8 -->

The third is about who does the work. Every commit on this repository is authored by
one human, and four in five carry an agent as co-author. What makes that survivable
is not the model, it is the paperwork: a spec before code and a plan before keys,
ceremony scaled to blast radius, and a standing rule never to refactor existing code
without approval — a rule that has cost the product a knowingly duplicated file
rather than a quiet regression in code that already
worked.<!-- src: _digests/method-current.md §5, §8 -->

What is not settled is the first half of April's promise. No feed to scroll is
absolute and enforced in the schema. No streak to protect is a different story:
bounce, the regularity rank over a rolling window, has existed since April 2026, and
in July it became visible on a public profile, next to a tiered badge ladder that
pays karma at unlock. The mechanic did not change. What it acquired was an audience,
and nothing in the decision log acknowledges
that.<!-- src: _digests/act3-community-trust.md R2; journal PRs #675, #677 -->

[INTENTION? — I could not source a position on this. No decision entry, spec or PR
note acknowledges the April anti-streak stance while designing the badges or the
public profile. Proposal: bounce was always a rank on a moving window rather than a
chain that breaks, so July made it social rather than punishing — a change worth
naming rather than a promise broken. Accept, rewrite, or cut at review.]

The remaining open questions are smaller and named where they live. Both composers
are shipped and the experiment has no verdict. A block cannot be undone from inside
the app. And the valence picker still tells you the moment you just recorded will be
wrapped into your weekly Cairn, which is a sentence a stranger is holding and a
feature that does not exist.
