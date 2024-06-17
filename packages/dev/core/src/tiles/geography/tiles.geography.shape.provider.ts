import { ICartesian3 } from "../../geometry";
import { PolylineSimplifier } from "../../geometry/geometry.simplify";
import { IShape } from "../../geometry/shapes/geometry.shapes.interfaces";
import { ShapeLayerOutputContentType } from "../map/tiles.map.interfaces";
import { AbstractTileProvider } from "../providers";
import { ITile, ITileMetrics } from "../tiles.interfaces";
import { ShapeLayerInputContentType } from "./tiles.geography.layer.shape";
import { IShapeView, ShapeViewCollection } from "./tiles.geography.shape.collection";

export class ShapeProvider extends AbstractTileProvider<Array<ShapeLayerOutputContentType>> {
    static readonly DEFAULT_NAMESPACE = "ShapeProvider";
    _source: ShapeViewCollection;

    public constructor(namespace: string, metrics: ITileMetrics | ShapeViewCollection, simplifier?: PolylineSimplifier<ICartesian3>) {
        super();
        this._source = metrics instanceof ShapeViewCollection ? metrics : new ShapeViewCollection(metrics, simplifier);
        this._source.addedObservable.add(this._shapesAdded.bind(this));
        this.factory.withMetrics(this._source.metrics).withNamespace(namespace ?? ShapeProvider.DEFAULT_NAMESPACE); // ensure the factory has the right metrics and namespace to build bounds.
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

    public addShapes(...shapes: Array<ShapeLayerInputContentType>): void {
        let lod = this._source.metrics.maxLOD;
        do {
            if (!this._source.trySet(lod, ...shapes)) {
                break;
            }
            lod--;
        } while (lod >= this._source.metrics.minLOD);
    }

    protected _shapesAdded(shape: Array<IShapeView>): void {
        for (const view of shape) {
            this._shapeAdded(view);
        }
    }

    protected _shapeAdded(view: IShapeView): void {
        for (const tile of this.activTiles) {
            if (tile.address.levelOfDetail === view.lod && tile.geoBounds?.intersects(view.geoBounds)) {
                tile.content = tile.content ?? [];
                tile.content.push(view.view);
                if (this._updatedObservable && this._updatedObservable.hasObservers()) {
                    this._updatedObservable.notifyObservers(tile);
                }
            }
        }
    }
}
