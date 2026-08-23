# Slice 5 — Tiptap editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Ariko admin a rich-text authoring surface for `Sprout.content`, `Plant.content` and `Pod.content` — the first time a human can write or revise prose anywhere in the app.

**Architecture:** Markdown stays the stored format. Tiptap is a client island over it, mounted in its own form with its own server action so the existing zero-JS metadata forms are untouched. The editor parses/serializes with `@tiptap/markdown` (`marked`); the public site renders with `remark`; a conformance test asserts the two agree. Entity references (`::entity{ref=…}` / `:entity[label]{ref=…}`) become two custom Tiptap nodes with hand-rolled tokenizers.

**Tech Stack:** Next.js 15 · React 19 · TypeScript · MongoDB · Tiptap 3.30.2 (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-table`, `@tiptap/markdown`, `@tiptap/suggestion`) · `node --test` via `tsx`

**Spec:** [`docs/superpowers/specs/2026-08-23-tiptap-editor-design.md`](../specs/2026-08-23-tiptap-editor-design.md)

---

## Before you start

**Read the spec.** Especially §2 (decisions), §6 (why two parsers is the central risk) and §6.1 (the
spike that already proved the approach — its verified code is reproduced in Task 2, do not redesign it).

**House rules that bind this work:**

- Pure logic is unit-tested with **no DB**. DB glue gets a smoke test that **auto-skips without
  `MONGODB_URI`**. Run tests with `npm test`.
- Never hand-roll a UI primitive `components/ui/` already has (`CLAUDE.md`).
- The **metadata** forms stay zero-client-JS. Only the new content forms are client components.
- This branch is `specs/slice-5-tiptap`. Do not commit to `main`.

**The one thing that will waste your afternoon if you miss it:** `updateVersion` writes
`$set: { ...patch }`. Never add `content` to `SproutPatch` — the metadata form has no content input,
so it would blank the prose on every metadata save. The content writers in Task 6 exist for this reason
and set **explicitly named fields only**.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `lib/entity-markdown.ts` | The two Tiptap entity nodes: schema + hand-rolled markdown tokenizer/parse/render. **No React** — the conformance test loads it headlessly. |
| `lib/entity-markdown.test.ts` | Tokenizer/serializer unit tests, incl. degradation rules. |
| `lib/markdown-conformance.test.ts` | Cross-parser: `remark(md) ≡ remark(serialize(parse(md)))`. |
| `lib/entity-options.ts` | Pure: `RawGarden` → the picker's menu rows. |
| `lib/entity-options.test.ts` | Unit tests for the above. |
| `lib/content-edit.ts` | Pure: `buildContentPatch` — size ceiling, bilingual preservation, ref mirroring, dirty detection. |
| `lib/content-edit.test.ts` | Unit tests for the above. |
| `lib/content-store.test.ts` | DB smoke: the three writers touch `content`/`relations` and nothing else. |
| `components/editor/entity-views.tsx` | React node views for both entity nodes, and the `.extend()`ed nodes the editor uses. |
| `components/editor/suggestion-menu.tsx` | Keyboard-navigable popup list, positioned from a `clientRect`. Shared by `@` and `/`. |
| `components/editor/prose-editor.tsx` | `"use client"` — the editor island: bubble menu, `/` menu, `@` menu, Save. |
| `app/admin/_components/content-card.tsx` | Server wrapper: builds the entity list and renders the editor in a `Card`. |
| `app/admin/plant/[slug]/page.tsx` | Plant narrative page. |
| `app/admin/pod/[slug]/page.tsx` | Pod narrative page. |
| `app/admin/garden/page.tsx` | Plants-and-pods index. |

**Two deliberate departures from the spec's §3 table**, both consequences of the spike:

- The spec put the entity nodes in `components/editor/entity-node.ts`. The plan splits them into
  `lib/entity-markdown.ts` (schema + grammar, **React-free**) and `components/editor/entity-views.tsx`
  (the views). The conformance test must load the nodes under `node --test`, and it cannot do that
  through a file that imports `@tiptap/react`.
- The spec's `components/editor/markdown-config.ts` becomes the `headlessExtensions` export of
  `lib/entity-markdown.ts` — same job, one fewer file, and it sits next to the nodes it lists.

**Modified:**

| File | Change |
|---|---|
| `package.json` | Tiptap dependencies. |
| `lib/markdown.ts` | Ref-less directives unwrap to their children (bug fix, Task 3). |
| `lib/botanical.ts` | Three narrow content writers. |
| `app/admin/actions.ts` | `editContentAction`, `editContainerContentAction`. |
| `app/admin/sprout/[slug]/page.tsx` | Editor card; `<pre>` demoted into `<details>`. |
| `app/admin/_components/admin-bar.tsx` | "Garden" link. |
| `CLAUDE.md` | Scope the zero-client-JS rule; name the exception. |
| `docs/superpowers/ROADMAP.md` | Slice 5 shipped. |

---

### Task 1: Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the Tiptap packages, all pinned to one version**

All `@tiptap/*` packages must share an exact version — `@tiptap/markdown` declares
`peerDependencies: { "@tiptap/pm": "3.30.2", "@tiptap/core": "3.30.2" }`, an exact pin, so a mixed
set fails to resolve.

```bash
npm install @tiptap/react@3.30.2 @tiptap/core@3.30.2 @tiptap/pm@3.30.2 \
  @tiptap/starter-kit@3.30.2 @tiptap/extension-table@3.30.2 \
  @tiptap/markdown@3.30.2 @tiptap/suggestion@3.30.2
```

- [ ] **Step 2: Verify the install resolved to one version**

Run: `npm ls @tiptap/core @tiptap/pm @tiptap/markdown 2>&1 | head -20`
Expected: every entry reads `3.30.2`, and there is no `UNMET PEER DEPENDENCY` line.

- [ ] **Step 3: Verify the existing suite still passes**

Run: `npm test 2>&1 | tail -5`
Expected: the pre-existing pass count, unchanged. (Record the number — later tasks add to it.)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: tiptap 3.30.2 for the admin prose editor"
```

---

### Task 2: The entity nodes and their markdown grammar

The editor's half of the `::entity{…}` grammar. This code is **verified** — it is the spec §6.1
spike, ported. Do not substitute `createAtomBlockMarkdownSpec` / `createInlineMarkdownSpec`: those
helpers emit Pandoc `:::name {attrs}` and shortcode `[name attrs]…[/name]`, neither of which is this
grammar.

**Files:**
- Create: `lib/entity-markdown.ts`
- Test: `lib/entity-markdown.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { MarkdownManager } from "@tiptap/markdown";
import { headlessExtensions } from "./entity-markdown";

// The editor's parse/serialize pair, headless — no DOM, no React. This is the
// same manager the editor builds (components/editor/prose-editor.tsx) minus the
// node views, which is exactly why the nodes live in lib/ without them.
const manager = new MarkdownManager({ extensions: headlessExtensions });
const roundTrip = (src: string): string => manager.serialize(manager.parse(src)).trim();
const nodeTypes = (src: string): string => JSON.stringify(manager.parse(src));

test("a block card round-trips byte-identically", () => {
  const src = "::entity{ref=bean:karma-accountability}";
  assert.equal(roundTrip(src), src);
  assert.ok(nodeTypes(src).includes('"entityCard"'));
});

test("an inline mention round-trips byte-identically, label and all", () => {
  const src = "see :entity[Prediction Timelines]{ref=bean:prediction-timelines} here";
  assert.equal(roundTrip(src), src);
  assert.ok(nodeTypes(src).includes('"entityMention"'));
});

test("a ref-less directive mints nothing and stays literal text", () => {
  // Mirrors remarkEntity's rule (lib/markdown.ts): no ref, no node.
  for (const src of ["::entity{foo=bar}", "::entity{ref=}", "::entity"]) {
    assert.ok(!nodeTypes(src).includes('"entityCard"'), src);
    assert.equal(roundTrip(src), src);
  }
});

test("indentation follows the CommonMark rule: 3 spaces yes, 4 spaces no", () => {
  assert.ok(nodeTypes("   ::entity{ref=bean:x}").includes('"entityCard"'));
  // 4+ spaces is an indented code block; marked re-emits it as a fence, which
  // renders identically (asserted in lib/markdown-conformance.test.ts).
  assert.ok(!nodeTypes("    ::entity{ref=bean:x}").includes('"entityCard"'));
});

test("code contexts never activate the directive", () => {
  assert.ok(!nodeTypes("```\n::entity{ref=bean:x}\n```").includes('"entityCard"'));
  assert.ok(!nodeTypes("literal `::entity{ref=bean:x}` here").includes('"entityMention"'));
});

test("a mixed document keeps prose, mention and card in order", () => {
  const src = "## Drawer\n\nProse with :entity[X]{ref=bean:x} inline.\n\n::entity{ref=bean:y}";
  assert.equal(roundTrip(src), src);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --import tsx --test lib/entity-markdown.test.ts 2>&1 | tail -5`
Expected: FAIL — `Cannot find module './entity-markdown'`.

- [ ] **Step 3: Write the implementation**

```ts
import { Node, type JSONContent, type MarkdownToken } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";

/**
 * The EDITOR's half of the entity grammar (compose spec §2.2).
 *
 * The public site parses this syntax with remark (`lib/markdown.ts`); the editor
 * parses it with marked, which is what `@tiptap/markdown` runs on. Two parsers
 * over one format is this slice's central risk, and `lib/markdown-conformance.test.ts`
 * is what keeps them honest — change nothing here without re-running it.
 *
 * Tiptap's built-in `createAtomBlockMarkdownSpec` / `createInlineMarkdownSpec`
 * are deliberately unused: they emit Pandoc `:::name {attrs}` (three colons) and
 * shortcodes `[name attrs]…[/name]`. Neither is our grammar (spec §6.1).
 */

// Mirrors lib/entity-refs.ts's BLOCK/INLINE, and for the same reasons: up to
// three leading spaces (four is an indented code block), ref anywhere in the
// braces, and the inline form guarded against matching the block form's second
// colon.
const REF = /\bref=([^\s}]+)/;
const BLOCK = /^ {0,3}::entity\{([^}\n]*)\}[ \t]*(?:\n|$)/;
const INLINE = /^:entity\[([^\]]*)\]\{([^}\n]*)\}/;

interface EntityCardToken extends MarkdownToken {
  ref: string;
}
interface EntityMentionToken extends MarkdownToken {
  ref: string;
  label: string;
}

export const EntityCard = Node.create({
  name: "entityCard",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes: () => ({ ref: { default: null } }),

  parseHTML: () => [{ tag: "entity-card" }],
  renderHTML: ({ HTMLAttributes }) => ["entity-card", HTMLAttributes],

  markdownTokenizer: {
    name: "entityCard",
    level: "block",
    // marked uses `start` to decide where to cut a paragraph. Landing on the
    // preceding newline rather than the colons is safe — it only ever cuts
    // earlier, never later.
    start: (src: string) => src.search(/(^|\n) {0,3}::entity\{/),
    tokenize: (src: string) => {
      const m = BLOCK.exec(src);
      if (!m) return;
      const ref = REF.exec(m[1])?.[1];
      // No ref, no node: the directive degrades to literal text, exactly as
      // remarkEntity degrades it (lib/markdown.ts:34).
      if (!ref) return;
      return { type: "entityCard", raw: m[0], ref } as EntityCardToken;
    },
  },
  parseMarkdown: (token: MarkdownToken) => ({
    type: "entityCard",
    attrs: { ref: (token as EntityCardToken).ref },
  }),
  renderMarkdown: (node: JSONContent) => `::entity{ref=${node.attrs?.ref}}`,
});

export const EntityMention = Node.create({
  name: "entityMention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes: () => ({ ref: { default: null }, label: { default: "" } }),

  parseHTML: () => [{ tag: "entity-link" }],
  renderHTML: ({ HTMLAttributes }) => ["entity-link", HTMLAttributes],

  markdownTokenizer: {
    name: "entityMention",
    level: "inline",
    // The lookbehind is the block form's guard: `::entity[…]` must not be read
    // as an inline mention preceded by a stray colon.
    start: (src: string) => src.search(/(?<!:):entity\[/),
    tokenize: (src: string) => {
      const m = INLINE.exec(src);
      if (!m) return;
      const ref = REF.exec(m[2])?.[1];
      if (!ref) return;
      return { type: "entityMention", raw: m[0], label: m[1], ref } as EntityMentionToken;
    },
  },
  parseMarkdown: (token: MarkdownToken) => ({
    type: "entityMention",
    attrs: {
      ref: (token as EntityMentionToken).ref,
      label: (token as EntityMentionToken).label,
    },
  }),
  renderMarkdown: (node: JSONContent) =>
    `:entity[${node.attrs?.label ?? ""}]{ref=${node.attrs?.ref}}`,
});

/**
 * The headless extension set: schema and markdown, no views. Exported so both
 * lib/entity-markdown.test.ts and lib/markdown-conformance.test.ts drive the
 * exact schema the editor drives, minus the React node views the editor layers
 * on top (components/editor/entity-views.tsx). One definition, so a node added
 * later cannot be tested by one file and missed by the other.
 */
export const headlessExtensions = [StarterKit, TableKit, EntityCard, EntityMention];
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --import tsx --test lib/entity-markdown.test.ts 2>&1 | tail -8`
Expected: `# pass 6`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add lib/entity-markdown.ts lib/entity-markdown.test.ts
git commit -m "feat: entity nodes with a marked tokenizer for the ::entity grammar"
```

---

### Task 3: The conformance test, and the renderer bug it finds

The test that makes Task 2 safe, plus a genuine slice-3 bug it surfaces: a ref-less
`:entity[Label]{}` currently renders as `<div>Label</div>` **inside a `<p>`** — invalid nesting, and
the opposite of compose §3's *"produces no element at all"*.

**Files:**
- Create: `lib/markdown-conformance.test.ts`
- Modify: `lib/markdown.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import { MarkdownManager } from "@tiptap/markdown";
import { remarkPlugins, rehypePlugins } from "./markdown";
import { headlessExtensions } from "./entity-markdown";

// Spec §6. The editor writes markdown with `marked`; the site renders it with
// `remark`. This asserts they MEAN the same thing, by comparing rendered HTML
// rather than markdown — markdown comparison would fail on harmless
// normalization (spec §2.5) and would be a test about formatting, not meaning.
const manager = new MarkdownManager({ extensions: headlessExtensions });

// The EXACT chain the app renders — same helper as lib/entity-refs.test.ts:12.
const render = (source: string): string =>
  renderToStaticMarkup(createElement(Markdown, { remarkPlugins, rehypePlugins }, source));

const roundTrip = (source: string): string => manager.serialize(manager.parse(source)).trim();

const FIXTURES: Record<string, string> = {
  heading: "## Execution",
  emphasis: "plain *em* and **strong** text",
  underscoreEmphasis: "_em_ and __strong__",
  link: "see [the docs](https://example.com)",
  linkTitle: '[x](https://e.com "T")',
  bullets: "- one\n- two",
  nestedList: "- a\n  - b\n- c",
  ordered: "1. first\n2. second",
  quote: "> quoted line",
  inlineCode: "call `filterPublic()` first",
  fenced: "```ts\nconst x: number = 1\n```",
  indentedCode: "    ::entity{ref=bean:x}",
  table: "| a | b |\n| --- | --- |\n| 1 | 2 |",
  hardWrap: "line one\nline two",
  entityCard: "::entity{ref=bean:karma-accountability}",
  entityInline: "see :entity[Prediction Timelines]{ref=bean:prediction-timelines} here",
  entityInFence: "```\n::entity{ref=bean:x}\n```",
  entityInInlineCode: "literal `::entity{ref=bean:x}` here",
  reflessBlock: "::entity{foo=bar}",
  emptyRef: "::entity{ref=}",
  mixed: "## Drawer\n\nProse with :entity[X]{ref=bean:x} inline.\n\n::entity{ref=bean:y}",
};

for (const [name, source] of Object.entries(FIXTURES)) {
  test(`conformance: ${name} means the same after a round trip`, () => {
    assert.equal(render(roundTrip(source)), render(source));
  });
}

test("a ref-less inline directive degrades to prose, not to a <div> in a <p>", () => {
  // compose §3: "a directive whose ref is missing or malformed produces no
  // element at all". Before this slice the unhandled mdast node reached
  // mdast-util-to-hast, which renders it as a bare <div> — inside a <p>, which
  // is invalid nesting.
  assert.equal(render("see :entity[Label]{} here"), "<p>see Label here</p>");
});

test("KNOWN DIVERGENCE: a malformed inline directive is the one case the parsers read differently", () => {
  // remark CONSUMES the directive syntax and keeps the label; marked never
  // tokenizes it, so it survives as literal text and serializes with escaped
  // brackets. Neither is wrong — they disagree only on input the editor can
  // never produce, and which only reaches the vault by hand through
  // /api/articles. Asserted so it stays known rather than surprising; if this
  // test starts failing, the parsers have converged and it can be deleted.
  const source = "see :entity[Label]{} here";
  assert.equal(render(source), "<p>see Label here</p>");
  assert.equal(roundTrip(source), "see :entity\\[Label\\]{} here");
  assert.notEqual(render(roundTrip(source)), render(source));
});
```

- [ ] **Step 2: Run it to see the two real failures**

Run: `node --import tsx --test lib/markdown-conformance.test.ts 2>&1 | tail -12`
Expected: FAIL on `degrades to prose, not to a <div>` (actual is
`<p>see <div>Label</div> here</p>`), and FAIL on the `KNOWN DIVERGENCE` test's first assertion for
the same reason. Every `conformance: …` case passes already.

- [ ] **Step 3: Fix the renderer**

In `lib/markdown.ts`, add `children` to the local `DirectiveNode` interface:

```ts
interface DirectiveNode {
  type: string;
  name?: string;
  children?: unknown[];
  attributes?: Record<string, string | null | undefined>;
  data?: { hName?: string; hProperties?: Record<string, unknown> };
}
```

Then widen the visitor signature and replace the bare `if (!ref) return;`:

```ts
function remarkEntity() {
  return (tree: unknown) => {
    visit(
      tree as never,
      (node: DirectiveNode, index?: number, parent?: { children: unknown[] }) => {
        const block = node.type === "containerDirective" || node.type === "leafDirective";
        const inline = node.type === "textDirective";
        if ((!block && !inline) || node.name !== "entity") return;
        const ref = typeof node.attributes?.ref === "string" ? node.attributes.ref.trim() : "";
        if (!ref) {
          // Degrade to NOTHING (compose §3), which means unwrapping to the
          // directive's own children. Returning early instead leaves an
          // unhandled directive node for mdast-util-to-hast, which renders it
          // as a bare <div> — inside a <p> for the inline form, which is
          // invalid nesting. Found by lib/markdown-conformance.test.ts.
          if (parent && typeof index === "number") {
            parent.children.splice(index, 1, ...(node.children ?? []));
            return index;
          }
          return;
        }
        node.data = {
          ...node.data,
          hName: block ? "entity-card" : "entity-link",
          hProperties: { "data-ref": ref },
        };
      },
    );
  };
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --import tsx --test lib/markdown-conformance.test.ts lib/markdown.test.ts lib/entity-refs.test.ts 2>&1 | tail -8`
Expected: `# fail 0`. The two pre-existing suites must still pass — the fix changes only the
ref-less path.

- [ ] **Step 5: Close the third implementation's gap in the same grammar**

Task 2's code-quality review found that `lib/entity-refs.ts` — the scanner that mirrors prose refs
into `relations[]` — does not recognise the **labeled** block form. So
`::entity[Some Label]{ref=bean:x}` renders as a card on the page but mints **no graph edge**. Give
its `BLOCK` the same optional-label group Task 2 gave the tokenizer:

```ts
const BLOCK = /^ {0,3}::entity(?:\[[^\]\n]*\])?\{[^}]*\bref=([^\s}]+)/gm;
```

Add to `lib/entity-refs.test.ts`:

```ts
test("a labeled block card mints an embeds edge, like the unlabeled form", () => {
  // Found by the slice-5 conformance work: the renderer draws a card for this
  // and the graph had no edge for it.
  assert.deepEqual(extractRefs("::entity[Some Label]{ref=bean:x}"), [
    { kind: "embeds", ref: "bean:x" },
  ]);
});
```

- [ ] **Step 6: Pin all three implementations against one fixture table**

This is the artifact that actually prevents drift, and it is the review's own recommendation. There
are **three** implementations of this grammar — remark (renders the page), the marked tokenizer
(the editor writes), and `extractRefs` (feeds the graph) — and until now no test drove more than two.

Create `lib/entity-fixtures.ts`:

```ts
/**
 * One corpus, three readers. This grammar is implemented three times — remark
 * renders it (lib/markdown.ts), the marked tokenizer writes it
 * (lib/entity-markdown.ts), and extractRefs mirrors it into the graph
 * (lib/entity-refs.ts). Every row below is a case where all three MUST agree.
 *
 * Cases where they legitimately differ are NOT here: they live as named,
 * commented tests in lib/markdown-conformance.test.ts, so a divergence is
 * always either forbidden (this file) or deliberate (a named test).
 */
export interface EntityFixture {
  md: string;
  expect: "card" | "mention" | "none";
}

export const ENTITY_FIXTURES: EntityFixture[] = [
  { md: "::entity{ref=bean:x}", expect: "card" },
  { md: "::entity[Some Label]{ref=bean:x}", expect: "card" },
  { md: "   ::entity{ref=bean:x}", expect: "card" },
  { md: "Before.\n\n::entity{ref=bean:x}", expect: "card" },
  { md: "see :entity[Label]{ref=bean:x} here", expect: "mention" },
  { md: "    ::entity{ref=bean:x}", expect: "none" },
  { md: "```\n::entity{ref=bean:x}\n```", expect: "none" },
  { md: "literal `::entity{ref=bean:x}` here", expect: "none" },
  { md: "::entity{foo=bar}", expect: "none" },
  { md: "::entity{ref=}", expect: "none" },
  { md: "x::entity{ref=bean:x}", expect: "none" },
];
```

Append to `lib/markdown-conformance.test.ts`:

```ts
import { extractRefs } from "./entity-refs";
import { ENTITY_FIXTURES } from "./entity-fixtures";

// Reads what each implementation believes the fixture contains.
const remarkVerdict = (md: string): "card" | "mention" | "none" => {
  const html = render(md);
  if (html.includes("<entity-card")) return "card";
  if (html.includes("<entity-link")) return "mention";
  return "none";
};

const editorVerdict = (md: string): "card" | "mention" | "none" => {
  const json = JSON.stringify(manager.parse(md));
  if (json.includes('"entityCard"')) return "card";
  if (json.includes('"entityMention"')) return "mention";
  return "none";
};

const refsVerdict = (md: string): "card" | "mention" | "none" => {
  const kinds = extractRefs(md).map((r) => r.kind);
  if (kinds.includes("embeds")) return "card";
  if (kinds.includes("mentions")) return "mention";
  return "none";
};

for (const { md, expect } of ENTITY_FIXTURES) {
  test(`all three readers agree on ${JSON.stringify(md)}`, () => {
    assert.equal(remarkVerdict(md), expect, "remark (renders the page)");
    assert.equal(editorVerdict(md), expect, "marked tokenizer (the editor writes)");
    assert.equal(refsVerdict(md), expect, "extractRefs (feeds the graph)");
  });
}
```

- [ ] **Step 7: Run everything**

Run: `npm test 2>&1 | tail -6`
Expected: `fail 0`. If a fixture row fails, **do not weaken the row** — one of the three
implementations is wrong, and the row is the point.

- [ ] **Step 8: Commit**

```bash
git add lib/markdown.ts lib/entity-refs.ts lib/entity-refs.test.ts \
        lib/entity-fixtures.ts lib/markdown-conformance.test.ts
git commit -m "test: one grammar corpus, three readers; fix ref-less <div> and the labeled-block gap"
```

---

### Task 3b: Stop `remark-directive` from eating ordinary prose

**Found by the Task 3 conformance work, not planned.** `remark-directive` is enabled globally for
the whole public zone, so **every** `:` followed by identifier characters is parsed as a directive —
not just ours. Unhandled directives reach `mdast-util-to-hast` with no `hName` and render as a bare
`<div>`, destroying the text:

| authored prose | renders as |
|---|---|
| `meet at 10:30 tomorrow` | `<p>meet at 10<div></div> tomorrow</p>` |
| `a ratio of 3:2` | `<p>a ratio of 3<div></div></p>` |
| `see :something[here]` | `<p>see <div>here</div> in prose</p>` |

Verified against the live database: **no published document is affected today**, because until now
nothing could author prose. Slice 5 is precisely what makes it reachable — the moment the editor
ships, a time of day in an article silently corrupts the page. Task 3 fixed this for ref-less
`entity` directives only; this closes the general case.

**Files:**
- Modify: `lib/markdown.ts`
- Modify: `lib/entity-fixtures.ts`
- Test: `lib/markdown-conformance.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `lib/markdown-conformance.test.ts`:

```ts
test("a time of day survives rendering", () => {
  assert.equal(render("meet at 10:30 tomorrow"), "<p>meet at 10:30 tomorrow</p>");
});

test("a ratio survives rendering", () => {
  assert.equal(render("a ratio of 3:2 today"), "<p>a ratio of 3:2 today</p>");
});

test("a directive we do not handle is left as the text the author wrote", () => {
  // remark-directive parses ALL directive syntax, not just ours. Anything we
  // do not claim must be handed back verbatim rather than rendered as a <div>.
  assert.equal(render("see :something[here] in prose"), "<p>see :something[here] in prose</p>");
  assert.equal(render("::callout{type=warn}"), "<p>::callout{type=warn}</p>");
});

test("no rendered output ever contains an empty div", () => {
  for (const md of ["meet at 10:30", "3:2", ":x", "a:b:c", "::callout{type=warn}"]) {
    assert.ok(!render(md).includes("<div></div>"), md);
  }
});
```

Add three rows to `ENTITY_FIXTURES` in `lib/entity-fixtures.ts` — the corpus had no colon case at
all, which is why this survived Task 3:

```ts
  { md: "meet at 10:30 tomorrow", expect: "none" },
  { md: "a ratio of 3:2 today", expect: "none" },
  { md: "see :something[here] in prose", expect: "none" },
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `node --import tsx --test lib/markdown-conformance.test.ts 2>&1 | tail -20`
Expected: the four new tests FAIL with `<div></div>` in the actual output. The three new fixture rows
should PASS already (all three readers agree the text contains no entity), which is the point — the
fixture table checks *agreement*, and both readers agree while both are wrong about the prose.

- [ ] **Step 3: Restore unhandled directives from their own source offsets**

In `lib/markdown.ts`, a remark transformer receives `(tree, file)`, and every mdast node carries
`position.start.offset` / `position.end.offset`. So the original text can be restored **byte-exactly**
rather than reconstructed from name + label + attributes, which would lose attribute order and
quoting.

Widen `DirectiveNode`:

```ts
interface DirectiveNode {
  type: string;
  name?: string;
  children?: unknown[];
  attributes?: Record<string, string | null | undefined>;
  data?: { hName?: string; hProperties?: Record<string, unknown> };
  position?: { start: { offset?: number }; end: { offset?: number } };
}
```

Change the transformer signature and add the fall-through. Note the ref-less `entity` branch keeps
its existing unwrap-to-children behaviour — `:entity[Label]{}` still degrades to `Label`, which
Task 3 pinned and the `KNOWN DIVERGENCE` test asserts:

```ts
function remarkEntity() {
  return (tree: unknown, file: { value?: unknown }) => {
    const source = typeof file?.value === "string" ? file.value : "";
    visit(
      tree as never,
      (node: DirectiveNode, index?: number, parent?: { children: unknown[] }) => {
        const block = node.type === "containerDirective" || node.type === "leafDirective";
        const inline = node.type === "textDirective";
        if (!block && !inline) return;

        // Not ours. remark-directive claims EVERY `:name` in prose — a time of
        // day, a ratio, a namespaced word — and an unclaimed directive reaches
        // mdast-util-to-hast with no hName, where it renders as a bare <div>
        // and the author's text is gone. Hand it back exactly as written,
        // sliced from the source by the node's own offsets so attribute order
        // and quoting survive verbatim.
        if (node.name !== "entity") {
          const from = node.position?.start?.offset;
          const to = node.position?.end?.offset;
          if (parent && typeof index === "number" && typeof from === "number" && typeof to === "number") {
            parent.children.splice(index, 1, { type: "text", value: source.slice(from, to) });
            return index + 1; // past the text node just inserted
          }
          return;
        }

        const ref = typeof node.attributes?.ref === "string" ? node.attributes.ref.trim() : "";
        if (!ref) {
          // Degrade to NOTHING (compose §3), which means unwrapping to the
          // directive's own children. Returning early instead leaves an
          // unhandled directive node for mdast-util-to-hast, which renders it
          // as a bare <div> — inside a <p> for the inline form, which is
          // invalid nesting. Found by lib/markdown-conformance.test.ts.
          if (parent && typeof index === "number") {
            parent.children.splice(index, 1, ...(node.children ?? []));
            return index;
          }
          return;
        }
        node.data = {
          ...node.data,
          hName: block ? "entity-card" : "entity-link",
          hProperties: { "data-ref": ref },
        };
      },
    );
  };
}
```

- [ ] **Step 4: Run everything**

Run: `node --import tsx --test lib/markdown-conformance.test.ts lib/markdown.test.ts lib/entity-refs.test.ts lib/entity-markdown.test.ts 2>&1 | tail -8`
Expected: `fail 0`. The `KNOWN DIVERGENCE` test and the ref-less-degrades-to-prose test must both
still pass — `entity` directives are handled before the fall-through, so their behaviour is unchanged.

Run: `npm test 2>&1 | tail -6` — expected `fail 0`.
Run: `npx tsc --noEmit` — expected clean.

- [ ] **Step 5: Commit**

```bash
git add lib/markdown.ts lib/entity-fixtures.ts lib/markdown-conformance.test.ts
git commit -m "fix: a time of day in prose no longer renders as an empty div"
```

---

### Task 3c: The editor must not delete what it cannot represent

**Found by the Task 3 + 3b quality review.** Seven items, one theme: a save must never lose the
author's work. Verified against the real pipelines — every claim below was reproduced before being
written down.

- [ ] **Step 1: Stop the editor deleting images and task lists (the important one)**

`StarterKit` ships no `Image` and no `TaskList` extension, so anything it cannot represent is
dropped on serialize. Measured:

| input | today | required |
|---|---|---|
| `![alt text](/img.png)` | `alt text` — **the image is gone** | round-trips |
| `- [ ] todo\n- [x] done` | `""` — **the whole list is gone** | round-trips |

Once the editor ships, opening any article containing an image and pressing Save destroys it. Verified
that registering the extensions fixes both completely:

```bash
npm install @tiptap/extension-image@3.30.2 @tiptap/extension-list@3.30.2
```

In `lib/entity-markdown.ts`, add them to `headlessExtensions`:

```ts
import { Image } from "@tiptap/extension-image";
import { TaskList, TaskItem } from "@tiptap/extension-list";

// Image and TaskList are NOT in StarterKit, and @tiptap/markdown drops any node
// its schema cannot represent: without these, saving an article silently
// deletes every image, and a task list serializes to the empty string.
export const headlessExtensions = [StarterKit, TableKit, Image, TaskList, TaskItem, EntityCard, EntityMention];
```

Add corpus rows to `lib/entity-fixtures.ts` (`expect: "none"` — they contain no entity) and
round-trip fixtures to `lib/markdown-conformance.test.ts`:

```ts
  image: "![alt text](/img.png)",
  imageTitled: '![alt](/i.png "Title")',
  taskList: "- [ ] todo item\n- [x] done item",
```

- [ ] **Step 2: Pin the two losses that adding an extension cannot fix**

Character entities and GFM footnotes survive remark but not the round trip. Verified:
`"AT&amp;T &copy; x"` → `"AT&amp;T &amp;copy; x"` (the entity becomes literal text), and
`"text[^1]\n\n[^1]: note"` → `"text[^1](note)"`. Add named divergence tests in the style the file
already uses, so both stay known rather than surprising. Do **not** add them to `ENTITY_FIXTURES` —
that corpus is for cases all three readers agree on.

- [ ] **Step 3: Fix the BOM off-by-one in the restoration**

micromark strips a leading U+FEFF before assigning offsets, so positions index the BOM-less string
while `file.value` still carries it, and every slice shifts by one. Verified:
`render("\uFEFFmeet at 10:30 tomorrow")` → `<p>meet at 100:3 tomorrow</p>` — the exact silent
corruption Task 3b exists to prevent.

```ts
const raw = typeof file?.value === "string" ? file.value : "";
// micromark's preprocessor strips a leading BOM before assigning offsets, so
// positions index the BOM-less string while file.value still carries it.
const source = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
```

Add `"\uFEFFmeet at 10:30 tomorrow"` as a round-trip fixture.

- [ ] **Step 4: Restrict the grammar and the fall-through to leaf and text directives**

Task 3b's fall-through replaces a *container* directive before `visit` reaches its children, so all
inner structure is discarded. Measured regression:

| input | before 3b | after 3b |
|---|---|---|
| `:::note\npara one\n\npara two\n:::` | `<div><p>para one</p><p>para two</p></div>` | one run-on `<p>` of literal source |
| `:::grid\n::entity{ref=bean:x}\n:::` | renders the card | card gone, **but `extractRefs` still mints the edge** |

The third row is a page/graph disagreement, which this slice exists to eliminate. Fix both this and
the related `:::entity` divergence by narrowing what counts:

- **Ariko's grammar is `leafDirective` + `textDirective` only.** `::entity{…}` and
  `:entity[…]{…}`. Change the entity branch's `block` test from
  `containerDirective || leafDirective` to `leafDirective` alone. A `:::entity{…}` container then
  stops being ours.
- **The fall-through restores only `leafDirective` and `textDirective`.** A foreign
  `containerDirective` keeps the pre-3b behaviour: unwrap to its children, preserving inner
  structure.

Say all of this in the comment. The current comment claims the restoration is a strict improvement,
which is not true for containers.

- [ ] **Step 5: Let a card in a quote or a list mint its graph edge**

`extractRefs`'s `BLOCK` is anchored `^ {0,3}::entity`, so a line prefixed by `> ` or `- ` never
matches — while both other readers render a card. Verified three-reader verdicts today:

| input | remark | editor | extractRefs |
|---|---|---|---|
| `> ::entity{ref=bean:x}` | card | card | **none** |
| `- ::entity{ref=bean:x}` | card | card | **none** |

This is reachable from the editor the moment Task 10 lands: `EntityCard` is `group: "block"`, and
StarterKit's `blockquote` and `listItem` both accept block content. It is the identical bug class
Task 3 Step 5 fixed for labeled cards.

Widen `BLOCK` to tolerate blockquote and list-item prefixes **without** breaking the 4-space
indented-code rule — `    ::entity{ref=x}` must still mint nothing. Add all four cases
(`> `, `- `, nested, and the 4-space negative) as corpus rows and let the fixture table be the spec.

- [ ] **Step 6: Three robustness fixes in the restoration**

- A non-string `file.value` (VFile permits `Uint8Array`) leaves `source` empty while the offsets stay
  valid numbers, so every foreign directive is replaced with an **empty** text node. Guard on
  `source` being non-empty before restoring.
- A directive node with no `position` falls through to `return`, which restores the original bare-`<div>`
  bug. Unwrap to `node.children` instead — the same fallback the ref-less branch already uses.
- `lib/markdown-conformance.test.ts`'s "no rendered output ever contains an empty div" test matches
  the literal `<div></div>`, so it would not have caught the `:something[here]` → `<div>here</div>`
  case that motivated Task 3b. This pipeline never legitimately mints a div — assert
  `!render(md).includes("<div")`.

- [ ] **Step 7: Split the transformer**

`remarkEntity` now does three jobs and its name covers one of them; someone debugging a vanished
`:foo` will not grep for "entity". Split into `remarkEntity` (claim + ref-less unwrap) and
`remarkRestoreForeignDirectives` (the fall-through), registered in that order in `remarkPlugins`.
The extra `visit` is one O(n) walk over a tree that parse, `mdast-to-hast` and `renderToStaticMarkup`
each already traverse — not measurable, and the ordering becomes explicit rather than implicit.

- [ ] **Step 8: Verify and commit**

Run: `npm test 2>&1 | tail -6` — baseline is **462 pass / 0 fail / 32 skipped**; expect it higher, `fail 0`.
Run: `npx tsc --noEmit` — clean.
Confirm `git status --short` is empty of scratch files before committing; **never `git add -A`**.

```bash
git add lib/markdown.ts lib/entity-refs.ts lib/entity-markdown.ts \
        lib/entity-fixtures.ts lib/markdown-conformance.test.ts package.json package-lock.json
git commit -m "fix: the editor no longer deletes images, task lists or BOM-prefixed prose"
```

---

### Task 4: The picker's menu

Pure. Turns the raw garden into the rows the `@` and `/` menus offer. Sprouts are excluded on
purpose: `resolveEntity` returns `null` for `sprout:` refs (there is no public sprout URL), so a
sprout card could never render.

**Files:**
- Create: `lib/entity-options.ts`
- Test: `lib/entity-options.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { entityOptions } from "./entity-options";
import type { RawGarden } from "./data";

const garden: RawGarden = {
  plants: [
    { slug: "paulopus", name: "Paulopus", natures: ["work"], description: "A project." },
  ],
  pods: [{ slug: "records", name: "Records", description: "" }],
  beans: [
    { slug: "karma", name: { en: "Karma", fr: "Karma FR" }, parents: [], description: "Synopsis." },
    { slug: "anatomy", name: "Anatomy", parents: [] },
  ],
  sprouts: [{ slug: "karma-0", name: "K0", type: "article", date: "2026-07-24", description: "", parents: [] }],
};

test("offers plants, pods and beans, sorted by name", () => {
  assert.deepEqual(
    entityOptions(garden).map((o) => o.ref),
    ["bean:anatomy", "bean:karma", "plant:paulopus", "pod:records"],
  );
});

test("never offers sprouts — a sprout card could not resolve a URL", () => {
  assert.ok(!entityOptions(garden).some((o) => o.ref.startsWith("sprout:")));
});

test("carries kind, resolved name and a non-blank description only", () => {
  const byRef = new Map(entityOptions(garden).map((o) => [o.ref, o]));
  assert.deepEqual(byRef.get("bean:karma"), {
    ref: "bean:karma",
    kind: "bean",
    name: "Karma",
    description: "Synopsis.",
  });
  // No description key at all when it is absent or blank — the menu renders on
  // presence, and an empty string would render an empty line.
  assert.deepEqual(byRef.get("bean:anatomy"), {
    ref: "bean:anatomy",
    kind: "bean",
    name: "Anatomy",
  });
});

test("excludes the entity being edited, so a page cannot reference itself", () => {
  assert.ok(!entityOptions(garden, "plant:paulopus").some((o) => o.ref === "plant:paulopus"));
  assert.equal(entityOptions(garden, "plant:paulopus").length, 3);
});

test("an empty garden yields no options rather than throwing", () => {
  assert.deepEqual(entityOptions({}), []);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --import tsx --test lib/entity-options.test.ts 2>&1 | tail -5`
Expected: FAIL — `Cannot find module './entity-options'`.

- [ ] **Step 3: Write the implementation**

```ts
import {
  BEAN_PREFIX,
  PLANT_PREFIX,
  POD_PREFIX,
  resolveText,
  type Bean,
  type Plant,
  type Pod,
  type RawGarden,
} from "./data";

export interface EntityOption {
  ref: string;
  kind: "plant" | "pod" | "bean";
  name: string;
  description?: string;
}

/**
 * Pure. The rows the editor's `@` and `/` menus offer (spec §2.6).
 *
 * Sprouts are absent by design: resolveEntity returns null for `sprout:` refs
 * because sprouts have no public URL, so offering one would mint a reference
 * that can never render. `exclude` keeps a page from referencing itself.
 *
 * Reads the RAW garden, not a Dataset — Dataset has no whole-bean accessor, and
 * composing beansForPlant + beansForPod + standaloneBeans to fake one would be
 * three ways to miss a bean.
 */
export function entityOptions(raw: RawGarden, exclude?: string): EntityOption[] {
  const rows: EntityOption[] = [];

  const collect = (
    kind: EntityOption["kind"],
    prefix: string,
    docs: Array<Plant | Pod | Bean> | undefined,
  ): void => {
    for (const doc of docs ?? []) {
      const ref = prefix + doc.slug;
      if (ref === exclude) continue;
      const description = resolveText(doc.description ?? "").trim();
      rows.push({
        ref,
        kind,
        name: resolveText(doc.name),
        ...(description ? { description } : {}),
      });
    }
  };

  collect("plant", PLANT_PREFIX, raw.plants);
  collect("pod", POD_PREFIX, raw.pods);
  collect("bean", BEAN_PREFIX, raw.beans);

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --import tsx --test lib/entity-options.test.ts 2>&1 | tail -6`
Expected: `# pass 5`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add lib/entity-options.ts lib/entity-options.test.ts
git commit -m "feat: entityOptions — the prose editor's reference picker menu"
```

---

### Task 5: The content patch

The pure core of a save: size ceiling, bilingual preservation, ref mirroring, dirty detection.

**Files:**
- Create: `lib/content-edit.ts`
- Test: `lib/content-edit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContentPatch, MAX_CONTENT_BYTES } from "./content-edit";

test("an unchanged document is not dirty and yields no patch", () => {
  assert.deepEqual(buildContentPatch({ content: "same" }, "same"), { ok: true, dirty: false });
  assert.deepEqual(buildContentPatch({ content: { en: "same" } }, "same"), { ok: true, dirty: false });
  // A document that has never had content, saved empty, is also not dirty.
  assert.deepEqual(buildContentPatch({}, ""), { ok: true, dirty: false });
});

test("a plain string stays a plain string", () => {
  const result = buildContentPatch({ content: "old" }, "new");
  assert.equal(result.ok && result.dirty && result.patch.content, "new");
});

test("a bilingual value keeps its fr half untouched", () => {
  // Spec §2.9: the editor only ever edits `en`, and must never destroy `fr`.
  const result = buildContentPatch({ content: { en: "old", fr: "français" } }, "new");
  assert.deepEqual(result.ok && result.dirty && result.patch.content, {
    en: "new",
    fr: "français",
  });
});

test("mirrored relations are re-derived and hand-authored kinds survive", () => {
  // Spec §2.10 — the regression articles-store would have introduced by
  // passing `undefined` as the existing relations.
  const result = buildContentPatch(
    {
      content: "::entity{ref=bean:gone}",
      relations: [
        { kind: "evolves-from", ref: "sprout:earlier" },
        { kind: "embeds", ref: "bean:gone" },
      ],
    },
    "::entity{ref=bean:fresh}\n\nand :entity[M]{ref=plant:p} inline",
  );
  assert.deepEqual(result.ok && result.dirty && result.patch.relations, [
    { kind: "evolves-from", ref: "sprout:earlier" },
    { kind: "embeds", ref: "bean:fresh" },
    { kind: "mentions", ref: "plant:p" },
  ]);
});

test("content over the ceiling is refused, and the message names the limit", () => {
  const tooBig = "x".repeat(MAX_CONTENT_BYTES + 1);
  const result = buildContentPatch({}, tooBig);
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.error : "", /64 KiB/);
});

test("the ceiling counts bytes, not characters", () => {
  // "é" is two bytes in UTF-8, so half the ceiling in é's must exceed it.
  const result = buildContentPatch({}, "é".repeat(MAX_CONTENT_BYTES / 2 + 1));
  assert.equal(result.ok, false);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --import tsx --test lib/content-edit.test.ts 2>&1 | tail -5`
Expected: FAIL — `Cannot find module './content-edit'`.

- [ ] **Step 3: Write the implementation**

```ts
import { textPart, type Relation, type Text } from "./data";
import { extractRefs, mergeMirrored } from "./entity-refs";

// The article door's ceiling (article-door spec §4), applied to the same field
// from the authoring side so the two doors agree on what fits.
export const MAX_CONTENT_BYTES = 64 * 1024;

/** The slice of a Sprout / Plant / Pod this module cares about. */
export interface ContentOwner {
  content?: Text;
  relations?: Relation[];
}

export interface ContentPatch {
  content: Text;
  relations: Relation[];
}

export type ContentPatchResult =
  | { ok: true; dirty: false }
  | { ok: true; dirty: true; patch: ContentPatch }
  | { ok: false; error: string };

/**
 * Pure. Turns the editor's markdown into the fields to write, or says the
 * document is unchanged.
 *
 * Three rules, all from the spec:
 *  - §2.5 dirty-gating: an untouched open-and-save writes NOTHING, so reading a
 *    bee-written digest can never silently normalize it.
 *  - §2.9 bilingual safety: the editor edits `en` only; a stored `fr` half is
 *    carried back verbatim.
 *  - §2.10 mirroring: existing relations are PASSED IN, so hand-authored kinds
 *    survive. `lib/articles-store.ts` passes `undefined` here, which is right
 *    for a door that only writes unreviewed sprouts and wrong for an edit path.
 */
export function buildContentPatch(current: ContentOwner, markdown: string): ContentPatchResult {
  if (new TextEncoder().encode(markdown).length > MAX_CONTENT_BYTES) {
    return { ok: false, error: `content exceeds ${MAX_CONTENT_BYTES / 1024} KiB` };
  }

  const stored = current.content;
  // textPart is STRICT — no fallback from a blank `en` to `fr`, which is
  // exactly what the load side uses (app/admin/_components/content-card.tsx).
  // The two must agree or a save would compare the editor's text against a
  // string it was never given.
  if (textPart(stored, "en") === markdown) return { ok: true, dirty: false };

  const frPart =
    typeof stored === "object" && stored !== null && typeof stored.fr === "string" ? stored.fr : "";
  const content: Text = frPart ? { en: markdown, fr: frPart } : markdown;

  return {
    ok: true,
    dirty: true,
    patch: { content, relations: mergeMirrored(current.relations, extractRefs(content)) },
  };
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --import tsx --test lib/content-edit.test.ts 2>&1 | tail -6`
Expected: `# pass 6`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add lib/content-edit.ts lib/content-edit.test.ts
git commit -m "feat: buildContentPatch — dirty-gated, fr-preserving, relation-safe"
```

---

### Task 6: The three content writers

Narrow writers that set **explicitly named fields only**. This is the task the "waste your afternoon"
warning is about.

**Files:**
- Modify: `lib/botanical.ts`
- Test: `lib/content-store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  updateSproutContent,
  updatePlantContent,
  updatePodContent,
} from "./botanical";
import { getDb } from "./db";

const hasDb = Boolean(process.env.MONGODB_URI);

async function cleanup() {
  const db = await getDb();
  await db.collection("plants").deleteMany({ slug: /^__test__/ });
  await db.collection("pods").deleteMany({ slug: /^__test__/ });
  await db.collection("sprouts").deleteMany({ slug: /^__test__/ });
}

test("a content write touches content and relations and NOTHING else", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("sprouts").insertOne({
    slug: "__test__s",
    name: "S",
    type: "article",
    date: "2026-08-23",
    description: "keep me",
    parents: ["bean:__test__b"],
    state: "published",
    media: [{ kind: "image", storageKey: "k", url: "https://e.com/i.png" }],
    source: { kind: "manual" },
    content: "before",
  });

  await updateSproutContent("__test__s", {
    content: "after",
    relations: [{ kind: "embeds", ref: "bean:x" }],
  });

  const stored = await db.collection("sprouts").findOne({ slug: "__test__s" });
  assert.equal(stored?.content, "after");
  assert.deepEqual(stored?.relations, [{ kind: "embeds", ref: "bean:x" }]);
  // The fields a content save must never disturb (spec §9 acceptance).
  assert.equal(stored?.state, "published");
  assert.equal(stored?.description, "keep me");
  assert.equal(stored?.type, "article");
  assert.deepEqual(stored?.parents, ["bean:__test__b"]);
  assert.equal((stored?.media as unknown[])?.length, 1);
  assert.deepEqual(stored?.source, { kind: "manual" });
});

test("the container writers reach plants and pods, leaving visibility alone", { skip: !hasDb }, async (t) => {
  t.after(cleanup);
  const db = await getDb();
  await db.collection("plants").insertOne({
    slug: "__test__p", name: "P", natures: ["work"], description: "d", visibility: "public",
  });
  await db.collection("pods").insertOne({
    slug: "__test__d", name: "D", description: "d", visibility: "private",
  });

  await updatePlantContent("__test__p", { content: "plant prose", relations: [] });
  await updatePodContent("__test__d", { content: "pod prose", relations: [] });

  const plant = await db.collection("plants").findOne({ slug: "__test__p" });
  const pod = await db.collection("pods").findOne({ slug: "__test__d" });
  assert.equal(plant?.content, "plant prose");
  assert.equal(plant?.visibility, "public");
  assert.equal(plant?.description, "d");
  assert.equal(pod?.content, "pod prose");
  assert.equal(pod?.visibility, "private");
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --import tsx --test lib/content-store.test.ts 2>&1 | tail -5`
Expected: FAIL — `updateSproutContent is not exported`. (If `MONGODB_URI` is unset the tests skip;
the import error still fails the file, which is the signal you need.)

- [ ] **Step 3: Write the implementation**

Append to `lib/botanical.ts`. Import the patch type rather than redeclaring it — `ContentPatch` is
already exactly `{ content, relations }`, and two structurally identical names for one payload is how
they drift apart later:

```ts
import type { ContentPatch } from "./content-edit";
```

```ts
/**
 * Writes prose and its mirrored relations — and nothing else.
 *
 * The two fields are named explicitly rather than spread, deliberately. This is
 * the mirror of updateVersion's `$set: { ...patch }`: because that one spreads,
 * `content` must never join SproutPatch (the metadata form has no content input
 * and would blank the prose on every save), and because this one does not
 * spread, a widened caller can never reach `state`, `media` or `source`.
 */
async function writeContent(collection: string, slug: string, patch: ContentPatch): Promise<void> {
  const db = await getDb();
  await db
    .collection(collection)
    .updateOne({ slug }, { $set: { content: patch.content, relations: patch.relations } });
}

export function updateSproutContent(slug: string, patch: ContentPatch): Promise<void> {
  return writeContent("sprouts", slug, patch);
}

export function updatePlantContent(slug: string, patch: ContentPatch): Promise<void> {
  return writeContent("plants", slug, patch);
}

export function updatePodContent(slug: string, patch: ContentPatch): Promise<void> {
  return writeContent("pods", slug, patch);
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `MONGODB_URI="$(grep -m1 '^MONGODB_URI=' .env.local | cut -d= -f2-)" node --import tsx --test lib/content-store.test.ts 2>&1 | tail -6`
Expected: `# pass 2`, `# fail 0`. Without a database: `# skipped 2`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add lib/botanical.ts lib/content-store.test.ts
git commit -m "feat: narrow content writers for sprouts, plants and pods"
```

---

### Task 7: The server actions

**Files:**
- Modify: `app/admin/actions.ts`

No test: the repo has no server-action harness, and the roadmap already logs that as deferred tech
debt. Every piece of logic these actions contain is pure and tested in Tasks 4–6; what is left is
glue.

- [ ] **Step 1: Add the imports**

At the top of `app/admin/actions.ts`, extend the existing imports:

```ts
import { buildContentPatch } from "@/lib/content-edit";
import { PLANT_PREFIX, POD_PREFIX } from "@/lib/data";
```

and add to the existing `@/lib/botanical` import block:

```ts
  updateSproutContent,
  updatePlantContent,
  updatePodContent,
```

- [ ] **Step 2: Add the sprout content action**

```ts
// Prose only. Deliberately separate from editVersionAction: content touches
// neither `state` nor `visibility`, so there is no cascade to run here, and
// keeping it apart is what lets the metadata form stay a zero-JS server-action
// form (spec §2.2).
export async function editContentAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");
  const markdown = String(formData.get("content") ?? "");

  const existing = await getSprout(slug);
  if (!existing) redirect("/admin/vault");

  const result = buildContentPatch(existing, markdown);
  if (!result.ok) {
    redirect(
      `/admin/sprout/${encodeURIComponent(slug)}?error=${encodeURIComponent(
        `could not save content: ${result.error}`,
      )}`,
    );
  }
  // Dirty-gated (spec §2.5): opening a digest and saving it untouched writes
  // nothing at all, so reading can never normalize what a bee wrote.
  if (result.dirty) await updateSproutContent(slug, result.patch);

  revalidatePath("/admin");
  redirect(`/admin/sprout/${encodeURIComponent(slug)}`);
}
```

- [ ] **Step 3: Add the container content action**

```ts
// Plant and pod narrative. One action for both tiers: the ref carries the tier,
// and the two collections differ only in which writer runs.
export async function editContainerContentAction(formData: FormData): Promise<void> {
  await requireSession();
  const ref = String(formData.get("ref") ?? "");
  const markdown = String(formData.get("content") ?? "");

  const isPlant = ref.startsWith(PLANT_PREFIX);
  const isPod = ref.startsWith(POD_PREFIX);
  if (!isPlant && !isPod) redirect("/admin/garden");

  const slug = ref.slice(ref.indexOf(":") + 1);
  const raw = await loadRawGarden();
  const existing = isPlant
    ? raw.plants?.find((p) => p.slug === slug)
    : raw.pods?.find((p) => p.slug === slug);
  if (!existing) redirect("/admin/garden");

  const back = `/admin/${isPlant ? "plant" : "pod"}/${encodeURIComponent(slug)}`;
  const result = buildContentPatch(existing, markdown);
  if (!result.ok) {
    redirect(`${back}?error=${encodeURIComponent(`could not save content: ${result.error}`)}`);
  }
  if (result.dirty) {
    if (isPlant) await updatePlantContent(slug, result.patch);
    else await updatePodContent(slug, result.patch);
  }

  revalidatePath("/admin");
  redirect(back);
}
```

- [ ] **Step 4: Verify the project still type-checks**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add app/admin/actions.ts
git commit -m "feat: editContentAction and editContainerContentAction"
```

---

### Task 8: Node views

The entity nodes as they look **inside** the editor. Kept out of `lib/entity-markdown.ts` so that
file stays React-free and the conformance test can load it headlessly.

The entity list reaches the views through **extension options**, not React context: `.extend()`ing
the node with a closure over the lookup map is stable regardless of how Tiptap portals its node
views into the tree.

**Files:**
- Create: `components/editor/entity-views.tsx`

- [ ] **Step 1: Write the component file**

```tsx
"use client";

import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { EntityCard, EntityMention } from "@/lib/entity-markdown";
import type { EntityOption } from "@/lib/entity-options";
import { Card, CardContent } from "@/components/ui/card";

type Lookup = (ref: string) => EntityOption | null;

function lookupOf(props: NodeViewProps): Lookup {
  return (props.extension.options as { lookup: Lookup }).lookup;
}

/**
 * A block card, as seen while writing. Unresolved refs stay VISIBLE here — in
 * the authoring zone a dangling reference is information, not a leak, which is
 * the same rule components/entity.tsx applies with `showUnresolved`.
 */
function EntityCardView(props: NodeViewProps): React.ReactElement {
  const ref = String(props.node.attrs.ref ?? "");
  const entity = lookupOf(props)(ref);
  return (
    <NodeViewWrapper className="not-prose my-4" data-drag-handle>
      {entity ? (
        <Card>
          <CardContent className="flex flex-col gap-1 py-4">
            <span className="text-sm font-medium">{entity.name}</span>
            {entity.description ? (
              <span className="text-xs text-muted-foreground">{entity.description}</span>
            ) : null}
            <span className="font-heading text-[10px] text-muted-foreground">{entity.ref}</span>
          </CardContent>
        </Card>
      ) : (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          unresolved reference: {ref || "(no ref)"}
        </p>
      )}
    </NodeViewWrapper>
  );
}

/** An inline mention: the author's label, chipped. */
function EntityMentionView(props: NodeViewProps): React.ReactElement {
  const ref = String(props.node.attrs.ref ?? "");
  const label = String(props.node.attrs.label ?? "");
  const entity = lookupOf(props)(ref);
  return (
    <NodeViewWrapper as="span">
      <span
        className={
          entity
            ? "rounded bg-accent px-1 py-0.5 text-accent-foreground"
            : "rounded border border-dashed px-1 py-0.5 text-muted-foreground"
        }
        title={entity ? entity.ref : `unresolved reference: ${ref || "(no ref)"}`}
      >
        {label || entity?.name || ref}
      </span>
    </NodeViewWrapper>
  );
}

/**
 * The editor's entity extensions: the pure nodes from lib/, plus views bound to
 * this page's entity list. Built per editor because the lookup closes over the
 * options the server passed down.
 */
export function entityExtensions(options: EntityOption[]) {
  const byRef = new Map(options.map((o) => [o.ref, o]));
  const lookup: Lookup = (ref) => byRef.get(ref) ?? null;

  return [
    EntityCard.extend({
      addOptions() {
        return { ...this.parent?.(), lookup };
      },
      addNodeView() {
        return ReactNodeViewRenderer(EntityCardView);
      },
    }),
    EntityMention.extend({
      addOptions() {
        return { ...this.parent?.(), lookup };
      },
      addNodeView() {
        return ReactNodeViewRenderer(EntityMentionView);
      },
    }),
  ];
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/editor/entity-views.tsx
git commit -m "feat: entity node views for the editor"
```

---

### Task 9: The suggestion menu

A presentational, keyboard-navigable list positioned from a caret rectangle. Shared by `@` and `/`.

**Files:**
- Create: `components/editor/suggestion-menu.tsx`

- [ ] **Step 1: Write the component file**

```tsx
"use client";

import { cn } from "@/lib/utils";

export interface MenuItem {
  id: string;
  label: string;
  hint?: string;
}

/**
 * Positioned with `position: fixed` from the caret rect that @tiptap/suggestion
 * hands us via `clientRect()` — which is why this needs no floating-ui or
 * popper dependency.
 *
 * onMouseDown (not onClick) with preventDefault: a click would blur the editor
 * before the command ran, and the suggestion range would already be gone.
 */
export function SuggestionMenu({
  items,
  activeIndex,
  rect,
  onPick,
}: {
  items: MenuItem[];
  activeIndex: number;
  rect: DOMRect | null;
  onPick: (index: number) => void;
}) {
  if (!rect || items.length === 0) return null;

  return (
    <div
      role="listbox"
      style={{ position: "fixed", top: rect.bottom + 6, left: rect.left, zIndex: 50 }}
      className="max-h-64 w-72 overflow-y-auto rounded-lg border bg-background p-1 shadow-md"
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(index);
          }}
          className={cn(
            "flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left text-sm",
            index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
          )}
        >
          <span>{item.label}</span>
          {item.hint ? (
            <span className="font-heading text-xs text-muted-foreground">{item.hint}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/editor/suggestion-menu.tsx
git commit -m "feat: keyboard-navigable suggestion menu for the editor"
```

---

### Task 10: The editor island

The client component itself. `@` inserts an inline mention; `/` opens a block menu that also lists
every entity as a **card**, so one menu covers both block types and block references without a
second trigger character or a two-step picker.

**Files:**
- Create: `components/editor/prose-editor.tsx`

- [ ] **Step 1: Write the component file**

```tsx
"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Extension, type Editor, type Range } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { StarterKit } from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import Suggestion from "@tiptap/suggestion";
import type { EntityOption } from "@/lib/entity-options";
import { entityExtensions } from "./entity-views";
import { SuggestionMenu, type MenuItem } from "./suggestion-menu";
import { Button } from "@/components/ui/button";

interface MenuState {
  items: MenuItem[];
  index: number;
  rect: DOMRect | null;
  run: (item: MenuItem) => void;
}

/** A `/` command that is not an entity card. */
const BLOCKS: Array<{ id: string; label: string; run: (e: Editor, r: Range) => void }> = [
  { id: "h2", label: "Heading", run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 2 }).run() },
  { id: "h3", label: "Subheading", run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 3 }).run() },
  { id: "ul", label: "Bullet list", run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { id: "ol", label: "Numbered list", run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { id: "quote", label: "Quote", run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { id: "code", label: "Code block", run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  { id: "table", label: "Table", run: (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run() },
];

const matches = (haystack: string, query: string): boolean =>
  haystack.toLowerCase().includes(query.toLowerCase());

export function ProseEditor({
  initialMarkdown,
  entities,
  action,
  hidden,
}: {
  initialMarkdown: string;
  entities: EntityOption[];
  /** The server action this form posts to. */
  action: (formData: FormData) => Promise<void>;
  /** Identifying fields the action needs, e.g. { slug } or { ref }. */
  hidden: Record<string, string>;
}) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [pending, startTransition] = useTransition();
  // Mirrors `menu` for the keydown handler, which runs outside React's render
  // and would otherwise close over a stale index.
  const menuRef = useRef<MenuState | null>(null);

  const show = (next: MenuState | null): void => {
    menuRef.current = next;
    setMenu(next);
  };

  const extensions = useMemo(() => {
    // One suggestion plugin per trigger character. `render` drives React state;
    // `onKeyDown` returns true to swallow the key from the editor.
    const suggestion = (
      char: string,
      items: (query: string) => MenuItem[],
      run: (editor: Editor, range: Range, item: MenuItem) => void,
    ) =>
      Extension.create({
        name: `suggestion-${char === "@" ? "entity" : "block"}`,
        addProseMirrorPlugins() {
          const editor = this.editor;
          return [
            Suggestion<MenuItem>({
              editor,
              char,
              startOfLine: char === "/",
              items: ({ query }) => items(query),
              command: ({ range, props }) => run(editor, range, props),
              render: () => {
                let range: Range | null = null;
                const open = (props: {
                  items: MenuItem[];
                  clientRect?: (() => DOMRect | null) | null;
                  range: Range;
                }) => {
                  range = props.range;
                  show({
                    items: props.items,
                    index: 0,
                    rect: props.clientRect?.() ?? null,
                    run: (item) => run(editor, range!, item),
                  });
                };
                return {
                  onStart: open,
                  onUpdate: open,
                  onExit: () => show(null),
                  onKeyDown: ({ event }) => {
                    const current = menuRef.current;
                    if (!current || current.items.length === 0) return false;
                    if (event.key === "ArrowDown") {
                      show({ ...current, index: (current.index + 1) % current.items.length });
                      return true;
                    }
                    if (event.key === "ArrowUp") {
                      show({
                        ...current,
                        index: (current.index - 1 + current.items.length) % current.items.length,
                      });
                      return true;
                    }
                    if (event.key === "Enter") {
                      current.run(current.items[current.index]);
                      show(null);
                      return true;
                    }
                    if (event.key === "Escape") {
                      show(null);
                      return true;
                    }
                    return false;
                  },
                };
              },
            }),
          ];
        },
      });

    const entityItems = (query: string): MenuItem[] =>
      entities
        .filter((e) => matches(e.name, query) || matches(e.ref, query))
        .slice(0, 20)
        .map((e) => ({ id: e.ref, label: e.name, hint: e.ref }));

    return [
      StarterKit,
      TableKit,
      Markdown,
      ...entityExtensions(entities),
      // `@` — an inline mention. The label is the entity's name at insertion
      // time; it is authored text from then on, which is why a rename does not
      // rewrite existing prose.
      suggestion("@", entityItems, (editor, range, item) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({
            type: "entityMention",
            attrs: { ref: item.id, label: item.label },
          })
          .run();
      }),
      // `/` — block types AND entity cards in one list, so a block reference
      // needs no second trigger character and no two-step picker.
      suggestion(
        "/",
        (query) => [
          ...BLOCKS.filter((b) => matches(b.label, query)).map((b) => ({ id: b.id, label: b.label })),
          ...entities
            .filter((e) => matches(e.name, query) || matches(e.ref, query))
            .slice(0, 20)
            .map((e) => ({ id: `card:${e.ref}`, label: `Card: ${e.name}`, hint: e.ref })),
        ],
        (editor, range, item) => {
          const block = BLOCKS.find((b) => b.id === item.id);
          if (block) return block.run(editor, range);
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({ type: "entityCard", attrs: { ref: item.id.slice("card:".length) } })
            .run();
        },
      ),
    ];
    // Rebuilt only when the entity list identity changes — the editor is not
    // recreated on every render.
  }, [entities]);

  const editor = useEditor({
    extensions,
    content: initialMarkdown,
    contentType: "markdown",
    immediatelyRender: false, // Next SSR: the editor mounts on the client only.
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none dark:prose-invert min-h-48 focus:outline-none",
      },
    },
  });

  const save = (): void => {
    if (!editor) return;
    const formData = new FormData();
    for (const [key, value] of Object.entries(hidden)) formData.set(key, value);
    // The serialize step (spec §2.3): markdown is what the database stores, and
    // the editor is only ever a surface over it.
    formData.set("content", editor.getMarkdown());
    startTransition(() => {
      void action(formData);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {editor ? (
        <BubbleMenu editor={editor}>
          <div className="flex items-center gap-1 rounded-lg border bg-background p-1 shadow-md">
            <Button type="button" size="sm" variant="ghost" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}>Bold</Button>
            <Button type="button" size="sm" variant="ghost" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}>Italic</Button>
            <Button type="button" size="sm" variant="ghost" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleCode().run(); }}>Code</Button>
            <Button
              type="button" size="sm" variant="ghost"
              onMouseDown={(e) => {
                e.preventDefault();
                const href = window.prompt("Link URL");
                if (href) editor.chain().focus().setLink({ href }).run();
              }}
            >
              Link
            </Button>
          </div>
        </BubbleMenu>
      ) : null}

      <div className="rounded-lg border p-3">
        <EditorContent editor={editor} />
      </div>

      <p className="font-heading text-xs text-muted-foreground">
        Type <strong>@</strong> to mention an entity inline, <strong>/</strong> at the start of a line
        for headings, lists, tables and reference cards. Select text to format it.
      </p>

      <div>
        <Button type="button" onClick={save} disabled={pending || !editor}>
          {pending ? "Saving…" : "Save content"}
        </Button>
      </div>

      <SuggestionMenu
        items={menu?.items ?? []}
        activeIndex={menu?.index ?? 0}
        rect={menu?.rect ?? null}
        onPick={(index) => {
          const current = menuRef.current;
          if (!current) return;
          current.run(current.items[index]);
          show(null);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Guarantee no insertion can create a ref-less node**

Task 2's review established that a ref-less `entityCard` serializes to `""`, which is harmless in a
flat document and **destroys a list** when the node is a list item's only child. Task 2 pinned that
behaviour with tests; this task is what makes it unreachable. Both insert paths above take `item.id`
from the picker, so a ref is always present — add the guard anyway, because the cost is one line and
the failure is silent data loss:

```ts
// In the `@` handler, before insertContent:
if (!item.id) return;
// In the `/` handler's card branch, before insertContent:
const ref = item.id.slice("card:".length);
if (!ref) return;
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: no output. If `BubbleMenu` cannot be found, confirm the subpath: in Tiptap 3 it is
`@tiptap/react/menus`, **not** `@tiptap/react`.

- [ ] **Step 4: Verify the app builds**

Run: `npm run build 2>&1 | tail -20`
Expected: `Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add components/editor/prose-editor.tsx
git commit -m "feat: the prose editor island — bubble menu, @ mentions, / blocks"
```

---

### Task 11: The content card, and the sprout page

One server wrapper, used by all three pages.

**Files:**
- Create: `app/admin/_components/content-card.tsx`
- Modify: `app/admin/sprout/[slug]/page.tsx`

- [ ] **Step 1: Write the wrapper**

```tsx
import { textPart, type RawGarden, type Text } from "@/lib/data";
import { entityOptions } from "@/lib/entity-options";
import { ProseEditor } from "@/components/editor/prose-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The editor in its card. Server component: it builds the entity list from the
 * raw garden the page already loaded and hands it down as a prop, which is why
 * there is no /api/admin/entities endpoint (spec §2.7).
 *
 * `textPart(content, "en")` is STRICT on purpose — resolveText's fallback would
 * load the `fr` half into the editor and save it back as `en`, corrupting the
 * data exactly the way the name/description prefills already warn about.
 */
export function ContentCard({
  raw,
  content,
  selfRef,
  action,
  hidden,
}: {
  raw: RawGarden;
  content?: Text;
  /** This entity's own ref, so the picker cannot offer it to itself. */
  selfRef: string;
  action: (formData: FormData) => Promise<void>;
  hidden: Record<string, string>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base tracking-tight">Content</CardTitle>
      </CardHeader>
      <CardContent>
        <ProseEditor
          initialMarkdown={textPart(content, "en")}
          entities={entityOptions(raw, selfRef)}
          action={action}
          hidden={hidden}
        />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Rewire the sprout page's data loading**

In `app/admin/sprout/[slug]/page.tsx`, replace the `getFullDataset` import and call so the page gets
**both** the raw garden and the dataset from one read:

```ts
// was: import { getFullDataset } from "@/lib/store";
import { loadRawGarden } from "@/lib/store";
import { buildDataset } from "@/lib/data";
```

```ts
// was: const dataset = await getFullDataset();
const raw = await loadRawGarden();
const dataset = buildDataset(raw);
```

`getFullDataset()` is literally `buildDataset(await loadRawGarden())`, so this is the same single
round trip — it just keeps the raw garden the entity picker needs.

- [ ] **Step 3: Add the editor card and demote the source view**

Add the imports:

```ts
import { ContentCard } from "../../_components/content-card";
import { editContentAction } from "../../actions";
```

Insert the content card immediately after the Preview card, and **replace** the existing `<pre>`
card (the one whose `CardTitle` reads "Content") with a collapsed source view:

```tsx
<ContentCard
  raw={raw}
  content={version.content}
  selfRef={`sprout:${version.slug}`}
  action={editContentAction}
  hidden={{ slug: version.slug }}
/>

{content ? (
  <Card>
    <CardContent>
      {/* Read-only, zero JS, collapsed. The editor is the authoring surface;
          this stays as the diagnostic for when the two markdown parsers
          disagree (spec §5). */}
      <details>
        <summary className="cursor-pointer font-heading text-sm text-muted-foreground">
          Source
        </summary>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 font-heading text-xs whitespace-pre-wrap">
          {content}
        </pre>
      </details>
    </CardContent>
  </Card>
) : null}
```

Note the card is now rendered **unconditionally** — a sprout with no content yet is precisely the one
you need an editor for. Only the source `<details>` stays behind the `content` guard.

- [ ] **Step 4: Verify the build**

Run: `npm run build 2>&1 | tail -15`
Expected: `Compiled successfully`.

- [ ] **Step 5: Verify by hand**

Run `npm run dev`, open `/admin/sprout/<any digest slug>`, and confirm: the prose renders in the
editor, `@` opens the entity list, `/` opens the block list, Save returns to the page with the text
intact, and the metadata form below still saves independently.

- [ ] **Step 6: Commit**

```bash
git add app/admin/_components/content-card.tsx "app/admin/sprout/[slug]/page.tsx"
git commit -m "feat: the sprout page can edit its prose"
```

---

### Task 12: The container pages

`Plant.content` and `Pod.content` get their first admin door — the Track A debt the article-door spec
§7 logged.

**Files:**
- Create: `app/admin/plant/[slug]/page.tsx`
- Create: `app/admin/pod/[slug]/page.tsx`

- [ ] **Step 1: Write the plant page**

```tsx
import { notFound } from "next/navigation";
import { buildDataset, resolveText } from "@/lib/data";
import { loadRawGarden } from "@/lib/store";
import { editContainerContentAction } from "../../actions";
import { AdminBar } from "../../_components/admin-bar";
import { ContentCard } from "../../_components/content-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminPlantPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;

  const raw = await loadRawGarden();
  const plant = raw.plants?.find((p) => p.slug === slug);
  if (!plant) notFound();

  const dataset = buildDataset(raw);
  const pods = dataset.podsForPlant(slug);
  const beans = dataset.beansForPlant(slug);

  return (
    <article>
      <AdminBar current="/admin/garden" />

      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <a
            href="/admin/garden"
            className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            ← garden
          </a>
          <h1 className="font-heading text-2xl font-medium tracking-tight">
            {resolveText(plant.name)}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">plant:{plant.slug}</Badge>
            <Badge variant={plant.visibility === "public" ? "default" : "secondary"}>
              {plant.visibility ?? "public"}
            </Badge>
          </div>
          {resolveText(plant.description ?? "").trim() ? (
            <p className="text-sm text-muted-foreground">{resolveText(plant.description)}</p>
          ) : null}
        </div>

        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <ContentCard
          raw={raw}
          content={plant.content}
          selfRef={`plant:${plant.slug}`}
          action={editContainerContentAction}
          hidden={{ ref: `plant:${plant.slug}` }}
        />

        {/* Mechanical: an index has no argument to make, so it takes no
            authoring (umbrella §9). */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base tracking-tight">Inside</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm">
              {pods.map((pod) => (
                <li key={pod.slug}>
                  <a href={`/admin/pod/${pod.slug}`} className="underline-offset-4 hover:underline">
                    {resolveText(pod.name)}
                  </a>{" "}
                  <span className="font-heading text-xs text-muted-foreground">pod:{pod.slug}</span>
                </li>
              ))}
              {beans.map((bean) => (
                <li key={bean.slug}>
                  <a href={`/admin/bean/${bean.slug}`} className="underline-offset-4 hover:underline">
                    {resolveText(bean.name)}
                  </a>{" "}
                  <span className="font-heading text-xs text-muted-foreground">bean:{bean.slug}</span>
                </li>
              ))}
              {pods.length === 0 && beans.length === 0 ? (
                <li className="text-muted-foreground">nothing yet</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Write the pod page**

Identical in shape. Four differences: it reads `raw.pods`, its ref prefix is `pod:`, its children come
from `dataset.beansForPod(slug)` only (a pod contains no pods), and its back link stays `/admin/garden`.

```tsx
import { notFound } from "next/navigation";
import { buildDataset, resolveText } from "@/lib/data";
import { loadRawGarden } from "@/lib/store";
import { editContainerContentAction } from "../../actions";
import { AdminBar } from "../../_components/admin-bar";
import { ContentCard } from "../../_components/content-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminPodPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;

  const raw = await loadRawGarden();
  const pod = raw.pods?.find((p) => p.slug === slug);
  if (!pod) notFound();

  const beans = buildDataset(raw).beansForPod(slug);

  return (
    <article>
      <AdminBar current="/admin/garden" />

      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <a
            href="/admin/garden"
            className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            ← garden
          </a>
          <h1 className="font-heading text-2xl font-medium tracking-tight">
            {resolveText(pod.name)}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">pod:{pod.slug}</Badge>
            <Badge variant={pod.visibility === "public" ? "default" : "secondary"}>
              {pod.visibility ?? "public"}
            </Badge>
          </div>
          {resolveText(pod.description ?? "").trim() ? (
            <p className="text-sm text-muted-foreground">{resolveText(pod.description)}</p>
          ) : null}
        </div>

        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <ContentCard
          raw={raw}
          content={pod.content}
          selfRef={`pod:${pod.slug}`}
          action={editContainerContentAction}
          hidden={{ ref: `pod:${pod.slug}` }}
        />

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base tracking-tight">Inside</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm">
              {beans.map((bean) => (
                <li key={bean.slug}>
                  <a href={`/admin/bean/${bean.slug}`} className="underline-offset-4 hover:underline">
                    {resolveText(bean.name)}
                  </a>{" "}
                  <span className="font-heading text-xs text-muted-foreground">bean:{bean.slug}</span>
                </li>
              ))}
              {beans.length === 0 ? <li className="text-muted-foreground">nothing yet</li> : null}
            </ul>
          </CardContent>
        </Card>
      </div>
    </article>
  );
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build 2>&1 | tail -15`
Expected: `Compiled successfully`, and the route list includes `/admin/plant/[slug]` and
`/admin/pod/[slug]`.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/plant/[slug]/page.tsx" "app/admin/pod/[slug]/page.tsx"
git commit -m "feat: admin pages for plant and pod narrative"
```

---

### Task 13: The garden index

**Files:**
- Create: `app/admin/garden/page.tsx`
- Modify: `app/admin/_components/admin-bar.tsx`

- [ ] **Step 1: Write the index page**

```tsx
import { resolveText, textPart } from "@/lib/data";
import { loadRawGarden } from "@/lib/store";
import { AdminBar } from "../_components/admin-bar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

/**
 * Plants and pods, the two tiers that hold narrative. Mechanical — the vault
 * stays sprout-centric, and this is the only way to reach a container page
 * without typing its URL.
 */
export default async function AdminGardenPage() {
  const raw = await loadRawGarden();

  const rows = [
    ...(raw.plants ?? []).map((p) => ({
      tier: "plant" as const,
      slug: p.slug,
      name: resolveText(p.name),
      visibility: p.visibility ?? "public",
      hasNarrative: textPart(p.content, "en").trim().length > 0,
      href: `/admin/plant/${p.slug}`,
    })),
    ...(raw.pods ?? []).map((p) => ({
      tier: "pod" as const,
      slug: p.slug,
      name: resolveText(p.name),
      visibility: p.visibility ?? "public",
      hasNarrative: textPart(p.content, "en").trim().length > 0,
      href: `/admin/pod/${p.slug}`,
    })),
  ].sort((a, b) => a.tier.localeCompare(b.tier) || a.name.localeCompare(b.name));

  return (
    <article>
      <AdminBar current="/admin/garden" />

      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-2xl font-medium tracking-tight">Garden</h1>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>name</TableHead>
              <TableHead>tier</TableHead>
              <TableHead>visibility</TableHead>
              <TableHead>narrative</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.tier}:${row.slug}`}>
                <TableCell>
                  <a href={row.href} className="underline-offset-4 hover:underline">
                    {row.name}
                  </a>
                  <span className="ml-2 font-heading text-xs text-muted-foreground">{row.slug}</span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{row.tier}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.visibility}</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.hasNarrative ? "yes" : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Add the nav link**

In `app/admin/_components/admin-bar.tsx`, add one entry to `LINKS`, after Vault:

```ts
const LINKS = [
  { href: "/admin", label: "Inbox" },
  { href: "/admin/vault", label: "Vault" },
  { href: "/admin/garden", label: "Garden" },
  { href: "/admin/beanstalk", label: "Beanstalk" },
];
```

- [ ] **Step 3: Verify the build**

Run: `npm run build 2>&1 | tail -15`
Expected: `Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add app/admin/garden/page.tsx app/admin/_components/admin-bar.tsx
git commit -m "feat: /admin/garden — the plants and pods index"
```

---

### Task 14: The documentation the code now contradicts

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/ROADMAP.md`

- [ ] **Step 1: Scope the zero-client-JS rule in `CLAUDE.md`**

Replace the bullet beginning **"The admin forms stay zero-client-JS"** with these two:

```markdown
- **The admin's *metadata* forms stay zero-client-JS**: they post to server actions and must
  work without script. Use the styled *native* controls in
  `components/ui/native-controls.tsx` (`NativeSelect`, `NativeRadio`,
  `NativeCheckbox`) rather than the Base UI Select/RadioGroup/Checkbox
  composites, which submit through a script-populated hidden input.
- **The prose editor is the one deliberate exception** (`components/editor/`, slice 5). The
  content forms on `/admin/sprout/[slug]`, `/admin/plant/[slug]` and `/admin/pod/[slug]` are
  client components and do not work without script. They still invoke the same server actions,
  and they are separate forms from the metadata ones on the same page — which is what keeps the
  exception contained. Widening it to any other form is a decision, not a convenience.
```

- [ ] **Step 2: Update the roadmap**

In `docs/superpowers/ROADMAP.md`, add a row to the **Shipped** table:

```markdown
| **Slice 5 — Tiptap editor** | #?? | The admin learns to write. `Sprout.content`, `Plant.content` and `Pod.content` get their first authoring surface: a Tiptap island over markdown with `@` entity mentions, `/` blocks and reference cards, in its own form and its own action so the metadata forms stay zero-JS. New `/admin/plant/[slug]`, `/admin/pod/[slug]` and `/admin/garden`. A cross-parser conformance test pins `marked` (editor) against `remark` (site); it found and fixed a slice-3 bug where a ref-less directive rendered as a bare `<div>` inside a `<p>`. Spec `2026-08-23-tiptap-editor-design.md`. |
```

And in **Track B / B3**, append to the slice-4 status paragraph:

```markdown
    Slice 5 (Tiptap) closed the authoring gap on 2026-08-23: Track A's container-narrative debt —
    "correcting a published narrative means re-privatizing the container or editing the database" —
    is paid, and revising a sprout's prose no longer requires a re-post through `/api/articles`.
    Container name/description/visibility editing remains open.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/superpowers/ROADMAP.md
git commit -m "docs: scope the zero-client-JS rule; roadmap for slice 5"
```

---

## Final verification

- [ ] **Run the whole suite**

Run: `npm test 2>&1 | tail -8`
Expected: `# fail 0`. Every pre-existing test still passes — in particular `lib/markdown.test.ts` and
`lib/entity-refs.test.ts`, which Task 3 touched the pipeline underneath.

- [ ] **Build**

Run: `npm run build 2>&1 | tail -15`
Expected: `Compiled successfully`.

- [ ] **Type-check**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Walk the spec §9 acceptance list by hand** (`npm run dev`)

1. A weekly digest opens in the editor at `/admin/sprout/<digest-slug>`, edits, saves, and reads
   correctly on its bean page.
2. **Open a digest and save without typing → nothing is written.** Verify in Mongo that
   `content` is byte-identical, or add a temporary log in `editContentAction`. This is the
   dirty-gate (spec §2.5) and it is the one behaviour no test in this plan covers end to end.
3. `@` inserts an inline mention; reload and confirm it survives as
   `:entity[…]{ref=…}` in the Source `<details>`.
4. `/` inserts a card; reload and confirm `::entity{ref=…}` in the Source view.
5. Both appear in `/api/graph` as `mentions` / `embeds` edges, and any hand-authored relation on
   that document is still there.
6. `/admin/plant/paulopus` edits the narrative the article door posted, and the change is live on
   `/plant/paulopus`.
7. A sprout's `state`, `media` and `source` are unchanged by a content save.
8. **The metadata form still saves with JavaScript disabled** (DevTools → Settings → Debugger →
   Disable JavaScript). The content editor will be inert — that is the documented exception.

- [ ] **Open the PR**

The PR body **must** carry a Lab Note (`CLAUDE.md`) — this is a change a user notices.

```yaml
en:
  title: Write and edit your words, right in Ariko
  summary: Ariko finally has a proper writing surface. Articles, project stories and weekly digests can all be written and revised in place — mention another piece of work with @, drop in a reference card with /, and see it laid out as you type.
fr:
  title: Écris et retouche tes textes directement dans Ariko
  summary: Ariko a enfin un vrai espace d'écriture. Articles, récits de projet et digests hebdo se rédigent et se corrigent sur place — mentionne un autre travail avec @, glisse une carte de référence avec /, et vois la mise en page se faire au fil de la frappe.
suggested:
  molecule: ariko
  type: feature
  tags: [changelog]
```

---

## Deferred to later specs / follow-ups

- **Bilingual content authoring.** `content` is the only `Text` field with no `fr` box. The editor
  preserves a stored `fr` half but cannot edit it (spec §2.9).
- **Container name / description / visibility editing** — Track A. Flipping a container's visibility
  by hand is cascade-adjacent and deserves its own slice.
- **Image and media insertion** — roadmap B2, which is what creates the first `MediaImage`.
- **Syntax highlighting in code fences** — the open half of B3. `sanitizeSchema` already admits
  `className` on `code` restricted to `language-*`.
- **Autosave, revision history, collaborative editing** — not needed at single-author scale.
- **A server-action test harness** — still the roadmap's deferred item; Task 7 ships untested glue
  over tested pure functions, consistent with `editVersionAction` before it.
- **The known parser divergence** on malformed inline directives (Task 3). Asserted, narrow, and
  unreachable from the editor; revisit only if `/api/articles` starts receiving such input.
- **A card inside a blockquote mints no graph edge.** `> ::entity{ref=…}` renders as a card in both
  remark and the editor, but `extractRefs`'s `BLOCK` is anchored to line start and does not see
  through the `> ` prefix. Pre-existing, unreachable from the editor (which never nests a card in a
  quote), and left out of the fixture table deliberately. *(Task 2 review.)*
- **A bracketed label on a block card diverges.** `::entity[[L]]{ref=bean:x}` renders as a card in
  remark but is literal text to the editor, which re-serializes it escaped — so opening and saving
  such a document mangles a valid card. One bracket deeper than the labeled-block case Task 2 fixed,
  and not reachable from the editor or from any payload the article door has sent. *(Task 2 review.)*
- **A quoted ref keeps its quotes.** `::entity{ref="bean:x"}` yields the ref `"bean:x"` including the
  quotes, in both the tokenizer and `extractRefs`, while remark strips them. Hand-authored input only
  — the picker cannot produce it. *(Task 2 review.)*
- **Marks around an inline mention are dropped**, and a card inside a loose list item makes the list
  tight. Both are upstream in `@tiptap/markdown`'s serializer, pinned by a test in
  `lib/entity-markdown.test.ts` rather than worked around. *(Task 2 review.)*
- **`@tiptap/markdown` version drift.** Its peer dependencies pin `@tiptap/core` and `@tiptap/pm` to
  an exact version, so upgrading any Tiptap package means upgrading all of them and re-running
  `lib/markdown-conformance.test.ts` — which is the test that would catch a serializer change.
