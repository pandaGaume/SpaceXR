import { ICartesian3 } from "core/geometry/geometry.interfaces";
import { IVerticesData } from "core/meshes/meshes.interfaces";

declare module "@babylonjs/core" {
    export interface VertexData extends IVerticesData {}
    export interface Vector3 extends ICartesian3 {}
}
