# Mission Shackleton dans SpaceXR

## Promesse

« Trouve trois sites à comparer près de Shackleton pour une installation lunaire. » L'agent transforme cette demande en observations visibles, critères explicites et choix conservés. La commande « Montre-moi pourquoi » présente les éléments qui soutiennent une conclusion.

Mission Control orchestre cette expérience dans Explorer. Le Babylon peut en fournir le contexte narratif, sans modifier les données scientifiques. Les profils énergie, terrain et accès du texte source sont illustratifs, pas des emplacements validés.

Mission Control reprend le système gouverné de `co2-scrubber-governed-agent`. Explorer est un slot parmi les capacités de ce système. La [base logique auditée](mission-control-governed-agent-audit.md) et le [découpage des dépôts](explorer-mission-control-architecture.md) font référence pour ce portage.

## Six actes

Ces actes organisent la présentation à l'utilisateur. Ils ne constituent pas un workflow d'appels imposé au superviseur. La mission fournit une situation, un objectif et des critères de résultat ; le superviseur choisit ses actions dans les capacités disponibles, puis réévalue à partir des réponses. Les conduites spécialisées et les gardes restent celles des tâches auxquelles elles s'appliquent.

| Acte | Expérience | Résultat conservé |
| --- | --- | --- |
| Arrivée | Rejoindre la région, afficher la zone d'étude, les critères et les données disponibles | Région, période, hypothèses et priorités |
| Reconnaissance | Survoler les candidats et afficher les couches pertinentes | Emprises et observations de chaque site |
| Comparaison | Trois vues avec date, échelle et conventions de hauteur communes | Vues et mesures comparables |
| Temps | Animation et courbes des résultats d'illumination calculés | Série temporelle, méthode et provenance |
| Implantation | Placer le même habitat à l'échelle réelle sur les candidats | Propositions distinctes et annulables |
| Décision | Retenir, écarter ou demander d'autres sites | Choix, motifs explicites et visite rejouable |

L'agent vérifie les données avant d'annoncer trois sites. Il peut en proposer moins si les contraintes ou la couverture le nécessitent. « Meilleur » signifie meilleur parmi les candidats évalués, selon les critères et la période choisis.

## Interface et comparaison

Le terrain reste central. Le panneau de mission présente objectif, avancement, critères et candidats. La comparaison ouvre trois vues du même monde, puis permet de revenir au survol général.

Chaque candidat sépare mesures, données absentes et synthèse. Les sources et la période sont consultables. Changer les poids du classement ne recalcule pas les mesures indépendantes de ces poids.

Les vues déclarent leur hauteur au-dessus du sol ou de la surface de référence. Elles partagent champ de vision, échelle, date, exagération verticale et règle d'orientation. Une désynchronisation volontaire est visible.

## Montre-moi pourquoi

Une conclusion référence une séquence : rappeler le critère, rejoindre le site, montrer la couche et sa mesure, comparer au second candidat dans les mêmes conditions, puis revenir au compromis proposé.

Cette séquence illustre un résultat d'analyse et sa provenance. Une image convaincante ne valide pas seule la conclusion. Les scores et mesures proviennent des calculs disponibles, pas du modèle de langage.

Une contestation telle que « le site B paraît plus plat » ouvre la zone mesurée, la définition de la pente et les profils comparés. La mission conserve les décisions explicites et leurs pièces justificatives.

Cette fonction réutilise les manifests, les claims, les résultats et les traces du système existant. Chaque élément montré renvoie à sa donnée ou à son calcul. Une inférence conserve son statut ; la répétition d'une phrase ou l'accord d'un autre modèle ne la transforme pas en observation validée.

## Analyses à construire

| Critère | Données et méthode | Limite à présenter |
| --- | --- | --- |
| Terrain | DEM référencé, pente à une échelle déclarée, surface contiguë adaptée à l'emprise | Une résolution insuffisante ne décrit pas les petits obstacles |
| Énergie | Orientation datée, horizon du relief, hauteur des panneaux, période et échantillonnage | Moyenne d'éclairage, durée de coupure et production électrique sont des résultats différents |
| Ressources | Produits scientifiques et niveaux d'interprétation identifiés | Ombre, détection de glace et ressource exploitable sont des informations distinctes |
| Accessibilité | Chemins et contraintes de pente, obstacles connus, capacités du véhicule | Une distance en ligne droite ne décrit pas un trajet praticable |
| Communications, si demandées | Visibilité de la Terre ou d'un relais et horizon | Ce critère exige ses données et son calcul |

La température demande des produits ou un modèle thermique spécifiques. Elle ne se déduit pas directement de la couleur du rendu ou du pourcentage d'éclairage.

Les calculs lisent les données à la résolution déclarée, indépendamment du LOD visible. L'illumination précise repère lunaire, orientation, étendue du terrain occultant et traitement du disque solaire. L'échantillonnage est vérifié pour ne pas manquer des occultations brèves. Les corrections d'orientation identifiées dans celestial-core sont un prérequis.

Une année animée à l'écran n'est pas automatiquement une année analysée. Les ombres visibles doivent être cohérentes avec les résultats présentés. Les tâches longues exposent progression, couverture traitée et annulation.

## Classement

Appliquer d'abord les contraintes éliminatoires choisies, puis comparer les candidats restants. Une somme pondérée peut fournir un premier classement, avec normalisation et poids visibles. Les données absentes restent absentes ; elles ne deviennent ni une valeur favorable ni un zéro arbitraire.

Si les données ne permettent pas la comparaison, présenter un classement partiel. Montrer si une petite variation des poids change le premier choix. Les scores ne remplacent pas les mesures physiques et les incertitudes.

## Implantation

Placer le même module avec dimensions, ancrage et orientation explicites. Chaque proposition peut être conservée, modifiée et annulée. Les panneaux suivent une règle d'orientation définie.

Une représentation sur le relief ne certifie ni stabilité, ni fondations, ni faisabilité d'exploitation. Ces questions demandent d'autres analyses.

## Mission persistante

Conserver objectif, région, période, candidats, repères, vues, annotations, critères, contraintes, poids, sources, révisions, résolutions, algorithmes, paramètres, résultats, incertitudes, implantations et décisions explicites.

Une autre personne peut rejouer la visite et créer une variante des critères. Rejouer une visite, relire un résultat et relancer un calcul sont des opérations distinctes. Une nouvelle exécution conserve sa provenance sans remplacer silencieusement l'ancienne.

Le prototype commence par export/import et URL de vue. Le partage distant demande stockage et sources accessibles au destinataire. La mission persistante appartient à Mission Control, pas au broker.

Réutiliser `harness/lib/run-log.ts` pour les exécutions : prompts et schémas réellement proposés, réponses, étapes du harness, arguments, résultats, erreurs et changements d'état. Une livraison de scénario terminée ne clôt pas le journal d'une mission encore ouverte. Les attentes, suspensions et échecs restent enregistrés. La restauration après redémarrage doit être vérifiée séparément des attentes/reprises dans un même processus.

## Un monde et trois vues

Les trois vues partagent moteur et monde. La sélection des tuiles couvre l'union des besoins des caméras ; une vue ne doit pas évincer les données utiles aux autres. La SSE utilise les dimensions de chaque viewport.

Le rendu relatif à la caméra, le picking et la profondeur sont actualisés pour chaque passe. Le terrain actuel nécessite une validation et probablement une adaptation pour ce fonctionnement. Calculs et rendu partagent des budgets pour préserver la navigation.

## Livraisons

| Étape | Livrable | Recette |
| --- | --- | --- |
| M0 | Portage de la base gouvernée CO₂ et contrats du slot Explorer | Même boucle, capacités et traces ; services du domaine injectés sans dépendance à un scrubber |
| M1 | Emmène-moi et explique ce que je vois | Actions visibles dans Explorer et reprise en main immédiate |
| M2 | Mission avec trois candidats préparés | Comparaison, critères, annotations, sauvegarde et justification ; démonstration identifiée |
| M3 | Analyse réelle de terrain | Pentes et emprises sourcées, comparaison à une référence indépendante |
| M4 | Illumination et implantation | Orientation et horizon validés, animation cohérente avec les résultats |
| M5 | Mission complète sur les analyses réelles | Budget, attentes et décisions explicites dans le harness existant ; reprise et export vérifiés |

Les fixtures déterministes éprouvent les contrats et l'interface. La recette de mission utilise le superviseur sur le graphe existant ; aucun script ne remplace silencieusement le reasoner. Le portage du host et la validation des analyses restent deux travaux distincts. Les estimations du premier visualiseur Terre-Lune ne couvrent pas cette mission complète.
