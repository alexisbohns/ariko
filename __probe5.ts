import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import { visit, SKIP } from "unist-util-visit";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import { sanitizeSchema } from "./lib/markdown";

// Candidate: unwrap EVERY unhandled directive, restoring its literal source.
function remarkEntityFixed() {
  return (tree: any) => {
    visit(tree, (node: any, index?: number, parent?: any) => {
      const block = node.type === "containerDirective" || node.type === "leafDirective";
      const inline = node.type === "textDirective";
      if (!block && !inline) return;
      const ref =
        node.name === "entity" && typeof node.attributes?.ref === "string"
          ? node.attributes.ref.trim()
          : "";
      if (ref) {
        node.data = { ...node.data, hName: block ? "entity-card" : "entity-link", hProperties: { "data-ref": ref } };
        return;
      }
      if (!parent || typeof index !== "number") return;
      const marker = inline ? ":" : node.type === "leafDirective" ? "::" : ":::";
      const kids = node.children ?? [];
      const replacement =
        node.name === "entity"
          ? kids
          : [{ type: "text", value: marker + node.name }, ...kids];
      parent.children.splice(index, 1, ...replacement);
      return [SKIP, index];
    });
  };
}

const render = (s: string, plugins: any) =>
  renderToStaticMarkup(
    createElement(Markdown, {
      remarkPlugins: [remarkGfm, remarkDirective, plugins],
      rehypePlugins: [rehypeSlug, [rehypeSanitize, sanitizeSchema]],
    }, s),
  );

const cases = [
  "Time is 10:30am.",
  "The ref bean:karma is stored as bean:karma.",
  "See TODO:refactor later.",
  "a :entity[L]{ref=bean:x} b",
  "::entity{ref=bean:x}",
  "see :entity[Label]{} here",
  "::entity[Label]{}",
  ":::entity\ninner\n:::",
  "see :entity[a :entity[b]{} c]{} end",
];
for (const md of cases) {
  console.log(`${JSON.stringify(md).padEnd(46)} -> ${render(md, remarkEntityFixed).replace(/\n/g, "\\n")}`);
}
