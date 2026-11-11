import type { JsonValue } from "../../contracts/graph.js";
import type { ICapabilityBinding, ICorrelation } from "../../contracts/runtime.js";

export type PreservationPolicy =
  | { readonly mode: "none" }
  | { readonly mode: "cache"; readonly required: boolean; readonly ttlMs: number }
  | { readonly mode: "history"; readonly required: boolean }
  | { readonly mode: "cache+history"; readonly required: boolean; readonly ttlMs: number };

export interface IReasonerSessionOptions {
  readonly correlation: ICorrelation;
  readonly profile: string;
  readonly initialContext: JsonValue;
  readonly preservation: PreservationPolicy;
  readonly storageBindings: readonly ICapabilityBinding[];
}

export interface IReasonerSession {
  readonly id: string;
  readonly version: number;
}

/** L'état est produit par l'adaptateur modèle, sans secret ni handle vivant. */
export interface IReasonerSnapshot {
  readonly format: "reasoner-session.v1";
  readonly checkpointId: string;
  readonly sessionId: string;
  readonly version: number;
  readonly correlation: ICorrelation;
  readonly createdAt: string;
  readonly profile: string;
  readonly adapter: string;
  readonly adapterStateVersion: string;
  readonly context: JsonValue;
  readonly adapterState: JsonValue;
}

/** Interface interne au slot reasoner ; adaptateurs MCP injectés par session. */
export interface IReasonerSessionStore {
  /** expectedVersion=null signifie création. Une sauvegarde acquittée est lisible. */
  saveSnapshot(snapshot: IReasonerSnapshot, expectedVersion: number | null, signal: AbortSignal): Promise<void>;
  loadSnapshot(checkpointId: string, signal: AbortSignal): Promise<IReasonerSnapshot | null>;
  /** Effacement explicite, indépendant de la fermeture de la session active. */
  deleteSnapshot(checkpointId: string, signal: AbortSignal): Promise<void>;
}

export interface IReasonerJournal {
  append(event: {
    readonly id: string;
    readonly sessionId: string;
    readonly sequence: number;
    readonly time: string;
    readonly value: JsonValue;
  }, signal: AbortSignal): Promise<void>;
}

/** Surface cible du slot. Aucun ordre de parcours métier n'est défini ici. */
export interface IReasonerSlot {
  open(options: IReasonerSessionOptions, signal: AbortSignal): Promise<IReasonerSession>;
  update(session: IReasonerSession, patch: JsonValue, signal: AbortSignal): Promise<IReasonerSession>;
  call(session: IReasonerSession, request: JsonValue, signal: AbortSignal): Promise<{
    readonly session: IReasonerSession;
    readonly response: JsonValue;
  }>;
  checkpoint(session: IReasonerSession, signal: AbortSignal): Promise<IReasonerSnapshot>;
  restore(checkpointId: string, options: IReasonerSessionOptions, signal: AbortSignal): Promise<IReasonerSession>;
  close(session: IReasonerSession, signal: AbortSignal): Promise<void>;
}
