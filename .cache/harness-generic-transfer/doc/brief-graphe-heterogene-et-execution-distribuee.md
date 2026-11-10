# Brief d'architecture : graphe hétérogène et exécution distribuée

Date : 10 octobre 2026.

Statut : décisions de principe retenues dans la conversation. Les mécanismes détaillés et leur implémentation restent à définir et vérifier dans Core.

Ce brief précise les [fondements du harness](fondements-harness-industriel.md) et la [proposition d'implémentation](proposition-implementation-harness.md). Pour le passage entre domaines, il corrige l'interprétation qui assimilait systématiquement le lancement d'une simulation à l'exécution d'un sous-graphe encapsulé dans un nœud.

## 1. Le harness est un graphe étendu hétérogène

Le harness est le graphe avec ses runtimes. Les domaines de raisonnement, connaissance, procédure, physique, simulation et apprentissage appartiennent au même espace logique de graphe. Les relations définissent le parcours et l'orchestration.

Un runtime peut emprunter un lien depuis un nœud du harness vers un nœud du domaine physique et poursuivre le parcours avec le contexte et les capacités adaptés. Une simulation peut donc être une branche de ce graphe continu. Elle n'a pas à être représentée exclusivement comme une opération opaque exécutée à l'intérieur d'un nœud.

Les sessions portent les contextes et l'état d'exécution. Un agent désigne une activité de parcours avec sa session ; il peut mobiliser un LLM, un solveur, un parcours de connaissance ou des opérations déterministes.

## 2. Trois dimensions indépendantes

| Dimension | Question traitée | Décision |
| --- | --- | --- |
| Imbrication logique | Comment représente-t-on et détaille-t-on le graphe ? | Un nœud peut exposer un graphe au niveau de détail suivant |
| Contexte d'exécution | Avec quelle session, quelles données et quelles capacités avance-t-on ? | Une transition peut conserver le contexte, le changer ou ouvrir une session enfant |
| Placement | Où le parcours s'exécute-t-il ? | Une branche peut s'exécuter localement ou sur un dispositif distant |

L'imbrication reste une abstraction logique possible. Entrer dans un graphe imbriqué n'impose pas automatiquement un changement de contexte ou une nouvelle session. Inversement, changer de contexte n'exige pas de créer un niveau d'imbrication.

Franchir une liaison distante n'impose pas non plus une session enfant. La transition de contexte et le placement doivent être décrits séparément. Les garanties d'un contexte distribué restent à préciser avant implémentation.

## 3. Le lien est une frontière de transition possible

Le lien relie les ports de nœuds dans l'espace logique du graphe. Il peut déclarer les conditions du passage : données transmises, projection du contexte, contexte cible et capacités requises. Il peut également être réalisé par une passerelle distante.

Le lien porte la déclaration de transition. Le runtime la réalise dans ses sessions. Le transport assure la livraison entre les lieux d'exécution. Les responsabilités détaillées seront fixées à partir des primitives Core existantes ; le lien ne doit pas devenir un ordonnanceur autonome qui reconstruit un flow métier.

Le changement de domaine et l'ouverture d'une branche sont deux décisions distinctes. Un parcours peut continuer dans un autre domaine. Une bifurcation peut aussi ouvrir une session enfant autonome pendant que les autres parcours progressent.

```text
                              lien de transition
nœud du harness --------------------------------------> nœud physique
                         contexte et placement                |
                                                              v
                                                     autres nœuds physiques
                                                              |
                              lien de résultat                 |
nœud de réunion <---------------------------------------------+
```

Ce schéma représente une continuité logique. Il ne prescrit ni un conteneur de simulation, ni une pile d'appels synchrone, ni un transport particulier.

## 4. Passage vers une simulation

Lorsqu'un parcours atteint une transition vers le domaine simulation, le runtime résout le contexte nécessaire et rattache les capacités de calcul adaptées. Si la relation ouvre une branche, une session enfant devient l'activité de simulation jusqu'à sa terminaison. Les autres activités du harness peuvent continuer.

Les conditions initiales, paramètres, références de modèle, horizon et critères de terminaison sont des données de contexte. Les solveurs et autres ressources vivantes sont des attachements du runtime concerné.

La portée du solveur doit être identifiable dans le graphe : nœuds physiques et relations qu'il prend en charge. Cette portée ne doit pas dépendre exclusivement de la présence d'un conteneur de sous-graphe. Les fonctions d'attachement et registres de solveurs existants doivent être réutilisés ou étendus de façon localisée si leur portée actuelle ne suffit pas.

Le temps physique de simulation et le temps des événements du harness ont des responsabilités distinctes. Leur coordination doit être explicite. Une attente de résultat bloque les activations qui dépendent de ce résultat, sans suspendre toutes les activités indépendantes.

Les sorties, erreurs et états terminaux reviennent par des relations déclarées dans le graphe. Leur corrélation permet de rattacher chaque retour à la session, la branche et la tentative attendues.

## 5. Les liens peuvent être des passerelles distantes

Une branche peut s'exécuter sur un autre hôte, un service ou un dispositif embarqué, par exemple un ESP32. Elle reste une branche du même graphe logique. Les nœuds distants disposent de leurs capacités locales et publient leurs sorties par les relations du graphe.

Le transport distant transmet des données et des références de contexte sérialisables. Les objets vivants du runtime source, connexions, solveurs et handles, ne sont pas transférés comme s'il s'agissait de données ordinaires. Le runtime destinataire rattache les capacités nécessaires selon ses propres ressources et droits.

Le placement ne modifie pas implicitement le flow. Les différences de transport, latence et disponibilité exigent cependant une sémantique observable de livraison et de reprise. Il ne faut pas prétendre qu'un passage distant possède automatiquement les mêmes garanties qu'un passage local.

Le broker reste une dépendance structurelle du harness. Discovery, routage des capacités et autorisations réutilisent ses contrats publics. Le protocole de passerelle, l'intégration d'un dispositif embarqué et la possibilité d'utiliser un transport adapté derrière cette intégration restent à concevoir. Ce brief ne décide pas d'un protocole réseau particulier.

## 6. Conséquences pour Core et les contrats du harness

Le socle reste celui de SpikyPanda Core : nœuds, liens, graphes, builders, registres et sessions natifs. Les topologies sont définies en JSON ; les nœuds et liens sont créés symétriquement par leurs registres.

Le graphe étendu doit pouvoir accueillir les types natifs des différents domaines. Un nœud physique ne doit pas être contraint d'adopter les champs d'un nœud cognitif du harness. Les spécialisations `IHarnessGraphNode` et `IHarnessLink` restent utiles pour les éléments concernés ; la portée du typage actuel de `IHarnessGraph` devra être revue en conséquence, sans dupliquer le métamodèle Core.

La composition native de `RuntimeGraph` offre une représentation imbriquée utile, mais elle ne constitue pas à elle seule la transition de contexte recherchée. Son appel d'une session interne et l'attente de son exécution ne doivent pas être confondus avec une branche autonome du graphe étendu.

La prochaine analyse de Core doit donc porter sur le franchissement des liens, l'adressage des nœuds, les transitions de contexte, la gestion des sessions actives et le placement. Elle doit s'appuyer sur la [carte de réutilisation](relecture-spikypanda-et-reutilisation.md) avant d'introduire de nouvelles primitives.

## 7. Points restant à spécifier

Ces points sont des travaux de conception, pas des décisions déjà implémentées :

- Représentation JSON de la transition, de la portée de contexte et du placement ; distinction entre données requises et capacités à rattacher.
- Identité et version des nœuds, graphes, sessions, branches et tentatives traversant une passerelle.
- Sémantique de livraison : ordre, acquittement, doublons, saturation, interruption et reconnexion. Aucune garantie de livraison exactement une fois n'est présumée.
- Propriété et synchronisation d'un contexte lorsque son exécution se répartit entre plusieurs dispositifs.
- Cycle de vie : ouverture, progression, suspension, retour, annulation, fermeture et traitement des résultats tardifs.
- Portée des solveurs, horloges et budgets d'exécution ; compatibilité des capacités avec les ressources d'un dispositif embarqué.
- Intégration au broker et restauration des activités sans rejouer aveuglément leurs effets.

## 8. Scénarios de validation attendus

1. Un lien entre deux domaines au même niveau fait évoluer le contexte sans imposer un sous-graphe.
2. Un graphe imbriqué est parcouru sans imposer une nouvelle session du seul fait de son imbrication.
3. Une branche de simulation ouvre une session autonome ; une alarme active l'exploitation pendant sa progression.
4. Le résultat de simulation rejoint la bonne attente ; un résultat d'une ancienne tentative ne satisfait pas une tentative nouvelle.
5. Une branche placée sur un dispositif distant publie ses sorties dans le même flow logique ; une interruption produit un état explicite selon son contrat.
6. Deux activités sur une même topologie conservent leurs états, contextes et attachements isolés selon les règles déclarées.

Ces scénarios devront vérifier le comportement du runtime et des transports réels. Le présent changement consigne les décisions d'architecture ; il n'implémente aucune passerelle, migration de contexte ou exécution distante.
