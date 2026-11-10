import type {
    IMetadataClassProperty,
    MetadataComponentType,
    IMetadataEntity,
    IMetadataSchema,
    MetadataValue,
} from "@spacexr/3d-tiles-core";

import type {
    IMetadataDiagnostic,
    IMetadataResolutionInput,
    MetadataScopeKind,
    MetadataScopeOrder,
    IMetadataSnapshot,
    IResolvedMetadataEntity,
    IResolvedMetadataProperty,
} from "./types";

const VECTOR_LENGTHS: Readonly<Record<string, number>> = { VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

const INTEGER_RANGES: Readonly<Record<MetadataComponentType, readonly [number, number] | undefined>> = {
    INT8: [-128, 127],
    UINT8: [0, 255],
    INT16: [-32768, 32767],
    UINT16: [0, 65535],
    INT32: [-2147483648, 2147483647],
    UINT32: [0, 4294967295],
    INT64: undefined,
    UINT64: undefined,
    FLOAT32: undefined,
    FLOAT64: undefined,
};

export const DEFAULT_METADATA_SCOPE_ORDER: MetadataScopeOrder = [
    "feature",
    "content",
    "tile",
    "ancestor-tile",
    "subtree",
    "group",
    "tileset",
];

function valuesEqual(left: unknown, right: unknown): boolean {
    if (left === right) return true;
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => valuesEqual(value, right[index]));
}

function valueAt(value: MetadataValue | undefined, index: number): MetadataValue | undefined {
    if (!Array.isArray(value)) return value;
    return value[index];
}

function normalizeNumber(value: number, componentType: MetadataComponentType | undefined): number {
    if (!componentType) return value;
    const range = INTEGER_RANGES[componentType];
    if (!range) return value;
    if (range[0] < 0) return Math.max(value / range[1], -1);
    return value / range[1];
}

function transformValue(value: MetadataValue, definition: IMetadataClassProperty): MetadataValue {
    const transformNumber = (item: number, index: number): number => {
        const normalized = definition.normalized ? normalizeNumber(item, definition.componentType) : item;
        const scale = valueAt(definition.scale, index);
        const offset = valueAt(definition.offset, index);
        return normalized * (typeof scale === "number" ? scale : 1) + (typeof offset === "number" ? offset : 0);
    };

    if (typeof value === "number") return transformNumber(value, 0);
    if (Array.isArray(value)) {
        return value.map((item, index) => (typeof item === "number" ? transformNumber(item, index) : item)) as MetadataValue;
    }
    return value;
}

function validateComponentNumber(value: unknown, definition: IMetadataClassProperty): boolean {
    if (typeof value !== "number" || !Number.isFinite(value)) return false;
    const component = definition.componentType;
    if (!component || component.startsWith("FLOAT")) return true;
    if (!Number.isInteger(value)) return false;
    const range = INTEGER_RANGES[component];
    return !range || (value >= range[0] && value <= range[1]);
}

function isValueValid(value: unknown, definition: IMetadataClassProperty, schema: IMetadataSchema | undefined): boolean {
    if (definition.array) {
        if (!Array.isArray(value)) return false;
        if (definition.count !== undefined && value.length !== definition.count) return false;
        return value.every((item) => isSingleValueValid(item, { ...definition, array: false }, schema));
    }
    return isSingleValueValid(value, definition, schema);
}

function isSingleValueValid(value: unknown, definition: IMetadataClassProperty, schema: IMetadataSchema | undefined): boolean {
    if (definition.type === "BOOLEAN") return typeof value === "boolean";
    if (definition.type === "STRING") return typeof value === "string";
    if (definition.type === "ENUM") {
        if (typeof value !== "string" || !definition.enumType) return false;
        return schema?.enums?.[definition.enumType]?.values.some((candidate) => candidate.name === value) ?? false;
    }
    if (definition.type === "SCALAR") return validateComponentNumber(value, definition);

    const expectedLength = VECTOR_LENGTHS[definition.type];
    return (
        expectedLength !== undefined &&
        Array.isArray(value) &&
        value.length === expectedLength &&
        value.every((item) => validateComponentNumber(item, definition))
    );
}

export class MetadataResolver {
    public resolve(input: IMetadataResolutionInput): IMetadataSnapshot {
        const scopes: IResolvedMetadataEntity[] = [];
        const diagnostics: IMetadataDiagnostic[] = [...input.document.diagnostics];
        const append = (
            scope: MetadataScopeKind,
            ownerId: string,
            entity: IMetadataEntity | undefined,
            path: string,
            featureId?: string | number,
        ): void => {
            if (!entity) return;
            const resolved = this.resolveEntity(input.document.uri, input.document.schema, scope, ownerId, entity, path, featureId);
            scopes.push(resolved);
            diagnostics.push(...resolved.diagnostics);
        };

        append("tileset", input.document.uri, input.document.tileset.metadata, "$.metadata");
        if (input.subtree) {
            const resolved = this.resolveEntity(
                input.subtree.documentUri,
                input.document.schema,
                "subtree",
                input.subtree.id,
                input.subtree.entity,
                `${input.subtree.id}.subtreeMetadata`,
            );
            scopes.push(resolved);
            diagnostics.push(...resolved.diagnostics);
        }
        for (const ancestor of input.ancestors) {
            diagnostics.push(...ancestor.document.diagnostics);
            if (ancestor.tile.metadata) {
                const resolved = this.resolveEntity(
                    ancestor.document.uri,
                    ancestor.document.schema,
                    "ancestor-tile",
                    ancestor.id,
                    ancestor.tile.metadata,
                    `${ancestor.id}.metadata`,
                );
                scopes.push(resolved);
                diagnostics.push(...resolved.diagnostics);
            }
        }
        append("tile", input.tileId, input.tile.metadata, `${input.tileId}.metadata`);

        if (input.content?.group !== undefined) {
            const group = input.document.tileset.groups?.[input.content.group];
            if (group) {
                append("group", `${input.document.uri}#group/${input.content.group}`, group, `$.groups[${input.content.group}]`);
            } else {
                diagnostics.push({
                    code: "METADATA_GROUP_OUT_OF_RANGE",
                    severity: "error",
                    message: `Content references missing group ${input.content.group}.`,
                    path: `${input.tileId}.content.group`,
                    documentUri: input.document.uri,
                });
            }
        }

        append("content", `${input.tileId}.content`, input.content?.metadata, `${input.tileId}.content.metadata`);
        for (const feature of input.features ?? []) {
            const resolved = this.resolveEntity(
                feature.sourceUri ?? input.document.uri,
                feature.schema ?? input.document.schema,
                "feature",
                `${input.tileId}.feature/${feature.id ?? scopes.length}`,
                feature.entity,
                `${input.tileId}.features[${String(feature.id ?? scopes.length)}]`,
                feature.id,
            );
            scopes.push(resolved);
            diagnostics.push(...resolved.diagnostics);
        }

        return {
            document: input.document,
            tileId: input.tileId,
            tile: input.tile,
            ...(input.content ? { content: input.content } : {}),
            scopes,
            diagnostics,
        };
    }

    public findBySemantic(
        snapshot: IMetadataSnapshot,
        semantic: string,
        order: MetadataScopeOrder = DEFAULT_METADATA_SCOPE_ORDER,
    ): IResolvedMetadataProperty | undefined {
        for (const scopeKind of order) {
            for (let index = snapshot.scopes.length - 1; index >= 0; index--) {
                const scope = snapshot.scopes[index];
                if (scope?.scope !== scopeKind) continue;
                const property = Object.values(scope.properties).find((candidate) => candidate.semantic === semantic);
                if (property) return property;
            }
        }
        return undefined;
    }

    private resolveEntity(
        documentUri: string,
        schema: IMetadataSchema | undefined,
        scope: MetadataScopeKind,
        ownerId: string,
        entity: IMetadataEntity,
        path: string,
        featureId?: string | number,
    ): IResolvedMetadataEntity {
        const diagnostics: IMetadataDiagnostic[] = [];
        const classDefinition = schema?.classes?.[entity.class];
        if (!schema) {
            diagnostics.push({
                code: "METADATA_SCHEMA_UNAVAILABLE",
                severity: "warning",
                message: `Cannot validate class "${entity.class}" because its schema is unavailable.`,
                path,
                documentUri,
            });
        } else if (!classDefinition) {
            diagnostics.push({
                code: "METADATA_CLASS_UNKNOWN",
                severity: "error",
                message: `Class "${entity.class}" is not declared by schema "${schema.id}".`,
                path: `${path}.class`,
                documentUri,
            });
        }

        const propertyIds = new Set([...Object.keys(classDefinition?.properties ?? {}), ...Object.keys(entity.properties ?? {})]);
        const properties: Record<string, IResolvedMetadataProperty> = {};

        for (const propertyId of propertyIds) {
            const definition = classDefinition?.properties?.[propertyId];
            const rawValue = entity.properties?.[propertyId];
            const isNoData = definition?.noData !== undefined && rawValue !== undefined && valuesEqual(rawValue, definition.noData);
            const fromDefault = (rawValue === undefined || isNoData) && definition?.default !== undefined;
            const sourceValue = fromDefault ? definition?.default : isNoData ? undefined : rawValue;
            const value = sourceValue !== undefined && definition ? transformValue(sourceValue, definition) : sourceValue;

            if (!definition) {
                diagnostics.push({
                    code: "METADATA_PROPERTY_UNKNOWN",
                    severity: "warning",
                    message: `Property "${propertyId}" is not declared by class "${entity.class}".`,
                    path: `${path}.properties.${propertyId}`,
                    documentUri,
                });
            } else {
                if (definition.required && sourceValue === undefined) {
                    diagnostics.push({
                        code: "METADATA_PROPERTY_REQUIRED",
                        severity: "error",
                        message: `Required property "${propertyId}" is missing.`,
                        path: `${path}.properties.${propertyId}`,
                        documentUri,
                    });
                }
                if (sourceValue !== undefined && !isValueValid(sourceValue, definition, schema)) {
                    diagnostics.push({
                        code: "METADATA_PROPERTY_TYPE",
                        severity: "error",
                        message: `Property "${propertyId}" does not conform to its ${definition.type} definition.`,
                        path: `${path}.properties.${propertyId}`,
                        documentUri,
                    });
                }
            }

            properties[propertyId] = {
                id: propertyId,
                ...(definition ? { definition, semantic: definition.semantic } : {}),
                ...(rawValue !== undefined ? { rawValue } : {}),
                ...(value !== undefined ? { value } : {}),
                fromDefault,
                isNoData,
            };
        }

        return {
            scope,
            ownerId,
            documentUri,
            ...(featureId !== undefined ? { featureId } : {}),
            entity,
            classId: entity.class,
            ...(classDefinition ? { classDefinition } : {}),
            properties,
            diagnostics,
        };
    }
}
