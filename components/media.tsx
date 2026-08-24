import type { Media, MediaEmbed } from "@/lib/data";
import { embedSrc, type EmbedFrame } from "@/lib/embed-src";
// Shared, not local: lib/graph.ts needs the same predicate for the cover URL it
// puts on the wire, and a security check with two copies has two behaviours.
// lib/url.ts also records why an href is guarded here and an <img src> below is
// deliberately not.
import { isHttpUrl } from "@/lib/url";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Renders a media[] list (spec §5.4). Server component — no client JS enters
 * the public zone, the same rule components/markdown.tsx carries.
 *
 * Three cases, in descending order of how much we trust the thing: an image we
 * host, an embed whose URL we derived exactly, and everything else — which
 * becomes a link out rather than a frame. embedSrc returning null is the
 * ORDINARY path for ausha, figma, deezer shows and every `link` provider, not
 * an error.
 *
 * NO LUCIDE ICONS HERE, and not by oversight: lucide-react@1.33 routes every
 * icon through an Icon.mjs carrying "use client", so a single <ExternalLink />
 * would push a client boundary into a zone whose whole rule is that it has
 * none. Any affordance this file needs is an inline <svg aria-hidden> or a
 * glyph. The same applies to every other public server component.
 */

// The measured heights behind embedSrc's `aspect` (spec §5.2). Providers render
// a collection far taller than a single item — Spotify 152px vs 352px,
// SoundCloud 166px vs 450px, Deezer ~150 vs ~350 — so one box cannot serve
// both. These are the taller end of each bucket on purpose: a widget shorter
// than its box loses whitespace, one taller than its box loses content.
//
// Keyed on the union rather than on `string` so a fourth aspect fails the build
// naming its missing box. Untyped, it would silently inherit the 166px
// single-player box — which is precisely the clipping the third value exists to
// prevent.
const FRAME_BOX: Record<EmbedFrame["aspect"], string> = {
  video: "aspect-video w-full",
  audio: "h-[166px] w-full",
  "audio-list": "h-[450px] w-full",
};

// Casing is looked up, never derived: "soundcloud" → "SoundCloud" is not a
// capitalize(). An unknown provider falls back to its raw slug rather than to a
// guess. `link` is deliberately absent — it is the one provider that never
// earns a badge (see LinkCard).
const PROVIDER_LABEL: Record<string, string> = {
  ausha: "Ausha",
  deezer: "Deezer",
  figma: "Figma",
  soundcloud: "SoundCloud",
  spotify: "Spotify",
  vimeo: "Vimeo",
  youtube: "YouTube",
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const CARD = "flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm";

/** The fallback for everything embedSrc cannot frame. */
function LinkCard({ media }: { media: MediaEmbed }) {
  // No badge for `link`: it is a category name, not a destination, and it is
  // the commonest case — the only MediaEmbed in production today. The hostname
  // carries the meaning, so it is the label rather than a muted footnote.
  const body = (
    <>
      {media.provider !== "link" ? (
        <Badge variant="secondary">{PROVIDER_LABEL[media.provider] ?? media.provider}</Badge>
      ) : null}
      <span className="min-w-0 break-all text-foreground">{hostOf(media.url)}</span>
    </>
  );

  // A non-http URL renders as text: still visible, still copyable, simply not
  // clickable. Same card, no anchor — see lib/url.ts for what that prevents.
  if (!isHttpUrl(media.url)) return <div className={CARD}>{body}</div>;

  return (
    // The repo's FIRST target="_blank" in the public zone — a decision, not an
    // inherited convention: a player or a portfolio link should not cost the
    // reader their place on the page. Because it is the first, it also owes the
    // announcement that sighted readers get from the tab opening.
    <a
      href={media.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(CARD, "transition-colors hover:bg-accent")}
    >
      {body}
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

function EmbedItem({ media }: { media: MediaEmbed }) {
  const frame = embedSrc(media);
  if (!frame) return <LinkCard media={media} />;

  return (
    <div className={FRAME_BOX[frame.aspect]}>
      {/* `allow` is an allowlist, not a grant list: a cross-origin frame gets a
          powerful feature only by delegation, so camera, microphone,
          geolocation, payment and USB are already denied by not being named.
          This is YouTube's canonical set; encrypted-media is load-bearing for
          Spotify (EME). Deliberately no `sandbox` — the CSP frame-src pins the
          five origins, and an unverified token set breaks playback silently. */}
      <iframe
        src={frame.src}
        title={frame.title}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="h-full w-full rounded-lg border-0"
      />
    </div>
  );
}

function MediaItem({ media }: { media: Media }) {
  if (media.kind === "image") {
    return (
      // A plain <img>, not next/image: that needs images.remotePatterns for
      // Cloudinary and puts an optimizer in front of the public zone for no
      // gain here. width/height are stored by toMediaImage (lib/storage.ts)
      // and are what stop the page reflowing as images arrive.
      // An absent alt renders as alt="" — the correct markup for an image with
      // no description, and never a fabricated one. Making that gap visible is
      // the admin picker's job, where an author can still fix it.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={media.url}
        alt={media.alt ?? ""}
        {...(media.width ? { width: media.width } : {})}
        {...(media.height ? { height: media.height } : {})}
        loading="lazy"
        decoding="async"
        className="h-auto max-w-full rounded-lg"
      />
    );
  }
  return <EmbedItem media={media} />;
}

export function MediaList({ media }: { media?: Media[] }) {
  if (!media || media.length === 0) return null;
  return (
    <ul className="not-prose flex flex-col gap-3">
      {media.map((m, i) => (
        // The index is the only part guaranteeing uniqueness — nothing dedupes
        // media[], so the same url can legitimately appear twice. Safe here
        // because the list is server-rendered, stateless and never mutated
        // client-side.
        <li key={`${m.kind}-${i}-${m.url}`}>
          <MediaItem media={m} />
        </li>
      ))}
    </ul>
  );
}
