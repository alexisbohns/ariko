---
name: The iOS App
description: Native SwiftUI, iPhone only — the surface that sets the quality bar the other two are measured against.
pod: pbbls-ios
---

A pebble is meant to feel like an object you are holding. The iOS app is where
that gets decided: how a stone is drawn, how it settles, what your hand feels when
you finish recording something. Three months after it started, when the Android
stack was being chosen, the reasoning named this surface directly — the expensive
work is custom SVG rendering, the glyph canvas, and animation and haptic feel, it
is per-platform whichever framework you pick, and the finished iOS app is a
directly portable reference implementation for whoever ports
it.<!-- src: docs/decisions/log.md 2026-07-10 -->

[INTENTION? — I could not source why iOS came before anything else, only that it
did, from 12 April 2026. Proposal: an app for recording a moment while you are
still in it belongs on the phone in your pocket, and a browser tab is not that.
Accept, rewrite, or cut at review.]

The shape of it is deliberately plain. SwiftUI, iOS 17 and up, iPhone only,
mirroring the mobile-first web app it was ported from. The Xcode project is not
checked in: a generator builds it from one manifest, which makes the project file
disposable and merge conflicts inside it impossible. Builds run on Xcode Cloud.
Nothing has been submitted to the App Store.

The most interesting thing about this surface right now is that it has two ways to
record a pebble and keeps both on purpose. Tapping the plus on the Path opens an
eleven-step flow — photo, when, name, valence, emotion, domain, souls, collection,
glyph, privacy, publish — with a haptic on every tap. Long-pressing the same plus
opens the older all-in-one sheet. That is an experiment in interaction model, and
the honest way to evaluate an interaction model is to be able to fall back on the
device, without a rebuild. The long-press was chosen over a settings toggle
because it adds no chrome, no persisted state and no localized string, and it
deletes in one line the day the experiment resolves.<!-- src: docs/decisions/log.md 2026-08-23 #723 -->

The load-bearing half sits underneath. Every branch of the publish path and the
whole draft lifecycle were pulled out so that both composers drive one copy — each
of those branches is a bug that was already found and fixed once, and a second
hand-rolled copy is how they come back, silently, while the flow carries on
looking like it works. There is a note in the log for whoever finds two composers
later and assumes one is dead code. It is not, and resolving the experiment means
deleting one of them, not merging them.

The clearest thing this surface has taught is a feature that did not ship. The
karma you earn while recording was going to appear in the Dynamic Island as a Live
Activity. On device the request succeeded and reported itself active, and nothing
rendered — not in the notch, not on the lock screen, not on coming back from the
background. iOS does not render a foreground app's own Live Activity in the
Dynamic Island, and karma is only ever earned by a foreground action, so the
Dynamic Island could never have shown this one. The concern had been raised during
brainstorming, walked back, and then settled by the
device.<!-- src: docs/decisions/log.md 2026-07-01 #505 -->

What replaced it stays inside the app: a small capsule popping bottom-centre in a
pass-through window that floats above whichever sheet is open, with a countdown
ring, and a vibration derived from the amplitude envelope of the ceramic sound it
arrives with. The widget target is still in the project, unused, kept as the
reference for a future notification that fires while the app is closed — which is
where the Dynamic Island does work.

Inside this pod: the jump from a browser app to SwiftUI; the two composers and the
rule that keeps them from drifting apart; and the Live Activity that device
evidence killed. And one thing that belongs to the render story is worth knowing
here anyway: the fixture defining what a hand-drawn wobble should look like is an
iOS file. The web test reads it out of the iOS test directory, Android keeps a
byte-for-byte copy, and this surface owns the definition of the line.

The product journal counts 68 shipped pull requests marked iOS, and as of
2 September 2026 the app does everything the web app does — sign-in, the Path,
recording and editing, profile, carving and buying glyphs, karma, the Lab — in
English and French.
