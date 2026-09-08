import { test } from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, resolveColumn, resolveNavItem } from "./admin-nav";

test("the five sections are the nav, in order", () => {
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.href),
    ["/admin", "/admin/vault", "/admin/garden", "/admin/beanstalk", "/admin/screens"],
  );
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.label),
    ["Inbox", "Vault", "Garden", "Beanstalk", "Screens"],
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

/**
 * The column rule (components/page-column.tsx). It reads NAV_ITEMS rather than
 * carrying a list of its own, and the first test below is what makes that
 * choice worth anything: add a fifth section and its index page is wide without
 * anyone remembering to say so.
 */

test("every section index reads in the wide column", () => {
  for (const item of NAV_ITEMS) assert.equal(resolveColumn(item.href), "wide", item.href);
});

test("detail pages read in the same column the public site does", () => {
  assert.equal(resolveColumn("/admin/plant/ariko"), "reading");
  assert.equal(resolveColumn("/admin/pod/some-pod"), "reading");
  assert.equal(resolveColumn("/admin/bean/abc123"), "reading");
  assert.equal(resolveColumn("/admin/sprout/my-sprout"), "reading");
  assert.equal(resolveColumn("/admin/triage/abc123"), "reading");
});

test("login is bare — it has no chrome to clear", () => {
  assert.equal(resolveColumn("/admin/login"), "bare");
});

test("an unknown route reads rather than sprawls", () => {
  // Detail pages outnumber indexes and always will, and 80px too narrow is a
  // smaller wrong than 280px too wide.
  assert.equal(resolveColumn("/admin/nowhere"), "reading");
});

test("the column rule tolerates a trailing slash", () => {
  assert.equal(resolveColumn("/admin/vault/"), "wide");
  assert.equal(resolveColumn("/admin/login/"), "bare");
});

test("Screens is a section, and its children light it", () => {
  assert.equal(resolveNavItem("/admin/screens"), "/admin/screens");
  assert.equal(resolveNavItem("/admin/screens/karma-top"), "/admin/screens");
  assert.equal(resolveNavItem("/admin/screens/new"), "/admin/screens");
});

test("the library is a wide column and a screen is a reading one", () => {
  assert.equal(resolveColumn("/admin/screens"), "wide");
  assert.equal(resolveColumn("/admin/screens/karma-top"), "reading");
  assert.equal(resolveColumn("/admin/screens/new"), "reading");
});

// The SECTIONS comment says no prefix is a prefix of another, and a singular
// /admin/screen route — the shape every other species uses — would make that
// false. The boundary check is what actually protects it, so pin the behaviour
// rather than the comment. Both directions: /admin/screen* is an extension of
// the prefix, /admin/screen/… is a route the prefix is an extension OF, and it
// is the second one the comment is actually about.
test("a would-be /admin/screen route does not light Screens", () => {
  assert.equal(resolveNavItem("/admin/screenshots"), null);
  assert.equal(resolveNavItem("/admin/screen/karma-top"), null);
});
