---
Title: Le Flow · comment enregistrer un souvenir est passé de quinze étapes à un geste de quelques secondes
Statut: BROUILLON subagent (matière première à réécrire — 0% à publier tel quel)
Tag: Path/RecordFlow
Brief: B2a (recentrage de B2)
---

# Le Flow · de la corvée en quinze étapes au galet posé en trois secondes

Bon. Une précision avant qu'on plonge, parce que je tiens à ce que tu ne te perdes pas dans mon vocabulaire de cailloux.

Dans Pebbles, il y a le **Path** et il y a le **Flow**. Deux choses différentes que je confonds moi-même un soir sur deux. Le *Path*, c'est le **chemin** sur lequel tes souvenirs sont **listés** — la page où tu retrouves tes galets, alignés le long d'un sentier que tu remontes. J'en ferai un article à part, parce qu'il le mérite. Le *Flow*, lui — et c'est **lui**, le héros d'aujourd'hui — c'est le **flux de création** : tout ce qui se passe entre le moment où tu as un souvenir à poser et le moment où il est enregistré. Comment tu **captures** un instant. Comment Pebbles te tend le carnet.

Voilà. Path = la liste. Flow = la saisie. Aujourd'hui on parle de la saisie. C'est dit.

[Rappel pour Maman et Tata, qui débarquent en cours de route : les "colonnes de Beck", c'est un exercice de thérapie cognitivo-comportementale où tu décortiques une situation qui t'a remué·e — la situation, tes émotions, leur intensité, tes pensées, ton comportement — pour prendre de la hauteur. Très efficace. Très laborieux. Les deux ensemble, oui.]

Si tu as suivi le reste de mes élucubrations, tu sais que Pebbles n'est pas *née* app de souvenirs : elle l'est *devenue*. Et que tout est parti de ces fameuses colonnes de Beck, un exercice que j'avais bricolé sur Notion parce qu'il me sauvait la mise et que je voulais le partager.

Ce que je veux te raconter, c'est une seule trajectoire, précise : comment ce geste — **enregistrer un souvenir** — est passé en quelques semaines d'un **formulaire à rallonge de quinze étapes** à quelque chose qui te prend **trois secondes** entre deux stations de métro. Et comment, en route, il a changé non seulement de forme mais de *nature* : d'abord un module qui flottait au bord du chemin, puis — bascule que je n'avais pas anticipée — une **feuille qu'on fait remonter d'un bouton**, alignée sur ce que je construisais en parallèle sur iOS.

> Note · Le fil rouge de toute cette histoire, c'est un principe qu'on appelle en conception le *single responsibility* (responsabilité unique) : faire en sorte que chaque chose ne fasse **qu'une seule chose**, et la fasse bien. Garde-le dans un coin de ta tête, on y revient sans cesse.

Ah, t'es pressé·e ? La bande-annonce, alors : un tableau de six colonnes devient un parcours de quinze étapes (mieux, mais pénible), que j'éclate en micro-étapes mono-objectif (encore mieux, mais long), qui explose en vol un dimanche maudit, avant de renaître en un **éditeur unique et compact**. Et cet éditeur, à son tour, quitte le bord du chemin pour devenir une feuille qu'on déclenche. Voilà l'essentiel. Le reste, c'est la version au pinceau et à la brosse à dents.

---

## 1. Beck-ground bis · l'héritage encombrant des quinze étapes

Reprenons là où le récit principal s'arrête : novembre 2025.

À ce moment-là, je me lance sur une **webapp** [une application qui reste un site web utilisable dans un navigateur, sur ordi comme sur téléphone — pas une "vraie" app installée]. J'y passe un bon mois et demi, en soirée et le week-end, et j'aboutis plus loin que jamais : une appli où tu peux créer un compte et tenir un journal d'analyse de situations à la Beck, avec un registre d'émotions et de domaines de vie calqué sur celui qu'Apple utilise dans son app Santé.

Ça fonctionne de bout en bout. Et pourtant, je fais un constat qui me plombe :

- toute l'interactivité que j'ai ajoutée est **annulée par la complexité** que j'ai ajoutée. En clair : on est passé d'un vieux tableau de six colonnes à un vrai parcours progressif… mais qui compte désormais **quinze étapes** ;
- pire : malgré toute la guidance que j'y ai mise, ça reste pénible à remplir, pour ne pas dire **franchement décourageant** ;
- et l'expérience sur téléphone demeure médiocre, aussi *responsive* [adaptée au format mobile] soit-elle.

> « C'est passé d'un vieux tableau de six colonnes à un vrai parcours progressif, mais il y a maintenant quinze étapes. »

Tu vois le paradoxe ? J'ai voulu rendre l'outil moins intimidant en le découpant, en l'accompagnant, en le rendant "progressif". Et j'ai accouché d'un truc plus long, plus lourd, qui demande plus de patience que le tableau austère du départ. J'avais remplacé un mur par un couloir de quinze portes.

[Tu connais cette sensation, "étape 3 sur 12", quand tu sens ton âme quitter doucement ton corps devant un formulaire administratif ? Voilà ce que j'avais conçu. Pour des **souvenirs**. Chapeau l'artiste.]

Insatisfait, désabusé, j'abandonne une fois de plus mon rocher au bord du chemin.

Sauf que cette fois, il n'y reste pas longtemps. En février 2026, le concours d'apps mobiles de Luni me remet le pied à l'étrier. Et je reprends exactement là où j'avais buté : ce satané flux de capture.

---

## 2. Un flow, pas un formulaire · la fièvre du "single responsibility"

Fast-forward au concours. On est fin mars, j'ai repris le chantier sur une nouvelle stack [l'empilement de technologies sur lesquelles tourne l'app], et le 27 mars je pose ce que mes notes appellent le **record flow shell** : le squelette du parcours d'enregistrement. Juste l'ossature, avant le *delight* [tout ce qui rend une expérience agréable : les petites attentions, les animations qui réjouissent]. Dans mon journal : *« When the root flow is solid, I'll work on product delight. »* (Quand le parcours de base tiendra debout, je m'occuperai du plaisir.)

Et là, le 29 mars, je prends une décision qui structure tout le reste. Je l'ai notée comme un titre de chapitre : **« Single purpose record flow ».**

Traduction pour la tablée : au lieu d'un gros formulaire où tout est entassé sur le même écran, j'éclate le parcours en **étapes mono-objectif**. Chaque écran ne te demande **qu'une seule chose** :

- l'heure du souvenir,
- son titre,
- sa description,
- l'intensité,
- l'émotion,
- les *souls* [les personnes qui comptent — j'évite à dessein le mot "users", j'y reviendrai],
- les *domains* [les domaines de vie, façon Maslow revisité],
- les *cards*…

Et dans mes notes, la phrase qui scelle tout :

> « It's no longer a form but a real flow. » (Ce n'est plus un formulaire, mais un vrai parcours.)

[C'est ça, le *single responsibility*, le "principe de responsabilité unique". L'idée — piquée au développement logiciel mais qui vaut aussi pour le design — c'est que chaque brique ne devrait avoir **qu'une seule raison d'exister**. Un écran, une question. Comme à un oral : on te pose une question à la fois, pas les douze d'un coup. Imagine qu'on te demande simultanément ta date de naissance, ton avis sur le libre arbitre et ce que tu as mangé hier. Panique. Une chose à la fois, et le cerveau respire.]

Petit détail que j'adorais : quand tu revenais en arrière dans le flow, il y avait des **effets de transition** (*« action effects when moving backward »*, dixit le journal). Ce n'était plus seulement fonctionnel, ça commençait à *vivre*. J'étais content. Sur mobile c'était encore *« loin du natif »* [loin de ressembler à une vraie app iOS], mais l'intention y était.

J'avais réglé le problème du mur-couloir : au lieu de quinze portes intimidantes, des questions simples qui s'enchaînent. Sauf que… quinze questions simples, ça reste quinze questions. Tu vois où je veux en venir ?

---

## 3. Le piège de la complexité · quand "bien guidé" rime avec "moins abordable"

Voilà le truc fourbe avec la guidance. Plus tu accompagnes, plus tu découpes, plus tu expliques… plus c'est **long**.

C'est un classique de la conception, et c'est même un peu pervers : chaque étape que tu ajoutes part d'une bonne intention (rendre les choses plus claires, plus douces, moins intimidantes), mais l'addition de toutes ces bonnes intentions accouche d'un parcours interminable. L'enfer est pavé de bonnes micro-étapes.

[Image pour visualiser : c'est le syndrome de la notice de meuble en kit qui te fait visser, dévisser, revisser, retourner la planche, vérifier le sens du tenon… alors que tu voulais juste un tabouret pour ce soir. Trois pages plus loin, tu t'assois enfin. Épuisé. Sur le bon tabouret, certes.]

Et là apparaît la vraie tension, celle qui va me hanter pendant des jours. Plus tard, en simplifiant, je le noterai noir sur blanc : l'ancien flow était plus **pédagogique** ; le nouveau, plus rapide, devient *« less affordable »* — moins évident à prendre en main.

> Tension fondatrice : un parcours qui **t'apprend** à enregistrer un souvenir, ou un parcours qui te **laisse** l'enregistrer en trois secondes ? Spoiler : tu ne peux pas maximiser les deux.

[*« Affordable »* ici, attention faux-ami : ça ne veut pas dire "pas cher". En design, une *affordance*, c'est ce qu'un objet te suggère de faire rien qu'à le regarder. Une poignée "affordable", c'est celle qui te crie "tire-moi" ou "pousse-moi" sans notice. Un truc *less affordable*, c'est plus efficace une fois qu'on sait s'en servir, mais moins parlant au premier contact. Le couteau suisse face au couteau à beurre, quoi.]

C'est exactement le dilemme du débutant contre l'habitué. Mes quinze étapes hyper-guidées, c'était parfait pour quelqu'un qui découvre l'introspection et a besoin qu'on lui tienne la main. Mais pour quelqu'un qui veut juste **capturer un instant avant qu'il file**, c'était une punition.

Or — et c'est le cœur de tout Pebbles — je conçois une app qu'on est censé ouvrir **tous les jours**, comme une habitude calme. Une habitude quotidienne qui réclame quinze étapes, ça n'existe pas. Ça s'appelle une corvée, et les corvées, on les lâche. (Demande à mon template Notion partagé en 2023, que personne n'a jamais rempli malgré mon pitch de camelot.)

Il fallait trancher. Mais avant de trancher proprement, j'allais d'abord me planter magistralement.

---

## 4. Wasted Sunday · la leçon la plus chère du projet

Ah, le dimanche. Jour du repos, paraît-il. Jour où, le 5 avril 2026, j'ai méthodiquement sabordé huit heures de ma vie. Laisse-moi te le raconter, parce que c'est sans doute l'échec le plus instructif de toute l'aventure.

Ce jour-là, je m'attaque au **pebble engine** [le "moteur du galet" : tout le système qui, à partir de ce que tu saisis, fabrique et stocke le souvenir et son apparence]. Et comme un grand garçon plein d'ambition, je veux le faire *bien*. Du coup je spécifie, je modélise, j'implémente… un moteur **beaucoup trop complexe**.

Mes propres mots dans le journal de bord, sans filtre :

> « I literally wasted my sunday speccing and implemented a too complex pebble's engine… In the end, I flushed everything. »
> (J'ai littéralement gâché mon dimanche à spécifier et implémenter un moteur de galet trop complexe… Au final, j'ai tout balancé.)

*Flushed everything.* Tout à la corbeille. Huit heures dissoutes. 😅

Mais — et c'est là que le gag devient leçon — j'ai compris **pourquoi** je m'étais planté. Mon erreur n'était pas de la malchance, c'était une **mauvaise découpe du travail**.

Je m'y étais pris de façon **linéaire** : construire d'abord toute la base technique (le *back*, la machinerie invisible), à fond, complète, parfaite… *puis* attaquer ce que l'utilisateur voit (le *front*). En enchaînant back → front, je m'étais enfermé : j'avais bâti une cale de bateau surdimensionnée pour une coque que je n'avais même pas encore mise à l'eau.

La bonne méthode, celle que j'aurais dû appliquer (et que j'appliquais déjà *ailleurs*, l'ironie), c'est d'itérer **en pleine épaisseur** — *full-stack* — du **simple vers le complexe**. Tu fais une version qui traverse toute la couche, de la base de données à l'écran, mais minuscule, bête, qui marche. Puis tu l'enrichis tranche par tranche.

> La leçon du dimanche maudit : itérer **simple → complexe** sur toute l'épaisseur, jamais **back → front** sur toute la largeur. Construis un escalier entier d'une seule marche, pas une marche parfaite d'un escalier qui n'existe pas.

[Maman, Tata, version potager : la mauvaise méthode, c'est de bâtir la serre, le système d'arrosage automatique et l'étiquetage avant d'avoir vérifié qu'une seule graine pousse dans cette terre. La bonne, c'est de faire germer un radis bancal d'abord, et d'industrialiser ensuite. On vérifie que ça prend avant d'en rajouter.]

C'est moche à vivre, un dimanche flushé. Mais c'est ce naufrage qui a rendu la suite possible. Parce que quelques jours plus tard — la chronologie de mes nuits blanches est un peu floue — j'ai tout repris à l'envers. Et tout est devenu plus simple.

---

## 5. Le Quick Pebble editor · de dix étapes à quelques secondes

Le 8-9 avril, je fais une série de changements qui tirent tous dans la même direction : **dégraisser**.

[Aparté, parce qu'un autre déclic de ces journées-là mérite une ligne, pas un chapitre : j'ai aussi sabré une **barre latérale** de tableau de bord que je traînais par réflexe de webapp pro. *« Pebbles is an app, not a SaaS »*, me suis-je noté. Une app de souvenirs, ce n'est pas un logiciel d'entreprise : on l'ouvre trente secondes, on ne l'*opère* pas huit heures. Fin de l'aparté, revenons au flow.]

Le gros morceau, c'est le **Quick Pebble editor** [l'éditeur de galet express].

L'idée : prendre les **dix étapes** du flow [il en restait dix après quelques coupes] et les **compacter** dans un seul écran malin. Plus de couloir de portes : tout est là, sous la main, et tu remplis ce que tu veux, dans l'ordre que tu veux. Mes notes parlent d'une saisie *« en secondes vs flow de dix étapes »*.

C'est le moment où Pebbles cesse de te faire passer un interrogatoire et commence à te tendre un carnet ouvert à la bonne page.

> Concevoir, c'est arbitrer. J'ai sacrifié un peu de pédagogie sur l'autel de la fluidité. Parce qu'un outil parfait qu'on n'ouvre jamais vaut moins qu'un outil imparfait qu'on ouvre tous les jours.

Et le 9-10 avril, je pousse la logique au bout. Le Quick editor devient l'**unique** moyen d'enregistrer un pebble. *L'unique.* Toutes les fonctionnalités sont compactées dedans :

> « It's now the unique way to record a pebble as all features are compacted in it. »

Pour y arriver, un sacrifice temporaire : les *cards* [les fameuses cartes héritées des colonnes de Beck — feeling, thought… chacune était une question de l'exercice thérapeutique] sont **mises de côté**, *« temporarily discontinued »*. Ça me coûte, parce que les cards, c'est l'ADN TCC du projet, le lien direct avec Beck. Mais je préfère un éditeur qui marche et qu'on utilise, quitte à réintégrer les cards proprement plus tard.

L'architecture de l'éditeur, pour les curieux, ressemble à ça : un en-tête (heure + intensité/valence), un titre, une qualification (domaine + émotion), une description, une zone de personnalisation (glyphe, collection, souls, photos), et un pied de page (visibilité + sauvegarde). Tout ce petit monde dans un seul écran qui se **replie et se déplie selon le focus** [compact quand tu ne touches à rien, agrandi quand tu te mets à écrire].

Et la touche dont j'étais le plus fier à ce stade : l'**auto-focus si tu as moins de cinq pebbles**.

[Traduction pour Maman et Tata : l'*auto-focus*, ici, c'est l'app qui place automatiquement le curseur dans le champ de saisie et ouvre le clavier, sans que tu aies à toucher quoi que ce soit. Comme un libraire qui glisse le marque-page à la bonne page avant même que tu ouvres le livre.]

Pourquoi "moins de cinq pebbles" ? Parce que quand tu débutes, l'app **prend l'initiative** : elle ouvre le clavier, elle te pousse doucement à écrire, elle réduit la friction au minimum pour t'aider à installer l'habitude. Et une fois que tu as cinq galets, que le réflexe est pris, elle se fait plus discrète et te laisse mener. De la guidance, mais **intelligente et contextuelle** — exactement ce que je cherchais depuis le début, à la place d'un tunnel de quinze étapes infligé à tout le monde, débutant comme habitué.

> L'app tient la main des débutants, et lâche celle des habitués. La meilleure guidance, c'est celle qui sait disparaître.

À ce stade — je veux être honnête, parce que c'est tout l'intérêt de raconter un chantier en train de se faire — je croyais avoir trouvé la forme définitive : un module compact qui **flotte au bord du Path**, qui s'ouvre tout seul pour les nouveaux, qui se replie pour les habitués. J'étais persuadé d'avoir bouclé la boucle.

Je me trompais. Il manquait une marche. Et cette marche, elle est venue d'iOS.

---

## 6. Le chapitre iOS · quand le flow devient une feuille qu'on tire

Petit changement de décor. Pendant que je peaufinais l'éditeur web, je construisais **en parallèle l'app native iOS** [une vraie app installée depuis l'App Store, écrite en SwiftUI, le langage d'interface d'Apple — pas une page web déguisée]. Et concevoir pour iOS, ça t'oblige à parler la **langue du système**. Tu ne plaques pas tes habitudes de webapp sur un iPhone : tu épouses les codes natifs, sinon ton truc sonne faux, comme un acteur doublé deux fois.

[Pour la tablée : une *sheet*, sur ton téléphone, c'est ce panneau qui **remonte du bas de l'écran** par-dessus le reste, comme un tiroir qu'on tire vers soi. Quand tu partages une photo sur iPhone et que la liste glisse vers le haut : ça, c'est une sheet. C'est natif, c'est fluide, c'est "téléphone" — à l'opposé de la page web qui se recharge.]

Sur iOS, donc, la création d'un pebble prend la forme d'une **single sheet form** : un **formulaire unique, dans une seule feuille** qui remonte du bas. Tu touches un bouton, la feuille monte, tu poses ton souvenir, tu valides, elle redescend. Un geste pour entrer, un geste pour sortir. Net.

Et c'est là que la boucle se referme, mais pas du tout comme je l'avais prévu. En regardant la version iOS, j'ai vu ce qui clochait dans ma version web. Mon éditeur "qui flotte au bord du Path", c'était encore un réflexe de page web : un module **planté en permanence** dans le décor, toujours là, qui s'ouvrait tout seul. Élégant sur le papier. Bancal à l'usage, et surtout **incohérent** entre les deux plateformes.

Alors j'ai aligné le web sur l'iOS. Le Quick Pebble editor a quitté le bord du chemin pour devenir, lui aussi, une **feuille déclenchée par un bouton** — exactement comme sur iPhone. Plus un module incrusté dans le Path : un geste délibéré. Tu **décides** d'enregistrer, tu appuies, la feuille monte.

Conséquence directe, et il faut l'assumer franchement : **fini l'auto-focus**. Dans un module qui flottait là en permanence, ouvrir le clavier automatiquement pour les débutants avait du sens — l'éditeur était déjà sous tes yeux, autant l'amorcer. Mais dans une feuille que **tu** fais monter d'un bouton, le geste d'appui *est déjà* la déclaration d'intention. Tu as dit "je veux écrire" en touchant le bouton ; l'app n'a plus à le deviner à ta place. Forcer le clavier par-dessus ton geste, ce serait répondre à une question que tu viens déjà de poser.

> La même fonction, deux grammaires. Module permanent → l'app devine et amorce (auto-focus). Feuille à la demande → tu déclares, l'app suit (plus d'auto-focus). Ce n'est pas un reniement, c'est un accord de temps.

C'est ça que je trouve beau, avec le recul. L'auto-focus n'était pas une *erreur* : c'était la bonne réponse à la forme d'avant. Quand la forme a changé — du module-toujours-là à la feuille-qu'on-tire —, la bonne réponse a changé avec elle. Le geste de l'utilisateur a remplacé l'anticipation de l'app. Et au passage, web et iOS se sont mis à parler **la même langue** : un bouton, une feuille, un souvenir.

L'arc complet du flow, donc, si tu veux le tenir d'un coup dans la main :

- **un tableau** de six colonnes (Notion, l'origine) ;
- **un parcours** de quinze étapes (la webapp de novembre — mieux, mais pénible) ;
- **un flow mono-objectif** d'une dizaine d'étapes (le concours — propre, mais long) ;
- **un éditeur compact** qui flotte au bord du Path, avec auto-focus pour les débutants (le tournant du 9-10 avril, web) ;
- **une feuille qu'on déclenche d'un bouton**, sans auto-focus, alignée sur l'app iOS native (l'état actuel).

D'un mur à un couloir, d'un couloir à un carnet, d'un carnet posé là à un carnet qu'on **ouvre soi-même** d'un geste. Le souvenir, finalement, méritait un geste — pas un formulaire à rallonge, et pas non plus un meuble qui squatte le paysage en attendant qu'on s'en serve.

---

## Épilogue · ce que le Flow m'a appris

Si je devais résumer ce que cette odyssée du flux de capture m'a enseigné, ce serait à peu près ça.

D'abord, qu'**ajouter de la guidance n'est pas neutre**. Chaque étape "pour aider" est aussi une étape "pour ralentir". Le confort du débutant peut devenir la prison de l'habitué.

Ensuite, que la **bonne découpe vaut mieux que le bon effort**. Mon dimanche flushé ne s'est pas perdu par manque de travail, mais par excès de travail mal orienté. Itérer simple → complexe sur toute l'épaisseur, plutôt que back → front sur toute la largeur.

Enfin — et c'est la leçon que ce recentrage m'a fait creuser — qu'une **bonne solution n'est jamais vraie dans l'absolu, seulement juste pour une forme donnée**. L'auto-focus était parfait pour un module permanent, et caduc pour une feuille à la demande. Concevoir, ce n'est pas trouver LA réponse une fois pour toutes : c'est réaccorder la réponse à chaque fois que la forme bouge — et, quand on tient deux plateformes, les faire parler la même langue.

Le souvenir méritait un geste, pas un formulaire. Un galet qu'on choisit de poser, pas une ligne qu'on subit dans un tableur. Et le jour où le web et l'iPhone ont enfin dit la même chose d'un même bouton, j'ai senti que le flow avait trouvé, sinon sa fin, au moins son juste tempo.

Et si tout ça t'a barbé : sois pas vache, dis-le-moi, je t'en serai reconnaissant. 🙃

---

## Sources mobilisées

- **`docs/journal/draft.md`** (l. 62-73) — la webapp de novembre 2025, le tableau de six colonnes devenu quinze étapes, le constat d'échec UX et l'abandon. Voix de référence (intro, "Maman et Tata", apartés, métaphores minérales, faux-amis vulgarisés).
- **`docs/journal/atelier-editorial/03-guide-de-style.md`** — calibrage de la voix (tutoiement, apartés `[...]`, registres haut/bas, pull-quotes, emojis rares et variés, vulgarisation systématique du jargon, **règle anti-redondance** : varier refs/memes/métaphores/émojis, ne pas recycler le filon culinaire 🍽 ni le « THE END · rideau »).
- **`docs/journal/atelier-editorial/_digests/apple-journal.md`** — entrées : *Record flow shell* (27 mars, squelette + « when the root flow is solid, I'll work on product delight »), *Record cards* (27 mars, cartes = questions de Beck), *Single purpose record flow* (29 mars, étapes mono-objectif, « no longer a form but a real flow », « loin du natif », liste des étapes), *Wasted Sunday* (5-6 avril, « flushed everything », leçon de découpe full-stack simple→complexe), *Pebble engine* (8-9 avril, « Pebbles is an app, not a SaaS », Quick Pebble editor « secondes vs flow de 10 étapes », sheet view, « less affordable », suppression sidebar), *Quick Pebble editor V2* (9-10 avril, éditeur unique, cards « temporarily discontinued », structure header/title/qualification/description/customization/footer, compact/étendu au focus, auto-focus si < 5 pebbles).
- **`docs/journal/atelier-editorial/_digests/tech-stack.md`** — confirme l'**app native iOS SwiftUI** (`apps/ios`, Swift 33,6 % du repo, Supabase Swift SDK), les routes web `record/` (création multi-étapes) et `path/` (timeline), la PWA local-first, et la roadmap iOS (M18 Record flow 17 avril, M19 Timeline 18 avril, M20 TestFlight V0 19 avril).
- **`docs/journal/atelier-editorial/00-chronologie.md`** — dates et jalons du flux de création.

## [À COMPLÉTER]

- **[Mécanique exacte de la single sheet form iOS]** — le brief précise que, sur iOS, la création se fait dans une **single sheet form** (formulaire unique en feuille), et que le Quick Pebble editor web a basculé en **feuille déclenchée par un bouton** (comme iOS), **avec abandon de l'auto-focus**. J'ai raconté cette bascule en suivant le brief. Mais mes digests (`apple-journal.md`, `tech-stack.md`) documentent surtout l'**éditeur web** (sheet view au 8-9 avril, structure de l'éditeur, auto-focus < 5 pebbles) ; ils ne contiennent **pas de verbatim daté** décrivant explicitement (a) la single sheet form iOS, (b) le moment où le Quick editor web passe du "module flottant dans le Path" au "déclenché par un bouton", ni (c) la décision de retirer l'auto-focus. **À sourcer** dans le journal iOS / les notes postérieures au 10 avril, ou à confirmer de mémoire, pour ancrer la bascule sur une date et un verbatim plutôt que sur une reconstruction logique.
- **[Date de la bascule "module → feuille à bouton"]** — sur le web, l'éditeur est décrit le 8-9 avril comme une *sheet view*, et le 10-11 avril la navigation passe en *centred peek* (entrée *Legal foundations*). Le moment précis où l'**éditeur de création** (et non la navigation) devient une feuille déclenchée par un bouton, aligné iOS, reste à dater. Probablement autour des jalons iOS (M17 bootstrap 15 avril, M18 Record flow 17 avril) — à confirmer.
- **[Le sort de l'auto-focus aujourd'hui]** — l'auto-focus « si < 5 pebbles » est documenté au 9-10 avril pour l'éditeur web. Le brief indique qu'il **disparaît** avec la bascule en feuille à bouton. A-t-il été retiré partout (web ET iOS), ou conservé dans un cas ? La logique "le bouton vaut déclaration d'intention" tient, mais le détail d'implémentation final reste à vérifier.
- **[Le nombre exact d'étapes : 15 vs 10]** — le `draft.md` parle de "15 étapes" pour la webapp de nov. 2025 ; les logs du concours (29 mars, *Single purpose record flow* ; 8-9 avril, *Pebble engine*) parlent d'un flow à "10 étapes". S'agit-il du même flow dégraissé entre-temps, ou de deux flows distincts (webapp Beck vs flow du concours) ? Je les ai présentés comme deux moments distincts, mais à confirmer/clarifier pour ne pas induire le lecteur en erreur.
- **[Anecdote charnue sur le Wasted Sunday]** — j'ai le verbatim « flushed everything » et la leçon de méthode, mais une anecdote concrète (l'heure de l'abandon, ce que tu t'es dit, le moment de bascule) rendrait le gag bien plus vivant. À pimenter avec le vécu.
- **[La réintégration des cards]** — les *cards* sont « temporarily discontinued » au 9-10 avril. Ont-elles été réintégrées depuis (mai 2026) ? Si oui, comment, et où, dans le Quick editor (devenu feuille) ? Ça bouclerait proprement le fil de l'ADN TCC.
