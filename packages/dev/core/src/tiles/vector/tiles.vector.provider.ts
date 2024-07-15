import { ICartesian3, IShape } from "../../geometry";
import { PolylineSimplifier } from "../../geometry/geometry.simplify";
import { AbstractTileProvider } from "../providers";
import { ITileMetrics } from "../tiles.interfaces";
import { ShapeCollection, ShapeCollectionEventArgs } from "./tiles.vector.collection";
import { IVectorTile, IVectorTileContent, IVectorTileFeature, IVectorTileLayer } from "./tiles.vector.interfaces";
import { IGeoShape } from "../../geography";

export class VectorTileProvider extends AbstractTileProvider<IVectorTileContent> {
    static readonly DEFAULT_NAMESPACE = "VectorProvider";
    static readonly DEFAULT_VERSION = 2;

    _source: Map<string, ShapeCollection>;
    _simplifier?: PolylineSimplifier<ICartesian3>;

    public constructor(namespace: string, metrics: ITileMetrics, simplifier?: PolylineSimplifier<ICartesian3>) {
        super();
        this._source = new Map<string, ShapeCollection>();
        this._simplifier = simplifier;
        this.factory.withMetrics(metrics).withNamespace(namespace ?? VectorTileProvider.DEFAULT_NAMESPACE); // ensure the factory has the right metrics and namespace to build bounds.
    }

    public _fetchContent(tile: IVectorTile, callback: (t: IVectorTile) => void): IVectorTile {
        tile.content = new Map<string, IVectorTileLayer>();
        const lod = tile.address.levelOfDetail;
        for (const [key, collection] of this._source) {
            const logGroup = collection.get(lod);
            if (logGroup?.bounds?.intersects(tile.bounds)) {
                for (const shape of logGroup) {
                    if (shape.bounds?.intersects(tile.bounds)) {
                        let layer = tile.content.get(key);
                        if (!layer) {
                            layer = this._buildVectorLayer(VectorTileProvider.DEFAULT_VERSION, key);
                            tile.content.set(key, layer);
                        }
                        const feature = this._buildVectorFeature(tile, shape);
                        if (feature) {
                            if (!layer.features) {
                                layer.features = [];
                            }
                            layer.features?.push(feature);
                        }
                    }
                }
            }
        }
        return tile;
    }

    protected _buildVectorLayer(version: number, name: string): IVectorTileLayer {
        throw new Error("Method not implemented.");
    }

    protected _buildVectorFeature(target: IVectorTile, shape: IShape): IVectorTileFeature | undefined {
        // given a shape, we need to build a feature
        const clipArea = target.bounds;
        const shapeBounds = shape.bounds;
        let feature: IVectorTileFeature | undefined = undefined;
        if (clipArea && shapeBounds) {
            if (clipArea.contains(shapeBounds?.xmin, shapeBounds?.ymin) && clipArea.contains(shapeBounds?.xmax, shapeBounds?.ymax)) {
                // the shape is completely inside the tile
                feature = {
                    tags: [],
                    shape: [shape],
                };
            } else {
                // go for clipping
            }
        }
        return feature;
    }

    public addShapes(layerName: string, ...shapes: Array<IGeoShape>): void {
        let lod = this.metrics.maxLOD;
        do {
            let group = this._source.get(layerName);
            if (!group) {
                group = new ShapeCollection(this.metrics, this._simplifier);
                group.addedObservable.add(this._shapesAdded.bind(this));
                this._source.set(layerName, group);
            }
            if (!group.trySet(lod, ...shapes)) {
                // we break the loop if we failed to add the shapes at this Level of Detail
                break;
            }
            lod--;
        } while (lod >= this.metrics.minLOD);
    }

    protected _shapesAdded(args: ShapeCollectionEventArgs): void {}

    /*protected _shapeAdded(view: IShape): void {
        for (const tile of this.activTiles) {
            if (tile.address.levelOfDetail === view.lod && tile.geoBounds?.intersects(view.geoBounds)) {
                tile.content = tile.content ?? [];
                tile.content.push(view);
                if (this._updatedObservable && this._updatedObservable.hasObservers()) {
                    this._updatedObservable.notifyObservers(tile);
                }
            }
        }
    }*/
}
