# Pebbles on Ariko — case-study architecture

**Date:** 2026-09-02
**Status:** Draft for review. Not approved.
**Scope:** Content architecture for `plant:pbbls` on Ariko — the pod/bean/sprout
structure, the authoring register, the agent-maintenance contract, and the two
engineering prerequisites the content depends on.
**Out of scope:** implementing the routine agent (kept in mind throughout, built
later); the Ariko graph playground; any change to pbbls itself.

---

## 1. Why this exists

`plant:pbbls` on Ariko today is four seeded beans, twelve changelog sprouts, and
no narrative at all. Pebbles is the largest and most sustained thing in the
garden — 367 commits, four surfaces, an economy, a community, 42 recorded
decisions — and the plant page says nothing about any of it.

The goal is a case study that shows **intention, method, design and story**: what
was meant, how it was made, what changed, and why. Paulopus proved the format on
Ariko. Pebbles needs the same evidentiary standard at roughly four times the
scale, plus something Paulopus never had — a product that is still moving, and so
must be **maintainable by an agent** rather than rewritten by hand every month.

## 2. The corpus, and its expiry date

Two bodies of source material exist, and they are not equal.

**`docs/pbbls-atelier-editorial/`** (in this repo) — chronology, sources map,
style guide, three long French drafts, three digests. Authored 29 May 2026.
**It documents Act II and stops.** Six of its load-bearing claims about the
product are now false (§2.1). It remains the best source for *2022 → May 2026*
and the only source for the personal backstory.

**`~/code/pbbls`** (read-only) — 42 decision entries dated 2026-05-26 →
2026-09-02, 94 specs, 88 plans, a 926-event Arkaik journal, and the code. This is
the authority for anything after May.

Four `_digests/*-current.md` files were produced on 2026-09-02 to close the gap:
`act3-karma-glyph-market.md`, `act3-community-trust.md`,
`pebble-object-current.md`, `method-current.md`.

### 2.1 Corrections the corpus (and the pbbls README) require

| Stale claim | Correct as of 2026-09-02 | Source |
|---|---|---|
| valence `−2..+2` | `positiveness` is `−1/0/+1`; nine forms = 3 intensities × 3 polarities | log 2026-08-24 |
| pebbles are "deliberately flat" | the petroglyph wobble ships in production on all three surfaces | #727/#729 |
| emotion colour lives in the SVG fill | composed SVG is `fill="none"`, `stroke="currentColor"`; colour is applied per-surface from the emotion *category* palette | `compose.ts` |
| an animation manifest drives reveal | `render_manifest`/`buildManifest` dropped 2026-04-29; motion is a client timings table keyed by `render_version` | spec 2026-04-29 |
| the engine is called *from* RPCs | inverted — the `compose-pebble` edge function *wraps* the RPC | edge fn |
| "nine shapes, two polarities, one gesture" | three polarities; that picker was replaced by the valence fan 2026-08-24 | #729 |
| the admin analytics run on twelve materialized views refreshed by `pg_cron` | **never shipped.** `20260430_analytics_mvs.sql` lives under `docs/poc/admin-analytics/` — a proof of concept, not a migration. The real migrations contain zero materialized views and zero cron; the thin-slice spec deferred them and nothing added them since. The May digest read the POC file as production infrastructure. | verified 2026-09-03 |
| the shared engine was abandoned when the native apps went independent | **false — it is alive and central.** The compose engine lives at `packages/supabase/supabase/functions/_shared/engine/` (Deno, ~711 lines), runs at write time via `compose-pebble` / `compose-pebble-update`, and all three clients call it. The 2026-07-10 decision does not touch it. What *is* per-surface is the client-side parser/renderer that displays the composed SVG. | spec 2026-04-15, edge fns |

`pebble_shapes` was dropped 2026-07-01 (#503) but **never held the art** — it had
six named rows. The nine hand-drawn forms survive as baked template sets. The B1
draft's ending stands; its vocabulary does not.

## 3. Register

Authored per [`../../pbbls-atelier-editorial/04-voice-charter-en.md`](../../pbbls-atelier-editorial/04-voice-charter-en.md).

In one line: **the rigour of a good post-mortem, delivered by someone who is
genuinely funny and has nothing to prove.** Paulopus's sourcing discipline and
refusal to overclaim; the atelier's first person and plain treatment of failure;
dry humour that earns its place only by being *also* the most accurate sentence
available. Hard caps: one bracketed aside per piece, no memes, no emoji.

Every piece is authored in **English and French**. The French is an adaptation,
not a translation — same facts, same dates, same structure, warmer gesture.

## 4. The spine — three acts

The plant narrative runs Paulopus's five movements (Context / Intention /
Execution / Outcome / Reflection) over a three-act arc:

- **Act I — the private tool** (2022 → Mar 2026). Beck's columns in depression,
  the Notion template nobody adopted, the 15-step webapp that was technically
  fine and humanly unbearable, and the pivot: *never talk about therapy*.
- **Act II — the app** (Mar → May 2026). The contest month. The mineral language.
  Nine forms. Karma as encouragement. iOS. TestFlight. Twenty-one people.
- **Act III — the commons** (Jun → Sep 2026). Karma becomes a currency. Glyphs
  get creators, prices and moderation. Android reaches parity in six days. The
  journal grows a public face — and every safeguard that had to exist first.

**Through-line:** a tool built for one person learning to hold several, without
becoming the thing Act I refused to be.

**The stated ethical position** (author, 2026-09-02), which the Act III pods
must carry accurately: badges, currency and market exist **to reward and to
sustain the habit, not to imprison**. Karma is earned by recording — which
requires having lived something — and spent on glyphs that decorate memories made
outside the app. The aim is to send someone out into their life to collect
something worth keeping, not to hold them on a screen. **Time-in-app is not the
metric.**

### 4.1 Recorded positions (author, 2026-09-03) — statable as fact

These close review markers that were open across the first wave. They are
**sourced to the author** and may be stated in prose without a marker. Anything
beyond them still gets marked.

**The streak clause — the mechanic never broke the promise.** Bounce is a rank
on a rolling window that *erodes*; it is not a chain that breaks and punishes.
July made it visible to other people, which changed **who can see it**, not what
it does to you. April's promise was about punishment, and that still holds.

Write it that way, and keep the distinction sharp: the pieces should still say
plainly that the streak became social in July and that no decision entry records
the change. The position is that visibility is not punishment — not that nothing
happened. Do not overstate it into "the promise was never touched".

**Why the market is community-supplied — sharing your own marks, and being
rewarded for it.** Both proposed readings were accepted, with the emphasis on
the maker: the point is that you can share a thing you carved and get rewarded
for sharing it, and that the symbols on someone's memory were drawn by another
person who also records rather than by a design team.

**Factual correction that comes with it:** most of the community glyphs live
today were **drawn by Alexis**. The pieces must not imply a large third-party
creator base. This is consistent with what the code already says — first-party
glyphs are admin-owned normal listings — but the prose should not lean on
"other pebblers drew these" as a description of the *current* catalogue. It is
the design's intent, not yet its population. `pbbls-market` and `pbbls-d8` both
need a pass for this.

### 4.2 Act I is trimmed to what is independently sourced (author, 2026-09-03)

The pre-March-2026 material — Beck, the Notion template, the SvelteKit webapp,
the Wasted Sunday, the Emotion Pearls' reasoning — survives only in
agent-written digests (`00-chronologie.md`, `_digests/apple-journal.md`) and in
the `brouillons/`. The primaries (`draft.md`, the 37 Apple Journal entries) are
in **neither repo**.

**Decision: cut anything that traces only to a digest.** Keep what the pbbls
repo, the decision log, the specs, the migrations, the changelog or the Arkaik
journal can carry on their own. Act I becomes considerably thinner, and that is
accepted.

Consequences to apply:

- `plant-pbbls` Context — trim to sourced facts; the existing `[TO VERIFY]`
  there becomes a cut instead.
- `pbbls-cut` — its largest `[TO VERIFY]` covers exactly this material (the
  SvelteKit retro, the Sunday engine, the sidebar, Emotion Pearls, Moss Pool).
  Those reasons come out; the *events* stay where a primary confirms them.
- Future atelier beans (`pbbls-naming`, `pbbls-pivot`, `pbbls-psychology`)
  shrink accordingly, or wait for primaries to resurface.

If the primaries are ever recovered, this reverses — but no piece may assume
they will be.

---

The April 2026 onboarding promise was *"No streak to protect, no feed to scroll."*
The second clause is kept absolutely and enforced by decree dated before any code
existed: no feed, no directory, no search, no follower graph, connections by
invite or QR only (#658). The first clause is *complicated* — bounce has existed
since April, but became visible on a public profile in July. Pieces must state
both halves and the distinction, and must not flatten it into either a betrayal
or a non-event.

## 5. Structure

### 5.1 Two levels of narrative

- **Plant** (`/plant/pbbls`) — the five movements, with `::entity{ref=pod:…}`
  cards embedded in Execution.
- **Pod** (`/pod/<slug>`) — a shorter narrative (400–700 words) framing that
  territory, with bean cards.
- **Bean** (`/bean/<slug>`) — the full piece, 1,800–3,000 words.

### 5.2 Pod map — 11 pods in three families

Surfaces answer *where it runs*; domains answer *what it does*; the atelier
answers *how it got made*.

| Family | Pod slug | Name |
|---|---|---|
| Surface | `pbbls-web` | The Web App |
| Surface | `pbbls-ios` | The iOS App |
| Surface | `pbbls-android` | The Android App |
| Surface | `pbbls-backstage` | Backstage |
| Domain | `pbbls-record` | Recording a Pebble |
| Domain | `pbbls-pebble` | Pebbles & Glyphs |
| Domain | `pbbls-path` | The Path |
| Domain | `pbbls-karma` | Karma & the Glyph Market |
| Domain | `pbbls-souls` | Souls & Domains |
| Domain | `pbbls-public` | Connecting & Sharing |
| Atelier | `pbbls-atelier` | The Workshop |

`pbbls-karma` and `pbbls-public` are deliberately **two pods with two purposes**
(author, 2026-09-02): karma is a currency for acquiring glyphs through the
community market; public is how people connect and share memories. They shipped a
month apart from different pressures — the market from an economic design, the
public layer from a security response — and share only a calendar.

### 5.3 Bean map

Tier **A** = written in wave 1. **B** = stub now (name + description + milestone
ledger), piece later. **C** = stub only.

#### `pbbls-web`
| Bean | Tier | Subject |
|---|---|---|
| `pbbls-web-shell` | B | The PWA that stopped pretending to be offline — offline as an explicit non-goal (#620), and the cached-401 bug that proved it |
| `pbbls-polaroid-wall` | B | The Path as a polaroid wall; masonry dealt round-robin, never height-balanced (#720) |

#### `pbbls-ios`
| Bean | Tier | Subject |
|---|---|---|
| `pbbls-ios-jump` | B | Web to SwiftUI: M14→M23, TestFlight V0/V1 |
| `pbbls-ios-two-composers` | B | Two composers coexist on purpose (#723) — the resolution of April's flow-vs-quick-editor argument |
| `pbbls-ios-live-activity` | C | The Live Activity that device evidence killed (#505); widget target retained as dead code |

#### `pbbls-android`
| Bean | Tier | Subject |
|---|---|---|
| `pbbls-android-six-days` | B | Bootstrap to parity, 11–17 July: funnel → read-only Path → writes → stats → Profile/Settings → Souls → Collections → Snaps + Glyph Studio → Lab, across nine milestones (M38→M44) |
| `pbbls-android-parity-audit` | B | The 16 July audit: ~7,500–8,000 lines of iOS behaviour still missing, "none of it needs DB work", 12 gaps confirmed, zero false positives — plus three defects found in already-shipped code |
| `pbbls-android-divergence` | C | Draft glue deliberately left duplicated under "never refactor without approval", with the debt named and enforceable — both copies must receive every fix (#725). Its separate valence grid was superseded the same day by the fan (#729) |

#### `pbbls-backstage`
| Bean | Tier | Subject |
|---|---|---|
| `pbbls-analytics` | C | Measuring the product without making the numbers the point — what the admin actually reads, and the materialized-view layer that was designed, prototyped and deliberately never shipped |
| `pbbls-moderation` | B | The glyph queue, and the `SECURITY DEFINER` read that exists because the market policy would not be weakened (#497) |
| `pbbls-lab` | C | The Lab: in-app changelog, YAML prefilled from the clipboard (#601) |

#### `pbbls-record`
| Bean | Tier | Subject |
|---|---|---|
| `pbbls-record-flow` | B | Fifteen steps → seconds → two composers *(rewrite of draft B2)* |
| `pbbls-cards` | C | The cards: Beck, hidden in plain sight |
| `pbbls-drafts` | B | Keep the half-formed thoughts (#639) — a jsonb table, never a status column; autosave as insurance only |

#### `pbbls-pebble`
| Bean | Tier | Subject |
|---|---|---|
| `pbbls-valence` | B | How a memory became a shape *(rewrite of draft B1 — vocabulary corrected)* |
| `pbbls-wobble` | B | The petroglyph wobble: runtime, on-device, leaky filled outlines (#727) |
| `pbbls-glyph-carving` | C | Carving a glyph |
| `pbbls-render` | B | Compose once on the server, parse everywhere: one Deno engine at write time, three client renderers for display, parity held by `WobbleGolden.json` — which the web reads *from the iOS directory* and Android keeps as a byte-for-byte copy *(rewrite of B9; note the April ambition was always server-side composition, never an embedded shared client engine — B9's premise is wrong, not just its details)* |
| `pbbls-colour` | C | Emotion categories, palettes, per-surface tinting |

#### `pbbls-path`
| Bean | Tier | Subject |
|---|---|---|
| `pbbls-path-nav` | B | Neither a list, nor a thread, nor stories |
| `pbbls-collections` | C | Stack, Pack, Track |

#### `pbbls-karma`
| Bean | Tier | Subject |
|---|---|---|
| `pbbls-wallet` | **A** | One ledger, debt allowed, no floor at zero (#494) |
| `pbbls-market` | **A** | Use-rights not copies; net-zero transfers; price snapshotting (#496) |
| `pbbls-d8` | **A** | The glyph its own creator can no longer change (D8) |
| `pbbls-reward-not-prison` | **A** | The ethics piece — §4's position, tested against the design |
| `pbbls-badges` | B | Achievements: idempotent RPC, permanent, karma granted at unlock (#664) |

##### 5.3a — How every `pbbls-karma` piece must close

The economy shipped as one milestone (M36) across five days at the end of June,
and nothing has shipped in that area since 31 July. **That is a pause, not an
ending** (author, 2026-09-02): the system is live and behaving, further work is
intended, and other priorities took the summer.

Every karma piece's "where it stands now" states exactly that, dated, and says
plainly that the second Pebblestore good — themes and pebbleskins, named as
forthcoming in three specs — has not shipped. It does **not** describe the
economy as finished, abandoned, or stalled, and it does not promise a date.

The five-week gap is not a flaw to explain away. A solo builder shipping a
working economy and then leaving it alone to work on other things is ordinary,
correct prioritisation; write it as such (charter §7).

#### `pbbls-souls`
| Bean | Tier | Subject |
|---|---|---|
| `pbbls-souls-not-users` | C | Calling them souls |
| `pbbls-domains-greek` | C | **Rescoped 2026-09-03.** Five Greek domains (Zoē, Asphaleia, Philía, Timē, Eudaimonia) were seeded 11 April 2026; **four days later eighteen plain-English domains were entered by hand and became the real set.** The Greek rows were never deleted and a July spec calls them harmless debris. Maslow survives only in the labels the eighteen inherited and in an analytics sort array. The piece is that reversal, not the README's version |
| `pbbls-emotions` | C | **Rescoped 2026-09-03.** The "HealthKit alignment" is NOT in the product — no entitlement, no import, no type; it exists only in the April 2026 corpus and in legal boilerplate. Barrett is credited only on an influences page. The piece is the emotion model as actually shipped, and the marker asks whether the HealthKit lineage is a real influence or an artefact of the old corpus |

#### `pbbls-public`
| Bean | Tier | Subject |
|---|---|---|
| `pbbls-connections` | B | Invite/QR only, no search, no directory; blocks silent from day one (#658) |
| `pbbls-profiles-handles` | B | Handles, trigger-enforced; "a handle is a pointer, not an archive" (#654) |
| `pbbls-sharing` | B | What a share link exposes: one row, `render_svg`, nothing else |
| `pbbls-privacy-grades` | B | `secret` / `private` as connections-visible / shared; why a re-grade is not a user edit (#708). Frame per §8 |
| `pbbls-deletion-consent` | B | Anonymize to `user_id = null` so buyers keep rendering; consent on the record (#631). Frame per §8 |

#### `pbbls-atelier`
| Bean | Tier | Subject |
|---|---|---|
| `pbbls-naming` | B | Nomen omen *(rewrite of draft B3)* |
| `pbbls-pivot` | B | Beck's columns to a pebble *(rewrite of draft B4)* |
| `pbbls-psychology` | C | Beck, Barrett, Maslow, Kahneman, Clear, Lembke, SDT |
| `pbbls-agentic` | **A** | 367 commits, one author, 288 co-author trailers *(rewrite of B11)* |
| `pbbls-arkaik` | B | 67 nodes → 460; the map that updates itself (#622) *(rewrite of B8)* |
| `pbbls-harnesses` | B | Proof, not simulation — the audit programme and the contract harnesses that became a merge gate (#741). Frame per §8 |
| `pbbls-cut` | **A** | **What got cut** — everything abandoned or suspended, each with its date and its recorded reason. See §5.3b |
| `pbbls-unbuilt` | **A** | **What isn't built** — everything envisioned, planned or considered and not shipped, honestly separated by how real each one is. See §5.3b |

##### 5.3b — The two ledger beans

`pbbls-cut` and `pbbls-unbuilt` are a matched pair and the most load-bearing
pages in the atelier pod, for two reasons.

**They are the strongest evidence in the case study.** A builder who can name what
they killed, when, and why is demonstrating judgement; a builder who can name what
is not finished is demonstrating honesty about their own product. Both are rarer
and more persuasive than a feature tour. **Charter §7 is binding and matters more
here than anywhere else** — this is a record of decisions, not a list of regrets.
Nothing in either piece may read as apology, confession, or a near-miss.

**They are the pages the routine agent exists to maintain.** Every other bean
decays slowly; these two decay on every ship. When something in `pbbls-unbuilt`
ships it must leave that page and appear in a milestone ledger; when something is
abandoned it must enter `pbbls-cut` with its date and reason. The agent loop in
§7.2 should treat these two beans as its default destination for any Arkaik event
that changes a thing's status to or from `idea`/`archived`, and their account
watermark is therefore the most important date in the corpus.

**`pbbls-unbuilt` must grade its entries by how real they are**, because "planned"
and "idle thought" are different claims: shipped-copy promises with no
implementation (the Cairn, and the privacy policy's fictional sections — §11.7)
· specced and not landed (the owners/usage read
function behind the "Soon" placeholder; block-management UI) · named as future in
specs (themes and pebbleskins; creator royalties) · known parity gaps (Sign in
with Apple on Android and the rest of the 16 July audit) · open explorations
(the bounce Path A / Path B question, unresolved since mid-May). Never present a
lower grade as a higher one, and never promise a date.

Total: 11 pods, **42 beans. 7 tier-A, 23 tier-B, 12 tier-C** — corrected
2026-09-04 (#54) by counting the tables above; the previous "35 beans, 5/20/10"
never matched them. §10's "five tier-A pieces" is still right: it describes
wave 1, which does not include the two ledger beans of §5.3b.

## 6. Sprouts — the account, and the ledger

Each bean carries:

- **One account sprout** — the readable piece. Slug `<bean>-0`, then `<bean>-1`,
  `<bean>-2` for successive accounts. `date` = the last day the narrative
  accounts for (the **watermark**).
- **Milestone sprouts** — dated, content-free, one per shipped deliverable, named
  from the Arkaik journal's `deliverable.shipped` titles, which are already
  written in user-facing English ("Your karma, now in a Wallet"). These form the
  evolution ledger the bean page renders beneath the article.

The bean page renders the **newest published content-bearing sprout** as prose
(`lib/article.ts`) and lists every sprout below it. So publishing `<bean>-1`
swaps the article while `<bean>-0` stays visible as a dated earlier account.

This is not a workaround; it falls out of an existing safety rule. `/api/articles`
**refuses to touch a sprout a human has reviewed** (409). An agent therefore can
never silently rewrite a published piece — it can only propose the next one. The
door's paranoia and the botanical model's promise turn out to be the same thing.

## 7. Crossing, and the maintenance contract

### 7.1 How pods get crossed

A bean has exactly one home. Crossing happens three ways, all already supported:

1. **Prose entity refs** — `::entity{ref=bean:pbbls-valence}` inside a piece.
   These mirror into `relations[]` at write time, so the graph reads stored refs
   and never parses prose. Write the cross-reference, get the edge free.
2. **Explicit relations** — `evolves-from`, `superseded-by`, `constrains`.
   `pbbls-wobble` `evolves-from` `pbbls-valence`; `pbbls-render` is
   `superseded-by` nothing but explicitly `revises` the April shared-engine claim.
3. **Journal events** — Arkaik pollen envelopes carry `anchors.{plant,pod,bean}`.
   Pod slugs are landing zones; getting the vocabulary right now is what lets
   future events file themselves.

### 7.2 The routine agent (designed now, built later)

Loop:

1. **Read the cursor.** Last processed Arkaik pollen id.
2. **Pull** envelopes after it, filtered to `anchors.plant = plant:pbbls`.
3. **File** each `deliverable.shipped` as a milestone sprout under the bean it
   advances, using a slug→bean routing table maintained in this spec's companion
   plan. Unroutable events go to a review queue, never guessed.
4. **Compare** new milestones against each affected bean's account watermark.
5. **Draft** `<bean>-N+1` *only* where the new milestones contradict or
   materially extend the standing account — with a diff note naming what changed.
   Cosmetic additions append to the ledger and touch nothing else.
6. **Never publish.** Everything lands private. Publication is a human act.

Preconditions: the hosted Arkaik pollen endpoint currently returns **404** with
the configured token and project id (`data/federation.yml`, feed `arkaik-pbbls`).
The transport needs fixing before any of this runs. The *content* problem is
already solved — pbbls emits the feed, 926 events deep.

## 8. Security and quality — the frame

**Decided (author, 2026-09-02): no incident disclosure.** The subject is the
**audit programme**, not its findings.

Pebbles ran a deliberate security and quality audit, outlined in partnership with
Arkaik, which identified a set of improvement surfaces across the data layer and
the client contract. That work produced the privacy-grade architecture, the
definer-RPC projection pattern for cross-user reads, trigger-pinned capability
columns, and four contract harnesses that were subsequently promoted to a merge
gate so the same classes cannot regress unnoticed.

**That is the story, and it is a strong one.** Someone building solo with agents
designed a systematic audit, acted on it, and then made the checks structural.
The evidence of rigour is the point.

### What gets written

- The audit programme: why it was run, how it was scoped, what it looked for.
- The architecture that came out of it, with its reasoning — including the lines
  worth quoting on their own merits, e.g. *"owning a row is not authority to
  raise capability in it."*
- The harnesses: why acceptance tests against a real project are "proof rather
  than simulation", why every merged Supabase PR performs real signups and
  deletions, and why `verify-account-purge` deliberately stays manual.
- Classes of issue as **things the audit was designed to catch** — stated as
  engineering categories, in the register of a good checklist.

### What does not get written

- Specific live vulnerabilities in a shipped product.
- Impact figures, record counts, affected-user counts.
- Exploitability narratives, or anything a reader could follow as a recipe.
- Dates or issue numbers that pin a fix to a window of exposure.
- Any framing — "breach", "leak", "incident", "P0" — that casts routine,
  well-handled engineering work as an emergency.

### Rationale, and a rule that generalizes

Honesty here means being accurate about **what was done, why, and how**. It does
not mean maximizing drama, and self-deprecation is not the same thing as candour.
A finding surfaced by your own audit is evidence the audit works; narrating it as
a near-miss inverts its meaning and misleads the reader about what happened.

Writers: where material could read as either *competence* or *confession*, check
which one the facts actually support before choosing the framing. Usually it is
competence, and the accurate telling is also the better one.

`pbbls-privacy-grades`, `pbbls-deletion-consent` and `pbbls-harnesses` are
**unblocked** under this frame and move to tier B.

## 9. Engineering prerequisites

Neither blocks wave 1; both block *publication as designed*. Each needs its own
spec, plan and PR.

### 9.1 Bilingual authoring and a locale switch

- `POST /api/articles` accepts **plain strings only**. It must accept
  `{ en, fr }` for `name`, `description`, `narrative` and `content`. The model's
  `Text` type and `composeText` already exist; this is validation plus the store
  write.
- `resolveText(value, lang)` **already takes a locale**, defaulting to `"en"`.
  The switch is threading a locale through six public files plus a header
  control, and making `articleFor`'s blankness check locale-aware.

Until this ships, agents write both languages into repo payload files, EN posts
through the existing door, and the FR half lands the day the door widens. Nothing
is written twice.

### 9.2 The legacy bean migration

**Done, 2026-09-04 (#54).** Spec:
`docs/superpowers/specs/2026-09-04-pbbls-legacy-bean-retirement-design.md`.

Two things this section got wrong, found while surveying:

- **Four beans, not two.** `bean:pbbls-path` and `bean:pbbls-recorder` were
  public with nothing in them, rendering as empty pages on the live site.
- **Two slug shadows, not one.** `bean:pbbls-path` shadowed `pod:pbbls-path`
  exactly as `bean:pbbls-ios` shadowed `pod:pbbls-ios`.

All four were deleted (backed up to `data/retired/`), the twelve changelog
sprouts were refiled as `type: milestone` under the beans they advance, and the
36 beans of §5.3 that did not exist yet were seeded as private stubs so every
ref in `payloads/_SLUGS.md` resolves.

Consequence, accepted at the time: `plant:pbbls` is public and carries no
narrative, so those four beans were its entire public content. `/plant/pbbls` is
deliberately empty until the case study publishes.

Still open: only 12 of the pbbls changelog's 47 entries were ever imported. The
remaining 35, plus 217 `deliverable.shipped` journal events, are a ready-made
milestone ledger — #55.

## 10. Wave 1

Five tier-A pieces, fresh sources, no disclosure block, dispatched in parallel:

| Bean | Why first |
|---|---|
| `pbbls-wallet` | The economy's foundation; the "no floor at zero" decision is exemplary |
| `pbbls-market` | Use-rights, net-zero transfers — undocumented anywhere public |
| `pbbls-d8` | A moral position expressed as a database policy |
| `pbbls-reward-not-prison` | The ethics spine; the author's position is now on record (§4) |
| `pbbls-agentic` | The method piece; 367/288 is the number that opens it |

Each agent receives: the voice charter, the relevant `_digests/*-current.md`, the
bean's source list, and the instruction to mark gaps `[TO VERIFY: …]` rather than
invent. Output is EN + FR payload files under
`docs/pbbls-atelier-editorial/payloads/`, reviewed before anything is posted.

Waves 2+ follow tier B, ordered by pod, once wave 1's register is approved.

## 11. Open questions

1. **Security disclosure** (§8) — blocking for three beans.
2. ~~The economy stops on 31 July — pause or ending?~~ **Resolved (author,
   2026-09-02): paused.** See §5.3a.
3. **Does the FR half of tier-C beans get written at all**, or do stubs stay
   EN-only until promoted?
4. **Android ships with a default app icon.** The parity audit records the stock
   icon as live on the Play internal-testing track, alongside placeholder
   onboarding illustrations, a static cairn instead of the Rive animation, no
   karma sound or haptics, and — the substantive one — **no Sign in with Apple**,
   which locks every iOS Apple-account user out of Android entirely. Does
   `pbbls-android-six-days` say this plainly? The honest version of a six-day
   parity story includes what six days does not buy, and the audit's own
   candour ("zero false positives") is the piece's best argument. Author's call.

5. **A second unacknowledged reversal.** The step-by-step record flow retired by
   PR #161 on 2026-04-08 became the default again on all three surfaces on
   23–24 August. The decision log does not mention it; only the Arkaik map says
   so obliquely (`V-record-success`: "Revives the celebration beat … before #161
   retired it"). Same shape as the streak reversal — a position quietly
   re-adopted without a record. Worth one paragraph in `pbbls-record-flow`, and
   worth knowing whether it was deliberate.

7. **The live privacy policy describes features that do not exist.** Served at
   `/docs/privacy` in both languages, it carries a **Therapist Access** section
   with granular permissions, a definition of **"Decisions"** scored −3 to +3,
   and a **Cairns** section on anonymised weekly/monthly aggregations. None of
   these exist, and Therapist Access contradicts the product's own rule since
   25 March 2026 ("never talk about therapy"). The 28 July roadmap already
   schedules the rewrite (M56) and calls those sections fictional — so this is
   known, but it is live. **This is a product/legal matter, not an editorial
   one**, and it is raised here only because the case study cannot honestly
   describe the Cairn without touching it. Author's call, outside this spec.

8. **Two live defects surfaced while writing.** `compute_karma_delta` still pays
   up to four of a pebble's ten karma points for cards, while every client sends
   `cards: []` or omits the key — four of ten points are unreachable. And
   `20260501000003_analytics_meaning_share.sql` derives `domain_level` via
   `array_position` over the five Greek domain slugs, which returns null for all
   eighteen real ones. Both verified in code, neither raised anywhere in pbbls.

6. **No surface has a public release.** Web and admin auto-deploy via Vercel,
   Android publishes a signed AAB to Play *internal testing*, iOS builds on
   Xcode Cloud (workflow definition not in the repo). Every "shipped" in this
   case study means shipped to a closed track. Pieces must not imply otherwise.
