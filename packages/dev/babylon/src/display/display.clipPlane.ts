import { Nullable, Vector3 } from "@babylonjs/core";

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

export interface IHolographicBounds {
    clipPlanes: Nullable<Array<ClipPlaneDefinition>>;
    clipPlanesWorld: Nullable<Array<ClipPlaneDefinition>>;
}

export function HasHolographicBounds(obj: unknown): obj is IHasHolographicBounds {
    if (typeof obj !== "object" || obj === null) return false;
    return (<IHasHolographicBounds>obj).holographicBounds !== undefined;
}

export interface IHasHolographicBounds {
    holographicBounds: Nullable<IHolographicBounds>;
}
