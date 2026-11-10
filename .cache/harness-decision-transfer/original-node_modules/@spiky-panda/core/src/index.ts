import "reflect-metadata";

export * from "./types";
export * from "./math";
export * from "./geometry";
export * from "./graph";
export * from "./execution";
export * from "./document";
export * from "./sim";
export * from "./compute";
export * from "./dsp";
export * from "./provenance";
export * from "./quantization";
export * from "./neuralnetwork";
export * from "./utils";
export * from "./metrics";
export * from "./events";

// ensure that the global namespace is defined
if (typeof window !== "undefined") {
    (<any>window).SPIKYPANDA = (<any>window).SPIKYPANDA || {};

    // Assign S only if it is not already defined
    if (!(<any>window).S) {
        (<any>window).S = (<any>window).SPIKYPANDA;
    }
}

// The root optimizer contract transforms graphs. Numerical training retains its scoped legacy name.
export type { IOptimizer } from "./graph/graph.optimizer";
export type { IOptimizer as ITrainingOptimizer } from "./neuralnetwork/nn.training";
