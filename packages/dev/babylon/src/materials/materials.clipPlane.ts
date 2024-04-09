import { Vector3 } from "@babylonjs/core";

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
