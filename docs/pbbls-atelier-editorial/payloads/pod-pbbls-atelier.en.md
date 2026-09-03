---
name: The Workshop
description: How Pebbles got made — the words chosen and the words refused, the day it stopped being a health app, and a product map that keeps itself.
pod: pbbls-atelier
---

Everything else in this case study is the product. This territory is the making
of it: the words chosen and the words refused, the day it stopped being a health
app, and the machinery that lets one person keep four surfaces moving. Little of
it is visible from inside the app, and most of it decided what the app was
allowed to be.

Start with the words: naming came first and did the most work. A pebble is a
small stone worn smooth by water, which is what time does to a memory — sharp on
the day, round enough to hold later. Stack them and you have a cairn, chosen over
*pile* and *heap* because nobody makes a cairn by accident. Dolmen and menhir
were dropped for a plainer reason: to an English speaker they read as Astérix.<!-- src: _digests/gemini.md §A–E; brouillons/B3-naming-cairn.md -->

Then the argument that mattered. A habit product usually has a streak, and a
streak is a chain, and a chain breaks. The mechanic was wanted; the word was not.
A week of naming work in February 2026 landed on *Skimmer* — the stone that
grazes the water without sinking — with a clean objection to the alternative:
every other word here names an object, and *bounce* names an action. Bounce was
chosen anyway.

[INTENTION? — the reason is not sourced to Alexis. A May 2026 draft in this
corpus argues that a thing which bounces goes back up after it has fallen, and
that for a product which came out of a depression this says something the stone
skimming the surface does not — but that draft was written by an agent, not by
him. Keep it as the reason, replace it, or cut the sentence.]<!-- src: _digests/gemini.md §G; brouillons/B3-naming-cairn.md -->

Naming also works as a fence. The people in your memories are souls, never users.
And the product does not say *therapy*, ever.

That last one is the pivot, and it has a date. On 25 March 2026, early in the
contest month, the clinical framing was dropped: never talk about therapy. The
reasons on the record are blunt. It is simpler legally. And people want the
result rather than the process — you want to speak the language, not to do the
exercises. The same day set the references instead: Duolingo for rewards
quick and also durable, Polarsteps for sharing worth looking at, Pokémon cards
for the plain pleasure of
collecting.<!-- src: dev-log 2026-03-25 "Duolingo vs Babel" and "Flush Start" -->

The clinical version was built and abandoned twice: a Notion template people
praised and nobody used, then a web app where Beck's columns had become a
fifteen-step flow — technically fine, humanly unbearable.

The psychology stayed. It stopped introducing itself. The typed cards in the
record flow are Beck's columns, one question each. The shape a memory takes comes
from Barrett's circumplex, an intensity crossed with a polarity. The domains are
Maslow, re-read in Greek. None of that vocabulary reaches the screen.

Then how it is built. Every commit on the repository is authored by one human,
and four in five carry an agent as co-author. What makes that work is not the
model, it is the paperwork: a spec before code and a plan before keys; an
append-only decision log, started in May 2026 because settled questions kept
being re-litigated; and a triage rule that ceremony scales with blast radius,
written down with its reason — heavy process on small tasks is the main reason
agent work feels slow. The prohibitions carry as much weight. Never refactor
existing code without approval: that rule has cost the product a knowingly
duplicated file rather than a quiet regression in code that already worked, and
the duplication is recorded rather than
hidden.<!-- src: _digests/method-current.md §1, §5, §8 -->

The map is the other half. On 1 April 2026 the product graph held 67 nodes and
every one of them was an idea. As of 2 September 2026 it holds 460, about three
in four of them live. It also stopped being a file patched by hand — it is
served, and a node's status moves with the pull request that touches it. A
wishlist became a record of what
shipped.<!-- src: _digests/method-current.md §3 -->

Where it stands: nothing here is written yet. The naming and the mineral
vocabulary, the pivot, the psychology underneath, the division of labour between
a person and a set of agents, the map, and the harnesses that turned a check
somebody had to remember into one nobody can merge past. All of it still to be
told.
