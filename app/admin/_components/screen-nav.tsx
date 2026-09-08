import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { screensHref } from "@/lib/screens";
import { SheetKeys } from "./sheet-keys";
import { Button } from "@/components/ui/button";

/**
 * The panel's header: previous, next, close — all three real links.
 *
 * They are `next/link` so the panel swaps in place (interception), and they are
 * `<a href>` underneath so the standalone page navigates perfectly without
 * script. Nothing here is a click handler and nothing here is `router.back()`:
 * "back" would leave the library when the author arrived by URL, and a handler
 * would make the whole navigation script-dependent to save nothing.
 *
 * prev/next walk the FILTERED list — the hrefs are computed by the page from
 * the same rows the grid drew, so the arrows stay inside the set the author is
 * working through. A screen with no neighbour renders a disabled span rather
 * than a dead link.
 */
export function ScreenNav({
  prev,
  next,
  query,
}: {
  prev: string | null;
  next: string | null;
  query: string;
}) {
  const prevHref = prev ? screensHref(prev, query) : null;
  const nextHref = next ? screensHref(next, query) : null;
  const closeHref = screensHref(null, query);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        <Arrow href={prevHref} label="Previous screen">
          <ChevronLeft className="size-4" />
        </Arrow>
        <Arrow href={nextHref} label="Next screen">
          <ChevronRight className="size-4" />
        </Arrow>
      </div>

      {/* The house idiom for a button that is really a link: the CHILDREN stay
          on the outer component and the `render` element is empty — see
          components/ui/dialog.tsx's DialogPrimitive.Close. `Button` is Base
          UI's, so `render` is the primitive's own prop. */}
      <Button render={<Link href={closeHref} aria-label="Close" />} size="icon" variant="ghost">
        <X className="size-4" />
      </Button>

      <SheetKeys prev={prevHref} next={nextHref} close={closeHref} />
    </div>
  );
}

function Arrow({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: React.ReactNode;
}) {
  if (!href) {
    return (
      <span aria-hidden className="flex size-8 items-center justify-center text-muted-foreground/40">
        {children}
      </span>
    );
  }
  return (
    <Button render={<Link href={href} aria-label={label} />} size="icon" variant="ghost">
      {children}
    </Button>
  );
}
