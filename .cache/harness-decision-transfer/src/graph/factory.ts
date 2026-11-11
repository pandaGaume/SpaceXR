import { LinkRegistry, NodeRegistry } from "@spiky-panda/core";
import type { IHarnessGraphFactory } from "../contracts/factory.js";
import { HarnessGraphNode } from "./nodes.js";
import { HarnessLink } from "./links.js";

/** Catalogue de proposition ; l'hôte peut fournir ses propres registres Core. */
export class HarnessGraphFactory implements IHarnessGraphFactory {
  public readonly nodes = new NodeRegistry();
  public readonly links = new LinkRegistry();

  public constructor() {
    this.nodes.register("harness.node", () => new HarnessGraphNode(), {
      label: "Harness node", category: "Harness",
      inputPorts: [], outputPorts: [],
    });
    this.links.register("harness.link", () => new HarnessLink(), {
      label: "Harness context", category: "Harness",
    });
  }
}
