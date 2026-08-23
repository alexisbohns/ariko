import type { LocalizedText } from "./data";
import type { InputMedia } from "./inbox";
import { parseMediaField } from "./media-input";

// The raw body shape /api/inbox accepts. Embeds may be bare (no provider) —
// provider detection happens in validateInboxPayload → normalizeMedia →
// detectEmbed. Images arrive already-formed from the media picker, which
// uploaded them through uploadImageAction before this form was ever submitted.
export interface RawGardenBody {
  title: string;
  body?: LocalizedText;
  media: InputMedia[];
  source: { kind: "manual" };
}

// Pure. Maps the admin seed <form> into the raw ingestion body. Empty note ⇒
// no body; blank link fields dropped; title trimmed (may be "" — the downstream
// validateInboxPayload guard rejects an empty title).
//
// Links first, then images, both in declaration order. Order matters: a bean's
// cover is the FIRST MediaImage in its newest sprout's media[] (spec §5.5), and
// image order here is the picker's order.
export function buildSeedBody(form: FormData): RawGardenBody {
  const title = String(form.get("title") ?? "").trim();
  const note = String(form.get("note") ?? "").trim();
  const lang = form.get("lang") === "fr" ? "fr" : "en";
  const links = form
    .getAll("link")
    .map((v) => String(v).trim())
    .filter((url) => url.length > 0)
    .map((url) => ({ kind: "embed" as const, url }));
  const images = parseMediaField(form.getAll("image").map((v) => String(v)));

  return {
    title,
    ...(note ? { body: { [lang]: note } as LocalizedText } : {}),
    media: [...links, ...images],
    source: { kind: "manual" },
  };
}
