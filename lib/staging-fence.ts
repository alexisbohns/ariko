/**
 * Where a container directive ends, by remark-directive's rules (spec
 * 2026-11-15 §2.3), for marked — which has no idea containers exist and must
 * be told how far to advance. Over-reading here swallows the rest of the
 * document into one block; under-reading leaves a stray `:::` paragraph. The
 * rules were checked against remark before this was written, and
 * lib/staging-fence.test.ts holds the two to agreement on every staging
 * fixture, so a remark upgrade that moves a boundary fails there rather than
 * in an editor that quietly parses a different document than the site renders.
 *
 * Returns an offset into `src` just past the closing line's newline, or
 * `src.length` for a container that never closes (remark runs it to the end
 * of the document too), or null when `src` does not open with a container.
 *
 * A closer of length L closes every open container whose opener is ≤ L,
 * innermost first: `:::` inside `::::compare` closes only the inner `:::do`,
 * `::::` closes both, and same-length nesting closes both at the first closer.
 * A closer shorter than the outermost opener pops nothing. Up to three spaces
 * of indent still count.
 *
 * Fenced code is HALF opaque, which is remark's rule and not an intuitive
 * one: an opener inside code is code, but a closer inside code still closes —
 * `:::callout\n```\n:::\n```\n:::` is a callout holding an empty code block,
 * closed at the inner `:::`, with the rest of the fence left outside. Treating
 * code as wholly opaque over-read such a block by two lines.
 *
 * Server-safe: no imports, so the editor's tokenizers and the public zone can
 * both take it.
 */
const OPEN = /^ {0,3}(:{3,})[A-Za-z]/;
const CLOSE = /^ {0,3}(:{3,})[ \t]*$/;
const CODE = /^ {0,3}(`{3,}|~{3,})/;

export function findContainerEnd(src: string): number | null {
  const first = OPEN.exec(src);
  if (!first) return null;
  const stack: number[] = [first[1].length];
  let offset = src.indexOf("\n");
  if (offset === -1) return src.length;
  offset += 1;
  let code: string | null = null;

  while (offset < src.length) {
    const nl = src.indexOf("\n", offset);
    const lineEnd = nl === -1 ? src.length : nl;
    const line = src.slice(offset, lineEnd);
    const next = nl === -1 ? src.length : nl + 1;

    const fence = CODE.exec(line);
    const close = CLOSE.exec(line);
    if (close && stack[stack.length - 1] <= close[1].length) {
      // A closing container ends any code open inside it.
      const len = close[1].length;
      while (stack.length > 0 && stack[stack.length - 1] <= len) stack.pop();
      if (stack.length === 0) return next;
      code = null;
    } else if (code) {
      if (fence && fence[1][0] === code[0] && fence[1].length >= code.length && !line.slice(fence[0].length).trim()) code = null;
    } else if (fence) {
      code = fence[1];
    } else if (!close) {
      const open = OPEN.exec(line);
      if (open) stack.push(open[1].length);
    }
    offset = next;
  }
  return src.length;
}
