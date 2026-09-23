"use server";

/**
 * Several `revalidateGarden()` calls below sit OUTSIDE their action's
 * `if (result.dirty)` guard, so a save that turned out to change nothing
 * still invalidates. That is deliberate, not an oversight: the two mistakes
 * are not symmetric. Invalidating after a no-op write costs one extra Mongo
 * read on the next public request. Failing to invalidate after a real write
 * costs a stale public site until GARDEN_TTL expires. Erring toward the
 * cheap mistake is the whole point of putting the call outside the guard.
 */
import { redirect } from "next/navigation";
import { revalidateGarden } from "@/lib/garden-cache";
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
  parentsWithPrefix,
  type MediaImage,
  type PlantRole,
  type PlantStatus,
  type SproutState,
  type Visibility,
} from "@/lib/data";
import { resolveParentChoice, buildSproutInput, buildNewBean, validateSproutInput } from "@/lib/promote";
import { shouldCascadePublish } from "@/lib/sprout-edit";
import { buildSproutMetaPatch, BlankSproutNameError, type SproutMetaPatch } from "@/lib/sprout-meta";
import { isSproutState } from "@/lib/sprout-state";
import { isTimelineDate } from "@/lib/sprout-date";
import { isSproutType } from "@/lib/sprout-type";
import { buildContentPatch } from "@/lib/content-edit";
import { parseEditLangField, withEditLang } from "@/lib/edit-lang";
import { buildMediaPatch } from "@/lib/media-edit";
import { buildPlantRolePatch, InvalidRoleKindError } from "@/lib/plant-role";
import {
  buildPlantMetaPatch,
  BlankPlantNameError,
  InvalidPlantStatusError,
  type PlantMetaPatch,
} from "@/lib/plant-meta";
import { buildPlantLogoPatch } from "@/lib/plant-logo";
import { isPlantStatus } from "@/lib/plant-status";
import { narrativeHref } from "@/lib/plant-path";
import { isVisibility } from "@/lib/plant-visibility";
import { runSync } from "@/lib/pollen-run";
import {
  createPod,
  createBean,
  createSprout,
  deleteSprout,
  setPublic,
  SlugExistsError,
  getSprout,
  setPrivate,
  updateSproutContent,
  updatePlantContent,
  updatePodContent,
  updateSproutMedia,
  updateSproutMeta,
  updateSproutState,
  updateSproutDate,
  updateSproutType,
  updatePlantRole,
  updatePlantMeta,
  updatePlantLogo,
  updatePlantStatus,
  updatePlantVisibility,
  updateBeanCover,
  updateBeanKeyword,
  updateBeanMeta,
  updateBeanTags,
  updateBeanVisibility,
  createScreen,
  getScreen,
  updateScreenMeta,
  updateScreenImage,
  deleteScreen,
  listScreensForPlant,
  writeExhibition,
} from "@/lib/botanical";
import { buildBeanCoverPatch } from "@/lib/bean-cover-edit";
import { buildBeanKeywordPatch } from "@/lib/bean-keyword";
import { buildBeanMetaPatch, BlankBeanNameError, type BeanMetaPatch } from "@/lib/bean-meta";
import { parseBeanTags } from "@/lib/bean-tags";
import { buildScreenMetaPatch } from "@/lib/screen-edit";
import { buildScreenImagePatch } from "@/lib/screen-image";
import { buildNewScreenInput } from "@/lib/screen-create";
import {
  applyExhibitionOp,
  exhibitionOf,
  exhibitionOpOf,
  exhibitionWrites,
} from "@/lib/exhibition";
import {
  SCREEN_FILTER_KEYS,
  filterFieldName,
  newScreenHref,
  screensHref,
  screensQuery,
} from "@/lib/screens";
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
//
// The three seed actions land on "/admin/inbox", never on "/admin". The two
// meant the same place while "/admin" WAS the inbox; the inbox has an address
// of its own now and "/admin" lists no seeds, so an action still returning
// there would drop the author out of the queue they were working through —
// a regression that passes `tsc`, `npm test` and `npm run build`.
export async function createSeedAction(formData: FormData): Promise<void> {
  await requireSession();
  const raw = buildSeedBody(formData);
  const parsed = validateInboxPayload(raw);
  if (!parsed.ok) {
    // The error flag has to come back to the page that renders the overlay:
    // SeedOverlay reopens onto its banner from `?error=`, and "/admin" does
    // not render the overlay at all.
    redirect(`/admin/inbox?error=${encodeURIComponent(parsed.error)}`);
  }
  await createOrUpdateSeed(parsed.value);
  redirect("/admin/inbox");
}

export async function discardSeedAction(formData: FormData): Promise<void> {
  await requireSession();
  const seedId = String(formData.get("seedId") ?? "");
  await discardSeed(seedId);
  redirect("/admin/inbox");
}

export async function promoteSeedAction(formData: FormData): Promise<void> {
  await requireSession();
  const seedId = String(formData.get("seedId") ?? "");
  const seed = await getSeed(seedId);
  if (!seed) redirect("/admin/inbox");

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

  // Above the slugError redirect, not below: createPod or createBean can
  // each succeed before a LATER SlugExistsError throws (the bean's slug
  // collides right after the pod was created; the sprout's collides right
  // after both parents were), so a garden write can land here with the
  // success path below never reached. revalidateGarden() is idempotent and
  // cheap — the same argument the module docblock above makes for calling it
  // outside the `if (result.dirty)` guards elsewhere in this file — so it
  // runs unconditionally rather than only when nothing went wrong.
  revalidateGarden();

  if (slugError) {
    redirect(`/admin/triage/${seedId}?error=${encodeURIComponent(slugError)}`);
  }
  redirect("/admin/inbox");
}

// Hard delete (roadmap A2). The bean parents and published state are captured BEFORE
// the delete — afterwards the version is gone from the dataset, so the slug-keyed
// unpublishCascade would silently no-op. The recompute (only when the deleted version
// WAS published; a draft/private delete cannot change the public projection) runs the
// bean-keyed core against the dataset loaded AFTER the delete, so the deleted version
// cannot shelter anything.
export async function deleteSproutAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  // Existence first, so the confirm-fail redirect below only ever targets a real
  // edit page (and the slug it interpolates is a known-good stored slug).
  const existing = await getSprout(slug);
  if (!existing) redirect("/admin/sprouts");

  // Server-side re-check of the confirm checkbox; the browser `required` is only UX.
  if (String(formData.get("confirm") ?? "") !== "on") {
    redirect(sproutHref(slug, "could not delete: confirm the permanent deletion first", "delete"));
  }

  const beanSlugs = (existing.parents ?? [])
    .filter((p) => p.startsWith("bean:"))
    .map((p) => p.slice("bean:".length));
  const wasPublished = existing.state === "published";

  await deleteSprout(slug);

  if (wasPublished) {
    const { plantSlugs, podSlugs, beanSlugs: flipBeans } = unpublishCascadeForBeans(
      await loadRawGarden(),
      beanSlugs,
    );
    await setPrivate(plantSlugs, podSlugs, flipBeans);
  }

  revalidateGarden();
  redirect(beanSlugs[0] ? `/admin/bean/${beanSlugs[0]}` : "/admin/sprouts");
}

// Prose only. Deliberately separate from the head's four writes: content
// touches neither `state` nor `visibility`, so there is no cascade to run here.
//
// One HALF of the prose, named by the posted `lang` (lib/edit-lang.ts), and
// every redirect lands back on that half — a French save that returned the
// author to the English editor would read as the French text having vanished.
export async function editContentAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");
  const markdown = String(formData.get("content") ?? "");

  const existing = await getSprout(slug);
  if (!existing) redirect("/admin/sprouts");

  const back = `/admin/sprout/${encodeURIComponent(slug)}`;
  const field = parseEditLangField(formData.get("lang"));
  if (!field.ok) {
    redirect(`${back}?error=${encodeURIComponent(`could not save content: ${field.error}`)}`);
  }

  const result = buildContentPatch(existing, markdown, field.lang);
  if (!result.ok) {
    redirect(
      withEditLang(`${back}?error=${encodeURIComponent(`could not save content: ${result.error}`)}`, field.lang),
    );
  }
  // Dirty-gated (spec §2.5): opening a digest and saving it untouched writes
  // nothing at all, so reading can never normalize what a bee wrote.
  if (result.dirty) await updateSproutContent(slug, result.patch);

  revalidateGarden();
  redirect(withEditLang(back, field.lang));
}

// A sprout's media[] — its own form, its own action, its own narrow writer.
// Separate from BOTH the metadata form and the prose editor, which is what
// keeps each surface's blast radius to its own fields (spec §4.4).
export async function editSproutMediaAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const existing = await getSprout(slug);
  if (!existing) redirect("/admin/sprouts");

  const result = buildMediaPatch(existing, formData);
  // Dirty-gated, same rule as editContentAction: opening a sprout and saving
  // it untouched writes nothing at all.
  if (result.dirty) await updateSproutMedia(slug, result.media);

  revalidateGarden();
  redirect(`/admin/sprout/${encodeURIComponent(slug)}`);
}

/**
 * Where a sprout's four head writes go back to, and where a rejected one puts
 * its message.
 *
 * `form` is the surface the author had open. The sprout head
 * (`sprout-hero.tsx`, the slice this helper was written for) reads it back and
 * reopens onto it, because the field that was rejected is behind a closed
 * overlay or popover and the banner would otherwise have nowhere to live. An unknown value opens nothing and falls through to the
 * page-level alert, which is why nothing here has to trust it.
 */
function sproutHref(slug: string, error?: string, form?: string): string {
  const base = `/admin/sprout/${encodeURIComponent(slug)}`;
  if (!error) return base;
  return `${base}?error=${encodeURIComponent(error)}&form=${encodeURIComponent(form ?? "")}`;
}

/**
 * A sprout's name and description — and nothing else.
 *
 * The overlay behind the page title. Split out of `editVersionAction`, which
 * wrote seven fields from one form: that shape was only safe while every field
 * WAS on one form, and the head puts each of them behind its own surface.
 *
 * `buildSproutMetaPatch` throws on a name blank in both languages rather than
 * falling back, so the only rejection here is the one the author can fix.
 */
export async function editSproutMetaAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  // Existence first, so the redirects below can only ever target a real page
  // and can only interpolate a known-good stored slug.
  const existing = await getSprout(slug);
  if (!existing) redirect("/admin/sprouts");

  // Typed `let` + try/catch, exactly as editPlantMetaAction does it: `redirect`
  // is typed `never`, so TypeScript accepts that `patch` is assigned by the
  // time it is used, and a throw that is NOT the one we expect is re-thrown
  // rather than swallowed into a misleading error message.
  let patch: SproutMetaPatch;
  try {
    patch = buildSproutMetaPatch(formData);
  } catch (err) {
    if (!(err instanceof BlankSproutNameError)) throw err;
    redirect(sproutHref(slug, `could not save: ${err.message}`, "meta"));
  }

  await updateSproutMeta(slug, patch);

  revalidateGarden();
  redirect(sproutHref(slug));
}

/**
 * A sprout's state — and the two cascades around it.
 *
 * This is `editVersionAction`'s publish logic, moved verbatim to the one action
 * that can own it, and it is why state is a write of its own rather than a
 * field on the meta overlay: the transition, not the value, is what decides
 * whether the sprout's bean, pod and plant are flipped public or recomputed
 * private. `existing` is read BEFORE the write so `existing.state` is the
 * pre-save state the transition is measured against.
 *
 * Both cascade branches re-read with `loadRawGarden` AFTER `updateSproutState`,
 * never `loadCachedGarden`: the cascade has to see the just-saved state, and a
 * cached read here publishes the wrong parents — a published sprout whose bean
 * silently stays private, or an unpublish that leaves a parent public.
 *
 * The digest gate (`shouldCascadePublish`) is unchanged: publishing a digest
 * marks review sign-off, not public exhibition, and flipping its curated
 * private containers public stays a separate human act.
 *
 * The posted value is a NAMED MEMBER of a vocabulary, re-validated here rather
 * than trusted — the rule `flipPlantField` states for the plant's two enums. A
 * stale page can then only ever name a value this vocabulary already has.
 */
export async function setSproutStateAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const existing = await getSprout(slug);
  if (!existing) redirect("/admin/sprouts");

  const state = String(formData.get("state") ?? "").trim();
  if (!isSproutState(state)) {
    redirect(sproutHref(slug, `unknown state: ${state || "(blank)"}`, "state"));
  }

  // No `as SproutState`: `isSproutState` is a type predicate and `redirect`
  // returns `never`, so the narrowing is real. A cast here would keep this line
  // compiling if someone later widened that guard's signature to plain
  // `boolean` — the guard would silently stop narrowing and nothing would say
  // so. (`flipPlantField`'s callers DO cast, because it takes its validator as
  // a plain `(raw: string) => boolean` and there is no predicate to inherit.)
  await updateSproutState(slug, state);

  if (state === "published" && shouldCascadePublish(existing.type)) {
    const { plantSlugs, podSlugs, beanSlugs } = publishCascade(await loadRawGarden(), slug);
    await setPublic(plantSlugs, podSlugs, beanSlugs);
  } else if (existing.state === "published") {
    const { plantSlugs, podSlugs, beanSlugs } = unpublishCascade(await loadRawGarden(), slug);
    await setPrivate(plantSlugs, podSlugs, beanSlugs);
  }

  revalidateGarden();
  redirect(sproutHref(slug));
}

/**
 * A sprout's date — and nothing else.
 *
 * `required` on the input is UX; this is the guard. A blank date would sort the
 * sprout to the bottom of every timeline the garden builds and would render as
 * an empty cell on four admin tables, which is a worse outcome than a rejected
 * save.
 *
 * Non-empty is not enough, and `isTimelineDate` is the half nothing in the old
 * whole-form path ever had. `lib/sprout-date.ts` is where that rule and its
 * reasons live; this is only the door that applies it.
 */
export async function setSproutDateAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const existing = await getSprout(slug);
  if (!existing) redirect("/admin/sprouts");

  const date = String(formData.get("date") ?? "").trim();
  if (!date) redirect(sproutHref(slug, "could not save: a sprout needs a date", "date"));
  if (!isTimelineDate(date)) {
    // The shape, not just the verdict: the author cannot fix "invalid" without
    // being told which of the several dates they might have typed is wanted.
    redirect(
      sproutHref(
        slug,
        `could not save: a sprout's date must read YYYY-MM-DD (got "${date}")`,
        "date",
      ),
    );
  }

  await updateSproutDate(slug, date);

  revalidateGarden();
  redirect(sproutHref(slug));
}

/**
 * A sprout's type — and nothing else.
 *
 * `lib/sprout-type.ts` holds the rule and its reasons; this is only the door
 * that applies it, exactly as `setSproutDateAction` is for the date. What that
 * guard is NOT is a vocabulary: nothing in the garden validates a sprout's type
 * against a list, because there isn't one — `lib/sprouts.ts` filters by state,
 * plant and tag and never by type, and the seed-promotion path writes whatever
 * the source carried. If a vocabulary is ever wanted it joins that module and
 * this action validates against it; inventing one here would make the UI the
 * definition.
 *
 * One consequence worth naming rather than hiding: `shouldCascadePublish` is
 * consulted at publish time only, so moving a published sprout off `digest`
 * HERE does not re-cascade — it stays published with its bean and plant still
 * private, and the author's next act on the state control is what settles it.
 * `setSproutStateAction` reads `existing.type`, so the gap lives between two
 * actions rather than inside one, which is at least a gap that can be seen.
 *
 * It is a NEW gap, not an inherited one, and saying so is the honest version:
 * the whole-form path this replaced evaluated the digest exemption against the
 * type being SAVED, so one submit that changed the type and published at once
 * cascaded on the new value. Splitting the fields is what split that.
 */
export async function setSproutTypeAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const existing = await getSprout(slug);
  if (!existing) redirect("/admin/sprouts");

  const type = String(formData.get("type") ?? "").trim();
  if (!isSproutType(type)) {
    redirect(sproutHref(slug, "could not save: a sprout needs a type", "type"));
  }

  await updateSproutType(slug, type);

  revalidateGarden();
  redirect(sproutHref(slug));
}

// Plant and pod narrative. One action for both tiers: the ref carries the tier,
// and the two collections differ only in which writer runs.
//
// The redirect goes to WHEREVER THAT REF'S EDITOR ACTUALLY IS, which is no
// longer the same page for both tiers: a pod's narrative is still edited on the
// pod's own page, while a plant's has a page of its own
// (`narrativeHref`, app/admin/(chrome)/plant/[slug]/narrative). Sending a plant
// back to the hub would land the author on a page where the thing they just
// saved is two clamped lines and the caret is gone. The error redirect goes to
// the same place for the stronger version of the reason — the banner has to
// appear where the editor is, or it describes an edit on a page the author has
// already left.
//
// Both branches interpolate a STORED slug through the one builder that spells
// the plant address (lib/plant-path.ts), after the existence check below: the
// ref arrives from a form, and a redirect target is not a thing to take on
// trust from a payload.
//
// One half of the prose, named by the posted `lang`, and every redirect lands
// back on that half — see editContentAction.
export async function editContainerContentAction(formData: FormData): Promise<void> {
  await requireSession();
  const ref = String(formData.get("ref") ?? "");
  const markdown = String(formData.get("content") ?? "");

  const isPlant = ref.startsWith(PLANT_PREFIX);
  const isPod = ref.startsWith(POD_PREFIX);
  if (!isPlant && !isPod) redirect("/admin");

  const slug = ref.slice(ref.indexOf(":") + 1);
  const raw = await loadRawGarden();
  const existing = isPlant
    ? raw.plants?.find((p) => p.slug === slug)
    : raw.pods?.find((p) => p.slug === slug);
  if (!existing) redirect("/admin");

  const back = isPlant ? narrativeHref(slug) : `/admin/pod/${encodeURIComponent(slug)}`;
  const field = parseEditLangField(formData.get("lang"));
  if (!field.ok) {
    redirect(`${back}?error=${encodeURIComponent(`could not save content: ${field.error}`)}`);
  }

  const result = buildContentPatch(existing, markdown, field.lang);
  if (!result.ok) {
    redirect(
      withEditLang(`${back}?error=${encodeURIComponent(`could not save content: ${result.error}`)}`, field.lang),
    );
  }
  if (result.dirty) {
    if (isPlant) await updatePlantContent(slug, result.patch);
    else await updatePodContent(slug, result.patch);
  }

  revalidateGarden();
  redirect(withEditLang(back, field.lang));
}

/**
 * The plant's role — and nothing else.
 *
 * A separate form and a separate action from the narrative one, which is what
 * keeps each write narrow: this one can only ever reach `role`, and
 * editContainerContentAction can only ever reach `content`. (They no longer
 * share a page either — the narrative editor moved to
 * `plant/[slug]/narrative` — but the separation was never about the page.)
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
  if (!existing) redirect("/admin");

  const back = `/admin/plant/${encodeURIComponent(slug)}`;
  let role: PlantRole;
  try {
    role = buildPlantRolePatch(formData);
  } catch (err) {
    if (!(err instanceof InvalidRoleKindError)) throw err;
    redirect(
      `${back}?form=role&error=${encodeURIComponent(`could not save role: ${err.message}`)}`,
    );
  }

  await updatePlantRole(slug, role);

  revalidateGarden();
  redirect(back);
}

/**
 * The plant's name, description and status — and nothing else.
 *
 * A third narrow write on the plant, beside the role and the narrative.
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
  if (!existing) redirect("/admin");

  const back = `/admin/plant/${encodeURIComponent(slug)}`;
  let patch: PlantMetaPatch;
  try {
    patch = buildPlantMetaPatch(formData);
  } catch (err) {
    if (!(err instanceof BlankPlantNameError) && !(err instanceof InvalidPlantStatusError)) throw err;
    redirect(`${back}?form=meta&error=${encodeURIComponent(`could not save: ${err.message}`)}`);
  }

  await updatePlantMeta(slug, patch);

  revalidateGarden();
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
  if (!existing) redirect("/admin");

  const result = buildPlantLogoPatch(existing, formData);
  if (result.dirty) await updatePlantLogo(slug, result.logo);

  revalidateGarden();
  redirect(`/admin/plant/${encodeURIComponent(slug)}`);
}

/**
 * The plant page's two enum writes: the zap (status) and the globe/lock
 * (visibility).
 *
 * One helper, two exports. Both are the same shape and the shape is the point:
 * the form posts the value it WANTS rather than "flip it", so a page rendered
 * before somebody else changed the field cannot flip it into a third state, and
 * the action validates a named member of a vocabulary instead of trusting the
 * client's arithmetic. An unrecognized value redirects with an error rather
 * than defaulting, the stance editPlantRoleAction takes: both fields are public
 * claims (one shows on the landing gallery, the other decides whether the plant
 * is on it at all).
 *
 * NEITHER SURVIVES WITHOUT SCRIPT, and neither is one click. `EnumForm` in
 * app/admin/_components/plant-hero.tsx renders the vocabulary as native radios
 * plus a Save button disabled until the pick differs from what is stored, and
 * it lives inside a client-only popover. That is deliberate:
 * a one-click flip means a stray click on the globe unpublishes a project and
 * the undo is another stray click on the same pixel.
 */
async function flipPlantField(
  formData: FormData,
  field: "status" | "visibility",
  write: (slug: string, value: string) => Promise<void>,
  valid: (raw: string) => boolean,
): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  // Existence first, so the error redirect below can only ever target a real
  // page and can only interpolate a known-good stored slug.
  const raw = await loadRawGarden();
  const existing = raw.plants?.find((p) => p.slug === slug);
  if (!existing) redirect("/admin");

  const back = `/admin/plant/${encodeURIComponent(slug)}`;
  const value = String(formData.get(field) ?? "").trim();
  if (!valid(value)) {
    redirect(`${back}?error=${encodeURIComponent(`unknown ${field}: ${value || "(blank)"}`)}`);
  }

  await write(slug, value);

  revalidateGarden();
  redirect(back);
}

export async function setPlantStatusAction(formData: FormData): Promise<void> {
  return flipPlantField(
    formData,
    "status",
    (slug, value) => updatePlantStatus(slug, value as PlantStatus),
    isPlantStatus,
  );
}

export async function setPlantVisibilityAction(formData: FormData): Promise<void> {
  return flipPlantField(
    formData,
    "visibility",
    (slug, value) => updatePlantVisibility(slug, value as Visibility),
    isVisibility,
  );
}

/**
 * The bean's cover — and nothing else.
 *
 * `/admin/bean/[id]` was read-only until this slice, so this is the first bean
 * EDIT in the admin — beans were already CREATED here, by the triage promotion
 * path above, but never changed afterwards. It is editPlantLogoAction's shape
 * exactly: the form is nothing BUT the picker, so the picker renders the submit
 * button (`submitLabel`) and script-off there is no button at all — the card is
 * inert rather than destructive. buildBeanCoverPatch enforces the same thing
 * server-side for a POST that never rendered one.
 */
export async function editBeanCoverAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const raw = await loadRawGarden();
  const existing = raw.beans?.find((b) => b.slug === slug);
  if (!existing) redirect("/admin/sprouts");
  // Projected beans are source-owned and read-only: the page renders no trigger
  // and drops the rail's Cover panel under the same condition, and
  // lib/pollen-store.ts's deleteFeedData ($deleteMany on projected.feedId) would
  // take an authored cover, keyword or tag list with the document on a full
  // rebuild. The rendered gate is not a server-side guarantee — the same reason
  // buildBeanCoverPatch checks `cover__ready` — so it is re-checked here.
  if (existing.projected) redirect(`/admin/bean/${encodeURIComponent(slug)}`);

  const result = buildBeanCoverPatch(existing, formData);
  if (result.dirty) await updateBeanCover(slug, result.cover);

  revalidateGarden();
  redirect(`/admin/bean/${encodeURIComponent(slug)}`);
}

/**
 * The bean's keyword — and nothing else.
 *
 * A separate form from the Cover card above, and separate on purpose. One form
 * holding the picker AND a text input renders no button script-off (the button
 * is inside the island) but DOES render the input — and a form with one text
 * input and no button permits implicit submission on Enter. The author would
 * type a keyword, press Return, and post a payload carrying no `cover__ready`
 * and no media: nothing destroyed, but the keyword silently lost, with no sign
 * on the page. Two forms make that impossible instead of survivable.
 */
export async function editBeanKeywordAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const raw = await loadRawGarden();
  const existing = raw.beans?.find((b) => b.slug === slug);
  if (!existing) redirect("/admin/sprouts");
  // Projected beans are source-owned and read-only: the page renders no trigger
  // and drops the rail's Cover panel under the same condition, and
  // lib/pollen-store.ts's deleteFeedData ($deleteMany on projected.feedId) would
  // take an authored cover, keyword or tag list with the document on a full
  // rebuild. The rendered gate is not a server-side guarantee — the same reason
  // buildBeanCoverPatch checks `cover__ready` — so it is re-checked here.
  if (existing.projected) redirect(`/admin/bean/${encodeURIComponent(slug)}`);

  await updateBeanKeyword(slug, buildBeanKeywordPatch(formData));

  revalidateGarden();
  redirect(`/admin/bean/${encodeURIComponent(slug)}`);
}

/**
 * The bean's name and description — and nothing else.
 *
 * `editPlantMetaAction`'s shape exactly, minus the status it has to carry.
 * Existence is checked FIRST so the error redirect below can only ever target a
 * real page and can only interpolate a known-good stored slug.
 */
export async function editBeanMetaAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const raw = await loadRawGarden();
  const existing = raw.beans?.find((b) => b.slug === slug);
  if (!existing) redirect("/admin/sprouts");

  const back = `/admin/bean/${encodeURIComponent(slug)}`;
  // A projected bean is source-owned and read-only. The page renders no trigger
  // for it, but a rendered gate is not a server-side guarantee — the same reason
  // editBeanCoverAction re-checks, and the same reason buildBeanCoverPatch checks
  // `cover__ready`.
  if (existing.projected) redirect(back);

  let patch: BeanMetaPatch;
  try {
    patch = buildBeanMetaPatch(formData);
  } catch (err) {
    if (!(err instanceof BlankBeanNameError)) throw err;
    redirect(`${back}?form=meta&error=${encodeURIComponent(`could not save: ${err.message}`)}`);
  }

  await updateBeanMeta(slug, patch);

  revalidateGarden();
  redirect(back);
}

/**
 * The bean's visibility — and nothing else.
 *
 * A named member of a vocabulary, RE-VALIDATED here rather than trusted, which
 * is what makes a stale page harmless: it can only ever post a value
 * `lib/plant-visibility.ts` already has. The head draws the members as radios
 * behind a Save, so nothing flips on the click that opens it.
 *
 * Not routed through `flipPlantField` above: that helper redirects to
 * `/admin/plant/...` and looks the slug up in `raw.plants`. A bean is a different
 * collection and a different address, and a helper generic over both would need
 * four parameters to say so.
 */
export async function setBeanVisibilityAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const raw = await loadRawGarden();
  const existing = raw.beans?.find((b) => b.slug === slug);
  if (!existing) redirect("/admin/sprouts");

  const back = `/admin/bean/${encodeURIComponent(slug)}`;
  if (existing.projected) redirect(back);

  const value = String(formData.get("visibility") ?? "").trim();
  if (!isVisibility(value)) {
    redirect(
      `${back}?form=visibility&error=${encodeURIComponent(
        `unknown visibility: ${value || "(blank)"}`,
      )}`,
    );
  }

  await updateBeanVisibility(slug, value);

  revalidateGarden();
  redirect(back);
}

/**
 * The bean's tags — and nothing else.
 *
 * The comma field is parsed by `lib/bean-tags.ts` rather than here: the trim is
 * load-bearing (the garden's tag filters compare with `===` and do not trim, so a
 * stored " ariko" matches nothing while drawing identically) and a rule told in
 * two files is two files that drift.
 *
 * An empty field is a CLEAR, not a rejection. A bean with no tags is an ordinary
 * bean, which is why nothing here throws and there is no error redirect.
 */
export async function editBeanTagsAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const raw = await loadRawGarden();
  const existing = raw.beans?.find((b) => b.slug === slug);
  if (!existing) redirect("/admin/sprouts");

  const back = `/admin/bean/${encodeURIComponent(slug)}`;
  if (existing.projected) redirect(back);

  await updateBeanTags(slug, parseBeanTags(String(formData.get("tags") ?? "")));

  revalidateGarden();
  redirect(back);
}

// Manual pull of every configured feed — same core the cron Action calls.
// Failed feeds surface via ?error= — a transport-construction failure (missing
// token env var) never reaches a cursor doc, so the redirect must carry it.
export async function syncNowAction(): Promise<void> {
  await requireSession();
  const results = await runSync();
  revalidateGarden();
  const failed = results.filter((r) => r.status === "error");
  redirect(
    failed.length > 0
      ? `/admin/beanstalk?error=${encodeURIComponent(failed.map((f) => `${f.feedId}: ${f.error ?? "unknown"}`).join(" · "))}`
      : "/admin/beanstalk",
  );
}

/**
 * The library's write paths.
 *
 * All four share one arrangement worth naming once. Each form carries the
 * index's active filters in three hidden fields and each action redirects back
 * through them, so a save does not drop the author out of the filtered set they
 * were working through — they are walking a hundred and seventy screens with
 * prev/next, and losing the filter on the first save would send them back to
 * the top of the whole collection.
 *
 * Those fields are client-controlled, so they are re-canonicalized by
 * `screensQuery` rather than concatenated: whatever arrives, only `plant`,
 * `bean` and `tag` survive, and `lib/screens.ts` is the only thing that builds
 * the URL — `screensHref` for the index and a screen, `newScreenHref` for the
 * create page. A hidden field reaching `redirect()` intact would be an open
 * redirect; one that can only ever produce three known keys on a known path is
 * not.
 *
 * The field names are DERIVED, from `SCREEN_FILTER_KEYS` through
 * `filterFieldName`, and so are the ones `filter-fields.tsx` renders. Spelled
 * out on both sides — which they were — a fourth dimension would type-check,
 * build, and silently drop out of every save's round trip.
 *
 * Not exported and not async: only the EXPORTS of a "use server" module have to
 * be async, and there is nothing to await here.
 */
function activeFilterQuery(formData: FormData): string {
  return screensQuery(
    Object.fromEntries(
      SCREEN_FILTER_KEYS.map((key) => [key, String(formData.get(filterFieldName(key)) ?? "")]),
    ),
  );
}

export async function createScreenAction(formData: FormData): Promise<void> {
  await requireSession();
  const query = activeFilterQuery(formData);

  const result = buildNewScreenInput(formData);
  if (!result.ok) redirect(newScreenHref(query, result.error));

  // Only slug collisions are recoverable; anything else propagates. redirect()
  // stays OUT of the try (it throws to control flow), so the taken slug leaves
  // on a flag — promoteSeedAction's arrangement.
  let taken = false;
  try {
    await createScreen({
      ...result.input,
      // Not in the pure builder: it is a clock, and the builder is tested
      // without one. The list sorts on this, so a new screen lands at the top
      // of the library rather than at the bottom under an empty date — from the
      // day after an import, at least: scripts/import-paulopus-screens.ts stamps its
      // whole run with the same date, so a screen added by hand on an import
      // day ties with the batch and falls through to the slug tie-break.
      capturedAt: new Date().toISOString().slice(0, 10),
    });
  } catch (err) {
    if (!(err instanceof SlugExistsError)) throw err;
    taken = true;
  }
  if (taken) redirect(newScreenHref(query, `that slug is taken: ${result.input.slug}`));

  revalidateGarden();
  redirect(screensHref(result.input.slug, query));
}

export async function editScreenMetaAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");
  const query = activeFilterQuery(formData);

  // Existence first, so every redirect below targets a real page and only ever
  // interpolates a known-good stored slug.
  const existing = await getScreen(slug);
  if (!existing) redirect(screensHref(null, query));

  const result = buildScreenMetaPatch(existing, formData);
  if (!result.ok) redirect(screensHref(slug, query, result.error));
  if (result.dirty) await updateScreenMeta(slug, result.patch);

  revalidateGarden();
  redirect(screensHref(slug, query));
}

/**
 * The screen's image — the one client-island write in this slice. Its form is
 * nothing BUT the picker, so the picker renders the submit button and
 * script-off there is no button at all: inert rather than destructive, which is
 * the rule CLAUDE.md states. buildScreenImagePatch enforces the same thing
 * server-side for a POST that never rendered one.
 */
export async function editScreenImageAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");
  const query = activeFilterQuery(formData);

  const existing = await getScreen(slug);
  if (!existing) redirect(screensHref(null, query));

  const result = buildScreenImagePatch(existing, formData);
  if (result.dirty) await updateScreenImage(slug, result.image);

  revalidateGarden();
  redirect(screensHref(slug, query));
}

/**
 * Hard delete, behind a confirm checkbox re-checked here — `deleteSproutAction`'s
 * shape, because the browser's `required` is only UX and this is the one
 * irreversible act in the library.
 */
export async function deleteScreenAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");
  const query = activeFilterQuery(formData);

  const existing = await getScreen(slug);
  if (!existing) redirect(screensHref(null, query));

  if (String(formData.get("confirm") ?? "") !== "on") {
    redirect(screensHref(slug, query, "could not delete: confirm the permanent deletion first"));
  }

  await deleteScreen(slug);

  revalidateGarden();
  redirect(screensHref(null, query));
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

/**
 * What a press against the exhibition resolves to, once `applyExhibition` has
 * tried it. Three cases rather than the `string | null` this replaces,
 * because the two callers below redirect differently depending on which one
 * they got, and collapsing them made one caller redirect a deleted screen
 * back to its own now-dead page (see `toggleScreenExhibitAction`'s history):
 *
 * - `gone`: the screen no longer exists — deleted, in another tab or another
 *   request, between the page rendering and this press. There is no screen
 *   page left to land on.
 * - `refused`: the screen is real, but the op was not a member of the
 *   vocabulary, or the screen has no plant parent to join an exhibition on.
 *   The screen's own page can say why nothing happened.
 * - `settled`: the write ran, or was correctly a no-op (`up` at the head,
 *   `add` on a screen already exhibited — `applyExhibitionOp`'s null already
 *   makes those free), against a real plant. Both read identically from here:
 *   whatever the strip's state is now is what the plant page should show.
 */
type ExhibitionOutcome =
  | { kind: "gone" }
  | { kind: "refused" }
  | { kind: "settled"; plantSlug: string };

/**
 * The exhibition's one write, behind two doors.
 *
 * The PLANT IS DERIVED from the screen's own `parents[]` rather than taken from
 * a form field, and that is a guard rather than a tidiness: the ordering panel
 * redirects to `/admin/plant/<slug>`, and a plant slug that arrived in a hidden
 * input and reached `redirect()` would be an open redirect. Derived, it can
 * only ever be a value already in the database — the stance `screensHref` takes
 * for the library's filters.
 *
 * `op` is re-validated against the vocabulary rather than trusted, so a stale
 * page can only name one of the four.
 *
 * Not exported and not async-for-nothing: only the EXPORTS of a "use server"
 * module must be async, and this one genuinely awaits.
 */
async function applyExhibition(slug: string, rawOp: string): Promise<ExhibitionOutcome> {
  const op = exhibitionOpOf(rawOp);
  if (!op) return { kind: "refused" };

  const screen = await getScreen(slug);
  if (!screen) return { kind: "gone" };

  const plantSlug = parentsWithPrefix(screen.parents, PLANT_PREFIX)[0];
  if (!plantSlug) return { kind: "refused" };

  // `exhibitionOf`, never a hand-rolled filter-and-sort. It is the one place
  // that narrows a plant's screens to the strip, and the narrowing is not
  // optional: `exhibitionWrites`' withdraw half re-privatizes, so handing it
  // this plant's WHOLE screen list would make every unexhibited screen private
  // on one press of an arrow.
  const current = exhibitionOf(await listScreensForPlant(plantSlug));

  const after = applyExhibitionOp(
    current.map((s) => s.slug),
    slug,
    op,
  );
  if (!after) return { kind: "settled", plantSlug };

  await writeExhibition(exhibitionWrites(current, after));
  return { kind: "settled", plantSlug };
}

/**
 * Membership, from the screen's own page in the library — the half that works
 * without script. `gone` redirects to the INDEX, `screensHref(null, query)` —
 * `editScreenMetaAction`'s, `editScreenImageAction`'s and `deleteScreenAction`'s
 * shape, all three of which redirect there rather than to the screen's own
 * page when `getScreen` comes back empty, precisely so a redirect never
 * targets a page that is no longer there. Everything else lands back on the
 * screen's own page, through the author's filters, exactly as those three do.
 *
 * NEITHER exhibition action carries an `error` message, and the four write
 * paths above them all do. That asymmetry is a decision rather than an
 * omission, and it turns on WHOSE mistake each refusal is. `createScreenAction`
 * refuses a taken slug, `editScreenMetaAction` a nameless screen,
 * `deleteScreenAction` an unticked confirm — every one of those is something
 * the author did, on a page that is telling the truth, and that they can fix by
 * doing it differently. There is a message because there is a correction.
 *
 * An exhibition op has no such case. `refused` covers an unknown op or a
 * screen with no plant — and `applyExhibitionOp` returns null for `up` at the
 * head or `add` for something already exhibited, which `settled` treats as
 * ordinary success. The refusals are a crafted POST or a page whose world
 * changed underneath it; the two no-ops are a button the panel renders
 * `disabled`. In none of them did the author get anything wrong, and in none
 * of them is there anything to do differently. "Could not move it up" on a
 * screen that is already first is noise dressed as an error.
 *
 * What the author gets instead is the page, re-rendered from the database.
 * `gone` sends them to the index rather than a 404; one that lost its plant
 * shows the card's no-plant sentence; a strip that did not move shows the
 * order it actually has. The state is the message.
 *
 * One outcome this does not enumerate on purpose: the screen's plant parent
 * can itself change between the page rendering and the form submitting —
 * edited in Details, in another tab, in the seconds between. No hidden
 * `plant` field checks that against what the page showed; `slug` is the only
 * identity carried across the submit, and `applyExhibition` re-reads the
 * screen fresh and derives `plantSlug` from whatever parent it has NOW. That
 * is not a bug to close: the write lands on the screen the author meant (the
 * slug is unambiguous) and joins whichever strip that screen currently
 * belongs to, which may not be the one the stale page displayed — a rare race
 * whose outcome is a successful write in a different strip than expected, not
 * a wrong or silent one. And it stays honest afterward: the redirect goes to
 * the plant the write actually touched, never the one the page happened to
 * render, so the page the author lands on tells the truth about where the
 * screen went even when it is not the page they expected.
 */
export async function toggleScreenExhibitAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");
  const query = activeFilterQuery(formData);

  const outcome = await applyExhibition(slug, String(formData.get("op") ?? ""));

  revalidateGarden();
  redirect(outcome.kind === "gone" ? screensHref(null, query) : screensHref(slug, query));
}

/**
 * Ordering, from the plant's rail panel. Same core; the only difference is
 * where each outcome comes back to — and unlike `toggleScreenExhibitAction`,
 * that is three destinations, not two, because there is no filter query here
 * to fall back into.
 *
 * `gone`: the screen itself no longer exists, so its own page is a 404 and the
 * index is the only destination left that is honestly there —
 * `screensHref(null, "")`.
 *
 * `refused`: the screen is real, but the op was never valid or it has no
 * plant to join. There is no plant page to land on, so the screen's own page
 * is the next most honest destination: it is the row the author pressed, and
 * its Exhibition card says why (the no-plant sentence, or simply an unmoved
 * strip for a stale op) — `screensHref(slug, "")`.
 *
 * `settled`: the plant page, as before, with `encodeURIComponent` on the
 * redirect — a screen's slug came from a filename and a plant's is
 * hand-authored, but neither is a reason to be the one place in the slice
 * that trusts one. (It used to guard a revalidated path too; the garden
 * cache slice replaced that with one `revalidateGarden()` above.)
 */
export async function reorderExhibitionAction(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug") ?? "");

  const outcome = await applyExhibition(slug, String(formData.get("op") ?? ""));

  revalidateGarden();
  if (outcome.kind === "gone") redirect(screensHref(null, ""));
  if (outcome.kind === "refused") redirect(screensHref(slug, ""));
  redirect(`/admin/plant/${encodeURIComponent(outcome.plantSlug)}`);
}
