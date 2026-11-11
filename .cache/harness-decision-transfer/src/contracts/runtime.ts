import type { McpClient } from "@cyanmycelium/mcp-core/client";
import type { IHarnessGraph, JsonValue, TriggerKind } from "./graph.js";

/** Le runtime ne peut pas être configuré sans son rattachement au broker. */
export interface IHarnessRuntimeOptions {
  readonly broker: McpClient;
  readonly graph: IHarnessGraph;
}

export interface ICorrelation {
  readonly eventId: string;
  readonly runId: string;
  readonly attemptId: string;
  readonly sessionId: string;
  readonly branchId: string;
}

export interface IExternalEvent {
  readonly id: string;
  readonly kind: TriggerKind;
  readonly source: string;
  readonly occurredAt: string;
  readonly payload: JsonValue;
  readonly correlation?: ICorrelation;
  readonly replyTo?: string;
}

export interface ICapabilityBinding {
  readonly needId: string;
  readonly slot: string;
  readonly contract: string;
  readonly resourceScope: string;
  /** Identité de connexion native du provider, pas une révision inventée du catalogue. */
  readonly providerConnectedSince: string;
}

export interface IContextPacket {
  readonly correlation: ICorrelation;
  readonly graphVersion: string;
  readonly contextVersion: number;
  readonly data: Readonly<Record<string, JsonValue>>;
  readonly provenance: readonly string[];
}

export interface IReasonerSessionRef {
  readonly slot: string;
  readonly sessionId: string;
  readonly version: number;
  readonly checkpointId?: string;
}

/** État durable candidat. Ce n'est pas encore un checkpoint complet du runtime. */
export interface ISessionContext {
  readonly packet: IContextPacket;
  readonly parentSessionId?: string;
  readonly bindings: readonly ICapabilityBinding[];
  readonly reasoners: readonly IReasonerSessionRef[];
}

/** Attaché à la session Core ; jamais sérialisé dans cache/history. */
export interface IRuntimeAttachments {
  /** Client natif connecté au slot _broker sous l'identité du harness. */
  readonly broker: McpClient;
  readonly signal: AbortSignal;
  readonly services: ReadonlyMap<string, unknown>;
}
