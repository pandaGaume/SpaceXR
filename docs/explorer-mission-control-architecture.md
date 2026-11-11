# Explorer comme slot de Mission Control

## Architecture retenue

`spacexr-mission-control` reprend la base logique de `co2-scrubber-governed-agent` : un système gouverné fondé sur le graphe, ses harnesses et ses services distribués. `spacexr-explorer` publie un slot supplémentaire, au même titre que les services de connaissance, de simulation, d'analyse ou de raisonnement.

L'[audit de la base existante](mission-control-governed-agent-audit.md) remplace l'évaluation précédente, qui s'appuyait trop sur le dépôt séparé `spikypanda-harness`. Le système CO₂ dispose d'une intégration exécutable et de traces de missions ; son portage doit réutiliser ces mécanismes.

## Deux dépôts d'application

| Dépôt | Responsabilité |
| --- | --- |
| `spacexr-mission-control` | Assemblage du système gouverné, observation de mission, profils de capacités, slots, connaissance spatiale, tâches spécialisées, résultats, décisions, traces et poste de contrôle |
| `spacexr-explorer` | Monde daté, repères, terrain, caméra, Soleil, atmosphère, objets, navigation manuelle et provider MCP de la session graphique |

Mission Control ne recrée pas un harness indépendant. Explorer reste utilisable manuellement. Le Babylon fournit le fil narratif de l'expérience, tandis que l'objectif et les preuves de mission appartiennent au système gouverné.

## Topologie

```text
Humain et poste de contrôle
             |
Système gouverné et graphe
  harnesses, état, capacités, évaluations
             |
         MCP Broker
  /      |       |       |       \
agent  reasoner library factory  explorer
station physics twin   analyses screens
```

Les noms des services d'analyse spatiale restent à définir. Chaque service est un provider de capacités, pas une branche spéciale d'un dialogue. Le broker route et contrôle l'accès ; il ne choisit pas les actions du superviseur et ne porte pas la persistance métier.

La boucle commune observe, construit le contexte, choisit une décision, la vérifie, exécute une capacité, observe le résultat, l'évalue et le trace. Les conduites spécialisées encadrent les tâches auxquelles elles s'appliquent. Une mission fournit un objectif et des critères de complétion, sans imposer une séquence métier de navigation et d'appels.

## Réutilisation de la base CO₂

| Élément existant | Adaptation SpaceXR |
| --- | --- |
| Graphe de décision et `createAgent` | Même mécanisme, services d'observation et d'évaluation spatiaux |
| Découverte broker et profils de capacités | Ajouter les capacités Explorer et celles des analyses selon le rôle |
| Transport de mission, attentes et budgets | Conserver la distinction mission/tâche/scénario et la conclusion explicite sur preuves |
| Reasoner et routage par rôle | Changer les rôles et données du domaine sans coupler l'architecture à un modèle |
| Library, faits, claims et unités | Étendre les sources, repères, méthodes et quantités spatiales |
| Factory, topics, playbooks et validations | Réutiliser les mécanismes ; ajouter les spécialisations réellement nécessaires |
| Station et questions | Conserver les autorités, réponses et reprises ; adapter les opérations protégées au domaine |
| Journaux, manifestes et événements | Même trace d'exécution, liée aux vues et aux données spatiales |
| Dashboard, écrans et narration | Ajouter la vue Explorer et les projections de mission |

Le host actuel contient encore un observateur de cabine, un évaluateur CO₂ et des raccordements de commissioning. Leur généralisation est une extraction à vérifier, pas une duplication du démonstrateur ni un simple remplacement de prompt. Le démonstrateur reste la référence de non-régression.

## Surface du slot Explorer

Le provider expose des capacités spatiales de haut niveau. Leurs noms définitifs seront fixés à partir des conventions de la base et de l'audit de `mcp-for-babylon`.

| Famille | Capacités |
| --- | --- |
| Observer | Contexte, corps, date, caméra, sélection, couches, disponibilité et révision du monde |
| Explorer | Rejoindre un lieu, orienter le regard, changer la date, comparer des vues, annuler un déplacement |
| Présenter | Afficher une région, une annotation, une mesure ou un résultat de calcul existant |
| Manipuler | Placer ou retirer un objet, conserver une vue et un état de comparaison |

Les contrôles manuels et MCP appellent les mêmes commandes applicatives. Les schémas spatiaux précisent corps, repère, unités, vue et identifiants. Les descriptions et ressources suivent les mécanismes de grammaire et de découverte existants, sans catalogue parallèle écrit dans le prompt.

Une commande acceptée ne prouve pas que l'animation est achevée ou que le terrain est prêt. Les opérations exposent leur état et leur résultat. Une analyse de pente ou d'illumination appartient au service qui calcule ; le visualiseur la présente avec ses références.

Le slot peut résider dans le navigateur ou passer par un pont vers la session vivante. Fermer la page rend la capacité indisponible, sans supprimer l'objectif de mission. Aucun choix de transport ne doit dupliquer le monde 3D.

## Contrôle, durée et persistance

Guide, Copilote et exploration déléguée correspondent à des profils de capacités et à l'arbitrage du contrôle. Une interaction manuelle invalide une proposition de caméra devenue ancienne. L'agent observe à nouveau avant de poursuivre. L'arrêt du déplacement et l'arrêt d'une analyse restent distincts.

Le journal conserve demandes, outils proposés, réponses, garde, exécution et résultats. Le flux d'événements visible reste une projection courte ; il ne remplace pas le journal. Les secrets d'authentification n'entrent pas dans les journaux ou dans les exports.

L'identité de mission, la session Explorer et les vues sont distinctes. Les manifests et les résultats conservent leurs hashes. La restauration après redémarrage est un critère de portage à tester : les journaux sur disque ne prouvent pas à eux seuls une reprise durable de tous les états actuellement gardés en mémoire.

Les décisions portent sur des artefacts et des opérations identifiés. Les approbations propres aux essais matériels ne sont pas ajoutées à la navigation réversible.

## Workspace commun

```text
Gaume/
  spacexr-mission-control/
  spacexr-explorer/
  co2-scrubber-governed-agent/  référence exécutable
  celestial-core/
  quantia/
  geodesy_ts/
  3d-tiles-core/
  3d-tiles-babylon/
  spacexr-atmosphere/
  mcp-core/
  mcp-broker/
  mcp-for-babylon/
  spikypanda-harness/          à aligner avec la base effective
```

Le workspace peut aussi référencer le checkout SpikyPanda utilisé pour les paquets du substrate et son studio. Un fichier multi-root `spacexr.code-workspace` coordonne les tâches de développement. Chaque dépôt garde son lockfile et sa CI ; le dossier parent ne devient pas un troisième dépôt.

Les liens locaux servent à développer. Des versions ou archives identifiées rendent les installations reproductibles. Les mécanismes communs sont consommés depuis leurs paquets propriétaires ou extraits de façon contrôlée, sans copie durable de la boucle dans Mission Control.

## Livraisons révisées

1. Fixer la base CO₂ et les versions du substrate ; identifier et isoler les raccordements applicatifs.
2. Monter Mission Control avec cette base et les mêmes mécanismes de trace, mission et capacités.
3. Réaliser Explorer et publier son slot : contexte, navigation, temps, vues et événements.
4. Exécuter une première mission spatiale avec un vrai reasoner et des résultats visibles, en conservant toute la trace. Les fixtures restent des tests, jamais une substitution silencieuse du superviseur.
5. Ajouter les analyses et la [mission Shackleton](lunar-site-explorer-mission.md), puis le partage et la reprise durable vérifiés.

Les deux nouveaux dépôts ne sont pas encore initialisés. Les documents présents dans SpaceXR définissent leur cible.
