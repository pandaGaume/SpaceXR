# Base logique de Mission Control

## Conclusion corrigée

`spikypanda-harness` est la cible de la reprise générique de `co2-scrubber-governed-agent`. Ce qui doit être repris est son architecture, ses slots utiles et ses graphes, après examen critique. Mission Control assemblera ce socle ; Explorer lui ajoutera ses behaviors métier. Le démonstrateur fournit des chemins exécutables et des preuves historiques, mais son fonctionnement partiel ne valide pas son assemblage comme bibliothèque générique.

La proposition précédente donnait trop de responsabilités à un nouvel orchestrateur situé au-dessus du broker. Elle s'appuyait aussi sur le statut du dépôt séparé `spikypanda-harness` pour apprécier la maturité de tout le système. Cette conclusion était incomplète : la base CO₂ utilise notamment `@spiky-panda/harness` 0.1.1 et d'autres paquets du substrate conservés dans `vendor/`, avec une intégration applicative exécutable.

État local : commit `62a8e6c`, du 29 octobre 2026, examiné le 6 novembre 2026. Cette revue porte sur les documents structurants, les chemins de décision et de mission, les contrats, les providers, les mécanismes de connaissance et de traces, les tests associés et les éléments d'exécution exportés. Les archives et fixtures historiques sont des éléments datés, pas une certification du code actuel. Aucune mission, appel de modèle ou commande matérielle n'a été lancé.

## Ce que la base fournit

Les chemins du tableau sont relatifs à `Gaume/co2-scrubber-governed-agent`.

| Capacité | Implémentation | Conséquence pour Mission Control |
| --- | --- | --- |
| Boucle de décision exécutable | `harness/lib/flow.ts`, `harness/core/agent.ts` | Réutiliser le graphe observe/context/lookup/gate/request/reason/merge/guard/execute/observe-after/evaluate/record |
| Agent défini par ses services | `harness/core/agent.ts` | Brancher observateur spatial, capacités, évaluateur, garde et mémoire sur la même boucle |
| Découverte des slots et outils | `harness/lib/broker.ts`, `harness/core/capabilities.ts` | Le slot Explorer devient un catalogue de capacités selon le profil de l'appelant |
| Mission supervisée | `tier3/mission.ts`, `slots/agent/provider.ts` | Conserver objectif, budget, attente d'événement ou d'humain, suspension, invalidation et conclusion explicite |
| Objectif initial sans workflow imposé | `slots/scenario/mission.ts` | Un scénario fournit situation et objectif ; il ne choisit pas les appels du superviseur |
| Raisonnement remplaçable et routage par rôle | `slots/reasoner/provider.ts`, `specs/reasoner/routing.json` | Conserver le rôle et ses outils indépendamment du modèle qui l'occupe |
| Factory et spécialisations | `harness/core/runner.ts`, `topic.ts`, `slots/factory/provider.ts`, `harness/topics/` | Ajouter le travail spatial par contrats et topics, avec validation des résultats |
| Conduite spécialisée en graphe | `harness/core/conduct.ts`, `specs/*/playbook.json` | Réutiliser les preuves, étapes et gates des tâches sans imposer un scénario métier à toute mission |
| Autorité et décisions humaines | `slots/station/`, `lib/roles.ts`, `broker/security.json` | Adapter les rôles et opérations au domaine ; l'agent ne s'attribue pas l'autorité |
| Connaissance sourcée | `slots/tools/library/provider.ts`, `docs/library/`, `harness/core/contracts.ts` | Publier méthodes, faits, conditions et provenance des données spatiales |
| Statuts des affirmations | `harness/core/claims.ts` | Distinguer OBSERVED, VERIFIED, INFERRED, AMBIGUOUS, CONTRADICTED et UNKNOWN |
| Quantités et interprétation | `slots/physics/`, `harness/core/interpreter.ts`, `harness/lib/semantic-interpretation.ts` | Conserver le service de quantités ; étendre le vocabulaire spatial et vérifier repères et unités |
| Mémoire et évaluation | `episodes.ts`, `recipes.ts`, `replay.ts`, `lib/working-memory.ts`, `memory.ts`, `evaluator.ts` | Garder les expériences et les corrections avec leurs résultats ; une recette ne remplace pas une décision de supervision obligatoire |
| Adaptations gouvernées | `lib/fork.ts`, `reflection.ts`, `recommendation.ts`, topics associés | Garder l'expérimentation isolée et la séparation entre proposition et adoption |
| Journal persistant | `harness/lib/run-log.ts`, `harness/core/manifest.ts` | Réutiliser les prompts réellement envoyés, schémas, réponses, arguments, résultats, états et hashes |
| Activité visible | `slots/lib/events.ts`, `ui/pushes.ts` | Faire suivre l'activité par les vues ; distinguer le flux court des journaux persistants |
| Interfaces de contrôle | `dashboard/`, `ui/`, slots `screens`, `speech`, `station` | Ajouter l'explorateur aux vues du système et aux écrans existants |

Les dépendances du package et le code actif font autorité pour l'extraction. Un commentaire historique décrivant quatre slots ou une fonctionnalité encore prévue ne remplace pas le code : `slots/run-all.ts` déclare aujourd'hui vingt slots.

## La frontière exacte du slot Explorer

Explorer possède le rendu, le terrain, la caméra, le temps affiché, les sélections, les objets visibles et leurs références. Il expose outils, ressources et événements selon les mêmes contrats MCP que les autres slots.

Il peut être un provider dans le navigateur, ou utiliser un pont vers la session vivante selon l'intégration retenue. Fermer son onglet rend sa capacité indisponible ; cela ne transforme pas automatiquement une mission en succès ou en échec définitif. Le superviseur voit l'indisponibilité et la mission garde son objectif.

Les autres slots peuvent continuer à lire les données, calculer et préparer des artefacts sans ce rendu. L'état de mission ne doit pas vivre uniquement dans la page Explorer. Une vue utile est un artefact lié à un résultat, pas le résultat scientifique lui-même.

`screens` choisit les pages affichées sur les écrans. `explorer` agit dans le monde spatial. Ces deux capacités restent distinctes.

## Réutiliser sans transporter les dépendances CO₂

Le mécanisme générique est déjà isolé en partie. Son assemblage applicatif contient encore des liens concrets au démonstrateur :

- `tier3/agent.ts` choisit un observateur de cabine et un évaluateur fondé sur l'état CO₂.
- `tier3/lib/observer.ts` lit `scrubber.motor.state`.
- `slots/agent/provider.ts` raccorde l'exécuteur de procédures, les décisions de commissioning et des événements déterminés.
- `specs/harness/application.json` contient les bindings d'autorité et les noms de seuils, mais son chargement est un import statique.
- Les topics disponibles et les kinds d'artefacts sont des listes explicites dans `task.ts`, le runner et le manifeste.
- Le helper `slots/lib/slot-server.ts` fixe encore le domaine `habitat`, et les profils et politiques portent des chemins du démonstrateur. Ces bindings doivent suivre le contexte spatial, sans réécrire le transport MCP.
- Les décisions et questions en attente comportent des états en mémoire. Le journal sur disque ne prouve pas une restauration automatique après redémarrage.

Il faut donc généraliser ces points d'assemblage en conservant les mécanismes et leurs tests. Changer le prompt ou ajouter une ligne dans la liste des slots ne suffit pas à transformer l'observateur de cabine en observateur de mission spatiale.

La réutilisation prend la forme de dépendances vers les paquets du substrate et d'une extraction contrôlée du host commun. Le démonstrateur CO₂ reste une application de référence. Une copie durable du harness dans Mission Control créerait deux sources à maintenir et doit être évitée.

## Ce que montrent les exécutions enregistrées

Le [dossier du 27 octobre](../../Gaume/co2-scrubber-governed-agent/docs/evidence/commissioning-2026-10-27/README.md) contient une mission terminée, les requêtes et résultats, deux tentatives de factory, les décisions humaines, l'exécution et son contrôle de complétion. L'[index des actions](../../Gaume/co2-scrubber-governed-agent/docs/evidence/commissioning-2026-10-27/reference/actions.json) montre notamment la demande de factory, la lecture de son état, les attentes, la demande d'exécution puis la conclusion de mission. Une réponse `completed` à `factory.task` signifie que cette lecture a réussi, pas que la tâche consultée a réussi.

Le run est historique et son contexte comporte des modifications non commitées. Il prouve le fonctionnement enregistré dans ce contexte, pas la reproductibilité de toute révision future ni la validation des futures analyses lunaires.

Le [cas du sas du 28 octobre](../../Gaume/co2-scrubber-governed-agent/docs/evidence/commissioning-2026-10-27/essais/2026-10-28-sas/README.md) conserve un refus d'exécution, la réponse du modèle et une attente d'événement sans voie interactive de réponse. Il montre pourquoi l'attente d'un humain doit être raccordée à une vraie question et pourquoi un refus ne démontre pas l'état physique supposé par le modèle. La procédure et l'exécuteur étaient incompatibles ; une instruction orale ne corrigeait pas l'artefact approuvé.

Pour Shackleton, la même discipline impose : demande d'analyse, résultat calculé, validation, affichage et décision restent des états distincts. L'agent choisit sa prochaine action à partir de leurs résultats réels.

## Ce qu'il reste à ajouter pour SpaceXR

1. Un domaine spatial : corps, repères, lieux, régions, jeux de données, candidats, critères et résultats référencés.
2. Le slot `explorer` sur la session 3D réelle, avec observation, navigation, temps, annotations, objets et vues.
3. Des capacités d'analyse dédiées : relief, horizon, illumination, accessibilité et comparaisons, avec budgets et preuves numériques.
4. Les prompts, contrats et conduites spécialisés nécessaires, sans réécrire la boucle commune.
5. Une projection visuelle des preuves : « Montre-moi pourquoi » rejoint le lieu et les résultats effectivement enregistrés.
6. Une persistance et un export de mission adaptés au partage, avec restauration après redémarrage explicitement testée.
7. Le raccordement des vues et de la narration au voyage du Babylon.

Les modes Guide, Copilote et exploration déléguée se traduisent par profils de capacités et arbitrage du contrôle. La navigation réversible n'hérite pas automatiquement des approbations à deux rôles d'un test matériel CO₂. Les règles dépendent de l'opération et de son autorité réelle.

## Ordre de portage

La revue critique ci-dessous remplace l'ordre de portage initial. La priorité est la reprise architecturale dans `spikypanda-harness`, avant l'assemblage de Mission Control et l'ajout du slot Explorer.

Les tests de contrat, de transport, de gouvernance et les fixtures restent utiles, mais une recette de mission complète doit vérifier la succession réellement choisie, les résultats produits et la conclusion fondée sur ces résultats. Aucun test n'a été relancé dans cette revue documentaire.

## Revue critique et périmètre de reprise, 6 novembre 2026

### Décision de périmètre

Le fonctionnement approximatif du démonstrateur interdit une extraction par simple copie de fichiers. Une fonction peu couplée n'est pas nécessairement le composant architectural dont le harness a besoin. La reprise doit commencer par la sémantique d'exécution des graphes, leurs sessions et les services exposés par les slots.

L'apprentissage topologique reste une branche exploratoire non validée. Préserver son archive et ses références ne signifie ni l'activer dans le chemin nominal, ni faire de sa validation un prérequis de cette reprise. Les épisodes, recettes et analyses de traces ne démontrent pas à eux seuls un apprentissage de la topologie.

### Les graphes à reprendre et leurs responsabilités

Ces responsabilités peuvent se composer dans le système commun. Elles ne doivent pas être confondues avec un graphe documentaire unique ni avec des moteurs indépendants.

| Graphe ou rôle | Ce qui existe dans le scrubber | Reprise et limite |
| --- | --- | --- |
| Décision de l'agent | `harness/lib/flow.ts`, douze nœuds et douze liens ; `harness/core/agent.ts` appelle `AdaptivePolicyRuntime` | Conserver observe/context/lookup/gate/request/reason/merge/guard/execute/observe-after/evaluate/record. Porter la topologie en JSON avec les registres et sessions Core actuels. Vérifier chaque branche, y compris refus et absence de résultat |
| Conduite d'une tâche ou d'un processus | `harness/core/conduct.ts`, `specs/<topic>/playbook.json` ; preuves, étapes, gates et sorties | Reprendre les nœuds génériques et les règles de passage. Les preuves et vues sont fournies par l'application. Une conduite spécialisée ne doit pas fixer tout le voyage d'une mission ouverte |
| Connaissance et justification | Library, faits, contrats, affirmations et références dans les slots et `harness/core/` | Préserver sources, unités, versions et statut des affirmations. Un texte lu ou une affirmation du modèle ne devient pas une preuve d'exécution |
| Analyse des exécutions | `lib/harness-graph.ts`, reconstruit depuis manifestes, épisodes, traces et textes lus | Conserver comme projection dérivée pour diagnostic et comparaison. Il ne pilote pas la mission et ne remplace pas les sources persistées |
| Simulation et calcul | Slots `twin`, `model`, `physics`, graphes Core et modèles ONNX | Composer les domaines d'exécution et les capacités existantes. Extraire les mécanismes, laisser modèles de cabine et critères CO₂ dans leur application |
| Relations du système et autorité | Rôles, bindings, politiques du broker et contrôles applicatifs | Préserver les frontières d'autorité. Une connexion au graphe ne donne pas automatiquement un droit d'action ; le raisonneur reste une capacité remplaçable |

Le graphe de référence du dépôt cible n'est pas encore ce runtime : `src/graph/nodes.ts` lève explicitement une erreur dans `fire()`. Sa matérialisation et ses tests de structure ne prouvent pas une boucle d'agent opérationnelle. Inversement, le scrubber utilise un harness vendored dont les contrats ne sont pas ceux de cette proposition. Le passage de l'un à l'autre doit être explicite.

### Défauts à corriger pendant la reprise

| Constat vérifiable | Conséquence | Traitement |
| --- | --- | --- |
| `flow.ts` construit sa topologie en code puis la sérialise en définition v1 ; la cible attend des topologies JSON et une matérialisation native | Copier le builder ancien contournerait le modèle retenu dans la cible | Extraire la topologie et inscrire les types de nœuds et liens dans les registres Core ; vérifier la compatibilité des ports et des formats |
| `runner.ts` importe explicitement neuf topics, le contexte applicatif, la mémoire, les chemins d'atelier et les services | Le runner apparent générique transporte l'assemblage du démonstrateur | Composer les spécialités au niveau de l'hôte ; garder le contexte d'exécution dans la session et exprimer la conduite dans le graphe |
| `physics.ts` conserve un port global, le dernier enregistré pour tout le processus | Deux contextes peuvent recevoir le même service malgré leurs besoins différents | Rattacher le service à la session concernée et tester deux sessions distinctes |
| `createAgent` utilise `AllowAllSafetyGuard` lorsque le guard est absent | L'existence du stade guard ne prouve pas une politique restrictive | Rendre la politique de l'hôte explicite ; vérifier les refus réels du broker et des exécutants indépendamment du prompt |
| L'invalidation d'une décision est reconnue dans `agent.ts` par comparaison du texte d'une erreur | Un changement de message peut casser le traitement | Préférer un contrat d'erreur typé du substrate ; isoler l'adaptation de version tant qu'il manque |
| `Mission` possède une boucle et des états propres en plus du runtime de décision | Copier ce contrôleur tel quel risquerait de créer une seconde orchestration à côté du graphe | Reprendre les transitions de cycle de vie, les rattacher aux sessions et aux relations du graphe ; ne pas ajouter un ordonnanceur parallèle |
| Le cas historique du sas attend un événement sans question humaine exploitable | Une mission ouverte peut rester bloquée malgré des composants disponibles | Lier attente, destinataire, question ou événement attendu et corrélation ; vérifier l'arrivée avant, pendant et après la mise en attente |
| Des questions et états vivent en mémoire ; le journal persistant capture l'exécution | Journaliser ne suffit pas à reprendre une mission après redémarrage | Définir et tester restauration, événements déjà traités et traitement des résultats tardifs ; ne pas promettre cette reprise avant preuve |
| Le serveur de slots fixe `habitat` et des chemins de grammaires applicatifs | Copier le helper conserverait le domaine CO₂ | Réutiliser serveur, behaviors, adaptateurs, grammaires et transports de la famille MCP ; injecter les bindings applicatifs |

La gouvernance peut correctement refuser une action alors que la mission reste défaillante : le refus protège une frontière, mais ne prouve ni la qualité du raisonnement ni la capacité à récupérer. De même, une réponse MCP réussie à une lecture de tâche n'est pas une tâche réussie.

### Slots utiles et emplacement de la reprise

Le tableau distingue la responsabilité logique et sa réalisation. Il ne prescrit pas un processus ou un nouveau dépôt par ligne. Les dépôts MCP inventoriés ne sont pas tous raccordés au scrubber actuel.

| Responsabilité | Décision |
| --- | --- |
| Broker, découverte, transport, serveur et grammaires | Dépendre de `mcp-broker`, `mcp-core` et du provider existant. Aucun catalogue parallèle ; les besoins du graphe ne sont pas un registre de providers |
| Reasoner | Reprendre contrats, routage par rôle, limites et traces. Séparer les adaptateurs de modèles du runtime du graphe |
| Agent, factory et supervisor | Reprendre graphes, délégation, validation et cycle de vie ; ce sont des surfaces de services du harness, pas trois orchestrateurs autonomes |
| Workspace et artefacts | Reprendre accès délimité, références, versions et résultats vérifiables. Retirer chemins et types d'artefacts imposés par le démonstrateur |
| Library et connaissance | Reprendre consultation et provenance. Les corpus et règles métier restent chez les applications |
| Observer | Reprendre le rôle et la projection de contexte. L'observateur de cabine est une implémentation métier à remplacer |
| Station et interaction humaine | Extraire questions, réponses corrélées, décisions et restitutions. Conserver les procédures et signatures de commissioning dans CO₂ |
| Mémoire temporaire et historique | Évaluer les contrats de `mcp-cache` et `mcp-history` pour les stockages appropriés. Un cache ne constitue pas automatiquement un journal durable ou un checkpoint de session |
| Secrets et identités de ressources | Réutiliser `mcp-vault` et `mcp-uns` selon le besoin. Distinguer identité stable d'une ressource et identité d'une connexion provider |
| Web | Consommer `mcp-web`, déjà extrait du démonstrateur. Ne pas copier une seconde fois le slot web |
| Screens, speech et QR | Garder comme capacités optionnelles de restitution et d'interaction, hors du noyau d'exécution |
| Forge, CAD, model et physics | Conserver les extensions utiles, mais évaluer contrats et dépendances hôte séparément. Les outils de génération et calcul ne sont pas requis par toute mission |
| OpenAPI, SCADA, Modbus, OPC UA et découverte réseau | Intégrations optionnelles disponibles dans la famille MCP, activées par l'application et les politiques du broker. Aucune découverte réseau à lancer pour cette extraction |
| Explorer | Écrire ses behaviors métier et les raccorder avec `mcp-for-babylon`, `mcp-core` et le broker. Ne pas recréer leur infrastructure |
| Scrubber, biomed, scénarios et twin CO₂ | Garder dans le démonstrateur. Réutiliser la capacité de charger un domaine et un scénario, sans imposer leurs contenus au harness |

### Évaluation du lot de code préparé

Le répertoire isolé `.cache/harness-generic-transfer` contient des ports d'affirmations, de refus, d'épisodes, de livraison ordonnée et un accès natif aux slots du broker. Dix-neuf tests y passent, dont des échanges MCP en Loopback. Ce résultat vérifie ce lot restreint ; il ne démontre ni le transfert des graphes, ni une mission fonctionnelle, ni une reprise après incident.

Ce lot n'a pas été appliqué à `spikypanda-harness`. Il reste un candidat à examiner après les décisions architecturales. L'accès broker préparé doit notamment être confronté aux mécanismes existants avant adoption. Les utilitaires seront repris uniquement lorsqu'un nœud, une relation ou un service identifié en a besoin.

### Plan révisé et critères de sortie

1. **Cartographier les contrats.** Fixer versions source et cible, responsabilités de chaque graphe, services et dépendances. Sortie : correspondance entre nœuds anciens, types Core actuels, ports, contexte de session et capacités MCP, avec écarts explicites.
2. **Rendre la boucle minimale exécutable dans la cible.** Charger son JSON par la factory native, implémenter les résolveurs nécessaires et exécuter une décision complète avec reasoner contrôlé et un slot MCP de test. Sortie : observation, action, résultat, évaluation et trace corrélés ; refus et absence de provider observables.
3. **Porter conduite, délégation et cycle de vie.** Ajouter un playbook de tâche, attente humaine ou externe, budgets, annulation et résultats tardifs, en s'appuyant sur les sessions Core. Sortie : plusieurs tâches progressent sans mélange de contexte ni blocage global ; une tâche terminée ne termine pas la mission.
4. **Raccorder les slots utiles.** Reasoner, factory, connaissance, artefacts, observation et interaction humaine en priorité ; autres capacités selon les besoins. Sortie : une seconde application les compose sans importer de code ou de configuration CO₂ ; les slots manquants restent identifiés comme indisponibles.
5. **Raccorder preuve et diagnostic.** Journal corrélé, manifestes et projection du graphe d'analyse. Clarifier stockage temporaire, historique, artefacts et checkpoints. Sortie : expliquer une décision à partir des données effectivement reçues ; ne pas déclarer une restauration non testée.
6. **Vérifier la transférabilité.** Rebrancher une recette CO₂ avec ses bindings métier, puis une mission minimale sans CO₂. Sortie : deux assemblages utilisent le même socle, avec au moins un parcours complet et des cas de refus, déconnexion et attente documentés. Une recette contrôlée ne remplace pas ensuite l'essai avec modèle réel.

Mission Control et les behaviors Explorer viennent après ce socle vérifié. L'archive d'apprentissage topologique reste conservée à part pendant ces étapes.
