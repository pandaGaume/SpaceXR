import { Tile, TileContentType } from "core/tiles";
import { Tile3DContent } from "./tile3d.content";

export class Tile3D extends Tile<Tile3DContent> {
    public constructor(x: number, y: number, levelOfDetail: number, data: TileContentType<Tile3DContent>) {
        super(x, y, levelOfDetail, data);
    }
}
