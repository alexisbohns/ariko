---
name: The Path
description: Where you go back and read — a life laid out as a route you walk rather than a feed you scroll, and the hardest problem in the product.
pod: pbbls-path
---

Recording a moment takes seconds. Coming back to it is the other half, and the
half everything else is for. This territory is the reading side of Pebbles: the
place where what you have kept is laid out, and where you go looking for a
Tuesday in March without knowing that is what you are looking for.

The onboarding puts the premise first — your life is a path, and most of it
slips away before you
notice.<!-- src: apps/web/lib/i18n/messages/en.json onboarding.steps.path -->
It puts the refusal in the same breath: no streak to protect, no feed to scroll.
That costs something, because a feed is the solved problem and everything else
is not.

The cost was named on the first weekend of work. On 25 March 2026 four
workstreams were written down — record a moment, record an emotion, reward
regularity without dark patterns, and navigate the history — and the fourth was
marked the hardest, with a constraint attached: neither a list, nor a thread,
nor stories.<!-- src: _digests/apple-journal.md, 25 mars 2026 — End of the week -->
All three are recorded as refusals. The reasoning behind them is not.

[INTENTION? — I could not source why each of the three was rejected. Proposal: a
list gives the birth of a niece and a queue at the post office the same height, a
thread implies each moment answers the one before it, and stories are built to
expire — which is the opposite of a thing kept on purpose. Accept, rewrite, or
cut at review.]

What got built treats time as blocks rather than a ribbon. Pebbles are grouped
by ISO week, each week is its own page, and you move between weeks sideways
instead of downward. The strip of weeks above the page holds only weeks that
contain something, plus the current one, so adjacent in the strip is not
adjacent in the calendar — a year you recorded nothing collapses to a single
step.<!-- src: apps/ios/.../Services/WeekRollBuilder.swift; apps/web/lib/utils/week-roll-entries.ts -->
Inside a week the sort flips depending on where you are: past weeks read
oldest-first, so you walk them forward, and the week you are living in reads
newest-first.

Since 23 August 2026 the web goes further. The Path there is a wall of polaroid
prints, each pebble a card with its stone resting on the top edge. The wall is
where this territory's one non-negotiable rule became visible. Cards are dealt
to the columns in strict rotation and never balanced by height, which is what a
masonry layout normally does. Both the decision and the code say why:
height-balancing lets a short card
jump the queue to fill a gap, so two cards side by side stop being neighbours in
time, and on a Path "whose entire premise is chronology, that is a correctness
bug wearing a tidier bottom
edge."<!-- src: docs/decisions/log.md 2026-08-23 #720; apps/web/lib/utils/path-layout.ts -->
The wall pays for that with columns ending at different heights, and the code
says which way the trade runs: a ragged bottom edge reads as a wall, an
out-of-order timeline reads as a bug.

Large pebbles break the wall and take the full width, splitting the runs either
side into their own sections. That is the whole hierarchy the Path has. There is
no search on it, no filter, and no way to jump to a date.

Inside this territory: the navigation itself — the refusals, the week as the
unit of memory, the wall — and collections, the other way of grouping, the one
you choose rather than the one the calendar chooses for you. A collection can be
a Stack, a Pack or a Track: a goal, something bounded in time, something that
recurs. The mode is a badge and nothing more. It changes no order, no limit and
no behaviour anywhere in the product.

Where it stands, as of 2 September 2026: the wall is web-only. iOS and Android
still draw rows, and the decision says so plainly — nothing broke, no schema or
contract changed, and bringing the other two into line is follow-up work rather
than a regression to fix blind. One promise is outstanding. When you choose how
big a moment felt, the picker tells you it will be wrapped into your weekly,
monthly or yearly Cairn. There is no cairns table, no endpoint, and no
screen.<!-- src: apps/ios/.../Models/Valence.swift; arkaik API-get-weekly-cairn retired_reason; issue #220 open -->
