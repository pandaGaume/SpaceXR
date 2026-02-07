import type { Matrix3d } from "./3mf.math";

export const ThreeDimModelNamespace = "http://schemas.microsoft.com/3dmanufacturing/core/2015/02";
export const TriangleSetsNamespace = "http://schemas.microsoft.com/3dmanufacturing/trianglesets/2021/07";

/* eslint-disable @typescript-eslint/naming-convention */
export enum ST_Unit {
    micron = "micron",
    millimeter = "millimeter",
    centimeter = "centimeter",
    inch = "inch",
    foot = "foot",
    meter = "meter",
}

export type ST_ColorValue = string;
export type ST_UriReference = string;

export type ST_Number = number;

export type ST_ResourceID = number;
export type ST_ResourceIndex = number;

export enum ST_ObjectType {
    model = "model",
    solidsupport = "solidsupport",
    support = "support",
    surface = "surface",
    other = "other",
}

/**
 *
 */
export interface I3mfMetadata {
    /**
     *
     */
    name: string;
    /**
     *
     */
    preserve?: boolean;
    /**
     *
     */
    type?: string;
    /**
     *
     */
    value: string;
}

/**
 *
 */
export interface I3mfMetadataGroup {
    /**
     *
     */
    metadata: Array<I3mfMetadata>;
}

/**
 *
 */
export interface I3mfVertex {
    /**
     *
     */
    x: ST_Number;
    /**
     *
     */
    y: ST_Number;
    /**
     *
     */
    z: ST_Number;
}

/**
 *
 */
export interface I3mfTriangle {
    /**
     *
     */
    v1: ST_ResourceIndex;
    /**
     *
     */
    v2: ST_ResourceIndex;
    /**
     *
     */
    v3: ST_ResourceIndex;

    /**
     *
     */
    p1?: ST_ResourceIndex;
    /**
     *
     */
    p2?: ST_ResourceIndex;
    /**
     *
     */
    p3?: ST_ResourceIndex;
    /**
     *
     */
    pid?: ST_ResourceID; // Overrides the OBJECT LEVEL pid for the riangle.
}

/**
 *
 */
export interface I3mfVertices {
    /**
     *
     */
    vertex: Array<I3mfVertex>;
}

/**
 *
 */
export interface I3mfTriangles {
    /**
     *
     */
    triangle: Array<I3mfTriangle>;
}

/**
 *
 */
export interface I3mfMesh {
    /**
     *
     */
    vertices: I3mfVertices;
    /**
     *
     */
    triangles: I3mfTriangles;
}

/**
 *
 */
export interface I3mfComponent {
    /**
     *
     */
    objectid: ST_ResourceID;
    /**
     *
     */
    transform?: Matrix3d;
}

/**
 *
 */
export interface I3mfComponents {
    /**
     *
     */
    component: Array<I3mfComponent>;
}

/**
 *
 */
export interface I3mfObject {
    /**
     *
     */
    id: ST_ResourceID;

    /**
     *
     */
    type?: ST_ObjectType;
    /**
     *
     */
    thumbnail?: ST_UriReference;
    /**
     *
     */
    partnumber?: string;
    /**
     *
     */
    name?: string;

    /**
     *
     */
    pid?: ST_ResourceID; // Reference to the property group element with the matching id attribute value (e.g. <basematerials>). It is REQUIRED if pindex is specified.
    /**
     *
     */
    pindex?: ST_ResourceIndex;

    /**
     *
     */
    metadatagroup?: I3mfMetadataGroup;

    /**
     *
     */
    content?: I3mfMesh | I3mfComponents;
}

/**
 *
 */
export interface I3mfBase {
    /**
     *
     */
    name: string;
    /**
     *
     */
    displaycolor: ST_ColorValue;
}

/**
 *
 */
export interface I3mfBaseMaterials {
    /**
     *
     */
    id: ST_ResourceID;
    /**
     *
     */
    base: Array<I3mfBase>;
}

/**
 *
 */
export interface I3mfResources {
    /**
     *
     */
    object: Array<I3mfObject>;
    /**
     *
     */
    basematerials?: Array<I3mfBaseMaterials>;
}

/**
 *
 */
export interface I3mfItem {
    /**
     *
     */
    objectid: ST_ResourceID;
    /**
     *
     */
    transform?: Matrix3d;
    /**
     *
     */
    partnumber?: string;
    /**
     *
     */
    metadatagroup?: I3mfMetadataGroup;
}

/**
 *
 */
export interface I3mfBuild {
    /**
     *
     */
    item: Array<I3mfItem>;
}

/**
 *
 */
export interface I3mfModel {
    /**
     *
     */
    unit?: ST_Unit;
    /**
     *
     */
    requiredextensions?: string;
    /**
     *
     */
    recommendedextensions?: string;

    /**
     *
     */
    metadata?: Array<I3mfMetadata>;
    /**
     *
     */
    resources?: I3mfResources;
    /**
     *
     */
    build?: I3mfBuild;
}
