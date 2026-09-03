---
name: Tout ce que j'ai arrêté de faire
description: Ce que Pebbles a abandonné ou suspendu, avec sa date et sa raison notée — y compris la coupe qui est revenue, en douce, comme réglage par défaut.
date: 2026-09-02
bean: pbbls-cut
---

# Tout ce que j'ai arrêté de faire

Ouvre le projet iOS de Pebbles aujourd'hui : tu y trouveras une extension d'app
qui se compile dans chaque build et ne dessine rien. Elle est inerte depuis le
1er juillet 2026. Le réflexe, c'est de la supprimer. Le réflexe a tort — et la
seule raison pour laquelle on peut le savoir, c'est que le jour où elle s'est
tue, la raison est partie dans un fichier.

Pebbles tient un journal de décisions en ajout seul. Il a démarré le 26 mai 2026
parce que les questions tranchées n'arrêtaient pas de se rejouer : elles vivaient
dans des fils d'issues, très bien pour discuter, inutilisables pour retrouver une
réponse deux fois.<!-- src: docs/decisions/log.md 2026-05-26 #477 #482 -->
La même entrée donne le test d'entrée — *est-ce qu'un agent ou un humain
perdrait vraiment du temps, plus tard, à redécouvrir ça ou à l'inverser à
tort ?* Un relevé de ce qu'on a coupé, c'est ce test passé à l'envers. Ce n'est
pas une liste de regrets. C'est la moitié d'une décision qui survit au code.

Rangé par type de décision, pas par date. Voilà ce qui est sorti.

## Ce que l'appareil a tranché

Le 1er juillet 2026, le flash de karma sur iOS a perdu sa Live Activity. Le plan,
c'était la Dynamic Island : tu gagnes du karma, un « +N » apparaît dans
l'encoche. Sur un iPhone 15 en iOS 26, `Activity.request` répond succès,
l'activité se déclare active — et rien ne s'affiche. Ni dans l'encoche, ni sur
l'écran verrouillé, ni quand l'app passe en arrière-plan pendant la
fenêtre.<!-- src: docs/decisions/log.md 2026-07-01 #505 -->

Ce que la preuve dit, ce n'est pas que l'implémentation était fausse. C'est que
la prémisse l'était. iOS n'affiche pas dans la Dynamic Island la Live Activity
d'une app qui est au premier plan, et dans Pebbles le karma ne se gagne *que* par
une action au premier plan : tu crées un galet, ou tu l'enrichis. La Dynamic
Island n'aurait jamais pu montrer ce flash. Sur aucun appareil, dans aucun build.

Ce qui est sorti à la place, c'est une pastille dans une fenêtre traversante, qui
flotte au-dessus de la feuille où le gain vient d'avoir lieu, avec une vibration
dérivée de l'enveloppe d'amplitude de son propre son de céramique. Et l'extension
est restée. L'achat d'un glyphe est une notification future plausible qui, elle,
*peut* arriver app en arrière-plan — précisément le cas où la Dynamic Island
fonctionne. Donc la cible, le contrôleur et les attributs partagés ont été gardés
comme référence, plutôt que reconstruits de mémoire plus tard.

Deux semaines après, le même genre d'arbitrage est tombé sur le tremblement
pétroglyphe. L'issue qui proposait ce trait à la main recommandait de cuire la
géométrie tremblée au moment du build. Impossible ici, et pour une raison produit
plus que technique : les glyphes sont dessinés par les gens qui utilisent
Pebbles, et s'échangent sur :entity[le marché des glyphes]{ref=bean:pbbls-market}
— au moment du build, il n'y a rien à cuire. Cuire à l'écriture a été envisagé
dans la même entrée, et refusé : il faudrait un redéploiement et un backfill à
chaque retouche du rendu, une mauvaise version se figerait d'un coup sur toutes
les plateformes, et ça raterait quand même toutes les surfaces qui dessinent un
glyphe sans passer par l'image composée.<!-- src: docs/decisions/log.md 2026-07-13 #555 -->
Le tremblement tourne sur l'appareil, et l'accord entre les portages Swift,
Kotlin et TypeScript tient à une fixture de référence, pas à du code partagé.

La même décision a lâché le mode « trait au centre » que l'issue avait spécifié :
un trait tremblé mais tracé au centre garde une largeur constante, et une largeur
qui respire, c'est exactement l'idée.

## La semaine où tout a rétréci

La première coupe est antérieure à l'app. La tentative de l'automne 2025 était
vibe-codée sur SvelteKit avec Codex, et abandonnée pour deux raisons que j'ai
notées à l'époque : je construisais le client et le modèle de données en même
temps alors que le modèle bougeait encore, et j'avais choisi une techno de niche
à un moment où les modèles écrivent du
React.<!-- src: _digests/apple-journal.md, entrée « First Version » (25 mars 2026), rétro sur l'automne 2025 -->

Le week-end du 5 avril 2026 est parti dans un moteur de galet. Pas un petit :
spécifié et implémenté sur toute l'épaisseur du back avant que quoi que ce soit
ne dessine. Lundi, il n'existait plus — *flushed everything*, tiré la chasse, mes
mots à l'époque. Ce qui était mauvais, ce n'était pas le moteur. C'était la
découpe : j'avais construit d'arrière en avant sur toute la largeur au lieu
d'itérer du simple au complexe sur toute l'épaisseur, donc il n'y avait rien à
regarder tant que tout ne marchait pas — et quand ça n'a pas marché, il n'y avait
rien à garder.<!-- src: _digests/apple-journal.md, entrée « Wasted Sunday » (5–6 avril 2026) -->

[TO VERIFY: ce paragraphe, les raisons du sidebar et des Emotion Pearls
ci-dessous, le verdict Moss Pool et la tentative SvelteKit de l'automne 2025
viennent tous du journal de bord d'Alexis, qui ne survit aujourd'hui que sous
forme de `_digests/apple-journal.md` — les entrées HTML d'origine ne sont dans
aucun des deux repos. Le digest les cite verbatim, mais les originaux ne peuvent
plus être relus pour confirmer.]

Deux jours plus tard, un moteur plus simple arrive, à l'intérieur d'une même
passe de soustraction. Dans la foulée : la barre latérale du dashboard saute, au
motif noté que *Pebbles is an app, not a SaaS* — une app, pas un outil de gestion
en ligne — et la navigation devient une carte qui flotte le long du Path. Les
Emotion Pearls
— la perle lumineuse au-dessus de la grille d'émotions, sortie fin mars — passent
en archivé, la raison notée étant de mettre la couleur de l'émotion directement
dans le fill du SVG. Et la longue séquence d'enregistrement pas-à-pas se replie
en un éditeur rapide. Retiens celle-là.

Les perles sont restées archivées. Leur raison, non : l'image composée ne porte
plus aucune couleur aujourd'hui. Tous les fills sont vidés, tous les traits
passés en `currentColor`, et la couleur s'applique par surface, par thème, au
moment du rendu, depuis la palette de la *catégorie*
d'émotion.<!-- src: functions/_shared/engine/compose.ts -->

Le réflexe a continué. Les analytics du back-office sont arrivées sous forme de
POC décrivant une page adossée à des vues matérialisées rafraîchies chaque nuit ;
la spec qui a réellement livré a refusé toute la couche, noir sur blanc :
surdimensionné pour le volume de données, et ça ferait entrer la disponibilité de
`pg_cron`, la sécurité par ligne sur des vues matérialisées et la gestion des
échecs de rafraîchissement dans le rayon d'explosion de la v1. Ce qui est sorti,
ce sont des vues simples calculées à la demande, avec une note : le remplacement
sera mécanique si les temps de requête le justifient un
jour.<!-- src: specs/2026-04-30-admin-analytics-thin-slice-design.md ; le DDL survit sous docs/poc/admin-analytics/ -->

Le 17 juillet, l'app a arrêté de faire semblant de charger. L'écran de lancement
était une animation Rive tenue par un timer en dur — un loader qui ne charge
rien. Il a été remplacé par un logo natif qui se dessine trait après trait et se
pose quand un vrai signal de disponibilité
arrive.<!-- src: docs/decisions/log.md 2026-07-17 #598 -->

Et une seule spec, celle de l'éventail de valence, a jeté une ligne de légende,
un surtitre, une rangée de repères de taille, une ombre portée et une série de
dégradés entre sa première version et la dernière — un dégradé « se lisait comme
un filtre photo », son remplaçant « n'était pas mieux », et le suivant « était
clownesque quelle que soit la façon dont on réglait son
encre ».<!-- src: specs/2026-08-24-ios-valence-fan-picker-design.md, révisions 1–5 -->

## Celui qui est revenu

Le 27 mars 2026, Pebbles sort un composeur qui te fait enregistrer un moment une
question à la fois. Le 8 avril, il est retiré : *the long step-by-step sequence is
gone* — la longue séquence pas-à-pas n'est plus là. Nom, ressenti, gens, pans de
vie, photos, glyphe et collections passent tous dans l'éditeur rapide, sur le
Path.<!-- src: docs/arkaik/journal.jsonl pr-25 (2026-03-27), pr-161 (2026-04-08) -->
En juillet, le composeur quitte au moins la pop-up pour une page à lui.

Les 23 et 24 août 2026, le pas-à-pas redevient le composeur par défaut sur toutes
les surfaces — iOS d'abord, puis Android et le web. Le formulaire tout-en-un est
toujours là, derrière un appui long sur le même bouton ou un paramètre dans l'URL
web. C'est lui, maintenant, le repli.

Rien dans le journal de décisions ne relie les deux. L'entrée d'août défend le
flow uniquement au présent : le formulaire « demande à l'utilisateur de tenir dix
décisions en tête en même temps », et le séquencement permet ce qu'un formulaire
ne peut pas — préremplir la date depuis l'EXIF de la photo avant de la demander,
ordonner les catégories d'émotion selon la valence qu'on vient de choisir, finir
sur le galet composé qui se
trace.<!-- src: specs/2026-08-23-ios-record-flow-design.md ; VO : "asks the user to hold ten decisions in their head simultaneously" -->
Avril n'est pas mentionné. Ni le retrait, ni l'éditeur rapide. Le seul endroit de
tout le corpus qui le remarque, c'est la carte produit, dans la description de
l'écran de succès du flow : elle « fait revivre le temps de célébration porté par
le web avant que #161 ne le retire
».<!-- src: docs/arkaik/bundle.json, nœud V-record-success -->

[INTENTION? — je n'ai pas trouvé de source pour le pourquoi ici ; aucune décision,
aucune spec ne relie août à avril. Proposition : la coupe d'avril était juste
pour avril, et sa raison a expiré — les dépendances de séquencement que la spec
d'août invoque reposent toutes sur un pipeline photo et des surfaces natives qui
n'existaient pas en avril. À accepter, réécrire ou couper à la relecture.]

Le mot officiel pour l'état actuel, c'est *expérience*, et elle n'est pas
tranchée : trancher voudra dire supprimer l'un des deux composeurs et le geste
d'appui long, pas les fusionner.

Pose le cas inverse à côté. Le local-first était la forme fondatrice du prototype
web : tout dans le navigateur, installation hors-ligne comprise. Le 11 avril 2026,
une couche de données est conçue là-dessus et renversée le jour même — Supabase
devient la source de vérité, le hors-ligne complet passe en « différé ». Le 29
juillet, il cesse d'être différé et devient un non-objectif sur toutes les
surfaces. Et la raison de juillet n'est pas celle d'avril. C'est un bug précis :
un 401 mis en cache avant la connexion et resservi après, qui avait déjà prouvé
que mettre ces réponses en cache n'est pas sûr. Alors l'entrée interdit de les
ramener sous la bannière du hors-ligne sans d'abord la superseder. Ce qui
survit : la coquille installable et l'écran hors-ligne. Le non-objectif porte sur
les données.<!-- src: docs/decisions/log.md 2026-07-29 #620 ; specs/2026-04-11-auth-data-layer-redesign.md -->

Une suspension dont la raison s'est renforcée, à côté d'une suspension dont la
raison a cessé de s'appliquer sans que personne ne le dise. Une seule des deux
est écrite quelque part comme un revirement.

## Toujours dans le build, exprès

Le 11 avril 2026, le premier schéma sème cinq domaines de vie aux noms grecs —
Zoē, Asphaleia, Philía, Timē, Eudaimonia — une lecture de Maslow. Quatre jours
plus tard, une migration en insère dix-huit en anglais courant : Community,
Family, Health, Money, Partner, Work et les autres. Son en-tête explique la
partie ingrate sans se dérober : la base distante les avait déjà, ajoutés hors
canal, donc contre le projet en ligne l'insertion ne fait rien, et sur une base
locale neuve elle crée le vrai jeu. Les lignes grecques n'ont jamais été
supprimées. Elles cohabitent, intactes, et une spec de juillet sur l'éditeur de
domaines de l'admin les liste comme des reliquats qu'aucun galet ne référence et
les dit
inoffensives.<!-- src: migrations/20260411000000, 20260415000001, en-têtes ; specs/2026-07-03-admin-domain-management-design.md -->

Maslow a laissé un fossile. Une vue d'analytics calcule encore le niveau d'un
domaine en cherchant son slug dans un tableau de ces cinq noms grecs — ce qui
veut dire qu'elle ne renvoie rien du tout pour les dix-huit domaines dont les
gens se servent vraiment.<!-- src: migrations/20260501000003_analytics_meaning_share.sql -->

Les cards, c'est l'autre, et c'est plus gros. Une card, c'est une des colonnes de
Beck — la pensée, le ressenti, les faits — et elles avaient une étape entière du
record flow d'origine pour elles seules : la colonne vertébrale thérapeutique du
truc, planquée en pleine lumière. Le 9 avril, elles sortent de l'éditeur,
décrites à ce moment-là comme *temporarily discontinued*, temporairement
interrompues.

Au 2 septembre 2026, la table est toujours là, avec ses règles et son index. La
vue de lecture assemble toujours un tableau de cards pour chaque galet. Chaque
fonction qui écrit un galet les efface et les réinsère, et chaque migration qui
réémet ces fonctions — la plus récente date du 17 août — reconduit ce code
intact. Et :entity[le grand livre du karma]{ref=bean:pbbls-wallet} paie toujours
jusqu'à quatre points par galet pour des cards, sur un plafond de
dix.<!-- src: migrations/20260411000003 compute_karma_delta ; 20260817130000 -->

Et tous les composeurs, sur toutes les surfaces, envoient une liste vide. Le web
envoie littéralement `cards: []` ; iOS et Android n'envoient même pas la clé.
Donc quatre des dix points qu'un galet peut rapporter sont réservés à une chose
qu'aucun client ne sait faire.<!-- src: apps/web/components/record/flow/RecordFlow.tsx, QuickPebbleEditor.tsx -->
Le journal de décisions commence le 26 mai et n'y est jamais revenu.

Quelques autres sont restées pour des raisons écrites, et une pour rien du tout.
Le moteur de composition du web avait été condamné dans une spec — *l'existant
`apps/web/lib/engine/` est supprimé* — dans une section étiquetée comme un
aperçu d'itérations futures, pas comme un plan ; il est toujours là, et il dessine
les vieilles lignes et les galets de la page d'accueil non connectée. La colonne
de couleur par émotion est dépréciée en douceur plutôt que supprimée, parce que
des builds iOS déjà livrés la lisent, et une colonne qu'on retire, c'est un build
qu'on casse. Et Moss Pool, un thème jugé « trop médical » en mars, est toujours
l'un des mondes de couleur dans les réglages web ; il a été écarté pour iOS, où
seul Blush Quartz sort, et jamais retiré du
web.<!-- src: specs/2026-04-15-remote-pebble-engine-slice-1-design.md ; apps/web/lib/config/color-worlds.ts ; specs/2026-04-17-ios-color-modifiers-design.md, non-goals -->

[TO VERIFY: est-ce que le verdict de mars sur Moss Pool visait vraiment à le
retirer du web, ou seulement la direction de thème ? Le monde de couleur est
vivant dans le sélecteur web aujourd'hui, donc la note de mars et le code ne
disent pas la même chose.]

Et le cairn du déroulé des semaines, sur le web, a perdu son dessin à un moment
et n'est plus qu'un bouton texte, avec la dépendance Rive et un commentaire sur
« les canvas Rive » toujours posés à côté dans l'arborescence. Rien, ni dans le
journal de décisions ni dans le journal produit, ne dit pourquoi. Celle-là n'est
pas une décision ; c'est l'absence d'une décision, et c'est la seule entrée de
cette page que je ne peux pas sourcer.

## Où ça en est

Le journal est en ajout seul : on supersède, on ne corrige pas. Donc rien de tout
ça n'a été rangé sous le tapis le jour où c'est devenu faux. Un
revirement, c'est une entrée neuve qui pointe vers une ancienne ; une entrée que
personne n'a jamais pointée, c'est une entrée qui tient toujours. Tout ce qui
précède est daté dans ce journal, dans la carte produit ou dans l'en-tête d'une
migration — c'est tout le rendement d'avoir écrit la raison sur le moment, et
c'est pour ça qu'une extension oubliée survit à un coup de balai.

Ce qui reste ouvert, au 2 septembre 2026 : les deux composeurs sont livrés et
l'expérience n'a pas de verdict, et le retour du pas-à-pas reste l'un des rares
vrais revirements de ce produit que personne n'a écrit. Cette page est ce qui
s'en rapproche le plus.
