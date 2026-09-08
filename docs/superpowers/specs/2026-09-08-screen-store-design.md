# The screen store — a library the exhibition can draw from

*2026-09-08*

## 0. The observation

The phone-covers slice ([`2026-09-08-bean-phone-covers-design.md`](2026-09-08-bean-phone-covers-design.md))
needed eight screenshots of Paulopus and produced a hundred and seventy. Seven
of the eight covers came straight out of that capture run; the rest of it — every
match tab, sixteen team pages, the karma graphs, four hero moods — sat in a
session scratchpad under `/private/tmp`, on a path keyed to a conversation id,
one cleanup away from not existing.

That is the immediate problem, and it is a storage problem. But the interesting
half is what the capture run revealed: an app has a *body of screens*, and the
portfolio has nowhere to put one. `media[]` on a sprout holds assets rendered in
that sprout's body. `cover` holds one image for one bean. Neither is a library,
and a plant deliberately has no assets array at all —

> A plant has `logo` (one image) and no assets array at all, and inventing one
> so that six URLs have somewhere to sit would be giving it a body it does not
> have. — `lib/data.ts`

That comment is still right, and this spec does not overturn it. A plant does
not grow an `images[]`. Instead a **screen becomes a thing**, with the same
grammar every other thing in this model has: a slug, a name, containment
through `parents[]`, cross-links through `relations[]`.

## 1. What this slice is, and what it is not

**This slice is the store.** The species, the collection, the privacy cascade,
and a one-off import that puts the hundred and seventy screens into Cloudinary
and Mongo with readable names.

**It renders nothing.** No public gallery, no admin list, no exhibition. Those
are filed as follow-on work (§6) because the urgency here is the volatile
scratchpad, not the page.

The sequencing matters and is deliberate: a store with no reader is testable,
reviewable and *finishable* today, and every surface built later draws from a
shape that already holds real data. The reverse — a gallery built against three
hand-made fixtures — is how a model gets shaped by its first screen instead of
by its contents.

## 2. The record

```ts
export interface Screen {
  slug: string;            // stable id — the capture's filename, already kebab-case
  name: Text;              // readable, bilingual like every other name
  legend?: Text;           // the caption; blank on import, written later
  image: MediaImage;       // the asset — the same shape a cover stores
  parents: string[];       // containment: ["plant:paulopus"]
  relations?: Relation[];  // cross-links: { kind: "shows", ref: "bean:karma-accountability" }
  visibility?: Visibility; // default treated as "public", the pod/bean rule
  tags?: string[];
  capturedAt?: string;     // ISO date of the capture run
}
```

Every field but two is borrowed rather than invented, and that is the point: a
`Screen` is a `Bean` that happens to hold an image instead of prose. `parents[]`
is containment ONLY and `relations[]` is everything else — the same split
`README.md` documents for the rest of the model, which is what lets the
privacy cascade in §3 be the bean's cascade rather than a new one.

`name` and `legend` are `Text` because everything nameable here is. The import
writes plain strings (`composeText`'s simple case); a French half can be added
later per screen without a migration.

`image` is a `MediaImage`, not a bare URL, because the phone-covers slice
proved what the dimensions buy: `lib/bean-cover.ts` decides the phone treatment
from `height > width`, and an image that cannot state its own shape silently
renders as something else.

### 2.1 What is deliberately absent

**`exhibited` and `order` are not here.** They belong to the gallery, they are
optional, and Mongo adds an optional field with no migration. Declaring them now
would put two fields in the type that nothing reads and nothing writes — the
speculative generality this codebase's own comments argue against everywhere
else. The gallery slice adds them when it has a use for them.

**A plant still has no `screens[]`.** Containment points upward from the screen,
exactly as a bean's does. The plant page will one day query for its screens; it
will not own a list of them.

## 3. Privacy

Screens join `filterPublic` with the **bean's rule**: dropped when
`visibility === "private"`, and dropped when every *existing* plant parent has
been filtered out. Dangling parents are ignored, so a screen whose plant does
not exist survives as standalone — the behaviour `buildDataset` already has for
every other species.

Their `relations[]` are scrubbed by the same `refSurvives` predicate the
sprouts, plants and pods already use, and the scrub must happen **after** the
kept-sprout set is built, for the reason that function already documents.

Nothing public reads screens in this slice. The cascade is written anyway, and
that is not premature: `filterPublic` is the security boundary, and a species
that enters the read model without passing through it is the exact shape of
omission that ships a leak the day someone adds a reader. A test pins it.

**Storing is not publishing, but a Cloudinary URL is public.** An unexhibited
screen is not linked from anywhere, and its delivery URL is unguessable in
practice — the same property every other image in this repo has. Stated so the
absence of a stronger claim reads as a decision.

## 4. The import

`scripts/import-paulopus-screens.ts`, run as `npm run import:screens`, modelled
on `scripts/import-casa-media.ts`.

- **Source:** a directory of PNGs, defaulting to `~/Pictures/ariko-screens/paulopus`.
- **Slug:** the filename stem, which the capture run already produced in
  kebab-case (`match-hero-m104-final-spain-argentina-aet`).
- **Name:** derived from the stem — separators to spaces, first letter up. Good
  enough to find a screen by; the author sharpens the ones that matter.
- **Legend:** empty. A hundred and seventy captions nobody asked for would be
  worse than none.
- **`parents`:** `["plant:paulopus"]`.
- **`relations`:** the eight screens that are currently bean covers get
  `{ kind: "cover", ref: "bean:<slug>" }`, so the library knows which images the
  landing row is already using.
- **`capturedAt`:** the run's date.

### 4.1 It skips what it has already imported

The CASA script re-uploads on every run. `lib/storage.ts` refuses to derive a
public_id from a filename — that once overwrote assets a published sprout
pointed at — so Cloudinary mints a fresh one each time and the previous run's
assets are orphaned. Twelve images made that an acceptable trade with a note to
tidy the console afterwards.

A hundred and seventy does not. **This script skips any slug already in the
collection**, which makes it resumable if it dies at image 140, makes a
careless second run free rather than expensive, and means no orphan is ever
created by re-running. Replacing a screen's image is then a deliberate act
through the admin, not a side effect of re-running an import.

It reports created / skipped / failed counts, and a failure on one image never
aborts the run.

## 5. Tests

- `lib/data.test.ts` — `filterPublic` drops a private screen, drops a screen
  whose only plant parent is private, keeps one whose plant is public, keeps a
  standalone screen with a dangling parent, and scrubs a relation pointing at a
  filtered bean.
- `lib/botanical.test.ts` — `createScreen` round-trips under the existing
  `{ skip: !hasDb }` gate and the `__test__` slug convention.
- The name derivation is pure and gets a table test: it is the only logic in the
  import worth pinning, and it is what every future reader sees first.

## 6. Follow-on work — filed, not built

Each is a slice of its own, and each was designed in the same conversation as
this one:

1. **The admin library.** `/admin/screens` — list, filter by plant and by
   related bean, edit name, legend, relations and tags, upload a new screen.
2. **The gallery.** An `exhibited` opt-in plus explicit ordering, and the public
   strip on the plant page: phones with bezels, legends always visible, before
   the narrative, CSS scroll-snap reusing the CASA run-grouping primitive.
3. **The lightbox.** Click a screen to open it large. This is a **second client
   island** in `app/(public)` and a seventh documented exception — taken
   deliberately, and built as an interceptor over a real `<a href>` to the full
   image so that script-off the click still works and the island's absence
   costs nothing.
4. **Covers become screen references.** `Bean.cover` changes from an inline
   `MediaImage` to a screen ref, so one asset has one record. A migration of the
   eight live covers, a rewrite of `buildBeanCoverPatch`, and a rework of the
   Cover card.

Until (4) lands, a cover and a screen may hold the same Cloudinary asset twice.
That duplication is **accepted, not overlooked**: the `{ kind: "cover" }`
relation in §4 is what keeps the two knowable from each other in the meantime.
