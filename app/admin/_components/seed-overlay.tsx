"use client";

import { useEffect, useRef, useState } from "react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Link2, Plus, Send } from "lucide-react";
import { createSeedAction } from "../actions";
import { MediaPicker } from "@/components/admin/media-picker";
import { OverlaySheet } from "./overlay-sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
 * The shell is `OverlaySheet` — the registry's dialog primitive rather than a
 * hand-rolled one, so the modal claim is actually enforced: focus containment,
 * scroll lock, inert background, Escape dismissal and focus restoration all
 * come from `Dialog.Root`'s `modal` default rather than from this file. That
 * sheet is shared with the plant page's Meta and Role overlays now; it carries
 * the shell ONLY, and this file keeps its own form and its own action.
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

  // A rejected save redirects to /admin/inbox?error=… — and the form it came
  // from is no longer on the page, so the banner would have nowhere to live.
  // Reopen onto it rather than bounce the author to a page that says nothing
  // went wrong. (Their text is gone either way; the message is what is
  // salvageable.)
  useEffect(() => {
    if (error) setOpen(true);
  }, [error]);

  // createSeedAction redirects to /admin/inbox, which is the page this overlay
  // is rendered on — so that redirect is a SOFT navigation: this component
  // keeps its place in the tree, and nothing here resets itself. A save is
  // therefore detected the only way the client honestly can: the server
  // re-rendered the page with one more seed in the inbox. Closing unmounts the
  // popup, and with it the MediaPicker, which is what clears its rows;
  // `firstLink` is this component's own state and has to be cleared by hand.
  // Without this the next capture inherits the previous one's link and images.
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

  // A rejected save leaves the author on /admin/inbox?error=…, and the param
  // outlives the overlay: close it, reload, and the banner comes back about a
  // seed that no longer exists in any field. Dropped on close with replaceState
  // rather than a router push — this is tidying the URL, not a navigation, and a
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

      <OverlaySheet
        open={open}
        onOpenChange={handleOpenChange}
        label="New seed"
        initialFocus={titleRef}
        finalFocus={plusRef}
      >
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
      </OverlaySheet>
    </>
  );
}
