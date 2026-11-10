import assert from "node:assert/strict";
import { Channel, RuntimeGraph, RuntimeNode } from "@spiky-panda/core";
import { buildReferenceGraph } from "../dist/graphs/reference.js";
import { HarnessGraphFactory } from "../dist/graph/factory.js";

const referenceGraph = buildReferenceGraph(new HarnessGraphFactory());

assert(referenceGraph instanceof RuntimeGraph, "Le graphe doit être une instance Core");
const nodes = new Map(referenceGraph.nodes.map(node => [String(node.id), node]));
assert.equal(nodes.size, referenceGraph.nodes.length, "Identifiants de nœuds dupliqués");
for (const edge of referenceGraph.links) {
  assert(edge instanceof Channel, "Le lien doit être un Channel Core");
  const source = nodes.get(String(edge.oini?.id));
  const target = nodes.get(String(edge.ofin?.id));
  assert(source?.outputPorts.some(port => port.slot === edge.slot), `Sortie inconnue : ${edge.oini?.id}.${edge.slot}`);
  assert(target?.inputPorts.some(port => port.slot === edge.toSlot), `Entrée inconnue : ${edge.ofin?.id}.${edge.toSlot}`);
  assert(source.onsc().includes(edge), "Channel absent du routage de sortie Core");
  assert(target.opsc().includes(edge), "Channel absent du routage d'entrée Core");
}
for (const entry of Object.values(referenceGraph.entries)) assert(nodes.has(entry), `Entrée absente : ${entry}`);
for (const node of nodes.values()) {
  assert(node instanceof RuntimeNode, "Le nœud doit être un RuntimeNode Core");
  if (node.activation !== "all-correlated-inputs") continue;
  for (const input of node.inputPorts) {
    assert(referenceGraph.links.some(edge => edge.ofin === node && edge.toSlot === input.slot), `Dépendance sans producteur : ${node.id}.${input.slot}`);
  }
}
const reachable = new Set(Object.values(referenceGraph.entries));
let changed = true;
while (changed) {
  changed = false;
  for (const edge of referenceGraph.links) {
    const from = String(edge.oini?.id);
    const to = String(edge.ofin?.id);
    if (reachable.has(from) && !reachable.has(to)) {
      reachable.add(to);
      changed = true;
    }
  }
}
assert.equal(reachable.size, nodes.size, "Nœuds inaccessibles depuis les entrées");
const regions = [...new Set(referenceGraph.nodes.map(node => node.region))];
console.log(JSON.stringify({
  status: "Topologie de proposition cohérente ; exécution non implémentée",
  nodes: nodes.size, links: referenceGraph.links.length,
  entries: Object.keys(referenceGraph.entries).length, regions,
}, null, 2));
