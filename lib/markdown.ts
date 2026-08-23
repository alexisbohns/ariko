import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
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
  children?: unknown[];
  attributes?: Record<string, string | null | undefined>;
  data?: { hName?: string; hProperties?: Record<string, unknown> };
  position?: { start: { offset?: number }; end: { offset?: number } };
}

// Converts ::entity{ref=…} (block) and :entity[label]{ref=…} (inline) into the
// two custom elements the renderer maps to components. A directive with no ref
// mints nothing: it degrades to absence, never to a broken card. Runs BEFORE
// rehypeSanitize, whose schema must admit whatever this mints (slice 3 §3).
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
            const text = { type: "text", value: source.slice(from, to) };
            // A textDirective already sits inside an existing paragraph's
            // children — a bare text node there is enough. A leaf/container
            // directive instead sits directly under a block parent (root,
            // blockquote, list item…) in the SLOT a paragraph would have
            // occupied; splicing in a bare text node there leaves it
            // unwrapped, since mdast-to-hast does not paragraph-wrap loose
            // text outside phrasing content — the text would then render
            // with no enclosing <p>. Wrap it in one so it does.
            parent.children.splice(index, 1, block ? { type: "paragraph", children: [text] } : text);
            return index + 1; // past the node(s) just inserted
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

// hast-util-sanitize's default (GitHub) schema, unmodified in this slice: it
// already admits the GFM table elements and className on <code> restricted to
// language-*, which is the hook syntax highlighting will want later.
// …widened (slice 3) to admit the two elements remarkEntity mints, and only the
// ref attribute on them. A minted element absent from this schema is stripped
// silently, which is the single most confusing failure in this pipeline.
export const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "entity-card", "entity-link"],
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
  },
};

export const remarkPlugins: PluggableList = [remarkGfm, remarkDirective, remarkEntity];

// Sanitization runs LAST, always. When slice 3 mints nodes of its own, its
// transform runs BEFORE this one and widens sanitizeSchema — a custom node
// absent from the schema is silently stripped, which is a confusing failure to
// debug from scratch.
export const rehypePlugins: PluggableList = [rehypeSlug, [rehypeSanitize, sanitizeSchema]];
