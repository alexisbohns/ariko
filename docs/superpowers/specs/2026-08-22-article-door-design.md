# Slice 4 — The article door: long-form content arrives through an API

**Date:** 2026-08-22
**Umbrella:** [`2026-08-22-content-composition-design.md`](2026-08-22-content-composition-design.md) — the umbrella called its tail "the Paulopus import, a content task". That framing was wrong (§1); this slice replaces it.
**Status:** Approved design, ready for a plan.

---

## 1. Problem

The umbrella assumed the Paulopus articles would be imported by committing markdown — into
`garden.yml` or into a `data/articles/` folder. **Content of this kind does not belong in a
repository.** It is what an agent or a routine writes and posts; its home is Ariko's database, and
the only thing a repo should hold is the door it arrives through.

Measured against that, slices 1–3 left a hole and half a hole:

- **`Plant.content` and `Pod.content` have no authoring door at all.** Slice 3 gave containers a
  narrative field and a page to render it, and the only way to fill it is editing `garden.yml` and
  running `npm run migrate` — content living in a repo, by construction.
- **Sprout content has a door but a human-shaped one.** `/api/inbox` takes a body and triage
  promotes it, one capture at a time. That is a capture path for raw material, not a publishing path
  for a finished set of articles, and it cannot touch a container.

So the Paulopus set does not need an importer. It needs the door it should have arrived through, and
it is that door's first payload.

## 2. Decisions

1. **A new `POST /api/articles`, sibling to the synthesis door.** Same proven shape: bearer token,
   pure all-or-nothing validation before any write, idempotent upsert, refusal rather than clobber.
   Not a generalization of `/api/synthesis` — that endpoint's week-id and digest-bean grammar is
   load-bearing for the weekly bee, and widening it to a second payload shape would put that at risk
   for no gain.
2. **One payload carries a container's narrative and its articles**, because they are written
   together and are meaningless apart:

   ```json
   {
     "container": "plant:paulopus",
     "narrative": "## Context\n…",
     "articles": [
       { "slug": "karma-accountability", "name": "Karma & Accountability",
         "description": "One line.", "date": "2026-07-24", "content": "…" }
     ]
   }
   ```

   Both halves are optional individually — a payload may carry narrative only, or articles only —
   but not both absent.
3. **The door structurally cannot publish.** `state` on any article is a refusal, whatever its
   value, exactly as the synthesis door does it. Machines draft; the human publishes.
4. **It refuses to overwrite reviewed work.** An article whose stored sprout has **any** `state` set
   is refused, and one refusal aborts the whole batch. A container is refused when it is already
   **public and carries a non-blank narrative** — the closest available proxy for "a human has
   published this prose", since containers have visibility but no state.
5. **The door never changes visibility.** It creates beans private (as `createBean` already does) and
   leaves the container's visibility exactly as it found it. Publication stays a human act performed
   in the admin, where the existing `publishCascade` lifts bean and container together.
6. **Sprout slugs are derived and stable:** `<article-slug>-0`, matching the garden's existing
   convention (`wait-for-the-sun-0`). Re-posting an unreviewed article updates that same sprout, so a
   correction is a re-post. A *revision* as a second sprout is a later concern and a human act (§7).
7. **`rehype-slug` joins the pipeline.** Six of the Paulopus cross-links point at drawer anchors
   (`#execution`), and rendered headings carry no `id` today, so those links currently land at the
   top of the page. The sanitize schema widens to allow `id` on headings only.
8. **Refs mirror on this write path too**, via the same `extractRefs`/`mergeMirrored` the other three
   writers use.

## 3. The operating sequence (why the door needs no publish flag)

Posting a narrative to an already-public container would put live prose on the site whose entity
cards all resolve to nothing — the articles being drafts — so every link in it would silently
degrade. The existing mechanics already solve this without a new gate:

1. The container is **private** while its content is being posted and reviewed. `/plant/[slug]`
   already `notFound()`s for a container outside the public projection.
2. The payload lands: narrative on the container, one draft sprout per article, beans created
   private.
3. The author reads them in the admin, edits, and publishes the sprouts.
4. `publishCascade` — untouched, already shipped — flips each bean **and the container** public. The
   narrative, the cards and the articles all go live in the same act.

This is documented as the procedure rather than enforced by the door, because a container may
legitimately be private for other reasons and the door has no business inferring intent.

## 4. Validation rules

Pure, in `lib/articles.ts`, all-or-nothing, first failure names the offender:

- `container` is a `plant:`/`pod:` ref matching the slug grammar `^[a-z0-9][a-z0-9-]*$`; `bean:` is
  refused (a bean's narrative is its sprout's content, not a field).
- `narrative`, when present, is a string of at most **64 KiB** (the largest Paulopus focus is ~8 KB,
  the molecule ~12 KB).
- Each article: `slug` matching the slug grammar and unique within the batch; `name` non-blank;
  `date` `YYYY-MM-DD`; `content` a string of at most 64 KiB; `description` optional; **any `state`
  key is a refusal**.
- Unknown top-level keys are ignored, matching the pollen envelope's forward-compatibility rule.

DB-dependent refusals (reviewed sprouts, published container) are checked in the store before any
write, and reported as `409` with the offending slugs — the synthesis door's contract.

## 5. Paulopus, the first payload

Prepared **outside the repo** (scratchpad, discarded after posting) and sent by hand with `curl`. No
poster script, no committed copies: the articles' provenance stays in the paulopus repo where they
were written, and their home becomes Ariko's database.

Transformations applied while building the payload:

| Source | Becomes |
|---|---|
| `molecule.md` body (minus frontmatter and its `# Paulopus` H1, which the page renders from the name) | `narrative` on `plant:paulopus` |
| each `focuses/<slug>.md` | one article: `slug`, `name` from `title`, `content` from the body |
| the 10 molecule→focus links, mid-sentence | inline `:entity[Prediction Timelines]{ref=bean:prediction-timelines}` — the sentences read exactly as written |
| each drawer's end | a cluster of `::entity{ref=bean:…}` block cards for the focuses that drawer compresses, from the molecule's own `compresses:` frontmatter |
| the 6 focus→molecule links | plain links to `/plant/paulopus#<drawer>` — an anchor is a location, not an entity, and §2.7 makes them land |
| `molecule_drawer`, `sources` frontmatter | dropped; the drawer relationship is expressed by the cards and mirrored into `relations[]` |
| `substack/*.md` | **not posted** — a distribution layer, not a mirror of Ariko |

**Two human review gates, both hard stops:**

1. **The eight synopses.** No focus carries one; each needs one or two sentences as its bean
   `description`. Drafted from the article for the author to edit or replace — not auto-generated
   from the opening paragraph, which would defeat the field.
2. **The eight verification flags.** `content-ops/paulopus/verification-flags.json` records 8 flags
   whose prose was edited afterwards in paulopus `4ea4b3c` without the file being updated. Neither
   file can be trusted alone; the flagged claims are re-read against the current text before the
   payload is built.

## 6. Testing

- **`lib/articles.test.ts`** — the validation matrix: container grammar, `bean:` refused, missing
  both halves refused, slug grammar, duplicate slugs, blank name, bad date, oversized content, and
  **`state` refused whatever its value**.
- **`lib/articles-store.test.ts`** — DB-backed, auto-skipping without `MONGODB_URI`: a fresh post
  creates bean + sprout + narrative; a re-post updates in place; a sprout with any state set is
  refused and **nothing in the batch is written**; a public container with a narrative is refused;
  beans are created private.
- **`app/api/articles`** covered by `lib/articles-route.test.ts` in the shape of the existing
  route tests: 401 without a token, 400 on malformed JSON, 409 on refusal, 200 with counts.
- **`lib/markdown.test.ts`** — a heading gains an `id`, and the widened schema still strips
  everything it stripped before.

## 7. Out of scope, seams reserved

- **Revisions as second sprouts** (`<slug>-1`). The model supports it, the door does not yet address
  it; a `revision` field is the seam.
- **An admin surface for container narrative** — Track A. Until it exists, correcting a published
  narrative means re-privatizing the container or editing the database.
- **A poster script / workflow in paulopus.** Deliberately not built: one payload, sent by hand. If
  a second set of articles ever wants posting, that is when the federation-shaped poster earns
  itself.
- **Publishing from the door**, in any form (§2.3).
