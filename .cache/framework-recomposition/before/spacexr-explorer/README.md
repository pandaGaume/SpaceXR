# SpaceXR Explorer

API applicative d'une session Explorer, exposée en MCP avec `@cyanmycelium/mcp-core` et publiée dans un slot avec `@cyanmycelium/mcp-broker-provider`.

## Scène Soleil, Terre, Lune et Mars

Mars dispose d'un fond global MOLA 16 pixels/degré et de raffinements CTX/HiRISE à Jezero, servis sur le même port 8794. Pour vérifier le relief hors de Jezero, ouvrir `/?manifest=/worlds/mars-global.json`. Les détails globaux restent limités à la résolution MOLA, environ 3,7 km.

Le chargeur de manifeste JSON et la démonstration graphique sont disponibles. Lancer `npm run dev`, puis ouvrir l’adresse affichée. Le monde utilise celestial-core, Babylon et les primitives géospatiales existantes. Voir [le contrat du manifeste, les repères et les limites](docs/world-loader.md). Les changements inertiel, centré sur le corps et tangent ENU préservent la caméra ; un adaptateur de tuiles incompatible bloque le mode tangent.

## Terrains et survol de Shackleton

Le manifeste par défaut `sun-earth-moon-mars.json` raccorde le DEM Mapzen terrestre, le drapé satellite Google, le terrain et l'imagerie lunaires via `http://127.0.0.1:8794/moon/`, ainsi que le DEM régional Jezero via `http://127.0.0.1:8794/mars/`. Le bouton Mars montre le corps ; Jezero rejoint la région CTX/HiRISE. Mars 2000 est défini dans `celestial-core` et utilisé par le catalogue, la géométrie et les caméras. Le rendu et la sélection des tuiles conservent des repères séparés ; le mode tangent ENU reste disponible. Les états, erreurs et attributions sont affichés et exposés au contexte MCP.

Le bouton **Fly by Shackleton** lance un survol annulable du site, également disponible via `navigation_flyBy`. Voir [la configuration des sources, les limites de datum et la commande MCP](docs/terrain-layers.md).

La navigation utilise `createGeospatialCamera` sur Terre et `OrbitalCamera` sur la Lune, comme les démos du paquet. Le rendu des terrains emploie `GpuTerrainEngine` sur WebGL 2 et WebGPU, avec un nœud de repère par corps ; les transitions ENU restent disponibles.

## Spatial Awareness

Le [socle et le brief de référence](../celestial-core/docs/spatial-awareness/README.md) appartiennent à `celestial-core`. Explorer porte la caméra vivante, les observations terrain, la visibilité et la présentation interactive. Le [document d'intégration](docs/spatial-awareness.md) décrit le raccordement prévu et les responsabilités de Mission Control. Ces capacités restent à implémenter.

## Socle API

Les 108 contrats d'outils v1.1, les 11 topics, les ressources et les grammaires FR/EN sont intégrés. Le socle exécute 17 outils de contexte, d'horloge et de contrôle des opérations. Les autres outils deviennent disponibles lorsque l'hôte injecte leur exécutant réel. Aucun terrain, déplacement graphique, calcul scientifique ou enregistrement vidéo n'est simulé par le socle.

| Famille                      | Disponible dans le socle               | À raccorder par l'hôte                          |
| ---------------------------- | -------------------------------------- | ----------------------------------------------- |
| control                      | Les 6 outils                           | Politique d'accès du broker                     |
| observer                     | getContext, getHistory                 | Caméra, picking, visibilité, capture            |
| time                         | get, set, setNow, play, pause, setRate | Heure solaire, animation bornée                 |
| navigation                   | stop, getStatus                        | Exécution des déplacements et prévisualisation  |
| capture                      | getCaptureStatus                       | Production des captures et artefacts            |
| universe, ephemeris, surface | Contrats et ports                      | Catalogue, modèles et données scientifiques     |
| scene, mission, tv           | Contrats et ports                      | Monde graphique, Mission Control et restitution |

Une capacité absente est masquée dans `tools/list` et déclarée indisponible par l'API. Une session sans hôte graphique retourne `renderingAvailable: false`. La découverte décrit les capacités techniques ; les permissions sont vérifiées séparément à chaque requête.

## Développement

Node.js 22.13 ou ultérieur. Ce dépôt utilise les paquets voisins du workspace Gaume, avec un lockfile propre. Compiler les dépendances locales avant une première installation si leur `dist` est absent.

```sh
npm install
npm run typecheck
npm test
```

Le fichier `.npmrc` fixe `install-links=false` pour lier les paquets voisins, comme dans la démo `3d-tiles-babylon`. Les copies anciennes installées avec `--install-links` sont remplacées par `npm install`. Vite charge les sources de l'adaptateur Babylon et les builds liés de 3D Tiles, en gardant une seule instance de Babylon. Après reconstruction d'une dépendance, redémarrer avec `npm run dev -- --force` si nécessaire. Les chemins locaux ne constituent pas une distribution publiée reproductible ; un déploiement devra utiliser des versions ou archives identifiées.

`npm run generate` régénère `src/contracts/catalog.ts` depuis les catalogues JSON de `src/contracts`. Les originaux sont dans `docs/specifications/mcp/v1.1/SpaceXR_MCP_JSON_v1_1.zip`. Ne pas transmettre les catalogues d'outils à `McpGrammar.fromJSON` : seules les grammaires y sont chargées.

## Architecture

```text
Commandes manuelles                 Client MCP
        |                               |
        |                         MCP Broker
        |                               |
        |                    mcp-broker-provider
        |                               |
        |                    mcp-core + behaviors
        |                               |
        +-------- ExplorerSession <----- adapters
                          |
              Horloge et opérations
                          |
         Ports vers la session graphique,
         les analyses et Mission Control

ExplorerPersistence -> PersistencePort -> PersistenceSlotStore
                                            |
                                slot MCP persistence.v1
```

L'identité de session est distincte de la connexion MCP. Reconnecter un client ne recrée pas le monde. Une page fermée rend son provider indisponible ; la mission reste chez Mission Control.

## Raccorder le monde vivant

```ts
const session = new ExplorerSession({
  sessionId: "world-1",
  access: hostAccess,
  tools: {
    navigation_flyTo: {
      mutating: true,
      longRunning: true,
      camera: true,
      async execute(args, context) {
        return graphicsHost.flyTo(args.target, {
          epoch: context.epoch,
          signal: context.signal,
          onProgress: context.reportProgress,
        });
      },
    },
  },
});
```

`graphicsHost` et `hostAccess` sont les dépendances de l'application, pas des exécutants fournis par ce dépôt. Les mêmes commandes s'utilisent manuellement avec `session.execute(name, args)` et depuis MCP via l'adapter. L'origine manuelle est une API interne de confiance ; elle ne doit pas être déduite d'un argument distant.

Un exécutant de caméra doit être asynchrone et respecter `AbortSignal` pour interrompre le déplacement réel. Il résout sa promesse seulement lorsque l'action est effectivement terminée. `accepted` n'affirme ni arrivée ni terrain prêt. La résolution de `context.epoch` distingue `now`, `simulation` et une date ISO. `navigation_flyByAtCurrentTime` sélectionne toujours l'époque réelle.

L'hôte publie les observations réelles avec `session.updateContext(context)`. Lors d'une interaction manuelle, appeler `session.takeManualControl()` ou `updateContext(context, "manual")`. Les opérations de caméra sont annulées, tandis que les analyses indépendantes continuent. Appeler `context.worldChanged()` ou `session.resourceChanged(uri)` pour notifier des changements provenant d'un exécutant.

Les résultats scientifiques et les captures doivent conserver leurs sources, époque, repère, unités, résolution, incertitude et caractère synthétique. Ces données relèvent du port qui produit le résultat. Mission Control fournit les exécutants `mission_*` ; Explorer ne crée pas un deuxième orchestrateur.

## Contrôle et opérations

Le mode initial est `guide`. Les mutations MCP nécessitent une politique d'hôte explicite et un mode autorisé. La promotion de mode est elle-même soumise à la politique. Sans port d'accès, le socle autorise les lectures MCP et refuse les mutations. Une application exposant des données privées doit installer une politique pour les lectures aussi.

`BrokerExplorerAccess` demande au broker une décision sur la session avec `explorer.read`, `explorer.control` ou `explorer.agentMode`. Les références de demandeur proviennent de `_meta`, via le helper du provider. Les décisions contraintes sont refusées tant que l'hôte ne sait pas appliquer leurs obligations. La déclaration du provider ne donne aucun droit.

Les lectures de ressources restent vérifiées à chaque requête. Une lecture refusée ou indisponible est rendue au routeur comme une ressource introuvable, sans exposer son contenu.

`worldRevision` accompagne le contexte. Une commande locale peut fournir `expectedRevision` dans son invocation ; un client MCP utilise `params._meta["spacexr/expectedRevision"]`. Une précondition périmée exige une nouvelle observation. Ce contrôle est optionnel dans le contrat v1.1, il ne remplace pas l'annulation lors d'une reprise manuelle.

Les opérations exposent `queued`, `running`, `completed`, `failed` et `cancelled`, ainsi que progression et résultat. Leur registre est borné à 256 entrées par défaut, sans éviction d'opération active. Les résultats tardifs ne changent pas une opération annulée en succès. Le registre reste en mémoire dans cette livraison.

## Publication broker

`createExplorerProvider` utilise `MultiplexTransport` sur `ws(s)://<broker>/providers`. Le slot est configurable, `explorer` par défaut. L'adhésion à `_all` est désactivée par défaut et s'active explicitement. L'hôte doit arrêter le serveur et libérer son transport à la fermeture. Dans une page, raccorder ce nettoyage à `pagehide`.

L'exécutable `npm start` publie le socle sans rendu auprès d'un broker existant. Il vérifie l'acceptation de la déclaration avant d'annoncer sa disponibilité. Il ne lance pas son propre broker et ne configure aucun droit.

| Variable                 | Défaut                                 |
| ------------------------ | -------------------------------------- |
| EXPLORER_BROKER_URL      | ws://127.0.0.1:3000/providers          |
| EXPLORER_SLOT            | explorer                               |
| EXPLORER_SESSION_ID      | local                                  |
| EXPLORER_PROVIDER_SECRET | Credential du provider Node, si requis |
| EXPLORER_AGGREGATE       | 1 pour adhérer à \_all                 |
| EXPLORER_LOCALE          | en, ou fr                              |

Le credential du provider Node n'est pas une solution d'authentification pour le navigateur. L'intégration graphique doit suivre le déploiement navigateur supporté par le broker.

## Persistance

`PersistencePort` reprend les méthodes de documents et de découverte du contrat `IPersistenceStore`. `ExplorerPersistence` conserve des checkpoints et vues avec `expectedRevision`, `idempotencyKey` et références épinglées. Il accepte un store interne de confiance ou le véritable adapter MCP `PersistenceSlotStore`.

Le helper Node `createRemoteExplorerPersistence` est exporté depuis `@spacexr/explorer/persistence/node`. Il utilise `PersistenceSlotStore`, vérifie `persistence.v1` et lit les limites annoncées. Le point d'entrée principal ne charge pas le runtime du paquet de persistance, qui exporte actuellement aussi SQLite et des modules Node. Un hôte navigateur doit injecter un adapter compatible et adapté à son environnement.

`npm run example:checkpoint` sauvegarde puis relit un checkpoint sur un service existant. Configuration : `EXPLORER_PERSISTENCE_MCP_URL`, `EXPLORER_PERSISTENCE_TOKEN` et `EXPLORER_PERSISTENCE_NAMESPACE`. L'identité vient du transport MCP ; aucun `context.subject` n'est envoyé comme identité au service.

Conserver un snapshot et sa clé inchangés lorsqu'une réponse perdue impose de réessayer. Ne pas reconstruire un checkpoint différent avec la même clé. Un conflit de révision remonte à l'application, sans écrasement automatique.

Le checkpoint contient le contexte publié par l'hôte et l'horloge, avec sa version de schéma. Il ne contient ni ressources GPU ni credentials. `loadCheckpoint` valide et retourne ce document ; l'hôte vérifie ses sources et reconstruit le monde. Il ne relance pas les opérations ni la lecture temporelle. La restauration graphique n'est pas encore implémentée.

Les transferts de captures utilisent les méthodes d'artefact de `PersistenceSlotStore` et son endpoint HTTP authentifié. Aucun transport binaire parallèle n'est créé par Explorer. Le helper expose le store pour ces usages ; la production et l'enregistrement des captures restent à raccorder.

## Vérifications

La suite vérifie les contrats, les échanges MCP Loopback, les notifications, la priorité manuelle, les opérations, les autorisations à travers un vrai broker, la persistance via MCP et la relecture après fermeture/réouverture SQLite. Elle ne constitue pas une recette graphique, une simulation scientifique ou un essai d'arrêt brutal de la machine.
