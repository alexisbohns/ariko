---
Title: Digest — Les quatre surfaces de Pebbles (web, iOS, Android, admin)
Source: `/Users/alexis/code/pbbls` (LECTURE SEULE — aucune écriture, aucun commit)
Date de collecte: 2026-09-02 (état du repo à cette date)
Nature: digest factuel. Aucune prose publiable. Chaque affirmation porte sa source.
---

# Les quatre surfaces — état courant

## Tableau de bord

| Surface | Née | Stack | Comment ça expédie | État courant |
|---|---|---|---|---|
| **web** (`apps/web`, `@pbbls/web`) | Prototype local-first web dès le **2026-03-26** (1er événement du journal Arkaik) ; clôture du prototype navigateur le **2026-04-09** (`release.tagged` `web-prototype`) ; monorepo + Supabase le **2026-04-10/11** (`platform-foundation`, 2026-04-11T22:26) | Next.js **16.2.0** App Router, React 19.2.4, Tailwind 4, shadcn/ui (style `base-nova`), Framer Motion 12, Serwist 9.5.7 (PWA/service worker), next-themes, Rive `@rive-app/react-canvas` (`apps/web/CLAUDE.md`) | **Vercel**, intégration git, Root Directory = `apps/web` (`README.md` §Deployment ; `apps/web/vercel.json` est vide, juste le `$schema`). **Aucun workflow GitHub Actions pour le web** (`.github/workflows/` n'en contient pas) | App de référence. 65 PR marquées `platform: web` dans le journal, de pr-226 (2026-04-11) à pr-684 (2026-07-30). Porte le mur polaroïd du Path (#720, 2026-08-23), le flow d'enregistrement pas-à-pas (#732) et l'éventail de valence (#729, 2026-08-24) |
| **iOS** (`apps/ios`, `@pbbls/ios`) | Spec bootstrap **2026-04-12** (`docs/superpowers/specs/2026-04-12-ios-project-bootstrap-design.md`) ; 1re livraison `platform: ios` = pr-242 « Pebbles lands on iPhone », **2026-04-12T13:14Z** ; ère close le **2026-04-29** (`release.tagged` `ios-arrival`) | SwiftUI, **iOS 17+**, iPhone-only ; XcodeGen (`project.yml` = source de vérité), SwiftLint, **Swift Testing** (jamais XCTest), `@Observable` (jamais `ObservableObject`), supabase-swift, exyte `SVGView`, rive-ios (`apps/ios/CLAUDE.md`, `apps/ios/README.md`) | **Xcode Cloud** — seul artefact CI dans le repo : `apps/ios/ci_scripts/ci_post_clone.sh` (installe XcodeGen, fabrique `Secrets.xcconfig` depuis les variables d'env Xcode Cloud, `xcodegen generate`, résout les paquets SPM). **La définition du workflow de release iOS n'est PAS dans le repo** (elle vit dans App Store Connect) — voir §8 | « Full production app » (`apps/ios/README.md` §Status) : auth email/Apple/Google, Path, create/edit/detail, Profile, carving + marketplace de glyphes, karma, Lab, localisé en/fr. 68 PR `platform: ios`. Surface de référence pour Android |
| **Android** (`apps/android`, `@pbbls/android`) | Décision **2026-07-10** (`docs/decisions/log.md`) ; 1re livraison pr-535 **2026-07-11T19:33Z** ; ère close le **2026-07-18** (`release.tagged` `android-arrival`) | Kotlin + Jetpack Compose, **minSdk 33**, compile/targetSdk 37, JDK 21, Gradle 9.4.1 / AGP 9.2.0, supabase-kt, rive-android, AndroidSVG, Coil, ktlint, JUnit4 + Compose Preview Screenshot Testing. **Pas de DI framework** (services simples + CompositionLocals) (`apps/android/CLAUDE.md`, `apps/android/README.md`) | **Automatique, vers Google Play internal testing.** `.github/workflows/android-release.yml` fabrique un AAB **signé** (`bundleRelease`) et publie via l'API Play ; déclencheurs : push sur `main` touchant `apps/android/**`, PR étiquetée `deploy-beta`, `workflow_dispatch`. `versionCode` = `GITHUB_RUN_NUMBER`. Runbook : `docs/android-play-deploy.md` | 18 PR `platform: android`. Parité fonctionnelle avec iOS atteinte en **7 jalons (M38→M44)** entre le 11 et le 17 juillet. Divergences résiduelles : voir §2 |
| **admin** (`apps/admin`, `@pbbls/admin`) | Spec **2026-04-26** (`docs/superpowers/specs/2026-04-26-back-office-app-design.md`) ; analytics le 2026-04-30 (`2026-04-30-admin-analytics-thin-slice-design.md`, PR #338) | Next.js ^16.3.0, React 19.2.4, **Base UI** (`@base-ui/react`), Tailwind 4, recharts, `@uiw/react-md-editor`, sonner. Port 3001. **Seul workspace qui consomme `@pbbls/supabase`** (dépendance déclarée dans `apps/admin/package.json`) | **Vercel**, projet séparé, Root Directory = `apps/admin`, domaine `admin.<consumer-domain>` (`apps/admin/README.md` §Deployment ; racine `CLAUDE.md` : « Web and admin deploy to Vercel (root directory set per app) »). Aucun workflow CI | Analytics, Lab logs, modération de glyphes, éditeur palettes + emojis, gestion des domaines, achievements, playground. **Délibérément non relié à Arkaik** (décision 2026-07-28) — voir §7 |

> **Note de méthode.** Le journal `docs/arkaik/journal.jsonl` s'arrête au **2026-08-24T23:05Z** et sa dernière `deliverable.shipped` date du **2026-07-30**. Depuis la décision du 2026-07-28 (« the arkaik map is served from the hosted project »), le plan local n'est plus le plan que les agents lisent : le journal local est donc **partiel après juillet**. Les événements d'août n'y figurent que sous forme de `node.status_changed` / `node.updated`.

---

## 1. « Independent codebases that mirror each other's architecture and share only the database contract » — le raisonnement complet, et le sort du moteur de rendu

### 1a. La décision du 2026-07-10, in extenso

`docs/decisions/log.md`, entrée **2026-07-10 — Android app: native Kotlin + Jetpack Compose, mirroring the iOS architecture** (Status: taken, Scope: android/docs).

**Contexte cité :** trois candidats — React Native (« the webapp is React »), Flutter, Kotlin natif. Deux contraintes explicites : « The app will be built mostly by AI agents with human review », et « the long-term vision is two platform-perfect native apps — **no convergence of iOS+Android into one codebase** ».

**Le « Why », verbatim, en quatre mouvements :**

> « The real cross-surface contract is the database — business logic lives in Postgres RPCs (see 2026-05-26 "Prefer RPCs"), on which all stacks sit equally. React Native's reuse advantage is modest (a thin React-free data layer; **the expensive work — custom SVG rendering, glyph canvas, animation/haptic feel — is per-platform in every option**), Flutter adds a third language with zero reuse from any surface, and Kotlin Multiplatform only pays if the healthy 16k-LOC Swift app were refactored to consume shared Kotlin. Compose is the only Android option with zero abstraction tax on the deep-native work that defines the iOS quality bar (#505 pastille), and **SwiftUI ↔ Compose are near-isomorphic, making the finished iOS app a directly portable reference implementation for agents.** »

**La conséquence qui verrouille :**

> « Models and query strings are hand-written per surface by design — **do not build a codegen/shared-types bridge without a new decision.** RN/Flutter proposals for Android are settled-rejected. »

Reformulée dans la racine `CLAUDE.md` (ligne 7) : « Four client surfaces sit on one Supabase database; **the database contract is the only thing they share.** » Et dans la roadmap store du 2026-07-28 : « three hand-written native clients by design (no codegen bridge) » (`docs/superpowers/specs/2026-07-28-store-launch-roadmap.md` §2).

### 1b. Le moteur de rendu TypeScript — ce qu'il était, ce qu'il est devenu

**⚠️ Correction de prémisse.** L'ambition d'avril 2026 n'était **pas** « un moteur TypeScript embarqué dans iOS et web ». C'était : **composer côté serveur, livrer le SVG composé à tous les clients**. Cette version-là a été livrée et **tourne toujours**. La décision du 2026-07-10 ne la renverse pas.

**Source primaire de l'ambition :** `docs/superpowers/specs/2026-04-15-remote-pebble-engine-slice-1-design.md` (« Remote Pebble Engine — Slice 1: iOS fallback render », PRD #260, jalon M19), verbatim :

> « Issue #260 ("Remote pebble engine") proposes **consolidating pebble visual composition on the server so both webapp and iOS receive the same composed SVG + animation manifest for display**. Today, composition is 100 % client-side in the webapp (`apps/web/lib/engine/`) and iOS has no visual at all. »

> « **Single external API for iOS.** The client makes one call to `compose-pebble` per pebble creation and receives `{ pebble_id, render_svg, render_manifest, render_version }`. »

**Réponse plate : oui, le moteur existe toujours.** Il est à
`packages/supabase/supabase/functions/_shared/engine/` :
`compose.ts` (154 l., en-tête : « Runs SERVER-SIDE as a Supabase Edge Function (Deno). Called by create_pebble / update_pebble RPCs. »), `glyph.ts` (279), `layout.ts` (159), `resolve.ts` (28), `types.ts` (91), plus `shapes/` (9 constantes SVG inline : small|medium|large × lowlight|neutral|highlight). L'écriture passe par `_shared/compose-and-write.ts` (`const RENDER_VERSION = "0.1.0"`).

**Qui l'exécute :** trois edge functions Deno — `compose-pebble/index.ts` (création), `compose-pebble-update/index.ts` (édition, ajoutée après la spec d'avril), `backfill-pebble-render/index.ts` (ops, service-role). Migration d'origine : `packages/supabase/supabase/migrations/20260415000001_remote_pebble_engine.sql`. Le `render_manifest` a été **supprimé** ensuite : `20260429000000_drop_pebbles_render_manifest.sql`.

**Les trois clients l'appellent tous** (au moment de l'écriture, pas de l'affichage) :
- web — `apps/web/lib/data/supabase-provider.ts:474` et `:510`
- iOS — `apps/ios/Pebbles/Features/Path/PebblePublisher.swift:34`, `EditPebbleSheet.swift:230`
- Android — `apps/android/app/src/main/kotlin/app/pbbls/android/services/PebbleWriteService.kt:160-161`

**Ce qui n'a PAS eu lieu :**
1. **La suppression du moteur client web.** `apps/web/lib/engine/` existe toujours (`render.ts`, `templates.ts`, `glyph.ts`, `params.ts`, `types.ts`, `seed.ts`, `index.ts` — 542 l.). C'est une implémentation **différente et plus ancienne** (templates dessinés à la main, sélectionnés par intensité/positiveness). La spec du 2026-04-15 la condamnait explicitement, en section « Anticipated future iterations (NOT planned, outlined only) » : « The existing `apps/web/lib/engine/` **is deleted**. » Elle ne l'a pas été. Elle survit comme **repli client**, commenté dans `apps/web/components/pebble/PebbleVisual.tsx:33-38` : « Prefer the server-composed render written by the compose-pebble edge function. **Fall back to the client engine for legacy rows** that pre-date the remote engine **and for unauthenticated previews** (e.g. landing page seed pebbles) where no render exists yet. » Même préséance dans `PathStone.tsx:68`. La bascule web date du commit `9eca11d8` (2026-04-26, #315).
2. **`packages/shared` n'a jamais démarré.** `packages/shared/CLAUDE.md` : « Currently a **stub**. Placeholder package. Build and lint scripts are no-ops. Entry point `src/index.ts` is an empty export. » Le fichier `src/index.ts` contient une seule ligne de commentaire.
3. **Aucun moteur partagé côté client.** Chaque surface porte son propre parseur/renderer (§3).

**Il n'existe aucune trace d'une ambition d'exécuter le moteur TS *dans* iOS** — aucune mention de JavaScriptCore/JSCore nulle part dans le repo, aucun `@pbbls/engine` ni `packages/engine` n'a jamais existé. **NOT FOUND.** Et `docs/decisions/log.md` **commence au 2026-05-26** : il n'y a donc aucune entrée de journal de décisions pour avril.

---

## 2. Android : du bootstrap à la parité en ~six jours (11–17 juillet)

### 2a. L'ordre d'arrivée (journal Arkaik, `platform: android`)

| Horodatage (UTC) | PR | Ce qui atterrit | Jalon |
|---|---|---|---|
| 2026-07-11 19:33 | #535 | Entonnoir d'entrée : Welcome (splash Rive), auth email/mdp, Google OAuth (PKCE, `pebbles://auth-callback`), onboarding 4 pages | M38 sous-projets A–C |
| 2026-07-11 22:57 | #536 | **Path en lecture seule** : `path_pebbles()` → week roll (cairn statique) + header + pager, lignes outline + `render_svg` + vignettes | M38 sous-projet D |
| 2026-07-13 09:08 | #550 | **Premier chemin d'écriture** : create / detail / edit / delete, `PebbleForm` partagé, 4 pickers, création inline de soul, pastille karma | M39 |
| 2026-07-13 12:24 | #552 | Renderer statique par traçage de calques (les glyphes rendent au poids d'outline) | M39 suite |
| *(2026-07-14)* | #558 | Port complet du wobble avec parité par golden fixtures ; `WOBBLE_ENABLED` cuit dans les builds internal-testing (décision 2026-07-14) | — |
| 2026-07-16 12:03 | #572 | Correctif pré-vol : union des glyphes achetés (`glyph_entitlements`) dans `GlyphService.list()` | pré-vol |
| 2026-07-16 13:43 | #575 | Barre de stats en pied de Path (glyphe de profil, bounce/ripple, karma) | M41 |
| 2026-07-16 15:29 | #576 | **Profile + Settings** | M41 |
| 2026-07-16 19:07 | #577 | **Souls** (liste, détail, create/edit) | M41 |
| 2026-07-16 22:24 | #578 | **Collections** (liste, détail, create/edit) | M41 |
| 2026-07-17 07:15 | #593 | **Snaps** (photo attach + pipeline d'upload) **et Glyph Studio + store** (carve, market, `buy_glyph`) | M42 + M43 |
| 2026-07-17 08:35 | #597 | **Lab** (4 flux, réactions, détail d'annonce) — *fin de l'arc Android* | M44 |

Le tag `android-arrival` (2026-07-18T16:42Z) résume : « **In eight days a third client went from an empty Gradle module to Lab parity with iOS** … The Android arc itself completed at the M44 exit (#597, 2026-07-17T08:35:59Z); the rest of the era is cross-surface polish. » Sept jalons, M38 → M44.

### 2b. Le verdict de l'audit de parité (2026-07-16)

`docs/superpowers/specs/2026-07-16-android-parity-audit.md` — audit fichier par fichier des dix domaines, contradictoire (« every headline "missing on Android" claim was attacked with full-tree greps (**all 12 confirmed, zero false gaps**) »).

**Verdict chiffré :**

> « Remaining to port: **~7,500–8,000 iOS-LOC equivalent** — roughly the back half of the app. **None of it needs DB work**: every view, RPC, table, bucket, and edge function the gaps depend on already exists, built for web/iOS. »

**Trois défauts vérifiés dans du code déjà livré** (§2) : (1) `GlyphService.list()` excluait les glyphes achetés au marché — « a user who bought glyphs on web/iOS **cannot attach them on Android** even though `can_use_glyph` permits it » ; (2) le soul picker affichait des compteurs à zéro en permanence (agrégat `pebbles_count` absent du select) ; (3) passe de grooming M39 manquée — Arkaik et `apps/android/CLAUDE.md` périmés.

**Le seul trou « in-scope » non documenté :** l'animation d'apparition du pebble (`PebbleAnimatedRenderView` + `PebbleAnimationTimings`, ~315 LOC) — « **the only substantial iOS behavior inside M39's own scope dropped without a named decision** ».

L'audit proposait M40→M43 ; les jalons ont été exécutés dans la journée et le lendemain (voir 2a).

### 2c. Ce qui n'est **réellement** pas à parité aujourd'hui

Classé par l'audit en **gap** (absent sans autorité documentaire) ou signalé comme divergence assumée ailleurs :

- **Icône d'application.** « **default system icon is live on the Play internal track** » — bloqué sur les sources de design du mainteneur (audit §3, « Platform services »). Confirmé par `apps/android/CLAUDE.md` : « No app icon slot — the launcher shows the default system icon. Expected. »
- **Illustrations d'onboarding** : surface placeholder ; les quatre PNG 720×720 existent dans le catalogue d'assets iOS, ~10 LOC pour les brancher (audit).
- **Cairn animé du week-roll** : Android affiche un drawable statique (`res/drawable/cairn_static.xml`) ; la state machine Rive iOS (`pbbls-cairn-states.riv`, input `isSelected` + data binding `strokeColor`) est un « known fast-follow » (`apps/android/CLAUDE.md`).
- **Sign in with Apple** : absent (non-goal M38). Conséquence acceptée et notée comme « highest-value auth item: **iOS Apple-SSO accounts are hard-locked out of Android today** ».
- **Son céramique + haptique à enveloppe** sur le karma (DD, D9) ; **predictive back** non activé malgré le minSdk 33 invoqué pour le justifier ; kit d'idiomes d'écran/liste (`pebblesScreen`, `pebblesList`…) ; cascade de révélation de la semaine ; centrage/snap du week-roll ; police serif du détail.
- **Live Activity / Dynamic Island** : classé **n/a** (Apple-only, abandonné même sur iOS, décision 2026-07-01).
- **Le drapeau wobble a divergé exprès en trois** (décision 2026-08-24, #729) : iOS et web l'ont promu à `true` inconditionnel ; « **Android (#735) kept `WOBBLE_ENABLED` conditional** and instead renders `ValenceStone` outside it, because the flag guards an AndroidSVG fallback that web has no equivalent of ». La consigne de le passer à `'false'` avant toute promotion vers une piste publique **tient toujours pour Android seul**.
- **La glu de brouillon dupliquée** dans `CreatePebbleScreen` — voir §6.

---

## 3. Ce qui est réellement partagé entre surfaces, aujourd'hui

### 3a. Partagé pour de vrai

| Artefact | Nature | Preuve |
|---|---|---|
| **Le contrat de base de données** | 64 migrations, RLS, triggers, vues, RPC. « The database is the contract between four clients » | racine `CLAUDE.md` §Standing cross-surface rules ; `packages/supabase/CLAUDE.md` |
| **Les RPC Postgres** | `create_pebble`, `update_pebble`, `delete_pebble`, `path_pebbles()`, `buy_glyph`, `check_achievements`, `purge_account`, `get_public_profile`, `can_use_glyph`… Règle : tout écrit multi-tables passe par une RPC (atomicité — PostgREST n'a pas de transaction client) | `AGENTS.md` §Supabase ; décision 2026-05-26 |
| **Les edge functions Deno** | `compose-pebble`, `compose-pebble-update`, `backfill-pebble-render`, `delete-account` — plus le **moteur de rendu** dans `_shared/engine/` | `packages/supabase/supabase/functions/` |
| **`pebbles.render_svg`** | La **chaîne SVG composée** est le seul artefact de rendu partagé. Tout ce qui est en aval est un port | §1b |
| **Les harnais de contrat** | `packages/supabase/scripts/verify-*.ts` (Deno) — 4 en CI + `verify-account-purge.ts` manuel. « acceptance tests, not simulations » : ils créent de vrais comptes jetables **contre le projet de production** | `packages/supabase/CLAUDE.md` |
| **`WobbleGolden.json`** | Fixture de parité inter-plateformes, propriété d'iOS (`apps/ios/PebblesTests/Wobble/WobbleGolden.json`), régénérable **uniquement** via `apps/ios/Scripts/generate-wobble-golden.mjs`. Le web **lit le fichier iOS directement** (`apps/web/lib/wobble/wobble.golden.test.ts` : chemin `../../../../apps/ios/PebblesTests/Wobble/WobbleGolden.json`) ; Android en garde une **copie octet pour octet** (`apps/android/app/src/test/resources/WobbleGolden.json`) | décision 2026-07-13 |
| **Les seize hexadécimaux échantillonnés** du dégradé de valence | « the hexes are the shared artefact, the drawing is not, and **a fourth surface should copy the samples rather than the technique** » | décision 2026-08-24 (#729) |

### 3b. `packages/rive` — « consumed by copy per surface », ce que ça veut dire

Le dossier `packages/rive/` contient **quatre fichiers et rien d'autre** : `pbbls-cairn-states` (⚠️ **sans extension `.riv`** — défaut relevé par l'audit de parité), `pbbls-cairn.riv`, `pbbls-logo-appear_idle.riv`, `pbbls-logo.riv`. Pas de `package.json` : **ce n'est pas un workspace npm** (racine `CLAUDE.md` : « `.riv` animation assets, copied per surface (not an npm workspace) »).

« Consumed by copy » veut dire littéralement : chaque surface possède **sa propre copie physique** du fichier dans son arborescence d'assets, sous les contraintes de nommage de sa plateforme. Aucune résolution de dépendance, aucun lien symbolique, aucun script de synchronisation.

```
apps/ios/Pebbles/Resources/pbbls-logo-appear_idle.riv
apps/ios/Pebbles/Resources/pbbls-logo.riv
apps/ios/Pebbles/Resources/pbbls-cairn-states.riv
apps/android/app/src/main/res/raw/pbbls_logo_appear_idle.riv   ← renommé (res Android = [a-z0-9_])
apps/web/public/animations/pbbls-cairn.riv
apps/web/public/animations/pbbls-cairn-states.riv
apps/web/public/animations/pebbles-stack.riv                    ← n'existe pas dans packages/rive
```

`apps/android/CLAUDE.md` formalise la « **Rive rename map (D14)** » : `pbbls-logo-appear_idle.riv` → `res/raw/pbbls_logo_appear_idle.riv`. La même **règle de renommage-à-la-copie** s'applique ensuite à d'autres familles d'assets : les 9 silhouettes d'outline (`{size}-{polarity}.svg` → `outline_{size}_{polarity}.svg`), la police Caveat (« copied byte-identical from `apps/ios/Pebbles/Resources/` into `res/font/caveat.ttf` », décision 2026-08-24), et les 9 artworks de valence (« a **third** copy of iOS assets under the rename-on-copy rule », décision 2026-08-24 #729). Chaque surface tire aussi son propre runtime Rive : `@rive-app/react-canvas` ^4.21 (web), `rive-android` 11.7.2 (Android), le SPM `rive-ios` (iOS).

### 3c. `packages/shared` — ce que c'est vraiment

**Rien.** `packages/shared/src/index.ts` contient une ligne : `// Placeholder for shared types and utilities`. `package.json` : `"build": "echo 'placeholder — no build step yet'"`, idem pour `lint`. `packages/shared/CLAUDE.md` décrit un futur au conditionnel (« Domain types **will** migrate here from `apps/web/lib/types.ts` … Validation schemas and pure utility functions shared across `apps/web/` and `apps/ios/` »). La racine `CLAUDE.md` tranche : « `packages/shared` | **Stub — no code yet** ».

### 3d. Ce qui est dupliqué alors qu'on pourrait croire le contraire

- **Les types générés de la base.** `packages/supabase/types/database.ts` est généré et commité — mais **seul `apps/admin` déclare `@pbbls/supabase` en dépendance**. `apps/web` ne l'importe nulle part : `apps/web/lib/supabase/client.ts` crée un `createBrowserClient` **sans le générique `Database`**, et le web maintient ses propres types métier dans `apps/web/lib/types.ts`. La promesse de `packages/supabase/CLAUDE.md` (« The web app will import them … **once the dependency is wired** ») n'est toujours pas tenue.
- **Les dimensions du canevas du moteur**, retapées à la main dans deux autres langages : `apps/ios/Pebbles/Features/Path/Render/PebbleOutlineGeometry.swift` (« Mirrors `packages/supabase/supabase/functions/_shared/engine/layout.ts` » — small 250×200, medium 260×260, large 260×310) et `apps/web/lib/config/pebble-geometry.ts:39-45` (mêmes nombres, en-tête « web port of iOS PR #475 … Mirrors `PebbleOutlineGeometry.swift` »).
- **Le wobble**, porté trois fois avec les mêmes sept noms de fichiers : `apps/ios/…/Render/Wobble/` (Swift), `apps/android/…/features/path/render/wobble/` (Kotlin), `apps/web/lib/wobble/` (TS).
- **Le rendu du `render_svg` lui-même** : iOS parse avec son propre `SVGPathParser.swift` / `PebbleSVGModel.swift` + exyte `SVGView` ; Android avec AndroidSVG `SVG.getFromString()` et un remplacement littéral de `currentColor` par l'hexa de palette (« mirrors iOS `PebbleRenderView` », spec bootstrap D10) ; le web avec `dangerouslySetInnerHTML`.
- **L'aperçu de glyphe dans l'admin** : « The admin app cannot import `apps/web/lib/engine`. **Duplicate a minimal pure** fit/render helper into `apps/admin/lib/pebblestore/render-preview.ts` … **Package-extraction of the engine is a future option, not done here** » (`docs/superpowers/specs/2026-06-30-issue-497-admin-glyph-moderation-design.md:251`).

### 3e. La règle de test qui remplace le partage de code

Décision **2026-07-30** (#651), née d'un bug silencieux : `pebble_drafts.payload` est la première forme écrite *et lue* par les trois clients, et ils ne s'accordaient pas sur la précision sub-seconde (web = millisecondes, Postgres = microsecondes, iOS `ISO8601DateFormatter` = secondes entières). Résultat : « **every web- and Postgres-written `happened_at` silently decoded to `nil`** ». Deux règles permanentes en sont sorties :

> « (1) Any data shape shared by more than one client is tested on each surface **against real payloads produced by the others, verbatim** — including precision variants and explicit nulls, never against that surface's own output. »
> « (2) Timestamps crossing a surface boundary are parsed **tolerantly** and emitted at the **narrowest** precision every reader accepts. »

Cause racine nommée explicitement : « **Same-surface round-trips are structurally incapable of catching a same-surface formatter bug**, so the test strategy, not the formatter, was the root cause. » Android n'avait besoin d'aucun changement de code (`OffsetDateTime.parse` accepte les trois précisions) « but gets the same foreign-payload tests anyway, because **"it happens to work" is not a contract** ».

---

## 4. Le mur polaroïd du web, et pourquoi le round-robin plutôt que l'équilibrage des hauteurs

Décision **2026-08-23 — Path becomes a polaroid wall on web; masonry is dealt round-robin, never height-balanced (#720)**, jalon M58, surface `apps/web` uniquement. Le design a été arrêté sur `/sandbox/path`, « an unauthenticated fixture page, rather than on the real Path » (`docs/superpowers/specs/2026-08-22-path-polaroid-sandbox-design.md` : « so a design decision can be made **by looking rather than by arguing** »).

**La raison, verbatim (décision) :**

> « **Height-balancing lets a short card jump the queue to fill a gap, so two cards side by side stop being neighbours in time — on a *Path*, whose entire premise is chronology, that is a correctness bug wearing a tidier bottom edge.** Round-robin guarantees reading the columns row by row returns the input order, and `lib/utils/path-layout.test.ts` asserts it. »

Le code le redit et nomme le prix payé (`apps/web/lib/utils/path-layout.ts`, en-tête de `groupPebbles`) :

> « Cards are dealt round-robin (0 → col 0, 1 → col 1, 2 → col 0 …) rather than height-balanced. Height-balancing needs measurement, and worse, **it breaks chronology** … **The cost is that columns end at different heights when card heights differ. That is the trade the wall accepts — a ragged bottom edge reads as a wall, an out-of-order timeline reads as a bug.** »

**Deuxième choix technique, distinct :** colonnes **flex**, pas `columns-*` CSS. « Multicol fragments boxes at column boundaries and **slices each card's drop shadow**; here it would also **bisect the stone overhanging the top edge**. » (Le galet est posé à cheval sur le bord haut de chaque polaroïd, « like a stone on a print ».)

**Autres décisions de la même entrée :** les gros pebbles cassent le mur et prennent toute la largeur, les séquences de part et d'autre deviennent leurs propres sections ; `WeekPath` gagne `display?: "wall" | "list"` (défaut `"wall"`) qui garde la pile de lignes atteignable ; la couleur du galet passe par des custom properties CSS choisies par la cascade `.dark`, **jamais par un thème lu en JS** (désynchronisation serveur/client).

**Conséquences assumées :** « **The three clients now diverge visually** — no schema or RPC changed, so nothing is broken, but iOS and Android still render rows; mirroring them is a follow-up under M58, **not a regression to fix blind**. » Deux défauts latents ont été relevés **et pas corrigés** : `dark_color` est injoignable en production (absent de `EmotionPalette` et du select de `v_emotions_with_palette`), et les fixtures de `/sandbox/path` portent toutes `render_svg: null` — « the sandbox exercises only the fallback path and **cannot** catch a regression on the server-render branch — which is exactly how the first cut of `PathStone` shipped bare, unwobbled outlines while the sandbox looked correct ».

---

## 5. Les deux composeurs iOS, et l'argument d'avril 2026

### 5a. La décision

**2026-08-23 — Two iOS composers coexist on purpose: the record flow by default, the sheet behind a long-press (#723)**, jalon M58.

Le `+` du Path ouvre `RecordFlowView` (11 étapes : photo → when → name → valence → emotion → domain → souls → collection → glyph → privacy/publish → success, haptique à chaque tap). **Un appui long sur le même `+`** ouvre `CreatePebbleSheet`, le formulaire tout-en-un. La reprise d'un brouillon entre dans le flow « at the first unanswered mandatory step ».

**Le pourquoi, verbatim :**

> « This is **an experiment in interaction model**, and the honest way to evaluate it is to **fall back on device without a rebuild**. Long-press was chosen over a Settings toggle because it adds no chrome, no persisted state and no localized string — **it deletes in one line when the experiment resolves**. »

Et la moitié structurante :

> « The extractions are the load-bearing half: every branch in the publish path and the draft glue is a bug that was found and fixed once already (soft success, #647, the M47 D7 glyph verification), and **a second hand-rolled copy is how they come back — silently, since the flow would keep working while quietly losing the fixes**. »

D'où le partage explicite de la logique risquée entre les deux composeurs : `PebblePublisher` (l'invocation `compose-pebble`, la récupération du `pebble_id` en soft-success, le mapping d'erreurs) et `ComposerDraftCoordinator` (le cycle de vie brouillon serveur + snapshot local de M47, y compris le gate d'hydratation `refs.hasLoaded` de #647).

**L'avertissement au lecteur futur :** « **A future reader will find two composers and may assume one is dead code. It is not**; deleting `CreatePebbleSheet` also removes the only fallback if the flow proves wrong, and `EditPebbleSheet` still needs `PebbleFormView`. **Resolving the experiment means deleting *one* of them plus the long-press gesture, not merging them.** »

La spec ajoute la ligne de partage éditoriale (`docs/superpowers/specs/2026-08-23-ios-record-flow-design.md`, D1) : « `EditPebbleSheet` is **not** in scope. Editing an existing pebble keeps `PebbleFormView`: **a form is the right shape for changing one field of ten, and a wizard is the wrong one.** »

### 5b. Le lien avec la tension d'avril 2026

**Ce que dit le corpus, factuellement :**

- **2026-03-27, PR #25** (journal, pré-monorepo) : « Record a moment one question at a time — Adding a pebble now walks you through it in steps instead of asking for everything at once, with a progress bar so you always know how far is left. » Le stepper existait donc dès mars.
- **2026-04-08, PR #161** : « **One place to make a pebble — The long step-by-step sequence is gone.** Name, feeling, people, parts of life, photos, glyph and collections all happen in the quick editor on your path. » Le Quick Pebble Editor gagne.
- **2026-04-08, PR #162** : l'éditeur « stays folded to a single line and opens up on its own when you start typing ».
- **2026-07-03, PR #521** (web) : « Recording a pebble gets its own page — The composer moved out of the pop-up over your Path and onto a full Record page. »
- **2026-08-23 → 2026-08-24** : le pas-à-pas revient et devient **le composeur par défaut sur les trois clients** — iOS (#723), web (#732), Android (#725).

**Est-ce la résolution de l'argument d'avril ? Le journal de décisions ne le dit nulle part.** L'entrée du 2026-08-23 et la spec `2026-08-23-ios-record-flow-design.md` ne mentionnent **ni avril 2026, ni la PR #161, ni le Quick Pebble Editor comme prédécesseur historique**. La spec justifie le flow sur un seul terrain, présent : le formulaire « asks the user to hold **ten decisions in their head simultaneously** », et le séquencement permet trois choses qu'un formulaire ne peut pas faire (EXIF de la photo → date ; valence → ordre des catégories d'émotion ; privacy en dernier, contre publish).

**Le seul endroit du corpus qui fasse explicitement le lien** est la carte Arkaik, dans la description du nœud `V-record-success` (`docs/arkaik/bundle.json`) :

> « **Revives the celebration beat `V-record-celebration` carried on web before #161 retired it.** »

Et le nœud `V-record-celebration` est bien présent, statut `archived`, plateformes `["web","ios","android"]` : « Celebration screen after revelation that confirms the pebble was saved, before navigating to the detail view. »

**Formulation prudente pour l'écriture :** oui, dans les faits c'est un retour de balancier complet — le pas-à-pas retiré le 2026-04-08 redevient le défaut sur trois surfaces les 23–24 août 2026, le formulaire devenant le repli. Mais **c'est une reconstitution d'archive, pas une affirmation du corpus** : aucune décision, aucune spec ne pose l'argument comme tranché, et le vocabulaire officiel reste « experiment » avec une résolution encore à venir (supprimer l'un ou l'autre).

### 5c. Où en est l'expérience aujourd'hui

Le nœud Arkaik `F-record-pebble-flow` est **`live` sur `web`, `ios`, `android`**, et décrit deux déviations par surface assumées : le web garde l'étape collection en multi-sélection (« because the web composer has always allowed several collections ») et le web n'a **pas d'haptique** (« the Vibration API is unsupported in Safari/iOS and inconsistent elsewhere, so **the web flow is the quiet one**, where iOS and Android buzz on every tap »). Le repli formulaire est atteignable par appui long sur le `+` (iOS), appui long sur « New pebble » (Android), ou **`/record?composer=form`** (web). L'acceptance `AC-record-pebble-flow` est `live` sur les trois plateformes.

---

## 6. Android : la grille de valence propre, et la glu de brouillon « deliberately left duplicated »

Décision **2026-08-24 — Android mirrors the record flow but keeps its own valence grid, and one composer's draft glue is deliberately left duplicated (#725)**.

**Ce qui portait 1:1** : les onze étapes, l'ordre et ses trois dépendances de séquencement, le modèle « un objet possède toutes les interactions », la règle haptique-à-chaque-tap, les extractions de contenu de picker.

### 6a. La grille de valence — décision **superseded le même jour**

Raison invoquée pour ne pas porter l'éventail iOS : « an ~850 LOC art-and-layout subsystem whose assets do not exist on Android ». Et surtout : « **Porting the fan would roughly double the change and would ship a *third* valence design (iOS stones, Android line art, web) rather than converging on one** — the fan is worth its own issue, with its own asset export. »

**⚠️ Cette moitié-là a été renversée le jour même.** L'entrée **2026-08-24 (#729) — Android gets the valence fan** porte : « **Supersedes the "Android keeps its own valence grid" half of the 2026-08-24 entry for #725** — the rest of that entry (the duplicated draft glue, the Caveat copy) stands. » Android a son éventail, avec un maillage **cuit en bitmap** (`ValenceMesh` rééchantillonne la grille de contrôle 4×4 sur un carré de 64² par pondération inverse-distance de Shepard, étiré par un `BitmapShader`), parce que « SwiftUI's `MeshGradient` … has **no Compose equivalent at all** ».

### 6b. La glu de brouillon — la duplication, elle, tient

**Le fait :** iOS a extrait `ComposerDraftCoordinator` *hors de* `CreatePebbleSheet` pour que les deux composeurs pilotent une seule copie du cycle de vie brouillon M47. Sur Android, cette glu est **inline dans `CreatePebbleScreen`**. Le `ComposerDraftCoordinator` **a bien été écrit** pour Android et `RecordFlowScreen` l'utilise — mais `CreatePebbleScreen` **reste sur sa copie inline**. « **Two copies today, one canonical implementation going forward.** »

**Pourquoi la duplication est choisie plutôt que l'abstraction, verbatim :**

> « On the draft glue: **duplicating it is the exact silent-drift failure the iOS D8 extraction was written to prevent**, but the repo's standing rule is that **existing code is not refactored without approval**, and **a bug introduced into `CreatePebbleScreen` while porting the flow would be worse than a second copy that is known and recorded**. »

Autrement dit : ce n'est pas une préférence architecturale pour la duplication, c'est un **arbitrage de risque sous une règle de process**. La règle citée est celle de `AGENTS.md` : « **Never refactor existing code without explicit approval.** If you see something to improve, mention it in a comment — don't change it. » Le prix est nommé et rendu opposable :

> « **`CreatePebbleScreen` and `RecordFlowScreen` both implement the M47 draft lifecycle**, so a fix to hydrate-or-restore, `can_use_glyph` verification, save-as-draft or consume-after-publish **must land in *both*** until the sheet is migrated to `ComposerDraftCoordinator` — **that migration is the follow-up that closes this**. »

**Le principe général qui coiffe tout ça** (décision 2026-08-24, #729, web) : « **All three surfaces now draw the same gradient three different ways** … from one set of sixteen sampled hexes: **the hexes are the shared artefact, the drawing is not, and a fourth surface should copy the samples rather than the technique.** »

**Note d'incident, utile éditorialement :** la même entrée #725 raconte que « Web shipped its own port of the flow in #732 while this branch was open … **The two branches both re-emitted the same three Arkaik nodes and collided exactly the way the standing `create or replace` rule warns about**; the merge unions them rather than letting the later branch win. »

---

## 7. L'app admin

### 7a. Ce qu'elle fait aujourd'hui

Routes réelles sous `apps/admin/app/(authed)/` :

| Route | Contenu | Source |
|---|---|---|
| `/analytics` | Strip de KPI (Total users, DAU, WAU, MAU, Pebbles/day, DAU/MAU), courbe d'utilisateurs actifs avec bascule DAU/WAU/MAU, heatmap de rétention par cohorte hebdo, plages 7d/30d/90d/1y/All pilotées par `?range=`. Toutes les données passent par des **RPC SECURITY DEFINER gated `is_admin(auth.uid())`** ; les vues sont révoquées à `anon`/`authenticated` | `apps/admin/CLAUDE.md`, nœud `V-admin-analytics` |
| `/logs`, `/logs/new`, `/logs/[id]`, `/logs/features`, `/logs/announcements` | Le **Lab** : changelog + annonces, création/édition, publish/unpublish/delete. « New log » lit le presse-papier pendant le geste de clic et **préremplit** le formulaire si le contenu est un snippet YAML de Lab Note (décision 2026-07-17, #601) | `apps/admin/README.md` ; `apps/admin/lib/logs/parse-lab-note.ts` |
| `/pebblestore/glyphs` | **Modération de glyphes** : file filtrée par statut (pending/approved/rejected), preview, Approve (publication au marché, override de prix optionnel), Reject (raison obligatoire stockée dans `review_note`, montrée au soumetteur), re-pricing. Lecture via `admin_list_glyph_submissions` parce que la policy SELECT élargie n'expose pas les strokes des soumissions pending | nœud `V-admin-glyph-moderation` |
| `/emotions/palettes` | **Éditeur de palettes** : par catégorie d'émotion, cinq variantes réglées à la main (primary, secondary, light, shaded, dark), inputs hexa + color pickers natifs qui préservent l'octet alpha. `surface_color` n'est **pas** édité — il est re-dérivé de `primary` côté serveur à chaque save | nœud `V-admin-palettes` (#608) |
| `/emotions/emojis` | **Éditeur d'emoji** par émotion, groupées par catégorie ; lecture `admin_list_emotions`, écriture `admin_update_emotion_emoji` | nœud `V-admin-emojis` (#608) |
| `/domains`, `/domains/[id]` | **Gestion des domaines** : liste avec vignette du glyphe courant ; éditeur nom + description (colonne `domains.label`) + upload/remplacement du glyphe via le pipeline stroke-only SVG partagé avec l'uploader de glyphes. Les édits texte ne touchent **que le fallback DB** — les noms localisés viennent des catalogues i18n clients | nœud `V-admin-domains` (#518) |
| `/achievements`, `/achievements/new`, `/achievements/[id]` | Catalogue d'achievements (le mainteneur y fixe le `karma_reward`) | décision 2026-07-30 (#664) |
| `/playground/analytics`, `/playground/glyphs` | Pages de revue d'états (dense / sparse / empty) sans données seedées | `apps/admin/CLAUDE.md` |

Plus `/login`, `/403`, `/auth/callback`, `/auth/signout`. Le bootstrap admin est manuel : `update public.profiles set is_admin = true where user_id = '<id>'` en SQL editor.

**Pourquoi une app séparée** (`apps/admin/README.md`) : « `apps/web` is a PWA with a service worker. Admin is always-online and never installed. **Mixing them fights the platform**; subdomain isolation also gives a clean cookie boundary. »

### 7b. Est-elle déployée ?

**Oui, sur Vercel.** Racine `CLAUDE.md` : « Web and admin deploy to Vercel (root directory set per app) ». `apps/admin/README.md` documente la procédure : projet Vercel dédié, Root Directory `apps/admin`, deux variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), domaine `admin.<consumer-domain>` + CNAME, et ajout de l'URL aux Redirect URLs Supabase. **Le nom de domaine exact en production n'apparaît pas dans le repo — NOT FOUND** (le seul domaine nommé partout est `www.pbbls.app`, celui du web).

### 7c. La décision du 2026-07-28 : `apps/admin` reste non relié

Entrée **2026-07-28 — The arkaik map is served from the hosted project, and `apps/admin` stays unlinked (#622)**. Quatre volets, dont : des liens de repo scopés par chemin `apps/ios`→ios, `apps/android`→android, `apps/web`→web, `metadata.ref_policy = true` (PR ouverte → development, mergée → live), et **« (4) `apps/admin` is deliberately left unlinked. »**

**Le pourquoi, verbatim :**

> « Arkaik models only `web | ios | android`, so admin could only be linked as `web` — and **an admin-only PR would then mark the *customer-facing* web app shipped**. Leaving admin unlinked **keeps the "shipped" signal honest**; admin PRs simply move no platform status. »

La même entrée raconte un piège évité : le préfixe du brief original était `apps/webapp`, qui n'existe pas ici — « the API validates path *format*, not existence, so that link would have returned 201 and then **silently matched nothing**, and web would never have promoted ».

**Conséquence, avec une interdiction explicite :** « Adding an `apps/admin` link later is a one-line POST, **but only once admin has a platform of its own or is explicitly accepted as part of "web" for release purposes — do not add it as a convenience fix for the "missing" link.** »

**Ce que ça veut dire concrètement :** l'admin est la seule des quatre surfaces qui **n'apparaît pas dans le signal de release** du graphe produit. Elle est bel et bien modélisée dans le bundle (les nœuds `V-admin-*` existent, statut `live`, `platforms: ["web"]`), mais son **cycle PR→statut** est débranché. Une PR admin ne fait bouger aucune plateforme.

---

## 8. CI et release, surface par surface

### 8a. Ce qui part tout seul

| Surface | Automatisme | Détail |
|---|---|---|
| **web** | **Oui** — Vercel, intégration git | Root Directory `apps/web`. Preview URLs par branche. Aucun workflow GitHub Actions ; `apps/web/vercel.json` est vide |
| **admin** | **Oui** — Vercel, projet distinct | Root Directory `apps/admin` |
| **Android** | **Oui** — `android-release.yml` → **Play internal testing** | AAB signé (`bundleRelease`) publié via l'API Play (`r0adkll/upload-google-play`, service account). Trois entrées : push sur `main` touchant `apps/android/**`, PR étiquetée `deploy-beta` (publie **cette branche** sur le téléphone), `workflow_dispatch`. **Fail-soft** : sans secrets keystore/service-account, le job produit un AAB non signé en artefact et saute la publication — « nothing goes red during the one-time console setup ». `versionCode` = `GITHUB_RUN_NUMBER` (règle Play de stricte croissance ; ne jamais relancer un run, pousser un commit) |
| **iOS** | **Partiellement — la définition n'est pas dans le repo** | Le seul artefact CI iOS versionné est `apps/ios/ci_scripts/ci_post_clone.sh` (Xcode Cloud) : `brew install xcodegen`, écriture de `Config/Secrets.xcconfig` depuis `PBBLS_SUPABASE_URL`/`PBBLS_SUPABASE_ANON_KEY` (Xcode Cloud interdit les noms commençant par `CI_`/`TEST_RUNNER_`), `xcodegen generate`, `xcodebuild -resolvePackageDependencies`. `apps/ios/README.md` : « Builds on Xcode Cloud ». **Le workflow lui-même (déclencheurs, distribution TestFlight) vit dans App Store Connect — NOT FOUND dans le repo.** TestFlight n'apparaît que dans les plans d'avril 2026, comme nom de jalon (`M23 · TestFlight V1`) et comme lieu de validation manuelle |

### 8b. Ce qui ne part pas tout seul (gates et angles morts)

Les cinq workflows du repo, tous : `android.yml`, `android-release.yml`, `arkaik.yml`, `supabase.yml`, `lab-note-reminder.yml`. **Il n'y a aucun workflow web, admin ou iOS.**

- **`android.yml`** — « the repository's **first** CI workflow (D12) », path-filtered sur `apps/android/**`. ktlint + tests unitaires JVM + `assembleDebug` (artefact `app-debug`) + rendu des écrans en PNG (`ui-screenshots`, Compose Preview Screenshot Testing). C'est du **render-to-view, pas un gate de régression visuelle** : les références sont git-ignorées, rien n'échoue sur un diff visuel. Existe parce que le mainteneur n'a **ni Android Studio ni SDK local** (décision 2026-07-11).
- **`supabase.yml`** — les quatre harnais anon (`drafts`, `visibility`, `public-profile`, `guard`) sont un **gate de merge** sur les PR touchant `packages/supabase/**` **et venant d'une branche du repo** (les PR de fork sautent le job plutôt qu'échouer, faute de secrets), plus un run nocturne contre `main` et un dispatch manuel. Motif de création (#741) : « a PR touching only migrations got two Vercel builds proving the web and admin apps still compile, **which they would with or without any schema change** ». Un run nocturne rouge **ouvre ou commente une seule issue réutilisée** ; un run de PR rouge n'ouvre rien (décision 2026-09-02, #743).
- **`verify-account-purge.ts` n'est PAS en CI** et doit être lancé à la main après tout lot touchant `purge_account`. Raison : c'est le seul harnais qui a besoin de `SUPABASE_SERVICE_ROLE_KEY`, « **this repo is public**, and a leaked service-role key is total database access ». Interdiction explicite de « corriger » cette absence en ajoutant le secret sans en faire une décision.
- **`arkaik.yml`** — valide bundle + journal sur tout changement de `docs/arkaik/**`.
- **`lab-note-reminder.yml`** — **advisory, non bloquant** : commente une PR sans section `## Lab Note` valide ; opt-out par le label `no-lab-note`. Il appelle le workflow réutilisable **du repo Ariko** (`alexisbohns/ariko/.github/workflows/lab-note-reminder.yml@main`). La publication au merge se fait par le webhook de la GitHub App Arkaik, en `deliverable.shipped` idempotent par PR.
- **Il n'y a pas de tâche `test` racine.** `AGENTS.md` : « `npm run dev` / `build` / `lint` — Turborepo, all workspaces (**the only root tasks — there is no root `test`**) ». Vitest sur web, Swift Testing sur iOS, JUnit + previews sur Android, chacun via son workspace.
- **Aucune surface n'a de release publique.** Android est sur internal testing (≤100 testeurs) ; la roadmap store du 2026-07-28 tient v1.0 App Store/Play comme encore à venir, avec dix points produit qui la gâtent tous (« **Maintainer decision: all ten vision points gate v1.0 — nothing here is post-launch** »). Rappel opérationnel resté ouvert : « **flip `WOBBLE_ENABLED` to `'false'` in `android-release.yml` before any public-track promotion** » (décision 2026-07-14, réaffirmée le 2026-08-24 pour Android seul).

---

## REVERSALS

Tout ce qui, dans l'état courant, contredit ou renverse le matériau d'avril–mai 2026.

1. **La suppression annoncée de `apps/web/lib/engine/` n'a pas eu lieu.** La spec du 2026-04-15 (`remote-pebble-engine-slice-1`, §« Anticipated future iterations ») écrivait : « The existing `apps/web/lib/engine/` **is deleted**. » Il est toujours là (542 l.) et sert de repli pour les lignes héritées et les previews non authentifiées (`apps/web/components/pebble/PebbleVisual.tsx:33-38`). *Nuance : ce n'est pas une décision renversée — c'était une itération future « NOT planned, outlined only ».*

2. **`render_manifest` a été supprimé.** L'API de slice 1 promettait `{ pebble_id, render_svg, render_manifest, render_version }` (spec 2026-04-15). La migration `20260429000000_drop_pebbles_render_manifest.sql` a fait tomber la colonne, le JSON et le code moteur qui le produisait (spec `2026-04-29-ios-pebble-stroke-animation-design.md`).

3. **`packages/shared` n'a jamais existé autrement que comme promesse.** `packages/shared/CLAUDE.md` (daté du 2026-04-10 par mtime) annonce la migration des types de `apps/web/lib/types.ts` et des schémas de validation partagés web↔iOS. Cinq mois plus tard : stub, `src/index.ts` = un commentaire. Et la décision du 2026-07-10 l'a rendue interdite sans nouvelle décision : « do not build a codegen/shared-types bridge ».

4. **Le pipeline de types généré n'a jamais été branché sur le web.** `packages/supabase/CLAUDE.md` : « The web app **will** import them via `import type { Database } from "@pbbls/supabase"` **once the dependency is wired**. » Vérifié : `apps/web/package.json` ne déclare pas `@pbbls/supabase`, et `apps/web/lib/supabase/client.ts` construit son client **sans le générique `Database`**. Seul `apps/admin` consomme le paquet.

5. **Le composeur pas-à-pas, retiré le 2026-04-08, est redevenu le défaut sur trois surfaces les 23–24 août 2026.** PR #161 (2026-04-08) : « **The long step-by-step sequence is gone.** » PR #723/#725/#732 (août) : les onze étapes sont le composeur par défaut sur iOS, Android et web, le formulaire tout-en-un devenant le repli derrière un appui long (ou `/record?composer=form`). **Aucune décision ni spec ne nomme ce retournement** ; seule la carte Arkaik le fait, obliquement, dans `V-record-success` : « Revives the celebration beat `V-record-celebration` carried on web **before #161 retired it**. » (§5b)

6. **Le renoncement à l'offline (2026-07-29) durcit l'héritage du prototype d'avril.** Le tag `web-prototype` (2026-04-09) listait « **offline install** » parmi les acquis du prototype local-first ; `apps/web/CLAUDE.md` décrit encore le web comme « a **local-first** PWA ». La décision **2026-07-29 (#620)** tranche : « Offline is **not** a goal on web, iOS, or Android », le service worker garde les requêtes Supabase en **`NetworkOnly`**, et ni l'autosave local ni `pebble_drafts` ne changent cela.

7. **Les trois clients divergent visuellement — assumé, pas subi.** L'ère « cross-surface-alignment » (2026-05-27) décrivait l'alignement web↔iOS comme le programme. Depuis le 2026-08-23 : « **The three clients now diverge visually** — no schema or RPC changed, so nothing is broken, but iOS and Android still render rows; **mirroring them is a follow-up under M58, not a regression to fix blind.** » Et le drapeau wobble a « **deliberately diverged three ways** and should not be 'aligned' » (2026-08-24).

8. **L'expérience wobble a été fermée en trois temps, à rebours de son gating d'origine.** Le 2026-07-13 elle était « **unshippable by construction** » (Debug-only, iOS). Le 2026-07-14 Android la cuit dans les builds internal-testing. Le 2026-08-24 iOS (#727) puis le web (#729) la promeuvent à `true` inconditionnel : « **Wobble is now a shipped visual, not an experiment** — a regression in `WobbleRenderer` reaches users, and the golden-path tests … become **release gates** rather than spike checks. »

9. **La règle iOS « no `if #available` guards » est désormais contredite par le code.** `apps/ios/CLAUDE.md` dit encore « iOS 17 APIs only. No backports, no `if #available` guards. » La décision du 2026-08-24 (#727) a introduit le premier garde (`MeshGradient`, iOS 18+) et le note : « **`apps/ios/CLAUDE.md`'s "no `#available` guards" line is now contradicted by the codebase** and needs rewording at the next monorepo-audit grooming pass. »

10. **La distribution Android a inversé son propre non-goal en trois jours.** La spec bootstrap (2026-07-10) posait « **Play Store distribution** » en non-goal, et l'entrée du 2026-07-11 réaffirmait « Release/signed builds and Play distribution remain out of scope ». L'entrée du **2026-07-13** la renverse explicitement : « Reverses the "Release/signed builds and Play distribution remain out of scope" line of the 2026-07-11 entry. »

11. **« Android keeps its own valence grid » a été superseded le jour même.** Décision 2026-08-24 (#725) → superseded par 2026-08-24 (#729) : « Supersedes the "Android keeps its own valence grid" half … the rest of that entry (**the duplicated draft glue, the Caveat copy**) stands. » (§6a)

---

## Annexe — chemins de fichiers utiles pour l'écriture

**Décisions** — `/Users/alexis/code/pbbls/docs/decisions/log.md` (append-only, supersede-don't-edit ; **la dernière entrée sur un sujet gagne**). Entrées citées ici : 2026-07-10 (l.173), 2026-07-11 Nunito (l.184), 2026-07-11 CI secrets (l.195), 2026-07-13 Play (l.206), 2026-07-13 wobble (l.217), 2026-07-14 wobble Android (l.228), 2026-07-17 Lab Notes (l.239), 2026-07-28 arkaik/admin (l.261), 2026-07-29 offline (l.283), 2026-07-29 drafts (l.305), 2026-07-30 foreign payloads (l.316), 2026-08-23 polaroïd (l.393), 2026-08-23 deux composeurs (l.404), 2026-08-24 wobble Release iOS (l.415), 2026-08-24 Android record flow (l.426), 2026-08-24 éventail Android (l.437), 2026-08-24 éventail web (l.448), 2026-09-02 harnais CI (l.470).

**Moteur** — `packages/supabase/supabase/functions/_shared/engine/` (serveur, Deno) · `apps/web/lib/engine/` (repli client) · `apps/web/lib/config/pebble-geometry.ts` et `apps/ios/Pebbles/Features/Path/Render/PebbleOutlineGeometry.swift` (constantes retapées).

**Wobble** — `apps/ios/Pebbles/Features/Path/Render/Wobble/` · `apps/android/.../features/path/render/wobble/` · `apps/web/lib/wobble/` · fixture `apps/ios/PebblesTests/Wobble/WobbleGolden.json` + générateur `apps/ios/Scripts/generate-wobble-golden.mjs`.

**Path polaroïd** — `apps/web/lib/utils/path-layout.ts` (+ `.test.ts`), `apps/web/components/path/PathWall.tsx`, `PathStone.tsx`, spec `docs/superpowers/specs/2026-08-22-path-polaroid-sandbox-design.md`.

**Record flow** — spec `docs/superpowers/specs/2026-08-23-ios-record-flow-design.md`, plan `docs/superpowers/plans/2026-08-23-ios-record-flow.md`, `apps/ios/Pebbles/Features/Record/`, `apps/android/.../features/path/record/`.

**Audit de parité Android** — `docs/superpowers/specs/2026-07-16-android-parity-audit.md` (179 l., le document le plus dense du corpus sur « ce qui manque et pourquoi »).

**Roadmap store** — `docs/superpowers/specs/2026-07-28-store-launch-roadmap.md` (M45–M57, les dix points qui gâtent v1.0).

**Runbook Play** — `docs/android-play-deploy.md` (212 l., y compris les six étapes de setup console et le tableau de dépannage).

**Journal produit** — `docs/arkaik/journal.jsonl` (926 lignes, 2026-03-26 → 2026-08-24 ; 217 `deliverable.shipped`, 8 `release.tagged`). Les huit tags d'ère sont la meilleure matière narrative disponible : `web-prototype`, `platform-foundation`, `ios-arrival`, `back-office-and-insight`, `cross-surface-alignment`, `M36`, `android-arrival`, `store-readiness`.
