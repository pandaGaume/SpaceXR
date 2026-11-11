import { Channel, cloneable } from "@spiky-panda/core";
import type { IHarnessLink } from "../contracts/graph.js";

/** Créé sans extrémités ; Core restaure data puis raccorde les ports et nœuds. */
export class HarnessLink extends Channel implements IHarnessLink {
  @cloneable public readonly mode: IHarnessLink["mode"] = "continue";
  @cloneable public readonly context: IHarnessLink["context"] = "project";
}
