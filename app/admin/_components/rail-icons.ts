"use client";

/**
 * The entity rail's icons, re-exported across a client boundary.
 *
 * `RailItem.icon` is a `ComponentType`, and an entity page is a SERVER
 * component: importing `FileCode2` from `lucide-react` there and handing it to
 * `EntityRail` puts a bare function in the flight payload, and React refuses —
 * "Functions cannot be passed directly to Client Components". Only
 * `lucide-react/dist/esm/Icon.mjs` carries the directive, so the icon modules
 * themselves are server modules and their `forwardRef` objects are ordinary
 * values, not client references. Re-exporting them from a file that DOES carry
 * the directive is what registers each one, and a registered reference
 * serializes.
 *
 * `section-icons.ts` needs none of this and says so in its own docblock: both
 * of its importers are client components, so its icons never cross a boundary.
 * This one exists precisely because the rail's do.
 *
 * The failure is loud — a 500 on the first render of every page that uses the
 * rail — so there is no test here; it cannot reach a reader.
 */
export { FileCode2, Images, Trash2 } from "lucide-react";
