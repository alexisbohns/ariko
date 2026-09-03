---
name: Souls & Domains
description: The people in someone's pebbles and the parts of a life a moment belongs to — one deliberately not a user account, the other a taxonomy that changed its mind in four days.
pod: pbbls-souls
---

A moment is rarely only yours, and it always sits somewhere in a life. Two of
the questions the app asks when you record something are who was there and what
part of life this was. This territory is those two answers, and in both cases
the interesting part is what the answer is not allowed to become.

A soul is a person, a pet or an entity related to a pebble — "not a user, a
private contact in your world."<!-- src: README.md §Concepts -->
That is a refusal, and the database keeps it. A soul is a name that belongs to
you, plus, since 26 April 2026, a glyph so it has a face in a
grid.<!-- src: migrations/20260426000000_add_glyph_to_souls.sql (#298) -->
There is no email address on a soul, no phone number, no account, no invitation,
no notification. Naming your sister in a memory does not reach your sister, and
the privacy policy says so in as many words: Pebbles never contacts these people
and never shares their data with
them.<!-- src: apps/web/docs/privacy/en.md §2.5 -->

The same document turns the refusal into advice. Text you write into the body of
a memory is what leaves for the model when an AI feature reads it; soul names
are stripped first. So the policy recommends putting people in souls rather than
in sentences.<!-- src: apps/web/docs/privacy/en.md §12 -->

Nobody else ever sees one either. When a pebble is shown to a connection, the
reader gets the core row and the composed drawing; the enrichment around it —
cards, souls, photos — stays owner-only, deliberately.<!-- src: docs/decisions/log.md 2026-08-17 #708 -->

The word is not always the word you get. A naming audit in May 2026 proposed
changing the onboarding copy from "people" to "souls" and was turned down:
updating it "would push internal jargon into end-user
copy."<!-- src: docs/superpowers/specs/2026-05-27-issue-487-naming-harmonization-design.md -->

The other answer, the part of life, has a history the product does not tell. On
11 April 2026 there were five domains, named in Greek, one per level of Maslow's
hierarchy: Zoē for health and body, Asphaleia for security and comfort, Philía
for relationships, Timē for recognition and community, Eudaimonia for
self-actualization.<!-- src: migrations/20260411000000_reference_tables.sql -->

Four days later they were gone. Eighteen concrete domains had been entered by
hand into the production database, and the migration that followed exists only
to bring a local copy into line; it calls the Greek ones "5 outdated Greek-slug
domains … which coexist
untouched."<!-- src: migrations/20260415000001_remote_pebble_engine.sql -->
They still do. Nobody wrote down why Greek was chosen, and nobody wrote down why
it was dropped.

[INTENTION? — I could not source the why for the Greek names. Proposal: naming
the tiers of a needs pyramid in Greek keeps a borrowed theory from reading as a
borrowed theory, which stops working the moment somebody has to file a Tuesday
under it. Accept, rewrite, or cut at review.]

Maslow did not actually leave. The five Greek descriptions were redistributed
across five of the eighteen — Health kept "Health & body", Finance took
"Security & comfort", Friends took "Relationships", Work took "Recognition &
community", Passions took "Self-actualization". And the analytics still sort
domain charts by the original Greek slug order, because the table never grew a
column for the level.<!-- src: migrations/20260501000003_analytics_meaning_share.sql -->

Inside this territory: why they are called souls, and what the word costs and
buys. Maslow in Greek — the naming, the four days it lasted, and the debris.
And emotions: thirty-eight of them grouped into seven categories, where the
colour a stone is drawn in belongs to the category rather than to the feeling,
and where the picker reorders the seven according to the shape you just chose —
your own polarity first, its opposite last.

[TO VERIFY: the emotions bean is scoped as "emotions and the HealthKit
alignment", but no HealthKit entitlement, import or type exists in the app. The
alignment is claimed only in the April 2026 corpus and in legal boilerplate.
Barrett is likewise credited on the influences page and named nowhere in the
design record.]

Where it stands, as of 2 September 2026: souls, their glyphs and the eighteen
domains are live on all three clients. Soul seaming — a private, one-way link
between a soul and a real account, which the other person would never be
notified of and could never see — is specified and not built.
