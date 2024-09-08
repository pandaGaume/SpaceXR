import { Context2DTileMap } from "core/map";
import { IDisplay, ITile, TileNavigationState } from "core/tiles";

export interface IElevationTexture {
    tile: ITile<unknown>;
}

export class ElevationTexture extends Context2DTileMap<unknown> implements IElevationTexture {
    private _tile: ITile<unknown>;

    public constructor(tile: ITile<unknown>, display: IDisplay) {
        super(display, new TileNavigationState(tile.geoBounds?.center, tile.address.levelOfDetail));
        this._tile = tile;
    }

    public get tile(): ITile<unknown> {
        return this._tile;
    }
}
