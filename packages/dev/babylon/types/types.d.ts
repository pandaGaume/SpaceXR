import { ICartesian3, ICartesian2, ICartesian4 } from "core/geometry";
import { IVerticesData } from "core/geometry";
declare module "@babylonjs/core" {
    interface VertexData extends IVerticesData {
    }
    interface Vector3 extends ICartesian3 {
    }
    interface Vector2 extends ICartesian2 {
    }
    interface Vector4 extends ICartesian4 {
    }
}
