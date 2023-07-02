import { Nullable } from "../types";
export declare class ConvexHullBuilder {
    _hull: Array<number>;
    _positions: Float32Array;
    _stride: number;
    _n: number;
    constructor(positions: Float32Array, stride?: number);
    get ConvexHull(): Array<number> | undefined;
    withPositions(positions: Float32Array, stride?: number): void;
    build(): Nullable<Array<number>>;
    private findSide;
    private lineDist;
    private quickHull;
}
