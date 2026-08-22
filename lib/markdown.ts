import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { PluggableList } from "unified";

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
  attributes?: Record<string, string | null | undefined>;
  data?: { hName?: string; hProperties?: Record<string, unknown> };
}

// Converts ::entity{ref=…} (block) and :entity[label]{ref=…} (inline) into the
// two custom elements the renderer maps to components. A directive with no ref
// mints nothing: it degrades to absence, never to a broken card. Runs BEFORE
// rehypeSanitize, whose schema must admit whatever this mints (slice 3 §3).
function remarkEntity() {
  return (tree: unknown) => {
    visit(tree as never, (node: DirectiveNode) => {
      const block = node.type === "containerDirective" || node.type === "leafDirective";
      const inline = node.type === "textDirective";
      if ((!block && !inline) || node.name !== "entity") return;
      const ref = typeof node.attributes?.ref === "string" ? node.attributes.ref.trim() : "";
      if (!ref) return;
      node.data = {
        ...node.data,
        hName: block ? "entity-card" : "entity-link",
        hProperties: { "data-ref": ref },
      };
    });
  };
}

// hast-util-sanitize's default (GitHub) schema, unmodified in this slice: it
// already admits the GFM table elements and className on <code> restricted to
// language-*, which is the hook syntax highlighting will want later.
// …widened (slice 3) to admit the two elements remarkEntity mints, and only the
// ref attribute on them. A minted element absent from this schema is stripped
// silently, which is the single most confusing failure in this pipeline.
export const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "entity-card", "entity-link"],
  attributes: {
    ...defaultSchema.attributes,
    // The property key is the literal one remarkEntity sets in hProperties —
    // NOT the camelCased "dataRef" that hast derives when parsing HTML.
    "entity-card": ["data-ref"],
    "entity-link": ["data-ref"],
  },
};

export const remarkPlugins: PluggableList = [remarkGfm, remarkDirective, remarkEntity];

// Sanitization runs LAST, always. When slice 3 mints nodes of its own, its
// transform runs BEFORE this one and widens sanitizeSchema — a custom node
// absent from the schema is silently stripped, which is a confusing failure to
// debug from scratch.
export const rehypePlugins: PluggableList = [[rehypeSanitize, sanitizeSchema]];
