# Beanstalk

* **Intention**: I want to showcase all my creative and professional work, organized around an atomic content model.
* **Vision**: Everything I create — songs, product features, podcast episodes, blog posts — is an atom. Atoms group into molecules (albums, products, podcasts, blogs). The key insight is that atoms evolve: every atom has one or more versions, which are the fundamental unit of work. A song can have a demo, a studio recording, a live version. A feature can have a POC, an MVP, a V2. The portfolio tells the story of evolution, not just the final state.
* **Approach**: Build a zero-CSS Next.js app (App Router) as a POC for a personal portfolio system based on an atomic content model.

## Data model

### Seeding

* pre-seed with a `/data/seed.yml` (human)
* seed with a `/data/seed.json` file (agent)

### Architecture

* **Molecule**: has a name, type (`music | product | podcast | writing`), and contains atoms
* **Atom**: has a name, belongs to a molecule (optional — can be standalone), and contains versions
* **Version**: has a name, date, and a flat key-value properties object (flexible per type)

## Pages

* `/` — Directory. For each molecule (+ a "Standalone" group for orphan atoms): `<h2>` molecule name, `<ul>` of atom names as links to /atom/[id].
* `/timeline` — Timeline. All atom-versions sorted by date descending. Above the list: a `<ul>` of type filter buttons (`all | music | product | podcast | writing`). Below: a `<ul>` of filtered results.
* `/atom/[id]` — Atom detail. `<h1>` atom name, then for each version: `<h2>` version name, `<ul>` of all key-value properties.

## Constraints

* Zero CSS.
* No styling whatsoever.
* No UI library.
* Plain semantic HTML only.
* TypeScript.
* Public zone is zero-CSS, plain semantic HTML.

## Database & development

As of the Vault Spine slice, content lives in **MongoDB** (not the static seed). `data/seed.yml` is retained only as migration input.

* Set `MONGODB_URI` and `MONGODB_DB` in `.env.local` (gitignored).
* `npm run migrate` — one-time import of `data/seed.yml` into Mongo (idempotent).
* `npm run dev` / `npm run build` — **require DB reachability**: the public pages query Mongo at build/request time, so a clean-checkout or CI build needs `MONGODB_URI` set and the cluster reachable.
* `npm test` — pure unit tests; DB-backed integration tests auto-skip unless `MONGODB_URI` is set (run them with `node --env-file=.env.local --import tsx --test "lib/**/*.test.ts"`).

See `docs/superpowers/specs/` and `docs/superpowers/plans/` for the design and implementation plans.
