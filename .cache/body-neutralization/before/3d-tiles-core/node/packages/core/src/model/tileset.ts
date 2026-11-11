import type { IBoundingVolume } from "./bounding-volume";
import type { NonEmptyArray, IRootProperty } from "./common";
import type { IImplicitTiling } from "./implicit-tiling";
import type { IGroupMetadata, ILegacyPropertyRange, IMetadataEntity, IMetadataSchema, IStatistics } from "./metadata";

export type TileTransform = [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];

export type Refinement = "ADD" | "REPLACE";

export interface IAsset extends IRootProperty {
    version: string;
    tilesetVersion?: string;
}

export interface IContent extends IRootProperty {
    boundingVolume?: IBoundingVolume;
    uri: string;
    metadata?: IMetadataEntity;
    group?: number;
}

export interface ITile extends IRootProperty {
    boundingVolume: IBoundingVolume;
    viewerRequestVolume?: IBoundingVolume;
    geometricError: number;
    refine?: Refinement;
    transform?: TileTransform;
    content?: IContent;
    contents?: NonEmptyArray<IContent>;
    metadata?: IMetadataEntity;
    implicitTiling?: IImplicitTiling;
    children?: NonEmptyArray<ITile>;
}

export interface ITileset extends IRootProperty {
    asset: IAsset;
    properties?: Record<string, ILegacyPropertyRange>;
    schema?: IMetadataSchema;
    schemaUri?: string;
    statistics?: IStatistics;
    groups?: NonEmptyArray<IGroupMetadata>;
    metadata?: IMetadataEntity;
    geometricError: number;
    root: ITile;
    extensionsUsed?: NonEmptyArray<string>;
    extensionsRequired?: NonEmptyArray<string>;
}
