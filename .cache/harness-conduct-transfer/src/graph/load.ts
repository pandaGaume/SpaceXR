import { materializeSubGraphInto, RuntimeGraph } from "@spiky-panda/core";
import type { IHarnessGraphFactory } from "../contracts/factory.js";
import type { IHarnessGraph, IHarnessGraphNode, IHarnessLink, TriggerKind } from "../contracts/graph.js";

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Objet JSON attendu : ${path}`);
  return value as Record<string, unknown>;
}

function text(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`Chaîne non vide attendue : ${path}`);
  return value;
}

/** Admission stricte du harness ; création, restauration et câblage sont faits par Core. */
export function loadHarnessGraph(json: string, factory: IHarnessGraphFactory): IHarnessGraph {
  const document = record(JSON.parse(json), "document");
  if (document.version !== 4) throw new Error("Version de document attendue : 4, avec liens typés");
  const metadata = record(document.harness, "harness");
  const id = text(metadata.id, "harness.id");
  const version = text(metadata.version, "harness.version");
  const entries = record(metadata.entries, "harness.entries");
  const model = record(document.model, "model");
  if (!Array.isArray(model.nodes) || !Array.isArray(model.connections)) throw new Error("model.nodes et model.connections doivent être des tableaux");

  const nodeIds = new Set<string>();
  for (const saved of model.nodes) {
    const node = record(saved, "model.nodes[]");
    const nodeId = text(node.id, "node.id");
    if (nodeIds.has(nodeId)) throw new Error(`Identifiant de nœud dupliqué : ${nodeId}`);
    nodeIds.add(nodeId);
    text(node.typeId, "node.typeId");
    record(node.data, "node.data");
  }
  for (const saved of model.connections) {
    const connection = record(saved, "model.connections[]");
    text(connection.typeId, "connection.typeId");
    for (const side of ["from", "to"]) {
      const endpoint = record(connection[side], `connection.${side}`);
      const nodeId = text(endpoint.node, `connection.${side}.node`);
      if (!nodeIds.has(nodeId)) throw new Error(`Extrémité absente : ${nodeId}`);
      if (typeof endpoint.port !== "string" && typeof endpoint.port !== "number") throw new Error(`Port invalide : ${nodeId}`);
    }
  }
  const triggerKinds: readonly TriggerKind[] = [
    "question", "procedure-request", "alarm", "telemetry", "equipment-discovered",
    "external-response", "authorization-result", "async-result", "deadline", "source-invalidated", "cancel",
  ];
  for (const kind of triggerKinds) {
    if (!nodeIds.has(text(entries[kind], `harness.entries.${kind}`))) throw new Error(`Point d'entrée absent : ${kind}`);
  }

  const graph = new RuntimeGraph<IHarnessGraphNode, IHarnessLink>([], [], "dynamic");
  const result = materializeSubGraphInto(graph, json,
    typeId => factory.nodes.create(typeId) ?? null,
    typeId => factory.links.create(typeId) ?? null);
  if (result.missingTypeIds.length || result.missingLinkTypeIds.length || result.skipped.length) {
    throw new Error(`Matérialisation Core incomplète : ${JSON.stringify({
      missingTypeIds: result.missingTypeIds, missingLinkTypeIds: result.missingLinkTypeIds, skipped: result.skipped,
    })}`);
  }
  if (graph.nodes.length !== model.nodes.length || graph.links.length !== model.connections.length) throw new Error("Topologie Core incomplète");
  for (const [nodeId, instance] of result.instances) instance.id = nodeId;
  for (const node of graph.nodes) {
    if (typeof node.region !== "string" || typeof node.resolver !== "string" || !node.resolver
      || !Array.isArray(node.inputPorts) || !Array.isArray(node.outputPorts) || !Array.isArray(node.needs)
      || !["each-message", "all-correlated-inputs"].includes(node.activation)) {
      throw new Error(`Nœud incompatible avec IHarnessGraphNode : ${node.id}`);
    }
  }
  for (const link of graph.links) {
    if (!["continue", "spawn", "result"].includes(link.mode) || !["project", "result-only"].includes(link.context)) {
      throw new Error("Lien incompatible avec IHarnessLink");
    }
    const source = link.oini as IHarnessGraphNode;
    const target = link.ofin as IHarnessGraphNode;
    if (!source.outputPorts.some(port => port.slot === link.slot) || !target.inputPorts.some(port => port.slot === link.toSlot)) {
      throw new Error(`Port non déclaré : ${source.id}.${link.slot} -> ${target.id}.${link.toSlot}`);
    }
  }
  graph.id = id;
  return Object.assign(graph, { version, entries: Object.freeze({ ...entries }) as Readonly<Record<TriggerKind, string>> });
}
