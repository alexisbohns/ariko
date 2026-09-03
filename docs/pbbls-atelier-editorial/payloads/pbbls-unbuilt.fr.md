---
name: Le Cairn n'est encore qu'une phrase
description: Tout ce que Pebbles a voulu construire et n'a pas construit, rangé selon le degré de réalité de chaque intention — de la promesse imprimée dans l'app jusqu'à l'idée restée dans un prototype.
date: 2026-09-02
bean: pbbls-unbuilt
---

# Le Cairn n'est encore qu'une phrase

Tu enregistres un moment dans Pebbles, et l'app te demande quelle taille il
faisait. Tu prends le plus petit galet, et une ligne t'explique ce que tu viens
de choisir : *ce moment a marqué ma journée, et il sera rangé dans mon Cairn
hebdomadaire.* Tu prends le plus gros, on te promet un Cairn annuel.

Il n'y a pas de Cairn. Il n'y en a jamais eu.

La phrase est dans le produit depuis la sortie du sélecteur de valence, en avril
2026. Elle est encore à l'écran aujourd'hui, dans les feuilles d'édition du
web.<!-- src: apps/web/lib/i18n/messages/fr.json record.valencePicker ; apps/web/components/record/ValenceIntensityGrid.tsx:166 -->
Sur iPhone et sur Android, les mêmes phrases survivent dans les fichiers de
traduction et ne sont plus affichées nulle part — situation différente, et
meilleure.<!-- src: apps/ios/.../Models/Valence.swift:85 ; apps/android/.../res/values/strings.xml:318 -->

Ce que le Cairn devait être est écrit noir sur blanc. Un bilan de semaine : la
semaine se termine, un écran d'intro s'ouvre, tu relis les galets que tu as
posés, tu confirmes, et la semaine s'empile en cairn qui reste. La récompense
passe par les rails de karma existants, sans en inventer d'autres. L'issue qui
le demande a été ouverte le 10 avril 2026, requalifiée le 12 juillet 2026 après
un tri du backlog, et elle est toujours ouverte au 2 septembre 2026.<!-- src: pbbls#220 -->

Elle passe en premier parce qu'elle donne l'échelle de tout le reste. Tout ce qui
n'est pas construit ne l'est pas de la même façon. Une phrase dans l'app, c'est
quelqu'un d'autre qui la tient. Une ligne dans une spec, c'est moi. Un nœud dans
une carte, personne. Cette page est rangée selon cet écart, du plus lourd au plus
léger.

[INTENTION? — je n'ai pas trouvé de source pour le pourquoi de tenir ce registre
en public. Proposition : une chose non construite qui reste écrite est une chose
qu'on peut encore discuter, là où une chose non construite qui disparaît en
silence ne se discute plus. À accepter, réécrire ou couper à la relecture.]

## Écrit dans le produit, et pas construit

Le Cairn n'est pas le seul.

La politique de confidentialité servie sur `/docs/privacy` décrit un produit plus
large que celui qui existe. Elle a une section sur l'accès thérapeute, avec des
permissions fines que tu accordes et que tu révoques. Elle définit les Décisions
— des évaluations d'impact émotionnel, notées sur une échelle. Elle a une section
sur les Cairns comme agrégats anonymisés, hebdomadaires et mensuels.<!-- src: apps/web/docs/privacy/fr.md ; en.md:49,51,59,139,214 -->
Rien de tout ça n'est dans l'app. La feuille de route boutique du 28 juillet 2026
programme déjà la réécriture, et appelle ces sections par leur nom : fictives.<!-- src: docs/superpowers/specs/2026-07-28-store-launch-roadmap.md §M56 -->

Ce texte a été écrit quand Pebbles était encore un outil adjacent à la thérapie,
position que le produit a quittée délibérément. Les mentions légales sont le
dernier texte d'un produit à s'apercevoir que quelque chose a changé, parce que
rien ne casse dans le build quand elles vieillissent. C'est exactement pour ça
qu'elles sont en haut de cette page et pas en note de bas : c'est la seule
catégorie ici où la promesse est tenue par quelqu'un d'extérieur au projet.

Un détail de la copie de valence mérite d'être gardé. Elle promet un Cairn
hebdomadaire, un mensuel et un annuel. La carte produit n'en a jamais imaginé
qu'un hebdomadaire et un mensuel.<!-- src: docs/arkaik/bundle.json, nœuds F-weekly-wrap, F-monthly-wrap -->
Le Cairn annuel n'a jamais été conçu du tout. Il existe dans une phrase, dans un
fichier de traduction, et nulle part ailleurs.

## Spécifié, et pas livré

Ouvre un glyphe au marché sur iPhone ou sur Android : le tiroir te dit quand il a
été taillé, ce qu'il coûte, et ce que tu as en poche. Le reste du tiroir est
inerte — combien de gens possèdent ce glyphe, combien de fois il a servi, qui l'a
dessiné. Chacune de ces cases dit *Soon*.<!-- src: docs/superpowers/specs/2026-07-01-issue-507-glyph-swap-ios-design.md §Placeholders -->

La raison est écrite dans la spec qui les a livrées. Certaines de ces valeurs
sont des agrégats inter-utilisateurs derrière les règles de sécurité au niveau
des lignes, une autre est derrière des règles de profil réservées au
propriétaire : rien de tout ça n'est bon marché pour un client. La fonctionnalité
entière a été conçue pour ne demander ni migration ni nouvelle fonction, et
garder la mise en page avec des cases vides dedans, c'était le prix. La spec va
plus loin et décrit la suite exactement : une fonction de détail en
`SECURITY DEFINER`, additive, qui se glisse dans le même code de vue. Elle n'a
pas été écrite.

Même forme, enjeu plus lourd, du côté des blocages. Le blocage est sorti avec
:entity[les connexions]{ref=bean:pbbls-connections} le 30 juillet 2026, parce que
les règles d'Apple l'exigent au lancement, et il fonctionne : dirigé, vérifié
dans un sens comme dans l'autre, jamais révélé à la personne bloquée. Ce qui
n'est pas sorti, c'est l'écran pour en défaire un. L'entrée de décision note la
conséquence elle-même : jusqu'au jalon conformité, un blocage accidentel ne se
répare que par la suppression d'une ligne avec les droits de service.<!-- src: docs/decisions/log.md 2026-07-30 #658, Consequences -->
Traduction : quelqu'un avec les accès opérateur enlève la ligne à la main.

Ces cas-là sont du même degré, et c'est un degré honorable. Le travail est
spécifié, le coût de ne pas le faire est écrit juste à côté de ce qui l'a causé,
et ni l'un ni l'autre n'a été découvert par un utilisateur qui se plaint.

## Annoncé comme un futur

La boutique a été bâtie pour vendre autre chose que des glyphes. La spec du
portefeuille le dit dès son premier paragraphe : les rails sont la fondation sur
laquelle le reste de la boutique dépensera, et rien là-dedans ne code en dur
« glyphe » comme la chose achetée. La spec du marché range les thèmes et les
habillages de galets dans le hors-périmètre. La décision qui a fermé le marché
dit que les nouveaux biens réutilisent la forme de l'achat : valider le listing,
dépenser le karma, accorder le droit d'usage, une seule transaction.<!-- src: specs 2026-06-29-issue-494 §Scope, 2026-06-30-issue-496 §8 ; docs/decisions/log.md 2026-06-30 -->
:entity[Un seul registre]{ref=bean:pbbls-wallet} volontairement générique,
:entity[un chemin d'achat]{ref=bean:pbbls-market} taillé pour un deuxième bien.
La boutique vend toujours une seule sorte de chose.

La rémunération des créateurs en est au même point. Une vente crédite le
propriétaire du glyphe du prix entier, en karma, dans la transaction même où
l'acheteur dépense : un transfert, pas une création de monnaie. Le journal note
qu'un modèle de royalties partirait de la même colonne de propriété, celle qui
porte déjà :entity[la paternité]{ref=bean:pbbls-d8}. Ce travail n'a pas
commencé.<!-- src: docs/decisions/log.md 2026-07-01 #497, Consequences -->

Au-dessus de tout ça, il y a la feuille de route elle-même, datée du 28 juillet
2026 : le seaming des âmes, les galets appariés, les notes chiffrées côté
serveur, et les lots de conformité — avec dix points de vision qui gâtent une
v1.0 publique, et rien de repoussé à l'après-lancement. Chaque jalon reçoit son
document de conception quand il démarre, et au 2 septembre 2026, aucun de
ceux-là n'en a.<!-- src: docs/superpowers/specs/2026-07-28-store-launch-roadmap.md §1, §3 -->
La chose la plus ordinaire de cette liste est celle qu'il faut nommer : il n'y a
ni réinitialisation de mot de passe ni changement d'adresse e-mail, sur aucune
surface.

Pourquoi rien de tout ça n'est fait ? C'est banal : l'été est parti ailleurs.

## Les manques, trouvés exprès

Le 16 juillet 2026, le portage Android a été audité contre iOS, fichier par
fichier, sur tous les domaines. Chaque manque annoncé a été attaqué au grep sur
l'arbre entier avant d'entrer dans le document, et aucun ne s'est révélé
faux.<!-- src: docs/superpowers/specs/2026-07-16-android-parity-audit.md, en-tête -->
Ce qui suit, c'est la sortie de cet audit, toujours ouverte.

Le point de fond, c'est Sign in with Apple. Android a l'e-mail et Google ; il n'a
pas Apple. Quelqu'un qui a créé son compte sur iPhone avec un identifiant Apple
n'a aucun moyen d'entrer dans le build Android — pas un moyen dégradé : aucun.
L'audit le classe comme l'élément d'authentification à plus forte valeur, et le
dimensionne comme un petit portage sur un chemin qu'Android emprunte déjà pour
Google. L'issue est ouverte depuis le jour de l'audit.<!-- src: audit de parité §3 Entry funnel ; pbbls#570 -->

Le reste est cosmétique, et tout est encore vrai. Le lanceur, sur la piste
interne, affiche l'icône système par défaut, faute de source de design en
calques. L'onboarding rend des surfaces vides à la place des illustrations, et
les images attendent leur export dans le catalogue d'assets iOS. Le cairn du
rouleau de semaines est un drawable statique, là où l'iPhone fait tourner une
machine à états Rive. Et le flash de karma vibre sur Android sans sonner : le son
céramique et l'haptique à enveloppe sont des écarts nommés, et le fichier son
n'a jamais été recopié.<!-- src: apps/android/CLAUDE.md ; apps/android/.../SlideToConfirm.kt:74 -->

Un audit qui produit une liste aussi précise est un audit qui fonctionne.

## Toujours ouvert

Une question est ouverte depuis plus longtemps que tout le reste de cette page.

Le bounce, c'est le signal de régularité : un rang sur une fenêtre glissante de
28 jours, sorti le 1er avril 2026. À la mi-mai, un prototype a demandé quoi en
faire, et a bifurqué. Path A gardait les 28 cases et ne faisait varier que la
métaphore visuelle : grille de calendrier, cairn, champ de rides,
chemin de pierres. Path B prenait du recul et demandait si un niveau discret
était le bon modèle mental, en esquissant une jauge continue avec un plafond sain
au-delà duquel plus n'est pas mieux. [Path A et Path B n'ont rien à voir avec le
Path que tu fais défiler ; la collision de vocabulaire est malheureuse, et elle
est de moi.]

Ni l'un ni l'autre n'a été choisi. Ce qui s'est passé, c'est que les Ripples sont
sortis la même semaine — un badge d'anneaux sur la même fenêtre glissante,
toujours discret, toujours un niveau — et que le bounce est resté exactement où
il était : dans la base, dans les analytics, et sur le profil. L'un et l'autre
sont sur le profil public aujourd'hui, l'un au-dessus de l'autre. Donc Path A a
été pris dans les faits, dans l'un de ses costumes, et Path B n'a jamais reçu de
réponse.

[TO VERIFY: `bounce-explorations.html` (15 mai 2026) n'est pas dans le dépôt
pbbls en lecture seule. Le partage Path A / Path B est consigné dans
`00-chronologie.md` et détaillé uniquement dans `brouillons/B5`, un brouillon
écrit par un agent en mai 2026 — donc pas une preuve de ce que j'ai conclu. La
lecture ci-dessus — les Ripples ont réglé Path A dans les faits sans trancher
Path B — vient de moi et du code livré, pas d'une affirmation des sources.]

La carte produit est l'autre registre ouvert, et c'est le document le moins
fiable de cette page. Vingt-trois de ses nœuds sont encore au statut `idea`. Neuf
d'entre eux sont le Cairn : les flux de bilan hebdomadaire et mensuel, leurs
écrans d'intro, de relecture et de résultat, et le modèle de données
dessous.<!-- src: docs/arkaik/bundle.json, instantané du 2026-08-24 -->
Les endpoints du cairn, juste à côté, sont marqués archivés — la carte se
contredit elle-même sur la question de savoir si la fonctionnalité est abandonnée
ou seulement en attente.

Et le reste de ce compte n'est pas fiable. Des nœuds encore marqués `idea`
décrivent des fonctions en production depuis avril. L'instantané local a cessé
d'être la carte que les agents lisent le 28 juillet 2026, quand le graphe est
passé sur un service hébergé, et il a dérivé depuis. Le résumé honnête, c'est que
le registre de ce qui n'est pas construit est le registre le moins tenu du dépôt.
Ce qui est logique : rien ne casse quand il a tort.

## Où ça en est

Au 2 septembre 2026 : une promesse de Cairns est à l'écran et dans la politique
de confidentialité, et aucun Cairn n'existe. Les vrais chiffres du tiroir de
glyphe, et un moyen de défaire un blocage sans opérateur, sont spécifiés et non
écrits. Un deuxième bien pour la boutique et un modèle de rémunération des
créateurs sont annoncés comme futurs dans les specs qui leur ont fait de la
place. La liste de l'audit Android est intacte, et un de ses points ferme la
porte d'une vraie app à de vraies personnes. Et la plus vieille question ouverte
reste de savoir si un score de régularité doit être un niveau.

Je ne mettrai de date sur aucun de ces points.

La seule chose que je défendrais dans cette liste, c'est son ordre. Ce qui sépare
son haut de son bas, ce n'est pas la quantité de travail qui reste — le Cairn est
un jalon, l'icône Android est un après-midi. C'est qui tient la promesse. Une
phrase dans l'app a fait d'un inconnu le créancier. Un nœud dans une carte ne
coûte rien à personne, moi compris, et c'est précisément pour ça que la carte en
est pleine et que l'app ne l'est pas.
