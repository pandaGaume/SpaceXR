# Instructions du dépôt

- Ne jamais utiliser le caractère U+2014 dans les nouveaux fichiers ou les réponses.
- Toutes les interfaces commencent par `I`, suivi d'un nom en PascalCase, par exemple `IReasonerSessionStore`.
- Le broker est une dépendance obligatoire du harness. Réutiliser ses contrats publics de discovery, de routage et d'autorisation ; ne pas créer de catalogue ou de protocole de discovery parallèle.
- Le harness est le graphe avec ses runtimes. Les contextes et l'état d'exécution appartiennent aux sessions ; l'orchestration est exprimée par les relations du graphe.
- Réutiliser les primitives de SpikyPanda Core. `IHarnessGraphNode` spécialise `IRuntimeNode`, `IHarnessLink` spécialise `IChannel` ; les classes héritent de `RuntimeNode` et `Channel`. Le graphe est construit avec `RuntimeGraphBuilder`, sans redéfinir des contrats génériques de graphe.
- Le graphe spécialisé est déclaré par `IHarnessGraph extends IRuntimeGraph<IHarnessGraphNode, IHarnessLink>`. Ses métadonnées sont portées par l'instance Core ; une classe spécialisée devra hériter de `RuntimeGraph` si un comportement propre au harness la justifie.
- La construction d'une topologie reçoit une factory explicite. Elle ne fixe pas les constructeurs des nœuds ou liens ; chaque construction possède ses propres collections, sans graphe singleton créé à l'import.
- Définir les topologies en JSON. Utiliser les registres natifs `INodeRegistry` et `ILinkRegistry` et la matérialisation de Core pour créer et restaurer les nœuds et liens de la même manière. Ne pas reconstruire la topologie dans du code métier.
- Avant d'ajouter un sous-système, consulter `doc/relecture-spikypanda-et-reutilisation.md` et vérifier les exports et les implémentations de SpikyPanda concernés. Réutiliser les mécanismes existants et documenter les écarts de contrat effectivement constatés.
- Préserver l'archive exploratoire sans réécrire ses sources.
- Respecter `doc/brief-graphe-heterogene-et-execution-distribuee.md` : imbrication logique, contexte d'exécution et placement sont indépendants. Un passage vers un domaine ou un dispositif distant peut se faire par un lien ; il n'impose pas un sous-graphe ni une session enfant. Le typage actuel des propositions devra évoluer pour accueillir les domaines natifs hétérogènes.
- Distinguer explicitement les contrats proposés des fonctionnalités effectivement implémentées et vérifiées.
