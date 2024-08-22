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

export function IsHolographicBox(obj: unknown): obj is IHolographicBox {
    if (typeof obj !== "object" || obj === null) return false;
    return (<IHolographicBox>obj).type === HolographicBoundsType.BOX;
}

export interface IHolographicCylinder extends IHolographicBounds {
    radius: number;
    height: number;
}

export function IsHolographicCylinder(obj: unknown): obj is IHolographicBox {
    if (typeof obj !== "object" || obj === null) return false;
    return (<IHolographicBox>obj).type === HolographicBoundsType.CYLINDER;
}

export interface IHolographicSphere extends IHolographicBounds {
    radius: number;
}

export function IsHolographicSphere(obj: unknown): obj is IHolographicBox {
    if (typeof obj !== "object" || obj === null) return false;
    return (<IHolographicBox>obj).type === HolographicBoundsType.SPHERE;
}

export interface IHasHolographicBounds {
    holographicBounds: Nullable<IHolographicBounds>;
}

export function HasHolographicBounds(obj: unknown): obj is IHasHolographicBounds {
    if (typeof obj !== "object" || obj === null) return false;
    return (<IHasHolographicBounds>obj).holographicBounds !== undefined;
}
