---
name: "Chaque commit est de moi. Quatre sur cinq ont un co-auteur."
description: Comment une seule personne a tenu quatre surfaces, une économie et une communauté avec des agents IA — en construisant la mémoire, les garde-fous et les preuves qui leur permettent de bosser à cette échelle.
date: 2026-09-02
bean: pbbls-agentic
---

# Chaque commit est de moi. Quatre sur cinq ont un co-auteur.

364 commits sur `main`. Tous signés de ma main. 285 d'entre eux — 78% — portent une
ligne `Co-Authored-By: Claude`.<!-- src: git rev-list --count main @ 2026-09-02 = 364 ; 285 corps de commit contiennent un trailer Co-Authored-By: Claude -->
Quatre surfaces, une monnaie, un marché, une petite communauté, une personne. Ce qui
est intéressant, ce n'est pas que des agents aient écrit du code. C'est tout ce qu'il
a fallu construire avant.

## Le recensement des trailers

Les merges sont écrasés en un seul commit, donc un même message peut porter plusieurs
trailers [un « trailer », c'est une ligne de métadonnée collée en bas du message de
commit — ici, qui a co-écrit]. Il y en a 1 310 sur `main`, et lus ensemble ils forment
une histoire des versions de modèles du projet : Opus 4.7 (1M context) 497, Fable 5
266, un « Claude » sans nom de modèle 142, Opus 4.6 (1M) 149, Opus 4.8 sous ses deux
formes 133, Sonnet 4.6 76, Opus 5 44, Sonnet 5 3.<!-- src: git log main --format='%B' | grep -i 'Co-Authored-By: Claude' | sort | uniq -c, 2026-09-02 -->

Voilà la thèse en une statistique, et ce n'est pas « l'IA a écrit mon app ». C'est un
partage précis et vérifiable : l'humain est celui qui commite et qui relit ; l'agent
est co-auteur sur quatre commits sur cinq, et le seul acteur qui tient la carte du
produit à jour. Tout ce qui suit, c'est l'infrastructure qu'a exigée ce partage. Et
presque rien là-dedans n'est du code.

## Le journal de décisions, parce que les questions tranchées se re-débattaient

Jusqu'au 26 mai 2026, les décisions d'architecture vivaient dans les issues GitHub.
L'entrée qui a mis fin à ce régime est franche sur la raison de l'échec. Les issues
sont
> « bonnes pour la discussion, mais pas greppables depuis le dépôt, bruyantes, et
> invisibles aux agents au moment de la lecture. Les questions tranchées se
> re-débattaient parce qu'elles n'avaient pas de foyer durable et peu coûteux en
> tokens. »<!-- src: docs/decisions/log.md 2026-05-26 "Track significant decisions in an in-repo log" #477 #482 -->

Trois adjectifs, et c'est le troisième qui est propre aux agents. [« Greppable » =
retrouvable d'une recherche texte dans le dépôt, sans ouvrir un navigateur.] Un humain
qui a débattu d'une question en mars se souvient d'en avoir débattu. Un agent, lui,
démarre chaque session sans aucun souvenir de ce qui n'est pas écrit dans le dépôt. Si
le raisonnement n'est pas noté là où il sera lu, la même question sera re-tranchée —
autrement, et au prix fort.

Donc : un registre en ajout seul, une entrée terse par décision significative, on
supersède au lieu d'éditer, huit champs, et une micro-étape conditionnelle dans la
checklist de PR, « en général un no-op ». Un seul test de significativité gouverne
l'ensemble : « est-ce qu'un futur agent ou humain perdrait un temps réel à
redécouvrir ou à renverser ça par erreur ? »<!-- src: docs/decisions/log.md, bloc d'en-tête lignes 1-11 -->

Quarante-deux entrées plus tard, le bulletin de discipline est instructivement
mitigé.<!-- src: docs/decisions/log.md, grep -c '^## 20' = 42, entrées datées du 2026-05-26 au 2026-09-02 -->
Les 42 portent les huit champs dans l'ordre du gabarit, ligne `Refs` comprise ; pas
une seule à qui il manque le « pourquoi ». Ce qui s'est délité, c'est la brièveté : le
champ Conséquences d'une seule entrée d'août fait dans les 500 mots. [La règle qui dit
« garde les entrées terses » est en haut du même
fichier.]<!-- src: docs/decisions/log.md 2026-08-24, entrée éventail de valence web ; bloc de règles lignes 5-11 -->
L'axe `Status` s'est délité autrement : il ne sert pas. Le gabarit propose `rejected`,
`deprecated` et `superseded-by` ; les 42 disent `taken`, et la supersession se joue en
fait dans le champ `Supersedes` de l'entrée la plus
récente.<!-- src: docs/decisions/log.md, recensement des champs 2026-09-02 : 14 entrées sur 42 portent une valeur Supersedes non vide -->
La structure, c'est ce dont on remarque l'absence. La brièveté, c'est ce qu'on ne
remarque qu'en cumulé, c'est-à-dire jamais.

Le registre, c'est la mémoire profonde. Il y en a une autre au-dessus, moins profonde
et bien plus chère. `CLAUDE.md` et `AGENTS.md` se chargent dans *chaque* contexte
d'agent, ce qui en fait
> « les fichiers les plus précieux en tokens du dépôt [qui] ne doivent contenir que des
> règles durables et prescriptives — pas un tiroir fourre-tout
> d'observations. »<!-- src: docs/decisions/log.md 2026-05-26 "Promote learnings into CLAUDE.md only on hardening" #479 -->

D'où un tuyau à deux étages, décidé le jour même du registre. Une leçon est *captée à
bas coût*, dans la section « Lessons learned » du plan qui l'a produite — 13 des 88
fichiers de plan en ont une.<!-- src: docs/superpowers/plans/, grep "Lessons learned", 2026-09-02 -->
Elle n'est *promue* dans `CLAUDE.md` que si elle passe deux barres : **durable**
(« survit au prochain refactor ») et **prescriptive** (« dit à un futur agent quoi
faire ou éviter, pas une observation passive »). Et la promotion n'arrive pas à chaque
PR : c'est une passe de toilettage aux frontières de jalon, greffée sur l'audit du
monorepo qui existe déjà.<!-- src: docs/decisions/log.md 2026-05-26 #479 -->
Le lot promu tient en sept règles, sous un titre qui dit exactement ce qu'achète la
promotion : « en casser une est une régression, pas un choix de
style. »<!-- src: CLAUDE.md §"Standing cross-surface rules", 2026-09-02 -->

La moitié que tout le monde saute, c'est la rétrogradation — et c'est elle qui prouve
que le tuyau existe vraiment. Une règle de charge utile inter-surfaces écrite le 30
juillet s'est elle-même signalée comme candidate à la prochaine passe, et a depuis
atterri dans les règles
permanentes.<!-- src: docs/decisions/log.md 2026-07-30 #651 ; CLAUDE.md §Standing cross-surface rules -->
Une règle iOS a fait le trajet inverse : l'entrée du 24 août note que la ligne « pas de
garde `#available` » de `apps/ios/CLAUDE.md` « est désormais contredite par le code »
et doit être reformulée dans le sens qu'elle a toujours eu — pas de garde autour d'API
qui ont un équivalent iOS 17.<!-- src: docs/decisions/log.md 2026-08-24 #727 -->
Une règle périmée coûte plus cher que pas de règle du tout, parce qu'un agent, lui, va
lui obéir.

## La cérémonie est proportionnelle au rayon d'explosion

La pièce d'infrastructure suivante est une permission d'en faire moins. Le tri par
taille de tâche s'ouvre sur un diagnostic plutôt que sur une règle : « **les workflows
lourds sur les petites tâches sont la principale raison pour laquelle le travail
agentique paraît lent.** »<!-- src: CLAUDE.md §"Task-size triage (read first)" -->

Trois paliers. Sous ~150 lignes : on saute le brainstorming, le plan, la cérémonie TDD,
les sous-agents et la mise à jour de la carte. Sous ~500 : on esquisse l'approche en
deux ou trois phrases, pas de document de plan. Inter-app, migration de schéma ou
nouvelle surface : la boucle complète — « là, la cérémonie se
rentabilise. »<!-- src: README.md §4 Execution ; CLAUDE.md §Task-size triage -->
Cette section est autant une liste d'interdits qu'une liste de devoirs, et ce sont les
interdits qui portent.

Le décompte des artefacts montre où était vraiment le rayon d'explosion : 94 specs et
88 plans entre le 11 avril et le 24 août
2026.<!-- src: docs/superpowers/specs/ = 94 fichiers, docs/superpowers/plans/ = 88 fichiers, 2026-09-02 -->
Avril en a produit 41 de chaque ; juin, quatre ; septembre, aucun, et ses trois
décisions ont été livrées sans paire
spec/plan.<!-- src: recensement par préfixe de nom de fichier dans docs/superpowers/{specs,plans}/, 2026-09-02 : specs 41/24/4/21/4 et plans 41/23/4/17/3 d'avril à août -->
C'est la règle qui fonctionne, pas la règle qui flanche. Avril, c'était un monorepo,
une base de données et quatre surfaces à partir de rien ; juin, c'était de l'entretien.
Un volume de process qui resterait plat entre ces deux mois-là mesurerait le process,
pas le travail.

Un interdit mérite qu'on le regarde coûter quelque chose et être respecté quand même :
« ne jamais refactorer du code existant sans accord
explicite ».<!-- src: CLAUDE.md §"Before you start" -->
Le 24 août, un changement Android a dupliqué la plomberie du cycle de brouillon plutôt
que de refactorer un composeur déjà livré, avec ce raisonnement noté noir sur blanc :
« un bug introduit dans `CreatePebbleScreen` en portant le flux serait pire qu'une
seconde copie connue et
documentée. »<!-- src: docs/decisions/log.md 2026-08-24 #725 ; une entrée supplémentaire, 2026-08-23 #723, existe pour dire à un futur lecteur qu'aucune des deux copies n'est du code mort -->
Une duplication choisie exprès et écrite quelque part n'est pas le même objet qu'une
duplication qui est arrivée toute seule.

## La carte a cessé d'être un fichier

Pebbles tient un graphe de produit — écrans, endpoints, modèles de données, critères
d'acceptation, décisions, et les arêtes entre tout ça. Le 1er avril 2026, il comptait
67 nœuds et 108 arêtes, tous au statut
`idea`.<!-- src: pbbls commit bf72d36e, 2026-04-01, docs/arkaik/bundle.json -->
Une liste de vœux avec un schéma.

Aujourd'hui : 460 nœuds et 1 001 arêtes, dont 342 `live`, 60 en développement, 23
encore `idea`, 22 archivés, 13 en backlog. Deux espèces qui n'existaient pas en avril —
`acceptance` à 159 nœuds et `decision` à 40 — pèsent 43% du graphe, et la distribution
des statuts s'est inversée : de 100% de vœux à 74% de
livré.<!-- src: docs/arkaik/bundle.json, schema_version 3, project.updated_at 2026-08-24T23:05:00Z -->

Le changement mécanique compte plus que la croissance. Le 28 juillet, la carte a quitté
le disque. Un fichier de deux clés — un identifiant de projet et une origine, aucun
identifiant secret — pointe l'outillage des agents vers un graphe hébergé, si bien que
« le `docs/arkaik/bundle.json` local reste dans l'arbre mais n'est plus le plan que
lisent les agents ». Des liens de dépôt scopés par chemin « laissent une PR faire
bouger la bonne plateforme sans annotation », et le statut est promu par le cycle de
vie de la PR elle-même : « PR ouverte → development, mergée → live, fermée sans merge →
rien ».<!-- src: docs/decisions/log.md 2026-07-28 #622 -->
Le graphe est passé d'un fichier qu'un agent rafistole à la main à un service qu'un
agent mute, la promotion étant pilotée par les merges plutôt que par la mémoire de
quelqu'un.

Une omission délibérée est le choix le plus fin de l'entrée : l'app d'admin est laissée
non reliée, parce qu'« Arkaik ne modélise que `web | ios | android`, donc admin ne
pourrait être relié que comme `web` — et une PR purement admin marquerait alors l'app
web *destinée aux utilisateurs* comme livrée ». La laisser dehors « garde honnête le
signal “livré” », et l'entrée interdit d'ajouter le lien plus tard « comme rustine de
confort pour le lien “manquant” ».<!-- src: docs/decisions/log.md 2026-07-28 #622 -->

### Le journal, et le chiffre que tout le monde lit de travers

Le graphe garde une histoire à côté de son instantané : 926 événements, du 26 mars au
24 août 2026. La distribution des acteurs donne `bootstrap` 359, `claude-code` 323,
aucun acteur du tout 242 (dont 217 événements `deliverable.shipped` posés par le
webhook de merge), `arkaik-sync` 1, et `alexis`
1.<!-- src: docs/arkaik/journal.jsonl, 926 lignes, recensement des acteurs 2026-09-02 -->

Un. Un seul `request.filed`.

La mauvaise lecture, c'est que l'humain aurait arrêté de bosser. Le journal n'est pas
un relevé de qui a fait le travail ; il consigne ce que l'automatisation a capté, et
l'automatisation existe précisément pour que personne n'ait à y écrire à la main.
`bootstrap`, c'est le graphe reconstruit à rebours depuis les propres traces écrites du
dépôt.<!-- src: .arkaik/bootstrap/ (30 fichiers de fragments) et .arkaik/corpus/, système de fichiers 2026-09-02 -->
`claude-code`, c'est la carte entretenue comme effet de bord du travail de feature,
parce que la skill dit qu'elle s'applique « même si personne n'a explicitement demandé
de mettre la carte à jour ».<!-- src: .claude/skills/arkaik/SKILL.md -->
Les événements sans acteur, c'est un webhook qui remarque les merges. Et ma seule
entrée à moi est un `request.filed` : la seule opération que rien d'autre, dans ce
système, ne sait faire — vouloir quelque chose.

Un journal où le mainteneur apparaît trois cents fois est un journal tenu comme une
corvée. Celui-là ne l'y voit qu'une fois parce que le travail a migré en amont : dans
le fichier de skill, dans la règle d'écriture double, dans le lien hébergé, dans la
politique de références. Août, c'est 69 événements sur 70 par `claude-code` : à ce
stade, la reconstruction était finie et la carte était simplement à jour. L'instinct
qui rend ça sûr est écrit dans la skill elle-même : « si les outils MCP ne sont pas
disponibles, dis-le et arrête-toi plutôt que de retomber sur le fichier — un repli
silencieux, c'est la panne que personne ne
remarque. »<!-- src: .claude/skills/arkaik/SKILL.md -->

## Deux migrations, une fonction, et zéro conflit

Voici le bug que le workflow s'est créé tout seul.

Un jalon de fin juillet avait posé une règle permanente : chaque jalon suivant ajoute
ses nouvelles tables appartenant à l'utilisateur aux sections numérotées de la fonction
Postgres `purge_account`, et au harnais qui la vérifie. La fonction porte un marqueur
dans son corps pour que l'ajout atterrisse au bon
endroit.<!-- src: docs/decisions/log.md 2026-07-29 #631 -->
C'est une bonne règle. Deux agents lui ont obéi en même temps.

M48 (les succès) et M49 (les connexions mutuelles) ont atterri sur `main` à quelques
heures d'écart. Chacune a ré-émis `purge_account` avec son propre ajout au marqueur,
exactement comme prescrit. Aucune branche n'a vu la copie de l'autre, et les deux
étaient un `create or replace` du corps entier. Par ordre d'horodatage, une copie
s'applique après l'autre : la définition finale de l'historique fusionné portait la
table des succès et avait silencieusement perdu `connections`, `connection_invites` et
`connection_blocks`.<!-- src: docs/decisions/log.md 2026-07-31 #687 -->

Les deux branches étaient vertes ; chacune rejouait proprement toute seule. La
collision n'existe que dans l'ordre fusionné :
> « `create or replace function` n'a aucune sémantique de fusion — le dernier écrivain
> gagne le corps entier, et **git ne signale aucun conflit puisque les deux migrations
> sont des fichiers différents**. L'ordre d'horodatage rend le perdant arbitraire …
> donc **la revue de l'une ou l'autre PR isolément ne peut pas
> l'attraper**. »<!-- src: docs/decisions/log.md 2026-07-31 #687 -->

Attrapé au moment de l'application, avant qu'aucune des deux migrations n'atteigne le
projet lié ; le correctif a été une troisième migration ré-émettant le corps avec les
deux ajouts.<!-- src: docs/decisions/log.md 2026-07-31 #687 ; packages/supabase/supabase/migrations/20260731090000_purge_account_union.sql -->

Rien dans ce bug ne réclame un agent. Il réclame du *parallélisme*, ce qui est
précisément la raison d'être de tout le dispositif : deux branches en vol, chacune
correcte, chacune suivant la règle permanente, aucune ne pouvant voir l'autre. Une
personne seule sur une branche à la fois ne le produit jamais. La règle a donc survécu,
avec ses limites énoncées : la convention de marqueur « n'est **pas** sûre à la
collision toute seule », la fusion de deux branches pareilles est « une **union
manuelle** », et la règle s'étend désormais au harnais, parce que « c'est ce harnais
qui fait passer la collision du silence au
bruit ».<!-- src: docs/decisions/log.md 2026-07-31 #687 -->

Elle a durci dans `CLAUDE.md` en deux des sept règles permanentes — soit le tuyau de
promotion en train de tourner.<!-- src: CLAUDE.md §"Standing cross-surface rules" -->
Puis la classe a récidivé hors SQL : le 24 août, deux branches ont ré-émis les trois
mêmes nœuds Arkaik et sont entrées en collision de la même
manière.<!-- src: docs/decisions/log.md 2026-08-24 #725 -->
La leçon avait généralisé, des fonctions Postgres à toute ré-émission d'artefact
entier. Le genre de chose qu'on n'apprend qu'en la vivant deux fois.

Il reste une phrase dans l'entrée de juillet, et c'est le pont vers tout ce qui a suivi :
le harnais de vérification affirmait déjà les tables des deux jalons, donc il aurait
échoué sur le schéma fusionné. Rien ne l'a lancé entre les deux
merges.<!-- src: docs/decisions/log.md 2026-07-31 #687 -->

## Une preuve plutôt qu'une simulation

La base de données est le contrat entre quatre clients, et cinq scripts Deno sont la
preuve de tout ce qui traverse une frontière de surface :
> « Ce sont des **tests d'acceptation, pas des simulations** : chacun inscrit des
> utilisateurs jetables **contre le projet de production lié**, exerce les vraies
> policies RLS, les vrais triggers, les vraies RPC et la vraie fonction edge
> `delete-account`, puis supprime ce qu'il a créé dans un
> `finally`. »<!-- src: packages/supabase/CLAUDE.md §"Contract harnesses (scripts/verify-*.ts)" ; le finally s'exécute même en cas d'échec -->

[Pour qui n'a pas le vocabulaire : une « policy RLS », c'est la règle qui décide,
ligne par ligne dans la base, qui a le droit de voir quoi. Et le harnais ne fait pas
semblant — il crée un vrai compte, essaie pour de vrai, puis nettoie derrière lui.]

Jusqu'au 2 septembre 2026, ces scripts n'étaient branchés sur rien. Une PR qui ne
touchait que des migrations ou des fonctions edge « obtenait deux builds Vercel
prouvant que les apps web et admin compilent toujours, ce qu'elles feraient avec ou
sans le moindre changement de schéma », pendant que les harnais « ne tournaient que
quand un humain y pensait ».<!-- src: docs/decisions/log.md 2026-09-02 #741 -->
Pebbles a mené un audit délibéré de sécurité et de qualité sur la couche de données et
le contrat client ; un des garde-fous issus de ce programme a été, un temps, protégé
par rien d'autre qu'un script qu'il fallait penser à lancer. Un test qui ne tourne que
quand un humain s'en souvient n'est pas une barrière. C'est une bonne intention.

Donc quatre des cinq sont devenus une barrière de merge, filtrée par chemin, plus un
run nocturne et un déclenchement manuel — parce que « le nocturne seul détecte un
garde-fou tombé *après* le merge … le déclencheur de PR filtré par chemin le bloque, et
le nocturne rattrape encore le cas que personne n'avait fait matcher ». Le coût est
énoncé plutôt qu'absorbé : « chaque PR mergée touchant ce chemin effectue désormais une
poignée d'inscriptions et de suppressions en production ; c'est le prix des harnais
étant une preuve plutôt qu'une simulation. »<!-- src: docs/decisions/log.md 2026-09-02 #741 -->

Le cinquième harnais reste manuel, et la raison, c'est le dépôt lui-même. C'est celui
qui a besoin d'une clé de rôle de service ; cette clé n'est pas ajoutée à un dépôt
public ; et « une PR issue du dépôt reste du code qui s'exécute avant relecture », donc
le contrat « garde la barrière humaine qu'il a déjà plutôt que de l'échanger contre une
nouvelle classe d'exposition ». La conséquence est écrite sans adoucissant : ce contrat
« reste le seul contrat sans barrière automatique », et la règle permanente de lancer le
harnais à la main « est désormais la *seule* chose qui le protège, et elle est d'autant
moins indulgente ».<!-- src: docs/decisions/log.md 2026-09-02 #741 ; packages/supabase/CLAUDE.md -->

Puis la barrière a eu besoin d'une barrière. Le même jour, une seconde entrée a
supersédé l'hypothèse de la première, selon laquelle une notification suffisait. Le
dépôt n'a aucun câblage d'échec — pas une seule étape `failure()`, pas de webhook —
donc
> « le nocturne, la seule barrière qui attrape une régression sur une PR n'ayant jamais
> touché `packages/supabase/`, **était aussi la seule barrière dont l'échec n'obligeait
> personne à passer devant.** »<!-- src: docs/decisions/log.md 2026-09-02 #743 -->

Désormais chaque run écrit un tableau de résultats par harnais dans le résumé du job.
Un échec planifié ouvre une unique issue de suivi réutilisée ; un échec sur PR n'ouvre
rien, puisque la coche rouge est déjà sous le nez de la personne concernée. Et l'issue
est fermée à la main. La fermeture automatique au premier run vert a été rejetée, dans
la meilleure phrase du registre : « un échec intermittent fermerait discrètement son
propre rapport, et c'est exactement le mode de défaillance que toute cette barrière
existe pour empêcher. »<!-- src: docs/decisions/log.md 2026-09-02 #743 -->

Un détail de cette plomberie résume toute l'éthique. Le shell par défaut de GitHub n'a
pas `pipefail`, donc rediriger un harnais en échec dans `tee` sort avec le code 0 et
annonce une réussite ; le script enveloppe lit le statut du harnais lui-même à la
place.<!-- src: .github/scripts/verify-harness.sh, lit PIPESTATUS[0] -->
Une couche de rapport qui rapporte une réussite est pire que pas de couche du tout.

## Où ça en est, le 2 septembre 2026

Quarante-deux décisions consignées. Quatre-vingt-quatorze specs, quatre-vingt-huit
plans. Un graphe de produit de 460 nœuds tenu à jour par un agent comme effet de bord
des livraisons. Cinq harnais de contrat, dont quatre en barrière de merge et un
délibérément pas. Sept règles permanentes, dont deux n'existent que parce que deux
branches ont un jour ré-émis la même fonction Postgres.

Quatre surfaces : web et admin déploient sur Vercel, Android fabrique un bundle signé
vers Google Play internal testing, iOS se construit sur Xcode Cloud. **Aucune surface
n'a de sortie publique.** La feuille de route store tient la v1.0 pour encore à venir,
avec dix points produit qui la conditionnent tous : « rien ici n'est
post-lancement ».<!-- src: _digests/surfaces-current.md §8, d'après README.md §Deployment, android-release.yml, apps/ios/ci_scripts/ci_post_clone.sh, et la feuille de route store du 2026-07-28 -->

La documentation pour agents se périme exactement comme la documentation pour humains,
et au même rythme. `CLAUDE.md` et la skill Lab Note référencent toujours un fichier de
workflow supprimé quand la publication des notes est passée par un webhook ; le
commentaire d'en-tête du workflow des harnais dit toujours que le run planifié n'ouvre
aucune issue, et le corps du job juste en dessous en ouvre
une.<!-- src: .github/workflows/lab-note.yml absent, supprimé dans le commit 8d22e405 (#705) ; .github/workflows/supabase.yml, commentaire d'en-tête vs corps du job, 2026-09-02 -->
Deux correctifs de trois lignes qui attendent la prochaine passe de toilettage ; qu'ils
soient encore là est la mesure honnête de la santé du tuyau.

La question ouverte, c'est justement le second sens de ce tuyau. Une règle iOS est
contredite par son propre code et en attente de reformulation. La promotion a tourné,
démontrablement ; la rétrogradation a tourné une fois. Une mémoire qui ne fait
qu'accumuler finira par égarer ce qui la lit — donc le chiffre à surveiller dans six
mois n'est pas combien de règles tiennent debout. C'est combien on en a descendues.

Ce qu'il reste à l'humain, c'est ce qu'un agent ne peut structurellement pas faire :
tenir une préférence sur plusieurs mois, prendre un vrai téléphone dans la main et voir
que les traits sont toujours
droits,<!-- src: docs/decisions/log.md 2026-07-14 #555, observation sur appareil ayant renversé l'expérience du wobble -->
et décider qu'une règle qui avait raison en mai a tort en août. Ce travail-là n'a pas
rétréci. Il est monté d'un cran, ce qui est le seul endroit où il pouvait aller.
