# SpaceXR et le voyage du Babylon

## Intention

SpaceXR donne accès au voyage du Babylon, le vaisseau spatial du livre destiné à parcourir l'Univers. Le vaisseau fournit un point d'attache à l'exploration : on part quelque part, on traverse une distance, on rencontre un monde et on décide de ce que l'on veut y découvrir.

La promesse proposée est : **embarquer à bord du Babylon, explorer les mondes qu'il rencontre et poursuivre son propre voyage.**

Cette direction reprend la réflexion sur les dix expériences de SpaceXR. Voyager, découvrir et vivre un lieu deviennent les trois intentions qui organisent le produit. Le voyage continu Terre-Lune constitue sa première réalisation, au sein d'un moteur et d'un monde communs.

Le rôle du Babylon comme vaisseau explorateur est confirmé par l'auteur. Son itinéraire, ses personnages, ses missions et les événements du livre restent à renseigner. Les séquences ci-dessous sont des propositions de conception, pas des éléments ajoutés au récit.

Le produit se développe dans deux dépôts : `spacexr-explorer` pour le monde et la navigation, `spacexr-mission-control` pour les missions assistées par IA. Leur [workspace commun et leurs interfaces](explorer-mission-control-architecture.md) permettent de suivre le Babylon et d'explorer avec un agent dans le même environnement.

Mission Control réutilise la base logique exécutable de `co2-scrubber-governed-agent` : graphe, harnesses, services, connaissance, autorités et traces. Explorer en est un slot supplémentaire. Le voyage du Babylon et les missions partagent ainsi le système existant, plutôt qu'un nouveau chatbot placé au-dessus du visualiseur.

## Le Babylon comme point d'attache

Le Babylon accompagne le passage entre des lieux. L'utilisateur peut suivre sa route, interrompre une étape pour explorer, puis retrouver le vaisseau et reprendre le voyage.

La première version peut rendre cette présence par le nom du vaisseau, une position, un cap et la commande « Rejoindre le Babylon ». Une passerelle visitable, des intérieurs et un équipage animé ne sont pas nécessaires au premier parcours. Un modèle extérieur pourra ensuite rendre le vaisseau visible depuis les surfaces et donner une référence de taille.

L'identité du vaisseau vient du livre. L'analogie avec l'USS Enterprise décrit son rôle de vaisseau explorateur ; elle ne définit ni son apparence ni les règles de son univers.

## Un voyage qui laisse de la place à l'exploration

Le parcours suit une boucle simple :

1. **Une invitation.** Une destination, une question ou une étape du récit donne envie de partir.
2. **Une traversée.** L'utilisateur voit son point de départ s'éloigner et sa destination grandir. Il peut accélérer le voyage ou regarder autour de lui.
3. **Une rencontre.** Un paysage, une lumière ou une différence d'échelle révèle quelque chose du monde visité.
4. **Une exploration.** L'utilisateur se pose, change de point de vue, observe le ciel ou compare des dimensions.
5. **Une trace.** Il conserve un lieu et une date dans son carnet, partage sa vue et choisit de reprendre le voyage.

Une étape du livre peut fournir l'invitation et le contexte. Le lieu reste explorable après la fin de cette étape.

## Deux manières de parcourir le même monde

### Suivre le voyage du Babylon

L'utilisateur suit des étapes préparées, avec un texte court et des points de vue choisis. Il peut suspendre le récit, quitter le point de vue proposé et revenir au fil de l'étape. La commande « Reprendre le voyage » lui rend une direction sans effacer ses découvertes.

Les passages du livre ne seront intégrés qu'après sélection par l'auteur. La première version utilise des étapes descriptives indépendantes du canon pour éprouver le parcours.

### Explorer librement

L'utilisateur choisit un monde visible ou une destination, voyage et se pose dans les zones couvertes. Il peut retrouver le Babylon, revenir au lieu précédent et rouvrir ses découvertes.

Les deux parcours partagent le même monde, les mêmes terrains et les mêmes outils. Passer de l'un à l'autre ne recharge pas une autre application.

## Première expérience proposée

Le système Terre-Lune sert de premier territoire à explorer. Son rôle dans le livre reste à confirmer ; ce choix permet de développer le produit à partir des briques disponibles.

| Étape | Ce que fait l'utilisateur | Ce qu'il découvre | Capacité requise |
| --- | --- | --- | --- |
| Départ | Observe un lieu terrestre, puis prend de la hauteur | Le passage du relief au globe et la finesse de l'atmosphère | Terrain terrestre, caméra continue, atmosphère progressive |
| Traversée | Rejoint la Lune, avec vitesse de voyage réglable | La distance parcourue et l'évolution des tailles apparentes | Corps aux positions datées, navigation, Soleil cohérent |
| Approche | Choisit un site lunaire proposé | Un relief réel, son horizon et ses dimensions | Terrain lunaire cubique et chargement progressif |
| Exploration | Se pose, regarde le ciel et déplace son point de vue | Le lieu à une échelle humaine | Picking, distance au relief, caméra de surface |
| Observation | Change la date ou l'heure | L'évolution de l'éclairage, dans les limites du modèle validé | Orientation des corps et éclairage datés |
| Souvenir | Enregistre et partage la vue | La possibilité de retrouver exactement son observation | État de scène sérialisé, carnet et lien partageable |
| Reprise | Rejoint le Babylon | La continuité du voyage après l'exploration | Position du vaisseau et reprise d'étape |

Le changement de date commence par la direction du Soleil et l'alternance jour/nuit. Montrer les ombres portées du relief exige un travail supplémentaire sur l'occultation et les ombres. Le premier rendu ne doit pas être présenté comme un outil d'analyse de l'illumination de Shackleton.

## Commandes visibles

L'interface privilégie quelques intentions compréhensibles :

- « Explorer » : rejoindre un lieu ou un corps visible.
- « Se poser ici » : descendre au-dessus du relief disponible, avec aperçu de la destination.
- « Regarder le ciel » : orienter le regard depuis la position au sol.
- « Changer la date » : observer le lieu à un autre instant.
- « Comparer » : faire apparaître une référence de taille.
- « Garder cette vue » : ajouter un souvenir au carnet.
- « Partager » : produire un lien vers cette observation.
- « Rejoindre le Babylon » ou « Reprendre le voyage » : retrouver le fil du parcours.

Le double-clic peut proposer l'atterrissage, le glissement orienter le regard et la molette gérer l'approche. Le comportement doit rester prévisible au passage entre surface, orbite et espace. Les commandes tactiles et clavier donnent accès aux mêmes actions.

Le voyage garde des distances et tailles physiques cohérentes, avec une vitesse de déplacement adaptée. Une comparaison qui rapproche artificiellement des objets porte une indication visible et se ferme pour revenir au monde à son échelle réelle.

## La date du monde et la progression du récit

La date astronomique, le temps de déplacement de l'utilisateur et la progression dans le livre sont trois états distincts.

Une étape peut définir sa date et son lieu. L'utilisateur peut suspendre cette étape pour faire varier le temps, puis revenir à son état initial. Une exploration de date n'écrit pas une nouvelle version des événements du livre.

La position du Babylon dépendra du modèle de voyage choisi pour le récit. Dans le démonstrateur, elle peut suivre un itinéraire de navigation préparé, explicitement distinct d'une trajectoire orbitale calculée. Les propriétés physiques ou fictives de sa propulsion restent à définir par l'auteur.

## Le carnet et le partage dès le début

Chaque souvenir conserve le corps, la position de la caméra, son orientation, la date, le champ de vision et les réglages nécessaires. Les positions de surface sont rattachées au corps, pour que la vue reste retrouvable quand celui-ci se déplace dans le système solaire.

Le format porte une version et les références des données. Le lien restitue une observation équivalente, sous réserve de disponibilité des mêmes données ; une capture seule ne suffit pas. Une étape du voyage peut être associée au souvenir sans rendre le livre nécessaire pour l'ouvrir.

Pour le premier prototype local, le carnet peut être conservé dans le navigateur et la vue encodée dans l'URL. Le partage avec une autre personne nécessite ensuite que l'application et ses données lui soient accessibles. Aucun compte utilisateur n'est requis pour éprouver cette fonction.

## Découvertes et comparaisons

« Surprends-moi » choisit parmi des lieux préparés, avec un point de vue intéressant, une courte invitation à observer et des données disponibles. L'utilisateur peut continuer librement depuis cette destination.

La comparaison des échelles commence avec des références simples : une silhouette, un bâtiment ou une distance connue, à condition de disposer d'une échelle vérifiée. Les comparaisons de reliefs terrestres et extraterrestres peuvent suivre. Les objets comparatifs sont séparés du terrain réel et identifiés comme tels.

## Priorités de réalisation

Les scores d'effort de la réflexion initiale sont des indications produit. L'atterrissage libre et le voyage continu dépendent de la précision et du terrain ; ils ne peuvent pas être estimés comme de simples commandes d'interface.

| Livraison | Expérience obtenue | Critère de sortie |
| --- | --- | --- |
| A. Retrouver un lieu | Observer une vue terrestre ou lunaire, la garder et la rouvrir | Position, regard et date sont restitués par une URL versionnée |
| B. Voyager avec le Babylon | Quitter la Terre, rejoindre la Lune, explorer un site et revenir au vaisseau | Une scène continue, commandes compréhensibles, reprise du parcours après une interruption |
| C. Comprendre ce que l'on voit | Comparer les tailles, regarder le ciel, changer la date et découvrir des lieux proposés | Quelques expériences choisies sont lisibles et vérifiées ; limites des données annoncées au bon endroit |
| D. Donner corps au voyage | Atmosphère affinée, Soleil avec couronne, première séquence issue du livre | Une étape complète allie contexte narratif, qualité visuelle et exploration libre |
| E. Étendre les destinations | Ajouter Mars puis d'autres corps selon données et récit | Une destination réutilise les outils existants et dispose d'une expérience intéressante |

Le Soleil analytique et l'éclairage daté arrivent dès B. Leur finition visuelle appartient à D. Les ombres de relief nécessaires à une découverte donnée font partie du travail de C, avec une validation dédiée.

Les reconstitutions de missions, la construction complète d'installations, la réalité mixte et l'exploration collaborative prolongent ce socle. Le placement comparatif d'un habitat peut être introduit plus tôt dans la mission Shackleton. Explorer reste utilisable manuellement ; Mission Control expose progressivement « Emmène-moi », « Explique ce que je vois » et « Explore pour moi » via le broker et le harness.

La [mission Shackleton](lunar-site-explorer-mission.md) ajoute une boucle : question, reconnaissance, comparaison, évolution temporelle, implantation et décision. « Montre-moi pourquoi » relie chaque conclusion à une visite et à ses résultats sourcés. Une mission garde les candidats, critères, vues et décisions pour être reprise ou partagée.

## Implications pour les briques existantes

| Promesse utilisateur | Socle disponible | Travail à réaliser |
| --- | --- | --- |
| Retrouver le même monde à une date | Éphémérides et rotations approchées dans celestial-core | Orientation complète, modèle lunaire périodique et références de validation |
| Passer d'un monde à un autre | Runtime de tuiles et terrains Terre/Lune séparés | Monde commun, caméra, profondeur et budgets partagés |
| Se poser dans un paysage | Terrain GPU, DEM et picking | Approche au sol, couverture et limites de résolution |
| Voir un éclairage cohérent | Soleil astronomique et matériau terrain éclairé | Direction par corps, HDR, occultation et ombres de relief selon les expériences |
| Traverser l'atmosphère | Noyau physique et laboratoire dédiés | Adaptation Babylon et composition avec les surfaces |
| Voyager avec le Babylon | Intention narrative et vaisseau définis par l'auteur | Itinéraire, état du vaisseau, étapes et reprise du récit |
| Garder une découverte | Positions et dates manipulables | Format de vue, carnet local, URL et références des données |

Les détails des composants et des dépendances restent dans le [plan de développement](solar-system-development-plan.md). Cette direction produit en guide désormais l'ordre de livraison.

## Validation du premier parcours

Le premier essai utilisateur doit montrer si une personne peut comprendre où elle se trouve, rejoindre la Lune, se poser, regarder la Terre, conserver sa vue et retrouver le Babylon sans explication des repères ou des caméras.

On observe les hésitations, les pertes d'orientation, les interruptions dues au chargement et la capacité à reprendre le voyage. On vérifie également si la personne choisit de s'attarder sur un lieu ou d'en ouvrir un autre. La qualité du parcours se juge sur ces usages autant que sur les images produites.
