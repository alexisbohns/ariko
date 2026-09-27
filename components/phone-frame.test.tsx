import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { PhoneFrame } from "./phone-frame";
import type { MediaImage } from "@/lib/data";

/**
 * The phone's intrinsic size — the one thing that keeps an unloaded screen
 * from drawing as a dark bar. See the docblock in phone-frame.tsx for why the
 * stored dimensions are right in one shape and wrong in the other.
 */
const image = (dims: boolean): MediaImage => ({
  kind: "image",
  storageKey: "k/one",
  url: "https://res.cloudinary.com/demo/image/upload/v1/one.png",
  ...(dims ? { width: 1179, height: 2556 } : {}),
});

const img = (markup: string) => markup.match(/<img[^>]*>/)?.[0] ?? "";

test("uncropped, the <img> reserves the stored shape before it loads", () => {
  const tag = img(renderToStaticMarkup(<PhoneFrame image={image(true)} alt="" width={400} />));
  assert.match(tag, /\swidth="1179"/);
  assert.match(tag, /\sheight="2556"/);
});

test("cropped, the stored shape is NOT the drawn one, so it is left off", () => {
  // c_fill draws the caller's box, not the image's ratio — reserving the
  // stored height here would leave a tall phone above a short crop.
  const tag = img(
    renderToStaticMarkup(<PhoneFrame image={image(true)} alt="" width={400} height={300} />),
  );
  assert.doesNotMatch(tag, /\s(width|height)="/);
});

test("an image stored without dimensions sizes itself when it arrives", () => {
  const tag = img(renderToStaticMarkup(<PhoneFrame image={image(false)} alt="" width={400} />));
  assert.doesNotMatch(tag, /\s(width|height)="/);
});
