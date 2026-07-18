import { authorize, parseTokens } from "../../../lib/auth";
import { MAX_INBOX_BODY_BYTES, validateInboxPayload } from "../../../lib/inbox";
import { createOrUpdateCapture } from "../../../lib/captures";

export async function POST(request: Request): Promise<Response> {
  const tokens = parseTokens(process.env.INBOX_TOKENS);

  // Size gate before parsing and before any auth reasoning (spec: 413 wins
  // over 401 — an oversized body yields no source.kind, and 413 leaks nothing).
  const tooLarge = () =>
    Response.json(
      { error: `body too large (max ${MAX_INBOX_BODY_BYTES} bytes)` },
      { status: 413 },
    );
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_INBOX_BODY_BYTES) return tooLarge();

  // The header can lie or be absent (chunked encoding): measure what arrived.
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_INBOX_BODY_BYTES) return tooLarge();

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = validateInboxPayload(body);
  if (!parsed.ok) {
    // Distinguish an unauthenticated request from a bad payload: if no valid
    // token at all, prefer 401 even on a malformed body.
    const auth = request.headers.get("authorization");
    const kind =
      typeof body === "object" && body !== null && "source" in body
        ? (body as { source?: { kind?: string } }).source?.kind ?? ""
        : "";
    if (authorize(auth, kind, tokens) === "unauthorized") {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const auth = authorize(request.headers.get("authorization"), parsed.value.source.kind, tokens);
  if (auth === "unauthorized") return Response.json({ error: "unauthorized" }, { status: 401 });
  if (auth === "forbidden") return Response.json({ error: "forbidden source kind" }, { status: 403 });

  const { capture, created } = await createOrUpdateCapture(parsed.value);
  return Response.json({ id: capture.id, created }, { status: created ? 201 : 200 });
}
