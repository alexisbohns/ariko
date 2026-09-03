---
name: The Android App
description: Kotlin and Jetpack Compose, mirroring the iOS architecture — and what six days of porting does and does not buy.
pod: pbbls-android
---

An Android user is meant to get an Android app. That is the whole intention of
this surface, and it was set as a constraint before the first line was written:
the long-term vision is two platform-perfect native apps, with no convergence of
iOS and Android into a single codebase.<!-- src: docs/decisions/log.md 2026-07-10 -->

Three candidates were weighed on 10 July 2026 and two were rejected in writing.
React Native's reuse advantage was judged modest, because the expensive work —
custom SVG rendering, the glyph canvas, animation and haptic feel — is
per-platform whichever framework you pick. Flutter adds a third language with
nothing reused from any surface. Compose was the only option with no abstraction
tax on the deep-native work, and SwiftUI and Compose are so nearly isomorphic that
the finished iOS app becomes a directly portable reference for the agents doing
the porting. Models and query strings are hand-written per surface on purpose; a
codegen or shared-types bridge is forbidden without a new decision. The database
contract is the only thing the four surfaces share.

The port ran from an empty Gradle module to feature parity in six days, 11 to 17
July 2026, in roughly the order a person meets an app: the entry funnel, then a
Path you can only read, then the ability to write to it, then profile and
settings, souls, collections, photo attachments and the glyph studio, and finally
the Lab.

Halfway through, the port stopped and audited itself. On 16 July every feature
area was read file by file against the iOS source, and every claim that something
was missing was attacked with a repository-wide search before it was allowed into
the document: twelve confirmed, zero false gaps. The verdict was 7,500 to 8,000 lines
of iOS behaviour still to port — roughly the back half of the app — and one line
that mattered more than the number: none of it needs database work. Every view,
procedure, table, bucket and edge function the remaining gaps depended on already
existed, built for web and iOS. The audit also found three defects in code that
had already shipped, the sharpest being that someone who had bought glyphs on web
or iOS could not attach them on Android. The milestones it scoped were executed
within two days.<!-- src: docs/superpowers/specs/2026-07-16-android-parity-audit.md -->

Six days does not buy the finish. On the internal
testing track Android still launches under the stock system icon, the onboarding
illustrations are placeholders, the week's cairn is a static drawing where iOS
animates it, and there is no ceramic sound and no karma vibration. The substantive
one is Sign in with Apple, a stated non-goal of the first milestone that has not
been revisited since: an account created with Apple on an iPhone cannot be opened
on Android at all.

Where Android differs on purpose, it says so. The valence gradient is one artefact
drawn three ways — SwiftUI's mesh gradient has no Compose equivalent at all, so
Android resamples the same sixteen sampled colours into a bitmap and stretches it.
The colours are the shared thing, the drawing is not, and a fourth surface should
copy the samples rather than the technique. One piece of draft-handling logic
is deliberately left duplicated across two Android composers, under a standing
rule that existing code is not refactored without approval. Introducing a bug into
a shipped composer while porting the flow would be worse than a second copy that
is known and recorded — so the debt is written down and made enforceable: until
the older composer migrates, a fix to either copy must land in
both.<!-- src: docs/decisions/log.md 2026-08-24 #725, #729 -->

Inside this pod: the six days themselves; the parity audit, and what an audit
confirming twelve real gaps and no false ones is evidence of; and the divergences
kept rather than closed.

Android is also the only surface with a release pipeline in the repository. Every
push to the main branch that touches it builds a signed bundle and publishes it to
Google Play internal testing. That pipeline exists because the maintainer has
neither Android Studio nor a local SDK; the same continuous integration renders
the app's screens to images so they can be looked at.
