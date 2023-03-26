import { ITileAddress } from "./tiles.interfaces";

export class TileAddress implements ITileAddress {
    public x: number;
    public y: number;
    public levelOfDetail: number;

    constructor(x: number, y: number, levelOfDetail: number) {
        this.x = x;
        this.y = y;
        this.levelOfDetail = levelOfDetail;
    }
}
