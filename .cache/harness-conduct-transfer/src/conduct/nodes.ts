import type { ISession } from "@spiky-panda/core";
import { HarnessGraphNode } from "../graph/nodes.js";
import { DecisionSession } from "../decision/session.js";
import type { IDecisionPacket } from "../decision/nodes.js";
import type { ConductTruth, IConductClosure, IConductStage } from "./contracts.js";

interface IConductToken {
  readonly sessionId: string;
  readonly packet: IDecisionPacket;
  readonly truth: ConductTruth;
  readonly stages?: readonly IConductStage[];
  readonly closed?: readonly IConductClosure[];
}
function configOf(node: ConductNode): Record<string, unknown> {
  if (!node.config || typeof node.config !== "object" || Array.isArray(node.config)) throw new Error("Conduct config expected");
  return node.config as Record<string, unknown>;
}
function names(value: unknown): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== "string" || !item)) throw new Error("Nonempty tool names expected");
  return [...new Set(value as string[])];
}
const and = (values: readonly ConductTruth[]): ConductTruth => values.includes(false) ? false : values.includes(null) ? null : true;
const or = (values: readonly ConductTruth[]): ConductTruth => values.includes(true) ? true : values.includes(null) ? null : false;

/** Conduct circuits run in the agent's existing Core session and graph. */
export class ConductNode extends HarnessGraphNode {
  public override isReady(session: ISession): boolean {
    return session instanceof DecisionSession && !session.report && session.canTraverse(this)
      && this.inputPorts.length > 0
      && this.inputPorts.every(port => this.inputChannels(port.slot).some(link => session.linkStateOf(link)?.ready));
  }
  public override fire(): never { throw new Error("Conduct nodes require Core runAsync"); }
  public override async fireAsync(native: ISession): Promise<void> {
    if (!(native instanceof DecisionSession)) throw new Error("DecisionSession required");
    const session = native;
    const inputs = new Map(this.inputPorts.map(port => [String(port.slot), this.consumeLatest(session, port.slot)]));
    const incoming = [...inputs.values()][0] as IDecisionPacket | IConductToken;
    const packet = this.resolver === "conduct.ingress" ? incoming as IDecisionPacket : (incoming as IConductToken).packet;
    try {
      session.services.signal.throwIfAborted();
      const config = configOf(this);
      if (this.resolver === "conduct.ingress") {
        if (!session.services.conductEvidence) throw new Error("Observed conduct evidence service is required");
        const facts = await session.services.conductEvidence(packet.step, session.input);
        if (Object.values(facts).some(value => value !== null && typeof value !== "boolean"
          && (typeof value !== "number" || !Number.isFinite(value)))) throw new Error("Invalid observed conduct evidence");
        const token: IConductToken = { sessionId: session.input.sessionId,
          packet: { ...packet, facts: structuredClone(facts) }, truth: true };
        this.publishAll(session, "tick", token);
        session.trace.push({ sessionId: session.input.sessionId, nodeId: String(this.id), iteration: packet.step.iteration,
          output: "evidence", value: structuredClone(facts) });
        return;
      }
      const tokens = [...inputs.values()] as IConductToken[];
      if (tokens.some(token => token.sessionId !== session.input.sessionId
        || token.packet.step.iteration !== packet.step.iteration)) throw new Error("Conduct inputs belong to different sessions or iterations");
      const base = tokens[0]!;
      const send = (slot: string, truth: ConductTruth, more: Partial<IConductToken> = {}): void => {
        this.publishAll(session, slot, { ...base, truth, stages: [], closed: [], ...more } satisfies IConductToken);
        session.trace.push({ sessionId: session.input.sessionId, nodeId: String(this.id), iteration: packet.step.iteration,
          output: slot, value: { truth, ...structuredClone(more) } });
      };
      switch (this.resolver) {
        case "conduct.evidence": {
          const fact = packet.facts?.[String(config.proof)];
          if (fact !== undefined && fact !== null && typeof fact !== "boolean") throw new Error("Boolean conduct proof expected");
          send("value", fact ?? null);
          break;
        }
        case "conduct.bound": {
          const value = packet.facts?.[String(config.count)];
          if (typeof config.atLeast !== "number" || !Number.isFinite(config.atLeast)) throw new Error("Finite conduct bound required");
          if (value !== undefined && value !== null && typeof value !== "number") throw new Error("Numeric conduct count expected");
          send("value", value === undefined || value === null ? null : value >= config.atLeast);
          break;
        }
        case "conduct.not": send("value", base.truth === null ? null : !base.truth); break;
        case "conduct.all": send("value", and(tokens.map(token => token.truth))); break;
        case "conduct.any": send("value", or(tokens.map(token => token.truth))); break;
        case "conduct.stage": {
          const entered = (inputs.get("entered") as IConductToken).truth;
          const passes = (inputs.get("passes") as IConductToken | undefined)?.truth ?? false;
          if (typeof config.goal !== "string" || !config.goal) throw new Error("Conduct stage goal required");
          const active = entered === true && passes !== true;
          const stage: IConductStage = { id: String(this.id), goal: config.goal, tools: names(config.tools) };
          send("next", and([entered, passes]));
          send("view", active, { stages: active ? [stage] : [] });
          break;
        }
        case "conduct.gate": {
          const tools = names(config.tools);
          if (typeof config.reason !== "string" || !tools.length) throw new Error("Conduct gate tools and reason required");
          send("view", base.truth, { closed: base.truth === false ? [] : [{ gateId: String(this.id), tools,
            reason: config.reason, unknown: base.truth === null }] });
          break;
        }
        case "conduct.commit": {
          const stages = tokens.flatMap(token => token.stages ?? []);
          const closed = tokens.flatMap(token => token.closed ?? []);
          if (stages.length !== 1) throw new Error(`Conduct requires exactly one active stage, received ${stages.length}`);
          if (session.conduct.has(packet.step.iteration)) throw new Error("Conduct snapshot already committed for this iteration");
          const forbidden = new Set(closed.flatMap(gate => gate.tools));
          const snapshot = { iteration: packet.step.iteration, stage: stages[0]!, closed,
            allowed: stages[0]!.tools.filter(tool => !forbidden.has(tool)), facts: packet.facts ?? {} };
          session.conduct.set(packet.step.iteration, structuredClone(snapshot));
          session.trace.push({ sessionId: session.input.sessionId, nodeId: String(this.id),
            iteration: packet.step.iteration, output: "conduct", value: structuredClone(snapshot) });
          this.publishAll(session, "out", packet);
          break;
        }
        default: throw new Error(`Unknown conduct resolver: ${this.resolver}`);
      }
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      session.trace.push({ sessionId: session.input.sessionId, nodeId: String(this.id), iteration: packet.step.iteration,
        output: "fault", value: errorText });
      this.publishAll(session, "fault", { ...packet, continue: false,
        terminal: session.services.signal.aborted ? "cancelled" : "failed", error: errorText } satisfies IDecisionPacket);
    }
  }
}
