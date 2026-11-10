import type { JsonValue } from "../contracts/graph.js";
import type { IDecisionReport } from "../decision/contracts.js";

export interface IDelegationRequest {
  readonly parentSessionId: string;
  readonly childSessionId: string;
  readonly attemptId: string;
  readonly role: string;
  readonly depth: number;
  readonly objective: string;
  readonly context: JsonValue;
}
export interface IDelegationResult {
  readonly parentSessionId: string;
  readonly childSessionId: string;
  readonly attemptId: string;
  readonly delegateId: string;
  readonly report: IDecisionReport;
}
