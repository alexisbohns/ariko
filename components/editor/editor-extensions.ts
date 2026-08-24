import { Extension, type Editor, type Range } from "@tiptap/core";
import { Markdown } from "@tiptap/markdown";
import Suggestion from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { baseExtensions } from "@/lib/entity-markdown";
import type { EntityOption } from "@/lib/entity-options";
import { entityExtensions } from "./entity-views";
import type { MenuItem } from "./suggestion-menu";

/**
 * The production extension list, React-free (the node VIEWS from
 * entity-views.tsx pull in React, but nothing here does). Built by
 * `components/editor/prose-editor.tsx` and by `lib/editor-mount.test.ts` —
 * one definition, so a defect here (like two suggestion plugins sharing a
 * key, 65bb5ff) is something a test can actually catch, instead of a test
 * building its own approximation of this array and missing what the real one
 * does differently.
 */

export interface MenuState {
  items: MenuItem[];
  index: number;
  rect: DOMRect | null;
  run: (item: MenuItem) => void;
}

/** A `/` command that is not an entity card. */
const STATIC_BLOCKS: Array<{ id: string; label: string; run: (e: Editor, r: Range) => void }> = [
  { id: "h2", label: "Heading", run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 2 }).run() },
  { id: "h3", label: "Subheading", run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 3 }).run() },
  { id: "ul", label: "Bullet list", run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { id: "ol", label: "Numbered list", run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { id: "quote", label: "Quote", run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { id: "code", label: "Code block", run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  { id: "table", label: "Table", run: (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run() },
];

/** A `/` command row. */
export interface BlockCommand {
  id: string;
  label: string;
  run: (e: Editor, r: Range) => void;
}

/**
 * The `/` menu's block rows. A function rather than a constant because the
 * Image row needs the host's file picker: the command deletes the typed
 * text and hands off, and the ASYNC half (open a picker, upload, insert)
 * lives in components/editor/prose-editor.tsx where it can hold React state.
 *
 * Exported so lib/editor-mount.test.ts can run a row against a real Editor
 * without a DOM file dialog.
 */
export function buildBlocks(onInsertImage: () => void): BlockCommand[] {
  return [
    ...STATIC_BLOCKS,
    {
      id: "image",
      label: "Image",
      run: (e, r) => {
        // Delete the typed "/image" NOW, before the file dialog takes focus,
        // so the insertion later lands at a clean cursor.
        e.chain().focus().deleteRange(r).run();
        onInsertImage();
      },
    },
  ];
}

const matches = (haystack: string, query: string): boolean =>
  haystack.toLowerCase().includes(query.toLowerCase());

export interface BuildEditorExtensionsOptions {
  /** The @ / and / menus' rows (spec §2.6) — server-computed, per page. */
  entities: EntityOption[];
  /**
   * Called whenever the current suggestion menu should change — opened,
   * moved to a different active row, or closed. React callers wire this to
   * `setState`; a headless caller (lib/editor-mount.test.ts) that never
   * opens a menu can pass a no-op.
   */
  onMenu: (next: MenuState | null) => void;
  /**
   * Read back the most recently reported menu state. `onKeyDown` runs
   * outside React's render (a ProseMirror event handler), so it would
   * otherwise close over a stale index — see the comment at its call site
   * below. React callers wire this to a ref mirrored alongside `onMenu`'s
   * argument; a headless caller that never opens a menu can pass `() =>
   * null`.
   */
  getMenu: () => MenuState | null;
  /**
   * Ask the host to pick an image file and insert it. Called by the `/image`
   * command AFTER the typed text is deleted. A headless caller
   * (lib/editor-mount.test.ts) can pass a no-op.
   */
  onInsertImage: () => void;
}

/**
 * The editor's schema plus its `@`/`/` suggestion plugins, entity node
 * views, and markdown wiring — everything `useEditor` needs besides
 * `content`. Exported so `prose-editor.tsx` and the mount smoke test drive
 * the exact same array.
 */
export function buildEditorExtensions({ entities, onMenu, getMenu, onInsertImage }: BuildEditorExtensionsOptions) {
  const blocks = buildBlocks(onInsertImage);
  // One suggestion plugin per trigger character. `render` drives menu state
  // via `onMenu`; `onKeyDown` returns true to swallow the key from the editor.
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
            //
            // `parent.type.spec.code` alone only catches codeBlock, a NODE
            // whose whole content is code — it misses the `code` MARK, an
            // inline code SPAN (`` `…` ``) inside an ordinary paragraph,
            // which carries no such flag on its parent. Reachable from the
            // same kind of technical prose: a mention or block picked mid-
            // span (`` `@Component` `` or `` `/usr/...` ``) runs
            // deleteRange(range) then inserts a node inline with the rest of
            // the code text — the inserted node is fine, but the code mark
            // that should have closed at the deleted text now reopens on
            // whatever text follows, silently marking it as code too
            // (mismatched backticks on serialization). `$pos.marks()` is the
            // same idiom @tiptap/core's own `isMarkActive` uses for an empty
            // selection (`state.selection.$from.marks()`) — range.from is
            // exactly that empty-selection cursor position while a
            // suggestion menu is open.
            allow: ({ state, range }) => {
              const $pos = state.doc.resolve(range.from);
              if ($pos.parent.type.spec.code) return false;
              const codeMark = state.schema.marks.code;
              return !codeMark || !codeMark.isInSet($pos.marks());
            },
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
                onMenu({
                  items: props.items,
                  index: 0,
                  rect: props.clientRect?.() ?? null,
                  run: (item) => run(editor, range!, item),
                });
              };
              return {
                onStart: open,
                onUpdate: open,
                onExit: () => onMenu(null),
                onKeyDown: ({ event }) => {
                  const current = getMenu();
                  if (!current || current.items.length === 0) return false;
                  if (event.key === "ArrowDown") {
                    onMenu({ ...current, index: (current.index + 1) % current.items.length });
                    return true;
                  }
                  if (event.key === "ArrowUp") {
                    onMenu({
                      ...current,
                      index: (current.index - 1 + current.items.length) % current.items.length,
                    });
                    return true;
                  }
                  if (event.key === "Enter") {
                    // getMenu() reflects onMenu() calls synchronously while the
                    // rendered list is React state (see the onPick guard in
                    // prose-editor.tsx for the fuller race) — guarded
                    // defensively so an out-of-range index can never
                    // dereference straight into item.id.
                    const item = current.items[current.index];
                    if (item) current.run(item);
                    onMenu(null);
                    return true;
                  }
                  if (event.key === "Escape") {
                    onMenu(null);
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
        ...blocks.filter((b) => matches(b.label, query)).map((b) => ({ id: b.id, label: b.label })),
        ...entities
          .filter((e) => matches(e.name, query) || matches(e.ref, query))
          .slice(0, 20)
          .map((e) => ({ id: `card:${e.ref}`, label: `Card: ${e.name}`, hint: e.ref })),
      ],
      (editor, range, item) => {
        const block = blocks.find((b) => b.id === item.id);
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
}
