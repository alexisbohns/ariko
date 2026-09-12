# Ariko — where we are

**Last updated:** 2026-09-12

One screen. This file does **not** aggregate the plans' deferred sections any
more — that arrangement asked for a prune on every slice, got one on none, and
spent twenty slices describing a vocabulary and a constraint set that had both
been retired. History lives in [`specs/`](specs/), one document per slice, and
that is the authoritative record.

---

## The thing

Ariko is a personal **central node**: a portfolio on a botanical content model,
`Pod → Bean → Sprout`, with inbox `Seed`s arriving from sibling repos' CIs. A
pod is a body of work, a bean a unit within it, a sprout a piece of writing or
a release. Plants sit above pods as the projects themselves.

**Archive-first and private by default.** Everything lives in a private vault;
a curated subset is projected to the public zone. The security rule — only
published entities and their non-private lineage ever reach the public — is
enforced by the pure `filterPublic` projection, which every public read passes
through and which is unit-tested.

Two zones, one design system (Tailwind v4 + shadcn on Base UI). The public zone
is progressively enhanced; the admin is a JavaScript application behind a
password with one user. `CLAUDE.md` §"Script, by zone" is the rulebook.

Live at [www.ariko.app](https://www.ariko.app). Stack: Next 15 / React 19 /
TypeScript / MongoDB / Cloudinary.

---

## Shipped

The vault spine and the admin over it; the botanical rename; the ingestion
spine (`/api/inbox`, `/api/articles`, `/api/synthesis`) and the pollen
federation contract; the Lab Note pipeline across five repos; Tiptap and the
media slice; bilingual reading; the brand mark; the landing gallery; plant
status, role, logo and visibility; the fluid admin — seed overlay, vault
filters, table glyphs, ⌘K; the plant page as its own object, public and admin;
the shared-surfaces slice; bean covers and the phone frame; the screen store,
library and exhibition; the public TOC rail; the rulebook rewrite itself —
`CLAUDE.md`'s three invariants, and `table.tsx` / `separator.tsx` dropping
`"use client"` along with it; the garden cache — the public zone's read behind
one `garden` tag, invalidated at four doors, with a 404 and an error boundary
per zone and a bounded Mongo timeout behind them.

Per-slice detail: [`specs/`](specs/), and the merged PRs they name.

---

## What's next

From [`../audits/2026-09-10-code-quality-audit.md`](../audits/2026-09-10-code-quality-audit.md)
§6, whose ordering this follows — except that two of its ten items shipped
ahead of turn, as part of this same rulebook slice: the guidelines rewrite
(item 5) and most of the `table`/`separator` de-clientizing (item 2 — its
`label.tsx` third is outstanding, tracked in
[#87](https://github.com/alexisbohns/ariko/issues/87)).

Two findings the audit records but never sequenced, so they have no turn here:
[#87](https://github.com/alexisbohns/ariko/issues/87) above, and
[#88](https://github.com/alexisbohns/ariko/issues/88) — the botanical rename
never finished in the identifiers, the write path, or the strings the author
reads. The sprout's share is done (the edition slice): `ATOM_PREFIX`,
`editVersionAction`, `deleteVersionAction`, `updateVersion`, `deleteVersion`
and the "Edit version" heading are all gone. What is left is the bean, pod and
screen paths.

1. ~~**Rewrite the guidelines.**~~ Shipped — [`specs/2026-09-10-guidelines-rewrite-design.md`](specs/2026-09-10-guidelines-rewrite-design.md).
2. ~~**Cache the garden.**~~ Shipped — [`specs/2026-09-11-cache-the-garden-design.md`](specs/2026-09-11-cache-the-garden-design.md).
3. **Assets.** svgo the two brand SVGs (102 kB and 91 kB of rendered HTML);
   subset Inclusive Sans to woff2 (−180 kB per first visit); Profane fallback
   metrics; `preconnect` to Cloudinary; transform the gallery and markdown
   images; eager + `fetchPriority` on the first row.
4. **Delete the trap.** `getDataset` and the `node:fs` import in `lib/data.ts`
   are dead outside tests, and they are the reason that module is
   server-only — the trap `CLAUDE.md` still has to describe (the
   `lib/palette.ts` / `lib/palette-items.ts` split).
5. **Form kit.** `field` from the registry; `TextField`, `BilingualField`,
   `StateRadios`, `ConfirmDeleteForm`, `ActionError`, `LoadFailure`.
6. **Action split.** `app/admin/actions.ts` is 963 lines and 26 exports; split
   by entity behind one `withEntity` guard, plus `lib/form-data.ts`,
   `lib/media-input.ts`, `parseRef`, a shared `SLUG`. Validate promote's slugs
   and make it compensate.
7. **Hotspot splits.** `plant-hero` → `media-picker` → `prose-editor` →
   `command-palette` → triage → sprout.
8. **Route-group the admin chrome**, so `AdminChrome` stops being a client
   component just to read the pathname.
9. **Language in the URL** (`/fr/…`), then `generateMetadata`, `hreflang`,
   `lang` from the route, and ISR for the public zone.

Further out, unsequenced: the lightbox (`components/screen-strip.tsx` already
links every phone to its full image, which is what the island would intercept),
and the interactive graph the public zone is aimed at.
