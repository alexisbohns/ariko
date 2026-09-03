---
Title: Forme et fond · comment un souvenir est devenu un caillou
Statut: brouillon subagent "Pearl" (matière première à réécrire — 0% à publier tel quel)
Tag: Visuel&Valence
---

# Forme et fond · comment un souvenir est devenu un caillou

[Note pour Maman et Tata : « la forme et le fond », normalement c'est une expression pour dire « la manière de dire les choses » (la forme) et « ce qu'on dit » (le fond). Ici je triche un peu : dans Pebbles, la forme du caillou EST le fond, vu qu'elle encode littéralement ce que tu ressens. Bref, jeu de mots. Capp ou pas capp.]

Avant de remonter le temps, je te montre où on a atterri. Parce que sinon, toute l'archéologie qui suit, tu vas la lire sans savoir vers quoi elle creuse.

Aujourd'hui, dans Pebbles, un souvenir, c'est un **galet animé**. Pas une icône figée : une petite pierre qui se forme sous tes yeux, calque après calque. Et ce galet combine deux choses. D'abord, **ton glyphe** — un petit symbole que *toi* tu as dessiné à la main, au doigt, pour résumer le moment (un chat, une vague, un cœur tordu, ce que tu veux). Ensuite, une **forme déterminée par la valence** du souvenir : selon ce que tu as ressenti, le galet est rond et endormi, ou triangulaire, ou dressé comme une lame ; sombre et mat, ou lumineux et veiné. Ton glyphe dit *quoi*. La forme dit *comment ça t'a fait*. Les deux se posent dans la même pierre.

Voilà l'état actuel. Pour en arriver là, j'ai mis trois semaines, enterré une dizaine de prototypes, et tué une idée à laquelle je tenais comme à la prunelle de mes yeux. C'est cette histoire-là que je veux te raconter. Une obsession, en fait. Pas une grosse, pas une qui se voit. Une de celles qui te bouffent un week-end entier sans que personne autour ne comprenne pourquoi tu fixes ton écran avec la tête de quelqu'un qui a perdu ses clés à l'intérieur de sa propre main.

L'obsession, c'était celle-ci : **comment faire pour qu'un souvenir devienne une forme ?**

[Pour les pressé·e·s qui veulent juste la fin : chaque souvenir devient un galet dessiné. Sa **forme** (petit/oblong → triangle → losange) dit l'intensité de l'émotion ; sa **couleur et sa texture** disent si c'était plutôt agréable ou pas. Trois semaines, six concepts ratés, une IA qui peint des images, une amie ex-brand manager et un paquet de jurons pour y arriver. Tu peux filer. Ou rester pour le moment où j'ai dû assassiner ma propre idée préférée — c'est le clou du spectacle.]

> Comment faire pour qu'un souvenir devienne une forme ?

Je te préviens, c'est l'épisode le plus « gadjo-avec-ses-métaphores-de-cailloux » de toute la série. Mais c'est aussi, je crois, le cœur battant de Pebbles : le reste — timeline, comptes, gamification — c'est de la plomberie comparé à ça. On va parler psychologie des émotions, design, et d'un moteur de rendu en SVG. Néanmoins, promis, je vulgarise au fur et à mesure.

# Peser une plume · le problème de départ

Reprenons depuis le sol. Dans Pebbles, quand tu enregistres un souvenir, à un moment on te demande de qualifier l'émotion qui l'accompagne. Et là, classiquement, il faut faire deux choses qui paraissent simples mais qui sont en réalité des supplices miniatures :

1. **nommer** l'émotion (joie, peur, tristesse…),
2. en **jauger l'intensité** (c'était un petit pincement ou une déflagration ?).

[Petit rappel pour celleux qui n'ont pas suivi les épisodes précédents : Pebbles descend en droite ligne des « colonnes de Beck », un exercice de thérapie cognitivo-comportementale où tu décortiques une situation, dont justement l'intensité de chaque émotion sur une échelle. C'est game-chang… euh, c'est un truc qui a changé ma vie. J'en parle ailleurs.]

Le problème, c'est l'étape 2. Mettre un chiffre sur une émotion, genre « ma tristesse était à 7/10 », c'est à la fois **chiant** et **abstrait**. Chiant parce qu'on n'a pas envie de faire des maths sur sa propre détresse. Abstrait parce que… c'est quoi, une tristesse à 7 ? Par rapport à quoi ? La tienne d'hier ? Celle de ton voisin ? Un slider, un nombre, une étoile sur cinq — tout ça nous renvoie à la même expérience désincarnée : on objective un truc vivant en le réduisant à une coordonnée sur une règle graduée. Beurk.

Et pourtant, il *faut* peser l'émotion. C'est même tout l'intérêt : objectiver la soupe émotionnelle, c'est le premier pas pour cesser de la subir. Mais comment faire peser une plume sans donner l'impression qu'on remplit un formulaire des impôts de l'âme ?

C'est là qu'un mot a tout débloqué dans ma tête : **le jeu**.

[« game aspect » dans mes notes de l'époque, parce que je pense en franglais quand je bricole, déso.]

L'intuition était bête comme chou : et si, au lieu de *renseigner* l'intensité avec un curseur, on la *fabriquait* avec un geste ? Si l'acte de pondérer son émotion devenait un petit jeu tactile, satisfaisant, presque enfantin ? Le jeu transforme une corvée d'introspection en moment de plaisir. Et surtout, il escamote la douleur de l'abstraction : tu ne dis pas « 7/10 », tu *façonnes* quelque chose qui *ressemble* à ce que tu ressens. Le chiffre est toujours là, planqué dessous, mais tu ne le vois plus. Tu joues.

Restait un détail. Il fallait inventer ce jeu. Et l'objet qu'il fabrique.

# Six ratés féconds · l'atelier des artefacts

28 mars 2026. Je lance un projet dans Claude (l'app, en mode « Cowork », un espace où l'IA peut bidouiller des fichiers avec moi) avec ce que j'appelle un Design Manifest — en gros, une note qui dit « voilà l'univers, voilà les règles, maintenant joue ». Et je lui demande des concepts d'« artefacts émotionnels » : des petits widgets interactifs où l'utilisateur sculpterait son émotion.

Six trucs en sortent. Six. Tous **bugués**, à peine fonctionnels, parfois franchement ridicules. Et pourtant je les garde tous en mémoire comme des ratés fertiles, parce que chacun apportait une idée que je n'avais pas. Petit musée des horreurs (affectueux) :

- **Breathing Pearl** — une perle qui respire, en SVG pur. Le germe de tout : un objet vivant, organique, qui pulse doucement.
- **Erosion Shaper** — un « accélérateur de particules » censé éroder la pierre sous tes yeux. Magnifique sur le papier, injouable en vrai. Mais l'idée d'**éroder** pour façonner restera.
- **Stacking Rings** — empiler des anneaux comme un cairn. (Le cairn, c'est ce tas de pierres qu'on monte sur les chemins de rando. Garde-le en tête, il revient souvent dans Pebbles.)
- **Gravity Pearl** — une molécule sombre et tournoyante. Mes notes de l'époque sont sans pitié : « cette molécule lugubre qui tourne, c'est carrément cringe » (gênant). Voilà. RIP.
- **Sediment Press** — *presser* pour donner du poids à un souvenir. Métaphore que je trouvais juste : appuyer fort = ça compte.
- **Ripple Pool** — un bassin où le galet ricoche et fait des ronds dans l'eau. (Le ricochet aura une vie à part dans l'histoire du *naming*, mais c'est une autre digression.)

Verdict de l'époque, recopié tel quel : *« it's hilarious… this gloomy rotating molecule is quite cringe »*, et juste après, l'étincelle : *« the game aspect make it fun. »* Le côté jeu rend ça fun. Donc l'intuition tenait. Restait juste à trouver le bon jeu, et le bon objet. (Spoiler : j'allais y passer encore une dizaine de jours.)

[Méta-leçon que je me répète depuis : un prototype raté n'est jamais perdu. Chacun de ces six trucs a déposé un caillou — l'érosion, le poids, la pulsation, le ricochet. On reconstruit toujours avec les gravats d'avant.]

# Deux molettes pour une émotion · l'intensité et la polarité

Maintenant, le morceau savant. (Je le vulgarise, reste avec moi.)

Quand on veut cartographier les émotions, il existe un modèle super pratique, celui de **Lisa Feldman Barrett**, une psychologue qui a remis les pendules à l'heure sur la façon dont notre cerveau fabrique les émotions. Son outil de base, c'est le **modèle circumplex**.

[Note pour Maman et Tata : « circumplex », ça sonne comme un complément alimentaire, mais c'est juste un **plan à deux axes**, comme une carte. Imagine une feuille avec un axe horizontal et un axe vertical, et chaque émotion qui se range quelque part sur la carte selon deux critères. Voilà. C'est tout.]

Les deux axes, c'est **l'intensité** (ça t'a peu ou beaucoup remué·e ? faible → forte) et **la valence** (c'était plutôt agréable ou désagréable ? négatif → positif). Avec juste ces deux curseurs, tu situes à peu près n'importe quel état émotionnel. La sérénité ? Agréable, intensité faible. La rage ? Désagréable, intensité maximale. C'est élégant, c'est solide, et c'est exactement le genre de truc que mon cerveau de designer adore parce que… ça ressemble à un plan cartésien. Zone de confort.

[Petit point de vocabulaire pour la suite, parce que j'ai changé de mots en route : à l'époque, je pensais « intensité × valence », pile le couple de Barrett. Aujourd'hui, dans l'app, j'appelle ça **Intensity × Polarity** — l'intensité d'un côté, la *polarité* de l'autre (en gros : à quel point c'était lumineux ou sombre). Et la combinaison des deux donne ce que j'appelle désormais les **9 valences** : neuf cases, neuf formes possibles. Garde les deux mots en tête : Barrett pour la théorie de départ, Intensity × Polarity → 9 valences pour ce qui tourne aujourd'hui.]

Le 29 mars, je formalise donc le shaper autour de ça : **intensité sur une échelle [1:3]**, **valence sur [-2:+2]**. Deux molettes pour décrire une émotion. Sur le papier, parfait.

Mais voilà l'écueil — et c'est LE nœud de tout l'épisode. Je ne voulais surtout pas que l'utilisateur ait besoin de *comprendre* Barrett pour s'en servir. Maman ne va pas réviser la psychologie des émotions avant de poser un galet. Il fallait que les deux axes deviennent **sensibles**, **intuitifs**, presque animaux. Pas une carte à lire : une matière à toucher.

Donc, mon pari, ma table de correspondance :

- **L'intensité, c'est la forme.** Plus c'est intense, plus la forme est… anguleuse, dressée, tendue. Une émotion faible, c'est un petit galet tout rond et oblong qui dort. Une émotion forte, c'est une pierre dressée comme une lame.
- **La polarité, c'est la couleur et la texture.** Désagréable → sombre, mat, dur. Neutre → gris ardoise, lisse, poli. Agréable → lumineux, irisé, multicolore.

Mes notes là-dessus disent l'objectif mieux que je ne le redirais : *« the shaping module is an instinctive and metaphorical way to appropriate the Barrett's scheme without having to understand it intellectually. »* Une façon instinctive et métaphorique de s'approprier le schéma de Barrett sans avoir à le comprendre intellectuellement. Voilà la mission. Rendre une théorie palpable au doigt.

> S'approprier le schéma de Barrett sans avoir à le comprendre intellectuellement.

Sauf que le 29 mars, j'avais la théorie, le mapping, l'intention — et toujours pas le bon objet. Mes notes de ce jour-là sont d'une honnêteté brutale, deux phrases que je garde encadrées au-dessus de mon bureau mental :

> *« What's easy to understand is not playful. What's looking playful at first sight is unusable in the end. »*

Ce qui est facile à comprendre n'est pas ludique. Ce qui a l'air ludique au premier coup d'œil est inutilisable au final. La malédiction du designer, résumée en deux lignes. À chaque exploration, je tombais d'un côté ou de l'autre du fil. Un truc clair et plat (sliders, molettes) : utilisable mais mortel d'ennui. Un truc joueur (presse, ricochet, érosion) : excitant trois secondes, puis ingérable.

Et la phrase qui clôt la journée, celle qui dit tout du moment où tu sais que tu n'y es pas encore :

> *« I've still not found the nugget for this shaper. »*

Je n'ai toujours pas trouvé la pépite pour ce shaper. (« Nugget », pépite — un autre fil minéral qui traîne dans mes notes, mais bref.) Pas trouvé. Encore.

[Petite revue des explos de ce 29 mars, pour l'archive : *Stone Drop* (oubliait le neutre), *Sculpt* (sliders ennuyeux mais le verbe « sculpter » sonnait juste), *Topographic* (mes notes disent juste « run! », soit « fuyez »), *Breath* (j'aimais le geste de presser, mais frustrant), *Constellation* (« aweful », c'est-à-dire affreux, et oui je sais que ça s'écrit « awful », j'étais fatigué). Cinq de plus au cimetière. Mais le cimetière, c'est de l'engrais.]

# Nano Banana, Claude et l'amie au bon œil · le 30 mars

Le lendemain. 30 mars. La journée pierre-angulaire — sans mauvais jeu de mots. (Bon, un peu.)

Changement de méthode. J'arrête de vouloir *coder* le bon objet avant de savoir à quoi il ressemble. Je passe en mode **image** : je vais d'abord chercher la bonne *gueule* du galet, et coder après. Pour ça, trois alliés inattendus.

**Allié n°1 : Nano Banana Pro.** [Oui, ça s'appelle vraiment comme ça. C'est un modèle de génération d'images de Google — tu lui décris une image en mots, il te la peint. Le nom est ridicule, je sais, mais l'engin est sérieux.] Je lui fais générer des dizaines de galets en faisant varier les descriptions selon mon mapping : pierre sombre et acérée pour le négatif, ardoise lisse pour le neutre, pierre lumineuse et veinée pour le positif.

**Allié n°2 : Claude**, mais cette fois dans un rôle que j'aime de plus en plus lui donner : le **challenger**. Pas le générateur, le contradicteur. Je lui montre mes pistes, il les bouscule, repère les incohérences, propose l'angle auquel je n'avais pas pensé. Un sparring-partner, quoi.

**Allié n°3, et pas le moindre : une amie, ex-brand manager.** Une vraie humaine, avec un vrai œil, qui a passé tout un après-midi avec moi à trier des cailloux générés par une IA bananière. [À COMPLÉTER : un échange précis avec elle — son prénom ou un surnom, une remarque marquante qu'elle a lâchée, le moment exact où on est tombés sur le galet « cookie ». Le digest ne donne aucun détail nominatif ni dialogue ; à injecter par Alexis, parce que la voix attend du vécu ici, pas une silhouette.]

Et là, le réel résiste. Comme toujours. Quelques apprentissages glanés à la dure :

- Le rendu **skeuomorphique** — [pour Maman et Tata : « skeuomorphique », c'est quand un truc numérique imite la matière réelle, genre les fausses textures de cuir des vieilles apps Apple] — était **trop 3D**. De jolis cailloux photoréalistes, mais qui juraient avec l'identité plate et primitive de Pebbles. Trop de relief, pas assez de geste.
- La piste la plus proche du but : une striation « river-stone », ces stries qu'on voit sur les galets de rivière. Ça, ça parlait. [À COMPLÉTER : cette striation a-t-elle survécu dans le rendu final monochrome, ou est-elle partie à la trappe avec le passage au plat ? À trancher.]
- Et le grand moment de gloire involontaire : certains stones générés *« ressemblaient à des cookies festonnés »*. Tu demandes à une IA des galets émotionnels chargés de sens, elle te rend des biscuits dentelés. On a bien rigolé, puis on a repris le tri.

[Fun fact rétrospectif : c'est exactement à ça que sert un humain dans la boucle. L'IA génère vite et large, mais c'est l'œil — le tien, celui de l'amie brand — qui dit « ça, c'est un souvenir » et « ça, non, c'est un biscuit ». Le goût ne se génère pas. Du moins pas encore.]

À la fin de cette journée, j'avais quand même verrouillé le **système**, le vrai, celui qui tient encore aujourd'hui dans ses grandes lignes :

- **Intensité → forme & nombre d'angles.** Faible = petit / oblong (2 angles). Moyenne = triangulaire (3 angles). Forte = losange (4 angles). [La logique secrète : plus l'émotion monte, plus le galet gagne un angle, comme une tension qui se cristallise. Tu n'as pas besoin de la connaître pour la ressentir. C'est ça, l'instinctif.]
- **Polarité → couleur, arête & matière.** Négatif = sombre, aigu, mat. Neutre = ardoise, lisse, poli. Positif = multicolore, lumineux.

Le 30 mars, j'avais enfin le langage. Mais je portais encore un poids mort sans le savoir : les **Emotion Pearls**.

# Tuer sa darling · adieu les perles, la couleur entre dans la pierre

Reculons d'un cran pour comprendre ce poids mort. Et accroche-toi, parce que c'est là que je dois te confesser un truc pas glorieux.

Pendant tout ce temps, je trimballais une idée à laquelle je m'étais *attaché*. Pas « je l'aimais bien ». Attaché, vraiment, comme on s'attache à un brouillon qu'on relit en se disant « non mais quand même, c'est trop beau pour le jeter ». Cette idée, c'était l'**Emotion Pearl** : que l'émotion vive — sa couleur, son irisation, sa vibration — soit portée par une *perle séparée*, un petit objet brillant posé sur ou dans le galet. La pierre, c'était la structure ; la perle, l'éclat émotionnel. J'avais même produit un SVG de cette perle et lorgné du côté de **Rive** [un outil pour animer des graphiques vectoriels] pour la faire tourner, scintiller, changer de couleur.

Et il faut que je rende à César. Cette perle, je ne l'ai pas inventée. Elle vient en droite ligne des **billes de souvenirs de _Vice-Versa_** [*Inside Out* en VO, le film d'animation Pixar — pour Maman et Tata : tu sais, celui où les émotions sont des petits personnages dans la tête d'une gamine]. Dans le film, chaque souvenir est une bille lumineuse dont la *couleur* dit l'émotion : jaune pour la joie, bleu pour la tristesse, et ainsi de suite. La première fois que j'ai vu ça, gamin — enfin, adulte au ciné, mais bon —, ça m'a scotché. Une émotion qui devient un objet qu'on peut tenir, ranger, faire rouler. C'était *exactement* ce que je cherchais à faire. Forcément, mon cerveau a sauté dessus.

Et c'est là que ça devient intéressant. Parce qu'il y a une difficulté que je trouve sous-estimée dans ce métier : **juger avec sagesse et impartialité ce qu'on prend pour son instinct.** Tu as une idée, elle te traverse comme une évidence, elle « sonne juste » — et tu confonds cette sensation de justesse avec la qualité réelle de l'idée. Les deux n'ont rien à voir.

La perle de *Vice-Versa*, sur le papier, cochait toutes les cases. C'est une réf que *tout le monde* capte instantanément. Tu dis « tu vois les billes dans Vice-Versa ? », et hop, la personne a compris. Aucun effort pédagogique. Tu te dis donc, en toute bonne foi, que ça va *aider* l'expérience — porter du sens gratis, faire le pont avec un truc que les gens adorent déjà.

Sauf que c'était une **fausse bonne idée**. Pire que neutre : elle *desservait* le projet. Parce qu'une perle posée sur un galet, c'est une **couche en trop**. Deux objets là où il en fallait un. Pebbles repose sur une promesse simple — *un souvenir = une pierre* —, et voilà que je collais un deuxième machin dessus, qui dédoublait le sens, alourdissait le rendu, et me forçait à animer, colorer, faire vivre une perle distincte. La référence séduisante me faisait diverger de ma propre idée. Elle la *biaisait*.

Et ça, c'est dur à voir quand on est dedans. Parce que la séduction de l'idée — « ah mais c'est *Vice-Versa* ! » — anesthésie le jugement. Tu prends ton attachement pour de l'intuition. Tu défends une faiblesse en croyant défendre une force.

> L'idée la plus séduisante de mon projet était aussi la plus mauvaise. Il a fallu l'accepter.

Le 5 avril, j'ai un prototype de renderer assez abouti [il est encore dans mes fichiers, `pebble-renderer.jsx`]. Et il est révélateur, parce qu'il porte les deux mondes en même temps : il y a déjà le `getPebblePath(intensity, valence)` qui dessine la forme selon l'intensité — petit/oblong, triangle, losange — avec même un facteur « sharp » qui rentre les courbes quand la valence est négative pour rendre la pierre plus acérée. Il y a déjà les trois palettes (sombre, ardoise, irisée), les **veines** d'émotion (des rubans colorés qui parcourent la pierre, une par émotion), et même un **fossile d'ammonite** qui apparaît quand le souvenir est ancien. Mais toute cette richesse chromatique vit encore dans une logique de perle : des palettes complexes, des facettes, du shimmer. C'est beau et c'est *lourd*.

[Pour Maman et Tata : un SVG, c'est une image décrite par des formules mathématiques plutôt que par des pixels. Du coup elle reste nette à n'importe quelle taille — tu peux zoomer à l'infini, ça ne pixellise jamais. C'est ça qui dessine les galets.]

Et puis vient le déclic, les 8–9 avril, dans une entrée que j'ai appelée sobrement « Shapes ». Deux décisions, prises presque dans le même souffle.

**Décision 1 : je dessine les 9 formes à la main. Sans IA.** Neuf canvas, la matrice complète Intensity (3) × Polarity (3) — mes fameuses 9 valences. Au doigt, au stylet, à l'œil. Pourquoi ? Parce que Nano Banana m'avait donné la *direction*, mais que pour la cohérence finale — la vraie, celle qui doit s'accorder pile avec mes glyphes dessinés à la main — il fallait ma propre patte. Un style ultra-plat, raccord avec le reste. [Et oui, après trois paragraphes à célébrer l'IA générative, je finis au stylet comme un moine copiste. C'est exactement le genre de contradiction que j'assume : l'outil sert le geste, pas l'inverse.]

**Décision 2, la libératrice : j'abandonne les Emotion Pearls. La couleur de l'émotion passe directement dans le `fill` du SVG.** [« fill », c'est le « remplissage » d'une forme vectorielle, la couleur qu'on verse à l'intérieur du tracé.] Plus de perle séparée. Plus de couche en trop. L'émotion ne se *pose plus sur* la pierre : elle *teinte* la pierre. Mes notes, sans cérémonie : *« I also decided to get rid of the Emotion Pearls, and to put the color of the emotion directly in the SVG fill. »*

> L'émotion ne se pose plus sur la pierre. Elle teinte la pierre.

Je ne vais pas te mentir : sur le moment, ç'a été une décision **difficile**. On ne tue pas une darling de gaieté de cœur — surtout une aussi mignonne, aussi « partageable », aussi *Pixar*. Il y avait un petit deuil là-dedans : le SVG de la perle, les heures sur Rive, l'image que je m'étais faite du truc. [À COMPLÉTER : le ressenti exact d'Alexis ce jour-là — j'ai mis du deuil + soulagement, mais lui seul sait le dosage réel, et s'il y avait du soulagement immédiat ou seulement avec le recul.]

Mais aujourd'hui ? Je regarde cette décision avec un vrai **soulagement**. C'était la bonne. La seule, même. Le jour où j'ai retiré la perle, j'ai senti le truc se simplifier sous mes doigts, comme quand tu enlèves la dernière pièce de trop d'un Jenga et que la tour, contre toute attente, tient mieux. Le souvenir n'était plus une pierre *plus* une perle. C'était juste une pierre. Une seule chose, qui dit tout : sa forme dit l'intensité, sa teinte dit l'émotion.

Et la leçon, je la garde précieusement, parce qu'elle dépasse Pebbles : **une idée peut être séduisante et nulle en même temps, et c'est précisément quand elle est séduisante qu'elle est la plus dangereuse.** Le job, ce n'est pas d'avoir des idées qui font « waouh ». C'est de savoir reconnaître, parmi celles qui font « waouh », lesquelles servent vraiment, et lesquelles ne font que te flatter. Spoiler : on se trompe souvent. Moi, sur ce coup, je me suis trompé pendant trois semaines. 🙂

# Le galet, à la chaîne · le moteur partagé

Reste la dernière marche, la moins glamour mais peut-être la plus satisfaisante pour l'artisan : passer du prototype joli à un truc **industrialisé**. C'est-à-dire un système qui sait fabriquer le bon galet, à tous les coups, partout — sur le web comme sur l'iPhone.

Pour penser ça, je me suis inspiré de comment **Duolingo** fabrique ses images (ses fameuses cartes de partage de streak). Leur secret, ce n'est pas des illustrateurs qui dessinent chaque image à la main. C'est un **système de design assemblé comme des LEGO** : des bibliothèques de petits composants visuels que le code emboîte selon ce que tu as fait. Pas de dessin manuel pour chaque cas, juste des briques et des règles d'assemblage. [Techniquement ils jonglent entre rendre une « vue » invisible en image, dessiner sur un « canvas » mathématique, ou composer du SVG. Le point commun : l'image est *calculée*, donc toujours nette.]

J'ai transposé direct : chaque attribut d'un souvenir **pilote un paramètre visuel** du galet. L'intensité pilote la forme, la polarité la teinte et la matière, les émotions les veines, le glyphe se loge dans sa zone. Un souvenir entre, des paramètres en sortent, et le galet se compose tout seul, brique par brique. Mon LEGO minéral.

Le 12 avril, ça prend corps dans un dossier que j'appelle `engine/`. Et là je vais lâcher un peu de technique, parce que j'en suis fier comme un gosse — mais je vulgarise, promis.

[Le `engine/`, c'est un **moteur de rendu** : un bout de code dont le seul boulot est de fabriquer l'image du galet à partir de ses caractéristiques. Écrit en TypeScript « pur » — un langage de programmation, et « pur » veut dire qu'il ne dépend de rien autour de lui, donc il tourne **à l'identique** sur le serveur ET dans ton téléphone. Même code, même galet, partout. C'est ça la beauté : un seul cerveau qui dessine, deux endroits où il s'exécute.]

Quelques pièces de ce moteur, pour le plaisir des curieux·ses :

- Il génère un **SVG paramétrique monochrome**. Monochrome = d'une seule couleur à la base. La couleur réelle (celle de l'émotion) est injectée *après*, grâce à un truc malin nommé `currentColor`. [« currentColor », en gros : tu dessines la forme en disant « remplis-moi avec LA couleur du moment », sans préciser laquelle. Puis l'app dit « la couleur du moment, c'est le jaune de la joie », et hop, toute la forme se teinte. Une seule forme, mille couleurs possibles, zéro re-dessin.]
- Le vocabulaire de polarité s'est même affiné en route : de « négatif / neutre / positif » on est passé à **highlight / neutral / lowlight** (en pleine lumière / neutre / dans l'ombre). Plus juste : ce n'est pas un jugement (« positif »), c'est une lumière.
- Un fichier (`layout.ts`) connaît la **matrice 3×3** — taille × polarité — et sait où placer le glyphe dans chacune des neuf configurations. Les neuf cases de ma grille du 9 avril, devenues du code.
- Un fichier (`compose.ts`) **empile les calques** dans le bon ordre — la forme, puis (s'il y a lieu) le fossile en transparence, puis le glyphe — et recrache un seul SVG propre. Ce composeur est appelé au moment où tu crées ou modifies un souvenir, via ce qu'on nomme des **RPC** [pour Maman et Tata : un RPC, c'est juste un coup de fil que ton téléphone passe au serveur — « hé, fabrique-moi et enregistre ce galet ». Le serveur exécute, range en base de données, et confirme]. Concrètement, deux appels : `create_pebble` et `update_pebble`.

[À COMPLÉTER : le statut réel du fossile d'ammonite (feature « retro ») dans l'app livrée. Il est partout dans le proto `pebble-renderer.jsx`, le `compose.ts` empile bien un calque « fossil », et une spec Notion parle d'un *toggle fossil*. Mais est-ce vraiment *shippé* côté utilisateur aujourd'hui, ou resté au stade moteur ? À ne pas affirmer livré sans vérif.]

Et la cerise, la touche d'artisan dont je suis le plus content : le moteur ne se contente pas de cracher une image figée. Il sort aussi un **manifeste d'animation** — une partition qui dit dans quel ordre, et à quel instant, le galet doit se révéler. La chorégraphie exacte, en millisecondes :

> Le glyphe d'abord (à 0 ms), puis la forme (600 ms), puis le fossile (1000 ms), puis la couleur qui se verse (1200 ms), et enfin tout qui se pose et se stabilise (1600 ms).

Glyphe → forme → fossile → fill → settle. En une seconde et demie, tu vois ton souvenir *se cristalliser* sous tes yeux, calque après calque, comme une pierre qui se forme en accéléré. [Et ça, c'est droit sorti du manifeste de design de Pebbles : « le mouvement est la texture d'un design plat ». Pas de fausses ombres, pas de fausses matières — juste des choses qui tombent, se posent, ont du poids. La vie est dans le geste, pas dans le vernis.]

Voilà. D'un curseur « 7/10 » qu'on remplissait en grimaçant, on est arrivés à un caillou unique qui se forme sous tes yeux et dont chaque trait raconte ce que tu as ressenti. La forme pour l'intensité, la teinte pour l'émotion, ton glyphe au centre, une animation qui donne du poids à l'ensemble. Et derrière, un petit moteur têtu qui le refabrique à l'identique sur tous les écrans.

[À COMPLÉTER : comment l'utilisateur façonne *concrètement* son galet aujourd'hui. Le changelog parle d'un *Valence Picker Sheet* (19 avr., « nine shapes, two polarities — one gesture ») ; un proto du 30 mars était un *touchpad 2D*. Confirmer que c'est bien l'aboutissement direct du « shaper » raconté ici, et décrire le geste final réel — un touchpad ? un autre mouvement ?]

Le plus beau, c'est que personne, en posant son galet, n'a besoin de savoir qui est Lisa Feldman Barrett, ni ce qu'est un SVG, ni qu'un moteur en TypeScript tourne sous le capot. On joue, on façonne, on regarde la pierre se former. Et quelque part, sans le savoir, on a pesé sa plume.

C'était ça, l'obsession. Faire un caillou — et avoir le cran de jeter la plus jolie idée que j'avais sur le sujet. Sois pas vache : dis-moi si je t'ai ennuyé·e, je t'en serai reconnaissant. Mais avoue que pour un truc qui « ràv avec des souvenirs et des galets », ça tient drôlement debout. 🙃

---

## Sources mobilisées

- **`03-guide-de-style.md`** (intégral) : voix (tutoiement, écriture inclusive légère, « Maman et Tata » comme prétexte à vulgariser, apartés `[…]` 1–3 par section, registres haut/bas, pull-quotes `>`, titres à jeux de mots, **anti-redondance** : varier refs/memes/métaphores/émojis, ne pas surexploiter le filon bouffe + 🍽 ni le gag « THE END · rideau », garde-fou « matière première à réécrire, 0 % publié tel quel »).
- **`draft.md`** (≈150 premières lignes) : ton, ouverture, métaphore minérale (« abandonner mon rocher au bord du chemin »), héritage des **colonnes de Beck** (exercice TCC, jauge d'intensité 0–10, objectiver la soupe émotionnelle), « royalement chiant », apartés-memes.
- **`_digests/apple-journal.md`** :
  - *28 mars — Emotion picker* : projet Claude (Cowork) + Design Manifest ; **6 concepts d'artifacts bugués mais féconds** (Breathing Pearl SVG pur, Erosion Shaper « accélérateur de particules », Stacking Rings cairn, Gravity Pearl « cringe », Sediment Press « presser = donner du poids », Ripple Pool bounce/ricochet) ; verbatims *« it's hilarious… this gloomy rotating molecule is quite cringe »* / *« the game aspect make it fun. »*
  - *28 mars — Dark mode themes* (contexte palettes, non détaillé ici).
  - *29 mars — Simpler emotion picker* : essai Claude non concluant → refait seul sur Figma.
  - *29 mars — Valence explorations* : shaper **intensité [1:3] × valence [-2:+2]** sur le **modèle circumplex de Barrett** ; revue Stone Drop / Sculpt / Topographic (« run! ») / Breath / Constellation (« aweful ») ; verbatims *« What's easy to understand is not playful. What's looking playful at first sight is unusable in the end. »* + *« I've still not found the nugget for this shaper. »*
  - *29 mars — emotion pearl* : 1re version du shaper visuel ; piste **Rive** pour animer le SVG.
  - *30 mars — Pebble design explorations with AI* : système arrêté — **Intensité** low=petit/oblong (2 angles), medium=triangulaire (3), high=losange (4) ; **Valence/Polarité** négatif=sombre/aigu/mat, neutre=ardoise/lisse/poli, positif=multicolore/lumineux. Outils **Nano Banana Pro** + challenge **Claude** + un après-midi avec une **amie ex-brand manager**. Skeuomorphique trop 3D ; « river-stone striation » la plus proche ; certains stones « ressemblent à des cookies festonnés ». Verbatim *« an instinctive and metaphorical way to appropriate the Barrett's scheme without having to understand it intellectually. »*
  - *8–9 avril — Shapes* : **9 canvas (Intensité × Valence) dessinés à la main, sans IA** ; style ultra-plat (cohérence avec les Glyphs) ; **abandon des Emotion Pearls** ; verbatim *« I also decided to get rid of the Emotion Pearls, and to put the color of the emotion directly in the SVG fill. »*
- **`_digests/gemini.md`** (DIGEST 2) :
  - § « Comment Duolingo génère ses Share Cards » : View-to-Bitmap / Canvas / SVG ; image *calculée* donc nette.
  - § « Architecture Design System de rendu » : *« ils créent des bibliothèques de composants… le code assemble ces morceaux comme des LEGO. »*
  - § « Application concrète au pebble engine » : galet composé **paramétriquement** depuis un souvenir (intensité → taille/forme, valence → matière « grey and eroded », retro → fossile d'ammonite, émotions → veines, glyphe → zone carrée).
  - Note matter vs material (« the pebble's matter will be grey and eroded »).
  - **Note de complétude (l. 113)** : section adjacente non développée — « visualisation émotions façon **Inside Out** ». → ancre la réf **Vice-Versa / billes-perles de souvenirs** comme origine documentée de l'Emotion Pearl (couleur = émotion), pas une invention du rédacteur.
- **`_digests/tech-stack.md`** (§ `engine/` + inventaire protos Visuel&Valence) :
  - `engine/` daté **2026-04-12**, 4 fichiers : `types.ts` (PebbleSize small/medium/large, **PebbleValence highlight/neutral/lowlight**, contrats input/output + AnimationManifest), `glyph.ts` (normalisation/centrage), `layout.ts` (**matrice 3×3** taille×valence, positions pré-calculées), `compose.ts` (compositor server-side appelé par les **RPC `create_pebble`/`update_pebble`** ; empile shape → fossil opacité 0.3 → glyph ; force `currentColor` monochrome ; **manifeste d'animation** reveal chronométré **glyph 0 ms, shape 600, fossil 1000, fill 1200, settle 1600**).
  - README repo : **Pebble (intensity 1–3, positiveness −2…+2)** → confirme le couple intensité × polarité et les **9 valences** (3 × 3 = 9 formes).
  - Inventaire protos : `emotion-pearl-shapers.jsx` (28 mars), `pebble-shaper-explorations.jsx` (29 mars, Stone Drop), `pebbles-concept-sheet.html` (29 mars, grille 9 variations), `pebble-shaping-prototype.html` (30 mars, touchpad 2D), `pebble-renderer.jsx` (5 avr.), `pebble-engine-workbench.jsx` (12 avr., DEFAULT_LAYOUT 3×3 extrait tel quel dans `engine/layout.ts` le même jour).
- **`pebbles-design_direction.md`** (intégral, « Eroded Flat / Neo-primitive ») : « everything is flat and animation-ready, but nothing is geometrically perfect » ; pastels géologiques (pigments, pas bonbons) ; icônes pétroglyphes flat sans contour ; **« le mouvement est la texture d'un design plat »** (motion gravitationnelle : les choses tombent, se posent, ont du poids) ; texture réservée aux moments de récompense.
- **`pebble-renderer.jsx`** (proto 5 avr., lu) : `getPebblePath(intensity, valence)` (low=oblong, medium=triangulaire, high=losange/diamant) avec **facteur `sharp = 0.55` pour valence négative** (courbes rentrées = pierre plus acérée) ; trois palettes `getValencePalette` (négatif sombre `#1C1C2E`, neutre ardoise `#8B9BAE`, positif irisé) ; **veines** d'émotion (1/2/3 rubans selon intensité) ; **fossile d'ammonite** si `retro` ; zone de glyphe carrée ; 8 émotions, 12 glyphes. → preuve concrète de l'état « avant bascule » (palettes riches façon pearl) face au futur moteur monochrome.
- **`02-backlog-editorial.md` § B1** : angle (« comment un souvenir est devenu une forme »), les 6 beats, longueur cible 2 500–3 500 mots, points à soigner (tension lisible/ludique, citation « nugget », mapping Barrett rendu sensible).
- **`00-chronologie.md`** : dates et charnières (28–30 mars genèse visuelle ; 5–9 avril simplification ; 12 avril extraction `engine/`) ; **changelog** : *Emotion Pearl Visualizer* (29 mars 09:30), *Pebble Visual Engine* (5 avr. 19:41, « œuvre générative unique selon intensité, couleur d'émotion, glyphe »), *Remote Pebble Render Engine* + *Emotion-Colored Pebble Artwork* (16 avr.), *Valence Picker Sheet* (19 avr., « nine shapes, two polarities — one gesture »).

## [À COMPLÉTER]

1. **Anecdote concrète de l'après-midi avec l'amie ex-brand manager** (section « Nano Banana, Claude et l'amie ») : la voix attend du vécu — un échange précis, son prénom (ou un surnom), une remarque marquante d'elle, le moment exact du « cookie festonné ». Le digest ne donne aucun détail nominatif ni dialogue. À injecter par Alexis. *(marqueur inline posé dans la section)*
2. **Le dosage exact du ressenti à la bascule du 8–9 avril** (abandon des Emotion Pearls) : j'ai écrit deuil + soulagement (le beat « tuer sa darling » est désormais central), mais Alexis seul sait le mélange réel sur le moment, et s'il y a eu un soulagement immédiat ou seulement rétrospectif. *(marqueur inline posé dans la section)*
3. **Statut exact de la feature « retro » / fossile d'ammonite dans le produit livré** : très présent dans `pebble-renderer.jsx`, le digest Gemini (retro → ammonite), le `compose.ts` (calque « fossil ») et une spec Notion (*toggle fossil*). Mais est-ce *vraiment shippé* dans l'app actuelle, ou resté au stade moteur/proto ? Ne pas l'affirmer livré sans vérif. *(marqueur inline posé dans la section moteur)*
4. **Le nom et le geste du picker final côté utilisateur** : le changelog parle d'un *Valence Picker Sheet* (19 avr., « nine shapes, two polarities — one gesture »). Vérifier que c'est bien l'aboutissement UI direct du « shaper » raconté ici, et si le geste final est un *touchpad 2D* (proto 30 mars) ou autre chose. Préciser comment l'utilisateur façonne concrètement aujourd'hui. *(marqueur inline posé en fin de section moteur)*
5. **« river-stone striation »** : mentionné comme la piste la plus proche du but le 30 mars — a-t-elle survécu dans le rendu final monochrome (les stries dans le SVG), ou abandonnée avec le passage au plat ? À trancher. *(marqueur inline posé dans la section 30 mars)*
6. **Captures / visuels à intercaler** (la voix d'Alexis ponctue de légendes `[…]()`) : prévoir les images — les 6 artefacts ratés du 28 mars, la planche 9 canvas du 9 avril, un avant/après pearl → fill, le reveal animé du galet, et idéalement une image-clin-d'œil aux billes de *Vice-Versa* pour le beat de la perle. Emplacements à marquer dans la version finale.
7. **Vérif Notion non fournie au subagent** : pages `DSG · Pebble Engine V3` (« pebble shape + glyph + toggle fossil ») et `Pbbls · Pebbles on Nano Banana` citées dans le brief mais non accessibles ici — à recouper pour préciser le brief de génération d'images et la spec V3 du moteur (toggle fossil = confirme/infirme le point 3).
8. **Crédit Vice-Versa / Pixar** : la réf des billes-de-souvenirs est ajoutée à la demande d'Alexis et corroborée par le digest Gemini (« visualisation émotions façon Inside Out »). Vérifier qu'aucune formulation ne laisse entendre une affiliation officielle à Pixar/Disney ; c'est une *inspiration assumée*, pas un partenariat.
