# Harness industriel

Cette base contient une **proposition d'implémentation à contrôler**, pas un moteur opérationnel.

Le harness est le graphe avec ses runtimes. Les sessions portent les contextes. L'ordre, les branches, les attentes et les reprises sont définis par les relations du graphe.

Le broker est une dépendance obligatoire. La discovery utilise son contrat natif et les types publics de `@cyanmycelium/mcp-broker`. Le client MCP natif est requis dans les options du runtime et les attachements de session. Toute interface du harness commence par `I`.

- [Proposition et étapes d'implémentation](doc/proposition-implementation-harness.md)
- [Fondements](doc/fondements-harness-industriel.md)
- [Décisions : graphe hétérogène, transitions de contexte et exécution distribuée](doc/brief-graphe-heterogene-et-execution-distribuee.md)
- [Vérification ONNX Transformer et corrections pour LLMLingua-2](doc/verification-onnx-transformer-llmlingua2.md)
- [Validation du modèle LLMLingua-2 complet, export et résultats](LLMLingua2/README.md)
- [Représentation d'ensemble](doc/representation-graphe-unifie-harness.md)
- [Relecture de SpikyPanda et composants à réutiliser](doc/relecture-spikypanda-et-reutilisation.md)
- [Définition JSON du graphe](src/graphs/reference.json) et [chargement](src/graphs/reference.ts)
- [Contrats du graphe](src/contracts/graph.ts), [sessions runtime](src/contracts/runtime.ts), [discovery](src/contracts/discovery.ts)
- [Nœuds spécialisés Core](src/graph/nodes.ts) et [channels spécialisés Core](src/graph/links.ts)
- [Contrat de factory](src/contracts/factory.ts) et [factory de proposition](src/graph/factory.ts)
- [Contrats du slot reasoner et de son stockage](src/slots/reasoner/contracts.ts)

Le prototype précédent est conservé dans `archive/exploration-2026-10-10/`, avec ses modifications locales, ses tests et ses documents. Son `manifest.json` inventorie les fichiers source et leurs empreintes. Les documents industriels dans `doc/` restent la référence active.

## Vérification

Après installation des dépendances de développement, `npm run check` vérifie les contrats TypeScript. `npm run build:proposal` compile la proposition dans `dist/`, puis `npm run inspect:proposal` vérifie et résume la topologie chargée depuis le JSON. `npm test` contrôle les registres, la restauration et le refus des définitions incomplètes. Ces commandes ne lancent aucun agent ni appel externe.

Le graphe est une instance native `RuntimeGraph`, construite avec `RuntimeGraphBuilder`. `IHarnessGraph` étend `IRuntimeGraph` avec sa version et ses points d'entrée. `IHarnessGraphNode` étend `IRuntimeNode` et `IHarnessLink` étend `IChannel`. Les classes concrètes héritent de `RuntimeNode` et `Channel`. Les resolvers métier, le raccordement des sessions et le stockage restent à implémenter ; les nœuds signalent explicitement cette absence si on tente de les exécuter.

Pour ce workspace de développement, la dépendance broker pointe vers le paquet du dépôt voisin `../mcp-broker/node/packages/broker`. Cela permet de contrôler les contrats réellement construits dans ce dépôt. Une distribution future devra référencer une version publiée compatible.

La dépendance SpikyPanda Core utilise le paquet local `../../spikypanda/packages/dev/core`, déjà employé par le prototype. Le JSON est la source de la topologie ; `materializeSubGraphInto` de Core assure création, désérialisation et câblage natif, en utilisant son builder.

La topologie expose `buildReferenceGraph(factory: IHarnessGraphFactory)`. L'hôte fournit les registres natifs `INodeRegistry` et `ILinkRegistry`, qui créent symétriquement nœuds et liens par `typeId`. Le script d'inspection choisit `HarnessGraphFactory` ; la définition du graphe n'importe aucun constructeur concret du harness et ne crée pas de singleton à l'import.
