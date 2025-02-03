import * as GLTF2 from "babylonjs-gltf2interface";
import { ICartesian3, ICartesian2, ICartesian4 } from "core/geometry";
import { IVerticesData } from "core/meshes";
import { IHasFeatureIds } from "./gltf/2.0/extensions/EXT_mesh_features";
import { IHasInstanceIds } from "./gltf/2.0/extensions/EXT_instance_features";
declare module "@babylonjs/core" {
    interface VertexData extends IVerticesData {
    }
    interface Vector3 extends ICartesian3 {
    }
    interface Vector2 extends ICartesian2 {
    }
    interface Vector4 extends ICartesian4 {
    }
    interface Mesh extends IHasFeatureIds, IHasInstanceIds {
    }
}
declare module "@babylonjs/loaders/glTF/2.0" {
    interface IProperty extends GLTF2.IProperty {
    }
    interface IEXTMeshFeatures extends IHasFeatureIds {
    }
    interface IEXTInstanceFeatures extends IHasFeatureIds {
    }
}
