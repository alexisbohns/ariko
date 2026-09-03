---
Title: Jouer sans piéger · Counter, Bounce, Karma et le refus du streak
Statut: BROUILLON subagent "Levels" (matière première à réécrire — 0% à publier tel quel)
Tag: Gamification/Bounce
Brief: B5 (gamification éthique — les leviers du jeu contre les dark patterns)
---

# Jouer sans piéger · comment récompenser sans asservir

Bon. Aujourd'hui, on touche au sujet qui me met le plus mal à l'aise de tout le projet. Pas parce qu'il est compliqué — parce qu'il est **piégé**.

Je vais te parler de **gamification**. [Pour Maman et Tata, et toute la tablée qui n'a pas grandi une manette à la main : « gamifier », c'est prendre les ressorts du jeu vidéo — points, niveaux, badges, petites récompenses qui font *pling* — et les coller sur un truc qui n'est pas un jeu. Ton app de sport qui te file des médailles, ta carte de fidélité et son 10e café offert : de la gamification. L'idée que progresser doit se *voir* et se *fêter*.] Et tout le malaise tient en une phrase : **les exacts mêmes leviers qui peuvent t'aider à prendre soin de toi peuvent aussi te transformer en hamster sur sa roue.**

C'est la même poudre — médicament ou poison selon le dosage et l'intention. Alors la vraie question de cet article, ce n'est pas « comment gamifier Pebbles ? ». C'est : **comment se servir des armes du jeu *contre* ceux qui s'en servent pour te capter ?**

[Le mot savant du jour, parce qu'il revient partout : **dark pattern**. Littéralement « motif sombre ». Une astuce d'interface conçue pour te manipuler — t'enfermer, te culpabiliser, te faire cliquer là où tu ne voulais pas. La case « se désabonner » planquée en gris sur gris. Le compte à rebours bidon « plus que 2 minutes ! ». Et, vedette de notre histoire, la **série** qui menace de s'effondrer si tu loupes un jour.]

Trois pièces composent le système de Pebbles : le **Counter**, le **Bounce**, le **Karma**. Trois façons de dire « bravo » sans jamais dire « reviens ou tu perds tout ». Et au-dessus, une couche de récompense qui, elle, a vraiment du **sens** : les **Cairns**. On déroule.

> La même poudre fait le médicament ou le poison. Toute la question, c'est l'intention de celui qui dose.

Ah, t'es pressé·e ? La version courte d'abord, on fera l'autopsie ensuite.

# Bande annonce · l'histoire, version courte

J'ai grandi avec Duolingo qui m'a appris l'allemand et la peur de perdre ma flamme 🔥. J'admire le *craft* de leur gamification — sincèrement, c'est de l'orfèvrerie. Mais je refuse leur arme la plus connue : le **streak**, cette série de jours consécutifs qui te récompense tant que tu tiens et te **punit** dès que tu craques. Surtout dans une app de bien-être, où culpabiliser quelqu'un qui va déjà mal est à peu près l'inverse du métier.

Alors j'ai construit trois compteurs qui récompensent **sans menacer**. Le **Counter** compte tes souvenirs, bêtement, et un nombre ne redescend jamais. Le **Bounce** mesure ta régularité sur une **fenêtre glissante de 28 jours** : tu reviens, il monte ; tu disparais, il s'érode doucement — jamais de remise à zéro, jamais de couperet. Un **anti-streak**. Le **Karma** récompense la *richesse* de ce que tu déposes, pas la quantité. Et par-dessus, les **Cairns** : des récaps de ta vie qui *racontent quelque chose* plutôt que de faire briller un chiffre.

Le tout étayé par trois béquilles savantes que je vulgariserai en chemin — la théorie de l'**autodétermination**, l'hygiène **dopaminergique**, les **habitudes atomiques** — et clos sur un chantier encore ouvert : le **Bounce, que je suis en train de remettre sur l'établi**.

C'est parti pour la version à la loupe.

---

## 1. Duolingo, mon maître et mon contre-exemple

Commençons par une confession : **j'adore Duolingo.** Le petit hibou vert, sa manière de transformer une corvée (apprendre une langue) en un truc qu'on a envie de faire tous les soirs. Quand j'ai pivoté Pebbles — d'un outil de thérapie un peu austère vers une app qu'on a *envie* d'ouvrir —, Duolingo était l'une de mes trois étoiles polaires. [Les deux autres, pour mémoire : Polarsteps pour le partage de qualité, Pokémon pour le plaisir de collectionner. J'en ai parlé ailleurs.]

Mais admirer un artisan, ce n'est pas approuver tous ses outils.

L'arme la plus célèbre de Duolingo, c'est le **streak** : ta flamme, le nombre de jours d'affilée où tu as fait ta leçon. 200 jours, 365 jours, les gens en sont **fiers** — et ils ont raison, c'est un bel accomplissement. Le problème n'est pas la fierté. C'est le **mécanisme de la peur** qui la sous-tend.

[Le streak, décortiqué pour la tablée : c'est une chaîne. Chaque jour ajoute un maillon. Tu rates **un seul** jour — tu es malade, ta vie déraille trois heures — et *crac*, la chaîne casse, retour à zéro. Tout l'édifice de 199 jours, par terre. Le génie pervers : plus ta série est longue, plus tu as **peur** de la perdre, donc plus tu reviens. La motivation n'est plus le plaisir d'apprendre ; c'est l'angoisse de la rupture.]

Tu vois le glissement ? Au début, le streak *sert* l'utilisateur : il l'aide à tenir une habitude. Mais passé un certain point, l'utilisateur **sert le streak** — il ouvre l'app non pas par envie, mais parce qu'un petit chiffre le tient en otage. Duolingo a même dû inventer des rustines (« gels de série », « réparations ») pour adoucir le couperet. C'est l'aveu que le couperet, dès le départ, fait mal.

> Au début, le streak sert l'utilisateur. Passé un seuil, l'utilisateur sert le streak.

Et maintenant, transpose à Pebbles. Mon app collecte des **souvenirs**, dans un esprit de calme et de soin de soi. Imagine : tu traverses une mauvaise passe — un deuil, une dépression, une semaine pourrie — et l'app que tu avais téléchargée *pour aller mieux* t'envoie « ⚠️ Ta série de 47 jours va expirer ! ». [Au pire moment, l'outil censé t'épauler te tape sur les doigts pour ne pas avoir collecté de souvenir heureux pendant que tu coulais. La cruauté involontaire absolue.] Non. Mille fois non. **Pas de streak.** Ligne rouge dès le premier jour.

Reste à comprendre pourquoi cette intuition de dégoût a, en fait, de bonnes raisons scientifiques. Parce que je ne voulais pas juste suivre mon instinct — je voulais qu'il soit étayé.

---

## 2. Le paradoxe du streak · quand la récompense décourage

Voilà le truc contre-intuitif, le **paradoxe du streak** : un mécanisme conçu pour te motiver finit, dans certaines conditions, par te **dé**motiver. Et pas qu'un peu.

L'enchaînement est sournois. Tant que ta série monte, tout va bien — tu es dans la lumière. Mais le jour où elle casse (et elle **finira** par casser : personne ne tient une chaîne quotidienne à vie), il se passe un effet psychologique bien documenté : le « **et puis merde** ». [Les chercheurs l'appellent plus poliment le *what-the-hell effect*, « l'effet et-puis-merde ». L'idée : une fois la perfection brisée, on lâche tout. Le régime tenu six jours s'effondre au premier carré de chocolat — « foutu pour foutu, autant finir la tablette ». Le streak, c'est pareil : un jour manqué et le « tout ou rien » te souffle qu'il n'y a plus rien à sauver.] Le zéro n'est pas un point de redépart neutre ; il est vécu comme un **échec**. Et on n'a pas envie de retourner sur le lieu de son échec.

Le streak fabrique donc exactement ce qu'il prétend combattre : l'**abandon**.

[Et c'est encore pire en contexte bien-être. Une app de méditation, de sommeil, de souvenirs, parle à des gens **précisément** dans les moments où leur vie n'est pas régulière. Exiger la régularité parfaite de gens en plein chaos, c'est leur garantir l'échec, puis la honte. Headspace — l'app de médit — a justement réfléchi tout haut là-dessus : faut-il vraiment infliger un streak punitif à quelqu'un qui vient chercher du calme ? La réponse de bon sens, c'est non.]

> Le streak maximise l'assiduité au prix d'une fragilité totale. Une fissure, et tout s'écroule — le bâtisseur avec.

[À COMPLÉTER : sourcer précisément la position de **Headspace** sur les streaks en contexte bien-être (article, interview, post de blog produit ?). Je l'ai en tête comme l'exemple canonique du « paradoxe du streak appliqué au mental health », mais il me faut la référence exacte avant publication — ne pas leur faire dire ce qu'ils n'ont pas dit. Idem pour la formulation académique du *what-the-hell effect* (souvent attribuée aux travaux sur l'autorégulation type Polivy & Herman) : citer la source réelle, pas une vague « des chercheurs ».]

Petit clin d'œil pour les amateurs : **Nassim Taleb** a forgé le mot « **antifragile** » — non pas ce qui *résiste* aux chocs (ça, c'est robuste), mais ce qui s'en **renforce**. [L'os qui durcit quand on le sollicite : antifragile. Le verre, qui ne fait que casser : fragile.] Un streak, par construction, est **fragile** : le moindre choc le détruit. Le système que je cherchais devait au moins être **robuste** — encaisser un jour manqué sans broncher — et, dans l'idéal, faire d'une absence une raison de **revenir** plutôt que de fuir. C'est exactement ce que le mot « bounce » va incarner.

---

## 3. Trois compteurs qui disent bravo sans menacer

Donc, exit le streak. Restait à construire autre chose. Ça a donné un trio, chacun avec son icône et sa petite **modale** explicative [une *modale*, c'est cette fenêtre qui surgit par-dessus l'écran quand tu touches un truc, pour t'expliquer ce que c'est avant de se refermer ; je voulais que chaque compteur se présente lui-même, en une phrase, sans manuel]. Présentations.

### Le Counter · le plus bête, et c'est volontaire

Le **Counter**, c'est le nombre brut de pebbles que tu as posés. Point. Tu en as 3, tu en as 340. [Oui, « counter » = « compteur ». Le degré zéro de la gamification : on compte, on affiche.]

Sa vertu, c'est sa **bêtise honnête**. Un Counter ne juge pas, ne menace pas, ne redescend **jamais** : chaque souvenir ajouté est acquis pour toujours. Là où le streak peut t'effacer 199 jours d'un coup, le Counter est un cliquet qui ne tourne que dans un sens. Rassurant comme un bocal où l'on dépose des billes : il ne se vide pas tout seul la nuit.

### Le Bounce · la régularité sans la laisse

Le **Bounce**, c'est la pièce maîtresse, et la plus subtile. C'est un **rang, de 0 à 7**, qui mesure ta **régularité récente** — pas ton total, pas ta série. Et le mot-clé, celui que je vais te marteler, c'est **« récente »** : le Bounce vit sur une **fenêtre glissante de 28 jours**.

[Décortiquons « fenêtre glissante » (*rolling window*), parce que c'est tout le truc. Imagine une fenêtre, une vraie, large de 28 jours, posée sur le calendrier. Elle ne montre **que** les 28 derniers jours. Et chaque nuit, elle **avance d'un cran** : le jour le plus ancien sort par la gauche, aujourd'hui entre par la droite. Pas un compte figé qui part d'une date de départ ; une fenêtre qui glisse avec toi, collée au présent. Ton Bounce, c'est juste : « à quel point as-tu été régulier·e dans ce qu'elle voit en ce moment ? »]

Et voilà pourquoi c'est un **anti-streak**, le contraire mécanique de la flamme Duolingo :

- **Un streak se *casse*. Le Bounce, lui, s'érode.** Tu sautes un jour, une semaine ? Il ne tombe pas à zéro. Le jour manqué finit simplement par sortir de la fenêtre, sans drame, et ton rang descend d'un cran, doucement. Pas de couperet, pas de « tu as TOUT perdu ».
- **Un streak punit l'absence. Le Bounce récompense la présence.** La seule façon de le faire monter, c'est de revenir — pas de « ne jamais s'arrêter ». On ne te tient pas en otage avec une menace, on t'accueille avec une porte ouverte.
- **Un streak cassé te dégoûte d'y retourner** (le fameux « et puis merde »). Le Bounce, lui, **n'a pas de point de non-retour** : tu peux toujours le faire remonter. Pas de ruine à fuir, juste un niveau qui attend.

> Un streak se casse, et la rupture te chasse. Un Bounce s'érode, et l'érosion t'invite à revenir.

[Le nom « bounce » — rebondir — n'est pas un hasard, mais je ne refais pas ici l'épopée de sa trouvaille : il y a un article entier sur le naming, la saga du « ricochet », et le jour où j'ai poliment ignoré l'IA qui me conseillait autre chose. Pour ici, retiens ceci : une chose qui **rebondit** *remonte après être tombée*. Le mot a imposé la bienveillance du mécanisme — j'avais gardé « streak » ou « chaîne », j'aurais traîné toute leur logique punitive sans m'en rendre compte.]

### Le Karma · récompenser la profondeur, pas le volume

Le troisième larron, le **Karma**, répond à une peur précise : et si, à force de récompenser la *quantité*, je poussais les gens à bâcler ? À balancer dix souvenirs vides pour gonfler le chiffre ? [C'est le travers classique de la gamification mal pensée : tu récompenses ce qui est *facile à mesurer* (le nombre), les gens optimisent pour ça, au détriment de ce qui compte (la qualité). On appelle ça jouer *contre* sa propre métrique.]

Le Karma s'enrichit donc selon la **richesse** du pebble : as-tu ajouté une description ? Nommé l'émotion ? Consigné les pensées qui te traversaient ? Plus tu prends soin d'un souvenir, plus il te rend de Karma. [Et c'est réactif : reviens *enrichir* un vieux pebble en lui ajoutant une pensée, et ton Karma réagit. La récompense suit l'attention, pas le clic.] Le Counter dit « tu en as fait combien ». Le Karma dit « avec quel soin ».

Ensemble, ces trois-là forment un **garde-fou en triangle** : le Counter valorise le simple fait de **déposer** (anti-page-blanche), le Bounce valorise de **revenir** (la régularité douce), le Karma valorise de **fouiller** (la profondeur). Aucun des trois ne menace, ne se vide, ni ne te met de couperet sur la nuque.

[À COMPLÉTER : confirmer le détail exact de chaque mécanique en prod au moment d'écrire — notamment la **formule du Karma** (quels champs comptent, combien chacun rapporte) et le **barème précis du Bounce** (comment on passe du rang 0 au rang 7 : seuils, vitesse d'érosion). D'après mes notes : Bounce = rang 0–7 sur 28 jours glissants, shippé le 1ᵉʳ avril (« Karma & Bounce System »). Mais voir aussi la section 6 : la mécanique exacte était **en cours de refonte** à la mi-mai, donc dater ce qu'on décrit.]

---

## 4. La science derrière la bienveillance · pourquoi ça tient debout

Je ne voulais pas que tout ça repose sur mon seul « parce que je le sens ». Le risque, quand on refuse une mécanique éprouvée comme le streak, c'est de jeter le bébé avec l'eau du bain : sans aucune contrainte, une app de bien-être devient un jardin si calme que **plus personne n'y revient**. Il fallait un autre moteur. Trois corpus m'ont servi de boussole.

### La théorie de l'autodétermination · trois besoins, pas une carotte

[La grande idée, vulgarisée : pendant des décennies on a cru que pour faire agir les gens, il fallait des carottes et des bâtons. La **théorie de l'autodétermination** (en anglais *Self-Determination Theory*, abrégée SDT) dit que la motivation la plus solide, celle qui dure, est **intrinsèque** : elle vient de l'intérieur. Et qu'elle s'épanouit quand trois besoins psychologiques sont nourris.] Ces trois besoins :

- **L'autonomie** — agir par choix, pas sous la contrainte. [Un streak la viole frontalement : tu reviens *parce qu'il le faut*. Le Bounce la respecte : tu reviens *parce que tu veux*, et il t'accueille sans te culpabiliser.]
- **La compétence** — sentir que tu progresses, que tu deviens bon à un truc. [Le rôle des rangs du Bounce : voir une jauge monter, c'est se sentir capable. La récompense n'est pas un bonbon extérieur, c'est le **reflet** de ta progression.]
- **Le lien social** (*relatedness*) — se sentir relié à d'autres, compter pour quelqu'un. [D'où le fait que dans Pebbles les gens de tes souvenirs sont des « **souls** », des âmes, et pas des « contacts ». Mais ça, c'est l'autre article.]

Le streak ne nourrit **aucun** de ces trois besoins — il les piétine même (zéro autonomie, échec = zéro compétence, la honte isole). Mon trio essaie au contraire de **caresser les trois**. C'est ça, la différence entre une mécanique qui te respecte et une qui t'exploite : pas le fait d'avoir des récompenses, mais **d'où vient le carburant**.

> La vraie question n'est pas « récompense ou pas ». C'est : la motivation vient-elle de **toi**, ou d'une menace qu'on a installée dans ton téléphone ?

### L'hygiène dopaminergique · ne pas te shooter

Deuxième boussole, plus organique. [La **dopamine**, pour la table : un messager chimique du cerveau, souvent résumé — un peu vite — à « la molécule du plaisir ». Plus juste : la molécule de l'**envie**, de l'anticipation, celle qui te fait tendre la main vers le téléphone *avant même* d'avoir réfléchi.] Les apps qui veulent te capter sont devenues des **distributeurs de dopamine** : likes imprévisibles, scroll sans fin, récompenses aléatoires calibrées comme une machine à sous.

Une psychiatre, **Anna Lembke**, a beaucoup écrit là-dessus — sur la manière dont nos plaisirs faciles et répétés finissent par dérégler notre équilibre et nous laissent, paradoxalement, plus en manque qu'avant. [À chaque pic de plaisir provoqué artificiellement répond ensuite un creux. Trop de pics, et la ligne de base s'effondre : il en faut toujours plus pour ressentir moins. Le mécanisme de fond de l'addiction, exactement ce que les apps à dopamine exploitent.] Je ne veux pas que Pebbles soit un distributeur. Le rythme de la pierre est **lent** : on ne pose pas quarante souvenirs par minute ; on en pose un, posément, et on s'arrête.

[D'où un choix qui peut surprendre : le système a un **plafond**. Au-delà d'un certain volume sur la fenêtre, *plus n'est pas mieux* — un sommet « sain » au-delà duquel s'acharner ne rapporte rien. La plupart des apps n'ont **aucun** plafond, justement pour que tu puisses toujours t'enfoncer plus loin. Mettre un toit, c'est dire « tu en as assez fait, va vivre ta vie ». J'y reviens en section 6 — c'est au cœur de mes explorations du moment.]

[À COMPLÉTER : citer précisément l'ouvrage de **Anna Lembke** (*Dopamine Nation* / « Génération dopamine » en VF, 2021) et, si je veux être carré, la formulation exacte de l'**équilibre plaisir-douleur** (le « see-saw », la balançoire) qu'elle décrit — ne pas paraphraser de mémoire. Vérifier aussi que je n'extrapole pas au-delà de ce qu'elle affirme.]

### Les habitudes atomiques · le petit geste bat la grande résolution

Troisième et dernière boussole. **James Clear**, dans son bouquin sur les « **habitudes atomiques** », défend une idée simple et libératrice : ce ne sont pas les grandes résolutions héroïques qui changent une vie, mais les **tout petits gestes répétés**. [« Atomique » a deux sens ici, les deux comptent : *minuscule* (un geste si petit qu'on ne peut pas le rater) et *fondamental* (l'atome, la brique dont tout le reste est fait).]

Or — et c'est ça qui me plaît — un système *à la Clear* récompense le **fait de se pointer**, pas la performance. Tu n'as pas besoin d'écrire la page parfaite ; juste de **poser un caillou**, même minuscule. [C'est exactement la raison du Quick Pebble editor, cette saisie en quelques secondes dont je parle dans l'article sur le Flow : abaisser la barre d'entrée au ras du sol, pour que l'habitude tienne *justement* les mauvais jours. Le jour où tu n'as la force de rien, tu peux quand même poser un galet minuscule — et c'est lui qui sauve l'habitude.] Clear insiste : on veut un système où **rater une fois ne casse rien** — « ne jamais manquer deux fois » plutôt que « ne jamais manquer ». Mot pour mot, la philosophie du Bounce : un trou ne te détruit pas, il attend juste que tu reviennes.

> On ne bâtit pas une mémoire avec des résolutions héroïques. On la bâtit un caillou à la fois, surtout les jours où on n'en a pas envie.

[À COMPLÉTER : référence exacte — **James Clear, *Atomic Habits* (2018)**, « Un rien peut tout changer » en VF — et vérifier l'attribution de la maxime « **never miss twice** » (manquer une fois c'est un accident, deux fois c'est le début d'une nouvelle (mauvaise) habitude). C'est de lui, mais citer le passage proprement.]

---

## 5. Les Cairns · la récompense qui raconte quelque chose

Jusqu'ici, j'ai surtout parlé de **ne pas faire de mal** : pas de streak, pas de couperet, pas de distributeur à dopamine. Mais une gamification éthique ne se résume pas à un chapelet d'interdits. Il faut aussi **donner** quelque chose en échange — une vraie récompense. Sinon on a juste construit un potager si tranquille que personne n'y revient. La question devient : **comment récompenser sans appâter ?**

Ma réponse tient en un mot : les **Cairns**. [Le cairn, je le rappelle vite pour qui débarque : ce petit tas de pierres qu'on empile en montagne pour baliser un chemin. Dans Pebbles, tu empiles tes souvenirs-galets en cairns. Tout l'univers de noms, j'en parle ailleurs ; ici, ce qui compte, c'est ce que le cairn *fait* côté récompense.]

Et pour expliquer d'où vient cette idée, une petite obsession à t'avouer : j'adore les **wraps**. [Un *wrap* — « emballage », « ce qui enveloppe » —, c'est ce récapitulatif festif que certaines apps te sortent en fin de période. Le plus connu : le **Spotify Wrapped**, ce bilan musical de ton année que la moitié de ton feed partage chaque décembre.] Moi, je suis fièrement chez Deezer, et chaque **premier du mois**, la toute première chose que je fais en ouvrant les yeux, c'est vérifier si mon **#MyDeezerMonth** est tombé. Cette petite **impatience joyeuse**, ce rendez-vous qu'on attend, c'est *exactement* le réflexe que je veux faire naître dans Pebbles.

Les **Cairns**, ce sont donc des **wraps de ta vie** : des récapitulatifs à l'échelle de la **semaine, du mois, de l'année**. Empiler tes pebbles en cairns, compléter un « **Cairn marathon** », débloquer des récompenses au passage. [Pas des récompenses-bonbon vides genre « +50 gemmes ! », mais des récompenses qui te **rendent ta propre histoire** : voilà ta semaine, voilà la forme qu'elle a prise, voilà les émotions qui l'ont traversée. Le **sens** rendu visible.]

Tu vois la différence de nature avec un badge Duolingo ? Un badge classique te récompense d'avoir **obéi au système** (« 7 jours d'affilée ! »). Un Cairn te récompense d'avoir **vécu**, et te le **rend** sous une forme contemplative. L'un te félicite d'avoir nourri la machine ; l'autre te tend un miroir de ta vie. C'est, je crois, la distinction-clé entre une récompense qui **capte** et une qui **honore**.

> Un badge te félicite d'avoir nourri la machine. Un Cairn te rend ta propre vie, emballée pour que tu la contemples.

[Une nuance, pour ne pas me contredire : un wrap **chaque semaine**, ce serait trop — personne ne veut une cérémonie tous les sept jours, ça userait la magie. Alors le groupement par semaine et ses onglets, déjà là côté navigation, jouent le rôle d'un **proto-wrap** discret : une semaine entamée mais pas finie *appelle* qu'on la complète, comme une barre à moitié pleine. Mais toute la **mécanique de navigation** (vue par semaine, swipe, onglets), je l'ai racontée dans l'article sur le **Path** — file la lire. Ici, je ne garde que la couche *récompense* : le Cairn comme rétrospective qu'on a envie d'attendre.]

[À COMPLÉTER : **statut réel des Cairns**. Au moment où j'écris, les Cairns (wraps semaine/mois/année, « Cairn marathon », récompenses) sont-ils **livrés**, en cours d'implémentation, ou encore au stade **vision** ? Mes notes penchent fortement vers « vision / pas encore shippé » (le rapport analytics de début mai *recommande* de shipper les Cairns comme prochain levier — donc ils n'existaient pas encore à cette date). Ne PAS présenter les Cairns comme une feature en place : à formuler comme une couche à venir, étayée par le proto-wrap déjà présent. Vérifier contre le changelog et l'état de l'app.]

---

## 6. Le chantier ouvert · je suis en train de refaire le Bounce

Je pourrais m'arrêter là, sur une belle architecture théorique bien rangée. Sauf que ce serait mentir par omission. La vérité, au moment où j'écris ces lignes, c'est que **le Bounce, je suis en plein dans sa refonte.** Et tant mieux que je te le dise : un produit honnête, ça se montre aussi à mi-réparation, pas seulement repeint pour la photo.

Reprenons. Le Bounce a été **livré** début avril : un rang de 0 à 7 sur la fenêtre glissante de 28 jours. Sur le papier, nickel. À l'usage, des gênes ont émergé, et je me suis retrouvé à les explorer noir sur blanc à la **mi-mai**, dans un banc d'essai où j'ai mis deux philosophies en concurrence. [Un *banc d'essai* : un document de maquettes où je pose côte à côte plusieurs solutions au même problème, pour *voir* laquelle respire le mieux avant de coder quoi que ce soit. On ne construit pas, on compare.]

Les deux pistes, je les ai baptisées **Path A** et **Path B**. [Rien à voir avec le « Path » de navigation, malheureuse collision de vocabulaire — appelle-les « piste A » et « piste B » dans ta tête.]

**Path A — faire évoluer la fondation des 28 jours.** Ici, je garde l'idée littérale : 28 jours, 28 cases, chacune remplie si tu as posé un galet ce jour-là. Et je fais juste **varier la métaphore visuelle** pour voir laquelle « sonne » Pebbles plutôt que tableur. J'ai maquetté quatre habits pour la même donnée :
- une **grille de calendrier** 7×4, la plus lisible — mais qui risque de faire « tableau de productivité » façon GitHub, pas « mémoire » ;
- un **cairn empilé** : 28 galets montés en tas, les jours manqués étant des pierres absentes, des trous dans la silhouette. Très raccord avec la marque [la forme *est* ton mois] — mais aux rangs très bas, le cairn a l'air cassé, presque triste ;
- un **champ de ricochets** : chaque jour actif émet des ondes concentriques sur un étang horizontal, les récentes vives, les anciennes qui s'estompent. Magnifiquement raccord (le galet sur l'eau !) — mais moins précis, dur à *compter* d'un coup d'œil ;
- un **sentier de pas japonais** : 28 pierres le long d'un chemin sinueux, façon Polarsteps, les jours vides étant des sauts. Le plus narratif — mais le plus difficile à lire comme un « niveau ».

**Path B — remettre en cause les niveaux discrets eux-mêmes.** Là, je prends du recul et je me demande si « niveau 4 sur 7 » est même le bon modèle mental. [Un niveau « discret », c'est un palier net, par marches : tu es au niveau 3, ou au 4, jamais entre les deux. À l'opposé, une mesure « continue » bouge à chaque petit pas.] J'ai exploré :
- une **jauge continue** : pas de niveaux du tout, juste « 16 sur 25 », une aiguille qui bouge à **chaque** souvenir — donc chaque geste compte visiblement, fini les paliers plats où rien ne change. Avec un **plafond à 25** assumé comme un « palier sain » : au-delà, plus n'est pas mieux. [Le revers : on perd le petit shoot identitaire du « je suis **niveau 4** », plus difficile à fêter et à montrer.] ;
- un **badge composite** fait de plusieurs « atomes » (5 ou 7 pierres) qui se remplissent par seuils : ton badge *grandit* littéralement, et il est joli à montrer — mais à l'intérieur d'un atome, rien ne bouge (retour des paliers plats) ;
- une **constellation** : **aucun chiffre**, 28 points en cercle allumés là où il y a eu de l'activité, et un simple mot qualitatif à la place du niveau — *clairsemé · régulier · vibrant · dense*. [C'est la piste la plus radicalement « calme » : elle abandonne carrément l'échelle de jeu pour quelque chose de contemplatif. Tu ne *chasses* plus un nombre, tu *contemples* la forme de ton mois et tu te demandes « suis-je dans une saison clairsemée ? ». Le revers, évidemment : sans niveau ni progression chiffrée, le petit ressort qui te fait revenir demain est plus faible.]

Tu sens la tension de fond ? **Plus je rends le truc calme et contemplatif (constellation, jauge douce), moins il y a de ressort ludique qui te ramène. Plus je muscle le côté jeu (niveaux, badges à collectionner), plus je risque de retomber dans ce que je fuyais.** C'est l'arbitrage central de toute gamification éthique, et je n'ai pas encore tranché. [Et c'est l'honnêteté de cet article : je ne te vends pas une réponse propre. Je te montre un designer, en mai 2026, le nez dans ses maquettes, qui hésite entre la paix et l'élan — et qui sait que la bonne réponse est probablement un dosage des deux, pas un camp. 🪨]

> Plus c'est calme, moins ça rappelle. Plus ça rappelle, plus ça risque d'asservir. La gamification éthique, c'est tout entière dans ce dosage.

[À COMPLÉTER : préciser **où en est la refonte du Bounce** au moment exact de la publication — ai-je tranché pour une piste (laquelle ? la jauge continue + plafond 25 a ma préférence à la lecture des maquettes, mais à confirmer) ? est-ce encore en exploration ouverte ? Et l'état chiffré : la maquette de mi-mai parle d'un **plafond à 25** et d'un état « 16 pebbles / niveau 4 », alors que le Bounce livré était 0–7 sur 28. Clarifier ce qui est *vision* vs *prod* pour ne pas désorienter un lecteur qui a l'app sous les yeux.]

---

## Épilogue · gamifier ce qui compte vraiment

Si je dois ramasser tout ça en trois cailloux, les voici.

D'abord : **les leviers du jeu ne sont ni bons ni mauvais — c'est l'intention qui tranche.** Les mêmes ressorts qui font les dark patterns peuvent faire une app qui prend soin de toi. Toute la différence tient dans une question : ce système est-il là pour *te* servir, ou pour te capter ? Le streak punitif sert le système ; le Bounce essaie de te servir, toi.

Ensuite : **on peut refuser une mécanique sans renoncer à toute mécanique.** J'ai jeté le streak, pas la motivation — je l'ai juste cherchée du côté du **renforcement positif** plutôt que de la menace, de la **reconnaissance** de ce que tu vis plutôt que de la captation de ton attention. Counter, Bounce, Karma, Cairns : quatre façons de dire « bravo » et « reviens quand tu veux », zéro façon de dire « ou sinon ».

Enfin : **la finalité doit valoir le jeu.** Je n'ai pas honte de gamifier ; j'ai tenu à mettre le jeu au service de quelque chose qui compte *réellement* — ta mémoire, le soin que tu t'apportes en la cultivant. Gamifier pour gamifier, c'est du sucre. Gamifier pour t'aider à garder une trace de ta vie et à y revenir avec douceur, c'est légitime. La nuance tient à ce qu'il y a **au bout** du jeu.

> Je ne gamifie pas pour te retenir. Je gamifie pour t'aider à garder une trace de ta vie — et ça, ça vaut le coup de jouer.

Le réflexe de l'industrie, c'était le streak. Mon pari, c'est le rebond. Et entre les deux, il y a tout ce qui sépare une app qui te tient en otage d'une app qui te tend la main.

Et si tout ce laïus t'a barbé : sois pas vache, dis-le-moi, je t'en serai reconnaissant.

---

## Sources mobilisées

- **`docs/journal/atelier-editorial/03-guide-de-style.md`** — calibrage de la voix (tutoiement, registres haut/bas, apartés `[…]` 1–3 par section et **variés** : vulgarisation, méthode, coulisses, clin d'œil ; pull-quotes en `>` ; vulgarisation systématique du jargon : *gamification, dark pattern, streak, dopamine, rolling window, modale, SDT*). **Règle anti-redondance appliquée** : émojis rares et **variés** (🔥 référentiel pour la flamme du streak, 🪨 une fois) ; **pas** de filon culinaire/🍽 ; **pas** de gag « THE END · rideau » ; refs/memes différents des articles voisins (pas de Huh Cat / Mr. Bean / Astérix ici).
- **`docs/journal/draft.md`** (≈150 premières lignes) — ton (intro « pas née, devenue », adresse « Maman et Tata », note « 0% écrit par une IA », clôture « sois pas vache, dis-le-moi »), origine TCC/colonnes de Beck/dépression (contexte du « bien-être » et du refus de culpabiliser), structure « Bande annonce · version courte » puis version longue à sections-titres.
- **`docs/journal/atelier-editorial/_digests/apple-journal.md`** —
  - **25 mars · Duolingo vs Babel** : abandon de l'approche clinique, les gens veulent le résultat pas le processus pénible ; Duolingo comme modèle de récompenses (et contre-modèle de dark patterns).
  - **25 mars · End of the week** : « how to reward regularity ethically, how to reward quantity without dark patterns » → fonde directement les beats Counter/Bounce/Karma.
  - **2 avril · Gamification erzatz** : **Counter** (records bruts), **Bounce** (rang **0–7** sur **fenêtre glissante 28 jours**), **Karma** (enrichi selon la richesse du pebble), incréments à l'affichage du success screen.
  - **2 avril · Explained gamification** : chaque compteur a une **icône + modale explicative** ; Karma réactif aux éditions (« Pebble enrichment »).
  - **2 avril · Carving** : vision **Cairns** (wraps hebdo/mensuels) déjà esquissée.
- **`docs/journal/atelier-editorial/_digests/gemini.md`** — DIGEST 1 §G (saga **streak → ricochet → skip → bounce**) : mobilisé en **renvoi** (l'aparté « le nom bounce n'est pas un hasard ») et **non re-déroulé**, pour ne pas dupliquer l'article B3. Note finale du digest : l'app a tranché **« Bounce »** (changelog « Karma & Bounce »).
- **`bounce-explorations.html`** (proto **15 mai 2026**) — section 6 (la refonte) : **Path A** = faire évoluer la fondation des **28 slots** (4 métaphores maquettées : calendar grid, cairn, ripple field, stepping-stone trail) vs **Path B** = remettre en cause les **niveaux discrets** (jauge continue **16/25** avec **plafond 25 = « healthy plateau, more isn't better »**, badge composite 5/7 atomes, **constellation** sans chiffre avec mots *Sparse/Steady/Vibrant/Dense*). État commun montré par les maquettes : **16 pebbles sur 28 jours, niveau 4**. Tension « calme vs ressort ludique » tirée des `tradeoffs` du proto.
- **`docs/journal/atelier-editorial/02-backlog-editorial.md` §B5** — angle (« gamifier sans asservir », « les leviers du jeu contre les dark patterns »), les beats (critique streaks punitifs → Counter/Bounce/Karma → SDT/dopamine → Cairns → explorations Path A/B), longueur cible 2 000–3 000, et renvoi du naming « bounce » à B3.
- **`docs/journal/atelier-editorial/00-chronologie.md`** — datations : **Karma & Bounce System** = **1ᵉʳ avril 2026 08:40** (record → karma, revenir régulièrement → bounce, écran de célébration) ; Bounce **0–7 / 28 j glissants** (log 2 avr.) ; vision **Cairns** (2 avr. « Carving ») ; rapport **analytics W18 (≈1ᵉʳ mai)** recommandant de **shipper les Cairns** comme prochain levier ; proto **`bounce-explorations.html` = 15 mai** (« le plus récent »).
- **`docs/journal/atelier-editorial/brouillons/B2b-le-path.md`** — pour **ne pas dupliquer** la couche navigation : le wrap/Cairns y a été introduit par l'angle navigation (Spotify Wrapped, **#MyDeezerMonth** Deezer, proto-wrap du groupement hebdo + onglets). Ici, traité comme couche **récompense** uniquement, avec renvoi explicite à B2b pour la mécanique. Réfs Deezer/wrap reprises du même matériau autoritaire d'Alexis.
- **`docs/journal/atelier-editorial/brouillons/B3-naming-cairn.md`** — saga « bounce » et arc « désobéir à l'IA » : **cités, pas répétés** (renvoi). Terminologie « anti-streak », « bounce karma », « souls » alignée sans rien y ré-affirmer de neuf. Réutilise la maxime « une chose qui rebondit remonte après être tombée » (déjà posée en B3) en la rattachant ici à la **mécanique** d'érosion plutôt qu'au naming.
- **`docs/journal/atelier-editorial/brouillons/_notes-relecture.md`** — consigne anti-surclaim appliquée : Bounce **« shippé puis ré-interrogé »** (pas « stabilisé ») ; grades speck→nugget→monolith = **exploration**, donc **non mentionnés** ici comme système de récompense livré ; tout claim « livré » encadré d'un `[À COMPLÉTER]`.
- **Faits cadres du brief** (autoritaires) — Counter/Bounce/Karma + icône + modale ; Bounce = anti-streak sur fenêtre glissante 28 j (revenir pour le maintenir, pas de chaîne punitive) ; Karma selon richesse (description/émotion/pensées) ; positionnement (renforcement positif > performativité, reconnaissance > attention, gamification au service de ce qui compte) ; le wrap → Cairns (Deezer, Cairn marathon, proto-wrap hebdo) ; ancrages science : paradoxe du streak (réf. Headspace), SDT (autonomie/compétence/lien), Lembke (dopamine), Clear (habitudes atomiques), Taleb (antifragilité).

## [À COMPLÉTER]

**État réel « livré vs exploré » (anti-surclaim — le plus important) :**
1. **Bounce** — confirmé **livré le 1ᵉʳ avril** (rang 0–7 / 28 j glissants), mais **en refonte à la mi-mai** (proto `bounce-explorations.html`). À formuler partout comme **« shippé puis ré-interrogé »**, jamais « stabilisé ». Et **trancher l'état au jour de publication** : ai-je arrêté une piste (Path A vs B) ou est-ce encore ouvert ? (Section 6.) La maquette parle d'un **plafond 25** et d'un état « 16/niveau 4 » qui ne coïncide pas avec le 0–7 livré → distinguer clairement *prod* (0–7) et *exploration* (jauge 0–25). 
2. **Cairns** — très probablement **pas encore livrés** au moment d'écrire (le rapport analytics de début mai *recommande* de les shipper → ils n'existaient donc pas en prod à cette date). NE PAS les présenter comme une feature en place : couche **à venir**, étayée par le proto-wrap (groupement hebdo + onglets) déjà présent. Vérifier contre changelog + état app. (Section 5.)
3. **Karma** — confirmer la **formule exacte en prod** (quels champs comptent : description, émotion, pensées… et le poids de chacun) et le **barème précis du Bounce** (seuils de passage rang 0→7, vitesse d'érosion). (Section 3.)
4. **Plafond « sain »** — confirmer qu'un **plafond** (anti-sur-enregistrement) existe vraiment en prod ou n'est qu'une **piste d'exploration** (il apparaît dans les maquettes Path B, pas certain qu'il soit dans le Bounce 0–7 livré). (Sections 3 et 6.)

**Citations « science » précises (ne pas paraphraser de mémoire) :**
5. **Headspace & paradoxe du streak en contexte bien-être** — trouver la **source exacte** (article/interview/post produit) de leur position sur les streaks punitifs ; à défaut, requalifier en exemple plus prudent ou retirer le nom propre. (Section 2.)
6. **What-the-hell effect** — citer la **source académique réelle** (souvent rattachée aux travaux sur l'autorégulation, p. ex. Polivy & Herman) plutôt que « des chercheurs ». (Section 2.)
7. **Self-Determination Theory** — créditer **Deci & Ryan** et vérifier la formulation des **trois besoins** (autonomie / compétence / lien social — *autonomy / competence / relatedness*). (Section 4.)
8. **Anna Lembke** — référence exacte (*Dopamine Nation*, 2021 ; VF « Génération dopamine ») et formulation juste de l'**équilibre plaisir-douleur** (la « balançoire »/see-saw), sans extrapoler. (Section 4.)
9. **James Clear** — *Atomic Habits* (2018 ; VF « Un rien peut tout changer ») et attribution propre de la maxime **« never miss twice »**. (Section 4.)
10. **Nassim Taleb / antifragile** — vérifier l'usage (le concept « antifragile = se renforce sous le choc » est bien de lui, *Antifragile*, 2012) ; m'assurer que je ne sur-étire pas l'analogie au Bounce. (Section 2.)

**Voix / vécu à incarner (le grain final, c'est toi) :**
11. Anecdote perso sur **Duolingo** (quelle langue, combien de jours de streak, le jour où il a cassé et ce que ça a fait) pour ancrer la section 1 dans du vécu plutôt que de la théorie.
12. Le **ressenti** de la refonte du Bounce (section 6) : laquelle des maquettes te parle vraiment, et *pourquoi* — l'intuition derrière le choix, façon « le jour où j'ai choisi Bounce contre l'IA » en B3.
13. Vérifier la **collision de vocabulaire** « Path » (navigation) vs « Path A/B » (les deux pistes de la refonte) : reformuler si ça embrouille (j'ai mis un garde-fou en crochets, mais à arbitrer).
