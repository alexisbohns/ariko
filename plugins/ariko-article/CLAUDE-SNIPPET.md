## Writing for Ariko

When asked to write an article about this project for Ariko, post it as a
**draft** through Ariko's API — never commit the article or its images to this
repo. (The `ariko-article` skill has the full guidance; this section is enough
without it.)

- **Env:** `ARIKO_TOKEN` (this repo's token, scoped to its pod) and `ARIKO_URL`
  (default `https://www.ariko.app`). In a cloud session they come from the
  environment preset; `www.ariko.app` must be on its network allowlist.
- **1. Ping first:** `curl -fsS -H "Authorization: Bearer $ARIKO_TOKEN" "${ARIKO_URL:-https://www.ariko.app}/api/articles/ping"`
  returns `{ pod, plant, beans }`. If it fails, stop and say why: token unset,
  Ariko unreachable (allowlist), or 401 (token revoked or mistyped).
- **2. Pick the kind:** an **essay** is a dated piece about the pod and/or some
  of its beans; a **narrative** rewrites what the pod or one feature (bean) *is
  now*. Ask if the request does not say.
- **3. Draft in a temp folder**, markdown, EN and optionally FR (an adaptation
  in "tu", not a literal translation). Images as local paths for now.
- **4. Show the draft and wait for an explicit yes.** Upload nothing before.
- **5. Upload each image:** `curl -sS -w '\nHTTP %{http_code}\n' -H "Authorization: Bearer $ARIKO_TOKEN" -F "file=@shot.png;type=image/png" "${ARIKO_URL:-https://www.ariko.app}/api/articles/assets"`
  → `{ url, width, height }`. Always declare `;type=` and make it match the
  format (`image/png|jpeg|gif|webp|avif`): curl sends `.webp`/`.avif` as
  octet-stream, which is refused. PNG/JPEG/GIF/WebP/AVIF, 4 MB max; no SVG (a
  renamed SVG fails at upload). Replace each local path with its `url`: Ariko
  refuses any image URL that did not come from this endpoint.
- **6. Post** with `curl -sS -w '\nHTTP %{http_code}\n' -X POST -H "Authorization: Bearer $ARIKO_TOKEN" -H "content-type: application/json" --data @payload.json "${ARIKO_URL:-https://www.ariko.app}/api/articles"` (no `-f`: the error body matters), JSON:
  `{ "essays": [{ "slug", "date": "YYYY-MM-DD", "name", "description"?, "content", "about": ["<pod or bean slug>"] }],
     "narratives": [{ "slug": "<pod or bean slug>", "name"?, "description"?, "content" }] }`.
  `name` / `description` / `content` are a string or `{ "en", "fr" }`; posting
  only `{ "en" }` keeps a stored French half (and vice versa). A new bean needs
  `name`. Never send `state`, `visibility`, `kind`, `type`, `parents` or
  `exhibited` — they are refused — and no other key: an unknown one is refused
  by name too.
- **Only private things are writable.** A pod or bean the maintainer has
  published is refused (`already reviewed`), even if its narrative is blank. An
  essay can be re-posted only while it is still a draft this door wrote for this
  pod.
- **7. Report** the `admin` URLs from the response: the maintainer publishes
  there. A 409 is `{ error: "refused", refused: [...], written: [...] }`: fix
  what `refused` names and re-post the whole payload. Nothing was written
  unless `written` lists something (a race interrupted the batch; what it lists
  is private/draft, and re-posting is safe). A rare 409 may carry only
  `{ error }` — a slug taken mid-write: re-ping and retry.
