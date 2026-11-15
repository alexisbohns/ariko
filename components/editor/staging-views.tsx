"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import Markdown from "react-markdown";
import type { NodeViewRenderer } from "@tiptap/core";
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
 * NOTHING IS WRITTEN UNTIL SAVE, AND NOTHING IS DELETED BY A CLOSE. Every
 * popover edits a DRAFT; Save is the one `updateAttributes`, and Escape, a
 * click outside or focus leaving all throw the draft away and leave the node
 * as stored. A media block left empty stays on screen as a dashed placeholder
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
 * figure the author saw in the popover is simply missing from the page.
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
 * Draft, open state and uploads, shared by every popover.
 *
 * A block whose markdown is "" (a freshly inserted media atom) opens on
 * mount — local state rather than a transient attribute, which would be
 * stored, serialized and undone like any other.
 *
 * `generation` counts drafts. An upload resolves seconds after it starts, and
 * the popover may have been closed — its draft discarded — and reopened on a
 * fresh one in the meantime; a result tagged with an older generation is
 * dropped, or a file picked into an abandoned draft would appear in the new
 * one as if the author had chosen it there.
 */
function useDraft<T>(props: NodeViewProps, stored: T, empty: boolean) {
  const opts = optionsOf(props);
  const [open, setOpen] = useState(empty);
  const [draft, setDraft] = useState<T>(stored);
  const generation = useRef(0);
  // Uploads in flight from this node's popover, of any generation: Save
  // waits for them, and the form says so even after a reopen remounted the
  // slot that started one.
  const [uploads, setUploads] = useState(0);
  const reset = () => {
    generation.current += 1;
    setDraft(stored);
  };
  const onOpenChange = (next: boolean) => {
    reset();
    setOpen(next);
  };
  const save = (value: Record<string, unknown>) => {
    generation.current += 1;
    props.updateAttributes(value);
    setOpen(false);
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
  return { open, onOpenChange, draft, setDraft, save, busy: uploads > 0, uploadInto, opts };
}

function PopoverForm({
  open,
  onOpenChange,
  trigger,
  title,
  canSave,
  busy = false,
  onSave,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  title: string;
  canSave: boolean;
  busy?: boolean;
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
 * The media block's face: its published self, as a control. A `div` with the
 * button role (Base UI's `nativeButton={false}` supplies the role, the tab
 * stop and Enter/Space), never a `<button>`: the preview is a `<figure>` whose
 * images are real `<a href>`s (staged-image.tsx), and neither may sit inside a
 * button. The preview is INERT — no anchor is focusable or clickable, so a
 * click cannot navigate the editor away from unsaved prose, and the trigger
 * itself is the event target.
 */
function MediaTrigger({ label, markdown, lang, placeholder }: { label: string; markdown: string; lang: Lang; placeholder: string }) {
  return (
    <PopoverTrigger
      nativeButton={false}
      render={<div />}
      {...{ [TRIGGER_ATTR]: "" }}
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

const imageName = (src: string, alt: string) => (!src.trim() ? "no image" : alt.trim() || "image without alt text");

function FigureView(props: NodeViewProps) {
  const stored = figureOf(props.node.attrs);
  const markdown = serializeFigure(stored);
  const f = useDraft(props, stored, markdown === "");
  const d = f.draft;
  const patch = (p: Partial<FigureFields>) => f.setDraft((x) => ({ ...x, ...p }));
  const canSave = !f.busy && d.src.trim() !== "" && srcsOk(d.src, d.darkSrc) && !same(d, stored);
  return (
    <NodeViewWrapper className="not-prose my-4" data-drag-handle>
      <PopoverForm
        open={f.open}
        onOpenChange={f.onOpenChange}
        title="Figure"
        canSave={canSave}
        busy={f.busy}
        onSave={() => f.save({ ...d })}
        trigger={
          <MediaTrigger
            label={`Edit figure: ${imageName(stored.src, stored.alt)}`}
            markdown={markdown}
            lang={f.opts.lang}
            placeholder="Empty figure — add an image"
          />
        }
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
        <ImageSlot label="Image" value={{ src: d.src, alt: d.alt }} onPatch={(p) => patch(p)} svg uploadInto={f.uploadInto} />
        <ImageSlot
          label="Dark-mode image (optional)"
          value={{ src: d.darkSrc, alt: d.darkAlt }}
          onPatch={(p) => patch({ ...(p.src !== undefined ? { darkSrc: p.src } : {}), ...(p.alt !== undefined ? { darkAlt: p.alt } : {}) })}
          svg
          uploadInto={f.uploadInto}
        />
        <Field label="Caption" value={d.caption} onChange={(caption) => patch({ caption })} />
      </PopoverForm>
    </NodeViewWrapper>
  );
}

const galleryOf = (a: Record<string, unknown>): GalleryFields => a as unknown as GalleryFields;
const EMPTY_IMAGE: GalleryImage = { src: "", alt: "", title: "" };

function GalleryView(props: NodeViewProps) {
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
  const canSave =
    !f.busy && kept.images.length >= 2 && srcsOk(...kept.images.map((m) => m.src)) && !same(kept, stored);
  const count = stored.images.filter((m) => m.src.trim()).length;
  return (
    <NodeViewWrapper className="not-prose my-4" data-drag-handle>
      <PopoverForm
        open={f.open}
        onOpenChange={f.onOpenChange}
        title="Gallery"
        canSave={canSave}
        busy={f.busy}
        onSave={() => f.save({ ...kept })}
        trigger={
          <MediaTrigger
            label={`Edit gallery: ${count ? `${count} images` : "no images"}`}
            markdown={markdown}
            lang={f.opts.lang}
            placeholder="Empty gallery — add two images"
          />
        }
      >
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
      </PopoverForm>
    </NodeViewWrapper>
  );
}

const compareOf = (a: Record<string, unknown>): CompareFields => a as unknown as CompareFields;

function CompareView(props: NodeViewProps) {
  const stored = compareOf(props.node.attrs);
  const markdown = serializeCompare(stored);
  const f = useDraft(props, stored, markdown === "");
  const d = f.draft;
  const labels = COMPARE_LABELS[f.opts.lang];
  const patchSide = (side: keyof CompareFields, p: Partial<SideFields>) =>
    f.setDraft((x) => ({ ...x, [side]: { ...x[side], ...p } }));
  const canSave =
    !f.busy && d.do.text.trim() !== "" && d.dont.text.trim() !== "" && srcsOk(d.do.src, d.dont.src) && !same(d, stored);
  const name = (t: string) => t.trim() || "no text";
  return (
    <NodeViewWrapper className="not-prose my-4" data-drag-handle>
      <PopoverForm
        open={f.open}
        onOpenChange={f.onOpenChange}
        title="Do / Don't"
        canSave={canSave}
        busy={f.busy}
        onSave={() => f.save({ do: { ...d.do }, dont: { ...d.dont } })}
        trigger={
          <MediaTrigger
            label={`Edit do / don't: ${name(stored.do.text)} / ${name(stored.dont.text)}`}
            markdown={markdown}
            lang={f.opts.lang}
            placeholder="Empty do / don't — add both texts"
          />
        }
      >
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
      </PopoverForm>
    </NodeViewWrapper>
  );
}

// ── Text blocks ────────────────────────────────────────────────────────────

/** The trigger of a text block's line: the label or the attribution. Out of
 *  the editable flow (`contentEditable={false}` on its wrapper), so the caret
 *  never lands in the chrome around the body. */
function LineTrigger({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <PopoverTrigger
      nativeButton={false}
      render={<div />}
      {...{ [TRIGGER_ATTR]: "" }}
      aria-label={label}
      className={`w-fit cursor-pointer rounded-md text-left outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 ${className ?? ""}`}
    >
      {children}
    </PopoverTrigger>
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

function CalloutView(props: NodeViewProps) {
  const label = (props.node.attrs.label as string | null) ?? "";
  const f = useDraft(props, { label }, false);
  // Against the stored SOURCE, through the same escape Save applies — or an
  // untouched label that holds an escaped bracket would light Save up.
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
            // The trigger names its stored value (CLAUDE.md, "An icon trigger
            // names its stored value"), and an empty one says so.
            <LineTrigger label={`Edit callout label: ${label || "none"}`}>
              {label ? (
                <span className={CALLOUT_LABEL_CLASS}>
                  <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={inlineComponents(f.opts.lang)}>
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
  const f = useDraft(props, { by, role }, false);
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
            <LineTrigger label={`Edit attribution: ${by ? `${by}${role ? `, ${role}` : ""}` : "none"}`}>
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
