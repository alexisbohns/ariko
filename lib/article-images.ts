// lib/article-images.ts
//
// The article door's image rule (spec 2026-11-14 §3.3): every image in posted
// prose must already be on Ariko's own Cloudinary cloud, uploaded through
// POST /api/articles/assets. That is what makes the draft the maintainer
// approved in the sibling session the draft that is stored — a hotlink can
// change or vanish after review, and a local path renders as a broken image.
//
// Parsed with the same remark + GFM grammar the renderer uses, so an image in
// a code span or fence (which renders as text) is correctly NOT an image, and
// a plain link is not one either. Reference-style images are refused rather
// than resolved: the door wants one obvious form, and a definition can sit
// anywhere in a 500 KiB body.

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";

export function markdownImages(markdown: string): { urls: string[]; references: number } {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  const urls: string[] = [];
  let references = 0;
  visit(tree, (node) => {
    if (node.type === "image") urls.push((node as { url: string }).url);
    else if (node.type === "imageReference") references += 1;
  });
  return { urls, references };
}

/** One message per offending image; empty when every image is Ariko-hosted. */
export function imageProblems(markdown: string, cloud: string | undefined): string[] {
  const { urls, references } = markdownImages(markdown);
  const problems: string[] = [];
  if (references > 0)
    problems.push("reference-style images (![alt][id]) are not accepted — use ![alt](url)");
  const prefix = cloud ? `https://res.cloudinary.com/${cloud}/` : null;
  for (const url of urls) {
    if (prefix && url.startsWith(prefix)) continue;
    problems.push(
      `${url} is not hosted by Ariko — upload it to /api/articles/assets and use the URL it returns`,
    );
  }
  return problems;
}

/** `cloudinary://<key>:<secret>@<cloud>` → `<cloud>`. */
export function cloudinaryCloudName(env: string | undefined): string | undefined {
  if (!env) return undefined;
  const match = /^cloudinary:\/\/[^@]+@([a-z0-9-_]+)/i.exec(env);
  return match ? match[1] : undefined;
}
