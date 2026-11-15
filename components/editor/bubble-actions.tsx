"use client";

import { useId, type ReactNode } from "react";
import { isTextSelection, type Editor } from "@tiptap/core";
import { NodeSelection, type EditorState } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { useEditorState } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { figureFromImage } from "@/lib/staging-convert";
import { makeFigure } from "./staging-views";

/**
 * When the bubble menu shows: Tiptap's own rule (the editor or the menu has
 * focus, the selection is not empty, not an empty text block, the editor is
 * editable) — restated, because passing `shouldShow` replaces it — plus one
 * of ours. A NODE selection shows the menu only when it is a plain `image`,
 * the one node the menu has an action for; a staged block, a card or a rule
 * selected by a click would otherwise wear Bold / Italic / Code / Link,
 * which do nothing to an atom.
 *
 * Module-level, so the prop is the same function on every render.
 */
export function bubbleShouldShow({
  editor,
  element,
  view,
  state,
  from,
  to,
}: {
  editor: Editor;
  element: HTMLElement;
  view: EditorView;
  state: EditorState;
  from: number;
  to: number;
}): boolean {
  const { selection } = state;
  if (selection instanceof NodeSelection && selection.node.type.name !== "image") return false;
  const isEmptyTextBlock = !state.doc.textBetween(from, to).length && isTextSelection(selection);
  const hasFocus = view.hasFocus() || element.contains(document.activeElement);
  return hasFocus && !selection.empty && !isEmptyTextBlock && editor.isEditable;
}

/**
 * The bubble menu's contents. A text selection gets the text marks
 * (`children`, exactly as they were); a plain image gets "Make it a figure"
 * instead (spec 2026-11-15 §12), since a mark on an image means nothing.
 * Whether the image may become one is `figureFromImage`'s decision
 * (lib/staging-convert.ts) — this only draws it. Refused, the button stays on
 * screen, disabled, with the reason beside it as its description, so the
 * action is discoverable where it is not yet possible.
 *
 * Its own file, apart from prose-editor.tsx, so lib/staging-panel.test.tsx
 * can render it without importing the page's server actions.
 *
 * `useEditorState`, because `useEditor` no longer re-renders this component
 * on every transaction: a selection read at render would be the last
 * render's.
 */
export function BubbleActions({ editor, children }: { editor: Editor; children: ReactNode }) {
  const verdict = useEditorState({ editor, selector: ({ editor: e }) => figureFromImage(e.state) });
  const reasonId = useId();
  if (!verdict) return <>{children}</>;
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={!verdict.ok}
        aria-describedby={verdict.ok ? undefined : reasonId}
        onMouseDown={(e) => {
          e.preventDefault();
          makeFigure(editor);
        }}
      >
        Make it a figure
      </Button>
      {verdict.ok ? null : (
        <span id={reasonId} className="max-w-56 px-2 text-xs text-muted-foreground">
          {verdict.reason}
        </span>
      )}
    </>
  );
}
