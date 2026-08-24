"use client";

import { useEffect, useRef, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import type { Media } from "@/lib/data";
import { ALLOWED_TYPES, checkUploadFile } from "@/lib/upload-input";
import { cloudinaryThumb } from "@/lib/image-url";
import { uploadImageAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The admin's media island (spec §4.2) — the SECOND deliberate client-JS
 * exception in this codebase, after the prose editor, and bounded by one rule
 * recorded in CLAUDE.md:
 *
 *   The picker renders NOTHING until it mounts. Without script the form around
 *   it is byte-for-byte what it was, and no capture or edit ever depends on it.
 *
 * The second half of that rule is why `submitLabel` exists. A form whose only
 * meaningful content is this picker cannot keep a server-rendered submit
 * button: script-off, that button submits a form carrying nothing, which is a
 * form that visibly depends on the island. Such a form hands its button to the
 * picker, so script-off there is not a broken form — it is no form at all. The
 * capture bar keeps its own button, because its title, note and link fields
 * work perfectly without script.
 *
 * It owns one ORDERED list holding stored entries and newly uploaded ones
 * alike, and emits the whole list as repeated hidden fields — so reorder and
 * remove never cross the wire as operations (lib/media-input.ts).
 *
 * It never blocks a submit. In-flight and failed rows simply emit nothing;
 * the surrounding form posts without them. That is the whole of "media
 * pending": the capture survives, and the file is still on disk.
 */

type Row =
  | { key: string; state: "settled"; media: Media }
  | { key: string; state: "uploading"; file: File }
  | { key: string; state: "failed"; file: File; error: string };

export function MediaPicker({
  name,
  initial = [],
  links = false,
  max,
  submitLabel,
}: {
  /** The hidden field name — "image" on the capture bar, "media" on a sprout. */
  name: string;
  /** Stored entries to open with. Empty on the capture bar. */
  initial?: Media[];
  /** Offer an "add link" input, which joins the same ordered list. */
  links?: boolean;
  /**
   * Cap on how many entries the list may hold. Unset means no cap, which is
   * every surface but the plant Logo card — a plant has ONE mark.
   *
   * It withdraws the ADD controls when the list is full, never the editing
   * ones: a capped row stays removable, or a logo could never be changed once
   * set. Advisory, the way checkUploadFile is: buildPlantLogoPatch takes the
   * first image whatever arrives, so a crafted POST cannot use this to store
   * more than one.
   */
  max?: number;
  /**
   * Renders the form's submit button INSIDE the island when set.
   *
   * For a form whose entire meaningful content is this picker — the sprout
   * media card — a server-rendered submit button would still be clickable
   * without script, and would submit a form carrying nothing. The
   * `${name}__ready` marker makes that write safe, but "safe" is not the claim
   * CLAUDE.md makes: it says no edit ever DEPENDS on this island. A button that
   * appears to work, does nothing, and redirects as though it worked is a form
   * that plainly depends on it. Rendering the button here means script-off sees
   * no button at all, and the form is simply not operable — which is the rule,
   * literally.
   *
   * Omitted on the capture bar, whose submit belongs to the capture form and
   * must keep working without script.
   */
  submitLabel?: string;
}) {
  const [mounted, setMounted] = useState(false);
  // `initial` is read ONCE: past mount this list is the picker's own, and a
  // later `initial` prop is ignored — the same uncontrolled shape as
  // `initialMarkdown` in components/editor/prose-editor.tsx, and deliberate,
  // since re-seeding mid-edit would discard rows the user is still arranging.
  // A consumer that wants the saved server state back after a save gives the
  // component a `key` so React remounts it; the sprout media card does exactly
  // that.
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((media, i) => ({ key: `initial-${i}`, state: "settled" as const, media })),
  );
  const [link, setLink] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);

  // The rule above. A client component still server-renders its initial HTML,
  // so without this a script-off browser would be shown a file input that
  // cannot do anything.
  useEffect(() => setMounted(true), []);

  const patch = (key: string, next: Row) =>
    setRows((rs) => rs.map((r) => (r.key === key ? next : r)));

  const upload = async (key: string, file: File): Promise<void> => {
    const formData = new FormData();
    formData.set("file", file);
    try {
      const result = await uploadImageAction(formData);
      patch(
        key,
        result.ok
          ? { key, state: "settled", media: result.media }
          : { key, state: "failed", file, error: result.error },
      );
    } catch (e) {
      // A server action invoked directly from a client component returns its
      // redirect() as a REJECTED promise — see the long comment in
      // components/editor/prose-editor.tsx. uploadImageAction does not redirect
      // on success, but requireSession() does when the session has expired, and
      // presenting an expired session as an upload error would be wrong.
      unstable_rethrow(e);
      patch(key, { key, state: "failed", file, error: e instanceof Error ? e.message : "upload failed" });
    }
  };

  /**
   * The one path from a File to a row, so the dialog and Retry apply the guard
   * identically and a file that fails it is never sent.
   *
   * Advisory only — uploadImageAction re-checks and stays authoritative. This
   * exists so the message the user sees is checkUploadFile's ("the file is too
   * large (max 4MB)") rather than the platform's opaque body-size rejection,
   * which is what they would get for anything far over the limit:
   * next.config.ts's bodySizeLimit sits only 64KiB above MAX_UPLOAD_BYTES, so
   * it cannot be the thing that reports a 12MB phone photo. It also spares the
   * user a pointless 12MB upload, and makes Retry refuse instantly instead of
   * re-sending.
   */
  const rowFor = (key: string, file: File): Row => {
    const check = checkUploadFile({ size: file.size, type: file.type });
    return check.ok
      ? { key, state: "uploading", file }
      : { key, state: "failed", file, error: check.error };
  };

  const addFiles = (files: FileList | null): void => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const key = `row-${nextKey.current++}`;
      const row = rowFor(key, file);
      setRows((rs) => [...rs, row]);
      if (row.state === "uploading") void upload(key, file);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const retry = (key: string, file: File): void => {
    const row = rowFor(key, file);
    patch(key, row);
    if (row.state === "uploading") void upload(key, file);
  };

  const addLink = (): void => {
    const url = link.trim();
    if (!url) return;
    // Bare — no provider. detectEmbed runs SERVER-side (lib/media-input.ts), so
    // the browser never declares what a URL is. `provider` is required on
    // MediaEmbed, so "not declared" is spelled as the empty string:
    // validateMediaEntry treats an empty provider as absent and normalizeMedia
    // derives the real one, so an empty provider never reaches the database.
    setRows((rs) => [
      ...rs,
      { key: `row-${nextKey.current++}`, state: "settled", media: { kind: "embed", provider: "", url } },
    ]);
    setLink("");
  };

  // Addressed by key like every other operation, not by the index the click
  // came from: that index belongs to a render of a list that is React state,
  // and state lags a render behind (the hazard prose-editor.tsx documents for
  // its suggestion menu). Resolving the position inside the updater removes it.
  const move = (key: string, delta: number): void =>
    setRows((rs) => {
      const from = rs.findIndex((r) => r.key === key);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= rs.length) return rs;
      const next = [...rs];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });

  // Removing a row whose upload is still in flight orphans the Cloudinary
  // asset: the bytes have already left, and no abort would call them back.
  // An accepted cost, not an oversight — the alternative is tracking uploads
  // for deletion, which buys tidiness in a bucket nobody is paying attention
  // to. (The spec's "the file is still on disk" line covers failure, not this.)
  const remove = (key: string): void => setRows((rs) => rs.filter((r) => r.key !== key));

  const setAlt = (key: string, alt: string): void =>
    setRows((rs) =>
      rs.map((r) =>
        r.key === key && r.state === "settled" && r.media.kind === "image"
          ? { ...r, media: { ...r.media, alt } }
          : r,
      ),
    );

  if (!mounted) return null;

  const pending = rows.filter((r) => r.state !== "settled").length;
  // Counts EVERY row, in-flight and failed included. Counting only settled ones
  // would let a second file be picked while the first is still uploading, and
  // the cap would be breached the moment both landed.
  const full = max !== undefined && rows.length >= max;

  return (
    <div className="flex flex-col gap-3">
      {/* Proof that this island actually mounted.
          A list the admin emptied and a picker that never mounted both submit
          ZERO `${name}` fields, and they mean opposite things: the first is a
          deliberate clear-all, the second is a form that has no idea what it
          holds. Without this marker the server cannot tell them apart, and the
          destructive reading wins — a script-off save on a sprout would $set
          media:[] and silently delete every stored image. This is what makes
          CLAUDE.md's "no capture or edit ever depends on it" literally true
          rather than aspirational. */}
      <input type="hidden" name={`${name}__ready`} value="1" />

      {/* Withdrawn once the list is full — the cap is expressed by having
          nowhere to add, not by a disabled control explaining itself. */}
      {full ? null : (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${name}-file`}>Images</Label>
          {/* The registry Input, not a raw element: it already ships this
              project's file: styling, and Base UI's Field.Control forwards the
              ref to the real <input>, so the post-pick reset below still
              works. */}
          <Input
            id={`${name}-file`}
            ref={fileRef}
            type="file"
            accept={ALLOWED_TYPES.join(",")}
            multiple
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>
      )}

      {links && !full ? (
        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor={`${name}-link`}>Add a link</Label>
            <Input
              id={`${name}-link`}
              type="url"
              value={link}
              placeholder="paste a URL"
              onChange={(e) => setLink(e.target.value)}
              // Enter here would otherwise submit the whole form (implicit
              // submission finds the picker's own submit button) instead of
              // adding the link the author just typed — losing it.
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLink();
                }
              }}
            />
          </div>
          <Button type="button" variant="secondary" onClick={addLink}>
            Add
          </Button>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <li key={row.key} className="flex items-start gap-3 rounded-lg border p-2">
              <div className="flex flex-col gap-1">
                {/* index reaches these two only as decoration — what is
                    disabled, and what the label counts. The move itself is
                    addressed by key. */}
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Move item ${index + 1} up`}
                  onClick={() => move(row.key, -1)}
                  disabled={index === 0}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Move item ${index + 1} down`}
                  onClick={() => move(row.key, 1)}
                  disabled={index === rows.length - 1}
                >
                  ↓
                </Button>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {row.state === "settled" && row.media.kind === "image" ? (
                  <>
                    {/* 160px of pixels for an 80px box — 2x, so it stays sharp
                        on a retina display. This surface is the worst case for
                        painting originals, not the mildest: it shows a whole
                        media list at once, so five 4MB uploads meant 20MB
                        fetched to draw five squares. cloudinaryThumb asks
                        Cloudinary for the derivative instead, and returns a
                        non-Cloudinary URL untouched.
                        alt="" is right here and only here: the filename and the
                        alt-text field sit beside it, so announcing the image
                        would repeat what the row already says. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cloudinaryThumb(row.media.url, { width: 160, height: 160 })}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-20 w-20 rounded object-cover"
                    />
                    <Label htmlFor={`${name}-alt-${row.key}`}>Alt text</Label>
                    <Input
                      id={`${name}-alt-${row.key}`}
                      type="text"
                      value={row.media.alt ?? ""}
                      placeholder="describe the image"
                      onChange={(e) => setAlt(row.key, e.target.value)}
                    />
                    {/* An image with no alt renders alt="" on the public page,
                        which tells a screen reader the image is DECORATIVE and
                        to skip it. On a portfolio the image is often the work
                        itself, so that is a silent lie rather than a neutral
                        default — and nothing downstream can invent the sentence
                        an author never wrote. Said here because this is the one
                        moment someone can fix it. Deliberately not blocking:
                        some images really are decorative, and a save that
                        refuses is worse than a description that is missing. */}
                    {!row.media.alt?.trim() ? (
                      <span className="font-heading text-xs text-muted-foreground">
                        No description — screen readers will skip this image.
                      </span>
                    ) : null}
                  </>
                ) : row.state === "settled" ? (
                  <span className="min-w-0 break-all font-heading text-xs">{row.media.url}</span>
                ) : row.state === "uploading" ? (
                  <span className="font-heading text-xs text-muted-foreground">
                    Uploading {row.file.name}…
                  </span>
                ) : (
                  <span className="flex flex-wrap items-center gap-2 font-heading text-xs text-destructive">
                    {row.file.name}: {row.error}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => retry(row.key, row.file)}
                    >
                      Retry
                    </Button>
                  </span>
                )}
              </div>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Remove item ${index + 1}`}
                onClick={() => remove(row.key)}
              >
                Remove
              </Button>

              {/* Only SETTLED rows reach the server. An in-flight or failed row
                  emits nothing, which is what lets the form submit without it. */}
              {row.state === "settled" ? (
                <input type="hidden" name={name} value={JSON.stringify(row.media)} />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {pending > 0 ? (
        <p className="font-heading text-xs text-muted-foreground">
          {pending} not ready — saving now will leave {pending === 1 ? "it" : "them"} out. Nothing
          here blocks the save.
        </p>
      ) : null}

      {submitLabel ? (
        <div>
          <Button type="submit">{submitLabel}</Button>
        </div>
      ) : null}
    </div>
  );
}
