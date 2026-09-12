import { test } from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, navHref, navItems, resolveColumn, resolveNavItem } from "./admin-nav";

test("the six sections are the nav, in order", () => {
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.id),
    ["inbox", "pods", "beans", "sprouts", "screens", "beanstalk"],
  );
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.href),
    [
      "/admin/inbox",
      "/admin/pods",
      "/admin/beans",
      "/admin/sprouts",
      "/admin/screens",
      "/admin/beanstalk",
    ],
  );
  assert.deepEqual(
    NAV_ITEMS.map((i) => i.label),
    ["Inbox", "Pods", "Beans", "Sprouts", "Screens", "Beanstalk"],
  );
});

test("the root is not a section — it lights nothing", () => {
  assert.equal(resolveNavItem("/admin"), null);
  assert.equal(resolveNavItem("/admin/"), null);
});

test("section roots resolve to themselves", () => {
  assert.equal(resolveNavItem("/admin/inbox"), "/admin/inbox");
  assert.equal(resolveNavItem("/admin/pods"), "/admin/pods");
  assert.equal(resolveNavItem("/admin/beans"), "/admin/beans");
  assert.equal(resolveNavItem("/admin/sprouts"), "/admin/sprouts");
  assert.equal(resolveNavItem("/admin/beanstalk"), "/admin/beanstalk");
});

test("detail routes resolve to the section they belong to", () => {
  assert.equal(resolveNavItem("/admin/sprout/my-sprout"), "/admin/sprouts");
  assert.equal(resolveNavItem("/admin/bean/abc123"), "/admin/beans");
  assert.equal(resolveNavItem("/admin/pod/some-pod"), "/admin/pods");
  assert.equal(resolveNavItem("/admin/triage/abc123"), "/admin/inbox");
});

test("a plant page belongs to Overview, which only exists when scoped", () => {
  assert.equal(resolveNavItem("/admin/plant/ariko"), "/admin/plant/ariko");
});

test("login belongs to no section", () => {
  assert.equal(resolveNavItem("/admin/login"), null);
});

test("an unknown admin route highlights nothing", () => {
  assert.equal(resolveNavItem("/admin/nowhere"), null);
  assert.equal(resolveNavItem("/"), null);
});

test("a prefix must end at a segment boundary", () => {
  assert.equal(resolveNavItem("/admin/podsy"), null);
  assert.equal(resolveNavItem("/admin/beanstalked"), null);
  assert.equal(resolveNavItem("/admin/screenshots"), null);
  assert.equal(resolveNavItem("/admin/screen/karma-top"), null);
});

test("unscoped, the rail is exactly NAV_ITEMS", () => {
  assert.deepEqual(navItems(null), NAV_ITEMS);
});

test("scoped, Overview leads and Beanstalk steps aside", () => {
  const items = navItems("ariko");
  assert.deepEqual(
    items.map((i) => i.id),
    ["overview", "inbox", "pods", "beans", "sprouts", "screens"],
  );
  assert.equal(items[0].href, "/admin/plant/ariko");
  assert.equal(items[0].label, "Overview");
});

test("a scoped slug is encoded into Overview's href", () => {
  assert.equal(navItems("a b/c")[0].href, "/admin/plant/a%20b%2Fc");
});

test("navHref carries the scope to a section and leaves Overview alone", () => {
  assert.equal(navHref(NAV_ITEMS[1], "ariko"), "/admin/pods?plant=ariko");
  assert.equal(navHref(NAV_ITEMS[1], null), "/admin/pods");
  const overview = navItems("ariko")[0];
  assert.equal(navHref(overview, "ariko"), "/admin/plant/ariko");
});

test("every section index reads in the wide column", () => {
  for (const item of NAV_ITEMS) assert.equal(resolveColumn(item.href), "wide", item.href);
});

test("the welcome page is wide too — it holds two tables", () => {
  assert.equal(resolveColumn("/admin"), "wide");
  assert.equal(resolveColumn("/admin/"), "wide");
});

test("detail pages read in the same column the public site does", () => {
  assert.equal(resolveColumn("/admin/plant/ariko"), "reading");
  assert.equal(resolveColumn("/admin/pod/some-pod"), "reading");
  assert.equal(resolveColumn("/admin/bean/abc123"), "reading");
  assert.equal(resolveColumn("/admin/sprout/my-sprout"), "reading");
  assert.equal(resolveColumn("/admin/triage/abc123"), "reading");
  assert.equal(resolveColumn("/admin/screens/karma-top"), "reading");
});

test("login is bare — it has no chrome to clear", () => {
  assert.equal(resolveColumn("/admin/login"), "bare");
  assert.equal(resolveColumn("/admin/login/"), "bare");
});

test("an unknown route reads rather than sprawls", () => {
  assert.equal(resolveColumn("/admin/nowhere"), "reading");
});
