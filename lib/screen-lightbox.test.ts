import { test } from "node:test";
import assert from "node:assert/strict";

import { isPlainClick, stepScreen, swipeStep, SWIPE_THRESHOLD } from "./screen-lightbox";

const plain = {
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
};

test("a plain primary click is the lightbox's to take", () => {
  assert.equal(isPlainClick(plain), true);
});

test("every modified click stays the browser's", () => {
  // ⌘/Ctrl-click is "open this in a tab", Shift is a window, Alt a download.
  // Taking any of them would replace what the visitor asked for with an
  // overlay — an enhancement turned into a replacement.
  for (const key of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const) {
    assert.equal(isPlainClick({ ...plain, [key]: true }), false, key);
  }
});

test("a non-primary button, or a click already claimed, stays the browser's", () => {
  assert.equal(isPlainClick({ ...plain, button: 1 }), false);
  assert.equal(isPlainClick({ ...plain, button: 2 }), false);
  assert.equal(isPlainClick({ ...plain, defaultPrevented: true }), false);
});

test("a step moves within the strip", () => {
  assert.equal(stepScreen(0, 1, 3), 1);
  assert.equal(stepScreen(2, -1, 3), 1);
});

test("a step off either end is a no-op, never a wrap", () => {
  // Clamped like the admin's screen sheet: on a strip of two, a wrap makes →
  // on the last screen look like the arrow did nothing.
  assert.equal(stepScreen(0, -1, 3), null);
  assert.equal(stepScreen(2, 1, 3), null);
  assert.equal(stepScreen(0, 1, 1), null);
  assert.equal(stepScreen(0, 1, 0), null);
});

test("a swipe left goes on, a swipe right goes back", () => {
  assert.equal(swipeStep(-SWIPE_THRESHOLD, 0), 1);
  assert.equal(swipeStep(SWIPE_THRESHOLD, 0), -1);
});

test("a short drift is a tap, not a swipe", () => {
  assert.equal(swipeStep(SWIPE_THRESHOLD - 1, 0), 0);
  assert.equal(swipeStep(-(SWIPE_THRESHOLD - 1), 0), 0);
});

test("a mostly-vertical movement is a scroll, not a swipe", () => {
  // The sheet scrolls on a short viewport; a scroll with sideways drift must
  // stay a scroll.
  assert.equal(swipeStep(-80, 120), 0);
  assert.equal(swipeStep(80, -80), 0);
});
