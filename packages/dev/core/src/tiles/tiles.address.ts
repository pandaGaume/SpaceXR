import { ITileAddress } from "./tiles.interfaces";

export class TileAddress implements ITileAddress {
    public constructor(public x: number, public y: number, public levelOfDetail: number) {}
}
