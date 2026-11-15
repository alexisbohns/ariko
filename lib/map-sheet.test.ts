import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DISCARD_PROMPT,
  EDITOR_DIRTY_ATTR,
  MAP_PATH,
  confirmDiscard,
  hasUnsavedEdit,
  mapCloseHref,
  sheetOpenFor,
} from "./map-sheet";

test("closing returns to the map with the query the author left it with", () => {
  assert.equal(mapCloseHref(""), MAP_PATH);
  assert.equal(mapCloseHref("?plant=ariko&view=review"), "/admin/map?plant=ariko&view=review");
  // `URLSearchParams.toString()` carries no `?`; a caller may pass either.
  assert.equal(mapCloseHref("plant=ariko"), "/admin/map?plant=ariko");
});

test("the sheet is open on every path but the map's own", () => {
  assert.equal(sheetOpenFor("/admin/map"), false);
  assert.equal(sheetOpenFor("/admin/map/"), false);
  assert.equal(sheetOpenFor("/admin/bean/spike-bean"), true);
  assert.equal(sheetOpenFor("/admin/plant/spike/narrative"), true);
});

test("an editor is unsaved exactly when the dirty marker is in the sheet", () => {
  const clean = { querySelector: () => null };
  const dirty = { querySelector: (selector: string) => (selector === `[${EDITOR_DIRTY_ATTR}]` ? {} : null) };
  assert.equal(hasUnsavedEdit(null), false);
  assert.equal(hasUnsavedEdit(clean), false);
  assert.equal(hasUnsavedEdit(dirty), true);
});

test("a clean sheet never asks; a dirty one asks once and obeys the answer", () => {
  const dirty = { querySelector: () => ({}) };
  const clean = { querySelector: () => null };
  const asked: string[] = [];
  const yes = (message: string) => (asked.push(message), true);
  const no = (message: string) => (asked.push(message), false);

  assert.equal(confirmDiscard(clean, yes), true);
  assert.deepEqual(asked, []);
  assert.equal(confirmDiscard(dirty, yes), true);
  assert.equal(confirmDiscard(dirty, no), false);
  assert.deepEqual(asked, [DISCARD_PROMPT, DISCARD_PROMPT]);
});
