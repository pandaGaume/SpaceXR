import { ICartesian3, ICartesian2, ICartesian4 } from "core/geometry/geometry.interfaces";
import { IVerticesData } from "core/meshes/meshes.interfaces";

declare module "@babylonjs/core" {
    export interface VertexData extends IVerticesData {}
    export interface Vector3 extends ICartesian3 {}
    export interface Vector2 extends ICartesian2 {}
    export interface Vector4 extends ICartesian4 {}
}
