# Slots à reprendre et statuts

Date : 6 novembre 2026. Cette liste décrit la reprise générique dans le harness. Une ligne ne signifie pas qu'un provider est déjà démarré ou importé dans le dépôt.

## Providers et surfaces prioritaires

| Slot logique | Source existante | Usage | Statut et décision |
| --- | --- | --- | --- |
| `_broker` | `mcp-broker` | Discovery et autorisations | Dépendance obligatoire, contrat natif utilisé dans les tests Loopback et HTTP |
| `reasoner` | Slot du démonstrateur `slots/reasoner/provider.ts` | Raisonnement remplaçable par rôle | Appels `decide` déjà raccordés ; le serveur et ses profils restent dans le démonstrateur tant que leur extraction n'est pas faite |
| `web` | Dépôt autonome `mcp-web` | Recherche et sources | Binding MCP déjà présent ; consommer ce provider, ne pas recopier le slot CO₂. Les tests utilisent un provider contrôlé |
| `library` | `slots/tools/library/provider.ts` du démonstrateur | Méthodes, faits, règles, documents et provenance | À extraire avec un corpus injecté. Première surface utile : `list`, `search`, `read`, `methods`, `facts`, `rules`. Les opérations `review`, `sign` et `propose` demandent leur autorité propre |
| `workspace` | `slots/tools/workspace/provider.ts` du démonstrateur | Artefacts et fichiers de travail | À extraire avec une racine et un périmètre d'accès propres à la session ; outils existants `list`, `read`, `write` |
| `supervisor` | `slots/supervisor/provider.ts` du démonstrateur | Revue d'une proposition ou demande | À extraire : `review`, `review_request`. La revue ne donne pas au modèle le pouvoir d'adopter sa propre proposition |
| `observer` | `slots/observer/provider.ts`, observateurs du démonstrateur | Observation et qualification des entrées | Reprendre le rôle et les contrats utiles ; retirer les lectures de cabine et les bindings CO₂ |
| `agent` | `slots/agent/provider.ts` du démonstrateur | Entrées et visibilité des activités d'agent | Le parcours et les sessions sont désormais dans le graphe commun. La façade MCP reste à extraire ; ne pas copier sa boucle de mission parallèle |
| `factory` | `slots/factory/provider.ts` du démonstrateur | Demande déléguée, état et artefacts de tâche | La délégation locale est implémentée par liens et sessions. La façade MCP reste à raccorder à ce mécanisme ; ne pas importer `runTask` comme autre moteur |
| Interaction humaine, issue de `station` | `slots/station/` du démonstrateur | Questions et décisions corrélées | À extraire séparément des procédures de commissioning et des équipements. Pas nécessaire à la preuve de délégation locale de ce lot |

Les noms des providers restent des bindings du graphe. Leurs schémas sont lus via `tools/list` sous l'identité du demandeur. Aucun registre de providers parallèle n'est entretenu. Aucun de ces slots ne s'accorde implicitement l'autorité d'un autre.

## Services de la famille MCP à raccorder selon leur contrat réel

| Dépôt | Contrat existant | Usage envisagé et limite |
| --- | --- | --- |
| `mcp-cache` | `cache.v1`, `CacheBehavior`, `CacheSlotStore`, stockages mémoire et Redis, clés UNS et TTL | État temporaire et projections. Ce n'est pas une preuve de checkpoint transactionnel ni de reprise durable |
| `mcp-history` | `history.v1`, `HistoryBehavior`, `HistorySlotStore`, séries de valeurs par identifiant UNS, stockage mémoire et paquet SQLite | Historisation des observations et résultats compatibles. Le contrat actuel est orienté valeurs SCADA ; sa présence ne suffit pas à en faire un journal arbitraire des agents |
| `mcp-uns` | Identifiants de ressources et contrôle d'accès broker | Références stables, distinctes des identifiants d'agents et des connexions de providers |
| `mcp-vault` | Secrets et configuration protégés | Attachement de credentials par l'hôte, hors du contexte transmis au reasoner ou à un enfant |

Ces services ne sont pas ajoutés comme dépendances obligatoires par ce deuxième lot. Leur raccordement doit documenter les garanties d'acquittement, d'idempotence et de restauration réellement disponibles.

## Extensions optionnelles

`screens`, `speech` et `qr` servent les restitutions. `model`, `physics`, `forge` et `cad` servent des travaux spécialisés. Les dépôts `mcp-open-api`, `mcp-scada`, `mcp-modbus`, `mcp-opc-ua` et `mcp-network-discovery` restent des intégrations activées selon le domaine. Leurs sources ne sont pas à recopier dans le harness.

`mcp-for-babylon` et les behaviors de la spécification SpaceXR appartiennent à Explorer. La spécification v1.1 et son archive JSON sont rangées dans `spacexr-explorer/docs/specifications/mcp/v1.1/`.

Les slots `scrubber`, `biomed`, les scénarios et les modèles de cabine restent dans l'application CO₂. Leurs mécanismes génériques peuvent servir de référence ; leurs contenus métier ne deviennent pas des dépendances du harness.
