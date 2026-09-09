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
 * `ignoreInputs` is stated on Escape and left default on the arrows, and the
 * asymmetry is the library's rather than a preference. `getDefaultIgnoreInputs`
 * in @tanstack/hotkeys returns `true` for a bare single key — so ← and → are
 * already dead while the caret is in a field, and `isInputElement` counts a
 * `<select>` too, which is what keeps them from hijacking the Plant and Shows
 * dropdowns. Escape is the one key it opts OUT (`if (parsedHotkey.key ===
 * "Escape") return false`), on the reasoning that a dialog should close from
 * inside its own form.
 *
 * That reasoning does not hold here, because this Escape does not close a
 * dialog — it NAVIGATES. Left to the default, one Escape with the caret in Name
 * or Legend (the reflex for dismissing a browser autofill dropdown) unmounts
 * the form and takes every unsaved field with it, and in the Image card it
 * strands a Cloudinary asset that was uploaded on selection and never saved.
 * So it is stated.
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

  useHotkey("Escape", () => router.push(close), { ignoreInputs: true });
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
