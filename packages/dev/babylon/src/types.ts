import type * as GLTF2 from "babylonjs-gltf2interface";
import { ICartesian3, ICartesian2, ICartesian4 } from "core/geometry";
import { IVerticesData } from "core/meshes";

/// classic augmentation
declare module "@babylonjs/core" {
    export interface VertexData extends IVerticesData {}
    export interface Vector3 extends ICartesian3 {}
    export interface Vector2 extends ICartesian2 {}
    export interface Vector4 extends ICartesian4 {}
}

declare module "@babylonjs/loaders/glTF/2.0" {
    interface IProperty extends GLTF2.IProperty {}
}
