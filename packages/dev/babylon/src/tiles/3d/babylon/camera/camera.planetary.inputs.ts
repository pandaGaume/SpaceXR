import { Camera, ICameraInput, KeyboardEventTypes, KeyboardInfo, Observer, PointerEventTypes, PointerInfo, Scene } from "@babylonjs/core";
import { IPlaneteryCamera } from "./camera.interfaces";
import { Cartesian3, ICartesian3 } from "core/geometry";


export class PlaneteryInputConstant{
    static PixelPerLine = 16;
    static PixelPerPage = 800;
    static WheelNotchPx = 120;
    static MinWheelNotxhPx = PlaneteryInputConstant.WheelNotchPx/3;
    static MaxWheelNotxhPx = PlaneteryInputConstant.WheelNotchPx * 2;
    static CalibrationWindowSize = 12;
}


// Contract used by your wheel handler.
// alt is the current camera altitude (meters).
// rawDelta is the wheel delta (can be pixels/lines/pages depending on deltaMode).
export interface IPlanetoryMeterPerStepProvider {
  getStep(alt: number, rawDelta: number): number;
}

