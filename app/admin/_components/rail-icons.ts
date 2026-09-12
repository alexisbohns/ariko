"use client";

/**
 * The entity rail's icons, re-exported across a client boundary.
 *
 * `RailItem.icon` is a `ComponentType`, and an entity page is a SERVER
 * component: importing `FileCode2` from `lucide-react` there and handing it to
 * `EntityRail` puts a bare function in the flight payload, and React refuses —
 * "Functions cannot be passed directly to Client Components". NO PER-ICON
 * MODULE carries the directive (three files in the package do, none of them an
 * icon), so an icon's `forwardRef` object is an ordinary value rather than a
 * client reference. Re-exporting from a file that DOES carry it is what
 * registers each one, and a registered reference serializes.
 *
 * `section-icons.ts` next door needs none of this, but not for the reason it
 * used to give: what saves it is that both of its importers are client
 * components, so its icons never cross a boundary at all. These do.
 *
 * `lib/entity-rail-source.test.ts` pins both halves — this file's directive,
 * and that no rail page reaches past it to `lucide-react`. It has to, because
 * every page that uses the rail is `force-dynamic`: `next build` never renders
 * one, so `tsc`, `eslint`, `npm test` and `npm run build` ALL pass on a page
 * that 500s on every request.
 */
export { FileCode2, Images, Trash2 } from "lucide-react";
