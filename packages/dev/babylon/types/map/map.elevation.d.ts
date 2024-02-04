import { IDemInfos } from "core/dem";
import { ITileDisplay, ITileMapLayer, ImageLayer, TileMapBase } from "core/tiles";
import { ElevationLayer } from "./map.elevation.layer";
export type ElevationTileContentType = IDemInfos | HTMLImageElement;
export declare class ElevationMap extends TileMapBase<ElevationTileContentType, ITileMapLayer<ElevationTileContentType>> {
    constructor(name: string, display?: ITileDisplay);
    get elevationLayer(): Array<ElevationLayer>;
    get textureLayer(): Array<ImageLayer>;
    protected _getTypedLayer<T>(type: new (...args: any[]) => T): Array<T>;
}
