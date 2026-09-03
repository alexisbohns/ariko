---
name: Enregistrer un galet
description: Le geste de capture — comment Pebbles te demande un moment, et pourquoi deux façons de le demander cohabitent derrière le même bouton.
pod: pbbls-record
---

Il se passe quelque chose. Un café avec un ami, un concert qui t'a donné des
frissons, une conversation qui a mal tourné. Tu as peut-être vingt secondes de
bonne volonté avant que ça cesse de te sembler digne d'être noté. Ce territoire,
c'est tout ce qui se passe pendant ces vingt secondes.

L'introduction de l'app dit à quoi ça sert, et le dit depuis avril 2026 :
capture-le en quelques secondes — sans page blanche, sans pression, sans
audience.<!-- src: apps/web/lib/i18n/messages/fr.json onboarding.steps.pebble.body -->
La promesse est plus dure à tenir qu'elle n'en a l'air, parce qu'un galet n'est
pas un champ. Il a une heure, un nom, une forme, une émotion, un pan de vie, les
gens qui étaient là, une collection, un symbole et un réglage de visibilité.
Demande tout ça d'un coup et tu as construit un mur. Demande-le un écran à la
fois et tu as construit un couloir. Pebbles a livré les deux, puis a relivré les
deux.

La première version, c'était le couloir : un formulaire en quinze étapes bâti
fin 2025, descendant des colonnes de Beck, qui marchait de bout en bout et qu'on
remplissait en serrant les dents. Le 29 mars 2026, les étapes sont refaites en
écrans mono-objectif — une question par écran, « no longer a form but a real
flow ».<!-- src: _digests/apple-journal.md, 29 mars 2026 — Single purpose record flow -->
Dix jours plus tard, tout est replié dans un éditeur compact posé au bord du
Path, qui devient l'unique façon d'enregistrer quoi que ce soit. Les cards sont
la victime de ce mouvement.

Puis c'est revenu. Les 23 et 24 août 2026, sur iOS, sur le web et sur Android en
deux jours, un composeur pas-à-pas redevient le mode par défaut. L'argument est
écrit, et ce n'est pas de la nostalgie. Le formulaire demande de tenir dix
décisions en tête en même temps. Et un ordre achète trois choses qu'un
formulaire ne peut structurellement pas : la photo passe en premier pour que ses
métadonnées disent quand c'était, la forme passe avant l'émotion pour que les
catégories soient reclassées autour d'elle, et la visibilité passe en dernier
pour que le choix se fasse face à un vrai bouton de publication plutôt que dans
une barre d'outils à huit champs de
là.<!-- src: docs/superpowers/specs/2026-08-23-ios-record-flow-design.md D2 ; VO : "asks the user to hold ten decisions in their head simultaneously" -->

L'ancien formulaire n'est pas mort. Il a glissé derrière un appui long sur le
même bouton. Le raisonnement est posé noir sur blanc : c'est une expérience sur
le modèle d'interaction, et la façon honnête de l'évaluer, c'est de pouvoir
revenir en arrière sur l'appareil sans reconstruire l'app ; l'appui long a été
choisi contre un réglage parce qu'il n'ajoute ni habillage, ni état stocké, ni
chaîne à traduire, et parce qu'« il se supprime en une ligne quand l'expérience
sera
tranchée ».<!-- src: docs/decisions/log.md 2026-08-23 #723 ; VO : "it deletes in one line when the experiment resolves" -->
L'entrée finit par un mot à qui lira le code plus tard : on trouvera deux
composeurs et on croira que l'un est mort ; il ne l'est pas, et trancher
l'expérience voudra dire en supprimer un, pas les fusionner.

Pour tous ses écrans, le flux exige très peu. Il ne bloque que sur trois
réponses : un nom, un ressenti, un pan de vie. Le reste se saute ou arrive déjà
répondu.

Dans ce territoire : le flux lui-même, de quinze étapes à quelques secondes puis
à onze étapes — une position prise, abandonnée, puis reprise sans le dire,
puisque aucune entrée de décision ne reconnaît ce retour et que seule la carte du
produit le mentionne, de
biais.<!-- src: docs/arkaik/bundle.json, V-record-success -->
Les cards, quatre questions — qu'est-ce que j'ai ressenti, qu'est-ce que j'ai
pensé, qu'est-ce que j'ai fait, et une dernière qui dit juste écris ce que tu
veux — notées en mars 2026 comme héritées des colonnes de Beck. Elles sont
toujours dans la base, elles valent toujours du karma, et aucun client n'en a lu
ni écrit une seule depuis avril. Et les brouillons, qui existent parce que
jusqu'en juillet 2026 enregistrer était tout ou rien : chaque composeur bloquait
son bouton d'enregistrement sur un nom et un ressenti, donc une pensée à moitié
formulée ne pouvait pas être
gardée.<!-- src: docs/superpowers/specs/2026-07-29-drafts-and-autosave-design.md ; log 2026-07-29 #639 -->
Aujourd'hui seule la publication reste bloquée, et la proposition de garder un
galet inachevé apparaît au moment où tu essaies de partir — c'est-à-dire
exactement quand on en a besoin.

Où ça en est, au 2 septembre 2026 : le flux est livré sur les trois surfaces, et
le formulaire est à un appui long sur chacune. L'un est l'expérience, l'autre est
le repli, et rien dans le journal ne dit que l'expérience a été tranchée.
