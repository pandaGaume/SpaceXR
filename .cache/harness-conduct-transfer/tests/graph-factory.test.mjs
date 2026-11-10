import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReferenceGraph } from "../dist/graphs/reference.js";
import { HarnessGraphFactory } from "../dist/graph/factory.js";
import { HarnessGraphNode } from "../dist/graph/nodes.js";
import { HarnessLink } from "../dist/graph/links.js";
import { loadHarnessGraph } from "../dist/graph/load.js";
import { readFileSync } from "node:fs";

const sourceDocument = JSON.parse(readFileSync(new URL("../src/graphs/reference.json", import.meta.url), "utf8"));

test("L'hôte choisit les classes de tous les nœuds et liens", () => {
  class HostNode extends HarnessGraphNode {}
  class HostLink extends HarnessLink {}
  const factory = new HarnessGraphFactory();
  factory.nodes.register("harness.node", () => new HostNode(), { label: "Host node", inputPorts: [], outputPorts: [] });
  factory.links.register("harness.link", () => new HostLink(), { label: "Host link" });
  const graph = buildReferenceGraph(factory);
  assert(graph.nodes.length > 0);
  assert(graph.links.length > 0);
  assert(graph.nodes.every(node => node instanceof HostNode));
  assert(graph.links.every(link => link instanceof HostLink));
  assert(graph.links.every(link => graph.nodes.includes(link.oini) && graph.nodes.includes(link.ofin)));
});

test("La modification du JSON détermine les nœuds et les liens chargés", () => {
  const document = structuredClone(sourceDocument);
  document.model.nodes.find(node => node.id === "ingress.question").data.config = { kind: "question", marker: "from-json" };
  const connection = document.model.connections.find(link => link.data.mode === "spawn");
  connection.data.context = "result-only";
  const graph = loadHarnessGraph(JSON.stringify(document), new HarnessGraphFactory());
  assert.equal(graph.nodes.find(node => node.id === "ingress.question").config.marker, "from-json");
  const restored = graph.links.find(link => link.oini.id === connection.from.node && link.slot === connection.from.port);
  assert.equal(restored.context, "result-only");
  assert.equal(restored.serialize().context, "result-only");
});

test("Un type de lien inconnu échoue au lieu de produire un Channel générique", () => {
  const document = structuredClone(sourceDocument);
  document.model.connections[0].typeId = "missing.link";
  assert.throws(() => loadHarnessGraph(JSON.stringify(document), new HarnessGraphFactory()), /missing.link/);
});

test("Une connexion ou un port absent empêche la publication du graphe", () => {
  const document = structuredClone(sourceDocument);
  document.model.connections[0].to.node = "missing.node";
  assert.throws(() => loadHarnessGraph(JSON.stringify(document), new HarnessGraphFactory()), /Extrémité absente/);
  document.model.connections[0].to.node = sourceDocument.model.connections[0].to.node;
  document.model.connections[0].to.port = "missing.port";
  assert.throws(() => loadHarnessGraph(JSON.stringify(document), new HarnessGraphFactory()), /Port non déclaré/);
});

test("Deux constructions avec la même factory ne partagent pas leurs objets de topologie", () => {
  const factory = new HarnessGraphFactory();
  const first = buildReferenceGraph(factory);
  const second = buildReferenceGraph(factory);
  assert.notEqual(first, second);
  assert.equal(first.nodes.length, second.nodes.length);
  assert.equal(first.links.length, second.links.length);
  assert(first.nodes.every(node => !second.nodes.includes(node)));
  assert(first.links.every(link => !second.links.includes(link)));
  assert(first.links.every(link => link.oini.onsc().includes(link) && link.ofin.opsc().includes(link)));
});
