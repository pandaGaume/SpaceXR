import { cloneable, RuntimeNode, type IPortDescriptor } from "@spiky-panda/core";
import type { ICapabilityNeed, IHarnessGraphNode, JsonValue } from "../contracts/graph.js";

/** Nœud Core restauré depuis data par serialize/deserialize natifs. */
export class HarnessGraphNode extends RuntimeNode implements IHarnessGraphNode {
  @cloneable public readonly inputPorts: readonly IPortDescriptor[] = [];
  @cloneable public readonly outputPorts: readonly IPortDescriptor[] = [];
  @cloneable public readonly region: string = "";
  @cloneable public readonly resolver: string = "";
  @cloneable public readonly activation: IHarnessGraphNode["activation"] = "each-message";
  @cloneable public readonly needs: readonly ICapabilityNeed[] = [];
  @cloneable public readonly config: JsonValue = {};

  public override fire(): never {
    throw new Error("Resolver non implémenté dans la proposition : " + this.resolver);
  }
}
