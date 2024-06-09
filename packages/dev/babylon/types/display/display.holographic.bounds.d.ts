import { Nullable, Vector3 } from "@babylonjs/core";
export declare enum HolographicBoundsType {
    BOX = 0,
    CYLINDER = 1,
    SPHERE = 2
}
export interface IHolographicBounds {
    type?: HolographicBoundsType;
}
export declare enum ClipIndex {
    North = 0,
    South = 1,
    East = 2,
    West = 3,
    Top = 4,
    Bottom = 5
}
export declare class ClipPlaneDefinition {
    index: ClipIndex;
    point: Vector3;
    normal: Vector3;
    constructor(index: ClipIndex, point: Vector3, normal: Vector3);
}
export interface IHolographicBox extends IHolographicBounds {
    clipPlanes: Nullable<Array<ClipPlaneDefinition>>;
    clipPlanesWorld: Nullable<Array<ClipPlaneDefinition>>;
}
export interface IHolographicCylinder extends IHolographicBounds {
    radius: number;
    height: number;
}
export interface IHolographicSphere extends IHolographicBounds {
    radius: number;
}
export declare function HasHolographicBox(obj: unknown): obj is IHasHolographicBox;
export interface IHasHolographicBox {
    holographicBox: Nullable<IHolographicBox>;
}
