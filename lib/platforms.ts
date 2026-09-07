import { hostMatches } from "./embeds";
import type { PlatformLink } from "./data";

/**
 * Where a thing can be found — the vocabulary, and the one place it is decided.
 *
 * This is NOT lib/embeds.ts's job and must not become it. That file's
 * HOST_PROVIDERS table decides what gets loaded into an IFRAME, and the file is
 * under a dependency-free constraint because next.config.ts imports
 * EMBED_FRAME_HOSTS while Next reads its config, before the app exists.
 * Widening that table so Linktree can have a chip would change framing
 * behaviour to gain a label. So: a second table, and exactly one import from
 * over there — `hostMatches`, because a host check with two implementations has
 * two behaviours.
 *
 * A `platform` string is only ever a member of PLATFORM_HOSTS' second column or
 * the literal "link". That is what makes PLATFORM_LABEL[platform] safe to
 * render, and it holds because `platform` is DERIVED here rather than accepted
 * from a caller — the rule lib/inbox.ts already applies to MediaEmbed.provider.
 */

// Host → platform. First match wins, exactly like HOST_PROVIDERS.
export const PLATFORM_HOSTS: Array<[string, string]> = [
  ["open.spotify.com", "spotify"],
  ["spotify.com", "spotify"],
  ["podcasts.apple.com", "apple-podcasts"],
  ["music.apple.com", "apple-podcasts"],
  ["deezer.com", "deezer"],
  ["ausha.co", "ausha"],
  ["instagram.com", "instagram"],
  ["linktr.ee", "linktree"],
  ["youtube.com", "youtube"],
  ["youtu.be", "youtube"],
  ["soundcloud.com", "soundcloud"],
];

// Casing is looked up, never derived — "apple-podcasts" → "Apple Podcasts" is
// not a titlecase(). Same table shape and same fallback rule as
// components/media.tsx's PROVIDER_LABEL, for the same reason: an unknown
// platform shows its raw slug instead of a guess.
export const PLATFORM_LABEL: Record<string, string> = {
  spotify: "Spotify",
  "apple-podcasts": "Apple Podcasts",
  deezer: "Deezer",
  ausha: "Ausha",
  instagram: "Instagram",
  linktree: "Linktree",
  youtube: "YouTube",
  soundcloud: "SoundCloud",
};

export function platformLabel(platform: string): string {
  return PLATFORM_LABEL[platform] ?? platform;
}

/**
 * Query parameters removed on write.
 *
 * `stkn` is the reason this function exists rather than a nicety: it is
 * Instagram's private-share token, and the URL that seeded this slice carried
 * one. Storing it would put a credential-ish value in the database and then
 * serve it on a public page.
 *
 * `si`, `nd` and `dlsi` are Spotify's share-attribution parameters. `utm_*` is
 * handled by prefix.
 *
 * Deliberately an ALLOW-everything-else list rather than a keep-list: Apple
 * Podcasts puts the episode id in `?i=`, so a keep-list would have to know
 * every platform's load-bearing parameter and would silently truncate the first
 * one it had not met.
 */
const STRIPPED_PARAMS = new Set(["stkn", "si", "nd", "dlsi"]);

export function normalizeLinkUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    // Never throws. An unparseable string is stored as typed — LinkRow will
    // render it as inert text rather than as an anchor (lib/url.ts).
    return url.trim();
  }
  // Snapshot the keys: deleting while iterating a URLSearchParams skips entries.
  for (const key of [...u.searchParams.keys()]) {
    if (STRIPPED_PARAMS.has(key) || key.startsWith("utm_")) u.searchParams.delete(key);
  }
  u.hash = "";
  return u.toString();
}

export function detectPlatform(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "link";
  }
  // hostMatches, not includes(): the whole point is that
  // "instagram.com.evil.test" is not Instagram.
  return PLATFORM_HOSTS.find(([h]) => hostMatches(host, h))?.[1] ?? "link";
}

/**
 * The write boundary. Every path that stores links goes through here, so a
 * stored URL is already clean and a stored `platform` is already derived —
 * nothing downstream re-normalizes, and nothing downstream has to.
 *
 * The input's own `platform`, if it has one, is overwritten rather than
 * respected. That is the point.
 */
export function normalizeLinks(
  links: Array<{ url: string } & Partial<PlatformLink>> | undefined,
): PlatformLink[] | undefined {
  if (!links) return undefined;
  return links.map((link) => {
    const url = normalizeLinkUrl(link.url);
    return { ...link, url, platform: detectPlatform(url) };
  });
}
