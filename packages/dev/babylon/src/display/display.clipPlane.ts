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

export function isClipableContent(content: any): content is IClipableContent {
    if (typeof content !== "object" || content === null) return false;
    return content.addClipPlane !== undefined && content.removeClipPlane !== undefined && content.clearClipPlanes !== undefined;
}

export interface IClipableContent {
    addClipPlane(...clipPlanes: ClipPlaneDefinition[]): IClipableContent;
    removeClipPlane(...indices: ClipIndex[]): IClipableContent;
    clearClipPlanes(): IClipableContent;
}
