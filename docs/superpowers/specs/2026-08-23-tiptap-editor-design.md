# Slice 5 — Tiptap: the admin learns to write

**Date:** 2026-08-23
**Umbrella:** [`2026-08-22-content-composition-design.md`](2026-08-22-content-composition-design.md) — decision 10 deferred Tiptap out of that umbrella and named it "the slice that follows". This is it.
**Status:** Approved design, ready for a plan.

---

## 1. Problem

**The admin cannot author prose.** Four slices of content work shipped a renderer, a description
field, a composition grammar and a machine door — and none of them gave the human a place to type.

Concretely:

- **`Sprout.content` has no admin write path.** `SproutPatch` (`lib/sprout-edit.ts:6`) carries
  `name`/`type`/`date`/`description`/`state` and nothing else. `/admin/sprout/[slug]` renders
  content twice — as a rendered preview and as a `<pre>` source dump
  (`app/admin/sprout/[slug]/page.tsx:75` and `:95`) — both read-only.
- **`Plant.content` / `Pod.content` have no admin page at all.** There is no `/admin/plant/[slug]`
  and no `/admin/pod/[slug]`; `app/admin` holds routes for beans, sprouts, triage, vault and
  beanstalk only. The article-door spec §7 logged this as open Track A debt: *"correcting a
  published narrative means re-privatizing the container or editing the database."*

So content reaches the vault through exactly two doors, both of which write and then let go:
`/api/inbox` + triage promote (a capture's body, carried verbatim), and `POST /api/articles` (which
§2.3 of its own spec forbids from publishing). **Neither can revise.** Fixing a typo in a live
article means re-privatizing its container and re-posting the batch, or editing Mongo by hand.

Slice 1 opened the drawer the weekly-digest bee writes into. This slice puts a pen in it.

## 2. Decisions

1. **Rich-only, client-submitted.** The prose forms require client JS and do not work without
   script. This retires `CLAUDE.md`'s zero-client-JS rule **for those forms only**.

   Umbrella decision 10 said the constraint *"gets retired deliberately, by progressive enhancement
   over a `<textarea>` — not as a side effect of this work."* This slice honours the intent — the
   retirement is deliberate, named, scoped and documented in the same PR — and **reverses the
   mechanism**. Mirroring a serialized document into a hidden textarea on every keystroke is a
   well-known source of stale-value bugs, and it buys a script-off fallback for a field whose only
   other authors are machines. Recorded here as a reversal so the next reader does not mistake it
   for drift.

   The cost this does **not** carry: no new endpoint. A client component invokes a server action
   directly with a `FormData` it builds. Same action, same `requireSession()`, same validation.

2. **Content is its own form and its own action** — not a widening of the existing edit form.

   This is forced, not stylistic. `updateVersion` writes `$set: { ...patch }`
   (`lib/botanical.ts:123-126`), and its own comment states it "never touches … content". Adding
   `content` to `SproutPatch` would make the metadata form — which has no content input — **blank
   the content on every save**. A narrow content writer is a correctness requirement.

   It also keeps the blast radius of client JS to exactly the prose field: the metadata form stays
   a zero-JS server-action form with its native controls intact.

3. **`@tiptap/markdown` 3.30.2 (official) for parse and serialize.**

   The render spec §2.1 named the community `tiptap-markdown` and accepted "one `markdown-it` rule"
   as the cost of the entity grammar. That premise is obsolete. Verified 2026-08-23:

   | Package | Version | Last published |
   |---|---|---|
   | `@tiptap/react` / `@tiptap/pm` / `@tiptap/starter-kit` | 3.30.2 | 2026-08-18 |
   | **`@tiptap/markdown`** (first-party, 65 releases since 2025-10) | **3.30.2** | **2026-08-18** |
   | `tiptap-markdown` (community, single maintainer) | 0.9.0 | **2025-09-08** |

   `tiptap-markdown` does declare a `@tiptap/core: ^3.0.1` peer, so it *works* — but it is eleven
   months stale and has been superseded by an official package covering the same ground. Choosing it
   would honour a spec sentence at the price of adopting the abandoned option.

   `@tiptap/markdown` parses with `marked` 17 and exposes exactly the hook a custom syntax needs:
   `MarkdownManager.registerExtension` reads **`markdownName`, `markdownTokenizer`, `parseMarkdown`
   and `renderMarkdown`** off an extension's own config. The entity node is a first-class citizen,
   not a patched library.

4. **Two node types, one grammar.** Block and inline are structurally different in ProseMirror, so
   the schema gets `entityCard` (block atom) and `entityMention` (inline atom). Both carry a single
   `ref` attribute. Compose §2.2's actual point stands unchanged: the generic `::entity{ref=…}`
   means **one ref vocabulary**, so there is no `plantCard`/`podCard`/`beanCard` proliferation —
   which is what "one Tiptap node type rather than four" was arguing against.

5. **Normalization on edit is accepted; a no-op save writes nothing.** Markdown is the format, not
   the byte string (umbrella §9, format sovereignty). A round trip through the editor may reflow
   `*`→`_`, re-pad a table, or re-wrap a paragraph. That is acceptable for a *changed* document and
   unacceptable for an *unchanged* one, so saves are **dirty-gated**: if the serialized markdown is
   identical to what was loaded, the write is skipped entirely. Opening a bee-written digest to read
   it can never rewrite it.

6. **The picker offers plants, pods and beans — never sprouts, never the entity being edited.**
   `resolveEntity` returns `null` for `sprout:` refs by design (compose §4: no public sprout URL
   exists, and a card that cannot link anywhere is worse than no card), so offering sprouts would
   mint references that can never render. Self-reference is excluded as noise.

7. **The entity list travels as a prop**, from the server page that already calls `getFullDataset()`
   (`app/admin/sprout/[slug]/page.tsx:41`). No `/api/admin/entities` endpoint: `middleware.ts`
   matches `/admin/:path*` only, so an API route would need its own auth for no gain at
   personal-portfolio scale. `/api/graph` is the wrong source — it is the public projection and
   could not offer a draft.

8. **Both insertion affordances ship.** `@` opens the mention menu and inserts an inline
   `:entity[Name]{ref=…}`; the `/` block menu inserts a `::entity{ref=…}` card. The acceptance
   payload is 10 inline mentions and 8 block cards, and compose §2.4 already distinguishes
   `mentions` from `embeds` for exactly this reason.

9. **Bilingual content is preserved, never edited.** `content` is `Text`, and unlike `name` and
   `description` it has no paired fr box — this slice does not add one. The editor works on the
   `en` half (or the plain string). If a stored value is `{ en, fr }`, the `fr` half is written back
   **untouched**. The rule has to be non-destructive rather than absent.

10. **Mirroring passes the existing relations.** `lib/articles-store.ts` writes
    `mergeMirrored(undefined, extractRefs(…))` at `:128` and `:174`. Passing `undefined` discards
    every hand-authored relation — defensible for a door that only ever writes unreviewed sprouts,
    and **silently destructive on an edit path**, where it would delete G2 edges on every prose save.
    The admin writer passes the document's current `relations[]`.

11. **Bubble menu, `/` and `@` — no fixed toolbar.** Selecting text raises formatting; `/` on an
    empty line opens the block menu (heading, list, quote, code fence, table, entity card); `@`
    opens the entity menu. The writing surface stays clear, and no toolbar has to be designed in a
    zone whose artistic direction is deliberately unset (D1). Discoverability rests on a one-line
    hint beneath the editor, which is proportionate for a single-author admin.

## 3. Architecture

| Unit | Kind | Responsibility |
|---|---|---|
| `lib/content-edit.ts` | **pure** | `buildContentPatch(current, markdown)` → `{ content, relations, dirty }`, where `current` is the stored document's `{ content?: Text; relations?: Relation[] }` — the same shape for a sprout, a plant and a pod, which is why one function serves all three. Enforces the 64 KiB ceiling (the article door's, §4 there). Preserves the untouched `fr` half (§2.9). Calls `mergeMirrored(current.relations, extractRefs(md))` (§2.10). Reports `dirty` (§2.5). |
| `components/editor/entity-node.ts` | client | The two nodes (§2.4): `markdownTokenizer` + `parseMarkdown` + `renderMarkdown` for both directive forms, plus their node views. A ref-less directive mints **nothing**, mirroring `remarkEntity`'s existing rule (`lib/markdown.ts:34`). |
| `components/editor/markdown-config.ts` | isomorphic | The extension list, exported so the conformance test drives the same schema the editor does. |
| `components/editor/prose-editor.tsx` | client | The island: editor instance, bubble menu, `/` menu, `@` menu, Save. Takes `initialMarkdown` and the entity list as props. |
| `lib/botanical.ts` | glue | `updateSproutContent` / `updatePlantContent` / `updatePodContent` — narrow `$set` on `content` + `relations` only (§2.2). |
| `app/admin/actions.ts` | glue | `editContentAction`, `editContainerContentAction`. `requireSession()`, then validate, then write. **No cascade**: content touches neither `state` nor `visibility`, which is precisely why it earns its own action. `revalidatePath("/admin")` then redirect, per the house pattern; the public pages are `force-dynamic` and need no revalidation. |

**Data flow, one save:**

```
server page ──getFullDataset()──▶ entity list ─┐
                                               ├─▶ <ProseEditor> ──serialize()──▶ markdown
stored content ────resolveText()──────────────┘                                      │
                                                                                     ▼
                                                        editContentAction(FormData) ──▶
                                          buildContentPatch(current, markdown)  [pure]
                                                                │
                                          dirty? ──no──▶ redirect, no write
                                                │yes
                                                ▼
                                          updateSproutContent(slug, patch)
```

The graph is untouched by all of this: it reads stored `relations[]`, exactly as compose §2.5
requires.

## 4. The entity node

The grammar is fixed by compose §2.2 and is not reopened: `::entity{ref=bean:slug}` as a block,
`:entity[label]{ref=bean:slug}` inline.

**Serialization** (`renderMarkdown`):
- `entityCard` → `::entity{ref=<ref>}`, alone on its line.
- `entityMention` → `:entity[<label>]{ref=<ref>}`, where `label` is the node's text content.

**Parsing** (`markdownTokenizer` + `parseMarkdown`): one `marked` tokenizer recognising both forms.
It must match `remarkEntity`'s tolerances — up to three leading spaces for the block form (four is
an indented code block), and a directive with a missing or blank `ref` produces no node at all.

**Node views.** `entityCard` renders the resolved name and description in a card echoing the
reader's `EntityCard`; `entityMention` renders the label as a chip. **An unresolved ref renders
visibly as `unresolved reference: <ref>`** in both — the admin's existing `showUnresolved`
behaviour (`components/entity.tsx:19-24`), because in the authoring zone a dangling ref is
information, not a leak (compose §2.3).

## 5. Pages

**`/admin/sprout/[slug]`** — the card order becomes:

1. **Preview** *(kept)* — renders through the **real remark pipeline**, so it is the by-eye check
   that the editor and the site agree.
2. **Content** *(new)* — the editor and its own Save.
3. **Source** *(demoted)* — today's `<pre>` inside a collapsed `<details>`. Read-only, zero JS, zero
   design cost, and the only diagnostic when the two parsers disagree. A deliberate softening of
   "rich-only": what was rejected was an *editable* source mode inside the editor, not the existing
   read-only dump.
4. **Metadata form** *(unchanged)* — server action, native controls, works without script.
5. **Danger zone** *(unchanged)*.

**`/admin/plant/[slug]` and `/admin/pod/[slug]`** — new, sharing one component. A read-only header
(name, visibility, and a mechanical index of the container's children) plus the editor card. Nothing
else is editable here; container name/description/visibility remain Track A.

**`/admin/garden`, a plants-and-pods index** — a new "Garden" entry in `AdminBar`'s `LINKS`
(`app/admin/_components/admin-bar.tsx:5-9`). It lists every plant and pod with its visibility and a
link to its page, and it is mechanical: an aggregation with no argument to make, so it takes no
authoring (umbrella §9). Without it these pages inherit the discoverability bug the roadmap already
logs against parentless sprouts (*"must be typed by hand"*), on the tier that holds the longest prose
in the vault. The name is deliberate: `/admin/vault` is sprout-centric and stays that way.

## 6. Round-trip fidelity — the risk section

**The editor parses with `marked`; the public page renders with `remark`.** Two grammars over one
format is the central risk of this slice: any disagreement means what you see while writing is not
what ships. The render spec accepted this duplication in principle (§2.1); this slice makes it
*testable* rather than merely accepted.

**`lib/markdown-conformance.test.ts`** — fixtures across the feature floor (headings, emphasis,
links, lists, blockquotes, inline code, fenced code **with a language**, tables) plus both entity
forms, asserting:

```
render(md)  ≡  render(serialize(parse(md)))
```

where `render` is the **real remark pipeline** from `lib/markdown.ts`, and `≡` compares **HTML, not
markdown**. Comparing markdown would fail on harmless normalization (§2.5) and would be a test about
formatting rather than meaning; comparing rendered HTML fails only when the meaning moved.

This requires `remark-parse`, `remark-rehype` and `rehype-stringify` promoted to declared
devDependencies — already present transitively under `react-markdown`, but depended on directly by
the test.

**The spike, and it is task one of the plan.** `MarkdownManager` must construct, parse and serialize
under plain `node --test` with **no DOM**. Its constructor takes `{ extensions }` and its
`parse`/`serialize` work on `JSONContent`, so this should hold — but node views reference React, and
if the manager cannot be built headlessly then the conformance test cannot exist, and the conformance
test is the entire reason decision 3 is safe. **If the spike fails, the remark-bridge option
(`@handlewithcare/remark-prosemirror` + `mdast-util-to-markdown`, one grammar in the repo) returns to
the table and this spec is amended before any further work.**

## 7. Testing

Per the house rule — pure logic unit-tested with no DB, glue smoke-tested:

- **`lib/content-edit.test.ts`** *(pure)* — the 64 KiB ceiling; a `{ en, fr }` value keeps its `fr`
  half; a plain string stays a plain string; `embeds`/`mentions` mirror from both directive forms;
  **hand-authored relation kinds survive a save** (the §2.10 regression); `dirty` is false for an
  unchanged document.
- **`lib/entity-markdown.test.ts`** *(pure)* — the tokenizer and serializer for both forms; a
  ref-less directive mints nothing; up-to-three-space indentation matches, four does not; a card
  round-trips to byte-identical markdown.
- **`lib/markdown-conformance.test.ts`** *(pure)* — §6's matrix.
- **DB-backed, auto-skipping without `MONGODB_URI`** — the three content writers touch `content` and
  `relations` and **nothing else** (asserted against a sprout whose `state`, `media` and `source`
  must survive).
- **No browser/interaction harness.** None exists in the repo, and this slice is not where that gets
  invented. The editor's interactive behaviour is verified by hand against §9's acceptance list.

## 8. Documentation deliverables

Both land in the implementation PR, not afterwards:

- **`CLAUDE.md` amended.** The bullet currently reading *"The admin forms stay zero-client-JS"*
  becomes scoped, plus a named exception:

  > - **The admin's *metadata* forms stay zero-client-JS**: they post to server actions and must work
  >   without script. Use the styled *native* controls in `components/ui/native-controls.tsx` …
  > - **The prose editor is the one deliberate exception** (`components/editor/`, slice 5): the
  >   content forms on `/admin/sprout/[slug]`, `/admin/plant/[slug]` and `/admin/pod/[slug]` require
  >   client JS and do not work without script. They still invoke the same server actions. Widening
  >   this exception to any other form is a decision, not a convenience.

  Left unamended, the next agent follows a rule the code no longer obeys.
- **`docs/superpowers/ROADMAP.md`** — slice 5 into Shipped; the Track A container-narrative debt and
  the article-door §7 note closed; the roadmap's stale "no CSS / no client JS" framing corrected.

## 9. Acceptance

- A weekly digest opens in the editor, is edited, saves, and reads correctly on its bean page.
- Opening a digest and saving without typing writes **nothing** (§2.5).
- `@` inserts an inline mention that survives a save→reload as `:entity[…]{ref=…}`; `/` inserts a
  card that survives as `::entity{ref=…}`.
- Both appear in `/api/graph` as `mentions` / `embeds` edges, with any hand-authored relation kind on
  the same document still present.
- `/admin/plant/paulopus` edits the narrative posted by the article door, and the change is live on
  `/plant/paulopus`.
- A sprout's `state`, `media` and `source` are unchanged by a content save.
- The metadata form still saves with JavaScript disabled.

## 10. Out of scope, seams reserved

- **Bilingual content authoring** — an fr box for `content`. §2.9 keeps the data safe until it lands.
- **Container name / description / visibility editing** — Track A. Flipping a container's visibility
  by hand is cascade-adjacent and deserves its own thought.
- **Image and media insertion** — roadmap B2, which is what creates the first `MediaImage`.
- **Syntax highlighting in code fences** — the open half of B3. The sanitize schema already admits
  `className` on `code` restricted to `language-*`, which is the hook.
- **Autosave, revision history, collaborative editing** — none is needed at single-author scale.
- **A public `/sprout/[slug]`** — until it exists, §2.6 keeps sprouts out of the picker.
- **Retiring the public bean page's property dump** — still the exhibition slice (D1).
