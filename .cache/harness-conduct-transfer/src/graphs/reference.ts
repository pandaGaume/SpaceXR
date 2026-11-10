import referenceDocument from "./reference.json" with { type: "json" };
import type { IHarnessGraphFactory } from "../contracts/factory.js";
import type { IHarnessGraph } from "../contracts/graph.js";
import { loadHarnessGraph } from "../graph/load.js";

/** La topologie est définie dans le JSON, jamais reconstruite dans ce module. */
export function buildReferenceGraph(factory: IHarnessGraphFactory): IHarnessGraph {
  return loadHarnessGraph(JSON.stringify(referenceDocument), factory);
}
