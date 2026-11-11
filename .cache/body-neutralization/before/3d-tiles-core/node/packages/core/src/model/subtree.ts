import type { NonEmptyArray, IRootProperty } from "./common";
import type { MetadataComponentType, IMetadataEntity, MetadataValue } from "./metadata";

export interface IAvailability extends IRootProperty {
    constant?: 0 | 1;
    bitstream?: number;
    availableCount?: number;
}

export interface ISubtreeBuffer extends IRootProperty {
    uri?: string;
    byteLength: number;
}

export interface ISubtreeBufferView extends IRootProperty {
    buffer: number;
    byteOffset?: number;
    byteLength: number;
}

export interface IPropertyTableProperty extends IRootProperty {
    values: number;
    arrayOffsets?: number;
    stringOffsets?: number;
    arrayOffsetType?: "UINT8" | "UINT16" | "UINT32" | "UINT64";
    stringOffsetType?: "UINT8" | "UINT16" | "UINT32" | "UINT64";
    offset?: MetadataValue;
    scale?: MetadataValue;
    max?: MetadataValue;
    min?: MetadataValue;
}

export interface IPropertyTable extends IRootProperty {
    name?: string;
    class: string;
    count: number;
    properties?: Record<string, IPropertyTableProperty>;
}

export interface ISubtree extends IRootProperty {
    buffers?: NonEmptyArray<ISubtreeBuffer>;
    bufferViews?: NonEmptyArray<ISubtreeBufferView>;
    propertyTables?: NonEmptyArray<IPropertyTable>;
    tileAvailability: IAvailability;
    contentAvailability?: NonEmptyArray<IAvailability>;
    childSubtreeAvailability: IAvailability;
    tileMetadata?: number;
    contentMetadata?: NonEmptyArray<number>;
    subtreeMetadata?: IMetadataEntity;
}

/** Retained as a named alias for clients that map binary metadata components. */
export type PropertyTableComponentType = MetadataComponentType;
