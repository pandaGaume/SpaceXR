import type { Camera } from "@babylonjs/core/Cameras/camera.js";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import type { IAtmosphereCamera } from "@spacexr/atmosphere/webgpu";

/** Captures an unparented, symmetric perspective Babylon view in ECEF metres. */
export function atmosphereCamera(camera: Camera, width: number, height: number): IAtmosphereCamera {
    if (camera.mode !== 0 || camera.parent || camera.viewport.x !== 0 || camera.viewport.y !== 0 || camera.viewport.width !== 1 || camera.viewport.height !== 1)
        throw new Error("Earth atmosphere requires an unparented perspective camera and a full viewport.");
    const inverse = Matrix.Invert(camera.getViewMatrix(true));
    const direction = (x: number, y: number, z: number): readonly [number, number, number] => {
        const v = Vector3.TransformNormal(new Vector3(x,y,z),inverse).normalize();
        return [v.x,v.y,v.z];
    };
    const projection = camera.getProjectionMatrix(true).m;
    if (Math.abs(projection[8]!) > 1e-7 || Math.abs(projection[9]!) > 1e-7)
        throw new Error("Asymmetric camera projections are not supported by the Earth atmosphere adapter.");
    const position = camera.globalPosition;
    return {
        positionEcefMeters: [position.x,position.y,position.z],
        forwardEcef: direction(0,0,-1), rightEcef: direction(1,0,0), upEcef: direction(0,1,0),
        halfWidthTangent: 1 / projection[0]!, halfHeightTangent: 1 / projection[5]!,
        viewportWidth: width, viewportHeight: height,
    };
}
