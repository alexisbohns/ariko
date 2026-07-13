import { hasValidToken, parseTokens } from "../../../lib/auth";
import { uploadImage } from "../../../lib/storage";

export async function POST(request: Request): Promise<Response> {
  const tokens = parseTokens(process.env.INBOX_TOKENS);
  if (!hasValidToken(request.headers.get("authorization"), tokens)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return Response.json({ error: "missing 'file' field" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = typeof (file as File).name === "string" ? (file as File).name : undefined;

  try {
    const media = await uploadImage(bytes, filename);
    return Response.json(media, { status: 201 });
  } catch (err) {
    // Upload failure never costs a capture: inbox and upload are separate calls.
    return Response.json(
      { error: "upload failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
