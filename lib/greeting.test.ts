import { test } from "node:test";
import assert from "node:assert/strict";
import { greeting } from "./greeting";

const at = (hour: number) => new Date(2026, 8, 12, hour, 0, 0);

test("the day has three parts", () => {
  assert.equal(greeting(at(0)), "Good morning");
  assert.equal(greeting(at(11)), "Good morning");
  assert.equal(greeting(at(12)), "Good afternoon");
  assert.equal(greeting(at(17)), "Good afternoon");
  assert.equal(greeting(at(18)), "Good evening");
  assert.equal(greeting(at(23)), "Good evening");
});
