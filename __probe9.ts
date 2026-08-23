import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";

function nest(d: number): string {
  let s = "core";
  for (let i = 0; i < d; i++) s = `:entity[${s}]{}`;
  return "start " + s + " end";
}
for (const d of [4, 8, 12, 16, 20, 24]) {
  let visits = 0;
  const plugin = () => (tree: any) => {
    visit(tree, (node: any, index?: number, parent?: any) => {
      visits++;
      if (!/Directive$/.test(node.type) || node.name !== "entity") return;
      if (node.attributes?.ref) return;
      if (parent && typeof index === "number") {
        parent.children.splice(index, 1, ...(node.children ?? []));
        return index;
      }
    });
  };
  const p = unified().use(remarkParse).use(remarkDirective).use(plugin);
  const src = nest(d);
  const t0 = Date.now();
  const tree = p.parse(src);
  p.runSync(tree);
  console.log(`depth=${String(d).padStart(2)}  srcLen=${String(src.length).padStart(5)}  visits=${String(visits).padStart(9)}  ms=${Date.now() - t0}`);
}
