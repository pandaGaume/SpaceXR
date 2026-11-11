import type { IHarnessGraphFactory } from "../contracts/factory.js";
import { HarnessGraphFactory } from "../graph/factory.js";
import { DecisionNode } from "./nodes.js";

/** Explicit native registry, replaceable by the embedding application's factory. */
export class DecisionGraphFactory extends HarnessGraphFactory {
  public constructor() { super(); registerDecisionNodes(this); }
}

export function registerDecisionNodes(factory: IHarnessGraphFactory): void {
  for (const type of ["harness.decision", "harness.mcp-action"]) {
    factory.nodes.register(type, () => new DecisionNode(), {
      label: type, category: "Harness", inputPorts: [{ slot: "in", optional: false }],
      outputPorts: [{ slot: "out", optional: false }, { slot: "fault", optional: false }],
    });
  }
}
