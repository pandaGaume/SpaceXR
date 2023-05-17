import { IVerticesData } from "@dev/core/src/meshes/meshes.interfaces";
declare module "@babylonjs/core" {
    interface VertexData extends IVerticesData {
    }
}
