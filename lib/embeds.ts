import type { MediaEmbed } from "./data";

// Host → provider. First match wins.
const HOST_PROVIDERS: Array<[string, MediaEmbed["provider"]]> = [
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
  return host === base || host.endsWith("." + base);
}

function parseHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function youtubeId(url: string): string | undefined {
  try {
    const u = new URL(url);
    // hostMatches, not includes(): "youtu.be.evil.test/HIJACK" would otherwise
    // have had its path read as the video id.
    if (hostMatches(u.hostname.toLowerCase(), "youtu.be")) {
      return u.pathname.slice(1) || undefined;
    }
    return u.searchParams.get("v") ?? undefined;
  } catch {
    return undefined;
  }
}

// The LAST numeric path segment. Not the first: Vimeo nests the video id under
// a collection id in several of its share forms —
// vimeo.com/showcase/999/video/123456 and vimeo.com/groups/123/videos/456 both
// lead with the COLLECTION's id, and taking the first would embed the wrong
// video. The last segment is right for every form, including the bare
// vimeo.com/123456 and player.vimeo.com/video/123456.
//
// Still a path-segment scan rather than a regex over the whole URL: the regex
// this replaced could lift an id out of a query string.
function vimeoId(url: string): string | undefined {
  try {
    const numeric = new URL(url).pathname.split("/").filter((s) => /^\d+$/.test(s));
    return numeric[numeric.length - 1];
  } catch {
    return undefined;
  }
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
