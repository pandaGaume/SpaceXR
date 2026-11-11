import { cloneable, type ISession, type IChannelDelivery } from "@spiky-panda/core";
import { HarnessLink } from "../graph/links.js";
import type { AgentSession } from "./session.js";
import type { IDecisionPacket } from "../decision/nodes.js";

/** Tags a declared session transition and its result path, not an independent driver. */
export class DelegationLink extends HarnessLink {
  @cloneable public readonly delegateId: string = "";

  public prepareDelivery(value: unknown, native: ISession): IChannelDelivery | null {
    if (this.mode !== "result") return { value };
    const session = native as AgentSession;
    const packet = value as IDecisionPacket | undefined;
    const result = packet?.delegation;
    const attempt = result && session.delegations?.get(result.attemptId);
    if (!result || !attempt?.result || attempt.returned || attempt.deliveryQueued
      || result.parentSessionId !== session.input.sessionId || result.childSessionId !== attempt.request.childSessionId
      || result.delegateId !== this.delegateId || attempt.joinNodeId !== String(this.ofin?.id)
      || packet?.step?.iteration !== session.steps.length + 1) {
      session.trace?.push({ sessionId: session.input?.sessionId ?? "unknown", nodeId: this.delegateId,
        iteration: packet?.step?.iteration ?? 0, output: "delegation.ignored", value: { attemptId: result?.attemptId ?? null } });
      return null;
    }
    attempt.deliveryQueued = true;
    return { value: { ...packet, delegation: attempt.result } };
  }
}
