import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import { remarkPlugins, rehypePlugins } from "./lib/markdown";
const render = (s: string) =>
  renderToStaticMarkup(createElement(Markdown, { remarkPlugins, rehypePlugins }, s));

const prose = [
  "The ref bean:karma is stored as bean:karma.",
  "Note:this is a note.",
  "See TODO:refactor later.",
  "Ratio is 1:2 and 3:4.",
  "Visit https://example.com now.",
  "Time is 10:30am.",
  "Namespace foo:Bar and pod:ariko.",
  "a :entity[L]{ref=bean:x} b",
  "::entity{ref=bean:x}",
  "Emoji shortcode :smile: here",
  "```\nbean:x\n```",
  "`bean:x`",
  "The kind is embeds:mentions.",
];
for (const md of prose) {
  const html = render(md);
  const bad = html.includes("<div") ? "  <<< DIV" : "";
  console.log(`${JSON.stringify(md).padEnd(48)} -> ${html}${bad}`);
}
