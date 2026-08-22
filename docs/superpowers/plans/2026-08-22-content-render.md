# Slice 1 — Render Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `Sprout.content` markdown as prose — on the public bean page and as a preview in the admin — so the weekly digests already sitting in Mongo become readable.

**Architecture:** One configured pipeline in `lib/markdown.ts` (exported as plugin arrays so slice 3 appends rather than forks), one pure selection rule in `lib/article.ts`, one thin server component in `components/markdown.tsx`, wired into two existing pages. Sanitization runs last and `rehype-raw` is never added.

**Tech Stack:** Next.js 15 App Router (server components, `force-dynamic`), React 19, TypeScript, `react-markdown` 10 + `remark-gfm` 4 + `rehype-sanitize` 6, `@tailwindcss/typography` 0.5, tests via `node --import tsx --test`.

**Spec:** [`docs/superpowers/specs/2026-08-22-content-render-design.md`](../specs/2026-08-22-content-render-design.md)

---

## File structure

| File | Responsibility |
|---|---|
| `lib/markdown.ts` (create) | The **only** place the pipeline is configured. Exports `remarkPlugins`, `rehypePlugins`, `sanitizeSchema`. No React, no JSX — so `node --test` can import it. |
| `lib/markdown.test.ts` (create) | Drives the real plugin chain and asserts the three security rules. |
| `lib/article.ts` (create) | Pure `articleFor(sprouts)` — which sprout's content is the article. |
| `lib/article.test.ts` (create) | The selection rule's cases. |
| `components/markdown.tsx` (create) | `<Prose content={…} />` — resolves `Text`, renders nothing when blank, maps tables to the design system. Only importer of `react-markdown`. |
| `app/(public)/bean/[id]/page.tsx` (modify) | Renders the article above the existing property dump. |
| `app/admin/sprout/[slug]/page.tsx` (modify) | Adds a rendered preview beside the existing `<pre>` source view. |
| `app/globals.css` (modify) | One `@plugin` line for the typography plugin. |
| `package.json` (modify) | Four dependencies. |

---

## Task 1: Branch, dependencies and typography plugin

**Files:**
- Modify: `package.json`
- Modify: `app/globals.css:1-5`

- [ ] **Step 1: Branch off main**

```bash
git checkout main && git pull && git checkout -b slice-1-content-render
```

(The specs and this plan land on their own branch first — see `docs/superpowers/specs/2026-08-22-content-render-design.md`. Implementation never shares that branch.)

- [ ] **Step 2: Install the runtime dependencies**

```bash
npm install react-markdown@^10 remark-gfm@^4 rehype-sanitize@^6 unified@^11 @tailwindcss/typography@^0.5
```

`unified` is installed explicitly only for its `PluggableList` type — relying on it as a transitive dep of `react-markdown` would break the day that dep tree changes.

- [ ] **Step 3: Enable the typography plugin**

In `app/globals.css`, immediately after the existing `@import "shadcn/tailwind.css";` on line 3, add:

```css
@plugin "@tailwindcss/typography";
```

- [ ] **Step 4: Verify the app still compiles**

Run: `npx tsc --noEmit`
Expected: no output (success).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app/globals.css
git commit -m "chore: add the markdown render dependencies + typography plugin"
```

---

## Task 2: The pipeline

**Files:**
- Create: `lib/markdown.ts`
- Test: `lib/markdown.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/markdown.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import { remarkPlugins, rehypePlugins } from "./markdown";

// Drives the EXACT chain the app renders (spec §7). No JSX: tsconfig sets
// jsx:"preserve", so a .tsx test would not run under tsx.
function render(source: string): string {
  return renderToStaticMarkup(
    createElement(Markdown, { remarkPlugins, rehypePlugins }, source),
  );
}

test("renders a GFM table", () => {
  const html = render("| verdict | points |\n| --- | --- |\n| Perfect | 1.5 |");
  assert.match(html, /<table>/);
  assert.match(html, /<th>verdict<\/th>/);
  assert.match(html, /<td>1\.5<\/td>/);
});

test("keeps the language class on a fenced code block", () => {
  const html = render('```json\n{ "matchId": "M099" }\n```');
  assert.match(html, /class="language-json"/);
});

// The three security cases below are the point of this file. Two of them pass
// trivially today because remark-rehype DROPS raw HTML when rehype-raw is
// absent — that is deliberate: they are regression guards for the day someone
// reaches for rehype-raw. The javascript: case exercises the sanitizer itself.
test("drops a script tag", () => {
  const html = render("<script>alert(1)</script>\n\nplain text");
  assert.doesNotMatch(html, /<script/);
});

test("drops an onclick attribute", () => {
  const html = render('<p onclick="alert(1)">hi</p>');
  assert.doesNotMatch(html, /onclick/);
});

test("drops a javascript: href", () => {
  const html = render("[click](javascript:alert(1))");
  assert.doesNotMatch(html, /javascript:/);
});

test("renders nothing for blank content", () => {
  assert.equal(render(""), "");
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm test 2>&1 | tail -20`
Expected: FAIL — `Cannot find module './markdown'`.

- [ ] **Step 3: Write the implementation**

Create `lib/markdown.ts`:

```ts
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { PluggableList } from "unified";

// The one place the markdown pipeline is configured (spec §3). Exported as
// arrays rather than a configured component so slice 3 can append the entity
// directive without forking a second pipeline — and so the tests can drive the
// exact chain the app renders.

// hast-util-sanitize's default (GitHub) schema, unmodified in this slice: it
// already admits the GFM table elements and className on <code> restricted to
// language-*, which is the hook syntax highlighting will want later.
export const sanitizeSchema = defaultSchema;

export const remarkPlugins: PluggableList = [remarkGfm];

// Sanitization runs LAST, always. When slice 3 mints nodes of its own, its
// transform runs BEFORE this one and widens sanitizeSchema — a custom node
// absent from the schema is silently stripped, which is a confusing failure to
// debug from scratch.
export const rehypePlugins: PluggableList = [[rehypeSanitize, sanitizeSchema]];
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npm test 2>&1 | tail -20`
Expected: PASS, 7 new tests green.

If `renderToStaticMarkup` cannot drive `react-markdown` under the runner, replace the `render` helper with the identical unified chain (spec §7) — `unified().use(remarkParse).use(remarkPlugins).use(remarkRehype).use(rehypePlugins).use(rehypeStringify)` — and keep every assertion as written.

- [ ] **Step 5: Commit**

```bash
git add lib/markdown.ts lib/markdown.test.ts
git commit -m "feat: configure the markdown pipeline, sanitized and GFM-capable"
```

---

## Task 3: The selection rule

**Files:**
- Create: `lib/article.ts`
- Test: `lib/article.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/article.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Sprout } from "./data";
import { articleFor } from "./article";

function sprout(slug: string, date: string, content?: Sprout["content"]): Sprout {
  return {
    slug,
    name: slug,
    type: "article",
    date,
    description: "",
    parents: ["bean:paulopus"],
    ...(content !== undefined ? { content } : {}),
  };
}

test("picks the first sprout carrying content", () => {
  const found = articleFor([
    sprout("b", "2026-08-02", "# newer"),
    sprout("a", "2026-08-01", "# older"),
  ]);
  assert.equal(found?.slug, "b");
});

test("skips a newer sprout with no content at all", () => {
  const found = articleFor([sprout("b", "2026-08-02"), sprout("a", "2026-08-01", "# older")]);
  assert.equal(found?.slug, "a");
});

test("treats a blank string and a blank localized value as absent", () => {
  const found = articleFor([
    sprout("c", "2026-08-03", "   "),
    sprout("b", "2026-08-02", { en: "" }),
    sprout("a", "2026-08-01", "# real"),
  ]);
  assert.equal(found?.slug, "a");
});

test("returns null when nothing carries content", () => {
  assert.equal(articleFor([sprout("a", "2026-08-01")]), null);
});

test("returns null for an empty list", () => {
  assert.equal(articleFor([]), null);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm test 2>&1 | tail -20`
Expected: FAIL — `Cannot find module './article'`.

- [ ] **Step 3: Write the implementation**

Create `lib/article.ts`:

```ts
import { resolveText, type Sprout } from "./data";

// Pure (spec §4). Given sprouts in the newest-first order the dataset already
// guarantees (stable byDateDesc), returns the first one carrying non-blank
// content — or null when none does, which is every bean in the garden today.
//
// State is NOT re-checked here: the public page passes the filterPublic-projected
// dataset, so "published" is already enforced upstream. One projection, one place.
export function articleFor(sprouts: Sprout[]): Sprout | null {
  return sprouts.find((s) => resolveText(s.content ?? "").trim() !== "") ?? null;
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npm test 2>&1 | tail -20`
Expected: PASS, 5 new tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/article.ts lib/article.test.ts
git commit -m "feat: pick a bean's article — the newest sprout carrying content"
```

---

## Task 4: The Prose component

**Files:**
- Create: `components/markdown.tsx`

- [ ] **Step 1: Write the component**

Create `components/markdown.tsx`:

```tsx
import Markdown, { type Components } from "react-markdown";
import { resolveText, type Text } from "@/lib/data";
import { remarkPlugins, rehypePlugins } from "@/lib/markdown";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// GFM tables render through the design system's primitives instead of the
// typography plugin's table styles — hence not-prose around them (CLAUDE.md:
// never hand-roll what the registry already has). Table itself supplies the
// overflow-x-auto container, so a wide table scrolls instead of blowing out the
// reading column. Only children (and GFM's column-alignment style) are
// forwarded: react-markdown also passes a `node` prop, which must not reach the
// DOM.
const components: Components = {
  table: ({ children }) => (
    <div className="not-prose">
      <Table>{children}</Table>
    </div>
  ),
  thead: ({ children }) => <TableHeader>{children}</TableHeader>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children, style }) => <TableHead style={style}>{children}</TableHead>,
  td: ({ children, style }) => <TableCell style={style}>{children}</TableCell>,
};

/**
 * Renders localizable markdown as prose. Server-only — no client JS enters the
 * public zone. Renders NOTHING (not an empty card, not a heading) when the
 * resolved content is blank, which is the common case today.
 */
export function Prose({ content }: { content?: Text }) {
  const source = resolveText(content ?? "").trim();
  if (!source) return null;

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <Markdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {source}
      </Markdown>
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add components/markdown.tsx
git commit -m "feat: add the Prose component — sanitized markdown, design-system tables"
```

---

## Task 5: Render the article on the public bean page

**Files:**
- Modify: `app/(public)/bean/[id]/page.tsx:1-6` (imports) and `:59-70` (the returned markup)

- [ ] **Step 1: Add the imports**

At the top of `app/(public)/bean/[id]/page.tsx`, alongside the existing imports, add:

```tsx
import { articleFor } from "@/lib/article";
import { Prose } from "@/components/markdown";
```

- [ ] **Step 2: Select the article**

In `BeanPage`, directly after the existing line:

```tsx
  const sprouts = data.sproutsForBean(bean.slug);
```

add:

```tsx
  // The newest published sprout carrying content (spec §4). Older sprouts stay
  // as the property-dump rows below — they have no public URL to link to yet.
  const article = articleFor(sprouts);
```

- [ ] **Step 3: Render it above the property dump**

In the returned JSX, immediately after the `<h1>` line and before `{sprouts.map(…)}`, add:

```tsx
      {article ? <Prose content={article.content} /> : null}
```

- [ ] **Step 4: Verify it type-checks and the tests still pass**

Run: `npx tsc --noEmit && npm test 2>&1 | tail -5`
Expected: no tsc output; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/bean/[id]/page.tsx"
git commit -m "feat: bean pages render their article as prose"
```

---

## Task 6: Add the rendered preview to the admin sprout page

**Files:**
- Modify: `app/admin/sprout/[slug]/page.tsx:1-10` (imports) and `:68-79` (the content card)

- [ ] **Step 1: Add the import**

At the top of `app/admin/sprout/[slug]/page.tsx`, add:

```tsx
import { Prose } from "@/components/markdown";
```

- [ ] **Step 2: Add a preview card above the source card**

The file already computes `const content = resolveText(version.content);` and renders a `<pre>` card
when it is non-empty. Immediately **before** that existing `{content ? ( … ) : null}` block, add a
second card:

```tsx
        {content ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base tracking-tight">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <Prose content={version.content} />
            </CardContent>
          </Card>
        ) : null}
```

The existing source card stays exactly as it is — rendered preview *beside* the source, never
instead of it (spec §2.5).

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no output (success).

- [ ] **Step 4: Commit**

```bash
git add "app/admin/sprout/[slug]/page.tsx"
git commit -m "feat: admin sprout pages preview their content as prose"
```

---

## Task 7: Manual acceptance

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
(Needs `MONGODB_URI` in `.env.local`; the pages read Mongo at request time.)

- [ ] **Step 2: Read a weekly digest as prose — the dogfood acceptance**

Find a digest sprout's slug (they follow `digest-<plant>-<week>` / `weekly-wrap-<week>`):

```bash
node --env-file=.env.local --import tsx -e "import('./lib/db.ts').then(async ({getDb}) => { const db = await getDb(); const rows = await db.collection('sprouts').find({ type: 'digest' }, { projection: { _id: 0, slug: 1 } }).limit(5).toArray(); console.log(rows); process.exit(0) })"
```

Open `/admin/sprout/<slug>` after logging in at `/admin/login`.
Expected: the digest renders as headings/paragraphs/lists in a **Preview** card, with the raw source
still available in the **Content** card below it.

- [ ] **Step 3: Confirm the public side is unchanged**

Open `/bean/rom-win` (or any existing bean).
Expected: **identical to before this slice** — no published sprout in the garden carries `content`
yet, so `articleFor` returns `null` and nothing new renders. This is the correct outcome, not a gap
(spec §6).

- [ ] **Step 4: Prove the public path works, with a temporary fixture**

In Mongo, temporarily give one published sprout some content, load its bean page, then revert:

```bash
node --env-file=.env.local --import tsx -e "import('./lib/db.ts').then(async ({getDb}) => { const db = await getDb(); await db.collection('sprouts').updateOne({slug:'rom-win-0'},{\$set:{content:'## Heading\n\nA paragraph, a [link](https://ariko.app), and a table:\n\n| a | b |\n| --- | --- |\n| 1 | 2 |'}}); console.log('set'); process.exit(0) })"
```

Open `/bean/rom-win`. Expected: the markdown renders as prose above the property dump, with the table
styled by the design system. Then revert:

```bash
node --env-file=.env.local --import tsx -e "import('./lib/db.ts').then(async ({getDb}) => { const db = await getDb(); await db.collection('sprouts').updateOne({slug:'rom-win-0'},{\$unset:{content:''}}); console.log('reverted'); process.exit(0) })"
```

Confirm `/bean/rom-win` is back to its pre-slice rendering. If `rom-win-0` is not a published sprout
in your dataset, substitute any slug from `data/garden.yml`'s `sprouts:` list.

---

## Task 8: Documentation

**Files:**
- Modify: `README.md` (new subsection)
- Modify: `docs/superpowers/ROADMAP.md` (Track B)

- [ ] **Step 1: Document the render layer in the README**

Add this subsection to `README.md`, directly after the "Pages" section:

```markdown
## Rich content

Sprouts carry optional markdown in `content` (localizable — `Text`, like `name`/`description`).

* It renders as prose on `/bean/[id]` (the newest published sprout carrying content) and as a
  **Preview** card on `/admin/sprout/[slug]`, beside the raw source.
* The pipeline is configured in exactly one place, `lib/markdown.ts`: `remark-gfm` for tables and
  fenced code, `rehype-sanitize` **last**. `rehype-raw` is deliberately absent, so HTML embedded in
  markdown is inert; the sanitizer is belt-and-braces on top of that.
* GFM tables render through the design system's `Table` primitives; everything else through
  `@tailwindcss/typography`.
* Not yet rendered: media embeds, syntax highlighting, and entity blocks (slice 3).
```

- [ ] **Step 2: Update the roadmap**

In `docs/superpowers/ROADMAP.md`, under **Track B**, replace the `B3` bullet's *Status* (or add one)
with:

```markdown
  - *Status:* the **render half** shipped 2026-08-22 (`lib/markdown.ts`, `components/markdown.tsx`,
    bean page + admin preview) as slice 1 of the Content & Composition umbrella. Media/embed
    rendering and the host-matching hardening remain open.
```

- [ ] **Step 3: Commit**

```bash
git add README.md docs/superpowers/ROADMAP.md
git commit -m "docs: document the render layer and update the B3 status"
```

---

## Task 9: Open the PR

**Files:** none

- [ ] **Step 1: Full sweep before pushing**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all tests pass, no type errors, build succeeds.

- [ ] **Step 2: Push and open the PR with a Lab Note**

This ships something the author notices (digests become readable), so the PR body **must** carry a
Lab Note — merging posts it to the Ariko inbox automatically (`CLAUDE.md`).

````bash
git push -u origin slice-1-content-render
gh pr create --title "Slice 1 — Render: markdown becomes prose" --body "$(cat <<'EOF'
Implements `docs/superpowers/specs/2026-08-22-content-render-design.md`: one configured markdown
pipeline (`remark-gfm` + `rehype-sanitize`, sanitize last, no `rehype-raw`), a pure article-selection
rule, and a `Prose` server component wired into the public bean page and the admin sprout page.

The weekly digests the synthesis bee has been writing since slice 5 are readable as prose for the
first time. The public side is unchanged until content exists to show — that arrives with the
Paulopus import.

Plugin arrays and the sanitize schema are exported so slice 3's entity directive appends to this
pipeline instead of forking a second one.

## Lab Note

```yaml
en:
  title: "Written pieces finally read like written pieces"
  summary: "Long-form notes stored in the garden now render as proper prose — headings, lists, tables and code — instead of a wall of raw text."
fr:
  title: "Tes textes s'affichent enfin comme des textes"
  summary: "Les notes longues du jardin s'affichent maintenant en vraie prose : titres, listes, tableaux et code, au lieu d'un bloc brut."
suggested:
  molecule: ariko
  type: feature
  tags: [changelog]
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
````

---

## Notes for the executor

- **Sanitize runs last, always.** If you add a rehype plugin, it goes *before* `rehypeSanitize` in
  the array, and anything it mints must be admitted by `sanitizeSchema` or it vanishes silently.
- **Never add `rehype-raw`.** Two of the security tests pass trivially because of its absence; adding
  it turns them into the real thing, and the schema becomes load-bearing overnight.
- **Don't re-check `state` in `articleFor`.** The public page hands it a `filterPublic`-projected
  dataset. One projection, one place — a second check is a second thing to get wrong.
- **The public half rendering nothing is a pass, not a fail** (Task 7 step 3). No published sprout
  carries content until the Paulopus import.
