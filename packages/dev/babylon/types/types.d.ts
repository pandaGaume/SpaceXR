import * as GLTF2 from "babylonjs-gltf2interface";
import { ICartesian3, ICartesian2, ICartesian4 } from "core/geometry";
import { IVerticesData } from "core/geometry";
import { IHasFeatureIds, IHasInstanceIds, IStructuralMetadata } from "./tiles/3d/babylon/gltf";
declare module "@babylonjs/core" {
    interface VertexData extends IVerticesData {
    }
    interface Vector3 extends ICartesian3 {
    }
    interface Vector2 extends ICartesian2 {
    }
    interface Vector4 extends ICartesian4 {
    }
    interface Mesh extends IHasFeatureIds, IHasInstanceIds, IStructuralMetadata {
    }
}
declare module "@babylonjs/loaders/glTF/2.0" {
    interface IProperty extends GLTF2.IProperty {
    }
    interface IEXTMeshFeatures extends IHasFeatureIds {
    }
    interface IEXTInstanceFeatures extends IHasFeatureIds {
    }
    interface IEXTStructuralMetadata extends IStructuralMetadata {
    }
}
