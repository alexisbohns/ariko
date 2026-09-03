# Retiring the legacy Pebbles beans

**Date:** 2026-09-04
**Status:** Approved (author, 2026-09-04).
**Issue:** #54
**Parent spec:** `docs/superpowers/specs/2026-09-02-pbbls-case-study-design.md` §9.2
**Scope:** Retire the four seeded `pbbls-*` beans, re-parent their twelve
changelog sprouts onto the beans the case study actually uses, and seed the rest
of the bean map as private stubs so every ref in `_SLUGS.md` resolves.
**Out of scope:** importing the 35 unimported changelog entries or the 217
`deliverable.shipped` journal events (#55); writing any bean article (#56);
publishing anything.

---

## 1. The state this starts from

Verified against Mongo and `data/garden.yml` on 2026-09-04.

| Bean | Visibility | Sprouts | Problem |
|---|---|---|---|
| `pbbls-webapp` | public | 6 | Superseded by the pod tier |
| `pbbls-ios` | public | 6 | Slug-shadows `pod:pbbls-ios` |
| `pbbls-path` | public | 0 | Empty page, live now; slug-shadows `pod:pbbls-path` |
| `pbbls-recorder` | public | 0 | Empty page, live now |

Two corrections to the record, both found while surveying:

- **There are two slug shadows, not one.** §9.2 names only `pbbls-ios`.
  `bean:pbbls-path` shadows `pod:pbbls-path` the same way.
- **The bean map holds 42 beans, not 35.** §5.3's closing line ("Total: 11 pods,
  35 beans. 5 tier-A, 20 tier-B, 10 tier-C") does not match its own tables, which
  list 42 rows; `_SLUGS.md` lists the same 42 plus the two legacy beans. Six are
  authored and live in Mongo, so **36 are missing**. #56's "remaining 27 beans"
  inherits the same undercount.

Nothing technically breaks today. Refs are prefixed (`pod:` / `bean:`), so a
shadow is not an ambiguous lookup — it is an ambiguous *choice*, offered to every
writer and every writing agent in the admin's entity picker, and mitigated today
only by a prose warning at the bottom of `_SLUGS.md`.

## 2. What this changes, and the one visible consequence

`plant:pbbls` is **public** and carries no narrative. Those four beans and twelve
sprouts are its entire public content. Re-parenting the sprouts onto private
stubs empties `/plant/pbbls` on the live site.

**Accepted (author, 2026-09-04).** What is live now is four thin beans, two of
them literally empty. A quiet plant page is better than a wrong one, and the
plant narrative payload already exists to fill it when #56 lands. This is not a
regression to fix later; it is the intended intermediate state.

## 3. Decisions

| Question | Decision (author, 2026-09-04) |
|---|---|
| How do the four retire? | **Deleted**, after a JSON backup written by the script |
| How many stubs? | **All 36 missing beans**, private |
| Where do stubs live? | **`data/garden.yml`**, following the pod tier's precedent |
| The empty plant page? | **Accepted** — pbbls goes quiet until #56 publishes |
| The three ambiguous sprouts? | **Domain-first** (§4) |
| Sprout `type`? | Retyped `feature` → **`milestone`** (parent spec §6) |

Delete is safe because, once the twelve sprouts have moved, the four beans hold
nothing but a slug, a name and a `plant:pbbls` parent. There is no content to
lose. The backup exists so the decision is reversible, not because the docs are
valuable.

## 4. The sprout map

Four assignments are named in parent-spec §9.2 (marked *spec*). Three were
genuine judgement calls and were decided **domain-first** — §9.2's own
instruction is to re-parent onto "the domain beans they actually advance", so a
milestone about browsing a life backwards belongs to the Path, not to the surface
that happened to ship it first.

| Sprout | Milestone | → Bean | |
|---|---|---|---|
| `pbbls-webapp-core` | Path, Collections & Pebble Detail | `pbbls-path-nav` | call |
| `pbbls-webapp-color` | Color World Themes | `pbbls-colour` | |
| `pbbls-webapp-record-flow` | Multi step recording flow | `pbbls-record-flow` | |
| `pbbls-webapp-emotion-pearl` | Emotion Pearl | `pbbls-valence` | spec |
| `pbbls-webapp-pwa` | PWA Support | `pbbls-web-shell` | spec |
| `pbbls-webapp-karma` | Karma and Bounce system | `pbbls-wallet` | spec |
| `pbbls-ios-core` | Core iOS App | `pbbls-ios-jump` | |
| `pbbls-ios-record-flow` | Multi step recording flow | `pbbls-record-flow` | |
| `pbbls-ios-profile` | Profile and Settings | `pbbls-ios-jump` | call |
| `pbbls-ios-pebble-detail` | Pebble Detail View | `pbbls-path-nav` | call |
| `pbbls-ios-pebble-render` | Pebble Render Engine | `pbbls-render` | spec |
| `pbbls-ios-emotion-colored-pebbles` | Emotion Colored Pebbles | `pbbls-colour` | |

Eight target beans; `pbbls-wallet` already exists, the other seven are among the
36 stubs.

**Sprout slugs do not change.** The `webapp-`/`ios-` prefix records *which
surface shipped it*, which is exactly the fact a milestone ledger wants once #55
adds 217 more events. `pbbls-ios-record-flow` under `bean:pbbls-record-flow`
reads as "the iOS recording-flow milestone", which is what it is.

Two beans end up holding two same-named sprouts (`pbbls-record-flow` gets both
"Multi step recording flow" milestones, one per surface, dated a fortnight
apart). That is correct: they are two shipments of the same feature, and the
ledger should say so.

## 5. Architecture

The `migrate-retier` precedent, followed deliberately rather than reinvented: a
**pure, idempotent transform** over a `RawGarden`, tested against the real
`data/garden.yml`, driven by one `--dry-run`-capable script that applies the same
transform to the YAML and to Mongo.

### 5.1 `lib/pbbls-legacy.ts` — the transform

Exports three catalogs and one function.

- `LEGACY_BEANS: string[]` — the four slugs that retire.
- `SPROUT_MAP: Record<string, string>` — the twelve `sprout slug → bean slug`
  pairs of §4.
- `STUB_BEANS: Bean[]` — the 36 stubs, each with `slug`, `name`, `description`,
  `parents: ["pod:…"]` and `visibility: "private"`.
- `retireLegacyBeans(raw: RawGarden): RawGarden` — adds any missing stub,
  rewrites the twelve sprouts' `parents` and `type`, drops the four legacy beans.

Idempotence is a property, not a step: the function is a no-op on its own output,
which is what makes a single test suite cover both the pre- and post-migration
`garden.yml`.

Two rules the transform keeps, both about not destroying authored work:

- **A stub is only ever added, never merged.** If a bean with that slug already
  exists — the six authored ones, or a stub authored since — the catalog entry is
  skipped entirely. The catalog never overwrites a name or a description.
- **A sprout is re-parented only if `SPROUT_MAP` names it.** Nothing is inferred
  from a slug prefix.

### 5.2 `scripts/migrate-pbbls-legacy.ts` — the driver

`npm run migrate:pbbls-legacy [-- --dry-run]`, ordered so every intermediate
state is readable if the run is interrupted:

1. Load `data/garden.yml`, compute the transform, hold the result.
2. Mongo: insert missing stub beans (`$setOnInsert`, so an existing doc is
   untouched even if the guard in 5.1 were ever wrong).
3. Mongo: `$set` `parents` and `type` on the twelve sprouts — diffed per doc, so
   an idempotent re-run logs no writes.
4. Mongo: read the four legacy beans, write them to
   `data/retired/2026-09-04-legacy-pbbls-beans.json`, then delete them. Beans go
   **last**, when nothing points at them any more.
5. Write `data/garden.yml` — only once the Mongo half is fully through, so a
   connection failure has zero side effects.

The backup file is committed. It is small, it is the reversal path, and a
deletion with an uncommitted backup is a deletion.

### 5.3 `data/garden.yml`

- The four `pbbls-*` bean entries are removed.
- The twelve sprouts get their new `parents` and `type: milestone`.
- A delimited stub block is added, carrying the same warning the pod tier
  carries, plus the one this tier adds:

  > These are **stubs**. `migrate` `$set`s `name` and `description` on every run,
  > so the day a bean is authored through the admin, **delete its line here** —
  > or the next migrate reverts the title to the placeholder. The six already
  > authored (`wallet`, `market`, `d8`, `connections`, `cut`, `unbuilt`) are
  > deliberately absent for exactly this reason.

  This is the accepted cost of the pod-tier precedent, stated where someone will
  read it.

### 5.4 `lib/pbbls-legacy.test.ts`

Against the real `data/garden.yml`, so every assertion holds before and after:

- the transform is idempotent (`f(f(x)) === f(x)`);
- no output bean carries a `LEGACY_BEANS` slug;
- every `SPROUT_MAP` value resolves to a bean in the output;
- every `SPROUT_MAP` key resolves to a sprout, with the mapped parent and
  `type: "milestone"`;
- every stub's `parents` names a pod that exists;
- a fixture bean with a stub's slug and an authored name survives untouched;
- a sprout not in `SPROUT_MAP` is untouched;
- `STUB_BEANS` and the six authored slugs are disjoint, and together equal the
  42 of `_SLUGS.md` minus the two legacy ones.

The last one is the guard that keeps the catalog and the writers' reference from
drifting.

## 6. Documentation changes

- `_SLUGS.md` — drop the "Legacy seeded beans … Never link to either" note; the
  beans are gone. Add the count so the file states its own size.
- Parent spec §5.3 — correct "Total: 11 pods, 35 beans" to the real count.
- Parent spec §9.2 — mark done, note the second shadow (`pbbls-path`) and the
  four-bean scope rather than two.
- `README.md` — one line for the new `migrate:pbbls-legacy` script alongside the
  other one-shots.

## 7. Not done here

- The 35 unimported changelog entries and the 217 `deliverable.shipped` events
  (#55). This spec deliberately leaves the ledger at twelve entries.
- Any article, any FR text, any publication (#56, #53).
- An admin re-parenting UI. Still the deferred A3 slice; this remains a script.

## 8. Lab Note

None. Retiring seed data and re-parenting private stubs is structural work. The
one visitor-facing effect — `/plant/pbbls` going quiet — is the removal of four
thin pages, not a change anyone would want announced. The note belongs to the PR
that publishes the case study.

---

## Appendix A — the 36 stubs

Names and descriptions are **provisional**, derived from parent-spec §5.3's
subject column. They exist so a bean page is not blank and a card is not
nameless; the authoring wave replaces both (and adds the FR half), at which point
the stub's line leaves `garden.yml` per §5.3's rule. Plain strings, not `{en, fr}`
— the pod tier's convention, and the bilingual pair arrives with the article.

### `pod:pbbls-web`
| Slug | Name | Description |
|---|---|---|
| `pbbls-web-shell` | The Web Shell | The PWA that stopped pretending to be offline. |
| `pbbls-polaroid-wall` | The Polaroid Wall | The Path as a wall of polaroids, dealt round-robin rather than height-balanced. |

### `pod:pbbls-ios`
| Slug | Name | Description |
|---|---|---|
| `pbbls-ios-jump` | The Jump to SwiftUI | Web to native, and the TestFlight builds that settled whether Pebbles was an app. |
| `pbbls-ios-two-composers` | Two Composers | Why two ways of writing a pebble coexist on purpose. |
| `pbbls-ios-live-activity` | The Live Activity | The Live Activity that device evidence killed, and the widget target left behind. |

### `pod:pbbls-android`
| Slug | Name | Description |
|---|---|---|
| `pbbls-android-six-days` | Six Days to Parity | Bootstrap to parity in six days, across nine milestones. |
| `pbbls-android-parity-audit` | The Parity Audit | The July audit that counted what was still missing, and found three defects in shipped code. |
| `pbbls-android-divergence` | Deliberate Divergence | Duplicated draft glue, kept on purpose, with the debt named and enforceable. |

### `pod:pbbls-backstage`
| Slug | Name | Description |
|---|---|---|
| `pbbls-analytics` | Analytics | Measuring the product without making the numbers the point. |
| `pbbls-moderation` | The Glyph Queue | Human review of submitted glyphs, and the read that exists because the market policy would not be weakened. |
| `pbbls-lab` | The Lab | The in-app changelog, prefilled from the clipboard. |

### `pod:pbbls-record`
| Slug | Name | Description |
|---|---|---|
| `pbbls-record-flow` | The Recording Flow | Fifteen steps, then seconds, then two composers. |
| `pbbls-cards` | The Cards | Beck, hidden in plain sight. |
| `pbbls-drafts` | Drafts | Keeping the half-formed thoughts: a table of its own, never a status column. |

### `pod:pbbls-pebble`
| Slug | Name | Description |
|---|---|---|
| `pbbls-valence` | Valence | How a memory became a shape. |
| `pbbls-wobble` | The Wobble | The petroglyph wobble, computed at runtime on the device. |
| `pbbls-glyph-carving` | Carving a Glyph | How a symbol gets drawn by hand, submitted, and accepted. |
| `pbbls-render` | The Render Engine | Compose once on the server, parse everywhere. |
| `pbbls-colour` | Colour | Emotion categories, palettes, and per-surface tinting. |

### `pod:pbbls-path`
| Slug | Name | Description |
|---|---|---|
| `pbbls-path-nav` | The Path | Neither a list, nor a thread, nor stories. |
| `pbbls-collections` | Collections | Stack, Pack and Track — three ways of gathering pebbles. |

### `pod:pbbls-karma`
| Slug | Name | Description |
|---|---|---|
| `pbbls-reward-not-prison` | Reward, Not Prison | An economy that rewards recording without ever becoming a streak to protect. |
| `pbbls-badges` | Badges | Achievements: idempotent, permanent, and paid at unlock. |

### `pod:pbbls-souls`
| Slug | Name | Description |
|---|---|---|
| `pbbls-souls-not-users` | Souls, Not Users | Why the people in someone's pebbles are called souls. |
| `pbbls-domains-greek` | The Greek Domains | Five Greek domains seeded, and the eighteen plain-English ones entered four days later. |
| `pbbls-emotions` | The Emotion Model | The emotion model as it actually shipped. |

### `pod:pbbls-public`
| Slug | Name | Description |
|---|---|---|
| `pbbls-profiles-handles` | Handles | A handle is a pointer, not an archive. |
| `pbbls-sharing` | Sharing | What a share link exposes: one row, and nothing else. |
| `pbbls-privacy-grades` | Privacy Grades | Secret and private, as connections-visible and shared. |
| `pbbls-deletion-consent` | Deletion & Consent | Anonymising rather than destroying, so what someone bought keeps rendering. |

### `pod:pbbls-atelier`
| Slug | Name | Description |
|---|---|---|
| `pbbls-naming` | Nomen Omen | How Pebbles got its name. |
| `pbbls-pivot` | The Pivot | From Beck's columns to a pebble. |
| `pbbls-psychology` | The Psychology | Beck, Barrett, Maslow, Kahneman, Clear, Lembke, SDT. |
| `pbbls-agentic` | The Agentic Method | One author, and the co-author trailers on most of the commits. |
| `pbbls-arkaik` | Arkaik | Sixty-seven nodes to four hundred and sixty: the map that updates itself. |
| `pbbls-harnesses` | The Harnesses | Proof rather than simulation — the audit programme, and the contract harnesses that became a merge gate. |

36 stubs. The six authored beans that already exist — `pbbls-wallet`,
`pbbls-market`, `pbbls-d8`, `pbbls-connections`, `pbbls-cut`, `pbbls-unbuilt` —
are deliberately absent from this catalog and from `garden.yml`. 36 + 6 = the 42
of `_SLUGS.md`.
