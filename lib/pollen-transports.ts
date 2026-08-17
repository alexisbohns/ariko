import type { FeedConfig } from "./federation";
import { sliceFeedFile, type FeedPage, type FeedTransport } from "./pollen-sync";
import { isObject } from "./text-input";

const PAGE_LIMIT = 200; // POLLEN.md server cap

// Builds the transport for one configured feed. fetchImpl is injectable for
// tests; env is injectable so a missing token env var fails HERE, loudly, at
// construction — never as a silent unauthenticated request.
export function makeTransport(
  feed: FeedConfig,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): FeedTransport {
  if (feed.transport === "http") {
    const token = feed.tokenEnv ? env[feed.tokenEnv] : undefined;
    if (!token) throw new Error(`feed "${feed.id}": env var ${feed.tokenEnv} is not set`);
    return {
      async fetchPage(cursor): Promise<FeedPage> {
        const url = new URL(feed.url);
        url.searchParams.set("limit", String(PAGE_LIMIT));
        if (cursor !== null) url.searchParams.set("after", cursor);
        const res = await fetchImpl(url, { headers: { authorization: `Bearer ${token}` } });
        if (res.status === 410) return "gone";
        if (!res.ok) throw new Error(`feed "${feed.id}": HTTP ${res.status}`);
        const body: unknown = await res.json().catch(() => {
          throw new Error(`feed "${feed.id}": response is not JSON`);
        });
        if (!isObject(body) || !Array.isArray(body.pollen)) {
          throw new Error(`feed "${feed.id}": response is not { pollen: [...] }`);
        }
        return { envelopes: body.pollen, done: body.pollen.length === 0 };
      },
    };
  }
  // Committed feed file: refetched whole per call (at most twice per run —
  // once, plus once more after a gone reset). Single page, always done.
  return {
    async fetchPage(cursor): Promise<FeedPage> {
      const res = await fetchImpl(feed.url);
      if (!res.ok) throw new Error(`feed "${feed.id}": HTTP ${res.status}`);
      const sliced = sliceFeedFile(await res.text(), cursor);
      if (sliced === "gone") return "gone";
      return { envelopes: sliced.entries, extraRefusals: sliced.malformed, done: true };
    },
  };
}
