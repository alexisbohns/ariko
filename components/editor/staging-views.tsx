"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { unstable_rethrow } from "next/navigation";
import Markdown from "react-markdown";
import type { Editor, NodeViewRenderer } from "@tiptap/core";
import { NodeSelection, type Transaction } from "@tiptap/pm/state";
import { closeHistory } from "@tiptap/pm/history";
import type { Node as PMNode } from "@tiptap/pm/model";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import {
  StagedFigure,
  StagedGallery,
  StagedCompare,
  StagedCallout,
  StagedQuote,
} from "@/lib/staging-editor";
import {
  serializeFigure,
  serializeGallery,
  serializeCompare,
  type FigureFields,
  type GalleryFields,
  type GalleryImage,
  type CompareFields,
  type SideFields,
} from "@/lib/staging-markdown";
import {
  COMPARE_LABELS,
  COMPARE_SIDES,
  DEFAULT_SIZE,
  FRAMES,
  SIZES,
  type Frame,
  type Size,
} from "@/lib/staging";
import type { Lang } from "@/lib/locale";
import { figureFromImage } from "@/lib/staging-convert";
import { remarkPlugins, rehypePlugins } from "@/lib/markdown";
import { ALLOWED_TYPES } from "@/lib/upload-input";
import { stagingComponents } from "@/components/staging/markdown-components";
import { CALLOUT_CLASS, CALLOUT_LABEL_CLASS } from "@/components/staging/callout";
import { QUOTE_BODY_CLASS, QUOTE_BY_CLASS, QUOTE_CLASS, QUOTE_MARK_CLASS } from "@/components/staging/quote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChoiceLabel, NativeRadio } from "@/components/ui/native-controls";
import { useRailPanel } from "@/app/admin/_components/rail-panel";

/**
 * The staging blocks as seen while writing (spec 2026-11-15 §4.2).
 *
 * THE PREVIEW IS THE PUBLISHED BLOCK. Each media view renders its node's own
 * canonical markdown (lib/staging-markdown.ts — the string `renderMarkdown`
 * writes on save) through the site's own chain: lib/markdown.ts's plugins and
 * components/staging's map. A preview drawn from the attributes by hand would
 * be a second figure, and it would drift silently — the editor's entity card
 * did, by a `py-4` and a missing cover (entity-views.tsx). Drawn this way, a
 * field the serializer drops is a field the preview drops too, and an author
 * sees it before the visitor does.
 *
 * THE FORM IS IN THE RAIL'S PANEL (spec §11). Each block's preview — or the
 * callout's label line, the quote's attribution line — opens its form in the
 * page's `EntityRail` panel, through `useRailPanel()`. It was a popover
 * anchored under the block until a tall figure pushed its own form below the
 * viewport. Every editor page hosts a rail for this
 * (lib/entity-rail-source.test.ts); outside one, a block draws and edits
 * nothing.
 *
 * NOTHING IS WRITTEN UNTIL SAVE, AND NOTHING IS DELETED BY A CLOSE. Every
 * form edits a DRAFT; Save is the one `updateAttributes`, and Escape or the
 * panel's ✕ throw the draft away and leave the node as stored. A media block left empty stays on screen as a dashed placeholder
 * and serializes to "" — gone from the saved article, deletable like any atom.
 * A first version deleted an empty block on close, and every close reason
 * became a way to lose one: a stray focus-out, the click that finished
 * picking the row from the `/` menu, a file dialog's blur.
 *
 * Uploads go through the host's `upload` (prose-editor.tsx, which owns the
 * server action), never from here: lib/editor.test.ts builds these extensions
 * headless, with no server to import an action from.
 */

export type StagingUploadResult = { ok: true; url: string } | { ok: false; error: string };
export type StagingUpload = (file: File, purpose?: "figure-svg") => Promise<StagingUploadResult>;

export interface StagingViewOptions {
  upload: StagingUpload;
  onUploadBusy: (busy: boolean) => void;
  lang: Lang;
}

const optionsOf = (props: NodeViewProps) => props.extension.options as StagingViewOptions;

// Display forms only, keyed by the vocabulary's own types: a member added to
// lib/staging.ts without a word here is a compile error, not a blank radio.
const FRAME_LABELS: Record<Frame, string> = { phone: "Phone", desktop: "Desktop", none: "None" };
const SIZE_LABELS: Record<Size, string> = { s: "Small", m: "Medium", l: "Large", wide: "Wide" };

const RASTER_ACCEPT = ALLOWED_TYPES.join(",");
// The one slot an SVG may fill (spec §5). The server's check for it lands
// with the `figure-svg` purpose; until then the action refuses the file, which
// is the safe half of the rule arriving first.
const FIGURE_ACCEPT = [...ALLOWED_TYPES, "image/svg+xml"].join(",");

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const SRC_SHAPE = /^https?:\/\/[^\s\u0000-\u001f\u007f]+$/;

/**
 * Why a pasted image URL cannot be saved, or null. An empty slot is not a
 * problem here — whether a block needs the image is the block's own rule.
 * Anything else that is not an absolute http(s) URL is refused before Save:
 * the serializer writes what it is given, so `javascript:…` or a relative
 * path reaches the stored article, the sanitizer drops it on render, and the
 * figure the author saw in the form is simply missing from the page.
 */
export function srcProblem(src: string): string | null {
  const s = src.trim();
  return s === "" || SRC_SHAPE.test(s) ? null : "Use an https:// image URL";
}

const srcsOk = (...srcs: string[]) => srcs.every((s) => srcProblem(s) === null);

function Preview({ markdown, lang }: { markdown: string; lang: Lang }) {
  return (
    <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={stagingComponents(lang)}>
      {markdown}
    </Markdown>
  );
}

type UploadInto = (file: File, purpose?: "figure-svg") => Promise<StagingUploadResult | null>;

/**
 * What a staging form, rendered in the rail's panel, knows about its node.
 *
 * The form is NOT inside the node view any more: `EntityRail` renders it, in
 * a panel outside the page wrapper, from a `ReactNode` the node view handed
 * over when it opened. So it cannot read `props.node` — that would be the
 * node as it was at open, and a Save built from it would write over anything
 * that changed since. It reads the node from the editor's CURRENT state,
 * through the node view's live `getPos`, every time (`useLiveAttrs`), and
 * writes through the node view's `updateAttributes`, which resolves its
 * position at call time.
 */
interface NodeSource {
  editor: Editor;
  /** The node's type, so a position that now holds something else reads as gone. */
  typeName: string;
  getPos: () => number | undefined;
  update: (attrs: Record<string, unknown>) => void;
  /** Closes this node's panel, and only this node's. */
  close: () => void;
  opts: StagingViewOptions;
}

/**
 * Which block a panel was opened for, held as a RANGE mapped through every
 * transaction since — not as a node view, and not as a node.
 *
 * The node view is not enough. ProseMirror reuses a node view for any node of
 * the same type it can match, so one transaction that changes A's attrs AND
 * inserts X before A (a redo of a grouped history step, say) can leave A's
 * view drawing X, its `getPos` now X's. A form reading through that view
 * would show X under A's panel, and Save would write A's draft into X. The
 * range is what tells them apart: X's arrival maps A's start past X, and the
 * view's position no longer agrees with it.
 *
 * The start maps with `assoc` 1, so an insertion AT it pushes it forward (the
 * new node is before the block); the end with -1, so one at the end stays
 * after it. A replacement of the block itself — `updateAttributes` on a leaf
 * is `setNodeMarkup`, which replaces it — keeps both: ProseMirror maps a
 * range's own endpoints outward. A deletion collapses the range, and its
 * width stops matching the node's size. Registered when the panel opens,
 * before the form subscribes, so it has mapped each transaction by the time
 * the form reads.
 */
interface Tracked {
  start: number;
  end: number;
  stop: () => void;
}

function track(editor: Editor, pos: number): Tracked {
  const size = editor.state.doc.nodeAt(pos)?.nodeSize ?? 0;
  const onTransaction = ({ transaction }: { transaction: Transaction }) => {
    if (!transaction.docChanged) return;
    tracked.start = transaction.mapping.map(tracked.start, 1);
    tracked.end = transaction.mapping.map(tracked.end, -1);
  };
  const tracked: Tracked = { start: pos, end: pos + size, stop: () => editor.off("transaction", onTransaction) };
  editor.on("transaction", onTransaction);
  return tracked;
}

const positionOf = (src: NodeSource): number | undefined => {
  try {
    return src.getPos();
  } catch {
    return undefined; // a destroyed node view has no position to report
  }
};

function liveAttrs(src: NodeSource, tracked: Tracked): Record<string, unknown> | null {
  if (src.editor.isDestroyed) return null;
  const pos = positionOf(src);
  if (pos !== tracked.start) return null; // the view now draws another node
  const node = src.editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== src.typeName) return null;
  return node.nodeSize === tracked.end - tracked.start ? node.attrs : null;
}

/**
 * The node's attributes as the editor holds them NOW, or null once it is
 * gone. ProseMirror reuses an unchanged node — and an unchanged node's
 * `attrs` object — across transactions, so the snapshot is stable until this
 * node's attributes actually change, which is what `useSyncExternalStore`
 * needs from it.
 */
function useLiveAttrs(src: NodeSource, tracked: Tracked): Record<string, unknown> | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      src.editor.on("transaction", onChange);
      return () => {
        src.editor.off("transaction", onChange);
      };
    },
    [src],
  );
  const read = () => liveAttrs(src, tracked);
  return useSyncExternalStore(subscribe, read, read);
}

// A number per attrs OBJECT, to key the form on. ProseMirror never mutates
// attrs, so a new object is a new value — an undo, a redo, a save — and the
// draft built from the old one must not be what a Save writes back.
const attrsIds = new WeakMap<object, number>();
let nextAttrsId = 0;
function attrsKey(attrs: object): number {
  let id = attrsIds.get(attrs);
  if (id === undefined) attrsIds.set(attrs, (id = ++nextAttrsId));
  return id;
}

type FormProps = { src: NodeSource; attrs: Record<string, unknown> };

/**
 * The panel's content: the form for the node as it stands, remounted on a
 * fresh draft whenever the stored attributes change underneath it, and
 * closing its own panel if the node is deleted while it is open (the node
 * view's unmount closes it too; this is the half that does not wait for
 * React to get round to that).
 */
function LiveForm({ src, tracked, Form }: { src: NodeSource; tracked: Tracked; Form: ComponentType<FormProps> }) {
  const attrs = useLiveAttrs(src, tracked);
  // Save re-checks at the moment it writes, not only at the last render.
  const bound = useMemo<NodeSource>(
    () => ({ ...src, update: (a) => void (liveAttrs(src, tracked) && src.update(a)) }),
    [src, tracked],
  );
  const gone = attrs === null;
  useEffect(() => {
    if (gone) src.close();
  }, [gone, src]);
  return attrs ? <Form key={attrsKey(attrs)} src={bound} attrs={attrs} /> : null;
}

/**
 * Draft and uploads, shared by every form.
 *
 * The draft is local state of a component that exists only while its panel
 * is open — `EntityRail` unmounts a page panel on close — so closing is what
 * discards it, with nothing to reset by hand.
 *
 * `generation` counts drafts. An upload resolves seconds after it starts, and
 * the panel may have been closed — its draft discarded — and reopened on a
 * fresh one in the meantime; a result tagged with an older generation is
 * dropped, or a file picked into an abandoned draft would appear in the new
 * one as if the author had chosen it there. Unmounting is a new generation.
 */
function useDraft<T>(src: NodeSource, stored: T) {
  const opts = src.opts;
  const [draft, setDraft] = useState<T>(stored);
  const generation = useRef(0);
  useEffect(() => {
    const gen = generation;
    return () => {
      gen.current += 1;
    };
  }, []);
  // Uploads in flight from this form, so Save waits for them.
  const [uploads, setUploads] = useState(0);
  const save = (value: Record<string, unknown>) => {
    generation.current += 1;
    src.update(value);
    src.close();
  };
  const uploadInto: UploadInto = async (file, purpose) => {
    const gen = generation.current;
    setUploads((n) => n + 1);
    opts.onUploadBusy(true);
    try {
      const r = await opts.upload(file, purpose);
      return gen === generation.current ? r : null;
    } catch (e) {
      // A redirect from the session check must still navigate (insertImage's
      // rule in prose-editor.tsx); only a real failure becomes a message.
      unstable_rethrow(e);
      return gen === generation.current ? { ok: false, error: e instanceof Error ? e.message : "upload failed" } : null;
    } finally {
      // Paired in `finally`: a busy count that leaked on a throw would leave
      // the article's commit and the EN/FR switch dead until a reload.
      setUploads((n) => n - 1);
      opts.onUploadBusy(false);
    }
  };
  return { draft, setDraft, save, busy: uploads > 0, uploadInto, opts };
}

function PanelForm({
  canSave,
  busy = false,
  onSave,
  children,
}: {
  canSave: boolean;
  busy?: boolean;
  onSave: () => void;
  children: ReactNode;
}) {
  // No title here: the panel's heading is the form's title (`useStagedPanel`'s
  // `title`), drawn by the rail's own shell.
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) onSave();
      }}
    >
      {children}
      {busy ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Uploading image…
        </p>
      ) : null}
      {/* Disabled until the draft differs from what is stored AND is a
          block the site will draw: a Save that commits a figure with no
          image, or a quote with no `by`, writes markdown the renderer
          unwraps (lib/staging-markdown.ts's notes on serializeCompare and
          quoteOpener lean on exactly this). */}
      <Button type="submit" size="sm" className="self-end" disabled={!canSave}>
        Save
      </Button>
    </form>
  );
}

function RadioRow<T extends string>({
  legend,
  options,
  labels,
  value,
  onChange,
}: {
  legend: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-xs font-medium text-muted-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {options.map((o) => (
          <ChoiceLabel key={o}>
            <NativeRadio name={name} value={o} checked={value === o} onChange={() => onChange(o)} />
            {labels[o]}
          </ChoiceLabel>
        ))}
      </div>
    </fieldset>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string | null;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type Slot = { src: string; alt: string };

/**
 * One image: upload a file, or paste the URL of one already hosted, plus its
 * alt. `onPatch` is applied by the caller as a FUNCTIONAL update, because an
 * upload resolves seconds after it starts and the author may have typed the
 * alt meanwhile — a patch built from the value at pick time would erase it.
 */
function ImageSlot({
  label,
  value,
  onPatch,
  svg,
  uploadInto,
}: {
  label: string;
  value: Slot;
  onPatch: (p: Partial<Slot>) => void;
  svg: boolean;
  uploadInto: UploadInto;
}) {
  const fileId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (file: File) => {
    setError(null);
    setPending(true);
    try {
      const r = await uploadInto(file, svg && file.type === "image/svg+xml" ? "figure-svg" : undefined);
      if (!r) return; // a discarded draft's upload: see useDraft
      if (r.ok) onPatch({ src: r.url });
      else setError(r.error);
    } finally {
      setPending(false);
    }
  };
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border p-2">
      <legend className="px-1 text-xs font-medium text-muted-foreground">{label}</legend>
      <div className="flex flex-col gap-1">
        <Label htmlFor={fileId} className="text-xs">
          Upload
        </Label>
        <input
          id={fileId}
          type="file"
          accept={svg ? FIGURE_ACCEPT : RASTER_ACCEPT}
          disabled={pending}
          className="text-xs file:mr-2 file:rounded-md file:border file:bg-background file:px-2 file:py-1"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void pick(file);
          }}
        />
      </div>
      <Field
        label="…or image URL"
        value={value.src}
        onChange={(src) => onPatch({ src })}
        placeholder="https://res.cloudinary.com/…"
        error={srcProblem(value.src)}
      />
      <Field label="Alt text" value={value.alt} onChange={(alt) => onPatch({ alt })} placeholder="Describe the image" />
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          Could not upload: {error}
        </p>
      ) : null}
    </fieldset>
  );
}

// Marks the node view's triggers for `withTriggerEvents` below.
const TRIGGER_ATTR = "data-staging-trigger";

/**
 * Closes the editor's `@` and `/` menus (spec §11: "lists stay out of the
 * way"). A block's panel opening over an open menu would leave the list
 * floating over the prose with focus gone into the panel. Each suggestion
 * plugin is keyed by its extension's name, `suggestion-entity` /
 * `suggestion-block` (editor-extensions.ts), and exits on a transaction
 * carrying `{ exit: true }` under its own key — what @tiptap/suggestion's
 * `exitSuggestion` dispatches for one key. Both, in one transaction, and
 * only when one is open, so an ordinary click dispatches nothing.
 * `lib/editor.test.ts` pins the name coupling.
 */
export function exitMenus(editor: Editor): void {
  if (editor.isDestroyed) return;
  const { state } = editor;
  const open = state.plugins.filter((p) => {
    const key = (p as unknown as { key: string }).key;
    return key.startsWith("suggestion-") && (p.getState(state) as { active?: boolean } | undefined)?.active;
  });
  if (open.length === 0) return;
  const tr = state.tr;
  for (const p of open) tr.setMeta(p, { exit: true });
  editor.view.dispatch(tr);
}

/**
 * "Make it a figure" (spec §12): the paragraph holding a lone image becomes a
 * `stagedFigure` in ONE transaction — one undo gives back the plain image,
 * byte for byte — and the new figure's panel opens, as an inserted one's does.
 * Whether it may is `figureFromImage`'s call (lib/staging-convert.ts), which
 * the bubble menu asked first; asked again here, so a stale menu can never
 * convert what the state no longer allows. `closeHistory` keeps the step from
 * merging into the typing before it, so that undo restores the image and
 * nothing else.
 *
 * WHICH figure opens is the node itself, not a position or a flag: the figure
 * built here is remembered against its editor, and a figure view opens on
 * mount only when it is drawing that very node. Identity rather than
 * position, because positions are shared by whatever lands there next. Every
 * other figure mounting at the same moment (a page load, a paste) is a
 * different node and opens nothing.
 *
 * It is retired by the next document change rather than by being read, so
 * React's development double-mount opens it as production's single mount
 * does, and a later transaction — a redo that brings the same node back —
 * does not reopen it. "The next document" is the one the dispatch LEFT, not
 * `tr.doc`: an appended transaction can follow in the same dispatch (the
 * trailing paragraph after a figure that ends the document), and the view
 * may mount during the dispatch itself, before that document exists — hence
 * `doc: null` until the dispatch returns.
 *
 * An inserted figure needs none of this — it is EMPTY, which is its own mark.
 */
const justConverted = new WeakMap<Editor, { node: PMNode; doc: PMNode | null }>();

function isJustConverted(editor: Editor, node: PMNode): boolean {
  const pending = justConverted.get(editor);
  return !!pending && pending.node === node && (pending.doc === null || pending.doc === editor.state.doc);
}

export function makeFigure(editor: Editor): boolean {
  const verdict = figureFromImage(editor.state);
  if (!verdict?.ok) return false;
  const { state } = editor;
  const figure = state.schema.nodes.stagedFigure.create(verdict.attrs);
  const tr = closeHistory(state.tr.replaceWith(verdict.from, verdict.to, figure));
  tr.setSelection(NodeSelection.create(tr.doc, verdict.from)).scrollIntoView();
  const pending = { node: figure, doc: null as PMNode | null };
  justConverted.set(editor, pending);
  editor.view.dispatch(tr);
  pending.doc = editor.state.doc;
  return true;
}

interface StagedPanel {
  /** False outside an `EntityRail`: the trigger then draws, inert, and edits nothing. */
  available: boolean;
  expanded: boolean;
  triggerProps: Record<string, unknown>;
}

/**
 * A node view's door to the rail's panel (spec §11), replacing the popover
 * each view used to own.
 *
 * The form goes to `EntityRail` as a node built HERE, so its `NodeSource` is
 * built here too, once per node view, over a ref that tracks the node view's
 * latest props. A media block whose markdown is "" (freshly inserted) opens
 * on mount, as the popover did; and a node view that unmounts — its node
 * deleted, dragged, the editor gone — closes its own panel, never anyone
 * else's.
 */
function useStagedPanel(
  props: NodeViewProps,
  title: string,
  Form: ComponentType<FormProps>,
  openOnMount: boolean,
): StagedPanel {
  const panel = useRailPanel();
  const id = useId();
  const trigger = useRef<HTMLDivElement>(null);
  const live = useRef(props);
  useLayoutEffect(() => {
    live.current = props;
  });
  const { editor } = props;
  const typeName = props.node.type.name;
  const options = optionsOf(props);
  const close = panel?.close;
  const src = useMemo<NodeSource>(
    () => ({
      editor,
      typeName,
      getPos: () => live.current.getPos(),
      update: (attrs) => live.current.updateAttributes(attrs),
      close: () => close?.(id),
      opts: options,
    }),
    [editor, typeName, close, id, options],
  );
  const show = (onInsert = false) => {
    if (!panel) return;
    // Not on insert: the `/` menu that inserted this block closes itself, and
    // this runs inside that pick's dispatch (Tiptap renders a new node view
    // synchronously), where a second dispatch would be a nested one.
    const pos = positionOf(src);
    if (typeof pos !== "number") return;
    if (!onInsert) exitMenus(editor);
    const tracked = track(editor, pos);
    panel.open({
      id,
      title,
      content: <LiveForm src={src} tracked={tracked} Form={Form} />,
      returnFocus: trigger.current,
      onClose: tracked.stop,
    });
  };
  // Mount and unmount only. `show` reads `panel` at mount, which is the
  // rail the node view mounted under; `close` is stable for its lifetime.
  useEffect(() => {
    if (openOnMount || isJustConverted(editor, live.current.node)) show(true);
    return () => close?.(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const expanded = panel?.openId === id;
  const toggle = () => (expanded ? panel?.close(id) : show());
  if (!panel) return { available: false, expanded: false, triggerProps: {} };
  return {
    available: true,
    expanded,
    triggerProps: {
      ref: trigger,
      role: "button",
      tabIndex: 0,
      "aria-expanded": expanded,
      // Only while expanded: a page panel exists only while it is open.
      "aria-controls": expanded ? panel.panelId : undefined,
      [TRIGGER_ATTR]: "",
      onClick: toggle,
      onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault(); // Space would scroll the page
        toggle();
      },
    },
  };
}

/**
 * The media block's face: its published self, as a control. A `div` with the
 * button role, never a `<button>`: the preview is a `<figure>` whose images
 * are real `<a href>`s (staged-image.tsx), and neither may sit inside a
 * button. The preview is INERT — no anchor is focusable or clickable, so a
 * click cannot navigate the editor away from unsaved prose, and the trigger
 * itself is the event target. Without a rail to open a panel in, it is the
 * preview and nothing more.
 */
function MediaTrigger({
  panel,
  label,
  markdown,
  lang,
  placeholder,
}: {
  panel: StagedPanel;
  label: string;
  markdown: string;
  lang: Lang;
  placeholder: string;
}) {
  return (
    <div
      {...panel.triggerProps}
      aria-label={panel.available ? label : undefined}
      className={
        "block w-full rounded-xl text-left outline-none " +
        (panel.available
          ? "cursor-pointer ring-offset-4 ring-offset-background hover:ring-2 hover:ring-ring/40 focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:ring-2 aria-expanded:ring-ring/60"
          : "")
      }
    >
      {markdown ? (
        <div inert className="pointer-events-none">
          <Preview markdown={markdown} lang={lang} />
        </div>
      ) : (
        <span className="flex h-24 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          {placeholder}
        </span>
      )}
    </div>
  );
}

// ── Media blocks ───────────────────────────────────────────────────────────

const figureOf = (a: Record<string, unknown>): FigureFields => a as unknown as FigureFields;

const imageName = (src: string, alt: string) => (!src.trim() ? "no image" : alt.trim() || "image without alt text");

function FigureForm({ src, attrs }: FormProps) {
  const stored = figureOf(attrs);
  const f = useDraft(src, stored);
  const d = f.draft;
  const patch = (p: Partial<FigureFields>) => f.setDraft((x) => ({ ...x, ...p }));
  const canSave = !f.busy && d.src.trim() !== "" && srcsOk(d.src, d.darkSrc) && !same(d, stored);
  return (
    <PanelForm canSave={canSave} busy={f.busy} onSave={() => f.save({ ...d })}>
      <RadioRow
        legend="Frame"
        options={FRAMES}
        labels={FRAME_LABELS}
        value={d.frame}
        // A size still at the old frame's default follows the new frame's:
        // a phone wants `m` and a desktop `l`, and a size the author never
        // chose should not be the one thing that does not move.
        onChange={(frame) => patch({ frame, size: d.size === DEFAULT_SIZE[d.frame] ? DEFAULT_SIZE[frame] : d.size })}
      />
      <RadioRow legend="Size" options={SIZES} labels={SIZE_LABELS} value={d.size} onChange={(size) => patch({ size })} />
      <ImageSlot label="Image" value={{ src: d.src, alt: d.alt }} onPatch={(p) => patch(p)} svg uploadInto={f.uploadInto} />
      <ImageSlot
        label="Dark-mode image (optional)"
        value={{ src: d.darkSrc, alt: d.darkAlt }}
        onPatch={(p) => patch({ ...(p.src !== undefined ? { darkSrc: p.src } : {}), ...(p.alt !== undefined ? { darkAlt: p.alt } : {}) })}
        svg
        uploadInto={f.uploadInto}
      />
      <Field label="Caption" value={d.caption} onChange={(caption) => patch({ caption })} />
    </PanelForm>
  );
}

function FigureView(props: NodeViewProps) {
  const stored = figureOf(props.node.attrs);
  const markdown = serializeFigure(stored);
  const panel = useStagedPanel(props, "Figure", FigureForm, markdown === "");
  return (
    <NodeViewWrapper className="not-prose my-4" data-drag-handle>
      <MediaTrigger
        panel={panel}
        label={`Edit figure: ${imageName(stored.src, stored.alt)}`}
        markdown={markdown}
        lang={optionsOf(props).lang}
        placeholder="Empty figure — add an image"
      />
    </NodeViewWrapper>
  );
}

const galleryOf = (a: Record<string, unknown>): GalleryFields => a as unknown as GalleryFields;
const EMPTY_IMAGE: GalleryImage = { src: "", alt: "", title: "" };

function GalleryForm({ src, attrs }: FormProps) {
  const stored = galleryOf(attrs);
  const f = useDraft(src, stored);
  const d = f.draft;
  // Two empty slots on a fresh gallery: it needs two to be one.
  const images = d.images.length ? d.images : [EMPTY_IMAGE, EMPTY_IMAGE];
  const setImages = (fn: (imgs: GalleryImage[]) => GalleryImage[]) =>
    f.setDraft((x) => ({ ...x, images: fn(x.images.length ? x.images : [EMPTY_IMAGE, EMPTY_IMAGE]) }));
  const patchAt = (i: number, p: Partial<GalleryImage>) => setImages((imgs) => imgs.map((m, j) => (j === i ? { ...m, ...p } : m)));
  const move = (i: number, by: number) =>
    setImages((imgs) => {
      const next = [...imgs];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });
  // Reordering and removing wait for uploads: a slot's upload lands by INDEX
  // when it resolves, so a move mid-flight would put the image in the wrong
  // place.
  //
  // Empty slots are dropped on save rather than stored: the serializer skips
  // them anyway, and a stored blank would reopen as a slot nobody added.
  const kept = { ...d, images: images.filter((m) => m.src.trim()) };
  const canSave =
    !f.busy && kept.images.length >= 2 && srcsOk(...kept.images.map((m) => m.src)) && !same(kept, stored);
  return (
    <PanelForm canSave={canSave} busy={f.busy} onSave={() => f.save({ ...kept })}>
      <RadioRow legend="Frame" options={FRAMES} labels={FRAME_LABELS} value={d.frame} onChange={(frame) => f.setDraft((x) => ({ ...x, frame }))} />
      {images.map((m, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <ImageSlot label={`Image ${i + 1}`} value={{ src: m.src, alt: m.alt }} onPatch={(p) => patchAt(i, p)} svg={false} uploadInto={f.uploadInto} />
          <Field label={`Image ${i + 1} title`} value={m.title} onChange={(title) => patchAt(i, { title })} />
          <div className="flex gap-1 self-end">
            <Button type="button" size="icon-sm" variant="ghost" aria-label={`Move image ${i + 1} up`} disabled={f.busy || i === 0} onClick={() => move(i, -1)}>
              <ArrowUp />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Move image ${i + 1} down`}
              disabled={f.busy || i === images.length - 1}
              onClick={() => move(i, 1)}
            >
              <ArrowDown />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Remove image ${i + 1}`}
              disabled={f.busy}
              onClick={() => setImages((imgs) => imgs.filter((_, j) => j !== i))}
            >
              <X />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => setImages((imgs) => [...imgs, EMPTY_IMAGE])}>
        Add image
      </Button>
      <Field label="Caption" value={d.caption} onChange={(caption) => f.setDraft((x) => ({ ...x, caption }))} />
    </PanelForm>
  );
}

function GalleryView(props: NodeViewProps) {
  const stored = galleryOf(props.node.attrs);
  const markdown = serializeGallery(stored);
  const panel = useStagedPanel(props, "Gallery", GalleryForm, markdown === "");
  const count = stored.images.filter((m) => m.src.trim()).length;
  return (
    <NodeViewWrapper className="not-prose my-4" data-drag-handle>
      <MediaTrigger
        panel={panel}
        label={`Edit gallery: ${count ? `${count} images` : "no images"}`}
        markdown={markdown}
        lang={optionsOf(props).lang}
        placeholder="Empty gallery — add two images"
      />
    </NodeViewWrapper>
  );
}

const compareOf = (a: Record<string, unknown>): CompareFields => a as unknown as CompareFields;

function CompareForm({ src, attrs }: FormProps) {
  const stored = compareOf(attrs);
  const f = useDraft(src, stored);
  const d = f.draft;
  const labels = COMPARE_LABELS[f.opts.lang];
  const patchSide = (side: keyof CompareFields, p: Partial<SideFields>) =>
    f.setDraft((x) => ({ ...x, [side]: { ...x[side], ...p } }));
  const canSave =
    !f.busy && d.do.text.trim() !== "" && d.dont.text.trim() !== "" && srcsOk(d.do.src, d.dont.src) && !same(d, stored);
  return (
    <PanelForm canSave={canSave} busy={f.busy} onSave={() => f.save({ do: { ...d.do }, dont: { ...d.dont } })}>
      {COMPARE_SIDES.map((side) => (
        // A fieldset per side, so "Do" and "Don't" NAME their halves for
        // assistive tech — two identical "Text" fields otherwise.
        <fieldset key={side} className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-medium">{labels[side]}</legend>
          <Field label="Text" value={d[side].text} required onChange={(text) => patchSide(side, { text })} />
          <ImageSlot
            label="Image (optional)"
            value={{ src: d[side].src, alt: d[side].alt }}
            onPatch={(p) => patchSide(side, p)}
            svg={false}
            uploadInto={f.uploadInto}
          />
        </fieldset>
      ))}
    </PanelForm>
  );
}

function CompareView(props: NodeViewProps) {
  const stored = compareOf(props.node.attrs);
  const markdown = serializeCompare(stored);
  const panel = useStagedPanel(props, "Do / Don't", CompareForm, markdown === "");
  const name = (t: string) => t.trim() || "no text";
  return (
    <NodeViewWrapper className="not-prose my-4" data-drag-handle>
      <MediaTrigger
        panel={panel}
        label={`Edit do / don't: ${name(stored.do.text)} / ${name(stored.dont.text)}`}
        markdown={markdown}
        lang={optionsOf(props).lang}
        placeholder="Empty do / don't — add both texts"
      />
    </NodeViewWrapper>
  );
}

// ── Text blocks ────────────────────────────────────────────────────────────

/** The trigger of a text block's line: the label or the attribution. Out of
 *  the editable flow (`contentEditable={false}` on its wrapper), so the caret
 *  never lands in the chrome around the body. */
function LineTrigger({
  panel,
  label,
  className,
  children,
}: {
  panel: StagedPanel;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      {...panel.triggerProps}
      aria-label={panel.available ? label : undefined}
      className={
        "w-fit rounded-md text-left outline-none " +
        (panel.available ? "cursor-pointer hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:underline " : "") +
        (className ?? "")
      }
    >
      {children}
    </div>
  );
}

/**
 * The label as the author typed it → label SOURCE for calloutOpener, which
 * writes it verbatim between `[` and `]`. An unescaped `]` ends the label
 * early (`:::callout[a ] b]` is no longer a directive, and the site draws the
 * fence as text), an unescaped `[` can open a nested bracket remark then
 * balances against the wrong `]`, and a trailing lone `\` escapes the closer.
 *
 * Only UNESCAPED brackets are escaped, never every backslash: the field holds
 * markdown source, shown back as stored, so `\*not emphasis\*` or an already
 * escaped `\]` must survive a save unchanged — escaping `\` too would double
 * every backslash on each save, the bug calloutOpener's own note records.
 * Idempotent, which is what lets the field round-trip the stored value.
 */
export function escapeLabel(text: string): string {
  let out = "";
  let run = 0; // backslashes immediately before this character
  for (const c of text) {
    if ((c === "[" || c === "]") && run % 2 === 0) out += "\\";
    out += c;
    run = c === "\\" ? run + 1 : 0;
  }
  return run % 2 === 1 ? `${out}\\` : out;
}

// The label is markdown SOURCE (lib/staging-markdown.ts's calloutOpener), so
// it is drawn through the site's chain — `*Note*` reads as emphasis here
// exactly as it will there — with the paragraph unwrapped: the label sits in
// the same <p> CalloutLabel draws.
const inlineComponents = (lang: Lang) => ({ ...stagingComponents(lang), p: ({ children }: { children?: ReactNode }) => <>{children}</> });


function CalloutForm({ src, attrs }: FormProps) {
  const label = (attrs.label as string | null) ?? "";
  const f = useDraft(src, { label });
  // Against the stored SOURCE, through the same escape Save applies — or an
  // untouched label that holds an escaped bracket would light Save up.
  const canSave = escapeLabel(f.draft.label.trim()) !== label.trim();
  return (
    <PanelForm canSave={canSave} onSave={() => f.save({ label: escapeLabel(f.draft.label.trim()) || null })}>
      <Field label="Label" value={f.draft.label} onChange={(v) => f.setDraft({ label: v })} placeholder="Note" />
    </PanelForm>
  );
}

function CalloutView(props: NodeViewProps) {
  const label = (props.node.attrs.label as string | null) ?? "";
  const panel = useStagedPanel(props, "Callout label", CalloutForm, false);
  return (
    <NodeViewWrapper as="aside" className={CALLOUT_CLASS}>
      <div contentEditable={false} className="pt-4">
        {/* The trigger names its stored value (CLAUDE.md, "An icon trigger
            names its stored value"), and an empty one says so. */}
        <LineTrigger panel={panel} label={`Edit callout label: ${label || "none"}`}>
          {label ? (
            <span className={CALLOUT_LABEL_CLASS}>
              <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={inlineComponents(optionsOf(props).lang)}>
                {label}
              </Markdown>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Add a label (optional)</span>
          )}
        </LineTrigger>
      </div>
      <NodeViewContent className="pb-4" />
    </NodeViewWrapper>
  );
}

function QuoteForm({ src, attrs }: FormProps) {
  const by = String(attrs.by ?? "");
  const role = (attrs.role as string | null) ?? "";
  const f = useDraft(src, { by, role });
  const d = f.draft;
  const canSave = d.by.trim() !== "" && !same({ by: d.by.trim(), role: d.role.trim() }, { by: by.trim(), role: role.trim() });
  return (
    <PanelForm canSave={canSave} onSave={() => f.save({ by: d.by.trim(), role: d.role.trim() || null })}>
      <Field label="By" value={d.by} required onChange={(v) => f.setDraft((x) => ({ ...x, by: v }))} />
      <Field label="Role (optional)" value={d.role} onChange={(v) => f.setDraft((x) => ({ ...x, role: v }))} />
    </PanelForm>
  );
}

function QuoteView(props: NodeViewProps) {
  const by = String(props.node.attrs.by ?? "");
  const role = (props.node.attrs.role as string | null) ?? "";
  const panel = useStagedPanel(props, "Attribution", QuoteForm, false);
  return (
    <NodeViewWrapper as="figure" className={QUOTE_CLASS}>
      <span aria-hidden="true" contentEditable={false} className={QUOTE_MARK_CLASS}>
        “
      </span>
      <NodeViewContent<"blockquote"> as="blockquote" className={QUOTE_BODY_CLASS} />
      <div contentEditable={false} className={QUOTE_BY_CLASS}>
        {/* An empty `by` writes a `:::quote` the site refuses to draw
            (lib/staging-markdown.ts's quoteOpener), so its absence is drawn
            as the one thing still missing, not as blank. */}
        <LineTrigger panel={panel} label={`Edit attribution: ${by ? `${by}${role ? `, ${role}` : ""}` : "none"}`}>
          {by ? (
            <>
              — {by}
              {role ? `, ${role}` : ""}
            </>
          ) : (
            <span className="text-destructive">— Who said this? (required)</span>
          )}
        </LineTrigger>
      </div>
    </NodeViewWrapper>
  );
}

/**
 * Keys and clicks on a trigger belong to the trigger, not to ProseMirror.
 * With a `<button>` Tiptap's default `stopEvent` already said so; a `div`
 * trigger is not one it recognises, and without this an Enter on a focused
 * trigger would ALSO reach the editor's keymap — splitting or replacing the
 * selected node. `mousedown` and drag events still go to the default, so a
 * click selects the atom (Backspace deletes it) and dragging still works.
 */
function withTriggerEvents(render: NodeViewRenderer): NodeViewRenderer {
  return (props) => {
    const view = render(props) as ReturnType<NodeViewRenderer> & { stopEvent?: (event: Event) => boolean };
    const base = view.stopEvent?.bind(view);
    view.stopEvent = (event: Event) => {
      const t = event.target;
      const passThrough = event.type === "mousedown" || event.type.startsWith("drag") || event.type === "drop";
      if (!passThrough && t instanceof Element && t.closest(`[${TRIGGER_ATTR}]`)) return true;
      return base ? base(event) : false;
    };
    return view;
  };
}

/**
 * The five staging nodes with their views, bound to this editor's upload,
 * busy reporting and language. `.extend()`ed copies of lib/staging-editor.ts's
 * headless nodes — the schema and markdown stay there, once — exactly as
 * entityExtensions does for the entity nodes.
 */
export function stagingExtensions(opts: StagingViewOptions) {
  const view = (node: typeof StagedFigure, View: (p: NodeViewProps) => React.ReactElement) =>
    node.extend({
      addOptions() {
        return { ...this.parent?.(), ...opts };
      },
      addNodeView() {
        return withTriggerEvents(ReactNodeViewRenderer(View));
      },
    });
  return [
    view(StagedFigure, FigureView),
    view(StagedGallery, GalleryView),
    view(StagedCompare, CompareView),
    view(StagedCallout, CalloutView),
    view(StagedQuote, QuoteView),
  ];
}
