import { hostMatches } from "./embeds";
import type { MediaEmbed } from "./data";

/**
 * Which embeds become an iframe, and what URL they load (spec §5.2).
 *
 * KEEP THIS MODULE DEPENDENCY-FREE at runtime. next.config.ts imports
 * EMBED_FRAME_HOSTS to build the CSP, so anything this file pulls in is loaded
 * while Next reads its config, before the app exists — the same constraint
 * lib/upload-input.ts carries. `hostMatches` comes from lib/embeds.ts, which is
 * itself import-free apart from a type. Do not add more.
 *
 * Pure and table-driven so "which providers are framed" is a reviewable list
 * rather than a property of scattered conditionals — this decides what
 * third-party code runs on a public page, which is not a decision anyone should
 * have to reconstruct by reading control flow.
 *
 * `null` is not a failure: it means "render a link card instead"
 * (components/media.tsx). Two known providers return null deliberately —
 * ausha share URLs carry no podcastId and its player requires one, and Figma's
 * current embed contract is unverified with no Figma content in the database to
 * test against. Each is one table row and one test away.
 *
 * SAFETY: this trusts `media.provider` absolutely. That trust is earned by two
 * other files, and is worthless without them — lib/embeds.ts matches hosts
 * exactly rather than by substring, and lib/inbox.ts re-derives provider from
 * the URL on every write rather than accepting a declared one. If either is
 * ever relaxed, this file becomes an open redirect into an iframe.
 */

export interface EmbedFrame {
  src: string;
  /** The iframe's accessible name. Not fetched — nothing here makes a network call. */
  title: string;
  /** "video" is a 16:9 box; "audio" a short fixed one — a player that is 16:9 is mostly empty space. */
  aspect: "video" | "audio";
}

export const EMBED_FRAME_HOSTS = [
  "https://www.youtube-nocookie.com",
  "https://player.vimeo.com",
  "https://w.soundcloud.com",
  "https://open.spotify.com",
  "https://widget.deezer.com",
] as const;

const SPOTIFY_TYPES = new Set([
  "track",
  "album",
  "playlist",
  "episode",
  "show",
  "artist",
]);
const DEEZER_TYPES = new Set([
  "track",
  "album",
  "playlist",
  "episode",
  "show",
  "artist",
]);

function segments(url: string): string[] | null {
  try {
    return new URL(url).pathname.split("/").filter(Boolean);
  } catch {
    return null;
  }
}

// The last two path segments as a validated {type, id} pair, or null. Both
// Spotify and Deezer put the type immediately before the id, with Deezer
// optionally prefixing a locale ("/en/track/123").
function typeAndId(
  url: string,
  types: Set<string>,
  idPattern: RegExp,
): { type: string; id: string } | null {
  const parts = segments(url);
  if (!parts || parts.length < 2) return null;
  const [type, id] = parts.slice(-2);
  if (!types.has(type) || !idPattern.test(id)) return null;
  return { type, id };
}

export function embedSrc(media: MediaEmbed): EmbedFrame | null {
  const title = `${media.provider} player`;

  switch (media.provider) {
    case "youtube":
      return media.embedId
        ? {
            src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(media.embedId)}`,
            title,
            aspect: "video",
          }
        : null;

    case "vimeo":
      return media.embedId
        ? {
            src: `https://player.vimeo.com/video/${encodeURIComponent(media.embedId)}`,
            title,
            aspect: "video",
          }
        : null;

    case "soundcloud": {
      // The ONLY provider whose stored URL is handed to a third party verbatim
      // rather than reduced to an extracted id — so it is the only one where a
      // wrong `provider` would leak an arbitrary URL off-site, as a query
      // parameter SoundCloud's widget will fetch. Re-verified here rather than
      // relying solely on the two upstream guarantees: this is the one case
      // where defence in depth costs a single line.
      const host = (() => {
        try {
          return new URL(media.url).hostname.toLowerCase();
        } catch {
          return null;
        }
      })();
      if (!host || !hostMatches(host, "soundcloud.com")) return null;
      return {
        src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(media.url)}`,
        title,
        aspect: "audio",
      };
    }

    case "spotify": {
      const found = typeAndId(media.url, SPOTIFY_TYPES, /^[A-Za-z0-9]+$/);
      return found
        ? {
            src: `https://open.spotify.com/embed/${found.type}/${found.id}`,
            title,
            aspect: "audio",
          }
        : null;
    }

    case "deezer": {
      const found = typeAndId(media.url, DEEZER_TYPES, /^\d+$/);
      return found
        ? {
            src: `https://widget.deezer.com/widget/dark/${found.type}/${found.id}`,
            title,
            aspect: "audio",
          }
        : null;
    }

    default:
      // ausha, figma, link — and anything a future provider adds before its
      // derivation is written. A link card is always a correct answer.
      return null;
  }
}
