"use client";

import { useId, useState, type ReactNode } from "react";
import Markdown from "react-markdown";
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
import { remarkPlugins, rehypePlugins } from "@/lib/markdown";
import { ALLOWED_TYPES } from "@/lib/upload-input";
import { stagingComponents } from "@/components/staging/markdown-components";
import { CALLOUT_CLASS, CALLOUT_LABEL_CLASS } from "@/components/staging/callout";
import { QUOTE_BODY_CLASS, QUOTE_BY_CLASS, QUOTE_CLASS, QUOTE_MARK_CLASS } from "@/components/staging/quote";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChoiceLabel, NativeRadio } from "@/components/ui/native-controls";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

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
 * NOTHING IS WRITTEN UNTIL SAVE. Every popover edits a DRAFT; Save is the one
 * `updateAttributes`, and Escape or a click outside throws the draft away. A
 * field written on every keystroke would make the half-typed caption the
 * stored one the moment the author looked away, and would make each letter
 * its own undo step.
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

function Preview({ markdown, lang }: { markdown: string; lang: Lang }) {
  return (
    <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={stagingComponents(lang)}>
      {markdown}
    </Markdown>
  );
}

/**
 * Draft, open state and the empty-block rule, shared by every popover.
 *
 * A block whose markdown is "" (an atom with no image, lib/staging-markdown.ts)
 * already vanishes on save. Cancelled while still empty it is also DELETED,
 * so the author is not left looking at an empty box the document no longer
 * contains — and the same test, made once at mount, is what opens a block
 * freshly inserted from `/`. Local state rather than a transient attribute:
 * an attribute would be stored, serialized and undone like any other.
 */
function useDraft<T>(props: NodeViewProps, stored: T, empty: boolean) {
  const [open, setOpen] = useState(empty);
  const [draft, setDraft] = useState<T>(stored);
  // Uploads in flight inside THIS form: Save waits for them, or it would
  // commit the slot as it was before the image arrived.
  const [uploads, setUploads] = useState(0);
  const onOpenChange = (next: boolean) => {
    if (next) {
      setDraft(stored);
      setOpen(true);
      return;
    }
    setOpen(false);
    if (empty) props.deleteNode();
  };
  const save = (value: Record<string, unknown>) => {
    props.updateAttributes(value);
    setOpen(false);
  };
  const onLocalBusy = (busy: boolean) => setUploads((n) => n + (busy ? 1 : -1));
  return { open, onOpenChange, draft, setDraft, save, busy: uploads > 0, onLocalBusy };
}

function PopoverForm({
  open,
  onOpenChange,
  trigger,
  title,
  canSave,
  onSave,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  title: string;
  canSave: boolean;
  onSave: () => void;
  children: ReactNode;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {trigger}
      <PopoverContent align="start" className="max-h-[70vh] w-80 overflow-y-auto">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) onSave();
          }}
        >
          <PopoverTitle>{title}</PopoverTitle>
          {children}
          {/* Disabled until the draft differs from what is stored AND is a
              block the site will draw: a Save that commits a figure with no
              image, or a quote with no `by`, writes markdown the renderer
              unwraps (lib/staging-markdown.ts's notes on serializeCompare and
              quoteOpener lean on exactly this). */}
          <Button type="submit" size="sm" className="self-end" disabled={!canSave}>
            Save
          </Button>
        </form>
      </PopoverContent>
    </Popover>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input id={id} value={value} placeholder={placeholder} required={required} onChange={(e) => onChange(e.target.value)} />
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
  opts,
  onLocalBusy,
}: {
  label: string;
  value: Slot;
  onPatch: (p: Partial<Slot>) => void;
  svg: boolean;
  opts: StagingViewOptions;
  onLocalBusy: (busy: boolean) => void;
}) {
  const fileId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (file: File) => {
    setError(null);
    setBusy(true);
    onLocalBusy(true);
    opts.onUploadBusy(true);
    try {
      const r = await opts.upload(file, svg && file.type === "image/svg+xml" ? "figure-svg" : undefined);
      if (r.ok) onPatch({ src: r.url });
      else setError(r.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
    } finally {
      // Paired in `finally`: a busy count that leaked on a throw would leave
      // the article's commit and the EN/FR switch dead until a reload.
      setBusy(false);
      onLocalBusy(false);
      opts.onUploadBusy(false);
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
          disabled={busy}
          className="text-xs file:mr-2 file:rounded-md file:border file:bg-background file:px-2 file:py-1"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void pick(file);
          }}
        />
      </div>
      <Field label="…or image URL" value={value.src} onChange={(src) => onPatch({ src })} placeholder="https://res.cloudinary.com/…" />
      <Field label="Alt text" value={value.alt} onChange={(alt) => onPatch({ alt })} placeholder="Describe the image" />
      {busy ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Uploading…
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          Could not upload: {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/**
 * The media block's face: its published self, as a button. INERT inside —
 * every staged image is a real `<a href>` to the original (staged-image.tsx),
 * and a click landing on that anchor would navigate the editor away from
 * unsaved prose. Inert also hands the click to the BUTTON, which is the
 * element ProseMirror's node view lets through (Tiptap's `stopEvent` passes
 * events whose target is a button), so opening the popover does not also
 * select or drag the node.
 */
function MediaTrigger({ label, markdown, lang, placeholder }: { label: string; markdown: string; lang: Lang; placeholder: string }) {
  return (
    <PopoverTrigger
      aria-label={label}
      className="block w-full cursor-pointer rounded-xl text-left outline-none ring-offset-4 ring-offset-background hover:ring-2 hover:ring-ring/40 focus-visible:ring-3 focus-visible:ring-ring/50"
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
    </PopoverTrigger>
  );
}

// ── Media blocks ───────────────────────────────────────────────────────────

const figureOf = (a: Record<string, unknown>): FigureFields => a as unknown as FigureFields;

function FigureView(props: NodeViewProps) {
  const opts = optionsOf(props);
  const stored = figureOf(props.node.attrs);
  const markdown = serializeFigure(stored);
  const f = useDraft(props, stored, markdown === "");
  const d = f.draft;
  const patch = (p: Partial<FigureFields>) => f.setDraft((x) => ({ ...x, ...p }));
  const canSave = !f.busy && d.src.trim() !== "" && !same(d, stored);
  return (
    <NodeViewWrapper className="not-prose my-4" data-drag-handle>
      <PopoverForm
        open={f.open}
        onOpenChange={f.onOpenChange}
        title="Figure"
        canSave={canSave}
        onSave={() => f.save({ ...d })}
        trigger={<MediaTrigger label="Edit figure" markdown={markdown} lang={opts.lang} placeholder="Figure — add an image" />}
      >
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
        <ImageSlot
          label="Image"
          value={{ src: d.src, alt: d.alt }}
          onPatch={(p) => patch(p)}
          svg
          opts={opts}
          onLocalBusy={f.onLocalBusy}
        />
        <ImageSlot
          label="Dark-mode image (optional)"
          value={{ src: d.darkSrc, alt: d.darkAlt }}
          onPatch={(p) => patch({ ...(p.src !== undefined ? { darkSrc: p.src } : {}), ...(p.alt !== undefined ? { darkAlt: p.alt } : {}) })}
          svg
          opts={opts}
          onLocalBusy={f.onLocalBusy}
        />
        <Field label="Caption" value={d.caption} onChange={(caption) => patch({ caption })} />
      </PopoverForm>
    </NodeViewWrapper>
  );
}

const galleryOf = (a: Record<string, unknown>): GalleryFields => a as unknown as GalleryFields;
const EMPTY_IMAGE: GalleryImage = { src: "", alt: "", title: "" };

function GalleryView(props: NodeViewProps) {
  const opts = optionsOf(props);
  const stored = galleryOf(props.node.attrs);
  const markdown = serializeGallery(stored);
  const f = useDraft(props, stored, markdown === "");
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
  const canSave = !f.busy && kept.images.length >= 2 && !same(kept, stored);
  return (
    <NodeViewWrapper className="not-prose my-4" data-drag-handle>
      <PopoverForm
        open={f.open}
        onOpenChange={f.onOpenChange}
        title="Gallery"
        canSave={canSave}
        onSave={() => f.save({ ...kept })}
        trigger={<MediaTrigger label="Edit gallery" markdown={markdown} lang={opts.lang} placeholder="Gallery — add two images or more" />}
      >
        <RadioRow legend="Frame" options={FRAMES} labels={FRAME_LABELS} value={d.frame} onChange={(frame) => f.setDraft((x) => ({ ...x, frame }))} />
        {images.map((m, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <ImageSlot
              label={`Image ${i + 1}`}
              value={{ src: m.src, alt: m.alt }}
              onPatch={(p) => patchAt(i, p)}
              svg={false}
              opts={opts}
              onLocalBusy={f.onLocalBusy}
            />
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
      </PopoverForm>
    </NodeViewWrapper>
  );
}

const compareOf = (a: Record<string, unknown>): CompareFields => a as unknown as CompareFields;

function CompareView(props: NodeViewProps) {
  const opts = optionsOf(props);
  const stored = compareOf(props.node.attrs);
  const markdown = serializeCompare(stored);
  const f = useDraft(props, stored, markdown === "");
  const d = f.draft;
  const labels = COMPARE_LABELS[opts.lang];
  const patchSide = (side: keyof CompareFields, p: Partial<SideFields>) =>
    f.setDraft((x) => ({ ...x, [side]: { ...x[side], ...p } }));
  const canSave = !f.busy && d.do.text.trim() !== "" && d.dont.text.trim() !== "" && !same(d, stored);
  return (
    <NodeViewWrapper className="not-prose my-4" data-drag-handle>
      <PopoverForm
        open={f.open}
        onOpenChange={f.onOpenChange}
        title="Do / Don't"
        canSave={canSave}
        onSave={() => f.save({ do: { ...d.do }, dont: { ...d.dont } })}
        trigger={<MediaTrigger label="Edit do / don't" markdown={markdown} lang={opts.lang} placeholder="Do / Don't — describe both sides" />}
      >
        {COMPARE_SIDES.map((side) => (
          <div key={side} className="flex flex-col gap-2">
            <p className="text-xs font-medium">{labels[side]}</p>
            <Field label="Text" value={d[side].text} required onChange={(text) => patchSide(side, { text })} />
            <ImageSlot
              label="Image (optional)"
              value={{ src: d[side].src, alt: d[side].alt }}
              onPatch={(p) => patchSide(side, p)}
              svg={false}
              opts={opts}
              onLocalBusy={f.onLocalBusy}
            />
          </div>
        ))}
      </PopoverForm>
    </NodeViewWrapper>
  );
}

// ── Text blocks ────────────────────────────────────────────────────────────

/** The trigger of a text block's line: the label or the attribution. Out of
 *  the editable flow (`contentEditable={false}`), so the caret never lands in
 *  the chrome around the body. */
function LineTrigger({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <PopoverTrigger
      aria-label={label}
      className={`cursor-pointer rounded-md text-left outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 ${className ?? ""}`}
    >
      {children}
    </PopoverTrigger>
  );
}

// The label is markdown SOURCE (lib/staging-markdown.ts's calloutOpener), so
// it is drawn through the site's chain — `*Note*` reads as emphasis here
// exactly as it will there — with the paragraph unwrapped: the label sits in
// the same <p> CalloutLabel draws.
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

const inlineComponents = (lang: Lang) => ({ ...stagingComponents(lang), p: ({ children }: { children?: ReactNode }) => <>{children}</> });

function CalloutView(props: NodeViewProps) {
  const opts = optionsOf(props);
  const label = (props.node.attrs.label as string | null) ?? "";
  const f = useDraft(props, { label }, false);
  const canSave = escapeLabel(f.draft.label.trim()) !== label.trim();
  return (
    <NodeViewWrapper as="aside" className={CALLOUT_CLASS}>
      <div contentEditable={false} className="pt-4">
        <PopoverForm
          open={f.open}
          onOpenChange={f.onOpenChange}
          title="Callout"
          canSave={canSave}
          onSave={() => f.save({ label: escapeLabel(f.draft.label.trim()) || null })}
          trigger={
            <LineTrigger label={label ? "Edit callout label" : "Add a callout label"}>
              {label ? (
                <span className={CALLOUT_LABEL_CLASS}>
                  <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={inlineComponents(opts.lang)}>
                    {label}
                  </Markdown>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Add a label (optional)</span>
              )}
            </LineTrigger>
          }
        >
          <Field label="Label" value={f.draft.label} onChange={(v) => f.setDraft({ label: v })} placeholder="Note" />
        </PopoverForm>
      </div>
      <NodeViewContent className="pb-4" />
    </NodeViewWrapper>
  );
}

function QuoteView(props: NodeViewProps) {
  const by = String(props.node.attrs.by ?? "");
  const role = (props.node.attrs.role as string | null) ?? "";
  const stored = { by, role };
  const f = useDraft(props, stored, false);
  const d = f.draft;
  const canSave = d.by.trim() !== "" && !same({ by: d.by.trim(), role: d.role.trim() }, { by: by.trim(), role: role.trim() });
  return (
    <NodeViewWrapper as="figure" className={QUOTE_CLASS}>
      <span aria-hidden="true" contentEditable={false} className={QUOTE_MARK_CLASS}>
        “
      </span>
      <NodeViewContent<"blockquote"> as="blockquote" className={QUOTE_BODY_CLASS} />
      <div contentEditable={false} className={QUOTE_BY_CLASS}>
        <PopoverForm
          open={f.open}
          onOpenChange={f.onOpenChange}
          title="Attribution"
          canSave={canSave}
          onSave={() => f.save({ by: d.by.trim(), role: d.role.trim() || null })}
          trigger={
            // An empty `by` writes a `:::quote` the site refuses to draw
            // (lib/staging-markdown.ts's quoteOpener), so its absence is
            // drawn as the one thing still missing, not as blank.
            <LineTrigger label={by ? `Edit attribution: ${by}` : "Add attribution"}>
              {by ? (
                <>
                  — {by}
                  {role ? `, ${role}` : ""}
                </>
              ) : (
                <span className="text-destructive">— Who said this? (required)</span>
              )}
            </LineTrigger>
          }
        >
          <Field label="By" value={d.by} required onChange={(v) => f.setDraft((x) => ({ ...x, by: v }))} />
          <Field label="Role (optional)" value={d.role} onChange={(v) => f.setDraft((x) => ({ ...x, role: v }))} />
        </PopoverForm>
      </div>
    </NodeViewWrapper>
  );
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
        return ReactNodeViewRenderer(View);
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
