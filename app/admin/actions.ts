"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifyPassword } from "@/lib/session";
import { buildSeedBody } from "@/lib/seed-form";
import { validateInboxPayload } from "@/lib/inbox";
import { createOrUpdateSeed, getSeed, markSeedPromoted, discardSeed } from "@/lib/seeds";
import { loadRawGarden } from "@/lib/store";
import {
  publishCascade,
  unpublishCascade,
  unpublishCascadeForBeans,
  PLANT_PREFIX,
  POD_PREFIX,
  type MediaImage,
  type PlantRole,
} from "@/lib/data";
import { resolveParentChoice, buildSproutInput, buildNewBean, validateSproutInput } from "@/lib/promote";
import { buildSproutPatch, validateSproutPatch, shouldCascadePublish } from "@/lib/sprout-edit";
import { buildContentPatch } from "@/lib/content-edit";
import { buildMediaPatch } from "@/lib/media-edit";
import { buildPlantRolePatch, InvalidRoleKindError } from "@/lib/plant-role";
import {
  buildPlantMetaPatch,
  BlankPlantNameError,
  InvalidPlantStatusError,
  type PlantMetaPatch,
} from "@/lib/plant-meta";
import { buildPlantLogoPatch } from "@/lib/plant-logo";
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
  updateSproutContent,
  updatePlantContent,
  updatePodContent,
  updateSproutMedia,
  updatePlantRole,
  updatePlantMeta,
  updatePlantLogo,
} from "@/lib/botanical";
import { uploadImage } from "@/lib/storage";
import { checkUploadFile, uploadedFilename } from "@/lib/upload-input";
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
        ...buildNewBean(formData, beanChoice.slug),
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

// Prose only. Deliberately separate from editVersionAction: content touches
// neither `state` nor `visibility`, so there is no cascade to run here, and
// keeping it apart is what lets the metadata form stay a zero-JS server-action
// form (spec §2.2).
export async function editContentAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");
  const markdown = String(formData.get("content") ?? "");

  const existing = await getSprout(slug);
  if (!existing) redirect("/admin/vault");

  const result = buildContentPatch(existing, markdown);
  if (!result.ok) {
    redirect(
      `/admin/sprout/${encodeURIComponent(slug)}?error=${encodeURIComponent(
        `could not save content: ${result.error}`,
      )}`,
    );
  }
  // Dirty-gated (spec §2.5): opening a digest and saving it untouched writes
  // nothing at all, so reading can never normalize what a bee wrote.
  if (result.dirty) await updateSproutContent(slug, result.patch);

  revalidatePath("/admin");
  redirect(`/admin/sprout/${encodeURIComponent(slug)}`);
}

// A sprout's media[] — its own form, its own action, its own narrow writer.
// Separate from BOTH the metadata form and the prose editor, which is what
// keeps each surface's blast radius to its own fields (spec §4.4).
export async function editSproutMediaAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const existing = await getSprout(slug);
  if (!existing) redirect("/admin/vault");

  const result = buildMediaPatch(existing, formData);
  // Dirty-gated, same rule as editContentAction: opening a sprout and saving
  // it untouched writes nothing at all.
  if (result.dirty) await updateSproutMedia(slug, result.media);

  revalidatePath("/admin");
  redirect(`/admin/sprout/${encodeURIComponent(slug)}`);
}

// Plant and pod narrative. One action for both tiers: the ref carries the tier,
// and the two collections differ only in which writer runs.
export async function editContainerContentAction(formData: FormData): Promise<void> {
  await requireSession();
  const ref = String(formData.get("ref") ?? "");
  const markdown = String(formData.get("content") ?? "");

  const isPlant = ref.startsWith(PLANT_PREFIX);
  const isPod = ref.startsWith(POD_PREFIX);
  if (!isPlant && !isPod) redirect("/admin/garden");

  const slug = ref.slice(ref.indexOf(":") + 1);
  const raw = await loadRawGarden();
  const existing = isPlant
    ? raw.plants?.find((p) => p.slug === slug)
    : raw.pods?.find((p) => p.slug === slug);
  if (!existing) redirect("/admin/garden");

  const back = `/admin/${isPlant ? "plant" : "pod"}/${encodeURIComponent(slug)}`;
  const result = buildContentPatch(existing, markdown);
  if (!result.ok) {
    redirect(`${back}?error=${encodeURIComponent(`could not save content: ${result.error}`)}`);
  }
  if (result.dirty) {
    if (isPlant) await updatePlantContent(slug, result.patch);
    else await updatePodContent(slug, result.patch);
  }

  revalidatePath("/admin");
  redirect(back);
}

/**
 * The plant's role — and nothing else.
 *
 * A separate form and a separate action from the narrative one on the same
 * page, which is what keeps each write narrow: this one can only ever reach
 * `role`, and editContainerContentAction can only ever reach `content`.
 *
 * An unknown `kind` redirects with an error instead of defaulting. A role is a
 * public claim about Alexis's relationship to someone else's project, so a
 * garbled submit must not quietly become "owner".
 */
export async function editPlantRoleAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  // Existence first, so the error redirect below can only ever target a real
  // page and can only interpolate a known-good stored slug.
  const raw = await loadRawGarden();
  const existing = raw.plants?.find((p) => p.slug === slug);
  if (!existing) redirect("/admin/garden");

  const back = `/admin/plant/${encodeURIComponent(slug)}`;
  let role: PlantRole;
  try {
    role = buildPlantRolePatch(formData);
  } catch (err) {
    if (!(err instanceof InvalidRoleKindError)) throw err;
    redirect(`${back}?error=${encodeURIComponent(`could not save role: ${err.message}`)}`);
  }

  await updatePlantRole(slug, role);

  revalidatePath("/admin");
  // The role renders on the landing gallery and the plant page, both
  // force-dynamic — nothing to revalidate there, they re-read on next request.
  redirect(back);
}

/**
 * The plant's name, description and status — and nothing else.
 *
 * A third narrow write on the plant page, beside the role and the narrative.
 * Zero-client-JS, so this is reachable from a browser with script disabled and
 * must behave correctly there.
 *
 * Both builder failures redirect with an error rather than defaulting, the
 * stance editPlantRoleAction takes: a nameless plant and a mis-stated status
 * are public claims the site would otherwise render as though authored.
 */
export async function editPlantMetaAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  // Existence first, so the error redirect below can only ever target a real
  // page and can only interpolate a known-good stored slug.
  const raw = await loadRawGarden();
  const existing = raw.plants?.find((p) => p.slug === slug);
  if (!existing) redirect("/admin/garden");

  const back = `/admin/plant/${encodeURIComponent(slug)}`;
  let patch: PlantMetaPatch;
  try {
    patch = buildPlantMetaPatch(formData);
  } catch (err) {
    if (!(err instanceof BlankPlantNameError) && !(err instanceof InvalidPlantStatusError)) throw err;
    redirect(`${back}?error=${encodeURIComponent(`could not save: ${err.message}`)}`);
  }

  await updatePlantMeta(slug, patch);

  revalidatePath("/admin");
  // /admin/garden tabulates name and status, so it is stale after this write
  // in a way /admin/plant/[slug] (force-dynamic) is not. The public landing and
  // plant page are force-dynamic too — they re-read on the next request.
  revalidatePath("/admin/garden");
  redirect(back);
}

/**
 * The plant's logo — and nothing else.
 *
 * The one client-island write on this page. Its form is nothing BUT the picker,
 * so the picker renders the submit button (`submitLabel`) and script-off there
 * is no button at all — the card is inert rather than destructive, which is the
 * rule CLAUDE.md states. buildPlantLogoPatch enforces the same thing server-side
 * for a POST that never rendered a button.
 */
export async function editPlantLogoAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const raw = await loadRawGarden();
  const existing = raw.plants?.find((p) => p.slug === slug);
  if (!existing) redirect("/admin/garden");

  const result = buildPlantLogoPatch(existing, formData);
  if (result.dirty) await updatePlantLogo(slug, result.logo);

  revalidatePath("/admin");
  revalidatePath("/admin/garden");
  redirect(`/admin/plant/${encodeURIComponent(slug)}`);
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

export type UploadResult = { ok: true; media: MediaImage } | { ok: false; error: string };

/**
 * The admin's upload door (spec §4.1). Called DIRECTLY by a client component
 * (components/admin/media-picker.tsx), not through a `<form action>`, so it
 * RETURNS a result rather than redirecting.
 *
 * It never throws to the client: a Cloudinary failure becomes { ok: false },
 * because a failed upload must not take the capture down with it. That is the
 * same stance app/api/upload/route.ts states as "upload failure never costs a
 * seed" — honoured here by construction, since the island uploads first and
 * captures second.
 *
 * /api/upload is deliberately NOT reused: its guarantee is "bearer or nothing",
 * and a browser cannot hold that token.
 */
export async function uploadImageAction(formData: FormData): Promise<UploadResult> {
  await requireSession();

  const file = formData.get("file");
  if (!(file instanceof Blob)) return { ok: false, error: "no file was sent" };

  const check = checkUploadFile({ size: file.size, type: file.type });
  if (!check.ok) return { ok: false, error: check.error };

  const filename = uploadedFilename(file);
  try {
    const media = await uploadImage(Buffer.from(await file.arrayBuffer()), filename);
    return { ok: true, media };
  } catch (err) {
    // Never throws to the client — but an unexpected failure must not vanish
    // either. Without this, a real bug is indistinguishable from an ordinary
    // upload failure and leaves no server-side trace.
    console.error("[upload] uploadImageAction failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "upload failed" };
  }
}
