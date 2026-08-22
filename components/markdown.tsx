import Markdown, { type Components } from "react-markdown";
import { resolveText, type Text } from "@/lib/data";
import { remarkPlugins, rehypePlugins } from "@/lib/markdown";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// GFM tables render through the design system's primitives instead of the
// typography plugin's table styles — hence not-prose around them (CLAUDE.md:
// never hand-roll what the registry already has). Table itself supplies the
// overflow-x-auto container, so a wide table scrolls instead of blowing out the
// reading column. Only children (and GFM's column-alignment style) are
// forwarded: react-markdown also passes a `node` prop, which must not reach the
// DOM.
const components: Components = {
  table: ({ children }) => (
    <div className="not-prose">
      <Table>{children}</Table>
    </div>
  ),
  thead: ({ children }) => <TableHeader>{children}</TableHeader>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children, style }) => <TableHead style={style}>{children}</TableHead>,
  td: ({ children, style }) => <TableCell style={style}>{children}</TableCell>,
};

/**
 * Renders localizable markdown as prose. Server-only — no client JS enters the
 * public zone. Renders NOTHING (not an empty card, not a heading) when the
 * resolved content is blank, which is the common case today.
 */
export function Prose({ content }: { content?: Text }) {
  const source = resolveText(content ?? "").trim();
  if (!source) return null;

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <Markdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {source}
      </Markdown>
    </div>
  );
}
