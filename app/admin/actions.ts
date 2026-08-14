"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifyPassword } from "@/lib/session";
import { buildSeedBody } from "@/lib/seed-form";
import { validateInboxPayload } from "@/lib/inbox";
import { createOrUpdateSeed, getSeed, markSeedPromoted, discardSeed } from "@/lib/seeds";
import { loadRawGarden } from "@/lib/store";
import { publishCascade, unpublishCascade, unpublishCascadeForBeans, type Domain } from "@/lib/data";
import { resolveParentChoice, buildSproutInput, validateSproutInput } from "@/lib/promote";
import { buildSproutPatch, validateSproutPatch } from "@/lib/sprout-edit";
import {
  createPod,
  createBean,
  createSprout,
  deleteVersion,
  setPublic,
  SlugExistsError,
  getSprout,
  updateVersion,
  setPrivate,
} from "@/lib/botanical";
import {
  requireSession,
  setSessionCookie,
  clearSessionCookie,
} from "./session";

// Verify the password, mint a session, land on /admin. Wrong password → back to
// login with an error flag. Fail closed if either secret is unset.
export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const secret = process.env.ADMIN_SESSION_SECRET;
  const expected = process.env.ADMIN_PASSWORD;
  if (!secret || !expected || !(await verifyPassword(secret, password, expected))) {
    redirect("/admin/login?error=1");
  }
  await setSessionCookie();
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await requireSession();
  await clearSessionCookie();
  redirect("/admin/login");
}

// Map the form → raw body → the SAME validate + persist seam /api/inbox uses.
export async function createSeedAction(formData: FormData): Promise<void> {
  await requireSession();
  const raw = buildSeedBody(formData);
  const parsed = validateInboxPayload(raw);
  if (!parsed.ok) {
    redirect(`/admin?error=${encodeURIComponent(parsed.error)}`);
  }
  await createOrUpdateSeed(parsed.value);
  revalidatePath("/admin");
  redirect("/admin");
}

const DOMAINS: Domain[] = ["music", "design", "podcast"];

export async function discardSeedAction(formData: FormData): Promise<void> {
  await requireSession();
  const seedId = String(formData.get("seedId") ?? "");
  await discardSeed(seedId);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function promoteSeedAction(formData: FormData): Promise<void> {
  await requireSession();
  const seedId = String(formData.get("seedId") ?? "");
  const capture = await getSeed(seedId);
  if (!capture) redirect("/admin");

  // Validate the version's own fields BEFORE any write, so an invalid version never
  // leaves orphan molecule/atom docs behind.
  const precheck = validateSproutInput(buildSproutInput(formData, capture, null));
  if (!precheck.ok) {
    redirect(`/admin/triage/${seedId}?error=${encodeURIComponent(precheck.error)}`);
  }

  // Resolve parent choices up front (pure) so we can guard invalid combinations
  // BEFORE any write. A newly created molecule is only ever linked from a newly
  // created atom in this flow, so "new molecule + (existing/no) atom" would leave
  // the molecule orphaned — reject it rather than silently drop the intent.
  const molChoice = resolveParentChoice(
    String(formData.get("newMoleculeSlug") ?? ""),
    String(formData.get("podSlug") ?? ""),
  );
  const atomChoice = resolveParentChoice(
    String(formData.get("newAtomSlug") ?? ""),
    String(formData.get("beanSlug") ?? ""),
  );
  if (molChoice.mode === "create" && atomChoice.mode !== "create") {
    redirect(
      `/admin/triage/${seedId}?error=${encodeURIComponent(
        "a new molecule must be paired with a new atom under it",
      )}`,
    );
  }

  // Create parents, then the version. Only slug collisions are recoverable;
  // anything else propagates. redirect() stays OUT of the try (it throws to control flow).
  let slugError: string | null = null;
  try {
    let podSlug: string | null = null;
    if (molChoice.mode === "create") {
      const domainRaw = String(formData.get("newMoleculeDomain") ?? "");
      const domain: Domain = DOMAINS.includes(domainRaw as Domain) ? (domainRaw as Domain) : "music";
      await createPod({
        slug: molChoice.slug,
        name: String(formData.get("newMoleculeName") ?? "").trim() || molChoice.slug,
        domain,
        description: "",
      });
      podSlug = molChoice.slug;
    } else if (molChoice.mode === "existing") {
      podSlug = molChoice.slug;
    }

    let beanSlug: string | null = null;
    if (atomChoice.mode === "create") {
      await createBean({
        slug: atomChoice.slug,
        name: String(formData.get("newAtomName") ?? "").trim() || atomChoice.slug,
        podSlug,
      });
      beanSlug = atomChoice.slug;
    } else if (atomChoice.mode === "existing") {
      beanSlug = atomChoice.slug;
    }

    const input = buildSproutInput(formData, capture, beanSlug);
    await createSprout(input);

    if (input.state === "published") {
      const { podSlugs, beanSlugs } = publishCascade(await loadRawGarden(), input.slug);
      await setPublic(podSlugs, beanSlugs);
    }

    await markSeedPromoted(seedId, input.slug);
  } catch (err) {
    if (err instanceof SlugExistsError) slugError = err.message;
    else throw err;
  }

  if (slugError) {
    redirect(`/admin/triage/${seedId}?error=${encodeURIComponent(slugError)}`);
  }
  revalidatePath("/admin");
  redirect("/admin");
}

export async function editVersionAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");
  const existing = await getSprout(slug);
  if (!existing) redirect("/admin/vault");

  const patch = buildSproutPatch(formData);
  const check = validateSproutPatch(patch);
  if (!check.ok) {
    // The page renders ?error verbatim (the delete action shares the slot), so the
    // message carries its own "could not save" context.
    redirect(`/admin/sprout/${slug}?error=${encodeURIComponent(`could not save: ${check.error}`)}`);
  }

  await updateVersion(slug, patch);

  // Re-publish reuses the upward, idempotent cascade (same as promote). An actual
  // un-publish — the version WAS published and no longer is — runs the downward
  // recompute (A1): re-privatize parents left sheltering no published version.
  // Gated on the transition (existing = pre-save state) so a routine draft save can
  // never flip visibility somebody authored directly (e.g. a seeded public atom
  // that has no published versions yet). Both branches load the dataset AFTER
  // updateVersion, so the cascade evaluates the just-saved state.
  if (patch.state === "published") {
    const { podSlugs, beanSlugs } = publishCascade(await loadRawGarden(), slug);
    await setPublic(podSlugs, beanSlugs);
  } else if (existing.state === "published") {
    const { podSlugs, beanSlugs } = unpublishCascade(await loadRawGarden(), slug);
    await setPrivate(podSlugs, beanSlugs);
  }

  revalidatePath("/admin");
  const beanSlug = (existing.parents ?? [])
    .filter((p) => p.startsWith("bean:"))
    .map((p) => p.slice("bean:".length))[0];
  redirect(beanSlug ? `/admin/bean/${beanSlug}` : "/admin/vault");
}

// Hard delete (roadmap A2). The atom parents and published state are captured BEFORE
// the delete — afterwards the version is gone from the dataset, so the slug-keyed
// unpublishCascade would silently no-op. The recompute (only when the deleted version
// WAS published; a draft/private delete cannot change the public projection) runs the
// atom-keyed core against the dataset loaded AFTER the delete, so the deleted version
// cannot shelter anything.
export async function deleteVersionAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  // Existence first, so the confirm-fail redirect below only ever targets a real
  // edit page (and the slug it interpolates is a known-good stored slug).
  const existing = await getSprout(slug);
  if (!existing) redirect("/admin/vault");

  // Server-side re-check of the confirm checkbox; the browser `required` is only UX.
  if (String(formData.get("confirm") ?? "") !== "on") {
    redirect(
      `/admin/sprout/${encodeURIComponent(slug)}?error=${encodeURIComponent(
        "could not delete: confirm the permanent deletion first",
      )}`,
    );
  }

  const beanSlugs = (existing.parents ?? [])
    .filter((p) => p.startsWith("bean:"))
    .map((p) => p.slice("bean:".length));
  const wasPublished = existing.state === "published";

  await deleteVersion(slug);

  if (wasPublished) {
    const { podSlugs, beanSlugs: flipAtoms } = unpublishCascadeForBeans(
      await loadRawGarden(),
      beanSlugs,
    );
    await setPrivate(podSlugs, flipAtoms);
  }

  revalidatePath("/admin");
  redirect(beanSlugs[0] ? `/admin/bean/${beanSlugs[0]}` : "/admin/vault");
}
