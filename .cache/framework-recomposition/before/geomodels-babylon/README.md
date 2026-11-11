# Focus Geosolutions Inc. is a tech-driven mineral exploration services company publicly launched in 2026.

Built on strong expertise in applied geology, 3D modeling, GIS, and full-stack web engineering, Focus delivers innovative digital solutions and high-value technical services to exploration companies in Canada and internationally.

## GeoModels v2 3D Tiles prototype

The `3d-tiles` branch contains the v1 to v2 package converter, a CesiumJS
compatibility viewer and a Babylon WebGPU viewer backed by
`@spacexr/3d-tiles-runtime`.

- [Prototype architecture and validation](docs/3d-tiles-prototype.md)
- [Conversion tools](tools/README.md)

## Studio V2, serveur local unique

Les sources sont séparées des fichiers de déploiement :

```text
packages/
  dev/
    studio/       # Studio V2 : src/, src/styles/, tests/
    studio-v1/    # Ancienne interface : src/, src/styles/
    web/          # Pages HTML, intégration, src/styles/, public/, Vite
  host/
    www/dist/     # Distribution générée, servie par le broker
legacy/www-deployments/  # Anciennes copies conservées
```

Chaque interface possède ses styles dans `src/styles/`. Le package web importe les interfaces métier sans dupliquer leurs sources. Les fichiers compilés ne doivent pas être modifiés directement.

```sh
npm run build:studio
npm run start:studio
```

Ouvrir `http://127.0.0.1:3000/studio/studio-v2.html`. Le processus Node du mcp-broker sert les fichiers compilés sous `/studio/` et expose les transports MCP sur le même port. Studio V1 est disponible sous `/studio/studio-v1.html`. Aucun serveur Vite n'est nécessaire à l'exécution de cette distribution.

`npm run dev:studio` conserve Vite pour le développement avec rechargement immédiat, sur le port 5290. `npm run build:studio` compile les pages et les Workers dans `packages/host/www/dist`.

Le preset `.mcp-broker.studio.json` configure le montage et les origines locales autorisées. Le lanceur respecte `MCP_BROKER_CONFIG` et une configuration existante `.mcp-broker/config.json`. Dans ce cas, ajouter le montage `/studio` à cette configuration en conservant ses providers et sa configuration de sécurité. Si le broker fonctionne déjà, lui ajouter le montage puis le redémarrer au lieu de lancer un second broker sur le même port. Les chemins `www.mounts[].dir` sont relatifs au fichier de configuration.

Le dossier projet choisi dans le navigateur reste distinct des fichiers statiques de l'application. Ses modèles et settings sont lus et écrits via File System Access ; ils ne sont pas exposés par le montage HTTP.

Le Studio reste déployable comme application web statique : le contenu de `packages/host/www/dist` fonctionne aussi sous un sous-chemin d'hébergement. Le broker local est une option de distribution et fournit les capacités MCP. Depuis une origine web distante, l'adresse du broker local doit être configurée explicitement, cette origine autorisée par le broker et la compatibilité HTTPS/WebSocket vérifiée. Aucun packaging desktop n'est ajouté.

Voir [la spécification](docs/studio-v2-specification.md), [le fonctionnement de la maquette](packages/dev/studio/README.md) et [le contrat OpenAPI du Studio](docs/api/README.md). Les dépendances MCP utilisent actuellement les dépôts voisins compilés `../mcp-core` et `../mcp-broker`.
