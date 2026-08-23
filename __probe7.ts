import { MarkdownManager } from "@tiptap/markdown";
import { headlessExtensions } from "./lib/entity-markdown";
const manager = new MarkdownManager({ extensions: headlessExtensions });
const roundTrip = (s: string) => manager.serialize(manager.parse(s)).trim();
const FIXTURES: Record<string, string> = {
  heading: "## Execution", emphasis: "plain *em* and **strong** text",
  underscoreEmphasis: "_em_ and __strong__", link: "see [the docs](https://example.com)",
  linkTitle: '[x](https://e.com "T")', bullets: "- one\n- two", nestedList: "- a\n  - b\n- c",
  ordered: "1. first\n2. second", quote: "> quoted line",
  inlineCode: "call `filterPublic()` first", fenced: "```ts\nconst x: number = 1\n```",
  indentedCode: "    ::entity{ref=bean:x}", table: "| a | b |\n| --- | --- |\n| 1 | 2 |",
  hardWrap: "line one\nline two", entityCard: "::entity{ref=bean:karma-accountability}",
  entityInline: "see :entity[Prediction Timelines]{ref=bean:prediction-timelines} here",
  entityInFence: "```\n::entity{ref=bean:x}\n```", entityInInlineCode: "literal `::entity{ref=bean:x}` here",
  reflessBlock: "::entity{foo=bar}", emptyRef: "::entity{ref=}",
  mixed: "## Drawer\n\nProse with :entity[X]{ref=bean:x} inline.\n\n::entity{ref=bean:y}",
};
for (const [n, s] of Object.entries(FIXTURES)) {
  const rt = roundTrip(s);
  console.log(`${(rt === s.trim() ? "IDENTITY " : "CHANGED  ")}${n.padEnd(20)} ${JSON.stringify(s)} -> ${JSON.stringify(rt)}`);
}
