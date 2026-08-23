import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import { remarkPlugins, rehypePlugins } from "./lib/markdown";
const render = (s: string) => renderToStaticMarkup(createElement(Markdown, { remarkPlugins, rehypePlugins }, s));
for (const md of [
  "## Execution",
  "## Head :entity[X]{} tail",
  "## Head :entity[X]{ref=bean:x} tail",
  "## Ratio 1:2 here",
  "## Plain heading",
  ":::entity\n## Inside\n:::",
  "## a\n\n## a",
]) console.log(`${JSON.stringify(md).padEnd(38)} -> ${render(md).replace(/\n/g, "\\n")}`);
