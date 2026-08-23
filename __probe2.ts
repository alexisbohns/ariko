import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import { MarkdownManager } from "@tiptap/markdown";
import { remarkPlugins, rehypePlugins } from "./lib/markdown";
import { headlessExtensions } from "./lib/entity-markdown";
import { extractRefs } from "./lib/entity-refs";

const manager = new MarkdownManager({ extensions: headlessExtensions });
const render = (s: string) =>
  renderToStaticMarkup(createElement(Markdown, { remarkPlugins, rehypePlugins }, s));
const roundTrip = (s: string) => manager.serialize(manager.parse(s)).trim();

const remarkVerdict = (md: string) => {
  const h = render(md);
  return h.includes("<entity-card") ? "card" : h.includes("<entity-link") ? "mention" : "none";
};
const editorVerdict = (md: string) => {
  const j = JSON.stringify(manager.parse(md));
  return j.includes('"entityCard"') ? "card" : j.includes('"entityMention"') ? "mention" : "none";
};
const refsVerdict = (md: string) => {
  const k = extractRefs(md).map((r) => r.kind);
  return k.includes("embeds") ? "card" : k.includes("mentions") ? "mention" : "none";
};

const cases = [
  ":::entity{ref=bean:x}\ninner\n:::",
  ":::entity[Lbl]{ref=bean:x}\ninner\n:::",
  "::::entity{ref=bean:x}\ninner\n::::",
  "::entity[a](b){ref=bean:x}",
  "::entity[a{b}]{ref=bean:x}",
  "::entity[a[b]]{ref=bean:x}",
  "::entity[]{ref=bean:x}",
  "::entity[a]  {ref=bean:x}",
  "::entity[multi\nline]{ref=bean:x}",
  "> ::entity[L]{ref=bean:x}",
  "- ::entity[L]{ref=bean:x}",
  "::entity[Label]{ref=}",
  "::entity[Label]{}",
  "Before.\n\n::entity[Label]{}\n\nAfter.",
  "text ::entity[L]{ref=bean:x} tail",
  "::entity[L]{ref=bean:x} trailing",
  "*::entity[L]{ref=bean:x}*",
];

console.log("case | remark | editor | refs | extractRefs()");
for (const md of cases) {
  console.log(
    `${JSON.stringify(md).padEnd(42)} | ${remarkVerdict(md).padEnd(7)} | ${editorVerdict(md).padEnd(7)} | ${refsVerdict(md).padEnd(7)} | ${JSON.stringify(extractRefs(md))}`,
  );
}

console.log("\n--- render/roundtrip detail for the divergent ones");
for (const md of [":::entity{ref=bean:x}\ninner\n:::", ":::entity[Lbl]{ref=bean:x}\ninner\n:::", "Before.\n\n::entity[Label]{}\n\nAfter.", "::entity[a](b){ref=bean:x}", "::entity[a[b]]{ref=bean:x}", "::entity[L]{ref=bean:x} trailing"]) {
  console.log(`in  : ${JSON.stringify(md)}`);
  console.log(`html: ${render(md)}`);
  console.log(`rt  : ${JSON.stringify(roundTrip(md))}`);
  console.log(`rt-h: ${render(roundTrip(md))}`);
  console.log(`same: ${render(roundTrip(md)) === render(md)}`);
  console.log("");
}
