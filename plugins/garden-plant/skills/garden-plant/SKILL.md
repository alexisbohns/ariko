---
name: garden-plant
description: >
  Describe THIS repo's project for Ariko by writing a `garden.yml` at the repo
  root — a pod, its beans, and the sprouts hanging from them, bilingual EN/FR.
  Use whenever someone asks to add this project to Ariko, give it a pod, write
  its beans, or draft its narratives. You write the FILE and open a PR, and you
  stop there: the maintainer plants it from the Ariko repo.
---

# Planting a project in Ariko

Ariko is a garden. A project lives there as a **pod** with **beans** hanging
off it and **sprouts** hanging off those. This skill has you describe your own
repo in one file — `garden.yml` at the repo root — so the maintainer can plant
it with a single reviewed command.

## Where you stop

You read this repo, write `garden.yml`, open a PR, and report what the tree
contains. That is the whole job.

- **Never connect to MongoDB.** Not from a script, not from a tool, not once.
- **Never run the planting command.** It lives in the Ariko repo, not here.
- **Never ask for a connection string**, and refuse one if it is offered.

The credential stays in Ariko, and the write is a human's decision made while
looking at a diff. A file in a PR is reviewable, reversible, and diffable; a
direct write from a sibling repo is none of those. If you find yourself
reaching for a database, you have left the skill.

## The four tiers

| Tier | What it is | Prose? |
|---|---|---|
| **Plant** | A whole practice or brand — the root. | yes (`content`) |
| **Pod** | One project. Usually one repo. | yes (`content`) |
| **Bean** | One feature, theme or strand of the project. | **no** |
| **Sprout** | One dated thing that happened: a release, a note, a milestone. | yes (`content`) |

A manifest writes **one pod, its beans, and their sprouts**. It never creates a
plant — it may only point at one that already exists.

**Small project? Skip the plant.** `plant: null` makes a standalone pod, and
that is the normal case for a side project.

### A bean has no prose, and that is the design

This is the mistake everyone makes once. There is no `content` on a bean. Not a
shorter one, not an undocumented one — the field does not exist, and the
validator rejects the key by name:

```
beans[0].content: a bean has no content field — put this in one of its sprouts instead
```

Do not route around it. The bean **is** the feature: a durable name, a
description, a place things hang from. What you want to *say* about that
feature on a given day is a **sprout** — dated, and therefore something the
timeline can order and the publish cascade can find. Prose stuffed into a bean
would have no date, appear in no timeline, and be publishable only by
publishing the whole bean.

So: "Ledger import" is a bean. "Ledger import now reads OFX" on 2026-08-14 is a
sprout hanging from it.

## The file

`garden.yml`, at the repo root. Here is a complete, real one — a small personal
ledger tool called Krabs. Copy its shape.

```yaml
pod:
  slug: krabs
  plant: null
  name:
    en: Krabs
    fr: Krabs
  description:
    en: A pocket ledger that tells you where the money actually went.
    fr: Un petit carnet de comptes qui te dit où l'argent est vraiment parti.
  content:
    en: |
      Krabs started as a spreadsheet that got out of hand. It reads your bank
      exports, sorts them into buckets you actually recognise, and shows you
      one number: what you have left this month.

      No budgets to set up, no categories to invent. Point it at a file and it
      gets to work.
    fr: |
      Krabs, c'était un tableur qui a mal tourné. Il lit tes exports bancaires,
      les range dans des catégories que tu reconnais vraiment, et t'affiche un
      seul chiffre : ce qu'il te reste ce mois-ci.

      Rien à paramétrer, aucune catégorie à inventer. Tu lui donnes un fichier,
      il se débrouille.

beans:
  - slug: ledger-import
    name:
      en: Import
      fr: Import
    description:
      en: Drop in a bank export and Krabs sorts it out.
      fr: Dépose un export bancaire, Krabs s'occupe du tri.
    sprouts:
      - slug: krabs-ofx-import
        type: release
        date: 2026-08-14
        name:
          en: Your bank's own file, straight in
          fr: Le fichier de ta banque, tel quel
        description:
          en: Krabs now reads OFX, so most banks work without a conversion step.
          fr: "Krabs lit désormais l'OFX : la plupart des banques passent sans conversion."
        content:
          en: |
            CSV was always a negotiation — every bank spells a date differently.
            OFX is the format banks already export, so there is nothing to fix
            up by hand any more.
          fr: |
            Le CSV, c'était toujours une négociation : chaque banque écrit ses
            dates à sa façon. L'OFX, c'est ce que les banques exportent déjà —
            plus rien à rafistoler à la main.

  - slug: krabs-stack
    name:
      en: Under the hood
      fr: Sous le capot
    description:
      en: What Krabs is built from, and why it stays small.
      fr: Ce qui fait tourner Krabs, et pourquoi ça reste léger.
    sprouts:
      - slug: krabs-offline-first
        type: note
        date: 2026-09-02
        name:
          en: It works on the train
          fr: Ça marche dans le train
        description:
          en: Everything is stored on your own machine, so Krabs never needs a signal.
          fr: "Tout est stocké sur ta machine : Krabs n'a jamais besoin de réseau."
```

Notes on the shape:

- Every human-readable field is a `{ en, fr }` pair. `en` is required; `fr` is
  recommended and should be a real **adaptation**, not a literal translation.
- `content` uses a block scalar (`|`), which lets you write paragraphs of
  Markdown without quoting anything.
- `beans` may be omitted or empty — a pod on its own is a valid manifest.
- `sprouts` may be omitted on a bean.
- `plant:` is either `null` or the slug of a plant that already exists in the
  garden. When unsure, use `null` and let the maintainer re-home it.

## What the validator checks

The whole file is checked before anything is written, and the first problem
stops the run with nothing touched.

- **Slugs are kebab-case** — `^[a-z0-9]+(-[a-z0-9]+)*$`. They become URL
  segments, and a capital or an underscore round-trips through URL encoding
  into something nobody can retype from the address bar.
- **Slugs are unique across the whole file** — pod, beans and sprouts share one
  namespace here. The database would accept a pod and a bean both called
  `krabs`; the *reader* would not. A manifest is prose plus references, and a
  mention of `krabs` three lines above a bean of the same name is ambiguous to
  every human and every agent who edits the file later.
- **Dates are `YYYY-MM-DD`**, exactly ten characters. The garden sorts sprouts
  by comparing the date **string**, raw — nothing anywhere parses it into a
  date. So `09/12/2026` does not fail; it sorts above every date starting with
  a `2` and quietly misfiles the sprout at the top of the timeline forever.
- **Types are non-blank, with no surrounding whitespace.** There is no list of
  allowed types — pick a word that fits (`release`, `note`, `milestone`,
  `essay`). The whitespace rule is the sharp one: three places in the garden
  compare a type against a bare literal with `===` and none of them trims, so a
  stored `"digest "` draws identically to `"digest"` everywhere and matches
  none of the three.
- **Every bilingual pair needs a non-blank `en`.** `fr` may be omitted.
- **`content` is capped at 64 KiB per language.** A narrative, not a book.

One YAML habit worth keeping: **wrap any single-line value containing a colon
in double quotes**. A colon is natural French punctuation ("ta machine : Krabs
n'a jamais besoin de réseau") and it is exactly what makes a plain YAML scalar
fail to parse. Block scalars (`|`) are free of the problem — colons inside them
need nothing.

## Keys the manifest refuses

Each of these is a **hard error**, not a field quietly dropped:

| Key | Why |
|---|---|
| `visibility` | Publishing is a deliberate act in the Ariko admin. |
| `state` | Same — and a sprout's state cascades upward through its bean and pod. |
| `exhibited` | Same. |
| `order` | Same. |
| `relations` | Derived from the prose's own references, never authored. |
| `parents` | Containment; re-homing an entity is a privacy decision. |
| `content` on a bean | A bean has no such field — use a sprout. |

**Everything a manifest creates is private.** Sprouts land as drafts. The
maintainer publishes in the admin, where the vocabulary is a list of radios and
a Save button. A key that *looked* like it published and silently did not would
be worse than a refusal: you would believe the thing is live, and nothing
anywhere would look wrong.

## Tone

Write for the person who uses the thing, not the person who built it.

- **Lead with the benefit**, not the mechanism. "Your bank's own file, straight
  in" beats "Added an OFX parser to the import pipeline."
- **Short.** Names of a few words; descriptions of one or two sentences.
- **Warm and a little playful**, never corporate. No "We are pleased to
  announce."
- **No engineering jargon, ticket numbers, or internal names** in the prose.
  Class names and file paths belong in the repo, not in the garden.
- **French uses the informal "Tu"** — "Ta banque", "Dépose", "Tu lui donnes".
  Never "Vous". And it is an adaptation: if the English pun does not survive,
  write a French one instead.

## What happens next

Open a PR with `garden.yml` and say what the tree contains — the pod, how many
beans, how many sprouts. Then stop.

In the **Ariko** repo, the maintainer runs:

```
npm run garden:plant -- ../<this-repo>/garden.yml --dry-run
npm run garden:plant -- ../<this-repo>/garden.yml
```

The dry run prints the plan — a `create` or `skip` per entity — and writes
nothing.

**Re-running is safe.** A slug that already exists is skipped, so planting the
same file twice changes nothing. `--update` opts into rewriting names,
descriptions and narratives from the file for entities that already exist, and
touches nothing else — no visibility, no state, no parentage.
