import type { Media, MediaEmbed } from "@/lib/data";
import { embedSrc } from "@/lib/embed-src";
import { Badge } from "@/components/ui/badge";

/**
 * Renders a media[] list (spec §5.4). Server component — no client JS enters
 * the public zone, the same rule components/markdown.tsx carries.
 *
 * Three cases, in descending order of how much we trust the thing: an image we
 * host, an embed whose URL we derived exactly, and everything else — which
 * becomes a link out rather than a frame. embedSrc returning null is the
 * ORDINARY path for ausha, figma, deezer shows and every `link` provider, not
 * an error.
 */

// The measured heights behind embedSrc's `aspect` (spec §5.2). Providers render
// a collection far taller than a single item — Spotify 152px vs 352px,
// SoundCloud 166px vs 450px, Deezer ~150 vs ~350 — so one box cannot serve
// both. These are the taller end of each bucket on purpose: a widget shorter
// than its box loses whitespace, one taller than its box loses content.
const FRAME_BOX: Record<string, string> = {
  video: "aspect-video w-full",
  audio: "h-[166px] w-full",
  "audio-list": "h-[450px] w-full",
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function EmbedItem({ media }: { media: MediaEmbed }) {
  const frame = embedSrc(media);

  if (frame) {
    return (
      <div className={FRAME_BOX[frame.aspect] ?? FRAME_BOX.audio}>
        <iframe
          src={frame.src}
          title={frame.title}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          className="h-full w-full rounded-lg border-0"
        />
      </div>
    );
  }

  return (
    <a
      href={media.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-accent"
    >
      <Badge variant="secondary">{media.provider}</Badge>
      <span className="min-w-0 break-all text-muted-foreground">{hostOf(media.url)}</span>
    </a>
  );
}

function MediaItem({ media }: { media: Media }) {
  if (media.kind === "image") {
    return (
      // A plain <img>, not next/image: that needs images.remotePatterns for
      // Cloudinary and puts an optimizer in front of the public zone for no
      // gain here. width/height are stored by toMediaImage (lib/storage.ts)
      // and are what stop the page reflowing as images arrive.
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
        <li key={`${m.kind}-${i}-${m.url}`}>
          <MediaItem media={m} />
        </li>
      ))}
    </ul>
  );
}
