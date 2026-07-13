import type { LocalizedText } from "./data";

// The raw body shape /api/inbox accepts. Embeds are bare (no provider) — provider
// detection happens later in validateInboxPayload → normalizeMedia → detectEmbed.
export interface RawCaptureBody {
  title: string;
  body?: LocalizedText;
  media: Array<{ kind: "embed"; url: string }>;
  source: { kind: "manual" };
}

// Pure. Maps the admin capture <form> into the raw ingestion body. Empty note ⇒
// no body; blank link fields dropped; title trimmed (may be "" — the downstream
// validateInboxPayload guard rejects an empty title).
export function buildCaptureBody(form: FormData): RawCaptureBody {
  const title = String(form.get("title") ?? "").trim();
  const note = String(form.get("note") ?? "").trim();
  const lang = form.get("lang") === "fr" ? "fr" : "en";
  const media = form
    .getAll("link")
    .map((v) => String(v).trim())
    .filter((url) => url.length > 0)
    .map((url) => ({ kind: "embed" as const, url }));

  return {
    title,
    ...(note ? { body: { [lang]: note } as LocalizedText } : {}),
    media,
    source: { kind: "manual" },
  };
}
