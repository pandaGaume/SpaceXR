import { IVerticesData } from "core/meshes/meshes.interfaces";
declare module "@babylonjs/core" {
    export interface VertexData extends IVerticesData {}
}
