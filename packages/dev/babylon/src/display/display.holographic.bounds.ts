import { Nullable, Vector3 } from "@babylonjs/core";

export enum HolographicBoundsType {
    BOX,
    CYLINDER,
    SPHERE,
}

export interface IHolographicBounds {
    type?: HolographicBoundsType;
}

export enum ClipIndex {
    North,
    South,
    East,
    West,
    Top,
    Bottom,
}

export class ClipPlaneDefinition {
    public constructor(public index: ClipIndex, public point: Vector3, public normal: Vector3) {}
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

export function HasHolographicBox(obj: unknown): obj is IHasHolographicBox {
    if (typeof obj !== "object" || obj === null) return false;
    return (<IHasHolographicBox>obj).holographicBox !== undefined;
}

export interface IHasHolographicBox {
    holographicBox: Nullable<IHolographicBox>;
}
