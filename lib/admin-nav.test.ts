import { test } from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, resolveNavItem } from "./admin-nav";

test("the four sections are the nav, in order", () => {
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.href),
    ["/admin", "/admin/vault", "/admin/garden", "/admin/beanstalk"],
  );
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.label),
    ["Inbox", "Vault", "Garden", "Beanstalk"],
  );
});

test("/admin matches Inbox exactly, not as a prefix of everything", () => {
  assert.equal(resolveNavItem("/admin"), "/admin");
  assert.equal(resolveNavItem("/admin/"), "/admin");
});

test("section roots resolve to themselves", () => {
  assert.equal(resolveNavItem("/admin/vault"), "/admin/vault");
  assert.equal(resolveNavItem("/admin/garden"), "/admin/garden");
  assert.equal(resolveNavItem("/admin/beanstalk"), "/admin/beanstalk");
});

test("detail routes resolve to the section they belong to", () => {
  assert.equal(resolveNavItem("/admin/sprout/my-sprout"), "/admin/vault");
  assert.equal(resolveNavItem("/admin/bean/abc123"), "/admin/vault");
  assert.equal(resolveNavItem("/admin/plant/ariko"), "/admin/garden");
  assert.equal(resolveNavItem("/admin/pod/some-pod"), "/admin/garden");
  assert.equal(resolveNavItem("/admin/triage/abc123"), "/admin");
});

test("login belongs to no section", () => {
  assert.equal(resolveNavItem("/admin/login"), null);
});

test("an unknown admin route highlights nothing", () => {
  assert.equal(resolveNavItem("/admin/nowhere"), null);
  assert.equal(resolveNavItem("/"), null);
});

test("a prefix must end at a segment boundary", () => {
  // /admin/vaulted is not the vault.
  assert.equal(resolveNavItem("/admin/vaulted"), null);
});
