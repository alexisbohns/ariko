"use client";

import { useEffect, useRef, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import type { Media } from "@/lib/data";
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

  const addFiles = (files: FileList | null): void => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const key = `row-${nextKey.current++}`;
      setRows((rs) => [...rs, { key, state: "uploading", file }]);
      void upload(key, file);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const addLink = (): void => {
    const url = link.trim();
    if (!url) return;
    // Bare — no provider. detectEmbed runs SERVER-side (lib/media-input.ts), so
    // the browser never declares what a URL is.
    setRows((rs) => [
      ...rs,
      { key: `row-${nextKey.current++}`, state: "settled", media: { kind: "embed", provider: "", url } },
    ]);
    setLink("");
  };

  const move = (index: number, delta: number): void =>
    setRows((rs) => {
      const to = index + delta;
      if (to < 0 || to >= rs.length) return rs;
      const next = [...rs];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });

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
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${name}-file`}>Images</Label>
        <input
          id={`${name}-file`}
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
          multiple
          onChange={(e) => addFiles(e.target.files)}
          className="text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1 file:text-sm"
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
                <Button type="button" size="sm" variant="ghost" onClick={() => move(index, -1)} disabled={index === 0}>
                  ↑
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => move(index, 1)}
                  disabled={index === rows.length - 1}
                >
                  ↓
                </Button>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {row.state === "settled" && row.media.kind === "image" ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={row.media.url} alt="" className="h-20 w-20 rounded object-cover" />
                    <Input
                      type="text"
                      value={row.media.alt ?? ""}
                      placeholder="alt text (describe the image)"
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
                    <Button type="button" size="sm" variant="secondary" onClick={() => {
                      patch(row.key, { key: row.key, state: "uploading", file: row.file });
                      void upload(row.key, row.file);
                    }}>
                      Retry
                    </Button>
                  </span>
                )}
              </div>

              <Button type="button" size="sm" variant="ghost" onClick={() => remove(row.key)}>
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
