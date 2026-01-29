
import { FloatArray, IndicesArray, Nullable } from "../types";
import { Range} from "../math"

export enum ST_Unit {
    micron,
    millimeter,
    centimeter,
    inch,
    foot,
    meter
}
export type ST_RessourceId = string;
export type ST_RessourceIndex = number;
export type ST_Matrix3D = [number,number,number,number,number,number,number,number,number,number,number,number,number,number,number,number]
export type ST_UriReference = string;

export interface I3MFMetadata {
  name: string;        // e.g. "Title", "Designer", "License", or any custom key
  value: string;
  preserve?: boolean;  // A non-zero value indicates the  producer wants the consumer to preserve this value when it saves a modified version of this
  type?: string;       // optional, e.g. "xs:string"
}

export interface IHasMetadataGroup {
    metadatagroup?:Nullable<Array<I3MFMetadata>>; 
}

export interface I3FNode{
}

export interface I3MFComponent extends I3FNode{
  objectId: number;
  transform?: ST_Matrix3D;
}

export interface I3MFBuildItem extends I3FNode, IHasMetadataGroup{
  objectId: ST_RessourceId;
  transform?: ST_Matrix3D;
  partnumber?:string;
}

export interface I3MFTriangleSet extends I3FNode{
  id: string;   // unique within the mesh
  name: string;         // human readable
  triangles: IndicesArray | Range ; // triangle indices (t), 
}

export interface I3MFMesh extends I3FNode {
  // vertices: [x0,y0,z0, x1,y1,z1, ...]
  vertices: FloatArray;
  // triangles: [i0,j0,k0, i1,j1,k1, ...]
  triangles: IndicesArray;
  properties?:Array<Nullable<[ST_RessourceIndex,ST_RessourceIndex,ST_RessourceIndex,ST_RessourceId]>>
  // A mesh node MAY contain a trianglesets node that contains information how triangles are grouped and organized
  triangleSets?:Array<I3MFTriangleSet>
}

export enum ST_ObjectType {
    model,
    solidsupport,
    support,
    surface,
    other
}

export interface I3MFObject extends I3FNode, IHasMetadataGroup {
    id: number;
    type: ST_ObjectType;
    thumbnail: ST_UriReference;
    partNumber:string;
    name:string;
    pid: ST_RessourceId;
    pindex: ST_RessourceIndex;
    mesh:I3MFMesh;
    components? : Array<I3MFComponent>; 
}

export interface I3MFModel extends I3FNode{
    unit:ST_Unit;
    requiredExtensions?:Nullable<string>;
    recommendedExtensions?:Nullable<string>;
    metadata?:Nullable<Array<I3MFMetadata>>; 
    ressources: Array<I3MFObject>;
    builds: Array<I3MFBuildItem>;
}

