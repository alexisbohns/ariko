"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifyPassword } from "@/lib/session";
import { buildSeedBody } from "@/lib/seed-form";
import { validateInboxPayload } from "@/lib/inbox";
import { createOrUpdateSeed, getSeed, markSeedPromoted, discardSeed } from "@/lib/seeds";
import { loadRawGarden } from "@/lib/store";
import { publishCascade, unpublishCascade, unpublishCascadeForBeans } from "@/lib/data";
import { resolveParentChoice, buildSproutInput, validateSproutInput } from "@/lib/promote";
import { buildSproutPatch, validateSproutPatch, shouldCascadePublish } from "@/lib/sprout-edit";
import { runSync } from "@/lib/pollen-run";
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
  const seed = await getSeed(seedId);
  if (!seed) redirect("/admin");

  // Validate the version's own fields BEFORE any write, so an invalid version never
  // leaves orphan pod/bean docs behind.
  const precheck = validateSproutInput(buildSproutInput(formData, seed, null));
  if (!precheck.ok) {
    redirect(`/admin/triage/${seedId}?error=${encodeURIComponent(precheck.error)}`);
  }

  // Resolve parent choices up front (pure) so invalid combinations are guarded
  // BEFORE any write. A newly created pod is only ever linked from a newly
  // created bean in this flow — reject "new pod + (existing/no) bean" rather
  // than silently drop the intent. The plant select applies to whichever parent
  // is created: a new pod roots under it; a new bean with NO pod roots directly
  // under it (simple projects skip the pod tier).
  const plantSlug = String(formData.get("plantSlug") ?? "").trim() || null;
  const podChoice = resolveParentChoice(
    String(formData.get("newPodSlug") ?? ""),
    String(formData.get("podSlug") ?? ""),
  );
  const beanChoice = resolveParentChoice(
    String(formData.get("newBeanSlug") ?? ""),
    String(formData.get("beanSlug") ?? ""),
  );
  if (podChoice.mode === "create" && beanChoice.mode !== "create") {
    redirect(
      `/admin/triage/${seedId}?error=${encodeURIComponent(
        "a new pod must be paired with a new bean under it",
      )}`,
    );
  }

  // Create parents, then the version. Only slug collisions are recoverable;
  // anything else propagates. redirect() stays OUT of the try (it throws to control flow).
  let slugError: string | null = null;
  try {
    let podSlug: string | null = null;
    if (podChoice.mode === "create") {
      await createPod({
        slug: podChoice.slug,
        name: String(formData.get("newPodName") ?? "").trim() || podChoice.slug,
        plantSlug,
        description: "",
      });
      podSlug = podChoice.slug;
    } else if (podChoice.mode === "existing") {
      podSlug = podChoice.slug;
    }

    let beanSlug: string | null = null;
    if (beanChoice.mode === "create") {
      await createBean({
        slug: beanChoice.slug,
        name: String(formData.get("newBeanName") ?? "").trim() || beanChoice.slug,
        podSlug,
        plantSlug: podSlug ? null : plantSlug,
      });
      beanSlug = beanChoice.slug;
    } else if (beanChoice.mode === "existing") {
      beanSlug = beanChoice.slug;
    }

    const input = buildSproutInput(formData, seed, beanSlug);
    await createSprout(input);

    if (input.state === "published") {
      const { plantSlugs, podSlugs, beanSlugs } = publishCascade(await loadRawGarden(), input.slug);
      await setPublic(plantSlugs, podSlugs, beanSlugs);
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
  // never flip visibility somebody authored directly (e.g. a seeded public bean
  // that has no published versions yet). Both branches load the dataset AFTER
  // updateVersion, so the cascade evaluates the just-saved state.
  // Further gated on the type being SAVED (final review C1): digest publication
  // marks review sign-off, not public exhibition — visibility of digest-*/
  // weekly-wrap beans and their plants stays a separate human act.
  if (patch.state === "published" && shouldCascadePublish(patch.type)) {
    const { plantSlugs, podSlugs, beanSlugs } = publishCascade(await loadRawGarden(), slug);
    await setPublic(plantSlugs, podSlugs, beanSlugs);
  } else if (existing.state === "published") {
    const { plantSlugs, podSlugs, beanSlugs } = unpublishCascade(await loadRawGarden(), slug);
    await setPrivate(plantSlugs, podSlugs, beanSlugs);
  }

  revalidatePath("/admin");
  const beanSlug = (existing.parents ?? [])
    .filter((p) => p.startsWith("bean:"))
    .map((p) => p.slice("bean:".length))[0];
  redirect(beanSlug ? `/admin/bean/${beanSlug}` : "/admin/vault");
}

// Hard delete (roadmap A2). The bean parents and published state are captured BEFORE
// the delete — afterwards the version is gone from the dataset, so the slug-keyed
// unpublishCascade would silently no-op. The recompute (only when the deleted version
// WAS published; a draft/private delete cannot change the public projection) runs the
// bean-keyed core against the dataset loaded AFTER the delete, so the deleted version
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
    const { plantSlugs, podSlugs, beanSlugs: flipBeans } = unpublishCascadeForBeans(
      await loadRawGarden(),
      beanSlugs,
    );
    await setPrivate(plantSlugs, podSlugs, flipBeans);
  }

  revalidatePath("/admin");
  redirect(beanSlugs[0] ? `/admin/bean/${beanSlugs[0]}` : "/admin/vault");
}

// Manual pull of every configured feed — same core the cron Action calls.
// Failed feeds surface via ?error= — a transport-construction failure (missing
// token env var) never reaches a cursor doc, so the redirect must carry it.
export async function syncNowAction(): Promise<void> {
  await requireSession();
  const results = await runSync();
  revalidatePath("/admin/beanstalk");
  const failed = results.filter((r) => r.status === "error");
  redirect(
    failed.length > 0
      ? `/admin/beanstalk?error=${encodeURIComponent(failed.map((f) => `${f.feedId}: ${f.error ?? "unknown"}`).join(" · "))}`
      : "/admin/beanstalk",
  );
}
