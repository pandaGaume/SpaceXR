import { ITileAddress } from "./tiles.interfaces";
export declare class TileAddress implements ITileAddress {
    x: number;
    y: number;
    levelOfDetail: number;
    private _k?;
    constructor(x: number, y: number, levelOfDetail: number);
    get quadkey(): string;
    toString(): string;
}
