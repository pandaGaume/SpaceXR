import type { ICameraEventSource } from "./camera";
import type { IImplicitMetadataDecoder, IImplicitSubtreeLoader, IImplicitTileResolver } from "../implicit/types";
import type { ITileContentAdapter } from "./content";
import type { IGlyphPublisher } from "./glyph";
import type { IMetadataSchemaLoader, IRuntimeUriResolver, ITilesetLoader } from "./resource";
import type { ISpatialMetric } from "./spatial";
import type { IRuntimeTelemetry } from "./telemetry";
import type { ITileActivationAdapter, ITilePresentationAdapter } from "../pipeline/ports";

export * from "./camera";
export * from "./content";
export * from "./glyph";
export * from "./resource";
export * from "./spatial";
export * from "./telemetry";

export interface IRuntimeAdapter<TCamera, TSpatial, TContentHandle, TGlyphHandle> {
    tilesets: ITilesetLoader;
    /** Legacy combined adapter. New integrations should use activation and presentation. */
    content?: ITileContentAdapter<TSpatial, TContentHandle>;
    activation?: ITileActivationAdapter<TSpatial, TContentHandle, TGlyphHandle>;
    presentation?: ITilePresentationAdapter<TSpatial, TContentHandle, TGlyphHandle>;
    spatial: ISpatialMetric<TCamera, TSpatial>;
    camera?: ICameraEventSource<TCamera>;
    glyphs?: IGlyphPublisher<TSpatial, TContentHandle, TGlyphHandle>;
    metadataSchemas?: IMetadataSchemaLoader;
    telemetry?: IRuntimeTelemetry;
    uri?: IRuntimeUriResolver;
    subtrees?: IImplicitSubtreeLoader;
    implicitTiles?: IImplicitTileResolver;
    implicitMetadata?: IImplicitMetadataDecoder;
}
