/**
 * One corpus, three readers. This grammar is implemented three times — remark
 * renders it (lib/markdown.ts), the marked tokenizer writes it
 * (lib/entity-markdown.ts), and extractRefs mirrors it into the graph
 * (lib/entity-refs.ts). Every row below is a case where all three MUST agree.
 *
 * Cases where they legitimately differ are NOT here: they live as named,
 * commented tests in lib/markdown-conformance.test.ts, so a divergence is
 * always either forbidden (this file) or deliberate (a named test).
 */
export interface EntityFixture {
  md: string;
  expect: "card" | "mention" | "none";
}

export const ENTITY_FIXTURES: EntityFixture[] = [
  { md: "::entity{ref=bean:x}", expect: "card" },
  { md: "::entity[Some Label]{ref=bean:x}", expect: "card" },
  { md: "   ::entity{ref=bean:x}", expect: "card" },
  { md: "Before.\n\n::entity{ref=bean:x}", expect: "card" },
  { md: "see :entity[Label]{ref=bean:x} here", expect: "mention" },
  { md: "    ::entity{ref=bean:x}", expect: "none" },
  { md: "```\n::entity{ref=bean:x}\n```", expect: "none" },
  { md: "literal `::entity{ref=bean:x}` here", expect: "none" },
  { md: "::entity{foo=bar}", expect: "none" },
  { md: "::entity{ref=}", expect: "none" },
  { md: "x::entity{ref=bean:x}", expect: "none" },
  { md: "meet at 10:30 tomorrow", expect: "none" },
  { md: "a ratio of 3:2 today", expect: "none" },
  { md: "see :something[here] in prose", expect: "none" },
];
