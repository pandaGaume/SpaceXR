import { ITileAddress } from "./tiles.interfaces";
export declare class TileAddress implements ITileAddress {
    x: number;
    y: number;
    levelOfDetail: number;
    constructor(x: number, y: number, levelOfDetail: number);
}
