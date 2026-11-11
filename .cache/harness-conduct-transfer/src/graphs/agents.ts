import document from "./agents.json" with { type: "json" };
import type { IHarnessGraphFactory } from "../contracts/factory.js";
import type { IHarnessGraph } from "../contracts/graph.js";
import { loadHarnessGraph } from "../graph/load.js";

/** Conduct and delegation are regions of this graph, not separately driven graphs. */
export function buildAgentGraph(factory: IHarnessGraphFactory): IHarnessGraph {
  return loadHarnessGraph(JSON.stringify(document), factory);
}
