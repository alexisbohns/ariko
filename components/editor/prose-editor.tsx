"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Extension, type Editor, type Range } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Markdown } from "@tiptap/markdown";
import Suggestion from "@tiptap/suggestion";
import { baseExtensions } from "@/lib/entity-markdown";
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
              startOfLine: char === "/",
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
                      current.run(current.items[current.index]);
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
      Markdown,
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
    // Rebuilt only when the entity list identity changes — the editor is not
    // recreated on every render.
  }, [entities]);

  const editor = useEditor({
    extensions,
    content: initialMarkdown,
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
    const formData = new FormData();
    for (const [key, value] of Object.entries(hidden)) formData.set(key, value);
    // The serialize step (spec §2.3): markdown is what the database stores, and
    // the editor is only ever a surface over it.
    formData.set("content", markdown);
    startTransition(() => {
      void action(formData);
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
      </div>

      <SuggestionMenu
        items={menu?.items ?? []}
        activeIndex={menu?.index ?? 0}
        rect={menu?.rect ?? null}
        onPick={(index) => {
          const current = menuRef.current;
          if (!current) return;
          current.run(current.items[index]);
          show(null);
        }}
      />
    </div>
  );
}
