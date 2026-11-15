import { test } from "node:test";
import assert from "node:assert/strict";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import { findContainerEnd } from "./staging-fence";
import { STAGING_FIXTURES, NONCANONICAL_FIXTURES, MALFORMED_FIXTURES } from "./staging-fixtures";

test("a block ends after its closing fence and that line's newline", () => {
  const src = `${STAGING_FIXTURES.callout}\n\nafter`;
  assert.equal(src.slice(0, findContainerEnd(src)!), `${STAGING_FIXTURES.callout}\n`);
});

test("compare survives the inner closers", () => {
  const src = `${STAGING_FIXTURES.compare}\nafter`;
  assert.equal(findContainerEnd(src), STAGING_FIXTURES.compare.length + 1);
});

test("a longer closer closes every shorter-or-equal open container", () => {
  const src = "::::compare\n:::do\nyes\n::::\nafter";
  assert.equal(src.slice(0, findContainerEnd(src)!), "::::compare\n:::do\nyes\n::::\n");
});

test("same-length nesting closes both at the first closer", () => {
  const src = ":::callout\n:::gallery\nx\n:::\nmore\n:::";
  assert.equal(src.slice(0, findContainerEnd(src)!), ":::callout\n:::gallery\nx\n:::\n");
});

test("an unclosed container runs to the end", () => {
  const src = ":::callout\nnever closed\n\nstill inside";
  assert.equal(findContainerEnd(src), src.length);
});

test("a closer inside fenced code still closes (remark's rule)", () => {
  const src = ":::callout\n```\n:::\n```\nreal\n:::\nafter";
  assert.equal(src.slice(0, findContainerEnd(src)!), ":::callout\n```\n:::\n");
});

test("an opener inside fenced code is code, not a nested container", () => {
  // `:::::gallery` would otherwise sit on the stack above `::::callout`, and
  // the `::::` closer could not reach the callout under it.
  const src = "::::callout\n```\n:::::gallery\n```\n::::\nz\n::::\nafter";
  assert.equal(src.slice(0, findContainerEnd(src)!), "::::callout\n```\n:::::gallery\n```\n::::\n");
});

test("a closer shorter than the container is code content", () => {
  const src = "::::callout\n```\n:::\n```\n::::\nafter";
  assert.equal(src.slice(0, findContainerEnd(src)!), "::::callout\n```\n:::\n```\n::::\n");
});

test("an indented closer (up to 3 spaces) counts; 4 does not", () => {
  assert.equal(findContainerEnd(":::callout\nx\n   :::\ny"), ":::callout\nx\n   :::\n".length);
  assert.equal(findContainerEnd(":::callout\nx\n    :::\ny"), ":::callout\nx\n    :::\ny".length);
});

test("not an opener → null", () => {
  assert.equal(findContainerEnd("text\n:::"), null);
  assert.equal(findContainerEnd("::entity{ref=bean:x}"), null);
});

/**
 * The rules above were read off remark; this is remark itself being asked. A
 * hand-written boundary finder that agrees with its own unit tests and not
 * with the parser would pass everything except the one thing it is for.
 */
const processor = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);

type Node = { type: string; position?: { start: { offset?: number }; end: { offset?: number } }; children?: Node[] };

function firstContainer(node: Node): Node | null {
  if (node.type === "containerDirective") return node;
  for (const child of node.children ?? []) {
    const hit = firstContainer(child);
    if (hit) return hit;
  }
  return null;
}

// Code inside a container, where remark's closing rule is least intuitive.
const CODE_CASES: Record<string, string> = {
  closerInCode: ":::callout\n```\n:::\n```\n:::",
  openerInCode: "::::callout\n```\n:::::gallery\n```\n::::\nz\n::::",
  shortCloserInCode: "::::callout\n```\n:::\n```\n::::",
  tildeCode: ":::callout\n~~~\n:::\n~~~\n:::",
};

const CORPUS: Array<[string, string]> = [
  ...Object.entries(CODE_CASES),
  ...Object.entries(STAGING_FIXTURES),
  ...Object.entries(NONCANONICAL_FIXTURES),
  ...Object.entries(MALFORMED_FIXTURES).map(([name, f]): [string, string] => [name, f.md]),
];

for (const [name, md] of CORPUS) {
  test(`findContainerEnd agrees with remark on fixture ${name}`, () => {
    const src = `${md}\n\nafter`;
    const node = firstContainer(processor.parse(src) as Node);
    assert.ok(node, "every fixture in the corpus contains a container directive");
    const start = node!.position!.start.offset!;
    const end = node!.position!.end.offset!;
    // marked is asked at the container's own first line, never mid-paragraph.
    const fromHere = src.slice(start);
    const found = findContainerEnd(fromHere);
    assert.notEqual(found, null, "remark found a container where findContainerEnd saw no opener");
    const mine = src.slice(start, start + found!).replace(/\n$/, "");
    assert.equal(mine, src.slice(start, end));
  });
}
