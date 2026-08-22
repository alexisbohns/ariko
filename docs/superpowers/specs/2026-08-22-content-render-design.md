# Slice 1 — Render: markdown becomes prose

**Date:** 2026-08-22
**Umbrella:** [`2026-08-22-content-composition-design.md`](2026-08-22-content-composition-design.md) §4 — this slice implements the render layer and nothing else.
**Status:** Approved design, ready for a plan.

---

## 1. Problem

`Sprout.content` has held *"optional rich markdown, localizable"* (`lib/data.ts:113`) since the data
spine, and no surface renders it. The weekly-digest bee has been writing markdown into Mongo on a
schedule since slice 5 (`lib/synthesis-store.ts:87`); the only way to read a digest is
`/admin/sprout/[slug]`, which prints the raw source into a `<pre>` (`app/admin/sprout/[slug]/page.tsx:74`).

A machine writes weekly into a drawer that does not open. This slice opens it.

## 2. Decisions

1. **Stack: the remark family.** `react-markdown` (10) + `remark-gfm` (4) + `rehype-sanitize` (6),
   versions verified 2026-08-22. Chosen over `markdown-it` because slice 3's entity blocks must
   render as **React components** with access to the pre-loaded dataset — a card that resolves
   fail-closed is a component returning `null`, not an HTML string needing post-processing. The cost
   is accepted knowingly: `tiptap-markdown` parses with `markdown-it`, so slice 4 reimplements the
   directive grammar as one `markdown-it` rule. A small, confined duplication of a tiny grammar.
2. **Server-only.** Rendering happens inside the existing `force-dynamic` pages. No client JS enters
   the public zone in this slice.
3. **No raw HTML, ever.** `rehype-raw` is never added, so HTML embedded in markdown is inert by
   default. `rehype-sanitize` stays on regardless, as belt and braces — content comes from routines
   today and agentic tasks tomorrow.
4. **The public bean page renders the newest published sprout's content**, and only that one. Older
   sprouts have no public URL to link to yet, so they stay as dated metadata rows; a per-sprout page
   can add real evolution history later without revisiting this.
5. **The admin keeps its source view.** The rendered preview is added *beside* the `<pre>`, never
   instead of it. Round-tripping a routine's output is exactly when both views are wanted.
6. **Typography via the plugin, tables via the design system.** `@tailwindcss/typography` (0.5) for
   prose defaults; GFM tables map to the existing `components/ui/table.tsx` primitives, per
   `CLAUDE.md`'s rule against hand-rolling what the registry already has.
7. **The pipeline is configured in exactly one place**, and its plugin arrays are exported so slice 3
   appends to them rather than forking a second pipeline.

## 3. The pipeline

**`lib/markdown.ts`** — plain TypeScript, no JSX, so it is directly importable by `node --test`:

- `remarkPlugins` — `[remarkGfm]`. Slice 3 appends `remarkDirective` plus the directive→hast
  transform here.
- `rehypePlugins` — `[[rehypeSanitize, sanitizeSchema]]`. **Sanitization runs last**, always. When
  slice 3 introduces nodes of its own, the transform that creates them runs *before* sanitize and the
  schema is widened to admit them — a custom node that is not in the schema is silently stripped, and
  that failure is confusing enough to be worth stating here.
- `sanitizeSchema` — `hast-util-sanitize`'s default (GitHub) schema, unmodified in this slice. It
  already admits the GFM table elements and `className` on `code` restricted to `language-*`, which
  is exactly the surface the Paulopus focuses need and the exact hook syntax highlighting will want
  later.

**`components/markdown.tsx`** — a thin server component, the only importer of `react-markdown`:

- takes `Text` (not `string`) and resolves through `resolveText` (en-first, blank parts fall
  through), so bilingual content works the day it exists;
- renders nothing at all — not an empty card, not a heading — when the resolved content is blank;
- maps `table`/`thead`/`tbody`/`tr`/`th`/`td` onto the shadcn `Table*` primitives, wrapped in
  `not-prose` so the plugin's table styles do not fight the design system's;
- wraps everything else in `prose dark:prose-invert` (the repo's dark variant is the `.dark` class,
  `app/globals.css:5`).

**`app/globals.css`** gains one line: `@plugin "@tailwindcss/typography";`.

## 4. Which sprout — the selection rule

**`lib/article.ts`**, pure and DB-free:

```ts
articleFor(sprouts: Sprout[]): Sprout | null
```

Returns the first sprout whose resolved `content` is non-blank, given the newest-first ordering
`dataset.sproutsForBean` already guarantees (stable `byDateDesc`, ties keep input order). Returns
`null` for an empty list or a list where nothing carries content — the common case today, and the
reason the bean page must degrade to exactly what it renders now.

The public page passes the **public** dataset, so "published" is already enforced by `filterPublic`
upstream; this function never re-checks state. Keeping the projection in one place is the whole
security posture — a second state check here would be a second thing to get wrong.

## 5. Surfaces

**`/bean/[id]`** — the article renders above the existing per-sprout property dump. The dump is the
model's debug view; retiring it belongs to the exhibition slice, not to this one.

**`/admin/sprout/[slug]`** — the rendered preview joins the existing source `<pre>`.

Nothing else changes. The Directory, the beanstalk, and every admin table are untouched.

## 6. Acceptance

**The dogfood half, testable the day it lands:** open a weekly digest at `/admin/sprout/[slug]` and
read it as prose — headings, lists and links rendered, source still available below.

**The public half has no content to show yet.** No published sprout in the garden carries `content`
today; the first will arrive with the Paulopus import. So the public surface is proven by the unit
tests in §7 plus one manual check against a temporarily published fixture sprout, and is *expected*
to render exactly as it does now for every existing bean. That is the correct outcome, not a gap.

## 7. Testing

House rule: pure logic unit-tested with no DB, via `npm test` (`node --import tsx --test`).

**`lib/article.test.ts`** — the selection rule: newest-with-content wins; a newer sprout without
content is skipped; blank-string and `{ en: "" }` content both count as absent; empty list → `null`.

**`lib/markdown.test.ts`** — the real pipeline, driven without JSX (the repo's `tsconfig.json` sets
`jsx: "preserve"`, so a `.tsx` test would not run under `tsx`): build the element with
`createElement` and render it with `react-dom/server`'s `renderToStaticMarkup`. Cases:

- a GFM table renders as a table;
- a fenced block with a language keeps `language-*` on its `code`;
- **a `<script>` in the content does not survive**;
- **an `onclick` attribute does not survive**;
- **a `javascript:` href does not survive**;
- blank content renders empty output.

Those three security cases are the point of the file. If `renderToStaticMarkup` cannot drive
`react-markdown` under the test runner, fall back to asserting against the same unified pipeline
directly (`unified().use(remarkParse).use(remarkPlugins).use(remarkRehype).use(rehypePlugins).use(rehypeStringify)`)
— it is the identical plugin chain, which is why `lib/markdown.ts` exports the arrays rather than a
configured component.

No DB-backed test is needed: nothing in this slice touches Mongo.

## 8. Out of scope, seams reserved

- **Entity blocks / directives** — slice 3. The seam is the exported plugin arrays and the sanitize
  schema (§3).
- **Syntax highlighting** — later, and server-side when it comes (Shiki keeps the zero-client-JS
  posture). The seam is the preserved `language-*` class.
- **Media and embed rendering** — the other half of roadmap B3. Note for whoever takes it: the
  README's standing requirement is to harden embed host-matching from `includes()` to exact match
  *before* anything gets iframed.
- **A public `/sprout/[slug]` page** — would turn decision 4 into a real evolution history.
- **Retiring the public property dump** — the exhibition slice.
- **`description` on Bean, cover, container pages, Tiptap** — slices 2, 3 and beyond.
