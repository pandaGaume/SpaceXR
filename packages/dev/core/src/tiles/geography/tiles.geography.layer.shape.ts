import { IGeoShape } from "dev/core/src/geography";
import { IShapeLayer, ITileMapLayerOptions } from "../map/tiles.map.interfaces";
import { ITile, ITileCollection, ITileMetrics } from "../tiles.interfaces";
import { AbstractTileMapLayer } from "../map/tiles.map.layer.abstract";

export type ShapeLayerContentType = IGeoShape;

export interface IShapeLayerOptions extends ITileMapLayerOptions {}

export class ShapeLayer extends AbstractTileMapLayer<ShapeLayerContentType> implements IShapeLayer {
    public get metrics(): ITileMetrics {
        throw new Error("Method not implemented.");
    }

    public get activTiles(): ITileCollection<IGeoShape> {
        throw new Error("Method not implemented.");
    }
    public constructor(name: string, options?: IShapeLayerOptions, enabled?: boolean) {
        super(name, options, enabled);
    }

    public draw(context: CanvasRenderingContext2D, tile: ITile<IGeoShape>): void {
        throw new Error("Method not implemented.");
    }
}
