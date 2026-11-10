import { DecisionGraphFactory } from "../decision/factory.js";
import { ConductNode } from "../conduct/nodes.js";
import { DelegateNode, AgentJoinNode } from "./nodes.js";
import { DelegationLink } from "./links.js";

export class AgentGraphFactory extends DecisionGraphFactory {
  public constructor() {
    super();
    for (const [type, create] of [
      ["harness.conduct", () => new ConductNode()],
      ["harness.delegate", () => new DelegateNode()],
      ["harness.agent-join", () => new AgentJoinNode()],
    ] as const) this.nodes.register(type, create, { label: type, category: "Harness",
      inputPorts: [{ slot: "in", optional: false }], outputPorts: [] });
    this.links.register("harness.delegation-link", () => new DelegationLink(), { label: "Agent session transition", category: "Harness" });
  }
}
