import type { ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import { resolveText, type Text } from "@/lib/data";
import type { EntityResolver } from "@/lib/entity-resolve";
import { EntityCard, EntityLink } from "@/components/entity";
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
const baseComponents: Components = {
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
export function Prose({
  content,
  resolve,
  showUnresolved,
}: {
  content?: Text;
  resolve?: EntityResolver;
  showUnresolved?: boolean;
}) {
  const source = resolveText(content ?? "").trim();
  if (!source) return null;

  // Built per render so it can close over the resolver: server components have
  // no context, so the dataset travels as a prop (spec §4). The two custom tag
  // names are not in react-markdown's element map, hence the cast.
  const components = {
    ...baseComponents,
    "entity-card": (props: { "data-ref"?: string }) => (
      <EntityCard refValue={props["data-ref"]} resolve={resolve} showUnresolved={showUnresolved} />
    ),
    "entity-link": (props: { "data-ref"?: string; children?: ReactNode }) => (
      <EntityLink refValue={props["data-ref"]} resolve={resolve}>
        {props.children}
      </EntityLink>
    ),
  } as Components;

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
