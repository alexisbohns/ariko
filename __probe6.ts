import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import { MarkdownManager } from "@tiptap/markdown";
import { remarkPlugins, rehypePlugins } from "./lib/markdown";
import { headlessExtensions } from "./lib/entity-markdown";
import { extractRefs } from "./lib/entity-refs";
const manager = new MarkdownManager({ extensions: headlessExtensions });
const render = (s: string) => renderToStaticMarkup(createElement(Markdown, { remarkPlugins, rehypePlugins }, s));
const rv = (m: string) => { const h = render(m); return h.includes("<entity-card") ? "card" : h.includes("<entity-link") ? "mention" : "none"; };
const ev = (m: string) => { const j = JSON.stringify(manager.parse(m)); return j.includes('"entityCard"') ? "card" : j.includes('"entityMention"') ? "mention" : "none"; };
const fv = (m: string) => { const k = extractRefs(m).map(r => r.kind); return k.includes("embeds") ? "card" : k.includes("mentions") ? "mention" : "none"; };
for (const md of [
  "- ::entity{ref=bean:x}",
  "> ::entity{ref=bean:x}",
  "1. ::entity{ref=bean:x}",
  ":::entity{ref=bean:x}\n:::",
  "::entity{ref=bean:x}\n::entity{ref=bean:y}",
  "Time is 10:30am.",
]) console.log(`${JSON.stringify(md).padEnd(40)} remark=${rv(md).padEnd(7)} editor=${ev(md).padEnd(7)} refs=${fv(md)}`);
