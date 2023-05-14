import { IGeo2 } from "../geography/geography.interfaces";
import { AbstractDisplayMap, IDisplay } from "./map";
import { ITile, ITileAddress, ITileDatasource, ITileMetrics } from "../tiles/tiles.interfaces";
import { ISize3 } from "../geometry/geometry.interfaces";
import { IVerticesData } from "../meshes/meshes.interfaces";
export declare class HologramDisplay implements IDisplay {
    _size: ISize3;
    constructor(size: ISize3);
    get height(): number;
    get width(): number;
}
export declare class HologramTileMap<T, H extends HologramDisplay> extends AbstractDisplayMap<T, H> {
    _gridSeed: IVerticesData;
    constructor(display: H, datasource: ITileDatasource<T, ITileAddress>, metrics: ITileMetrics, center?: IGeo2, lod?: number);
    protected onDeleted(key: string, tile: ITile<T>): void;
    protected onAdded(key: string, tile: ITile<T>): void;
    protected invalidateDisplay(): void;
    protected invalidateTiles(added: ITile<T>[] | undefined, removed: ITile<T>[] | undefined): void;
}
