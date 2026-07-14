"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifyPassword } from "@/lib/session";
import { buildCaptureBody } from "@/lib/capture-form";
import { validateInboxPayload } from "@/lib/inbox";
import { createOrUpdateCapture, getCapture, markCapturePromoted, discardCapture } from "@/lib/captures";
import { loadRawSeed } from "@/lib/store";
import { publishCascade, unpublishCascade, type Domain } from "@/lib/data";
import { resolveParentChoice, buildVersionInput, validateVersionInput } from "@/lib/promote";
import { buildVersionPatch, validateVersionPatch } from "@/lib/version-edit";
import {
  createMolecule,
  createAtom,
  createVersion,
  setPublic,
  SlugExistsError,
  getVersion,
  updateVersion,
  setPrivate,
} from "@/lib/atomic";
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
export async function createCaptureAction(formData: FormData): Promise<void> {
  await requireSession();
  const raw = buildCaptureBody(formData);
  const parsed = validateInboxPayload(raw);
  if (!parsed.ok) {
    redirect(`/admin?error=${encodeURIComponent(parsed.error)}`);
  }
  await createOrUpdateCapture(parsed.value);
  revalidatePath("/admin");
  redirect("/admin");
}

const DOMAINS: Domain[] = ["music", "design", "podcast"];

export async function discardCaptureAction(formData: FormData): Promise<void> {
  await requireSession();
  const captureId = String(formData.get("captureId") ?? "");
  await discardCapture(captureId);
  revalidatePath("/admin");
  redirect("/admin");
}

export async function promoteCaptureAction(formData: FormData): Promise<void> {
  await requireSession();
  const captureId = String(formData.get("captureId") ?? "");
  const capture = await getCapture(captureId);
  if (!capture) redirect("/admin");

  // Validate the version's own fields BEFORE any write, so an invalid version never
  // leaves orphan molecule/atom docs behind.
  const precheck = validateVersionInput(buildVersionInput(formData, capture, null));
  if (!precheck.ok) {
    redirect(`/admin/triage/${captureId}?error=${encodeURIComponent(precheck.error)}`);
  }

  // Resolve parent choices up front (pure) so we can guard invalid combinations
  // BEFORE any write. A newly created molecule is only ever linked from a newly
  // created atom in this flow, so "new molecule + (existing/no) atom" would leave
  // the molecule orphaned — reject it rather than silently drop the intent.
  const molChoice = resolveParentChoice(
    String(formData.get("newMoleculeSlug") ?? ""),
    String(formData.get("moleculeSlug") ?? ""),
  );
  const atomChoice = resolveParentChoice(
    String(formData.get("newAtomSlug") ?? ""),
    String(formData.get("atomSlug") ?? ""),
  );
  if (molChoice.mode === "create" && atomChoice.mode !== "create") {
    redirect(
      `/admin/triage/${captureId}?error=${encodeURIComponent(
        "a new molecule must be paired with a new atom under it",
      )}`,
    );
  }

  // Create parents, then the version. Only slug collisions are recoverable;
  // anything else propagates. redirect() stays OUT of the try (it throws to control flow).
  let slugError: string | null = null;
  try {
    let moleculeSlug: string | null = null;
    if (molChoice.mode === "create") {
      const domainRaw = String(formData.get("newMoleculeDomain") ?? "");
      const domain: Domain = DOMAINS.includes(domainRaw as Domain) ? (domainRaw as Domain) : "music";
      await createMolecule({
        slug: molChoice.slug,
        name: String(formData.get("newMoleculeName") ?? "").trim() || molChoice.slug,
        domain,
        description: "",
      });
      moleculeSlug = molChoice.slug;
    } else if (molChoice.mode === "existing") {
      moleculeSlug = molChoice.slug;
    }

    let atomSlug: string | null = null;
    if (atomChoice.mode === "create") {
      await createAtom({
        slug: atomChoice.slug,
        name: String(formData.get("newAtomName") ?? "").trim() || atomChoice.slug,
        moleculeSlug,
      });
      atomSlug = atomChoice.slug;
    } else if (atomChoice.mode === "existing") {
      atomSlug = atomChoice.slug;
    }

    const input = buildVersionInput(formData, capture, atomSlug);
    await createVersion(input);

    if (input.state === "published") {
      const { moleculeSlugs, atomSlugs } = publishCascade(await loadRawSeed(), input.slug);
      await setPublic(moleculeSlugs, atomSlugs);
    }

    await markCapturePromoted(captureId, input.slug);
  } catch (err) {
    if (err instanceof SlugExistsError) slugError = err.message;
    else throw err;
  }

  if (slugError) {
    redirect(`/admin/triage/${captureId}?error=${encodeURIComponent(slugError)}`);
  }
  revalidatePath("/admin");
  redirect("/admin");
}

export async function editVersionAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");
  const existing = await getVersion(slug);
  if (!existing) redirect("/admin/vault");

  const patch = buildVersionPatch(formData);
  const check = validateVersionPatch(patch);
  if (!check.ok) {
    redirect(`/admin/version/${slug}?error=${encodeURIComponent(check.error)}`);
  }

  await updateVersion(slug, patch);

  // Re-publish reuses the upward, idempotent cascade (same as promote). Any other
  // state runs the downward recompute (A1): re-privatize parents that no longer
  // shelter a published version. Idempotent — a draft save under a still-published
  // sibling flips nothing; an empty shell left by an older un-publish is healed.
  // Both branches load the dataset AFTER updateVersion, so the just-saved state
  // is what the cascade evaluates.
  if (patch.state === "published") {
    const { moleculeSlugs, atomSlugs } = publishCascade(await loadRawSeed(), slug);
    await setPublic(moleculeSlugs, atomSlugs);
  } else {
    const { moleculeSlugs, atomSlugs } = unpublishCascade(await loadRawSeed(), slug);
    await setPrivate(moleculeSlugs, atomSlugs);
  }

  revalidatePath("/admin");
  const atomSlug = existing.parents
    .filter((p) => p.startsWith("atom:"))
    .map((p) => p.slice("atom:".length))[0];
  redirect(atomSlug ? `/admin/atom/${atomSlug}` : "/admin/vault");
}
