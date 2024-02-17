import { Nullable } from "../types";
export declare class ConvexHull2Builder {
    _positions: Float32Array;
    _stride: number;
    _n: number;
    constructor(positions: Float32Array, stride?: number);
    withPositions(positions: Float32Array, stride?: number): ConvexHull2Builder;
    build(): Nullable<Array<number>>;
    private findSide;
    private lineDist;
    private quickHull;
}
