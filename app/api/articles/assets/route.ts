// app/api/articles/assets/route.ts
import { handleAssetUpload } from "../../../../lib/articles-assets";
import { authorizeRepo } from "../../../../lib/repo-token-store";
import { uploadImage } from "../../../../lib/storage";

export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  return handleAssetUpload(request, { authorize: authorizeRepo, upload: uploadImage });
}
