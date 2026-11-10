import type { IChannel, IPortDescriptor, IRuntimeGraph, IRuntimeNode } from "@spiky-panda/core";

/** Le métamodèle de graphe et d'exécution est celui de Core. */
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type TriggerKind =
  | "question" | "procedure-request" | "alarm" | "telemetry"
  | "equipment-discovered" | "external-response" | "authorization-result"
  | "async-result" | "deadline" | "source-invalidated" | "cancel";

export interface ICapabilityNeed {
  readonly id: string;
  readonly contract: string;
  readonly operations: readonly string[];
  readonly presence: "required" | "optional";
  readonly resourceScope: string;
}

export interface IHarnessGraphNode extends IRuntimeNode {
  readonly region: string;
  /** Clé de resolver, aucun état d'exécution ni fonction d'orchestration. */
  readonly resolver: string;
  readonly inputPorts: readonly IPortDescriptor[];
  readonly outputPorts: readonly IPortDescriptor[];
  readonly activation: "each-message" | "all-correlated-inputs";
  readonly needs: readonly ICapabilityNeed[];
  readonly config: JsonValue;
}

export interface IHarnessLink extends IChannel {
  /** spawn ouvre une session enfant ; result revient à la session corrélée. */
  readonly mode: "continue" | "spawn" | "result";
  readonly context: "project" | "result-only";
}

/** Graphe Core spécialisé : identité de version et points d'entrée du harness. */
export interface IHarnessGraph extends IRuntimeGraph<IHarnessGraphNode, IHarnessLink> {
  readonly version: string;
  readonly entries: Readonly<Record<TriggerKind, string>>;
}
