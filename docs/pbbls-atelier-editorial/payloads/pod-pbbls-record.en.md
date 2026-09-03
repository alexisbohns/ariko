---
name: Recording a Pebble
description: The capture flow — how Pebbles asks for a moment, and why two different ways of asking now sit behind the same button.
pod: pbbls-record
---

Something happens. A coffee with a friend, a concert that gave you chills, a
conversation that went badly. You have maybe twenty seconds of willingness
before it stops feeling worth writing down. This territory is everything that
happens in those twenty seconds.

The onboarding says what it is for, and has said it since April 2026: record it
in seconds — no blank page, no pressure, no
audience.<!-- src: apps/web/lib/i18n/messages/en.json onboarding.steps.pebble.body -->
That is a harder promise than it sounds, because a pebble is not one field. It
has a time, a name, a shape, an emotion, a life domain, the people who were
there, a collection, a symbol and a privacy setting. Ask for all of it at once
and you have built a wall. Ask for it one screen at a time and you have built a
corridor. Pebbles has shipped both, and then shipped both again.

The first version was the corridor: a fifteen-step form built through late 2025,
descended from Beck's columns, which worked end to end and was unbearable to
fill in. On 29 March 2026 the steps were rebuilt as single-purpose screens — one
question per screen, "no longer a form but a real
flow."<!-- src: _digests/apple-journal.md, 29 mars 2026 — Single purpose record flow -->
Ten days later the whole thing was collapsed into a compact editor at the edge
of the Path, and became the only way to record anything. The cards were the
casualty of that move.

Then it went back. On 23 and 24 August 2026, on iOS, web and Android within two
days, a step-by-step composer became the default again. The argument for it is
written down and it is not nostalgia. The form "asks the user to hold ten
decisions in their head simultaneously", and an order buys three things a form
structurally cannot: the photo comes first so its own metadata can say when the
moment happened, the shape comes before the emotion so the emotion categories
can be reordered around it, and privacy comes last so the choice sits against a
real publish button rather than in a toolbar eight fields
away.<!-- src: docs/superpowers/specs/2026-08-23-ios-record-flow-design.md D2 -->

The old form did not die. It moved behind a long press on the same button. The
reasoning is stated plainly: this is an experiment in interaction model, and the
honest way to evaluate it is to fall back on device without a rebuild; a long
press was chosen over a settings toggle because it adds no chrome, no persisted
state and no localized string, and "it deletes in one line when the experiment
resolves."<!-- src: docs/decisions/log.md 2026-08-23 #723 -->
The entry ends with a note to whoever reads the code later: a future reader will
find two composers and may assume one is dead code — it is not, and resolving
the experiment means deleting one, not merging them.

For all its screens, the flow demands very little. It gates on three answers: a
name, a feeling, and a part of life. Everything else is skippable or arrives
already answered.

Inside this territory: the flow itself, from fifteen steps to seconds and back to
eleven — a position taken, abandoned, and quietly retaken, since no decision
entry anywhere acknowledges the return and only the product map mentions it, in
passing.<!-- src: docs/arkaik/bundle.json, V-record-success -->
The cards, which are four questions — what did I feel, what did I think, what
did I do, and one that just says write anything — recorded in March 2026 as
inherited from Beck's columns. They are still in the database, still worth karma,
and no client has read or written one since April. And drafts, which exist
because until July 2026 recording was all or nothing: every composer gated its
save button on a name and a feeling, so a half-articulated thought could not be
kept at
all.<!-- src: docs/superpowers/specs/2026-07-29-drafts-and-autosave-design.md; log 2026-07-29 #639 -->
Now saving is relaxed and only publishing is gated, and the offer to keep a
half-finished pebble appears at the moment you try to leave — which is exactly
when somebody wants it.

Where it stands, as of 2 September 2026: the flow is live on all three surfaces
and the form is one long press away on each. One is the experiment, the other is
the fallback, and nothing in the record says the experiment has been called.
