"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
} from "@/components/ui/dialog";
import { PhoneFrame } from "@/components/phone-frame";
import type { ExhibitionRow } from "@/lib/exhibition";
import { cloudinaryFit } from "@/lib/image-url";
import { isPlainClick, SCREEN_ANCHOR_ATTR, stepScreen, swipeStep } from "@/lib/screen-lightbox";

/**
 * The exhibition, one screen at a time and large — and the public zone's
 * THIRD client island.
 *
 * It is built to the TOC rail's standard rather than the preferences menu's:
 * it renders NOTHING until it mounts, so script-off the plant page is
 * byte-for-byte what it was, and its absence costs nothing but itself. Every
 * screen in `components/screen-strip.tsx` is already a real `<a href>` to the
 * full image, server-rendered by the gallery; this island INTERCEPTS those
 * clicks and never supplies a destination of its own. Script-off (or before
 * hydration, or on a modified click) the browser opens the image natively.
 * lib/screen-lightbox-mount.test.ts pins the first half, and
 * components/screen-strip.test.tsx pins that the anchors it reads are there.
 *
 * It is an island because a phone at strip size is small — about 200px wide —
 * and a legend cannot substitute for seeing the screen. Base UI's
 * Dialog rather than a hand-rolled overlay, for the focus trap, the scroll
 * lock, the inert page behind it and Escape. The CSS-label exception in
 * `components/chrome.tsx` is for chrome clusters magnetized to a viewport
 * corner, which this is not.
 *
 * `lucide-react` is imported directly, for the preferences menu's reason: the
 * ban is on lucide in a SERVER-SAFE file, and this file IS a declared client
 * boundary.
 *
 * It never writes: no form, no server action, no URL change. Opening a screen
 * is not a navigation, so Back leaves the page rather than closing the
 * overlay — the same as every other dialog on the site.
 */
export function ScreenLightbox({ rows, plantName }: { rows: ExhibitionRow[]; plantName: string }) {
  // The gate lives in this OUTER component so no browser-only hook runs during
  // a server render — lib/toc-mount.test.ts explains why the split is forced
  // (the rules of hooks) rather than chosen.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || rows.length === 0) return null;
  return <MountedScreenLightbox rows={rows} plantName={plantName} />;
}

/** The derivative the lightbox asks for — about twice the widest phone it
 *  paints (28rem), for a retina display. Shared by the render and the
 *  neighbour preload so the preload is a cache hit rather than a second
 *  request for a different URL. */
const LIGHTBOX_WIDTH = 900;

/**
 * How wide the phone may be, so the WHOLE phone fits: never wider than the
 * viewport allows, never taller than the viewport's height less the room the
 * close button, the legend and the arrows need beneath it.
 *
 * Height is the binding constraint on a desktop, where a portrait screen at
 * the viewport's width would be three screens tall. The image's stored ratio
 * turns a height budget into a width, which is the only dimension `PhoneFrame`
 * takes. Uploads record both dimensions (lib/storage.ts); a screen without
 * them falls back to a width alone and the sheet scrolls if it must — a
 * missing measurement costs fit, never the image.
 *
 * FLOORED at the strip's own phone width (`min(52vw, 13rem)` there, so
 * `min(88vw, 13rem)` here is never narrower). On a phone held sideways the
 * height budget is a hundred-odd pixels, and without the floor the lightbox
 * would draw the screen SMALLER than the strip it was opened from — at 208px
 * of height, not at all. Below the floor the sheet scrolls instead, which is
 * what its `overflow-y-auto` is for.
 */
function phoneWidth(row: ExhibitionRow): CSSProperties {
  const { width, height } = row.image;
  if (width && height) {
    return {
      width: `max(min(88vw, 13rem), min(88vw, 28rem, calc((100dvh - 13rem) * ${width / height})))`,
    };
  }
  return { width: "min(88vw, 22rem)" };
}

function anchorFor(slug: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`a[${SCREEN_ANCHOR_ATTR}="${CSS.escape(slug)}"]`);
}

function MountedScreenLightbox({ rows, plantName }: { rows: ExhibitionRow[]; plantName: string }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const announcementId = useId();

  // One listener on the document rather than one per anchor: the anchors are
  // the gallery's, server-rendered, and the island only ever READS them. The
  // slug on the anchor must also be one of THIS exhibition's rows, so a stray
  // attribute elsewhere can never open an empty lightbox.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest(`a[${SCREEN_ANCHOR_ATTR}]`);
      if (!anchor) return;
      const at = rows.findIndex((row) => row.slug === anchor.getAttribute(SCREEN_ANCHOR_ATTR));
      if (at === -1 || !isPlainClick(event)) return;
      event.preventDefault();
      setIndex(at);
      setOpen(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [rows]);

  // Warm the neighbours, so an arrow press lands on an image already in the
  // cache rather than on an empty bezel.
  useEffect(() => {
    if (!open) return;
    for (const near of [index - 1, index + 1]) {
      const row = rows[near];
      if (row) new Image().src = cloudinaryFit(row.image.url, { width: LIGHTBOX_WIDTH });
    }
  }, [open, index, rows]);

  const go = (delta: number) => {
    const next = stepScreen(index, delta, rows.length);
    if (next !== null) setIndex(next);
  };

  const row = rows[index] ?? rows[0];
  const caption = row.legend || row.name;
  const many = rows.length > 1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPortal>
        <DialogOverlay className="z-50 bg-background/80 backdrop-blur-xl supports-backdrop-filter:backdrop-blur-xl" />
        <DialogPopup
          aria-label={`Screens from ${plantName}`}
          // Back to the anchor of the screen that is SHOWING, not the one that
          // was clicked: a visitor who arrowed from the second screen to the
          // fifth and pressed Escape is on the fifth, and focusing its anchor
          // also scrolls the strip to it. The default (`true`) is the fallback
          // should the anchor somehow be gone.
          finalFocus={() => anchorFor(row.slug) ?? true}
          // Announce WHICH screen opened, not only that a dialog did: focus
          // lands on Close, so without this a screen-reader visitor has to go
          // looking for the image. The live region below is the description,
          // so the words on open and on each step are the same words.
          aria-describedby={announcementId}
          // `touch-pan-y` hands horizontal movement to the swipe below rather
          // than to the browser, and keeps a short viewport's vertical scroll.
          // `touch-pinch-zoom` is NOT optional: `pan-y` alone disables pinch,
          // and zooming into a screenshot is the one thing the browser's own
          // image view — the script-off fallback — lets a phone visitor do.
          // An enhancement must not take it away.
          className="fixed inset-0 z-50 flex touch-pan-y touch-pinch-zoom flex-col overflow-y-auto p-6 pt-16 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
          // The popup is full-bleed, so nothing is ever "outside" it for the
          // primitive's outside-press to catch — the admin's OverlaySheet
          // hand-rolls the same thing for the same reason. Only a press that
          // lands on the empty surround itself closes.
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
          onKeyDown={(event) => {
            // A modified arrow is the browser's — ⌘← and Alt+← are Back.
            // `isPlainClick`'s rule, applied to the keyboard.
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            const delta = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
            if (delta === 0) return;
            event.preventDefault();
            go(delta);
          }}
          // ONE finger only. A second finger makes the gesture a pinch, and a
          // pinch whose fingers happen to spread sideways would otherwise read
          // as a swipe and change the screen under the zoom. Once a gesture
          // has been a pinch it stays void until every finger has lifted.
          onTouchStart={(event: TouchEvent) => {
            const touch = event.touches[0];
            touchStart.current =
              event.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY } : null;
          }}
          onTouchEnd={(event: TouchEvent) => {
            if (event.touches.length > 0) {
              touchStart.current = null;
              return;
            }
            const start = touchStart.current;
            const touch = event.changedTouches[0];
            touchStart.current = null;
            if (!start || !touch) return;
            const delta = swipeStep(touch.clientX - start.x, touch.clientY - start.y);
            if (delta !== 0) go(delta);
          }}
        >
          <DialogClose
            render={
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Close"
                className="absolute right-4 top-4"
              />
            }
          >
            <X className="size-4" aria-hidden="true" />
          </DialogClose>

          {/* `my-auto` rather than `justify-center` on the popup: auto margins
              centre the content while it fits and give way when it does not,
              where `justify-center` on an overflowing column pushes its top
              out of reach of the scroll. */}
          <div className="mx-auto my-auto flex flex-col items-center gap-4">
            <figure className="flex flex-col items-center gap-3" style={phoneWidth(row)}>
              <PhoneFrame
                // Keyed so a step REPLACES the <img> rather than swapping its
                // src: a swapped src can keep painting the previous screen
                // under the next screen's legend until the new one decodes.
                key={row.slug}
                image={row.image}
                // The screen IS the content, as in the strip.
                alt={row.image.alt ?? ""}
                width={LIGHTBOX_WIDTH}
                className="w-full"
              />
              {/* The legend travels with the image, and it is the same words
                  the strip shows under it — the name when there is none. */}
              <figcaption className="text-center font-heading text-xs leading-relaxed text-muted-foreground">
                {caption}
              </figcaption>
            </figure>

            {many ? (
              <div className="flex items-center gap-3">
                {/* `focusableWhenDisabled` is load-bearing: arrowing to the
                    last screen disables the button that has focus, and a
                    plain `disabled` would drop focus to <body> — outside the
                    popup, where the arrow keys are no longer heard. */}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Previous screen"
                  disabled={index === 0}
                  focusableWhenDisabled
                  onClick={() => go(-1)}
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </Button>
                <span aria-hidden="true" className="font-heading text-xs tabular-nums text-muted-foreground">
                  {index + 1} / {rows.length}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Next screen"
                  disabled={index === rows.length - 1}
                  focusableWhenDisabled
                  onClick={() => go(1)}
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ) : null}
          </div>

          {/* What a screen-reader visitor hears on each step. The counter above
              is hidden from them because "2 slash 5" says it worse. */}
          <p id={announcementId} className="sr-only" aria-live="polite">
            {many ? `Screen ${index + 1} of ${rows.length}: ${caption}` : caption}
          </p>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
