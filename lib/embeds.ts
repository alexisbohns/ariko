import type { MediaEmbed } from "./data";

// Host → provider. First match wins.
export const HOST_PROVIDERS: Array<[string, MediaEmbed["provider"]]> = [
  ["soundcloud.com", "soundcloud"],
  ["spotify.com", "spotify"],
  ["deezer.com", "deezer"],
  ["ausha.co", "ausha"],
  ["youtube.com", "youtube"],
  ["youtu.be", "youtube"],
  ["vimeo.com", "vimeo"],
  ["figma.com", "figma"],
];

/**
 * Exact host, or a subdomain of it. NOT a substring.
 *
 * This was `host.includes(h)` until the media slice, which made
 * "vimeo.com.evil.test" detect as vimeo. That was harmless for as long as
 * nothing rendered an embed; it stopped being harmless the moment `provider`
 * started deciding whether a URL gets loaded into an iframe (lib/embed-src.ts).
 */
export function hostMatches(host: string, base: string): boolean {
  if (!base) return false;
  return host === base || host.endsWith("." + base);
}

function parseHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

// Exactly 11 chars of YouTube's id alphabet. Validated HERE rather than
// escaped at the point of use: an id that is not an id degrades to a link card,
// the same way an unparsable Vimeo path already does, instead of building a
// URL on a trusted host out of arbitrary stored text.
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function youtubeId(url: string): string | undefined {
  try {
    const u = new URL(url);
    // hostMatches, not includes(): "youtu.be.evil.test/HIJACK" would otherwise
    // have had its path read as the video id.
    let candidate: string | undefined;
    if (hostMatches(u.hostname.toLowerCase(), "youtu.be")) {
      candidate = u.pathname.slice(1) || undefined;
    } else {
      candidate = u.searchParams.get("v") ?? undefined;
    }
    return candidate && YOUTUBE_ID.test(candidate) ? candidate : undefined;
  } catch {
    return undefined;
  }
}

// Vimeo's share forms disagree about WHERE the video id sits, so no positional
// rule is right for all of them:
//
//   vimeo.com/123456                          bare
//   vimeo.com/channels/staffpicks/123456      collection slug, id last
//   vimeo.com/showcase/999/video/123456       collection id FIRST, video last
//   vimeo.com/groups/123/videos/456           same shape
//   vimeo.com/76979871/576845123              unlisted: id FIRST, hash last
//   vimeo.com/user/review/76979871/12345678   review: id first, review id last
//
// Taking the first segment embeds the collection; taking the last embeds the
// unlisted-link hash. Both are wrong-video bugs rather than security ones (the
// host stays allowlisted either way), and both are silent.
//
// So: anchor on the `video`/`videos` keyword that every collection form
// contains, and take the numeric segment immediately after it. Absent that
// keyword, the id is the FIRST numeric segment — correct for the bare,
// unlisted, and review forms alike.
//
// Known miss: an all-numeric channel slug (vimeo.com/channels/12345/67890)
// would resolve to the channel. Far rarer than a private link, and it fails to
// a wrong video rather than an unsafe one.
function vimeoId(url: string): string | undefined {
  let segments: string[];
  try {
    segments = new URL(url).pathname.split("/").filter(Boolean);
  } catch {
    return undefined;
  }
  const anchor = segments.findIndex((s) => s === "video" || s === "videos");
  if (anchor !== -1) {
    const next = segments[anchor + 1];
    if (next && /^\d+$/.test(next)) return next;
  }
  return segments.find((s) => /^\d+$/.test(s));
}

// Pure. Never throws. Unknown/unparseable → a generic "link" embed that still
// preserves the original string (spec §7: seed never fails on a bad URL).
export function detectEmbed(url: string): MediaEmbed {
  const host = parseHost(url);
  const provider =
    (host && HOST_PROVIDERS.find(([h]) => hostMatches(host, h))?.[1]) || "link";

  let embedId: string | undefined;
  if (provider === "youtube") embedId = youtubeId(url);
  else if (provider === "vimeo") embedId = vimeoId(url);

  return { kind: "embed", provider, url, ...(embedId ? { embedId } : {}) };
}
