import { ICartesian3 } from "core/geometry/geometry.interfaces";
import { IVerticesData } from "core/meshes/meshes.interfaces";
declare module "@babylonjs/core" {
    interface VertexData extends IVerticesData {
    }
    interface Vector3 extends ICartesian3 {
    }
}
