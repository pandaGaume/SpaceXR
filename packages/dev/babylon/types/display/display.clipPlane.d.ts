import { Nullable, Vector3 } from "@babylonjs/core";
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
export interface IHolographicBounds {
    clipPlanes: Nullable<Array<ClipPlaneDefinition>>;
    clipPlanesWorld: Nullable<Array<ClipPlaneDefinition>>;
}
export declare function hasHolographicBounds(obj: unknown): obj is IHasHolographicBounds;
export interface IHasHolographicBounds {
    holographicBounds: Nullable<IHolographicBounds>;
}
