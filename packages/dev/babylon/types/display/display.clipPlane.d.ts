import { Vector3 } from "@babylonjs/core";
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
export declare function isClipableContent(content: any): content is IClipableContent;
export interface IClipableContent {
    addClipPlane(...clipPlanes: ClipPlaneDefinition[]): IClipableContent;
    removeClipPlane(...indices: ClipIndex[]): IClipableContent;
    clearClipPlanes(): IClipableContent;
}
