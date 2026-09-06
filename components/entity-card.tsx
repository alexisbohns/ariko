import type { MediaImage } from "@/lib/data";
import { cloudinaryThumb } from "@/lib/image-url";
import { Card, CardContent } from "@/components/ui/card";

/**
 * The entity card, drawn once.
 *
 * There were two of these: `components/entity.tsx`, which renders a card in
 * published prose, and the tiptap node view in
 * `components/editor/entity-views.tsx`, which renders one while it is being
 * written. They had drifted in three ways at once — the editor's carried an
 * extra `py-4`, showed the entity's `ref`, and had no cover — so the author was
 * composing against a card the visitor would never see.
 *
 * Only ONE of those three differences was a real one. A `ref` is information in
 * the authoring zone and a leak outside it, exactly as `showUnresolved` is; the
 * other two were accidents. So `refText` is the one parameter the writing
 * surface passes, and the padding is now whatever `CardContent` says it is in
 * both places.
 *
 * Server-safe, and used from a client node view — the same property
 * `components/chrome.tsx` and `components/plant-header.tsx` rest on.
 */

export function EntityCardBody({
  name,
  description,
  cover,
  refText,
  interactive,
}: {
  name: string;
  description?: string;
  /** Beans only — derived from the newest sprout carrying an image (lib/cover.ts). */
  cover?: MediaImage;
  /**
   * The prefixed ref (`bean:some-slug`), shown ONLY where a ref is information
   * rather than a leak: the editor, and the admin's read pages. Public prose
   * passes nothing.
   */
  refText?: string;
  /**
   * Whether this card is inside a link. Adds the hover affordance — and only
   * that, since the anchor itself belongs to the caller. A card in the editor
   * is not going anywhere, so it says so.
   */
  interactive?: boolean;
}) {
  return (
    <Card className={interactive ? "transition-shadow group-hover:shadow-md" : undefined}>
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          // The card renders at the reading column's full width
          // (components/page-column.tsx: `max-w-3xl px-6` -> 768px - 2*24px =
          // 720px at its widest) and h-32 (128px) tall, so 1440x256 is that box
          // doubled for a 2x display. Matching the box's own aspect ratio
          // (~5.6:1), rather than picking a rounder but narrower number, keeps
          // Cloudinary's c_fill crop aligned with what object-cover shows
          // instead of cropping a differently-shaped box.
          //
          // Since the shared-surfaces slice that arithmetic holds in the ADMIN
          // too: both zones render the same column string.
          //
          // Decorative: the name below carries the accessible name.
          src={cloudinaryThumb(cover.url, { width: 1440, height: 256 })}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-32 w-full object-cover"
        />
      ) : null}
      <CardContent className="flex flex-col gap-1">
        <span
          className={
            "text-sm font-medium" +
            (interactive ? " underline-offset-4 group-hover:underline" : "")
          }
        >
          {name}
        </span>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        {refText ? (
          <span className="font-heading text-[10px] text-muted-foreground">{refText}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * A reference that resolves to nothing, where saying so is the right thing.
 *
 * Never on a public page. `components/entity.tsx` renders this only behind
 * `showUnresolved`, because public prose must fail CLOSED — no stub, no name, no
 * gap to infer from (spec §2.3). In the admin and in the editor a dangling ref
 * is information.
 *
 * The dashed frame is the editor's old treatment, taken as the shared one over
 * the admin read page's bare `<p>`: a placeholder should read as a placeholder
 * rather than as a sentence someone wrote.
 */
export function UnresolvedRef({ refValue }: { refValue?: string }) {
  return (
    <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
      unresolved reference: {refValue || "(no ref)"}
    </p>
  );
}
