/** Evidence is supplied by observed results, never inferred from an agent's claim. */
export type IConductFacts = Readonly<Record<string, boolean | number | null>>;
export type ConductTruth = boolean | null;
export interface IConductStage {
  readonly id: string;
  readonly goal: string;
  readonly tools: readonly string[];
}
export interface IConductClosure {
  readonly gateId: string;
  readonly tools: readonly string[];
  readonly reason: string;
  readonly unknown: boolean;
}
export interface IConductSnapshot {
  readonly iteration: number;
  readonly stage: IConductStage;
  readonly allowed: readonly string[];
  readonly closed: readonly IConductClosure[];
  readonly facts: IConductFacts;
}
