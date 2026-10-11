---
name: Cinq façons de tenir une semaine
description: Une soirée de design sur le Path de Pebbles, le 11 octobre 2026 — de deux affichages qui ne me plaisaient pas, en passant par cinq directions et deux synthèses explorées par des agents Claude, jusqu'à la Marge aux pierres éclairées.
date: 2026-10-11
kind: essay
about:
  - bean:pbbls-polaroid-wall
  - bean:pbbls-render
  - pod:pbbls-path
artifact: https://claude.ai/artifact/YWnrBsWLbbkTTkZ3ra561z
---

# Cinq façons de tenir une semaine

Ouvrez Pebbles sur le web : une semaine de votre vie y est un mur de polaroïds.
Des cartes blanches, une pierre qui dépasse du bord supérieur de chacune, des
noms dans une police manuscrite, une légère inclinaison au passage du pointeur.
Ouvrez-le sur iPhone ou sur Android : la même semaine est une liste de lignes.
Le 11 octobre 2026, aucun des deux ne me satisfaisait, pour des raisons
opposées, et j'ai passé la soirée à chercher à quoi une semaine devrait
ressembler à la place.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §1, §2 (scratchpad de session 5e6e8339…/scratchpad/) -->

## Ce qu'était le Path ce matin-là

Le Path est l'écran où s'étale une semaine de pebbles. Sur le
web, c'est :entity[le mur de polaroïds]{ref=bean:pbbls-polaroid-wall} depuis le
jalon M58 (issue #720, août 2026) : une carte blanche par pebble, la photo bord
à bord, le nom dans la police manuscrite Caveat, les avatars des âmes, deux
colonnes.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §1; apps/web/components/path/PathPolaroid.tsx, PathWall.tsx -->

Sur iOS et Android, qui se reflètent à l'identique, ce sont des lignes : une
vignette de pierre de 56 pt (96 pt à l'intensité 3), le nom, « MARDI · 14:32 »
en petites capitales et, s'il y a une photo, un instantané de 64 pt incliné, à
droite.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §1; apps/ios/Pebbles/Features/Path/Components/PathPebbleRow.swift -->

La pierre elle-même venait de diverger d'une surface à l'autre. Depuis le 27
septembre (PR #975), chaque écran iOS dessine une pierre éclairée, matérielle,
avec des shaders Metal : lave pour un moment bas, galet de rivière pour un
moment neutre, gemme pour un moment haut, le glyphe gravé dedans, la lumière
qui suit l'inclinaison du téléphone sur la page de détail. Le portage Android
et web n'avait pas commencé. La direction que j'avais posée alors : « le client
dessine le pebble, le serveur ne garde que le glyphe » — c'est là que le sujet
touche :entity[le rendu d'un pebble]{ref=bean:pbbls-render}.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §1 -->

Trois jours plus tôt, le 8 octobre, un audit stratégique avait posé un cadre.
Il positionne Pebbles comme « la mémoire privée de votre vie avec les gens qui y
sont », avec pour étoile polaire « la vie avec cinq personnes, pas diffusée à
cinq cents ». Il désigne l'esthétique de la pierre et les âmes comme des forces
à protéger, met au programme un livre annuel imprimé (le Cairn) et un Cairn
hebdomadaire, et exclut les mécaniques de fil d'actualité, la publicité et tout
ce qui ressemble à de la gamification. Les deux choses qu'il demande de
protéger, la pierre et les âmes, sont justement les deux que le Path met à
l'écran.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §1 (audit stratégique, 2026-10-08, artifact privé) -->

## Précieux, et bon marché

Voici le message par lequel j'ai ouvert la session (je l'ai écrit en anglais) :

> Je suis très insatisfait de l'affichage polaroïd de l'app web, et très
> insatisfait de l'affichage en lignes des apps mobiles. […] Ce qui ne me plaît
> pas dans les lignes, c'est que ce n'est pas assez « précieux » ou
> « collectionnable » ; les polaroïds sont bien mieux. Mais les polaroïds font
> bon marché, il y a quelque chose de très amateur dans le design : entre
> interface (sans âme) et skeuomorphique (pas réaliste). Les pebbles sont moches
> sur le web comparés à iOS, mais je me demande encore si le super design qu'on
> a façonné sur iOS est une bonne idée.

Les deux reproches tirent en sens contraire : les lignes ne sont pas assez
précieuses ; les polaroïds le sont davantage et font bon marché, coincés entre
interface et skeuomorphisme. Et sous les deux, un doute sur la pierre éclairée
d'iOS.

J'ai demandé à l'agent orchestrateur, une session Claude Code, de briefer cinq
sous-agents Opus sur « 5 directions totalement distinctes, audacieuses,
abouties, ambitieuses, uniques, singulières, fidèles à la philosophie de
Pebbles ».<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §2 -->

## Le brief

L'orchestrateur a rédigé un brief unique, commun aux cinq agents. Chaque pebble
devait montrer la pierre avec son glyphe, le nom, la date et l'heure, et les
âmes. Une photo devait apparaître dans son propre format (portrait 2:3, paysage
3:2, carré, 16:9) et ne jamais être recadrée dans un cadre uniforme sauf si
l'agent le défendait. Un pebble sans photo devait paraître aussi voulu qu'un
pebble avec. Intensité et valence devaient se lire. La mise en page devait tenir
de zéro à vingt pebbles, à 390 px d'abord, puis à 900 px et au-delà, en clair et
en sombre. Chaque agent devait prendre position sur le rendu de la pierre
éclairée. Et une ligne : « Ne produis PAS de polaroïd, de liste de cartes, ni de
carte sociale générique. »<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §3 -->

Tous ont travaillé sur la même semaine de test, du lundi 5 au dimanche 11
octobre 2026 : onze pebbles, cinq âmes (Mara, une compagne ; Elio, un fils de
six ans ; deux amis ; Bruno, un chien), cinq photos en quatre formats, d'un
anniversaire sur un toit en 16:9 à un portrait de Mara sur la digue. Six pebbles
n'avaient pas de photo : la première dent d'Elio, le loyer qui augmente, une
nuit sans sommeil à 03:10, un non à un projet en plus, un appel avec mamie qui
s'est tu, Bruno endormi sur mes pieds.

Les agents ont reçu de vrais éléments, pas des substituts : les silhouettes de
contour d'iOS, les formes du moteur, six glyphes de seed, les sept palettes
d'émotions et les photos de sandbox de l'app web. Ils y ont relevé deux
problèmes en route : dans `large-neutral.svg`, le contour n'est pas le premier
tracé, et les glyphes de seed `identity` et `travel` sont le même dessin. Chaque
agent a livré un `index.html` fonctionnel de toute la semaine et une note de 900
mots au plus.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §3, §4 -->

## Cinq directions, volontairement éloignées

L'orchestrateur a attribué les cinq métaphores ; les agents ont tourné en
parallèle, chacun pendant 17 à 28 minutes et 200 000 à 280 000 tokens.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §4 -->

**La Vitrine** (*The Vitrine*) fait de la semaine un tiroir de cabinet de collectionneur
(« Tiroir 41 · 5–11 octobre 2026 ») et de chaque pebble un spécimen dans un
plateau ajusté : la pierre dans une empreinte découpée à sa silhouette, la photo
en planche numérotée à son propre ratio, une étiquette de musée à double filet
avec un numéro d'inventaire (2026.41.7). Références : Deyrolle, le Pitt Rivers
Museum, Naturalis, les boîtes Riker. Elle garde la pierre éclairée, sous une
seule lumière de cabinet. Ses propres doutes : un tiroir de vingt pebbles est
long, et « lowlight, medium » à côté d'un moment de deuil sonne
clinique.<!-- src: ../sources/2026-10-11-feed-redesign/vitrine-DIRECTION.md -->

**Le Lit de rivière** (*The Riverbed*) dessine la semaine vue d'en haut en gravier ratissé : le
lundi en amont, le dimanche en aval, chaque jour un bief entre deux radiers, les
pierres à leur taille relative réelle (90, 128 et 178 px sur téléphone) avec les
lignes du râteau qui s'écartent autour, une photo en bassin creusé dans le sol à
ses proportions exactes. Références : Ryōan-ji, les bassins de Carlo Scarpa à la
tombe Brion, les cartes Swisstopo, Andy Goldsworthy. Il garde la pierre éclairée
— « la pierre est la seule chose qui a un corps, tout le reste est un trait
d'encre fin ». Toucher une pierre envoie des ondes à travers le lit. Ses doutes :
environ 4 800 px de défilement sur téléphone pour onze pebbles, et le coût du
dessin.<!-- src: ../sources/2026-10-11-feed-redesign/riverbed-DIRECTION.md; ../sources/2026-10-11-feed-redesign/FACTS.md §4 -->

**Le Journal** (*The Journal*) compose la semaine comme un cahier du Cairn imprimé, lu pendant
qu'on le met en page : une page de titre, les personnes de la semaine avec leurs
numéros de page, la table des matières, des entrées sur de vraies pages 2:3. La
pierre est un sceau d'encre, et la valence est la façon de l'imprimer : aplat,
trait ouvert ou hachures, d'après le relief et le creux de la gravure de sceaux
chinoise. Autres références : Tschichold, Irma Boom, *Apartamento*. Sur la
pierre, il écrit : « J'ai essayé une pierre éclairée en SVG et elle ressemblait
à un biscuit biseauté, le même problème de déguisement que les polaroïds. » Le
rendu Metal serait réservé à l'entrée ouverte et à un frontispice par livre
imprimé. Son doute : la pagination, c'est de la vraie composition.<!-- src: ../sources/2026-10-11-feed-redesign/journal-DIRECTION.md -->

**Le Jeu de cartes** (*The Deck*) fait de chaque pebble une carte au format 7:12 du tarot,
avec une bordure imprimée, un index de coin répété tête-bêche, une fenêtre
d'image 2:3 et, pour un pebble sans photo, une « figure » dont toute
l'illustration est la pierre. Des tranches peintes, plus épaisses pour les
moments lourds, montrent où la semaine a pesé. Références : le Tarot de
Marseille, la Bicycle 808, les hanafuda, les tranches colorées de Smythson. Il
imprime la pierre à plat en deux encres et garde le rendu pour la carte qu'on
soulève. Ses doutes : des images plus petites (une bande paysage d'environ
225 px de large sur téléphone), feuilleter est plus lent que balayer du regard,
et un bagage de cartes à refuser (le swipe pour juger, les paquets, la
rareté).<!-- src: ../sources/2026-10-11-feed-redesign/deck-DIRECTION.md; ../sources/2026-10-11-feed-redesign/FACTS.md §4 -->

**La Constellation** (*The Constellation*) organise la semaine par qui était là. Chaque personne est
un fil, le mien la ligne continue au milieu ; un pebble est un nœud où
convergent les fils des personnes présentes ; une photo pend au nœud par ces
mêmes fils. Références : l'atlas céleste de Cellarius, le plan du métro de
Londres de Harry Beck, Chiharu Shiota, *async* de Ryuichi Sakamoto. Elle garde
la pierre éclairée à l'échelle d'une perle, sans animation. Ses doutes :
environ 5 350 px sur téléphone, des couloirs espacés de 13 px qui
s'emmêlent dès six personnes régulières, et une semaine solitaire et clairsemée
qui pourrait sembler jugée.<!-- src: ../sources/2026-10-11-feed-redesign/constellation-DIRECTION.md; ../sources/2026-10-11-feed-redesign/FACTS.md §4 -->

L'orchestrateur a capturé les cinq à 390 et 1280 px, les a publiées dans un
artifact privé qui les rassemble, et a donné sa lecture : le vrai partage était
entre objets et page. La Vitrine, le Lit de rivière et la Constellation gardent
la pierre éclairée et lui donnent ce qui lui manquait sur le web, un sol et une
seule lumière. Le Journal et le Jeu de cartes l'impriment à plat et gardent le
rendu pour le moment où l'on ouvre un pebble. Les deux camps étaient honnêtes,
ce que le polaroïd n'était pas. Il recommandait le Journal comme Path sur les
trois surfaces, avec le Lit de rivière en challenger.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §4 -->

## Ce que j'ai gardé de chacune

Je n'ai pas suivi la recommandation. J'ai pris des morceaux :

> J'aime l'idée de sommaire du Journal : les personnes de la semaine et la
> simple table des matières sont parfaites pour introduire une semaine passée.
> J'adore le fond du Lit de rivière, qui va bien avec la frise, mais je me
> demande si ce n'est pas un peu difficile à implémenter ; et puis les pierres
> sont trop grosses et l'ensemble est très brouillon sur mobile. J'aime aussi les
> transitions par jour, comme une couture, et l'animation d'onde quand on touche
> une pierre. J'adore absolument le design des cartes du jeu, mais il reste le
> même problème : les photos portrait tombent parfaitement, mais aucune forme
> géométrique n'apparaît par rapport aux autres ; alors que les photos paysage
> et carrées ne tombent pas très bien, donc on pourrait envisager des cartes de
> tailles différentes, ce n'est pas un problème, je crois, en fait. Le
> placeholder des cartes sans photo est intéressant, mais pourrait aussi être
> compacté pour éviter des cartes vides trop grandes. J'adore la frise de la
> Constellation, mais je suppose qu'elle ne convient pas (si on enregistre des
> pebbles avec 14 personnes par exemple). Cela dit, la frise est chouette, et on
> pourrait peut-être avoir le pebble sur la frise, et la carte du jeu s'il y a
> une photo, sinon juste le nom, l'heure et les personnes.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §5 -->

Rien n'a été gardé entier : l'ouverture du Journal sans sa pagination, le sol
du Lit de rivière sans ses tailles de pierre, la carte du Jeu à la mesure de la
photo, la frise de la Constellation sans un fil par personne. J'ai demandé deux
agents de plus pour assembler tout ça.

## Deux synthèses, une même forme

L'orchestrateur a traduit ces choix en une forme : l'ouverture du Journal ; une
seule frise verticale, la mienne ; le sol du Lit de rivière rendu peu coûteux,
avec des coutures entre les jours ; la pierre sur la frise entre 36 et 72 px ;
avec une photo, une carte du Jeu dont la hauteur suit la photo ; sans photo, une
entrée compacte, sans cadre ; une onde au toucher ; d'une à quatorze personnes
sur un pebble. Il a donné aux deux agents des positions opposées, l'un penchant
vers le paysage, l'autre vers la page.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §6 -->

**Le Ruisseau** (*The Stream* ; environ 26 minutes, 311 000 tokens) fait couler une bande de
gravier ratissé au centre de l'écran, à la manière d'un karesansui. Un premier
essai, avec une bande pâle et une ligne centrale, « se lisait comme une route
avec son marquage au sol » et a été abandonné. Les pierres sont éclairées, de 44
à 70 px, sur l'eau, et les cartes pendent en dessous. Dans les personnes de la
semaine, chacune porte une bande de sept points pour les jours où elle apparaît.
Ses doutes : la bande peut ne pas se lire comme de l'eau, et l'heure est dite
trois fois par pebble.<!-- src: ../sources/2026-10-11-feed-redesign/stream-DIRECTION.md; ../sources/2026-10-11-feed-redesign/FACTS.md §6 -->

**La Marge** (*The Spine* ; environ 18 minutes, 263 000 tokens) pose la frise
comme la marge d'un livre : une ligne qui descend à gauche, les pierres dessus à
30, 40 et 52 px en sceaux d'encre plats dans un à trois cercles ratissés, chaque
jour une couture en trait fin avec des dents de radier et la date dans la marge.
Une photo accroche une carte du Jeu à sa pierre, et la carte abandonne son
propre grand sceau, puisque la pierre sur la ligne en est déjà un. Un pebble
sans photo est composé en texte, sans cadre, la valence en graisse ou en
italique. Sur grand écran, cela devient une double page : l'ouverture épinglée
sur la page de gauche, la ligne dans le petit fond. Toucher envoie trois ondes
en forme de pierre à travers le sol. Références : les notes marginales de
Tschichold, les sceaux zhuwen et baiwen, Ryōan-ji, le Tarot de Marseille, les
vergeures du papier vergé. Ses doutes : le sol est à la limite du visible et
pourrait se lire comme du veinage de bois, les coins des cartes répètent le jour
et la pierre déjà montrés dans la marge, et la marge de 82 px laisse des photos
d'environ 250 px de large sur téléphone.<!-- src: ../sources/2026-10-11-feed-redesign/spine-DIRECTION.md; ../sources/2026-10-11-feed-redesign/FACTS.md §6 -->

L'orchestrateur a recommandé la Marge, en empruntant au Ruisseau la bande de
sept points et une pierre qui ne s'allume que le temps d'être touchée. La
question qu'il laissait ouverte : la pierre éclairée a-t-elle sa place dans la
liste ?<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §6 -->

## Le verdict

> La Marge est vraiment une leçon de maître. Je crois que je ne prendrai que le
> rendu réaliste des pierres + les 7 cercles pour la semaine dans les personnes
> de la semaine, tous deux venant du Ruisseau.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §7 -->

Cela répondait à la question ouverte, et contre la note de la Marge elle-même,
qui soutenait qu'entre 30 et 52 px « un rendu éclairé devient une perle
biseautée qui avale le glyphe ». J'avais commencé la soirée en doutant de la
pierre d'iOS. Je l'ai finie en gardant la pierre éclairée, dans la liste, sur
la ligne.<!-- src: ../sources/2026-10-11-feed-redesign/spine-DIRECTION.md -->

Dans le même message, j'ai demandé un agent Opus de plus pour construire
l'itération finale, et un second pour écrire ce récit.

## Où on en est

L'itération finale est la Marge avec deux éléments du Ruisseau. Un agent
constructeur l'a faite en environ 16 minutes et 285 000 tokens ; l'orchestrateur
l'a vérifiée à 390 px réels et à 1280 px, dans les deux thèmes, et l'a ajoutée à
l'artifact privé sous « The final ».<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §8; rapport du constructeur via l'orchestrateur -->

Les pierres sur la ligne de marge sont désormais les pierres éclairées : lave,
galet de rivière ou gemme selon la valence, le glyphe gravé, une seule lumière,
une ombre douce, les cercles ratissés conservés. Elles ont grandi, parce qu'aux
tailles de la Marge la gravure ne se lisait pas : 34, 44 et 54 px de large sur
téléphone, 40, 52 et 58 sur grand écran, aucune au-delà de 69 px de haut. La
règle retenue : « l'objet vit sur la ligne, l'imprimé vit dans la
typographie ». Une pierre n'est éclairée que là où on peut l'appuyer, et la
table des matières garde les sceaux d'encre plats de la Marge. Les personnes de
la semaine portent la bande de sept points `L M M J V S D`, qui remplace les
numéros de jour, puisque les points disent la même chose.<!-- src: ../sources/2026-10-11-feed-redesign/final-DIRECTION.md -->

Deux des doutes de la Marge ont été travaillés. Les coins des cartes gardent un
seul index (jour et jour de la semaine, en haut à gauche) et un seul rail heure
et émotion ; le double tête-bêche et le pip de pierre disparaissent, puisque la
pierre éclairée est à 40 px. Le sol a été redessiné en six sillons sinueux
régulièrement espacés, chacun une ligne d'ombre doublée d'une ligne de lumière,
sur un grain de papier fin, pour qu'il se lise comme ratissé et non comme du
veinage de bois. Toucher une pierre garde l'onde et ajoute un éclat dont la
force suit la matière : 1 pour une gemme, 0,62 pour un galet, 0,34 pour la lave,
avec un reflet fixe quand les animations sont réduites. La construction a aussi
corrigé un bug de la maquette de la Marge : un nom de variable CSS entrait en
collision avec la couleur ombrée de la palette, si bien que les pierres se
plaçaient en haut de chaque entrée au lieu de se poser sur le trait qui les
relie à leur carte.<!-- src: ../sources/2026-10-11-feed-redesign/final-DIRECTION.md; rapport du constructeur via l'orchestrateur -->

Rien n'a changé dans les apps Pebbles le 11 octobre. Les maquettes sont des
approximations en HTML, CSS et SVG ; leurs pierres sont en SVG, pas le rendu
Metal. Aucun changement de la carte produit, pas de Lab Note, pas de pull
request.<!-- src: ../sources/2026-10-11-feed-redesign/FACTS.md §9 -->

Ce qui reste ouvert, au 11 octobre 2026 :

- **L'implémentation sur trois surfaces.** La note finale estime les pierres,
  l'éclat, le sol, les coutures, l'onde et la bande à deux jours sur le web, un
  jour et demi sur iOS et deux jours et demi sur Android, où la pierre éclairée
  doit encore être portée en shader AGSL. Les cartes, les entrées et
  l'ouverture s'y ajoutent, selon l'estimation de la Marge.<!-- src: ../sources/2026-10-11-feed-redesign/final-DIRECTION.md; ../sources/2026-10-11-feed-redesign/FACTS.md §1 -->
- **Les semaines de vingt pebbles.** La Marge les estime à environ 5 000 px sur
  téléphone ; la table des matières doit porter la navigation, et le vrai
  débordement n'a pas été conçu.<!-- src: ../sources/2026-10-11-feed-redesign/spine-DIRECTION.md -->
- **Les deux doutes du constructeur.** Retirer le pip abandonne une partie de
  la grammaire du Jeu de cartes, même si un seul réglage le remet. Et la force
  du sol, comme l'éclaircissement de 20 % des pierres de lave la nuit, ont été
  réglés sur un rendu sans écran, pas sur un téléphone.<!-- src: rapport du constructeur via l'orchestrateur -->
