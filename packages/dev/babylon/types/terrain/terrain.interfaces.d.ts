import { IVerticesData } from "core/meshes/meshes.interfaces";
declare module "@babylonjs/core" {
    interface VertexData extends IVerticesData {
    }
}
