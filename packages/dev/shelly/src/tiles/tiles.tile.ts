import { ITile, ITileAddress } from "./tiles.interfaces";

export class Tile<T> implements ITile<T> {
    address: ITileAddress;
    data: T;

    public constructor(data: T, address: ITileAddress) {
        this.data = data;
        this.address = address;
    }
}
