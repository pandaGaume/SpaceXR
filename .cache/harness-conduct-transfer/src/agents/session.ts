import type { IRuntimeNode } from "@spiky-panda/core";
import type { IHarnessGraph } from "../contracts/graph.js";
import type { IDecisionInput, IDecisionServices } from "../decision/contracts.js";
import { DecisionSession } from "../decision/session.js";
import { DelegationLink } from "./links.js";
import type { IDelegationRequest, IDelegationResult } from "./contracts.js";

export interface IDelegationAttempt {
  readonly request: IDelegationRequest;
  readonly controller: AbortController;
  readonly joinNodeId: string;
  child?: AgentSession;
  result?: IDelegationResult;
  returned: boolean;
  deliveryQueued?: boolean;
}

/** Agent contexts specialize native sessions on one unchanged topology. */
export class AgentSession extends DecisionSession {
  public readonly delegations = new Map<string, IDelegationAttempt>();
  private readonly scope = new Set<IRuntimeNode>();

  public constructor(graph: IHarnessGraph, input: IDecisionInput, services: IDecisionServices) {
    super(graph, input, services);
    const entry = graph.nodes.find(node => String(node.id) === (input.entryNodeId ?? graph.entries.question));
    if (!entry || entry.resolver !== "decision.start") throw new Error("Agent entry must be a declared decision.start node");
    // Reachability describes context scope. It neither copies nor executes the graph.
    const pending: IRuntimeNode[] = [entry];
    while (pending.length) {
      const node = pending.pop()!;
      if (this.scope.has(node)) continue;
      this.scope.add(node);
      for (const link of graph.links) {
        if (link.oini === node && link.mode === "continue" && link.ofin) pending.push(link.ofin as IRuntimeNode);
        if (link instanceof DelegationLink && link.mode === "result" && link.delegateId === String(node.id) && link.ofin) {
          pending.push(link.ofin as IRuntimeNode);
        }
      }
    }
  }

  public override canTraverse(node: IRuntimeNode): boolean { return this.scope.has(node); }
  public override dispose(): void {
    for (const attempt of this.delegations.values()) {
      attempt.controller.abort("Parent agent disposed");
      attempt.child?.dispose();
    }
    super.dispose();
  }
}
