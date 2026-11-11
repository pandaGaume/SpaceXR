# Proposition d'implémentation du harness industriel

Date : 10 octobre 2026. Statut : proposition à contrôler.

Précision d'architecture ultérieure : le [brief sur le graphe hétérogène et l'exécution distribuée](brief-graphe-heterogene-et-execution-distribuee.md) distingue imbrication logique, transition de contexte et placement. Les frontières connaissance/simulation de cette proposition ne doivent pas être interprétées comme une obligation d'encapsuler ces domaines dans un nœud. Le typage de la topologie et la sémantique des transitions restent à adapter à cette décision.

## 1. Ce qui a été fait et ce qui reste proposé

Le code exploratoire a été déplacé dans `../archive/exploration-2026-10-10/`, avec ses modifications locales, configurations, tests, exemples et documents. Les empreintes de 158 fichiers source et de configuration ont été vérifiées après déplacement. Les dépendances et sorties de compilation ont également été rangées, sans calcul d'empreinte. Aucun fichier du dépôt applicatif source n'a été modifié.

La nouvelle base contient des contrats TypeScript et une topologie construite avec les objets natifs de SpikyPanda Core. Elle ne contient pas encore de resolver opérationnel, de raccordement des sessions du harness, de slot MCP ou de stockage actif. La compilation et l'inspection de topologie ne démontrent pas l'exécution concurrente ni la reprise d'un agent.

Les références actives sont les [fondements](fondements-harness-industriel.md), la [représentation du graphe unifié](representation-graphe-unifie-harness.md) et la [relecture des composants SpikyPanda](relecture-spikypanda-et-reutilisation.md). Les précisions de l'utilisateur priment sur les hypothèses des notes antérieures.

## 2. Architecture proposée

Le harness est un espace de graphe composable avec ses runtimes. Un agent est une activité de parcours, avec sa session et son contexte. Les rôles cognitifs sont des régions du même graphe. La connaissance et le graphe physique restent des domaines parcourus par des runtimes spécialisés dans cet espace.

Le moteur interprète les relations : transmission en série, création de session enfant, attente de résultats, reprise et annulation. Aucun runner ne doit reconstruire ce flow dans une boucle métier distincte. Un resolver exécute une opération locale et publie ses sorties ; il ne choisit pas lui-même les étapes suivantes hors des relations déclarées.

Le transport MCP, les modèles et le stockage sont des capacités rattachées à la session. Un slot reasoner mobilise un modèle et maintient son contexte local. Il n'a pas la responsabilité de parcourir le harness ou de choisir ses agents.

Le broker est une dépendance structurelle obligatoire : discovery, routage des slots, identité d'appel et autorisations passent par lui. `IHarnessRuntimeOptions.broker` et `IRuntimeAttachments.broker` sont requis et utilisent le client natif `McpClient` de `@cyanmycelium/mcp-core/client`. Sans connexion au broker, aucune nouvelle activation qui en dépend ne doit démarrer ; une perte de connexion produit une attente ou un échec explicite des activités concernées. Les calculs locaux déjà actifs suivent leur contrat d'annulation et de continuation.

Toutes les interfaces du nouveau code suivent la convention `IXxxxxx`. L'archive est conservée sans réécriture.

Le fonctionnement standard poursuit toutes les activités activables. Le debug suspend ou observe le même runtime, avec les mêmes relations et contextes.

## 3. Arborescence de départ

```text
src/
  contracts/
    graph.ts                 définition de contrôle du graphe et des besoins
    runtime.ts               événements, corrélations et contexte de session
    discovery.ts             types et opérations natifs du broker
    factory.ts               contrat de création des nœuds et liens
  graphs/
    reference.json           source de la topologie dépliée
    reference.ts             point de chargement, sans topologie codée
  graph/
    load.ts                  admission et matérialisation native Core
    nodes.ts                 HarnessGraphNode hérite de RuntimeNode
    links.ts                 HarnessLink hérite de Channel
    factory.ts               implémentation de proposition choisie par l'hôte
  slots/
    reasoner/
      contracts.ts           sessions du slot et interface interne de stockage
scripts/
  inspect-proposal.mjs        contrôle structurel de la topologie proposée
doc/
  proposition-implementation-harness.md
archive/
  exploration-2026-10-10/
```

Étapes suivantes proposées : les sessions spécialisées de Core, `src/resolvers/` pour les opérations locales, `src/broker/` pour l'utilisation du client MCP natif et du contrat du broker, et des adaptateurs de modèle et stockage dans `src/slots/reasoner/`. Ces dossiers seront créés au moment de leur implémentation.

## 4. Graphe à contrôler

`src/graphs/reference.json` définit les nœuds et les liens typés. `src/graphs/reference.ts` charge ce document, sans reconstruire son flow en TypeScript. Le motif cognitif est déplié pour chaque rôle. Il sert de première proposition commune, à spécialiser d'après les contrats de chaque rôle lors de la reprise.

La construction est appelée par `buildReferenceGraph(factory: IHarnessGraphFactory)`. Cette factory fournit les registres natifs `INodeRegistry` et `ILinkRegistry`. Les deux sortes d'objets sont créées par leur `typeId`, restaurées avec `deserialize`, puis reliées par `materializeSubGraphInto` de Core et son `RuntimeGraphBuilder`. Aucun constructeur concret du harness n'est imposé dans la topologie. Les collections appartiennent à chaque appel et aucun graphe n'est construit à l'import du module.

Le script de contrôle fournit explicitement `new HarnessGraphFactory()`, qui utilise les classes de proposition. Un hôte opérationnel fournira sa propre factory. Les essais de construction vérifient que ses classes remplacent tous les nœuds et liens et que deux graphes construits avec la même factory ne partagent pas leurs objets de topologie.

La [source JSON](../src/graphs/reference.json) contient 302 nœuds, 384 liaisons, 11 entrées et 25 régions. On la modifie directement, puis on la contrôle avec `npm run build:proposal` et `npm run inspect:proposal`. Il n'existe plus d'export de topologie dérivé de fonctions métier.

| Région | Responsabilité représentée |
| --- | --- |
| Entrées | Question, procédure, alarme, télémétrie, équipement découvert, réponse externe, autorisation, résultat asynchrone, échéance, invalidation, annulation |
| Admission et corrélation | Vérifier l'événement et le rattacher à une activité nouvelle ou existante |
| Exploitation | Recevoir les événements d'exploitation, orienter la qualification d'équipement |
| Qualification et observation | Construire la demande d'essais et ses observations |
| Préparation initiale | Produire un contexte de sollicitation suffisant |
| Connaissance, simulation et branche indépendante | Trois sessions enfant, dont les résultats sont réunis selon leurs corrélations |
| Agent central | Proposer une résolution, garder sa session reasoner pendant les corrections |
| Analyse et contradiction | Deux sessions enfant produisant des diagnostics pour un verdict |
| Préparation corrective | Corriger le contexte et produire une nouvelle tentative avec de nouvelles preuves |
| Construction | Observation, graphe, code, procédure, modèle, conduite, diagnostic, réflexion, recommandation |
| Retour | Réponse ou état corrélé au demandeur |

Le motif cognitif déplie : observation, contexte, mémoire, applicabilité, préparation du prompt, acquisition de session reasoner, mise à jour, appel, sélection, autorité, exécution, observation des effets, évaluation, conservation, fermeture et enregistrement. La réutilisation d'une expérience peut contourner l'appel LLM. Une région déterministe peut remplacer les étapes cognitives inutiles par ses propres nœuds.

Les frontières `knowledge.runtime` et `simulation.runtime` représentent le raccordement à des graphes spécialisés, pas une procédure opaque. Leur topologie interne devra être attachée et inspectable dans le même espace. Elle n'a pas été recopiée dans cette première définition de contrôle.

La topologie de référence couvre les rôles et un scénario de bout en bout. Elle ne constitue pas encore le graphe complet de production : l'enveloppe des ports, les projections de contexte, les contrats des artefacts, les parcours d'effets autorisés, les erreurs, les raccordements internes connaissance/physique et les conditions de chaque route restent à formaliser. Les sorties `refused`, `denied` et `abort` rendent déjà visibles les arrêts explicitement représentés.

La simulation est ici obligatoire pour le scénario de contrôle. Les scénarios sans simulation utiliseront une topologie dont la réunion exige uniquement les branches effectivement ouvertes. Une dépendance conditionnelle ne doit pas créer une attente sur une branche absente.

## 5. Spécialisations de Core

Le métamodèle de graphe et d'exécution est fourni par `@spiky-panda/core`. Les contrats génériques locaux `IGraphNode`, `IGraphLink` et `IGraphDefinition` sont supprimés.

```typescript
interface IHarnessGraphNode extends IRuntimeNode { /* informations du harness */ }
interface IHarnessLink extends IChannel { /* passage de contexte */ }
interface IHarnessGraph extends IRuntimeGraph<IHarnessGraphNode, IHarnessLink> {
  readonly version: string;
  readonly entries: Readonly<Record<TriggerKind, string>>;
}
```

Les informations ajoutées au nœud sont son rôle, son resolver, ses besoins de capacités, sa configuration et sa politique d'activation. Les ports utilisent `IPortDescriptor` de Core. Le lien ajoute le mode de passage entre sessions et la politique de contexte ; ses extrémités `oini`/`ofin` et ses ports `slot`/`toSlot` sont ceux du channel natif, sans champs `from`/`to` concurrents.

Les classes `HarnessGraphNode` et `HarnessLink` héritent respectivement de `RuntimeNode` et `Channel`. Le builder de Core construit le graphe dynamique et les channels sont attachés au routage natif des nœuds. `IHarnessGraph` spécialise le contrat du graphe avec sa version et ses points d'entrée, portés directement par l'instance Core. Le type alias `HarnessGraph` et le wrapper `referenceDefinition` sont supprimés.

Une classe `HarnessGraph` héritant de `RuntimeGraph` pourra matérialiser ce contrat si des comportements propres au harness deviennent nécessaires. Pour cette proposition, l'interface suffit : la construction ajoute les métadonnées à l'instance native sans introduire de nouveau runtime.

Le JSON contient les `typeId` et les données sérialisables des nœuds et des liens, avec les extrémités et ports natifs. Les champs spécialisés utilisent `@cloneable` de Core. Les métadonnées propres au harness sont dans l'enveloppe `harness`. Le chargeur refuse les types inconnus, les extrémités absentes et les ports non déclarés ; il refuse également toute matérialisation partielle signalée par Core.

Le chemin documentaire général `parseDocument` / `instantiateDocument` accepte actuellement le format v3. Le chemin de matérialisation utilisé ici prend déjà en charge les liens typés et leurs données, conformément à la direction v4 décrite dans l'ADR-001. Cette différence est documentée dans la relecture ; la compatibilité avec toute la chaîne documentaire et l'éditeur n'est pas encore acquise.

Le type générique `harness.node` restaure ses ports depuis le document ; les métadonnées de son registre sont encore vides. Les types opérationnels devront déclarer leurs signatures et ports dans le registre pour bénéficier de la validation documentaire et du catalogue de l'éditeur. Cette proposition ne constitue donc pas encore un plugin industrialisé.

Les resolvers et les comportements `each-message`, `spawn`, `result` et de réunion corrélée restent à implémenter dans les spécialisations des runtimes et sessions de Core. Les nœuds de proposition refusent explicitement leur exécution tant que les resolvers sont absents. Si Core ne possède pas une primitive nécessaire, une extension localisée de ses sessions ou de son runtime sera proposée et vérifiée avant d'implémenter une orchestration ailleurs.

Audit nécessaire :

1. Activation par disponibilité des ports et corrélation des tentatives.
2. Création de session enfant avec projection de contexte et identité de branche.
3. Publication d'un résultat vers la session parente, sans réinitialiser son contexte.
4. Attente locale et reprise après résultat externe ou reconnexion.
5. Annulation, fermeture, propagation des erreurs et traitement des retours tardifs.
6. Concurrence réelle : un solveur synchrone doit être isolé dans un worker ou un service adapté s'il bloque le thread.

La base éprouvée fournit le flow V1, les gardes, les évaluateurs et la conduite des constructions. Le code exploratoire fournit des pistes d'apprentissage. Leur reprise se fait opération par opération et relation par relation, sans réimporter un runner applicatif complet.

## 6. Contextes et concurrence

Chaque message porte `eventId`, `runId`, `attemptId`, `sessionId`, `branchId`, version du graphe et version du contexte. Une session enfant possède sa propre identité et une référence à sa session parente. La projection de contexte est explicite et ne partage pas implicitement un objet mutable entre branches.

Une réunion associe les résultats au run, à la tentative et à la session parente attendus. Elle connaît les branches exigées et leur état terminal. Un échec doit pouvoir satisfaire une dépendance comme résultat d'échec, puis activer une route de traitement ; il ne doit pas laisser une attente permanente.

Les poignées vivantes, connexions, solveurs et signaux d'annulation restent dans les attachements de la session. Les données sérialisables restent dans son contexte. `ISessionContext` ne prétend pas sauvegarder tout le runtime : une reprise durable du parcours doit aussi préserver les activations en attente, les branches, les receipts d'effets et les versions.

La redélivrance d'un événement ou la reprise d'un appel ne doit pas rejouer aveuglément un effet externe. L'identité d'opération, le receipt et le comportement de la capacité doivent définir ce qui est vérifiable ou répétable. Un résultat d'une ancienne tentative reste traçable et ne satisfait pas une attente plus récente.

## 7. Slot reasoner avec état

Surface cible : `open`, `update`, `call`, `checkpoint`, `restore`, `close`. Les outils MCP actuels ne sont pas renommés ni remplacés à ce stade.

`ensure-session` est un resolver du graphe : il appelle `open` seulement si la session runtime ne porte pas déjà une référence compatible. Les corrections réutilisent la session centrale et passent par `update`. Chaque appel précise la version attendue ; le slot sérialise les modifications d'une même session et renvoie sa nouvelle version.

Le contexte local comprend les données de rôle, observations, hypothèses, références et l'état conversationnel de l'adaptateur. Chaque mise à jour précise ce qu'elle remplace ou invalide. La rétention locale évite de retransmettre systématiquement les données entre harness et slot ; l'économie d'envoi au fournisseur du modèle dépend de son API.

Un snapshot porte son format, son identifiant, la version de session, le profil et la version du format de l'adaptateur. Il exclut clés API, handles et droits réutilisables. À la restauration, les capacités sont redécouvertes, les droits revérifiés et la compatibilité du profil et de l'adaptateur est contrôlée. Restaurer le reasoner ne restaure pas automatiquement le parcours du runtime.

`close` libère la session active. L'effacement d'une sauvegarde est une opération distincte. La fermeture de région ne ferme pas arbitrairement les reasoners appartenant à d'autres sessions.

## 8. Où vit IReasonerSessionStore

L'interface est dans `src/slots/reasoner/contracts.ts`. Son instance appartient au service reasoner. Le runtime fournit les bindings de stockage et la politique de conservation propres à la session ; les données sont adressées par namespace, identité de session et version.

| Adaptateur proposé | Usage |
| --- | --- |
| CacheSessionStore | Sauvegarde JSON via `ICacheStore` ou `CacheSlotStore`, avec TTL et propriétés du backend vérifiées |
| HistorySessionStore | Instantanés JSON via `IHistoryStore` ou `HistorySlotStore`, lus en données brutes |
| HistoryReasonerJournal | Événements ordonnés et identifiés, avec sémantique de reconstruction explicite |
| Conservation combinée | History comme référence conservée, cache comme accélérateur de reprise |

Les contrats actuels `cache.v1` et `history.v1` existent. L'histoire temporelle de mesures ne définit pas à elle seule une session conversationnelle : l'adaptateur doit fixer les identifiants, séquences, versions et règles d'idempotence.

La sauvegarde n'est acquittée que selon les garanties réelles du stockage choisi. En mode combiné, l'écriture de référence est acquittée avant la mise à jour du cache ; une panne du cache ne doit pas masquer un snapshot durable.

Le paramètre `expectedVersion` de l'interface proposée exige une règle de propriétaire unique ou un mécanisme conditionnel du backend. Le cache actuel ne fournit pas automatiquement une transaction de comparaison et écriture. L'implémentation initiale devra donc imposer un seul writer par session et refuser les reprises concurrentes ; une garantie entre plusieurs instances demandera un mécanisme supplémentaire validé. Ce point reste à contrôler avant implémentation.

## 9. Déclaration et discovery

Le graphe exprime le besoin de capacité et la politique de conservation. Le slot reasoner décrit son contrat de session et les formats sauvegardables. Le runtime résout les besoins et porte les références. Les fournisseurs cache/history décrivent leurs propriétés. Le broker obligatoire assure le catalogue, le routage et les autorisations.

Le contrat de discovery est celui du broker. `src/contracts/discovery.ts` réexporte `IBrokerProviderInfo` et `IBrokerContext` depuis son paquet public et référence ses opérations natives. Aucun `ICapabilityDiscovery`, `ISlotDescription` ou `ICatalogSnapshot` propre au harness n'est conservé.

Séquence proposée : connecter le client MCP natif au slot `_broker` sous l'identité du harness, installer le callback `onResourceUpdated` et l'abonnement `subscribeResource("broker://providers")`, puis lire l'état initial avec `providers_list` ou `readResource("broker://providers")`. Le résultat conserve l'enveloppe native `{ count, providers }` et les éléments `IBrokerProviderInfo`. `provider_status({ name })` fournit l'état détaillé d'un slot. Une notification `notifications/resources/updated` déclenche une nouvelle lecture ; une reconnexion réinstalle les abonnements et relit l'état. La ressource d'un slot utilise son nom encodé dans `broker://providers/<name>`.

Pour découvrir les opérations, ouvrir le client MCP du slot candidat à travers le broker et utiliser son `listTools()` natif. La compatibilité de session, de cache ou d'historique est ensuite vérifiée avec les outils descriptifs du fournisseur. Les besoins du graphe ne remplacent pas le catalogue du broker. Un compteur interne peut prévenir une course entre lecture initiale et notification ; il ne devient pas une révision du protocole de discovery.

`providers_list` inclut les slots déconnectés : leur présence ne prouve pas leur disponibilité. L'apparition d'un fournisseur enrichit le catalogue, sans migrer les sessions existantes. Une disparition active une route d'attente, de reprise ou d'échec suivant le contrat du graphe.

La déclaration d'autorisation actuelle du broker ne contient pas de manifeste `requires`. Les dépendances restent donc dans le graphe et dans une description explicite du reasoner. Cette différence concerne l'expression des besoins, pas la discovery, qui reste native. Le binding du runtime conserve `name` et `connectedSince` du provider sélectionné pour détecter un changement de connexion ; il n'invente pas de `catalogRevision`. Cet horodatage identifie une connexion, pas une version de contrat ni une autorisation durable.

Le bootstrap de transport est une responsabilité de l'hôte et exige un broker connecté. Les choix de rattachement et les réactions métier à la disponibilité restent des opérations du graphe. Les noms `solver.v1`, `knowledge-graph.v1` et `reasoner-session.v1` dans la topologie sont des contrats cibles proposés ; ils ne prétendent pas exister dans le catalogue actuel. Les besoins de stockage et les politiques de rétention seront attachés aux régions lors de la spécialisation du graphe.

La dépendance de développement est liée au paquet local `../mcp-broker/node/packages/broker`, dont les exports publics sont utilisés sans copier ses interfaces. Une future distribution utilisera une version publiée compatible. Le contrat `IBrokerContext` est utile pour une intégration embarquée au broker ; un harness distant utilise la surface MCP, sans accès direct à l'état interne du serveur.

## 10. Ordre d'implémentation et critères de contrôle

| Lot | Livrable | Critère de contrôle |
| --- | --- | --- |
| 0, présent | Archive, contrats et topologie | Sources préservées, types compilables, ports et régions inspectables |
| 1 | Audit et spécialisations des sessions/runtime Core | Une seule topologie native ; états dans les sessions |
| 2 | Événements, série, fork et join | Simulation, connaissance et branche indépendante progressent réellement ; aucun mélange de tentative |
| 3 | Reasoner avec sessions et adaptateur modèle initial | Deux appels utilisent un contexte local mis à jour ; correction sans perte de la session centrale |
| 4 | Discovery et stockage | Rattachement initial, notifications, reconnexion et reprise par checkpoint |
| 5 | Reprise des rôles éprouvés | Exploitation, qualification, neuf spécialités, analyse et contradiction reliées dans le graphe |
| 6 | Apprentissage | Évolution proposée du graphe, évaluée et admise avec provenance |

Les lots 1 à 6 restent à implémenter. Les contrôles du lot 0 ne remplacent pas leurs essais d'exécution.

Validation du lot 0 : compilation TypeScript, instances natives `RuntimeGraph`/`RuntimeNode`/`Channel`, identifiants de nœuds uniques, existence des ports reliés, attachment des channels au routage Core, producteurs présents pour les entrées des réunions et accessibilité de tous les nœuds depuis les entrées. Cinq tests vérifient la substitution symétrique des classes, la restauration des données JSON, le refus d'un type de lien inconnu, le refus d'extrémités ou ports absents et l'indépendance de deux constructions. Ces vérifications sont structurelles ; elles ne valident pas les schémas de données des ports, les conditions de routage ni la progression à l'exécution.

Le premier scénario exécuté devra recevoir une question, préparer son contexte, lancer une recherche et une simulation en parallèle, poursuivre une observation indépendante, réunir les preuves, analyser et contredire une proposition, puis corriger ou répondre. Une alarme pendant la simulation devra activer l'exploitation sans attendre la fin du calcul. Une découverte d'équipement devra passer par l'exploitation avant qualification.

Les vérifications de reprise couvriront expiration du cache, stockage indisponible obligatoire ou facultatif, snapshot incompatible, redélivrance, résultat tardif et fermeture sans effacement. Les garanties de concurrence et d'idempotence seront testées sur les vrais adaptateurs, pas seulement sur des mocks.

## 11. Décisions à contrôler avant d'implémenter le moteur

1. La définition proposée se raccorde-t-elle directement aux primitives Core, ou certaines extensions sont-elles nécessaires ?
2. Quel contrat de ports et quelles projections de contexte chaque rôle exige-t-il ?
3. Quelles régions peuvent partager une session reasoner, et lesquelles exigent une isolation ?
4. Quels snapshots doivent être conservés et avec quel backend, TTL et niveau de garantie ?
5. La première version impose-t-elle un propriétaire unique de session, avant la reprise multi-instance ?

Ces points sont visibles ici pour permettre le contrôle de la proposition. Aucun choix non confirmé n'est présenté comme une fonctionnalité existante.
