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
      async fetchPage(cursor, etag): Promise<FeedPage> {
        const url = new URL(feed.url);
        url.searchParams.set("limit", String(PAGE_LIMIT));
        if (cursor !== null) url.searchParams.set("after", cursor);
        // The conditional half of the contract (arkaik#490): the server
        // stamps a weak ETag on every page and answers a matching
        // If-None-Match with a bodiless 304 from one validator statement —
        // no bundle, no journal. Sent only when we hold a tag for THIS
        // cursor (syncFeed keeps the two together).
        const headers: Record<string, string> = { authorization: `Bearer ${token}` };
        if (etag !== null) headers["if-none-match"] = etag;
        const res = await fetchImpl(url, { headers });
        // 410 is checked server-side BEFORE the conditional answer, so a gone
        // cursor can never hide behind a 304.
        if (res.status === 410) return "gone";
        if (res.status === 304) return { envelopes: [], done: true, etag };
        if (!res.ok) throw new Error(`feed "${feed.id}": HTTP ${res.status}`);
        const body: unknown = await res.json().catch(() => {
          throw new Error(`feed "${feed.id}": response is not JSON`);
        });
        if (!isObject(body) || !Array.isArray(body.pollen)) {
          throw new Error(`feed "${feed.id}": response is not { pollen: [...] }`);
        }
        return { envelopes: body.pollen, done: body.pollen.length === 0, etag: res.headers.get("etag") };
      },
    };
  }
  // Committed feed file: refetched whole per call (at most twice per run —
  // once, plus once more after a gone reset). Single page, always done, and
  // no validator — a raw file on a CDN has no page to be unmodified from.
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
