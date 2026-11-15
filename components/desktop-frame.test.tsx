import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { DesktopFrame } from "./desktop-frame";

test("a desktop frame: hairline, a three-dot strip, the image with its alt", () => {
  const html = renderToStaticMarkup(
    <DesktopFrame
      src="https://res.cloudinary.com/c/image/upload/v1/beanstalk/a.png"
      alt="The cromlech"
      width={1536}
    />,
  );
  assert.match(html, /border-border/);
  assert.equal((html.match(/rounded-full/g) ?? []).length, 3);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /alt="The cromlech"/);
  assert.match(html, /w_1536/);
});
