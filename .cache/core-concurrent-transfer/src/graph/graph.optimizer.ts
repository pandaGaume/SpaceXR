import type { IRuntimeGraph } from "../execution/execution.interfaces";

/** A graph transformation applied before runtime execution. */
export interface IOptimizer<TGraph = IRuntimeGraph> {
    /** Return the transformed graph; implementations must not mutate the input graph. */
    optimize(graph: TGraph): TGraph;
}
