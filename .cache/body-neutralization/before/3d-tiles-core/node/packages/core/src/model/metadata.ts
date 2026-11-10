import type { NonEmptyArray, IRootProperty } from "./common";

export type MetadataType = "SCALAR" | "VEC2" | "VEC3" | "VEC4" | "MAT2" | "MAT3" | "MAT4" | "STRING" | "BOOLEAN" | "ENUM";

export type MetadataComponentType = "INT8" | "UINT8" | "INT16" | "UINT16" | "INT32" | "UINT32" | "INT64" | "UINT64" | "FLOAT32" | "FLOAT64";

export type MetadataIntegerComponentType = Exclude<MetadataComponentType, "FLOAT32" | "FLOAT64">;

export type MetadataScalarValue = number | string | boolean;

export type MetadataValue = MetadataScalarValue | MetadataValue[];

export interface IMetadataClassProperty extends IRootProperty {
    name?: string;
    description?: string;
    type: MetadataType;
    componentType?: MetadataComponentType;
    enumType?: string;
    array?: boolean;
    count?: number;
    normalized?: boolean;
    offset?: MetadataValue;
    scale?: MetadataValue;
    max?: MetadataValue;
    min?: MetadataValue;
    required?: boolean;
    noData?: MetadataValue;
    default?: MetadataValue;
    semantic?: string;
}

export interface IMetadataClass extends IRootProperty {
    name?: string;
    description?: string;
    properties?: Record<string, IMetadataClassProperty>;
}

export interface IMetadataEnumValue extends IRootProperty {
    name: string;
    description?: string;
    value: number;
}

export interface IMetadataEnum extends IRootProperty {
    name?: string;
    description?: string;
    valueType?: MetadataIntegerComponentType;
    values: NonEmptyArray<IMetadataEnumValue>;
}

export interface IMetadataSchema extends IRootProperty {
    id: string;
    name?: string;
    description?: string;
    version?: string;
    classes?: Record<string, IMetadataClass>;
    enums?: Record<string, IMetadataEnum>;
}

export interface IMetadataEntity extends IRootProperty {
    class: string;
    properties?: Record<string, MetadataValue>;
}

export interface IGroupMetadata extends IMetadataEntity {
    name?: string;
    description?: string;
}

export interface IPropertyStatistics extends IRootProperty {
    min?: MetadataValue;
    max?: MetadataValue;
    mean?: number;
    median?: number;
    standardDeviation?: number;
    variance?: number;
    sum?: number;
    occurrences?: Record<string, number>;
}

export interface IClassStatistics extends IRootProperty {
    count: number;
    properties?: Record<string, IPropertyStatistics>;
}

export interface IStatistics extends IRootProperty {
    classes?: Record<string, IClassStatistics>;
    enums?: Record<string, Record<string, number>>;
}

export interface ILegacyPropertyRange extends IRootProperty {
    minimum: number;
    maximum: number;
}
