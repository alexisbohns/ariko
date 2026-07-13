import type { MediaEmbed } from "./data";

// Host substring → provider. First match wins.
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
    if (u.hostname.toLowerCase().includes("youtu.be")) {
      return u.pathname.slice(1) || undefined;
    }
    return u.searchParams.get("v") ?? undefined;
  } catch {
    return undefined;
  }
}

function vimeoId(url: string): string | undefined {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : undefined;
}

// Pure. Never throws. Unknown/unparseable → a generic "link" embed that still
// preserves the original string (spec §7: capture never fails on a bad URL).
export function detectEmbed(url: string): MediaEmbed {
  const host = parseHost(url);
  const provider =
    (host && HOST_PROVIDERS.find(([h]) => host.includes(h))?.[1]) || "link";

  let embedId: string | undefined;
  if (provider === "youtube") embedId = youtubeId(url);
  else if (provider === "vimeo") embedId = vimeoId(url);

  return { kind: "embed", provider, url, ...(embedId ? { embedId } : {}) };
}
