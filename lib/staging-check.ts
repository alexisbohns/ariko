import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import { visitParents } from "unist-util-visit-parents";
import { COMPARE_SIDES, STAGED_BLOCKS, isStagedBlock } from "./staging";
import { parseStagedBlock, type MdNode } from "./staging-parse";

/**
 * The door's staging check (spec 2026-11-15 §6.1): STRICT where the renderer
 * is lenient. Stored content falls back gracefully so a typo never breaks a
 * page; posted content is refused by name so the agent that wrote the typo
 * learns of it while it can still fix it — the door's "a typo is an error"
 * rule, applied to the grammar. Without it `size=xl` renders as the default
 * size, a misspelt block unwraps to plain paragraphs, and the maintainer
 * reviews a draft that is quietly not what its author staged.
 *
 * It walks the renderer's own parse (remark + gfm + directive), so whatever it
 * calls a block is what remarkStaging will be handed, and every verdict on a
 * block's shape is parseStagedBlock's — this file decides only what that
 * function cannot see from one node: nesting, placement and closure.
 */
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);
const SIDES: readonly string[] = COMPARE_SIDES;

const offset = (n: MdNode | undefined, edge: "start" | "end") => n?.position?.[edge].offset;

/**
 * remark closes a container at end of document (or of its parent) without a
 * word, so "unclosed" is read back from the source: a closed container ends
 * with its closing fence, which sits AFTER its last child — so the text
 * between the last child's end (or the opening line's, with no children) and
 * the node's end holds a fence line at least as long as the opening one.
 *
 * Deliberately not "does the node reach the end of the document": a closed
 * block with nothing after it reaches it too, and an unclosed `:::do` inside
 * a closed `::::compare` reaches only its parent's end. Nor does it re-find
 * the fence with lib/staging-fence.ts — that is marked's view of the source,
 * and this check must agree with remark's, which is the parse that renders.
 * An indented `    :::` as the last line is part of a code child, so it is
 * (correctly) not read as a fence.
 */
function isUnclosed(node: MdNode, markdown: string): boolean {
  const start = offset(node, "start");
  const end = offset(node, "end");
  if (typeof start !== "number" || typeof end !== "number") return false;
  const opening = /^:+/.exec(markdown.slice(start))?.[0].length ?? 3;
  const kids = node.children ?? [];
  const newline = markdown.indexOf("\n", start);
  const openingLineEnd = newline === -1 || newline > end ? end : newline;
  const lastKidEnd = offset(kids[kids.length - 1], "end");
  const after = Math.max(openingLineEnd, typeof lastKidEnd === "number" ? lastKidEnd : openingLineEnd);
  const tail = markdown.slice(after, end);
  return !new RegExp(`(^|\\n)[ \\t>]*:{${opening},}[ \\t]*$`).test(tail);
}

export function stagingProblems(markdown: string): string[] {
  const tree = parser.parse(markdown) as unknown as MdNode;
  const problems: string[] = [];
  visitParents(tree as never, (node: MdNode, ancestors: MdNode[]) => {
    const name = node.name ?? "";
    // Only a staged name is this check's: `::entity{…}`, `:entity[…]` and the
    // `:30` of "10:30" are other passes' business, or prose.
    if (node.type === "leafDirective" || node.type === "textDirective") {
      const colons = node.type === "leafDirective" ? "::" : ":";
      if (isStagedBlock(name)) problems.push(`${colons}${name} must be a container — write :::${name} … :::`);
      return;
    }
    if (node.type !== "containerDirective") return;
    if (isUnclosed(node, markdown)) {
      problems.push(`${name}: unclosed — no matching :::`);
      return;
    }
    const parent = ancestors[ancestors.length - 1];
    if (SIDES.includes(name)) {
      if (!(parent?.type === "containerDirective" && parent.name === "compare"))
        problems.push(`${name}: only inside ::::compare`);
      return;
    }
    // An unknown container is refused rather than unwrapped: an agent that
    // wrote `:::warning` expected it to mean something, and the reader would
    // see only its paragraphs.
    if (!isStagedBlock(name)) {
      problems.push(`:::${name} is not a staging block (${STAGED_BLOCKS.join(", ")})`);
      return;
    }
    const host = ancestors.find((a) => a.type === "containerDirective" && isStagedBlock(a.name));
    if (host) {
      problems.push(`${name}: a staged block cannot sit inside ${host.name}`);
      return;
    }
    const r = parseStagedBlock(node, markdown, { strict: true });
    if (!r.ok) problems.push(r.problem);
  });
  return problems;
}
