import { IGeoShape } from "../../geography";
import { ICartesian3 } from "../../geometry";
import { PolylineSimplifier } from "../../geometry/geometry.simplify";
import { IShape } from "../../geometry/shapes/geometry.shapes.interfaces";
import { AbstractTileProvider } from "../providers";
import { ITile, ITileMetrics } from "../tiles.interfaces";
import { ShapeViewCollection } from "./tiles.geography.shape.collection";

export class ShapeProvider extends AbstractTileProvider<Array<IShape>> {
    _source: ShapeViewCollection;

    public constructor(metrics: ITileMetrics | ShapeViewCollection, simplifier?: PolylineSimplifier<ICartesian3>) {
        super();
        this._source = metrics instanceof ShapeViewCollection ? metrics : new ShapeViewCollection(metrics, simplifier);
    }

    public _fetchContent(tile: ITile<IShape[]>, callback: (t: ITile<IShape[]>) => void): ITile<IShape[]> {
        tile.content = [];
        const lod = tile.address.levelOfDetail;
        const collection = this._source.get(lod);
        if (collection?.geoBounds?.intersects(tile.geoBounds)) {
            for (const shape of collection) {
                if (shape.view.bounds?.intersects(tile.bounds)) {
                    tile.content.push(shape.view);
                }
            }
        }
        return tile;
    }

    public addShapes(...shapes: Array<IGeoShape>): void {
        let lod = this._source.metrics.maxLOD;
        do {
            if (this._source.trySet(lod, ...shapes)) {
                break;
            }
            lod--;
        } while (lod >= this._source.metrics.minLOD);
    }
}
