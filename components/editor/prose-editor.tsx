"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { CloudAlert, CloudCheck, LoaderCircle } from "lucide-react";
import { normalizeEmptyListMarkers } from "@/lib/entity-markdown";
import type { EntityOption } from "@/lib/entity-options";
import { buildEditorExtensions, type MenuState } from "./editor-extensions";
import { SuggestionMenu } from "./suggestion-menu";
import { Button } from "@/components/ui/button";
import { Chrome } from "@/components/chrome";
import { uploadImageAction } from "@/app/admin/actions";
import { checkUploadFile, ALLOWED_TYPES } from "@/lib/upload-input";
// `Lang` from lib/locale.ts and never lib/edit-lang.ts: that one is the
// server half, and it opens node:fs — importing it here fails the build.
import type { Lang } from "@/lib/locale";
import { EditLangSwitch } from "./edit-lang-switch";

/** See `onUpdate` — one serialization per burst of typing, not one per key. */
const DIRTY_DEBOUNCE_MS = 200;

export function ProseEditor({
  initialMarkdown,
  entities,
  action,
  hidden,
  bare = false,
  float = false,
  langSwitch,
  seed,
}: {
  initialMarkdown: string;
  entities: EntityOption[];
  /** The server action this form posts to. */
  action: (formData: FormData) => Promise<void>;
  /** Identifying fields the action needs, e.g. { slug } or { ref }. */
  hidden: Record<string, string>;
  /**
   * No frame, and a bigger type — for a page where the editor is not a card's
   * content but the page's own body.
   *
   * A prop rather than a global change, because the other shape is still real:
   * `ContentCard` puts this component inside a card, where the box is one
   * border inside another but is also what separates the writing surface from
   * the card's header and its neighbours. On a page whose body IS the editor
   * there is nothing to separate it from, and a rectangle drawn around the
   * page's only content is a rectangle drawn around nothing.
   *
   * Which pages are which is deliberately not listed here — `float`'s comment
   * below says why an enumeration goes quietly false, and this one had already
   * done it twice: it named a path that had since moved, and it named the
   * sprout page as a `ContentCard` caller after the sprout page stopped being
   * one.
   */
  bare?: boolean;
  /**
   * The commit as a floating cluster at the bottom of the viewport, instead of
   * a row under the writing surface.
   *
   * Two shapes, deliberately not a list of pages — the pages move, and an
   * enumeration in a comment goes quietly false when they do. OFF is the editor
   * as one item among several, with the commit as an inline row and its "No
   * changes to save" and "Could not save" lines beside a live button, whether
   * it arrives through `ContentCard` or renders this component directly. ON is
   * a page whose whole body is the editor, where that row sits a screen-height
   * below the caret and the author has to go looking for it.
   *
   * Separate from `bare` on purpose. They are set together wherever the second
   * shape applies, but they are two decisions: `bare` is about the frame around
   * the writing surface, this is about where the commit lives.
   *
   * ONLY THE COMMIT FLOATS. The `@` / `/` hint and the `/image` command's
   * progress and error lines stay in the document: they are about the caret's
   * neighbourhood rather than about the document's state, and a fixed cluster
   * at the bottom of the viewport is the wrong distance from the thing they
   * describe.
   */
  float?: boolean;
  /**
   * Which half of a bilingual article this instance edits, and the links to
   * the other. The page keys the editor on `current`, so switching REMOUNTS it
   * with the other half's baseline rather than diffing French against English.
   * Absent on any caller that has no halves to switch between.
   */
  langSwitch?: { current: Lang; hrefs: Record<Lang, string> };
  /**
   * The English body, handed over ONLY when this is the French half and it is
   * blank (lib/edit-lang.ts `editorHalves`). It powers "Start from English",
   * which loads it as an unsaved draft — the stored value does not change until
   * the author presses Save.
   */
  seed?: string;
}) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [pending, startTransition] = useTransition();
  // What the floating commit's resting state is a CLAIM about: does the
  // document differ from what is stored, right now? `unchanged` on the next
  // line answers a narrower and later question — did the last save ATTEMPT find
  // no diff — which is all the inline row's "No changes to save" ever reported,
  // and which is why nothing could honestly say "up to date" before this state
  // existed. Two facts, two states.
  //
  // DEBOUNCED, because `onUpdate` fires on every keystroke and
  // `editor.getMarkdown()` serializes the whole document: 200ms buys one
  // serialization per burst of typing, and is far inside the time it takes the
  // author to look up from the caret. The comparison is against `baselineRef`
  // — see its comment below for why the stored `initialMarkdown` prop is the
  // wrong thing to compare to.
  const [dirty, setDirty] = useState(false);
  const [unchanged, setUnchanged] = useState(false);
  const dirtyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Whether the document is empty — "Start from English" is a way IN, not a
  // reset, so it shows only over an empty document and disappears the moment
  // there is anything to lose. Seeded from the string so the first client
  // render is right; `onCreate` then replaces the guess with the editor's own
  // answer, for the same reason `baselineRef` below is not the stored prop.
  const [empty, setEmpty] = useState(initialMarkdown.trim() === "");
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
  // the same function lib/editor.test.ts drives against a real headless
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
        // Read ONCE, at mount: `useEditor` builds the editor from this config
        // and a later prop would not reach it. `bare` never changes over an
        // instance's life (it is a per-page constant), so that is fine here —
        // but it is why this is not a place to put anything stateful.
        //
        // The `prose-headings:*` treatment is kept in step with
        // `components/markdown.tsx` ON PURPOSE, and both branches carry it. This
        // is a WYSIWYG editor over the same markdown that <Prose> renders, so a
        // heading typed in the body face and published in mono is the editor
        // lying about its own output — the same defect markdown.tsx's comment
        // names about size. Change the treatment in one file, change it in both.
        //
        // `prose` vs `prose-sm` is the one difference that stays: a deliberate
        // density choice between the full-page editor and the inline one.
        class: bare
          ? "prose max-w-none dark:prose-invert prose-headings:font-heading prose-headings:font-medium prose-headings:tracking-tight min-h-[60vh] focus:outline-none"
          : "prose prose-sm max-w-none dark:prose-invert prose-headings:font-heading prose-headings:font-medium prose-headings:tracking-tight min-h-48 focus:outline-none",
        // Spellcheck in the language being written. Read once at mount, like
        // `class` — which is fine because the page keys this editor on it, so
        // a switch is a new instance rather than a prop this one never sees.
        lang: langSwitch?.current ?? "en",
      },
    },
    onCreate: ({ editor }) => {
      baselineRef.current = editor.getMarkdown();
      setEmpty(editor.isEmpty);
    },
    onUpdate: ({ editor }) => {
      setUnchanged(false);
      // Not debounced, unlike `dirty`: `isEmpty` stops descending at the first
      // non-empty node, where `getMarkdown()` serializes the whole document.
      // Undo back to nothing brings "Start from English" back.
      setEmpty(editor.isEmpty);
      // A previous failure's red line must not outlive the attempt the author
      // is making right now — the file's own rule, from the image input's
      // onChange below. In the FLOAT shape it is also the only way out of a
      // dead end: there the error REPLACES the state claim rather than sitting
      // beside it, so an author who edits and then undoes back to clean would
      // otherwise be left with a permanently red button whose every click takes
      // the no-op branch. (setState with an unchanged value bails out, so this
      // costs nothing on the 99% of keystrokes where `error` is already null.)
      setError(null);
      // Dirty goes true on the KEYSTROKE and false only from the debounced
      // comparison below, and the asymmetry is deliberate. Waiting 200ms to
      // turn it ON leaves the commit DISABLED and reading "Up to date" over a
      // document the author has just edited — the same lie this state exists to
      // remove, pointed the other way, and reachable by anyone who types and
      // goes straight for the button. Turning it OFF has no such urgency: only
      // the comparison can know that an undo landed back on the baseline.
      setDirty(true);
      if (dirtyTimer.current) clearTimeout(dirtyTimer.current);
      dirtyTimer.current = setTimeout(() => {
        setDirty(baselineRef.current !== null && editor.getMarkdown() !== baselineRef.current);
      }, DIRTY_DEBOUNCE_MS);
    },
  });

  // The author types and then leaves — a rail link, the palette, browser back —
  // and a timer armed by the last keystroke outlives the tree that armed it.
  //
  // Not for the reason that is usually given: React has not warned about a
  // setState on an unmounted component since 18, and the `setDirty` this fires
  // would be a silent no-op on a fiber nobody is rendering. That silence is the
  // problem. The timer holds the destroyed `Editor` — and through it the whole
  // ProseMirror document — reachable until it runs, it then serializes that
  // corpse (which does not even throw: a destroyed editor still answers
  // `getMarkdown()`), and nothing anywhere reports any of it.
  useEffect(
    () => () => {
      if (dirtyTimer.current) clearTimeout(dirtyTimer.current);
    },
    [],
  );

  const save = (): void => {
    if (!editor) return;
    // This comparison supersedes any debounced one still in flight: a click
    // within 200ms of a keystroke would otherwise leave an armed timer racing a
    // write, recomputing `dirty` against a baseline the save is in the middle of
    // replacing. Invisible today, and an unowned timer regardless.
    if (dirtyTimer.current) clearTimeout(dirtyTimer.current);
    const markdown = editor.getMarkdown();
    if (baselineRef.current !== null && markdown === baselineRef.current) {
      // Nothing the author did changed the document (undo back to the
      // original lands here too, correctly). Do not call the action at all: a
      // scheduled bee writes these digests, and reading one must never
      // rewrite it (spec §2.5).
      setUnchanged(true);
      // Nothing redirects on this branch, so nothing remounts this tree and
      // resets anything — this is where an optimistic `dirty` from a keystroke
      // the debounce has not caught up with gets corrected.
      setDirty(false);
      return;
    }
    setUnchanged(false);
    setError(null);
    // `dirty` is deliberately NOT cleared here, on either outcome.
    //
    // On SUCCESS this tree does not survive to read it. `redirect()` comes back
    // from the action as a REJECTED promise (the long note below), and
    // `unstable_rethrow` rethrows it inside the async transition scope — which
    // React 19 chains into this component's own `useTransition` state and then
    // THROWS out of this component's next render (ReactFiberHooks'
    // `updateTransition` reads the chained thenable, `trackUsedThenable` sees
    // `status: "rejected"` and throws the reason). Next's RedirectErrorBoundary
    // is the nearest boundary above the page, and its render() swaps
    // `this.props.children` for `<HandleRedirect>` and, once the navigation is
    // done, swaps them back. That is a REMOUNT, not a re-render — Next's own
    // source says so at the reject site — and since `useEditor` keeps its
    // instance manager in `useState`, the remount builds a NEW Editor, runs
    // `onCreate`, and re-seeds `baselineRef` from the just-saved content. (It
    // is also why the editor loses its undo history on every save.)
    //
    // On FAILURE the tree does survive, and there `dirty` is simply TRUE: the
    // document really does still differ from what is stored. Clearing it would
    // be a lie that only hides because `error` outranks `dirty` in both the
    // variant and the content chain.
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

      {seed && editor && empty ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          // Replaces the (empty) document; emits an update, so `dirty` goes
          // true and the commit lights. Nothing is written until Save.
          onClick={() => editor.chain().focus().setContent(normalizeEmptyListMarkers(seed), { contentType: "markdown" }).run()}
        >
          Start from English
        </Button>
      ) : null}

      <div className={bare ? undefined : "rounded-lg border p-3"}>
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

      {/* Disabled mid-upload in both shapes: saving now would persist a
          document missing the image that is seconds from being inserted, and
          the author would have to notice and save again. */}
      {float ? (
        // Nothing at all until the editor exists. `immediatelyRender: false`
        // leaves `editor` null through SSR and the first client render, so
        // without this gate the server HTML carries a pill claiming "Up to
        // date" about a document that has not loaded yet — precisely the
        // dishonest resting state the rest of this file is built to prevent.
        // `components/toc-rail.tsx` renders nothing until it mounts for the
        // same reason. It is also why `!editor` is absent from `disabled`
        // below: inside this branch it cannot be true, and a guard that cannot
        // fire reads as a live rule.
        editor ? (
          <Chrome magnet="bottom-center" content>
            {/* In this shape the button's own text is the ONLY save signal —
                the inline row has a separate span, this does not — and it
                changes while the caret is somewhere in the prose. Without a
                live region a screen-reader author is never told the save
                failed; `role="alert"` on the image error above is the same
                precedent. */}
            <span aria-live="polite">
              <Button
                type="button"
                onClick={save}
                disabled={pending || imageBusy || (!dirty && !error)}
                variant={error ? "destructive" : dirty ? "default" : "ghost"}
                size="sm"
                className={error || dirty ? undefined : "text-muted-foreground"}
              >
                {pending ? (
                  <>
                    <LoaderCircle className="animate-spin" /> Saving…
                  </>
                ) : error ? (
                  <>
                    <CloudAlert /> Couldn&rsquo;t save — {error}
                  </>
                ) : dirty ? (
                  "Save"
                ) : (
                  <>
                    <CloudCheck /> Up to date
                  </>
                )}
              </Button>
            </span>
            {/* AFTER the save, not before it: lib/prose-commit-source.test.ts
                reads the FIRST `disabled` in this cluster as the Save button's,
                and the switch's own expression carries no `!error` — nor
                should it, since a failed save is exactly unsaved text. */}
            {langSwitch ? (
              <EditLangSwitch
                current={langSwitch.current}
                hrefs={langSwitch.hrefs}
                disabled={dirty || pending || imageBusy}
              />
            ) : null}
          </Chrome>
        ) : null
      ) : (
        <div className="flex items-center gap-3">
          <Button type="button" onClick={save} disabled={pending || imageBusy || !editor}>
            {pending ? "Saving…" : "Save content"}
          </Button>
          {unchanged ? (
            <span className="self-center text-xs text-muted-foreground">No changes to save</span>
          ) : null}
          {error ? (
            <span className="self-center text-xs text-destructive">Could not save: {error}</span>
          ) : null}
          {/* `dirty` is kept by `onUpdate` in both shapes, not only the
              float one — so the same guard holds here. */}
          {langSwitch ? (
            <div className="ml-auto">
              <EditLangSwitch
                current={langSwitch.current}
                hrefs={langSwitch.hrefs}
                disabled={dirty || pending || imageBusy}
              />
            </div>
          ) : null}
        </div>
      )}

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
