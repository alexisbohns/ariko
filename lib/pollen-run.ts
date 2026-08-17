import { getFederation } from "./federation";
import { makeSink } from "./pollen-store";
import { syncFeed, type FeedResult } from "./pollen-sync";
import { makeTransport } from "./pollen-transports";

// The one shared entry point for the sync door, the admin button, and the
// rebuild script. Sequential on purpose: two feeds, no concurrency to reason
// about, and one feed's construction failure (missing env var) still lets the
// others run.
export async function runSync(onlyFeedId?: string): Promise<FeedResult[]> {
  const { feeds, exhibit } = getFederation();
  const selected = onlyFeedId ? feeds.filter((f) => f.id === onlyFeedId) : feeds;
  const results: FeedResult[] = [];
  for (const feed of selected) {
    try {
      results.push(await syncFeed(feed.id, makeTransport(feed), makeSink(exhibit)));
    } catch (err) {
      results.push({
        feedId: feed.id,
        stored: 0,
        refused: 0,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}
