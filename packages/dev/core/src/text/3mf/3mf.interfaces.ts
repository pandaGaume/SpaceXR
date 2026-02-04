import { Nullable } from "../../types";
import { Matrix3D } from "./3mf.matrix";

export enum ST_Unit {
  micron = "micron",
  millimeter = "millimeter",
  centimeter = "centimeter",
  inch = "inch",
  foot = "foot",
  meter = "meter"
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
  other = "other"
}



export interface I3MFMetadata {
  name: string;
  preserve?: boolean;
  type?: string;
  value: string;
}

export interface I3MFMetadataGroup {
  metadata: Array<I3MFMetadata>;
}

export interface I3MFVertex {
  x: ST_Number;
  y: ST_Number;
  z: ST_Number;
}

export interface I3MFTriangle {
  v1: ST_ResourceIndex;
  v2: ST_ResourceIndex;
  v3: ST_ResourceIndex;

  p1?: ST_ResourceIndex;
  p2?: ST_ResourceIndex;
  p3?: ST_ResourceIndex;
  pid?: ST_ResourceID; // Overrides the OBJECT LEVEL pid for the riangle.
}

export interface I3MFVertices {
  vertex: Array<I3MFVertex>;
}

export interface I3MFTriangles {
  triangle: Array<I3MFTriangle>;
}

export interface I3MFMesh {
  vertices: I3MFVertices;
  triangles: I3MFTriangles;
}

export interface I3MFComponent {
  objectid: ST_ResourceID;
  transform?: Matrix3D;
}

export interface I3MFComponents {
  component: Array<I3MFComponent>;
}

export interface I3MFObject {
  id?: ST_ResourceID;

  type?: ST_ObjectType;
  thumbnail?: ST_UriReference;
  partnumber?: string;
  name?: string;

  pid?: ST_ResourceID; // Reference to the property group element with the matching id attribute value (e.g. <basematerials>). It is REQUIRED if pindex is specified.
  pindex?: ST_ResourceIndex;
  
  metadatagroup?: I3MFMetadataGroup;

  content?: I3MFMesh | I3MFComponents ;
}

export interface I3MFBase {
  name: string;
  displaycolor: ST_ColorValue;
}

export interface I3MFBaseMaterials {
  id: ST_ResourceID;
  base: Array<I3MFBase>;
}

export interface I3MFResources {
  object: Array<I3MFObject>;
  basematerials?: Array<I3MFBaseMaterials>;
}

export interface I3MFItem {
  objectid: ST_ResourceID;
  transform?: Matrix3D;
  partnumber?: string;
  metadatagroup?: I3MFMetadataGroup;
}

export interface I3MFBuild {
  item: Array<I3MFItem>;
}

export interface I3MFModel {
  unit?: ST_Unit;
  requiredextensions?: string;
  recommendedextensions?: string;

  metadata?: Nullable<Array<I3MFMetadata>>;
  resources?: Nullable<I3MFResources>;
  build?: Nullable<I3MFBuild>;
}
