import type {
    IContent,
    IMetadataClass,
    IMetadataClassProperty,
    IMetadataEntity,
    IMetadataSchema,
    MetadataValue,
    ITile,
    ITileset,
} from "@spacexr/3d-tiles-core";

export type MetadataDiagnosticSeverity = "info" | "warning" | "error";

export interface IMetadataDiagnostic {
    code: string;
    severity: MetadataDiagnosticSeverity;
    message: string;
    path: string;
    documentUri: string;
}

export type MetadataScopeKind = "tileset" | "subtree" | "ancestor-tile" | "tile" | "group" | "content" | "feature";

export interface IRuntimeFeatureMetadata {
    id?: string | number;
    entity: IMetadataEntity;
    schema?: IMetadataSchema;
    sourceUri?: string;
}

export interface IMetadataDocumentContext {
    uri: string;
    tileset: ITileset;
    schema?: IMetadataSchema;
    schemaUri?: string;
    diagnostics: readonly IMetadataDiagnostic[];
}

export interface IResolvedMetadataProperty {
    id: string;
    definition?: IMetadataClassProperty;
    semantic?: string;
    rawValue?: MetadataValue;
    value?: MetadataValue;
    fromDefault: boolean;
    isNoData: boolean;
}

export interface IResolvedMetadataEntity {
    scope: MetadataScopeKind;
    ownerId: string;
    documentUri: string;
    featureId?: string | number;
    entity: IMetadataEntity;
    classId: string;
    classDefinition?: IMetadataClass;
    properties: Readonly<Record<string, IResolvedMetadataProperty>>;
    diagnostics: readonly IMetadataDiagnostic[];
}

export interface IMetadataAncestorInput {
    id: string;
    tile: ITile;
    document: IMetadataDocumentContext;
}

/**
 * Metadata scopes are deliberately kept separate. The 3D Tiles specification
 * does not define implicit inheritance between tileset, group, tile, content
 * and feature metadata.
 */
export interface IMetadataSnapshot {
    document: IMetadataDocumentContext;
    tileId: string;
    tile: ITile;
    content?: IContent;
    scopes: readonly IResolvedMetadataEntity[];
    diagnostics: readonly IMetadataDiagnostic[];
}

export interface IMetadataResolutionInput {
    document: IMetadataDocumentContext;
    tileId: string;
    tile: ITile;
    ancestors: readonly IMetadataAncestorInput[];
    subtree?: { id: string; entity: IMetadataEntity; documentUri: string };
    content?: IContent;
    features?: readonly IRuntimeFeatureMetadata[];
}

export type MetadataScopeOrder = readonly MetadataScopeKind[];
