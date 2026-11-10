import { Matrix } from "@babylonjs/core/Maths/math.vector.js";
import type { IEcefSpatialState, IVector3 } from "@spacexr/3d-tiles-runtime";

/** Column-major rotation from glTF Y-up content axes to 3D Tiles Z-up axes. */
export const GLTF_Y_UP_TO_3D_TILES_Z_UP: Readonly<Float64Array> = new Float64Array([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1]);

function multiply(left: ArrayLike<number>, right: ArrayLike<number>): Float64Array {
    const result = new Float64Array(16);
    for (let column = 0; column < 4; column++) {
        for (let row = 0; row < 4; row++) {
            let value = 0;
            for (let index = 0; index < 4; index++) value += left[index * 4 + row]! * right[column * 4 + index]!;
            result[column * 4 + row] = value;
        }
    }
    return result;
}

/**
 * Converts glTF Y-up content to 3D Tiles Z-up, then applies its local-to-ECEF transform.
 *
 * @param offset - Moves the content in ECEF metres, as the vertical scale of the scene does.
 */
export function createBabylonTileMatrix(spatial: IEcefSpatialState, offset?: Readonly<IVector3>): Matrix {
    const matrix = multiply(spatial.worldTransform, GLTF_Y_UP_TO_3D_TILES_Z_UP);
    if (offset) {
        matrix[12]! += offset.x;
        matrix[13]! += offset.y;
        matrix[14]! += offset.z;
    }
    return Matrix.FromArray(matrix);
}
