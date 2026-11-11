import type { ILinkRegistry, INodeRegistry } from "@spiky-panda/core";

/** Les factories de nœuds et de liens sont les registres natifs de Core. */
export interface IHarnessGraphFactory {
  readonly nodes: INodeRegistry;
  readonly links: ILinkRegistry;
}
