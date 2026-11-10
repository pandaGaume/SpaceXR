import type { IBoundingVolume, IContent, ITileset } from "@spacexr/3d-tiles-core";

import type { IMetadataSnapshot, IRuntimeFeatureMetadata } from "../metadata/types";
import type { IRuntimeResourceCost } from "../runtime/cache";
import type { ITileContext } from "../runtime/contracts";

export interface IContentLoadContext<TSpatial> extends ITileContext<TSpatial> {
    contentId: string;
    content: IContent;
    uri: string;
}

export type ContentLoadResult<TContentHandle> =
    | {
          kind: "renderable";
          handle: TContentHandle;
          mediaType?: string;
          featureMetadata?: readonly IRuntimeFeatureMetadata[];
          /** Stable adapter cache identity when several tiles share a renderable resource. */
          cacheKey?: string;
          /** Adapter-reported footprint used by the runtime cache budgets and statistics. */
          cost?: IRuntimeResourceCost;
          /**
           * Bounding volume of the whole tile measured from the loaded content, for example the
           * height range of a DEM tile. The runtime re-derives the tile spatial state from it, so
           * culling and refinement use the measured extent instead of the declared one. The
           * serialized tile is not modified. A tile with several contents must report a volume
           * enclosing all of them.
           */
          /** A volume measured on the content. A function is evaluated again when the vertical scale changes. */
          tileBoundingVolume?: IBoundingVolume | (() => IBoundingVolume);
          /**
           * Lowest and highest heights measured on the content, such as a DEM tile, over the reference surface, in metres.
           * Evaluated again when the vertical scale changes, whose factor it includes.
           */
          tileHeightRange?: () => readonly [number, number];
      }
    | {
          kind: "external-tileset";
          tileset: ITileset;
          documentUri?: string;
          baseUri?: string;
      }
    | { kind: "empty" };

export interface IContentPresentationContext<TSpatial, TContentHandle> extends IContentLoadContext<TSpatial> {
    handle: TContentHandle;
    metadata: IMetadataSnapshot;
}

/**
 * Renderer adaptation port. A Babylon adapter may return AssetContainer, a
 * Three.js adapter may return Object3D, and another adapter may publish a GPU
 * resource handle. Content probing and glTF decoding stay outside the runtime.
 * Implicit coordinates and spatial state are present in the load context, so
 * terrain adapters may instance a shared grid and bind a DEM texture or shader.
 */
export interface ITileContentAdapter<TSpatial, TContentHandle> {
    load(context: IContentLoadContext<TSpatial>, signal: AbortSignal): Promise<ContentLoadResult<TContentHandle>>;
    attach(context: IContentPresentationContext<TSpatial, TContentHandle>): void | Promise<void>;
    detach(context: IContentPresentationContext<TSpatial, TContentHandle>): void | Promise<void>;
    dispose?(context: IContentPresentationContext<TSpatial, TContentHandle>): void | Promise<void>;
}
