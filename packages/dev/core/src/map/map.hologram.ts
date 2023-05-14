import { IGeo2 } from "../geography/geography.interfaces";
import { AbstractDisplayMap, IDisplay } from "./map";
import { ITile, ITileAddress, ITileDatasource, ITileMetrics } from "../tiles/tiles.interfaces";
import { ISize3 } from "../geometry/geometry.interfaces";
import { IVerticesData } from "../meshes/meshes.interfaces";
import { TerrainGridOptions, TerrainNormalizedGridBuilder } from "../meshes/terrain.grid";

export class HologramDisplay implements IDisplay {
    _size: ISize3;

    public constructor(size: ISize3) {
        this._size = size;
    }

    public get height(): number {
        return this._size.height;
    }

    public get width(): number {
        return this._size.width;
    }
}

export class HologramTileMap<T, H extends HologramDisplay> extends AbstractDisplayMap<T, H> {
    _gridSeed: IVerticesData;

    public constructor(display: H, datasource: ITileDatasource<T, ITileAddress>, metrics: ITileMetrics, center?: IGeo2, lod?: number) {
        super(display, datasource, metrics, center, lod);
        // build a normalized grid of tile size.
        // this grid will be used to allocate meshes and instances.
        const o = new TerrainGridOptions(metrics.tileSize);
        this._gridSeed = new TerrainNormalizedGridBuilder().withOptions(o).build();
    }

    protected onDeleted(key: string, tile: ITile<T>): void {
        throw new Error("Method not implemented.");
    }
    protected onAdded(key: string, tile: ITile<T>): void {
        throw new Error("Method not implemented.");
    }
    protected invalidateDisplay(): void {
        throw new Error("Method not implemented.");
    }
    protected invalidateTiles(added: ITile<T>[] | undefined, removed: ITile<T>[] | undefined): void {
        throw new Error("Method not implemented.");
    }
}
