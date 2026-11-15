import type { ReactNode } from "react";
import type { Components } from "react-markdown";
import type { Element, ElementContent } from "hast";
import { COMPARE_LABELS, resolveFrame, resolveSize } from "@/lib/staging";
import type { Lang } from "@/lib/locale";
import type { ImageData } from "./staged-image";
import { StagedFigure } from "./figure";
import { StagedGallery } from "./gallery";
import { StagedCompare, CompareSide } from "./compare";
import { StagedCallout, CalloutLabel } from "./callout";
import { StagedQuote } from "./quote";

/**
 * The staged tags → components, for react-markdown (spec 2026-11-15 §3.2).
 * ONE map, used by components/markdown.tsx's <Prose> on the public site AND
 * by the editor's node views, so the author sees what the visitor sees — the
 * shared-surfaces rule. SERVER-SAFE, on lib/server-safe-source.test.ts's
 * list: a "use client" here would be a boundary under every prose page.
 *
 * A media block's images arrive as `staged-image` leaves, already sanitized;
 * their data is read from the hast `node` and the leaf itself renders
 * nothing, while the caption arrives as rendered `children`. That split is
 * forced: a server component cannot hand data to its child through context.
 *
 * Every attribute is re-resolved against the vocabulary rather than trusted:
 * the remark pass and the sanitize schema already close the lists, and this
 * is the third reader that must not draw `size=xl` as something.
 */
type Props = { node?: Element; children?: ReactNode } & Record<string, unknown>;

const isEl = (c: ElementContent, tag: string): c is Element => c.type === "element" && c.tagName === tag;
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));

// hast keeps the sanitized property under its literal name, `data-dark`, not
// the camel-cased `dataDark` a parsed-HTML tree would carry.
function imagesOf(node?: Element): Array<ImageData & { dark: boolean }> {
  return (node?.children ?? []).flatMap((c) =>
    isEl(c, "staged-image")
      ? [
          {
            src: str(c.properties.src),
            alt: str(c.properties.alt),
            title: c.properties.title ? str(c.properties.title) : null,
            dark: str(c.properties["data-dark"]) === "true",
          },
        ]
      : [],
  );
}
const hasChild = (node: Element | undefined, tag: string) => (node?.children ?? []).some((c) => isEl(c, tag));
const captionOf = (node: Element | undefined, children: ReactNode) =>
  hasChild(node, "staged-caption") ? children : null;

export function stagingComponents(lang: Lang): Components {
  const labels = COMPARE_LABELS[lang];
  // The staged tag names are not in react-markdown's element map, hence the cast.
  return {
    "staged-image": () => null,
    "staged-caption": ({ children }: Props) => <>{children}</>,
    "staged-text": ({ children }: Props) => <>{children}</>,
    "staged-label": ({ children }: Props) => <CalloutLabel>{children}</CalloutLabel>,
    "staged-figure": ({ node, children, ...p }: Props) => {
      const imgs = imagesOf(node);
      const light = imgs.find((i) => !i.dark);
      // The sanitizer took the src (a `javascript:` URL): show what is left
      // rather than a frame around nothing.
      if (!light?.src) return <>{children}</>;
      const frame = resolveFrame(p["data-frame"]);
      const dark = imgs.find((i) => i.dark && i.src) ?? null;
      return (
        <StagedFigure
          frame={frame}
          size={resolveSize(p["data-size"], frame)}
          image={light}
          dark={dark}
          caption={captionOf(node, children)}
        />
      );
    },
    "staged-gallery": ({ node, children, ...p }: Props) => (
      <StagedGallery
        frame={resolveFrame(p["data-frame"])}
        images={imagesOf(node).filter((i) => i.src)}
        caption={captionOf(node, children)}
      />
    ),
    "staged-compare": ({ children }: Props) => <StagedCompare>{children}</StagedCompare>,
    "staged-do": ({ node, children }: Props) => (
      <CompareSide verdict="do" label={labels.do} image={imagesOf(node).find((i) => i.src) ?? null} text={children} />
    ),
    "staged-dont": ({ node, children }: Props) => (
      <CompareSide verdict="dont" label={labels.dont} image={imagesOf(node).find((i) => i.src) ?? null} text={children} />
    ),
    "staged-callout": ({ children, ...p }: Props) => (
      <StagedCallout labelText={p["data-label"] ? str(p["data-label"]) : null}>{children}</StagedCallout>
    ),
    "staged-quote": ({ children, ...p }: Props) => (
      <StagedQuote by={str(p["data-by"])} role={p["data-role"] ? str(p["data-role"]) : null}>
        {children}
      </StagedQuote>
    ),
  } as Components;
}
