# Planting a project from its own repo

*2026-09-13*

Krabs is smaller than Paulopus. It wants a pod, five beans and an opening
sprout under each — and the person who knows what to write is the agent sitting
in the Krabs repo, reading the actual code. That agent cannot write to the
garden, and should not be able to.

Today a sibling repo has exactly one door into Ariko: `POST /api/inbox`,
token-gated by `lib/auth.ts`, which creates **Seeds**. Triage turns one seed
into one sprout and, at most, one new pod paired with one new bean
(`app/admin/actions.ts:190` refuses any other combination). Neither carries a
narrative. Pods, beans and narratives have no external write path at all —
they are written by `createPod` / `createBean` / `editContainerContentAction`
behind the session gate, or by a one-off script in `scripts/`
(`import-paulopus-screens.ts`, the four `migrate-*.ts`).

A structure is not a stream of notes. This slice gives the garden a **seeding
script** driven by a declarative manifest, and a **skill** that teaches any
agent in the stack to write that manifest and then stop.

## The shape of the thing

```
Krabs repo                          Ariko repo
──────────                          ──────────
agent + garden-plant skill
  │
  ├─ writes garden.yml  ──PR──▶  reviewed by a human
                                     │
                                     ▼
                            npm run garden:plant ../krabs/garden.yml
                                     │  createPod / createBean / createSprout
                                     ▼
                                   Mongo (everything private)
                                     │
                                     ▼
                            admin: publish the beans by hand
```

Three properties, and each is a decision rather than a consequence:

- **The credential never leaves Ariko.** The sibling agent produces a file. It
  does not hold `MONGODB_URI`, does not call an API, does not run the script.
- **The manifest is reviewable before it is real.** It arrives as a diff in a
  Krabs PR, in a format a person can read, and nothing is written until someone
  runs a command.
- **The writes go through the model's own constructors**, never raw
  collections — so the unique slug index, the prefixed-ref grammar and
  private-at-birth are inherited rather than reimplemented in a second place.

## 1. The manifest

`garden.yml` at the root of the project's own repo. Declarative, bilingual,
and importing nothing from Ariko.

```yaml
pod:
  slug: krabs
  name: { en: Krabs, fr: Krabs }
  plant: null                    # standalone — Pod.parents is optional
  description: { en: "…", fr: "…" }
  content:
    en: |-
      The bilingual narrative, markdown.
    fr: |-
      L'adaptation française, en tutoiement.
beans:
  - slug: krabs-import-rules-triage
    name: { en: "Import, rules and triage", fr: "Import, règles et tri" }
    description: { en: "…", fr: "…" }
    sprouts:
      - slug: krabs-import-rules-triage-intro
        type: note
        date: 2026-09-13
        name: { en: "…", fr: "…" }
        description: { en: "…", fr: "…" }
        content:
          en: |-
            The real writing.
          fr: |-
            L'adaptation.
```

### Why a bean's narrative is a sprout

**A bean has no `content` field.** Only `Pod.content` and `Plant.content` carry
markdown (`lib/data.ts:161`, `:129`). A `Bean` carries `name`, a bilingual
`description`, `tags`, `cover` and `keyword` — and nothing longer
(`lib/data.ts:174`).

This is not an oversight to route around. The bean IS the feature; what you
write about it on a given day is a sprout under it, which is how the timeline,
the digest and the publish cascade all find it. An agent asked for "a narrative
per feature" will reach for a `content:` key on the bean, it will validate
against nothing, and the prose will vanish silently — which is why the skill
says this first and the validator rejects the key by name.

### What the manifest may not say

No `visibility`, no sprout `state`, no `exhibited`, no `order`, no
`relations`, no `parents` beyond `pod.plant`. A key from that list is a
validation **error**, not a silently ignored field: a manifest that appears to
publish and does not is worse than one that refuses.

`relations` in particular is derived, never authored — `createSprout` mirrors
it from the body's entity refs (`lib/promote.ts:33`).

### Validation reuses the shape modules

`date` goes through `lib/sprout-date.ts` and `type` through
`lib/sprout-type.ts` rather than through a regex written here. Those two
modules exist because a merely-non-empty date sorts the sprout to the bottom of
every timeline, and a stored `"digest "` draws identically to `"digest"` while
being exempt from none of the three places that compare it against a bare
literal. A second validator in a script is a second place for those rules to
drift.

Slugs are checked against the same kebab-case shape the rest of the garden
assumes, and every `{ en, fr }` pair must have a non-blank `en` — `fr` may be
absent, and is then simply not stored.

## 2. The script

`scripts/plant-garden.ts`, wired as `npm run garden:plant`, matching
`brand:build`'s invocation (`node --import tsx`).

```
npm run garden:plant -- ../krabs/garden.yml [--dry-run] [--update]
```

**Validate everything, then write.** The whole manifest is parsed and checked
in memory before the first `insertOne`. A pod that exists with three of its
five beans missing is a worse state than an untouched garden, and it is the
state a per-entity validator produces on the first bad sprout.

**Create-only by default.** An existing slug is reported `skipped` and not
touched. The admin is the editor once a thing is alive; a seeding tool that
quietly reverts last week's polish would make the manifest unsafe to re-run,
and an unsafe re-run is one nobody runs.

**`--update` is narrow on purpose.** It overwrites `description` and `content`
for slugs already present, and nothing else — never `parents`, never
`visibility`, never `state`. Widening it to parentage would let a file in
another repo re-home a bean, which is a cascade decision
(`lib/data.ts:695`) and belongs to the admin.

**`--dry-run` prints the plan as a tree**, one line per entity marked
`create` / `skip` / `update`, and exits without a write. It is the reviewer's
half of the human step.

**Nothing is published.** The script writes no `visibility` and no sprout
`state`, so `createPod`, `createBean` and `createSprout` leave everything
private at birth exactly as the triage flow does. The five beans are published
in the admin, through the enum rule — a named member of a vocabulary and a Save
that confirms. A CLI flag that ran `publishCascade` would flip the bean and the
pod above it with no confirmation, which is the shape the rulebook rejected for
a stray click on a globe.

**The cache is NOT invalidated, and that is correct.** A CLI has no Next
request store, so `revalidateGarden()` (`lib/garden-cache.ts:105`) would take
its tolerated branch and do nothing — an invalidation that looks like one and
is not. It is not needed either: everything the script writes is private, so
`filterPublic` drops all of it and the cached public dataset is unchanged by
definition. The cache matters at the moment of publishing, and publishing
happens in the admin, where the four real doors invalidate properly. The
script's docblock says this, so the next reader does not add a call that cannot
work.

### Tests

`lib/garden-manifest.ts` holds the parse-and-validate half as a pure function,
and it is where the tests live — `lib/garden-manifest.test.ts`, no DB. Each
refused key (`content` on a bean, `visibility` anywhere, `state`, `relations`)
gets a case naming what it would have cost, because every one of them passes
`tsc` and `npm run build` while quietly becoming false.

The write half is exercised by `lib/plant-garden.test.ts` under `npm run
test:db`, added to that script's serial list: create, re-run is a no-op,
`--update` touches exactly two fields, and a manifest whose last sprout is
invalid writes nothing at all.

## 3. The skill

`plugins/garden-plant/`, beside `plugins/lab-note/` and listed in
`.claude-plugin/marketplace.json` — installable in any sibling repo with
`/plugin install garden-plant@ariko`, exactly as the Lab Note plugin is.

The skill carries four things the sibling agent cannot know from its own repo:

1. **The tier vocabulary** — `Pod → Bean → Sprout`, what each one is for, and
   that a pod may be standalone (`plant: null`) for a project too small to
   deserve a plant.
2. **Which fields exist**, with `Bean` has no `content` stated first and
   loudly, since it is the mistake every agent will make.
3. **The manifest schema** and the three shape constraints — kebab-case slugs,
   `YYYY-MM-DD` dates, an untrimmed `type` being a real bug rather than a
   tidiness one.
4. **That the agent stops at the file.** It writes `garden.yml`, opens a PR in
   its own repo, and reports what it wrote. It never connects to Mongo, never
   runs `garden:plant`, and never asks for a connection string. Handing a
   sibling agent the URI is precisely the failure this whole shape exists to
   prevent, so the skill says so in its own section rather than as a clause.

Tone for the prose follows the Lab Note rules already in that plugin: `fr` is
an adaptation in the informal *Tu*, never a literal translation.

Ariko's own `CLAUDE.md` gets a short always-loaded summary pointing at the
script, in the way the Lab Note section is self-sufficient without the plugin
installed.

## What this is not

- Not a sync engine. The manifest seeds; the admin edits.
- Not a publishing tool. Publishing stays a deliberate act in the admin.
- Not a new HTTP surface. No route is added, so no new authenticated write
  path exists to get wrong.
- Not a home-page change. A standalone pod renders at `/pod/krabs` and survives
  `filterPublic` (`lib/data.ts:656` — a pod with no parents was never
  filtered out of one), but the public index enumerates pods per plant
  (`app/(public)/page.tsx:120`), so a plantless pod is reachable by URL and
  listed nowhere. Listing loose pods is a separate slice with its own
  editorial decision to make.
