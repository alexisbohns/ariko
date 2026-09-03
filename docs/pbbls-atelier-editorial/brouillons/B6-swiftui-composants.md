---
Title: SwiftUI-first · du natif "fonctionnel" aux composants maison brandés
Statut: BROUILLON subagent (matière première à réécrire — 0 % publiable tel quel)
Tag: SwiftUI/Composants
Article: B6
---

> ⚠️ **Note de l'atelier.** Ceci est un brouillon pondu par un subagent : structure, faits, transitions, ton approchant. À réécrire entièrement avant publication (le `draft.md` se vante de 0 % d'IA, et on tient à cette promesse). Les trous sont marqués `[À COMPLÉTER : …]`.

# SwiftUI-first · ou comment j'ai d'abord triché, puis tout refait à la main

Allez, on va parler d'un truc que personne ne te raconte jamais quand on te vend le storytelling bien lisse d'un produit : **le premier jet, c'est de la triche assumée.**

Pas de la triche au sens "j'ai copié sur le voisin". De la triche au sens "je n'allais quand même pas tailler chaque bouton dans le marbre avant même de savoir si le truc tenait debout". Tu vois la nuance ?

[Note pour Maman et Tata : un "bouton", ici, ce n'est pas le truc en plastique de ta chemise. En dev, c'est l'élément cliquable d'une interface — et il y en a des dizaines dans la moindre app. Multiplie par le nombre d'écrans, et tu comprends pourquoi on ne les sculpte pas un par un d'entrée de jeu.]

Cet article, c'est l'histoire de cette **implémentation progressive**. D'abord faire marcher la mécanique avec des pièces toutes faites, achetées sur étagère. Puis, une fois que le truc fonctionne, remplacer ces pièces par des composants maison qui, eux, portent l'âme de Pebbles. Et au milieu de tout ça, le **grand saut** : passer du web au natif, c'est-à-dire abandonner une appli-site-web pour réécrire une vraie application iOS dans le langage d'Apple.

Spoiler : ça fait mal. Mais c'est le genre de douleur qui te rend meilleur.

Ah, et je te préviens, comme d'hab : ça va causer un peu technique par moments. Je vulgarise au mieux. Si je te perds, c'est ma faute, pas la tienne.

---

## Bande annonce · l'histoire, version courte

Pour les pressé·es, le résumé en accéléré :

1. **Phase web.** Pebbles naît comme une *webapp* — une application qui vit dans un navigateur, sur ordi comme sur mobile. Stack : Next.js (un cadre pour faire des sites web modernes) plus **shadcn/ui**, des composants prêts-à-l'emploi. Des briques de Lego déjà moulées que tu assembles vite pour que ça marche.
2. **Hygiène.** Le 28 mars, grand ménage dans ces briques (la journée "Quality Review of Shadcn") : dédup, import de composants shadcn officiels, découpe des gros pâtés.
3. **Le fossé.** Aussi soigné soit le web mobile, un mur reste infranchissable : **ça ne sera jamais une vraie appli.** Je le sens dès novembre 2025, je le re-sens en bidouillant la *PWA* (le 31 mars).
4. **Le saut.** Le **12 avril 2026**, je bascule sur une **vraie application iOS en SwiftUI** — le langage maison d'Apple. "A proper app, not just a web wrapper."
5. **La refonte brandée.** Je reconstruis, pièce par pièce, avec des composants **maison** qui incarnent la marque : un système de couleurs (17 avr.), un sélecteur d'émotion en *sheet* (19 avr.), un atelier de gravure plein écran (18 avr.), un polissage visuel (19 avr.).
6. **Le pont.** Et pour que le galet ait le même ADN des deux côtés (web ET iOS), un **moteur de rendu partagé** dessine la même forme partout.

Voilà. Tu peux t'arrêter là si t'es à la bourre. Sinon, on déroule à la pelle et au pinceau.

[Le "Huh Cat", mon meme préféré, hoche déjà la tête de perplexité. T'inquiète, mon grand, je t'explique tout.]

---

## First simple, then powerful · faire marcher avant de faire beau

Il y a une philosophie chez Linear (un outil de gestion de projet adoré des équipes produit) que j'ai faite mienne : **"First simple, then powerful."** D'abord simple, ensuite puissant. Facile à dire, diablement dur à tenir quand on a, comme moi, un œil de designer qui pleure dès qu'un coin n'est pas aligné au pixel près.

> Le piège du designer-qui-code, c'est de vouloir que ce soit *beau* avant que ce soit *vrai*.

Dans mes notes du 25 mars, je m'étais même fixé trois paliers, du plus rustre au plus fini, dont le premier que j'ai baptisé sans pitié **"ShameVP"** : un prototype tellement fonctionnel et moche que j'aurais honte de le montrer — juste la plomberie, zéro mise en forme.

[Pour situer : un "VP" / MVP, c'est le "produit minimum viable" — la plus petite chose qui marche et qu'on peut tester. Mon "ShameVP", c'est le MVP dont on a honte. Le préfixe "Shame" est de moi, et il dit bien l'humiliation que ça représente pour un type qui passe sa vie sur Figma.]

L'idée derrière : **ne pas se laisser bouffer par le delight (la magie de l'interface) tant que le squelette n'est pas solide.** Comme je l'avais noté à propos du record flow (le parcours de création d'un souvenir) : *"Quand le flux de base est solide, alors je travaillerai sur le plaisir produit et les dingueries d'UI."* Dans cet ordre. Jamais l'inverse.

Et pour tenir cette discipline, il me fallait des pièces préfabriquées. C'est là qu'entre **shadcn/ui**.

Imagine que tu montes un meuble. Tu peux fabriquer chaque vis, chaque charnière depuis zéro — noble, mais tu y passes ta vie. Ou tu prends un kit où les pièces standard (boutons, fenêtres surgissantes, badges, champs de texte) sont déjà là, propres et fonctionnelles, et tu n'as plus qu'à assembler. shadcn, c'est ce kit pour une interface web. Et son génie : tu ne le "branches" pas comme une dépendance lointaine intouchable, tu **copies le code chez toi** et il devient le tien. Tu pourras le retoucher plus tard.

[Aparté de vocabulaire : un "composant", en dev d'interface, c'est un morceau réutilisable — un bouton, une carte, une fenêtre modale. Tu le définis une fois, tu le réutilises partout. Comme un tampon encreur : tu graves le motif une fois, tu l'appliques cent fois.]

Ma stratégie web était donc limpide : **prends les Lego de shadcn, assemble vite, fais marcher le truc de bout en bout.** En quelques jours, j'avais une app Next.js locale où on pouvait s'inscrire, créer un souvenir, le retrouver. Pas joli partout, mais **vivant.**

---

## Quality Review of Shadcn · le grand ménage du 28 mars

Sauf que voilà : assembler vite, ça crée du bordel vite.

Au bout de quelques jours d'assemblage frénétique, mon code ressemblait à une chambre d'ado un dimanche soir. Des composants en double, des trucs faits maison qui réinventaient mal ce que shadcn faisait déjà très bien, des fichiers devenus obèses à force d'empiler.

Le **28 mars**, je m'offre donc une journée que mes notes appellent sobrement **"Quality Review of Shadcn"**. Revue qualité. Du ménage, quoi. Concrètement :

- **Dédoublonnage** : j'avais quatre composants qui faisaient grosso modo la même chose. J'en fais le tri.
- **Import des bons shadcn** : au lieu de mes versions bancales, j'importe les composants officiels — notamment le **badge** (la petite pastille d'étiquette) et l'**alertdialog** (la fenêtre de confirmation du genre "T'es sûr·e de vouloir supprimer ?").
- **Décomposition** : deux gros pâtés, le **soulpicker** (le sélecteur de "souls", c'est-à-dire les personnes qu'on associe à un souvenir) et le **recordstepper** (le truc qui te fait avancer étape par étape dans la création), je les **éclate en sous-morceaux** plus petits et plus digestes.
- Et bien sûr, je mets à jour la doc d'architecture au passage.

[Le "soulpicker"… Oui, dans Pebbles, les gens qu'on associe à un souvenir s'appellent des "souls", des âmes. Pas des "contacts", pas des "users". C'est un choix de naming qui mériterait son propre article — et il l'aura. Disons juste qu'appeler quelqu'un une "âme qui compte" plutôt qu'un "utilisateur", ça change tout dans la tête.]

Pourquoi je te raconte ce ménage apparemment chiant ? Parce que c'est **la moitié invisible du métier.** Tout le monde adore le moment "j'ai eu une idée géniale" ; personne ne montre celui où "j'ai passé une journée à ranger pour que la maison reste habitable". Sans ce second moment, le premier s'effondre sous son propre poids.

> Construire vite, c'est bien. Ranger derrière soi, c'est ce qui fait qu'on pourra construire encore demain.

Néanmoins. Tout ce beau ménage ne réglait pas le problème de fond. Parce que, aussi propre soit ma webapp, elle restait… une webapp.

---

## Le fossé · pourquoi "responsive" ne suffit jamais

Faut qu'on parle du **mur**. Celui contre lequel je me cogne depuis novembre 2025.

Tu connais le mot "responsive" ? On le dit d'un site qui **s'adapte au format de l'écran** — il se réorganise pour rester lisible sur un téléphone comme sur un grand moniteur. C'est devenu la base, et ma webapp l'était. Mais voilà ce que je notais déjà à l'époque, dépité :

> *"Aussi responsive qu'elle soit, rien n'égale une véritable application écrite dans un langage natif au téléphone."*

Le truc, c'est qu'un site web dans un navigateur, même déguisé en appli, reste un **invité** sur ton téléphone. Il n'a pas les clés de la maison. Il rame à reproduire les petites choses qu'une vraie appli fait nativement : le défilement qui colle parfaitement au doigt, les retours haptiques (ces minuscules vibrations qui confirment que t'as bien appuyé), les "safe areas" (les zones où ne pas mettre de contenu, genre derrière l'encoche du haut ou la barre du bas).

Pour repousser ce mur, j'ai d'abord essayé la solution intermédiaire : la **PWA**.

[PWA = "Progressive Web App", application web progressive. En gros : une webapp à qui on met un costume d'appli. On peut l'installer sur l'écran d'accueil, elle a une icône, elle s'ouvre en plein écran sans la barre du navigateur, et elle peut même marcher hors-ligne. C'est le maximum de déguisement qu'un site web peut porter.]

Le **31 mars**, dans une journée que mes notes appellent **"Feeling native on mobile"** (donner la sensation du natif sur mobile), je sors la trousse à outils complète :

- Un **service worker** : un petit programme qui tourne en arrière-plan et permet à l'app de fonctionner même sans connexion (il garde des choses en cache). C'est lui qui fait qu'une PWA peut s'ouvrir dans le métro sans réseau.
- Du **durcissement du défilement** : empêcher les rebonds bizarres, le texte qui se sélectionne tout seul quand tu fais glisser, tous ces petits trucs qui sentent le web à plein nez.
- La gestion des **safe areas** pour ne pas écrire sous l'encoche.
- Et même de l'**haptique**… que je savais d'avance condamnée. Je l'avais écrit, un peu fataliste : *"je sais que ça ne marchera que sur Android."* Parce que sur iOS, le web n'a tout simplement pas le droit de faire vibrer le téléphone. Apple garde cette clé pour ses propres applis. Point.

Et c'est ÇA, le résumé du fossé en une anecdote : **tu peux donner à un site web le plus beau costume d'appli du monde, il y aura toujours une porte qu'on lui claque au nez.** L'haptique sur iPhone, c'est cette porte.

[Imagine un acteur déguisé en flic pour un film. Crédible de loin, costume nickel. Mais si tu lui demandes de t'arrêter pour de vrai, il n'a pas le badge. Le natif, c'est le badge.]

La PWA, c'était un superbe pansement. Mais je ne voulais pas d'un pansement. Je voulais le badge.

---

## 12 avril · le grand saut dans le vide (SwiftUI)

Le **12 avril 2026**, je saute.

Dans le changelog, à 13h14, une ligne marque le tournant de tout le projet : **"Native iOS App (SwiftUI)"**, avec en sous-titre cette phrase que je revendique : *"a proper app, not just a web wrapper."* Une vraie appli, pas un emballage web.

[Un "web wrapper", littéralement un "emballage web", c'est quand tu prends ta webapp et que tu la fourres dans une coquille d'appli native, comme un bonbon dans son papier. Ça passe sur l'App Store, mais à l'intérieur c'est toujours du web. C'est exactement ce que je refusais de faire.]

Alors, **SwiftUI**, c'est quoi ?

C'est le langage — ou plus exactement le *framework*, le cadre de travail — qu'Apple a conçu pour fabriquer les interfaces de ses applis, sur iPhone, iPad, Mac, etc. Là où le web te demande de jongler avec trois langages (un pour la structure, un pour le style, un pour la logique), SwiftUI te laisse **décrire ce que tu veux voir, directement dans le langage Swift**, et il s'occupe de le dessiner avec les vrais matériaux d'Apple.

L'avantage est immense : tu hérites gratuitement de **tout ce qui fait qu'une appli iPhone se sent comme une appli iPhone.** Le défilement parfait. L'haptique (sans permission, cette fois). Les *sheets* (j'y reviens), les transitions, les gestes. Ce que je galérais à imiter dans la PWA, SwiftUI me le sert sur un plateau.

[Petite mise en garde honnête : ce n'est pas magique non plus. Réécrire en SwiftUI, c'est repartir d'une page largement blanche. Tout ce que j'avais bâti en composants web, il fallait le **re-penser** avec les outils d'Apple. D'où la suite de cet article.]

Et ce saut n'était pas qu'une lubie esthétique. Il s'inscrit dans une bascule plus large de toute l'architecture : on passe d'un repo Next.js bien plat à un **monorepo** — un seul dépôt de code qui héberge plusieurs applications côte à côte. Dedans : la webapp d'un côté, l'app iOS de l'autre, et des morceaux partagés au milieu.

[Pour mesurer à quel point l'iOS est devenu sérieux et pas cosmétique : à ce jour, le code du projet est composé d'environ **un tiers de Swift** (le langage d'Apple). Un tiers. Ce n'est pas un gadget collé sur le côté, c'est un pan entier et vivant du produit.]

> Passer au natif, ce n'est pas changer de peinture. C'est changer de matière.

---

## La reconstruction · remplacer les Lego par des pièces taillées maison

Et nous y voilà : le cœur de l'histoire, le **deuxième** mouvement de l'implémentation progressive. Phase 1, on fait marcher le truc avec des pièces standard (shadcn côté web, composants par défaut d'Apple côté iOS au début). Phase 2, **une fois que ça tourne**, on les remplace par des composants maison qui portent la marque.

Parce qu'une appli qui fonctionne mais ressemble à n'importe quelle autre, on a raté l'essentiel. Pebbles a une **identité visuelle** très précise — un manifeste que j'ai baptisé **"Eroded Flat"**, ou design "néo-primitif".

[En deux mots, l'idée : tout est plat et prêt à être animé, **mais rien n'est géométriquement parfait.** Pas de rectangles à coins arrondis bien propres — des silhouettes légèrement organiques, comme des galets de rivière, lisses mais jamais symétriques. Des couleurs de pigments (ocre, craie chaude, terre, ardoise) et non de bonbons. Des icônes façon pétroglyphes, ces symboles gravés dans la roche : nets, mais portant la main de celui qui les a tracés. "L'irrégularité est structurelle, pas cosmétique."]

Tu comprends le problème : **un composant shadcn standard, ou un bouton iOS par défaut, ça ne sait pas faire ça.** C'est trop propre, trop géométrique, trop… générique. Pour incarner l'âme érodée de Pebbles, il fallait tailler les pièces moi-même.

Voici les chantiers de cette refonte, dans l'ordre où ils sont tombés sur iOS.

### Le Color System (17 avril) · poser les pigments

Premier socle : un **système de couleurs** propre à l'app. Pas trois teintes posées au hasard, mais une vraie grammaire chromatique — les pastels géologiques du manifeste, déclinés pour le mode clair et le mode sombre, en jeux de teintes cohérents.

[Le "dark mode", mode sombre, c'est la version de l'app aux fonds foncés, plus reposante le soir. Le piège, c'est qu'on ne se contente pas d'inverser noir et blanc : chaque couleur doit être repensée. Sur mes essais de thèmes en mars, j'avais un verdict cruel pour l'un d'eux — "j'adore en clair, mais en sombre il fait trop Claude !" Trop proche de l'identité d'un autre. Donc oui, c'est un travail d'orfèvre, pas un interrupteur.]

Le Color System, c'est la première pierre maison. Sans une palette qui t'appartient, tout le reste sonne emprunté.

### Le Glyph Carving plein écran (18 avril) · graver dans la roche

Là, on touche à un truc dont je suis fier. Dans Pebbles, tu peux dessiner ton propre **glyph** — un petit symbole gravé, à la main levée, que tu attaches à un souvenir. Pense à un pétroglyphe que tu graves toi-même.

Le **18 avril**, je sors le **Glyph Carving** en **plein écran** : un canevas qui prend tout l'écran pour que tu puisses tracer ton glyph confortablement, du bout du doigt, comme on grave dans la pierre.

[Pourquoi "graver" et pas "dessiner" ? Parce que dans l'univers minéral de Pebbles, on ne griffonne pas, on **carve** — on taille, on creuse. Le mot porte l'intention. Un glyph, ce n'est pas un gribouillis, c'est une marque que tu laisses, comme nos ancêtres sur les parois des grottes. Madness ou vision ? J'avais moi-même noté à propos de cette feature : "c'est peut-être plus de la folie que de la vision, je l'admets." Les deux, mon capitaine.]

Un composant comme ça, **aucune bibliothèque ne te le donne.** C'est du sur-mesure intégral, pensé pour incarner précisément le geste fondateur de l'app.

### Le Valence Picker Sheet (19 avril) · neuf formes, un geste

Le morceau central, peut-être. Le **Valence Picker** — le sélecteur qui te permet de "façonner" ton souvenir en choisissant son intensité et sa valence (positive, neutre, négative).

[Vulgarisation express : dans Pebbles, un souvenir n'est pas qu'un texte, c'est une **forme** — un galet. Cette forme encode deux choses : à quel point l'émotion était intense, et si elle penchait vers le positif ou le négatif. C'est inspiré d'un modèle de la psychologue Lisa Feldman Barrett. Mais l'utilisateur n'a pas à comprendre la théorie : il manipule juste une forme jusqu'à ce qu'elle "lui parle". Le but était que ce soit "une façon instinctive et métaphorique de s'approprier le schéma sans avoir à le comprendre intellectuellement."]

Le 19 avril, ce sélecteur prend la forme d'un **sheet** — un mot qui revient partout dans le natif, donc je te l'explique.

[Un **sheet**, littéralement une "feuille", c'est ce panneau qui **glisse depuis le bas de l'écran** par-dessus le reste, te présente une tâche précise, puis se referme. Tu en vois tout le temps sur iPhone : quand tu partages, quand tu choisis une option. C'est LE geste natif par excellence — fluide, contextuel, qui ne te sort pas de là où tu étais. Sur le web, je bricolais des fenêtres modales qui n'avaient jamais tout à fait ce naturel. Sur iOS, le sheet est offert d'origine, et il sent juste.]

Le sous-titre que j'ai donné à cette feature résume tout : **"nine shapes, two polarities — one gesture."** Neuf formes, deux polarités, un seul geste. Tu fais glisser, la forme du galet se transforme sous tes yeux, et quand elle te ressemble, c'est plié.

Et c'est exactement là qu'on voit la philosophie du passage au natif : sur iOS, **créer un pebble se fait dans un formulaire en une seule sheet** (un pattern d'interaction typiquement Apple), et le Quick editor — l'éditeur express de souvenir — est devenu **une sheet qu'on déclenche par un bouton**, parfaitement aligné sur les codes iOS. Là où le web me poussait vers des parcours en pages qui s'enchaînent, le natif m'invite à penser en **sheets** qui surgissent et se referment. On ne porte pas le même geste d'une plateforme à l'autre : **on adopte les patterns natifs.**

> La leçon du natif : ne pas traduire le web mot à mot. Apprendre la langue du pays.

### Visual Polish (19 avril) · le coup de chiffon final

Et pour finir, le **Visual Polish** du 19 avril : le polissage. Le logo, les fonds, les accents de couleur — tous ces détails qu'on remarque seulement quand ils sont mal foutus, et qui, bien faits, donnent à l'ensemble cette sensation de "tout est à sa place."

[Le polissage, c'est l'étape la plus ingrate à raconter et la plus décisive à vivre. C'est 5 % du boulot qui fait 50 % de l'impression. Personne ne te félicitera pour un fond bien choisi. Mais tout le monde sentira, sans savoir pourquoi, que l'app "fait sérieuse".]

---

## Le moteur de rendu · le pont qui tient les deux rives

Reste une question qui a dû te chatouiller : si je construis **deux** apps (le web et l'iOS), comment je m'assure que le galet est rigoureusement **le même** des deux côtés ? Que mon souvenir-galet a exactement la même forme, qu'on le regarde dans Safari ou dans l'app iPhone ?

La réponse, c'est un **moteur de rendu partagé** — dans le code, le dossier `engine/`.

[Image avant définition : pense au **moule** d'un sculpteur. Peu importe qui coule le plâtre — toi sur le web, l'app sur iOS, ou le serveur dans le cloud — c'est le même moule, donc le même galet en sort. Une seule empreinte, un seul résultat, quel que soit l'atelier qui l'appelle.]

Concrètement, c'est un bout de code qui prend en entrée les caractéristiques d'un souvenir (sa taille, sa valence, son glyph) et qui recrache un dessin — un **SVG paramétrique**, c'est-à-dire une image vectorielle générée à la volée selon des paramètres. Et ce moteur tourne **identiquement** côté client (pour la prévisualisation pendant que tu crées) et côté serveur. Même code, même galet, partout.

C'est lui, le **pont entre iOS et web.** Il garantit que l'ADN visuel — la signature érodée, le galet jamais tout à fait régulier — reste rigoureusement cohérent quelle que soit la plateforme. Dans le changelog du 16 avril, je l'ai résumé ainsi : "moteur partagé, même ADN visuel iOS + web."

[Je ne vais pas t'ouvrir le capot de ce moteur ici — comment il normalise un glyph, comment il calcule la position selon une matrice de tailles, comment il chronomètre l'animation de révélation du galet. Ça mérite son propre article (ce sera l'épisode sur le moteur de rendu), et je ne vais pas te le spoiler. De même, l'odyssée de **la forme du galet elle-même** — de la "perle d'émotion" à la valence en passant par neuf formes dessinées à la main — c'est une autre histoire, racontée ailleurs. Ici, je me contente de pointer le moteur comme la **clé de voûte** qui tient les deux rives.]

Ce qu'il faut retenir : sans ce pont, j'aurais eu deux apps qui se ressemblent *vaguement*. Avec lui, j'ai deux apps qui parlent **exactement** la même langue visuelle. Et pour une app dont toute la promesse est que "chaque souvenir est unique mais reconnaissable entre mille", ce n'était pas négociable.

---

## Ce que j'en retiens · l'éloge de la triche temporaire

Si tu ne devais garder qu'une chose de tout ce bavardage, ce serait celle-ci :

**Le détour par les pièces standard n'est pas un échec, c'est une stratégie.**

J'aurais pu vouloir tout faire maison dès le premier jour. Tailler chaque bouton, sculpter chaque transition, refuser le moindre Lego préfabriqué. Résultat : je serais probablement encore en train de peaufiner le sélecteur d'émotion, sans jamais avoir vérifié si l'app, dans son ensemble, tenait debout et avait du sens.

À la place, j'ai triché. Shadcn pour faire marcher le web vite. Les composants par défaut d'Apple pour bootstrapper l'iOS. Et **seulement ensuite**, une fois la mécanique prouvée, j'ai remplacé ces pièces empruntées par des composants maison qui portent enfin l'âme de Pebbles : le Color System, le Glyph Carving, le Valence Picker, le Visual Polish.

> D'abord faire marcher. Ensuite faire chanter.

Et le passage du web au natif, dans tout ça ? C'est le même mouvement, en plus brutal. La PWA était la version "costume d'appli". SwiftUI, c'est l'appli pour de vrai. Le moment où tu cesses de mimer le natif pour **parler couramment sa langue** — ses sheets, son haptique, ses gestes.

Ça m'a coûté une réécriture quasi complète. Mais quand je tiens aujourd'hui mon iPhone et que je fais glisser le Valence Picker pour façonner un galet, avec la petite vibration qui confirme, le sheet qui se referme tout en douceur… je sais que ça valait le coup de tout casser pour le rebâtir.

C'était pas un emballage. C'était le badge.

[Et si tu trouves que je me la pète avec mon "badge", sache que la veille encore je galérais à empêcher mon texte de se surligner tout seul au scroll. L'humilité du dev te rattrape toujours. Toujours.]

Allez. Tu peux ranger la pelle et le pinceau. Pour cet épisode, du moins.

---

## Sources mobilisées

- **`docs/journal/draft.md`** — le constat de novembre 2025 (interactivité noyée par la complexité, "royalement chiant", "aussi responsive qu'elle soit, rien n'égale une véritable application écrite dans un langage natif") ; les deux erreurs reconnues (client + modèle en même temps ; techno de niche vs modèles sur-entraînés React/Next) ; la voix et le grain.
- **`_digests/apple-journal.md`** — entrées **"Quality Review of Shadcn"** (28 mars : dédup de 4 composants, import shadcn badge/alertdialog, décompo soulpicker/recordstepper, maj doc archi) ; **"Design themes with Claude"** (27 mars : néo-primitif, irrégularité structurelle, pétroglyphes, "too Claude") ; **"Dark mode themes"** (28 mars : Cave pigment/Blush Quartz/Dusk Stone/Moss Pool) ; **"Feeling native on mobile"** (31 mars : PWA, service worker, scroll/safe-areas, haptique "only on Android", splash) ; **"Pebble engine"** (8–9 avr. : engine V2, "an app not a SaaS", Quick editor, sheet view) ; méthode "First simple, then powerful" (Linear) et le palier "ShameVP" (25 mars).
- **`_digests/tech-stack.md`** — stack (Next.js + shadcn + Tailwind + PWA ; iOS SwiftUI + Supabase Swift SDK) ; monorepo Turborepo + npm workspaces ; **Swift ≈ 33,6 %** ; le moteur `engine/` (TS pur, SVG paramétrique, tourne client + serveur, "pont" iOS/web) ; PebbleValence highlight/neutral/lowlight.
- **`00-chronologie.md`** (Phases 3→4) — le **pivot SwiftUI du 12 avril** ("a proper app, not just a web wrapper", 13h14) ; **Remote Pebble Render Engine du 16 avril** ("moteur partagé, même ADN visuel iOS + web") ; **Color System 17 avr.** ; **Glyph Carving plein écran 18 avr.** ; **Valence Picker Sheet 19 avr.** ("nine shapes, two polarities — one gesture") ; **Visual Polish 19 avr.** (logo/fonds/accents).
- **`pebbles-design_direction.md`** — le manifeste "Eroded Flat / Neo-primitive" : contours usés (SVG, pas border-radius), pastels géologiques vs candy pastels, icônes pétroglyphes sans contour, "l'irrégularité est structurelle, pas cosmétique", motion gravitationnelle.
- **`02-backlog-editorial.md`** (B6 + briefs) — les 6 beats et le cadrage de l'angle ; renvois explicites à **B9** (deep-dive moteur de rendu) et **B1** (odyssée du visuel du pebble) qu'on cite sans refaire.
- **Matière autoritaire d'Alexis (brief)** — sur iOS, création d'un pebble en **single sheet form** ; Quick editor devenu **sheet déclenchée par un bouton** ; illustration du passage aux **patterns d'interaction natifs**.

---

## [À COMPLÉTER]

> Trous à combler par Alexis avant publication. Ne PAS inventer.

- **[À COMPLÉTER : quels composants shadcn précis ont été remplacés par du maison ?]** — Le brief mentionne explicitement de répondre à cette question. Les sources confirment qu'on a *importé* badge + alertdialog et *décomposé* soulpicker + recordstepper côté web (28 mars), mais la liste exacte des composants shadcn qui ont ensuite été **retirés/remplacés par des composants brandés maison** n'est pas établie dans le corpus lu. Lesquels (boutons ? cards ? inputs ? sheet/dialog ?) ont survécu, lesquels ont été ré-écrits "Eroded Flat" ?
- **[À COMPLÉTER : noms des composants SwiftUI maison ?]** — Côté iOS, on connaît les *features/écrans* (Color System, Glyph Carving, Valence Picker Sheet, Visual Polish), mais pas les **noms réels des vues/composants SwiftUI** dans le code (ex. `PebbleView`, `ValencePickerSheet`, `GlyphCarvingCanvas`… ?). À récupérer dans `apps/ios/`. Sans ça, les noms cités ici sont des paraphrases françaises, pas les identifiants réels.
- **[À COMPLÉTER : état exact ?]** — Au moment d'écrire, quel est le statut précis ? Le changelog couvre les features iOS shipped jusqu'au ~21 avr. (TestFlight V0 ~19 avr., V1 ~27 avr. visés). Les "cards" héritées de Beck sont notées "temporairement abandonnées" sur iOS : le sont-elles toujours aujourd'hui (mai 2026) ? Le Quick editor en sheet est-il bien l'**unique** moyen d'enregistrer sur iOS, ou les deux modes coexistent-ils ? Préciser l'état "à ce jour".
- **[À COMPLÉTER : le palier "ShameVP" — formulation exacte ?]** — J'ai repris le terme "ShameVP" du digest (log 25 mars). Vérifier la graphie/casse exacte et si tu veux le garder tel quel ou le franciser.
- **[À COMPLÉTER : haptique sur iOS post-natif ?]** — On dit que la PWA ne pouvait pas vibrer sur iOS, et que SwiftUI le permet. Confirmer que l'haptique a effectivement été câblée dans l'app native (le corpus l'implique mais ne le date pas explicitement comme feature livrée).
- **[À COMPLÉTER : titre définitif + accroche perso ?]** — Le patron d'article observé démarre souvent par une accroche personnelle (façon `draft.md`). Ajouter, si tu veux, une amorce vécue (un moment précis où le fossé web/natif t'a sauté à la figure) pour ancrer l'intro.
