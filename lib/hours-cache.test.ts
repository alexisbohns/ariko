import { test } from "node:test";
import assert from "node:assert/strict";
import { revalidateHours } from "./hours-cache";

// Under node --test there is no Next request store: revalidateTag throws the
// "outside a request" error, and revalidateHours tolerates exactly that one.
test("revalidateHours does not throw outside a Next request", () => {
  assert.doesNotThrow(() => revalidateHours());
});
