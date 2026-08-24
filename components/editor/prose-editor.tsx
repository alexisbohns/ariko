"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { normalizeEmptyListMarkers } from "@/lib/entity-markdown";
import type { EntityOption } from "@/lib/entity-options";
import { buildEditorExtensions, type MenuState } from "./editor-extensions";
import { SuggestionMenu } from "./suggestion-menu";
import { Button } from "@/components/ui/button";
import { uploadImageAction } from "@/app/admin/actions";
import { checkUploadFile, ALLOWED_TYPES } from "@/lib/upload-input";

export function ProseEditor({
  initialMarkdown,
  entities,
  action,
  hidden,
}: {
  initialMarkdown: string;
  entities: EntityOption[];
  /** The server action this form posts to. */
  action: (formData: FormData) => Promise<void>;
  /** Identifying fields the action needs, e.g. { slug } or { ref }. */
  hidden: Record<string, string>;
}) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [pending, startTransition] = useTransition();
  const [unchanged, setUnchanged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mirrors `menu` for the keydown handler, which runs outside React's render
  // and would otherwise close over a stale index.
  const menuRef = useRef<MenuState | null>(null);
  // The editor's OWN serialization of the loaded document (set in onCreate),
  // not the stored `initialMarkdown` prop. Those differ by normalization on
  // essentially every real document — a blank line between adjacent entity
  // cards, table cell padding, `&` -> `&amp;` — which is why comparing the
  // save-time serialization against the *stored* string server-side never
  // detects "unchanged" (spec §2.5). Comparing against the editor's own first
  // serialization does, because save-time re-serialization of an untouched
  // document is idempotent.
  const baselineRef = useRef<string | null>(null);

  // The `/image` command's async half. The extension deletes the typed text
  // and calls onInsertImage; this opens the picker, uploads through the same
  // server action the media picker uses, and inserts at the cursor the
  // deletion left behind.
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  // Mirrors `imageBusy` for `onInsertImage`, for exactly the reason `menuRef`
  // mirrors `menu` above: that callback is captured in the useMemo below,
  // which the editor reads ONCE at mount (see its comment), so reading the
  // `imageBusy` STATE there would close over `false` forever and the
  // one-at-a-time guard would never fire.
  const imageBusyRef = useRef(false);

  const show = (next: MenuState | null): void => {
    menuRef.current = next;
    setMenu(next);
  };

  // Same ref-alongside-state shape as `show`.
  const setBusy = (next: boolean): void => {
    imageBusyRef.current = next;
    setImageBusy(next);
  };

  // The schema, markdown wiring, and `@`/`/` suggestion plugins — built by
  // the same function lib/editor-mount.test.ts drives against a real headless
  // Editor, so a defect in this array (like two suggestion plugins sharing a
  // key, 65bb5ff) is something a test can catch.
  //
  // This dependency array does not do what it implies: useEditor(options)
  // below is called with no `deps` argument, which defaults to `[]`
  // (@tiptap/react), so it builds the Editor instance exactly once, at
  // mount, from whatever `extensions` this useMemo returned on the FIRST
  // render. A later `entities` change recomputes this array, but the
  // running editor never sees it — the @ and / pickers stay frozen with
  // the entity list that existed at mount. Harmless in practice:
  // ContentCard is a server component that rebuilds `entities` fresh on
  // every page request (app/admin/_components/content-card.tsx), so
  // ProseEditor is never kept mounted across an `entities` change — but
  // that is a property of how this component happens to be used, not
  // something this hook enforces.
  const extensions = useMemo(
    () =>
      buildEditorExtensions({
        entities,
        onMenu: show,
        getMenu: () => menuRef.current,
        onInsertImage: () => {
          // One at a time. Without this the author, seeing no feedback, runs
          // /image again and both uploads resolve into two inserted images.
          if (imageBusyRef.current) return;
          imageInputRef.current?.click();
        },
      }),
    [entities],
  );

  const editor = useEditor({
    extensions,
    // normalizeEmptyListMarkers: see lib/entity-markdown.ts — works around a
    // marked parsing bug that otherwise loses an empty list item (and
    // anything nested under it, including a card) the instant a stored
    // document with one is opened (defect I2).
    content: normalizeEmptyListMarkers(initialMarkdown),
    contentType: "markdown",
    immediatelyRender: false, // Next SSR: the editor mounts on the client only.
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none dark:prose-invert min-h-48 focus:outline-none",
      },
    },
    onCreate: ({ editor }) => {
      baselineRef.current = editor.getMarkdown();
    },
    onUpdate: () => setUnchanged(false),
  });

  const save = (): void => {
    if (!editor) return;
    const markdown = editor.getMarkdown();
    if (baselineRef.current !== null && markdown === baselineRef.current) {
      // Nothing the author did changed the document (undo back to the
      // original lands here too, correctly). Do not call the action at all: a
      // scheduled bee writes these digests, and reading one must never
      // rewrite it (spec §2.5).
      setUnchanged(true);
      return;
    }
    setUnchanged(false);
    setError(null);
    const formData = new FormData();
    for (const [key, value] of Object.entries(hidden)) formData.set(key, value);
    // The serialize step (spec §2.3): markdown is what the database stores, and
    // the editor is only ever a surface over it.
    formData.set("content", markdown);
    // I5: React 19 keeps `isPending` true across an async transition only
    // when the scope callback RETURNS the promise — `startTransition(() =>
    // { void action(formData) })` returns undefined, so `pending` flipped
    // back before the request settled ("Saving…" never really showed, the
    // button re-enabled mid-flight) and `void` discarded every rejection, so
    // a server error was an unhandled rejection with no user-visible signal.
    // Awaiting inside the transition fixes both.
    //
    // Every action passed in here (editContentAction / editContainerContentAction,
    // app/admin/actions.ts) ends with a `redirect()` on success — and a
    // client component invoking a server action directly (not through
    // `<form action>`) gets that redirect back as a REJECTED promise: Next's
    // server-action reducer resolves the underlying page navigation itself
    // and then explicitly rejects the action's promise with a NEXT_REDIRECT
    // digest error so RedirectBoundary can catch it and reset this
    // component's tree (see next/dist/client/components/router-reducer/
    // reducers/server-action-reducer.js). That rejection is control flow,
    // not failure — presenting it as a save error would be wrong on the
    // common (successful) path. unstable_rethrow is Next's documented way to
    // tell the two apart: it rethrows redirect/notFound errors so the
    // framework still handles them, and no-ops on anything else.
    startTransition(async () => {
      try {
        await action(formData);
      } catch (e) {
        unstable_rethrow(e);
        setError(e instanceof Error ? e.message : "could not save content");
      }
    });
  };

  const insertImage = async (file: File): Promise<void> => {
    // Explicit, like `save` above rather than an `editor?.` that silently
    // no-ops: if this invariant ever broke, the upload would still succeed
    // and the asset would sit in Cloudinary with nothing inserted and
    // nothing reported.
    if (!editor) return;
    setImageError(null);
    // Advisory guard, same reason as components/admin/media-picker.tsx: the
    // server re-checks and stays authoritative, but next.config.ts's
    // bodySizeLimit sits only 64KiB above MAX_UPLOAD_BYTES, so anything far
    // over — a phone photo — is rejected by the platform BEFORE the action
    // runs, and the author sees an opaque framework error instead of "the file
    // is too large (max 4MB)".
    const check = checkUploadFile({ size: file.size, type: file.type });
    if (!check.ok) {
      setImageError(check.error);
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    setBusy(true);
    try {
      const result = await uploadImageAction(formData);
      if (!result.ok) {
        setImageError(result.error);
        return;
      }
      // toMediaImage never sets alt (lib/storage.ts) — it is not something
      // Cloudinary knows — so it has to be asked for here or the image ships
      // with alt="" forever: this is a WYSIWYG, and the author has no way to
      // reach the markdown afterwards. window.prompt matches the Link button
      // in this same file rather than introducing a second modal idiom.
      // Cancelling yields "", which is the correct markup for an image the
      // author declines to describe.
      const alt = window.prompt("Alt text (describe the image, or leave blank if decorative)") ?? "";
      editor.chain().focus().setImage({ src: result.media.url, alt }).run();
    } catch (e) {
      // Same rejection semantics as `save` above — see its comment.
      unstable_rethrow(e);
      setImageError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {editor ? (
        <BubbleMenu editor={editor}>
          <div className="flex items-center gap-1 rounded-lg border bg-background p-1 shadow-md">
            <Button type="button" size="sm" variant="ghost" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}>Bold</Button>
            <Button type="button" size="sm" variant="ghost" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}>Italic</Button>
            <Button type="button" size="sm" variant="ghost" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleCode().run(); }}>Code</Button>
            <Button
              type="button" size="sm" variant="ghost"
              onMouseDown={(e) => {
                e.preventDefault();
                const href = window.prompt("Link URL");
                if (href) editor.chain().focus().setLink({ href }).run();
              }}
            >
              Link
            </Button>
          </div>
        </BubbleMenu>
      ) : null}

      <div className="rounded-lg border p-3">
        <EditorContent editor={editor} />
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          // A previous failure's red line must not outlive the attempt the
          // author is making right now.
          setImageError(null);
          if (file) void insertImage(file);
        }}
      />
      {imageBusy ? (
        <p className="font-heading text-xs text-muted-foreground" aria-live="polite">Uploading image…</p>
      ) : null}
      {imageError ? (
        <p className="font-heading text-xs text-destructive" role="alert">Could not add image: {imageError}</p>
      ) : null}

      <p className="font-heading text-xs text-muted-foreground">
        Type <strong>@</strong> to mention an entity inline, <strong>/</strong> at the start of a line
        for headings, lists, tables, images and reference cards. Select text to format it.
      </p>

      <div className="flex items-center gap-3">
        {/* Also disabled mid-upload: saving now would persist a document
            missing the image that is seconds from being inserted, and the
            author would have to notice and save again. */}
        <Button type="button" onClick={save} disabled={pending || imageBusy || !editor}>
          {pending ? "Saving…" : "Save content"}
        </Button>
        {unchanged ? (
          <span className="self-center text-xs text-muted-foreground">No changes to save</span>
        ) : null}
        {error ? (
          <span className="self-center text-xs text-destructive">Could not save: {error}</span>
        ) : null}
      </div>

      <SuggestionMenu
        items={menu?.items ?? []}
        activeIndex={menu?.index ?? 0}
        rect={menu?.rect ?? null}
        onPick={(index) => {
          const current = menuRef.current;
          if (!current) return;
          // menuRef.current updates synchronously on every show(), but the
          // rendered <SuggestionMenu> list this `index` was clicked from is
          // React state (`menu`), which lags a render behind. A mousedown
          // between a show() and its re-render can carry an index that no
          // longer exists in the current (possibly shorter) items array —
          // guarded rather than dereferencing straight into item.id.
          const item = current.items[index];
          if (!item) return;
          current.run(item);
          show(null);
        }}
      />
    </div>
  );
}
