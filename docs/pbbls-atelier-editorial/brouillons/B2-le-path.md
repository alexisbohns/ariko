---
Title: Le Path · comment enregistrer un souvenir est passé de 15 étapes à un geste de quelques secondes
Statut: BROUILLON subagent (matière première à réécrire — 0% à publier tel quel)
Tag: Path/RecordFlow
Brief: B2
---

# Le Path · de la corvée en 15 étapes au galet en trois secondes

Bon. Si tu as lu le reste de mes élucubrations, tu sais déjà que Pebbles n'est pas *née* app de souvenirs, elle l'est *devenue*. Et tu sais aussi que tout est parti d'un truc pas franchement sexy : les colonnes de Beck, un exercice de thérapie cognitivo-comportementale en sept étapes que j'ai porté sur Notion parce que ça me sauvait la vie et que je voulais le partager.

[Rappel pour Maman et Tata, qui débarquent : les "colonnes de Beck", c'est un exercice où tu décortiques une situation qui t'a chamboulé·e — la situation, tes émotions, leur intensité, tes pensées, ton comportement — pour prendre du recul. Ultra-puissant. Ultra-chiant. Les deux à la fois.]

Aujourd'hui je veux te raconter une histoire précise, une seule : celle de **comment on enregistre un souvenir** dans Pebbles. Parce que ce geste, ce tout petit geste, est passé en quelques semaines d'un **formulaire à rallonge de quinze étapes** à quelque chose qui te prend **trois secondes** quand t'es dans le métro.

Et crois-moi, ces trois secondes m'ont coûté un dimanche entier. THE END, La Fin, rideau — mais on y reviendra. 😅

> Note · La règle d'or de toute cette aventure, c'est ce qu'on appelle en conception le *single responsibility* (responsabilité unique). On en reparle plus bas, mais garde ça en tête : faire en sorte que chaque chose fasse **une seule chose**, et la fasse bien.

Ah t'es pressé·e ? Voici la bande-annonce : un tableau de six colonnes est devenu un parcours de quinze étapes (mieux, mais relou), que j'ai éclaté en micro-étapes ultra-propres (encore mieux, mais long), qui a explosé en vol un dimanche maudit, avant de renaître en un éditeur unique et compact qui flotte au bord d'un chemin. Le chemin, c'est le *Path*. Voilà. Le reste, c'est la version archéologue-au-pinceau.

---

## 1. Beck-ground bis : l'héritage encombrant des quinze étapes

Reprenons où le récit principal s'arrête : novembre 2025.

À ce moment-là, je me lance sur une **webapp** [une application qui reste un site web utilisable dans un navigateur, sur ordi comme sur mobile — pas une "vraie" app installée]. J'y consacre un bon mois et demi, en soirée et le week-end, et j'aboutis bien plus loin que jamais : une appli sur laquelle tu peux te créer un compte et tenir un journal d'analyse de situations à la Beck, avec un registre d'émotions et de domaines calqué sur celui qu'Apple a choisi dans son app Santé.

Ça marche de bout en bout. Et pourtant, je fais un constat qui me plombe le moral :

- toute l'interactivité que j'ai ajoutée est **annulée par la complexité** que j'ai ajoutée. En clair, c'est passé d'un vieux tableau de six colonnes à un vrai parcours progressif… mais il y a maintenant **quinze étapes** ;
- pire : malgré toute la guidance que j'ai mise, ça reste bien relou à faire, pour pas dire **royalement chiant** ;
- et l'expérience sur cellulaire reste médiocre, aussi *responsive* [adaptée au format du téléphone] soit-elle.

> « C'est passé d'un vieux tableau de 6 colonnes à un vrai parcours progressif, mais il y a maintenant 15 étapes. »

Tu vois le paradoxe ? J'ai voulu rendre l'outil moins intimidant en le découpant, en l'accompagnant, en le rendant "progressif". Et j'ai accouché d'un truc plus long, plus lourd, qui demande plus de patience que le tableau austère du départ. J'avais remplacé un mur par un couloir de quinze portes.

[Image mentale : la corvée administrative. Tu connais ce moment où tu remplis un formulaire en ligne, "étape 3 sur 12", et tu sens ton âme quitter lentement ton corps ? Voilà. J'avais conçu ça. Pour des **souvenirs**. Bravo champion.]

Insatisfait, désabusé, j'abandonne une nouvelle fois mon rocher au bord du chemin.

[THE END, La Fin, rideau, générique, ciao bonsoir.]

Sauf que cette fois, le rocher ne reste pas longtemps au bord du chemin. En février 2026, le concours d'apps mobiles de Luni me remet le pied à l'étrier. Et je vais reprendre exactement là où j'avais buté : ce satané flux de capture.

---

## 2. Un flow, pas un formulaire : la fièvre du "single responsibility"

Fast-forward au concours. On est fin mars, j'ai repris le chantier sur une nouvelle stack [l'empilement de technologies sur lesquelles tourne l'app], et le 27 mars je pose ce que j'appelle dans mes notes le **record flow shell** : le squelette du parcours d'enregistrement. Juste l'ossature, avant le *delight* [tout ce qui rend une expérience agréable, les petites attentions, les animations qui font plaisir].

Et là, le 29 mars, je prends une décision qui va structurer tout le reste. Dans mon journal de bord, je l'ai notée comme ça : **"Single purpose record flow"**.

Traduction pour la tablée : au lieu d'un gros formulaire où tout est entassé sur le même écran, j'éclate le parcours en **étapes mono-objectif**. Chaque écran ne te demande **qu'une seule chose** :

- l'heure du souvenir,
- son titre,
- sa description,
- l'intensité,
- l'émotion,
- les *souls* [les personnes qui comptent — j'évite à dessein le mot "users", j'y reviendrai un jour],
- les *domains* [les domaines de vie, façon Maslow revisité],
- les *cards*…

Et là, dans mes notes, une phrase qui résume tout :

> « It's no longer a form but a real flow. » (Ce n'est plus un formulaire, mais un vrai parcours.)

[C'est ça, le fameux *single responsibility*, le "principe de responsabilité unique". L'idée — piquée au développement logiciel mais qui marche aussi pour le design — c'est que chaque brique ne devrait avoir **qu'une seule raison d'exister**. Un écran, une question. Comme à l'oral du bac : on te pose une question à la fois, pas les douze d'un coup. Imagine qu'on te demande simultanément ta date de naissance, ton avis sur Spinoza et ce que tu as mangé hier. Panique. Une chose à la fois, et ton cerveau respire.]

Petit détail que j'adorais : quand tu revenais en arrière dans le flow, il y avait des **effets de transition** ("action effects when moving backward", dixit mes notes). C'était pas juste fonctionnel, ça commençait à *vivre*. J'étais content. Sur mobile c'était encore "loin du natif" [loin de ressembler à une vraie app iOS], mais l'intention y était.

J'avais réglé le problème du mur-couloir : au lieu de quinze portes intimidantes, des questions simples qui s'enchaînent. Sauf que… quinze questions simples, ça reste quinze questions. Tu vois où je veux en venir ?

---

## 3. Le piège de la complexité : quand "bien guidé" rime avec "moins abordable"

Voilà le truc fourbe avec la guidance. Plus tu accompagnes, plus tu découpes, plus tu expliques… plus c'est **long**.

C'est un classique de la conception, et c'est même un peu vicieux : chaque étape que tu ajoutes part d'une bonne intention (rendre les choses plus claires, plus douces, moins intimidantes), mais l'addition de toutes ces bonnes intentions produit un parcours interminable. L'enfer est pavé de bonnes micro-étapes.

[Métaphore culinaire, parce que c'est mon péché mignon 🍽 : c'est comme une recette qui te fait laver, peser, équeuter, tailler chaque ingrédient dans un bol séparé "pour bien faire". À la fin t'as vingt bols sales, tu mets trois heures, et t'avais juste envie d'une omelette.]

Et là apparaît la vraie tension, celle qui va me hanter pendant des jours. Plus tard, quand je simplifierai, je noterai noir sur blanc le compromis : l'ancien flow était plus **pédagogique** ; le nouveau, plus rapide, devient *"less affordable"* — moins évident à prendre en main.

> Tension fondatrice : un parcours qui **t'apprend** à enregistrer un souvenir, ou un parcours qui te **laisse** l'enregistrer en trois secondes ? Spoiler : tu ne peux pas maximiser les deux.

[*"Affordable"* ici, attention faux-ami : ça ne veut pas dire "pas cher". En design, une *affordance*, c'est ce qu'un objet te suggère de faire rien qu'en le regardant. Une poignée de porte "affordable", c'est une poignée qui te crie "tire-moi" ou "pousse-moi" sans notice. Un truc *less affordable*, c'est un truc plus efficace une fois que tu sais t'en servir, mais moins évident au premier contact. Le couteau suisse vs le couteau à beurre, quoi.]

Et c'est exactement le dilemme du débutant contre l'habitué. Mes quinze étapes hyper-guidées, c'était génial pour quelqu'un qui découvre l'introspection et a besoin qu'on lui tienne la main. Mais pour quelqu'un qui veut juste **capturer un instant avant qu'il file**, c'était une punition.

Or — et c'est le cœur de tout Pebbles — je conçois une app qu'on est censé ouvrir **tous les jours**, comme une habitude calme. Une habitude quotidienne qui prend quinze étapes, ça n'existe pas. Ça s'appelle une corvée, et les corvées, on les abandonne. (Demande à mon template Notion partagé en 2023, que personne n'a jamais rempli malgré mon pitch de vendeur de tapis.)

Il fallait trancher. Mais avant de trancher proprement, j'allais d'abord me planter magistralement.

---

## 4. Wasted Sunday : la leçon la plus chère du projet

Ah, le dimanche. Jour du Seigneur, jour du repos. Jour où, le 5 avril 2026, j'ai méthodiquement saboté huit heures de ma vie. Laisse-moi te le raconter, parce que c'est probablement l'échec le plus instructif de toute l'aventure.

Ce jour-là, je décide de m'attaquer au **pebble engine** [le "moteur du galet" : tout le système qui, à partir de ce que tu saisis, fabrique et stocke le souvenir et son apparence]. Et comme un grand garçon plein d'ambition, je veux le faire *bien*. Du coup je spécifie, je modélise, j'implémente… un moteur **beaucoup trop complexe**.

Mes propres mots dans le journal de bord, que je te livre sans filtre :

> « I literally wasted my sunday speccing and implemented a too complex pebble's engine… In the end, I flushed everything. »
> (J'ai littéralement gâché mon dimanche à spécifier et implémenter un moteur de galet trop complexe… Au final, j'ai tout balancé.)

*Flushed everything.* Tout à la poubelle. J'ai tiré la chasse sur mon dimanche. 🚽

[Pour visualiser : "flush", c'est le bouton de la chasse d'eau. Donc oui, j'ai imagé mon dimanche de travail comme un truc qu'on évacue aux toilettes. Le design émotionnel commence par soi-même, paraît-il.]

Mais — et c'est là que le gag devient leçon — j'ai compris **pourquoi** je m'étais planté. Mon erreur n'était pas de la malchance, c'était une **mauvaise découpe du travail**.

Je m'y étais pris de façon **linéaire** : construire d'abord toute la base technique (le *back*, l'arrière-cuisine invisible), à fond, complète, parfaite… *puis* attaquer ce que l'utilisateur voit (le *front*, la salle du restaurant). En enchaînant back → front, je m'étais enfermé : j'avais bâti une arrière-cuisine surdimensionnée pour un menu que je n'avais même pas encore goûté.

La bonne méthode, celle que j'aurais dû appliquer (et que j'appliquais déjà *ailleurs*, l'ironie), c'est d'itérer **en pleine épaisseur** — *full-stack* — du **simple vers le complexe**. Tu fais une version qui traverse toute la couche, de la base de données à l'écran, mais minuscule, bête, qui marche. Puis tu l'enrichis tranche par tranche.

> La leçon du dimanche maudit : itérer **simple → complexe** sur toute l'épaisseur, jamais **back → front** sur toute la largeur. Construis un escalier complet d'une marche, pas une marche complète d'escalier.

[Maman, Tata, traduction : imaginez que vous montez un meuble IKEA. La mauvaise méthode, c'est de fabriquer toutes les vis du monde avant de savoir si la planche du fond rentre. La bonne, c'est de monter d'abord un petit truc bancal mais debout, et de le solidifier ensuite. On vérifie que ça tient avant d'en rajouter.]

C'est moche à vivre, un dimanche flushé. Mais c'est ce naufrage qui a rendu possible la suite. Parce que le lendemain (enfin, quelques jours après — la chronologie de mes nuits blanches est un peu floue), j'ai tout repris à l'envers. Et tout est devenu plus simple.

---

## 5. "Pebbles is an app, not a SaaS" : la grande désintoxication

Le 8-9 avril, je fais quatre changements d'un coup. Quatre. Et chacun tire dans la même direction : **dégraisser**.

### Adieu la sidebar, bonjour la sobriété

Le premier déclic tient dans une phrase que je me suis notée comme un mantra :

> « No more dashboard sidebar · Pebbles is an app, not a SaaS. »
> (Plus de barre latérale de tableau de bord · Pebbles est une app, pas un SaaS.)

[Décodage. Un *SaaS* (*Software as a Service*, prononce "sasse"), c'est ce genre de logiciel pro qu'on utilise dans un navigateur, type tableau de bord d'entreprise, avec sa grosse **barre latérale** [*sidebar*] bourrée de menus à gauche. Pense à l'interface de ta banque en ligne, ou d'un Notion, d'un Salesforce. C'est efficace pour bosser huit heures, mais c'est froid, c'est dense, c'est… du logiciel. Une **app** mobile, elle, c'est l'inverse : tu l'ouvres trente secondes entre deux stations, tu fais ton truc, tu refermes. Pas de menu fleuve. Pas de tableau de bord.]

En supprimant cette sidebar, je tuais symboliquement le dernier réflexe "webapp pro" qui me restait dans les doigts. Je faisais une app de souvenirs, pas un ERP pour DAF. À la place de la barre latérale, l'information importante devient une **carte flottante** qui se balade le long du fameux *Path* (le chemin — patience, section 6).

Ce glissement, c'est presque philosophique. J'arrêtais de concevoir un *outil qu'on opère* pour concevoir un *compagnon qu'on consulte*.

### Le Quick Pebble editor : de dix étapes à quelques secondes

Deuxième changement, le gros morceau : le **Quick Pebble editor** [l'éditeur de galet express].

L'idée, c'est de prendre les dix étapes du flow [il en restait dix après quelques coupes] et de les **compacter** dans un seul écran malin. Plus de couloir de portes : tout est là, sous la main, et tu remplis ce que tu veux dans l'ordre que tu veux. Mes notes parlent d'une saisie **"en secondes vs flow de 10 étapes"**.

C'est le moment où Pebbles arrête de te faire passer un interrogatoire et commence à te tendre un carnet ouvert à la bonne page.

### La navigation en *sheet view*

Troisième changement : la navigation passe en **sheet view** [vue en "feuille"].

[Image pour la tablée : une *sheet*, sur ton téléphone, c'est ce panneau qui **remonte du bas de l'écran** par-dessus le reste, comme un tiroir qu'on ouvre. Quand tu partages une photo sur iPhone et que la liste des contacts glisse vers le haut : ça, c'est une sheet. C'est natif, c'est fluide, c'est "téléphone" — à l'opposé de la page web qui se recharge.]

### Le compromis, assumé

Bien sûr, comme dit plus haut, j'achète cette rapidité avec une monnaie : l'ancien flow était plus **pédagogique**, le nouveau est *"less affordable"*. Mais à ce stade j'ai tranché : Pebbles doit d'abord être **tenable au quotidien**. On apprendra à guider autrement (par petites touches, par l'exemple), pas en imposant un tunnel à tout le monde.

> Concevoir, c'est arbitrer. J'ai sacrifié un peu de pédagogie sur l'autel de la fluidité. Parce qu'un outil parfait qu'on n'ouvre jamais vaut moins qu'un outil imparfait qu'on ouvre tous les jours.

### L'éditeur unique + l'auto-focus malin

Et puis, le 9-10 avril, je pousse la logique à son terme. Le Quick editor devient l'**unique** moyen d'enregistrer un pebble. *L'unique.* Toutes les fonctionnalités sont compactées dedans :

> « It's now the unique way to record a pebble as all features are compacted in it. »

Pour y arriver, j'ai dû faire un sacrifice temporaire : les *cards* [les fameuses cartes héritées des colonnes de Beck — feeling, thought… chacune était une question de l'exercice thérapeutique] sont **mises de côté**, "temporarily discontinued". Ça me coûte, parce que les cards, c'est l'ADN TCC du projet, le lien direct avec les colonnes de Beck. Mais je préfère un éditeur qui marche et qu'on utilise, quitte à réintégrer les cards proprement plus tard.

L'architecture de l'éditeur, pour les curieux, ressemble à ça : un en-tête (heure + intensité/valence), un titre, une qualification (domaine + émotion), une description, une zone de personnalisation (glyphe, collection, souls, photos), et un pied de page (visibilité + sauvegarde). Tout ce petit monde dans un seul écran qui se **replie et se déplie selon le focus** [il est compact quand tu ne touches à rien, et s'agrandit quand tu te mets à écrire].

Et la cerise, le détail dont je suis le plus fier : l'**auto-focus si tu as moins de 5 pebbles**.

[Traduction pour Maman et Tata : l'*auto-focus*, ici, c'est l'app qui place automatiquement le curseur dans le champ de saisie et ouvre le clavier, sans que tu aies à toucher quoi que ce soit. Comme un serveur attentif qui te tend le stylo avant même que tu le demandes.]

Pourquoi "moins de 5 pebbles" ? Parce que quand tu débutes, l'app **prend l'initiative** : elle t'ouvre le clavier, elle te pousse gentiment à écrire, elle réduit la friction au minimum pour t'aider à prendre l'habitude. Et une fois que tu as cinq galets, que le réflexe est installé, elle se fait plus discrète et te laisse mener. C'est de la guidance, mais **intelligente et contextuelle** — exactement ce que je cherchais depuis le début, au lieu d'un tunnel à quinze étapes infligé à tout le monde, débutant comme habitué.

> L'app tient la main des débutants, et lâche celle des habitués. La meilleure guidance, c'est celle qui sait disparaître.

---

## 6. Le Path : quand un historique devient un chemin

Reste le plus beau défi, celui que j'avais désigné dès la première semaine comme **le plus dur de tous** : comment navigue-t-on dans son historique de souvenirs ? Dans mes notes, je l'avais formulé brutalement : **"ni liste, ni thread, ni stories"**.

[Décryptage du trio refusé. Une *liste*, c'est froid et infini (ton appli de notes). Un *thread* [fil], c'est l'enfilade chronologique d'une conversation (façon messagerie ou Twitter). Les *stories*, c'est le format bulles éphémères d'Instagram. Trois manières classiques d'empiler du contenu… et trois manières dont je ne voulais surtout pas, parce qu'aucune ne respecte un souvenir. Un souvenir, ça ne se *scrolle* pas comme un fil d'actu.]

La réponse, c'est le **Path** : le chemin. Tes souvenirs ne sont pas listés, ils sont **semés le long d'un sentier** que tu remontes. Chaque galet posé sur le chemin, c'est un instant que tu as capturé. La métaphore minérale prend tout son sens : tu marches le long de ton propre parcours, et tes cailloux jalonnent la route. [Oui, le gadjo et ses métaphores de cailloux, je sais. Mais avoue que c'est plus joli qu'un tableur.]

Et c'est là que tous les morceaux s'emboîtent :

- La **carte flottante** (celle qui remplace la sidebar défunte) se balade le long du Path et te donne le contexte sans alourdir l'écran.
- La navigation se fait par **sheet** qui remonte du bas… puis, le 10-11 avril, j'affine encore : la sheet devient un **centred peek**.

[Le *centred peek*, dernier terme et promis j'arrête. Un *peek*, c'est un "coup d'œil" — un aperçu d'un souvenir qui apparaît au **centre** de l'écran, posé là, comme une carte qu'on retourne, plutôt qu'un panneau qui monte du bas. Le galet qu'on prend dans la main pour l'examiner à la lumière, quoi. C'est plus intime, plus "objet précieux" que "tiroir système".]

- Et le 18 avril, touche finale : l'**artwork du pebble apparaît dans le chemin** ("Pebble Artwork in Path"). C'est-à-dire que la **forme générée** de chaque souvenir — ce galet dont la silhouette et la couleur encodent l'intensité et l'émotion que tu as ressenties — se matérialise directement sur le sentier.

[Si tu as lu l'article sur le visuel du galet, tu sais que chaque pebble a une forme et une couleur uniques, "sculptées" selon ce que tu ressens. Eh bien là, ces formes ne dorment plus dans une fiche : elles **peuplent le chemin**. Ton historique devient littéralement un paysage de cailloux, chacun avec sa gueule.]

Tu vois le chemin parcouru depuis le tableau de six colonnes ? On est passés d'une grille à remplir à un **paysage à arpenter**. D'un formulaire qu'on subit à un sentier qu'on a soi-même pavé, galet après galet, jour après jour.

### Du touchpad au record flow : une petite parenthèse archéologique

[Aparté pour les fouilleurs, parce que j'aime montrer les coulisses 🔧] Bien avant que le Quick editor ne compacte tout, dès le 30 mars, j'avais bricolé un petit prototype baptisé **"Shape Your Pebble"**. L'idée : pour saisir d'un seul geste **l'intensité ET la valence** [la valence = le caractère positif ou négatif d'une émotion], je proposais un **touchpad 2D**.

Concrètement : un grand cercle au milieu de l'écran, avec un galet posé dedans. Tu le **fais glisser au doigt** : vers la **gauche** il devient sombre et anguleux (émotion négative), vers la **droite** il devient lumineux et multicolore comme une gemme (émotion positive), vers le **haut** il grossit et s'intensifie, vers le **bas** il s'apaise. Le galet **change de forme, de couleur et d'ombre en temps réel** sous ton doigt, et quand tu relâches, il "claque" sur la valeur la plus proche avec une petite animation à ressort. Une seule manip pour deux dimensions. Tout le contraire d'un menu déroulant "choisissez une émotion dans la liste".

[Ce proto était un précurseur direct de la philosophie du record flow : remplacer la saisie de données par un **geste**. Au lieu de "renseigner deux champs", tu *sculptes* ton ressenti. C'est exactement la même intuition que celle qui, quelques jours plus tard, ferait passer le flow de quinze étapes à un geste de quelques secondes. La forme suit le ressenti, pas le formulaire.]

[À COMPLÉTER : le sort exact du touchpad 2D dans la version finale — a-t-il survécu tel quel, ou a-t-il fusionné dans le Valence Picker Sheet du 19 avril ("nine shapes, two polarities — one gesture") ? Le digest suggère une bascule vers neuf formes discrètes choisies à la main plutôt que le glissé continu, mais je n'ai pas le détail de la transition. À retracer.]

---

## Épilogue · ce que le Path m'a appris

Si je dois résumer ce que cette odyssée du flux de capture m'a enseigné, c'est à peu près ça :

D'abord, qu'**ajouter de la guidance n'est pas neutre**. Chaque étape "pour aider" est aussi une étape "pour ralentir". Le confort du débutant peut devenir la prison de l'habitué.

Ensuite, que la **bonne découpe vaut mieux que le bon effort**. Mon dimanche flushé ne s'est pas perdu par manque de travail, mais par excès de travail mal orienté. Itérer simple → complexe, sur toute l'épaisseur, plutôt que back → front sur toute la largeur.

Enfin, qu'un produit, ça se définit autant par ce qu'on **enlève** que par ce qu'on ajoute. "Pebbles is an app, not a SaaS" : six mots qui ont fait sauter une sidebar, dix étapes, et pas mal de mes vieux réflexes de responsable produit habitué aux tableaux de bord.

Le souvenir, finalement, méritait un geste, pas un formulaire. Un galet qu'on pose sur un chemin, pas une ligne dans un tableur.

Et si jamais tout ça t'a barbé : sois pas vache, dis-le-moi, je t'en serai reconnaissant. 🙃

---

## Sources mobilisées

- **`docs/journal/draft.md`** (l. 62-73) — la webapp de novembre 2025, le tableau de 6 colonnes devenu 15 étapes, "royalement chiant", le constat d'échec UX et l'abandon. Voix de référence (intro, "Maman et Tata", "THE END La Fin rideau", métaphores minérales/culinaires, faux-amis vulgarisés).
- **`docs/journal/atelier-editorial/03-guide-de-style.md`** — calibrage de la voix (tutoiement, apartés `[...]`, registres haut/bas, pull-quotes, emojis rares, vulgarisation systématique du jargon).
- **`docs/journal/atelier-editorial/_digests/apple-journal.md`** — entrées : *Record flow shell* (27 mars, squelette + "when the root flow is solid, I'll work on product delight"), *Record cards* (27 mars, cartes = questions de Beck), *Single purpose record flow* (29 mars, étapes mono-objectif, "no longer a form but a real flow", "loin du natif"), *Wasted Sunday* (5-6 avril, "flushed everything", leçon de découpe full-stack), *Pebble engine* (8-9 avril, "Pebbles is an app, not a SaaS", Quick Pebble editor, sheet view, "less affordable", carte flottante), *Quick Pebble editor V2* (9-10 avril, éditeur unique, cards "temporarily discontinued", structure header/title/qualification/description/customization/footer, compact/étendu au focus, auto-focus si < 5 pebbles), *Legal foundations* (10-11 avril, sheet → centred peek).
- **`docs/journal/atelier-editorial/02-backlog-editorial.md`** (section B2) — angle et 6 beats.
- **`docs/journal/atelier-editorial/00-chronologie.md`** — dates, "ni liste, ni thread, ni stories" comme plus gros défi de navigation ; changelog (Multi-Step Record Flow 28 mars, Pebble Revelation Screen 5 avr, Intensity-Scaled Cards 5 avr, Quick Pebble Editor 8 avr, Pebble Artwork in Path 18 avr) ; Valence Picker Sheet 19 avr ("nine shapes, two polarities — one gesture").
- **`pebble-shaping-prototype.html`** (PROTO 30 mars) — touchpad 2D intensité × valence : cercle + galet glissable, gauche/droite = valence (sombre-anguleux ↔ gemme-lumineuse), haut/bas = intensité (taille/ombre), snap à ressort au relâchement. Précurseur "geste plutôt que formulaire" du record flow. (Le fichier contient aussi un concept "Carousel" alternatif : 3 galets Sharp/Smooth/Gem puis choix d'intensité.)

## [À COMPLÉTER]

- **[Le devenir du touchpad 2D]** — section 6 : le prototype "Shape Your Pebble" du 30 mars (glissé continu sur touchpad) a-t-il survécu tel quel dans l'app native, ou a-t-il été remplacé par les 9 formes discrètes du *Valence Picker Sheet* du 19 avril ? Le digest penche pour une bascule continu → discret, mais la transition exacte n'est pas documentée dans mes sources. À trancher (et à raconter, car c'est un arbitrage "fluidité vs lisibilité" pile dans le thème).
- **[Le nombre exact d'étapes : 15 vs 10]** — le `draft.md` parle de "15 étapes" pour la webapp de nov. 2025 ; les logs du concours (29 mars, *Pebble engine*) parlent d'un flow à "10 étapes". S'agit-il du même flow dégraissé entre-temps, ou de deux flows distincts (webapp Beck vs flow du concours) ? J'ai présenté les deux chiffres comme deux moments distincts, mais à confirmer/clarifier pour ne pas induire le lecteur en erreur.
- **[Anecdote charnue sur le Wasted Sunday]** — j'ai le verbatim "flushed everything" et la leçon de méthode, mais une anecdote concrète (l'heure à laquelle tu as abandonné, ce que tu t'es dit, le café froid, le moment de bascule) rendrait le gag bien plus vivant. À toi de pimenter avec le vécu.
- **[La réintégration des cards]** — les *cards* sont "temporarily discontinued" au 9-10 avril. Ont-elles été réintégrées depuis (mai 2026) ? Si oui, comment, et où, dans le Quick editor ? Ça bouclerait proprement le fil de l'ADN TCC.
