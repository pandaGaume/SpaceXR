import { IGeo2 } from "../geography/geography.interfaces";
import { AbstractDisplayMap, IMapDisplay } from "./map";
import { ITile, ITileAddress, ITileDatasource, ITileMetrics } from "../tiles/tiles.interfaces";
import { ICartesian3, ISize2, ISize3, isCartesian3 } from "../geometry/geometry.interfaces";
import { IVerticesData } from "../meshes/meshes.interfaces";
import { TerrainGridOptionsBuilder, TerrainNormalizedGridBuilder } from "../meshes/terrain.grid";
import { Cartesian3 } from "../geometry/geometry.cartesian";
import { Size2 } from "../geometry/geometry.size";

/**
 * fixed physical sizes in inches, within the 3 axes
 * Resolution in dpi within the 3 axes
 * the formula will be
 *       width = dimension.width * dpi.width
 *       height = dimension.height * dpi.height
 */
export class HologramMapDisplay implements IMapDisplay {
    public static FromResolution(dimensions: ISize3, resolutions: ICartesian3) {
        const d = new HologramMapDisplay(dimensions, 0);
        d._dpi.x = resolutions.x / dimensions.width;
        d._dpi.y = resolutions.y / dimensions.height;
        d._dpi.z = resolutions.z / dimensions.thickness;
        return d;
    }

    _dimensions: ISize3;
    _dpi: ICartesian3;

    public constructor(dimensions: ISize3, dpi: number | ICartesian3) {
        this._dimensions = dimensions;
        this._dpi = isCartesian3(dpi) ? new Cartesian3(dpi.x, dpi.y, dpi.z) : new Cartesian3(dpi, dpi, dpi);
    }

    public get resolution(): ISize2 {
        return new Size2(this._dimensions.width * this._dpi.y, this._dimensions.height * this._dpi.z);
    }
}

export class HologramTileMap<T, H extends HologramMapDisplay> extends AbstractDisplayMap<T, ITile<T>, H> {
    _gridSeed: IVerticesData;

    public constructor(display: H, datasource: ITileDatasource<T, ITileAddress>, metrics: ITileMetrics, center?: IGeo2, lod?: number) {
        super(display, datasource, metrics, center, lod);
        // build a normalized grid of tile size.
        // this grid will be used to allocate meshes and instances.
        const o = new TerrainGridOptionsBuilder().withWidth(metrics.tileSize).build();
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
