---
name: Everything I stopped making
description: A record of what Pebbles abandoned or suspended — each with its date and its recorded reason, including the one cut that quietly came back as the default.
date: 2026-09-02
bean: pbbls-cut
---

# Everything I stopped making

Open the Pebbles iOS project today and you will find an app-extension target that
compiles into every build and draws nothing. It has been inert since 1 July 2026.
The obvious move is to delete it, and the obvious move is wrong — but the only
way anyone can know that is that on the day it went quiet, the reason went into a
file.

Pebbles keeps an append-only decision log, started on 26 May 2026 because settled
questions kept getting re-litigated: they lived in issue threads, which are good
for discussion and useless for finding an answer twice.<!-- src: docs/decisions/log.md 2026-05-26 #477 #482 -->
The same entry gives the test for what belongs in it — *would a future agent or
human waste real time rediscovering or wrongly reversing this?* A record of what
was cut is that test run backwards. It is not a list of regrets. It is the half
of a decision that outlives the code.

Sorted by the kind of decision each one was, rather than by date, here is what
came out.

## The ones a device settled

On 1 July 2026 the iOS karma flash lost its Live Activity. The plan had been the
Dynamic Island: earn karma, get a "+N" up in the notch. On an iPhone 15 running
iOS 26, `Activity.request` returned success and reported the activity active, and
nothing rendered — not in the notch, not on the Lock Screen, not when the app was
backgrounded inside the window.<!-- src: docs/decisions/log.md 2026-07-01 #505 -->

The evidence did not say the implementation was wrong. It said the premise was.
iOS does not render a foreground app's own Live Activity in the Dynamic Island,
and karma in Pebbles is only ever earned by a foreground action — you create or
enrich a pebble. The Dynamic Island could never have shown this flash, on any
device, in any build.

What shipped instead is an in-app pastille in a pass-through window, floating
above whichever sheet the earn happened inside, with a haptic derived from the
amplitude envelope of its own ceramic sound. And the extension target stayed. A
glyph purchase is a plausible future notification that *can* arrive while the app
is backgrounded, which is exactly the case where the Dynamic Island works — so
the widget target, the activity controller and the shared attributes were kept as
the reference for it rather than reconstructed later from memory.

Two weeks later the same kind of ruling landed on the petroglyph wobble. The
issue that proposed the handcrafted stroke recommended baking the wobbled
geometry at build time. That is impossible here for a product reason rather than
a technical one: glyphs are drawn by the people who use Pebbles and traded in
:entity[the glyph market]{ref=bean:pbbls-market}, so at build time there is
nothing to bake. Baking at write time was considered in the same entry and
rejected: it would need a redeploy and a backfill for every tweak to the look, it
would persist a wrong look across every platform at once, and it would still miss
every surface that draws a glyph without going through the composed
image.<!-- src: docs/decisions/log.md 2026-07-13 #555 -->
The wobble runs on the device instead, and agreement between the Swift, Kotlin
and TypeScript ports is held by a golden fixture rather than by shared code.

The same decision dropped the centreline stroke mode the issue had specified: a
stroked wobbled centreline holds a constant width, and a width that breathes is
the entire point.

## The week everything got smaller

The first cut predates the app. The autumn 2025 attempt was vibe-coded on
SvelteKit with Codex and abandoned for two reasons I wrote down at the time:
client and data model were being built at once while the model was still moving,
and the stack was a niche one at a moment when the models are trained on
React.<!-- src: _digests/apple-journal.md, entry "First Version" (25 March 2026), retrospective on autumn 2025 -->

The weekend of 5 April 2026 went into a pebble engine. Not a modest one: specced
and implemented across the whole back end before anything drew. By Monday it was
gone — *flushed everything*, in my own words at the time. The wrong call was not
the engine. It was the slicing: I had built the work back to front across its
full width instead of iterating simple to complex through its full thickness, so
there was nothing to look at until everything worked, and when it didn't work
there was nothing worth keeping.<!-- src: _digests/apple-journal.md, entry "Wasted Sunday" (5–6 April 2026) -->

[TO VERIFY: this paragraph, the sidebar and Emotion Pearl reasons below, the Moss
Pool verdict, and the autumn 2025 SvelteKit attempt all come from Alexis's own
Apple Journal entries, which survive today only as `_digests/apple-journal.md` —
the primary HTML entries are in neither repo. The digest quotes them verbatim,
but the originals cannot be re-read to confirm.]

Two days later a simpler engine arrived, inside a single pass of subtraction. In
the same stretch: the dashboard sidebar went, on the stated grounds that Pebbles
is an app, not a SaaS, and navigation became a card floating along the Path. The
Emotion Pearls — a glowing pearl above the emotion grid, shipped at the end of
March — were archived, the recorded reason being to put the emotion's colour
directly into the SVG fill instead. And the long step-by-step record sequence
collapsed into one quick editor. Hold that last one.

The pearls stayed archived. Their reason did not survive: the composed image
carries no colour at all today. Every fill is stripped and every stroke set to
`currentColor`, and colour is applied per surface, per theme, at render time from
the emotion *category*'s palette.<!-- src: functions/_shared/engine/compose.ts -->

That instinct kept operating. The back-office analytics arrived as a proof of
concept describing a page backed by nightly-refreshed materialized views; the
spec that actually shipped it declined the whole layer in writing, as overkill
for the data volume and as something that would drag `pg_cron` availability,
row-level security on materialized views and refresh-failure handling into the
first version's blast radius. What shipped is plain views computed per request,
with a note that the swap is mechanical if query times ever warrant
it.<!-- src: specs/2026-04-30-admin-analytics-thin-slice-design.md; the DDL survives under docs/poc/admin-analytics/ -->

On 17 July the app stopped pretending to load. The launch screen had been a Rive
animation held up by a hardcoded timer, which is a loader that loads nothing; it
was replaced by a native logo that draws itself stroke by stroke and settles when
a real readiness signal arrives.<!-- src: docs/decisions/log.md 2026-07-17 #598 -->

And one spec, the valence fan's, threw out a caption line, an overtitle, a row of
size marks, a drop shadow and a run of gradients between its first build and its
last — one gradient "read as a photo filter", its replacement "was no better",
and the one after that "was clownish however its ink was
tuned".<!-- src: specs/2026-08-24-ios-valence-fan-picker-design.md, revisions 1–5 -->

## The one that came back

On 27 March 2026 Pebbles shipped a composer that walked you through recording a
moment one question at a time. On 8 April it was removed:
*the long step-by-step sequence is gone*, and name, feeling, people, parts of
life, photos, glyph and collections all moved into the quick editor on the
Path.<!-- src: docs/arkaik/journal.jsonl pr-25 (2026-03-27), pr-161 (2026-04-08) -->
In July the composer at least got off the pop-up and onto a page of its own.

On 23 and 24 August 2026 the step-by-step flow became the default composer on
every surface — iOS first, then Android and web. The all-at-once form is still
there, behind a long-press on the same button or a query string on the web URL,
and it is now the fallback.

Nothing in the decision log connects the two. The August entry argues the flow
entirely on present-tense grounds: the form "asks the user to hold ten decisions
in their head simultaneously", and sequencing buys things a form cannot — seeding
the date from the photo's EXIF before asking for it, ordering the emotion
categories by the valence just chosen, ending on the composed pebble being drawn
on.<!-- src: specs/2026-08-23-ios-record-flow-design.md -->
April is not mentioned. Neither is the removal, nor the quick editor. The only
place in the whole corpus that notices is the product map, in the description of
the flow's success screen, which says it "revives the celebration beat carried on
web before #161 retired it."<!-- src: docs/arkaik/bundle.json, node V-record-success -->

[INTENTION? — I could not source the why here; no decision entry or spec connects
August to April. Proposal: the April cut was right for April, and its reason
expired — the sequencing dependencies the August spec names all rest on a photo
pipeline and native surfaces that did not exist in April. Accept, rewrite, or cut
at review.]

The official word for the current state is *experiment*, and it is unresolved:
resolving it means deleting one composer and the long-press gesture, not merging
them.

Set the opposite case beside it. Local-first was the founding
shape of the web prototype — everything in the browser, offline install
included. On 11 April 2026 a data layer was designed on that premise and reversed
the same day: Supabase became the source of truth, and offline support was marked
deferred. On 29 July it stopped being deferred and became a non-goal on every
surface — and the July reason is not April's. It is one specific bug, a 401
cached before sign-in and then served after it, which had already proved that
caching those responses is unsafe. So the entry forbids bringing them back under
the banner of offline support without superseding the entry first. What survives
is the installable shell and the offline screen: the non-goal is about
data.<!-- src: docs/decisions/log.md 2026-07-29 #620; specs/2026-04-11-auth-data-layer-redesign.md -->

A suspension whose reason got stronger, next to a suspension whose reason quietly
stopped applying. Only one of them is written down as a reversal.

## Still in the build, on purpose

On 11 April 2026 the first schema seeded five life domains with Greek names —
Zoē, Asphaleia, Philía, Timē, Eudaimonia — a reading of Maslow. Four days later a
migration upserted eighteen plain-English ones: Community, Family, Health,
Money, Partner, Work and the rest. Its header explains the awkward half without
flinching: the remote database already had them, added out of band, so against
the live project the insert is a no-op and on a fresh local one it creates the
real set. The Greek rows were never deleted. They coexist untouched, and a July
spec on the admin's domain editor lists them as legacy rows no pebble references
and calls them harmless.<!-- src: migrations/20260411000000, 20260415000001 headers; specs/2026-07-03-admin-domain-management-design.md -->

Maslow left one fossil behind. An analytics view still derives a domain's level
by looking its slug up in an array of those five Greek names — which means it
returns nothing at all for the eighteen domains anyone actually
uses.<!-- src: migrations/20260501000003_analytics_meaning_share.sql -->

The cards are the other one, and they are bigger. A card is one of Beck's
columns — the thought, the feeling, the evidence — and they had a whole step of
the original record flow to themselves: the therapeutic spine of the thing,
hidden in plain sight. On 9 April they came out of the editor, described at the
time as temporarily discontinued.

As of 2 September 2026 the table is still there with its policies and its index.
The read view still assembles a cards array for every pebble. Every function that
writes a pebble still deletes and re-inserts them, and every migration that
re-emits those functions — the most recent is from 17 August — carries the card
code forward intact. And :entity[the karma ledger]{ref=bean:pbbls-wallet} still
pays up to four points per pebble for cards, out of a ceiling of
ten.<!-- src: migrations/20260411000003 compute_karma_delta; 20260817130000 -->

Every composer on every surface sends an empty list. The web one sends
`cards: []` literally; iOS and Android do not send the key at all. So four of the
ten points a pebble can earn are reserved for something no client can do.<!-- src: apps/web/components/record/flow/RecordFlow.tsx, QuickPebbleEditor.tsx -->
The decision log begins on 26 May and has never revisited them.

A few more things stayed put for stated reasons, and one for none. The web app's
own composing engine was sentenced in a spec — *the existing `apps/web/lib/engine/`
is deleted* — inside a section labelled as an outline of future iterations rather
than a plan; it is still there, drawing legacy rows and the pebbles on the
unauthenticated landing page. The per-emotion colour column is
soft-deprecated rather than dropped, because shipped iOS builds still read it and
a column you drop is a build you break. Moss Pool, a theme judged too medical
back in March, is still one of the colour worlds in the web settings; it was
ruled out for iOS, where only Blush Quartz ships, and never taken off the
web.<!-- src: specs/2026-04-15-remote-pebble-engine-slice-1-design.md; apps/web/lib/config/color-worlds.ts; specs/2026-04-17-ios-color-modifiers-design.md non-goals -->

[TO VERIFY: whether Moss Pool's March verdict was ever meant to remove it from
the web at all, or only from the theme direction. The colour world is live in the
web switcher today, so the March note and the code disagree.]

And the week-roll cairn on the web lost its artwork at some point and is now a
plain text button, with the Rive dependency and a comment about "the Rive
canvases" still sitting in the tree beside it. Nothing in the decision log or the
journal says why. That one is not a decision; it is the absence of one, and it is
the only entry on this page I cannot source.

## Where it stands

The log is append-only and supersede-don't-edit, so none of this was tidied away
when it stopped being true. A reversal is a new entry pointing at an old one; an
entry nobody has pointed at is one that still stands. Everything above is dated
in that log, in the product map, or in a migration header — which is the whole
return on writing the reason down at the time, and the reason a stray extension
target survives a tidy-up.

What is open, as of 2 September 2026: both composers are shipped and the
experiment has no verdict, and the record flow's return remains one of the few
real reversals in this product that nobody wrote down. This page is the closest
thing it has to an entry.
