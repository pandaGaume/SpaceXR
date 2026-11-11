import type { McpTool, McpToolResult } from "@cyanmycelium/mcp-core";
import type { ISession } from "@spiky-panda/core";
import type { JsonValue } from "../contracts/graph.js";
import type { IBrokerSlotsOptions } from "../broker/slots.js";

export interface IDecisionInput {
  readonly sessionId: string;
  readonly intention: { readonly id: string; readonly description: string; readonly parameters: JsonValue };
}

/** A graph action binding expresses a need, never a provider catalogue. */
export interface IMcpActionBinding { readonly slot: string; readonly tool: string }
export interface IDecisionAction { readonly nodeId: string; readonly input: Record<string, unknown> }
export interface IDecisionCapability extends IMcpActionBinding {
  readonly id: string;
  readonly schema: McpTool;
}
export type DecisionOutcome = "executed" | "refused" | "tool-error" | "unavailable" | "indeterminate";
export interface IDecisionEvaluation {
  readonly continue: boolean;
  readonly satisfied: boolean;
  readonly reason: string;
}
export interface IDecisionStep {
  readonly iteration: number;
  readonly observation: JsonValue;
  readonly context: JsonValue;
  readonly action?: IDecisionAction;
  readonly reasoning?: McpToolResult;
  readonly result?: McpToolResult;
  readonly outcome?: DecisionOutcome;
  readonly after?: JsonValue;
  readonly evaluation?: IDecisionEvaluation;
  readonly error?: string;
}
export interface IDecisionTrace {
  readonly sessionId: string;
  readonly nodeId: string;
  readonly iteration: number;
  readonly output: string;
  readonly value: unknown;
}
export interface IDecisionReport {
  readonly sessionId: string;
  readonly status: "completed" | "budget-exhausted" | "failed" | "cancelled";
  readonly steps: readonly IDecisionStep[];
  readonly error?: string;
}

/** Operations only. Their sequencing and repetition are graph relations. */
export interface IDecisionServices extends IBrokerSlotsOptions {
  readonly signal: AbortSignal;
  observe(input: IDecisionInput, session: ISession): Promise<JsonValue>;
  context?(observation: JsonValue, input: IDecisionInput): Promise<JsonValue>;
  lookup?(context: JsonValue, input: IDecisionInput): Promise<IDecisionAction | null>;
  guard(action: IDecisionAction, step: IDecisionStep): Promise<{ readonly allowed: boolean; readonly reason: string }>;
  evaluate(step: IDecisionStep): Promise<IDecisionEvaluation>;
  /** Optional durable sink, called by the graph's record node before it continues. */
  record?(step: IDecisionStep, sessionId: string, trace: readonly IDecisionTrace[]): Promise<void>;
}
