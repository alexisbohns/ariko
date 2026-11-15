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

/**
 * A fence remark did NOT read as a fence. Every check above walks directive
 * nodes, and a malformed opener produces none: `:::callout In two words` (the
 * Docusaurus/VitePress admonition title, the likeliest slip of all), a space
 * before `{`, a brace never closed, a stray closer — remark reads each as a
 * paragraph, so the door saw nothing to refuse and the page rendered the
 * colons as literal text. So the paragraphs are read too, line by line.
 *
 * A line opening with three colons and a name is always a failed fence. With
 * two, only a STAGED name is this check's — the same line the leaf rule above
 * draws: `::entity{…} and more` on one line is another pass's prose (and a
 * well-formed `::entity{…}` alone on its line is a leafDirective, never a
 * paragraph line). One colon is a text directive or a time and never matches.
 * Code is not a paragraph, and inline code is blanked before lines are read.
 *
 * A failed opener's own `:::` closer then reads as prose too; it is paired
 * with the opener rather than reported a second time as stray.
 */
const FALSE_OPENER = /^ {0,3}(:{2,})([A-Za-z][\w-]*)/;
const STRAY_CLOSER = /^ {0,3}:{3,}[ \t]*$/;
// A paragraph inside a blockquote carries its `>` markers in the source slice.
const QUOTE_MARKERS = /^(?:[ \t]{0,3}>[ \t]?)+/;

function paragraphProblems(node: MdNode, markdown: string, open: { failed: number }): string[] {
  const start = offset(node, "start");
  const end = offset(node, "end");
  if (typeof start !== "number" || typeof end !== "number") return [];
  const chars = markdown.slice(start, end).split("");
  visitParents(node as never, (n: MdNode) => {
    if (n.type !== "inlineCode") return;
    const s = offset(n, "start");
    const e = offset(n, "end");
    if (typeof s !== "number" || typeof e !== "number") return;
    for (let i = s - start; i < e - start; i++) if (chars[i] !== "\n") chars[i] = " ";
  });
  const problems: string[] = [];
  for (const raw of chars.join("").split("\n")) {
    const line = raw.replace(QUOTE_MARKERS, "");
    const opener = FALSE_OPENER.exec(line);
    if (opener && (opener[1].length >= 3 || isStagedBlock(opener[2]))) {
      open.failed++;
      const shown = line.trim().length > 40 ? `${line.trim().slice(0, 40)}…` : line.trim();
      problems.push(`"${shown}" is not a block opener — write :::name[label]{attrs}, with no space before [ or {`);
    } else if (STRAY_CLOSER.test(line)) {
      if (open.failed > 0) open.failed--;
      else problems.push("a stray ::: closes nothing");
    }
  }
  return problems;
}

export function stagingProblems(input: string): string[] {
  // remark strips a leading BOM before assigning offsets (lib/markdown.ts's
  // sourceOf says the same), so the source read back here must lose it too —
  // or every slice is one character early and a closed block reads unclosed.
  const markdown = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const tree = parser.parse(markdown) as unknown as MdNode;
  const problems: string[] = [];
  const open = { failed: 0 };
  visitParents(tree as never, (node: MdNode, ancestors: MdNode[]) => {
    const name = node.name ?? "";
    if (node.type === "paragraph") {
      problems.push(...paragraphProblems(node, markdown, open));
      return;
    }
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
