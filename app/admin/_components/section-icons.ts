import { Archive, Images, Inbox, Sprout, Waypoints } from "lucide-react";
import type { ComponentType } from "react";

/**
 * One href → icon map for the admin's sections, drawn by both the rail
 * (admin-chrome.tsx) and the palette's "Go to" rows (command-palette.tsx), so
 * the same destination looks the same in both places.
 *
 * It WAS two maps, and they drifted the first time they were asked to: Screens
 * became the fifth section, the rail learned about it, the palette did not, and
 * its fall-through icon made Screens and Beanstalk the same picture under ⌘K.
 * Nothing failed — which is exactly why the map is here now rather than twice.
 * It is lib/admin-nav.ts's reason for reading NAV_ITEMS instead of listing the
 * section indexes again, one file over.
 *
 * JSX-free, and nothing in its graph reaches lib/data.ts: both importers are
 * client components and lucide-react is itself "use client", so this only ever
 * lands in a client bundle. lib/section-icons.test.ts holds it to NAV_ITEMS, so
 * the sixth section cannot repeat the fifth's mistake.
 */
export const SECTION_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  "/admin": Inbox,
  "/admin/vault": Archive,
  "/admin/garden": Sprout,
  "/admin/beanstalk": Waypoints,
  "/admin/screens": Images,
};
