import { IVerticesData } from "@dev/core/src/meshes/meshes.interfaces";
declare module "@babylonjs/core" {
    export interface VertexData extends IVerticesData {}
}
