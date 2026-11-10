# Harness industriel

Cette base contient un **premier graphe de décision exécutable**, construit et exécuté par SpikyPanda Core. Le grand graphe industriel de référence reste une proposition ; ses résolveurs ne sont pas tous implémentés.

Le [graphe de décision](src/graphs/decision.json) relie boucle, branchements, raisonneur et actions MCP dans une même topologie. Les agents sont des sessions distinctes parcourant les mêmes nœuds, avec leurs propres données, services et connexions. Le seul moteur utilisé est le runtime de graphe Core, y compris pour les boucles asynchrones. Aucun contrôleur de mission externe ne déroule les étapes.

Voir la [reprise architecturale et le mode d'emploi](doc/graphe-decision-executable.md) pour les contrats, les tests et les limites de ce premier lot. L'apprentissage topologique archivé reste exploratoire, hors du chemin nominal.

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

Après installation des dépendances de développement, `npm run check` vérifie les contrats TypeScript. `npm run build` compile dans `dist/` ; `build:proposal` reste disponible pour compatibilité. `npm run inspect:proposal` résume le grand graphe de référence. `npm test` vérifie chargement, exécution cyclique, isolation des sessions et échanges MCP. Un test démarre un broker réel sur une adresse locale avec des identités de test ; aucun modèle distant, recherche web ou équipement matériel n'est appelé.

Le graphe est une instance native `RuntimeGraph`, construite avec les mécanismes de Core. `IHarnessGraph` étend `IRuntimeGraph` avec sa version et ses points d'entrée. `IHarnessGraphNode` étend `IRuntimeNode` et `IHarnessLink` étend `IChannel`. Les classes concrètes héritent de `RuntimeNode` et `Channel`. Les nœuds `DecisionNode` sont exécutables dans une `DecisionSession`. Les nœuds génériques de la grande proposition continuent à signaler explicitement l'absence de leurs résolveurs.

Pour ce workspace de développement, la dépendance broker pointe vers le paquet du dépôt voisin `../mcp-broker/node/packages/broker`. Cela permet de contrôler les contrats réellement construits dans ce dépôt. Une distribution future devra référencer une version publiée compatible.

La dépendance SpikyPanda Core utilise le paquet local `../../spikypanda/packages/dev/core`, déjà employé par le prototype. Le JSON est la source de la topologie ; `materializeSubGraphInto` de Core assure création, désérialisation et câblage natif, en utilisant son builder.

La topologie expose `buildReferenceGraph(factory: IHarnessGraphFactory)`. L'hôte fournit les registres natifs `INodeRegistry` et `ILinkRegistry`, qui créent symétriquement nœuds et liens par `typeId`. Le script d'inspection choisit `HarnessGraphFactory` ; la définition du graphe n'importe aucun constructeur concret du harness et ne crée pas de singleton à l'import.
