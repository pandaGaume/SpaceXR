import { Session } from "@spiky-panda/core";
import type { IHarnessGraph } from "../contracts/graph.js";
import { BrokerSlots } from "../broker/slots.js";
import type { IDecisionInput, IDecisionReport, IDecisionServices, IDecisionStep, IDecisionTrace } from "./contracts.js";

/** One agent's state and live services on a shared native graph. No driver here. */
export class DecisionSession extends Session {
  public readonly slots: BrokerSlots;
  public readonly steps: IDecisionStep[] = [];
  public readonly trace: IDecisionTrace[] = [];
  public report?: IDecisionReport;
  public started = false;

  public constructor(graph: IHarnessGraph, public readonly input: IDecisionInput, public readonly services: IDecisionServices) {
    super(graph);
    if (!input.sessionId || !input.intention.id) throw new Error("Session and intention identifiers are required");
    this.slots = new BrokerSlots(services);
  }

  /** Releases this agent's MCP sessions, never the caller-owned discovery client. */
  public dispose(): void { this.slots.close(); }
}
