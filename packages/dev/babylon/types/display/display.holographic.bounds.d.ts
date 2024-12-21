import { Nullable, Vector3 } from "@babylonjs/core";
import { Observable } from "core/events";
export declare enum HolographicBoundsType {
    BOX = 0,
    CYLINDER = 1,
    SPHERE = 2
}
export interface IHolographicBounds {
    type?: HolographicBoundsType;
}
export declare function IsHolographicBounds(obj: any): obj is IHolographicBounds;
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
    clipPlanesAddedObservable: Observable<Array<ClipPlaneDefinition>>;
    clipPlanesRemovedObservable: Observable<Array<ClipPlaneDefinition>>;
    clipPlanes: Nullable<Array<ClipPlaneDefinition>>;
    clipPlanesWorld: Nullable<Array<ClipPlaneDefinition>>;
}
export declare function IsHolographicBox(obj: unknown): obj is IHolographicBox;
export interface IHolographicCylinder extends IHolographicBounds {
    radius: number;
    height: Vector3;
}
export declare function IsHolographicCylinder(obj: unknown): obj is IHolographicCylinder;
export interface IHolographicSphere extends IHolographicBounds {
    radius: number;
}
export declare function IsHolographicSphere(obj: unknown): obj is IHolographicSphere;
export interface IHasHolographicBounds {
    holographicBounds: Nullable<IHolographicBounds>;
}
export declare function HasHolographicBounds(obj: unknown): obj is IHasHolographicBounds;
