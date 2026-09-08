"use client";

import { useRouter } from "next/navigation";
import { useHotkey } from "@tanstack/react-hotkeys";

/**
 * Escape closes, ← and → walk the list. Renders NOTHING.
 *
 * The vault filters' category of affordance, not an exception: every key here
 * is bound over an href that is already on the page as a link, so script-off
 * costs the KEYS and never a destination. It is given the hrefs rather than
 * computing them, so this file never learns the library's URL grammar.
 *
 * A bare single key defaults to `ignoreInputs: true` in @tanstack/react-hotkeys,
 * so none of these fire while the author is typing in the legend field.
 */
export function SheetKeys({
  prev,
  next,
  close,
}: {
  prev: string | null;
  next: string | null;
  close: string;
}) {
  const router = useRouter();

  useHotkey("Escape", () => router.push(close));
  useHotkey(
    "ArrowLeft",
    () => {
      if (prev) router.push(prev);
    },
    { enabled: prev !== null },
  );
  useHotkey(
    "ArrowRight",
    () => {
      if (next) router.push(next);
    },
    { enabled: next !== null },
  );

  return null;
}
