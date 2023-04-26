import { ITile, ITileAddress } from "./tiles.interfaces";
export declare class Tile<T> implements ITile<T> {
    address: ITileAddress;
    data: T;
    constructor(data: T, address: ITileAddress);
}
