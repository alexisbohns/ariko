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
  /**
   * The frame's shape. "video" is 16:9. The two audio values differ because
   * the providers' own widgets do: Spotify renders a track or episode at 152px
   * and an album, playlist, show or artist at 352px; SoundCloud a single track
   * at 166px and a set at 450px; Deezer a track at ~150px and an album or
   * playlist at ~350px, where it draws a scrollable tracklist.
   *
   * Decided HERE because this is the only place the media's type is known — by
   * the time components/media.tsx has a frame, the type is gone. When it cannot
   * be determined, prefer the taller value: clipping loses content, padding
   * only loses whitespace.
   */
  aspect: "video" | "audio" | "audio-list";
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

// One player versus a scrollable tracklist. Spotify and Deezer make the same
// split, so one set serves both.
const SHORT_TYPES = new Set(["track", "episode"]);

const audioAspect = (type: string): EmbedFrame["aspect"] =>
  SHORT_TYPES.has(type) ? "audio" : "audio-list";

// Bounded deliberately. Unbounded, a 10,000-character path segment framed
// happily: a 10KB iframe src attribute in the served HTML and a guaranteed-404
// player. This is NOT an origin-safety measure — that is already covered by the
// charset itself, which cannot express a character capable of restructuring the
// URL. Real Spotify ids are exactly 22 base62 characters (4cOdK2wGLETKBW3PvgPWqT,
// 1DFixLWuPkv3KT3TnV35m3, 37i9dQZF1DXcBWIGoYBM5M, 0eGsygTp906u18L0Oimnem); real
// Deezer ids are 1–10 digits. Both bounds are generous enough to survive a
// format change while still meaning "an id".
const SPOTIFY_ID = /^[A-Za-z0-9]{1,64}$/;
const DEEZER_ID = /^\d{1,20}$/;

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
//
// A positional rule, like vimeoId's — and it survives where that one needed
// three attempts, for a structural reason worth knowing before extending it.
// Vimeo's rule keyed on a NUMERIC segment, and collection ids are numeric too,
// so a wrong reading still looked valid and embedded the wrong video silently.
// Here the second-to-last segment must be one of six allowlisted WORDS, so a
// misread almost always lands on a slug that is not a type and returns null —
// degrading to a link card rather than to a plausible-looking mistake. That is
// what makes "last two" safe here and unsafe there.
//
// Verified against the real share forms: the intl-XX locale prefix, ?si=
// tracking params, legacy /user/{id}/playlist/{id}, Deezer's
// /show/{id}/episode/{id}, and an embed or widget URL pasted back in (which
// round-trips to itself) all resolve correctly.
//
// Residual miss, stated at its real width: any URL where a type word happens to
// sit second-to-last with an alphanumeric final segment gets framed. No real
// Spotify or Deezer route was found with that shape — Spotify's filtered search
// is /search/{query}/tracks (plural, and the query is not a type), Deezer's
// genre route is /channels/{slug}. And as with vimeoId, the consequence is a
// wrong-or-404 embed on an allowlisted origin, never an unsafe host.
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
      const parsed = (() => {
        try {
          const u = new URL(media.url);
          return {
            host: u.hostname.toLowerCase(),
            parts: u.pathname.split("/").filter(Boolean),
          };
        } catch {
          return null;
        }
      })();
      if (!parsed || !hostMatches(parsed.host, "soundcloud.com")) return null;
      // A set is soundcloud.com/{user}/sets/{slug} — the widget draws a
      // scrollable tracklist for it and a single player for everything else.
      // `includes` rather than a position check, because the only thing it
      // over-matches is a track whose slug is literally "sets", and erring
      // tall costs whitespace where erring short would clip a tracklist. A
      // short link (on.soundcloud.com/{hash}) is unknowable without a network
      // call, which this file does not make; it gets the single-player box.
      const aspect = parsed.parts.includes("sets") ? "audio-list" : "audio";
      return {
        src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(media.url)}`,
        title,
        aspect,
      };
    }

    case "spotify": {
      const found = typeAndId(media.url, SPOTIFY_TYPES, SPOTIFY_ID);
      return found
        ? {
            src: `https://open.spotify.com/embed/${found.type}/${found.id}`,
            title,
            aspect: audioAspect(found.type),
          }
        : null;
    }

    case "deezer": {
      const found = typeAndId(media.url, DEEZER_TYPES, DEEZER_ID);
      return found
        ? {
            src: `https://widget.deezer.com/widget/dark/${found.type}/${found.id}`,
            title,
            aspect: audioAspect(found.type),
          }
        : null;
    }

    default:
      // ausha, figma, link — and anything a future provider adds before its
      // derivation is written. A link card is always a correct answer.
      return null;
  }
}
