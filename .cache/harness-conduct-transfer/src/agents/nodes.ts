import { McpToolResults } from "@cyanmycelium/mcp-core";
import type { IHarnessGraph, JsonValue } from "../contracts/graph.js";
import type { IDecisionCapability, IDecisionServices } from "../decision/contracts.js";
import { DecisionNode, type IDecisionPacket } from "../decision/nodes.js";
import { DecisionSession } from "../decision/session.js";
import { AgentSession } from "./session.js";
import { DelegationLink } from "./links.js";
import type { IDelegationRequest, IDelegationResult } from "./contracts.js";

function configOf(node: DecisionNode): Record<string, unknown> {
  if (!node.config || typeof node.config !== "object" || Array.isArray(node.config)) throw new Error("Delegation config required");
  return node.config as Record<string, unknown>;
}

/** An action node admits a child; Core owns concurrent traversal and completion. */
export class DelegateNode extends DecisionNode {
  public override asyncMode: "concurrent" = "concurrent";
  public override get isAction(): boolean { return true; }
  public override async describeCapability(): Promise<IDecisionCapability> {
    const config = configOf(this);
    return { id: String(this.id), schema: {
      name: String(this.id), description: String(config.description ?? "Delegate bounded work to an agent"),
      inputSchema: { type: "object", additionalProperties: false, properties: {
        objective: { type: "string", minLength: 1 }, context: { type: "object" },
      }, required: ["objective"] },
    } };
  }

  protected override async resolve(native: DecisionSession, packet: IDecisionPacket): Promise<{ port: string; packet: IDecisionPacket }> {
    if (!(native instanceof AgentSession)) throw new Error("Delegation requires an AgentSession");
    const session = native;
    const config = configOf(this);
    if (packet.step.action?.nodeId !== String(this.id)) throw new Error("Delegation reached the wrong action node");
    const args = packet.step.action.input;
    if (typeof args.objective !== "string" || !args.objective.trim()
      || Object.keys(args).some(key => !["objective", "context"].includes(key))) throw new Error("Delegation objective and optional context required");
    if (typeof config.role !== "string" || !config.role || !Number.isSafeInteger(config.maxDepth)
      || Number(config.maxDepth) < 1) throw new Error("Delegation role and depth limit must be declared in the graph");
    const depth = (session.input.lineage?.depth ?? 0) + 1;
    if (depth > Number(config.maxDepth)) throw new Error("Delegation depth budget exhausted");
    const transitions = session.graph.links.filter((link): link is DelegationLink => link instanceof DelegationLink && link.delegateId === String(this.id));
    const spawn = transitions.filter(link => link.mode === "spawn" && link.oini === this);
    const returns = transitions.filter(link => link.mode === "result");
    if (spawn.length !== 1 || returns.length !== 1 || !spawn[0]!.ofin || !returns[0]!.ofin) throw new Error("Delegation requires one declared spawn and result link");
    const resultLink = returns[0]!;
    const joinNodeId = String(resultLink.ofin!.id);
    const attemptId = `${session.input.sessionId}:${String(this.id)}:${packet.step.iteration}`;
    if (session.delegations.has(attemptId)) throw new Error("Delegation attempt already admitted; it cannot be replayed");
    if (!session.services.createDelegateServices) throw new Error("Explicit child service and identity factory required");
    const contextKeys = config.contextKeys;
    if (!Array.isArray(contextKeys) || contextKeys.some(key => typeof key !== "string")) throw new Error("Explicit context projection keys required");
    const source = packet.step.context && typeof packet.step.context === "object" && !Array.isArray(packet.step.context)
      ? packet.step.context as Record<string, JsonValue> : {};
    const context = Object.fromEntries(contextKeys.filter(key => Object.hasOwn(source, key)).map(key => [key, source[key]]));
    const request: IDelegationRequest = { parentSessionId: session.input.sessionId, attemptId,
      childSessionId: `${attemptId}/agent`, role: config.role, depth, objective: args.objective,
      context: structuredClone({ projected: context, provided: args.context ?? null }) as JsonValue };
    const controller = new AbortController();
    const attempt = { request, controller, joinNodeId, returned: false } as import("./session.js").IDelegationAttempt;
    session.delegations.set(attemptId, attempt);
    const services = await session.services.createDelegateServices(request);
    if (services.broker === session.services.broker) throw new Error("A delegated agent requires its own broker MCP session");
    session.services.signal.throwIfAborted();
    const attached: IDecisionServices = {
      broker: services.broker, connect: services.connect.bind(services),
      signal: AbortSignal.any([session.services.signal, services.signal, controller.signal]),
      observe: services.observe.bind(services), guard: services.guard.bind(services), evaluate: services.evaluate.bind(services),
      context: services.context?.bind(services), lookup: services.lookup?.bind(services), record: services.record?.bind(services),
      conductEvidence: services.conductEvidence?.bind(services), createDelegateServices: services.createDelegateServices?.bind(services),
    };
    const child = new AgentSession(session.graph as IHarnessGraph, {
      sessionId: request.childSessionId, entryNodeId: String(spawn[0]!.ofin!.id),
      lineage: { parentSessionId: request.parentSessionId, attemptId, depth },
      intention: { id: request.role, description: request.objective, parameters: request.context },
    }, attached);
    attempt.child = child;
    child.setInput(session.graph.links.indexOf(spawn[0]!), null);
    session.trace.push({ sessionId: session.input.sessionId, nodeId: String(this.id), iteration: packet.step.iteration,
      output: "delegation.admitted", value: structuredClone(request) });
    this.publishAll(session, "launched", packet);
    try {
      await session.graph.runAsync(0, child);
      if (!child.report) throw new Error("Delegated traversal stopped without a terminal report");
      if (child.report.terminalNodeId !== String(resultLink.oini?.id)) throw new Error("Child ended outside its declared result path");
      const result: IDelegationResult = { parentSessionId: session.input.sessionId, childSessionId: child.input.sessionId,
        attemptId, delegateId: String(this.id), report: structuredClone(child.report) };
      attempt.result = result;
      // Return through the graph's declared result link into the parent's native queue.
      session.publish(session.graph.links.indexOf(resultLink), { ...packet, delegation: result });
      return { port: "finished", packet };
    } finally { child.dispose(); }
  }
}

/** Results can satisfy only their owning session, child and attempt. */
export class AgentJoinNode extends DecisionNode {
  protected override async resolve(native: DecisionSession, packet: IDecisionPacket): Promise<{ port: string; packet: IDecisionPacket }> {
    if (!(native instanceof AgentSession)) throw new Error("AgentSession required for result join");
    const result = packet.delegation;
    const attempt = result && native.delegations.get(result.attemptId);
    if (!result || !attempt || attempt.returned || result.parentSessionId !== native.input.sessionId
      || result.childSessionId !== attempt.request.childSessionId || attempt.joinNodeId !== String(this.id)
      || packet.step.iteration !== native.steps.length + 1 || !attempt.result
      || result.delegateId !== attempt.result.delegateId) {
      return { port: "ignored", packet };
    }
    attempt.returned = true;
    const satisfied = result.report.status === "completed" && result.report.steps.at(-1)?.evaluation?.satisfied === true;
    return { port: "out", packet: { ...packet, step: { ...packet.step,
      result: McpToolResults.json(result), outcome: satisfied ? "executed" : "tool-error",
      ...(!satisfied ? { error: `Delegated task did not satisfy its objective: ${result.report.status}` } : {}) } } };
  }
}
