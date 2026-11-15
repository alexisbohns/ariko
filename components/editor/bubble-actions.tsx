"use client";

import { useId, type ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { figureFromImage } from "@/lib/staging-convert";
import { makeFigure } from "./staging-views";

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
