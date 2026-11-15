import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";
import { visitParents } from "unist-util-visit-parents";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import type { PluggableList } from "unified";
import { FRAMES, SIZES, isStagedBlock } from "./staging";
import { parseStagedBlock, type MdNode, type ParsedBlock, type Phrase, type StagedImage } from "./staging-parse";

// The one place the markdown pipeline is configured (spec §3). Exported as
// arrays rather than a configured component so slice 3 can append the entity
// directive without forking a second pipeline — and so the tests can drive the
// exact chain the app renders.

// The directive's shape, kept local: mdast-util-directive's node types arrive
// through declaration merging, and depending on them here would couple this file
// to a transitive dependency's type exports.
interface DirectiveNode {
  type: string;
  name?: string;
  children?: unknown[];
  attributes?: Record<string, string | null | undefined>;
  data?: { hName?: string; hProperties?: Record<string, unknown> };
  position?: { start: { offset?: number }; end: { offset?: number } };
}

// Converts ::entity{ref=…} (leafDirective) and :entity[label]{ref=…}
// (textDirective) into the two custom elements the renderer maps to
// components. A directive with no ref mints nothing: it degrades to
// absence, never to a broken card. Runs BEFORE rehypeSanitize, whose schema
// must admit whatever this mints (slice 3 §3).
//
// Ariko's grammar is leaf + text directives only — there is no container
// form. A `:::entity{…}` CONTAINER is therefore never ours, regardless of its
// name: it is left untouched here for remarkRestoreForeignDirectives (below)
// to unwrap, the same as any other foreign directive.
function remarkEntity() {
  return (tree: unknown) => {
    visit(
      tree as never,
      (node: DirectiveNode, index?: number, parent?: { children: unknown[] }) => {
        const block = node.type === "leafDirective";
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

// The source the node offsets index. micromark's preprocessor strips a
// leading BOM before assigning offsets, so positions index the BOM-less string
// while file.value still carries it — every slice would otherwise shift by one
// (verified: render("﻿meet at 10:30 tomorrow") corrupted to "meet at
// 100:3 tomorrow" without this). Both passes that slice the source read it
// here, so neither can forget the BOM the other remembers.
function sourceOf(file: { value?: unknown }): string {
  const raw = typeof file?.value === "string" ? file.value : "";
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}

// Spec 2026-11-15 §3.1. Claims the five staging containers that are VALID by
// lib/staging-parse.ts and rewrites them into custom elements the renderer
// maps to components/staging/*. An invalid one is left alone, so
// remarkRestoreForeignDirectives (below) unwraps it to its children exactly
// as it unwraps any foreign container — the reader keeps every image and
// every sentence of a block with the wrong shape.
//
// Lenient, not strict: an unknown attribute or value (`size=xl`) renders with
// the default rather than unwrapping, because a reader is better served by a
// figure at the wrong size than by a bare image. Refusing it is the door's job
// (lib/staging-check.ts), and the schema below is the second net: it admits
// only members of the vocabulary, so a value that slipped past this pass is
// stripped rather than painted.
//
// A staged block inside a CLAIMED staged block is not claimed: nesting is
// refused by the door and cannot be made in the editor, and when stored
// markdown has it anyway, the inner one unwraps. Unclaimed ancestors do not
// count — a broken figure that unwraps must not take a valid callout inside it
// down with it. visitParents walks parents before children, which is what
// makes "claimed" already known by the time a descendant is visited.
//
// Media blocks are restructured, not just renamed: their images become
// `staged-image` leaves and their caption a `staged-caption`, because a
// figure's component needs the image's data and the caption's RENDERED
// children separately, and server components have no context to pass one
// to the other.
//
// Runs AFTER remarkEntity, so an entity card or mention inside a callout is
// already minted when the callout's body is carried over, and BEFORE
// remarkRestoreForeignDirectives, which skips anything with an hName — the
// claimed blocks and their do/dont sides — while still descending into them,
// which is how a foreign directive inside a callout is still restored.
function remarkStaging() {
  return (tree: unknown, file: { value?: unknown }) => {
    const source = sourceOf(file);
    const claimed = new WeakSet<object>();
    visitParents(tree as never, (node: MdNode, ancestors: MdNode[]) => {
      if (node.type !== "containerDirective" || !isStagedBlock(node.name)) return;
      if (ancestors.some((a) => claimed.has(a))) return;
      const result = parseStagedBlock(node, source, { strict: false });
      if (!result.ok) return;
      claimed.add(node);
      mint(node, result.value);
    });
  };
}

// A leaf: the component reads the image from its props and has no children
// to render. `title` and `data-dark` only when present, so the schema's
// value list for data-dark is the one value ever written.
const stagedImage = (i: StagedImage, dark = false): MdNode => ({
  type: "stagedImage",
  data: {
    hName: "staged-image",
    hProperties: {
      src: i.src,
      alt: i.alt,
      ...(i.title ? { title: i.title } : {}),
      ...(dark ? { "data-dark": "true" } : {}),
    },
  },
});

// A caption, a side's text, a label: inline markdown under a custom element.
// A paragraph node renamed, so mdast-util-to-hast renders its children as
// phrasing — emphasis and mentions survive — without a <p> around them.
const phrase = (hName: string, p: Phrase): MdNode => ({ type: "paragraph", data: { hName }, children: p.nodes });

function mint(node: MdNode, v: ParsedBlock): void {
  switch (v.block) {
    case "figure":
      node.data = { hName: "staged-figure", hProperties: { "data-frame": v.frame, "data-size": v.size } };
      node.children = [
        stagedImage(v.image),
        ...(v.dark ? [stagedImage(v.dark, true)] : []),
        ...(v.caption ? [phrase("staged-caption", v.caption)] : []),
      ];
      return;
    case "gallery":
      node.data = { hName: "staged-gallery", hProperties: { "data-frame": v.frame } };
      node.children = [...v.images.map((i) => stagedImage(i)), ...(v.caption ? [phrase("staged-caption", v.caption)] : [])];
      return;
    case "compare": {
      const side = (s: typeof v.do, hName: string): MdNode => {
        s.node.data = { hName };
        s.node.children = [...(s.image ? [stagedImage(s.image)] : []), phrase("staged-text", s.text)];
        return s.node;
      };
      node.data = { hName: "staged-compare" };
      node.children = [side(v.do, "staged-do"), side(v.dont, "staged-dont")];
      return;
    }
    case "callout":
      node.data = { hName: "staged-callout", hProperties: v.labelText ? { "data-label": v.labelText } : {} };
      node.children = [...(v.label ? [phrase("staged-label", v.label)] : []), ...v.body];
      return;
    case "quote":
      node.data = { hName: "staged-quote", hProperties: { "data-by": v.by, ...(v.role ? { "data-role": v.role } : {}) } };
      node.children = v.body;
      return;
  }
}

// remark-directive claims EVERY `:name` directive syntax in prose, not just
// ours — a time of day, a ratio, a namespaced word, someone else's
// `:::callout`. By the time this runs, remarkEntity (above) has already
// turned our OWN leaf/text `entity` directives into entity-card / entity-link
// elements (or unwrapped ref-less ones to their children, removing them from
// the tree). Anything still a bare directive node here is therefore foreign,
// and must be handed back so mdast-util-to-hast never sees it — an
// unhandled directive node has no hName, and mdast-util-to-hast renders that
// as an empty <div>, destroying the author's text.
//
// leafDirective and textDirective are restored BYTE-EXACTLY from the
// source's own offsets, so attribute order and quoting survive verbatim.
// containerDirective is handled differently and deliberately: Ariko's
// grammar has no container form AT ALL, so a container is never ours no
// matter what it is named (including `:::entity{…}` — see remarkEntity's
// comment). Restoring a container from raw source would flatten whatever
// structure its children parsed into (headings, multiple paragraphs, a
// nested card) into one run-on paragraph of literal text, which is worse
// than the bare-<div> bug this exists to fix. So a container instead keeps
// the older, structure-preserving fallback: unwrap to its own children,
// exactly like remarkEntity's ref-less branch — this is also what lets a
// legitimate directive nested inside a foreign container (`:::grid` wrapping
// `::entity{ref=…}`) still render its card, matching what extractRefs
// (lib/entity-refs.ts) already mints for it.
function remarkRestoreForeignDirectives() {
  return (tree: unknown, file: { value?: unknown }) => {
    const source = sourceOf(file);

    const unwrap = (node: DirectiveNode, index: number, parent: { children: unknown[] }): number => {
      parent.children.splice(index, 1, ...(node.children ?? []));
      return index;
    };

    visit(
      tree as never,
      (node: DirectiveNode, index?: number, parent?: { children: unknown[] }) => {
        // Already claimed by remarkEntity (a valid-ref entity leaf/text
        // directive) — leave it exactly as that pass left it. A ref-less one
        // is already gone from the tree entirely, so it never reaches here.
        if (node.data?.hName) return;

        if (node.type === "containerDirective") {
          if (parent && typeof index === "number") return unwrap(node, index, parent);
          return;
        }

        if (node.type !== "leafDirective" && node.type !== "textDirective") return;

        const from = node.position?.start?.offset;
        const to = node.position?.end?.offset;
        if (
          parent &&
          typeof index === "number" &&
          typeof from === "number" &&
          typeof to === "number" &&
          source.length > 0
        ) {
          const text = { type: "text", value: source.slice(from, to) };
          // A textDirective already sits inside an existing paragraph's
          // children — a bare text node there is enough. A leafDirective
          // instead sits directly under a block parent (root, blockquote,
          // list item…) in the SLOT a paragraph would have occupied; splicing
          // in a bare text node there leaves it unwrapped, since
          // mdast-to-hast does not paragraph-wrap loose text outside
          // phrasing content — the text would then render with no enclosing
          // <p>. Wrap it in one so it does.
          parent.children.splice(
            index,
            1,
            node.type === "leafDirective" ? { type: "paragraph", children: [text] } : text,
          );
          return index + 1; // past the node(s) just inserted
        }
        // No offsets (a non-string file.value, e.g. VFile's Uint8Array form,
        // leaves `source` empty while the offsets stay valid numbers — or a
        // node with no position at all) — restoring from source is not
        // possible. Fall back to unwrapping to children rather than
        // `return`ing: an untouched directive node is exactly the bare-<div>
        // bug this function exists to prevent, and an empty source would
        // otherwise splice in an empty text node instead of the real text.
        if (parent && typeof index === "number") return unwrap(node, index, parent);
        return;
      },
    );
  };
}

// hast-util-sanitize's default (GitHub) schema, unmodified in this slice: it
// already admits the GFM table elements and className on <code> restricted to
// language-*, which is the hook syntax highlighting will want later.
// …widened (slice 3) to admit the two elements remarkEntity mints, and only the
// ref attribute on them. A minted element absent from this schema is stripped
// silently, which is the single most confusing failure in this pipeline.
//
// …and widened again (staging, spec 2026-11-15 §3.1) for the eleven elements
// remarkStaging mints. Forget one here and its block renders as nothing at
// all — the figure's frame is there, its caption is gone, and no test of the
// pass alone notices. The attributes with a closed vocabulary are listed as
// value lists drawn from lib/staging.ts, so the schema is a second, independent
// enforcement of the vocabulary: a frame the pass should never emit is
// stripped here rather than reaching a component that has no style for it.
const STAGED_TAGS = [
  "staged-figure", "staged-gallery", "staged-compare", "staged-do", "staged-dont",
  "staged-callout", "staged-quote", "staged-image", "staged-caption", "staged-text", "staged-label",
];

export const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "entity-card", "entity-link", ...STAGED_TAGS],
  // The GitHub schema clobber-prefixes "id" (and name/aria-*) to
  // "user-content-id" to stop DOM clobbering from attacker-controlled raw
  // HTML. There is no raw-HTML path here (rehype-raw is deliberately absent,
  // see below), so the only id this pipeline ever mints is rehype-slug's own
  // heading slug — safe to leave unprefixed so #execution deep links resolve.
  clobberPrefix: "",
  attributes: {
    ...defaultSchema.attributes,
    // rehype-slug mints these; without them the ids are stripped and every deep
    // link into a narrative lands at the top of the page instead.
    h1: ["id"], h2: ["id"], h3: ["id"], h4: ["id"], h5: ["id"], h6: ["id"],
    // The property key is the literal one remarkEntity sets in hProperties —
    // NOT the camelCased "dataRef" that hast derives when parsing HTML.
    "entity-card": ["data-ref"],
    "entity-link": ["data-ref"],
    // Literal hProperties keys again. `src` on staged-image is checked against
    // defaultSchema.protocols.src (http, https) by attribute NAME, not by tag,
    // which is what strips a `javascript:` image source here exactly as it
    // does on <img>.
    "staged-figure": [["data-frame", ...FRAMES], ["data-size", ...SIZES]],
    "staged-gallery": [["data-frame", ...FRAMES]],
    "staged-image": ["src", "alt", "title", ["data-dark", "true"]],
    "staged-callout": ["data-label"],
    "staged-quote": ["data-by", "data-role"],
  },
};

// Order matters: entity and staging claiming must run before foreign-directive
// restoration, so a valid `::entity{…}` / `:entity[…]{…}` is minted as a card
// or mention, and a valid staged block as its element, BEFORE
// remarkRestoreForeignDirectives decides what is foreign.
export const remarkPlugins: PluggableList = [
  remarkGfm,
  remarkDirective,
  remarkEntity,
  remarkStaging,
  remarkRestoreForeignDirectives,
];

// Sanitization runs LAST, always. When slice 3 mints nodes of its own, its
// transform runs BEFORE this one and widens sanitizeSchema — a custom node
// absent from the schema is silently stripped, which is a confusing failure to
// debug from scratch.
export const rehypePlugins: PluggableList = [rehypeSlug, [rehypeSanitize, sanitizeSchema]];
