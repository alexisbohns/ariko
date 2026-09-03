---
name: Pebbles
description: Un journal intime où un moment gardé devient un petit galet — fait pour l'habitude d'une seule personne, puis appris à en tenir plusieurs sans devenir ce qu'il avait refusé d'être.
plant: pbbls
---

## Contexte

En 2022, une psychologue me tend un tableau. On le remplit une colonne à la fois :
la pensée, l'émotion, ce qui la contredit. Ce sont les colonnes de Beck,
l'exercice standard des thérapies cognitives, et ça marche. Ce qui ne marche pas,
c'est de les faire sur papier au bout d'une mauvaise journée. L'exercice réclame
l'écriture la plus structurée dont tu es capable, au moment précis où tu en es le
moins capable.

Alors c'est parti sur Notion. Une base d'abord, puis un formulaire guidé le jour où
Notion a sorti les formulaires, pour pouvoir le remplir depuis le téléphone en
rentrant. J'ai partagé le template. Les gens ont trouvé ça très bien. Personne ne
s'en est servi.

[INTENTION? — la lecture n'est pas sourcée. Proposition : l'échec ne portait pas
sur l'exercice mais sur le contenant. À accepter, réécrire ou couper.]

L'automne 2025, c'est la première vraie tentative d'app. Une webapp avec des
comptes, un journal de situations, des émotions et des domaines de vie calqués sur
Apple Health. Ça fonctionnait de bout en bout et c'était pénible à remplir : un
tableau était devenu un parcours de quinze étapes. J'ai abandonné, en notant
pourquoi sur le moment — j'avais construit le client et le modèle de données en
même temps, alors que le modèle bougeait
encore.<!-- src: _digests/apple-journal.md, « First Version » 2026-03-25 -->

[TO VERIFY : tout ce qui précède mars 2026 dans cette section — l'exercice de 2022,
le template Notion et son échec d'adoption, la webapp de l'automne 2025 — ne
survit que dans `00-chronologie.md` et `_digests/apple-journal.md`, tous deux
compilés par un agent en mai 2026 à partir d'un récit personnel et d'entrées Apple
Journal. Aucun de ces primaires n'est dans le repo pbbls ni dans celui-ci : les
citations ne peuvent pas être recoupées avec leurs originaux.]

Le virage a une date. Le 25 mars 2026, au début d'un concours d'apps d'un mois,
j'abandonne le cadrage clinique et j'écris la règle que le produit tient depuis :
ne jamais parler de thérapie. C'est plus simple juridiquement, et c'est plus juste
sur ce que les gens veulent — tu veux parler la langue, pas faire les exercices.
Le même jour pose les références à la place : Duolingo pour des récompenses à la
fois rapides et durables, Polarsteps pour un partage qui mérite d'être regardé, les
cartes Pokémon pour le plaisir tout bête de
collectionner.<!-- src: dev-log 2026-03-25 « Duolingo vs Babel », « Flush Start » -->

La psychologie est restée. Elle a arrêté de se présenter.

## Intention

Pebbles, c'est ce que devient un moment quand tu le gardes. Tu enregistres quelque
chose en quelques secondes — un café avec un ami, un concert, une conversation qui
s'est mal passée — et ça devient un petit galet dont la forme porte l'ampleur du
moment et la façon dont il est retombé, avec à l'intérieur un symbole dessiné à la
main qui dit ce que c'était. Les galets s'alignent le long d'un Path que tu
reparcours. Enregistré en quelques secondes : pas de page blanche, pas de pression,
pas de public.<!-- src: apps/web/lib/i18n/messages/fr.json onboarding.steps.pebble.body -->

Le difficile n'a jamais été d'enregistrer. C'est de revenir. Dès le premier
week-end de travail, la navigation dans l'historique est désignée comme le plus
gros défi du produit, avec sa contrainte accrochée : ni une liste, ni un fil, ni
des stories.<!-- src: _digests/apple-journal.md, 2026-03-25 « End of the week » -->
Trois refus. Et refuser coûte, parce que le feed est le problème résolu et que tout
le reste ne l'est pas.

C'est pour ça que l'économie arrivée plus tard doit se dire clairement : de
l'extérieur, elle ressemble exactement à ce que ce produit disait ne pas vouloir
faire. Le karma, les badges et le marché existent pour récompenser l'habitude et la
faire tenir, pas pour enfermer qui que ce soit. Le karma se gagne en enregistrant,
donc en ayant vécu quelque chose d'abord, et il se dépense en glyphes — de petits
symboles dessinés à la main — qui décorent des souvenirs faits ailleurs que dans
l'app. Le but, c'est de t'envoyer dehors ramasser quelque chose qui vaut la peine
d'être gardé. Le temps passé dans l'app n'est pas la
mesure.<!-- src: spec case-study §4, auteur 2026-09-02 -->

L'onboarding d'avril 2026 en a mis la moitié dans une seule ligne : pas de série à
protéger, pas de feed à scroller. La seconde moitié est tenue absolument, et le
décret qui la tient a été écrit avant la moindre ligne du code qu'il contraint —
pas de feed, pas d'annuaire, pas de recherche, pas de graphe d'abonnés, des
connexions par invitation ou QR uniquement. La première moitié est compliquée, et
c'est la question ouverte en bas de cette page.

## Exécution

La construction se lit en quelques arcs, de l'extérieur. Un prototype navigateur a
tourné jusqu'à fin mars 2026 et s'est refermé en avril. Une app iPhone native
démarre le 12 avril et arrive sur TestFlight en une semaine. Puis, à partir de fin
juin, une économie, une face publique, et un troisième client.

Ce qui suit, c'est le vrai découpage du produit : où il tourne, ce qu'il fait, et
comment il s'est fabriqué.

La webapp, c'est là qu'une fonctionnalité devient réelle en premier. La cadence de
la maison est écrite et suivie — la migration, puis l'implémentation de référence
sur le web, puis iOS, puis Android — pour qu'une forme se discute tant qu'en
changer coûte encore peu.

::entity{ref=pod:pbbls-web}

iOS, c'est là que se règle le niveau d'exigence : comment un galet se dessine,
comment il se pose, ce que ta main sent quand tu finis d'enregistrer. C'est la
surface à l'aune de laquelle on mesure les deux autres, et celle dont le code fini
a servi de référence au portage suivant.

::entity{ref=pod:pbbls-ios}

Android, c'est ce portage — Kotlin et Compose, qui reprennent l'architecture d'iOS
sans en partager une ligne. Six jours entre un module Gradle vide et la parité,
avec au milieu un audit qui s'arrête pour compter ce que six jours n'achètent pas.

::entity{ref=pod:pbbls-android}

Backstage est la surface privée, et la pièce où se joue le goût : dans quelles
teintes se dessine une famille d'émotions, si le dessin envoyé par un inconnu entre
dans la boutique, et à quel prix.

::entity{ref=pod:pbbls-backstage}

Ensuite, ce que le produit fait. L'enregistrement, ce sont les quelques secondes de
bonne volonté que tu as avant qu'un moment cesse de te sembler digne d'être noté.
C'est le territoire le plus refait de tous — y compris une fois dans une direction
qu'il avait déjà abandonnée.

::entity{ref=pod:pbbls-record}

Le galet, c'est l'objet que produisent ces secondes. Une forme pour la façon dont
ça est retombé, un glyphe pour ce que c'était, et une couleur qui n'est nulle part
dans le dessin stocké parce qu'elle s'applique au tout dernier moment.

::entity{ref=pod:pbbls-pebble}

Le Path, c'est le côté lecture, celui qu'on avait désigné dès le premier jour comme
le plus dur. La semaine y est l'unité de mémoire. Pas de recherche, pas de filtre,
aucun moyen de sauter à une date.

::entity{ref=pod:pbbls-path}

Le karma, c'est l'économie : un registre qui autorise la dette exprès, un marché où
rien ne se crée et où aucun dessin n'est jamais copié, et un stock fourni par les
gens qui utilisent l'app plutôt que par un jeu maison.

::entity{ref=pod:pbbls-karma}

Les souls, ce sont les personnes de tes souvenirs, délibérément pas des comptes —
nommer ta sœur dans un galet n'atteint jamais ta sœur. Les domaines, c'est la part
de vie à laquelle un moment appartient, et la taxonomie livrée aujourd'hui n'est
pas celle du départ.

::entity{ref=pod:pbbls-souls}

La couche publique est la plus récente, et presque chaque décision qu'elle contient
porte sur ce que le produit refuse de devenir.

::entity{ref=pod:pbbls-public}

Et l'atelier : les mots choisis et les mots refusés, le jour où ça a cessé d'être
une app de santé, la paperasse qui permet à une seule personne de tenir autant de
surfaces, et une carte du produit qui se tient à jour toute seule.

::entity{ref=pod:pbbls-atelier}

## Résultat

Au 2 septembre 2026, Pebbles tourne sur quatre surfaces : une webapp, une app
iPhone, une app Android et le back-office privé. Elles reposent sur une seule base
Postgres, qui est la seule chose qu'elles partagent ; les modèles et les requêtes
sont écrits à la main sur chaque surface, exprès, et un pont de types partagés est
interdit sans nouvelle
décision.<!-- src: docs/decisions/log.md 2026-07-10 -->

L'économie est en ligne depuis fin juin, et plus rien n'y a été livré depuis le
31 juillet. C'est une pause, pas une fin. Le portefeuille, le marché, la modération
et la curation tournent et se comportent bien ; la boutique a été taillée pour
vendre un second type de bien qu'elle ne vend pas encore ; et le reste du produit a
pris l'été.

La couche communautaire est arrivée fin juillet. Deux personnes peuvent se
connecter par lien d'invitation ou par QR code, et depuis la mi-août un galet peut
être gradé pour qu'une connexion le voie, ou pour que quiconque a le lien le voie.

Le public, c'est une bêta fermée d'environ vingt et une personnes, en croissance
depuis la mi-février 2026.

[TO VERIFY : ce chiffre vient d'un seul rapport d'analytics de bêta fermée daté du
1er mai 2026 (« ~21 users since mid-February »), et `00-chronologie.md` signale
lui-même que ce démarrage à la mi-février est inexpliqué, puisque le build du
concours ne commence que le 24 mars — ces comptes sont peut-être ceux de la webapp
précédente. Rien dans le corpus actuel ne donne un chiffre au 2 septembre 2026.]

Et rien de tout ça n'a de sortie publique. Le web et l'admin se déploient sur
Vercel à chaque push. Android publie un bundle signé sur Google Play internal
testing. iOS se construit sur Xcode Cloud et n'a jamais été soumis à l'App Store.
Chaque « livré » de cette page veut dire livré sur une piste fermée.

## Réflexion

Une décision est à moitié faite quand le code atterrit. L'autre moitié, c'est la
raison, et la raison doit vivre quelque part de greppable, sinon elle se rejoue six
semaines plus tard avec quelqu'un — moi compris — qui ne se souvient plus de
l'argument. Un journal en ajout seul a démarré le 26 mai 2026 exactement pour ça,
avec un test franc de ce qui mérite d'y entrer : est-ce qu'un agent ou un humain
futur perdrait du temps à le redécouvrir ou à le renverser à
tort ?<!-- src: docs/decisions/log.md 2026-05-26 #477 #482 -->
Le rendement de cette habitude, c'est que cette étude de cas peut s'écrire — y
compris les deux pages qui se périment à chaque livraison : ce qui a été coupé, et
ce qui n'a jamais été construit.

::entity{ref=bean:pbbls-cut}

::entity{ref=bean:pbbls-unbuilt}

La deuxième chose, c'est la preuve. La moitié publique du produit s'est construite
en même temps qu'un audit de sécurité et de qualité délibéré, cadré avec Arkaik sur
la couche de données et sur le contrat client. Ce qui en sort est une architecture,
pas une liste : les grades de confidentialité ; une règle de projection où tout ce
qui traverse d'un compte à un autre passe par une fonction portant la liste
explicite de ce qui a le droit de sortir, plutôt que par une table élargie jusqu'à
devenir pratique ; des colonnes de capacité épinglées par un trigger, parce que
posséder une ligne ne donne pas l'autorité d'y élever une capacité ; et des
harnais de contrat qui créent de vrais comptes sur le vrai projet au lieu d'en
simuler un. Le 2 septembre 2026, ces harnais sont devenus une condition de merge,
pour la raison la plus simple qui soit : un contrôle qui ne tourne que quand
quelqu'un y pense n'est pas un
contrôle.<!-- src: docs/decisions/log.md 2026-09-02 #739 #741 ; spec case-study §8 -->

La troisième, c'est qui fait le travail. Chaque commit de ce dépôt est signé par un
humain, et quatre sur cinq portent un agent en co-auteur. Ce qui rend ça tenable,
ce n'est pas le modèle, c'est la paperasse : une spec avant le code et un plan
avant le clavier, une cérémonie proportionnée au rayon d'impact, et une règle
permanente de ne jamais refactorer du code existant sans accord — une règle qui a
coûté au produit un fichier sciemment dupliqué, plutôt qu'une régression discrète
dans du code qui marchait
déjà.<!-- src: _digests/method-current.md §5, §8 -->

Ce qui n'est pas tranché, c'est la première moitié de la promesse d'avril. Pas de
feed à scroller est absolu, et tenu par le schéma. Pas de série à protéger, c'est
une autre histoire : le bounce, le rang de régularité sur une fenêtre glissante,
existe depuis avril 2026, et en juillet il est devenu visible sur un profil public,
à côté d'une échelle de badges qui paie du karma à chaque palier. Le mécanisme n'a
pas changé. Ce qu'il a gagné, c'est un public, et rien dans le journal de décisions
ne le reconnaît.<!-- src: _digests/act3-community-trust.md R2 ; journal PR #675, #677 -->

[INTENTION ? — je n'ai pas trouvé de position sourcée là-dessus. Aucune entrée de
décision, aucune spec, aucune note de PR ne reconnaît la posture anti-série d'avril
en concevant les badges ou le profil public. Proposition : le bounce a toujours été
un rang sur une fenêtre mobile plutôt qu'une chaîne qui casse, donc juillet l'a
rendu social plutôt que punitif — un changement qui mérite d'être nommé, pas une
promesse trahie. À accepter, réécrire ou couper à la relecture.]

Les questions ouvertes qui restent sont plus petites, et nommées là où elles
vivent. Les deux composeurs sont livrés et l'expérience n'a pas de verdict. Un
blocage ne se défait pas depuis l'app. Et le sélecteur de valence te dit toujours
que le moment que tu viens d'enregistrer sera enveloppé dans ton Cairn
hebdomadaire — une phrase tenue par un inconnu, pour une fonctionnalité qui
n'existe pas.
