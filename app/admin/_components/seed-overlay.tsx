"use client";

import { useEffect, useState } from "react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { Link2, Plus, Send, X } from "lucide-react";
import { createSeedAction } from "../actions";
import { MediaPicker } from "@/components/admin/media-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Seed capture — the THIRD deliberate client-JS exception in this codebase,
 * after the prose editor and the media picker, and unlike those two it is a
 * real loss rather than a contained one: without script there is no way to
 * capture a seed at all. Recorded as such in CLAUDE.md. An overlay that opens
 * on a keystroke, autofocuses and blurs the page behind it cannot exist without
 * script, and the alternative — a second server-rendered form at its own route,
 * writing the same seed — would be maintained by nobody.
 *
 * The exception is the SHELL, never the write path: this posts to
 * createSeedAction with the field names lib/seed-form.ts already reads
 * (`title`, `note`, `lang`, repeated `link`, `image` + `image__ready`).
 *
 * Native inputs styled to look like bare text, not contenteditable. The
 * rendered result is the same and the native ones keep accented input, undo,
 * `required` validation and autofocus for free, with nothing to sync.
 */

const FIELD =
  "w-full border-0 bg-transparent outline-none placeholder:text-muted-foreground/40 focus:outline-none";

export function SeedOverlay({ error }: { error?: string }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");
  const [firstLink, setFirstLink] = useState("");

  // A rejected save redirects to /admin?error=… — and the form it came from is
  // no longer on the page, so the banner would have nowhere to live. Reopen
  // onto it rather than bounce the author to a page that says nothing went
  // wrong. (Their text is gone either way; the message is what is salvageable.)
  useEffect(() => {
    if (error) setOpen(true);
  }, [error]);

  // The library's defaults are the ones this wants, and are relied on
  // deliberately: a bare single key defaults to ignoreInputs:true, so "k" does
  // not fire while the author is typing — including into this overlay's own
  // fields — while Escape defaults to ignoreInputs:false, so it closes from
  // inside the title input.
  //
  // The key name is spelled "K": the library canonicalises letter keys to
  // uppercase (normalizeKeyName("k") === "K") and carries Shift as a separate
  // flag, so this is an unshifted "k" press, not Shift+K.
  useHotkey("K", () => setOpen(true), { enabled: !open });
  useHotkey("Escape", () => setOpen(false), { enabled: open });

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="New seed"
        title="New seed (k)"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New seed"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/70 p-6 backdrop-blur-xl"
          // Only a press that both starts and ends on the backdrop itself
          // dismisses — a drag that began inside the form and released outside
          // is a text selection, not a dismissal.
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Close"
            className="absolute right-4 top-4"
            onClick={() => setOpen(false)}
          >
            <X className="size-4" />
          </Button>

          <form action={createSeedAction} className="flex w-full max-w-xl flex-col gap-6">
            {error ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>Could not save: {error}</AlertDescription>
              </Alert>
            ) : null}

            <input type="hidden" name="lang" value={lang} />

            <input
              type="text"
              name="title"
              required
              autoFocus
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
        </div>
      ) : null}
    </>
  );
}
