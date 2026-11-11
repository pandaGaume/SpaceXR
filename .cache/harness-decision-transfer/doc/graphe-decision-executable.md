# Premier graphe de décision exécutable

Date : 6 novembre 2026. Statut : premier lot exécuté et testé, sans appel de modèle distant.

## Architecture retenue

Le harness est le graphe et ses sessions Core. La topologie JSON contient le parcours, les choix et le lien de retour. Les classes de nœuds implémentent des opérations ; aucun runner extérieur ne déroule une liste d'étapes. Plusieurs agents sont plusieurs sessions sur les mêmes objets de topologie.

```mermaid
flowchart TD
  start --> loop
  loop -->|body| observe
  observe --> context --> lookup --> gate
  gate -->|policy| merge
  gate -->|reason| request
  request --> reason[Action MCP : reasoner.decide]
  reason --> merge
  merge --> guard --> execute
  execute -->|web.search| web[Action MCP : web.search]
  execute -->|bypass après refus| after[observe-after]
  web --> after
  after --> evaluate --> record
  record --> loop
  loop -->|done ou exhausted| end
  fault[Liens fault des opérations] --> end
```

Le dessin est une lecture du JSON, pas une seconde définition exécutable. `reason` et `web.search` sont dans le même graphe que les nœuds de décision. `execute` route un token vers un nœud action ; il n'effectue pas lui-même un appel d'outil arbitraire. Le type `harness.mcp-action` utilise serveur, client, schémas et résultats natifs MCP.

`web.search` est un binding d'exemple vers le contrat existant de `mcp-web`. Cela n'installe ni ne démarre le service. Pour ajouter un slot, déclarer son nœud action, son binding `slot/tool`, un port de dispatch, son lien de résultat et son chemin d'erreur dans le document. Le catalogue proposé au reasoner dérive des nœuds du graphe et de `tools/list` des providers effectivement accessibles. Il ne remplace pas la discovery du broker.

## Réutilisation de Core

La matérialisation reste `loadHarnessGraph` puis `materializeSubGraphInto` et les registres natifs. La factory est explicite ; aucun graphe n'est construit à l'import.

Le parcours dynamique de Core savait déjà traiter les files de tokens et les cycles en synchrone. Son `RuntimeGraph.runAsync` utilisait exclusivement le parcours statique, incompatible avec une boucle de décision comportant des appels MCP.

Le changement dans Core ajoute `Scheduler.RunDynamicAsync` et `Session.runAsync`. Le parcours synchrone et le parcours asynchrone partagent la même logique de dispatch, les mêmes buffers et les mêmes règles de readiness. `RuntimeGraph.runAsync` délègue maintenant à la session selon le mode du graphe. La préparation du temps, les solveurs et les événements différés sont partagés avec le chemin synchrone. Deux parcours simultanés sur une même session sont refusés ; deux sessions sur le même graphe restent indépendantes.

Le harness n'ajoute aucun ordonnanceur, aucune boucle autour de Core, ni moteur de sérialisation. Ses tokens portent le contexte de la décision. `DecisionSession` spécialise `Session` pour porter entrée, services vivants, connexions MCP, étapes, traces et rapport.

## Utilisation

```ts
import { buildDecisionGraph, DecisionGraphFactory, DecisionSession } from "./dist/index.js";

const graph = buildDecisionGraph(new DecisionGraphFactory());
const first = new DecisionSession(graph, firstInput, firstServices);
const second = new DecisionSession(graph, secondInput, secondServices);
try {
  await Promise.all([graph.runAsync(0, first), graph.runAsync(0, second)]);
  console.log(first.report, second.report);
} finally {
  first.dispose();
  second.dispose();
}
```

Chaque entrée contient un `sessionId` unique et une intention `{id, description, parameters}`. L'hôte fournit :

- Un `McpClient` natif initialisé sur `_broker` et une factory de clients natifs pour les providers, sous l'identité et les autorisations de cet agent. L'hôte garde la propriété de son client discovery et des secrets du transport.
- Un `AbortSignal`, une opération d'observation, un guard explicite et une évaluation. L'évaluation retourne `continue`, `satisfied` et `reason` ; le nœud de boucle et ses liens réalisent le retour ou la sortie.
- Facultativement une projection de contexte, une proposition déterministe et un sink de journal. Ces services réalisent une opération ; ils ne pilotent pas l'ordre du parcours.

Le sink reçoit l'étape et ses traces, incluant les arguments et résultats MCP. Les identifiants et credentials de transport ne sont pas ajoutés aux prompts. Les observations et résultats choisis par l'application restent sous sa responsabilité.

Le reasoner est appelé via son outil `decide`, selon la surface existante du scrubber : intention, état, capacités accessibles et échecs récents. Son résultat contient `decision.invocation.capabilityId` et `input`. Le choix doit correspondre à un nœud action disponible du graphe. La surface de stockage de session reasoner définie dans les contrats antérieurs n'est pas présentée comme implémentée par cet adaptateur.

Le budget est `loop.config.maxDecisions` dans le JSON. Le graphe d'exemple s'arrête à huit décisions. La branche déterministe et la branche reasoner passent toutes deux par le guard et le même nœud action. Aucun apprentissage de topologie ou rejeu de recette n'est activé.

## Résultats et erreurs

Une étape distingue `executed`, `refused`, `tool-error`, `unavailable` et `indeterminate`. Le résultat MCP brut est conservé, y compris `isError` et les blocs de contenu autres que le texte.

Une rupture après dispatch ne déclenche aucun réessai automatique. L'évaluation ne peut pas certifier satisfaction après un refus ou un échec. Une continuation demandée malgré un effet indéterminé suit le lien d'erreur ; il faudra une réconciliation explicite pour la prendre en charge.

Les clients MCP natifs exposent encore certaines erreurs RPC sous forme d'`Error` simple. Un refus d'autorisation pendant l'invocation peut donc être classé prudemment comme `indeterminate`, même si le broker sait qu'aucun effet n'a eu lieu. Le test d'intégration vérifie que le provider n'a effectivement pas été appelé. Aucun protocole ou parseur de messages d'erreur parallèle n'a été ajouté.

Le rapport `completed` signifie que cette boucle a choisi de sortir. La satisfaction de l'objectif est portée séparément par l'évaluation. Cela ne termine pas une mission globale. `budget-exhausted`, `failed` et `cancelled` sont explicites. Une annulation après retour d'un outil conserve son résultat ; elle n'annule pas rétroactivement l'effet. L'annulation est coopérative entre opérations et n'interrompt pas une requête MCP déjà en vol.

## Vérifications

`npm test` vérifie 23 cas : chargement et registres, boucle de trois décisions dans un seul tick natif, branche déterministe, refus, erreur MCP, provider absent, rupture après dispatch, évaluation contradictoire, annulation, défaut d'observation ou de journal, budget et deux agents concurrents sur une même topologie.

Un test utilise le vrai broker via `@cyanmycelium/mcp-broker/testing`, son moteur de politiques et le transport HTTP natif de `mcp-core`. Deux identités appellent le même nœud action : l'une atteint le provider, l'autre est bloquée par une politique du broker. Les providers sont des fixtures contrôlées, sans recherche web, modèle facturé ou matériel.

Côté Core, cinq tests ciblés couvrent boucle asynchrone, sessions concurrentes, horloge et solveur, propagation d'erreur et livraison différée. Les suites historiques consultées de parcours dynamique, statique, calcul asynchrone et imbrication comptent par ailleurs trois échecs préexistants, reproduits sur les sources non modifiées : livraison par lien désactivé et deux débordements de buffers avec liens retardés. Ils restent à traiter dans Core ; ce lot ne prétend pas rendre toute sa suite verte.

## Limites et suite

Ce premier graphe valide le moteur de parcours et son raccordement aux slots. La proposition industrielle de 302 nœuds ne devient pas exécutable par ce changement. Les modèles, les corpus et les bindings CO₂ ne sont pas transportés.

Restent à reprendre : conduites des tâches, délégation corrélée, attentes humaines et événements externes, réconciliation des effets, journal durable et restauration, puis les autres slots utiles. Le sink de journal est optionnel, les traces par défaut sont en mémoire. Une session terminée est à remplacer par une nouvelle session et un nouvel identifiant pour une nouvelle activité ; le reset des buffers Core n'est pas une réinitialisation de conversation reasoner.

Le graphe d'exemple ne contient qu'une branche d'agent active par session. Plusieurs agents simultanés sont vérifiés via plusieurs sessions ; forks, joins, placement distant, fairness entre branches d'une même session et indépendance des calculs synchrones longs ne sont pas encore démontrés. Le test avec un reasoner réel reste à effectuer dans un assemblage applicatif.

L'archive exploratoire d'apprentissage topologique reste inchangée et hors du chemin nominal.
