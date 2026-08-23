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
  { md: "![alt text](/img.png)", expect: "none" },
  { md: '![alt](/i.png "Title")', expect: "none" },
  { md: "- [ ] todo item\n- [x] done item", expect: "none" },
  { md: "> ::entity{ref=bean:x}", expect: "card" },
  { md: "- ::entity{ref=bean:x}", expect: "card" },
  { md: "> - ::entity{ref=bean:x}", expect: "card" },
  // The 4-space negative already has a row above ("    ::entity{ref=bean:x}"),
  // load-bearing since it must NOT match despite the new quote/list prefixes.
  // Reachable from the editor itself: Tiptap's list serializer emits exactly
  // this indentation on round-trip, so a card nested one level deep must mint
  // its graph edge too (found by the coordinator's review of Task 3c).
  { md: "- a\n  - ::entity{ref=bean:x}", expect: "card" },
  // CommonMark allows a blockquote marker with no trailing space, unlike a
  // list marker — must agree the same way `> ::entity{…}` does above.
  { md: ">::entity{ref=bean:x}", expect: "card" },
  // Three levels deep: this is the row that rules out bounding the leading
  // marker run's indentation to {0,3} — a third-level list item legitimately
  // carries 4+ leading spaces, which the plain {0,3} rule alone would reject.
  { md: "- a\n  - b\n    - ::entity{ref=bean:x}", expect: "card" },
  // Nested blockquote markers, each with extra trailing whitespace, ending in
  // a list item — the general case the widened marker-run grammar exists for.
  { md: ">  >  - ::entity{ref=bean:x}", expect: "card" },
  // I1: a card sharing a level-2 list item with a preceding paragraph
  // serializes with BARE indentation (no marker of its own) — this is the
  // row that motivated BLOCK's lookbehind alternative. Depth 1 of the same
  // shape ("- a\n  ::entity{ref=bean:x}") already worked; this is "one level
  // down".
  { md: "- a\n  - b\n    ::entity{ref=bean:two}", expect: "card" },
];
