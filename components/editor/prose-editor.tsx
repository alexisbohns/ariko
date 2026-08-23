"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Extension, type Editor, type Range } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Markdown } from "@tiptap/markdown";
import Suggestion from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { baseExtensions, normalizeEmptyListMarkers } from "@/lib/entity-markdown";
import type { EntityOption } from "@/lib/entity-options";
import { entityExtensions } from "./entity-views";
import { SuggestionMenu, type MenuItem } from "./suggestion-menu";
import { Button } from "@/components/ui/button";

interface MenuState {
  items: MenuItem[];
  index: number;
  rect: DOMRect | null;
  run: (item: MenuItem) => void;
}

/** A `/` command that is not an entity card. */
const BLOCKS: Array<{ id: string; label: string; run: (e: Editor, r: Range) => void }> = [
  { id: "h2", label: "Heading", run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 2 }).run() },
  { id: "h3", label: "Subheading", run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 3 }).run() },
  { id: "ul", label: "Bullet list", run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { id: "ol", label: "Numbered list", run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { id: "quote", label: "Quote", run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { id: "code", label: "Code block", run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  { id: "table", label: "Table", run: (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run() },
];

const matches = (haystack: string, query: string): boolean =>
  haystack.toLowerCase().includes(query.toLowerCase());

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

  const show = (next: MenuState | null): void => {
    menuRef.current = next;
    setMenu(next);
  };

  const extensions = useMemo(() => {
    // One suggestion plugin per trigger character. `render` drives React state;
    // `onKeyDown` returns true to swallow the key from the editor.
    const suggestion = (
      char: string,
      items: (query: string) => MenuItem[],
      run: (editor: Editor, range: Range, item: MenuItem) => void,
    ) =>
      Extension.create({
        name: `suggestion-${char === "@" ? "entity" : "block"}`,
        addProseMirrorPlugins() {
          const editor = this.editor;
          return [
            Suggestion<MenuItem>({
              editor,
              char,
              // @tiptap/suggestion defaults pluginKey to `new PluginKey("suggestion")`,
              // so registering BOTH the `@` and `/` plugins made ProseMirror throw
              // "Adding different instances of a keyed plugin (suggestion$)" and the
              // editor failed to mount at all. Key each one by its own extension
              // name so the two never collide.
              pluginKey: new PluginKey(this.name),
              startOfLine: char === "/",
              // I4: @tiptap/suggestion defaults `allow` to always-true, so
              // both menus would otherwise fire inside a code block too.
              // codeBlock's content is `text*` with `marks: ""` — picking an
              // entity there runs deleteRange(range) (eating the typed text)
              // then tries to insert a node the block can't contain, and
              // picking "Heading" runs setNode("heading") on the block,
              // converting it and losing its language attribute. Reachable
              // from ordinary technical prose: an `@Component` decorator, or
              // a `/usr/...` path at the start of a line in a sample.
              allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
              items: ({ query }) => items(query),
              command: ({ range, props }) => run(editor, range, props),
              render: () => {
                let range: Range | null = null;
                const open = (props: {
                  items: MenuItem[];
                  clientRect?: (() => DOMRect | null) | null;
                  range: Range;
                }) => {
                  range = props.range;
                  show({
                    items: props.items,
                    index: 0,
                    rect: props.clientRect?.() ?? null,
                    run: (item) => run(editor, range!, item),
                  });
                };
                return {
                  onStart: open,
                  onUpdate: open,
                  onExit: () => show(null),
                  onKeyDown: ({ event }) => {
                    const current = menuRef.current;
                    if (!current || current.items.length === 0) return false;
                    if (event.key === "ArrowDown") {
                      show({ ...current, index: (current.index + 1) % current.items.length });
                      return true;
                    }
                    if (event.key === "ArrowUp") {
                      show({
                        ...current,
                        index: (current.index - 1 + current.items.length) % current.items.length,
                      });
                      return true;
                    }
                    if (event.key === "Enter") {
                      // menuRef.current updates synchronously while the rendered
                      // list is React state (see the onPick guard below for the
                      // fuller race) — guarded defensively so an out-of-range
                      // index can never dereference straight into item.id.
                      const item = current.items[current.index];
                      if (item) current.run(item);
                      show(null);
                      return true;
                    }
                    if (event.key === "Escape") {
                      show(null);
                      return true;
                    }
                    return false;
                  },
                };
              },
            }),
          ];
        },
      });

    const entityItems = (query: string): MenuItem[] =>
      entities
        .filter((e) => matches(e.name, query) || matches(e.ref, query))
        .slice(0, 20)
        .map((e) => ({ id: e.ref, label: e.name, hint: e.ref }));

    return [
      // Spread, never re-listed — see the baseExtensions split in
      // lib/entity-markdown.ts. A node missing here is a node the editor
      // silently deletes on save.
      ...baseExtensions,
      // @tiptap/markdown defaults to a 2-space indent for nested list
      // content. CommonMark requires the indent to be at least as wide as
      // the parent marker: `- ` is 2 columns (2 is correct), but `1. ` is 3
      // columns, so a 2-space child indent under an ORDERED item undershoots
      // by one column. remark then refuses to treat that child as belonging
      // to the item at all — nesting is lost, numbering re-runs flat, and at
      // 3 levels deep the mis-indented text itself gets folded onto the
      // parent line (defect C2). Bullets stay correct at 3 (more than their
      // own 2-column marker is still enough to count as nested content), so
      // widening to 3 fixes ordered nesting without breaking bullet nesting
      // — verified for both in lib/markdown-conformance.test.ts
      // (nestedOrdered, nestedOrderedDeep) alongside the existing bullet
      // fixtures. This is global (marked has no per-list-type indent
      // option), so it also widens the BARE (markerless) continuation
      // indentation a card gets when it shares a list item with a paragraph
      // — see lib/entity-refs.ts's BLOCK comment for how extractRefs stays
      // in step with that.
      Markdown.configure({ indentation: { style: "space", size: 3 } }),
      ...entityExtensions(entities),
      // `@` — an inline mention. The label is the entity's name at insertion
      // time; it is authored text from then on, which is why a rename does not
      // rewrite existing prose.
      suggestion("@", entityItems, (editor, range, item) => {
        // A ref-less entityMention serializes to "" (lib/entity-markdown.ts),
        // which is harmless in a flat document but destroys a list when the
        // node is a list item's only child. item.id always comes from the
        // picker so this should be unreachable — guarded anyway, because the
        // cost is one line and the failure mode is silent data loss.
        if (!item.id) return;
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({
            type: "entityMention",
            attrs: { ref: item.id, label: item.label },
          })
          .run();
      }),
      // `/` — block types AND entity cards in one list, so a block reference
      // needs no second trigger character and no two-step picker.
      suggestion(
        "/",
        (query) => [
          ...BLOCKS.filter((b) => matches(b.label, query)).map((b) => ({ id: b.id, label: b.label })),
          ...entities
            .filter((e) => matches(e.name, query) || matches(e.ref, query))
            .slice(0, 20)
            .map((e) => ({ id: `card:${e.ref}`, label: `Card: ${e.name}`, hint: e.ref })),
        ],
        (editor, range, item) => {
          const block = BLOCKS.find((b) => b.id === item.id);
          if (block) return block.run(editor, range);
          // Same guard as the `@` handler above, for the same reason: no ref,
          // no entityCard node.
          const ref = item.id.slice("card:".length);
          if (!ref) return;
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({ type: "entityCard", attrs: { ref } })
            .run();
        },
      ),
    ];
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
  }, [entities]);

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

      <p className="font-heading text-xs text-muted-foreground">
        Type <strong>@</strong> to mention an entity inline, <strong>/</strong> at the start of a line
        for headings, lists, tables and reference cards. Select text to format it.
      </p>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={pending || !editor}>
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
