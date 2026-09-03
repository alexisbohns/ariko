---
name: Âmes & domaines
description: Les gens présents dans les galets de quelqu'un et les pans de vie auxquels un moment appartient — l'un délibérément pas un compte, l'autre une taxonomie qui a changé d'avis en quatre jours.
pod: pbbls-souls
---

Un moment n'est presque jamais seulement le tien, et il se range toujours
quelque part dans une vie. Deux des questions que l'app pose, c'est qui était là
et de quel pan de vie il s'agissait. Ce territoire, ce sont ces deux réponses —
et dans les deux cas, l'intéressant, c'est ce que la réponse n'a pas le droit de
devenir.

Une âme, c'est une personne, un animal ou une entité liée à un galet : « not a
user — a private contact in your world ». Pas un utilisateur : un contact privé,
dans ton monde à toi.<!-- src: README.md §Concepts -->
C'est un refus, et la base le tient. Une âme, c'est un nom qui t'appartient, plus
— depuis le 26 avril 2026 — un glyphe, pour qu'elle ait un visage dans une
grille.<!-- src: migrations/20260426000000_add_glyph_to_souls.sql (#298) -->
Pas d'adresse mail sur une âme, pas de numéro, pas de compte, pas d'invitation,
pas de notification. Nommer ta sœur dans un souvenir n'atteint pas ta sœur, et la
politique de confidentialité le dit mot pour mot : Pebbles ne contacte jamais ces
personnes et ne partage jamais leurs données avec
elles.<!-- src: apps/web/docs/privacy/fr.md §2.5 -->

Le même document transforme le refus en conseil. Ce que tu écris dans le corps
d'un souvenir part vers le modèle quand une fonction d'IA le lit ; les noms
d'âmes, eux, sont retirés avant. Donc la politique recommande de mettre les gens
dans les âmes plutôt que dans les
phrases.<!-- src: apps/web/docs/privacy/fr.md §12 -->

Personne d'autre n'en voit jamais une non plus. Quand un galet est montré à une
connexion, le lecteur reçoit la ligne principale et le dessin composé ; tout
l'enrichissement autour — cards, âmes, photos — reste réservé au propriétaire,
délibérément.<!-- src: docs/decisions/log.md 2026-08-17 #708 -->

Le mot n'est même pas toujours celui qu'on te sert. Un audit de vocabulaire en
mai 2026 a proposé de remplacer « personnes » par « âmes » dans l'introduction
de l'app. Refusé : ça reviendrait à « pousser du jargon interne dans la copie
destinée aux
gens ».<!-- src: docs/superpowers/specs/2026-05-27-issue-487-naming-harmonization-design.md ; VO : "would push internal jargon into end-user copy" -->

L'autre réponse, le pan de vie, a une histoire que le produit ne raconte pas. Le
11 avril 2026, il y a cinq domaines, nommés en grec, un par étage de la pyramide
de Maslow : Zoē pour la santé et le corps, Asphaleia pour la sécurité et le
confort, Philía pour les relations, Timē pour la reconnaissance et la communauté,
Eudaimonia pour
l'accomplissement.<!-- src: migrations/20260411000000_reference_tables.sql -->

Quatre jours plus tard, ils ont disparu. Dix-huit domaines concrets ont été
saisis à la main dans la base de production, et la migration qui suit n'existe
que pour remettre une copie locale d'aplomb ; elle traite les grecs de « 5
outdated Greek-slug domains … which coexist untouched » — cinq domaines périmés,
qui cohabitent sans qu'on y
touche.<!-- src: migrations/20260415000001_remote_pebble_engine.sql -->
Ils cohabitent toujours. Personne n'a écrit pourquoi le grec, ni pourquoi on l'a
lâché.

[INTENTION? — je n'ai pas trouvé de source pour le pourquoi des noms grecs.
Proposition : nommer en grec les étages d'une pyramide des besoins empêche une
théorie empruntée de se lire comme une théorie empruntée — ce qui cesse de
fonctionner dès qu'il faut y ranger un mardi. À accepter, réécrire ou couper à la
relecture.]

Maslow n'est pas parti pour autant. Les cinq descriptions grecques ont été
redistribuées sur cinq des dix-huit : Santé garde « Health & body », Finances
prend « Security & comfort », Amis « Relationships », Travail « Recognition &
community », Passions « Self-actualization ». Et les statistiques trient encore
les graphiques de domaines dans l'ordre des slugs grecs d'origine, parce que la
table n'a jamais eu de colonne pour le
niveau.<!-- src: migrations/20260501000003_analytics_meaning_share.sql -->

Dans ce territoire : pourquoi on les appelle des âmes, et ce que le mot coûte et
rapporte. Maslow en grec — le nom, les quatre jours qu'il a tenu, et les débris.
Et les émotions : trente-huit, groupées en sept catégories, où la couleur dans
laquelle la pierre est dessinée appartient à la catégorie et non au ressenti, et
où le sélecteur reclasse les sept selon la forme que tu viens de choisir — ta
polarité d'abord, son contraire en dernier.

[TO VERIFY : le bean émotions est cadré comme « emotions and the HealthKit
alignment », mais aucune autorisation, aucun import et aucun type HealthKit
n'existe dans l'app. L'alignement n'est affirmé que dans le corpus d'avril 2026
et dans les mentions légales. Barrett, de même, est créditée sur la page des
influences et n'apparaît nulle part dans le dossier de conception.]

Où ça en est, au 2 septembre 2026 : les âmes, leurs glyphes et les dix-huit
domaines tournent sur les trois clients. Le *soul seaming* — un lien privé et à
sens unique entre une âme et un vrai compte, dont l'autre personne ne serait
jamais avertie et qu'elle ne pourrait jamais voir — est spécifié et pas
construit.
