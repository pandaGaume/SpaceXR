import document from "./decision.json" with { type: "json" };
import type { IHarnessGraphFactory } from "../contracts/factory.js";
import type { IHarnessGraph } from "../contracts/graph.js";
import { loadHarnessGraph } from "../graph/load.js";

/** All branches, MCP action edges and loop feedback are in the JSON document. */
export function buildDecisionGraph(factory: IHarnessGraphFactory): IHarnessGraph {
  return loadHarnessGraph(JSON.stringify(document), factory);
}
