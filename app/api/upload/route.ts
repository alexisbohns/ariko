import { hasValidToken, parseTokens } from "../../../lib/auth";
import { uploadImage } from "../../../lib/storage";
import { checkUploadFile, uploadedFilename } from "../../../lib/upload-input";

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

  const check = checkUploadFile({ size: file.size, type: file.type });
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = uploadedFilename(file);

  try {
    const media = await uploadImage(bytes, filename);
    return Response.json(media, { status: 201 });
  } catch (err) {
    // Upload failure never costs a seed: inbox and upload are separate calls.
    return Response.json(
      { error: "upload failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
