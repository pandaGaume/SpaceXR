import { ICartesian3, ICartesian2, ICartesian4 } from "core/geometry";
import { IVerticesData } from "core/geometry";

/// classic augmentation
declare module "@babylonjs/core" {
    export interface VertexData extends IVerticesData {}
    export interface Vector3 extends ICartesian3 {}
    export interface Vector2 extends ICartesian2 {}
    export interface Vector4 extends ICartesian4 {}

    // gltf extensions
    // export interface Mesh extends IHasFeatureIds, IHasInstanceIds, IStructuralMetadata {}
}

/*
declare module "@babylonjs/loaders/glTF/2.0" {
    interface IProperty extends GLTF2.IProperty {}

    interface IEXTMeshFeatures extends IHasFeatureIds {}
    interface IEXTInstanceFeatures extends IHasFeatureIds {}
    interface IEXTStructuralMetadata extends IStructuralMetadata {}
}
*/