import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import { remarkPlugins, rehypePlugins } from "/Users/alexis/code/ariko/lib/markdown";
import { extractRefs } from "/Users/alexis/code/ariko/lib/entity-refs";

const render = (s: string) =>
  renderToStaticMarkup(createElement(Markdown, { remarkPlugins, rehypePlugins }, s));

const cases: [string, string][] = [
  ["nested ref-less inline", "see :entity[a :entity[b]{} c]{} end"],
  ["nested ref-less inline w/ ref inside", "see :entity[a :entity[b]{ref=bean:z} c]{} end"],
  ["ref-less inline, NO children", "see :entity{} here"],
  ["ref-less inline empty label", "see :entity[]{} here"],
  ["ref-less inline then sibling text", "A :entity[X]{} B *em* C"],
  ["ref-less inline, two in a row", ":entity[A]{}:entity[B]{} tail"],
  ["ref-less inline first in para", ":entity[A]{} tail"],
  ["ref-less LEAF block", "::entity[Label]{}"],
  ["ref-less LEAF block no label", "::entity{}"],
  ["ref-less LEAF block no attrs", "::entity"],
  ["ref-less CONTAINER", ":::entity\nsome **para**\n\n- a\n- b\n:::"],
  ["ref-less CONTAINER w/ label", ":::entity[Lbl]\npara\n:::"],
  ["nested ref-less containers", ":::::entity\n:::entity\ninner\n:::\n:::::"],
  ["container ref-less w/ heading", ":::entity\n## Head\n:::"],
  ["container WITH ref", ":::entity{ref=bean:x}\ninner\n:::"],
  ["leaf WITH ref labeled", "::entity[Label]{ref=bean:x}"],
  ["ref-less inline in heading", "## Head :entity[X]{} tail"],
  ["ref-less inline in list", "- :entity[X]{} item"],
  ["ref-less inline in blockquote", "> :entity[X]{} q"],
  ["ref-less inline in table cell", "| a | b |\n| --- | --- |\n| :entity[X]{} | 2 |"],
  ["ref-less inline in link text", "[see :entity[X]{} d](https://e.com)"],
  ["ref with only whitespace", "see :entity[L]{ref=   } here"],
  ["container ref-less inside list item", "- :::entity\n  inner\n  :::"],
];

for (const [name, md] of cases) {
  let out: string;
  try { out = render(md); } catch (e) { out = "THREW: " + (e as Error).message; }
  console.log(`--- ${name}\n    in : ${JSON.stringify(md)}\n    out: ${out}`);
}
