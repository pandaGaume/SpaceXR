import { ICartesian3 } from "@dev/core/src/geometry/geometry.interfaces";
import { IVerticesData } from "@dev/core/src/meshes/meshes.interfaces";

declare module "@babylonjs/core" {
    export interface VertexData extends IVerticesData {}
    export interface Vector3 extends ICartesian3 {}
}
