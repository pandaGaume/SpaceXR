import { Context2DTileMap } from "core/map";
import { IDisplay, ITile } from "core/tiles";
export interface IElevationTexture {
    tile: ITile<unknown>;
}
export declare class ElevationTexture extends Context2DTileMap<unknown> implements IElevationTexture {
    private _tile;
    constructor(tile: ITile<unknown>, display: IDisplay);
    get tile(): ITile<unknown>;
}
