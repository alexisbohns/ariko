---
name: The Web App
description: The surface where a feature gets designed first, and the one everything else was ported from.
pod: pbbls-web
---

A feature becomes real on the web before it becomes real anywhere else. The house
cadence for a large milestone is written down and followed: the migration and the
regenerated types, then the web reference implementation, then iOS, then
Android.<!-- src: docs/superpowers/specs/2026-07-28-store-launch-roadmap.md §3 -->
That order is what this surface is for. It is where a shape gets argued out while
changing it is still cheap, and where the two native clients are handed something
that has already been used before they spend a week porting it.

It is also the Pebbles you reach by typing an address, rather than by being added
to a testing track.
[TO VERIFY: whether www.pbbls.app is open to anyone today or sits behind sign-up
— the repo names the domain but never its access.]

The browser is where Pebbles started, too. A local-first prototype ran through
late March 2026 and was closed off on 9 April; the monorepo and the database
arrived two days later. Most of what the web app is today is that prototype's
inheritance — including one promise it eventually stopped making.

The promise was offline. The web app is a progressive web app: installable,
mobile-first, with a service worker. On 29 July 2026 offline became an explicit
non-goal on web, iOS and Android, written into the decision log because it kept
being re-litigated. The service worker keeps every Supabase request on the
network, and stays that way because a cached-401-after-sign-in bug had already
shown what caching authenticated responses does. The composer's local autosave is
crash insurance for one open form on one device, not a sync
engine.<!-- src: docs/decisions/log.md 2026-07-29 #620 -->

The other thing this surface does that no other does is the Path. Since 23 August
2026 the web Path is a wall of polaroids rather than a stack of rows, and the
masonry is dealt round-robin — first card to the left column, second to the
right, third back to the left — rather than balanced for height. Height-balancing
lets a short card jump the queue to fill a gap, which means two cards sitting side
by side stop being neighbours in time. On a Path, whose entire premise is
chronology, that is a correctness bug wearing a tidier bottom edge. The code names
the trade it accepts: a ragged bottom edge reads as a wall, an out-of-order
timeline reads as a bug.<!-- src: docs/decisions/log.md 2026-08-23 #720; apps/web/lib/utils/path-layout.ts -->

The wall was designed on an unauthenticated fixture page rather than on the real
Path, so the decision could be made by looking rather than by arguing.

The consequence is that the three clients now look different from each other, and
that is a choice rather than a regression. Nothing in the schema or the stored
procedures moved; iOS and Android still render rows, and mirroring the wall onto
them is follow-up work, not a repair.

Inside this pod: the shell — the progressive web app, its service worker, and
offline as a stated non-goal with the cached-401 bug that settled it. The polaroid
wall, and why masonry here is dealt rather than balanced. And the older
client-side render engine that an April spec said would be deleted and never was:
it survives as the fallback for stones drawn before the server engine existed, and
for the sample pebbles on the landing page, where nobody is signed in and nothing
has been composed yet.

One more true thing about this surface. It is the quiet one. iOS and Android buzz
on every tap of the record flow; the browser has no vibration it can rely on, so
the web runs the same eleven steps in silence.

The product journal counts 65 shipped pull requests marked web between 11 April
and 30 July 2026. The app deploys to Vercel on every push and has no continuous
integration workflow of its own.
