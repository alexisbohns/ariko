"use client";

import { useEffect, useRef, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import type { Media } from "@/lib/data";
import { ALLOWED_TYPES, checkUploadFile } from "@/lib/upload-input";
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
}: {
  /** The hidden field name — "image" on the capture bar, "media" on a sprout. */
  name: string;
  /** Stored entries to open with. Empty on the capture bar. */
  initial?: Media[];
  /** Offer an "add link" input, which joins the same ordered list. */
  links?: boolean;
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

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${name}-file`}>Images</Label>
        {/* The registry Input, not a raw element: it already ships this
            project's file: styling, and Base UI's Field.Control forwards the
            ref to the real <input>, so the post-pick reset below still works. */}
        <Input
          id={`${name}-file`}
          ref={fileRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          multiple
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {links ? (
        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor={`${name}-link`}>Add a link</Label>
            <Input
              id={`${name}-link`}
              type="url"
              value={link}
              placeholder="paste a URL"
              onChange={(e) => setLink(e.target.value)}
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
                    {/* The full-size original, painted into an 80px square: five
                        4MB uploads is 20MB fetched to draw five thumbnails.
                        Accepted on a single-admin surface; a Cloudinary
                        transformation is the fix if it ever matters. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={row.media.url} alt="" className="h-20 w-20 rounded object-cover" />
                    <Label htmlFor={`${name}-alt-${row.key}`}>Alt text</Label>
                    <Input
                      id={`${name}-alt-${row.key}`}
                      type="text"
                      value={row.media.alt ?? ""}
                      placeholder="describe the image"
                      onChange={(e) => setAlt(row.key, e.target.value)}
                    />
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
    </div>
  );
}
