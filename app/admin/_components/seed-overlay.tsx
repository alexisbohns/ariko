"use client";

import { useEffect, useRef, useState } from "react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Link2, Plus, Send, X } from "lucide-react";
import { createSeedAction } from "../actions";
import { MediaPicker } from "@/components/admin/media-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Seed capture — the THIRD deliberate client-JS exception in this codebase,
 * after the prose editor and the media picker, and unlike those two it is a
 * real loss rather than a contained one: without script there is no way to
 * capture a seed at all. Recorded as such in CLAUDE.md. An overlay that opens
 * on a keystroke, autofocuses and blurs the page behind it cannot exist without
 * script, and the alternative — a second server-rendered form at its own route,
 * writing the same seed — would be maintained by nobody.
 *
 * The shell is the registry's dialog primitive rather than a hand-rolled one,
 * so the modal claim is actually enforced: focus containment, scroll lock,
 * inert background, Escape dismissal and focus restoration all come from
 * `Dialog.Root`'s `modal` default rather than from this file. Outside-press
 * dismissal is the one exception, hand-rolled on the backdrop below, because
 * the popup is full-bleed and so nothing is ever "outside" it for the
 * primitive to catch.
 *
 * The exception is the SHELL, never the write path: this posts to
 * createSeedAction with the field names lib/seed-form.ts already reads
 * (`title`, `note`, `lang`, repeated `link`, `image`). The picker also emits
 * its `image__ready` marker here, but nothing on this path reads it —
 * buildSeedBody does not, and only buildMediaPatch/buildPlantLogoPatch ever
 * do. A create has no stored list to clear, so the marker is inert.
 *
 * Native inputs styled to look like bare text, not contenteditable. The
 * rendered result is the same and the native ones keep accented input, undo,
 * `required` validation and autofocus for free, with nothing to sync.
 */

const FIELD =
  "w-full border-0 bg-transparent outline-none placeholder:text-muted-foreground/40 focus:outline-none";

export function SeedOverlay({ error, inboxCount }: { error?: string; inboxCount: number }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");
  const [firstLink, setFirstLink] = useState("");
  // The overlay's own record of how big the inbox was when it last saw it.
  const [seenCount, setSeenCount] = useState(inboxCount);

  // The dialog is opened from two places (the button and the `k` hotkey), so
  // it is controlled rather than trigger-driven — which means the primitive
  // cannot infer where focus came from. Name both ends explicitly: focus lands
  // on the title on open, and returns to the `+` on close whichever way it
  // was opened.
  const plusRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // A rejected save redirects to /admin?error=… — and the form it came from is
  // no longer on the page, so the banner would have nowhere to live. Reopen
  // onto it rather than bounce the author to a page that says nothing went
  // wrong. (Their text is gone either way; the message is what is salvageable.)
  useEffect(() => {
    if (error) setOpen(true);
  }, [error]);

  // createSeedAction redirects to /admin, which from /admin is a SOFT
  // navigation — this component keeps its place in the tree, so nothing here
  // resets itself. A save is therefore detected the only way the client
  // honestly can: the server re-rendered the page with one more seed in the
  // inbox. Closing unmounts the popup, and with it the MediaPicker, which is
  // what clears its rows; `firstLink` is this component's own state and has to
  // be cleared by hand. Without this the next capture inherits the previous
  // one's link and images.
  //
  // It composes with the error effect above rather than fighting it: a rejected
  // save leaves the inbox exactly as big as it was, so this does not fire and
  // the overlay stays open on its banner.
  useEffect(() => {
    if (inboxCount !== seenCount) {
      setSeenCount(inboxCount);
      setOpen(false);
      setFirstLink("");
    }
  }, [inboxCount, seenCount]);

  // The library's defaults are the ones this wants, and are relied on
  // deliberately: a bare single key defaults to ignoreInputs:true, so "k" does
  // not fire while the author is typing — including into this overlay's own
  // fields.
  //
  // The key name is spelled "K": the library canonicalises letter keys to
  // uppercase (normalizeKeyName("k") === "K") and carries Shift as a separate
  // flag, so this is an unshifted "k" press, not Shift+K.
  //
  // There is no Escape hotkey any more: Dialog.Root closes on Escape itself
  // (the `escapeKey` reason on onOpenChange), and a second handler would only
  // race it.
  useHotkey("K", () => setOpen(true), { enabled: !open });

  // A rejected save leaves the author on /admin?error=…, and the param outlives
  // the overlay: close it, reload, and the banner comes back about a seed that
  // no longer exists in any field. Dropped on close with replaceState rather
  // than a router push — this is tidying the URL, not a navigation, and a
  // navigation here would re-render the page under the closing dialog.
  const handleOpenChange = (next: boolean): void => {
    setOpen(next);
    if (!next && typeof window !== "undefined" && window.location.search) {
      const url = new URL(window.location.href);
      if (url.searchParams.has("error")) {
        url.searchParams.delete("error");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
    }
  };

  return (
    <>
      {/* Its own provider: AdminChrome's wraps only the rail and the top-right
          cluster, and the overlay is rendered by the page, outside both. */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                ref={plusRef}
                type="button"
                size="icon"
                variant="ghost"
                aria-label="New seed"
                onClick={() => setOpen(true)}
              >
                <Plus className="size-4" />
              </Button>
            }
          />
          <TooltipContent side="bottom">New seed (k)</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogPortal>
          {/* The blurred surface itself. The popup above it is transparent and
              full-bleed, so the two together are the single blurred sheet this
              overlay has always been, rather than a card on a scrim. */}
          <DialogOverlay className="z-50 bg-background/70 backdrop-blur-xl supports-backdrop-filter:backdrop-blur-xl" />
          <DialogPopup
            aria-label="New seed"
            initialFocus={titleRef}
            finalFocus={plusRef}
            // The fade matches the one the registry's backdrop already
            // carries, so the sheet arrives as one surface rather than a
            // fading blur with an instant form on top of it.
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-6 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
            // The popup covers the viewport, so nothing is ever "outside" it
            // for the primitive's own outside-press dismissal to catch. Only a
            // press that both starts and ends on the empty surround dismisses —
            // a drag that began inside the form and released outside is a text
            // selection, not a dismissal.
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) handleOpenChange(false);
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
              <X className="size-4" />
            </DialogClose>

            <form action={createSeedAction} className="flex w-full max-w-xl flex-col gap-6">
              {error ? (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>Could not save: {error}</AlertDescription>
                </Alert>
              ) : null}

              <input type="hidden" name="lang" value={lang} />

              <input
                ref={titleRef}
                type="text"
                name="title"
                required
                aria-label="Title"
                placeholder="What is it?"
                className={`${FIELD} text-center font-heading text-3xl tracking-tight`}
              />

              {/* field-sizing-content is Tailwind v4's `field-sizing: content` —
                  the textarea grows with its text, with no JS measuring it. */}
              <textarea
                name="note"
                rows={2}
                aria-label="Note"
                placeholder="Say more…"
                className={`${FIELD} field-sizing-content resize-none text-center text-base`}
              />

              <div className="flex items-center gap-3 border-t pt-4">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Note language: ${lang === "en" ? "English" : "French"}`}
                  onClick={() => setLang((l) => (l === "en" ? "fr" : "en"))}
                >
                  <span className="text-base leading-none">{lang === "en" ? "🇬🇧" : "🇫🇷"}</span>
                </Button>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Link2 className="size-4 shrink-0 text-muted-foreground" />
                    <input
                      type="url"
                      name="link"
                      value={firstLink}
                      onChange={(e) => setFirstLink(e.target.value)}
                      aria-label="Link"
                      placeholder="paste a URL"
                      className={`${FIELD} min-w-0 flex-1 text-sm`}
                    />
                  </div>
                  {/* The second slot appears once the first is used. Both post
                      under `link`; buildSeedBody reads getAll("link") and drops
                      the blanks. */}
                  {firstLink.trim() ? (
                    <div className="flex items-center gap-2">
                      <Link2 className="size-4 shrink-0 text-muted-foreground" />
                      <input
                        type="url"
                        name="link"
                        aria-label="Another link"
                        placeholder="another URL"
                        className={`${FIELD} min-w-0 flex-1 text-sm`}
                      />
                    </div>
                  ) : null}
                </div>

                <MediaPicker name="image" compact />

                <Button type="submit" size="icon" aria-label="Add to inbox" className="rounded-full">
                  <Send className="size-4" />
                </Button>
              </div>
            </form>
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </>
  );
}
