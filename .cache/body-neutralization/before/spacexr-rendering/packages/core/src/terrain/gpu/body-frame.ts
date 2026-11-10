import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";

/** Body-fixed eye and rotation for camera-relative GPU vertices. The root must be a rigid transform. */
export function terrainBodyFrame(sceneEye: Vector3, root?: TransformNode): { eye: Vector3; rotation: Matrix } {
    if (!root) return { eye: sceneEye.clone(), rotation: Matrix.Identity() };
    const matrix = root.computeWorldMatrix(true);
    const rotation = matrix.clone();
    rotation.setTranslationFromFloats(0, 0, 0);
    return { eye: Vector3.TransformCoordinates(sceneEye, Matrix.Invert(matrix)), rotation };
}
