"use client";

import { useEffect, useState } from "react";
import { shouldRenderToc, TOC_MIN_HEADINGS, tocState, type TocHeading } from "@/lib/toc";

/**
 * The reading position, as a column of dashes in the left gutter — and the
 * PUBLIC ZONE'S FIRST CLIENT ISLAND.
 *
 * It is also the mildest exception in the repo, in the strong sense the media
 * picker's rule uses: it renders NOTHING until it mounts, so script-off the
 * page is byte-for-byte what it was, and its absence never costs anything —
 * every heading it points at is already in the prose beneath it, in document
 * order, with an id on it. The rail adds no destination, no control and no
 * information of its own. It is a position indicator for a document you can
 * already read. And it never writes: no form, no server action, no submit.
 *
 * The gate lives in this OUTER component so no browser-only hook is ever
 * called during a server render; React's rules of hooks are what force the
 * split, since the inner DOM-scan effect cannot sit after an early return.
 * lib/toc-mount.test.ts pins the consequence rather than the shape: nothing at
 * all reaches the script-off HTML.
 */
export function TocRail() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <MountedTocRail />;
}

/** How far down the viewport the "reading line" sits. A heading counts as read
 *  once it crosses it — the top third, so the active row advances as a section
 *  arrives rather than as it leaves. */
const READING_LINE = 1 / 3;

function MountedTocRail() {
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    // The ids are rehypeSlug's, already on the rendered headings — so the
    // anchors cannot drift from their targets, because they are READ from the
    // targets. See lib/toc.ts for why this is not a server-side extraction.
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("main h2[id], main h3[id]"),
    );
    setHeadings(
      nodes.map((node) => ({
        id: node.id,
        text: (node.textContent ?? "").trim(),
        level: node.tagName === "H3" ? 3 : 2,
      })),
    );
    if (nodes.length < TOC_MIN_HEADINGS) return;

    // The last heading above the reading line. Recomputed from rects rather
    // than inferred from which entries are intersecting: that answer is correct
    // at the bottom of the document too, where the final heading may never
    // become the topmost visible one because the section under it is short.
    const compute = () => {
      const line = window.innerHeight * READING_LINE;
      let next = -1;
      nodes.forEach((node, index) => {
        if (node.getBoundingClientRect().top <= line) next = index;
      });
      setActive(next);
    };

    // An observer, not a scroll listener: a scroll handler runs on every frame
    // of every scroll on a page whose whole job is to be read. Shrinking the
    // root's bottom to the reading line makes the observer fire on exactly the
    // crossings that can change the answer.
    const observer = new IntersectionObserver(compute, {
      rootMargin: `0px 0px -${(1 - READING_LINE) * 100}% 0px`,
    });
    nodes.forEach((node) => observer.observe(node));
    compute();
    return () => observer.disconnect();
  }, []);

  if (!shouldRenderToc(headings)) return null;

  return (
    <nav
      aria-label="On this page"
      /* `hidden xl:block`: below that breakpoint the max-w-3xl column leaves no
         gutter to sit in, and a rail over the text is worse than none. */
      className="group fixed left-6 top-1/2 z-30 hidden -translate-y-1/2 xl:block"
    >
      {/* The dashes. aria-hidden — the panel below carries the same headings as
          real links, and announcing both would say the document's outline
          twice. */}
      <ul
        aria-hidden="true"
        className="flex flex-col gap-2 opacity-100 transition-opacity duration-200 group-hover:opacity-0 group-focus-within:opacity-0"
      >
        {headings.map((heading, index) => (
          <li key={heading.id} className="flex h-2 items-center">
            <span
              className={
                "h-0.5 rounded-full transition-all duration-200 " +
                (heading.level === 3 ? "w-2.5 " : "w-4 ") +
                DASH[tocState(index, active)]
              }
            />
          </li>
        ))}
      </ul>

      {/* The words, on hover or keyboard focus. The only place this rail
          carries text. `invisible` rather than opacity alone so the links are
          not tab-reachable while hidden — the rail must not put a dozen
          invisible stops in the tab order of every page. */}
      <div className="invisible absolute left-0 top-1/2 w-64 -translate-y-1/2 rounded-xl border bg-popover/95 p-3 opacity-0 shadow-lg backdrop-blur transition-opacity duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <ul className="flex flex-col gap-1">
          {headings.map((heading, index) => (
            <li key={heading.id} className={heading.level === 3 ? "pl-3" : undefined}>
              <a
                href={`#${heading.id}`}
                aria-current={tocState(index, active) === "active" ? "location" : undefined}
                className={
                  "block truncate rounded-md px-2 py-1 text-xs transition-colors hover:bg-accent/50 " +
                  LINK[tocState(index, active)]
                }
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

/* The three states, drawn. Default is faint rather than absent: the rail's
   length is itself information — it says how much document there is. */
const DASH: Record<ReturnType<typeof tocState>, string> = {
  passed: "bg-foreground/40",
  active: "bg-foreground",
  default: "bg-foreground/15",
};

const LINK: Record<ReturnType<typeof tocState>, string> = {
  passed: "text-muted-foreground",
  active: "text-foreground font-medium",
  default: "text-muted-foreground/60",
};
