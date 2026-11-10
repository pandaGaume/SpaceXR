# Relecture de SpikyPanda et réutilisation dans le harness

Date : 10 octobre 2026.

Intervention ultérieure : les [corrections ONNX Transformer pour LLMLingua-2](verification-onnx-transformer-llmlingua2.md) modifient maintenant des sources Core et ONNX de SpikyPanda et exécutent des tests ciblés. Les mentions d'absence de modification et de tests ci-dessous décrivent uniquement la relecture initiale.

Relecture ciblée des sources et contrats publics du dépôt `C:/Users/GuillaumePelletier/Documents/GitHub/spikypanda`, de Core et des fonctionnalités utiles au harness. Elle couvre les chemins de construction, restauration, exécution, simulation, édition et exposition MCP. Elle ne constitue pas un audit exhaustif de toutes les fonctionnalités. Aucune source de ce dépôt n'a été modifiée et sa suite de tests n'a pas été exécutée.

## 1. Socle à conserver

Le harness spécialise le graphe et les sessions de Core. Il doit ajouter les opérations propres aux agents, les corrélations et les règles de contexte aux mécanismes existants. Il ne doit pas introduire un second modèle de graphe, un ordonnanceur parallèle ou une sérialisation indépendante.

Les chemins ci-dessous sont relatifs au dépôt SpikyPanda.

| Composant relu | Mécanisme existant | Conséquence pour le harness |
| --- | --- | --- |
| `packages/dev/core/src/graph/graph.builder.graph.ts`, `execution/execution.builder.ts` | `GraphBuilder`, `RuntimeGraphBuilder`, assemblage de nœuds et liens natifs | Réutiliser le builder de Core, y compris à travers ses chargeurs JSON |
| `core/src/graph/graph.registry.ts` sous `packages/dev/` | `INodeRegistry`, `ILinkRegistry`, factories par `typeId`, métadonnées et notifications de changement | Enregistrer nœuds et liens symétriquement ; aucun protocole local de factory à dupliquer |
| `core/src/graph/graph.graphItem.ts` | `@cloneable`, `serialize`, `deserialize` | Déclarer les données spécialisées sur les classes héritées, sans réécrire leur restauration |
| `core/src/document/` | `buildDocument`, `buildDocumentJson`, `validateDocumentSpec`, `parseDocument`, `instantiateDocument`, `applySetting`, `runDocument` | Réutiliser la chaîne documentaire selon sa compatibilité de format et les signatures des types enregistrés |
| `core/src/sim/sub-graph.materialize.ts` | `materializeSubGraphInto`, création par factories, liens typés, restauration, sous-graphes imbriqués, ports de frontière et diagnostics | Charger la topologie JSON avec ce mécanisme ; ajouter seulement l'admission et les métadonnées du harness |
| `core/src/execution/` | `RuntimeGraph`, `RuntimeNode`, `Channel`, `Session`, ordonnanceur, buffers par slot, files d'événements, état par nœud et sessions internes aux graphes composés | Porter l'état dans les sessions natives ; examiner leurs points d'extension avant toute nouvelle primitive de parcours |
| `core/src/sim/solver.attachment.ts` | Collecte des descripteurs, regroupement et construction d'attachements de solveurs ; registre de solveurs existant | Raccorder un twin et son solveur par ces mécanismes, puis l'attacher à la session concernée |
| `core/src/compute/`, `packages/dev/onnx/` | Graphes de calcul natifs, kernels, liens tensoriels, planification, import ONNX et registres d'opérateurs | Raccorder ces graphes comme domaines d'exécution ; ne pas créer un moteur d'inférence dans le harness |
| `core/src/neuralnetwork/` | Réseaux, entraînement, plasticité et primitives neuronales | Réutiliser ces capacités pour l'apprentissage ; vérifier lesquelles sont déjà natives des sessions |
| `core/src/provenance/` | Provenance de modèle, heuristique ou standard | Réutiliser cette provenance lorsqu'elle décrit un modèle ; distinguer les références de preuves et les événements d'un run |
| `packages/dev/nodeeditor/`, `packages/dev/plugins/` | Contexte de plugin avec registres de nœuds et liens, éditeurs, reconstruction de sessions, liens typés et gestion documentaire | Intégrer le harness par plugin si une interface est nécessaire ; ne pas recopier l'éditeur ou créer une session invisible distincte de celle affichée |
| `packages/dev/factory/` | Jobs de sweep, fit et évaluation ; réexport des builders documentaires Core | Exposer ces opérations comme capacités du graphe, sans transformer cette factory numérique en runner du harness |
| `packages/dev/mcp/` | `RuntimeController`, contrôleur du graphe édité, stockage documentaire, journal d'événements, catalogue et transport vers le broker | Réutiliser les surfaces pertinentes, sans recopier la publication du catalogue ni les outils de construction/exécution |

Les racines `core/src/...` abrégées dans le tableau désignent `packages/dev/core/src/...`.

## 2. Construction et liens typés

Les factories de nœuds et de liens existent déjà dans Core. La factory de lien crée un objet non câblé, comme la factory de nœud crée son instance. La matérialisation restaure les données, positionne les ports, puis affecte les extrémités. Cet ordre compte pour les caches de routage des nœuds.

La base du harness utilise maintenant ces deux registres via `IHarnessGraphFactory`. Le [JSON de référence](../src/graphs/reference.json) porte les `typeId`, les données et les connexions. Le [chargeur](../src/graph/load.ts) délègue création, désérialisation et câblage à Core. Les constructeurs concrets restent dans les inscriptions de la factory choisie par l'hôte.

La matérialisation native peut signaler des éléments manquants et revenir à un `Channel` générique pour un type de lien inconnu. Le harness refuse ces diagnostics pour éviter de publier un graphe partiel ou de perdre silencieusement sa sémantique de passage de contexte. Cette admission est une politique du harness, pas un nouveau mécanisme de construction.

## 3. Écart documentaire constaté

Les interfaces `SavedGraph` et `SavedConnection` de `document.interfaces.ts`, ainsi que `parseDocument`, décrivent encore le chemin v3. `SavedConnection` ne décrit pas les champs `typeId` et `data` des liens. `instantiateDocument` ne constitue donc pas, en l'état relu, le chemin de restauration de nos liens spécialisés.

En parallèle, `materializeSubGraphInto` accepte les types et données des liens, et l'éditeur dispose de mécanismes pour les liens typés. L'ADR `docs/architecture/adr-001-session-native-snn-and-typed-links.md` décrit cette direction v4, avec des liens persistés de la même manière que les nœuds et une exécution SNN native des sessions.

Le document du harness suit cette direction avec `version: 4` et utilise la matérialisation existante. Cela ne garantit pas qu'il passe aujourd'hui par tous les outils documentaires MCP ou par toute la chaîne d'ouverture et sauvegarde de l'éditeur. La convergence de ces chemins doit être traitée dans Core, si nécessaire, avant de promettre cette compatibilité. Aucune modification de Core n'est faite ici.

Autre limite : l'inscription générique `harness.node` de la proposition n'expose pas encore ses ports dans les métadonnées du registre. Ils sont restaurés depuis les données de chaque instance. Les types opérationnels devront déclarer des signatures et ports cohérents pour utiliser pleinement `validateDocumentSpec`, le catalogue et l'éditeur.

## 4. Sessions, solveurs et agents

Core sépare déjà topologie et état d'exécution : les sessions portent états, buffers, événements et attachements. Les graphes composés disposent de sessions internes. Le harness doit s'appuyer sur cette séparation pour les contextes des agents et le parcours des domaines connaissance, physique et neuronal.

La présence de ces primitives ne démontre pas encore les comportements propres au harness : fork avec projection de contexte, réunion par tentative, reprise d'un événement externe, annulation descendante et traitement des résultats tardifs. Il reste à examiner et tester leur réalisation dans les sessions et l'ordonnanceur existants. Les contrôles de topologie actuels ne démontrent aucune progression concurrente.

L'attachement d'un solveur dispose déjà d'un registre et de fonctions dédiées. La prochaine étape doit raccorder la session enfant à ces mécanismes et vérifier qu'une simulation active laisse progresser les autres activités. Une API asynchrone ne suffit pas à établir cette propriété si le calcul bloque le thread.

L'ADR SNN privilégie également les sessions natives. Les anciennes pistes expérimentales d'apprentissage ne doivent donc pas réintroduire leur propre runtime sans vérifier les primitives actuelles de Core.

## 5. MCP, stockage et responsabilités restantes

La surface MCP runtime possède déjà des outils `document_validate`, `document_build`, `document_instantiate` et `session_run`. Le chemin `RuntimeController.session_run` instancie le document pour la demande ; cette surface ne prouve pas à elle seule l'existence d'un contrat de session persistante avec ouverture et reprise. Les contrôleurs de l'éditeur, eux, doivent travailler sur son runner existant.

Le stockage documentaire conserve une définition de graphe. Il ne constitue pas un checkpoint complet du parcours, de ses branches et de ses attentes. De même, les primitives de provenance de modèle et le journal d'événements ne garantissent pas à eux seuls une reprise durable.

Les responsabilités propres au harness restent : contrats des événements et corrélations, projections de contexte, résolutions locales des rôles, intégration de la discovery native du broker et reasoner avec session. Les adaptateurs de cache et d'historique doivent respecter les garanties réelles de leurs services. Ces besoins n'autorisent pas à remplacer les mécanismes de graphe, de session et de discovery existants.

## 6. Vérification effectuée dans le harness

La compilation, l'inspection des 302 nœuds et 384 liens, ainsi que cinq tests de chargement passent. Les tests couvrent la substitution des classes par les registres natifs, la restauration des données, le refus d'un type de lien inconnu, le refus d'extrémités ou ports invalides et l'indépendance de deux graphes construits.

Avant chaque évolution, consulter cette carte puis relire le contrat public et le chemin d'exécution concernés. Ajouter seulement les comportements manquants démontrés, avec leur critère de vérification. La suite de travail reste celle de la [proposition d'implémentation](proposition-implementation-harness.md).
