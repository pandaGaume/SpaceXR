import { IGeo2 } from "../geography/geography.interfaces";
import { AbstractDisplayMap, IMapDisplay } from "./map";
import { ITile, ITileAddress, ITileDatasource, ITileMetrics } from "../tiles/tiles.interfaces";
import { ICartesian3, ISize2, ISize3 } from "../geometry/geometry.interfaces";
import { IVerticesData } from "../meshes/meshes.interfaces";
export declare class HologramMapDisplay implements IMapDisplay {
    static FromResolution(dimensions: ISize3, resolutions: ICartesian3): HologramMapDisplay;
    _dimensions: ISize3;
    _dpi: ICartesian3;
    constructor(dimensions: ISize3, dpi: number | ICartesian3);
    get resolution(): ISize2;
}
export declare class HologramTileMapOptions {
    constructor(cellScale: ISize3);
}
export declare class HologramTileMap<T, H extends HologramMapDisplay> extends AbstractDisplayMap<T, H> {
    _gridSeed: IVerticesData;
    constructor(display: H, datasource: ITileDatasource<T, ITileAddress>, metrics: ITileMetrics, center?: IGeo2, lod?: number);
    protected onDeleted(key: string, tile: ITile<T>): void;
    protected onAdded(key: string, tile: ITile<T>): void;
    protected invalidateDisplay(): void;
    protected invalidateTiles(added: ITile<T>[] | undefined, removed: ITile<T>[] | undefined): void;
}
