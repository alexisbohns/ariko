---
name: Pebbles & Glyphs
description: The object a saved moment becomes — nine forms that carry how something landed, and a hand-drawn symbol that says what it was.
pod: pbbls-pebble
---

A moment worth keeping has a size and a shade. It almost never has a number.

This territory is about the object a saved moment turns into, and about the two
things that object has to carry: how big it felt, and how it landed. Asking for
that in a form means asking somebody to rate their own sadness out of ten, which
is both a chore and an abstraction. The working note from 29 March 2026 puts the
aim the other way round: the shaping module is "an instinctive and metaphorical
way to appropriate Barrett's scheme without having to understand it
intellectually."<!-- src: _digests/apple-journal.md, 29 mars 2026 — Valence explorations -->
Nobody needs to know that a two-axis model of emotion exists. They need to look
at nine stones and point at one.

So a pebble stores two values. `intensity` runs 1, 2, 3. `positiveness` runs −1,
0, +1 — lowlight, neutral, highlight. Three by three is nine, and nine is how
many forms there are, one drawing per cell, unchanged in count and in axis since
the day they were made.<!-- src: engine/resolve.ts; decision log 2026-08-24 #729 -->
[TO VERIFY: the April 2026 dev logs record the nine forms as drawn by hand,
without AI; the pbbls repo itself records no provenance for them.]

The form says how something landed. The glyph says what it was — a symbol drawn
with a finger, which then lives inside the stone. Glyphs and forms are
deliberately unrelated: the database column that once tied one to the other was
dropped in July 2026 with a note that reintroducing it is out of the question,
because glyphs are squares and a square goes in any of the nine.

Colour is the part that surprises people. The composed drawing has none. Every
fill is `none`, every stroke is `currentColor`, and the file that produces it
says why in a comment: the client applies the emotion colour at render
time.<!-- src: packages/supabase/supabase/functions/_shared/engine/compose.ts -->
Colour belongs to the emotion's *category* rather than to the emotion — seven
categories, each carrying a small palette — and it is chosen per surface and per
theme, at the last possible moment. One drawing, many stones.

Since 24 August 2026 every stone also breathes. The petroglyph wobble gives each
line a leaky, uneven edge instead of an even vector stroke, and it is generated
on the device at the moment of drawing rather than baked into anything stored.
That was a decision with reasons attached: glyphs are user-carved and traded, so
they cannot be baked at build time; baking at write time would iterate slowly,
grow the stored drawing several times over, and still miss every surface that
shows a glyph without a stone.<!-- src: decision log 2026-07-13 #555 -->
Underneath it is the design language written down on 27 March 2026 — "everything
is flat and animation-ready, but nothing is geometrically perfect. The
irregularity is structural, not cosmetic."<!-- src: _digests/apple-journal.md, 27 mars 2026 — Design themes with Claude -->
The stones spent months not obeying that line. Now they do.

Inside this territory: how a memory became a shape, which is the story of the
two axes, the nine canvases and the picker that spent a summer looking nothing
like the thing it was picking. The wobble, and the four-step argument for
generating it at runtime. Carving a glyph — the full-screen canvas, the finger,
the strokes. Rendering, which is stranger than it sounds: one composition engine
runs on the server at write time, three hand-written renderers draw the result
on web, iOS and Android, and their agreement is held not by shared code but by a
fixture file the web reads directly out of the iOS test directory. And colour —
the categories, the six palette slots, and why a read page tints itself
wholesale.

Where it stands, as of 2 September 2026: the wobble ships unconditionally on iOS
and on the web, and on Android only in internal builds, because the Android flag
guards a fallback the other two do not have. That three-way split is on purpose
and is written down as something not to tidy up.
