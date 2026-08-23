import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkDirective from "remark-directive";
import { visit, SKIP } from "unist-util-visit";

function counting(useSkip: boolean, counts: Map<string, number>) {
  return () => (tree: any) => {
    visit(tree, (node: any, index?: number, parent?: any) => {
      if (node.type === "text") counts.set(node.value, (counts.get(node.value) ?? 0) + 1);
      const isDir = /Directive$/.test(node.type);
      if (!isDir || node.name !== "entity") return;
      if (node.attributes?.ref) return;
      if (parent && typeof index === "number") {
        parent.children.splice(index, 1, ...(node.children ?? []));
        return useSkip ? [SKIP, index] : index;
      }
    });
  };
}
const src = "see :entity[alpha :entity[beta]{} gamma]{} end";
for (const useSkip of [false, true]) {
  const counts = new Map<string, number>();
  const p = unified().use(remarkParse).use(remarkDirective).use(counting(useSkip, counts));
  const tree = p.parse(src);
  p.runSync(tree);
  console.log(`useSkip=${useSkip}  visitCounts=${JSON.stringify([...counts])}`);
  console.log(`  final: ${JSON.stringify((tree as any).children[0].children.map((c: any) => c.value ?? c.type))}`);
}
