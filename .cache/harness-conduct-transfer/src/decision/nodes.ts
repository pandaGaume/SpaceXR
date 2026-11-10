import { type ISession } from "@spiky-panda/core";
import type { McpToolResult } from "@cyanmycelium/mcp-core";
import { HarnessGraphNode } from "../graph/nodes.js";
import type { IHarnessGraphNode } from "../contracts/graph.js";
import { SlotUnavailableError } from "../broker/slots.js";
import type { IDecisionAction, IDecisionCapability, IDecisionStep, IMcpActionBinding } from "./contracts.js";
import { DecisionSession } from "./session.js";
import type { IConductFacts } from "../conduct/contracts.js";
import type { IDelegationResult } from "../agents/contracts.js";

export interface IDecisionPacket {
  step: IDecisionStep;
  capabilities?: IDecisionCapability[];
  continue: boolean;
  terminal?: "failed" | "cancelled";
  error?: string;
  facts?: IConductFacts;
  delegation?: IDelegationResult;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Object expected");
  return value as Record<string, unknown>;
}
function binding(node: IHarnessGraphNode): IMcpActionBinding {
  const config = object(node.config);
  if (typeof config.slot !== "string" || !config.slot || config.slot.startsWith("_")
    || typeof config.tool !== "string" || !config.tool) throw new Error(`Invalid MCP binding: ${node.id}`);
  return { slot: config.slot, tool: config.tool };
}
function action(value: unknown): IDecisionAction {
  const raw = object(value);
  if (typeof raw.nodeId !== "string" || !raw.nodeId) throw new Error("Action nodeId required");
  return { nodeId: raw.nodeId, input: object(raw.input) };
}
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }

/** Reads only the native discovery and tools of the action nodes of this graph. */
async function capabilities(session: DecisionSession): Promise<IDecisionCapability[]> {
  const result: IDecisionCapability[] = [];
  for (const native of session.graph.nodes) {
    if (!(native instanceof DecisionNode) || !session.canTraverse(native)) continue;
    const conduct = session.conduct.get(session.steps.length + 1);
    if (conduct && !conduct.allowed.includes(String(native.id))) continue;
    const descriptor = await native.describeCapability(session);
    if (descriptor) result.push(descriptor);
  }
  return result;
}

/** Stateless operations. Tokens, traces, budgets and attachments live in Core sessions. */
export class DecisionNode extends HarnessGraphNode {
  public get isAction(): boolean { return this.resolver === "mcp.call"; }

  public async describeCapability(session: DecisionSession): Promise<IDecisionCapability | undefined> {
    if (!this.isAction) return undefined;
    const ref = binding(this);
    try {
      const schema = (await session.slots.tools(ref.slot)).find(tool => tool.name === ref.tool);
      return schema ? { id: String(this.id), ...ref, schema } : undefined;
    } catch (error) { if (!(error instanceof SlotUnavailableError)) throw error; return undefined; }
  }
  public override isReady(session: ISession): boolean {
    if (!(session instanceof DecisionSession) || session.report || !session.canTraverse(this)) return false;
    if (this.resolver === "decision.start") return !session.started
      && String(this.id) === (session.input.entryNodeId ?? (session.graph as import("../contracts/graph.js").IHarnessGraph).entries.question);
    return this.inputChannels("in").some(link => session.linkStateOf(link)?.ready);
  }

  public override fire(): never { throw new Error("Async decision nodes require Core runAsync"); }

  public override async fireAsync(native: ISession): Promise<void> {
    if (!(native instanceof DecisionSession)) throw new Error("DecisionSession required");
    const session = native;
    let packet: IDecisionPacket = this.resolver === "decision.start"
      ? { step: { iteration: 0, observation: null, context: null }, continue: true }
      : this.consumeLatest(session, "in") as IDecisionPacket;
    if (!packet) throw new Error(`Missing input token: ${this.id}`);
    try {
      if (this.resolver !== "decision.end") session.services.signal.throwIfAborted();
      const operation = await this.resolve(session, packet);
      packet = operation.packet;
      session.trace.push({ sessionId: session.input.sessionId, nodeId: String(this.id),
        iteration: packet.step.iteration, output: operation.port, value: structuredClone(packet) });
      this.publishAll(session, operation.port, packet);
    } catch (error) {
      const terminal = session.services.signal.aborted ? "cancelled" : "failed";
      packet = { ...packet, terminal, error: message(error), continue: false };
      session.trace.push({ sessionId: session.input.sessionId, nodeId: String(this.id),
        iteration: packet.step.iteration, output: "fault", value: structuredClone(packet) });
      this.publishAll(session, "fault", packet);
    }
  }

  protected async resolve(session: DecisionSession, packet: IDecisionPacket): Promise<{ port: string; packet: IDecisionPacket }> {
    const services = session.services;
    let port = "out";
    let step = packet.step;
    switch (this.resolver) {
      case "decision.start": this.consumeLatest(session, "in"); session.started = true; break;
      case "decision.loop": {
        const limit = object(this.config).maxDecisions;
        if (!Number.isSafeInteger(limit) || Number(limit) < 1) throw new Error("Invalid decision budget in graph");
        if (!packet.continue) port = "done";
        else if (step.iteration >= Number(limit)) port = "exhausted";
        else { port = "body"; step = { iteration: step.iteration + 1, observation: null, context: null }; }
        break;
      }
      case "decision.observe": step = { ...step, observation: await services.observe(session.input, session) }; break;
      case "decision.context": step = { ...step, context: services.context
        ? await services.context(step.observation, session.input) : step.observation }; break;
      case "decision.lookup": {
        const candidate = await services.lookup?.(step.context, session.input);
        if (candidate) step = { ...step, action: action(candidate) };
        break;
      }
      case "decision.gate": port = step.action ? "policy" : "reason"; break;
      case "decision.request": packet = { ...packet, capabilities: await capabilities(session) }; break;
      case "mcp.reason": {
        const ref = binding(this);
        const offered = packet.capabilities ?? [];
        const request = {
          conversationId: session.input.sessionId, decisionId: `${session.input.sessionId}:${step.iteration}`,
          intention: session.input.intention, state: { id: session.input.sessionId,
            features: { context: step.context, observation: step.observation, previous: session.steps.at(-1) ?? null,
              conduct: session.conduct.get(step.iteration) ?? null } },
          allowedCapabilities: offered.map(item => ({ id: item.id, description: item.schema.description,
            inputSchema: item.schema.inputSchema })), candidates: [],
          recentFailures: session.steps.filter(item => item.action && !item.evaluation?.satisfied).map(item => ({
            decision: { invocation: { capabilityId: item.action!.nodeId, input: item.action!.input } },
            result: { ok: false, error: item.error ?? item.evaluation?.reason ?? "Unsatisfied evaluation" },
          })),
        };
        session.trace.push({ sessionId: session.input.sessionId, nodeId: String(this.id), iteration: step.iteration,
          output: "mcp.request", value: structuredClone({ ...ref, input: request }) });
        const raw = await session.slots.call(ref.slot, ref.tool, request);
        session.trace.push({ sessionId: session.input.sessionId, nodeId: String(this.id), iteration: step.iteration,
          output: "mcp.result", value: structuredClone(raw) });
        if (raw.isError) throw new Error(`Reasoner returned an error: ${JSON.stringify(raw)}`);
        const content = raw.content.find(item => item.type === "text");
        if (!content || content.type !== "text") throw new Error("Reasoner must return a JSON text result");
        const answer = object(JSON.parse(content.text));
        const invocation = object(object(answer.decision).invocation);
        const chosen = offered.find(item => item.id === invocation.capabilityId);
        if (!chosen) throw new Error("Reasoner selected an action outside this graph's available capabilities");
        step = { ...step, reasoning: raw, action: action({ nodeId: chosen.id, input: invocation.input }) };
        break;
      }
      case "decision.merge": break;
      case "decision.guard": {
        if (!step.action) throw new Error("Missing decision");
        const conduct = session.conduct.get(step.iteration);
        if (conduct && !conduct.allowed.includes(step.action.nodeId)) {
          step = { ...step, outcome: "refused", error: `Conduct stage ${conduct.stage.id} does not allow ${step.action.nodeId}` };
          break;
        }
        const allowed = await services.guard(step.action, step);
        if (!allowed.allowed) step = { ...step, outcome: "refused", error: allowed.reason };
        break;
      }
      case "decision.dispatch": {
        if (step.outcome) { port = "bypass"; break; }
        const target = session.graph.nodes.find(node => String(node.id) === step.action?.nodeId) as IHarnessGraphNode | undefined;
        if (!(target instanceof DecisionNode) || !target.isAction || !session.canTraverse(target)) throw new Error("Decision target is not an accessible action node");
        port = String(target.id);
        if (!this.outputChannels(port).length) throw new Error(`Unwired action: ${port}`);
        break;
      }
      case "mcp.call": {
        if (step.action?.nodeId !== String(this.id)) throw new Error("Action reached the wrong node");
        const ref = binding(this);
        let result: McpToolResult;
        try {
          const tools = await session.slots.tools(ref.slot);
          if (!tools.some(tool => tool.name === ref.tool)) throw new SlotUnavailableError(`Tool unavailable: ${ref.slot}.${ref.tool}`);
        } catch (error) {
          step = { ...step, outcome: "unavailable", error: message(error) };
          break;
        }
        services.signal.throwIfAborted();
        session.trace.push({ sessionId: session.input.sessionId, nodeId: String(this.id), iteration: step.iteration,
          output: "mcp.request", value: structuredClone({ ...ref, input: step.action.input }) });
        try {
          result = await session.slots.call(ref.slot, ref.tool, step.action.input);
          session.trace.push({ sessionId: session.input.sessionId, nodeId: String(this.id), iteration: step.iteration,
            output: "mcp.result", value: structuredClone(result) });
          step = { ...step, result, outcome: result.isError ? "tool-error" : "executed" };
        } catch (error) {
          step = { ...step, outcome: error instanceof SlotUnavailableError ? "unavailable" : "indeterminate", error: message(error) };
        }
        break;
      }
      case "decision.observe-after": step = { ...step, after: await services.observe(session.input, session) }; break;
      case "decision.evaluate": {
        const evaluation = await services.evaluate(step);
        if (typeof evaluation.continue !== "boolean" || typeof evaluation.satisfied !== "boolean"
          || typeof evaluation.reason !== "string") throw new Error("Invalid evaluation");
        if (evaluation.satisfied && step.outcome !== "executed") throw new Error("An unsuccessful action cannot certify satisfaction");
        if (evaluation.continue && step.outcome === "indeterminate") throw new Error("Indeterminate effects require reconciliation before continuing");
        step = { ...step, evaluation };
        packet = { ...packet, continue: evaluation.continue };
        break;
      }
      case "decision.record":
        await services.record?.(step, session.input.sessionId,
          session.trace.filter(event => event.iteration === step.iteration));
        session.steps.push(structuredClone(step));
        break;
      case "decision.end": {
        const status = packet.terminal ?? (packet.continue ? "budget-exhausted" : "completed");
        const steps = step.iteration > session.steps.length ? [...session.steps, step] : session.steps;
        session.report = { sessionId: session.input.sessionId, status, steps: structuredClone(steps),
          terminalNodeId: String(this.id),
          ...(packet.error ? { error: packet.error } : {}) };
        break;
      }
      default: throw new Error(`Unknown executable resolver: ${this.resolver}`);
    }
    return { port, packet: { ...packet, step } };
  }
}
