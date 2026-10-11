---
name: Five ways to hold a week
description: One evening of design work on the Pebbles Path, 11 October 2026, from two displays I disliked, through five directions and two syntheses explored by Claude agents, to the Spine with lit stones.
date: 2026-10-11
kind: essay
about:
  - bean:pbbls-polaroid-wall
  - bean:pbbls-render
  - pod:pbbls-path
artifact: https://claude.ai/artifact/YWnrBsWLbbkTTkZ3ra561z
---

# Five ways to hold a week

Open Pebbles on the web and a week of your life is a wall of polaroids: white
cards, a stone overhanging each top edge, names in a handwriting font, a small
tilt when the pointer passes. Open it on an iPhone or an Android phone and the
same week is a list of rows. On 11 October 2026 I was unhappy with both, for
opposite reasons, and spent the evening finding out what a week should look
like instead.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §1, §2 (session scratchpad 5e6e8339…/scratchpad/) -->

## What the Path was that morning

The Path is the screen where a week of pebbles is laid out. On the web it has
been :entity[the polaroid wall]{ref=bean:pbbls-polaroid-wall} since milestone
M58 (issue #720, August 2026): a white card per pebble, the photo edge to edge,
the name in the Caveat handwriting font, soul avatars, two columns.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §1; apps/web/components/path/PathPolaroid.tsx, PathWall.tsx -->

On iOS and Android, which mirror each other one to one, it is rows: a 56 pt
stone thumbnail (96 pt at intensity 3), the name, "TUESDAY · 14:32" in small
caps, and when there is a photo, a 64 pt rotated snapshot on the right.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §1; apps/ios/Pebbles/Features/Path/Components/PathPebbleRow.swift -->

The stone itself had just diverged between surfaces. Since 27 September (PR
#975) every iOS surface draws a lit, material stone with Metal shaders: lava
for a lowlight, river pebble for a neutral moment, gem for a highlight, the
glyph carved in, the light following the phone's tilt on the detail page. The
Android and web port had not started. My stated direction at the time was "client draws the
pebble, server keeps only the glyph", which is where this touches
:entity[how a pebble gets rendered]{ref=bean:pbbls-render}.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §1 -->

Three days earlier, on 8 October, a strategy audit had set a frame. It positions Pebbles as "the private memory of your life with the
people in it", with a north star of "life with five people, not broadcast to
five hundred". It names the stone aesthetic and the souls as strengths to
protect, puts a printed yearly book (the Cairn) and a weekly Cairn on the
roadmap, and rules out feed mechanics, ads and a gamified feel. The two things it asks to protect, the stone and the souls, are
the two things the Path puts on screen.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §1 (strategy audit, 2026-10-08, private artifact) -->

## Precious, and cheap

This is the message I opened the session with:

> I'm very unsatisfied with the polaroid display of the web app, and very
> unsatisfied with the rows display in the mobile apps. […] What I don't like
> with the rows is that it's not enough "precious" or "collectable", the
> polaroids are far better. But the polaroids look cheap, something is very
> amateur in the design: between interface (soulless) and skeumorphic
> (unrealistic). The pebbles are ugly on web in comparison with iOS, but I'm
> still wondering if the super design we shaped in iOS is a good idea.

The two complaints pull in opposite directions: the rows are not precious
enough; the polaroids are better at that and look cheap, caught between
interface and skeuomorphism. Under both sat a doubt about the lit stone on
iOS.

I asked the orchestrating agent, a Claude Code session, to brief five Opus
sub-agents on "5 totally distinct direction, bold, polished, aspirational,
unique, singular, matching the philosophy of pebbles."<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §2 -->

## The brief

The orchestrator wrote one brief, shared by all five agents. Every pebble had
to show the stone with its glyph, the name, the date and time, and the souls. A
photo had to appear in its own format (portrait 2:3, landscape 3:2, square,
16:9) and never be cropped to a uniform frame unless the agent defended it. A
pebble without a photo had to look as intentional as one with. Intensity and
valence had to be readable. The layout had to hold zero to twenty pebbles, at
390 px first, then 900 px and wider, light and dark. Each agent had to take a position on the lit-stone render. And
one line: "Do NOT produce a polaroid, a card list, or a generic social card."<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §3 -->

Everyone worked on the same fixture week, Monday 5 to Sunday 11 October 2026:
eleven pebbles, five souls (Mara, a partner; Elio, a son of six; two friends;
Bruno, a dog), five photos in four formats, from a 16:9 rooftop birthday to a
portrait of Mara on the seawall. Six pebbles had no photo: Elio's first
tooth, the rent going up, not sleeping at 03:10, saying no to an extra project,
a call with grandma that went quiet, Bruno asleep on my feet.

The agents got real assets, not placeholders: the iOS outline silhouettes,
the engine shapes, six seed glyphs, the seven emotion palettes and the web
app's sandbox photos. They reported two problems in them on the way: in
`large-neutral.svg` the outline is not the first stroked path, and the
`identity` and `travel` seed glyphs are the same drawing. Each agent delivered a
working `index.html` of the whole week and a note of at most 900 words.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §3, §4 -->

## Five directions, deliberately far apart

The orchestrator assigned the five metaphors; the agents ran in parallel, each
for 17 to 28 minutes and 200,000 to 280,000 tokens.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §4 -->

**The Vitrine** made the week a drawer in a collector's cabinet ("Drawer 41 ·
5–11 October 2026") and each pebble a specimen in a fitted tray: the stone in a
recess cut to its silhouette, the photo as a numbered plate at its own ratio,
a double-ruled museum label with an accession number (2026.41.7). References:
Deyrolle, the Pitt Rivers Museum, Naturalis, Riker mounts.
It kept the lit stone, under one cabinet light. Its own doubts: a twenty-pebble
drawer is long, and "lowlight, medium" next to a grief moment reads clinical.<!-- src: ../sources/2026-10-11-feed-redesign/vitrine-DIRECTION.md -->

**The Riverbed** drew the week from above as raked gravel: Monday upstream,
Sunday downstream, each day a reach between riffles, the stones at real
relative size (90, 128 and 178 px on a phone) with rake lines parting around
them, a photo as a basin cut into the ground at its exact proportions. References: Ryōan-ji, Carlo Scarpa's basins at the
Brion tomb, Swisstopo map sheets, Andy Goldsworthy.
It kept the lit stone — "the stone is the only thing with a body, everything
else is hairline ink." Tapping a stone sends ripples across the bed. Its doubts: about 4,800 px of scrolling on a phone for
eleven pebbles, and the cost of drawing it.<!-- src: ../sources/2026-10-11-feed-redesign/riverbed-DIRECTION.md; ../sources/2026-10-11-feed-redesign/FACTS.md §4 -->

**The Journal** set the week as a gathering of the printed Cairn, read while it
is being typeset: a title page, the persons of the week with page numbers, the
contents, entries on true 2:3 pages. The stone is an ink seal, and valence is
how the seal is printed: solid, open line, or hatched, after the relief and
intaglio of Chinese seal carving. Other references: Tschichold, Irma Boom,
*Apartamento*. On the stone it wrote: "I tried an
SVG-lit stone and it looked like a bevelled cookie, the same costume problem as
the polaroids." The Metal render would be reserved for the opened entry and
one frontispiece per printed book. Its doubt: pagination is real typesetting.<!-- src: ../sources/2026-10-11-feed-redesign/journal-DIRECTION.md -->

**The Deck** made each pebble a card in a 7:12 tarot proportion, with a
printed border, a corner index repeated upside down, one 2:3 picture window,
and, for a pebble with no photo, a "face card" whose whole illustration is the
stone. Painted card edges, thicker for heavier moments, show where the week
weighed. References: the Tarot de Marseille, Bicycle 808, hanafuda, Smythson's
coloured edges. It printed the stone flat in two inks, keeping the render for
the lifted card. Its doubts: smaller pictures (a landscape band about 225 px
wide on a phone), thumbing is slower than scanning, and card baggage
(swipe-to-judge, packs, rarity) to refuse.<!-- src: ../sources/2026-10-11-feed-redesign/deck-DIRECTION.md; ../sources/2026-10-11-feed-redesign/FACTS.md §4 -->

**The Constellation** organised the week by who was there. Each person is a
thread, mine the unbroken line down the middle; a pebble is a knot where the
threads of the people present converge; a photo hangs from the knot on those
same threads. References: Cellarius's star atlas, Harry Beck's Underground
diagram, Chiharu Shiota, Ryuichi Sakamoto's *async*.
It kept the lit stone at bead scale, without animation. Its doubts: about
5,350 px on a phone, lanes 13 px apart that tangle with six or more regular
people, and a sparse solo week that could read as judged.<!-- src: ../sources/2026-10-11-feed-redesign/constellation-DIRECTION.md; ../sources/2026-10-11-feed-redesign/FACTS.md §4 -->

The orchestrator screenshotted all five at 390 and 1280 px, published them in
one private hub artifact, and gave its reading: the real split was objects versus page. The Vitrine, Riverbed and
Constellation keep the lit stone and give it what it lacked on the web, a
ground and one light. The Journal and Deck print it flat and keep the render
for the moment a pebble is opened. Both camps were honest, which the polaroid
was not. It recommended the Journal as the Path on all three surfaces,
with the Riverbed as challenger.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §4 -->

## What I kept from each

I did not take the recommendation. I took pieces:

> I like the summary idea of the Journal: people of the week and raw table of
> contents list are perfect for introducing a passed week. I love the Riverbed
> background that fits with the timeline, but I wonder if it's not a little bit
> hard to implement, also pebbles stones are too big and the overall is very
> messy on mobile. I also like the transitions per day, like a seam, and the
> ripple animation when tapping a stone. I absolutely love the deck card design
> but there is still the same issue: portrait pictures fit perfectly but no
> geometric shapes appear in comparison with other; while landscape and square
> photos don't fit very well, so we might consider having card of different
> sizes, it's not a problem I guess actually. No-photo cards placeholder is interesting, but also could be
> compacted to avoid too big empty cards. I love the constellation timeline,
> but I guess it's not suitable (if you record pebbles with 14 people for
> instance). However, the timeline is cool, and maybe we could have the pebble
> in the timeline, and the card deck if there is a photo, otherwise, just the
> name, time and people.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §5 -->

Nothing was kept whole: the Journal's opening without its pagination, the
Riverbed's ground without its stone sizes, the Deck's card sized to the photo,
the Constellation's timeline without a thread per person. I asked for two more
agents to combine those.

## Two syntheses from one shape

The orchestrator turned those picks into one shape: the Journal opening; one
vertical timeline, mine; the riverbed ground made cheap, with day seams; the
stone on the timeline at 36 to 72 px; with a photo, a Deck card whose height
follows the photo; without one, a compact entry with no box; a ripple on tap;
one to fourteen people on a pebble. It gave the two agents opposite stances,
one leaning toward landscape, one toward page.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §6 -->

**The Stream** (about 26 minutes, 311,000 tokens) ran a band of raked gravel
down the centre of the screen, karesansui style. A first attempt with a pale
band and a centre line "read as a road with lane markings" and was dropped.
Stones are lit, 44 to 70 px, on the water, and cards hang below them. In the
persons of the week, each person carries a strip of seven dots for the days
they appear. Its doubts: the band may not read as water, and the time is
stated three times per pebble.<!-- src: ../sources/2026-10-11-feed-redesign/stream-DIRECTION.md; ../sources/2026-10-11-feed-redesign/FACTS.md §6 -->

**The Spine** (about 18 minutes, 263,000 tokens) set the timeline as a book's
margin: one line down the left, stones on it at 30, 40 and 52 px as flat ink
seals inside one to three raked rings, each day a hairline seam with riffle
teeth and the date in the margin. A photo hangs a Deck card off its stone, and
the card drops its own large seal, because the stone on the line already is
one. A pebble without a photo is set as type with no box, valence as weight or
italic. On a wide screen it becomes a spread, the opening pinned on the left
page, the line in the gutter. Tapping sends three stone-shaped waves across the
ground. References: Tschichold's marginal notes, zhuwen and baiwen seals,
Ryōan-ji, the Tarot de Marseille, the chain lines of laid paper. Its doubts: the ground sits at the edge
of visibility and could read as wood grain, the card corners repeat the day and
stone already shown in the margin, and the 82 px margin leaves phone photos
about 250 px wide.<!-- src: ../sources/2026-10-11-feed-redesign/spine-DIRECTION.md; ../sources/2026-10-11-feed-redesign/FACTS.md §6 -->

The orchestrator recommended the Spine, borrowing the Stream's seven-dot strip
and a stone that lights up only for the moment it is tapped. The question it
left open was whether the lit stone belonged in the list at all.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §6 -->

## The verdict

> The Spine is truly a masterclass. I think I'll only pick the realistic
> pebbles stones render + the 7 circles for the week in the persons of the
> week, both from the Stream.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §7 -->

That answered the open question, and it answered it against the Spine's own
note, which had argued that at 30 to 52 px "a lit render becomes a bevelled
bead that swallows the glyph". I had started the evening doubting the iOS stone.
I ended it keeping the stone lit, in the list, on the line.<!-- src: ../sources/2026-10-11-feed-redesign/spine-DIRECTION.md -->

In the same message I asked for one more Opus agent to build the final
iteration, and a second agent to write this account.

## Where it stands

The final iteration is the Spine with two things from the Stream. A builder
agent made it in about 16 minutes and 285,000 tokens; the orchestrator checked
it at a true 390 px and at 1280 px, in both themes, and added it to the private
hub artifact under "The final".<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §8; builder's report via the orchestrator -->

The stones on the margin line are now the lit stones: lava, river pebble or
gem by valence, the glyph carved in, one light, a soft shadow, the raked rings
kept. They went up in size because at the Spine's sizes the carving did not
read: 34, 44 and 54 px wide on a phone, 40, 52 and 58 on a wide screen, none
taller than 69 px. The rule the final settles on is "the object lives on the
line, the print lives in the typography": a stone is lit only where you can
press it, and the contents list keeps the Spine's flat ink seals. The persons
of the week carry the seven-dot `M T W T F S S` strip, which replaces the day
numerals, since the dots carry the same information.<!-- src: ../sources/2026-10-11-feed-redesign/final-DIRECTION.md -->

Two of the Spine's own doubts were worked on. The card corners keep one index
(day and weekday, top left) and one time and emotion rail; the upside-down twin
and the stone pip go, because the lit stone sits 40 px away. The ground was
redrawn as six evenly spaced meandering grooves, each a shadow line with a lit
line beside it, over a fine paper grain, so it reads as raked rather than as
wood grain. Tapping a stone keeps the ripple and adds a glint whose strength
follows the material: 1 for a gem, 0.62 for a pebble, 0.34 for lava, with a
still sheen under reduced motion. The build also fixed a bug in the Spine mock:
a CSS variable name collided with the palette's shaded colour, so stones sat at
the top of each entry instead of on the card's leader line.<!-- src: ../sources/2026-10-11-feed-redesign/final-DIRECTION.md; builder's report via the orchestrator -->

Nothing in the Pebbles apps changed on 11 October. The mocks are HTML, CSS and
SVG approximations; their stones are SVG, not the Metal render. There was no
change to the product map, no Lab Note and no pull request.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §9 -->

What is open, as of 11 October 2026:

- **Implementation on three surfaces.** The final's note estimates the stones,
  glint, ground, seams, ripple and strip at two days on the web, a day and a
  half on iOS and two and a half on Android, which still needs the lit stone
  ported to an AGSL shader. Cards, entries and the opening come on top, at the
  Spine's estimate.<!-- src: ../sources/2026-10-11-feed-redesign/final-DIRECTION.md; ../sources/2026-10-11-feed-redesign/FACTS.md §1 -->
- **Twenty-pebble weeks.** The Spine puts twenty pebbles at about 5,000 px on a
  phone; the contents have to carry navigation, and real overflow has not been
  designed.<!-- src: ../sources/2026-10-11-feed-redesign/spine-DIRECTION.md -->
- **The builder's two doubts.** Dropping the pip gives up part of the Deck's
  grammar, though one switch puts it back. And the ground's strength and the 20%
  brightness lift on lava stones at night were tuned on a headless render, not
  on a phone.<!-- src: builder's report via the orchestrator -->
