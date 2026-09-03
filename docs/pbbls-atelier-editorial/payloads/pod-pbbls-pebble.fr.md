---
name: Galets & glyphes
description: L'objet que devient un moment gardé — neuf formes qui disent comment ça t'a touché, et un symbole dessiné au doigt qui dit quoi.
pod: pbbls-pebble
---

Un moment qu'on veut garder a une taille et une lumière. Il n'a presque jamais
de note sur dix.

Ce territoire, c'est l'objet que devient un moment enregistré, et les deux
choses que cet objet doit porter : l'ampleur que ça a eue, et la façon dont
c'est tombé. Demander ça dans un formulaire, ça revient à demander à quelqu'un
de noter sa propre tristesse. C'est pénible et c'est abstrait. La note de
travail du 29 mars 2026 pose l'intention à l'envers : le module de façonnage est
« an instinctive and metaphorical way to appropriate the Barrett's scheme
without having to understand it intellectually » — une façon instinctive et
métaphorique de s'approprier le schéma de Barrett sans avoir à le comprendre
intellectuellement.<!-- src: _digests/apple-journal.md, 29 mars 2026 — Valence explorations -->
Personne n'a besoin de savoir qu'il existe un modèle des émotions à deux axes.
Il faut juste regarder neuf pierres et en désigner une.

Un galet stocke donc deux valeurs. `intensity` vaut 1, 2 ou 3. `positiveness`
vaut −1, 0 ou +1 — lowlight, neutral, highlight. Trois fois trois font neuf, et
neuf, c'est le nombre de formes : un dessin par case, inchangé en nombre comme
en axes depuis le jour où elles ont été faites.<!-- src: engine/resolve.ts ; journal de décisions 2026-08-24 #729 -->
[TO VERIFY : les journaux de bord d'avril 2026 disent les neuf formes dessinées
à la main, sans IA ; le dépôt pbbls, lui, ne garde aucune trace de leur
provenance.]

La forme dit comment c'est tombé. Le glyphe dit quoi — un symbole dessiné au
doigt, qui vient ensuite se loger dans la pierre. Les deux sont volontairement
sans rapport : la colonne qui les reliait a été supprimée en juillet 2026, avec
une note qui ferme la porte. La remettre est hors de question, parce qu'un
glyphe est un carré, et qu'un carré entre dans les neuf.

La couleur, c'est la partie qui étonne. Le dessin composé n'en a aucune. Chaque
remplissage est `none`, chaque trait est `currentColor`, et le fichier qui le
produit dit pourquoi en commentaire : c'est le client qui applique la couleur de
l'émotion au moment d'afficher.<!-- src: packages/supabase/supabase/functions/_shared/engine/compose.ts -->
La couleur appartient à la *catégorie* d'émotion, pas à l'émotion — sept
catégories, chacune avec sa petite palette — et elle est choisie par surface et
par thème, au dernier moment possible. Un seul dessin, beaucoup de pierres.

Depuis le 24 août 2026, chaque pierre respire aussi. Le tremblement pétroglyphe
donne à chaque trait un bord irrégulier et fuyant, au lieu d'un tracé vectoriel
bien propre, et il est fabriqué sur l'appareil au moment de dessiner, jamais
cuit dans ce qui est stocké. La décision porte ses raisons : les glyphes sont
dessinés par les gens et s'échangent au marché, donc impossible de les précuire
à la compilation ; précuire à l'écriture ferait itérer lentement, grossir le
dessin stocké plusieurs fois, et raterait quand même toutes les surfaces qui
montrent un glyphe sans pierre.<!-- src: journal de décisions 2026-07-13 #555 -->
Dessous, il y a la langue visuelle posée le 27 mars 2026 : « everything is flat
and animation-ready, but nothing is geometrically perfect. The irregularity is
structural, not cosmetic. »<!-- src: _digests/apple-journal.md, 27 mars 2026 — Design themes with Claude -->
Les pierres ont passé des mois à ne pas obéir à cette phrase. Maintenant si.

Dans ce territoire : comment un souvenir est devenu une forme — les deux axes,
les neuf canevas, et le sélecteur qui a passé un été à ne ressembler en rien à
ce qu'il servait à choisir. Le tremblement, et l'argument en quatre temps qui
le fait naître à l'exécution. La gravure d'un glyphe : le canevas plein écran,
le doigt, les traits. Le rendu, plus étrange qu'il n'y paraît : un moteur de
composition tourne sur le serveur à l'écriture, trois moteurs d'affichage
écrits à la main dessinent le résultat sur web, iOS et Android, et leur accord
tient non pas à du code partagé mais à un fichier de référence que le web va
lire directement dans le dossier de tests iOS. Et la couleur — les catégories,
les six variantes de palette, et pourquoi une page de lecture se teinte en
entier.

Où ça en est, au 2 septembre 2026 : le tremblement est livré sans condition sur
iOS et sur le web, et sur Android seulement dans les builds internes, parce que
le drapeau Android protège un repli que les deux autres n'ont pas. Cet écart à
trois est délibéré, et il est écrit noir sur blanc qu'il ne faut pas le ranger.
