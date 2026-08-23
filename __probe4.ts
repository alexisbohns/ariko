import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";

const p = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);
for (const src of ["Time is 10:30am.", "The ref bean:karma here.", "See TODO:refactor later."]) {
  const tree = p.parse(src);
  p.runSync(tree);
  console.log(src, "=>", JSON.stringify(tree, (k, v) => (k === "position" ? undefined : v), 1));
}
