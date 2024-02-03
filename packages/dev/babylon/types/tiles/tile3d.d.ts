import { Tile, TileContentType } from "core/tiles";
import { Tile3DContent } from "./tile3d.content";
export declare class Tile3D extends Tile<Tile3DContent> {
    constructor(x: number, y: number, levelOfDetail: number, data: TileContentType<Tile3DContent>);
}
