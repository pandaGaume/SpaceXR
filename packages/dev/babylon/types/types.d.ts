import { ICartesian3 } from "@dev/core/src/geometry/geometry.interfaces";
import { IVerticesData } from "@dev/core/src/meshes/meshes.interfaces";
declare module "@babylonjs/core" {
    interface VertexData extends IVerticesData {
    }
    interface Vector3 extends ICartesian3 {
    }
}
